-- Catalogue commun des badges de mérite (récompenses).
-- Le modèle Achievement est commun à la plateforme (code unique global) et
-- aucun écran ne permettait d'en créer : toute attribution échouait (500).
-- Distinctions scolaires usuelles au Bénin ; idempotent (rejouable).
INSERT INTO "achievements" ("id", "code", "name", "description", "icon", "points", "category", "isActive") VALUES
  ('ach_default_felicitations',   'FELICITATIONS',   'Félicitations',          'Félicitations du conseil de classe.',                        'trophy',  60, 'Résultats',    true),
  ('ach_default_tableau_honneur', 'TABLEAU_HONNEUR', 'Tableau d''honneur',      'Inscription au tableau d''honneur par le conseil de classe.', 'trophy',  50, 'Résultats',    true),
  ('ach_default_encouragements',  'ENCOURAGEMENTS',  'Encouragements',         'Encouragements du conseil de classe.',                       'success', 30, 'Résultats',    true),
  ('ach_default_progres',         'PROGRES',         'Progrès remarquable',    'Nette progression de la moyenne d''une période à l''autre.', 'arrowUp', 40, 'Résultats',    true),
  ('ach_default_assiduite',       'ASSIDUITE',       'Assiduité exemplaire',   'Aucune absence injustifiée sur la période.',                 'check',   30, 'Assiduité',    true),
  ('ach_default_travail_soigne',  'TRAVAIL_SOIGNE',  'Travail soigné',         'Devoirs rendus à temps et soignés.',                         'pencil',  20, 'Travail',      true),
  ('ach_default_participation',   'PARTICIPATION',   'Participation active',   'Participation remarquable en classe.',                       'sparkle', 20, 'Travail',      true),
  ('ach_default_entraide',        'ENTRAIDE',        'Esprit d''entraide',      'Aide régulièrement ses camarades.',                          'users',   25, 'Comportement', true),
  ('ach_default_civisme',         'CIVISME',         'Civisme',                'Respect exemplaire du règlement et des autres.',             'success', 25, 'Comportement', true),
  ('ach_default_lecteur',         'LECTEUR',         'Lecteur assidu',         'Emprunts réguliers à la bibliothèque.',                      'book',    15, 'Culture',      true)
ON CONFLICT ("code") DO NOTHING;
