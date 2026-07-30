import { json } from "../../_utils.js";

// GET /api/campos -> { campos: [{id, nombre, hectareas}] }
export async function onRequestGet({ env }) {
  if (!env.DB) return json({ error: "Falta el binding DB" }, 500);
  try {
    const { results } = await env.DB.prepare("SELECT id, nombre, hectareas FROM campos ORDER BY nombre").all();
    return json({ campos: results });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

// POST /api/campos  { nombre, hectareas? } -> { id, nombre, hectareas }
export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: "Falta el binding DB" }, 500);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Body inválido" }, 400);
  }
  const nombre = (body?.nombre || "").trim();
  if (!nombre) return json({ error: "Falta el nombre del campo" }, 400);
  const hectareas = body?.hectareas ?? null;

  try {
    const res = await env.DB.prepare("INSERT INTO campos (nombre, hectareas) VALUES (?, ?)").bind(nombre, hectareas).run();
    return json({ id: res.meta.last_row_id, nombre, hectareas });
  } catch (e) {
    return json({ error: "No se pudo crear (¿nombre repetido?): " + e.message }, 500);
  }
}
