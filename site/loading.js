// JS do Depoimento (Troca os cards automaticamente)
let currentPair = 0;
const totalPairs = 4;
const cards = document.querySelectorAll(".persona-card");
const dots = document.querySelectorAll(".persona-dot");

function switchPersonas() {
  cards.forEach((c) => c.classList.remove("active"));
  if (dots.length) dots.forEach((d) => d.classList.remove("active"));

  currentPair = (currentPair + 1) % totalPairs;

  document
    .querySelectorAll(`.persona-card[data-pair="${currentPair}"]`)
    .forEach((c) => {
      c.classList.add("active");
    });
  if (dots[currentPair]) dots[currentPair].classList.add("active");
}

// Clique nos dots para trocar manualmente
dots.forEach((dot, i) => {
  dot.addEventListener("click", () => {
    cards.forEach((c) => c.classList.remove("active"));
    dots.forEach((d) => d.classList.remove("active"));
    currentPair = i;
    document
      .querySelectorAll(`.persona-card[data-pair="${i}"]`)
      .forEach((c) => c.classList.add("active"));
    dot.classList.add("active");
  });
});

setInterval(switchPersonas, 5000);

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
