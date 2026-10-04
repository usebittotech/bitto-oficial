(function () {
  const MAX_EXTRACTED_CHARS = 12000;
  const PDF_WORKER_URL =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  function showPdfToast(message, type = "success") {
    if (typeof window.showToast === "function") {
      window.showToast(message, type);
      return;
    }

    let container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${type === "error" ? "❌" : "✅"}</span> ${message}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  }

  function setStatus(statusEl, text, type = "") {
    if (!statusEl) return;
    statusEl.textContent = text || "";
    statusEl.className = `pdf-upload-status ${type}`.trim();
  }

  function appendText(textarea, text) {
    const cleanText = text.trim();
    if (!cleanText) return;

    const currentValue = textarea.value.trim();
    textarea.value = currentValue
      ? `${currentValue}\n\n${cleanText}`
      : cleanText;

    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }

  async function extractPdfText(file, statusEl) {
    if (!window.pdfjsLib) {
      throw new Error("Leitor de PDF não carregado. Recarregue a página.");
    }

    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages = [];
    let totalChars = 0;

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      setStatus(statusEl, `Lendo PDF... página ${pageNumber} de ${pdf.numPages}`);

      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => item.str)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      if (pageText) {
        const pageBlock = `--- Página ${pageNumber} ---\n${pageText}`;
        pages.push(pageBlock);
        totalChars += pageBlock.length;
      }

      if (totalChars >= MAX_EXTRACTED_CHARS) break;
    }

    const extractedText = pages.join("\n\n");
    return {
      text:
        extractedText.length > MAX_EXTRACTED_CHARS
          ? extractedText.slice(0, MAX_EXTRACTED_CHARS)
          : extractedText,
      wasLimited: totalChars >= MAX_EXTRACTED_CHARS,
      pageCount: pdf.numPages,
    };
  }

  function setupPdfUpload(config) {
    const fileInput = document.getElementById(config.inputId);
    const textarea = document.getElementById(config.textareaId);
    const statusEl = document.getElementById(config.statusId);
    const trigger = document.querySelector(`[data-pdf-trigger="${config.inputId}"]`);

    if (!fileInput || !textarea) return;

    if (trigger) {
      trigger.addEventListener("click", () => fileInput.click());
    }

    fileInput.addEventListener("change", async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;

      if (file.type !== "application/pdf") {
        setStatus(statusEl, "Envie um arquivo PDF.", "error");
        showPdfToast("Envie um arquivo PDF.", "error");
        fileInput.value = "";
        return;
      }

      try {
        setStatus(statusEl, "Preparando leitura do PDF...");
        const result = await extractPdfText(file, statusEl);

        if (!result.text.trim()) {
          setStatus(
            statusEl,
            "Não consegui extrair texto. Esse PDF pode ser escaneado como imagem.",
            "error",
          );
          showPdfToast("PDF sem texto selecionável. Tente outro arquivo.", "error");
          return;
        }

        appendText(textarea, result.text);
        setStatus(
          statusEl,
          result.wasLimited
            ? `Texto importado. PDF grande: usamos os primeiros ${MAX_EXTRACTED_CHARS.toLocaleString("pt-BR")} caracteres.`
            : `Texto importado de ${result.pageCount} página(s).`,
          "success",
        );
        showPdfToast("PDF importado para o campo de texto.", "success");
      } catch (error) {
        console.error("Erro ao ler PDF:", error);
        setStatus(statusEl, "Erro ao ler o PDF. Tente outro arquivo.", "error");
        showPdfToast("Erro ao ler o PDF.", "error");
      } finally {
        fileInput.value = "";
      }
    });
  }

  window.BittoPdfUpload = { setup: setupPdfUpload };
})();
