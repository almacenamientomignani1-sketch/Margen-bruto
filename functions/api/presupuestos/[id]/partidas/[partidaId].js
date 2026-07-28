import { json } from "../../../../_utils.js";

// PUT /api/presupuestos/:id/partidas/:partidaId
// body: cualquier subconjunto de { cultivo, superficie_ha, rendimiento_qq_ha, precio_symbol, precio_congelado, orden }
export async function onRequestPut({ request, env, params }) {
  if (!env.DB) return json({ error: "Falta el binding DB" }, 500);
  const partidaId = params.partidaId;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Body inválido" }, 400);
  }

  const allowed = ["cultivo", "superficie_ha", "rendimiento_qq_ha", "precio_symbol", "precio_congelado", "orden"];
  const fields = [];
  const values = [];

  for (const key of allowed) {
    if (body[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(body[key]);
    }
  }
  if (body.precio_symbol !== undefined) {
    fields.push("precio_fecha = ?");
    values.push(new Date().toISOString());
  }

  if (fields.length === 0) return json({ error: "Nada para actualizar" }, 400);

  values.push(partidaId);
  try {
    await env.DB.prepare(`UPDATE presupuesto_partidas SET ${fields.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();
    return json({ ok: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

// DELETE /api/presupuestos/:id/partidas/:partidaId
export async function onRequestDelete({ env, params }) {
  if (!env.DB) return json({ error: "Falta el binding DB" }, 500);
  try {
    await env.DB.prepare("DELETE FROM presupuesto_partidas WHERE id = ?").bind(params.partidaId).run();
    return json({ ok: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
