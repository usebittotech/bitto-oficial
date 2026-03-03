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
const URL_SHEETS = "SUA_URL_DO_APPS_SCRIPT_AQUI"; // COLOQUE SEU URL AQUI

function showToast(msg, color = "#111") {
  const toast = document.getElementById("toast");
  toast.innerText = msg;
  toast.style.background = color;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}

onAuthStateChanged(auth, (user) => {
  if (user && user.email.toLowerCase() === SEU_EMAIL_ADMIN.toLowerCase()) {
    document.body.style.display = "flex";
    carregarDadosSheets();
  } else {
    window.location.href = "index.html";
  }
});

// ATIVAÇÃO MANUAL (FIREBASE)
document.getElementById("btnLiberar")?.addEventListener("click", async () => {
  const email = document.getElementById("userEmail").value.trim().toLowerCase();
  if (!email) return showToast("Digite um e-mail!", "orange");
  try {
    const q = query(collection(db, "users"), where("email", "==", email));
    const snap = await getDocs(q);
    if (snap.empty) throw new Error("Usuário não cadastrado.");
    const exp = new Date();
    exp.setDate(exp.getDate() + 90);
    await updateDoc(doc(db, "users", snap.docs[0].id), {
      plan: "embaixador",
      subscriptionEnd: Timestamp.fromDate(exp),
    });
    showToast("🚀 Plano Ativado!", "#00b884");
    document.getElementById("userEmail").value = "";
  } catch (e) {
    showToast(e.message, "#ff4b4b");
  }
});

// CRM (GOOGLE SHEETS)
window.updateSheets = async (insta, tipo, valor, extra = {}) => {
  await fetch(URL_SHEETS, {
    method: "POST",
    mode: "no-cors", // Crucial para POST no Google Scripts
    body: JSON.stringify({ action: "update", insta, tipo, valor, ...extra }),
  });
  showToast("Atualizando planilha...");
  setTimeout(carregarDadosSheets, 2000);
};

async function carregarDadosSheets() {
  const lista = document.getElementById("listaInfluencers");
  lista.innerHTML =
    "<tr><td colspan='6' style='text-align:center'>Carregando...</td></tr>";
  try {
    const res = await fetch(URL_SHEETS, { redirect: "follow" }); // Resolve CORS no GET
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
                <td><b>${nome}</b><br><small>${insta}</small><span class="copy-badge" onclick="copyToAtivador('${nome}')">copiar</span></td>
                <td><select onchange="updateSheets('${insta}', 'status', this.value)"><option ${status === "Prospecção" ? "selected" : ""}>Prospecção</option><option ${status === "Abordagem" ? "selected" : ""}>Abordagem</option><option ${status === "Negociação" ? "selected" : ""}>Negociação</option><option ${status === "Ativo" ? "selected" : ""}>Ativo</option></select></td>
                <td><button onclick="updateSheets('${insta}', 'interacao', ${Number(interacoes) + 1})">${interacoes}/3 🔥</button><div class="progress-bar"><div class="progress-fill" style="width:${perc}%"></div></div></td>
                <td><input type="text" placeholder="Link" value="${link || ""}" onblur="updateSheets('${insta}', 'links', this.value, {link: this.value, cupom: '${cupom}'})"><input type="text" placeholder="Cupom" value="${cupom || ""}" onblur="updateSheets('${insta}', 'links', this.value, {link: '${link}', cupom: this.value})"></td>
                <td style="text-align:center; color:${ativado === "Sim" ? "#00b884" : "#ccc"}">${ativado === "Sim" ? "✅" : "PENDENTE"}</td>
                <td><button onclick="window.open('https://instagram.com/${insta.replace("@", "")}')">📸</button></td>`;
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
  await fetch(URL_SHEETS, {
    method: "POST",
    mode: "no-cors",
    body: JSON.stringify(dados),
  });
  setTimeout(carregarDadosSheets, 2000);
};
