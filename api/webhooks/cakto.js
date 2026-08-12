import admin from "firebase-admin";
import crypto from "crypto";

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

// Compara duas strings em tempo constante (evita timing attack na comparação do secret)
function safeCompare(a, b) {
  const bufA = Buffer.from(String(a || ""));
  const bufB = Buffer.from(String(b || ""));
  if (bufA.length !== bufB.length) {
    // Ainda assim compara contra si mesma para manter tempo constante
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

// ========== EVENTO DE COMPRA NO GA4 (server-side, via Measurement Protocol) ==========
// Mais confiável que rastrear no client: não depende do usuário voltar ao site
// depois de pagar, e não é bloqueado por AdBlock. Requer GA4_MEASUREMENT_ID e
// GA4_API_SECRET configurados no ambiente (Google Analytics 4 -> Admin ->
// Fluxos de dados -> seu stream -> "Medição de eventos" -> "Criar" chave de API).
async function sendGA4PurchaseEvent({ uid, value, currency, transactionId, planType }) {
  const measurementId = process.env.GA4_MEASUREMENT_ID;
  const apiSecret = process.env.GA4_API_SECRET;
  if (!measurementId || !apiSecret) {
    console.warn("ℹ️ GA4_MEASUREMENT_ID/GA4_API_SECRET não configurados — evento de compra não enviado ao GA4.");
    return;
  }
  try {
    await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`,
      {
        method: "POST",
        body: JSON.stringify({
          client_id: uid, // usa o UID do Firebase como client_id estável por usuário
          events: [
            {
              name: "purchase",
              params: {
                transaction_id: transactionId,
                value: value,
                currency: currency || "BRL",
                items: [{ item_id: planType, item_name: `Plano ${planType}` }],
              },
            },
          ],
        }),
      }
    );
  } catch (e) {
    console.error("Falha ao enviar evento 'purchase' para o GA4:", e.message);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const payload = req.body;
  const data = payload.data || payload;
  const eventName = payload.event || data.event || "";
  const status = data.status || data.state || "";

  // ========== VALIDAÇÃO DO WEBHOOK (Cakto envia "secret" no corpo do payload) ==========
  const expectedSecret = process.env.CAKTO_WEBHOOK_SECRET;
  if (!expectedSecret) {
    console.error("🔥 CAKTO_WEBHOOK_SECRET não configurado no ambiente. Recusando webhook por segurança.");
    return res.status(500).json({ error: "Webhook secret não configurado no servidor." });
  }
  const receivedSecret = payload.secret;
  if (!receivedSecret || !safeCompare(receivedSecret, expectedSecret)) {
    console.warn("⛔ Webhook recusado: secret ausente ou inválido.");
    return res.status(401).json({ error: "Assinatura do webhook inválida." });
  }

  const userEmail =
    data.customer?.email || data.client?.email || data.payer?.email;
  const userName =
    data.customer?.name || data.client?.name || "Estudante BITTO";
  const customerId = data.customer?.id || data.client?.id || null;

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📨 WEBHOOK CAKTO RECEBIDO
  Evento : ${eventName}
  Status : ${status}
  Email  : ${userEmail}
  ID     : ${customerId}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);

  if (!userEmail) {
    console.log("❌ Ignorado: Email não encontrado no payload");
    return res.json({ message: "Email missing" });
  }

  // ========== REVOGAÇÃO ==========
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

  // ========== VERIFICAR APROVAÇÃO ==========
  const isApproved =
    eventName === "purchase_approved" ||
    eventName === "subscription_renewed" ||
    status === "paid" ||
    status === "approved";

  if (!isApproved) {
    console.log(`⏳ Evento [${eventName}] — aguardando pagamento`);
    return res.json({ message: "Payment pending" });
  }

  // ========== PROCESSAR PAGAMENTO APROVADO ==========
  try {
    const productName = data.product?.name || data.offer?.name || "";
    const orderId = data.id || data.order_id || `webhook_${Date.now()}`;

    console.log(
      `💰 PAGAMENTO CONFIRMADO! Produto: "${productName}" | Order: ${orderId}`,
    );

    // DETERMINAR PLANO
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

    const now = new Date();
    const endDate = new Date(
      now.getTime() + monthsToAdd * 30 * 24 * 60 * 60 * 1000,
    );

    console.log(
      `📅 Plano: ${planType.toUpperCase()} | ${monthsToAdd} mês(es) | Vence: ${endDate.toLocaleDateString("pt-BR")}`,
    );

    // BUSCAR OU CRIAR USUÁRIO
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

    // Histórico usa ISO string — serverTimestamp() não funciona dentro de arrays
    const historyEntry = {
      plan: planType,
      startDate: now.toISOString(),
      endDate: endDate.toISOString(),
      orderId: orderId,
    };

    const userData = {
      name: userName,
      email: userEmail,
      plan: planType,
      subscriptionEnd: admin.firestore.Timestamp.fromDate(endDate),
      subscriptionStatus: "active",
      billingCycle: planType,
      customerId: customerId,
      lastPaymentDate: admin.firestore.FieldValue.serverTimestamp(),
      lastPaymentId: orderId,
      lastPaymentEvent: eventName,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      subscriptionHistory: admin.firestore.FieldValue.arrayUnion(historyEntry),
    };

    if (isNewUser) {
      userData.createdAt = admin.firestore.FieldValue.serverTimestamp();
      userData.usage = { flashcards: 0, quiz: 0, review: 0 };
      userData.xp = 0;
    }

    await db
      .collection("users")
      .doc(userRecord.uid)
      .set(userData, { merge: true });

    // Envia o evento de compra confirmada para o GA4 (não bloqueia a resposta do webhook)
    const amountRaw = data.amount ?? data.baseAmount ?? data.price ?? 0;
    // A Cakto costuma enviar valores em centavos, como a maioria dos gateways BR —
    // ajuste aqui se confirmar que o valor já vem em reais no seu payload real.
    const amountInReais = amountRaw > 1000 ? amountRaw / 100 : amountRaw;
    sendGA4PurchaseEvent({
      uid: userRecord.uid,
      value: amountInReais,
      currency: "BRL",
      transactionId: orderId,
      planType,
    });

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
