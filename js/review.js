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
    generateBtn.innerHTML = '<span class="loader"></span> PROCESSANDO...';
    generateBtn.disabled = true;

    try {
      const prompt = `BITTO AI - Modo Professor. Tema: "${topic}". Conteúdo: "${content}". Gere: 1. Resumo Teórico. 2. Simulado (15 questões). 3. Gabarito. Formato: Markdown.`;

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
        reviewOutput.innerHTML = aiResponse;
      }

      await incrementUsage(currentUser.uid, "review");
      if (window.recordActivity) window.recordActivity("review", 1);
      if (window.awardXP) window.awardXP(20, "Resumo IA");

      if (emptyState) emptyState.style.display = "none";
      reviewOutput.style.display = "block";
      if (outputActions) outputActions.style.display = "flex";
      if (topic && reviewTitle) reviewTitle.innerText = `Revisão: ${topic}`;
      showToast("Gerado com sucesso!", "success");
    } catch (error) {
      showToast("Erro na geração.", "error");
    } finally {
      generateBtn.innerHTML = originalText;
      generateBtn.disabled = false;
    }
  });
}

// --- SOLUÇÃO DEFINITIVA PDF ---
if (downloadPdfBtn) {
  downloadPdfBtn.addEventListener("click", async () => {
    const element = document.getElementById("reviewOutput");
    if (!element || element.innerText.trim() === "") return;

    // 1. Preparar o elemento (Remover animações e forçar cores sólidas)
    element.style.animation = "none";
    element.style.transition = "none";
    element.classList.add("pdf-force-visible");

    const opt = {
      margin: 10,
      filename: `Bitto_${topicInput.value || "Revisao"}.pdf`,
      image: { type: "jpeg", quality: 1.0 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        scrollY: 0,
        windowWidth: element.scrollWidth,
      },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["avoid-all", "css", "legacy"] },
    };

    try {
      // Pequeno delay para o browser processar a remoção da animação
      await new Promise((resolve) => setTimeout(resolve, 100));
      await html2pdf().set(opt).from(element).save();
    } catch (e) {
      showToast("Erro ao baixar PDF", "error");
    } finally {
      element.classList.remove("pdf-force-visible");
      element.style.animation = ""; // Restaura animação original
    }
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
  setTimeout(() => toast.remove(), 3000);
}
