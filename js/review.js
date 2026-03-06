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
    if (statusText) {
      statusText.style.display = "block";
      statusText.innerText = "Gerando síntese técnica...";
    }

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

      if (!response.ok) throw new Error("Erro no Servidor");

      const data = await response.json();
      const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!aiResponse) throw new Error("A IA não gerou resposta.");

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
      showToast("Revisão gerada com sucesso!", "success");
    } catch (error) {
      console.error(error);
      showToast("Erro ao gerar.", "error");
      statusText.innerText = "Erro na conexão.";
    } finally {
      generateBtn.innerHTML = originalText;
      generateBtn.classList.remove("btn-loading");
      generateBtn.disabled = false;
      if (statusText)
        setTimeout(() => (statusText.style.display = "none"), 5000);
    }
  });
}

// --- GERAR PDF ---
if (downloadPdfBtn) {
  downloadPdfBtn.addEventListener("click", () => {
    const jsPDFLib = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (!jsPDFLib) {
      alert("Erro: Lib jsPDF não carregada.");
      return;
    }

    const doc = new jsPDFLib({
      unit: "mm",
      format: "a4",
      orientation: "portrait",
    });
    const source = document.getElementById("reviewOutput");

    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 15;
    const maxW = pageW - margin * 2;
    let y = margin;

    // Remove emojis e qualquer caractere fora do latin-1 que jsPDF não suporta
    function sanitize(str) {
      return (str || "")
        .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
        .replace(/[\u{2600}-\u{27BF}]/gu, "")
        .replace(/[\u{1F300}-\u{1F9FF}]/gu, "")
        .replace(/[\u{1FA00}-\u{1FFFF}]/gu, "")
        .replace(/[^\x00-\xFF]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    }

    function addPage() {
      doc.addPage();
      y = margin;
    }
    function checkY(needed) {
      if (y + needed > pageH - margin) addPage();
    }

    function drawDivider(color = [200, 200, 200], weight = 0.3) {
      doc.setDrawColor(...color);
      doc.setLineWidth(weight);
      doc.line(margin, y, margin + maxW, y);
      y += 5;
    }

    function processNode(node) {
      if (node.nodeType === Node.TEXT_NODE) return;
      const tag = node.tagName ? node.tagName.toLowerCase() : "";
      const text = sanitize(node.innerText || node.textContent || "");

      switch (tag) {
        case "h1": {
          if (!text) break;
          y += 3;
          checkY(16);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(15);
          doc.setTextColor(17, 17, 17);
          const lines = doc.splitTextToSize(text, maxW);
          doc.text(lines, margin, y);
          y += lines.length * 7 + 2;
          drawDivider([180, 200, 0], 0.7);
          break;
        }
        case "h2": {
          if (!text) break;
          y += 4;
          checkY(14);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(12);
          doc.setTextColor(0, 50, 180);
          const lines = doc.splitTextToSize(text, maxW);
          doc.text(lines, margin, y);
          y += lines.length * 6 + 2;
          drawDivider([170, 200, 0], 0.4);
          break;
        }
        case "h3": {
          if (!text) break;
          y += 3;
          checkY(12);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(11);
          doc.setTextColor(30, 30, 30);
          const lines = doc.splitTextToSize(text, maxW);
          doc.text(lines, margin, y);
          y += lines.length * 5.5 + 4;
          break;
        }
        case "p": {
          if (!text) break;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          doc.setTextColor(40, 40, 40);
          const lines = doc.splitTextToSize(text, maxW);
          checkY(lines.length * 5 + 4);
          doc.text(lines, margin, y);
          y += lines.length * 5 + 4;
          break;
        }
        case "li": {
          if (!text) break;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          doc.setTextColor(40, 40, 40);
          const lines = doc.splitTextToSize(text, maxW - 7);
          checkY(lines.length * 5 + 2);
          // Bullet preenchido
          doc.setFillColor(40, 40, 40);
          doc.circle(margin + 2.5, y - 1.5, 0.9, "F");
          doc.text(lines, margin + 6, y);
          y += lines.length * 5 + 2;
          break;
        }
        case "blockquote": {
          if (!text) break;
          doc.setFont("helvetica", "italic");
          doc.setFontSize(10);
          doc.setTextColor(90, 90, 90);
          const lines = doc.splitTextToSize(text, maxW - 10);
          const blockH = lines.length * 5 + 8;
          checkY(blockH + 3);
          doc.setFillColor(249, 255, 220);
          doc.rect(margin, y - 4, maxW, blockH, "F");
          doc.setDrawColor(160, 190, 0);
          doc.setLineWidth(1.5);
          doc.line(margin, y - 4, margin, y - 4 + blockH);
          doc.text(lines, margin + 6, y);
          y += blockH + 4;
          break;
        }
        case "hr":
          checkY(6);
          drawDivider([200, 200, 200], 0.3);
          break;
        case "ul":
        case "ol":
          node.childNodes.forEach((child) => processNode(child));
          y += 2;
          break;
        // Ignorar inline — conteúdo já está no .innerText do pai
        case "strong":
        case "b":
        case "em":
        case "i":
        case "span":
        case "a":
        case "code":
        case "br":
          break;
        default:
          node.childNodes.forEach((child) => processNode(child));
          break;
      }
    }

    // Cabeçalho
    const topicText = sanitize(
      document.getElementById("reviewTitle")?.innerText || "Revisão Bitto",
    );
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(0, 50, 180);
    const titleLines = doc.splitTextToSize(topicText, maxW);
    doc.text(titleLines, margin, y);
    y += titleLines.length * 10 + 2;
    doc.setDrawColor(170, 201, 0);
    doc.setLineWidth(1.5);
    doc.line(margin, y, margin + maxW, y);
    y += 8;

    // Conteúdo
    source.childNodes.forEach((node) => processNode(node));

    doc.save("Bitto_Resumo.pdf");
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
    if (html.getAttribute("data-theme") === "dark")
      html.setAttribute("data-theme", "light");
    else html.setAttribute("data-theme", "dark");
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
  setTimeout(() => {
    toast.remove();
  }, 3500);
}
