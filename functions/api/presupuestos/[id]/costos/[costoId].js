import { json } from "../../../../_utils.js";

// PUT /api/presupuestos/:id/costos/:costoId
export async function onRequestPut({ request, env, params }) {
  if (!env.DB) return json({ error: "Falta el binding DB" }, 500);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Body inválido" }, 400);
  }

  const allowed = ["nombre", "unidad", "dosis", "pasadas", "importe", "moneda", "orden"];
  const fields = [];
  const values = [];

  for (const key of allowed) {
    if (body[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(body[key]);
    }
  }

  if (fields.length === 0) return json({ error: "Nada para actualizar" }, 400);

  values.push(params.costoId);
  try {
    await env.DB.prepare(`UPDATE presupuesto_costos SET ${fields.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();
    return json({ ok: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

// DELETE /api/presupuestos/:id/costos/:costoId
export async function onRequestDelete({ env, params }) {
  if (!env.DB) return json({ error: "Falta el binding DB" }, 500);
  try {
    await env.DB.prepare("DELETE FROM presupuesto_costos WHERE id = ?").bind(params.costoId).run();
    return json({ ok: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
