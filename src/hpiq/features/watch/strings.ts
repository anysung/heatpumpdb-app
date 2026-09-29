/** Watchlist + change alerts — five-language strings (see features/lang.ts). */
import type { Language } from '../../../types';
import { pick, FeatureLang } from '../lang';

export interface WatchStrings {
  watchModel: string;
  watching: string;
  watchMfr: (mfr: string) => string;
  watchingMfr: (mfr: string) => string;
  added: string;
  removed: string;
  limit: (n: number) => string;
  failed: string;
  tabProjects: string;
  tabWatchlist: string;
  title: string;
  sub: string;
  models: string;
  manufacturers: string;
  emptyTitle: string;
  emptyBody: string;
  emptyMfr: string;
  remove: string;
  open: string;
  modelsCount: (n: number) => string;
  notInCatalogue: string;
  emailAlerts: string;
  emailAlertsHint: string;
  latestTitle: (month: string) => string;
  latestNone: string;
  latestNoData: string;
  badgeListing: string;
  badgeAdded: string;
  badgeRemoved: string;
  badgeSpecs: string;
  changedSpecs: (fields: string) => string;
  listingFromTo: (from: string, to: string) => string;
  teaserTitle: string;
  teaserBody: string;
  teaserCta: string;
  colModel: string;
  colKw: string;
  colScop: string;
  colListing: string;
  capacity: string;
  used: (n: number, max: number) => string;
  mfrChanged: (n: number) => string;
  latestHeading: string;
}

const T: Record<FeatureLang, WatchStrings> = {
  en: {
    watchModel: 'Watch model', watching: 'Watching',
    watchMfr: (m) => `Watch all ${m} models`, watchingMfr: (m) => `Watching ${m}`,
    added: 'Added to your watchlist', removed: 'Removed from your watchlist',
    limit: (n) => `Your watchlist is full (${n} entries). Remove one first.`,
    failed: 'Could not update the watchlist. Please try again.',
    tabProjects: 'Projects', tabWatchlist: 'Watchlist',
    title: 'Watchlist', sub: 'Models and manufacturers you follow. After each monthly data update you see — and can be emailed — what changed.',
    models: 'Watched models', manufacturers: 'Watched manufacturers',
    emptyTitle: 'Nothing watched yet',
    emptyBody: 'Open a model in Products and choose “Watch model” — or follow a whole manufacturer from the same menu.',
    emptyMfr: 'No manufacturers followed.',
    remove: 'Remove', open: 'Open',
    modelsCount: (n) => `${n} ${n === 1 ? 'model' : 'models'} in the catalogue`,
    notInCatalogue: 'No longer in the current catalogue',
    emailAlerts: 'Email me when something I watch changes',
    emailAlertsHint: 'One email after the monthly data update, only if a watched item changed.',
    latestTitle: (m) => `Changed in the ${m} update`,
    latestNone: 'None of your watched items changed in the latest update.',
    latestNoData: 'Change information appears here after the next monthly data update.',
    badgeListing: 'Listing changed', badgeAdded: 'New', badgeRemoved: 'Removed', badgeSpecs: 'Specs updated',
    changedSpecs: (f) => `Updated: ${f}`, listingFromTo: (a, b) => `${a} → ${b}`,
    teaserTitle: 'Keep an eye on models and manufacturers',
    teaserBody: 'Premium members watch models and whole manufacturers and get an email when a listing status, a specification or the range changes in the monthly data update.',
    teaserCta: 'See Premium',
    colModel: 'Model', colKw: 'kW', colScop: 'SCOP', colListing: 'Listing',
    capacity: 'Rated capacity', used: (n, max) => `${n} / ${max} entries`,
    mfrChanged: (n) => `${n} ${n === 1 ? 'model' : 'models'} changed`, latestHeading: 'Latest data update',
  },
  de: {
    watchModel: 'Modell merken', watching: 'Gemerkt',
    watchMfr: (m) => `Alle ${m}-Modelle beobachten`, watchingMfr: (m) => `${m} wird beobachtet`,
    added: 'Zur Merkliste hinzugefügt', removed: 'Von der Merkliste entfernt',
    limit: (n) => `Ihre Merkliste ist voll (${n} Einträge). Bitte zuerst einen entfernen.`,
    failed: 'Die Merkliste konnte nicht aktualisiert werden. Bitte erneut versuchen.',
    tabProjects: 'Projekte', tabWatchlist: 'Merkliste',
    title: 'Merkliste', sub: 'Modelle und Hersteller, die Sie beobachten. Nach jedem monatlichen Datenupdate sehen Sie – auch per E-Mail –, was sich geändert hat.',
    models: 'Gemerkte Modelle', manufacturers: 'Beobachtete Hersteller',
    emptyTitle: 'Noch nichts gemerkt',
    emptyBody: 'Öffnen Sie ein Modell unter Produkte und wählen Sie „Modell merken“ – oder beobachten Sie dort gleich den ganzen Hersteller.',
    emptyMfr: 'Keine Hersteller beobachtet.',
    remove: 'Entfernen', open: 'Öffnen',
    modelsCount: (n) => `${n} ${n === 1 ? 'Modell' : 'Modelle'} im Katalog`,
    notInCatalogue: 'Nicht mehr im aktuellen Katalog',
    emailAlerts: 'E-Mail, wenn sich etwas Gemerktes ändert',
    emailAlertsHint: 'Eine E-Mail nach dem monatlichen Datenupdate – nur wenn sich ein gemerkter Eintrag geändert hat.',
    latestTitle: (m) => `Geändert im Update ${m}`,
    latestNone: 'Keiner Ihrer gemerkten Einträge hat sich im letzten Update geändert.',
    latestNoData: 'Änderungen erscheinen hier nach dem nächsten monatlichen Datenupdate.',
    badgeListing: 'Listung geändert', badgeAdded: 'Neu', badgeRemoved: 'Entfernt', badgeSpecs: 'Daten aktualisiert',
    changedSpecs: (f) => `Aktualisiert: ${f}`, listingFromTo: (a, b) => `${a} → ${b}`,
    teaserTitle: 'Modelle und Hersteller im Blick behalten',
    teaserBody: 'Premium-Mitglieder merken sich Modelle und ganze Hersteller und erhalten eine E-Mail, wenn sich im monatlichen Datenupdate ein Listungsstatus, technische Daten oder das Sortiment ändern.',
    teaserCta: 'Premium ansehen',
    colModel: 'Modell', colKw: 'kW', colScop: 'SCOP', colListing: 'Listung',
    capacity: 'Nennleistung', used: (n, max) => `${n} / ${max} Einträge`,
    mfrChanged: (n) => `${n} ${n === 1 ? 'Modell' : 'Modelle'} geändert`, latestHeading: 'Letztes Datenupdate',
  },
  fr: {
    watchModel: 'Suivre le modèle', watching: 'Suivi',
    watchMfr: (m) => `Suivre tous les modèles ${m}`, watchingMfr: (m) => `${m} suivi`,
    added: 'Ajouté à votre liste de suivi', removed: 'Retiré de votre liste de suivi',
    limit: (n) => `Votre liste de suivi est pleine (${n} entrées). Retirez-en une d’abord.`,
    failed: 'Impossible de mettre à jour la liste de suivi. Veuillez réessayer.',
    tabProjects: 'Projets', tabWatchlist: 'Suivi',
    title: 'Liste de suivi', sub: 'Les modèles et fabricants que vous suivez. Après chaque mise à jour mensuelle des données, vous voyez — et pouvez recevoir par e-mail — ce qui a changé.',
    models: 'Modèles suivis', manufacturers: 'Fabricants suivis',
    emptyTitle: 'Aucun suivi pour l’instant',
    emptyBody: 'Ouvrez un modèle dans Produits et choisissez « Suivre le modèle » — ou suivez tout un fabricant depuis le même menu.',
    emptyMfr: 'Aucun fabricant suivi.',
    remove: 'Retirer', open: 'Ouvrir',
    modelsCount: (n) => `${n} ${n === 1 ? 'modèle' : 'modèles'} au catalogue`,
    notInCatalogue: 'N’est plus dans le catalogue actuel',
    emailAlerts: 'M’avertir par e-mail quand un élément suivi change',
    emailAlertsHint: 'Un e-mail après la mise à jour mensuelle, uniquement si un élément suivi a changé.',
    latestTitle: (m) => `Modifié lors de la mise à jour de ${m}`,
    latestNone: 'Aucun de vos éléments suivis n’a changé lors de la dernière mise à jour.',
    latestNoData: 'Les modifications apparaîtront ici après la prochaine mise à jour mensuelle.',
    badgeListing: 'Statut modifié', badgeAdded: 'Nouveau', badgeRemoved: 'Retiré', badgeSpecs: 'Données mises à jour',
    changedSpecs: (f) => `Mis à jour : ${f}`, listingFromTo: (a, b) => `${a} → ${b}`,
    teaserTitle: 'Gardez un œil sur les modèles et les fabricants',
    teaserBody: 'Les membres Premium suivent des modèles et des fabricants entiers et reçoivent un e-mail quand un statut, une caractéristique ou la gamme change lors de la mise à jour mensuelle.',
    teaserCta: 'Découvrir Premium',
    colModel: 'Modèle', colKw: 'kW', colScop: 'SCOP', colListing: 'Statut',
    capacity: 'Puissance nominale', used: (n, max) => `${n} / ${max} entrées`,
    mfrChanged: (n) => `${n} ${n === 1 ? 'modèle modifié' : 'modèles modifiés'}`, latestHeading: 'Dernière mise à jour des données',
  },
  pl: {
    watchModel: 'Obserwuj model', watching: 'Obserwowany',
    watchMfr: (m) => `Obserwuj wszystkie modele ${m}`, watchingMfr: (m) => `Obserwujesz ${m}`,
    added: 'Dodano do listy obserwowanych', removed: 'Usunięto z listy obserwowanych',
    limit: (n) => `Lista obserwowanych jest pełna (${n} pozycji). Najpierw usuń jedną.`,
    failed: 'Nie udało się zaktualizować listy. Spróbuj ponownie.',
    tabProjects: 'Projekty', tabWatchlist: 'Obserwowane',
    title: 'Obserwowane', sub: 'Modele i producenci, których obserwujesz. Po każdej miesięcznej aktualizacji danych zobaczysz — także e-mailem — co się zmieniło.',
    models: 'Obserwowane modele', manufacturers: 'Obserwowani producenci',
    emptyTitle: 'Jeszcze nic nie obserwujesz',
    emptyBody: 'Otwórz model w Produktach i wybierz „Obserwuj model” — albo obserwuj od razu całego producenta.',
    emptyMfr: 'Brak obserwowanych producentów.',
    remove: 'Usuń', open: 'Otwórz',
    modelsCount: (n) => `${n} ${n === 1 ? 'model' : 'modele/modeli'} w katalogu`,
    notInCatalogue: 'Nie ma go już w aktualnym katalogu',
    emailAlerts: 'Powiadom mnie e-mailem o zmianach w obserwowanych',
    emailAlertsHint: 'Jeden e-mail po miesięcznej aktualizacji danych — tylko gdy coś obserwowanego się zmieniło.',
    latestTitle: (m) => `Zmienione w aktualizacji ${m}`,
    latestNone: 'Żadna z obserwowanych pozycji nie zmieniła się w ostatniej aktualizacji.',
    latestNoData: 'Zmiany pojawią się tutaj po następnej miesięcznej aktualizacji danych.',
    badgeListing: 'Zmiana statusu', badgeAdded: 'Nowy', badgeRemoved: 'Usunięty', badgeSpecs: 'Dane zaktualizowane',
    changedSpecs: (f) => `Zaktualizowano: ${f}`, listingFromTo: (a, b) => `${a} → ${b}`,
    teaserTitle: 'Miej modele i producentów na oku',
    teaserBody: 'Członkowie Premium obserwują modele i całych producentów i dostają e-mail, gdy w miesięcznej aktualizacji zmieni się status na liście, dane techniczne lub oferta.',
    teaserCta: 'Zobacz Premium',
    colModel: 'Model', colKw: 'kW', colScop: 'SCOP', colListing: 'Status',
    capacity: 'Moc znamionowa', used: (n, max) => `${n} / ${max} pozycji`,
    mfrChanged: (n) => `zmienione modele: ${n}`, latestHeading: 'Ostatnia aktualizacja danych',
  },
  it: {
    watchModel: 'Segui il modello', watching: 'Seguito',
    watchMfr: (m) => `Segui tutti i modelli ${m}`, watchingMfr: (m) => `Segui ${m}`,
    added: 'Aggiunto alla watchlist', removed: 'Rimosso dalla watchlist',
    limit: (n) => `La watchlist è piena (${n} voci). Rimuovine prima una.`,
    failed: 'Impossibile aggiornare la watchlist. Riprova.',
    tabProjects: 'Progetti', tabWatchlist: 'Watchlist',
    title: 'Watchlist', sub: 'I modelli e i produttori che segui. Dopo ogni aggiornamento mensile dei dati vedi — e puoi ricevere via e-mail — cosa è cambiato.',
    models: 'Modelli seguiti', manufacturers: 'Produttori seguiti',
    emptyTitle: 'Non segui ancora nulla',
    emptyBody: 'Apri un modello in Prodotti e scegli «Segui il modello» — oppure segui un intero produttore dallo stesso menu.',
    emptyMfr: 'Nessun produttore seguito.',
    remove: 'Rimuovi', open: 'Apri',
    modelsCount: (n) => `${n} ${n === 1 ? 'modello' : 'modelli'} nel catalogo`,
    notInCatalogue: 'Non più nel catalogo attuale',
    emailAlerts: 'Avvisami via e-mail quando qualcosa che seguo cambia',
    emailAlertsHint: 'Un’e-mail dopo l’aggiornamento mensile dei dati, solo se una voce seguita è cambiata.',
    latestTitle: (m) => `Modificato nell’aggiornamento di ${m}`,
    latestNone: 'Nessuna delle voci seguite è cambiata nell’ultimo aggiornamento.',
    latestNoData: 'Le modifiche compariranno qui dopo il prossimo aggiornamento mensile dei dati.',
    badgeListing: 'Stato modificato', badgeAdded: 'Nuovo', badgeRemoved: 'Rimosso', badgeSpecs: 'Dati aggiornati',
    changedSpecs: (f) => `Aggiornato: ${f}`, listingFromTo: (a, b) => `${a} → ${b}`,
    teaserTitle: 'Tieni d’occhio modelli e produttori',
    teaserBody: 'I membri Premium seguono modelli e interi produttori e ricevono un’e-mail quando nell’aggiornamento mensile cambia uno stato di catalogo, un dato tecnico o la gamma.',
    teaserCta: 'Scopri Premium',
    colModel: 'Modello', colKw: 'kW', colScop: 'SCOP', colListing: 'Stato',
    capacity: 'Potenza nominale', used: (n, max) => `${n} / ${max} voci`,
    mfrChanged: (n) => `${n} ${n === 1 ? 'modello modificato' : 'modelli modificati'}`, latestHeading: 'Ultimo aggiornamento dati',
  },
};

export const watchStrings = (lang: Language | string): WatchStrings => pick(T, lang);

/** Spec field labels for the "updated: …" line (mirrors scripts/lib/watch-alerts.mjs). */
const FIELDS: Record<string, Partial<Record<FeatureLang, string>> & { en: string }> = {
  scop: { en: 'SCOP' },
  power_55C_kw: { en: 'capacity 55 °C', de: 'Leistung 55 °C', fr: 'puissance 55 °C', pl: 'moc 55 °C', it: 'potenza 55 °C' },
  power_35C_kw: { en: 'capacity 35 °C', de: 'Leistung 35 °C', fr: 'puissance 35 °C', pl: 'moc 35 °C', it: 'potenza 35 °C' },
  efficiency_35C_percent: { en: 'ηs 35 °C' }, efficiency_55C_percent: { en: 'ηs 55 °C' },
  cop_A7W35: { en: 'COP A7/W35' }, cop_A2W35: { en: 'COP A2/W35' },
  cop_AMinus7W35: { en: 'COP A-7/W35' }, cop_A10W35: { en: 'COP A10/W35' },
  noise_outdoor_dB: { en: 'sound power', de: 'Schallleistung', fr: 'puissance acoustique', pl: 'moc akustyczna', it: 'potenza sonora' },
  refrigerant: { en: 'refrigerant', de: 'Kältemittel', fr: 'fluide frigorigène', pl: 'czynnik chłodniczy', it: 'refrigerante' },
};
export const fieldLabel = (f: string, lang: Language | string): string =>
  FIELDS[f]?.[lang as FeatureLang] ?? FIELDS[f]?.en ?? f;
