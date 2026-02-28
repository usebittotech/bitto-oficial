import {
  auth,
  db,
  onAuthStateChanged,
  doc,
  updateDoc,
  serverTimestamp,
} from "./firebase-init.js";
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const SEU_EMAIL_ADMIN = "seu-email@exemplo.com"; // <--- COLOQUE SEU EMAIL AQUI

onAuthStateChanged(auth, (user) => {
  if (user && user.email === SEU_EMAIL_ADMIN) {
    document.body.style.display = "flex";
    console.log("Admin autenticado.");
  } else {
    window.location.href = "index.html";
  }
});

document.getElementById("btnLiberar").addEventListener("click", async () => {
  const emailInput = document
    .getElementById("userEmail")
    .value.trim()
    .toLowerCase();
  const statusMsg = document.getElementById("statusMsg");
  const btn = document.getElementById("btnLiberar");

  if (!emailInput) {
    statusMsg.innerText = "Por favor, digite um e-mail.";
    statusMsg.className = "error-msg";
    return;
  }

  try {
    btn.disabled = true;
    btn.innerText = "PROCESSANDO...";
    statusMsg.innerText = "Buscando usuário...";

    // 1. Localiza o usuário pelo campo 'email' no Firestore
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", "==", emailInput));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      statusMsg.innerText = "Usuário não encontrado no banco de dados.";
      statusMsg.className = "error-msg";
      btn.disabled = false;
      btn.innerText = "ATIVAR 90 DIAS";
      return;
    }

    // 2. Define a data de expiração (Hoje + 90 dias)
    const dataExpiracao = new Date();
    dataExpiracao.setDate(dataExpiracao.getDate() + 90);

    // 3. Atualiza o documento
    const userDoc = querySnapshot.docs[0];
    const userRef = doc(db, "users", userDoc.id);

    await updateDoc(userRef, {
      plan: "embaixador", // Nome do novo plano
      subscriptionEnd: Timestamp.fromDate(dataExpiracao),
      lastUpgrade: serverTimestamp(),
    });

    statusMsg.innerText = `Sucesso! Plano 'Embaixador' ativo até ${dataExpiracao.toLocaleDateString()}`;
    statusMsg.className = "success-msg";
    btn.style.background = "#00b884";
    btn.innerText = "ATIVADO COM SUCESSO";
  } catch (error) {
    console.error("Erro ao atualizar:", error);
    statusMsg.innerText = "Erro técnico. Verifique o console.";
    statusMsg.className = "error-msg";
    btn.disabled = false;
  }
});
