import admin from "firebase-admin";
import crypto from "crypto";

// Inicializa o Firebase apenas se não estiver inicializado
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY
        ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
        : undefined,
    }),
  });
}

const db = admin.firestore();
const auth = admin.auth();

function safeCompare(a, b) {
  const bufA = Buffer.from(String(a || ""));
  const bufB = Buffer.from(String(b || ""));
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

// ========== EVENTO DE COMPRA NO GA4 (server-side, via Measurement Protocol) ==========
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
          client_id: uid,
          events: [
            {
              name: "purchase",
              params: {
                transaction_id: transactionId,
                value,
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
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  const payload = req.body;

  // Detecção da estrutura de dados da Cakto (payload direto ou dentro de 'data')
  const data = payload.data || payload;

  const eventName = payload.event || data.event || "";
  const status = data.status || data.state || "";

  // ========== VALIDAÇÃO DO WEBHOOK ==========
  const expectedSecret = process.env.CAKTO_WEBHOOK_SECRET;
  if (!expectedSecret) {
    console.error("🔥 CAKTO_WEBHOOK_SECRET não configurado. Recusando por segurança.");
    return res.status(500).json({ error: "Webhook secret não configurado no servidor." });
  }
  if (!payload.secret || !safeCompare(payload.secret, expectedSecret)) {
    console.warn("⛔ Webhook recusado: secret ausente ou inválido.");
    return res.status(401).json({ error: "Assinatura do webhook inválida." });
  }

  // Busca o email em todos os locais possíveis
  const userEmail =
    data.customer?.email || data.client?.email || data.payer?.email;
  const userName = data.customer?.name || data.client?.name || "Estudante VIP";

  console.log(
    `WEBHOOK | Evento: [${eventName}] | Status: [${status}] | Email: [${userEmail}]`,
  );

  if (!userEmail) {
    console.log("❌ Ignorado: Email não encontrado no payload.");
    return res.json({ message: "Email missing" });
  }

  // --- LÓGICA DE SEGURANÇA ---
  let isApproved = false;

  // 1. APROVAÇÃO REAL: Apenas se estiver PAGO ou APROVADO
  if (
    eventName === "purchase_approved" ||
    status === "paid" ||
    status === "approved" ||
    eventName === "subscription_renewed"
  ) {
    isApproved = true;
  }

  // 2. REVOGAÇÃO: Se for reembolso ou cancelamento, removemos o acesso
  else if (
    ["refund", "chargeback", "purchase_refused"].includes(eventName) ||
    status === "refunded" ||
    status === "refused"
  ) {
    console.log(`⛔ REVOGANDO ACESSO de ${userEmail}`);
    try {
      const userRecord = await auth.getUserByEmail(userEmail);
      await db.collection("users").doc(userRecord.uid).set(
        {
          plan: "free",
          subscriptionEnd: null,
          lastStatus: eventName,
        },
        { merge: true },
      );
      return res.json({ success: true, action: "revoked" });
    } catch (e) {
      return res.json({ message: "Usuário não encontrado para revogar." });
    }
  }

  // Se não for aprovado (ex: pix_gerado, waiting_payment), o código para aqui.
  if (!isApproved) {
    console.log(`⏳ Evento [${eventName}] recebido, mas aguardando pagamento.`);
    return res.json({ message: "Aguardando pagamento." });
  }

  try {
    // --- LÓGICA DE PRODUTO (Mensal vs Trimestral) ---
    const productName = data.product?.name || data.offer?.name || "";
    console.log(`💰 Pagamento Confirmado! Produto: ${productName}`);

    let monthsToAdd = 1;
    let planType = "monthly";

    if (productName.toLowerCase().includes("trimestral")) {
      monthsToAdd = 3;
      planType = "quarterly";
    }

    const now = new Date();
    const endDate = new Date();
    endDate.setMonth(now.getMonth() + monthsToAdd);

    // --- FIRESTORE & AUTH ---
    let userRecord;
    let isNewUser = false;

    try {
      userRecord = await auth.getUserByEmail(userEmail);
    } catch (error) {
      if (error.code === "auth/user-not-found") {
        userRecord = await auth.createUser({
          email: userEmail,
          emailVerified: true,
          displayName: userName,
        });
        isNewUser = true;
      } else throw error;
    }

    await db
      .collection("users")
      .doc(userRecord.uid)
      .set(
        {
          name: userName,
          email: userEmail,
          plan: planType,
          subscriptionEnd: admin.firestore.Timestamp.fromDate(endDate),
          lastPaymentId: data.id || `webhook_${Date.now()}`,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          ...(isNewUser && {
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            usage: { flashcards: 0, quiz: 0, review: 0 },
            xp: 0,
          }),
        },
        { merge: true },
      );

    const amountRaw = data.amount ?? data.baseAmount ?? data.price ?? 0;
    const amountInReais = amountRaw > 1000 ? amountRaw / 100 : amountRaw;
    sendGA4PurchaseEvent({
      uid: userRecord.uid,
      value: amountInReais,
      currency: "BRL",
      transactionId: data.id || `webhook_${Date.now()}`,
      planType,
    });

    console.log(`✅ SUCESSO: ${userEmail} ativado.`);
    return res.json({ success: true });
  } catch (error) {
    console.error("ERRO CRÍTICO:", error);
    return res.status(500).json({ error: error.message });
  }
}
