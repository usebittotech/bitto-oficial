import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  getDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ==========================================
// ELEMENTOS DA UI - SIDEBAR (STEPPER)
// ==========================================
const totalWeeklyHoursInput = document.getElementById("totalWeeklyHours");
const subjectNameInput = document.getElementById("subjectName");
const addSubjectBtn = document.getElementById("addSubjectBtn");
const subjectListEl = document.getElementById("subjectList");
const subjectEmptyState = document.getElementById("subjectEmptyState");
const generatePlanBtn = document.getElementById("generatePlanBtn");
const plannerFormArea = document.getElementById("plannerFormArea");
const weightPicker = document.getElementById("weightPicker");
const weightHint = document.getElementById("weightHint");
const step1Summary = document.getElementById("step1-summary");
const reviewSummary = document.getElementById("reviewSummary");

// Botões do stepper
const step1NextBtn = document.getElementById("step1NextBtn");
const step2BackBtn = document.getElementById("step2BackBtn");
const step2NextBtn = document.getElementById("step2NextBtn");
const step3BackBtn = document.getElementById("step3BackBtn");

// Elementos da UI - Main Column
const emptyState = document.getElementById("emptyState");
const plannerActive = document.getElementById("plannerActive");
const btnNewPlan = document.getElementById("btnNewPlan");
const weeklyCalendar = document.getElementById("weeklyCalendar");
const subjectProgressSection = document.getElementById(
  "subjectProgressSection",
);

// View toggle / exportar
const viewToggle = document.getElementById("viewToggle");
const btnViewWeek = document.getElementById("btnViewWeek");
const btnViewToday = document.getElementById("btnViewToday");
const btnExportCopy = document.getElementById("btnExportCopy");

// Elementos do Modal de Registro
const registerModal = document.getElementById("registerModal");
const closeRegisterBtn = document.getElementById("closeRegisterBtn");
const saveRegisterBtn = document.getElementById("saveRegisterBtn");
const regCategory = document.getElementById("regCategory");
const regSubjectDisplay = document.getElementById("regSubjectDisplay");
const regTargetTimeDisplay = document.getElementById("regTargetTimeDisplay");
const regTopic = document.getElementById("regTopic");
const regTime = document.getElementById("regTime");
const regDayIndex = document.getElementById("regDayIndex");
const regTaskIndex = document.getElementById("regTaskIndex");

let currentUserUid = null;
let subjects = [];
let colorIndexCounter = 0;
let selectedWeight = 2;
let currentStep = 1;
let currentView = "week";
let draggedItemId = null;

const glassColors = [
  "glass-blue",
  "glass-green",
  "glass-orange",
  "glass-purple",
  "glass-pink",
  "glass-cyan",
];

const daysOfWeek = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const weightLabels = {
  1: { label: "1 (Fácil)", desc: "menos horas por dia" },
  2: { label: "2 (Média)", desc: "distribuição equilibrada" },
  3: { label: "3 (Difícil)", desc: "mais horas por dia" },
};

// --- AUTENTICAÇÃO E CARREGAMENTO ---
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUserUid = user.uid;
    loadPlannerData(user.uid);
  } else {
    window.location.href = "login.html";
  }
});

async function loadPlannerData(uid) {
  try {
    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data.studyPlanner) {
        renderPlanner(data.studyPlanner);
      } else {
        showEmptyState();
      }
    }
  } catch (error) {
    console.error("Erro ao carregar dados do planeamento:", error);
  }
}

// --- FUNÇÕES UTILITÁRIAS ---
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
    toast.style.animation = "slideInRight 0.3s ease reverse forwards";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function formatTime(decimalHours) {
  const h = Math.floor(decimalHours);
  const m = Math.round((decimalHours - h) * 60);
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h00min`;
  return `${h}h${m.toString().padStart(2, "0")}min`;
}

function showEmptyState() {
  emptyState.style.display = "flex";
  plannerActive.style.display = "none";
  btnNewPlan.style.display = "none";
  if (viewToggle) viewToggle.style.display = "none";
  if (btnExportCopy) btnExportCopy.style.display = "none";
  plannerFormArea.style.display = "block";
  currentView = "week";
  if (weeklyCalendar) weeklyCalendar.dataset.plannerId = "";
  goToStep(1);
}

// ==========================================
// STEPPER — NAVEGAÇÃO ENTRE ETAPAS
// ==========================================
function goToStep(step) {
  currentStep = step;

  for (let i = 1; i <= 3; i++) {
    const panel = document.getElementById(`stepper-panel-${i}`);
    if (panel) panel.classList.toggle("active", i === step);
  }

  for (let i = 1; i <= 3; i++) {
    const indicator = document.getElementById(`step-indicator-${i}`);
    if (!indicator) continue;
    indicator.classList.remove("active", "done");
    if (i < step) indicator.classList.add("done");
    else if (i === step) indicator.classList.add("active");
  }

  const line1 = document.getElementById("stepper-line-1");
  const line2 = document.getElementById("stepper-line-2");
  if (line1) line1.classList.toggle("done", step > 1);
  if (line2) line2.classList.toggle("done", step > 2);

  if (step === 3) renderReviewStep();
}

function updateStep1Summary() {
  const totalHours = parseFloat(totalWeeklyHoursInput?.value) || 0;

  if (!step1Summary) return;

  if (totalHours > 0) {
    const perDay = totalHours / 7;
    step1Summary.style.display = "block";
    step1Summary.innerHTML = `📊 <strong>${totalHours}h</strong> divididas pelos <strong>7 dias</strong> da semana (~${perDay.toFixed(1)}h/dia)`;
    if (step1NextBtn) step1NextBtn.disabled = false;
  } else {
    step1Summary.style.display = "none";
    if (step1NextBtn) step1NextBtn.disabled = true;
  }
}

if (totalWeeklyHoursInput)
  totalWeeklyHoursInput.addEventListener("input", updateStep1Summary);

if (step1NextBtn) {
  step1NextBtn.addEventListener("click", () => {
    const totalHours = parseFloat(totalWeeklyHoursInput?.value) || 0;
    if (totalHours <= 0) {
      showToast("Insira as horas disponíveis!", "error");
      return;
    }
    goToStep(2);
  });
}

if (step2BackBtn) {
  step2BackBtn.addEventListener("click", () => goToStep(1));
}

if (step2NextBtn) {
  step2NextBtn.addEventListener("click", () => {
    if (subjects.length === 0) {
      showToast("Adicione pelo menos uma disciplina!", "error");
      return;
    }
    goToStep(3);
  });
}

if (step3BackBtn) {
  step3BackBtn.addEventListener("click", () => goToStep(2));
}

// ==========================================
// PICKER DE PESO (1/2/3)
// ==========================================
if (weightPicker) {
  weightPicker.querySelectorAll(".weight-btn[data-weight]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedWeight = parseInt(btn.dataset.weight);
      weightPicker
        .querySelectorAll(".weight-btn[data-weight]")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const info = weightLabels[selectedWeight];
      if (weightHint) {
        weightHint.innerHTML = `Peso: <strong>${info.label}</strong> — ${info.desc}`;
      }
    });
  });
}

// ==========================================
// ADICIONAR / REMOVER DISCIPLINAS
// ==========================================
if (subjectNameInput) {
  subjectNameInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addSubjectBtn && addSubjectBtn.click();
    }
  });
}

if (addSubjectBtn) {
  addSubjectBtn.addEventListener("click", () => {
    const name = subjectNameInput.value.trim();

    if (!name) {
      showToast("Digite o nome da matéria!", "error");
      subjectNameInput.focus();
      return;
    }
    if (subjects.find((s) => s.name.toLowerCase() === name.toLowerCase())) {
      showToast("Essa matéria já foi adicionada!", "error");
      return;
    }

    subjects.push({
      id: Date.now(),
      name,
      weight: selectedWeight,
      colorClass: glassColors[colorIndexCounter % glassColors.length],
    });

    colorIndexCounter++;
    subjectNameInput.value = "";
    subjectNameInput.focus();
    renderSubjectsConfig();
  });
}

window.removeSubject = (id) => {
  subjects = subjects.filter((s) => s.id !== id);
  renderSubjectsConfig();
};

function renderSubjectsConfig() {
  if (!subjectListEl) return;

  const totalHours = parseFloat(totalWeeklyHoursInput?.value) || 0;
  const totalWeight = subjects.reduce((acc, s) => acc + s.weight, 0);

  if (subjects.length === 0) {
    subjectListEl.innerHTML = "";
    if (subjectEmptyState) {
      subjectListEl.appendChild(subjectEmptyState);
    } else {
      subjectListEl.innerHTML = `
        <li class="subject-empty-state" id="subjectEmptyState">
          <span class="subject-empty-icon">📚</span>
          <span class="subject-empty-title">Nenhuma disciplina ainda</span>
          <span class="subject-empty-hint">Digite acima e pressione Enter ou +</span>
        </li>`;
    }
    if (step2NextBtn) step2NextBtn.disabled = true;
    return;
  }

  if (step2NextBtn) step2NextBtn.disabled = false;

  subjectListEl.innerHTML = "";
  subjects.forEach((sub) => {
    const li = document.createElement("li");
    li.className = "subject-item tilt-element";
    li.draggable = true;
    li.dataset.id = sub.id;

    const subHoursWeek =
      totalWeight > 0 && totalHours > 0
        ? ((sub.weight / totalWeight) * totalHours).toFixed(1) + "h/sem"
        : "";

    li.innerHTML = `
      <span class="subject-drag-handle">⠿</span>
      <div class="subject-item-left">
        <div style="width: 12px; height: 12px; border-radius: 50%; flex-shrink:0;" class="${sub.colorClass}"></div>
        <span class="subject-item-name" title="${sub.name}">${sub.name}</span>
      </div>
      ${subHoursWeek ? `<span class="subject-item-hours">${subHoursWeek}</span>` : ""}
      <button class="btn-remove-subject" onclick="removeSubject(${sub.id})" title="Remover">✕</button>
    `;

    li.addEventListener("dragstart", () => {
      draggedItemId = sub.id;
      li.classList.add("dragging");
    });
    li.addEventListener("dragend", () => {
      li.classList.remove("dragging");
      subjectListEl
        .querySelectorAll(".subject-item")
        .forEach((el) => el.classList.remove("drag-over"));
    });
    li.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (sub.id !== draggedItemId) li.classList.add("drag-over");
    });
    li.addEventListener("dragleave", () => li.classList.remove("drag-over"));
    li.addEventListener("drop", (e) => {
      e.preventDefault();
      li.classList.remove("drag-over");
      if (draggedItemId === null || draggedItemId === sub.id) return;

      const fromIndex = subjects.findIndex((s) => s.id === draggedItemId);
      const toIndex = subjects.findIndex((s) => s.id === sub.id);
      if (fromIndex === -1 || toIndex === -1) return;

      const [moved] = subjects.splice(fromIndex, 1);
      subjects.splice(toIndex, 0, moved);
      draggedItemId = null;
      renderSubjectsConfig();
    });

    subjectListEl.appendChild(li);
  });
}

// ==========================================
// ETAPA 3 — REVISÃO
// ==========================================
function renderReviewStep() {
  if (!reviewSummary) return;

  const totalHours = parseFloat(totalWeeklyHoursInput?.value) || 0;
  const totalWeight = subjects.reduce((acc, s) => acc + s.weight, 0);

  let subjectsHtml = "";
  subjects.forEach((sub) => {
    const subHours =
      totalWeight > 0 ? (sub.weight / totalWeight) * totalHours : 0;
    const pct = totalHours > 0 ? (subHours / totalHours) * 100 : 0;
    subjectsHtml += `
      <div class="review-subject-item">
        <span title="${sub.name}">${sub.name}</span>
        <div class="review-subject-bar-wrap">
          <div class="review-subject-bar ${sub.colorClass}" style="width:${pct}%;"></div>
        </div>
        <span>${subHours.toFixed(1)}h/sem</span>
      </div>
    `;
  });

  reviewSummary.innerHTML = `
    <div class="review-row">
      <span class="review-row-label">⏱️ Total de horas</span>
      <span class="review-row-value">${totalHours}h / semana</span>
    </div>
    <div class="review-row">
      <span class="review-row-label">📅 Distribuição</span>
      <span class="review-row-value">7 dias (Dom–Sáb)</span>
    </div>
    <div class="review-row">
      <span class="review-row-label">📚 Disciplinas</span>
      <span class="review-row-value">${subjects.length}</span>
    </div>
    <div class="review-subject-list">${subjectsHtml}</div>
  `;
}

// ==========================================
// GERAR CICLO (KANBAN)
// ==========================================
if (generatePlanBtn) {
  generatePlanBtn.addEventListener("click", async () => {
    if (!currentUserUid) return;

    const totalHours = parseFloat(totalWeeklyHoursInput.value);

    if (isNaN(totalHours) || totalHours <= 0) {
      showToast("Insira as horas disponíveis válidas!", "error");
      return;
    }
    if (subjects.length === 0) {
      showToast("Adicione pelo menos uma matéria!", "error");
      return;
    }

    const originalText = generatePlanBtn.innerHTML;
    generatePlanBtn.innerHTML = "A gerar...";
    generatePlanBtn.disabled = true;

    const totalWeight = subjects.reduce((acc, curr) => acc + curr.weight, 0);

    const newPlanner = {
      createdAt: new Date().toISOString(),
      totalTargetHours: totalHours,
      streak: 0,
      lastCompletedDayIndex: null,
      days: daysOfWeek.map((dayName) => {
        return {
          name: dayName,
          tasks: subjects.map((sub) => {
            const dailyHoursDecimal =
              ((sub.weight / totalWeight) * totalHours) / 7;
            return {
              name: sub.name,
              hoursDecimal: dailyHoursDecimal,
              hoursStr: formatTime(dailyHoursDecimal),
              colorClass: sub.colorClass,
              completed: false,
              studiedDecimal: 0,
              topic: "",
              category: "",
            };
          }),
        };
      }),
    };

    try {
      await updateDoc(doc(db, "users", currentUserUid), {
        studyPlanner: newPlanner,
      });
      showToast("Ciclo de estudos gerado com sucesso!", "success");

      subjects = [];
      colorIndexCounter = 0;
      renderSubjectsConfig();
      totalWeeklyHoursInput.value = "";
      updateStep1Summary();
      goToStep(1);

      renderPlanner(newPlanner);
    } catch (error) {
      console.error("Erro ao salvar:", error);
      showToast("Erro ao criar o calendário.", "error");
    } finally {
      generatePlanBtn.innerHTML = originalText;
      generatePlanBtn.disabled = false;
    }
  });
}

if (btnNewPlan) {
  btnNewPlan.addEventListener("click", async () => {
    if (confirm("Isto irá descartar o ciclo atual. Deseja replanejar?")) {
      showEmptyState();
      if (currentUserUid) {
        await updateDoc(doc(db, "users", currentUserUid), {
          studyPlanner: null,
        });
      }
    }
  });
}

// ==========================================
// TOGGLE DE VISÃO: SEMANA / FOCO NO DIA
// ==========================================
if (btnViewWeek) {
  btnViewWeek.addEventListener("click", () => {
    currentView = "week";
    btnViewWeek.classList.add("active");
    btnViewToday.classList.remove("active");
    if (weeklyCalendar) weeklyCalendar.classList.remove("focus-mode");
  });
}
if (btnViewToday) {
  btnViewToday.addEventListener("click", () => {
    currentView = "today";
    btnViewToday.classList.add("active");
    btnViewWeek.classList.remove("active");
    if (weeklyCalendar) weeklyCalendar.classList.add("focus-mode");
  });
}

// ==========================================
// EXPORTAR CRONOGRAMA (copiar texto)
// ==========================================
if (btnExportCopy) {
  btnExportCopy.addEventListener("click", async () => {
    const data = window.currentPlannerData;
    if (!data) return;

    let text = `📚 *Ciclo de Estudos* (${data.totalTargetHours}h/semana)\n\n`;
    data.days.forEach((day) => {
      if (day.tasks.length === 0) return;
      text += `*${day.name}*\n`;
      day.tasks.forEach((task) => {
        const check = task.completed ? "✅" : "⬜";
        text += `${check} ${task.name} — ${task.hoursStr}\n`;
      });
      text += "\n";
    });

    try {
      await navigator.clipboard.writeText(text);
      showToast("Cronograma copiado! 📋", "success");
    } catch (e) {
      console.error("Erro ao copiar:", e);
      showToast("Não foi possível copiar.", "error");
    }
  });
}

// ==========================================
// RENDERIZAÇÃO DO KANBAN
// ==========================================
function renderPlanner(plannerData) {
  window.currentPlannerData = plannerData;

  emptyState.style.display = "none";
  plannerFormArea.style.display = "none";
  plannerActive.style.display = "block";
  if (btnNewPlan) btnNewPlan.style.display = "inline-flex";
  if (viewToggle) viewToggle.style.display = "flex";
  if (btnExportCopy) btnExportCopy.style.display = "inline-flex";

  if (
    weeklyCalendar &&
    weeklyCalendar.dataset.plannerId !== plannerData.createdAt
  ) {
    weeklyCalendar.dataset.plannerId = plannerData.createdAt;
    weeklyCalendar.innerHTML = "";
    weeklyCalendar.classList.toggle("focus-mode", currentView === "today");

    const todayIndex = new Date().getDay();

    plannerData.days.forEach((day, dayIndex) => {
      const dayCol = document.createElement("div");
      const isToday = dayIndex === todayIndex;
      dayCol.className = `calendar-col${isToday ? " today-col" : ""}`;
      dayCol.dataset.dayIndex = dayIndex;

      let tasksHtml = "";
      day.tasks.forEach((task, taskIndex) => {
        const uniqueId = `task-${dayIndex}-${taskIndex}`;
        const bgColor = task.colorClass || "glass-blue";

        tasksHtml += `
                    <div class="task-card-glass ${bgColor}" id="block-${uniqueId}" onclick="openRegisterModal(${dayIndex}, ${taskIndex})">
                        <div class="card-title-glass">${task.name}</div>
                        <div class="card-time-pill">${task.hoursStr}</div>
                    </div>
                `;
      });

      dayCol.innerHTML = `
                <div class="calendar-col-header">${day.name}<span class="col-today-badge">Hoje</span><span class="col-complete-badge">✓ Feito</span></div>
                <div class="calendar-col-body">${tasksHtml}</div>
            `;
      weeklyCalendar.appendChild(dayCol);
    });
  }

  syncPlannerUI(plannerData);
}

// ==========================================
// SINCRONIZAÇÃO DE UI
// ==========================================
function syncPlannerUI(plannerData) {
  let targetHours = 0;
  let completedHours = 0;

  const subjectStats = {};

  plannerData.days.forEach((day, dayIndex) => {
    let dayDone = 0;

    day.tasks.forEach((task, taskIndex) => {
      targetHours += task.hoursDecimal;
      if (task.completed) {
        completedHours += task.studiedDecimal;
        dayDone++;
      }

      if (!subjectStats[task.name]) {
        subjectStats[task.name] = {
          done: 0,
          total: 0,
          colorClass: task.colorClass,
        };
      }
      subjectStats[task.name].total++;
      if (task.completed) subjectStats[task.name].done++;

      const uniqueId = `task-${dayIndex}-${taskIndex}`;
      const block = document.getElementById(`block-${uniqueId}`);

      if (block) {
        block.classList.toggle("completed", task.completed);
      }
    });

    const total = day.tasks.length;
    const allDone = total > 0 && dayDone === total;
    const dayCol = weeklyCalendar?.querySelector(
      `.calendar-col[data-day-index="${dayIndex}"]`,
    );
    if (dayCol) {
      const wasComplete = dayCol.classList.contains("day-complete");
      if (allDone && !wasComplete) {
        dayCol.classList.add("day-complete");
      } else if (!allDone) {
        dayCol.classList.remove("day-complete");
      }
    }
  });

  const progressBar = document.getElementById("plannerProgressBar");
  const progressText = document.getElementById("plannerProgressText");
  const cycleTimeText = document.getElementById("cycleTimeText");

  const progressPercentage =
    targetHours === 0
      ? 0
      : Math.min(100, Math.round((completedHours / targetHours) * 100));

  if (progressBar) progressBar.style.width = `${progressPercentage}%`;
  if (progressText) progressText.innerText = `${progressPercentage}%`;
  if (cycleTimeText)
    cycleTimeText.innerText = `${formatTime(completedHours)} / ${formatTime(targetHours)}`;

  const motivationEl = document.getElementById("plannerMotivation");
  if (motivationEl) {
    motivationEl.textContent = getMotivationMessage(progressPercentage);
  }

  renderSubjectProgress(subjectStats);
}

function getMotivationMessage(pct) {
  if (pct === 0)
    return "🚀 Vamos começar! Abra um card e registre sua primeira sessão.";
  if (pct < 50)
    return "💡 Você já começou — cada sessão registrada é um passo a mais.";
  if (pct < 100)
    return "💪 Metade do caminho! Você já provou que consegue — não para agora.";
  return "🏆 Ciclo completo! Você cumpriu toda a meta da semana. Hora de comemorar!";
}

// ==========================================
// PROGRESSO POR MATÉRIA
// ==========================================
function renderSubjectProgress(subjectStats) {
  if (!subjectProgressSection) return;

  const names = Object.keys(subjectStats);
  if (names.length === 0) {
    subjectProgressSection.innerHTML = "";
    return;
  }

  let html = `<p class="subject-progress-section-title">📈 Progresso por disciplina</p>`;
  names.forEach((name) => {
    const stat = subjectStats[name];
    const pct =
      stat.total === 0 ? 0 : Math.round((stat.done / stat.total) * 100);
    const colorClass = stat.colorClass || "glass-blue";
    const countLabel =
      stat.done === stat.total
        ? `${stat.done}/${stat.total} ✓`
        : `${stat.done}/${stat.total}`;
    html += `
      <div class="subject-progress-row">
        <div class="subject-progress-header">
          <span class="subject-progress-name"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;" class="${colorClass}"></span>${name}</span>
          <span class="subject-progress-count">${countLabel}</span>
        </div>
        <div class="subject-progress-bar-bg">
          <div class="subject-progress-bar-fill ${colorClass}" style="width:${pct}%;"></div>
        </div>
      </div>
    `;
  });

  subjectProgressSection.innerHTML = html;
}

const themeToggle = document.getElementById("themeToggle");
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

// ==========================================
// MODAL DE REGISTRO
// ==========================================
window.openRegisterModal = function (dayIndex, taskIndex) {
  const task = window.currentPlannerData.days[dayIndex].tasks[taskIndex];

  regSubjectDisplay.innerText = task.name;
  regTargetTimeDisplay.innerText = task.hoursStr;

  regTime.value = task.completed
    ? task.studiedDecimal.toFixed(1)
    : task.hoursDecimal.toFixed(1);
  regTopic.value = task.topic || "";
  regCategory.value = task.category || "Teoria";

  regDayIndex.value = dayIndex;
  regTaskIndex.value = taskIndex;

  registerModal.classList.add("active");
};

if (closeRegisterBtn) {
  closeRegisterBtn.addEventListener("click", () => {
    registerModal.classList.remove("active");
  });
}

if (saveRegisterBtn) {
  saveRegisterBtn.addEventListener("click", async () => {
    if (!currentUserUid || !window.currentPlannerData) return;

    const originalText = saveRegisterBtn.innerHTML;
    saveRegisterBtn.innerHTML = "A guardar...";
    saveRegisterBtn.disabled = true;

    const data = window.currentPlannerData;
    const dIdx = parseInt(regDayIndex.value);
    const tIdx = parseInt(regTaskIndex.value);
    const day = data.days[dIdx];
    const task = day.tasks[tIdx];

    const wasAlreadyCompleted = task.completed;
    const studiedVal = parseFloat(regTime.value) || task.hoursDecimal;

    task.completed = true;
    task.topic = regTopic.value.trim();
    task.category = regCategory.value;
    task.studiedDecimal = studiedVal;

    syncPlannerUI(data);

    if (!wasAlreadyCompleted && window.awardXP) {
      await window.awardXP(15, "Sessão Concluída");
    } else if (wasAlreadyCompleted) {
      showToast("Sessão atualizada!", "success");
    }

    if (!wasAlreadyCompleted) {
      const allDone =
        day.tasks.length > 0 && day.tasks.every((t) => t.completed);
      if (allDone) {
        const lastCompleted = data.lastCompletedDayIndex;
        let newStreak = data.streak || 0;

        if (lastCompleted !== null && lastCompleted !== dIdx) {
          newStreak += 1;
        } else if (lastCompleted === null) {
          newStreak = 1;
        }

        data.streak = newStreak;
        data.lastCompletedDayIndex = dIdx;

        if (newStreak >= 2) {
          setTimeout(() => {
            showToast(
              `🔥 ${newStreak} dias seguidos! Continue assim para ganhar bônus de XP!`,
              "success",
            );
          }, 600);
        } else {
          setTimeout(() => {
            showToast("✅ Dia completo! Excelente trabalho!", "success");
          }, 600);
        }
      }
    }

    try {
      await updateDoc(doc(db, "users", currentUserUid), {
        studyPlanner: data,
      });
    } catch (error) {
      console.error("Erro ao sincronizar progresso:", error);
    } finally {
      saveRegisterBtn.innerHTML = originalText;
      saveRegisterBtn.disabled = false;
      registerModal.classList.remove("active");
    }
  });
}

renderSubjectsConfig();
updateStep1Summary();
goToStep(1);
