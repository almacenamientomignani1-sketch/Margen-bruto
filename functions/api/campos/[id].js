import { json } from "../../_utils.js";

// PUT /api/campos/:id  { nombre?, hectareas? }
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
  if (body.hectareas !== undefined) {
    fields.push("hectareas = ?");
    values.push(body.hectareas);
  }
  if (fields.length === 0) return json({ error: "Nada para actualizar" }, 400);

  values.push(params.id);
  try {
    await env.DB.prepare(`UPDATE campos SET ${fields.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();
    return json({ ok: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
