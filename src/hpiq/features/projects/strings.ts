/**
 * Projects (customer shortlists) strings — EN/DE/FR/PL/IT via `pick`.
 */
import { pick, FeatureLang } from '../lang';
import type { Language } from '../../../types';

export interface ProjectStrings {
  title: string;
  subtitle: string;
  shared: string;
  personal: string;
  newProject: string;
  namePh: string;
  customerPh: string;
  notesPh: string;
  create: string;
  cancel: string;
  save: string;
  edit: string;
  del: string;
  confirmDelete: (name: string) => string;
  empty: string;
  models: (n: number) => string;
  updated: (d: string) => string;
  back: string;
  colModel: string;
  colMfr: string;
  colKw: string;
  colScop: string;
  colSound: string;
  colRef: string;
  colListing: string;
  colNote: string;
  gone: string;
  notePh: string;
  remove: string;
  open: string;
  compareSel: (n: number) => string;
  compareHint: string;
  compareSegment: string;
  pdf: string;
  noItems: string;
  addTo: string;
  addToN: (n: number) => string;
  added: (name: string) => string;
  addedSome: (added: number, name: string) => string;
  already: (name: string) => string;
  full: (max: number) => string;
  createAndAdd: string;
  saveFailed: string;
  loadFailed: string;
  teaserTitle: string;
  teaserBody: string;
  unlock: string;
  previewNote: string;
  pdfTitle: string;
  pdfCustomer: string;
  pdfGenerated: string;
  pdfNotes: string;
  /** Compact column labels for the PDF table (narrow A4 columns). */
  pdfColKw: string;
  pdfColSound: string;
  pdfDisclaimer: string;
  pdfFailed: string;
}

const EN: ProjectStrings = {
  title: 'Projects',
  subtitle: 'Customer shortlists — collect candidate models per job, add notes, compare them and hand over a PDF.',
  shared: 'Shared with your team',
  personal: 'Only visible to you',
  newProject: 'New project',
  namePh: 'Project name',
  customerPh: 'Customer (optional)',
  notesPh: 'Notes (optional)',
  create: 'Create',
  cancel: 'Cancel',
  save: 'Save',
  edit: 'Edit',
  del: 'Delete',
  confirmDelete: n => `Delete the project “${n}”? This cannot be undone.`,
  empty: 'No projects yet. Create one here, or use “Add to project” on any product.',
  models: n => (n === 1 ? '1 model' : `${n} models`),
  updated: d => `Updated ${d}`,
  back: '‹ All projects',
  colModel: 'Model',
  colMfr: 'Manufacturer',
  colKw: 'Rated kW',
  colScop: 'SCOP',
  colSound: 'Sound power',
  colRef: 'Refrigerant',
  colListing: 'Listing',
  colNote: 'Note',
  gone: 'No longer in the current catalogue',
  notePh: 'Add a note…',
  remove: 'Remove',
  open: 'Open',
  compareSel: n => `Compare selected (${n})`,
  compareHint: 'Tick 2–4 models to compare them side by side.',
  compareSegment: 'A comparison stays within one segment — models from the other segment were left out.',
  pdf: 'Project PDF',
  noItems: 'No models in this project yet. Open a product and use “Add to project”.',
  addTo: 'Add to project',
  addToN: n => `Add ${n} to project`,
  added: n => `Added to “${n}”`,
  addedSome: (a, n) => `${a} added to “${n}” (others were already in it)`,
  already: n => `Already in “${n}”`,
  full: m => `This project already has ${m} candidates — remove one first.`,
  createAndAdd: 'Create & add',
  saveFailed: 'Could not save — please try again.',
  loadFailed: 'Projects could not be loaded.',
  teaserTitle: 'Projects are part of Premium',
  teaserBody: 'One page per job: customer and site, building data, status and to-dos with due dates, up to four candidate models compared side by side — shared with your team, with a project PDF for the customer.',
  unlock: 'Unlock projects',
  previewNote: 'Preview mode — projects are kept in memory only.',
  pdfTitle: 'Project sheet',
  pdfCustomer: 'Customer',
  pdfGenerated: 'Generated',
  pdfNotes: 'Notes',
  pdfColKw: 'Rated kW',
  pdfColSound: 'Sound',
  pdfDisclaimer: 'Technical values as published in the HeatPump DB catalogue on the date above. Confirm specifications and national listing status with the manufacturer and the official list before quoting.',
  pdfFailed: 'The PDF could not be created.',
};

const DE: ProjectStrings = {
  title: 'Projekte',
  subtitle: 'Kunden-Auswahllisten – Kandidaten je Auftrag sammeln, Notizen ergänzen, vergleichen und als PDF übergeben.',
  shared: 'Mit Ihrem Team geteilt',
  personal: 'Nur für Sie sichtbar',
  newProject: 'Neues Projekt',
  namePh: 'Projektname',
  customerPh: 'Kunde (optional)',
  notesPh: 'Notizen (optional)',
  create: 'Anlegen',
  cancel: 'Abbrechen',
  save: 'Speichern',
  edit: 'Bearbeiten',
  del: 'Löschen',
  confirmDelete: n => `Projekt „${n}“ löschen? Das lässt sich nicht rückgängig machen.`,
  empty: 'Noch keine Projekte. Legen Sie hier eines an oder nutzen Sie „Zu Projekt hinzufügen“ bei einem Produkt.',
  models: n => (n === 1 ? '1 Modell' : `${n} Modelle`),
  updated: d => `Aktualisiert ${d}`,
  back: '‹ Alle Projekte',
  colModel: 'Modell',
  colMfr: 'Hersteller',
  colKw: 'Nennleistung kW',
  colScop: 'SCOP',
  colSound: 'Schallleistung',
  colRef: 'Kältemittel',
  colListing: 'Listung',
  colNote: 'Notiz',
  gone: 'Nicht mehr im aktuellen Katalog',
  notePh: 'Notiz hinzufügen…',
  remove: 'Entfernen',
  open: 'Öffnen',
  compareSel: n => `Auswahl vergleichen (${n})`,
  compareHint: '2–4 Modelle ankreuzen, um sie nebeneinander zu vergleichen.',
  compareSegment: 'Ein Vergleich bleibt in einem Segment – Modelle aus dem anderen Segment wurden ausgelassen.',
  pdf: 'Projekt-PDF',
  noItems: 'Noch keine Modelle in diesem Projekt. Öffnen Sie ein Produkt und nutzen Sie „Zu Projekt hinzufügen“.',
  addTo: 'Zu Projekt hinzufügen',
  addToN: n => `${n} zu Projekt hinzufügen`,
  added: n => `Zu „${n}“ hinzugefügt`,
  addedSome: (a, n) => `${a} zu „${n}“ hinzugefügt (weitere waren schon enthalten)`,
  already: n => `Bereits in „${n}“`,
  full: m => `Dieses Projekt hat bereits ${m} Kandidaten — bitte zuerst einen entfernen.`,
  createAndAdd: 'Anlegen & hinzufügen',
  saveFailed: 'Speichern fehlgeschlagen – bitte erneut versuchen.',
  loadFailed: 'Projekte konnten nicht geladen werden.',
  teaserTitle: 'Projekte sind Teil von Premium',
  teaserBody: 'Eine Seite pro Auftrag: Kunde und Objekt, Gebäudedaten, Status und Aufgaben mit Terminen, bis zu vier Kandidaten im direkten Vergleich — mit dem Team geteilt, mit Projekt-PDF für den Kunden.',
  unlock: 'Projekte freischalten',
  previewNote: 'Vorschaumodus – Projekte werden nur im Speicher gehalten.',
  pdfTitle: 'Projektblatt',
  pdfCustomer: 'Kunde',
  pdfGenerated: 'Erstellt',
  pdfNotes: 'Notizen',
  pdfColKw: 'kW (Nenn)',
  pdfColSound: 'Schall',
  pdfDisclaimer: 'Technische Werte wie im HeatPump-DB-Katalog zum obigen Datum veröffentlicht. Spezifikationen und Listungsstatus vor einem Angebot beim Hersteller und in der offiziellen Liste bestätigen.',
  pdfFailed: 'Das PDF konnte nicht erstellt werden.',
};

const FR: ProjectStrings = {
  title: 'Projets',
  subtitle: 'Présélections client – regroupez les modèles candidats par chantier, annotez, comparez et remettez un PDF.',
  shared: 'Partagé avec votre équipe',
  personal: 'Visible par vous seul',
  newProject: 'Nouveau projet',
  namePh: 'Nom du projet',
  customerPh: 'Client (facultatif)',
  notesPh: 'Notes (facultatif)',
  create: 'Créer',
  cancel: 'Annuler',
  save: 'Enregistrer',
  edit: 'Modifier',
  del: 'Supprimer',
  confirmDelete: n => `Supprimer le projet « ${n} » ? Cette action est définitive.`,
  empty: 'Aucun projet pour l’instant. Créez-en un ici ou utilisez « Ajouter au projet » sur une fiche produit.',
  models: n => (n <= 1 ? `${n} modèle` : `${n} modèles`),
  updated: d => `Mis à jour le ${d}`,
  back: '‹ Tous les projets',
  colModel: 'Modèle',
  colMfr: 'Fabricant',
  colKw: 'Puissance kW',
  colScop: 'SCOP',
  colSound: 'Puissance acoustique',
  colRef: 'Réfrigérant',
  colListing: 'Référencement',
  colNote: 'Note',
  gone: 'N’est plus dans le catalogue actuel',
  notePh: 'Ajouter une note…',
  remove: 'Retirer',
  open: 'Ouvrir',
  compareSel: n => `Comparer la sélection (${n})`,
  compareHint: 'Cochez 2 à 4 modèles pour les comparer côte à côte.',
  compareSegment: 'Une comparaison reste dans un seul segment – les modèles de l’autre segment ont été écartés.',
  pdf: 'PDF du projet',
  noItems: 'Aucun modèle dans ce projet. Ouvrez une fiche produit et utilisez « Ajouter au projet ».',
  addTo: 'Ajouter au projet',
  addToN: n => `Ajouter ${n} au projet`,
  added: n => `Ajouté à « ${n} »`,
  addedSome: (a, n) => `${a} ajouté(s) à « ${n} » (les autres y étaient déjà)`,
  already: n => `Déjà dans « ${n} »`,
  full: m => `Ce projet compte déjà ${m} candidats — retirez-en un d’abord.`,
  createAndAdd: 'Créer et ajouter',
  saveFailed: 'Enregistrement impossible – veuillez réessayer.',
  loadFailed: 'Impossible de charger les projets.',
  teaserTitle: 'Les projets font partie de Premium',
  teaserBody: 'Une page par chantier : client et site, données du bâtiment, statut et tâches avec échéances, jusqu’à quatre modèles candidats comparés côte à côte — partagée avec votre équipe, avec un PDF du projet pour le client.',
  unlock: 'Débloquer les projets',
  previewNote: 'Mode aperçu – les projets sont conservés en mémoire uniquement.',
  pdfTitle: 'Fiche projet',
  pdfCustomer: 'Client',
  pdfGenerated: 'Généré le',
  pdfNotes: 'Notes',
  pdfColKw: 'kW nom.',
  pdfColSound: 'Son',
  pdfDisclaimer: 'Valeurs techniques telles que publiées dans le catalogue HeatPump DB à la date ci-dessus. Vérifiez les caractéristiques et le référencement national auprès du fabricant et de la liste officielle avant tout devis.',
  pdfFailed: 'Le PDF n’a pas pu être créé.',
};

const PL: ProjectStrings = {
  title: 'Projekty',
  subtitle: 'Listy wyboru dla klientów – zbieraj modele dla każdego zlecenia, dodawaj notatki, porównuj i przekazuj PDF.',
  shared: 'Udostępnione zespołowi',
  personal: 'Widoczne tylko dla Ciebie',
  newProject: 'Nowy projekt',
  namePh: 'Nazwa projektu',
  customerPh: 'Klient (opcjonalnie)',
  notesPh: 'Notatki (opcjonalnie)',
  create: 'Utwórz',
  cancel: 'Anuluj',
  save: 'Zapisz',
  edit: 'Edytuj',
  del: 'Usuń',
  confirmDelete: n => `Usunąć projekt „${n}”? Tej operacji nie można cofnąć.`,
  empty: 'Brak projektów. Utwórz projekt tutaj lub użyj „Dodaj do projektu” przy dowolnym produkcie.',
  models: n => `Modele: ${n}`,
  updated: d => `Zaktualizowano ${d}`,
  back: '‹ Wszystkie projekty',
  colModel: 'Model',
  colMfr: 'Producent',
  colKw: 'Moc znam. kW',
  colScop: 'SCOP',
  colSound: 'Moc akustyczna',
  colRef: 'Czynnik',
  colListing: 'Lista',
  colNote: 'Notatka',
  gone: 'Nie ma go już w aktualnym katalogu',
  notePh: 'Dodaj notatkę…',
  remove: 'Usuń',
  open: 'Otwórz',
  compareSel: n => `Porównaj zaznaczone (${n})`,
  compareHint: 'Zaznacz 2–4 modele, aby porównać je obok siebie.',
  compareSegment: 'Porównanie obejmuje jeden segment – modele z drugiego segmentu pominięto.',
  pdf: 'PDF projektu',
  noItems: 'Ten projekt nie zawiera jeszcze modeli. Otwórz produkt i użyj „Dodaj do projektu”.',
  addTo: 'Dodaj do projektu',
  addToN: n => `Dodaj ${n} do projektu`,
  added: n => `Dodano do „${n}”`,
  addedSome: (a, n) => `Dodano ${a} do „${n}” (pozostałe już tam były)`,
  already: n => `Już w „${n}”`,
  full: m => `Ten projekt ma już ${m} kandydatów — najpierw usuń jednego.`,
  createAndAdd: 'Utwórz i dodaj',
  saveFailed: 'Nie udało się zapisać – spróbuj ponownie.',
  loadFailed: 'Nie udało się wczytać projektów.',
  teaserTitle: 'Projekty są częścią Premium',
  teaserBody: 'Jedna strona na zlecenie: klient i obiekt, dane budynku, status i zadania z terminami, do czterech modeli porównanych obok siebie — wspólna dla zespołu, z PDF-em projektu dla klienta.',
  unlock: 'Odblokuj projekty',
  previewNote: 'Tryb podglądu – projekty są przechowywane tylko w pamięci.',
  pdfTitle: 'Karta projektu',
  pdfCustomer: 'Klient',
  pdfGenerated: 'Wygenerowano',
  pdfNotes: 'Notatki',
  pdfColKw: 'kW znam.',
  pdfColSound: 'Hałas',
  pdfDisclaimer: 'Wartości techniczne według katalogu HeatPump DB na powyższą datę. Przed ofertą potwierdź dane i status na liście krajowej u producenta i w oficjalnym wykazie.',
  pdfFailed: 'Nie udało się utworzyć pliku PDF.',
};

const IT: ProjectStrings = {
  title: 'Progetti',
  subtitle: 'Liste di selezione per cliente – raccogli i modelli candidati per commessa, annota, confronta e consegna un PDF.',
  shared: 'Condiviso con il tuo team',
  personal: 'Visibile solo a te',
  newProject: 'Nuovo progetto',
  namePh: 'Nome del progetto',
  customerPh: 'Cliente (facoltativo)',
  notesPh: 'Note (facoltative)',
  create: 'Crea',
  cancel: 'Annulla',
  save: 'Salva',
  edit: 'Modifica',
  del: 'Elimina',
  confirmDelete: n => `Eliminare il progetto «${n}»? L’operazione è definitiva.`,
  empty: 'Nessun progetto. Creane uno qui oppure usa «Aggiungi al progetto» su un prodotto.',
  models: n => (n === 1 ? '1 modello' : `${n} modelli`),
  updated: d => `Aggiornato il ${d}`,
  back: '‹ Tutti i progetti',
  colModel: 'Modello',
  colMfr: 'Produttore',
  colKw: 'Potenza kW',
  colScop: 'SCOP',
  colSound: 'Potenza sonora',
  colRef: 'Refrigerante',
  colListing: 'Catalogo',
  colNote: 'Nota',
  gone: 'Non più presente nel catalogo attuale',
  notePh: 'Aggiungi una nota…',
  remove: 'Rimuovi',
  open: 'Apri',
  compareSel: n => `Confronta selezionati (${n})`,
  compareHint: 'Seleziona 2–4 modelli per confrontarli fianco a fianco.',
  compareSegment: 'Un confronto resta in un solo segmento – i modelli dell’altro segmento sono stati esclusi.',
  pdf: 'PDF del progetto',
  noItems: 'Nessun modello in questo progetto. Apri un prodotto e usa «Aggiungi al progetto».',
  addTo: 'Aggiungi al progetto',
  addToN: n => `Aggiungi ${n} al progetto`,
  added: n => `Aggiunto a «${n}»`,
  addedSome: (a, n) => `${a} aggiunti a «${n}» (gli altri erano già presenti)`,
  already: n => `Già in «${n}»`,
  full: m => `Questo progetto ha già ${m} candidati — rimuovine prima uno.`,
  createAndAdd: 'Crea e aggiungi',
  saveFailed: 'Salvataggio non riuscito – riprova.',
  loadFailed: 'Impossibile caricare i progetti.',
  teaserTitle: 'I progetti fanno parte di Premium',
  teaserBody: 'Una pagina per ogni lavoro: cliente e cantiere, dati dell’edificio, stato e attività con scadenze, fino a quattro modelli candidati a confronto — condivisa con il team, con un PDF di progetto per il cliente.',
  unlock: 'Sblocca i progetti',
  previewNote: 'Modalità anteprima – i progetti restano solo in memoria.',
  pdfTitle: 'Scheda progetto',
  pdfCustomer: 'Cliente',
  pdfGenerated: 'Generato il',
  pdfNotes: 'Note',
  pdfColKw: 'kW nom.',
  pdfColSound: 'Rumore',
  pdfDisclaimer: 'Valori tecnici come pubblicati nel catalogo HeatPump DB alla data indicata. Verifica specifiche e stato nel catalogo nazionale presso il produttore e l’elenco ufficiale prima di un preventivo.',
  pdfFailed: 'Impossibile creare il PDF.',
};

const TABLE: Record<FeatureLang, ProjectStrings> = { en: EN, de: DE, fr: FR, pl: PL, it: IT };
export const projectStrings = (lang: Language | string): ProjectStrings => pick(TABLE, lang);
