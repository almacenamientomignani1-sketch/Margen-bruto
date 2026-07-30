import { json } from "../../_utils.js";

// GET /api/ejecucion-compras?presupuesto_id=1 -> { compras: [...] }  (todas las compras de todas las categorías de ese presupuesto)
// GET /api/ejecucion-compras?categoria_id=5 -> { compras: [...] }    (solo de esa categoría)
export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: "Falta el binding DB" }, 500);
  const url = new URL(request.url);
  const presupuestoId = url.searchParams.get("presupuesto_id");
  const categoriaId = url.searchParams.get("categoria_id");

  try {
    let stmt;
    if (categoriaId) {
      stmt = env.DB.prepare(`SELECT * FROM ejecucion_compras WHERE categoria_id = ? ORDER BY orden, id`).bind(
        categoriaId
      );
    } else if (presupuestoId) {
      stmt = env.DB.prepare(
        `SELECT ec.* FROM ejecucion_compras ec
         JOIN ejecucion_categorias cat ON cat.id = ec.categoria_id
         WHERE cat.presupuesto_id = ?
         ORDER BY ec.orden, ec.id`
      ).bind(presupuestoId);
    } else {
      return json({ error: "Falta presupuesto_id o categoria_id" }, 400);
    }
    const { results } = await stmt.all();
    return json({ compras: results });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

// POST /api/ejecucion-compras
// body: { categoria_id, nombre, unidad?, cantidad?, precio_unitario?, moneda?, proveedor?, fecha?, nota?, orden? }
export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: "Falta el binding DB" }, 500);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Body inválido" }, 400);
  }

  const { categoria_id, nombre } = body || {};
  if (!categoria_id || !nombre?.trim()) return json({ error: "Faltan categoria_id o nombre" }, 400);

  const creado = new Date().toISOString();
  try {
    const res = await env.DB.prepare(
      `INSERT INTO ejecucion_compras
        (categoria_id, nombre, unidad, cantidad, precio_unitario, moneda, proveedor, fecha, nota, orden, creado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        categoria_id,
        nombre.trim(),
        body.unidad ?? "Unidades",
        body.cantidad ?? 0,
        body.precio_unitario ?? 0,
        body.moneda ?? "ARS",
        body.proveedor ?? null,
        body.fecha ?? null,
        body.nota ?? null,
        body.orden ?? 0,
        creado
      )
      .run();
    return json({ id: res.meta.last_row_id });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
