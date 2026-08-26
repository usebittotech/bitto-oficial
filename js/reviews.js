// js/reviews.js
// Controla o widget de estrelas, o envio do formulário de avaliação
// (POST /api/reviews) e a listagem das avaliações já aprovadas
// (GET /api/reviews). Não depende de login — qualquer visitante pode avaliar.

const API_URL = "/api/reviews";

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

async function loadReviews() {
  const list = document.getElementById("reviews-list");
  const empty = document.getElementById("reviews-empty");
  if (!list) return;

  try {
    const res = await fetch(API_URL, { method: "GET" });
    if (!res.ok) throw new Error("Falha ao buscar avaliações");
    const data = await res.json();
    const reviews = Array.isArray(data.reviews) ? data.reviews : [];

    if (reviews.length === 0) {
      if (empty) {
        empty.textContent = "Seja o primeiro a avaliar a BITTO! ⭐";
      }
      return;
    }

    if (empty) empty.remove();

    list.innerHTML = reviews
      .map(
        (r) => `
        <div class="review-card">
          <div class="review-card-header">
            <span class="review-card-name">${escapeHtml(r.name || "Anônimo")}</span>
            <span class="review-card-date">${formatDate(r.createdAt)}</span>
          </div>
          <div class="review-card-stars">${renderStars(r.rating)}</div>
          <p class="review-card-comment">${escapeHtml(r.comment || "")}</p>
        </div>`
      )
      .join("");
  } catch (err) {
    if (empty) {
      empty.textContent = "Não foi possível carregar as avaliações agora.";
    }
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
        body: JSON.stringify({ name, rating, comment }),
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
