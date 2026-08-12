// js/analytics-landing.js
// Rastreia os principais eventos de conversão da landing page no GA4
// (via Firebase Analytics). Não bloqueia navegação nem altera nenhum
// comportamento visual/funcional existente.
import { trackEvent } from "./firebase-init.js";

document.addEventListener("DOMContentLoaded", () => {
  // CTAs principais de cadastro ("Quero Começar Agora" / topo, meio e fim da página)
  document
    .querySelectorAll('a[href*="login.html?mode=register"], .btn-cta-large')
    .forEach((el) => {
      el.addEventListener("click", () => {
        trackEvent("landing_cta_click", {
          cta_label: el.textContent.trim().slice(0, 60),
          cta_location: el.closest("section")?.id || "unknown",
        });
      });
    });

  // Botão "Fazer Login" / "Entrar"
  document
    .querySelectorAll('a.btn-login, a.btn-secondary[href*="login.html"]')
    .forEach((el) => {
      el.addEventListener("click", () => {
        trackEvent("landing_login_click", {
          cta_location: el.closest("section")?.id || "header",
        });
      });
    });

  // Cliques nos planos (evento recomendado do GA4: select_item)
  document.querySelectorAll(".plan-cta[data-plan-link]").forEach((el) => {
    el.addEventListener("click", () => {
      trackEvent("select_item", {
        item_list_name: "planos_bitto",
        items: [{ item_id: el.dataset.planLink, item_name: el.dataset.planLabel || el.textContent.trim() }],
      });
    });
  });

  // Scroll até a seção de preços (indica intenção de compra)
  const pricingSection = document.getElementById("planos");
  if (pricingSection && "IntersectionObserver" in window) {
    let alreadyTracked = false;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !alreadyTracked) {
            alreadyTracked = true;
            trackEvent("view_pricing_section");
            observer.disconnect();
          }
        });
      },
      { threshold: 0.3 }
    );
    observer.observe(pricingSection);
  }
});
