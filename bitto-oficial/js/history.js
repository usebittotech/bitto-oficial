import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Elementos
const themeToggle = document.getElementById("themeToggle");
const navName = document.getElementById("navUserName");
const navAvatar = document.querySelector(".avatar-circle");

// Stats Elements
const valTotal = document.getElementById("valTotal");
const valFlashcards = document.getElementById("valFlashcards");
const valQuiz = document.getElementById("valQuiz");
const valReview = document.getElementById("valReview");
const currentMonthDisplay = document.getElementById("currentMonthDisplay");
const monthProgressBar = document.getElementById("monthProgressBar");
const daysLeftText = document.getElementById("daysLeftText");

// --- 1. CÁLCULO DE DATAS (MÊS) ---
function setupMonthInfo() {
  const date = new Date();
  const monthNames = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];

  // Nome do Mês
  if (currentMonthDisplay) {
    currentMonthDisplay.innerText = `${monthNames[date.getMonth()]} de ${date.getFullYear()}`;
  }

  // Dias Restantes
  const lastDay = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
  ).getDate(); // Último dia do mês (28, 30, 31)
  const today = date.getDate();
  const daysLeft = lastDay - today;
  const progress = (today / lastDay) * 100;

  if (monthProgressBar) monthProgressBar.style.width = `${progress}%`;
  if (daysLeftText)
    daysLeftText.innerText = `${daysLeft} dias restantes para o Reset Mensal`;
}

// --- 2. AUTENTICAÇÃO E DADOS ---
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      const data = snap.data();
      updateHeader(user, data);
      updateStats(data.stats || {});
    }
  } else {
    window.location.href = "login.html";
  }
});

function updateHeader(user, dbData) {
  const displayName = dbData.displayName || user.displayName || "Estudante";
  if (navName) navName.innerText = displayName.split(" ")[0];
  const photoURL = dbData.photoURL || user.photoURL;
  if (photoURL && navAvatar) {
    navAvatar.innerHTML = `<img src="${photoURL}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
  }
}

function updateStats(stats) {
  // Busca valores (se não existir, usa 0)
  const flashcards = stats.flashcardsGen || 0;
  const quiz = stats.quizGen || 0;
  const review = stats.reviewGen || 0;
  const total = stats.cardsGeneratedMonth || flashcards + quiz + review; // Fallback soma manual

  // Anima os números
  animateValue(valFlashcards, 0, flashcards, 1000);
  animateValue(valQuiz, 0, quiz, 1000);
  animateValue(valReview, 0, review, 1000);
  animateValue(valTotal, 0, total, 1500);
}

// Efeito de contagem "slot machine"
function animateValue(obj, start, end, duration) {
  if (!obj) return;
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    obj.innerHTML = Math.floor(progress * (end - start) + start);
    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else {
      obj.innerHTML = end; // Garante valor final exato
    }
  };
  window.requestAnimationFrame(step);
}

// --- TEMA E UI ---
setupMonthInfo();

// Tilt 3D
const tiltElements = document.querySelectorAll(".tilt-element");
document.addEventListener("mousemove", (e) => {
  if (window.innerWidth > 768) {
    // Só no PC
    tiltElements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (
        x >= -20 &&
        x <= rect.width + 20 &&
        y >= -20 &&
        y <= rect.height + 20
      ) {
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = ((y - centerY) / centerY) * -2;
        const rotateY = ((x - centerX) / centerX) * 2;
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
// ==========================================================================
//   GERAÇÃO, PRÉVIA E EXPORTAÇÃO DO STORY (CORRIGIDO)
// ==========================================================================
const btnShareStory = document.getElementById("btnShareStory");
const storyTemplate = document.getElementById("story-template");
const previewModal = document.getElementById("storyPreviewModal");
const btnClosePreview = document.getElementById("btnClosePreview");
const btnDownloadStory = document.getElementById("btnDownloadStory");
const previewImage = document.getElementById("previewImage");
const btnCopyCaption = document.getElementById("btnCopyCaption");

let currentStoryDataUrl = "";
let currentFileName = "";

if (btnShareStory) {
  btnShareStory.addEventListener("click", async () => {
    try {
      const originalText = btnShareStory.innerHTML;
      btnShareStory.innerHTML = "⏳ Criando Design Premium...";
      btnShareStory.disabled = true;

      // 1. Puxar Dados do Usuário e Data
      const navNameText = document.getElementById("navUserName").innerText;
      document.getElementById("st-name").innerText =
        navNameText !== "..." ? navNameText : "Estudante";

      const avatarImg = document.querySelector(".avatar-circle img");
      const stAvatar = document.getElementById("st-avatar");
      if (avatarImg && avatarImg.src) {
        stAvatar.src = avatarImg.src;
      } else {
        stAvatar.src = `https://ui-avatars.com/api/?name=${navNameText}&background=0035FF&color=fff&size=256`;
      }

      // Garante que o mês não seja "Carregando..."
      let monthText = document.getElementById("currentMonthDisplay").innerText;
      if (monthText === "Carregando..." || !monthText) {
        const date = new Date();
        const monthNames = [
          "Janeiro",
          "Fevereiro",
          "Março",
          "Abril",
          "Maio",
          "Junho",
          "Julho",
          "Agosto",
          "Setembro",
          "Outubro",
          "Novembro",
          "Dezembro",
        ];
        monthText = `${monthNames[date.getMonth()]} de ${date.getFullYear()}`;
      }
      document.getElementById("st-month").innerText = monthText;

      // 2. Atualizar Números
      const valTotal = document.getElementById("valTotal").innerText;
      document.getElementById("st-total").innerText = valTotal;
      document.getElementById("st-flashcards").innerText =
        document.getElementById("valFlashcards").innerText;
      document.getElementById("st-quiz").innerText =
        document.getElementById("valQuiz").innerText;
      document.getElementById("st-review").innerText =
        document.getElementById("valReview").innerText;

      // Atualiza legenda
      const emojis = ["🔥", "🚀", "🧠", "⚡"];
      const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
      document.getElementById("suggestedCaption").innerText =
        `"Meu mês na @usebitto: ${valTotal} materiais gerados com Inteligência Artificial! ${randomEmoji} Acelerando os estudos pro próximo nível."`;

      // Delay para garantir carregamento de fontes e imagens no template oculto
      await new Promise((resolve) => setTimeout(resolve, 800));

      // 3. Renderizar (SEM BUG DE BACKGROUND)
      // O segredo é que o elemento já está com position:fixed e left:-10000px no CSS.
      // Não precisamos movê-lo. O html2canvas vai buscar ele lá.
      const canvas = await window.html2canvas(storyTemplate, {
        scale: 1, // Mantém 1080x1920
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#020205", // Cor de fundo de segurança
        width: 1080,
        height: 1920,
        x: 0, // Coordenadas relativas ao próprio elemento fixo
        y: 0,
        scrollX: 0, // Impede que o scroll da página afete o print
        scrollY: 0,
        logging: false,
      });

      // 4. Mostrar Prévia
      currentStoryDataUrl = canvas.toDataURL("image/png");
      previewImage.src = currentStoryDataUrl;

      const safeName =
        navNameText !== "..."
          ? navNameText.toLowerCase().replace(/\s+/g, "-")
          : "estudante";
      currentFileName = `bitto-story-${safeName}.png`;

      previewModal.classList.add("active");

      // 5. Resetar botão
      btnShareStory.innerHTML = originalText;
      btnShareStory.disabled = false;
    } catch (error) {
      console.error("Erro ao gerar o Story: ", error);
      btnShareStory.innerHTML = "❌ Erro. Tente novamente.";
      setTimeout(() => {
        btnShareStory.innerHTML = originalText;
        btnShareStory.disabled = false;
      }, 3000);
    }
  });
}

// Fechar Modal
if (btnClosePreview) {
  btnClosePreview.addEventListener("click", () => {
    previewModal.classList.remove("active");
  });
}

// Download da Imagem
if (btnDownloadStory) {
  btnDownloadStory.addEventListener("click", () => {
    const link = document.createElement("a");
    link.download = currentFileName;
    link.href = currentStoryDataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    const originalText = btnDownloadStory.innerHTML;
    btnDownloadStory.innerHTML = "✅ Imagem Salva!";
    btnDownloadStory.style.background = "var(--accent-green)";
    btnDownloadStory.style.color = "var(--primary-blue)";
    setTimeout(() => {
      btnDownloadStory.innerHTML = originalText;
      btnDownloadStory.style.background = "";
      btnDownloadStory.style.color = "";
    }, 2500);
  });
}

// Copiar Legenda
if (btnCopyCaption) {
  btnCopyCaption.addEventListener("click", () => {
    const captionText = document.getElementById("suggestedCaption").innerText;
    navigator.clipboard.writeText(captionText.replace(/^"|"$/g, ""));

    const originalText = btnCopyCaption.innerHTML;
    btnCopyCaption.innerHTML = "Copiado!";
    btnCopyCaption.style.background = "var(--accent-green)";
    btnCopyCaption.style.color = "var(--primary-blue)";
    btnCopyCaption.style.borderColor = "transparent";

    setTimeout(() => {
      btnCopyCaption.innerHTML = originalText;
      btnCopyCaption.style.background = "";
      btnCopyCaption.style.color = "";
      btnCopyCaption.style.borderColor = "";
    }, 2000);
  });
}
