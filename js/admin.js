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

const SEU_EMAIL_ADMIN = "usebitto.tech@gmail.com";
const URL_SHEETS =
  "https://script.google.com/macros/s/AKfycbxBFmhAhBOKqPHXEqT9lfWE9rbmYKgyb3gEoUmdxdiG9s_HyIIT8g-mjLC0NSglE7Q/exec";

onAuthStateChanged(auth, (user) => {
  if (user && user.email.toLowerCase() === SEU_EMAIL_ADMIN.toLowerCase()) {
    document.body.style.display = "flex";
    carregarDadosSheets();
  } else {
    window.location.href = "index.html";
  }
});

// FUNÇÃO PARA ATUALIZAR O SHEETS
async function updateSheets(insta, tipo, valor, extra = {}) {
  await fetch(URL_SHEETS, {
    method: "POST",
    body: JSON.stringify({ action: "update", insta, tipo, valor, ...extra }),
  });
  carregarDadosSheets();
}

// LOGICA DE ATIVAÇÃO FIREBASE + CHECK NO SHEETS
window.ativarPlano = async (email, insta) => {
  if (!email) return alert("E-mail não encontrado para este influencer.");
  try {
    const q = query(collection(db, "users"), where("email", "==", email));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) return alert("Usuário não cadastrado no Bitto!");

    const dataExpiracao = new Date();
    dataExpiracao.setDate(dataExpiracao.getDate() + 90);

    await updateDoc(doc(db, "users", querySnapshot.docs[0].id), {
      plan: "embaixador",
      subscriptionEnd: Timestamp.fromDate(dataExpiracao),
    });

    // Marca como Ativado na Planilha
    await updateSheets(insta, "ativado", "Sim");
    alert("Plano Ativado e Planilha Atualizada!");
  } catch (e) {
    alert("Erro: " + e.message);
  }
};

// RENDERIZAR TABELA
async function carregarDadosSheets() {
  const lista = document.getElementById("listaInfluencers");
  const res = await fetch(URL_SHEETS);
  const influencers = await res.json();

  lista.innerHTML = "";
  influencers.forEach((inf) => {
    const [nome, insta, nicho, status, interacoes, data, link, cupom, ativado] =
      inf;
    const tr = document.createElement("tr");
    tr.innerHTML = `
            <td><b>${nome}</b><br><small>${insta}</small></td>
            <td>
                <select onchange="updateSheets('${insta}', 'status', this.value)">
                    <option ${status === "Prospecção" ? "selected" : ""}>Prospecção</option>
                    <option ${status === "Abordagem" ? "selected" : ""}>Abordagem</option>
                    <option ${status === "Negociação" ? "selected" : ""}>Negociação</option>
                    <option ${status === "Ativo" ? "selected" : ""}>Ativo</option>
                </select>
            </td>
            <td>
                <button onclick="updateSheets('${insta}', 'interacao', ${Number(interacoes) + 1})">
                    ${interacoes}/3 🔥
                </button>
            </td>
            <td>
                <input type="text" placeholder="Link" value="${link || ""}" onblur="updateSheets('${insta}', 'links', '', {link: this.value, cupom: '${cupom}'})"><br>
                <input type="text" placeholder="Cupom" value="${cupom || ""}" onblur="updateSheets('${insta}', 'links', '', {link: '${link}', cupom: this.value})">
            </td>
            <td>${ativado === "Sim" ? "✅ Ativo" : `<button onclick="ativarPlano('${nome}', '${insta}')">Ativar 90d</button>`}</td>
        `;
    lista.appendChild(tr);
  });
}

// Expondo funções para o HTML
window.updateSheets = updateSheets;
