import admin from "firebase-admin";

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

// ========== HANDLER PRINCIPAL ==========
export default async function handler(req, res) {
  // 1. VERIFICAR MÉTODO HTTP
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // NOTA: A Cakto NÃO envia o "Chave secreta do webhook" em nenhum header.
  // O campo existe na UI da Cakto mas não é usado para assinar os requests.
  // Segurança garantida pela URL privada do endpoint.

  const payload = req.body;
  const data = payload.data || payload;
  const eventName = payload.event || data.event || "";
  const status = data.status || data.state || "";

  // 2. EXTRAIR DADOS DO CLIENTE
  const userEmail =
    data.customer?.email || data.client?.email || data.payer?.email;
  const userName =
    data.customer?.name || data.client?.name || "Estudante BITTO";
  const customerId = data.customer?.id || data.client?.id;

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📨 WEBHOOK CAKTO RECEBIDO
  Evento : ${eventName}
  Status : ${status}
  Email  : ${userEmail}
  ID     : ${customerId}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);

  // 3. VALIDAR EMAIL
  if (!userEmail) {
    console.log("❌ Ignorado: Email não encontrado no payload");
    return res.json({ message: "Email missing" });
  }

  // 4. ========== LÓGICA DE REVOGAÇÃO ==========
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
      console.log(`✅ Acesso revogado: ${userEmail}`);
      return res.json({ success: true, action: "revoked" });
    } catch (e) {
      console.error(`❌ Erro ao revogar: ${e.message}`);
      return res.json({ message: "User not found for revoke" });
    }
  }

  // 5. ========== VERIFICAR SE É PAGAMENTO APROVADO ==========
  const isApproved =
    eventName === "purchase_approved" ||
    eventName === "subscription_renewed" ||
    status === "paid" ||
    status === "approved";

  if (!isApproved) {
    console.log(`⏳ Evento [${eventName}] recebido — aguardando pagamento`);
    return res.json({ message: "Payment pending" });
  }

  // 6. ========== PROCESSAR PAGAMENTO APROVADO ==========
  try {
    const productName = data.product?.name || data.offer?.name || "";
    const orderId = data.id || data.order_id;

    console.log(
      `💰 PAGAMENTO CONFIRMADO! Produto: "${productName}" | Order: ${orderId}`,
    );

    // ===== DETERMINAR TIPO DE PLANO =====
    let monthsToAdd = 1;
    let planType = "monthly";

    const nameLower = productName.toLowerCase();
    if (
      nameLower.includes("trimestral") ||
      nameLower.includes("quarterly") ||
      nameLower.includes("3 meses")
    ) {
      monthsToAdd = 3;
      planType = "quarterly";
    } else if (
      nameLower.includes("anual") ||
      nameLower.includes("annual") ||
      nameLower.includes("yearly") ||
      nameLower.includes("12 meses")
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
      `📅 Plano: ${planType.toUpperCase()} | ${monthsToAdd} mês(es) | Vence: ${endDate.toLocaleDateString("pt-BR")}`,
    );

    // ===== BUSCAR OU CRIAR USUÁRIO NO FIREBASE =====
    let userRecord;
    let isNewUser = false;

    try {
      userRecord = await auth.getUserByEmail(userEmail);
      console.log(`👤 Usuário existente: ${userRecord.uid}`);
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

    // ===== MONTAR DADOS DO USUÁRIO =====
    const userData = {
      name: userName,
      email: userEmail,
      plan: planType,
      subscriptionEnd: admin.firestore.Timestamp.fromDate(endDate),
      subscriptionStatus: "active",
      billingCycle: planType,
      customerId: customerId || null,
      lastPaymentDate: admin.firestore.FieldValue.serverTimestamp(),
      lastPaymentId: orderId || `webhook_${Date.now()}`,
      lastPaymentEvent: eventName,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (isNewUser) {
      userData.createdAt = admin.firestore.FieldValue.serverTimestamp();
      userData.usage = { flashcards: 0, quiz: 0, review: 0 };
      userData.xp = 0;
      userData.subscriptionHistory = [
        {
          plan: planType,
          startDate: admin.firestore.FieldValue.serverTimestamp(),
          endDate: admin.firestore.Timestamp.fromDate(endDate),
          orderId: orderId || null,
        },
      ];
    } else {
      userData.subscriptionHistory = admin.firestore.FieldValue.arrayUnion({
        plan: planType,
        startDate: admin.firestore.FieldValue.serverTimestamp(),
        endDate: admin.firestore.Timestamp.fromDate(endDate),
        orderId: orderId || null,
      });
    }

    // ===== SALVAR NO FIRESTORE =====
    await db
      .collection("users")
      .doc(userRecord.uid)
      .set(userData, { merge: true });

    console.log(`
✅ ✅ ✅ SUCESSO ✅ ✅ ✅
  Email  : ${userEmail}
  UID    : ${userRecord.uid}
  Plano  : ${planType.toUpperCase()}
  Válido até: ${endDate.toLocaleDateString("pt-BR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
  Order  : ${orderId}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);

    return res.json({
      success: true,
      plan: planType,
      expiresAt: endDate.toISOString(),
      userId: userRecord.uid,
    });
  } catch (error) {
    console.error(`🔥 ERRO CRÍTICO: ${error.message}\n${error.stack}`);
    return res.status(500).json({ error: error.message, type: error.code });
  }
}
