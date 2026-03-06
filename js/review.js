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

onAuthStateChanged(auth, (user) => {
  if (user) currentUser = user;
  else window.location.href = "login.html";
});

if (generateBtn) {
  generateBtn.addEventListener("click", async () => {
    const topic = topicInput?.value || "";
    const content = contentInput?.value || "";
    if (!content.trim() && !topic.trim()) {
      showToast("Cole um texto ou defina um tema!", "error");
      return;
    }
    if (!currentUser) return;

    const canUse = await checkUsageLimit(currentUser.uid, "review");
    if (!canUse) {
      showToast("🔒 Limite mensal atingido.", "error");
      return;
    }

    const originalText = generateBtn.innerHTML;
    generateBtn.innerHTML = '<span class="loader"></span> BITTO PROCESSANDO...';
    generateBtn.disabled = true;

    try {
      const prompt = `BITTO AI - Modo Professor Técnico. Tema: "${topic}". Conteúdo: "${content}". Gere: 1. Resumo Teórico. 2. Simulado (15 questões). 3. Gabarito. Formato: Markdown bonito. Idioma: PT-BR.`;

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
      generateBtn.disabled = false;
    }
  });
}

// --- SOLUÇÃO PARA O PDF EM BRANCO/CORTADO ---
if (downloadPdfBtn) {
  downloadPdfBtn.addEventListener("click", async () => {
    const element = document.getElementById("reviewOutput");
    if (!element || element.innerHTML.trim() === "") return;

    // 1. Forçar estado estático para evitar "branco" (opacidade 0 da animação)
    element.style.animation = "none";
    element.style.opacity = "1";
    element.style.display = "block";
    element.classList.add("pdf-rendering-mode");

    const opt = {
      margin: [15, 12],
      filename: `Bitto_${topicInput.value || "Revisao"}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff", // Fundo branco sólido
        scrollY: 0,
        windowWidth: 800, // Evita cortes laterais
      },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["avoid-all", "css", "legacy"] },
    };

    try {
      await html2pdf().set(opt).from(element).save();
    } catch (e) {
      console.error(e);
    } finally {
      // Restaurar estilo original
      element.classList.remove("pdf-rendering-mode");
      element.style.animation = "";
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
    html.setAttribute(
      "data-theme",
      html.getAttribute("data-theme") === "dark" ? "light" : "dark",
    );
  });
}

function showToast(message, type = "success") {
  let container =
    document.getElementById("toast-container") || document.createElement("div");
  if (!container.id) {
    container.id = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${type === "success" ? "✅" : "⚠️"}</span> ${message}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}
