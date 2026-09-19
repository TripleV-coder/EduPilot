-- Lot 6 (minimisation) : le catalogue des modules réglables s'étend.
--
-- Bibliothèque, récompenses, orientation, événements et clubs, rendez-vous,
-- documents et attestations, bien-être, comparaison entre établissements,
-- notifications vocales : ces fonctions étaient jusqu'ici TOUJOURS actives,
-- sans moyen de les éteindre. Elles deviennent réglables par l'école.
--
-- Les écoles existantes les gardent actives : elles s'en servent peut-être
-- déjà, et une migration ne retire jamais d'elle-même un accès en service.
-- Une nouvelle école ne reçoit que le socle (défaut de la colonne) et active
-- ce dont elle a besoin.
--
-- La garde `@>` limite l'écriture aux écoles qui n'ont encore aucun de ces
-- identifiants — ce qui est le cas de toutes, puisqu'ils n'existaient pas.

UPDATE "schools"
SET "enabledModules" = ARRAY(
  SELECT DISTINCT unnest(
    "enabledModules" || ARRAY[
      'library','gamification','orientation','events','appointments',
      'documents','wellbeing','benchmark','voice-notifications'
    ]::TEXT[]
  )
)
WHERE NOT ("enabledModules" @> ARRAY[
  'library','gamification','orientation','events','appointments',
  'documents','wellbeing','benchmark','voice-notifications'
]::TEXT[]);
