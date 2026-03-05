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

// --- GESTÃO DE TEMA ---
const themeBtn = document.getElementById("themeBtn");
themeBtn.onclick = () => {
  const isDark = document.body.getAttribute("data-theme") === "dark";
  document.body.setAttribute("data-theme", isDark ? "light" : "dark");
  themeBtn.innerText = isDark ? "Dark Mode" : "Light Mode";
};

function showToast(msg) {
  const t = document.getElementById("toast");
  t.innerText = msg;
  t.style.display = "block";
  setTimeout(() => (t.style.display = "none"), 3000);
}

// --- AUTENTICAÇÃO ---
onAuthStateChanged(auth, (user) => {
  if (user && user.email.toLowerCase() === SEU_EMAIL_ADMIN.toLowerCase()) {
    document.body.style.display = "block";
    carregarDadosSheets();
  } else {
    window.location.href = "index.html";
  }
});

// --- OPERAÇÕES CRM (SHEETS) ---
window.updateSheets = async (insta, tipo, valor, extra = {}) => {
  await fetch(URL_SHEETS, {
    method: "POST",
    mode: "no-cors",
    body: JSON.stringify({ action: "update", insta, tipo, valor, ...extra }),
  });
  showToast("A atualizar planilha...");
  setTimeout(carregarDadosSheets, 2000);
};

window.excluirInfluencer = async (insta) => {
  if (!confirm(`Remover ${insta} permanentemente do CRM?`)) return;
  showToast("Excluindo lead...");
  await fetch(URL_SHEETS, {
    method: "POST",
    mode: "no-cors",
    body: JSON.stringify({ action: "delete", insta }),
  });
  setTimeout(carregarDadosSheets, 1500);
};

async function carregarDadosSheets() {
  const lista = document.getElementById("listaInfluencers");
  lista.innerHTML =
    "<tr><td colspan='6' style='text-align:center; opacity:0.5'>Sincronizando...</td></tr>";

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
      const perc = (Math.min(interacoes, 3) / 3) * 100;
      const tr = document.createElement("tr");

      tr.innerHTML = `
                <td>
                    <div style="font-weight:600">${nome}</div>
                    <div style="font-size:11px; color:var(--text-muted)">${insta} <span onclick="copyToAtivador('${nome}')" style="cursor:pointer; color:var(--bitto-blue)">[copiar]</span></div>
                </td>
                <td>
                    <select onchange="updateSheets('${insta}', 'status', this.value)" style="border:none; font-size:12px; padding:0; background:transparent">
                        <option ${status === "Prospecção" ? "selected" : ""}>Prospecção</option>
                        <option ${status === "Abordagem" ? "selected" : ""}>Abordagem</option>
                        <option ${status === "Negociação" ? "selected" : ""}>Negociação</option>
                        <option ${status === "Ativo" ? "selected" : ""}>Ativo</option>
                    </select>
                </td>
                <td>
                    <div style="display:flex; align-items:center; gap:8px">
                        <button onclick="updateSheets('${insta}', 'interacao', ${Number(interacoes) + 1})" style="background:none; border:1px solid var(--border); border-radius:4px; padding:0 5px; cursor:pointer; font-size:10px">${interacoes}/3 🔥</button>
                        <div class="progress-bar"><div class="progress-fill" style="width:${perc}%"></div></div>
                    </div>
                </td>
                <td>
                    <div style="display:flex; flex-direction:column; gap:4px">
                        <input type="text" placeholder="Link" value="${link || ""}" onblur="updateSheets('${insta}', 'links', this.value, {link: this.value, cupom: '${cupom}'})" style="font-size:10px; padding:4px; margin:0; border:none; border-bottom:1px solid var(--border)">
                        <input type="text" placeholder="Cupom" value="${cupom || ""}" onblur="updateSheets('${insta}', 'links', this.value, {link: '${link}', cupom: this.value})" style="font-size:10px; padding:4px; margin:0; border:none; border-bottom:1px solid var(--border)">
                    </div>
                </td>
                <td style="text-align:center;">
                    <span class="status-dot" style="background:${ativado === "Sim" ? "var(--bitto-green)" : "#ccc"}"></span>
                </td>
                <td style="text-align:right">
                    <button onclick="window.open('https://instagram.com/${insta.replace("@", "")}')" style="background:none; border:none; color:var(--bitto-blue); cursor:pointer; font-size:12px; margin-right:10px">📸</button>
                    <button onclick="excluirInfluencer('${insta}')" style="background:none; border:none; color:#ff4b4b; cursor:pointer; font-size:14px; opacity:0.4">✕</button>
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
  showToast("E-mail copiado!");
};

document.getElementById("btnSync").onclick = carregarDadosSheets;

document.getElementById("btnSalvarInf").onclick = async () => {
  const dados = {
    action: "add",
    nome: document.getElementById("infNome").value,
    insta: document.getElementById("infInsta").value,
    status: document.getElementById("infStatus").value,
  };
  if (!dados.nome || !dados.insta) return showToast("Preencha os campos!");
  showToast("A enviar lead...");
  await fetch(URL_SHEETS, {
    method: "POST",
    mode: "no-cors",
    body: JSON.stringify(dados),
  });
  setTimeout(carregarDadosSheets, 2000);
};

// --- ATIVAÇÃO FIREBASE ---
document.getElementById("btnLiberar")?.addEventListener("click", async () => {
  const email = document.getElementById("userEmail").value.trim().toLowerCase();
  if (!email) return showToast("Digite um e-mail!");
  try {
    const q = query(collection(db, "users"), where("email", "==", email));
    const snap = await getDocs(q);
    if (snap.empty) throw new Error("Usuário não encontrado.");
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
