-- Esquema del módulo de Presupuesto Agrícola.
-- Se corre UNA vez en la Console de D1, igual que schema.sql.

CREATE TABLE IF NOT EXISTS campos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS presupuestos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campo_id INTEGER NOT NULL REFERENCES campos(id),
  campania TEXT NOT NULL,                 -- ej. '25-26'
  arrendamiento_qq_ha REAL NOT NULL DEFAULT 10,
  soja_ref_symbol TEXT,                   -- símbolo elegido como "Soja May" de referencia
  soja_ref_precio REAL,                   -- precio USD/ton congelado al elegirlo
  soja_ref_fecha TEXT,                    -- cuándo se congeló (ISO 8601)
  creado TEXT NOT NULL,
  UNIQUE(campo_id, campania)
);

CREATE TABLE IF NOT EXISTS presupuesto_partidas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  presupuesto_id INTEGER NOT NULL REFERENCES presupuestos(id),
  cultivo TEXT NOT NULL,                  -- 'Soja 1°', 'Maíz 1°', 'Trigo', etc.
  es_soja INTEGER NOT NULL DEFAULT 0,     -- 1 = el precio copia soja_ref del presupuesto
  orden INTEGER NOT NULL DEFAULT 0,
  superficie_ha REAL,
  rendimiento_qq_ha REAL,
  precio_symbol TEXT,                     -- símbolo elegido (si no es soja)
  precio_congelado REAL,                  -- USD/ton congelado al elegirlo
  precio_fecha TEXT
);

CREATE INDEX IF NOT EXISTS idx_presupuestos_campo ON presupuestos (campo_id);
CREATE INDEX IF NOT EXISTS idx_partidas_presupuesto ON presupuesto_partidas (presupuesto_id);
