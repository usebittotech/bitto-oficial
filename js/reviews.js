// js/reviews.js
// Controla o widget de estrelas, o envio do formulário de avaliação
// (POST /api/reviews) e duas renderizações a partir do mesmo dado real:
//  1) #reviews-list      -> todas as avaliações aprovadas
//  2) #persona-container -> só as marcadas como "featured" (curadoria manual
//     no console do Firebase), reaproveitando o carrossel de "Resultados
//     Reais" que já existia. Não depende de login — qualquer visitante avalia.

const API_URL = "/api/reviews";

const AVATAR_ICONS = [
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><path d="M12 3v18"/><path d="M5 7h4l-2 6a2.5 2.5 0 0 1-2 1 2.5 2.5 0 0 1-2-1Z"/><path d="M15 7h4l-2 6a2.5 2.5 0 0 1-2 1 2.5 2.5 0 0 1-2-1Z"/><path d="M7 21h10"/><path d="M9 7h6"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2Z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7Z"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>',
];

function initStarRating() {
  const wrap = document.getElementById("review-stars");
  if (!wrap) return;

  const stars = Array.from(wrap.querySelectorAll(".star-btn"));
  const hiddenInput = document.getElementById("review-rating");
  let selected = 0;

  function paint(value) {
    stars.forEach((star) => {
      const isFilled = Number(star.dataset.value) <= value;
      star.classList.toggle("filled", isFilled);
      star.setAttribute("aria-checked", String(Number(star.dataset.value) === selected));
    });
  }

  stars.forEach((star) => {
    star.addEventListener("click", () => {
      selected = Number(star.dataset.value);
      hiddenInput.value = String(selected);
      paint(selected);
    });
    star.addEventListener("mouseenter", () => paint(Number(star.dataset.value)));
    star.addEventListener("mouseleave", () => paint(selected));
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderStars(rating) {
  const full = Math.max(0, Math.min(5, Number(rating) || 0));
  let html = "";
  for (let i = 1; i <= 5; i++) {
    html += `<span class="review-card-star${i <= full ? " filled" : ""}">★</span>`;
  }
  return html;
}

function formatDate(isoOrTimestamp) {
  try {
    const date = new Date(isoOrTimestamp);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------
// Resumo agregado (nota média + total) — reforça prova social antes
// mesmo de rolar até os cards individuais.
// ---------------------------------------------------------------
function renderSummary(reviews) {
  const wrap = document.getElementById("reviews-summary");
  const scoreEl = document.getElementById("reviews-summary-score");
  const starsEl = document.getElementById("reviews-summary-stars");
  const countEl = document.getElementById("reviews-summary-count");
  if (!wrap) return;

  if (reviews.length === 0) {
    wrap.style.display = "none";
    return;
  }

  const avg =
    reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / reviews.length;
  const rounded = Math.round(avg * 10) / 10;

  scoreEl.textContent = rounded.toFixed(1).replace(".", ",");
  starsEl.innerHTML = renderStars(Math.round(avg)).replace(/review-card-star/g, "");
  starsEl.innerHTML = Array.from({ length: 5 })
    .map((_, i) => `<span class="${i < Math.round(avg) ? "filled" : ""}">★</span>`)
    .join("");
  countEl.textContent = `com base em ${reviews.length} avaliaç${reviews.length === 1 ? "ão" : "ões"}`;
  wrap.style.display = "flex";
}

// ---------------------------------------------------------------
// Lista completa (todas as aprovadas) — seção "Avaliações"
// ---------------------------------------------------------------
function renderReviewsList(reviews) {
  const list = document.getElementById("reviews-list");
  const empty = document.getElementById("reviews-empty");
  if (!list) return;

  if (reviews.length === 0) {
    if (empty) empty.textContent = "Seja o primeiro a avaliar a BITTO! ⭐";
    return;
  }

  if (empty) empty.remove();

  list.innerHTML = reviews
    .map(
      (r) => `
      <div class="review-card">
        <div class="review-card-header">
          <span class="review-card-name">${escapeHtml(r.name || "Anônimo")}${
        r.area ? ` <span class="review-card-area">• ${escapeHtml(r.area)}</span>` : ""
      }</span>
          <span class="review-card-date">${formatDate(r.createdAt)}</span>
        </div>
        <div class="review-card-stars">${renderStars(r.rating)}</div>
        <p class="review-card-comment">${escapeHtml(r.comment || "")}</p>
      </div>`
    )
    .join("");
}

// ---------------------------------------------------------------
// Vitrine "Resultados Reais" — só reviews marcadas como featured=true
// no Firestore. Reaproveita o mesmo HTML/CSS do carrossel de personas
// (.persona-card, .persona-dot) que já existia, só que com dado real.
// Se não houver featured suficientes, mantém o bloco fallback que já
// está no HTML (não mexe em nada).
// ---------------------------------------------------------------
function renderFeaturedShowcase(featuredReviews) {
  const container = document.getElementById("persona-container");
  const dotsWrap = document.querySelector(".persona-dots");
  if (!container) return;

  const MIN_FOR_REAL_SHOWCASE = 4; // abaixo disso, mantém o fallback

  if (featuredReviews.length < MIN_FOR_REAL_SHOWCASE) {
    // Não mexe no fallback estático que já está no HTML.
    return;
  }

  // Agrupa em pares (2 cards por "slide", igual ao carrossel original)
  const pairs = [];
  for (let i = 0; i < featuredReviews.length; i += 2) {
    pairs.push(featuredReviews.slice(i, i + 2));
  }

  container.removeAttribute("data-fallback");
  container.innerHTML = pairs
    .map((pair, pairIndex) =>
      pair
        .map(
          (r, cardIndex) => `
        <div class="persona-card${pairIndex === 0 ? " active" : ""}" data-pair="${pairIndex}">
          <div class="persona-card-header">
            <div class="persona-avatar">${AVATAR_ICONS[(pairIndex * 2 + cardIndex) % AVATAR_ICONS.length]}</div>
            <div class="persona-info">
              <h4>${escapeHtml(r.name || "Aluno BITTO")}</h4>
              <span class="tag">${escapeHtml(r.area || "Estudante")}</span>
            </div>
          </div>
          <p>"${escapeHtml(r.comment || "")}"</p>
        </div>`
        )
        .join("")
    )
    .join("");

  if (dotsWrap) {
    dotsWrap.innerHTML = pairs
      .map((_, i) => `<div class="persona-dot${i === 0 ? " active" : ""}"></div>`)
      .join("");
  }

  // Reinicia o carrossel (script.js já faz o setInterval/click, mas os nós
  // trocaram — dispara um evento pra quem quiser reengatar os listeners).
  document.dispatchEvent(new CustomEvent("bitto:featured-reviews-rendered"));
}

async function loadReviews() {
  const list = document.getElementById("reviews-list");
  const empty = document.getElementById("reviews-empty");

  try {
    const res = await fetch(API_URL, { method: "GET" });
    if (!res.ok) throw new Error("Falha ao buscar avaliações");
    const data = await res.json();
    const reviews = Array.isArray(data.reviews) ? data.reviews : [];

    renderReviewsList(reviews);
    renderSummary(reviews);
    renderFeaturedShowcase(reviews.filter((r) => r.featured));
  } catch (err) {
    if (empty) empty.textContent = "Não foi possível carregar as avaliações agora.";
    console.warn("reviews: falha ao carregar", err);
  }
}

function initReviewForm() {
  const form = document.getElementById("review-form");
  const msg = document.getElementById("review-form-msg");
  const submitBtn = document.getElementById("review-submit-btn");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (msg) {
      msg.textContent = "";
      msg.className = "review-form-note";
    }

    const name = form.name.value.trim();
    const area = form.area.value.trim();
    const rating = Number(form.rating.value);
    const comment = form.comment.value.trim();
    const honeypot = form.website.value.trim();

    // Honeypot preenchido = bot. Finge sucesso sem enviar nada.
    if (honeypot) {
      form.reset();
      if (msg) {
        msg.textContent = "Avaliação enviada! Obrigado pelo feedback.";
        msg.className = "review-form-note review-form-success";
      }
      return;
    }

    if (!name || name.length < 2) {
      if (msg) {
        msg.textContent = "Digite seu nome.";
        msg.className = "review-form-note review-form-error";
      }
      return;
    }
    if (!area || area.length < 2) {
      if (msg) {
        msg.textContent = "Diga seu curso ou área de estudo.";
        msg.className = "review-form-note review-form-error";
      }
      return;
    }
    if (!rating || rating < 1 || rating > 5) {
      if (msg) {
        msg.textContent = "Escolha uma avaliação de 1 a 5 estrelas.";
        msg.className = "review-form-note review-form-error";
      }
      return;
    }
    if (!comment || comment.length < 5) {
      if (msg) {
        msg.textContent = "Escreva um comentário um pouco mais completo.";
        msg.className = "review-form-note review-form-error";
      }
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Enviando...";

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, area, rating, comment }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erro ao enviar avaliação");
      }

      form.reset();
      document
        .querySelectorAll("#review-stars .star-btn")
        .forEach((s) => s.classList.remove("filled"));

      if (msg) {
        msg.textContent =
          "Avaliação enviada! Ela já está publicada aqui em cima.";
        msg.className = "review-form-note review-form-success";
      }

      // Publica na hora — recarrega a lista pra já mostrar a nova avaliação
      loadReviews();
    } catch (err) {
      if (msg) {
        msg.textContent = "Não foi possível enviar agora. Tenta de novo em instantes.";
        msg.className = "review-form-note review-form-error";
      }
      console.warn("reviews: falha ao enviar", err);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Enviar avaliação";
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initStarRating();
  initReviewForm();
  loadReviews();
});
