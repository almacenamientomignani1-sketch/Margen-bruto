import { json, REMARKETS_BASE } from "../../_utils.js";

// GET /api/remarkets/instruments?token=...  -> { instruments: [{symbol, cficode}] }
export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) return json({ error: "Falta token" }, 401);

  try {
    const upstream = await fetch(`${REMARKETS_BASE}/rest/instruments/all`, {
      headers: { "X-Auth-Token": token },
    });
    const data = await upstream.json();

    if (data.status !== "OK") {
      return json({ error: data.description || "Error consultando instrumentos" }, 502);
    }

    const instruments = (data.instruments || []).map((i) => ({
      symbol: i.instrumentId.symbol,
      cficode: i.cficode,
    }));

    return json({ instruments });
  } catch (e) {
    return json({ error: "No se pudo contactar a reMarkets" }, 502);
  }
}
