/******************************
 * Toast (bottom center)
 ******************************/
function showToast(msg, kind = "ok", ms = 3000) {
  const toast = document.getElementById("toast");
  const text = document.getElementById("toast-text");
  if (!toast || !text) return;
  text.textContent = msg;
  toast.className = "toast " + kind;
  toast.classList.add("show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove("show"), ms);
}

/******************************
 * Watchlist state & helpers
 ******************************/
let state = { current: "Default", lists: { Default: [] } };
let timer = null;

const $ = (s) => document.querySelector(s);
const tbody  = $("#tbody");
const listSel = $("#listSel");
const status = $("#status");

function load() {
  try {
    const raw = localStorage.getItem("watchlists");
    if (raw) state = JSON.parse(raw);
  } catch {}
  if (!state || typeof state !== "object") state = { current: "Default", lists: { Default: [] } };
  if (!state.lists[state.current]) state.lists[state.current] = [];
}

function save() {
  localStorage.setItem("watchlists", JSON.stringify(state));
}

function currentList() {
  return state.lists[state.current] || [];
}

function renderListSel() {
  if (!listSel) return;
  const names = Object.keys(state.lists);
  if (names.length === 0) {
    state.lists["Default"] = [];
    state.current = "Default";
  }
  listSel.innerHTML = Object.keys(state.lists)
    .map((n) => `<option${n === state.current ? " selected" : ""}>${n}</option>`)
    .join("");
}

/******************************
 * Fetch & render quotes
 ******************************/
async function fetchAll() {
  if (!tbody || !status) return;
  const list = currentList();
  if (!list.length) { tbody.innerHTML = ""; status.textContent = "—"; return; }

  status.textContent = "Chargement…";
  try {
    const url = "/api/quote?tickers=" + encodeURIComponent(list.join(","));
    const res = await fetch(url);
    const { results = [] } = await res.json();

    // Nettoyage: retirer de la liste les symboles non retournés par l’API (s’ils existent encore)
    const returned = new Set(results.map(r => String(r.symbol || "").toUpperCase()));
    const missing = currentList().filter(s => !returned.has(String(s).toUpperCase()));
    if (missing.length) {
      state.lists[state.current] = currentList().filter(s => !missing.includes(s));
      save();
      showToast(`Retiré (introuvable): ${missing.join(", ")}`, "error", 4000);
    }

    tbody.innerHTML = results.map((r) => {
      const chg = Number(r.regularMarketChange || 0);
      const pct = Number(r.regularMarketChangePercent || 0);
      const cls = chg >= 0 ? "up" : "down";
      return `<tr>
        <td><b>${r.symbol || "—"}</b></td>
        <td>${r.shortName || "—"}</td>
        <td>${r.regularMarketPrice ?? "—"}</td>
        <td class="${cls}">${isFinite(chg) ? chg.toFixed(2) : "—"}</td>
        <td class="${cls}">${isFinite(pct) ? pct.toFixed(2) + "%" : "—"}</td>
        <td>${r.currency || "—"}</td>
        <td><button data-sym="${r.symbol || ""}">X</button></td>
      </tr>`;
    }).join("");

    // Suppression par ligne
    tbody.querySelectorAll("button[data-sym]").forEach((b) => {
      b.onclick = function () {
        const sym = this.getAttribute("data-sym");
        state.lists[state.current] = currentList().filter((t) => t !== sym);
        save();
        fetchAll();
      };
    });

    status.textContent = "OK • " + results.length + " résultat(s)";
  } catch (e) {
    console.error(e);
    status.textContent = "Erreur";
    showToast("Erreur de récupération des quotes", "error", 4000);
  }
}

/******************************
 * UI actions (Watchlist)
 ******************************/
const addBtn = $("#add");
const symInput = $("#sym");
const refreshBtn = $("#refresh");
const autoSel = $("#auto");

if (addBtn && symInput) {
  addBtn.onclick = async function () {
    const raw = symInput.value.trim();
    if (!raw) return;

    const candidates = raw.split(/[, ]+/).map(s => s.trim()).filter(Boolean);
    symInput.value = "";

    try {
      const url = "/api/quote?tickers=" + encodeURIComponent(candidates.join(","));
      const res = await fetch(url);
      const { results = [] } = await res.json();

      const validSet = new Set(results.map(r => (r.symbol || "").toUpperCase()));
      const added = [];
      const invalid = [];

      for (const c of candidates) {
        if (validSet.has(c.toUpperCase())) {
          if (!currentList().includes(c)) {
            state.lists[state.current] = currentList().concat([c]);
            added.push(c);
          }
        } else {
          invalid.push(c);
        }
      }

      if (added.length) {
        save();
        fetchAll();
        showToast(`Ajouté: ${added.join(", ")}`, "ok");
      }
      if (invalid.length) {
        showToast(`Introuvable: ${invalid.join(", ")}`, "error", 4000);
      }
    } catch (e) {
      console.error(e);
      showToast("Erreur réseau/serveur lors de la vérification.", "error", 4000);
    }
  };

  // Enter sur l’input = Ajouter
  symInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addBtn.click();
    }
  });
}

if (refreshBtn) refreshBtn.onclick = fetchAll;

if (autoSel) {
  autoSel.onchange = function () {
    if (timer) { clearInterval(timer); timer = null; }
    const s = Number(this.value);
    if (s > 0) timer = setInterval(fetchAll, s * 1000);
  };
}

/******************************
 * Watchlist: gestion des listes
 ******************************/
const newListBtn = $("#newList");
const renameListBtn = $("#renameList");
const deleteListBtn = $("#deleteList");

if (newListBtn) newListBtn.onclick = function () {
  const name = prompt("Nom de la nouvelle liste ?", "MaListe");
  if (!name) return;
  if (state.lists[name]) return alert("Ce nom existe déjà.");
  state.lists[name] = [];
  state.current = name;
  save(); renderListSel(); fetchAll();
};

if (renameListBtn) renameListBtn.onclick = function () {
  const old = state.current;
  const name = prompt("Nouveau nom pour la liste:", old);
  if (!name || name === old) return;
  if (state.lists[name]) return alert("Ce nom existe déjà.");
  state.lists[name] = state.lists[old] || [];
  delete state.lists[old];
  state.current = name;
  save(); renderListSel(); fetchAll();
};

if (deleteListBtn) deleteListBtn.onclick = function () {
  if (!confirm(`Supprimer la liste "${state.current}" ?`)) return;
  const names = Object.keys(state.lists);
  if (names.length <= 1) return alert("Il faut au moins une liste.");
  delete state.lists[state.current];
  state.current = Object.keys(state.lists)[0];
  save(); renderListSel(); fetchAll();
};

if (listSel) {
  listSel.onchange = function () {
    state.current = this.value;
    if (!state.lists[state.current]) state.lists[state.current] = [];
    save(); fetchAll();
  };
}

/******************************
 * JSON modal (Watchlist)
 ******************************/
const modal = $("#jsonModal");
const area  = $("#jsonArea");
const hint  = $("#jsonHint");
const editJsonBtn = $("#editJson");
const jsonSaveBtn = $("#jsonSave");
const jsonCancelBtn = $("#jsonCancel");

if (editJsonBtn && modal && area && hint) {
  editJsonBtn.onclick = function () {
    area.value = JSON.stringify(currentList(), null, 2);
    hint.textContent = "Liste: " + state.current;
    modal.style.display = "flex";
  };
}
if (jsonCancelBtn && modal) {
  jsonCancelBtn.onclick = function () { modal.style.display = "none"; };
}
if (jsonSaveBtn && modal && area) {
  jsonSaveBtn.onclick = function () {
    try {
      let arr = JSON.parse(area.value);
      if (!Array.isArray(arr)) return alert("Le JSON doit être un tableau de tickers.");
      arr = arr.map((s) => String(s).trim()).filter(Boolean);
      state.lists[state.current] = arr;
      save(); modal.style.display = "none"; fetchAll();
    } catch (e) {
      alert("JSON invalide: " + e.message);
    }
  };
}

/******************************
 * Navigation (tabs)
 ******************************/
function showPage(page) {
  // onglets actifs
  document.querySelectorAll(".navbar a")
    .forEach(a => a.classList.toggle("active", a.dataset.page === page));

  // pages visibles
  document.querySelectorAll(".page").forEach(p => (p.classList.remove("active"), p.style.display = "none"));
  const target = document.getElementById("page-" + page);
  if (target) { target.classList.add("active"); target.style.display = "block"; }

  // timers: seulement sur watchlist
  if (timer) { clearInterval(timer); timer = null; }
  if (page === "watchlist") {
    fetchAll();
    const secs = Number(document.getElementById("auto")?.value || 0);
    if (secs > 0) timer = setInterval(fetchAll, secs * 1000);
  }

  // portfolio: rendre au moment où on entre (si chargé)
  if (page === "portfolio" && window.Portfolio && typeof Portfolio.render === "function") {
    Portfolio.render();
  }
}

// Appel d’init quand on arrive sur la page Portfolio
let _pfBooted = false;
function bootPortfolioOnce(){
  if (_pfBooted) return;
  _pfBooted = true;
  if (window.Portfolio){
    window.Portfolio.load();
    window.Portfolio.hook();
    window.Portfolio.render();
  }
}

// Exemple: si tu as une nav avec data-page
document.querySelectorAll('nav a[data-page]').forEach(a=>{
  a.addEventListener('click', (e)=>{
    e.preventDefault();
    const id = a.dataset.page;
    document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active', p.id === 'page-'+id));
    if (id === 'portfolio') bootPortfolioOnce();
  });
});

// Si la page Portfolio est la page par défaut
window.addEventListener('DOMContentLoaded', ()=>{
  const active = document.querySelector('.page.active');
  if (active && active.id === 'page-portfolio') bootPortfolioOnce();
});


document.querySelectorAll(".navbar a").forEach(link => {
  link.addEventListener("click", e => {
    e.preventDefault();
    showPage(link.dataset.page);
  });
});

/******************************
 * Boot
 ******************************/
load();
renderListSel();
fetchAll(); // premier rendu

document.addEventListener("DOMContentLoaded", () => {
  // si portfolio.js est présent, initialiser ses handlers (sans rendre)
  if (window.Portfolio && typeof Portfolio.load === "function" && typeof Portfolio.hook === "function") {
    Portfolio.load();
    Portfolio.hook();
  }
  // page par défaut
  showPage("watchlist");
});
