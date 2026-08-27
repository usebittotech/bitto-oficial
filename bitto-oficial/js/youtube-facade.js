// js/youtube-facade.js
// Substitui os embeds do YouTube por uma "fachada" (thumbnail + botão de play).
// O iframe real do YouTube só é criado quando o usuário clica, evitando que
// a página carregue ~500KB-1MB de JS/CSS do YouTube por vídeo automaticamente.

function loadYoutubeFacade(wrap) {
  const videoId = wrap.dataset.ytId;
  const title = wrap.dataset.ytTitle || "Vídeo do YouTube";
  if (!videoId) return;

  const iframe = document.createElement("iframe");
  iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
  iframe.title = title;
  iframe.allow =
    "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
  iframe.allowFullscreen = true;
  iframe.setAttribute("frameborder", "0");

  wrap.innerHTML = "";
  wrap.appendChild(iframe);
  wrap.classList.remove("yt-facade");
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".yt-facade").forEach((wrap) => {
    wrap.addEventListener("click", () => loadYoutubeFacade(wrap), {
      once: true,
    });
    // Acessibilidade: permite ativar com teclado (Enter/Espaço), já que o
    // elemento tem role="button" e tabindex="0".
    wrap.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          loadYoutubeFacade(wrap);
        }
      },
      { once: true }
    );
  });
});
