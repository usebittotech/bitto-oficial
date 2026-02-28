import { db } from "./js/firebase-init.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  collection,
  query,
  where,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Método não permitido" });
  }

  const body = req.body;

  // Mapeamento correto conforme a documentação da Cakto
  const eventName = body.event;
  const data = body.data || {};
  const status = data.status;

  // Acesso aos dados do cliente e produto
  const email = data.customer?.email?.toLowerCase().trim();
  const productName = data.product?.name || "";

  console.log(`Evento: ${eventName} | Status: ${status} | Usuário: ${email}`);

  // --- LÓGICA DE APROVAÇÃO (CONFIGURADA PARA TESTE) ---
  let isApproved = false;
  if (
    eventName === "purchase_approved" ||
    eventName === "pix_gerado" || // <--- REMOVER após testar a criação de conta
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
    return res
      .status(400)
      .json({ message: "E-mail não encontrado no payload" });
  }

  try {
    // Cálculo de validade do plano
    let planType = "monthly";
    let daysToAdd = 30;

    if (productName.toLowerCase().includes("trimestral")) {
      planType = "quarterly";
      daysToAdd = 90;
    }

    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + daysToAdd);

    // --- BUSCA INTELIGENTE POR E-MAIL ---
    // Buscamos em toda a coleção para evitar duplicidade entre UID e E-mail
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", "==", email));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      // CASO 1: USUÁRIO JÁ EXISTE (Muda de Free para Pago)
      const userDoc = querySnapshot.docs[0];
      const userRef = doc(db, "users", userDoc.id);

      await updateDoc(userRef, {
        plan: planType,
        subscriptionEnd: Timestamp.fromDate(expirationDate),
        updatedAt: serverTimestamp(),
      });
      console.log(`Upgrade concluído para usuário existente: ${email}`);
    } else {
      // CASO 2: USUÁRIO NOVO (Cria a conta usando o E-mail como ID do documento)
      const userRef = doc(db, "users", email);
      await setDoc(userRef, {
        email: email,
        name: data.customer?.name || "Usuário Bitto",
        plan: planType,
        subscriptionEnd: Timestamp.fromDate(expirationDate),
        usage: { flashcards: 0, quiz: 0, review: 0 },
        lastReset: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
      console.log(`Nova conta criada via Webhook: ${email}`);
    }

    return res
      .status(200)
      .json({ success: true, message: "Acesso processado com sucesso" });
  } catch (error) {
    console.error("Erro interno no processamento:", error);
    return res.status(500).json({ error: error.message });
  }
}
