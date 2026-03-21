// JS do Depoimento (Troca os cards automaticamente)
let currentPair = 0;
const totalPairs = 2;
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
