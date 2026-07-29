import { json } from "../../../../_utils.js";

// GET /api/presupuestos/:id/costos -> { costos: [...] }
export async function onRequestGet({ env, params }) {
  if (!env.DB) return json({ error: "Falta el binding DB" }, 500);
  try {
    const { results } = await env.DB.prepare(
      `SELECT * FROM presupuesto_costos WHERE presupuesto_id = ? ORDER BY seccion, orden, id`
    )
      .bind(params.id)
      .all();
    return json({ costos: results });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

// POST /api/presupuestos/:id/costos
// body: { seccion, nombre, unidad?, dosis?, pasadas?, importe?, moneda?, orden? }
export async function onRequestPost({ request, env, params }) {
  if (!env.DB) return json({ error: "Falta el binding DB" }, 500);
  const presupuestoId = params.id;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Body inválido" }, 400);
  }

  const seccion = (body?.seccion || "").trim();
  const nombre = (body?.nombre || "").trim();
  if (!seccion || !nombre) return json({ error: "Faltan seccion o nombre" }, 400);

  const creado = new Date().toISOString();
  try {
    const res = await env.DB.prepare(
      `INSERT INTO presupuesto_costos
        (presupuesto_id, seccion, nombre, unidad, dosis, pasadas, importe, moneda, orden, creado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        presupuestoId,
        seccion,
        nombre,
        body.unidad ?? "pesos_ha",
        body.dosis ?? null,
        body.pasadas ?? 1,
        body.importe ?? 0,
        body.moneda ?? "ARS",
        body.orden ?? 0,
        creado
      )
      .run();
    return json({ id: res.meta.last_row_id });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
