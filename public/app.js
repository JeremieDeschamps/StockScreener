// State & helpers
let state = { current: "Default", lists: { Default: [] } };
let timer = null;
const $ = (s) => document.querySelector(s);
const tbody = $("#tbody"), listSel = $("#listSel"), status = $("#status");

// Storage
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
  const names = Object.keys(state.lists);
  if (names.length === 0) {
    state.lists["Default"] = [];
    state.current = "Default";
  }
  listSel.innerHTML = Object.keys(state.lists)
    .map((n) => `<option${n === state.current ? " selected" : ""}>${n}</option>`)
    .join("");
}

// Fetch & render
async function fetchAll() {
  const list = currentList();
  if (!list.length) { tbody.innerHTML = ""; return; }
  status.textContent = "Chargement…";
  try {
    const url = "/api/quote?tickers=" + encodeURIComponent(list.join(","));
    const res = await fetch(url);
    const { results = [] } = await res.json();
    tbody.innerHTML = results.map((r) => {
      const chg = Number(r.regularMarketChange || 0);
      const pct = Number(r.regularMarketChangePercent || 0);
      const cls = chg >= 0 ? "up" : "down";
      return `<tr>
        <td><b>${r.symbol || "—"}</b></td>
        <td>${r.shortName || "—"}</td>
        <td>${r.regularMarketPrice ?? "—"}</td>
        <td class="${cls}">${chg.toFixed(2)}</td>
        <td class="${cls}">${pct.toFixed(2)}%</td>
        <td>${r.currency || "—"}</td>
        <td><button data-sym="${r.symbol || ""}">X</button></td>
      </tr>`;
    }).join("");
    tbody.querySelectorAll("button").forEach((b) => {
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
    alert(e.message || e);
  }
}

// UI actions
$("#add").onclick = function () {
  const v = $("#sym").value.trim();
  if (!v) return;
  const arr = currentList();
  if (!arr.includes(v)) {
    state.lists[state.current] = arr.concat([v]);
    save();
  }
  $("#sym").value = "";
  fetchAll();
};
// Quand on tape "Enter" dans l'input #sym, ça simule un clic sur Ajouter
$("#sym").addEventListener("keydown", function (e) {
  if (e.key === "Enter") {
    e.preventDefault(); // évite le "submit" ou refresh par défaut
    $("#add").click();  // déclenche le bouton Ajouter
  }
});
$("#refresh").onclick = fetchAll;
$("#auto").onchange = function () {
  if (timer) { clearInterval(timer); timer = null; }
  const s = Number(this.value);
  if (s > 0) timer = setInterval(fetchAll, s * 1000);
};

// lists
$("#newList").onclick = function () {
  const name = prompt("Nom de la nouvelle liste ?", "MaListe");
  if (!name) return;
  if (state.lists[name]) return alert("Ce nom existe déjà.");
  state.lists[name] = [];
  state.current = name;
  save(); renderListSel(); fetchAll();
};
$("#renameList").onclick = function () {
  const old = state.current;
  const name = prompt("Nouveau nom pour la liste:", old);
  if (!name || name === old) return;
  if (state.lists[name]) return alert("Ce nom existe déjà.");
  state.lists[name] = state.lists[old] || [];
  delete state.lists[old];
  state.current = name;
  save(); renderListSel(); fetchAll();
};
$("#deleteList").onclick = function () {
  if (!confirm(`Supprimer la liste "${state.current}" ?`)) return;
  const names = Object.keys(state.lists);
  if (names.length <= 1) return alert("Il faut au moins une liste.");
  delete state.lists[state.current];
  state.current = Object.keys(state.lists)[0];
  save(); renderListSel(); fetchAll();
};
listSel.onchange = function () {
  state.current = this.value;
  if (!state.lists[state.current]) state.lists[state.current] = [];
  save(); fetchAll();
};

// JSON modal
const modal = $("#jsonModal"), area = $("#jsonArea"), hint = $("#jsonHint");
$("#editJson").onclick = function () {
  area.value = JSON.stringify(currentList(), null, 2);
  hint.textContent = "Liste: " + state.current;
  modal.style.display = "flex";
};
$("#jsonCancel").onclick = function () { modal.style.display = "none"; };
$("#jsonSave").onclick = function () {
  try {
    let arr = JSON.parse(area.value);
    if (!Array.isArray(arr)) return alert("Le JSON doit être un tableau de tickers.");
    arr = arr.map((s) => String(s).trim()).filter(Boolean);
    state.lists[state.current] = arr;
    save(); modal.style.display = "none"; fetchAll();
  } catch (e) { alert("JSON invalide: " + e.message); }
};

// boot
load(); renderListSel(); fetchAll();
