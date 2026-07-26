import { json, REMARKETS_BASE } from "../../_utils.js";

// GET /api/remarkets/marketdata?token=...&symbol=SOJ/MAY26&entries=BI,OF,LA,SE,CL -> { marketData }
export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const symbol = url.searchParams.get("symbol");
  const entries = url.searchParams.get("entries") || "BI,OF,LA,SE,CL";

  if (!token) return json({ error: "Falta token" }, 401);
  if (!symbol) return json({ error: "Falta symbol" }, 400);

  try {
    const upstream = await fetch(
      `${REMARKETS_BASE}/rest/marketdata/get?marketId=ROFX&symbol=${encodeURIComponent(
        symbol
      )}&entries=${encodeURIComponent(entries)}&depth=1`,
      { headers: { "X-Auth-Token": token } }
    );
    const data = await upstream.json();

    if (data.status !== "OK") {
      return json({ error: data.description || "Error consultando market data" }, 502);
    }

    return json({ marketData: data.marketData });
  } catch (e) {
    return json({ error: "No se pudo contactar a reMarkets" }, 502);
  }
}
