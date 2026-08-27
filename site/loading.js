// JS do Depoimento (Troca os cards automaticamente)
// Reconstrói as referências sempre que os cards mudarem no DOM — necessário
// porque reviews.js pode substituir o conteúdo de #persona-container por
// avaliações reais (featured) depois que a página já carregou.
let currentPair = 0;
let personaInterval = null;

function setupPersonaCarousel() {
  const cards = document.querySelectorAll(".persona-card");
  const dots = document.querySelectorAll(".persona-dot");
  const totalPairs = dots.length || 1;
  currentPair = 0;

  function switchPersonas() {
    const freshCards = document.querySelectorAll(".persona-card");
    const freshDots = document.querySelectorAll(".persona-dot");
    freshCards.forEach((c) => c.classList.remove("active"));
    freshDots.forEach((d) => d.classList.remove("active"));

    currentPair = (currentPair + 1) % totalPairs;

    document
      .querySelectorAll(`.persona-card[data-pair="${currentPair}"]`)
      .forEach((c) => c.classList.add("active"));
    if (freshDots[currentPair]) freshDots[currentPair].classList.add("active");
  }

  // Clique nos dots para trocar manualmente
  dots.forEach((dot, i) => {
    dot.addEventListener("click", () => {
      document
        .querySelectorAll(".persona-card")
        .forEach((c) => c.classList.remove("active"));
      document
        .querySelectorAll(".persona-dot")
        .forEach((d) => d.classList.remove("active"));
      currentPair = i;
      document
        .querySelectorAll(`.persona-card[data-pair="${i}"]`)
        .forEach((c) => c.classList.add("active"));
      dot.classList.add("active");
    });
  });

  if (personaInterval) clearInterval(personaInterval);
  if (cards.length) personaInterval = setInterval(switchPersonas, 5000);
}

setupPersonaCarousel();
// reviews.js dispara este evento quando troca o fallback por reviews reais
document.addEventListener("bitto:featured-reviews-rendered", setupPersonaCarousel);

// JS do FAQ (Abre e fecha perguntas)
document.querySelectorAll(".faq-question").forEach((button) => {
  button.addEventListener("click", () => {
    const faqItem = button.parentElement;

    // Fecha outros itens abertos (efeito sanfona)
    document.querySelectorAll(".faq-item").forEach((item) => {
      if (item !== faqItem) {
        item.classList.remove("active");
      }
    });

    // Alterna o estado do item clicado
    faqItem.classList.toggle("active");
  });
});

// JS do Toggle de Planos (Mensal / Trimestral / Anual)
const planToggleBtns = document.querySelectorAll(".plan-toggle-btn");
const planOptions = document.querySelectorAll(".plan-option");
const planCtas = document.querySelectorAll(".plan-cta");
const planBadge = document.getElementById("plan-badge");

const planBadgeText = {
  mensal: "ASSINATURA FLEXÍVEL",
  trimestral: "MAIS ESCOLHIDO 🏆",
  anual: "MELHOR VALOR 🔥",
};

planToggleBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const plan = btn.dataset.plan;

    planToggleBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    planOptions.forEach((opt) => {
      opt.classList.toggle("active", opt.dataset.planContent === plan);
    });

    planCtas.forEach((cta) => {
      const isMatch = cta.dataset.planLink === plan;
      cta.style.display = isMatch ? "block" : "none";
    });

    if (planBadge && planBadgeText[plan]) {
      planBadge.textContent = planBadgeText[plan];
    }
  });
});

// Menu sanduíche (mobile)
(function () {
  const toggle = document.getElementById("nav-toggle");
  const menu = document.getElementById("mobile-menu");
  if (!toggle || !menu) return;

  function closeMenu() {
    menu.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Abrir menu");
  }

  function openMenu() {
    menu.classList.add("open");
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Fechar menu");
  }

  toggle.addEventListener("click", () => {
    const isOpen = menu.classList.contains("open");
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  // Fecha ao clicar em qualquer link do menu (navegação por âncora)
  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  // Fecha se a tela crescer pra desktop (evita menu preso aberto)
  window.addEventListener("resize", () => {
    if (window.innerWidth > 900) closeMenu();
  });
})();
