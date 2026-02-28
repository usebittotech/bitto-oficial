import { db } from "./js/firebase-init.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Método não permitido" });
  }

  const body = req.body;

  // Na Cakto, os dados costumam vir dentro de body.data
  const data = body.data || body;
  const eventName = body.event || data.event;
  const status = data.status;

  // Busca o e-mail em diferentes locais possíveis do payload da Cakto
  const email = (data.email || data.customer?.email || data.client?.email)
    ?.toLowerCase()
    .trim();
  const productName = data.product_name || "";

  console.log(`Evento: ${eventName} | Status: ${status} | Usuário: ${email}`);

  // --- LÓGICA DE APROVAÇÃO (INCLUINDO PIX PARA TESTE) ---
  let isApproved = false;
  if (
    eventName === "purchase_approved" ||
    eventName === "pix_gerado" || // <--- REMOVER APÓS OS TESTES
    status === "paid" ||
    status === "approved" ||
    eventName === "subscription_renewed"
  ) {
    isApproved = true;
  }

  if (!isApproved) {
    return res
      .status(200)
      .json({ message: "Evento recebido, mas não processado (não aprovado)" });
  }

  if (!email) {
    return res
      .status(400)
      .json({ message: "E-mail não identificado no payload" });
  }

  try {
    // Define a validade (30 ou 90 dias)
    let planType = "monthly";
    let daysToAdd = 30;

    if (productName.toLowerCase().includes("trimestral")) {
      planType = "quarterly";
      daysToAdd = 90;
    }

    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + daysToAdd);

    // --- AÇÃO NO BANCO DE DADOS ---
    // Usamos o EMAIL como ID do documento para facilitar a localização pelo Webhook
    const userRef = doc(db, "users", email);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      // CASO 1: O e-mail já existe (muda de Free para Pago)
      await updateDoc(userRef, {
        plan: planType,
        subscriptionEnd: Timestamp.fromDate(expirationDate),
        updatedAt: serverTimestamp(),
      });
      console.log(`Upgrade concluído: ${email} agora é ${planType}`);
    } else {
      // CASO 2: O e-mail NÃO existe (Cria a conta do zero já como Pago)
      await setDoc(userRef, {
        email: email,
        name: data.customer?.name || "Estudante Bitto",
        plan: planType,
        subscriptionEnd: Timestamp.fromDate(expirationDate),
        usage: { flashcards: 0, quiz: 0, review: 0 },
        lastReset: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
      console.log(`Nova conta criada via Webhook: ${email}`);
    }

    return res.status(200).json({ success: true, message: "Acesso liberado" });
  } catch (error) {
    console.error("Erro no processamento:", error);
    return res.status(500).json({ error: error.message });
  }
}
