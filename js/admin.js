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

function showToast(msg, color = "#1A1D21") {
  const toast = document.getElementById("toast");
  toast.innerText = msg;
  toast.style.background = color;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}

onAuthStateChanged(auth, (user) => {
  if (user && user.email.toLowerCase() === SEU_EMAIL_ADMIN.toLowerCase()) {
    document.body.style.display = "block";
    carregarDadosSheets();
  } else {
    window.location.href = "index.html";
  }
});

// ATIVAÇÃO MANUAL FIREBASE
document.getElementById("btnLiberar")?.addEventListener("click", async () => {
  const email = document.getElementById("userEmail").value.trim().toLowerCase();
  if (!email) return showToast("Digite um e-mail!", "orange");
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

    showToast("🚀 Plano Ativado com Sucesso!", "#0035ff");
    document.getElementById("userEmail").value = "";
  } catch (e) {
    showToast(e.message, "#ff4b4b");
  }
});

// CRM GOOGLE SHEETS
window.updateSheets = async (insta, tipo, valor, extra = {}) => {
  await fetch(URL_SHEETS, {
    method: "POST",
    mode: "no-cors",
    body: JSON.stringify({ action: "update", insta, tipo, valor, ...extra }),
  });
  showToast("Sincronizando alteração...");
  setTimeout(carregarDadosSheets, 1500);
};

async function carregarDadosSheets() {
  const lista = document.getElementById("listaInfluencers");
  lista.innerHTML =
    "<tr><td colspan='6' style='text-align:center; padding: 40px;'>Carregando pipeline...</td></tr>";

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
                    <div style="font-weight: 600;">${nome}</div>
                    <div style="color: var(--text-muted); font-size: 0.75rem;">${insta} 
                        <span style="cursor:pointer; color:var(--bitto-blue); margin-left:5px" onclick="copyToAtivador('${nome}')">[copiar]</span>
                    </div>
                </td>
                <td>
                    <select onchange="updateSheets('${insta}', 'status', this.value)" style="padding: 5px; font-size: 11px; background: white;">
                        <option ${status === "Prospecção" ? "selected" : ""}>Prospecção</option>
                        <option ${status === "Abordagem" ? "selected" : ""}>Abordagem</option>
                        <option ${status === "Negociação" ? "selected" : ""}>Negociação</option>
                        <option ${status === "Ativo" ? "selected" : ""}>Ativo</option>
                    </select>
                </td>
                <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <button onclick="updateSheets('${insta}', 'interacao', ${Number(interacoes) + 1})" style="width: auto; padding: 4px 6px; font-size: 9px; cursor:pointer">+1 DM</button>
                        <div>
                            <span style="font-size: 10px; font-weight: 700;">${interacoes}/3</span>
                            <div class="progress-container"><div class="progress-bar" style="width:${perc}%"></div></div>
                        </div>
                    </div>
                </td>
                <td>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <input type="text" placeholder="Link" value="${link || ""}" onblur="updateSheets('${insta}', 'links', this.value, {link: this.value, cupom: '${cupom}'})" style="padding: 4px; font-size: 10px;">
                        <input type="text" placeholder="Cupom" value="${cupom || ""}" onblur="updateSheets('${insta}', 'links', this.value, {link: '${link}', cupom: this.value})" style="padding: 4px; font-size: 10px;">
                    </div>
                </td>
                <td style="text-align:center;">
                    <span style="color:${ativado === "Sim" ? "var(--bitto-blue)" : "#E2E8F0"}; font-size: 1.2rem;">●</span>
                </td>
                <td style="text-align: right;">
                    <button onclick="window.open('https://instagram.com/${insta.replace("@", "")}')" style="width: auto; background: none; color: var(--bitto-blue); padding: 5px; border:none; cursor:pointer; font-weight:600; font-size: 11px;">VER PERFIL ↗</button>
                </td>`;
      lista.appendChild(tr);
    });
  } catch (e) {
    console.error(e);
    lista.innerHTML =
      "<tr><td colspan='6' style='text-align:center; color: red;'>Erro ao carregar dados.</td></tr>";
  }
}

window.copyToAtivador = (e) => {
  document.getElementById("userEmail").value = e;
  showToast("E-mail copiado para ativação!");
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
    return showToast("Preencha nome e insta!", "orange");

  showToast("Adicionando lead...");
  await fetch(URL_SHEETS, {
    method: "POST",
    mode: "no-cors",
    body: JSON.stringify(dados),
  });
  setTimeout(carregarDadosSheets, 2000);
};
