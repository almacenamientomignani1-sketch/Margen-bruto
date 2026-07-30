import { json } from "../../_utils.js";

// GET /api/ejecucion-categorias?presupuesto_id=1 -> { categorias: [...] }
export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: "Falta el binding DB" }, 500);
  const url = new URL(request.url);
  const presupuestoId = url.searchParams.get("presupuesto_id");
  if (!presupuestoId) return json({ error: "Falta presupuesto_id" }, 400);

  try {
    const { results } = await env.DB.prepare(
      `SELECT * FROM ejecucion_categorias WHERE presupuesto_id = ? ORDER BY seccion, orden, id`
    )
      .bind(presupuestoId)
      .all();
    return json({ categorias: results });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

// POST /api/ejecucion-categorias  { presupuesto_id, seccion, nombre, orden? } -> { id }
export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: "Falta el binding DB" }, 500);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Body inválido" }, 400);
  }

  const { presupuesto_id, seccion, nombre } = body || {};
  if (!presupuesto_id || !seccion || !nombre?.trim()) {
    return json({ error: "Faltan presupuesto_id, seccion o nombre" }, 400);
  }

  const creado = new Date().toISOString();
  try {
    const res = await env.DB.prepare(
      `INSERT INTO ejecucion_categorias (presupuesto_id, seccion, nombre, orden, creado) VALUES (?, ?, ?, ?, ?)`
    )
      .bind(presupuesto_id, seccion, nombre.trim(), body.orden ?? 0, creado)
      .run();
    return json({ id: res.meta.last_row_id });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
