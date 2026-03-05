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
const body = document.body;

themeBtn.addEventListener("click", () => {
  const isDark = body.getAttribute("data-theme") === "dark";
  body.setAttribute("data-theme", isDark ? "light" : "dark");
  themeBtn.innerText = isDark ? "🌙 MODO DARK" : "☀️ MODO LIGHT";
  localStorage.setItem("backstage-theme", isDark ? "light" : "dark");
});

// Carregar tema salvo
const savedTheme = localStorage.getItem("backstage-theme") || "light";
body.setAttribute("data-theme", savedTheme);
themeBtn.innerText = savedTheme === "dark" ? "☀️ MODO LIGHT" : "🌙 MODO DARK";

// --- AUTH & CORE ---
function showToast(msg, color = "var(--bitto-blue)") {
  const toast = document.getElementById("toast");
  toast.innerText = msg;
  toast.style.background = color;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}

onAuthStateChanged(auth, (user) => {
  if (user && user.email.toLowerCase() === SEU_EMAIL_ADMIN.toLowerCase()) {
    body.style.display = "block";
    carregarDadosSheets();
  } else {
    window.location.href = "index.html";
  }
});

// ATIVAÇÃO FIREBASE
document.getElementById("btnLiberar")?.addEventListener("click", async () => {
  const email = document.getElementById("userEmail").value.trim().toLowerCase();
  if (!email) return showToast("E-mail vazio!", "#f43f5e");
  try {
    const q = query(collection(db, "users"), where("email", "==", email));
    const snap = await getDocs(q);
    if (snap.empty) throw new Error("Não encontrado.");
    const exp = new Date();
    exp.setDate(exp.getDate() + 90);
    await updateDoc(doc(db, "users", snap.docs[0].id), {
      plan: "embaixador",
      subscriptionEnd: Timestamp.fromDate(exp),
    });
    showToast("🚀 Acesso liberado!", "var(--bitto-blue)");
    document.getElementById("userEmail").value = "";
  } catch (e) {
    showToast(e.message, "#f43f5e");
  }
});

// CRM LOGIC
window.updateSheets = async (insta, tipo, valor, extra = {}) => {
  await fetch(URL_SHEETS, {
    method: "POST",
    mode: "no-cors",
    body: JSON.stringify({ action: "update", insta, tipo, valor, ...extra }),
  });
  showToast("Sincronizando...", "var(--text-main)");
  setTimeout(carregarDadosSheets, 1500);
};

async function carregarDadosSheets() {
  const lista = document.getElementById("listaInfluencers");
  lista.innerHTML =
    "<tr><td colspan='6' style='text-align:center; padding: 50px; color: var(--text-muted)'>Carregando pipeline do Backstage...</td></tr>";

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
                    <div style="font-weight: 700; color: var(--text-main)">${nome}</div>
                    <div style="color: var(--text-muted); font-size: 0.7rem;">${insta} 
                        <span style="cursor:pointer; color:var(--bitto-blue); font-weight:bold" onclick="copyToAtivador('${nome}')"> [copy]</span>
                    </div>
                </td>
                <td>
                    <select onchange="updateSheets('${insta}', 'status', this.value)" style="width: auto; padding: 4px 8px; font-size: 0.75rem;">
                        <option ${status === "Prospecção" ? "selected" : ""}>Prospecção</option>
                        <option ${status === "Abordagem" ? "selected" : ""}>Abordagem</option>
                        <option ${status === "Negociação" ? "selected" : ""}>Negociação</option>
                        <option ${status === "Ativo" ? "selected" : ""}>Ativo</option>
                    </select>
                </td>
                <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <button onclick="updateSheets('${insta}', 'interacao', ${Number(interacoes) + 1})" style="background: var(--bitto-blue); color:white; border:none; padding: 4px 8px; border-radius:4px; font-size:9px; cursor:pointer">+1 DM</button>
                        <div style="flex: 1; min-width: 60px;">
                            <div style="font-size: 9px; font-weight: 800; margin-bottom: 2px;">${interacoes}/3</div>
                            <div class="progress-track"><div class="progress-fill" style="width:${perc}%"></div></div>
                        </div>
                    </div>
                </td>
                <td>
                    <div style="display: grid; gap: 4px;">
                        <input type="text" placeholder="Link" value="${link || ""}" onblur="updateSheets('${insta}', 'links', this.value, {link: this.value, cupom: '${cupom}'})" style="padding: 4px 8px; font-size: 10px;">
                        <input type="text" placeholder="Cupom" value="${cupom || ""}" onblur="updateSheets('${insta}', 'links', this.value, {link: '${link}', cupom: this.value})" style="padding: 4px 8px; font-size: 10px;">
                    </div>
                </td>
                <td style="text-align:center;">
                    <span style="color:${ativado === "Sim" ? "var(--bitto-green)" : "var(--border)"}; font-size: 1.4rem;">●</span>
                </td>
                <td style="text-align: right;">
                    <button onclick="window.open('https://instagram.com/${insta.replace("@", "")}')" style="background:none; border: 1px solid var(--border); color: var(--text-main); padding: 6px 10px; border-radius:6px; font-size: 10px; cursor:pointer; font-weight:600;">PROFILE ↗</button>
                </td>`;
      lista.appendChild(tr);
    });
  } catch (e) {
    lista.innerHTML =
      "<tr><td colspan='6' style='text-align:center; color: #f43f5e;'>Falha na sincronização com Sheets.</td></tr>";
  }
}

window.copyToAtivador = (e) => {
  document.getElementById("userEmail").value = e;
  showToast("E-mail preparado para ativação!");
};

document.getElementById("btnSync").onclick = carregarDadosSheets;

document.getElementById("btnSalvarInf").onclick = async () => {
  const dados = {
    action: "add",
    nome: document.getElementById("infNome").value,
    insta: document.getElementById("infInsta").value,
    status: document.getElementById("infStatus").value,
  };
  if (!dados.nome || !dados.insta)
    return showToast("Dados incompletos!", "#f43f5e");
  showToast("Registrando lead...");
  await fetch(URL_SHEETS, {
    method: "POST",
    mode: "no-cors",
    body: JSON.stringify(dados),
  });
  setTimeout(carregarDadosSheets, 2000);
};
