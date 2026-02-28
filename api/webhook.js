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
  // A Cakto envia os dados via POST
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Método não permitido" });
  }

  const body = req.body;

  // Extração de dados conforme padrão da Cakto
  const eventName = body.event; // pix_gerado, purchase_approved, etc.
  const status = body.data?.status;
  const email = body.data?.email?.toLowerCase();
  const productName = body.data?.product_name || "";

  console.log(`Evento recebido: ${eventName} | Usuário: ${email}`);

  // --- LÓGICA DE SEGURANÇA E TESTE ---
  let isApproved = false;

  // Configurado para aprovar se o pagamento for confirmado OU se um PIX for gerado (TESTE)
  if (
    eventName === "purchase_approved" ||
    eventName === "pix_gerado" || // <--- LINHA DE TESTE: Libera ao gerar o Pix
    status === "paid" ||
    status === "approved" ||
    eventName === "subscription_renewed"
  ) {
    isApproved = true;
  }

  if (!isApproved) {
    return res.status(200).json({ message: "Evento ignorado (não aprovado)" });
  }

  if (!email) {
    return res.status(400).json({ message: "Email não encontrado no payload" });
  }

  try {
    // Define o tipo de plano e duração com base no produto
    let planType = "monthly";
    let daysToAdd = 30;

    if (productName.toLowerCase().includes("trimestral")) {
      planType = "quarterly";
      daysToAdd = 90;
    }

    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + daysToAdd);

    // Referência do usuário no Firestore
    // Buscamos pelo e-mail ou UID. No webhook, o ideal é usar o email como identificador.
    // Nota: Esta lógica assume que o UID no Firebase é o próprio email ou que você fará uma busca.
    // Para simplificar, usaremos o email como ID do documento se for uma nova conta.
    const userRef = doc(db, "users", email);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      // Se o usuário já existe, apenas faz o upgrade do plano
      await updateDoc(userRef, {
        plan: planType,
        subscriptionEnd: Timestamp.fromDate(expirationDate),
        updatedAt: serverTimestamp(),
      });
      console.log(`Plano atualizado para ${email} até ${expirationDate}`);
    } else {
      // Se o usuário não existe, cria a conta Pro direto
      await setDoc(userRef, {
        email: email,
        plan: planType,
        subscriptionEnd: Timestamp.fromDate(expirationDate),
        usage: { flashcards: 0, quiz: 0, review: 0 },
        lastReset: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
      console.log(`Nova conta Pro criada para ${email}`);
    }

    return res
      .status(200)
      .json({ success: true, message: "Acesso liberado com sucesso" });
  } catch (error) {
    console.error("Erro no processamento do webhook:", error);
    return res.status(500).json({ error: error.message });
  }
}
