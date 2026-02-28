import {
  auth,
  db,
  onAuthStateChanged,
  doc,
  updateDoc,
} from "./firebase-init.js";
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// E-mail administrativo autorizado
const SEU_EMAIL_ADMIN = "usebitto.tech@gmail.com";

// 1. Controle de Acesso à Página
onAuthStateChanged(auth, (user) => {
  if (user && user.email.toLowerCase() === SEU_EMAIL_ADMIN.toLowerCase()) {
    console.log("Admin autenticado.");
    document.body.style.display = "flex"; // Mostra o HTML
  } else {
    console.warn("Acesso negado. Redirecionando...");
    window.location.href = "index.html"; // Expulsa se não for admin
  }
});

// 2. Lógica de Upgrade do Plano
const btnLiberar = document.getElementById("btnLiberar");
const statusMsg = document.getElementById("statusMsg");
const inputEmail = document.getElementById("userEmail");

if (btnLiberar) {
  btnLiberar.addEventListener("click", async () => {
    const emailAlvo = inputEmail.value.trim().toLowerCase();

    if (!emailAlvo) {
      statusMsg.innerText = "Por favor, insira um e-mail.";
      statusMsg.className = "error";
      return;
    }

    try {
      btnLiberar.disabled = true;
      statusMsg.innerText = "Buscando usuário...";
      statusMsg.className = "";

      // Busca o usuário na coleção 'users' pelo campo 'email'
      const q = query(collection(db, "users"), where("email", "==", emailAlvo));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        statusMsg.innerText = "Usuário não encontrado!";
        statusMsg.className = "error";
        btnLiberar.disabled = false;
        return;
      }

      // Define a validade para 90 dias a partir de agora
      const dataExpiracao = new Date();
      dataExpiracao.setDate(dataExpiracao.getDate() + 90);

      // Pega o ID do documento encontrado
      const userDoc = querySnapshot.docs[0];
      const userRef = doc(db, "users", userDoc.id);

      // Atualiza o plano e a data no Firestore
      await updateDoc(userRef, {
        plan: "embaixador",
        subscriptionEnd: Timestamp.fromDate(dataExpiracao),
      });

      statusMsg.innerText = "Sucesso! Plano 'Embaixador' ativo por 90 dias.";
      statusMsg.className = "success";
      btnLiberar.innerText = "ATIVADO COM SUCESSO";
      btnLiberar.style.background = "#00b884";
    } catch (error) {
      console.error("Erro ao atualizar:", error);
      statusMsg.innerText = "Erro: " + error.message;
      statusMsg.className = "error";
      btnLiberar.disabled = false;
    }
  });
}
