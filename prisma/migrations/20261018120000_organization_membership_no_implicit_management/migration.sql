-- Organisations (lot S5) : le droit de gestion d'une organisation n'est plus
-- accordé implicitement. Une adhésion créée sans valeur explicite — y compris
-- par un chemin futur ou une écriture SQL directe — est désormais un membre
-- simple. Seule la valeur par défaut change : les adhésions existantes ne
-- sont pas modifiées.
ALTER TABLE "organization_memberships" ALTER COLUMN "canManageSites" SET DEFAULT false;
