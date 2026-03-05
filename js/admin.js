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
  "https://script.google.com/macros/s/AKfycbykeG4jjW0RK9PFQi4aU5ndO1TzQPg-CWMIR6DYFfyWyn3jTCQ-I7HbCm5O-i3w-Bhd/exec";

function showToast(msg) {
  const t = document.getElementById("toast");
  t.innerText = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3000);
}

// --- PROTEÇÃO DE ACESSO ---
onAuthStateChanged(auth, (user) => {
  if (user && user.email.toLowerCase() === SEU_EMAIL_ADMIN.toLowerCase()) {
    document.body.style.display = "block";
    carregarDadosSheets();
  } else {
    window.location.href = "index.html";
  }
});

// --- ATIVAÇÃO FIREBASE (90 DIAS) ---
document.getElementById("btnLiberar")?.addEventListener("click", async () => {
  const email = document.getElementById("userEmail").value.trim().toLowerCase();
  if (!email) return showToast("Digite um e-mail!");

  try {
    const q = query(collection(db, "users"), where("email", "==", email));
    const snap = await getDocs(q);
    if (snap.empty) throw new Error("Usuário não encontrado no Bitto.");

    const exp = new Date();
    exp.setDate(exp.getDate() + 90);

    await updateDoc(doc(db, "users", snap.docs[0].id), {
      plan: "embaixador",
      subscriptionEnd: Timestamp.fromDate(exp),
    });

    showToast("🚀 Acesso Liberado!");
    document.getElementById("userEmail").value = "";
  } catch (e) {
    showToast(e.message);
  }
});

// --- CRM SHEETS ---
window.updateSheets = async (insta, tipo, valor, extra = {}) => {
  await fetch(URL_SHEETS, {
    method: "POST",
    mode: "no-cors",
    body: JSON.stringify({ action: "update", insta, tipo, valor, ...extra }),
  });
  showToast("Sincronizando...");
  setTimeout(carregarDadosSheets, 2000);
};

window.excluirInfluencer = async (insta) => {
  if (!confirm(`Excluir ${insta} da planilha?`)) return;
  await fetch(URL_SHEETS, {
    method: "POST",
    mode: "no-cors",
    body: JSON.stringify({ action: "delete", insta }),
  });
  showToast("Lead removido.");
  setTimeout(carregarDadosSheets, 1500);
};

async function carregarDadosSheets() {
  const lista = document.getElementById("listaInfluencers");
  lista.innerHTML =
    "<tr><td colspan='5' style='text-align:center; opacity:0.5'>Carregando database...</td></tr>";

  try {
    const res = await fetch(URL_SHEETS, { redirect: "follow" });
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
      tr.className = "tr-lead";
      tr.innerHTML = `
        <td>
          <div style="font-weight: 600;">${nome}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted); cursor:pointer" onclick="copyToAtivador('${nome}')">${insta} 📋</div>
        </td>
        <td><span class="status-badge">${status}</span></td>
        <td><div style="font-size: 0.75rem; color: var(--primary-blue); font-weight:700;">${cupom || "Sem Cupom"}</div></td>
        <td style="text-align:center;">
          <div style="display:flex; justify-content:center">
            ${ativado === "Sim" ? '<div class="active-glow"></div>' : '<div style="width:8px; height:8px; border-radius:50%; background:#333;"></div>'}
          </div>
        </td>
        <td style="text-align: right;">
          <button onclick="excluirInfluencer('${insta}')" class="btn-delete">✕</button>
        </td>
      `;
      lista.appendChild(tr);
    });
  } catch (e) {
    console.error(e);
  }
}

window.copyToAtivador = (e) => {
  document.getElementById("userEmail").value = e;
  showToast("E-mail copiado para o ativador!");
};

document.getElementById("btnSync").onclick = carregarDadosSheets;

document.getElementById("btnSalvarInf").onclick = async () => {
  const dados = {
    action: "add",
    nome: document.getElementById("infNome").value,
    insta: document.getElementById("infInsta").value,
    cupom: document.getElementById("infCupom").value,
    status: "Prospecção",
  };
  if (!dados.nome || !dados.insta) return showToast("Dados incompletos!");
  showToast("Enviando lead...");
  await fetch(URL_SHEETS, {
    method: "POST",
    mode: "no-cors",
    body: JSON.stringify(dados),
  });
  setTimeout(carregarDadosSheets, 2000);
};
