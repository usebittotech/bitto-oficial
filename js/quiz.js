import { auth, onAuthStateChanged } from "./firebase-init.js";
import { checkUsageLimit, incrementUsage } from "./userManager.js";

const themeToggle = document.getElementById("themeToggle");
const startBtn = document.getElementById("startQuizBtn");
const nextBtn = document.getElementById("nextQuestionBtn");

const emptyState = document.getElementById("emptyState");
const loadingState = document.getElementById("loadingState");
const gameActive = document.getElementById("gameActive");
const gameResult = document.getElementById("gameResult");
const questionText = document.getElementById("questionText");
const optionsContainer = document.getElementById("optionsContainer");
const feedbackArea = document.getElementById("feedbackArea");
const feedbackMsg = document.getElementById("feedbackMsg");
const feedbackIcon = document.getElementById("feedbackIcon");
const feedbackLabel = document.getElementById("feedbackLabel");
const feedbackExplan = document.getElementById("feedbackExplanation");
const scoreBadge = document.getElementById("scoreBadge");
const progressSteps = document.getElementById("progressSteps");
const questionCounter = document.getElementById("questionCounter");
const finalScoreEl = document.getElementById("finalScore");
const resultTopicEl = document.getElementById("resultTopic");
const gameTitle = document.getElementById("gameTitle");
const statusText = document.getElementById("statusText");

let questions = [];
let currentQuestionIndex = 0;
let score = 0;
let currentUser = null;
let TOTAL_QUESTIONS = 5; // atualizado dinamicamente ao iniciar
const OPTION_LABELS = ["A", "B", "C", "D"];

// --- AUTH ---
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
  } else {
    window.location.href = "login.html";
  }
});

// --- INICIAR QUIZ ---
if (startBtn) {
  startBtn.addEventListener("click", async () => {
    const topic = document.getElementById("quizTopic").value.trim();
    const difficultyEl = document.querySelector(
      'input[name="difficulty"]:checked',
    );
    const difficulty = difficultyEl ? difficultyEl.value : "Iniciante";
    const qtyEl = document.querySelector('input[name="quizQty"]:checked');
    TOTAL_QUESTIONS = qtyEl ? parseInt(qtyEl.value) : 5;

    if (!topic) {
      showToast("Digite um tema para começar!", "error");
      return;
    }
    if (!currentUser) {
      showToast("Aguarde a conexão...", "info");
      return;
    }

    const canUse = await checkUsageLimit(currentUser.uid, "quiz");
    if (!canUse) {
      showToast("🔒 Limite mensal de Quizzes atingido (3/3).", "error");
      return;
    }

    const originalText = startBtn.innerHTML;
    startBtn.innerHTML = '<span class="loader"></span> GERANDO...';
    startBtn.classList.add("btn-loading");
    startBtn.disabled = true;

    if (statusText)
      statusText.innerText = "Bitto está elaborando as perguntas...";
    emptyState.style.display = "none";
    loadingState.style.display = "flex";
    gameResult.style.display = "none";
    gameActive.style.display = "none";

    try {
      await fetchQuestions(topic, difficulty);
      await incrementUsage(currentUser.uid, "quiz");
      if (window.recordActivity) window.recordActivity("quiz", 1);

      loadingState.style.display = "none";
      gameActive.style.display = "block";
      if (gameTitle) gameTitle.innerText = topic;
      if (resultTopicEl) resultTopicEl.innerText = topic;

      score = 0;
      currentQuestionIndex = 0;
      if (scoreBadge) scoreBadge.innerText = `XP: ${score}`;

      setupProgressSteps();
      loadQuestion();
    } catch (error) {
      console.error(error);
      showToast("Erro ao criar quiz: " + error.message, "error");
      loadingState.style.display = "none";
      emptyState.style.display = "flex";
    } finally {
      startBtn.innerHTML = originalText;
      startBtn.classList.remove("btn-loading");
      startBtn.disabled = false;
    }
  });
}

// --- API ---
async function fetchQuestions(topic, difficulty) {
  const prompt = `
        Gere um Quiz JSON válido sobre: "${topic}".
        Nível: ${difficulty}. Quantidade: ${TOTAL_QUESTIONS}.
        FORMATO JSON: [{"q": "...", "options": ["A", "B", "C", "D"], "correct": 0, "why": "..."}]
        Regras: JSON PURO. Português.
    `;
  const response = await fetch("../api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gemini-2.5-flash",
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });
  if (!response.ok) throw new Error("Erro na API");
  const data = await response.json();
  let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error("Resposta vazia.");
  rawText = rawText
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();
  questions = JSON.parse(rawText);
}

// --- PROGRESS ---
function setupProgressSteps() {
  progressSteps.innerHTML = "";
  for (let i = 0; i < TOTAL_QUESTIONS; i++) {
    const step = document.createElement("div");
    step.className = "step";
    progressSteps.appendChild(step);
  }
}

function updateProgress(isCorrect = null) {
  const steps = document.querySelectorAll(".step");
  const prev = currentQuestionIndex - 1;
  if (isCorrect !== null && prev >= 0 && prev < steps.length) {
    steps[prev].className = isCorrect ? "step completed" : "step wrong-history";
  }
  if (currentQuestionIndex < steps.length) {
    steps[currentQuestionIndex].className = "step active";
  }
}

// --- CARREGAR QUESTÃO ---
function loadQuestion() {
  const q = questions[currentQuestionIndex];

  // Atualiza contador textual
  if (questionCounter) {
    questionCounter.innerText = `Questão ${currentQuestionIndex + 1} de ${TOTAL_QUESTIONS}`;
  }

  questionText.innerText = q.q;
  optionsContainer.innerHTML = "";
  feedbackArea.style.display = "none";
  updateProgress(null);

  // Botão próxima: desabilitado até o usuário responder
  if (nextBtn) {
    nextBtn.disabled = true;
    nextBtn.style.opacity = "0.45";
    nextBtn.style.cursor = "not-allowed";
  }

  q.options.forEach((opt, idx) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.innerText = opt;
    btn.dataset.label = OPTION_LABELS[idx] || String(idx + 1);
    btn.setAttribute(
      "aria-label",
      `Opção ${OPTION_LABELS[idx] || idx + 1}: ${opt}`,
    );
    btn.onclick = () => checkAnswer(idx, btn);
    optionsContainer.appendChild(btn);
  });
}

// --- VERIFICAR RESPOSTA ---
function checkAnswer(selectedIdx, btnElement) {
  const q = questions[currentQuestionIndex];
  const correctIdx = q.correct;
  const buttons = optionsContainer.querySelectorAll(".option-btn");

  // Desabilita todas as opções
  buttons.forEach((btn) => btn.classList.add("disabled"));

  const isCorrect = selectedIdx === correctIdx;

  if (isCorrect) {
    btnElement.classList.remove("disabled");
    btnElement.classList.add("correct");
    score += 10;
    if (scoreBadge) scoreBadge.innerText = `XP: ${score}`;
    if (window.awardXP) window.awardXP(10, "Quiz Acerto");
    showFeedback(true, q.why);
  } else {
    btnElement.classList.remove("disabled");
    btnElement.classList.add("wrong");
    const correctBtn = buttons[correctIdx];
    if (correctBtn) {
      correctBtn.classList.remove("disabled");
      correctBtn.classList.add("correct");
    }
    showFeedback(false, q.why);
  }

  updateProgress(isCorrect);

  // Habilita botão "Próxima" agora que respondeu
  if (nextBtn) {
    nextBtn.disabled = false;
    nextBtn.style.opacity = "1";
    nextBtn.style.cursor = "pointer";
  }
}

// --- FEEDBACK ---
function showFeedback(isCorrect, explanation) {
  feedbackArea.style.display = "block";
  feedbackMsg.className = isCorrect
    ? "feedback-box feedback-correct"
    : "feedback-box feedback-wrong";

  feedbackIcon.textContent = isCorrect ? "✓" : "✗";
  feedbackLabel.textContent = isCorrect
    ? "Resposta correta!"
    : "Resposta incorreta";
  feedbackExplan.textContent = explanation || "";
  feedbackMsg.setAttribute("role", "alert");
}

// --- PRÓXIMA QUESTÃO ---
if (nextBtn) {
  nextBtn.addEventListener("click", () => {
    currentQuestionIndex++;
    if (currentQuestionIndex < questions.length) loadQuestion();
    else finishGame();
  });
}

// --- FIM DE JOGO ---
function finishGame() {
  // Marca último passo
  const steps = document.querySelectorAll(".step");
  // já marcado por updateProgress no checkAnswer
  gameActive.style.display = "none";
  gameResult.style.display = "block";
  finalScoreEl.innerText = score;
  if (score >= 30) showToast("Parabéns! Excelente pontuação! 🏆", "success");
  if (window.awardXP) window.awardXP(score, "Quiz Concluído");
}

// --- TEMA ---
if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const html = document.documentElement;
    const sunIcon = document.querySelector(".icon-sun");
    const moonIcon = document.querySelector(".icon-moon");
    if (html.getAttribute("data-theme") === "dark") {
      html.setAttribute("data-theme", "light");
      if (sunIcon) sunIcon.style.display = "block";
      if (moonIcon) moonIcon.style.display = "none";
    } else {
      html.setAttribute("data-theme", "dark");
      if (sunIcon) sunIcon.style.display = "none";
      if (moonIcon) moonIcon.style.display = "block";
    }
  });
}

// --- TOAST ---
function showToast(message, type = "success") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  const icon = type === "success" ? "✅" : type === "error" ? "❌" : "⚠️";
  toast.innerHTML = `<span>${icon}</span> ${message}`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = "fadeOutToast 0.3s ease forwards";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
