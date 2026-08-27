// js/reviews.js
// Controla o widget de estrelas, o envio do formulário de avaliação
// (POST /api/reviews) e duas renderizações a partir do mesmo dado real:
//  1) #reviews-list      -> todas as avaliações aprovadas
//  2) #persona-container -> só as marcadas como "featured" (curadoria manual
//     no console do Firebase), reaproveitando o carrossel de "Resultados
//     Reais" que já existia. Não depende de login — qualquer visitante avalia.

const API_URL = "/api/reviews";

const AVATAR_BY_INDEX = ["🎓", "⚖️", "🩺", "📖", "💼", "🎯", "🌐", "📊"];

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
            <div class="persona-avatar">${AVATAR_BY_INDEX[(pairIndex * 2 + cardIndex) % AVATAR_BY_INDEX.length]}</div>
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
          "Avaliação enviada! Ela aparece aqui assim que for aprovada.";
        msg.className = "review-form-note review-form-success";
      }
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
