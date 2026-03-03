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
  addDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const SEU_EMAIL_ADMIN = "usebitto.tech@gmail.com";
const URL_SHEETS =
  "https://script.google.com/macros/s/AKfycbxBFmhAhBOKqPHXEqT9lfWE9rbmYKgyb3gEoUmdxdiG9s_HyIIT8g-mjLC0NSglE7Q/exec";

// --- CONTROLE DE ACESSO ---
onAuthStateChanged(auth, (user) => {
  if (user && user.email.toLowerCase() === SEU_EMAIL_ADMIN.toLowerCase()) {
    document.body.style.display = "flex";
    carregarDadosSheets();
  } else {
    window.location.href = "index.html";
  }
});

// --- LÓGICA DE ATIVAÇÃO MANUAL (RESTAURADA) ---
const btnLiberar = document.getElementById("btnLiberar");
const statusMsg = document.getElementById("statusMsg");
const inputEmail = document.getElementById("userEmail");

btnLiberar?.addEventListener("click", async () => {
  const emailAlvo = inputEmail.value.trim().toLowerCase();
  if (!emailAlvo) return;

  try {
    btnLiberar.innerText = "PROCESSANDO...";
    btnLiberar.disabled = true;

    const q = query(collection(db, "users"), where("email", "==", emailAlvo));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      statusMsg.innerText = "❌ Usuário não encontrado no Firebase.";
      statusMsg.style.color = "red";
      btnLiberar.disabled = false;
      btnLiberar.innerText = "LIBERAR 90 DIAS";
      return;
    }

    const dataExpiracao = new Date();
    dataExpiracao.setDate(dataExpiracao.getDate() + 90);
    const userRef = doc(db, "users", querySnapshot.docs[0].id);

    await updateDoc(userRef, {
      plan: "embaixador",
      subscriptionEnd: Timestamp.fromDate(dataExpiracao),
    });

    statusMsg.innerText = "✅ Ativado com sucesso!";
    statusMsg.style.color = "green";
    inputEmail.value = "";
    btnLiberar.disabled = false;
    btnLiberar.innerText = "LIBERAR 90 DIAS";
  } catch (e) {
    console.error(e);
    statusMsg.innerText = "Erro ao ativar.";
    btnLiberar.disabled = false;
  }
});

// --- CRM / GOOGLE SHEETS ---

// 1. Cadastrar Novo
document.getElementById("btnSalvarInf")?.addEventListener("click", async () => {
  const btn = document.getElementById("btnSalvarInf");
  const dados = {
    action: "add",
    nome: document.getElementById("infNome").value,
    insta: document.getElementById("infInsta").value,
    nicho: document.getElementById("infNicho").value,
    status: document.getElementById("infStatus").value,
  };

  if (!dados.nome || !dados.insta) return alert("Preencha o básico!");

  btn.innerText = "SALVANDO...";
  await fetch(URL_SHEETS, { method: "POST", body: JSON.stringify(dados) });
  btn.innerText = "CADASTRAR NA PLANILHA";
  carregarDadosSheets();
});

// 2. Atualizar Dados (Interação, Status, Links)
window.updateSheets = async (insta, tipo, valor, extra = {}) => {
  await fetch(URL_SHEETS, {
    method: "POST",
    body: JSON.stringify({ action: "update", insta, tipo, valor, ...extra }),
  });
  carregarDadosSheets();
};

// 3. Renderizar Tabela
async function carregarDadosSheets() {
  const lista = document.getElementById("listaInfluencers");
  lista.innerHTML =
    "<tr><td colspan='6' style='text-align:center'>Carregando planilha...</td></tr>";

  try {
    const res = await fetch(URL_SHEETS);
    const influencers = await res.json();
    lista.innerHTML = "";

    influencers.forEach((inf) => {
      const [
        nome,
        insta,
        nicho,
        status,
        interacoes,
        data,
        link,
        cupom,
        ativado,
      ] = inf;
      const tr = document.createElement("tr");
      tr.innerHTML = `
            <td>
                <div class="row-insta">${nome}</div>
                <div class="row-nicho">${insta} | ${nicho}</div>
            </td>
            <td>
                <select class="status-select" onchange="updateSheets('${insta}', 'status', this.value)">
                    <option ${status === "Prospecção" ? "selected" : ""}>Prospecção</option>
                    <option ${status === "Abordagem" ? "selected" : ""}>Abordagem</option>
                    <option ${status === "Negociação" ? "selected" : ""}>Negociação</option>
                    <option ${status === "Ativo" ? "selected" : ""}>Ativo</option>
                </select>
            </td>
            <td>
                <button class="btn-fire" onclick="updateSheets('${insta}', 'interacao', ${Number(interacoes) + 1})">
                    ${interacoes}/3 🔥
                </button>
            </td>
            <td>
                <input type="text" class="input-table" placeholder="Link" value="${link || ""}" onblur="updateSheets('${insta}', 'links', '', {link: this.value, cupom: '${cupom}'})">
                <input type="text" class="input-table" placeholder="Cupom" value="${cupom || ""}" onblur="updateSheets('${insta}', 'links', '', {link: '${link}', cupom: this.value})">
            </td>
            <td style="text-align:center; font-weight:bold; color:${ativado === "Sim" ? "green" : "#ccc"}">
                ${ativado === "Sim" ? "✅ SIM" : "PENDENTE"}
            </td>
            <td>
                <button onclick="window.open('https://instagram.com/${insta.replace("@", "")}')" style="width:auto; padding:5px 15px; background:#eee; color:#333; font-size:10px;">DM</button>
            </td>
        `;
      lista.appendChild(tr);
    });
  } catch (e) {
    lista.innerHTML = "Erro ao carregar dados.";
  }
}

document.getElementById("btnSync").onclick = carregarDadosSheets;
window.updateSheets = updateSheets;
