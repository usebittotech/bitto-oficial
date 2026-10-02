import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { checkMonthlyReset } from "./xpSystem.js";

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

  if (currentMonthDisplay) {
    currentMonthDisplay.innerText = `${monthNames[date.getMonth()]} de ${date.getFullYear()}`;
  }

  const lastDay = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
  ).getDate();
  const today = date.getDate();
  const daysLeft = lastDay - today;
  const progress = (today / lastDay) * 100;

  if (monthProgressBar) monthProgressBar.style.width = `${progress}%`;
  if (daysLeftText) {
    daysLeftText.innerText = `${daysLeft} dias restantes para o Reset Mensal`;
  }
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    await checkMonthlyReset(user);

    const userRef = doc(db, "users", user.uid);
    onSnapshot(userRef, (snap) => {
      if (!snap.exists()) return;

      const data = snap.data();
      updateHeader(user, data);
      updateStats(data);
    });
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

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function getMonthlyStats(userData) {
  const stats = userData.stats || {};
  const usage = userData.usage || {};

  const flashcards = toNumber(stats.flashcardsGen ?? usage.flashcards);
  const quiz = toNumber(stats.quizGen ?? usage.quiz);
  const review = toNumber(stats.reviewGen ?? usage.review);
  const total =
    toNumber(stats.cardsGeneratedMonth) || flashcards + quiz + review;

  return { flashcards, quiz, review, total };
}

function updateStats(userData) {
  const { flashcards, quiz, review, total } = getMonthlyStats(userData);

  animateValue(valFlashcards, 0, flashcards, 1000);
  animateValue(valQuiz, 0, quiz, 1000);
  animateValue(valReview, 0, review, 1000);
  animateValue(valTotal, 0, total, 1500);
}

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
      obj.innerHTML = end;
    }
  };

  window.requestAnimationFrame(step);
}

setupMonthInfo();

const tiltElements = document.querySelectorAll(".tilt-element");
document.addEventListener("mousemove", (e) => {
  if (window.innerWidth > 768) {
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
    const originalText = btnShareStory.innerHTML;

    try {
      btnShareStory.innerHTML = "⏳ Criando Design Premium...";
      btnShareStory.disabled = true;

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

      const valTotal = document.getElementById("valTotal").innerText;
      document.getElementById("st-total").innerText = valTotal;
      document.getElementById("st-flashcards").innerText =
        document.getElementById("valFlashcards").innerText;
      document.getElementById("st-quiz").innerText =
        document.getElementById("valQuiz").innerText;
      document.getElementById("st-review").innerText =
        document.getElementById("valReview").innerText;

      const emojis = ["🔥", "🚀", "🧠", "⚡"];
      const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
      document.getElementById("suggestedCaption").innerText =
        `"Meu mês na @usebitto: ${valTotal} materiais gerados com Inteligência Artificial! ${randomEmoji} Acelerando os estudos pro próximo nível."`;

      await new Promise((resolve) => setTimeout(resolve, 800));

      const canvas = await window.html2canvas(storyTemplate, {
        scale: 1,
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#020205",
        width: 1080,
        height: 1920,
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
        logging: false,
      });

      currentStoryDataUrl = canvas.toDataURL("image/png");
      previewImage.src = currentStoryDataUrl;

      const safeName =
        navNameText !== "..."
          ? navNameText.toLowerCase().replace(/\s+/g, "-")
          : "estudante";

      currentFileName = `bitto-story-${safeName}.png`;

      previewModal.classList.add("active");

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

if (btnClosePreview) {
  btnClosePreview.addEventListener("click", () => {
    previewModal.classList.remove("active");
  });
}

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
