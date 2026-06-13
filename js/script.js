import { auth } from "./firebase-init.js";
import {
  onAuthStateChanged,
  signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  onSnapshot,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "./firebase-init.js";
import { checkMonthlyReset, calculateLevel, addUserXP } from "./xpSystem.js";

let currentUserUid = null;

// --- FUNÇÃO DE CORREÇÃO PARA MOBILE ---
async function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 400;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}

// ==========================================
// 1. ELEMENTOS UI E INICIALIZAÇÃO
// ==========================================
const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const themeToggle = document.getElementById("themeToggle");

let chatHistory = [
  {
    role: "user",
    parts: [
      {
        text: "Você é o Bitto, um assistente de estudos universitário inteligente, motivador e direto. Suas respostas devem ser curtas e úteis. Use emojis ocasionalmente para deixar o papo leve.",
      },
    ],
  },
  {
    role: "model",
    parts: [
      { text: "Entendido! Sou o Bitto. Vamos dominar os estudos juntos? 🚀" },
    ],
  },
];

// ==========================================
// 2. AUTENTICAÇÃO E DADOS
// ==========================================
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUserUid = user.uid;
    await checkMonthlyReset(user);
    const emailInput = document.getElementById("settingsEmailInput");
    if (emailInput) emailInput.value = user.email;

    onSnapshot(doc(db, "users", user.uid), (docSnapshot) => {
      if (docSnapshot.exists()) {
        updateInterface(user, docSnapshot.data());
      }
    });

    setupSettingsSave(user);
  } else {
    window.location.href = "../index.html";
  }
});

function updateInterface(user, dbData) {
  const currentXP = dbData.xp || 0;
  const levelData = calculateLevel(currentXP);
  const displayName = dbData.displayName || user.displayName || "Estudante";
  const firstName = displayName.split(" ")[0];

  const planNav = document.getElementById("userPlanNav");
  const planMobile = document.getElementById("userPlanMobile");
  const userPlan = dbData.plan || "free";

  if (planNav) {
    planNav.innerText = userPlan.toUpperCase();
    if (userPlan === "free") {
      planNav.style.background = "var(--border-color)";
      planNav.style.color = "var(--text-muted)";
      planNav.style.boxShadow = "none";
    } else {
      planNav.style.background = "var(--accent-green)";
      planNav.style.color = "var(--primary-blue)";
      planNav.style.boxShadow = "0 0 10px rgba(204, 255, 0, 0.2)";
    }
  }

  if (planMobile) {
    planMobile.innerText = userPlan === "free" ? "Plano Gratuito" : "Plano Pro";
  }

  document.getElementById("navUserName").innerText = firstName;
  document.getElementById("ddUserName").innerText = displayName;
  document.getElementById("userXP").innerText = currentXP;
  document.getElementById("xpText").innerText =
    `${currentXP} / ${levelData.limit} XP`;
  document.getElementById("ddLevel").innerText = `Nível ${levelData.level}`;
  document.getElementById("mascotLevelText").innerText =
    `Nível ${levelData.level}`;

  const stats = dbData.stats || {};
  const generatedCount = stats.cardsGeneratedMonth || 0;
  const generatedCountEl = document.getElementById("generatedCount");
  if (generatedCountEl) {
    generatedCountEl.innerText = `${generatedCount} Cards`;
    generatedCountEl.style.color =
      generatedCount > 50 ? "var(--accent-green)" : "var(--primary-blue)";
  }

  let range = levelData.limit - levelData.min;
  let progress = currentXP - levelData.min;
  let percentage = Math.max(0, Math.min(100, (progress / range) * 100));
  const bar = document.getElementById("xpBarFill");
  if (bar) bar.style.width = `${percentage}%`;

  updateGreeting(firstName);
  updateMascotImage(currentXP);

  // GESTÃO DO PLANEAMENTO: Mostra se existir, caso contrário devolve o formulário
  if (dbData.studyPlanner) {
    renderPlanner(dbData.studyPlanner);
  } else {
    const plannerFormArea = document.getElementById("plannerFormArea");
    const plannerResult = document.getElementById("plannerResult");
    const weeklyCalendar = document.getElementById("weeklyCalendar");
    if (plannerFormArea && plannerResult) {
      plannerFormArea.style.display = "block";
      plannerResult.style.display = "none";
    }
    if (weeklyCalendar) weeklyCalendar.dataset.plannerId = "";
  }

  const photoURL = dbData.photoURL || user.photoURL;
  if (photoURL) {
    document
      .querySelectorAll(".avatar-circle, .avatar-placeholder-large")
      .forEach((el) => {
        el.innerHTML = `<img src="${photoURL}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
      });
    const preview = document.getElementById("settingsAvatarPreview");
    if (preview) {
      preview.src = photoURL;
      preview.style.display = "block";
    }
    const placeholder = document.getElementById("settingsAvatarPlaceholder");
    if (placeholder) placeholder.style.display = "none";
  }

  const nameInput = document.getElementById("settingsNameInput");
  if (nameInput) nameInput.value = displayName;
}

function updateMascotImage(xp) {
  const mascotImg = document.getElementById("mascotImage");
  if (!mascotImg) return;
  let imageName = "bittinho-0";
  if (xp >= 5800) imageName = "bittinho-5800";
  else if (xp >= 4200) imageName = "bittinho-4200";
  else if (xp >= 3000) imageName = "bittinho-3000";
  else if (xp >= 2100) imageName = "bittinho-2100";
  else if (xp >= 1400) imageName = "bittinho-1400";
  else if (xp >= 900) imageName = "bittinho-900";
  else if (xp >= 500) imageName = "bittinho-500";
  else if (xp >= 250) imageName = "bittinho-250";
  else if (xp >= 100) imageName = "bittinho-100";
  mascotImg.src = `../bittinhos/${imageName}.png`;
}

function updateGreeting(name) {
  const hour = new Date().getHours();
  const greetingElement = document.getElementById("greetingText");
  if (greetingElement) {
    let greeting =
      hour >= 5 && hour < 12
        ? "Bom dia"
        : hour >= 12 && hour < 18
          ? "Boa tarde"
          : "Boa noite";
    greetingElement.innerText = `${greeting}, ${name}! 👋`;
  }
}

// ==========================================
// 3. MENU MOBILE & NAVEGAÇÃO
// ==========================================
const hamburgerBtn = document.getElementById("hamburgerBtn");
const mobileMenu = document.getElementById("mobileMenu");
const mobileMenuOverlay = document.getElementById("mobileMenuOverlay");
const closeMenuBtn = document.getElementById("closeMenuBtn");
const mobileConfigBtn = document.getElementById("mobileConfigBtn");
const mobileLogoutBtn = document.getElementById("mobileLogoutBtn");

function toggleMobileMenu() {
  mobileMenu.classList.toggle("active");
  mobileMenuOverlay.classList.toggle("active");
}

if (hamburgerBtn) hamburgerBtn.addEventListener("click", toggleMobileMenu);
if (closeMenuBtn) closeMenuBtn.addEventListener("click", toggleMobileMenu);
if (mobileMenuOverlay)
  mobileMenuOverlay.addEventListener("click", toggleMobileMenu);

if (mobileConfigBtn)
  mobileConfigBtn.addEventListener("click", (e) => {
    e.preventDefault();
    toggleMobileMenu();
    openSettings();
  });
if (mobileLogoutBtn)
  mobileLogoutBtn.addEventListener("click", (e) => {
    e.preventDefault();
    toggleMobileMenu();
    openLogoutModal();
  });

// ==========================================
// 4. CONFIGURAÇÕES E LOGOUT
// ==========================================
const settingsModal = document.getElementById("settingsModal");
const navConfigBtn = document.getElementById("navConfigBtn");
const ddAccountBtn = document.getElementById("ddAccountBtn");
const closeSettingsBtn = document.getElementById("closeSettingsBtn");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");
const avatarInput = document.getElementById("avatarInput");

function openSettings() {
  settingsModal.classList.add("active");
}
function closeSettings() {
  settingsModal.classList.remove("active");
}

if (navConfigBtn)
  navConfigBtn.addEventListener("click", (e) => {
    e.preventDefault();
    openSettings();
  });
if (ddAccountBtn)
  ddAccountBtn.addEventListener("click", (e) => {
    e.preventDefault();
    openSettings();
  });
if (closeSettingsBtn) closeSettingsBtn.addEventListener("click", closeSettings);

if (avatarInput) {
  avatarInput.addEventListener("change", async function (e) {
    const file = e.target.files[0];
    if (file) {
      try {
        const compressedSrc = await compressImage(file);
        const preview = document.getElementById("settingsAvatarPreview");
        const placeholder = document.getElementById(
          "settingsAvatarPlaceholder",
        );
        preview.src = compressedSrc;
        preview.style.display = "block";
        placeholder.style.display = "none";
      } catch (err) {
        console.error("Erro ao processar imagem:", err);
        showToast("Erro ao carregar imagem no celular.", "error");
      }
    }
  });
}

function setupSettingsSave(user) {
  if (saveSettingsBtn) {
    const newBtn = saveSettingsBtn.cloneNode(true);
    saveSettingsBtn.parentNode.replaceChild(newBtn, saveSettingsBtn);
    newBtn.addEventListener("click", async () => {
      const newName = document.getElementById("settingsNameInput").value;
      const previewSrc = document.getElementById("settingsAvatarPreview").src;
      const hasNewImage =
        document.getElementById("settingsAvatarPreview").style.display !==
        "none";
      const originalText = newBtn.innerText;
      newBtn.innerText = "Salvando...";
      newBtn.disabled = true;

      try {
        const updateData = { displayName: newName };

        if (hasNewImage && previewSrc.startsWith("data:image")) {
          updateData.photoURL = previewSrc;
        }

        await updateProfile(user, {
          displayName: newName,
        });

        await updateDoc(doc(db, "users", user.uid), updateData);

        showToast("Perfil atualizado!", "success");
        closeSettings();
      } catch (error) {
        console.error(error);
        showToast("Erro ao atualizar.", "error");
      } finally {
        newBtn.innerText = originalText;
        newBtn.disabled = false;
      }
    });
  }
}

const logoutBtn = document.getElementById("logoutBtn");
const modalLogoutBtn = document.getElementById("modalLogoutBtn");
const confirmModal = document.getElementById("confirmModal");
const acceptConfirmBtn = document.getElementById("acceptConfirmBtn");
const cancelConfirmBtn = document.getElementById("cancelConfirmBtn");

function openLogoutModal(e) {
  if (e) e.preventDefault();
  confirmModal.classList.add("active");
}
if (logoutBtn) logoutBtn.addEventListener("click", openLogoutModal);
if (modalLogoutBtn) modalLogoutBtn.addEventListener("click", openLogoutModal);
if (cancelConfirmBtn)
  cancelConfirmBtn.addEventListener("click", () =>
    confirmModal.classList.remove("active"),
  );

if (acceptConfirmBtn)
  acceptConfirmBtn.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "../index.html";
  });

const profileDropdown = document.getElementById("profileDropdown");
const profileBtn = document.getElementById("profileBtn");
if (profileBtn)
  profileBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    profileDropdown.classList.toggle("active");
  });
document.addEventListener("click", () => {
  if (profileDropdown) profileDropdown.classList.remove("active");
});

// ==========================================
// 5. VISUAIS E CHAT
// ==========================================
const tiltElements = document.querySelectorAll(".tilt-element");
document.addEventListener("mousemove", (e) => {
  if (window.innerWidth > 900) {
    tiltElements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (
        x >= -50 &&
        x <= rect.width + 50 &&
        y >= -50 &&
        y <= rect.height + 50
      ) {
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = ((y - centerY) / centerY) * -3;
        const rotateY = ((x - centerX) / centerX) * 3;
        el.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
      } else {
        el.style.transform =
          "perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)";
      }
    });
  }
});

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const html = document.documentElement;
    const current = html.getAttribute("data-theme");
    const newTheme = current === "dark" ? "light" : "dark";
    html.setAttribute("data-theme", newTheme);
    localStorage.setItem("bitto_theme", newTheme);
    updateThemeIcons(newTheme);
  });
}

function updateThemeIcons(theme) {
  const sun = document.querySelector(".icon-sun");
  const moon = document.querySelector(".icon-moon");
  if (theme === "dark" && sun && moon) {
    sun.style.display = "none";
    moon.style.display = "block";
  } else if (sun && moon) {
    sun.style.display = "block";
    moon.style.display = "none";
  }
}

if (localStorage.getItem("bitto_theme") === "dark") updateThemeIcons("dark");
else updateThemeIcons("light");

function typeWriter(text, i) {
  if (i < text.length) {
    const target = document.getElementById("typewriterText");
    if (target) {
      target.innerHTML = text.substring(0, i + 1);
      setTimeout(() => typeWriter(text, i + 1), 30);
    }
  }
}
document.addEventListener("DOMContentLoaded", () => {
  typeWriter("Oi! Sou o Bitto. Vamos evoluir juntos?", 0);
});

window.sendChip = (text) => {
  if (chatInput) {
    chatInput.value = text;
    handleSend();
  }
};

async function handleSend() {
  const text = chatInput.value.trim();
  if (!text || sendBtn.disabled) return;
  sendBtn.disabled = true;
  chatInput.disabled = true;
  const originalBtnText = sendBtn.innerText;
  let timeLeft = 15;
  sendBtn.innerText = `⏳ ${timeLeft}`;
  const timer = setInterval(() => {
    timeLeft--;
    sendBtn.innerText = `⏳ ${timeLeft}`;
    if (timeLeft <= 0) {
      clearInterval(timer);
      sendBtn.disabled = false;
      chatInput.disabled = false;
      sendBtn.innerText = originalBtnText || "→";
      chatInput.focus();
    }
  }, 1000);
  addMessage(text, "user");
  chatHistory.push({ role: "user", parts: [{ text: text }] });
  chatInput.value = "";
  const loadingId = addLoadingMessage();
  try {
    const botText = await callGeminiChat(chatHistory.slice(-10));
    removeLoadingMessage(loadingId);
    if (botText) {
      addMessage(botText, "bot");
      chatHistory.push({ role: "model", parts: [{ text: botText }] });
    }
  } catch (error) {
    removeLoadingMessage(loadingId);
    addMessage("O Bitto precisa de um café. Tente em breve.", "bot");
  }
}

async function callGeminiChat(history) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: history }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error("Erro na API");
  return data.candidates[0].content.parts[0].text;
}

function addMessage(text, type) {
  const time = new Date().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const formattedText = text.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
  const messageDiv = document.createElement("div");
  messageDiv.className = `message message-${type}`;
  let contentHtml =
    type === "bot"
      ? `<div class="header-avatar" style="border:none; background: transparent; flex-shrink:0;"><div class="header-avatar" style="width:32px; height:32px;"><img src="../imagens/bittochat.png" style="width:100%; height:100%; object-fit:cover; border-radius:50%;"></div></div><div class="message-bubble">${formattedText}<span class="message-time">${time}</span></div>`
      : `<div class="message-bubble">${formattedText}<span class="message-time">${time}</span></div>`;
  messageDiv.innerHTML = contentHtml;
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addLoadingMessage() {
  const id = "loading-" + Date.now();
  const messageDiv = document.createElement("div");
  messageDiv.className = `message message-bot`;
  messageDiv.id = id;
  messageDiv.innerHTML = `<div class="header-avatar" style="border:none; background: transparent; flex-shrink:0;"><div class="header-avatar" style="width:32px; height:32px;"><img src="../imagens/bittochat.png" style="width:100%; height:100%; object-fit:cover; border-radius:50%;"></div></div><div class="message-bubble" style="color: var(--text-muted); font-style: italic;"><span class="cursor">|</span> Digitando...</div>`;
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return id;
}

function removeLoadingMessage(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

// FUNÇÃO GLOBAL DE TOAST
window.showToast = function (message, type = "success") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  let icon = type === "success" ? "✅" : type === "error" ? "❌" : "ℹ️";
  toast.innerHTML = `<span>${icon}</span> ${message}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
};

if (sendBtn) sendBtn.addEventListener("click", handleSend);
if (chatInput)
  chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  });

// ==========================================
// 6. LÓGICA DO PLANEJAMENTO (CALENDÁRIO UNIFICADO)
// ==========================================
const totalWeeklyHoursInput = document.getElementById("totalWeeklyHours");
const subjectNameInput = document.getElementById("subjectName");
const subjectWeightSelect = document.getElementById("subjectWeight");
const addSubjectBtn = document.getElementById("addSubjectBtn");
const subjectListEl = document.getElementById("subjectList");
const generatePlanBtn = document.getElementById("generatePlanBtn");
const btnNewPlan = document.getElementById("btnNewPlan");
const plannerFormArea = document.getElementById("plannerFormArea");
const plannerResult = document.getElementById("plannerResult");
const weeklyCalendar = document.getElementById("weeklyCalendar");

// Elementos do Modal de Registo
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

// Formatação do tempo de "1.5" para "1h30min"
function formatTime(decimalHours) {
  const h = Math.floor(decimalHours);
  const m = Math.round((decimalHours - h) * 60);
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h00min`;
  return `${h}h${m.toString().padStart(2, "0")}min`;
}

if (addSubjectBtn) {
  addSubjectBtn.addEventListener("click", () => {
    const name = subjectNameInput.value.trim();
    const weight = parseInt(subjectWeightSelect.value);

    if (!name) {
      window.showToast("Digite o nome da matéria!", "error");
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
      window.showToast("Insira as horas disponíveis válidas!", "error");
      return;
    }
    if (subjects.length === 0) {
      window.showToast("Adicione pelo menos uma matéria!", "error");
      return;
    }

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
              hoursDecimal: dailyHoursDecimal, // Guarda o número para cálculos
              hoursStr: formatTime(dailyHoursDecimal), // Guarda a string formatada
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
      window.showToast("Ciclo de estudos gerado com sucesso!", "success");
      subjects = [];
      colorIndexCounter = 0;
      renderSubjectsConfig();
      totalWeeklyHoursInput.value = "";
    } catch (error) {
      console.error("Erro ao salvar:", error);
      window.showToast("Erro ao criar o calendário.", "error");
    }
  });
}

if (btnNewPlan) {
  btnNewPlan.addEventListener("click", () => {
    if (confirm("Isto apagará o ciclo atual. Queres replanear?")) {
      plannerFormArea.style.display = "block";
      plannerResult.style.display = "none";
      btnNewPlan.style.display = "none";
      if (currentUserUid) {
        updateDoc(doc(db, "users", currentUserUid), { studyPlanner: null });
      }
    }
  });
}

// Renderiza a Board Unificada
function renderPlanner(plannerData) {
  window.currentPlannerData = plannerData;

  if (plannerFormArea && plannerResult) {
    plannerFormArea.style.display = "none";
    plannerResult.style.display = "block";
    if (btnNewPlan) btnNewPlan.style.display = "inline-block";
  }

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

// --- LÓGICA DO MODAL DE REGISTO ---
window.openRegisterModal = function (dayIndex, taskIndex) {
  const task = window.currentPlannerData.days[dayIndex].tasks[taskIndex];

  regSubjectDisplay.innerText = task.name;
  regTargetTimeDisplay.innerText = task.hoursStr;

  // Mostra o tempo decimal no input para facilitar a edição
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

    // Atualiza os dados na base de dados
    task.completed = true;
    task.topic = regTopic.value.trim();
    task.category = regCategory.value;
    task.studiedDecimal = studiedVal;

    syncPlannerUI(window.currentPlannerData);

    if (!wasAlreadyCompleted) {
      window.showToast("+15 XP! Estudo Registado! 🧠", "success");
      await addUserXP(currentUserUid, 15);
    } else {
      window.showToast("Sessão atualizada!", "success");
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
