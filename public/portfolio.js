// public/portfolio.js
(function () {
  let portfolio = [];
  const nf2  = new Intl.NumberFormat(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
  const money = x => (x==null || !Number.isFinite(Number(x))) ? "—" : nf2.format(Number(x));
  const pctF  = x => (x==null || !Number.isFinite(Number(x))) ? "—" : nf2.format(Number(x)) + "%";

  // Anti-doublons d'écouteurs + anti double-submit
  let wired  = false;
  let adding = false;

  function load() {
    try { portfolio = JSON.parse(localStorage.getItem("portfolio") || "[]"); }
    catch { portfolio = []; }
    if (!Array.isArray(portfolio)) portfolio = [];
  }
  function save() {
    localStorage.setItem("portfolio", JSON.stringify(portfolio));
  }

  async function render() {
    const box = document.getElementById("pf-list");
    const status = document.getElementById("pf-status");
    if (!box || !status) return;

    if (!portfolio.length) {
      box.innerHTML = '<div class="muted" style="padding:8px">Aucune position.</div>';
      updateSummary({ value: null, pl: null, plp: null });
      status.textContent = "—";
      return;
    }

    status.textContent = "Chargement…";
    let quotes = [];
    try {
      const syms = portfolio.map(p => String(p.symbol||"").toUpperCase());
      const r = await fetch("/api/quote?tickers=" + encodeURIComponent(syms.join(",")));
      const js = await r.json();
      // Ton API renvoie js.results; fallback si jamais le nom change
      quotes = js.results || js.result || js.quotes || [];
    } catch (e) {
      console.error(e);
      if (typeof showToast === "function") showToast("Erreur: quotes portfolio", "error", 4000);
    }

    const qmap = new Map(quotes.map(q => [String(q.symbol||"").toUpperCase(), q]));
    let totalCost = 0, totalValue = 0;

    box.innerHTML = portfolio.map((p, idx) => {
      const symU = String(p.symbol||"").toUpperCase();
      const q = qmap.get(symU);
      const last = (q && Number.isFinite(Number(q.regularMarketPrice))) ? Number(q.regularMarketPrice) : null;

      const shares = Number(p.shares);
      const avg    = Number(p.avg);

      const value = (last!=null && Number.isFinite(shares)) ? last * shares : null;
      const cost  = (Number.isFinite(avg) && Number.isFinite(shares)) ? avg * shares : null;

      const pl  = (value!=null && cost!=null) ? (value - cost) : null;
      const plp = (pl!=null && cost>0) ? (pl / cost * 100) : null;

      if (cost!=null) totalCost += cost;
      if (value!=null) totalValue += value;

      const currency = q?.currency || "—";

      // Variation du jour totale + %
      const chgUnit = Number(q?.regularMarketChange ?? NaN);
      const pctUnit = Number(q?.regularMarketChangePercent ?? NaN);
      const haveChg = Number.isFinite(chgUnit) && Number.isFinite(shares);
      const havePct = Number.isFinite(pctUnit);
      const totalChg = haveChg ? chgUnit * shares : null;
      const cls = (totalChg ?? 0) >= 0 ? "up" : "down";

      return `
<details class="pos" data-idx="${idx}">
  <summary>
    <div class="sym">${symU}</div>
    <div class="price">${money(last)} ${currency}</div>
    <div class="chg ${ (totalChg==null || !havePct) ? "" : cls }">
      ${ (totalChg==null || !havePct) ? "—" : `${nf2.format(totalChg)} (${nf2.format(pctUnit)}%)` }
    </div>
  </summary>
  <div class="body">
    <div class="row"><div class="k">Actions</div><div class="v">${Number.isFinite(shares)? shares : "—"}</div></div>
    <div class="row"><div class="k">Coût moyen</div><div class="v">${money(avg)}</div></div>
    <div class="row"><div class="k">Valeur marché</div><div class="v">${money(value)} ${currency}</div></div>
    <div class="row"><div class="k">Coût total</div><div class="v">${money(cost)}</div></div>
    <div class="row"><div class="k">Dernier prix</div><div class="v">${money(last)} ${currency}</div></div>
    <div class="row"><div class="k">État</div><div class="v">${q?.marketState || "—"}</div></div>
    <div class="actions">
      <button class="btn-danger" data-action="del" data-idx="${idx}">Supprimer</button>
    </div>
  </div>
</details>`;
    }).join("");

    // Delete handler (ré-attache OK car on recrée l'HTML)
    box.querySelectorAll('button[data-action="del"]').forEach(btn => {
      btn.onclick = () => {
        const i = Number(btn.dataset.idx);
        if (!Number.isInteger(i)) return;
        portfolio.splice(i,1);
        save(); render();
        if (typeof showToast === "function") showToast("Position supprimée", "ok");
      };
    });

    const plTotal = (Number.isFinite(totalValue) && Number.isFinite(totalCost)) ? (totalValue - totalCost) : null;
    const plpTotal = (plTotal!=null && totalCost>0) ? (plTotal/totalCost*100) : null;
    updateSummary({ value: totalValue, pl: plTotal, plp: plpTotal });

    status.textContent = "OK • " + portfolio.length + " position(s)";
  }

  function updateSummary({ value, pl, plp }) {
    const sumValueEl = document.getElementById("pf-sum-value");
    const sumPlEl    = document.getElementById("pf-sum-pl");
    const sumPlpEl   = document.getElementById("pf-sum-plp");
    if (!sumValueEl || !sumPlEl || !sumPlpEl) return;

    sumValueEl.textContent = "Valeur totale: " + money(value);
    sumPlEl.textContent    = "Retour total ($): " + money(pl);
    // FIX: parenthèse manquante dans le texte %
    sumPlpEl.textContent   = "Retour total (%): " + pctF(plp);

    sumPlEl.classList.toggle("up",   (pl  ?? 0) >= 0);
    sumPlEl.classList.toggle("down", (pl  ?? 0) <  0);
    sumPlpEl.classList.toggle("up",  (plp ?? 0) >= 0);
    sumPlpEl.classList.toggle("down",(plp ?? 0) <  0);
  }

  function hook() {
    if (wired) return;  // évite d’attacher 2x
    wired = true;

    const add = document.getElementById("pf-add");
    const refresh = document.getElementById("pf-refresh");

    const elSym = document.getElementById("pf-symbol");
    const elSh  = document.getElementById("pf-shares");
    const elAv  = document.getElementById("pf-avg");

    const submit = async () => {
      if (adding) return; // anti double-submit
      adding = true;
      try {
        const s  = (elSym?.value || "").trim();
        const sh = Number(elSh?.value);
        const av = Number(elAv?.value);

        if(!s || !(sh>0) || !(av>=0)){
          showToast?.("Complète symbole / actions / coût moyen", "error", 4000);
          return;
        }

        // validate ticker
        try{
          const r = await fetch("/api/quote?tickers=" + encodeURIComponent(s));
          const js = await r.json();
          const arr = js.results || js.result || js.quotes || [];
          const ok = arr.some(r => String(r.symbol||"").toUpperCase()===s.toUpperCase());
          if(!ok){ showToast?.(`Introuvable: ${s}`, "error", 4000); return; }
        }catch{
          showToast?.("Erreur de validation du ticker", "error", 4000); return;
        }

        // merge same symbol
        const i = portfolio.findIndex(p => String(p.symbol||"").toUpperCase()===s.toUpperCase());
        if(i>=0){
          const prev = portfolio[i];
          const newShares = Number(prev.shares) + sh;
          const newAvg = ((Number(prev.avg)*Number(prev.shares)) + (av*sh)) / newShares;
          portfolio[i] = { symbol: prev.symbol, shares: newShares, avg: newAvg };
          showToast?.(`Position mise à jour: ${s}`, "ok");
        }else{
          portfolio.push({ symbol: s.toUpperCase(), shares: sh, avg: av });
          showToast?.(`Ajouté: ${s.toUpperCase()}`, "ok");
        }
        save();
        if (elSym) elSym.value = "";
        if (elSh)  elSh.value  = "";
        if (elAv)  elAv.value  = "";
        render();
      } finally {
        adding = false;
      }
    };

    if (add) add.onclick = submit;

    [elSym, elSh, elAv].forEach(el=>{
      el?.addEventListener("keydown", e=>{
        if (e.key==="Enter"){ e.preventDefault(); submit(); }
      });
    });

    if (refresh) refresh.onclick = render;
  }

  // Expose à app.js
  window.Portfolio = { load, save, render, hook };
})();
