import { json } from "../../_utils.js";

// GET /api/history/query?simbolo=blue&tipo=dolar&desde=2026-07-01&hasta=2026-07-27&limit=200
export async function onRequestGet({ request, env }) {
  if (!env.DB) {
    return json({ error: "Base de datos no configurada (falta el binding DB)" }, 500);
  }

  const url = new URL(request.url);
  const simbolo = url.searchParams.get("simbolo");
  const tipo = url.searchParams.get("tipo");
  const desde = url.searchParams.get("desde"); // 'YYYY-MM-DD'
  const hasta = url.searchParams.get("hasta"); // 'YYYY-MM-DD'
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "200", 10), 1000);

  const conditions = [];
  const params = [];

  if (simbolo) {
    conditions.push("simbolo LIKE ?");
    params.push(`%${simbolo}%`);
  }
  if (tipo) {
    conditions.push("tipo = ?");
    params.push(tipo);
  }
  if (desde) {
    conditions.push("fecha_hora >= ?");
    params.push(`${desde}T00:00:00.000Z`);
  }
  if (hasta) {
    conditions.push("fecha_hora <= ?");
    params.push(`${hasta}T23:59:59.999Z`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    const stmt = env.DB.prepare(
      `SELECT tipo, simbolo, etiqueta, precio, compra, venta, fecha_hora
       FROM cotizaciones_historial
       ${where}
       ORDER BY fecha_hora DESC
       LIMIT ?`
    ).bind(...params, limit);

    const { results } = await stmt.all();
    return json({ results });
  } catch (e) {
    return json({ error: "No se pudo consultar la base: " + e.message }, 500);
  }
}
