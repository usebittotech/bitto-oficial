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

// --- ENGINE DE TEMA ---
const themeBtn = document.getElementById("themeBtn");
const body = document.body;

themeBtn.addEventListener("click", () => {
  const isDark = body.getAttribute("data-theme") === "dark";
  const newTheme = isDark ? "light" : "dark";
  body.setAttribute("data-theme", newTheme);
  localStorage.setItem("backstage-theme", newTheme);
});

// Inicializar tema salvo
const savedTheme = localStorage.getItem("backstage-theme") || "dark";
body.setAttribute("data-theme", savedTheme);

// --- UTILITÁRIOS ---
function showToast(msg, isError = false) {
  const toast = document.getElementById("toast");
  toast.innerText = msg;
  toast.style.borderLeft = isError
    ? "4px solid #ff4b4b"
    : "4px solid var(--bitto-blue)";
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}

// --- CONTROLE DE ACESSO ---
onAuthStateChanged(auth, (user) => {
  if (user && user.email.toLowerCase() === SEU_EMAIL_ADMIN.toLowerCase()) {
    body.style.display = "block";
    carregarDadosSheets();
  } else {
    window.location.href = "index.html";
  }
});

// --- ATIVAÇÃO FIREBASE (PLANO EMBAIXADOR) ---
document.getElementById("btnLiberar")?.addEventListener("click", async () => {
  const email = document.getElementById("userEmail").value.trim().toLowerCase();
  if (!email) return showToast("Digite um e-mail válido!", true);

  try {
    const q = query(collection(db, "users"), where("email", "==", email));
    const snap = await getDocs(q);
    if (snap.empty) throw new Error("Usuário não cadastrado no Bitto.");

    const exp = new Date();
    exp.setDate(exp.getDate() + 90);

    await updateDoc(doc(db, "users", snap.docs[0].id), {
      plan: "embaixador",
      subscriptionEnd: Timestamp.fromDate(exp),
    });

    showToast("🚀 Acesso liberado por 90 dias!");
    document.getElementById("userEmail").value = "";
  } catch (e) {
    showToast(e.message, true);
  }
});

// --- INTEGRAÇÃO GOOGLE SHEETS (CRM) ---
window.updateSheets = async (insta, tipo, valor, extra = {}) => {
  await fetch(URL_SHEETS, {
    method: "POST",
    mode: "no-cors",
    body: JSON.stringify({ action: "update", insta, tipo, valor, ...extra }),
  });
  showToast("Atualizando dados...");
  setTimeout(carregarDadosSheets, 2000);
};

async function carregarDadosSheets() {
  const lista = document.getElementById("listaInfluencers");
  lista.innerHTML =
    "<tr><td colspan='6' style='text-align:center; padding: 40px; opacity: 0.5'>Sincronizando com a nuvem...</td></tr>";

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
                    <div style="font-weight: 700;">${nome}</div>
                    <div style="font-size: 0.7rem; color: var(--text-muted);">${insta} 
                        <span style="color: var(--bitto-blue); cursor:pointer; font-weight:bold;" onclick="copyToAtivador('${nome}')">[copiar]</span>
                    </div>
                </td>
                <td>
                    <select onchange="updateSheets('${insta}', 'status', this.value)" style="margin:0; padding: 5px; font-size: 11px; width: auto;">
                        <option ${status === "Prospecção" ? "selected" : ""}>Prospecção</option>
                        <option ${status === "Abordagem" ? "selected" : ""}>Abordagem</option>
                        <option ${status === "Negociação" ? "selected" : ""}>Negociação</option>
                        <option ${status === "Ativo" ? "selected" : ""}>Ativo</option>
                    </select>
                </td>
                <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <button onclick="updateSheets('${insta}', 'interacao', ${Number(interacoes) + 1})" style="padding: 2px 8px; font-size: 10px; cursor:pointer; background: var(--bitto-blue); color:white; border:none; border-radius:4px;">+1</button>
                        <div>
                            <div style="font-size: 9px; font-weight: 800;">${interacoes}/3</div>
                            <div class="progress-bar"><div class="progress-fill" style="width:${perc}%"></div></div>
                        </div>
                    </div>
                </td>
                <td>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <input type="text" placeholder="Cupom" value="${cupom || ""}" onblur="updateSheets('${insta}', 'links', this.value, {link: '${link}', cupom: this.value})" style="margin:0; padding: 4px; font-size: 10px;">
                    </div>
                </td>
                <td style="text-align:center;">
                    <div style="width: 10px; height: 10px; border-radius: 50%; margin: auto; background: ${ativado === "Sim" ? "var(--bitto-green)" : "#333"}; box-shadow: ${ativado === "Sim" ? "0 0 10px var(--bitto-green)" : "none"};"></div>
                </td>
                <td style="text-align: right;">
                    <button onclick="window.open('https://instagram.com/${insta.replace("@", "")}')" style="background: none; border: 1px solid var(--glass-border); color: var(--text-main); padding: 6px 12px; border-radius: 8px; font-size: 10px; cursor:pointer; font-weight: 600;">PROFILE ↗</button>
                </td>`;
      lista.appendChild(tr);
    });
  } catch (e) {
    lista.innerHTML =
      "<tr><td colspan='6' style='text-align:center; color: #ff4b4b;'>Erro de conexão com a planilha.</td></tr>";
  }
}

window.copyToAtivador = (e) => {
  document.getElementById("userEmail").value = e;
  showToast("E-mail movido para ativação!");
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
    return showToast("Preencha os campos!", true);
  showToast("Cadastrando lead...");
  await fetch(URL_SHEETS, {
    method: "POST",
    mode: "no-cors",
    body: JSON.stringify(dados),
  });
  setTimeout(carregarDadosSheets, 2000);
};
