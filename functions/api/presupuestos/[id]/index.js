import { json } from "../../_utils.js";

// GET /api/presupuestos/:id -> { presupuesto: {...}, partidas: [...] }
export async function onRequestGet({ env, params }) {
  if (!env.DB) return json({ error: "Falta el binding DB" }, 500);
  const id = params.id;

  try {
    const presupuesto = await env.DB.prepare(`SELECT * FROM presupuestos WHERE id = ?`).bind(id).first();
    if (!presupuesto) return json({ error: "No existe ese presupuesto" }, 404);

    const { results: partidas } = await env.DB.prepare(
      `SELECT * FROM presupuesto_partidas WHERE presupuesto_id = ? ORDER BY orden, id`
    )
      .bind(id)
      .all();

    return json({ presupuesto, partidas });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

// PUT /api/presupuestos/:id  { arrendamiento_qq_ha?, soja_ref_symbol?, soja_ref_precio? }
export async function onRequestPut({ request, env, params }) {
  if (!env.DB) return json({ error: "Falta el binding DB" }, 500);
  const id = params.id;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Body inválido" }, 400);
  }

  const fields = [];
  const values = [];

  if (body.arrendamiento_qq_ha !== undefined) {
    fields.push("arrendamiento_qq_ha = ?");
    values.push(body.arrendamiento_qq_ha);
  }
  if (body.soja_ref_symbol !== undefined) {
    fields.push("soja_ref_symbol = ?");
    values.push(body.soja_ref_symbol);
    fields.push("soja_ref_precio = ?");
    values.push(body.soja_ref_precio ?? null);
    fields.push("soja_ref_fecha = ?");
    values.push(new Date().toISOString());
  }

  if (fields.length === 0) return json({ error: "Nada para actualizar" }, 400);

  values.push(id);
  try {
    await env.DB.prepare(`UPDATE presupuestos SET ${fields.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();
    return json({ ok: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
