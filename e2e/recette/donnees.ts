/**
 * Jeu de données de la recette filmée : un réseau scolaire béninois fictif,
 * créé de zéro par l'interface. Aucune donnée réelle.
 */
export const DOMAIN = "recette.edupilot.test";
export const mail = (who: string) => `${who}@${DOMAIN}`;

/** Mot de passe choisi par chaque compte à sa première connexion (politique forte). */
export const pwd = (who: string) => `Recette!2026-${who}`;

export const ROOT = { firstName: "Aïcha", lastName: "Houénou", email: mail("root"), password: pwd("root") };

/**
 * Établissements déployés par la console root : une configuration par cas.
 * - Réseau Les Cocotiers : organisation multi-sites (collège + annexe primaire),
 *   chacun avec sa direction ; le chef d'organisation voit les deux.
 * - Lycée technique public, primaire confessionnel, groupe mixte international.
 */
export type Ecole = {
    key: string;
    name: string;
    type: "Public" | "Privé" | "Religieux (Confessionnel)" | "International";
    niveau: "Primaire" | "Secondaire (Collège)" | "Secondaire (Lycée)" | "Mixte";
    city: string;
    phone: string;
    address: string;
    email: string;
    organisation?: { mode: "nouvelle"; name: string; description: string } | { mode: "existante"; name: string };
    annexeDe?: string;
    /** Formule attribuée par la plateforme (quotas d'élèves et d'enseignants). */
    formule: "Essentiel" | "Professionnel" | "Réseau";
    admin: { key: string; firstName: string; lastName: string };
};

export const ECOLES: Ecole[] = [
    {
        key: "cocotiers",
        name: "Complexe Scolaire Les Cocotiers",
        type: "Privé",
        niveau: "Secondaire (Collège)",
        city: "Cotonou",
        phone: "+229 21 30 40 50",
        address: "Lot 214, quartier Haie Vive, Cotonou",
        email: "contact@cocotiers.recette.edupilot.test",
        organisation: { mode: "nouvelle", name: "Réseau Les Cocotiers", description: "Réseau privé : collège-lycée de Cotonou et école primaire d'Abomey-Calavi." },
        formule: "Réseau",
        admin: { key: "admin-cocotiers", firstName: "Rodrigue", lastName: "Agossou" },
    },
    {
        key: "cocotiers-primaire",
        name: "Les Cocotiers — Annexe Primaire Calavi",
        type: "Privé",
        niveau: "Primaire",
        city: "Abomey-Calavi",
        phone: "+229 21 36 00 11",
        address: "Carrefour Kpota, Abomey-Calavi",
        email: "primaire@cocotiers.recette.edupilot.test",
        organisation: { mode: "existante", name: "Réseau Les Cocotiers" },
        annexeDe: "Complexe Scolaire Les Cocotiers",
        formule: "Réseau",
        admin: { key: "admin-cocotiers-primaire", firstName: "Mireille", lastName: "Dossa" },
    },
    {
        key: "lycee-technique",
        name: "Lycée Technique Coulibaly",
        type: "Public",
        niveau: "Secondaire (Lycée)",
        city: "Cotonou",
        phone: "+229 21 31 22 33",
        address: "Avenue Steinmetz, Cotonou",
        email: "contact@ltc.recette.edupilot.test",
        formule: "Professionnel",
        admin: { key: "admin-lycee", firstName: "Sylvain", lastName: "Kpadonou" },
    },
    {
        key: "rosee",
        name: "École Primaire Catholique La Rosée",
        type: "Religieux (Confessionnel)",
        niveau: "Primaire",
        city: "Porto-Novo",
        phone: "+229 20 21 45 67",
        address: "Quartier Ouando, Porto-Novo",
        email: "contact@rosee.recette.edupilot.test",
        formule: "Essentiel",
        admin: { key: "admin-rosee", firstName: "Sœur Bernadette", lastName: "Ahouandjinou" },
    },
    {
        key: "saint-joseph",
        name: "Groupe Scolaire International Saint-Joseph",
        type: "International",
        niveau: "Mixte",
        city: "Parakou",
        phone: "+229 23 61 00 99",
        address: "Route de l'aéroport, Parakou",
        email: "contact@gsisj.recette.edupilot.test",
        formule: "Professionnel",
        admin: { key: "admin-saint-joseph", firstName: "Fulbert", lastName: "Sossa" },
    },
];

export const ANNEE = "2026-2027";
export const ANNEE_SUIVANTE = "2027-2028";

// ─── Référentiel académique par établissement (système béninois) ────────────

export type Niveau = { name: string; code: string; cycle: "Primaire" | "Collège" | "Lycée"; sequence: number };
export type Matiere = { name: string; code: string; categorie: string; coef: number };
export type Config = {
    cycles: ("Primaire" | "Collège" | "Lycée")[];
    /** Modules activés en plus des indispensables ; "tous" = tout le catalogue. */
    modules: "tous" | string[];
    couleur: "Bleu" | "Vert" | "Ambre" | "Rouge" | "Indigo";
    devise: string;
    codeMemp: string;
    region: string;
    categories: { name: string; code: string; couleur: string }[];
    matieres: Matiere[];
    typesEvaluation: { name: string; code: string; coef: number; max?: number }[];
    niveaux: Niveau[];
    salles: { name: string; capacite: number; batiment: string; equipements: string }[];
};

const NIVEAUX_PRIMAIRE: Niveau[] = [
    { name: "Cours d'Initiation", code: "CI", cycle: "Primaire", sequence: 1 },
    { name: "Cours Préparatoire", code: "CP", cycle: "Primaire", sequence: 2 },
    { name: "Cours Élémentaire 1", code: "CE1", cycle: "Primaire", sequence: 3 },
    { name: "Cours Élémentaire 2", code: "CE2", cycle: "Primaire", sequence: 4 },
    { name: "Cours Moyen 1", code: "CM1", cycle: "Primaire", sequence: 5 },
    { name: "Cours Moyen 2", code: "CM2", cycle: "Primaire", sequence: 6 },
];
const NIVEAUX_COLLEGE: Niveau[] = [
    { name: "Sixième", code: "6EME", cycle: "Collège", sequence: 7 },
    { name: "Cinquième", code: "5EME", cycle: "Collège", sequence: 8 },
    { name: "Quatrième", code: "4EME", cycle: "Collège", sequence: 9 },
    { name: "Troisième", code: "3EME", cycle: "Collège", sequence: 10 },
];
const NIVEAUX_LYCEE: Niveau[] = [
    { name: "Seconde", code: "2NDE", cycle: "Lycée", sequence: 11 },
    { name: "Première", code: "1ERE", cycle: "Lycée", sequence: 12 },
    { name: "Terminale", code: "TLE", cycle: "Lycée", sequence: 13 },
];

const CATEGORIES_SECONDAIRE = [
    { name: "Sciences", code: "SCI", couleur: "#2563EB" },
    { name: "Lettres et langues", code: "LET", couleur: "#9333EA" },
    { name: "Sciences humaines", code: "SHS", couleur: "#D97706" },
    { name: "Éducation physique et arts", code: "EPA", couleur: "#16A34A" },
];
const MATIERES_SECONDAIRE: Matiere[] = [
    { name: "Mathématiques", code: "MATH", categorie: "Sciences", coef: 3 },
    { name: "Physique-Chimie et Technologie", code: "PCT", categorie: "Sciences", coef: 2 },
    { name: "Sciences de la Vie et de la Terre", code: "SVT", categorie: "Sciences", coef: 2 },
    { name: "Français", code: "FRA", categorie: "Lettres et langues", coef: 3 },
    { name: "Anglais", code: "ANG", categorie: "Lettres et langues", coef: 2 },
    { name: "Espagnol", code: "ESP", categorie: "Lettres et langues", coef: 1 },
    { name: "Histoire-Géographie", code: "HG", categorie: "Sciences humaines", coef: 2 },
    { name: "Philosophie", code: "PHILO", categorie: "Sciences humaines", coef: 2 },
    { name: "Éducation Physique et Sportive", code: "EPS", categorie: "Éducation physique et arts", coef: 1 },
];
const TYPES_SECONDAIRE = [
    { name: "Interrogation écrite", code: "INT", coef: 1 },
    { name: "Devoir surveillé", code: "DS", coef: 1, max: 2 },
    { name: "Composition", code: "COMPO", coef: 2, max: 1 },
];

const CATEGORIES_PRIMAIRE = [
    { name: "Français et langues", code: "LANG", couleur: "#9333EA" },
    { name: "Mathématiques et sciences", code: "MSC", couleur: "#2563EB" },
    { name: "Éveil et éducation", code: "EVE", couleur: "#16A34A" },
];
const MATIERES_PRIMAIRE: Matiere[] = [
    { name: "Français (communication écrite et orale)", code: "FR", categorie: "Français et langues", coef: 1 },
    { name: "Mathématiques", code: "MATHS", categorie: "Mathématiques et sciences", coef: 1 },
    { name: "Éducation Scientifique et Technologique", code: "EST", categorie: "Mathématiques et sciences", coef: 1 },
    { name: "Éducation Sociale", code: "ES", categorie: "Éveil et éducation", coef: 1 },
    { name: "Éducation Artistique", code: "EA", categorie: "Éveil et éducation", coef: 1 },
    { name: "Éducation Physique et Sportive", code: "EPS", categorie: "Éveil et éducation", coef: 1 },
];
const TYPES_PRIMAIRE = [{ name: "Évaluation sommative", code: "EVAL", coef: 1 }];

export const CONFIGS: Record<string, Config> = {
    cocotiers: {
        cycles: ["Collège", "Lycée"],
        modules: "tous",
        couleur: "Vert",
        devise: "Travail, Rigueur, Réussite",
        codeMemp: "BJ-COT-0214",
        region: "Littoral",
        categories: CATEGORIES_SECONDAIRE,
        matieres: MATIERES_SECONDAIRE,
        typesEvaluation: TYPES_SECONDAIRE,
        niveaux: [...NIVEAUX_COLLEGE, ...NIVEAUX_LYCEE],
        salles: [
            { name: "Salle 101", capacite: 50, batiment: "Bâtiment A", equipements: "Tableau, Ventilateurs" },
            { name: "Salle 102", capacite: 50, batiment: "Bâtiment A", equipements: "Tableau, Vidéoprojecteur" },
            { name: "Laboratoire de sciences", capacite: 30, batiment: "Bâtiment B", equipements: "Paillasses, Microscopes" },
            { name: "Salle informatique", capacite: 25, batiment: "Bâtiment B", equipements: "25 ordinateurs, Imprimante" },
        ],
    },
    "cocotiers-primaire": {
        cycles: ["Primaire"],
        modules: ["Notes et bulletins", "Appel et présences", "Emploi du temps", "Messagerie et annonces", "Finance et paiements", "Cantine", "Transport"],
        couleur: "Ambre",
        devise: "Apprendre en s'épanouissant",
        codeMemp: "BJ-ABC-0077",
        region: "Atlantique",
        categories: CATEGORIES_PRIMAIRE,
        matieres: MATIERES_PRIMAIRE,
        typesEvaluation: TYPES_PRIMAIRE,
        niveaux: NIVEAUX_PRIMAIRE,
        salles: [
            { name: "Classe CI", capacite: 40, batiment: "Bloc 1", equipements: "Tableau" },
            { name: "Classe CM2", capacite: 45, batiment: "Bloc 2", equipements: "Tableau, Armoire" },
        ],
    },
    "lycee-technique": {
        cycles: ["Lycée"],
        modules: ["Notes et bulletins", "Appel et présences", "Emploi du temps", "Messagerie et annonces", "Discipline", "Orientation"],
        couleur: "Indigo",
        devise: "La technique au service du développement",
        codeMemp: "BJ-COT-0001",
        region: "Littoral",
        categories: [...CATEGORIES_SECONDAIRE, { name: "Enseignement technique", code: "TECH", couleur: "#DC2626" }],
        matieres: [
            ...MATIERES_SECONDAIRE.filter((m) => m.code !== "ESP"),
            { name: "Dessin technique", code: "DT", categorie: "Enseignement technique", coef: 3 },
            { name: "Électrotechnique", code: "ELEC", categorie: "Enseignement technique", coef: 4 },
            { name: "Comptabilité générale", code: "COMPTA", categorie: "Enseignement technique", coef: 4 },
        ],
        typesEvaluation: TYPES_SECONDAIRE,
        niveaux: NIVEAUX_LYCEE,
        salles: [{ name: "Atelier électrotechnique", capacite: 24, batiment: "Ateliers", equipements: "Bancs d'essai, Oscilloscopes" }],
    },
    rosee: {
        cycles: ["Primaire"],
        modules: ["Notes et bulletins", "Appel et présences", "Messagerie et annonces", "Finance et paiements"],
        couleur: "Bleu",
        devise: "Foi, Savoir, Discipline",
        codeMemp: "BJ-PNO-0033",
        region: "Ouémé",
        categories: CATEGORIES_PRIMAIRE,
        matieres: MATIERES_PRIMAIRE,
        typesEvaluation: TYPES_PRIMAIRE,
        niveaux: NIVEAUX_PRIMAIRE,
        salles: [{ name: "Classe CE1", capacite: 45, batiment: "Bâtiment principal", equipements: "Tableau" }],
    },
    "saint-joseph": {
        cycles: ["Primaire", "Collège", "Lycée"],
        modules: "tous",
        couleur: "Rouge",
        devise: "Excellence sans frontières",
        codeMemp: "BJ-PKO-0101",
        region: "Borgou",
        categories: [...CATEGORIES_SECONDAIRE, ...CATEGORIES_PRIMAIRE],
        matieres: [...MATIERES_SECONDAIRE, ...MATIERES_PRIMAIRE.filter((m) => m.code !== "EPS" && m.code !== "MATHS")],
        typesEvaluation: [...TYPES_SECONDAIRE, ...TYPES_PRIMAIRE],
        niveaux: [...NIVEAUX_PRIMAIRE, ...NIVEAUX_COLLEGE, ...NIVEAUX_LYCEE],
        salles: [{ name: "Amphithéâtre", capacite: 120, batiment: "Pôle lycée", equipements: "Sonorisation, Vidéoprojecteur" }],
    },
};

// ─── Personnel ───────────────────────────────────────────────────────────────

export type Membre = { key: string; firstName: string; lastName: string; phone: string };
export type Enseignant = Membre & { specialite: string; matricule: string; embauche: string };

export const PERSONNEL: Record<string, { directeur?: Membre; comptable?: Membre; enseignants: Enseignant[] }> = {
    cocotiers: {
        directeur: { key: "directeur-cocotiers", firstName: "Clarisse", lastName: "Hounkpatin", phone: "+229 96 11 22 33" },
        comptable: { key: "comptable-cocotiers", firstName: "Arnaud", lastName: "Tchibozo", phone: "+229 96 44 55 66" },
        enseignants: [
            { key: "prof-maths", firstName: "Koffi", lastName: "Dossou", phone: "+229 97 01 01 01", specialite: "Mathématiques", matricule: "PROF-2026-001", embauche: "2019-10-01" },
            { key: "prof-francais", firstName: "Awa", lastName: "Hountondji", phone: "+229 97 02 02 02", specialite: "Français", matricule: "PROF-2026-002", embauche: "2017-10-02" },
            { key: "prof-pct", firstName: "Brice", lastName: "Zinsou", phone: "+229 97 03 03 03", specialite: "Physique-Chimie et Technologie", matricule: "PROF-2026-003", embauche: "2021-10-04" },
            { key: "prof-svt", firstName: "Estelle", lastName: "Gbaguidi", phone: "+229 97 04 04 04", specialite: "Sciences de la Vie et de la Terre", matricule: "PROF-2026-004", embauche: "2020-10-05" },
            { key: "prof-anglais", firstName: "Jean-Baptiste", lastName: "Adjovi", phone: "+229 97 05 05 05", specialite: "Anglais", matricule: "PROF-2026-005", embauche: "2018-10-01" },
            { key: "prof-hg", firstName: "Pascal", lastName: "Houngbo", phone: "+229 97 06 06 06", specialite: "Histoire-Géographie", matricule: "PROF-2026-006", embauche: "2016-10-03" },
            { key: "prof-eps", firstName: "Yves", lastName: "Akpovi", phone: "+229 97 07 07 07", specialite: "Éducation Physique et Sportive", matricule: "PROF-2026-007", embauche: "2022-10-03" },
            { key: "prof-philo", firstName: "Nadège", lastName: "Kiki", phone: "+229 97 08 08 08", specialite: "Philosophie et Espagnol", matricule: "PROF-2026-008", embauche: "2015-10-01" },
        ],
    },
    "cocotiers-primaire": {
        enseignants: [
            { key: "instit-ci", firstName: "Léa", lastName: "Ahouansou", phone: "+229 95 10 10 10", specialite: "Instituteur CI", matricule: "INST-2026-001", embauche: "2020-10-01" },
            { key: "instit-cm2", firstName: "Romaric", lastName: "Dègla", phone: "+229 95 20 20 20", specialite: "Instituteur CM2", matricule: "INST-2026-002", embauche: "2014-10-01" },
        ],
    },
    "lycee-technique": {
        enseignants: [{ key: "prof-elec", firstName: "Gilles", lastName: "Fanou", phone: "+229 94 30 30 30", specialite: "Électrotechnique", matricule: "LTC-2026-001", embauche: "2012-10-01" }],
    },
    rosee: {
        enseignants: [{ key: "instit-rosee", firstName: "Thérèse", lastName: "Adanhoumè", phone: "+229 94 40 40 40", specialite: "Institutrice CE1", matricule: "EPR-2026-001", embauche: "2011-10-01" }],
    },
    "saint-joseph": {
        enseignants: [{ key: "prof-sj", firstName: "Michael", lastName: "Okafor", phone: "+229 94 50 50 50", specialite: "Anglais", matricule: "GSI-2026-001", embauche: "2023-09-01" }],
    },
};

// ─── Classes, matières enseignées, emploi du temps ──────────────────────────

export type Classe = {
    name: string;
    niveau: string;
    capacite: number;
    principal: string;
    /** Matière (code) → enseignant (clé de compte). */
    matieres: Record<string, string>;
};

const COLLEGE_6E: Record<string, string> = {
    MATH: "prof-maths",
    FRA: "prof-francais",
    ANG: "prof-anglais",
    PCT: "prof-pct",
    SVT: "prof-svt",
    HG: "prof-hg",
    EPS: "prof-eps",
};

export const CLASSES: Record<string, Classe[]> = {
    cocotiers: [
        { name: "6ème A", niveau: "Sixième", capacite: 45, principal: "prof-maths", matieres: COLLEGE_6E },
        { name: "6ème B", niveau: "Sixième", capacite: 45, principal: "prof-francais", matieres: COLLEGE_6E },
        { name: "3ème A", niveau: "Troisième", capacite: 50, principal: "prof-hg", matieres: { ...COLLEGE_6E, ESP: "prof-philo" } },
        { name: "Tle A", niveau: "Terminale", capacite: 40, principal: "prof-philo", matieres: { PHILO: "prof-philo", FRA: "prof-francais", ANG: "prof-anglais", HG: "prof-hg", MATH: "prof-maths", EPS: "prof-eps" } },
        { name: "Tle D", niveau: "Terminale", capacite: 40, principal: "prof-svt", matieres: { MATH: "prof-maths", PCT: "prof-pct", SVT: "prof-svt", PHILO: "prof-philo", FRA: "prof-francais", ANG: "prof-anglais", EPS: "prof-eps" } },
    ],
    "cocotiers-primaire": [
        { name: "CI A", niveau: "Cours d'Initiation", capacite: 40, principal: "instit-ci", matieres: { FR: "instit-ci", MATHS: "instit-ci", EST: "instit-ci", ES: "instit-ci", EA: "instit-ci", EPS: "instit-ci" } },
        { name: "CM2 A", niveau: "Cours Moyen 2", capacite: 45, principal: "instit-cm2", matieres: { FR: "instit-cm2", MATHS: "instit-cm2", EST: "instit-cm2", ES: "instit-cm2", EA: "instit-cm2", EPS: "instit-cm2" } },
    ],
    "lycee-technique": [
        { name: "Tle F3", niveau: "Terminale", capacite: 30, principal: "prof-elec", matieres: { ELEC: "prof-elec", DT: "prof-elec" } },
    ],
    rosee: [{ name: "CE1 A", niveau: "Cours Élémentaire 1", capacite: 45, principal: "instit-rosee", matieres: { FR: "instit-rosee", MATHS: "instit-rosee", EST: "instit-rosee" } }],
    "saint-joseph": [{ name: "6ème International", niveau: "Sixième", capacite: 30, principal: "prof-sj", matieres: { ANG: "prof-sj" } }],
};

/** Semaine de la 6ème A (Les Cocotiers). */
export const EDT_6A: { jour: string; debut: string; fin: string; matiere: string; salle: string }[] = [
    { jour: "Lundi", debut: "08:00", fin: "10:00", matiere: "MATH", salle: "Salle 101" },
    { jour: "Lundi", debut: "10:00", fin: "12:00", matiere: "FRA", salle: "Salle 101" },
    { jour: "Mardi", debut: "08:00", fin: "10:00", matiere: "ANG", salle: "Salle 101" },
    { jour: "Mardi", debut: "10:00", fin: "12:00", matiere: "PCT", salle: "Laboratoire de sciences" },
    { jour: "Mercredi", debut: "08:00", fin: "10:00", matiere: "SVT", salle: "Laboratoire de sciences" },
    { jour: "Jeudi", debut: "08:00", fin: "10:00", matiere: "HG", salle: "Salle 101" },
    { jour: "Jeudi", debut: "10:00", fin: "12:00", matiere: "MATH", salle: "Salle 101" },
    { jour: "Vendredi", debut: "15:00", fin: "17:00", matiere: "EPS", salle: "Terrain de sport" },
];

// ─── Élèves et familles ──────────────────────────────────────────────────────

export type Responsable = { key: string; firstName: string; lastName: string; lien: "Père" | "Mère" | "Tuteur / Tutrice"; phone: string; compte: boolean };
export type Eleve = {
    key: string;
    ecole: string;
    classe: string;
    nom: string;
    prenom: string;
    matricule: string;
    naissance: string;
    genre: "Masculin" | "Féminin";
    lieu: string;
    phone: string;
    adresse: string;
    responsable: Responsable;
};

/** Parent rattaché à deux enfants de deux sites de la même organisation. */
const FAMILLE_ZINSOU: Responsable = { key: "parent-zinsou", firstName: "Célestin", lastName: "Zinsou", lien: "Père", phone: "+229 96 70 70 70", compte: true };

export const ELEVES: Eleve[] = [
    { key: "eleve-kate", ecole: "cocotiers", classe: "6ème A", nom: "AGBOSSOU", prenom: "Kate", matricule: "COC-2026-0001", naissance: "2014-03-12", genre: "Féminin", lieu: "Cotonou", phone: "+229 90 11 00 01", adresse: "Akpakpa, Cotonou", responsable: { key: "parent-agbossou", firstName: "Fabrice", lastName: "Agbossou", lien: "Père", phone: "+229 96 10 10 10", compte: true } },
    { key: "eleve-ismael", ecole: "cocotiers", classe: "6ème A", nom: "GNANHOUI", prenom: "Ismaël", matricule: "COC-2026-0002", naissance: "2014-07-01", genre: "Masculin", lieu: "Porto-Novo", phone: "+229 90 11 00 02", adresse: "Fidjrossè, Cotonou", responsable: { key: "parent-gnanhoui", firstName: "Rachida", lastName: "Gnanhoui", lien: "Mère", phone: "+229 96 20 20 20", compte: true } },
    { key: "eleve-divine", ecole: "cocotiers", classe: "6ème A", nom: "ZINSOU", prenom: "Divine", matricule: "COC-2026-0003", naissance: "2014-11-23", genre: "Féminin", lieu: "Cotonou", phone: "+229 90 11 00 03", adresse: "Calavi Kpota", responsable: FAMILLE_ZINSOU },
    { key: "eleve-junior", ecole: "cocotiers", classe: "6ème A", nom: "HOUNSOU", prenom: "Junior", matricule: "COC-2026-0004", naissance: "2013-12-30", genre: "Masculin", lieu: "Abomey", phone: "+229 90 11 00 04", adresse: "Gbegamey, Cotonou", responsable: { key: "tuteur-hounsou", firstName: "Bernadin", lastName: "Hounsou", lien: "Tuteur / Tutrice", phone: "+229 96 40 40 40", compte: false } },
    { key: "eleve-aicha", ecole: "cocotiers", classe: "6ème B", nom: "SANNI", prenom: "Aïcha", matricule: "COC-2026-0005", naissance: "2014-05-05", genre: "Féminin", lieu: "Parakou", phone: "+229 90 11 00 05", adresse: "Zogbo, Cotonou", responsable: { key: "parent-sanni", firstName: "Moussa", lastName: "Sanni", lien: "Père", phone: "+229 96 50 50 50", compte: false } },
    { key: "eleve-fiacre", ecole: "cocotiers", classe: "3ème A", nom: "DOSSA", prenom: "Fiacre", matricule: "COC-2026-0006", naissance: "2011-02-14", genre: "Masculin", lieu: "Ouidah", phone: "+229 90 11 00 06", adresse: "Cadjèhoun, Cotonou", responsable: { key: "parent-dossa", firstName: "Hortense", lastName: "Dossa", lien: "Mère", phone: "+229 96 60 60 60", compte: true } },
    { key: "eleve-gloria", ecole: "cocotiers", classe: "Tle D", nom: "AKAKPO", prenom: "Gloria", matricule: "COC-2026-0007", naissance: "2008-09-09", genre: "Féminin", lieu: "Lokossa", phone: "+229 90 11 00 07", adresse: "Agla, Cotonou", responsable: { key: "parent-akakpo", firstName: "Edmond", lastName: "Akakpo", lien: "Père", phone: "+229 96 80 80 80", compte: false } },
    { key: "eleve-yann", ecole: "cocotiers", classe: "Tle A", nom: "KOUTON", prenom: "Yann", matricule: "COC-2026-0008", naissance: "2008-01-17", genre: "Masculin", lieu: "Cotonou", phone: "+229 90 11 00 08", adresse: "Vêdoko, Cotonou", responsable: { key: "parent-kouton", firstName: "Sylvie", lastName: "Kouton", lien: "Mère", phone: "+229 96 90 90 90", compte: false } },
    { key: "eleve-emmanuel", ecole: "cocotiers-primaire", classe: "CM2 A", nom: "ZINSOU", prenom: "Emmanuel", matricule: "CAL-2026-0001", naissance: "2015-04-04", genre: "Masculin", lieu: "Abomey-Calavi", phone: "+229 90 22 00 01", adresse: "Calavi Kpota", responsable: FAMILLE_ZINSOU },
    { key: "eleve-grace", ecole: "cocotiers-primaire", classe: "CM2 A", nom: "ADANDE", prenom: "Grâce", matricule: "CAL-2026-0002", naissance: "2015-08-18", genre: "Féminin", lieu: "Abomey-Calavi", phone: "+229 90 22 00 02", adresse: "Tankpè, Abomey-Calavi", responsable: { key: "parent-adande", firstName: "Josué", lastName: "Adandé", lien: "Père", phone: "+229 95 60 60 60", compte: false } },
    { key: "eleve-merveille", ecole: "cocotiers-primaire", classe: "CI A", nom: "KPOSSOU", prenom: "Merveille", matricule: "CAL-2026-0003", naissance: "2020-06-06", genre: "Féminin", lieu: "Abomey-Calavi", phone: "+229 90 22 00 03", adresse: "Godomey", responsable: { key: "parent-kpossou", firstName: "Nadia", lastName: "Kpossou", lien: "Mère", phone: "+229 95 70 70 70", compte: false } },
    { key: "eleve-ltc", ecole: "lycee-technique", classe: "Tle F3", nom: "BIO", prenom: "Chabi", matricule: "LTC-2026-0001", naissance: "2007-10-10", genre: "Masculin", lieu: "Natitingou", phone: "+229 90 33 00 01", adresse: "Jéricho, Cotonou", responsable: { key: "parent-bio", firstName: "Orou", lastName: "Bio", lien: "Père", phone: "+229 94 11 11 11", compte: false } },
    { key: "eleve-rosee", ecole: "rosee", classe: "CE1 A", nom: "AHOUANDJINOU", prenom: "Pascaline", matricule: "EPR-2026-0001", naissance: "2018-12-01", genre: "Féminin", lieu: "Porto-Novo", phone: "+229 90 44 00 01", adresse: "Ouando, Porto-Novo", responsable: { key: "parent-ahouandjinou", firstName: "Gisèle", lastName: "Ahouandjinou", lien: "Mère", phone: "+229 94 22 22 22", compte: false } },
    { key: "eleve-sj", ecole: "saint-joseph", classe: "6ème International", nom: "OKAFOR", prenom: "Chidi", matricule: "GSI-2026-0001", naissance: "2014-02-02", genre: "Masculin", lieu: "Lagos", phone: "+229 90 55 00 01", adresse: "Parakou centre", responsable: { key: "parent-okafor", firstName: "Ngozi", lastName: "Okafor", lien: "Mère", phone: "+229 94 33 33 33", compte: false } },
];

// ─── Frais scolaires ─────────────────────────────────────────────────────────

export type Frais = { intitule: string; montant: number; niveau?: string; echeance?: string; obligatoire: boolean; notes?: string };

export const FRAIS: Record<string, Frais[]> = {
    cocotiers: [
        { intitule: "Frais d'inscription 2026-2027", montant: 25000, echeance: "2026-09-30", obligatoire: true, notes: "Payable à l'inscription" },
        { intitule: "Scolarité 6ème 2026-2027", montant: 150000, niveau: "Sixième", echeance: "2026-10-31", obligatoire: true },
        { intitule: "Scolarité 3ème 2026-2027", montant: 175000, niveau: "Troisième", echeance: "2026-10-31", obligatoire: true },
        { intitule: "Scolarité Terminale 2026-2027", montant: 200000, niveau: "Terminale", echeance: "2026-10-31", obligatoire: true },
        { intitule: "Frais d'examen blanc BEPC", montant: 10000, niveau: "Troisième", echeance: "2026-09-20", obligatoire: true, notes: "Échéance déjà passée : sert à tester les relances" },
        { intitule: "Cantine — 1er trimestre", montant: 45000, echeance: "2026-10-15", obligatoire: false },
        { intitule: "Tenue scolaire", montant: 12000, obligatoire: false },
    ],
    "cocotiers-primaire": [
        { intitule: "Scolarité CI 2026-2027", montant: 60000, niveau: "Cours d'Initiation", echeance: "2026-10-31", obligatoire: true },
        { intitule: "Scolarité CM2 2026-2027", montant: 75000, niveau: "Cours Moyen 2", echeance: "2026-10-31", obligatoire: true },
    ],
    "lycee-technique": [{ intitule: "Contribution annuelle (public)", montant: 15000, obligatoire: true }],
    rosee: [{ intitule: "Scolarité CE1 2026-2027", montant: 55000, niveau: "Cours Élémentaire 1", obligatoire: true }],
    "saint-joseph": [{ intitule: "Tuition International 6th grade", montant: 900000, niveau: "Sixième", echeance: "2026-10-15", obligatoire: true }],
};
