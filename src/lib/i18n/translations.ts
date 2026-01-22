/**
 * Translations for EduPilot
 * Support for French (FR) and English (EN)
 */

export type Language = "fr" | "en";

export interface Translations {
  // Common
  common: {
    welcome: string;
    loading: string;
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    create: string;
    search: string;
    actions: string;
    yes: string;
    no: string;
    submit: string;
    back: string;
    next: string;
    previous: string;
    close: string;
    confirm: string;
  };
  // Auth
  auth: {
    login: string;
    logout: string;
    email: string;
    password: string;
    forgotPassword: string;
    resetPassword: string;
    loginButton: string;
    emailPlaceholder: string;
    invalidCredentials: string;
  };
  // Navigation
  nav: {
    dashboard: string;
    profile: string;
    settings: string;
    notifications: string;
    students: string;
    teachers: string;
    classes: string;
    subjects: string;
    grades: string;
    schedules: string;
    finance: string;
    reports: string;
  };
  // Settings
  settings: {
    title: string;
    appearance: string;
    theme: string;
    themeLight: string;
    themeDark: string;
    themeSystem: string;
    language: string;
    notifications: string;
    notificationsApp: string;
    notificationsEmail: string;
    security: string;
    deleteAccount: string;
  };
  // Messages
  messages: {
    success: string;
    error: string;
    confirmDelete: string;
    noData: string;
    saved: string;
    deleted: string;
  };
}

export const translations: Record<Language, Translations> = {
  fr: {
    common: {
      welcome: "Bienvenue",
      loading: "Chargement...",
      save: "Enregistrer",
      cancel: "Annuler",
      delete: "Supprimer",
      edit: "Modifier",
      create: "Créer",
      search: "Rechercher",
      actions: "Actions",
      yes: "Oui",
      no: "Non",
      submit: "Soumettre",
      back: "Retour",
      next: "Suivant",
      previous: "Précédent",
      close: "Fermer",
      confirm: "Confirmer",
    },
    auth: {
      login: "Connexion",
      logout: "Déconnexion",
      email: "Email",
      password: "Mot de passe",
      forgotPassword: "Mot de passe oublié ?",
      resetPassword: "Réinitialiser le mot de passe",
      loginButton: "Se connecter",
      emailPlaceholder: "exemple@ecole.bj",
      invalidCredentials: "Email ou mot de passe incorrect",
    },
    nav: {
      dashboard: "Tableau de bord",
      profile: "Profil",
      settings: "Paramètres",
      notifications: "Notifications",
      students: "Élèves",
      teachers: "Enseignants",
      classes: "Classes",
      subjects: "Matières",
      grades: "Notes",
      schedules: "Emplois du temps",
      finance: "Finances",
      reports: "Rapports",
    },
    settings: {
      title: "Paramètres",
      appearance: "Apparence",
      theme: "Thème",
      themeLight: "Clair",
      themeDark: "Sombre",
      themeSystem: "Système",
      language: "Langue",
      notifications: "Notifications",
      notificationsApp: "Notifications dans l'application",
      notificationsEmail: "Notifications par email",
      security: "Sécurité",
      deleteAccount: "Supprimer le compte",
    },
    messages: {
      success: "Opération réussie",
      error: "Une erreur est survenue",
      confirmDelete: "Êtes-vous sûr de vouloir supprimer ?",
      noData: "Aucune donnée disponible",
      saved: "Enregistré avec succès",
      deleted: "Supprimé avec succès",
    },
  },
  en: {
    common: {
      welcome: "Welcome",
      loading: "Loading...",
      save: "Save",
      cancel: "Cancel",
      delete: "Delete",
      edit: "Edit",
      create: "Create",
      search: "Search",
      actions: "Actions",
      yes: "Yes",
      no: "No",
      submit: "Submit",
      back: "Back",
      next: "Next",
      previous: "Previous",
      close: "Close",
      confirm: "Confirm",
    },
    auth: {
      login: "Login",
      logout: "Logout",
      email: "Email",
      password: "Password",
      forgotPassword: "Forgot password?",
      resetPassword: "Reset password",
      loginButton: "Sign in",
      emailPlaceholder: "example@school.bj",
      invalidCredentials: "Invalid email or password",
    },
    nav: {
      dashboard: "Dashboard",
      profile: "Profile",
      settings: "Settings",
      notifications: "Notifications",
      students: "Students",
      teachers: "Teachers",
      classes: "Classes",
      subjects: "Subjects",
      grades: "Grades",
      schedules: "Schedules",
      finance: "Finance",
      reports: "Reports",
    },
    settings: {
      title: "Settings",
      appearance: "Appearance",
      theme: "Theme",
      themeLight: "Light",
      themeDark: "Dark",
      themeSystem: "System",
      language: "Language",
      notifications: "Notifications",
      notificationsApp: "App notifications",
      notificationsEmail: "Email notifications",
      security: "Security",
      deleteAccount: "Delete account",
    },
    messages: {
      success: "Operation successful",
      error: "An error occurred",
      confirmDelete: "Are you sure you want to delete?",
      noData: "No data available",
      saved: "Saved successfully",
      deleted: "Deleted successfully",
    },
  },
};

/**
 * Get translation by key
 */
export function getTranslation(lang: Language, key: string): string {
  const keys = key.split(".");
  let value: any = translations[lang];

  for (const k of keys) {
    value = value?.[k];
  }

  return typeof value === "string" ? value : key;
}
