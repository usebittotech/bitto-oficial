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

// --- THEME ---
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
  setTimeout(() => (t.style.display = "none"), 2500);
}

// --- AUTH ---
onAuthStateChanged(auth, (user) => {
  if (user && user.email.toLowerCase() === SEU_EMAIL_ADMIN.toLowerCase()) {
    document.body.style.display = "block";
    carregarDadosSheets();
  } else {
    window.location.href = "index.html";
  }
});

// --- CRM FUNCTIONS ---
window.updateSheets = async (insta, tipo, valor, extra = {}) => {
  await fetch(URL_SHEETS, {
    method: "POST",
    mode: "no-cors",
    body: JSON.stringify({ action: "update", insta, tipo, valor, ...extra }),
  });
  showToast("Saving...");
  setTimeout(carregarDadosSheets, 1500);
};

window.excluirInfluencer = async (insta) => {
  if (!confirm(`Excluir ${insta}?`)) return;
  await fetch(URL_SHEETS, {
    method: "POST",
    mode: "no-cors",
    body: JSON.stringify({ action: "delete", insta }),
  });
  carregarDadosSheets();
};

async function carregarDadosSheets() {
  const container = document.getElementById("listaInfluencers");
  container.innerHTML =
    "<div style='font-size:12px; padding:20px; color:var(--text-muted)'>Sincronizando workspace...</div>";

  try {
    const res = await fetch(URL_SHEETS, { redirect: "follow" });
    const influencers = await res.json();
    container.innerHTML = "";

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
      const row = document.createElement("div");
      row.className = "database-item";
      row.innerHTML = `
        <div style="font-size: 14px; font-weight: 500;">
          <span style="cursor:pointer" onclick="copyToAtivador('${nome}')">📄</span> ${nome}
          <span style="font-size: 12px; color: var(--text-muted); margin-left: 10px;">${insta}</span>
        </div>
        <div>
          <select onchange="updateSheets('${insta}', 'status', this.value)" style="border:none; font-size:12px; color:var(--text-muted); padding:0">
            <option ${status === "Prospecção" ? "selected" : ""}>Prospecção</option>
            <option ${status === "Abordagem" ? "selected" : ""}>Abordagem</option>
            <option ${status === "Ativo" ? "selected" : ""}>Ativo</option>
          </select>
        </div>
        <div>
          <span class="status-pill">
            <span class="active-dot" style="background:${ativado === "Sim" ? "var(--bitto-green)" : "#ccc"}"></span>
            ${ativado === "Sim" ? "Ativo" : "Pendente"}
          </span>
        </div>
        <div style="text-align:right; cursor:pointer; font-size:12px; opacity:0.3" onclick="excluirInfluencer('${insta}')">✕</div>
      `;
      container.appendChild(row);
    });
  } catch (e) {
    console.error(e);
  }
}

window.copyToAtivador = (e) => {
  document.getElementById("userEmail").value = e;
  showToast("Email movido para ativação");
};

// ... Funções de Salvar Lead e Liberar Firebase ...
