# Registre des décisions du propriétaire

> Décisions prises par le propriétaire du produit au fil des sessions de travail, jusqu'ici
> conservées seulement dans la mémoire de l'assistant. Copiées ici le 2026-11-24 pour que
> l'équipe et tout agent les trouvent dans le dépôt.
>
> Règle : une décision listée ici **ne se rediscute pas** sans l'accord du propriétaire. Quand une
> décision a un document plus détaillé (ADR, guide, spécification), ce registre y renvoie. Les
> décisions **encore ouvertes** sont regroupées au §9.

## 1. Invariants (non négociables)

| Date | Décision | Pourquoi | Où c'est appliqué |
|---|---|---|---|
| 2026-10-17 | **Souveraineté de chaque école.** Aucune donnée ni aucun flux financier ne se mélange entre écoles, **SUPER_ADMIN compris**. Tout accès entre écoles légitime est explicite, autorisé et tracé. Contrôles côté serveur, doublés en base (transactions, triggers, RLS) quand c'est nécessaire | Plateforme multi-écoles : chaque école reste maîtresse de ses données et de son argent | `createApiHandler`, RLS (ADR-0010), garde-fous en base des paiements et échéanciers, balayage `tenant-isolation-sweep.test.ts`. Ne jamais écrire `role !== "SUPER_ADMIN" && …` devant un contrôle d'intégrité entre écoles |
| 2026-10-18 | **Compte marchand par école.** Les frais d'une école arrivent sur **son** compte FedaPay, jamais sur un compte global ; les clés d'une école ne sont jamais accessibles à une autre ; un webhook vérifie le compte et l'école attendus | Idem, et responsabilité juridique des fonds | ADR-0011, `SchoolPaymentAccount` |
| 2026-01 → | **Zéro donnée factice.** Vraies données, vrais libellés en français, vraies API, aucun texte de remplissage ni « TODO ». Si une API manque, on la construit | Qualité de production, pas de nettoyage après coup | Tout le frontend ; les façades trompeuses ont été retirées (lots du 2026-11-05) |

## 2. Façon de travailler

| Date | Décision |
|---|---|
| 2026-10-02 | **Documentation pour les utilisateurs** dans `docs/guide-utilisateur/`, en langage courant, sans terme technique (ni code, ni nom de route ou de table), avec un statut ✅ en place / 🔧 en cours. Toute règle nouvelle ou corrigée y est reportée dans le même lot |
| 2026-10-03 | **Avant de trancher une règle métier sensible** : poser d'abord une liste de questions précises, groupées, et ne rien coder avant les réponses. Une fois les réponses données, les appliquer sans redemander |
| 2026-11-24 | Sur une mission en plusieurs phases, **enchaîner sans attendre d'accord**. S'arrêter seulement pour une action irréversible ou extérieure : pousser, déployer, toucher la production ou une base réelle |
| 2026-11-05 | **Git** : un commit par lot thématique, poussé en fin de travail. **Suppressions prudentes** : désactiver ou archiver plutôt qu'effacer |
| 2026-10 | **Dire l'état réel, sans arrangement** : ne jamais modifier un test pour masquer un défaut. Seuls les sélecteurs faux se corrigent dans un test |
| 2026-11-07 | **Retirer les dépendances évitables** si ce n'est pas au prix de l'efficacité : Redis, bcryptjs, nanoid, react-to-print, otplib et le SDK FedaPay ont été remplacés. `dompurify` est gardé, car le nettoyeur maison serait trop faible |

## 3. Interface

| Date | Décision | Détail |
|---|---|---|
| 2026-09-25 | **Direction visuelle « colorée et vivante, priorité à la vue d'ensemble »**, inspirée de **Google Classroom** et Notion/Linear. Les pistes néo-brutaliste et « Data Humanism » ont été rejetées (« fait trop IA, pas edtech ») | `docs/design/directions/direction-approved.md`, `DESIGN.md` |
| 2026-09-25 | Les captures de `docs/design/directions/live/` sont la **référence trait pour trait**, sur **toutes** les pages : bandeaux de classe colorés, listes « Personnes » (avatar coloré, nom, détail, menu ⋮), blocs « Vue d'ensemble » à pastilles, actions secondaires dans un menu ⋮. Ne jamais retirer ce dossier | Réutiliser `edu-homes/home-kit.tsx` |
| 2026-11-05 | Texte d'au moins **12 px** partout (hors PDF) ; **sonner** seul pour les notifications à l'écran ; **framer-motion retiré** (animations en CSS) | — |
| 2026-06 | Animations : classes Tailwind `animate-spin` / `animate-bounce`, ou les keyframes EduFlow (`eduflowSpin`). Jamais `animation: "spin …"` en ligne, qui n'anime rien | `src/styles/edupilot-tokens.css` |

## 4. Structure scolaire

| Date | Décision |
|---|---|
| 2026-09-25 | **Primaire et secondaire sont deux sous-secteurs étanches**, jamais mélangés : matières, évaluations, notation, périodes, bulletins, tableaux de bord. Le secondaire = premier cycle (6e–3e) + second cycle (2nde–Tle, matières propres à chaque série). Système béninois d'abord |
| 2026-09-25 | Architecture visée : organisation → site → espace. Un espace = une école d'un seul sous-secteur. **Seul le chef d'organisation (`NETWORK_ADMIN`) voit plusieurs sites** ; enseignants et parents multi-sites ne voient que leurs classes ou leurs enfants. Pas de rôle « coordonnateur de réseau » |
| 2026-09-25 | **Primaire : une simple note sur 20 par matière** (la grille APC reste sur la copie) ; coefficients à 1 par défaut, modifiables |
| 2026-06-15 | **Cycles offerts réglables par école** (primaire, collège, lycée), avec une navigation et des contrôles serveur qui masquent les cycles non offerts (`src/lib/benin/levels.ts`) |
| 2026-07-02 | **Rôles** : `NETWORK_ADMIN` = SCHOOL_ADMIN de plusieurs écoles, jamais de portée globale (`roleSatisfies` aux points de contrôle). SUPER_ADMIN est à terme réduit au rôle d'opérateur de la plateforme (tranche B), avec un mode assistance audité (tranche C) |
| 2026-10-24 | **Cumul de rôles** : les contrôles d'accès portent sur le **rôle principal** seulement |
| 2026-07-21 | Après une promotion, l'inscription de départ passe au statut **`COMPLETED`** : un élève n'a jamais deux inscriptions actives |

## 5. Notes et moyennes

| Date | Décision |
|---|---|
| 2026-10-01 | **Moteur de moyennes unique** (`src/lib/academic/average-engine.ts`) : formule officielle béninoise (MI + D1 + D2) ÷ 3, calcul exact, **arrondi unique au centième**. Rang, mention et décision se fondent sur la moyenne **affichée** |
| 2026-10-01 | Absence non justifiée = **0** ; note manquante = « **à justifier** » (jamais un 0 silencieux) ; moyenne annuelle = (S1 + S2) ÷ 2 ou (T1 + T2 + T3) ÷ 3 |
| 2026-10-02 | **Règles configurables par école** : formule (y compris formule libre, par école et par enseignant pour sa matière), décisions du conseil, passage, orientation. Choix encadrés, défauts officiels du Bénin, figés au conseil, changements tracés. Les compétences ne comptent pas dans la moyenne |
| 2026-10-03 | **Tout seuil ou délai** (risque, alertes, relances…) est réglable par l'école (`school-parameters.ts`). Le risque officiel est unique (`assessRisk`) |

## 6. Argent

| Date | Décision |
|---|---|
| 2026-10-14 | **Paiement en ligne** : un essai reste réservé tant que son issue n'est pas établie ; 24 h déclenchent l'interrogation du fournisseur, pas une expiration ; en cas de doute, réconciliation obligatoire ; ne jamais confondre expiration et échec ; une confirmation tardive authentique est acceptée ; pas de blocage indéfini des familles. Détail : `EDUPILOT_FINANCIAL_RELIABILITY.md` |
| 2026-11-02 | **Remboursement = écriture d'extourne** (ligne négative liée au paiement), plafonnée au montant payé. L'argent d'un paiement en ligne est rendu depuis l'espace FedaPay de l'école, puis tracé dans EduPilot |
| 2026-09-19 | **Avis de paiement** sans modèle de facture : calculés à la demande (TD-017). **Clôture d'année** : une année clôturée refuse les écritures de notes, d'évaluations et de présences (TD-018) |
| 2026-11-24 | **Bourses** : 1) les frais visés sont choisis **par l'école**, bourse par bourse (par défaut, tous les frais obligatoires) ; 2) une bourse vaut pour **l'année entière**, sans prorata ; 3) sur un échéancier en cours, la réduction s'applique **en partant de la dernière échéance** ; 4) un trop-perçu est **remboursé**, après une alerte à la comptabilité. Détail : `EDUPILOT_FINANCIAL_RELIABILITY.md` §3 |
| 2026-11-24 | **Un paiement en ligne n'est jamais validé à la main** ; aucun paiement ne revient « en attente ». L'annulation manuelle reste possible, et une confirmation tardive authentique revalide alors le paiement |
| 2026-07-04 | Le **versement d'une paie** ne génère pas d'écriture de règlement comptable (hors périmètre) |
| 2026-11-24 | **La scolarité relève du service de comptabilité** : chaque encaissement de frais est passé automatiquement au journal (comptes SYSCOHADA par défaut 70100, 57100, 52100, 52200) |
| 2026-06-28 | **Paiements MoMo et FedaPay** branchés en réel ; **lien parent–enfant vérifié** par un code à usage unique (14 jours par défaut, réglable) ; **Alumni** et **contrôle d'accès** (points de scan, badges) en modèles réels |

## 7. Communication, IA, données

| Date | Décision | Référence |
|---|---|---|
| 2026-11-07 | **IA 100 % locale** : aucun modèle externe, ni n8n ni Ollama hébergé par le propriétaire. Les services gratuits externes (Groq) sont écartés faute d'autorisation de transfert hors du Bénin (APDP, art. 391 du Code du numérique) | ADR-0012 |
| 2026-11-14 | **WhatsApp (API Meta) en canal principal**, SMS en secours | ADR-0014 |
| 2026-10 | **Annonces** : notifications dans l'application seulement, aucune promesse d'e-mail | — |
| 2026-11-05 | **Parents** : notifications web (push) et « rester connecté » 30 jours (24 h d'inactivité, jamais pour SUPER_ADMIN). **Portefeuille** = comptes déclarés + soldes des paiements validés. **Benchmark national** retiré | — |
| 2026-07-04 | **Vitrine publique** sans formulaire de contact (liens e-mail et téléphone directs). **Signature électronique** en session, sans OTP pour les parents non connectés | — |
| 2026-11-07 | `.env` réduit au strict minimum ; les intégrations (e-mail, paiements, WhatsApp) se règlent dans la console root ; état partagé dans PostgreSQL (pas de Redis) | ADR-0013 |
| 2026-10 | Coût bcrypt **12** : choix de sécurité assumé malgré le coût CPU à la connexion | — |

## 8. Périmètre écarté

| Date | Écarté | Pourquoi |
|---|---|---|
| 2026-07-04 | Multi-pays et multi-devises (différé) ; job board ; application mobile native (la PWA suffit) | Faible valeur pour une école béninoise aujourd'hui |
| 2026-11-24 | Concurrencer EducMaster | On s'y **raccorde** (matricule EducMaster, exports au gabarit officiel), on ne le remplace pas |
| 2026-11-24 | S'aligner sur 500 F par élève et par an | Positionnement sur la fiabilité et le résultat (`EDUPILOT_PRODUCT_STRATEGY.md`) |

## 9. Décisions encore ouvertes (à trancher par le propriétaire)

- Un `NETWORK_ADMIN` peut-il **encaisser** dans les écoles de son réseau ?
- Périmètre exact du rôle **STAFF** ; la comptabilité voit-elle les incidents ?
- Un **parent avec des enfants dans deux établissements** (session limitée à une école) : choix d'architecture.
- Appel **par créneau** ; connexion par téléphone ou SMS ; transferts entre sites ; passage CM2 → 6e ;
  règles DS1/DS2 ; **bulletin retenu si impayé**.
- Moyenne annuelle (S1 + 2·S2) ÷ 3 si une école l'applique (convention à confirmer).
- **Grille tarifaire publique** et essai gratuit (`EDUPILOT_PRODUCT_STRATEGY.md` §4).
- Le parent doit-il pouvoir **choisir une tranche** précise (aujourd'hui : imputation chronologique, Q-FIN-02) ?
