import { auth, db, onAuthStateChanged } from "./firebase-init.js"; // Importe do local correto
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const SEU_EMAIL_ADMIN = "usebitto.tech@gmail.com"; // Coloque o e-mail exato do seu login

// O segredo está em observar o estado da autenticação
onAuthStateChanged(auth, (user) => {
  if (user) {
    // Se houver um utilizador, verificamos se é você
    if (user.email === SEU_EMAIL_ADMIN) {
      console.log("Acesso concedido ao Admin:", user.email);
      // Opcional: mostrar o conteúdo da página que estava oculto
      document.body.style.display = "block";
    } else {
      console.error("Tentativa de acesso não autorizada:", user.email);
      window.location.href = "index.html";
    }
  } else {
    // Se o Firebase confirmar que NÃO há ninguém logado, redireciona
    console.log("Nenhum utilizador logado. Redirecionando...");
    window.location.href = "index.html";
  }
});

// Lógica para liberar o influenciador (continua igual)
async function liberarInfluenciador(emailInfluenciador) {
  const q = query(
    collection(db, "users"),
    where("email", "==", emailInfluenciador),
  );
  const querySnapshot = await getDocs(q);

  if (!querySnapshot.empty) {
    const userDoc = querySnapshot.docs[0];
    const userRef = doc(db, "users", userDoc.id);

    const dataExpiracao = new Date();
    dataExpiracao.setDate(dataExpiracao.getDate() + 90);

    await updateDoc(userRef, {
      plan: "pro",
      subscriptionEnd: Timestamp.fromDate(dataExpiracao),
    });
    alert("Acesso liberado para " + emailInfluenciador);
  }
}
