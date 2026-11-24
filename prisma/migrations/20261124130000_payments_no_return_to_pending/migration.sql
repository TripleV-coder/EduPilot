-- FIN-03 / FIN-06 (2026-11-24) : un paiement ne revient jamais « en attente ».
-- Garde-fou en base, quelle que soit la route : un retour à PENDING recréerait
-- une réservation et effacerait silencieusement un encaissement ou une annulation.
CREATE OR REPLACE FUNCTION payments_no_return_to_pending() RETURNS trigger AS $$
BEGIN
  IF OLD."status" <> 'PENDING' AND NEW."status" = 'PENDING' THEN
    RAISE EXCEPTION 'Paiement % : retour au statut PENDING interdit (depuis %)', OLD."id", OLD."status"
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payments_no_return_to_pending ON "payments";
CREATE TRIGGER payments_no_return_to_pending
  BEFORE UPDATE OF "status" ON "payments"
  FOR EACH ROW EXECUTE FUNCTION payments_no_return_to_pending();
