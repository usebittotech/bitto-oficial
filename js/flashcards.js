import { auth, onAuthStateChanged } from "./firebase-init.js";
import { checkUsageLimit, incrementUsage } from "./userManager.js";

const themeToggle = document.getElementById("themeToggle");
const flipCard = document.getElementById("flashcardElement");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const flipBtn = document.getElementById("flipBtn");
const progressText = document.getElementById("progressText");
const progressBar = document.getElementById("progressBar");
const cardFrontText = document.getElementById("cardFrontText");
const cardBackText = document.getElementById("cardBackText");
const generateBtn = document.getElementById("generateBtn");
const deckTitle = document.getElementById("deckTitle");
const statusText = document.getElementById("statusText");
const evalControls = document.getElementById("evalControls");
const flipControls = document.getElementById("flipControls");
const wrongBtn = document.getElementById("wrongBtn");
const rightBtn = document.getElementById("rightBtn");
const sessionRight = document.getElementById("sessionRight");
const sessionWrong = document.getElementById("sessionWrong");

let sessionRightCount = 0;
let sessionWrongCount = 0;
let isFlipped = false;

let currentDeck = [
  {
    q: "👋 Olá! Bem-vindo ao BITTO Flashcards",
    a: "Aqui você transforma qualquer texto em flashcards com IA. Depois de virar o card, diga se lembrou ou não — o BITTO acompanha seu progresso.",
  },
  {
    q: "⚡ Como gerar seu primeiro deck?",
    a: "No painel ao lado: escreva um tema (ex: 'Fotossíntese') ou cole um texto do seu material. Escolha a quantidade e clique em GERAR AGORA.",
  },
  {
    q: "🃏 Como estudar com os cards?",
    a: "Leia a pergunta, tente lembrar a resposta mentalmente, depois vire o card. Clique ✓ se lembrou ou ✕ se não lembrou — isso registra seu desempenho.",
  },
  {
    q: "⌨️ Atalhos do teclado",
    a: "Enter ou ↑ para virar o card · ← → para navegar entre cards · Após virar: tecle 1 para 'Não lembrei' e 2 para 'Lembrei!'",
  },
  {
    q: "🚀 Pronto para começar?",
    a: "Gere seu primeiro deck com IA agora mesmo! Digite um tema no painel ao lado e clique em GERAR AGORA ⚡",
  },
];
let currentIndex = 0;
let currentUser = null;

// --- VERIFICAÇÃO DE LOGIN ---
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
  } else {
    window.location.href = "login.html";
  }
});

// --- UI UPDATE ---
function updateCardUI() {
  if (flipCard) flipCard.classList.remove("is-flipped");
  isFlipped = false;
  showFlipControls();
  setTimeout(() => {
    if (currentDeck && currentDeck[currentIndex]) {
      cardFrontText.innerText = currentDeck[currentIndex].q;
      cardBackText.innerText = currentDeck[currentIndex].a;
      if (progressText)
        progressText.innerText = `${currentIndex + 1} / ${currentDeck.length}`;
      if (progressBar) {
        const percent = ((currentIndex + 1) / currentDeck.length) * 100;
        progressBar.style.width = `${percent}%`;
      }
    }
  }, 250);
}

function showFlipControls() {
  if (flipControls) flipControls.style.display = "flex";
  if (evalControls) evalControls.style.display = "none";
}

function showEvalControls() {
  if (flipControls) flipControls.style.display = "none";
  if (evalControls) evalControls.style.display = "flex";
}

function updateSessionUI() {
  if (sessionRight) sessionRight.textContent = sessionRightCount;
  if (sessionWrong) sessionWrong.textContent = sessionWrongCount;
}

function toggleFlip() {
  if (flipCard) {
    flipCard.classList.toggle("is-flipped");
    isFlipped = flipCard.classList.contains("is-flipped");
    if (isFlipped) {
      showEvalControls();
    } else {
      showFlipControls();
    }
  }
}

// --- AVALIAÇÃO ---
function goNext() {
  if (currentIndex < currentDeck.length - 1) {
    currentIndex++;
    updateCardUI();
  } else {
    const total = sessionRightCount + sessionWrongCount;
    const pct = total > 0 ? Math.round((sessionRightCount / total) * 100) : 0;
    showToast(`Deck finalizado! ${pct}% de acerto 🎉 +50 XP`, "success");
    if (window.awardXP) window.awardXP(50, "Flashcards Concluído");
    currentIndex = 0;
    sessionRightCount = 0;
    sessionWrongCount = 0;
    updateSessionUI();
    setTimeout(updateCardUI, 1000);
  }
}

if (wrongBtn) {
  wrongBtn.addEventListener("click", () => {
    sessionWrongCount++;
    updateSessionUI();
    goNext();
  });
}

if (rightBtn) {
  rightBtn.addEventListener("click", () => {
    sessionRightCount++;
    updateSessionUI();
    goNext();
  });
}

// --- NAVEGAÇÃO ---
if (prevBtn)
  prevBtn.addEventListener("click", () => {
    if (currentIndex > 0) {
      currentIndex--;
      updateCardUI();
    }
  });

if (nextBtn)
  nextBtn.addEventListener("click", () => {
    goNext();
  });

if (flipBtn) flipBtn.addEventListener("click", toggleFlip);
if (flipCard)
  flipCard.addEventListener("click", () => {
    // Clique no card vira apenas se estiver mostrando controles de flip
    if (!isFlipped) toggleFlip();
  });

document.addEventListener("keydown", (e) => {
  if (e.code === "ArrowUp" || e.code === "Enter") {
    e.preventDefault();
    if (!isFlipped) toggleFlip();
  }
  if (e.code === "ArrowRight" && !isFlipped) if (nextBtn) nextBtn.click();
  if (e.code === "ArrowLeft" && !isFlipped) if (prevBtn) prevBtn.click();
  // Atalhos de avaliação: 1 = não lembrei, 2 = lembrei
  if (e.code === "Digit1" && isFlipped) if (wrongBtn) wrongBtn.click();
  if (e.code === "Digit2" && isFlipped) if (rightBtn) rightBtn.click();
});

// --- GERADOR BITTO ---
if (generateBtn) {
  generateBtn.addEventListener("click", async () => {
    const topic = document.getElementById("deckTopic").value;
    const content = document.getElementById("aiContent").value;
    const qtyInput = document.querySelector('input[name="cardQty"]:checked');
    const quantity = qtyInput ? parseInt(qtyInput.value) : 5;

    if (!topic && !content.trim()) {
      showToast("Digite um tema para estudar!", "error");
      return;
    }

    if (!currentUser) {
      showToast("Você precisa estar logado.", "error");
      return;
    }

    // 1. VERIFICA LIMITE DO PLANO (userManager.js)
    const canUse = await checkUsageLimit(currentUser.uid, "flashcards");
    if (!canUse) {
      showUpgradeModal();
      return;
    }

    // UI Loading
    const originalText = generateBtn.innerHTML;
    generateBtn.innerHTML = '<span class="loader"></span> CONSULTANDO BITTO...';
    generateBtn.classList.add("btn-loading");
    generateBtn.disabled = true;

    if (statusText) {
      statusText.style.display = "block";
      statusText.innerText = "Gerando plano de estudos...";
    }

    try {
      const prompt = `
                Você é o BITTO AI, Tutor Universal.
                Tema: "${topic}". Contexto: "${content}".
                Crie um JSON array com ${quantity} flashcards.
                Formato: [{"q": "Pergunta", "a": "Resposta"}]
                Idioma: Português BR. a Resposta deve ser curta e pratica JSON PURO.
            `;

      const response = await fetch("../api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gemini-2.5-flash-lite",
          contents: [{ parts: [{ text: prompt }] }],
        }),
      });

      if (!response.ok) throw new Error("Erro na API Backend");
      const data = await response.json();
      let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error("A IA respondeu vazio.");

      rawText = rawText
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
      const newDeck = JSON.parse(rawText);

      // Sucesso
      currentDeck = newDeck;
      currentIndex = 0;

      // 2. DESCONTA DO PLANO
      await incrementUsage(currentUser.uid, "flashcards");

      // --- 3. ATUALIZA ESTATÍSTICAS E XP (NOVO) ---
      // O CORRETO:
      if (window.recordActivity)
        window.recordActivity("flashcards", parseInt(quantity)); // Conta cards gerados
      if (window.awardXP) window.awardXP(10, "Criação de Deck"); // XP por criar

      if (deckTitle) deckTitle.innerText = topic || "Deck Gerado";
      showToast(`Sucesso! ${newDeck.length} cards criados.`, "success");
      updateCardUI();

      if (window.innerWidth < 900) {
        const studyArea = document.querySelector(".study-column");
        if (studyArea) studyArea.scrollIntoView({ behavior: "smooth" });
      }
    } catch (error) {
      console.error("Erro:", error);
      showToast("Erro: " + error.message, "error");
      if (statusText) statusText.innerText = "Falha.";
    } finally {
      generateBtn.innerHTML = originalText;
      generateBtn.classList.remove("btn-loading");
      generateBtn.disabled = false;
      if (statusText)
        setTimeout(() => (statusText.style.display = "none"), 5000);
    }
  });
}

// --- MODAL DE UPGRADE ---
function showUpgradeModal() {
  const overlay = document.getElementById("upgradeOverlay");
  if (!overlay) return;
  overlay.classList.add("is-open");
  document.body.style.overflow = "hidden";
}

function hideUpgradeModal() {
  const overlay = document.getElementById("upgradeOverlay");
  if (!overlay) return;
  overlay.classList.remove("is-open");
  document.body.style.overflow = "";
}

document
  .getElementById("upgradeClose")
  ?.addEventListener("click", hideUpgradeModal);
document.getElementById("upgradeOverlay")?.addEventListener("click", (e) => {
  if (e.target === e.currentTarget) hideUpgradeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.code === "Escape") hideUpgradeModal();
});

// --- TEMA & TOAST ---
themeToggle.addEventListener("click", () => {
  const html = document.documentElement;
  const sunIcon = document.querySelector(".icon-sun");
  const moonIcon = document.querySelector(".icon-moon");
  if (html.getAttribute("data-theme") === "dark") {
    html.setAttribute("data-theme", "light");
    sunIcon.style.display = "block";
    moonIcon.style.display = "none";
  } else {
    html.setAttribute("data-theme", "dark");
    sunIcon.style.display = "none";
    moonIcon.style.display = "block";
  }
});

function showToast(message, type = "success") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  let icon = type === "success" ? "✅" : "⚠️";
  if (type === "error") icon = "❌";
  toast.innerHTML = `<span>${icon}</span> ${message}`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3500);
}

updateCardUI();
