import { json } from "../../_utils.js";

// PUT /api/ejecucion-categorias/:id  { nombre?, orden? }
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
  if (body.nombre !== undefined) {
    fields.push("nombre = ?");
    values.push(body.nombre);
  }
  if (body.orden !== undefined) {
    fields.push("orden = ?");
    values.push(body.orden);
  }
  if (fields.length === 0) return json({ error: "Nada para actualizar" }, 400);

  values.push(params.id);
  try {
    await env.DB.prepare(`UPDATE ejecucion_categorias SET ${fields.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();
    return json({ ok: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

// DELETE /api/ejecucion-categorias/:id  (borra también sus compras)
export async function onRequestDelete({ env, params }) {
  if (!env.DB) return json({ error: "Falta el binding DB" }, 500);
  try {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM ejecucion_compras WHERE categoria_id = ?").bind(params.id),
      env.DB.prepare("DELETE FROM ejecucion_categorias WHERE id = ?").bind(params.id),
    ]);
    return json({ ok: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
