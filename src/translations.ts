
import { Language } from './types';
import { ACTIVE_COUNTRY } from './config/countryProfiles';

// Auth marketing chip for the market's funding scheme — the auth surface is
// shared across editions; only this chip names the national scheme.
const FUNDING_CHIP = ACTIVE_COUNTRY.code === 'GB'
  ? { en: 'BUS / MCS eligibility', de: 'BUS / MCS eligibility', fr: 'BUS / MCS eligibility' }
  : ACTIVE_COUNTRY.code === 'FR'
    ? { en: "MaPrimeRénov' / CEE eligibility", de: "MaPrimeRénov' / CEE eligibility", fr: "Éligibilité MaPrimeRénov' / CEE" }
    : { en: 'BAFA / KfW eligibility', de: 'BAFA-/KfW-Förderfähigkeit', fr: 'BAFA / KfW eligibility' };

const EN_T = {
    // General / Auth
    subTitle: "The most comprehensive heat pump database — with regular updates",
    welcomeTitle: "Welcome to Heat Pump World",
    signup: "Sign Up",
    login: "Log In",
    adminAccess: "Admin Access",
    termsTitle: "Account & data use terms",
    termsIntro: "Please review and accept before creating your account:",
    termsAccount: "One account per person. Each account is strictly personal and may only be used by one individual. If use by two or more persons is detected, the account may be closed without prior notice as a breach of contract, with no refund for any remaining subscription period.",
    termsData: "No unauthorised data extraction. Collecting, scraping or reusing the database contents outside the presentation forms of this application — including automated collection or AI training — is prohibited and leads to account closure; civil and criminal liability may apply under database-protection law.",
    termsAgree: "I agree — create account",
    termsCancel: "Cancel",
    termsDeclined: "Registration cancelled — the terms must be accepted to create an account.",

    // Registration pause (see src/config/registration.ts)
    regPausedTitle: "Registration is temporarily unavailable",
    regPausedBody: "We are currently carrying out a system review as we prepare to expand the HeatPump Database across Europe. While the review is running, no new accounts can be created.",
    regPausedReopen: "Expected reopening",
    regPausedExisting: "Already have an account? Existing members can sign in as usual.",
    regPausedNotice: "New registrations are paused during our European expansion review. Existing accounts are unaffected.",
    back: "Back",
    loginTitle: "Log In",
    loginSub: "Enter your credentials to access the database.",
    email: "Email Address",
    password: "Password",
    forgotPass: "Forgot Password?",
    loggingIn: "Logging in...",
    createAccount: "Create Account",
    firstName: "First Name",
    lastName: "Last Name",
    companyType: "Company Type",
    select: "Select...",
    jobRole: "Job Role",
    companyName: "Company Name",
    city: "City",
    referralSource: "Referral Source",
    registering: "Registering...",
    completeSignup: "Complete Registration",
    searchPlaceholder: "Search for model, brand, or capacity...",

    // Auth surface (eco-futuristic login)
    authTagline: "Intelligence for the heat transition",
    authHeadline: "Every heat pump on the market.",
    authHeadlineAccent: "One intelligent database.",
    authMarketLabel: "Market",
    authResidentialDesc: "Single- & multi-family homes",
    authCommercialDesc: "Commercial & large-scale systems",
    authChipBafa: FUNDING_CHIP.en,
    authChipRefrigerant: "R290 & refrigerant data",
    authChipScop: "SCOP, noise & capacity compare",
    authEcoLine: "Data for a climate-neutral building stock",
    authNoAccount: "No account yet?",
    authHaveAccount: "Already registered?",
    orContinueWith: "or continue with",
    continueGoogle: "Continue with Google",
    continueApple: "Continue with Apple",

    // Admin
    adminPanel: "Admin Panel",
    tabUsers: "Members", 
    tabDb: "Database",
    tabLogs: "Logs",
    tabStats: "Reports",
    tabSettings: "Settings",
    logoutAdmin: "Logout Admin",
    userMgmt: "Member Management",
    searchMembers: "Search members...",
    exportCsv: "Download CSV",
    
    // DB Management
    dbMgmt: "Database & Metadata",
    genDb: "Generate Database (AI Scan)",
    startScan: "Starting scan...",
    dbDownloadInstruction: "Database generated!",
    dbUploadNotice: "Upload the generated file to update.",
    uploadDb: "Upload Database",
    uploadDbInstruction: "Select .json file",
    uploadSuccess: "Success!",
    analytics: "Analytics",
    totalUsers: "Total Users",
    activeUsers: "Active Users",
    appModeConfig: "App Mode Configuration",
    modeDatabase: "Database Mode", // For radio buttons
    modeLive: "Live API Mode",     // For radio buttons
    dbMode: "Database Mode",       // For status indicators
    liveMode: "Live Mode",         // For status indicators
    saveConfigOnly: "Save Configuration",
    configSavedMsg: "Configuration Saved.",
    
    // Admin Settings
    adminSettings: "Admin Settings",
    changePassword: "Change Password",
    newPassword: "New Password",
    confirmPassword: "Confirm Password",
    updatePassword: "Update",
    passwordUpdated: "Updated!",
    passwordMismatch: "Mismatch!",
    passwordLength: "Too short!",
    
    // Footer
    legalDisclaimer: "Disclaimer: This data is generated by AI and may contain errors. Always verify with manufacturer datasheets.",
    
    // Filters & Table
    filterManufacturer: "Manufacturer",
    filterCapacity: "Capacity",
    filterInstallType: "Installation Type",
    activeFilters: "Active Filters",
    clearAll: "Clear All",
    colSelect: "Select",
    colManufacturer: "Manufacturer",
    colInstallType: "Installation Type",
    colModel: "Model",
    colCapacity: "Capacity",
    colRefrigerant: "Refrigerant",
    colRefrigerantAmt: "Refrig. Amt",
    colNoise: "Noise",
    colGridReady: "Grid Ready",
    colNumCompressors: "Compressors",
    colMarketSegment: "Segment",
    colPowerControl: "Drive",
    loading: "Loading...",
    noResults: "No results found.",
    bafaSnapshotNoticePrefix: "BAFA source snapshot:",
    bafaSnapshotNoticeSuffix: "Listed products reflect the BAFA source data used by this app. Verify current BAFA eligibility directly with BAFA before use.",

    // Product Search sub-tabs
    tabResidential: "Residential",
    tabCommercial: "Commercial",

    // Commercial filters
    filterMarketSegment: "Market Segment",

    // Tabs & Comparison
    tabComparison: "Comparison",
    selectedModels: "Selected",
    startComparison: "Compare",
    backToSelection: "Back",
    clearSelection: "Clear",
    compareErrorMax: "Max 4 models allowed.",
    compareErrorMin: "Select at least 2 models.",

    // Data Sheet
    tabDataSheet: "Data Sheet",
    dataSheetSelected: "Selected for Data Sheet",
    dataSheetPreview: "Preview",
    dataSheetSelectPrompt: "Select a model from the list below to generate a data sheet.",
    dataSheetPrint: "Print",
    dataSheetClose: "Close",
    dataSheetPrinting: "Printing...",
};

const DE_T = {
    // General / Auth
    subTitle: "Die umfassendste Wärmepumpen-Datenbank — regelmäßig aktualisiert",
    welcomeTitle: "Willkommen",
    signup: "Registrieren",
    login: "Anmelden",
    adminAccess: "Admin-Zugang",
    termsTitle: "Konto- und Datennutzungsbedingungen",
    termsIntro: "Bitte lesen und akzeptieren Sie vor der Kontoerstellung:",
    termsAccount: "Ein Konto pro Person. Jedes Konto ist strikt persönlich und darf nur von einer Person genutzt werden. Wird die Nutzung durch zwei oder mehr Personen festgestellt, kann das Konto ohne Vorankündigung wegen Vertragsverletzung geschlossen werden — ohne Erstattung für die verbleibende Laufzeit.",
    termsData: "Keine unerlaubte Datenentnahme. Das Sammeln, Auslesen (Scraping) oder Weiterverwenden der Datenbankinhalte außerhalb der Darstellungsformen dieser Anwendung — einschließlich automatisierter Erfassung oder KI-Trainings — ist untersagt und führt zur Kontoschließung; zivil- und strafrechtliche Folgen nach Datenbankschutzrecht sind möglich.",
    termsAgree: "Ich stimme zu — Konto erstellen",
    termsCancel: "Abbrechen",
    termsDeclined: "Registrierung abgebrochen — die Bedingungen müssen akzeptiert werden.",

    // Registrierungspause (siehe src/config/registration.ts)
    regPausedTitle: "Registrierung vorübergehend nicht möglich",
    regPausedBody: "Wir führen derzeit eine Systemprüfung durch, während wir die HeatPump DB auf weitere europäische Märkte ausweiten. Während der Prüfung können keine neuen Konten angelegt werden.",
    regPausedReopen: "Voraussichtliche Wiedereröffnung",
    regPausedExisting: "Sie haben bereits ein Konto? Bestehende Mitglieder können sich wie gewohnt anmelden.",
    regPausedNotice: "Neuregistrierungen sind während unserer Europa-Erweiterungsprüfung pausiert. Bestehende Konten sind nicht betroffen.",
    back: "Zurück",
    loginTitle: "Anmelden",
    loginSub: "Geben Sie Ihre Zugangsdaten ein.",
    email: "E-Mail-Adresse",
    password: "Passwort",
    forgotPass: "Passwort vergessen?",
    loggingIn: "Anmelden...",
    createAccount: "Konto erstellen",
    firstName: "Vorname",
    lastName: "Nachname",
    companyType: "Unternehmenstyp",
    select: "Auswählen...",
    jobRole: "Berufsbezeichnung",
    companyName: "Firmenname",
    city: "Stadt",
    referralSource: "Wie haben Sie uns gefunden?",
    registering: "Registrierung...",
    completeSignup: "Registrierung abschließen",
    searchPlaceholder: "Suche nach Modell, Marke oder Leistung...",

    // Auth surface (eco-futuristic login)
    authTagline: "Intelligenz für die Wärmewende",
    authHeadline: "Jede Wärmepumpe am Markt.",
    authHeadlineAccent: "Eine intelligente Datenbank.",
    authMarketLabel: "Markt",
    authResidentialDesc: "Ein- & Mehrfamilienhäuser",
    authCommercialDesc: "Gewerbe & Großanlagen",
    authChipBafa: FUNDING_CHIP.de,
    authChipRefrigerant: "R290- & Kältemitteldaten",
    authChipScop: "SCOP-, Schall- & Leistungsvergleich",
    authEcoLine: "Daten für einen klimaneutralen Gebäudebestand",
    authNoAccount: "Noch kein Konto?",
    authHaveAccount: "Bereits registriert?",
    orContinueWith: "oder weiter mit",
    continueGoogle: "Weiter mit Google",
    continueApple: "Weiter mit Apple",

    // Admin
    adminPanel: "Admin-Bereich",
    tabUsers: "Mitglieder",
    tabDb: "Datenbank",
    tabLogs: "Protokolle",
    tabStats: "Berichte",
    tabSettings: "Einstellungen",
    logoutAdmin: "Abmelden",
    userMgmt: "Mitgliederverwaltung",
    searchMembers: "Mitglieder suchen...",
    exportCsv: "CSV herunterladen",
    
    // DB Management
    dbMgmt: "Datenbank & Metadaten",
    genDb: "Datenbank generieren",
    startScan: "Scan startet...",
    dbDownloadInstruction: "Generiert!",
    dbUploadNotice: "Bitte hochladen.",
    uploadDb: "Datenbank hochladen",
    uploadDbInstruction: ".json wählen",
    uploadSuccess: "Erfolg!",
    analytics: "Analyse",
    totalUsers: "Gesamt",
    activeUsers: "Aktiv",
    appModeConfig: "App-Modus",
    modeDatabase: "DB-Modus",
    modeLive: "Live-Modus",
    dbMode: "Datenbank-Modus",
    liveMode: "Live-Modus",
    saveConfigOnly: "Speichern",
    configSavedMsg: "Gespeichert.",
    
    // Admin Settings
    adminSettings: "Einstellungen",
    changePassword: "Passwort ändern",
    newPassword: "Neues Passwort",
    confirmPassword: "Bestätigen",
    updatePassword: "Aktualisieren",
    passwordUpdated: "Aktualisiert!",
    passwordMismatch: "Fehler!",
    passwordLength: "Zu kurz!",
    
    // Footer
    legalDisclaimer: "Haftungsausschluss: Diese Daten werden von KI generiert und können Fehler enthalten. Bitte überprüfen Sie die Angaben in den Herstellerdatenblättern.",
    
    // Filters & Table
    filterManufacturer: "Hersteller",
    filterCapacity: "Leistung",
    filterInstallType: "Bauart",
    activeFilters: "Filter",
    clearAll: "Löschen",
    colSelect: "Wahl",
    colManufacturer: "Hersteller",
    colInstallType: "Bauart",
    colModel: "Modell",
    colCapacity: "Leistung",
    colRefrigerant: "Kältemittel",
    colRefrigerantAmt: "Kältem. Menge",
    colNoise: "Lärm",
    colGridReady: "Grid Ready",
    colNumCompressors: "Verdichter",
    colMarketSegment: "Segment",
    colPowerControl: "Antrieb",
    loading: "Laden...",
    noResults: "Keine Ergebnisse.",
    bafaSnapshotNoticePrefix: "BAFA-Quellstand:",
    bafaSnapshotNoticeSuffix: "Gelistete Produkte spiegeln die in dieser App verwendeten BAFA-Quelldaten wider. Bitte aktuelle Förderfähigkeit direkt bei der BAFA prüfen.",

    // Product Search sub-tabs
    tabResidential: "Wohngebäude",
    tabCommercial: "Gewerbe",

    // Commercial filters
    filterMarketSegment: "Marktsegment",

    // Tabs & Comparison
    tabComparison: "Vergleich",
    selectedModels: "Ausgewählt",
    startComparison: "Vergleichen",
    backToSelection: "Zurück",
    clearSelection: "Löschen",
    compareErrorMax: "Max 4",
    compareErrorMin: "Min 2",

    // Data Sheet
    tabDataSheet: "Datenblatt",
    dataSheetSelected: "Für Datenblatt ausgewählt",
    dataSheetPreview: "Vorschau",
    dataSheetSelectPrompt: "Wählen Sie ein Modell aus der Liste, um ein Datenblatt zu erstellen.",
    dataSheetPrint: "Drucken",
    dataSheetClose: "Schließen",
    dataSheetPrinting: "Wird gedruckt...",
};

// French auth surface (FR edition) — user-facing auth/footer strings in
// French; admin-console strings intentionally stay English (operator-facing).
const FR_T = {
    ...EN_T,
    termsTitle: "Conditions d’utilisation du compte et des données",
    termsIntro: "Veuillez lire et accepter avant de créer votre compte :",
    termsAccount: "Un compte par personne. Chaque compte est strictement personnel et ne peut être utilisé que par une seule personne. En cas d’utilisation par deux personnes ou plus, le compte peut être fermé sans préavis pour rupture de contrat, sans remboursement de la période restante.",
    termsData: "Aucune extraction de données non autorisée. Collecter, extraire (scraping) ou réutiliser le contenu de la base de données en dehors des formes de présentation de cette application — y compris la collecte automatisée ou l’entraînement d’IA — est interdit et entraîne la fermeture du compte ; des responsabilités civiles et pénales peuvent s’appliquer au titre du droit des bases de données.",
    termsAgree: "J’accepte — créer le compte",
    termsCancel: "Annuler",
    termsDeclined: "Inscription annulée — les conditions doivent être acceptées.",

    // Pause des inscriptions (voir src/config/registration.ts)
    regPausedTitle: "Les inscriptions sont temporairement suspendues",
    regPausedBody: "Nous procédons actuellement à une révision du système dans le cadre de l'expansion de HeatPump DB en Europe. Pendant cette révision, aucun nouveau compte ne peut être créé.",
    regPausedReopen: "Réouverture prévue",
    regPausedExisting: "Vous avez déjà un compte ? Les membres existants peuvent se connecter comme d'habitude.",
    regPausedNotice: "Les nouvelles inscriptions sont suspendues pendant notre révision liée à l'expansion européenne. Les comptes existants ne sont pas affectés.",
    subTitle: "La base de données de pompes à chaleur la plus complète — mise à jour régulièrement",
    welcomeTitle: "Bienvenue dans l'univers des pompes à chaleur",
    signup: "Créer un compte",
    login: "Se connecter",
    back: "Retour",
    loginTitle: "Connexion",
    loginSub: "Saisissez vos identifiants pour accéder à la base de données.",
    email: "Adresse e-mail",
    password: "Mot de passe",
    forgotPass: "Mot de passe oublié ?",
    loggingIn: "Connexion en cours…",
    createAccount: "Créer un compte",
    firstName: "Prénom",
    lastName: "Nom",
    companyType: "Type d'entreprise",
    select: "Sélectionner…",
    jobRole: "Fonction",
    companyName: "Nom de l'entreprise",
    city: "Ville",
    referralSource: "Comment nous avez-vous connus ?",
    registering: "Inscription en cours…",
    completeSignup: "Finaliser l'inscription",
    searchPlaceholder: "Rechercher un modèle, une marque ou une puissance…",
    authTagline: "L'intelligence de la transition thermique",
    authHeadline: "Toutes les pompes à chaleur du marché.",
    authHeadlineAccent: "Une base de données intelligente.",
    authMarketLabel: "Marché",
    authResidentialDesc: "Maisons individuelles & petits collectifs",
    authCommercialDesc: "Tertiaire & grandes installations",
    authChipBafa: FUNDING_CHIP.fr,
    authChipRefrigerant: "R290 & fluides frigorigènes",
    authChipScop: "SCOP, acoustique & puissance",
    tabResidential: "Résidentiel",
    tabCommercial: "Tertiaire",
    authEcoLine: "Des données pour un parc immobilier neutre en carbone",
    authNoAccount: "Pas encore de compte ?",
    authHaveAccount: "Déjà inscrit ?",
    orContinueWith: "ou continuer avec",
    continueGoogle: "Continuer avec Google",
    continueApple: "Continuer avec Apple",
    legalDisclaimer: "Avertissement : ces données sont générées automatiquement et peuvent contenir des erreurs. Vérifiez toujours les fiches techniques des fabricants.",
    loading: "Chargement…",
    noResults: "Aucun résultat.",
};

// SEO paragraph on the auth landing (the only publicly indexable page).
// Market keywords chosen per edition: DE = BAFA-Liste/Förderung/Luft-Wasser,
// GB = Ofgem BUS PEL/MCS/air source, FR = comparateur/MaPrimeRénov'/air-eau.
const SEO_LINE = ACTIVE_COUNTRY.code === 'GB'
  ? {
      en: 'UK heat pump database & comparison — Ofgem Boiler Upgrade Scheme (BUS) eligibility list, MCS-certified air source heat pumps, SCOP, sound power and refrigerant data.',
      de: '', fr: '',
    }
  : ACTIVE_COUNTRY.code === 'FR'
    ? {
        en: 'Heat pump database & comparison for the French market — air-to-water models, SCOP & COP, sound power, R290 refrigerant, EU energy label, MaPrimeRénov’ & CEE guidance.',
        de: '',
        fr: 'Base de données et comparateur de pompes à chaleur air/eau — SCOP & COP, puissance acoustique, fluide R290, étiquette énergie UE, repères MaPrimeRénov’ & CEE.',
      }
    : {
        en: 'Heat pump database & comparison for the German market — BAFA list of eligible heat pumps, SCOP & COP data, sound power, R290 refrigerant and EU energy label classes.',
        de: 'Wärmepumpen-Datenbank & Vergleich für Deutschland — BAFA-Liste förderfähiger Wärmepumpen, SCOP- & COP-Daten, Schallleistung, R290-Kältemittel und EU-Energielabel.',
        fr: '',
      };

(EN_T as any).authSeoLine = SEO_LINE.en;
(DE_T as any).authSeoLine = SEO_LINE.de || SEO_LINE.en;
(FR_T as any).authSeoLine = SEO_LINE.fr || SEO_LINE.en;

// Simple declarative copyright line (public brand: HeatPump DataBase (Europe)).
const YEAR = new Date().getFullYear();
(EN_T as any).authStatsTitle = 'Registered Heat Pump Models';
(DE_T as any).authStatsTitle = 'Registrierte Wärmepumpen-Modelle';
(FR_T as any).authStatsTitle = 'Modèles de pompes à chaleur référencés';
(EN_T as any).authStatsTotal = 'Total';
(DE_T as any).authStatsTotal = 'Gesamt';
(FR_T as any).authStatsTotal = 'Total';
(EN_T as any).authCopyright = `© ${YEAR} HeatPump DataBase (Europe) · All rights reserved.`;
(DE_T as any).authCopyright = `© ${YEAR} HeatPump DataBase (Europe) · Alle Rechte vorbehalten.`;
(FR_T as any).authCopyright = `© ${YEAR} HeatPump DataBase (Europe) · Tous droits réservés.`;

export const translations = { en: EN_T, de: DE_T, fr: FR_T };
