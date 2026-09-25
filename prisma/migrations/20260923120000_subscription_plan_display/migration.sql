-- Tarifs configurables par le super-administrateur : la page publique lit
-- désormais les plans en base. Deux réglages d'affichage manquaient :
--   isFeatured     : plan mis en avant (« le plus choisi ») ;
--   priceOnRequest : prix non publié, la landing affiche « Sur devis ».
-- Défauts neutres, aucun UPDATE : rejouable sans effet.

ALTER TABLE "subscription_plans"
  ADD COLUMN IF NOT EXISTS "isFeatured" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "priceOnRequest" BOOLEAN NOT NULL DEFAULT false;
