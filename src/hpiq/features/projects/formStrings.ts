/**
 * Project job-file strings (v2, 2026-10-02) — form, drop-down options, status,
 * tasks, lists, history. EN/DE/FR/PL/IT via `pick`. The shortlist/PDF strings
 * that predate v2 stay in strings.ts.
 */
import { pick, FeatureLang } from '../lang';
import type { Language } from '../../../types';
import type { ProjectStatus, DetailChoiceKey, LogKind } from './projectModel';

export interface ProjectFormStrings {
  subtitle: string;
  newTitle: string;
  newHint: string;
  required: string;
  choose: string;
  secCustomer: string;
  secBuilding: string;
  secPlanning: string;
  secCandidates: string;
  secTasks: string;
  secHistory: string;
  fName: string; fCustomer: string; fPhone: string; fEmail: string; fAddress: string; fPostcode: string; fCity: string;
  fBuildingType: string; fProjectType: string; fExisting: string; fDistribution: string; fDhw: string; fSupply: string;
  fArea: string; fBuildYear: string; fHeatLoad: string;
  fStatus: string; fTarget: string; fFunding: string; fNotes: string;
  opt: Record<DetailChoiceKey, Record<string, string>>;
  status: Record<ProjectStatus, string>;
  createProject: string;
  saveChanges: string;
  saved: string;
  unsaved: string;
  discard: string;
  closeSheet: string;
  needNameCustomer: string;
  // candidates
  candHint: (max: number) => string;
  candSearchPh: string;
  candNoResults: string;
  candFull: (max: number) => string;
  candEmpty: string;
  candAdd: string;
  choose1: string;
  chosen: string;
  unchoose: string;
  candNotePh: string;
  legacyMore: (n: number) => string;
  openCompare: string;
  // tasks
  taskPh: string;
  taskFrequent: string;
  taskTemplates: string[];
  taskAdd: string;
  taskNone: string;
  taskFull: (max: number) => string;
  due: { overdue: string; today: string; noDate: string };
  taskProgress: (done: number, all: number) => string;
  // lists
  listOpen: string;
  listAll: string;
  expand: string;
  collapse: string;
  colProject: string; colCustomer: string; colCity: string; colStatus: string; colNext: string; colTarget: string; colModels: string; colUpdated: string;
  filterAll: string;
  exportCsv: string;
  listEmptyOpen: string;
  listEmptyAll: string;
  sumOpen: (n: number) => string;
  sumDue: (n: number) => string;
  sumOverdue: (n: number) => string;
  // history + records
  log: Record<LogKind, (a: string, b: string) => string>;
  historyEmpty: string;
  recordNote: string;
  recordNoteTeam: string;
  // pdf
  pdfContact: string; pdfSite: string; pdfBuilding: string; pdfStatus: string; pdfTarget: string; pdfTasks: string; pdfChosen: string;
  // csv
  csvCandidates: string; csvOpenTasks: string; csvCreated: string;
}

const EN: ProjectFormStrings = {
  subtitle: 'One page per job: customer and site, building and system, status, up to four candidate models compared side by side, to-dos with due dates — and a PDF for the customer.',
  newTitle: 'New project',
  newHint: 'Fields marked * are required. Everything else can be added later.',
  required: 'required',
  choose: '— select —',
  secCustomer: 'Customer & site',
  secBuilding: 'Building & system',
  secPlanning: 'Status & planning',
  secCandidates: 'Candidate models',
  secTasks: 'To-dos',
  secHistory: 'History',
  fName: 'Project name', fCustomer: 'Customer', fPhone: 'Phone', fEmail: 'E-mail', fAddress: 'Street & no.', fPostcode: 'Postcode', fCity: 'Town / city',
  fBuildingType: 'Building type', fProjectType: 'Type of job', fExisting: 'Existing heating', fDistribution: 'Heat distribution', fDhw: 'Hot water', fSupply: 'Electrical supply',
  fArea: 'Heated area (m²)', fBuildYear: 'Year built', fHeatLoad: 'Heat load (kW)',
  fStatus: 'Status', fTarget: 'Target installation date', fFunding: 'Funding', fNotes: 'Notes',
  opt: {
    buildingType: { detached: 'Detached house', semi: 'Semi-detached', terraced: 'Terraced house', apartment: 'Flat / apartment', multi: 'Multi-family building', commercial: 'Commercial building', other: 'Other' },
    projectType: { replacement: 'Boiler replacement', newbuild: 'New build', hybrid: 'Hybrid (boiler stays)', extension: 'Extension / second unit', other: 'Other' },
    existing: { gas: 'Gas boiler', oil: 'Oil boiler', electric: 'Electric heating', solid: 'Solid fuel / wood', district: 'District heating', heatpump: 'Heat pump', none: 'None' },
    distribution: { underfloor: 'Underfloor heating', radiators: 'Radiators', mixed: 'Underfloor + radiators', air: 'Fan coils / air' },
    dhw: { integrated: 'By the heat pump', separate: 'Separate water heater', none: 'Not part of the job' },
    supply: { '1ph': 'Single-phase 230 V', '3ph': 'Three-phase 400 V', unknown: 'To be checked' },
    funding: { none: 'No funding', check: 'To be checked', applied: 'Applied', approved: 'Approved', paid: 'Paid out' },
  },
  status: { lead: 'Enquiry', survey: 'Site survey', quote: 'Quote sent', won: 'Order placed', install: 'Installation', done: 'Completed', hold: 'On hold', lost: 'Lost' },
  createProject: 'Create project',
  saveChanges: 'Save changes',
  saved: 'Saved',
  unsaved: 'Unsaved changes',
  discard: 'Discard',
  closeSheet: 'Close',
  needNameCustomer: 'Enter a project name and the customer.',
  candHint: m => `Up to ${m} models — the comparison below updates as you add them. The best value per row is highlighted.`,
  candSearchPh: 'Search model or manufacturer to add…',
  candNoResults: 'No matching model.',
  candFull: m => `${m} candidates is the limit — remove one to add another.`,
  candEmpty: 'No candidates yet. Search above, or use “Add to project” on any product or in your watchlist.',
  candAdd: 'Add',
  choose1: 'Choose',
  chosen: 'Chosen model',
  unchoose: 'Undo',
  candNotePh: 'Note on this model…',
  legacyMore: n => (n === 1 ? '1 more model is stored in this project (shown below the comparison).' : `${n} more models are stored in this project (shown below the comparison).`),
  openCompare: 'Open large comparison',
  taskPh: 'What needs to be done?',
  taskFrequent: 'Frequent to-dos',
  taskTemplates: ['Site survey', 'Heat load calculation', 'Check electrical connection', 'Send quote', 'Follow up on quote', 'Funding application', 'Order unit', 'Schedule installation', 'Installation', 'Commissioning', 'Customer handover & documents', 'Final invoice'],
  taskAdd: 'Add',
  taskNone: 'No to-dos yet.',
  taskFull: m => `A project holds up to ${m} to-dos.`,
  due: { overdue: 'overdue', today: 'today', noDate: 'no date' },
  taskProgress: (d, a) => `${d} of ${a} done`,
  listOpen: 'Open projects',
  listAll: 'All projects',
  expand: 'Show list',
  collapse: 'Hide list',
  colProject: 'Project', colCustomer: 'Customer', colCity: 'Town', colStatus: 'Status', colNext: 'Next to-do', colTarget: 'Target date', colModels: 'Models', colUpdated: 'Updated',
  filterAll: 'All statuses',
  exportCsv: 'Export CSV',
  listEmptyOpen: 'No open projects.',
  listEmptyAll: 'No projects yet.',
  sumOpen: n => (n === 1 ? '1 open project' : `${n} open projects`),
  sumDue: n => `${n} due within 7 days`,
  sumOverdue: n => `${n} overdue`,
  log: {
    created: () => 'Project created',
    status: (a, b) => `Status: ${a} → ${b}`,
    add: a => `Candidate added: ${a}`,
    remove: a => `Candidate removed: ${a}`,
    select: a => `Model chosen: ${a}`,
    unselect: () => 'Model choice undone',
    details: () => 'Project details updated',
    task: a => `To-do added: ${a}`,
    taskDone: a => `To-do done: ${a}`,
    taskUndone: a => `To-do reopened: ${a}`,
    taskRemoved: a => `To-do removed: ${a}`,
  },
  historyEmpty: 'No entries yet.',
  recordNote: 'Records: projects are saved in your account and stay until you delete them — completed and lost projects remain in “All projects”. Export CSV for your own files.',
  recordNoteTeam: 'Records: projects are saved for your whole team and stay until someone deletes them — completed and lost projects remain in “All projects”. Export CSV for your own files.',
  pdfContact: 'Contact', pdfSite: 'Site', pdfBuilding: 'Building & system', pdfStatus: 'Status', pdfTarget: 'Target date', pdfTasks: 'Open to-dos', pdfChosen: 'Chosen model',
  csvCandidates: 'Candidates', csvOpenTasks: 'Open to-dos', csvCreated: 'Created',
};

const DE: ProjectFormStrings = {
  subtitle: 'Eine Seite pro Auftrag: Kunde und Objekt, Gebäude und Anlage, Status, bis zu vier Kandidaten im direkten Vergleich, Aufgaben mit Terminen — und ein PDF für den Kunden.',
  newTitle: 'Neues Projekt',
  newHint: 'Felder mit * sind Pflichtfelder. Alles Weitere kann später ergänzt werden.',
  required: 'Pflichtfeld',
  choose: '— auswählen —',
  secCustomer: 'Kunde & Objekt',
  secBuilding: 'Gebäude & Anlage',
  secPlanning: 'Status & Planung',
  secCandidates: 'Kandidaten',
  secTasks: 'Aufgaben',
  secHistory: 'Verlauf',
  fName: 'Projektname', fCustomer: 'Kunde', fPhone: 'Telefon', fEmail: 'E-Mail', fAddress: 'Straße & Nr.', fPostcode: 'PLZ', fCity: 'Ort',
  fBuildingType: 'Gebäudetyp', fProjectType: 'Art des Auftrags', fExisting: 'Bestehende Heizung', fDistribution: 'Wärmeverteilung', fDhw: 'Warmwasser', fSupply: 'Elektroanschluss',
  fArea: 'Beheizte Fläche (m²)', fBuildYear: 'Baujahr', fHeatLoad: 'Heizlast (kW)',
  fStatus: 'Status', fTarget: 'Geplanter Einbautermin', fFunding: 'Förderung', fNotes: 'Notizen',
  opt: {
    buildingType: { detached: 'Einfamilienhaus', semi: 'Doppelhaushälfte', terraced: 'Reihenhaus', apartment: 'Wohnung', multi: 'Mehrfamilienhaus', commercial: 'Gewerbeobjekt', other: 'Sonstiges' },
    projectType: { replacement: 'Heizungstausch', newbuild: 'Neubau', hybrid: 'Hybrid (Kessel bleibt)', extension: 'Erweiterung / Zweitgerät', other: 'Sonstiges' },
    existing: { gas: 'Gaskessel', oil: 'Ölkessel', electric: 'Elektroheizung', solid: 'Festbrennstoff / Holz', district: 'Fernwärme', heatpump: 'Wärmepumpe', none: 'Keine' },
    distribution: { underfloor: 'Fußbodenheizung', radiators: 'Heizkörper', mixed: 'Fußboden + Heizkörper', air: 'Gebläsekonvektoren / Luft' },
    dhw: { integrated: 'Über die Wärmepumpe', separate: 'Separater Warmwasserbereiter', none: 'Nicht Teil des Auftrags' },
    supply: { '1ph': 'Einphasig 230 V', '3ph': 'Dreiphasig 400 V', unknown: 'Noch zu prüfen' },
    funding: { none: 'Keine Förderung', check: 'Noch zu prüfen', applied: 'Beantragt', approved: 'Bewilligt', paid: 'Ausgezahlt' },
  },
  status: { lead: 'Anfrage', survey: 'Vor-Ort-Termin', quote: 'Angebot versendet', won: 'Auftrag erteilt', install: 'Montage', done: 'Abgeschlossen', hold: 'Pausiert', lost: 'Verloren' },
  createProject: 'Projekt anlegen',
  saveChanges: 'Änderungen speichern',
  saved: 'Gespeichert',
  unsaved: 'Ungespeicherte Änderungen',
  discard: 'Verwerfen',
  closeSheet: 'Schließen',
  needNameCustomer: 'Bitte Projektname und Kunde angeben.',
  candHint: m => `Bis zu ${m} Modelle — der Vergleich darunter aktualisiert sich beim Hinzufügen. Der beste Wert je Zeile ist hervorgehoben.`,
  candSearchPh: 'Modell oder Hersteller suchen und hinzufügen…',
  candNoResults: 'Kein passendes Modell.',
  candFull: m => `${m} Kandidaten sind das Maximum — einen entfernen, um einen weiteren hinzuzufügen.`,
  candEmpty: 'Noch keine Kandidaten. Oben suchen oder bei einem Produkt bzw. in der Merkliste „Zum Projekt hinzufügen“ nutzen.',
  candAdd: 'Hinzufügen',
  choose1: 'Auswählen',
  chosen: 'Gewähltes Modell',
  unchoose: 'Zurücknehmen',
  candNotePh: 'Notiz zu diesem Modell…',
  legacyMore: n => (n === 1 ? '1 weiteres Modell ist in diesem Projekt gespeichert (unter dem Vergleich).' : `${n} weitere Modelle sind in diesem Projekt gespeichert (unter dem Vergleich).`),
  openCompare: 'Großen Vergleich öffnen',
  taskPh: 'Was ist zu tun?',
  taskFrequent: 'Häufige Aufgaben',
  taskTemplates: ['Vor-Ort-Termin', 'Heizlastberechnung', 'Elektroanschluss prüfen', 'Angebot versenden', 'Angebot nachfassen', 'Förderantrag stellen', 'Gerät bestellen', 'Montagetermin abstimmen', 'Montage', 'Inbetriebnahme', 'Übergabe & Dokumentation', 'Schlussrechnung'],
  taskAdd: 'Hinzufügen',
  taskNone: 'Noch keine Aufgaben.',
  taskFull: m => `Ein Projekt fasst bis zu ${m} Aufgaben.`,
  due: { overdue: 'überfällig', today: 'heute', noDate: 'ohne Termin' },
  taskProgress: (d, a) => `${d} von ${a} erledigt`,
  listOpen: 'Offene Projekte',
  listAll: 'Alle Projekte',
  expand: 'Liste anzeigen',
  collapse: 'Liste ausblenden',
  colProject: 'Projekt', colCustomer: 'Kunde', colCity: 'Ort', colStatus: 'Status', colNext: 'Nächste Aufgabe', colTarget: 'Einbautermin', colModels: 'Modelle', colUpdated: 'Geändert',
  filterAll: 'Alle Status',
  exportCsv: 'CSV exportieren',
  listEmptyOpen: 'Keine offenen Projekte.',
  listEmptyAll: 'Noch keine Projekte.',
  sumOpen: n => (n === 1 ? '1 offenes Projekt' : `${n} offene Projekte`),
  sumDue: n => `${n} fällig in 7 Tagen`,
  sumOverdue: n => `${n} überfällig`,
  log: {
    created: () => 'Projekt angelegt',
    status: (a, b) => `Status: ${a} → ${b}`,
    add: a => `Kandidat hinzugefügt: ${a}`,
    remove: a => `Kandidat entfernt: ${a}`,
    select: a => `Modell gewählt: ${a}`,
    unselect: () => 'Modellwahl zurückgenommen',
    details: () => 'Projektdaten geändert',
    task: a => `Aufgabe angelegt: ${a}`,
    taskDone: a => `Aufgabe erledigt: ${a}`,
    taskUndone: a => `Aufgabe wieder geöffnet: ${a}`,
    taskRemoved: a => `Aufgabe gelöscht: ${a}`,
  },
  historyEmpty: 'Noch keine Einträge.',
  recordNote: 'Aufbewahrung: Projekte werden in Ihrem Konto gespeichert und bleiben erhalten, bis Sie sie löschen — abgeschlossene und verlorene Projekte bleiben unter „Alle Projekte“. Für Ihre eigenen Unterlagen: CSV exportieren.',
  recordNoteTeam: 'Aufbewahrung: Projekte werden für Ihr gesamtes Team gespeichert und bleiben erhalten, bis jemand sie löscht — abgeschlossene und verlorene Projekte bleiben unter „Alle Projekte“. Für Ihre eigenen Unterlagen: CSV exportieren.',
  pdfContact: 'Kontakt', pdfSite: 'Objekt', pdfBuilding: 'Gebäude & Anlage', pdfStatus: 'Status', pdfTarget: 'Einbautermin', pdfTasks: 'Offene Aufgaben', pdfChosen: 'Gewähltes Modell',
  csvCandidates: 'Kandidaten', csvOpenTasks: 'Offene Aufgaben', csvCreated: 'Angelegt',
};

const FR: ProjectFormStrings = {
  subtitle: 'Une page par chantier : client et site, bâtiment et installation, statut, jusqu’à quatre modèles candidats comparés côte à côte, tâches avec échéances — et un PDF pour le client.',
  newTitle: 'Nouveau projet',
  newHint: 'Les champs marqués * sont obligatoires. Le reste peut être complété plus tard.',
  required: 'obligatoire',
  choose: '— sélectionner —',
  secCustomer: 'Client et site',
  secBuilding: 'Bâtiment et installation',
  secPlanning: 'Statut et planning',
  secCandidates: 'Modèles candidats',
  secTasks: 'Tâches',
  secHistory: 'Historique',
  fName: 'Nom du projet', fCustomer: 'Client', fPhone: 'Téléphone', fEmail: 'E-mail', fAddress: 'Rue et n°', fPostcode: 'Code postal', fCity: 'Ville',
  fBuildingType: 'Type de bâtiment', fProjectType: 'Type de chantier', fExisting: 'Chauffage existant', fDistribution: 'Émetteurs', fDhw: 'Eau chaude sanitaire', fSupply: 'Alimentation électrique',
  fArea: 'Surface chauffée (m²)', fBuildYear: 'Année de construction', fHeatLoad: 'Déperditions (kW)',
  fStatus: 'Statut', fTarget: 'Date de pose prévue', fFunding: 'Aides', fNotes: 'Notes',
  opt: {
    buildingType: { detached: 'Maison individuelle', semi: 'Maison jumelée', terraced: 'Maison mitoyenne', apartment: 'Appartement', multi: 'Immeuble collectif', commercial: 'Bâtiment tertiaire', other: 'Autre' },
    projectType: { replacement: 'Remplacement de chaudière', newbuild: 'Construction neuve', hybrid: 'Hybride (chaudière conservée)', extension: 'Extension / second appareil', other: 'Autre' },
    existing: { gas: 'Chaudière gaz', oil: 'Chaudière fioul', electric: 'Chauffage électrique', solid: 'Bois / combustible solide', district: 'Réseau de chaleur', heatpump: 'Pompe à chaleur', none: 'Aucun' },
    distribution: { underfloor: 'Plancher chauffant', radiators: 'Radiateurs', mixed: 'Plancher + radiateurs', air: 'Ventilo-convecteurs / air' },
    dhw: { integrated: 'Par la pompe à chaleur', separate: 'Chauffe-eau séparé', none: 'Hors chantier' },
    supply: { '1ph': 'Monophasé 230 V', '3ph': 'Triphasé 400 V', unknown: 'À vérifier' },
    funding: { none: 'Sans aide', check: 'À vérifier', applied: 'Dossier déposé', approved: 'Accordée', paid: 'Versée' },
  },
  status: { lead: 'Demande', survey: 'Visite technique', quote: 'Devis envoyé', won: 'Commande signée', install: 'Pose', done: 'Terminé', hold: 'En pause', lost: 'Perdu' },
  createProject: 'Créer le projet',
  saveChanges: 'Enregistrer les modifications',
  saved: 'Enregistré',
  unsaved: 'Modifications non enregistrées',
  discard: 'Annuler',
  closeSheet: 'Fermer',
  needNameCustomer: 'Indiquez le nom du projet et le client.',
  candHint: m => `Jusqu’à ${m} modèles — le comparatif ci-dessous se met à jour à chaque ajout. La meilleure valeur de chaque ligne est mise en évidence.`,
  candSearchPh: 'Rechercher un modèle ou un fabricant à ajouter…',
  candNoResults: 'Aucun modèle correspondant.',
  candFull: m => `${m} candidats au maximum — retirez-en un pour en ajouter un autre.`,
  candEmpty: 'Aucun candidat pour l’instant. Recherchez ci-dessus, ou utilisez « Ajouter au projet » sur un produit ou dans votre liste de suivi.',
  candAdd: 'Ajouter',
  choose1: 'Retenir',
  chosen: 'Modèle retenu',
  unchoose: 'Annuler',
  candNotePh: 'Note sur ce modèle…',
  legacyMore: n => (n === 1 ? '1 autre modèle est enregistré dans ce projet (sous le comparatif).' : `${n} autres modèles sont enregistrés dans ce projet (sous le comparatif).`),
  openCompare: 'Ouvrir le grand comparatif',
  taskPh: 'Que faut-il faire ?',
  taskFrequent: 'Tâches fréquentes',
  taskTemplates: ['Visite technique', 'Calcul des déperditions', 'Vérifier le raccordement électrique', 'Envoyer le devis', 'Relancer le devis', 'Dossier d’aides', 'Commander l’appareil', 'Planifier la pose', 'Pose', 'Mise en service', 'Remise au client et documents', 'Facture finale'],
  taskAdd: 'Ajouter',
  taskNone: 'Aucune tâche pour l’instant.',
  taskFull: m => `Un projet contient au maximum ${m} tâches.`,
  due: { overdue: 'en retard', today: 'aujourd’hui', noDate: 'sans date' },
  taskProgress: (d, a) => `${d} sur ${a} terminées`,
  listOpen: 'Projets en cours',
  listAll: 'Tous les projets',
  expand: 'Afficher la liste',
  collapse: 'Masquer la liste',
  colProject: 'Projet', colCustomer: 'Client', colCity: 'Ville', colStatus: 'Statut', colNext: 'Prochaine tâche', colTarget: 'Date de pose', colModels: 'Modèles', colUpdated: 'Modifié',
  filterAll: 'Tous les statuts',
  exportCsv: 'Exporter en CSV',
  listEmptyOpen: 'Aucun projet en cours.',
  listEmptyAll: 'Aucun projet pour l’instant.',
  sumOpen: n => (n <= 1 ? `${n} projet en cours` : `${n} projets en cours`),
  sumDue: n => `${n} à faire sous 7 jours`,
  sumOverdue: n => `${n} en retard`,
  log: {
    created: () => 'Projet créé',
    status: (a, b) => `Statut : ${a} → ${b}`,
    add: a => `Candidat ajouté : ${a}`,
    remove: a => `Candidat retiré : ${a}`,
    select: a => `Modèle retenu : ${a}`,
    unselect: () => 'Choix du modèle annulé',
    details: () => 'Données du projet modifiées',
    task: a => `Tâche ajoutée : ${a}`,
    taskDone: a => `Tâche terminée : ${a}`,
    taskUndone: a => `Tâche rouverte : ${a}`,
    taskRemoved: a => `Tâche supprimée : ${a}`,
  },
  historyEmpty: 'Aucune entrée pour l’instant.',
  recordNote: 'Conservation : les projets sont enregistrés dans votre compte et y restent jusqu’à ce que vous les supprimiez — les projets terminés et perdus restent dans « Tous les projets ». Exportez en CSV pour vos propres dossiers.',
  recordNoteTeam: 'Conservation : les projets sont enregistrés pour toute votre équipe et y restent jusqu’à leur suppression — les projets terminés et perdus restent dans « Tous les projets ». Exportez en CSV pour vos propres dossiers.',
  pdfContact: 'Contact', pdfSite: 'Site', pdfBuilding: 'Bâtiment et installation', pdfStatus: 'Statut', pdfTarget: 'Date de pose', pdfTasks: 'Tâches en cours', pdfChosen: 'Modèle retenu',
  csvCandidates: 'Candidats', csvOpenTasks: 'Tâches en cours', csvCreated: 'Créé',
};

const PL: ProjectFormStrings = {
  subtitle: 'Jedna strona na zlecenie: klient i obiekt, budynek i instalacja, status, do czterech modeli porównanych obok siebie, zadania z terminami — oraz PDF dla klienta.',
  newTitle: 'Nowy projekt',
  newHint: 'Pola oznaczone * są wymagane. Resztę można uzupełnić później.',
  required: 'wymagane',
  choose: '— wybierz —',
  secCustomer: 'Klient i obiekt',
  secBuilding: 'Budynek i instalacja',
  secPlanning: 'Status i plan',
  secCandidates: 'Modele kandydujące',
  secTasks: 'Zadania',
  secHistory: 'Historia',
  fName: 'Nazwa projektu', fCustomer: 'Klient', fPhone: 'Telefon', fEmail: 'E-mail', fAddress: 'Ulica i nr', fPostcode: 'Kod pocztowy', fCity: 'Miejscowość',
  fBuildingType: 'Typ budynku', fProjectType: 'Rodzaj zlecenia', fExisting: 'Obecne ogrzewanie', fDistribution: 'Odbiorniki ciepła', fDhw: 'Ciepła woda użytkowa', fSupply: 'Zasilanie elektryczne',
  fArea: 'Powierzchnia ogrzewana (m²)', fBuildYear: 'Rok budowy', fHeatLoad: 'Zapotrzebowanie na ciepło (kW)',
  fStatus: 'Status', fTarget: 'Planowany termin montażu', fFunding: 'Dofinansowanie', fNotes: 'Notatki',
  opt: {
    buildingType: { detached: 'Dom jednorodzinny', semi: 'Bliźniak', terraced: 'Dom szeregowy', apartment: 'Mieszkanie', multi: 'Budynek wielorodzinny', commercial: 'Budynek usługowy', other: 'Inny' },
    projectType: { replacement: 'Wymiana kotła', newbuild: 'Nowy budynek', hybrid: 'Hybryda (kocioł zostaje)', extension: 'Rozbudowa / drugie urządzenie', other: 'Inne' },
    existing: { gas: 'Kocioł gazowy', oil: 'Kocioł olejowy', electric: 'Ogrzewanie elektryczne', solid: 'Paliwo stałe / drewno', district: 'Ciepło sieciowe', heatpump: 'Pompa ciepła', none: 'Brak' },
    distribution: { underfloor: 'Ogrzewanie podłogowe', radiators: 'Grzejniki', mixed: 'Podłogówka + grzejniki', air: 'Klimakonwektory / powietrze' },
    dhw: { integrated: 'Z pompy ciepła', separate: 'Osobny podgrzewacz', none: 'Poza zakresem zlecenia' },
    supply: { '1ph': 'Jednofazowe 230 V', '3ph': 'Trójfazowe 400 V', unknown: 'Do sprawdzenia' },
    funding: { none: 'Bez dofinansowania', check: 'Do sprawdzenia', applied: 'Wniosek złożony', approved: 'Przyznane', paid: 'Wypłacone' },
  },
  status: { lead: 'Zapytanie', survey: 'Wizja lokalna', quote: 'Oferta wysłana', won: 'Zamówienie', install: 'Montaż', done: 'Zakończony', hold: 'Wstrzymany', lost: 'Utracony' },
  createProject: 'Utwórz projekt',
  saveChanges: 'Zapisz zmiany',
  saved: 'Zapisano',
  unsaved: 'Niezapisane zmiany',
  discard: 'Odrzuć',
  closeSheet: 'Zamknij',
  needNameCustomer: 'Podaj nazwę projektu i klienta.',
  candHint: m => `Do ${m} modeli — porównanie poniżej aktualizuje się przy dodawaniu. Najlepsza wartość w wierszu jest wyróżniona.`,
  candSearchPh: 'Wyszukaj model lub producenta, aby dodać…',
  candNoResults: 'Brak pasującego modelu.',
  candFull: m => `Limit to ${m} kandydatów — usuń jednego, aby dodać kolejnego.`,
  candEmpty: 'Brak kandydatów. Wyszukaj powyżej albo użyj „Dodaj do projektu” przy produkcie lub na liście obserwowanych.',
  candAdd: 'Dodaj',
  choose1: 'Wybierz',
  chosen: 'Wybrany model',
  unchoose: 'Cofnij',
  candNotePh: 'Notatka do tego modelu…',
  legacyMore: n => `Liczba pozostałych modeli zapisanych w tym projekcie: ${n} (pod porównaniem).`,
  openCompare: 'Otwórz duże porównanie',
  taskPh: 'Co trzeba zrobić?',
  taskFrequent: 'Częste zadania',
  taskTemplates: ['Wizja lokalna', 'Obliczenie zapotrzebowania na ciepło', 'Sprawdzić przyłącze elektryczne', 'Wysłać ofertę', 'Przypomnieć o ofercie', 'Wniosek o dofinansowanie', 'Zamówić urządzenie', 'Ustalić termin montażu', 'Montaż', 'Uruchomienie', 'Przekazanie i dokumentacja', 'Faktura końcowa'],
  taskAdd: 'Dodaj',
  taskNone: 'Brak zadań.',
  taskFull: m => `Projekt mieści do ${m} zadań.`,
  due: { overdue: 'po terminie', today: 'dziś', noDate: 'bez terminu' },
  taskProgress: (d, a) => `Wykonano ${d} z ${a}`,
  listOpen: 'Projekty otwarte',
  listAll: 'Wszystkie projekty',
  expand: 'Pokaż listę',
  collapse: 'Ukryj listę',
  colProject: 'Projekt', colCustomer: 'Klient', colCity: 'Miejscowość', colStatus: 'Status', colNext: 'Następne zadanie', colTarget: 'Termin montażu', colModels: 'Modele', colUpdated: 'Zmieniono',
  filterAll: 'Wszystkie statusy',
  exportCsv: 'Eksport CSV',
  listEmptyOpen: 'Brak otwartych projektów.',
  listEmptyAll: 'Brak projektów.',
  sumOpen: n => `Otwarte projekty: ${n}`,
  sumDue: n => `W ciągu 7 dni: ${n}`,
  sumOverdue: n => `Po terminie: ${n}`,
  log: {
    created: () => 'Utworzono projekt',
    status: (a, b) => `Status: ${a} → ${b}`,
    add: a => `Dodano kandydata: ${a}`,
    remove: a => `Usunięto kandydata: ${a}`,
    select: a => `Wybrano model: ${a}`,
    unselect: () => 'Cofnięto wybór modelu',
    details: () => 'Zmieniono dane projektu',
    task: a => `Dodano zadanie: ${a}`,
    taskDone: a => `Wykonano zadanie: ${a}`,
    taskUndone: a => `Ponownie otwarto zadanie: ${a}`,
    taskRemoved: a => `Usunięto zadanie: ${a}`,
  },
  historyEmpty: 'Brak wpisów.',
  recordNote: 'Przechowywanie: projekty są zapisane na Twoim koncie i pozostają tam do chwili usunięcia — zakończone i utracone projekty zostają w „Wszystkie projekty”. Do własnej dokumentacji użyj eksportu CSV.',
  recordNoteTeam: 'Przechowywanie: projekty są zapisane dla całego zespołu i pozostają do chwili usunięcia — zakończone i utracone projekty zostają w „Wszystkie projekty”. Do własnej dokumentacji użyj eksportu CSV.',
  pdfContact: 'Kontakt', pdfSite: 'Obiekt', pdfBuilding: 'Budynek i instalacja', pdfStatus: 'Status', pdfTarget: 'Termin montażu', pdfTasks: 'Otwarte zadania', pdfChosen: 'Wybrany model',
  csvCandidates: 'Kandydaci', csvOpenTasks: 'Otwarte zadania', csvCreated: 'Utworzono',
};

const IT: ProjectFormStrings = {
  subtitle: 'Una pagina per ogni lavoro: cliente e cantiere, edificio e impianto, stato, fino a quattro modelli candidati a confronto, attività con scadenze — e un PDF per il cliente.',
  newTitle: 'Nuovo progetto',
  newHint: 'I campi contrassegnati con * sono obbligatori. Il resto si può completare in seguito.',
  required: 'obbligatorio',
  choose: '— seleziona —',
  secCustomer: 'Cliente e cantiere',
  secBuilding: 'Edificio e impianto',
  secPlanning: 'Stato e pianificazione',
  secCandidates: 'Modelli candidati',
  secTasks: 'Attività',
  secHistory: 'Cronologia',
  fName: 'Nome del progetto', fCustomer: 'Cliente', fPhone: 'Telefono', fEmail: 'E-mail', fAddress: 'Via e n.', fPostcode: 'CAP', fCity: 'Comune',
  fBuildingType: 'Tipo di edificio', fProjectType: 'Tipo di intervento', fExisting: 'Riscaldamento esistente', fDistribution: 'Terminali', fDhw: 'Acqua calda sanitaria', fSupply: 'Alimentazione elettrica',
  fArea: 'Superficie riscaldata (m²)', fBuildYear: 'Anno di costruzione', fHeatLoad: 'Carico termico (kW)',
  fStatus: 'Stato', fTarget: 'Data di installazione prevista', fFunding: 'Incentivi', fNotes: 'Note',
  opt: {
    buildingType: { detached: 'Casa unifamiliare', semi: 'Bifamiliare', terraced: 'Casa a schiera', apartment: 'Appartamento', multi: 'Condominio', commercial: 'Edificio commerciale', other: 'Altro' },
    projectType: { replacement: 'Sostituzione caldaia', newbuild: 'Nuova costruzione', hybrid: 'Ibrido (la caldaia resta)', extension: 'Ampliamento / seconda unità', other: 'Altro' },
    existing: { gas: 'Caldaia a gas', oil: 'Caldaia a gasolio', electric: 'Riscaldamento elettrico', solid: 'Legna / combustibile solido', district: 'Teleriscaldamento', heatpump: 'Pompa di calore', none: 'Nessuno' },
    distribution: { underfloor: 'Pavimento radiante', radiators: 'Radiatori', mixed: 'Pavimento + radiatori', air: 'Ventilconvettori / aria' },
    dhw: { integrated: 'Dalla pompa di calore', separate: 'Scaldacqua separato', none: 'Non compresa' },
    supply: { '1ph': 'Monofase 230 V', '3ph': 'Trifase 400 V', unknown: 'Da verificare' },
    funding: { none: 'Nessun incentivo', check: 'Da verificare', applied: 'Domanda presentata', approved: 'Approvato', paid: 'Erogato' },
  },
  status: { lead: 'Richiesta', survey: 'Sopralluogo', quote: 'Preventivo inviato', won: 'Ordine confermato', install: 'Installazione', done: 'Concluso', hold: 'In sospeso', lost: 'Perso' },
  createProject: 'Crea progetto',
  saveChanges: 'Salva modifiche',
  saved: 'Salvato',
  unsaved: 'Modifiche non salvate',
  discard: 'Annulla',
  closeSheet: 'Chiudi',
  needNameCustomer: 'Inserisci il nome del progetto e il cliente.',
  candHint: m => `Fino a ${m} modelli — il confronto qui sotto si aggiorna a ogni aggiunta. Il valore migliore di ogni riga è evidenziato.`,
  candSearchPh: 'Cerca un modello o un produttore da aggiungere…',
  candNoResults: 'Nessun modello corrispondente.',
  candFull: m => `${m} candidati è il limite — rimuovine uno per aggiungerne un altro.`,
  candEmpty: 'Nessun candidato. Cerca qui sopra, oppure usa «Aggiungi al progetto» su un prodotto o nella tua lista di monitoraggio.',
  candAdd: 'Aggiungi',
  choose1: 'Scegli',
  chosen: 'Modello scelto',
  unchoose: 'Annulla',
  candNotePh: 'Nota su questo modello…',
  legacyMore: n => (n === 1 ? 'In questo progetto è salvato 1 altro modello (sotto il confronto).' : `In questo progetto sono salvati altri ${n} modelli (sotto il confronto).`),
  openCompare: 'Apri il confronto grande',
  taskPh: 'Cosa c’è da fare?',
  taskFrequent: 'Attività frequenti',
  taskTemplates: ['Sopralluogo', 'Calcolo del carico termico', 'Verificare l’allacciamento elettrico', 'Inviare il preventivo', 'Sollecitare il preventivo', 'Domanda di incentivo', 'Ordinare l’unità', 'Fissare l’installazione', 'Installazione', 'Messa in servizio', 'Consegna e documentazione', 'Fattura finale'],
  taskAdd: 'Aggiungi',
  taskNone: 'Nessuna attività.',
  taskFull: m => `Un progetto contiene fino a ${m} attività.`,
  due: { overdue: 'scaduta', today: 'oggi', noDate: 'senza data' },
  taskProgress: (d, a) => `${d} di ${a} completate`,
  listOpen: 'Progetti aperti',
  listAll: 'Tutti i progetti',
  expand: 'Mostra elenco',
  collapse: 'Nascondi elenco',
  colProject: 'Progetto', colCustomer: 'Cliente', colCity: 'Comune', colStatus: 'Stato', colNext: 'Prossima attività', colTarget: 'Data installazione', colModels: 'Modelli', colUpdated: 'Modificato',
  filterAll: 'Tutti gli stati',
  exportCsv: 'Esporta CSV',
  listEmptyOpen: 'Nessun progetto aperto.',
  listEmptyAll: 'Nessun progetto.',
  sumOpen: n => (n === 1 ? '1 progetto aperto' : `${n} progetti aperti`),
  sumDue: n => `${n} in scadenza entro 7 giorni`,
  sumOverdue: n => (n === 1 ? '1 scaduta' : `${n} scadute`),
  log: {
    created: () => 'Progetto creato',
    status: (a, b) => `Stato: ${a} → ${b}`,
    add: a => `Candidato aggiunto: ${a}`,
    remove: a => `Candidato rimosso: ${a}`,
    select: a => `Modello scelto: ${a}`,
    unselect: () => 'Scelta del modello annullata',
    details: () => 'Dati del progetto modificati',
    task: a => `Attività aggiunta: ${a}`,
    taskDone: a => `Attività completata: ${a}`,
    taskUndone: a => `Attività riaperta: ${a}`,
    taskRemoved: a => `Attività eliminata: ${a}`,
  },
  historyEmpty: 'Nessuna voce.',
  recordNote: 'Conservazione: i progetti sono salvati nel tuo account e restano finché non li elimini — i progetti conclusi e persi restano in «Tutti i progetti». Per il tuo archivio, esporta in CSV.',
  recordNoteTeam: 'Conservazione: i progetti sono salvati per tutto il team e restano finché qualcuno non li elimina — i progetti conclusi e persi restano in «Tutti i progetti». Per il tuo archivio, esporta in CSV.',
  pdfContact: 'Contatto', pdfSite: 'Cantiere', pdfBuilding: 'Edificio e impianto', pdfStatus: 'Stato', pdfTarget: 'Data installazione', pdfTasks: 'Attività aperte', pdfChosen: 'Modello scelto',
  csvCandidates: 'Candidati', csvOpenTasks: 'Attività aperte', csvCreated: 'Creato',
};

const TABLE: Record<FeatureLang, ProjectFormStrings> = { en: EN, de: DE, fr: FR, pl: PL, it: IT };
export const projectFormStrings = (lang: Language | string): ProjectFormStrings => pick(TABLE, lang);
