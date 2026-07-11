import { auth, onAuthStateChanged } from "./firebase-init.js";
import { checkUsageLimit, incrementUsage } from "./userManager.js";

const themeToggle = document.getElementById("themeToggle");
const profileBtn = document.getElementById("profileBtn");
const profileDropdown = document.getElementById("profileDropdown");
const logoutBtn = document.getElementById("logoutBtn");
const hamburgerBtn = document.getElementById("hamburgerBtn");
const mobileMenuOverlay = document.getElementById("mobileMenuOverlay");
const mobileMenu = document.getElementById("mobileMenu");
const closeMenuBtn = document.getElementById("closeMenuBtn");
const mobileLogoutBtn = document.getElementById("mobileLogoutBtn");
const mobileConfigBtn = document.getElementById("mobileConfigBtn");
const navConfigBtn = document.getElementById("navConfigBtn");
const settingsModal = document.getElementById("settingsModal");
const closeSettingsBtn = document.getElementById("closeSettingsBtn");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");
const modalLogoutBtn = document.getElementById("modalLogoutBtn");
const confirmModal = document.getElementById("confirmModal");
const acceptConfirmBtn = document.getElementById("acceptConfirmBtn");
const cancelConfirmBtn = document.getElementById("cancelConfirmBtn");
const settingsNameInput = document.getElementById("settingsNameInput");
const settingsEmailInput = document.getElementById("settingsEmailInput");
const xpBarFill = document.getElementById("xpBarFill");
const xpText = document.getElementById("xpText");
const ddLevel = document.getElementById("ddLevel");
const ddUserName = document.getElementById("ddUserName");
const userXP = document.getElementById("userXP");
const userPlanNav = document.getElementById("userPlanNav");
const userPlanMobile = document.getElementById("userPlanMobile");
const navUserName = document.getElementById("navUserName");
const greetingText = document.getElementById("greetingText");
const mascotImage = document.getElementById("mascotImage");
const mascotLevelText = document.getElementById("mascotLevelText");
const generatedCount = document.getElementById("generatedCount");
const generatedDetails = document.getElementById("generatedDetails");
const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const ddAccountBtn = document.getElementById("ddAccountBtn");
const settingsAvatarPreview = document.getElementById("settingsAvatarPreview");
const settingsAvatarPlaceholder = document.getElementById("settingsAvatarPlaceholder");
const avatarInput = document.getElementById("avatarInput");

let currentUser = null;
let chatHistory = [];
const mascotLevels = [
  "../bittinhos/bittinho-0.png",
  "../bittinhos/bittinho-1.png",
  "../bittinhos/bittinho-2.png",
  "../bittinhos/bittinho-3.png",
];

// --- AUTH STATE ---
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    settingsEmailInput.value = user.email;
    settingsNameInput.value = user.displayName || "Aluno";
    navUserName.textContent = user.displayName || "Aluno";
    greetingText.textContent = `Boa noite, ${user.displayName || "Aluno"}! 👋`;
    ddUserName.textContent = user.displayName || "Aluno";
    updatePlanDisplay();
    loadUserStats();
    loadUserAvatar();
    const greetingHour = new Date().getHours();
    if (greetingHour < 12) {
      greetingText.textContent = `Bom dia, ${user.displayName || "Aluno"}! 🌅`;
    } else if (greetingHour < 18) {
      greetingText.textContent = `Boa tarde, ${user.displayName || "Aluno"}! ☀️`;
    }
  } else {
    window.location.href = "login.html";
  }
});

// --- PLAN DISPLAY ---
async function updatePlanDisplay() {
  if (!currentUser) return;
  const userDoc = await getDoc(doc(db, "users", currentUser.uid));
  if (!userDoc.exists()) return;
  const plan = userDoc.data().plan || "free";
  const planText =
    plan === "free"
      ? "FREE"
      : plan === "monthly"
        ? "MONTHLY"
        : plan === "quarterly"
          ? "QUARTERLY"
          : "ANNUAL";
  userPlanNav.textContent = planText;
  userPlanMobile.textContent = planText;
}

// --- THEME TOGGLE ---
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
      if (sunIcon) sunIcon.display = "none";
      if (moonIcon) moonIcon.style.display = "block";
    }
  });
}

// --- PROFILE DROPDOWN ---
if (profileBtn) {
  profileBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    profileDropdown.style.display =
      profileDropdown.style.display === "block" ? "none" : "block";
  });
}

document.addEventListener("click", () => {
  if (profileDropdown) profileDropdown.style.display = "none";
});

// --- MENU MOBILE ---
if (hamburgerBtn) {
  hamburgerBtn.addEventListener("click", () => {
    mobileMenuOverlay.style.display = "block";
    mobileMenu.style.display = "flex";
  });
}

if (closeMenuBtn) {
  closeMenuBtn.addEventListener("click", () => {
    mobileMenuOverlay.style.display = "none";
    mobileMenu.style.display = "none";
  });
}

if (mobileMenuOverlay) {
  mobileMenuOverlay.addEventListener("click", () => {
    mobileMenuOverlay.style.display = "none";
    mobileMenu.style.display = "none";
  });
}

// --- SETTINGS MODAL ---
if (navConfigBtn) {
  navConfigBtn.addEventListener("click", () => {
    settingsModal.style.display = "flex";
    document.body.style.overflow = "hidden";
  });
}

if (mobileConfigBtn) {
  mobileConfigBtn.addEventListener("click", () => {
    mobileMenuOverlay.style.display = "none";
    mobileMenu.style.display = "none";
    settingsModal.style.display = "flex";
    document.body.style.overflow = "hidden";
  });
}

if (closeSettingsBtn) {
  closeSettingsBtn.addEventListener("click", () => {
    settingsModal.style.display = "none";
    document.body.style.overflow = "";
  });
}

if (saveSettingsBtn) {
  saveSettingsBtn.addEventListener("click", async () => {
    if (!currentUser) return;
    const newName = settingsNameInput.value;
    try {
      await updateProfile(currentUser, { displayName: newName });
      await updateDoc(doc(db, "users", currentUser.uid), { name: newName });
      navUserName.textContent = newName;
      greetingText.textContent = `Boa noite, ${newName}! 👋`;
      showToast("Perfil atualizado com sucesso!", "success");
      settingsModal.style.display = "none";
      document.body.style.overflow = "";
    } catch (error) {
      showToast("Erro ao salvar: " + error.message, "error");
    }
  });
}

// --- AVATAR ---
if (avatarInput) {
  avatarInput.addEventListener("change", async (e) => {
    if (!currentUser || !e.target.files[0]) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataURL = event.target.result;
      settingsAvatarPreview.src = dataURL;
      settingsAvatarPreview.style.display = "block";
      if (settingsAvatarPlaceholder)
        settingsAvatarPlaceholder.style.display = "none";
      try {
        await updateProfile(currentUser, { photoURL: dataURL });
        loadUserAvatar();
      } catch (error) {
        showToast("Erro ao atualizar avatar: " + error.message, "error");
      }
    };
    reader.readAsDataURL(e.target.files[0]);
  });
}

function loadUserAvatar() {
  if (!currentUser) return;
  const photoURL = currentUser.photoURL;
  if (photoURL) {
    settingsAvatarPreview.src = photoURL;
    settingsAvatarPreview.style.display = "block";
    if (settingsAvatarPlaceholder) settingsAvatarPlaceholder.style.display = "none";
  } else {
    settingsAvatarPreview.style.display = "none";
    if (settingsAvatarPlaceholder)
      settingsAvatarPlaceholder.style.display = "flex";
  }
}

// --- LOGOUT ---
function openConfirmLogout() {
  confirmModal.style.display = "flex";
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", openConfirmLogout);
}

if (modalLogoutBtn) {
  modalLogoutBtn.addEventListener("click", openConfirmLogout);
}

if (mobileLogoutBtn) {
  mobileLogoutBtn.addEventListener("click", openConfirmLogout);
}

if (acceptConfirmBtn) {
  acceptConfirmBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
      window.location.href = "login.html";
    } catch (error) {
      showToast("Erro ao sair: " + error.message, "error");
    }
  });
}

if (cancelConfirmBtn) {
  cancelConfirmBtn.addEventListener("click", () => {
    confirmModal.style.display = "none";
  });
}

// --- USER STATS ---
async function loadUserStats() {
  if (!currentUser) return;
  const userDoc = await getDoc(doc(db, "users", currentUser.uid));
  if (!userDoc.exists()) return;
  const userData = userDoc.data();
  const xp = userData.xp || 0;
  const level = Math.floor(xp / 100) + 1;
  const xpProgress = xp % 100;
  userXP.textContent = xp;
  ddLevel.textContent = `Nível ${level}`;
  mascotLevelText.textContent = `Nível ${level}`;
  if (xpBarFill) xpBarFill.style.width = `${xpProgress}%`;
  if (xpText) xpText.textContent = `${xpProgress} / 100 XP`;
  if (mascotImage && mascotLevels[level - 1])
    mascotImage.src = mascotLevels[level - 1];
  const monthKey = new Date().toISOString().slice(0, 7);
  const totalUsos =
    (userData[`usage_flashcards_${monthKey}`] || 0) +
    (userData[`usage_quiz_${monthKey}`] || 0) +
    (userData[`usage_review_${monthKey}`] || 0);
  generatedCount.textContent = `${totalUsos} Usos`;
  generatedDetails.textContent = `${10 - (userData[`usage_flashcards_${monthKey}`] || 0)} Flashcards • ${3 - (userData[`usage_quiz_${monthKey}`] || 0)} Quiz • ${5 - (userData[`usage_review_${monthKey}`] || 0)} Review`;
}

// --- CHAT ---
async function handleSend() {
  if (!sendBtn || sendBtn.disabled) return;
  const text = chatInput.value.trim();
  if (!text) return;
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

// ========================================
// 🎁 MODAL DE PLANOS - ASSINATURA
// ========================================

// Criar Modal de Planos
function createPlansModal() {
    const modal = document.createElement('div');
    modal.id = 'plansModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        backdrop-filter: blur(5px);
    `;
    
    modal.innerHTML = `
        <div style="
            background: white;
            border-radius: 16px;
            padding: 40px;
            max-width: 900px;
            width: 90%;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        ">
            <!-- CLOSE BUTTON -->
            <button onclick="document.getElementById('plansModal').remove()" style="
                position: absolute;
                top: 20px;
                right: 20px;
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #666;
            ">✕</button>

            <!-- HEADER -->
            <div style="text-align: center; margin-bottom: 40px;">
                <h1 style="color: #333; margin: 0 0 10px 0; font-size: 28px;">🚀 Escolha seu Plano</h1>
                <p style="color: #666; margin: 0; font-size: 14px;">Efetue a assinatura com o email da sua conta para ativar seu plano</p>
                <div style="background: #e3f2fd; color: #1976d2; padding: 12px; border-radius: 8px; margin-top: 15px; font-size: 13px; font-weight: 500;">
                    📧 Email de assinatura: <strong>${currentUser?.email || 'Carregando...'}</strong>
                </div>
            </div>

            <!-- AVISO IMPORTANTE -->
            <div style="
                background: #fff3cd;
                border-left: 4px solid #ffc107;
                padding: 15px;
                border-radius: 6px;
                margin-bottom: 30px;
                font-size: 13px;
                color: #856404;
            ">
                ⚠️ <strong>Importante:</strong> Use o email acima ao fazer a assinatura. Após o pagamento, seu plano será ativado automaticamente em até 2 minutos.
            </div>

            <!-- PLANS GRID -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px;">
                
                <!-- PLANO MENSAL -->
                <div style="
                    border: 2px solid #4db6ac;
                    border-radius: 12px;
                    padding: 25px;
                    text-align: center;
                    background: linear-gradient(135deg, #e0f2f1 0%, #b2dfdb 100%);
                ">
                    <h2 style="color: #00695c; margin: 0 0 10px 0; font-size: 22px;">📅 Mensal</h2>
                    <div style="font-size: 32px; color: #00897b; font-weight: bold; margin: 15px 0;">R\$ 29,90</div>
                    <p style="color: #00695c; font-size: 12px; margin: 0 0 20px 0;">/mês</p>
                    
                    <ul style="list-style: none; padding: 0; margin: 20px 0; text-align: left;">
                        <li style="padding: 8px 0; color: #00695c; font-size: 13px;">✅ Flashcards Ilimitados</li>
                        <li style="padding: 8px 0; color: #00695c; font-size: 13px;">✅ Quizzes Ilimitados</li>
                        <li style="padding: 8px 0; color: #00695c; font-size: 13px;">✅ Reviews Ilimitados</li>
                        <li style="padding: 8px 0; color: #00695c; font-size: 13px;">✅ IA Sem Limite</li>
                        <li style="padding: 8px 0; color: #00695c; font-size: 13px;">✅ Suporte Prioritário</li>
                    </ul>
                    
                    <a href="https://pay.cakto.com.br/ar6yxop_697009" target="_blank" style="
                        display: inline-block;
                        background: linear-gradient(135deg, #4db6ac 0%, #26a69a 100%);
                        color: white;
                        padding: 12px 30px;
                        border-radius: 6px;
                        text-decoration: none;
                        font-weight: bold;
                        margin-top: 15px;
                        transition: all 0.3s;
                        border: none;
                        cursor: pointer;
                    " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(77, 182, 172, 0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                        Assinar Agora →
                    </a>
                </div>

                <!-- PLANO TRIMESTRAL (RECOMENDADO) -->
                <div style="
                    border: 3px solid #ff9800;
                    border-radius: 12px;
                    padding: 25px;
                    text-align: center;
                    background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
                    position: relative;
                ">
                    <div style="
                        position: absolute;
                        top: -12px;
                        left: 50%;
                        transform: translateX(-50%);
                        background: #ff9800;
                        color: white;
                        padding: 4px 16px;
                        border-radius: 20px;
                        font-size: 11px;
                        font-weight: bold;
                    ">⭐ MAIS ECONOMICO</div>
                    
                    <h2 style="color: #e65100; margin: 15px 0 10px 0; font-size: 22px;">📆 Trimestral</h2>
                    <div style="font-size: 32px; color: #f57c00; font-weight: bold; margin: 15px 0;">R\$ 69,90</div>
                    <p style="color: #e65100; font-size: 12px; margin: 0 0 20px 0;">3 meses (R\$ 23,30/mês)</p>
                    
                    <ul style="list-style: none; padding: 0; margin: 20px 0; text-align: left;">
                        <li style="padding: 8px 0; color: #e65100; font-size: 13px;">✅ Flashcards Ilimitados</li>
                        <li style="padding: 8px 0; color: #e65100; font-size: 13px;">✅ Quizzes Ilimitados</li>
                        <li style="padding: 8px 0; color: #e65100; font-size: 13px;">✅ Reviews Ilimitados</li>
                        <li style="padding: 8px 0; color: #e65100; font-size: 13px;">✅ IA Sem Limite</li>
                        <li style="padding: 8px 0; color: #e65100; font-size: 13px;">✅ Suporte Prioritário</li>
                        <li style="padding: 8px 0; color: #e65100; font-size: 13px; font-weight: bold;">🎁 Economize R\$ 19,80</li>
                    </ul>
                    
                    <a href="https://pay.cakto.com.br/emb9kxo_700051" target="_blank" style="
                        display: inline-block;
                        background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
                        color: white;
                        padding: 12px 30px;
                        border-radius: 6px;
                        text-decoration: none;
                        font-weight: bold;
                        margin-top: 15px;
                        transition: all 0.3s;
                        border: none;
                        cursor: pointer;
                    " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(255, 152, 0, 0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                        Assinar Agora →
                    </a>
                </div>

                <!-- PLANO ANUAL -->
                <div style="
                    border: 2px solid #9c27b0;
                    border-radius: 12px;
                    padding: 25px;
                    text-align: center;
                    background: linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%);
                ">
                    <h2 style="color: #6a1b9a; margin: 0 0 10px 0; font-size: 22px;">📅 Anual</h2>
                    <div style="font-size: 32px; color: #7b1fa2; font-weight: bold; margin: 15px 0;">R\$ 199,90</div>
                    <p style="color: #6a1b9a; font-size: 12px; margin: 0 0 20px 0;">12 meses (R\$ 16,66/mês)</p>
                    
                    <ul style="list-style: none; padding: 0; margin: 20px 0; text-align: left;">
                        <li style="padding: 8px 0; color: #6a1b9a; font-size: 13px;">✅ Flashcards Ilimitados</li>
                        <li style="padding: 8px 0; color: #6a1b9a; font-size: 13px;">✅ Quizzes Ilimitados</li>
                        <li style="padding: 8px 0; color: #6a1b9a; font-size: 13px;">✅ Reviews Ilimitados</li>
                        <li style="padding: 8px 0; color: #6a1b9a; font-size: 13px;">✅ IA Sem Limite</li>
                        <li style="padding: 8px 0; color: #6a1b9a; font-size: 13px;">✅ Suporte Prioritário</li>
                        <li style="padding: 8px 0; color: #6a1b9a; font-size: 13px; font-weight: bold;">🎁 Economize R\$ 158,80</li>
                    </ul>
                    
                    <a href="https://pay.cakto.com.br/4mobwhi" target="_blank" style="
                        display: inline-block;
                        background: linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%);
                        color: white;
                        padding: 12px 30px;
                        border-radius: 6px;
                        text-decoration: none;
                        font-weight: bold;
                        margin-top: 15px;
                        transition: all 0.3s;
                        border: none;
                        cursor: pointer;
                    " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(156, 39, 176, 0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                        Assinar Agora →
                    </a>
                </div>
            </div>

            <!-- FOOTER -->
            <div style="
                background: #f5f5f5;
                padding: 20px;
                border-radius: 8px;
                text-align: center;
                font-size: 12px;
                color: #666;
            ">
                ✅ Pagamento seguro com PIX ou Cartão de Crédito<br/>
                ✅ Cancelamento a qualquer momento<br/>
                ✅ Acesso imediato após confirmação do pagamento
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    
    // Fechar ao clicar fora
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
            document.body.style.overflow = '';
        }
    });
}

// Função para abrir modal de planos
window.openPlansModal = function() {
    createPlansModal();
};

// ========================================
// 🔐 FUNÇÕES DE ASSINATURA E STATUS
// ========================================

// Carregar e exibir status de assinatura
async function loadSubscriptionStatus(userId) {
    try {
        console.log("📊 Carregando status para usuário:", userId);
        
        const response = await fetch(`/api/webhooks/cakto-status?userId=${userId}`);
        const data = await response.json();
        
        console.log("📊 Dados recebidos:", data);
        
        const statusEl = document.getElementById('subscription-status');
        
        if (!statusEl) {
            console.error("❌ Elemento 'subscription-status' não encontrado!");
            return;
        }
        
        if (data.isActive) {
            console.log("✅ Usuário com plano ATIVO:", data.plan);
            statusEl.innerHTML = `
                <div style="
                    padding: 15px; 
                    background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%); 
                    border-radius: 8px; 
                    margin: 15px 0;
                    border-left: 4px solid #4db6ac;
                    box-shadow: 0 2px 8px rgba(77, 182, 172, 0.2);
                ">
                    <strong style="color: #2e7d32; font-size: 16px;">✅ Plano ${data.plan.toUpperCase()} ATIVO</strong><br/>
                    <span style="color: #558b2f; font-size: 14px;">⏳ Válido por ${data.daysLeft} dias</span><br/>
                    <small style="color: #689f38;">Acesso: ILIMITADO • Flashcards + Quiz + Review</small>
                </div>
            `;
        } else {
            console.log("⏳ Usuário com plano GRATUITO");
            statusEl.innerHTML = `
                <div style="
                    padding: 15px; 
                    background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%); 
                    border-radius: 8px; 
                    margin: 15px 0;
                    border-left: 4px solid #ff9800;
                    box-shadow: 0 2px 8px rgba(255, 152, 0, 0.2);
                ">
                    <strong style="color: #e65100; font-size: 16px;">⏳ Plano GRATUITO</strong><br/>
                    <small style="color: #bf360c; font-size: 13px;">📊 Limite: <strong>10 Flashcards/mês</strong> • <strong>3 Quizzes/mês</strong> • <strong>5 Reviews/mês</strong></small><br/>
                    <button onclick="openPlansModal()" style="
                        margin-top: 10px; 
                        padding: 10px 20px; 
                        background: linear-gradient(135deg, #4db6ac 0%, #26a69a 100%);
                        color: white; 
                        border: none; 
                        border-radius: 6px; 
                        cursor: pointer;
                        font-weight: bold;
                        font-size: 14px;
                        box-shadow: 0 4px 12px rgba(77, 182, 172, 0.3);
                        transition: all 0.3s ease;
                    " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(77, 182, 172, 0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(77, 182, 172, 0.3)'">
                        🚀 Assinar Agora →
                    </button>
                </div>
            `;
        }
    } catch (error) {
        console.error("❌ Erro ao carregar status de assinatura:", error);
    }
}

// Chamar quando página carrega e usuário está logado
console.log("🔄 Script carregado, aguardando usuário...");

onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("✅ Usuário detectado:", user.uid, user.email);
        console.log("⏳ Carregando status de assinatura...");
        
        // Pequeno delay para garantir que o elemento existe
        setTimeout(() => {
            loadSubscriptionStatus(user.uid);
        }, 500);
    } else {
        console.log("❌ Nenhum usuário logado");
    }
});

// Adicionar Firebase imports no topo do arquivo
import { db } from "./firebase-init.js";
import { getDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { updateProfile, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";