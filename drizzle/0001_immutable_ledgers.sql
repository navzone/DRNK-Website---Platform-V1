-- Ledgers and audit events are append-only. Corrections must be reversal/adjustment rows.
CREATE OR REPLACE FUNCTION drnk_block_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'table % is append-only', TG_TABLE_NAME USING ERRCODE = 'integrity_constraint_violation';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER points_ledger_immutable BEFORE UPDATE OR DELETE ON points_ledger
  FOR EACH ROW EXECUTE FUNCTION drnk_block_mutation();
--> statement-breakpoint
CREATE TRIGGER alcometer_ledger_immutable BEFORE UPDATE OR DELETE ON alcometer_ledger
  FOR EACH ROW EXECUTE FUNCTION drnk_block_mutation();
--> statement-breakpoint
CREATE TRIGGER audit_events_immutable BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION drnk_block_mutation();
