-- Esquema de la base de datos D1 para el historial de cotizaciones.
-- Se corre UNA sola vez (ver README) contra la base ya creada y bindeada como DB.

CREATE TABLE IF NOT EXISTS cotizaciones_historial (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL,              -- 'dolar' | 'grano'
  simbolo TEXT NOT NULL,           -- ej. 'blue', 'mayorista', 'SOJ.ROS/NOV26'
  etiqueta TEXT,                   -- ej. 'último operado hoy', 'ajuste', 'cierre anterior'
  precio REAL,                     -- valor principal mostrado en la card
  compra REAL,
  venta REAL,
  fecha_hora TEXT NOT NULL         -- ISO 8601, ej. '2026-07-27T14:32:00.000Z'
);

CREATE INDEX IF NOT EXISTS idx_historial_simbolo_fecha
  ON cotizaciones_historial (simbolo, fecha_hora);

CREATE INDEX IF NOT EXISTS idx_historial_tipo_fecha
  ON cotizaciones_historial (tipo, fecha_hora);
