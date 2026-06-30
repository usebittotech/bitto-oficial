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
    const contentRaw = contentInput ? contentInput.value : "";

    // ✂️ Limitação de Caracteres do Conteúdo (Máximo 5000 caracteres)
    const content = contentRaw.substring(0, 5000);
    if (contentRaw.length > 5000) {
      showToast(
        "Texto longo! Limitado aos primeiros 5000 caracteres.",
        "warning",
      );
    }

    if (!content.trim() && !topic.trim()) {
      showToast("Cole um texto ou defina um tema!", "error");
      return;
    }
    if (!currentUser) return;

    const canUse = await checkUsageLimit(currentUser.uid, "review");
    if (!canUse) {
      showToast("Limite mensal atingido (3/3).", "error");
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

      // 🛠️ ROTA CORRIGIDA
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      });

      if (!response.ok) throw new Error("Erro no Servidor");

      const data = await response.json();
      const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!aiResponse) throw new Error("A IA não gerou resposta.");

      reviewOutput.innerHTML =
        typeof marked !== "undefined"
          ? marked.parse(aiResponse)
          : `<pre style="white-space:pre-wrap;">${aiResponse}</pre>`;

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
      if (statusText) statusText.innerText = "Erro na conexão.";
    } finally {
      generateBtn.innerHTML = originalText;
      generateBtn.classList.remove("btn-loading");
      generateBtn.disabled = false;
      if (statusText)
        setTimeout(() => (statusText.style.display = "none"), 5000);
    }
  });
}

// ═══════════════════════════════════════════════
//  GERAR PDF  —  design premium Bitto
// ═══════════════════════════════════════════════
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
    const mL = 16;
    const mR = 16;
    const mTop = 16;
    const footerH = 14;
    const maxW = pageW - mL - mR;
    let y = mTop;
    let pageNum = 1;

    const C = {
      blue: [0, 45, 180],
      blueDark: [0, 20, 90],
      blueMid: [30, 80, 210],
      bluePale: [235, 241, 255],
      blueLight: [210, 225, 255],
      questionBg: [248, 250, 255],
      green: [160, 195, 0],
      greenBright: [180, 220, 0],
      greenPale: [243, 252, 215],
      answerBg: [237, 252, 230],
      answerText: [30, 120, 30],
      dark: [22, 22, 22],
      mid: [70, 70, 70],
      muted: [130, 130, 130],
      hairline: [215, 215, 215],
      white: [255, 255, 255],
    };

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

    function lh(fs) {
      return fs * 0.44;
    }

    function checkY(needed) {
      if (y + needed > pageH - footerH - 4) {
        drawFooter();
        doc.addPage();
        pageNum++;
        y = mTop;
        drawPageHeader();
      }
    }

    function drawFooter() {
      const fy = pageH - footerH + 5;
      doc.setDrawColor(...C.hairline);
      doc.setLineWidth(0.25);
      doc.line(mL, fy - 4, pageW - mR, fy - 4);
      doc.setDrawColor(...C.green);
      doc.setLineWidth(1);
      doc.line(mL, fy - 4, mL + 12, fy - 4);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...C.blue);
      doc.text("BITTO", mL, fy);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...C.muted);
      doc.text("Gerado por Bitto AI", mL + 9, fy);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...C.mid);
      doc.text(String(pageNum), pageW - mR, fy, { align: "right" });
    }

    function drawPageHeader() {
      doc.setFillColor(...C.blueDark);
      doc.rect(0, 0, pageW, 6, "F");
      doc.setFillColor(...C.green);
      doc.rect(0, 5.2, pageW, 1.2, "F");
    }

    function drawCoverHeader(title) {
      doc.setFillColor(...C.blueDark);
      doc.rect(0, 0, pageW, 50, "F");

      doc.setFillColor(0, 35, 120);
      doc.rect(pageW - 45, 0, 45, 50, "F");
      doc.setFillColor(0, 28, 100);
      doc.rect(pageW - 25, 0, 25, 50, "F");

      doc.setFillColor(...C.greenBright);
      doc.rect(0, 47, pageW, 3, "F");

      doc.setFillColor(...C.green);
      doc.roundedRect(mL, 8, 28, 7, 1.5, 1.5, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...C.blueDark);
      doc.text("BITTO AI", mL + 14, 13, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(170, 195, 255);
      doc.text("GUIA DE ESTUDO", mL + 32, 13);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(17);
      doc.setTextColor(...C.white);
      const tLines = doc.splitTextToSize(title, maxW - 30);
      doc.text(tLines, mL, 28);

      const now = new Date();
      const dateStr = now.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(170, 195, 255);
      doc.text(dateStr, pageW - mR, 44, { align: "right" });

      y = 58;
    }

    function drawH1(text) {
      if (!text) return;
      y += 5;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12.5);
      doc.setTextColor(...C.dark);
      const lines = doc.splitTextToSize(text, maxW - 8);
      const blockH = lines.length * lh(12.5) + 7;
      checkY(blockH + 5);
      doc.setFillColor(...C.bluePale);
      doc.roundedRect(mL, y - 5, maxW, blockH, 2.5, 2.5, "F");
      doc.setFillColor(...C.blue);
      doc.roundedRect(mL, y - 5, 3.5, blockH, 1.5, 1.5, "F");
      doc.text(lines, mL + 7, y);
      y += blockH + 3;
    }

    function drawH2(text) {
      if (!text) return;
      y += 6;
      checkY(16);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...C.blueMid);
      const lines = doc.splitTextToSize(text, maxW - 4);
      doc.text(lines, mL, y);
      y += lines.length * lh(11) + 2;
      const split = maxW * 0.35;
      doc.setDrawColor(...C.greenBright);
      doc.setLineWidth(1);
      doc.line(mL, y, mL + split, y);
      doc.setDrawColor(...C.hairline);
      doc.setLineWidth(0.3);
      doc.line(mL + split, y, mL + maxW, y);
      y += 5;
    }

    function drawH3(text) {
      if (!text) return;
      y += 4;
      checkY(12);
      doc.setFillColor(...C.green);
      doc.circle(mL + 1.8, y - 1.8, 1.8, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(...C.dark);
      const lines = doc.splitTextToSize(text, maxW - 6);
      doc.text(lines, mL + 6, y);
      y += lines.length * lh(10.5) + 4;
    }

    function drawP(text) {
      if (!text) return;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...C.mid);
      const lines = doc.splitTextToSize(text, maxW);
      checkY(lines.length * lh(10) + 4);
      doc.text(lines, mL, y);
      y += lines.length * lh(10) + 4;
    }

    function drawLi(text, ordered, index) {
      if (!text) return;
      const indent = 9;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...C.mid);
      const lines = doc.splitTextToSize(text, maxW - indent);
      checkY(lines.length * lh(10) + 3);

      if (ordered) {
        doc.setFillColor(...C.blue);
        doc.circle(mL + 3, y - 1.8, 2.8, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6);
        doc.setTextColor(...C.white);
        doc.text(String(index), mL + 3, y - 0.4, { align: "center" });
      } else {
        doc.setFillColor(...C.blue);
        doc.rect(mL + 1.2, y - 2.8, 2.2, 2.2, "F");
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...C.mid);
      doc.text(lines, mL + indent, y);
      y += lines.length * lh(10) + 3;
    }

    let questaoNum = 0;
    function drawQuestaoLi(text) {
      if (!text) return;
      questaoNum++;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...C.dark);
      const lines = doc.splitTextToSize(text, maxW - 12);
      const blockH = lines.length * lh(9.5) + 9;
      checkY(blockH + 3);

      doc.setFillColor(...C.questionBg);
      doc.setDrawColor(...C.blueLight);
      doc.setLineWidth(0.4);
      doc.roundedRect(mL, y - 5, maxW, blockH, 2, 2, "FD");

      doc.setFillColor(...C.blueMid);
      doc.roundedRect(mL + 2, y - 3.5, 10, 5.5, 1.5, 1.5, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(...C.white);
      doc.text(`Q${questaoNum}`, mL + 7, y, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...C.dark);
      doc.text(lines, mL + 14, y);
      y += blockH + 2;
    }

    let gabaritoNum = 0;
    function drawAnswerLi(text) {
      if (!text) return;
      gabaritoNum++;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...C.dark);
      const lines = doc.splitTextToSize(text, maxW - 12);
      const blockH = lines.length * lh(9.5) + 8;
      checkY(blockH + 2);

      doc.setFillColor(...C.answerBg);
      doc.setDrawColor(170, 220, 160);
      doc.setLineWidth(0.35);
      doc.roundedRect(mL, y - 4, maxW, blockH, 2, 2, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(...C.muted);
      doc.text(`${gabaritoNum}.`, mL + 2.5, y, { align: "center" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...C.answerText);
      doc.text("v", mL + 7, y);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...C.dark);
      doc.text(lines, mL + 12, y);
      y += blockH + 2;
    }

    function drawBlockquote(text) {
      if (!text) return;
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9.5);
      doc.setTextColor(90, 90, 90);
      const lines = doc.splitTextToSize(text, maxW - 12);
      const blockH = lines.length * lh(9.5) + 10;
      checkY(blockH + 3);
      doc.setFillColor(...C.greenPale);
      doc.roundedRect(mL, y - 5, maxW, blockH, 2, 2, "F");
      doc.setFillColor(...C.green);
      doc.roundedRect(mL, y - 5, 3.5, blockH, 1.5, 1.5, "F");
      doc.text(lines, mL + 7, y);
      y += blockH + 4;
    }

    let inGabarito = false;
    let inSimulado = false;
    let olCounter = 0;

    function processNode(node, parentTag = "") {
      if (node.nodeType === Node.TEXT_NODE) return;
      const tag = node.tagName ? node.tagName.toLowerCase() : "";
      const text = sanitize(node.innerText || node.textContent || "");

      switch (tag) {
        case "h1":
          drawH1(text);
          inGabarito = text.toLowerCase().includes("gabarito");
          inSimulado = text.toLowerCase().includes("simulado");
          questaoNum = 0;
          gabaritoNum = 0;
          break;
        case "h2":
          drawH2(text);
          inGabarito = text.toLowerCase().includes("gabarito");
          inSimulado = text.toLowerCase().includes("simulado");
          questaoNum = 0;
          gabaritoNum = 0;
          break;
        case "h3":
          drawH3(text);
          inGabarito = text.toLowerCase().includes("gabarito");
          inSimulado = text.toLowerCase().includes("simulado");
          break;

        case "p":
          drawP(text);
          break;

        case "ol":
          olCounter = 0;
          node.childNodes.forEach((child) => processNode(child, "ol"));
          y += 2;
          break;

        case "ul":
          node.childNodes.forEach((child) => processNode(child, "ul"));
          y += 2;
          break;

        case "li": {
          const isOrdered = parentTag === "ol";
          if (isOrdered) olCounter++;
          if (inGabarito) {
            drawAnswerLi(text);
          } else if (inSimulado) {
            drawQuestaoLi(text);
          } else {
            drawLi(text, isOrdered, olCounter);
          }
          break;
        }

        case "blockquote":
          drawBlockquote(text);
          break;

        case "hr":
          checkY(7);
          doc.setDrawColor(...C.hairline);
          doc.setLineWidth(0.25);
          doc.line(mL, y, mL + maxW, y);
          y += 7;
          break;

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
          node.childNodes.forEach((child) => processNode(child, tag));
          break;
      }
    }

    const topicText = sanitize(
      document.getElementById("reviewTitle")?.innerText || "Revisão Bitto",
    );

    drawCoverHeader(topicText);
    source.childNodes.forEach((node) => processNode(node));
    drawFooter();

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
    html.setAttribute(
      "data-theme",
      html.getAttribute("data-theme") === "dark" ? "light" : "dark",
    );
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
  toast.innerHTML = `<span>${type === "success" ? "&#x2705;" : "&#x26A0;"}</span> ${message}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}
