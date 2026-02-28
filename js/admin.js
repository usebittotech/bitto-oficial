// js/admin.js
import { db, auth } from "./firebase-init.js";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const SEU_EMAIL_ADMIN = "usebitto.tech@gmail.com"; // Altere para o seu e-mail

// Proteção simples: só carrega se for VOCÊ logado
onAuthStateChanged(auth, (user) => {
  if (!user || user.email !== SEU_EMAIL_ADMIN) {
    window.location.href = "index.html"; // Expulsa se não for o admin
  }
});

document.getElementById("btnLiberar").addEventListener("click", async () => {
  const email = document.getElementById("userEmail").value.trim();
  const statusMsg = document.getElementById("statusMsg");

  if (!email) return alert("Digite um e-mail");

  try {
    // 1. Busca o usuário pelo e-mail
    const q = query(collection(db, "users"), where("email", "==", email));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      statusMsg.innerText = "Usuário não encontrado!";
      return;
    }

    // 2. Calcula 90 dias a partir de hoje
    const hoje = new Date();
    const dataExpiracao = new Date();
    dataExpiracao.setDate(hoje.getDate() + 90);

    // 3. Atualiza o documento no Firestore
    const userDoc = querySnapshot.docs[0];
    const userRef = doc(db, "users", userDoc.id);

    await updateDoc(userRef, {
      plan: "pro", // Ou "influencer"
      subscriptionEnd: Timestamp.fromDate(dataExpiracao),
    });

    statusMsg.innerText = `Sucesso! Acesso liberado até ${dataExpiracao.toLocaleDateString()}`;
    statusMsg.style.color = "green";
  } catch (error) {
    console.error(error);
    statusMsg.innerText = "Erro ao atualizar.";
  }
});
