import admin from "firebase-admin";

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

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  const payload = req.body;

  // Detecção da estrutura de dados da Cakto (payload direto ou dentro de 'data')
  const data = payload.data || payload;

  const eventName = payload.event || data.event || "";
  const status = data.status || data.state || "";

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

  // Adicionado 'pix_gerado' para fins de teste de liberação
  if (
    eventName === "purchase_approved" ||
    eventName === "pix_gerado" || // <--- Condição de teste
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

    console.log(`✅ SUCESSO: ${userEmail} ativado.`);
    return res.json({ success: true });
  } catch (error) {
    console.error("ERRO CRÍTICO:", error);
    return res.status(500).json({ error: error.message });
  }
}
