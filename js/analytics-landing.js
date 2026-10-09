// js/analytics-landing.js
// Rastreia os principais eventos de conversão da landing page no GA4
// (via Firebase Analytics). Não bloqueia navegação nem altera nenhum
// comportamento visual/funcional existente.
import { trackEvent } from "./firebase-init.js";
import { decorateCampaignLinks, campaignContext } from './campaign.js';

function setupLandingAnalytics() {
  campaignContext();
  decorateCampaignLinks();
  // CTAs principais de cadastro ("Quero Começar Agora" / topo, meio e fim da página)
  document
    .querySelectorAll('a[href*="login.html?mode=register"]')
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
      const itemId={mensal:'monthly',trimestral:'quarterly',anual:'annual'}[el.dataset.planLink];
      const price={mensal:24.90,trimestral:59.70,anual:178.80}[el.dataset.planLink];
      trackEvent("select_item", {
        item_list_name: "planos_bitto",
        items: [{ item_id: itemId, item_name: el.dataset.planLabel || el.textContent.trim() }],
      });
      trackEvent('begin_checkout',{
        currency:'BRL',
        value:price,
        items:[{item_id:itemId,item_name:'Plano '+el.dataset.planLink,price,quantity:1}]
      });
    });
  });

  document.querySelectorAll("[data-product-link], [data-product]").forEach((el) => {
    el.addEventListener("click", () => {
      const itemId = el.dataset.productLink || el.dataset.product;
      trackEvent("select_item", {
        item_list_name: "materiais_complementares",
        items: [{ item_id: itemId, item_name: el.textContent.trim().slice(0, 80) }],
      });
      trackEvent("digital_product_click", {
        product_id: itemId,
        page_path: window.location.pathname,
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

  const demoSection = document.getElementById("demonstracao");
  if (demoSection && "IntersectionObserver" in window) {
    const demoObserver = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        trackEvent("view_product_demo");
        demoObserver.disconnect();
      }
    }, { threshold: 0.25 });
    demoObserver.observe(demoSection);
  }

  window.setTimeout(() => {
    if (document.visibilityState === "visible") trackEvent("engaged_30s");
  }, 30000);
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',setupLandingAnalytics,{once:true});
else setupLandingAnalytics();
