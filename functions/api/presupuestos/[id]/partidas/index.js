import { json } from "../../../../_utils.js";

// POST /api/presupuestos/:id/partidas
// body: { cultivo, es_soja?, orden?, superficie_ha?, rendimiento_qq_ha?, precio_symbol?, precio_congelado? }
export async function onRequestPost({ request, env, params }) {
  if (!env.DB) return json({ error: "Falta el binding DB" }, 500);
  const presupuestoId = params.id;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Body inválido" }, 400);
  }

  const cultivo = (body?.cultivo || "").trim();
  if (!cultivo) return json({ error: "Falta el nombre del cultivo" }, 400);

  const esSoja = body.es_soja ? 1 : 0;
  const orden = body.orden ?? 0;
  const precioFecha = body.precio_symbol ? new Date().toISOString() : null;

  try {
    const res = await env.DB.prepare(
      `INSERT INTO presupuesto_partidas
        (presupuesto_id, cultivo, es_soja, orden, superficie_ha, rendimiento_qq_ha, precio_symbol, precio_congelado, precio_fecha)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        presupuestoId,
        cultivo,
        esSoja,
        orden,
        body.superficie_ha ?? null,
        body.rendimiento_qq_ha ?? null,
        body.precio_symbol ?? null,
        body.precio_congelado ?? null,
        precioFecha
      )
      .run();

    return json({ id: res.meta.last_row_id });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
