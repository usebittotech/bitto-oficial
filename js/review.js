import { auth, onAuthStateChanged } from "./firebase-init.js";
import { checkUsageLimit, incrementUsage } from "./userManager.js";

const themeToggle = document.getElementById("themeToggle");
const generateBtn = document.getElementById("generateBtn");
const topicInput = document.getElementById("topicInput");
const contentInput = document.getElementById("contentInput");
const reviewOutput = document.getElementById("reviewOutput");
const emptyState = document.getElementById("emptyState");
const outputActions = document.getElementById("outputActions");
const copyBtn = document.getElementById("copyBtn");
const downloadPdfBtn = document.getElementById("downloadPdfBtn");
const reviewTitle = document.getElementById("reviewTitle");
const statusText = document.getElementById("statusText");

let currentUser = null;

// --- AUTH ---
onAuthStateChanged(auth, (user) => {
  if (user) currentUser = user;
  else window.location.href = "login.html";
});

// --- EVENTO DE GERAR ---
if (generateBtn) {
  generateBtn.addEventListener("click", async () => {
    const topic = topicInput ? topicInput.value : "";
    const content = contentInput ? contentInput.value : "";

    if (!content.trim() && !topic.trim()) {
      showToast("Cole um texto ou defina um tema!", "error");
      return;
    }

    if (!currentUser) return;

    const canUse = await checkUsageLimit(currentUser.uid, "review");
    if (!canUse) {
      showToast("🔒 Limite mensal atingido (3/3).", "error");
      return;
    }

    const originalText = generateBtn.innerHTML;
    generateBtn.innerHTML = '<span class="loader"></span> BITTO PROCESSANDO...';
    generateBtn.classList.add("btn-loading");
    generateBtn.disabled = true;

    try {
      const prompt = `
                BITTO AI - Modo Professor Técnico.
                Tema: "${topic}". Conteúdo: "${content}".
                Gere: 1. Resumo Teórico (Conceitos, Aplicação). 2. Simulado (15 questões variadas). 3. Gabarito.
                Formato: Markdown bonito. Idioma: PT-BR.
            `;

      const response = await fetch("../api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gemini-2.5-flash-lite",
          contents: [{ parts: [{ text: prompt }] }],
        }),
      });

      const data = await response.json();
      const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (typeof marked !== "undefined") {
        reviewOutput.innerHTML = marked.parse(aiResponse);
      } else {
        reviewOutput.innerHTML = `<pre style="white-space: pre-wrap;">${aiResponse}</pre>`;
      }

      await incrementUsage(currentUser.uid, "review");
      if (window.recordActivity) window.recordActivity("review", 1);
      if (window.awardXP) window.awardXP(20, "Resumo IA");

      if (emptyState) emptyState.style.display = "none";
      reviewOutput.style.display = "block";
      if (outputActions) outputActions.style.display = "flex";
      if (topic && reviewTitle) reviewTitle.innerText = `Revisão: ${topic}`;
      showToast("Revisão gerada!", "success");
    } catch (error) {
      showToast("Erro ao gerar.", "error");
    } finally {
      generateBtn.innerHTML = originalText;
      generateBtn.classList.remove("btn-loading");
      generateBtn.disabled = false;
    }
  });
}

// --- DOWNLOAD PDF (FIX DEFINITIVO PARA BRANCO E CORES CLARAS) ---
if (downloadPdfBtn) {
  downloadPdfBtn.addEventListener("click", async () => {
    if (typeof html2pdf === "undefined") {
      alert("Biblioteca PDF não encontrada.");
      return;
    }

    const element = document.getElementById("reviewOutput");
    if (!element || element.innerHTML.trim() === "") return;

    // Força o elemento a ficar visível, preto no branco, antes da captura
    element.classList.add("pdf-rendering");

    const opt = {
      margin: [15, 15],
      filename: `Bitto_${topicInput.value || "Revisao"}.pdf`,
      image: { type: "jpeg", quality: 1.0 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        letterRendering: true,
        backgroundColor: "#FFFFFF",
        scrollY: -window.scrollY, // Ajusta o offset do scroll
      },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["avoid-all", "css", "legacy"] },
    };

    try {
      await html2pdf().set(opt).from(element).save();
    } catch (err) {
      console.error("Erro no PDF:", err);
      showToast("Erro ao gerar PDF", "error");
    } finally {
      // Remove a classe de renderização para voltar ao tema do app
      element.classList.remove("pdf-rendering");
    }
  });
}

if (copyBtn) {
  copyBtn.addEventListener("click", () => {
    navigator.clipboard
      .writeText(reviewOutput.innerText)
      .then(() => showToast("Copiado!", "success"));
  });
}

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const html = document.documentElement;
    const newTheme =
      html.getAttribute("data-theme") === "dark" ? "light" : "dark";
    html.setAttribute("data-theme", newTheme);
  });
}

function showToast(message, type = "success") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${type === "success" ? "✅" : "⚠️"}</span> ${message}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}
