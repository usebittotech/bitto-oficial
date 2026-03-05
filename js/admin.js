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

let currentLeadInsta = "";

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

// --- AUTH ---
onAuthStateChanged(auth, (user) => {
  if (user && user.email.toLowerCase() === SEU_EMAIL_ADMIN.toLowerCase()) {
    document.body.style.display = "block";
    carregarDadosSheets();
  } else {
    window.location.href = "index.html";
  }
});

// --- CRM (GOOGLE SHEETS) ---
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
  if (!confirm(`Remover ${insta} permanentemente?`)) return;
  await fetch(URL_SHEETS, {
    method: "POST",
    mode: "no-cors",
    body: JSON.stringify({ action: "delete", insta }),
  });
  carregarDadosSheets();
};

async function carregarDadosSheets() {
  const lista = document.getElementById("listaInfluencers");
  lista.innerHTML =
    "<tr><td colspan='5' style='text-align:center; opacity:0.5'>Carregando...</td></tr>";

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
                    <div style="font-weight:600; cursor:pointer;" onclick="openLeadPeek('${nome}', '${insta}', '${link}', '${cupom}')">${nome}</div>
                    <div style="font-size:11px; color:var(--text-muted)">${insta}</div>
                </td>
                <td>
                    <select onchange="updateSheets('${insta}', 'status', this.value)" style="border:none; font-size:12px; padding:0; background:transparent">
                        <option ${status === "Prospecção" ? "selected" : ""}>Prospecção</option>
                        <option ${status === "Abordagem" ? "selected" : ""}>Abordagem</option>
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
                    <span class="status-dot" style="background:${ativado === "Sim" ? "var(--bitto-green)" : "#ccc"}"></span>
                    <span style="font-size:11px">${ativado === "Sim" ? "Ativo" : "Pendente"}</span>
                </td>
                <td style="text-align:right">
                    <button onclick="excluirInfluencer('${insta}')" style="background:none; border:none; color:#ff4b4b; cursor:pointer; font-size:14px; opacity:0.4">✕</button>
                </td>
            `;
      lista.appendChild(tr);
    });
  } catch (e) {
    console.error(e);
  }
}

// --- SIDE PEEK LOGIC ---
window.togglePeek = (show) => {
  document.getElementById("sidePeek").classList.toggle("open", show);
};

window.openLeadPeek = (nome, insta, link, cupom) => {
  currentLeadInsta = insta;
  document.getElementById("peekName").innerText = nome;
  document.getElementById("peekInsta").innerText = insta;
  document.getElementById("editLink").value = link || "";
  document.getElementById("editCupom").value = cupom || "";
  togglePeek(true);
};

document.getElementById("btnSavePeek").onclick = () => {
  const link = document.getElementById("editLink").value;
  const cupom = document.getElementById("editCupom").value;
  updateSheets(currentLeadInsta, "links", link, { link, cupom });
  togglePeek(false);
};

document.getElementById("btnCopyPeek").onclick = () => {
  document.getElementById("userEmail").value =
    document.getElementById("peekName").innerText;
  showToast("E-mail movido!");
  togglePeek(false);
};

// ... Funções de Salvar Lead e Ativação Firebase permanecem as mesmas ...s
