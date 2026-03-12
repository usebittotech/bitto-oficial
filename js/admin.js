import {
  auth,
  db,
  onAuthStateChanged,
  doc,
  updateDoc,
} from "./firebase-init.js";
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const SEU_EMAIL_ADMIN = "usebitto.tech@gmail.com";
const URL_SHEETS =
  "https://script.google.com/macros/s/AKfycbykeG4jjW0RK9PFQi4aU5ndO1TzQPg-CWMIR6DYFfyWyn3jTCQ-I7HbCm5O-i3w-Bhd/exec";

// ── AUTH GUARD ──
onAuthStateChanged(auth, (user) => {
  if (user && user.email.toLowerCase() === SEU_EMAIL_ADMIN.toLowerCase()) {
    document.body.style.display = "flex";
    carregarDadosSheets();
  } else {
    window.location.href = "index.html";
  }
});

// ── TOAST ──
function showToast(msg, type = "success") {
  const t = document.getElementById("toast");
  const m = document.getElementById("toastMsg");
  const icon = t.querySelector(".toast-icon");
  m.textContent = msg;
  icon.textContent = type === "error" ? "❌" : type === "info" ? "⚡" : "✅";
  t.style.borderLeftColor =
    type === "error"
      ? "var(--red)"
      : type === "info"
        ? "var(--blue)"
        : "var(--green)";
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3000);
}

// ── ACTIVITY FEED ──
function addActivity(icon, html) {
  const feed = document.getElementById("activityFeed");
  const now = new Date().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const item = document.createElement("div");
  item.className = "activity-item";
  item.innerHTML = `<div class="activity-icon">${icon}</div>
    <div><div class="activity-text">${html}</div>
    <div class="activity-time">${now}</div></div>`;
  feed.prepend(item);
  while (feed.children.length > 10) feed.lastChild.remove();
}

// ── HELPERS ──
function getInitials(name = "") {
  return (name || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
}
function avatarColor(name = "") {
  const colors = [
    "rgba(59,111,255,0.3)",
    "rgba(0,229,122,0.25)",
    "rgba(168,85,247,0.3)",
    "rgba(255,200,80,0.25)",
    "rgba(255,77,106,0.25)",
  ];
  return colors[(name.charCodeAt(0) || 0) % colors.length];
}

// ── FIX 4: KPIs dinâmicos com barras de progresso reais ──
function updateKPIs(influencers) {
  const total = influencers.length;
  const ativos = influencers.filter((i) => i[3] === "Ativo").length;
  const abordagem = influencers.filter((i) => i[3] === "Abordagem").length;
  const prospeccao = influencers.filter((i) => i[3] === "Prospecção").length;

  document.getElementById("kpiTotal").textContent = total;
  document.getElementById("kpiAtivos").textContent = ativos;
  document.getElementById("kpiAbordagem").textContent = abordagem;
  document.getElementById("kpiProspeccao").textContent = prospeccao;
  document.getElementById("navBadge").textContent = total;

  // Barras de progresso baseadas em % real do total
  if (total > 0) {
    setBar("barAtivos", (ativos / total) * 100);
    setBar("barAbordagem", (abordagem / total) * 100);
    setBar("barProspeccao", (prospeccao / total) * 100);
    setBar("barTotal", Math.min(100, total * 5)); // escala visual p/ total
  }
}
function setBar(id, pct) {
  const el = document.getElementById(id);
  if (el) el.style.width = Math.round(pct) + "%";
}

// ── RENDER ROWS ──
function renderRows(influencers) {
  const lista = document.getElementById("listaInfluencers");
  const search = (
    document.getElementById("searchInput")?.value || ""
  ).toLowerCase();
  const filter = window._filterStatus || "all";

  let data = influencers;
  if (filter !== "all") data = data.filter((i) => i[3] === filter);
  if (search)
    data = data.filter(
      (i) =>
        (i[0] || "").toLowerCase().includes(search) ||
        (i[1] || "").toLowerCase().includes(search) ||
        (i[7] || "").toLowerCase().includes(search),
    );

  document.getElementById("tableCount").textContent =
    `${data.length} registro${data.length !== 1 ? "s" : ""}`;

  if (!data.length) {
    lista.innerHTML = `<tr><td colspan="6"><div class="empty-state">
      <div class="empty-icon">📭</div>
      <div class="empty-title">Nenhum resultado</div>
      <div>Tente mudar o filtro ou busca</div>
    </div></td></tr>`;
    return;
  }

  lista.innerHTML = "";
  data.forEach((inf) => {
    const [
      nome,
      insta,
      nicho,
      status,
      interacoes,
      data_add,
      link,
      cupom,
      ativado,
    ] = inf;
    const instaEscaped = (insta || "").replace(/'/g, "\\'");
    const nomeEscaped = (nome || "").replace(/'/g, "\\'");
    const linkEscaped = (link || "").replace(/'/g, "\\'");
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="col-inf">
        <div class="inf-cell">
          <div class="inf-avatar" style="background:${avatarColor(nome)}">${getInitials(nome)}</div>
          <div>
            <div class="inf-name">${nome || "—"}</div>
            <div class="inf-handle" style="cursor:pointer" onclick="copyToAtivador('${instaEscaped}')">
              ${insta || ""}
              <span style="color:var(--blue);font-size:0.6rem;font-weight:700;margin-left:4px">COPY</span>
            </div>
          </div>
        </div>
      </td>
      <td class="col-status">
        <select onchange="updateSheets('${instaEscaped}', 'status', this.value)"
          style="background:var(--surface-2);border:1px solid var(--border);color:var(--text);
                 font-family:var(--font);font-size:0.8rem;font-weight:600;cursor:pointer;
                 outline:none;padding:4px 8px;border-radius:6px;width:100%">
          <option ${status === "Prospecção" ? "selected" : ""}>Prospecção</option>
          <option ${status === "Abordagem" ? "selected" : ""}>Abordagem</option>
          <option ${status === "Ativo" ? "selected" : ""}>Ativo</option>
        </select>
      </td>
      <td class="col-assets">
        <input type="text" placeholder="Cupom..." value="${cupom || ""}"
          onchange="window._pendingCupom_${instaEscaped.replace(/\W/g, "_")} = this.value"
          onblur="salvarCupom('${instaEscaped}', '${linkEscaped}', this.value)"
          class="form-input"
          style="margin:0;padding:5px 10px;font-size:0.72rem;font-family:var(--mono);
                 color:var(--yellow);width:100%;background:var(--surface-2);border-color:var(--border)"/>
      </td>
      <td class="col-plan" style="text-align:center">
        ${
          ativado === "Sim"
            ? `<span class="badge badge-green" style="font-size:0.6rem;padding:3px 8px"><span class="badge-dot"></span>ON</span>`
            : `<span class="badge" style="font-size:0.6rem;padding:3px 8px;background:var(--surface-3);border-color:var(--border);color:var(--muted)">OFF</span>`
        }
      </td>
      <td class="col-date" style="color:var(--muted);font-size:0.7rem;font-family:var(--mono)">
        ${data_add || "—"}
      </td>
      <td class="col-manage">
        <div class="action-btns">
          <button class="icon-btn" title="Ver Instagram"
            onclick="window.open('https://instagram.com/${(insta || "").replace("@", "")}','_blank')">📸</button>
          <button class="icon-btn danger" title="Remover"
            onclick="excluirInfluencer('${instaEscaped}', '${nomeEscaped}')">🗑</button>
        </div>
      </td>`;
    lista.appendChild(tr);
  });
}

// ── CARREGAR SHEETS ──
async function carregarDadosSheets() {
  const lista = document.getElementById("listaInfluencers");
  lista.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;opacity:0.5">
    Sincronizando...
  </td></tr>`;
  try {
    const res = await fetch(URL_SHEETS, { redirect: "follow" });
    const influencers = await res.json();
    window._allInfluencers = influencers;
    updateKPIs(influencers);
    renderRows(influencers);
    addActivity("📊", `Sheets sincronizado — ${influencers.length} leads`);
  } catch (e) {
    console.error(e);
    lista.innerHTML = `<tr><td colspan="6"><div class="empty-state">
      <div class="empty-icon">⚠️</div>
      <div class="empty-title">Erro ao carregar dados</div>
      <div style="font-family:var(--mono);font-size:0.7rem;color:var(--red)">${e.message}</div>
    </div></td></tr>`;
    showToast("Erro ao sincronizar", "error");
  }
}

// ── FIX: COPY TO ATIVADOR ──
window.copyToAtivador = (insta) => {
  document.getElementById("userEmail").value = insta;
  showToast("Handle copiado!", "info");
  addActivity("📋", `Handle copiado: ${insta}`);
};

// ── FIX: UPDATE STATUS ──
window.updateSheets = async (insta, tipo, valor, extra = {}) => {
  try {
    await fetch(URL_SHEETS, {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify({ action: "update", insta, tipo, valor, ...extra }),
    });
    showToast("Planilha atualizada!");
    addActivity("✏️", `Atualizado: <b>${insta}</b> → ${tipo}: ${valor}`);
    setTimeout(carregarDadosSheets, 2000);
  } catch (e) {
    showToast("Erro ao atualizar", "error");
  }
};

// ── FIX 2: SALVAR CUPOM separado com valor correto ──
window.salvarCupom = async (insta, link, cupomValor) => {
  if (!cupomValor && cupomValor !== "") return;
  try {
    await fetch(URL_SHEETS, {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify({
        action: "update",
        insta,
        tipo: "links",
        valor: cupomValor,
        link: link,
        cupom: cupomValor,
      }),
    });
    showToast("Cupom salvo!");
    addActivity("🎟️", `Cupom de <b>${insta}</b>: ${cupomValor}`);
    setTimeout(carregarDadosSheets, 2000);
  } catch (e) {
    showToast("Erro ao salvar cupom", "error");
  }
};

// ── FIX 1: EXCLUIR — delay maior + feedback ──
window.excluirInfluencer = async (insta, nome) => {
  if (!confirm(`Remover ${nome || insta} permanentemente?`)) return;
  showToast("Excluindo lead...", "info");
  try {
    await fetch(URL_SHEETS, {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify({ action: "delete", insta }),
    });
    // Remove da lista local imediatamente para feedback visual instantâneo
    if (window._allInfluencers) {
      window._allInfluencers = window._allInfluencers.filter(
        (i) => i[1] !== insta,
      );
      updateKPIs(window._allInfluencers);
      renderRows(window._allInfluencers);
    }
    showToast(`"${nome}" removido com sucesso!`);
    addActivity("🗑", `Lead removido: <b>${nome}</b> (${insta})`);
    // Re-sync com Sheets após 3s para confirmar
    setTimeout(carregarDadosSheets, 3000);
  } catch (e) {
    showToast("Erro ao excluir", "error");
  }
};

// ── SALVAR NOVO LEAD ──
document.getElementById("btnSalvarInf").onclick = async () => {
  const nome = document.getElementById("infNome").value.trim();
  const insta = document.getElementById("infInsta").value.trim();
  const status = document.getElementById("infStatus").value;
  const cupom = document.getElementById("infCupom")?.value.trim() || "";
  const plano = document.getElementById("infPlano")?.value || "Basic";
  if (!nome || !insta) {
    showToast("Preencha nome e @!", "error");
    return;
  }
  showToast("Salvando lead...", "info");
  try {
    await fetch(URL_SHEETS, {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify({
        action: "add",
        nome,
        insta,
        status,
        cupom,
        plano,
      }),
    });
    document.getElementById("modalOverlay").classList.remove("open");
    ["infNome", "infInsta", "infCupom"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    addActivity("👤", `Novo lead: <b>${nome}</b> (${insta}) — ${status}`);
    showToast(`Lead "${nome}" salvo!`);
    setTimeout(carregarDadosSheets, 2500);
  } catch (e) {
    showToast("Erro ao salvar lead", "error");
  }
};

// ── FIREBASE GRANT ──
document.getElementById("btnLiberar")?.addEventListener("click", async () => {
  const email = document.getElementById("userEmail").value.trim().toLowerCase();
  if (!email) {
    showToast("Digite um e-mail!", "error");
    return;
  }
  showToast("Verificando...", "info");
  try {
    const q = query(collection(db, "users"), where("email", "==", email));
    const snap = await getDocs(q);
    if (snap.empty) throw new Error("Usuário não encontrado.");
    await updateDoc(doc(db, "users", snap.docs[0].id), {
      plan: "embaixador",
      subscriptionEnd: Timestamp.fromDate(
        new Date(Date.now() + 13 * 24 * 60 * 60 * 1000),
      ),
    });
    showToast("🚀 Acesso Liberado!");
    addActivity("⚡", `Firebase: embaixador → <b>${email}</b>`);
    document.getElementById("userEmail").value = "";
  } catch (e) {
    showToast(e.message, "error");
  }
});

// ── SYNC ──
document.getElementById("btnSync").onclick = carregarDadosSheets;

// ── FILTROS ──
window._filterStatus = "all";
document.querySelectorAll(".filter-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    document
      .querySelectorAll(".filter-chip")
      .forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    window._filterStatus = chip.dataset.filter;
    if (window._allInfluencers) renderRows(window._allInfluencers);
  });
});

// ── BUSCA ──
document.getElementById("searchInput")?.addEventListener("input", () => {
  if (window._allInfluencers) renderRows(window._allInfluencers);
});

// ── EXPORT CSV ──
document.getElementById("btnExport")?.addEventListener("click", () => {
  const data = window._allInfluencers || [];
  const header =
    "Nome,Instagram,Nicho,Status,Interações,Data,Link,Cupom,Ativado\n";
  const rows = data
    .map((i) => i.map((v) => `"${v || ""}"`).join(","))
    .join("\n");
  const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `backstage_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  showToast("CSV exportado!");
  addActivity("⬇️", "Export CSV gerado");
});

// ── MODAL ──
const modal = document.getElementById("modalOverlay");
document
  .getElementById("btnOpenModal")
  ?.addEventListener("click", () => modal.classList.add("open"));
document
  .getElementById("btnCloseModal")
  ?.addEventListener("click", () => modal.classList.remove("open"));
document
  .getElementById("btnCancelModal")
  ?.addEventListener("click", () => modal.classList.remove("open"));
modal?.addEventListener("click", (e) => {
  if (e.target === modal) modal.classList.remove("open");
});

// ── FIX 3: THEME — aplica no <html> para pegar TODOS os elementos ──
const themeBtn = document.getElementById("themeBtn");
const savedTheme = localStorage.getItem("bitto_theme") || "dark";
if (savedTheme === "light") {
  document.documentElement.setAttribute("data-theme", "light");
  themeBtn.textContent = "🌙";
}
themeBtn.onclick = () => {
  const isLight =
    document.documentElement.getAttribute("data-theme") === "light";
  if (isLight) {
    document.documentElement.removeAttribute("data-theme");
    localStorage.setItem("bitto_theme", "dark");
    themeBtn.textContent = "☀️";
  } else {
    document.documentElement.setAttribute("data-theme", "light");
    localStorage.setItem("bitto_theme", "light");
    themeBtn.textContent = "🌙";
  }
};
