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

onAuthStateChanged(auth, (user) => {
  if (user && user.email.toLowerCase() === SEU_EMAIL_ADMIN.toLowerCase()) {
    document.body.style.display = "block";
    carregarDadosSheets();
  } else {
    window.location.href = "index.html";
  }
});

async function carregarDadosSheets() {
  const container = document.getElementById("listaInfluencers");
  container.innerHTML =
    "<div style='opacity:0.5'>SYNCING DATABASE NODES...</div>";

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
      const activeColor = ativado === "Sim" ? "var(--bitto-green)" : "#444";

      const card = document.createElement("div");
      card.className = "lead-card";
      card.innerHTML = `
                <span class="delete-icon" onclick="excluirInfluencer('${insta}')">✕</span>
                <div style="font-weight: 800; font-size: 1.1rem; margin-bottom: 5px;">${nome}</div>
                <div style="color: var(--bitto-green); font-size: 0.7rem; margin-bottom: 15px;">${insta}</div>
                
                <div class="label-neon">FUNNEL_STATUS</div>
                <select onchange="updateSheets('${insta}', 'status', this.value)" style="padding: 8px; font-size: 0.7rem; margin-bottom: 10px;">
                    <option ${status === "Prospecção" ? "selected" : ""}>Prospecção</option>
                    <option ${status === "Abordagem" ? "selected" : ""}>Abordagem</option>
                    <option ${status === "Ativo" ? "selected" : ""}>Ativo</option>
                </select>

                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                    <span style="font-size: 0.6rem; opacity: 0.5;">PLAN_ACTIVE</span>
                    <div style="width: 12px; height: 12px; background: ${activeColor}; border-radius: 50%; box-shadow: 0 0 10px ${activeColor}"></div>
                </div>
                <button onclick="copyToAtivador('${nome}')" style="margin-top: 15px; background: transparent; border: 1px solid var(--border-color); color: #fff; width: 100%; padding: 8px; border-radius: 5px; font-size: 0.6rem; cursor: pointer;">COPY FOR ACTIVATION</button>
            `;
      container.appendChild(card);
    });
  } catch (e) {
    console.error(e);
  }
}

window.copyToAtivador = (e) => {
  document.getElementById("userEmail").value = e;
  const toast = document.getElementById("toast");
  toast.style.display = "block";
  setTimeout(() => (toast.style.display = "none"), 2000);
};

// Funções de liberação Firebase e exclusão continuam conectadas aos botões...
