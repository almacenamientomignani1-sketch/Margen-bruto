CREATE TABLE IF NOT EXISTS ejecucion_categorias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  presupuesto_id INTEGER NOT NULL REFERENCES presupuestos(id),
  seccion TEXT NOT NULL,
  nombre TEXT NOT NULL,
  orden INTEGER NOT NULL DEFAULT 0,
  creado TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ejecucion_categorias_presupuesto ON ejecucion_categorias (presupuesto_id);

CREATE TABLE IF NOT EXISTS ejecucion_compras (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  categoria_id INTEGER NOT NULL REFERENCES ejecucion_categorias(id),
  nombre TEXT NOT NULL,
  unidad TEXT,
  cantidad REAL,
  precio_unitario REAL,
  moneda TEXT NOT NULL DEFAULT 'ARS',
  proveedor TEXT,
  fecha TEXT,
  nota TEXT,
  orden INTEGER NOT NULL DEFAULT 0,
  creado TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ejecucion_compras_categoria ON ejecucion_compras (categoria_id);
