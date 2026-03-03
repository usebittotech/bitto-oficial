// Substitua pelo URL que você copiou do Google Apps Script
const URL_SHEETS =
  "https://script.google.com/macros/s/AKfycbwk3--wAmDEHTp8fRq9tc74y37lw3IrcxEOBRDDYfJtpHyyVrlI4Vm5q2GbG-zmHAoo/exec";

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

// 1. Controle de Acesso (Original)
onAuthStateChanged(auth, (user) => {
  if (user && user.email.toLowerCase() === SEU_EMAIL_ADMIN.toLowerCase()) {
    document.body.style.display = "flex";
    carregarDadosSheets();
  } else {
    window.location.href = "index.html";
  }
});

// 2. Ativação de Plano (Sua Lógica Original Mantida)
const btnLiberar = document.getElementById("btnLiberar");
btnLiberar?.addEventListener("click", async () => {
  // ... sua lógica de updateDoc no Firebase aqui (conforme arquivo original) ...
});

// 3. CRM via Google Sheets
const btnSalvarInf = document.getElementById("btnSalvarInf");

btnSalvarInf?.addEventListener("click", async () => {
  const dados = {
    nome: document.getElementById("infNome").value,
    insta: document.getElementById("infInsta").value,
    nicho: document.getElementById("infNicho").value,
    status: document.getElementById("infStatus").value,
  };

  if (!dados.nome || !dados.insta) return alert("Preencha os campos!");

  btnSalvarInf.innerText = "SALVANDO...";

  try {
    await fetch(URL_SHEETS, {
      method: "POST",
      body: JSON.stringify(dados),
    });
    alert("Enviado para a Planilha!");
    carregarDadosSheets(); // Atualiza a tabela
  } catch (e) {
    console.error("Erro ao salvar no Sheets:", e);
  } finally {
    btnSalvarInf.innerText = "SALVAR NA PLANILHA";
  }
});

async function carregarDadosSheets() {
  const lista = document.getElementById("listaInfluencers");
  lista.innerHTML =
    "<tr><td colspan='6'>Carregando dados da planilha...</td></tr>";

  try {
    const res = await fetch(URL_SHEETS);
    const influencers = await res.json();

    lista.innerHTML = "";
    influencers.forEach((inf) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
                <td><b>${inf[0]}</b><br><small>${inf[1]}</small></td>
                <td>${inf[2]}</td>
                <td><span class="badge">${inf[3]}</span></td>
                <td>${inf[4]}/3 🔥</td>
                <td>${inf[6] || "Sem link"}</td>
                <td>
                    <button onclick="window.open('https://instagram.com/${inf[1].replace("@", "")}')" style="padding:5px; width:auto;">DM</button>
                </td>
            `;
      lista.appendChild(tr);
    });
  } catch (e) {
    lista.innerHTML = "Erro ao carregar dados.";
  }
}
