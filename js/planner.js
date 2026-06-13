import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  getDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Elementos da UI - Sidebar
const totalWeeklyHoursInput = document.getElementById("totalWeeklyHours");
const subjectNameInput = document.getElementById("subjectName");
const subjectWeightSelect = document.getElementById("subjectWeight");
const addSubjectBtn = document.getElementById("addSubjectBtn");
const subjectListEl = document.getElementById("subjectList");
const generatePlanBtn = document.getElementById("generatePlanBtn");
const plannerFormArea = document.getElementById("plannerFormArea");

// Elementos da UI - Main Column
const emptyState = document.getElementById("emptyState");
const plannerActive = document.getElementById("plannerActive");
const btnNewPlan = document.getElementById("btnNewPlan");
const weeklyCalendar = document.getElementById("weeklyCalendar");

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
const glassColors = [
  "glass-blue",
  "glass-green",
  "glass-orange",
  "glass-purple",
  "glass-pink",
  "glass-cyan",
];

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
  plannerFormArea.style.display = "block";
}

// --- LÓGICA DO FORMULÁRIO ---
if (addSubjectBtn) {
  addSubjectBtn.addEventListener("click", () => {
    const name = subjectNameInput.value.trim();
    const weight = parseInt(subjectWeightSelect.value);

    if (!name) {
      showToast("Digite o nome da matéria!", "error");
      return;
    }

    subjects.push({
      id: Date.now(),
      name,
      weight,
      colorClass: glassColors[colorIndexCounter % glassColors.length],
    });

    colorIndexCounter++;
    subjectNameInput.value = "";
    renderSubjectsConfig();
  });
}

function renderSubjectsConfig() {
  if (!subjectListEl) return;
  subjectListEl.innerHTML = "";
  subjects.forEach((sub) => {
    const li = document.createElement("li");
    li.className = "subject-item tilt-element";
    const weightLabel =
      sub.weight === 1 ? "Peso 1" : sub.weight === 2 ? "Peso 2" : "Peso 3";
    li.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 12px; height: 12px; border-radius: 50%;" class="${sub.colorClass}"></div>
                <span>${sub.name} <small style="color: var(--text-muted); font-size: 0.8em;">(${weightLabel})</small></span>
            </div>
            <button class="btn-remove-subject" onclick="removeSubject(${sub.id})">✕</button>
        `;
    subjectListEl.appendChild(li);
  });
}

window.removeSubject = (id) => {
  subjects = subjects.filter((s) => s.id !== id);
  renderSubjectsConfig();
};

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
    const daysOfWeek = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

    const newPlanner = {
      createdAt: new Date().toISOString(),
      totalTargetHours: totalHours,
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

// --- RENDERIZAÇÃO DO KANBAN ---
function renderPlanner(plannerData) {
  window.currentPlannerData = plannerData;

  emptyState.style.display = "none";
  plannerFormArea.style.display = "none";
  plannerActive.style.display = "block";
  if (btnNewPlan) btnNewPlan.style.display = "inline-flex";

  if (
    weeklyCalendar &&
    weeklyCalendar.dataset.plannerId !== plannerData.createdAt
  ) {
    weeklyCalendar.dataset.plannerId = plannerData.createdAt;
    weeklyCalendar.innerHTML = "";

    plannerData.days.forEach((day, dayIndex) => {
      const dayCol = document.createElement("div");
      dayCol.className = "calendar-col";

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
                <div class="calendar-col-header">${day.name}</div>
                <div class="calendar-col-body">${tasksHtml}</div>
            `;
      weeklyCalendar.appendChild(dayCol);
    });
  }

  syncPlannerUI(plannerData);
}

function syncPlannerUI(plannerData) {
  let targetHours = 0;
  let completedHours = 0;

  plannerData.days.forEach((day, dayIndex) => {
    day.tasks.forEach((task, taskIndex) => {
      targetHours += task.hoursDecimal;
      if (task.completed) {
        completedHours += task.studiedDecimal;
      }

      const uniqueId = `task-${dayIndex}-${taskIndex}`;
      const block = document.getElementById(`block-${uniqueId}`);

      if (block) {
        if (task.completed) {
          block.classList.add("completed");
        } else {
          block.classList.remove("completed");
        }
      }
    });
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
}

// --- TEMA (Fallback caso o tools-core não pegue os botões desta página) ---
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

// --- MODAL DE REGISTRO ---
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

    const dIdx = regDayIndex.value;
    const tIdx = regTaskIndex.value;
    const task = window.currentPlannerData.days[dIdx].tasks[tIdx];

    const wasAlreadyCompleted = task.completed;
    const studiedVal = parseFloat(regTime.value) || task.hoursDecimal;

    task.completed = true;
    task.topic = regTopic.value.trim();
    task.category = regCategory.value;
    task.studiedDecimal = studiedVal;

    syncPlannerUI(window.currentPlannerData);

    // window.awardXP é injetado pelo tools-core.js
    if (!wasAlreadyCompleted && window.awardXP) {
      await window.awardXP(15, "Sessão Concluída");
    } else if (wasAlreadyCompleted) {
      showToast("Sessão atualizada!", "success");
    }

    try {
      await updateDoc(doc(db, "users", currentUserUid), {
        studyPlanner: window.currentPlannerData,
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
