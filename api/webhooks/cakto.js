import admin from "firebase-admin";
import crypto from "crypto";

// ========== INICIALIZAR FIREBASE ==========
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const db = admin.firestore();
const auth = admin.auth();

// ========== VALIDAÇÃO DE ASSINATURA ==========
function validateCaktoSignature(payload, signature) {
  if (!process.env.CAKTO_WEBHOOK_SECRET) {
    console.warn("⚠️  CAKTO_WEBHOOK_SECRET não configurado");
    return true;
  }

  const expectedSignature = crypto
    .createHmac("sha256", process.env.CAKTO_WEBHOOK_SECRET)
    .update(JSON.stringify(payload))
    .digest("hex");

  return signature === expectedSignature;
}

// ========== HANDLER PRINCIPAL ==========
export default async function handler(req, res) {
  // 1. VERIFICAR MÉTODO HTTP
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // 2. VALIDAR ASSINATURA CAKTO
  const receivedSignature = req.headers["x-cakto-signature"];
  if (!validateCaktoSignature(req.body, receivedSignature)) {
    console.error("❌ Webhook rejeitado: assinatura inválida");
    return res.status(401).json({ error: "Unauthorized" });
  }

  const payload = req.body;
  const data = payload.data || payload;
  const eventName = payload.event || data.event || "";
  const status = data.status || data.state || "";

  // 3. EXTRAIR DADOS DO CLIENTE
  const userEmail =
    data.customer?.email || data.client?.email || data.payer?.email;
  const userName =
    data.customer?.name || data.client?.name || "Estudante BITTO";
  const customerId = data.customer?.id || data.client?.id;

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📨 WEBHOOK CAKTO RECEBIDO
  Evento: ${eventName}
  Status: ${status}
  Email: ${userEmail}
  ID: ${customerId}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);

  // 4. VALIDAR EMAIL
  if (!userEmail) {
    console.log("❌ Ignorado: Email não encontrado no payload");
    return res.json({ message: "Email missing" });
  }

  // 5. ========== LÓGICA DE REVOGAÇÃO ==========
  if (
    ["refund", "chargeback", "purchase_refused"].includes(eventName) ||
    status === "refunded" ||
    status === "refused"
  ) {
    console.log(`⛔ REVOGANDO ACESSO: ${userEmail}`);

    try {
      const userRecord = await auth.getUserByEmail(userEmail);

      await db.collection("users").doc(userRecord.uid).update({
        plan: "free",
        subscriptionEnd: null,
        subscriptionStatus: "revoked",
        lastStatus: eventName,
        revokedAt: admin.firestore.FieldValue.serverTimestamp(),
        revokedReason: eventName,
      });

      console.log(`✅ Acesso revogado com sucesso para: ${userEmail}`);
      return res.json({ success: true, action: "revoked" });
    } catch (e) {
      console.error(`❌ Erro ao revogar acesso: ${e.message}`);
      return res.json({ message: "User not found for revoke" });
    }
  }

  // 6. ========== APROVAR PAGAMENTO ==========
  let isApproved = false;

  if (
    eventName === "purchase_approved" ||
    status === "paid" ||
    status === "approved" ||
    eventName === "subscription_renewed"
  ) {
    isApproved = true;
  } else {
    console.log(`⏳ Evento [${eventName}] recebido, mas aguardando pagamento`);
    return res.json({ message: "Payment pending" });
  }

  // 7. ========== PROCESSAR PAGAMENTO APROVADO ==========
  try {
    const productName = data.product?.name || data.offer?.name || "";
    const orderId = data.id || data.order_id;

    console.log(
      `💰 PAGAMENTO CONFIRMADO! Produto: ${productName} | Order: ${orderId}`,
    );

    // ===== DETERMINAR TIPO DE PLANO =====
    let monthsToAdd = 1;
    let planType = "monthly";

    if (
      productName.toLowerCase().includes("trimestral") ||
      productName.toLowerCase().includes("quarterly") ||
      productName.toLowerCase().includes("3 meses")
    ) {
      monthsToAdd = 3;
      planType = "quarterly";
    } else if (
      productName.toLowerCase().includes("anual") ||
      productName.toLowerCase().includes("annual") ||
      productName.toLowerCase().includes("yearly") ||
      productName.toLowerCase().includes("12 meses")
    ) {
      monthsToAdd = 12;
      planType = "annual";
    }

    // ===== CALCULAR DATA DE EXPIRAÇÃO =====
    const now = new Date();
    const endDate = new Date(
      now.getTime() + monthsToAdd * 30 * 24 * 60 * 60 * 1000,
    );

    console.log(
      `📅 Plano: ${planType.toUpperCase()} | Duração: ${monthsToAdd} mês(es) | Vencimento: ${endDate.toLocaleDateString("pt-BR")}`,
    );

    // ===== BUSCAR OU CRIAR USUÁRIO =====
    let userRecord;
    let isNewUser = false;

    try {
      userRecord = await auth.getUserByEmail(userEmail);
      console.log(`👤 Usuário existente encontrado: ${userRecord.uid}`);
    } catch (error) {
      if (error.code === "auth/user-not-found") {
        console.log(`➕ Criando novo usuário: ${userEmail}`);

        userRecord = await auth.createUser({
          email: userEmail,
          emailVerified: true,
          displayName: userName,
        });

        isNewUser = true;
        console.log(`✅ Novo usuário criado: ${userRecord.uid}`);
      } else {
        throw error;
      }
    }

    // ===== ATUALIZAR/CRIAR DOCUMENTO NO FIRESTORE =====
    const userData = {
      name: userName,
      email: userEmail,
      plan: planType,
      subscriptionEnd: admin.firestore.Timestamp.fromDate(endDate),
      subscriptionStatus: "active",
      billingCycle: planType,
      customerId: customerId,
      lastPaymentDate: admin.firestore.FieldValue.serverTimestamp(),
      lastPaymentId: orderId || `webhook_${Date.now()}`,
      lastPaymentEvent: eventName,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Se é novo usuário, inicializar campos adicionais
    if (isNewUser) {
      userData.createdAt = admin.firestore.FieldValue.serverTimestamp();
      userData.usage = { flashcards: 0, quiz: 0, review: 0 };
      userData.xp = 0;
      userData.subscriptionHistory = [
        {
          plan: planType,
          startDate: admin.firestore.FieldValue.serverTimestamp(),
          endDate: admin.firestore.Timestamp.fromDate(endDate),
          orderId: orderId,
        },
      ];
    } else {
      // Se é usuário existente, apenas atualizar
      userData.subscriptionHistory = admin.firestore.FieldValue.arrayUnion({
        plan: planType,
        startDate: admin.firestore.FieldValue.serverTimestamp(),
        endDate: admin.firestore.Timestamp.fromDate(endDate),
        orderId: orderId,
      });
    }

    // Salvar no Firestore
    await db
      .collection("users")
      .doc(userRecord.uid)
      .set(userData, { merge: true });

    console.log(`
✅ ✅ ✅ SUCESSO ✅ ✅ ✅
  Email: ${userEmail}
  UID: ${userRecord.uid}
  Plano: ${planType.toUpperCase()}
  Válido até: ${endDate.toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })}
  Order ID: ${orderId}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        `);

    return res.json({
      success: true,
      plan: planType,
      expiresAt: endDate.toISOString(),
      userId: userRecord.uid,
    });
  } catch (error) {
    console.error(`
🔥 🔥 🔥 ERRO CRÍTICO 🔥 🔥 🔥
  ${error.message}
  Stack: ${error.stack}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        `);

    return res.status(500).json({
      error: error.message,
      type: error.code,
    });
  }
}
