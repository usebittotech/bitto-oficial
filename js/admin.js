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

// --- FEEDBACK VISUAL ---
function showToast(msg, color = "#111") {
  const toast = document.getElementById("toast");
  toast.innerText = msg;
  toast.style.background = color;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}

// --- CONTROLE DE ACESSO ---
onAuthStateChanged(auth, (user) => {
  if (user && user.email.toLowerCase() === SEU_EMAIL_ADMIN.toLowerCase()) {
    document.body.style.display = "flex";
    carregarDadosSheets();
  } else {
    window.location.href = "index.html";
  }
});

// --- ATIVAÇÃO MANUAL FIREBASE (O QUE JÁ FUNCIONAVA) ---
document.getElementById("btnLiberar")?.addEventListener("click", async () => {
  const email = document.getElementById("userEmail").value.trim().toLowerCase();
  const btn = document.getElementById("btnLiberar");

  if (!email) return showToast("Digite um e-mail!", "orange");

  try {
    btn.innerText = "ATIVANDO...";
    btn.disabled = true;

    const q = query(collection(db, "users"), where("email", "==", email));
    const snap = await getDocs(q);

    if (snap.empty) throw new Error("Usuário não cadastrado no app.");

    const exp = new Date();
    exp.setDate(exp.getDate() + 90);

    await updateDoc(doc(db, "users", snap.docs[0].id), {
      plan: "embaixador",
      subscriptionEnd: Timestamp.fromDate(exp),
    });

    showToast("🚀 Plano Ativado com Sucesso!", "#00b884");
    document.getElementById("userEmail").value = "";
  } catch (e) {
    showToast(e.message, "#ff4b4b");
  } finally {
    btn.innerText = "LIBERAR 90 DIAS";
    btn.disabled = false;
  }
});

// --- GESTÃO GOOGLE SHEETS ---

window.updateSheets = async (insta, tipo, valor, extra = {}) => {
  try {
    await fetch(URL_SHEETS, {
      method: "POST",
      body: JSON.stringify({ action: "update", insta, tipo, valor, ...extra }),
    });
    showToast("Planilha atualizada!");
    carregarDadosSheets();
  } catch (e) {
    showToast("Erro ao salvar", "red");
  }
};

async function carregarDadosSheets() {
  const lista = document.getElementById("listaInfluencers");
  lista.innerHTML =
    "<tr><td colspan='6' class='loading-shimmer' style='height:150px'></td></tr>";

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
      const perc = (Math.min(interacoes, 3) / 3) * 100;

      const tr = document.createElement("tr");
      tr.innerHTML = `
                <td>
                    <b>${nome}</b><br>
                    <small>${insta}</small> 
                    <span class="copy-badge" onclick="copyToAtivador('${nome}')">copiar e-mail</span>
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
                    <div class="progress-bar"><div class="progress-fill" style="width:${perc}%"></div></div>
                </td>
                <td>
                    <input type="text" class="input-table" placeholder="Link" value="${link || ""}" onblur="updateSheets('${insta}', 'links', this.value, {campo: 'link', cupom: '${cupom}'})">
                    <input type="text" class="input-table" placeholder="Cupom" value="${cupom || ""}" onblur="updateSheets('${insta}', 'links', this.value, {campo: 'cupom', link: '${link}'})">
                </td>
                <td style="text-align:center; font-weight:bold; color:${ativado === "Sim" ? "#00b884" : "#ccc"}">
                    ${ativado === "Sim" ? "✅ ATIVO" : "PENDENTE"}
                </td>
                <td>
                   <button onclick="window.open('https://instagram.com/${insta.replace("@", "")}')" style="padding:8px; border-radius:10px; border:1px solid #ddd; background:white; cursor:pointer">📸</button>
                </td>
            `;
      lista.appendChild(tr);
    });
  } catch (e) {
    lista.innerHTML = "Erro ao conectar com a planilha.";
  }
}

window.copyToAtivador = (email) => {
  document.getElementById("userEmail").value = email;
  showToast("E-mail pronto para ativação!", "#0035ff");
};

document.getElementById("btnSalvarInf").onclick = async () => {
  const dados = {
    action: "add",
    nome: document.getElementById("infNome").value,
    insta: document.getElementById("infInsta").value,
    nicho: "Geral",
    status: document.getElementById("infStatus").value,
  };
  await fetch(URL_SHEETS, { method: "POST", body: JSON.stringify(dados) });
  carregarDadosSheets();
};

document.getElementById("btnSync").onclick = carregarDadosSheets;
