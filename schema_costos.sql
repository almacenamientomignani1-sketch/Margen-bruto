CREATE TABLE IF NOT EXISTS presupuesto_costos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  presupuesto_id INTEGER NOT NULL REFERENCES presupuestos(id),
  seccion TEXT NOT NULL,
  nombre TEXT NOT NULL,
  unidad TEXT NOT NULL DEFAULT 'pesos_ha',
  dosis REAL,
  pasadas REAL NOT NULL DEFAULT 1,
  importe REAL NOT NULL DEFAULT 0,
  moneda TEXT NOT NULL DEFAULT 'ARS',
  orden INTEGER NOT NULL DEFAULT 0,
  creado TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_costos_presupuesto ON presupuesto_costos (presupuesto_id);
