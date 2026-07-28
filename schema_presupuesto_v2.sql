ALTER TABLE presupuestos ADD COLUMN soja_ref_modo TEXT NOT NULL DEFAULT 'auto';
ALTER TABLE presupuestos ADD COLUMN soja_ref_manual REAL;
ALTER TABLE presupuestos ADD COLUMN soja_dispo_modo TEXT NOT NULL DEFAULT 'auto';
ALTER TABLE presupuestos ADD COLUMN soja_dispo_manual REAL;
ALTER TABLE presupuestos ADD COLUMN unidad TEXT NOT NULL DEFAULT 'ton';
ALTER TABLE presupuesto_partidas ADD COLUMN precio_modo TEXT NOT NULL DEFAULT 'auto';
ALTER TABLE presupuesto_partidas ADD COLUMN precio_manual REAL;
