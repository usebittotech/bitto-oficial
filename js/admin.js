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

// --- ACTIONS ---
window.updateSheets = async (insta, tipo, valor, extra = {}) => {
  await fetch(URL_SHEETS, {
    method: "POST",
    mode: "no-cors",
    body: JSON.stringify({ action: "update", insta, tipo, valor, ...extra }),
  });
  showToast("Synchronized");
  setTimeout(carregarDadosSheets, 1500);
};

window.excluirInfluencer = async (insta) => {
  if (!confirm(`Remove ${insta}?`)) return;
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
    "<div style='font-size:12px; opacity:0.5'>Authenticating data nodes...</div>";

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
      row.className = "data-row";
      row.innerHTML = `
                <div style="display:flex; flex-direction:column;">
                    <span style="font-weight: 600; font-size: 14px; cursor:pointer" onclick="copyToAtivador('${nome}')">${nome}</span>
                    <span style="font-size: 11px; color: var(--text-muted);">${insta}</span>
                </div>
                <div>
                    <select onchange="updateSheets('${insta}', 'status', this.value)" style="border:none; background:transparent; font-size:12px; font-weight:500; color:var(--text-muted);">
                        <option ${status === "Prospecção" ? "selected" : ""}>Prospecção</option>
                        <option ${status === "Ativo" ? "selected" : ""}>Ativo</option>
                    </select>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                    ${ativado === "Sim" ? '<div class="active-glow"></div>' : ""}
                    <span class="badge-status">${ativado === "Sim" ? "Enabled" : "Draft"}</span>
                </div>
                <div style="text-align:right; opacity:0.3; cursor:pointer; font-size:14px;" onclick="excluirInfluencer('${insta}')">✕</div>
            `;
      container.appendChild(row);
    });
  } catch (e) {
    console.error(e);
  }
}

window.copyToAtivador = (e) => {
  document.getElementById("userEmail").value = e;
  showToast("User ID prepared for activation");
};

// ... Funções de Salvar Lead e Liberar Firebase continuam ...
