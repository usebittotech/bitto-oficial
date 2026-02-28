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

  // Na Cakto, o evento e o status ficam em níveis específicos
  const eventName = body.event;
  const data = body.data || {};
  const status = data.status;

  // ACESSO CORRETO AOS DADOS (Segundo a documentação da Cakto)
  const email = data.customer?.email?.toLowerCase().trim();
  const productName = data.product?.name || "";

  console.log(`Evento: ${eventName} | Status: ${status} | Usuário: ${email}`);

  // --- LÓGICA DE APROVAÇÃO (INCLUINDO PIX PARA TESTE) ---
  let isApproved = false;
  if (
    eventName === "purchase_approved" ||
    eventName === "pix_gerado" || // <--- Mantenha apenas para o seu teste
    status === "paid" ||
    status === "approved" ||
    eventName === "subscription_renewed"
  ) {
    isApproved = true;
  }

  if (!isApproved) {
    return res.status(200).json({ message: "Evento ignorado" });
  }

  if (!email) {
    console.error("Payload recebido sem e-mail:", JSON.stringify(body));
    return res
      .status(400)
      .json({ message: "E-mail não encontrado no payload" });
  }

  try {
    // Define a validade com base no nome do produto
    let planType = "monthly";
    let daysToAdd = 30;

    if (productName.toLowerCase().includes("trimestral")) {
      planType = "quarterly";
      daysToAdd = 90;
    }

    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + daysToAdd);

    // Referência do usuário usando o e-mail como ID
    const userRef = doc(db, "users", email);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      // Se o usuário já existe, faz o upgrade do plano
      await updateDoc(userRef, {
        plan: planType,
        subscriptionEnd: Timestamp.fromDate(expirationDate),
        updatedAt: serverTimestamp(),
      });
      console.log(`Upgrade concluído para: ${email}`);
    } else {
      // Se o usuário não existe, cria a conta nova já com o plano ativo
      await setDoc(userRef, {
        email: email,
        name: data.customer?.name || "Usuário Bitto",
        plan: planType,
        subscriptionEnd: Timestamp.fromDate(expirationDate),
        usage: { flashcards: 0, quiz: 0, review: 0 },
        lastReset: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
      console.log(`Nova conta criada e liberada para: ${email}`);
    }

    return res
      .status(200)
      .json({ success: true, message: "Acesso processado" });
  } catch (error) {
    console.error("Erro interno no Firestore:", error);
    return res.status(500).json({ error: error.message });
  }
}
