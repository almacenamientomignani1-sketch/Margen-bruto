import { json } from "../../_utils.js";

const ALLOWED = ["nombre", "unidad", "cantidad", "precio_unitario", "moneda", "proveedor", "fecha", "nota", "orden"];

// PUT /api/ejecucion-compras/:id
export async function onRequestPut({ request, env, params }) {
  if (!env.DB) return json({ error: "Falta el binding DB" }, 500);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Body inválido" }, 400);
  }

  const fields = [];
  const values = [];
  for (const key of ALLOWED) {
    if (body[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(body[key]);
    }
  }
  if (fields.length === 0) return json({ error: "Nada para actualizar" }, 400);

  values.push(params.id);
  try {
    await env.DB.prepare(`UPDATE ejecucion_compras SET ${fields.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();
    return json({ ok: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

// DELETE /api/ejecucion-compras/:id
export async function onRequestDelete({ env, params }) {
  if (!env.DB) return json({ error: "Falta el binding DB" }, 500);
  try {
    await env.DB.prepare("DELETE FROM ejecucion_compras WHERE id = ?").bind(params.id).run();
    return json({ ok: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
