import express from "express";
import yahooFinance from "yahoo-finance2";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.use(express.json());
app.use(express.static("public")); // sert /public (index.html, app.js, styles.css)

// util: normalise l’heure reçue de Yahoo
function toIsoFromYahooTime(t: unknown): string | null {
  if (typeof t === "number") return new Date(t * 1000).toISOString();
  if (t instanceof Date) return t.toISOString();
  return null;
}

// API: GET /api/quote?tickers=AAPL,MSFT
app.get("/api/quote", async (req, res) => {
  try {
    const raw = String(req.query.tickers || "").trim();
    if (!raw) return res.status(400).json({ error: "Missing ?tickers=..." });

    const symbols = raw.split(/[, ]+/).filter(Boolean).slice(0, 25);
    const data = await yahooFinance.quote(symbols);
    const arr = Array.isArray(data) ? data : [data];

    const compact = arr.map((q: any) => ({
      symbol: q.symbol,
      shortName: q.shortName ?? q.longName ?? null,
      currency: q.currency ?? null,
      marketState: q.marketState ?? null,
      regularMarketPrice: q.regularMarketPrice ?? null,
      regularMarketChange: q.regularMarketChange ?? null,
      regularMarketChangePercent: q.regularMarketChangePercent ?? null,
      regularMarketTime: toIsoFromYahooTime(q.regularMarketTime),
      regularMarketVolume: q.regularMarketVolume ?? null,
      fiftyTwoWeekRange: q.fiftyTwoWeekRange ?? null,
      exchange: q.fullExchangeName ?? q.exchange ?? null,
    }));

    res.json({ count: compact.length, results: compact });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Unknown error" });
  }
});

app.listen(PORT, () => {
  console.log("✅ Server running: http://localhost:" + PORT);
});
