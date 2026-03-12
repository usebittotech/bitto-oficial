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

const themeBtn = document.getElementById("themeBtn");
themeBtn.onclick = () => {
  const isDark = document.body.getAttribute("data-theme") === "dark";
  document.body.setAttribute("data-theme", isDark ? "light" : "dark");
  themeBtn.innerText = isDark ? "Dark Mode" : "Light Mode";
};

function showToast(msg) {
  const t = document.getElementById("toast");
  t.innerText = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3000);
}

onAuthStateChanged(auth, (user) => {
  if (user && user.email.toLowerCase() === SEU_EMAIL_ADMIN.toLowerCase()) {
    document.body.style.display = "block";
    carregarDadosSheets();
  } else {
    window.location.href = "index.html";
  }
});

window.updateSheets = async (insta, tipo, valor, extra = {}) => {
  await fetch(URL_SHEETS, {
    method: "POST",
    mode: "no-cors",
    body: JSON.stringify({ action: "update", insta, tipo, valor, ...extra }),
  });
  showToast("Planilha atualizada!");
  setTimeout(carregarDadosSheets, 1500);
};

window.excluirInfluencer = async (insta) => {
  if (!confirm(`Remover ${insta} permanentemente?`)) return;
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
    "<tr><td colspan='5' style='text-align:center; padding: 40px; opacity:0.5;'>Sincronizando...</td></tr>";

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

      tr.innerHTML = `
                <td class="col-influencer">
                    <div style="font-weight:700;">${nome}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted); cursor:pointer;" onclick="copyToAtivador('${nome}')">
                        ${insta} <span style="color:var(--primary-blue); font-weight:800; font-size:10px; margin-left:5px;">COPY</span>
                    </div>
                </td>
                <td class="col-status">
                    <select onchange="updateSheets('${insta}', 'status', this.value)" style="background:transparent; border:none; color:var(--text-main); font-size:12px; font-weight:600; padding:0;">
                        <option ${status === "Prospecção" ? "selected" : ""}>Prospecção</option>
                        <option ${status === "Abordagem" ? "selected" : ""}>Abordagem</option>
                        <option ${status === "Ativo" ? "selected" : ""}>Ativo</option>
                    </select>
                </td>
                <td class="col-assets">
                    <input type="text" placeholder="Cupom" value="${cupom || ""}" 
                           onblur="updateSheets('${insta}', 'links', this.value, {link: '${link}', cupom: this.value})" 
                           class="auth-input" style="margin:0; padding: 6px 10px; font-size: 11px; width: 100%;">
                </td>
                <td class="col-plan" style="text-align:center;">
                    ${ativado === "Sim" ? '<div class="active-dot"></div>' : '<div style="width:10px; height:10px; border-radius:50%; background:var(--border-color); display:inline-block;"></div>'}
                </td>
                <td class="col-manage" style="text-align:right;">
                    <button onclick="window.open('https://instagram.com/${insta.replace("@", "")}')" style="background:none; border:none; cursor:pointer; font-size:1.1rem; margin-right:10px;">📸</button>
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
  showToast("Email preparado!");
};

document.getElementById("btnSync").onclick = carregarDadosSheets;

document.getElementById("btnSalvarInf").onclick = async () => {
  const nome = document.getElementById("infNome").value;
  const insta = document.getElementById("infInsta").value;
  const status = document.getElementById("infStatus").value;
  if (!nome || !insta) return showToast("Preencha os campos!");
  showToast("Salvando lead...");
  await fetch(URL_SHEETS, {
    method: "POST",
    mode: "no-cors",
    body: JSON.stringify({ action: "add", nome, insta, status }),
  });
  setTimeout(carregarDadosSheets, 2000);
};

document.getElementById("btnLiberar")?.addEventListener("click", async () => {
  const email = document.getElementById("userEmail").value.trim().toLowerCase();
  if (!email) return showToast("Digite um e-mail!");
  try {
    const q = query(collection(db, "users"), where("email", "==", email));
    const snap = await getDocs(q);
    if (snap.empty) throw new Error("Usuário não encontrado.");
    await updateDoc(doc(db, "users", snap.docs[0].id), {
      plan: "embaixador",
      subscriptionEnd: Timestamp.fromDate(
        new Date(Date.now() + 13 * 24 * 60 * 60 * 1000),
      ),
    });
    showToast("🚀 Acesso Liberado!");
    document.getElementById("userEmail").value = "";
  } catch (e) {
    showToast(e.message);
  }
});
