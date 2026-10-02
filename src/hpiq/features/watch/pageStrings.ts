/**
 * Watchlist page v2 strings (2026-10-02) — the "my models" working list:
 * how it works, add from the page, row actions. EN/DE/FR/PL/IT via `pick`.
 */
import type { Language } from '../../../types';
import { pick, FeatureLang } from '../lang';

export interface WatchPageStrings {
  sub: string;
  howTitle: string;
  how: [string, string][];
  addTitle: string;
  addSearchPh: string;
  addNoResults: string;
  addBtn: string;
  inList: string;
  addMfr: string;
  browse: string;
  compareSel: (n: number) => string;
  compareHint: string;
  compareSegment: string;
  dataSheet: string;
  colSound: string;
  colRef: string;
  starOn: string;
  starOff: string;
  emptyBody: string;
}

const T: Record<FeatureLang, WatchPageStrings> = {
  en: {
    sub: 'Your own short catalogue: the models you actually quote and install, one click away — always with their current data and listing status, and a notice when the monthly update changes them.',
    howTitle: 'How it works',
    how: [
      ['Save', 'Tap the star on any product in Products or Find — or add a model right here.'],
      ['Work', 'Open, compare, print the data sheet or add a model to a project straight from this list.'],
      ['Stay informed', 'After each monthly update the list marks what changed (listing, specs, new models) and e-mails you if you wish.'],
    ],
    addTitle: 'Add to your watchlist',
    addSearchPh: 'Search model or manufacturer…',
    addNoResults: 'No matching model.',
    addBtn: 'Add',
    inList: 'In your list',
    addMfr: 'Watch a whole manufacturer…',
    browse: 'Browse products',
    compareSel: n => `Compare selected (${n})`,
    compareHint: 'Tick 2–4 models to compare them side by side.',
    compareSegment: 'A comparison stays within one segment — models from the other segment were left out.',
    dataSheet: 'Data sheet',
    colSound: 'Sound',
    colRef: 'Refrigerant',
    starOn: 'In your watchlist — click to remove',
    starOff: 'Add to watchlist',
    emptyBody: 'Add the models you sell most often: search above, or tap the star on a product in Products or Find.',
  },
  de: {
    sub: 'Ihr eigener kleiner Katalog: die Modelle, die Sie tatsächlich anbieten und einbauen, mit einem Klick erreichbar — immer mit aktuellen Daten und Listenstatus, und mit Hinweis, wenn das Monats-Update etwas ändert.',
    howTitle: 'So funktioniert es',
    how: [
      ['Merken', 'Bei jedem Produkt unter „Produkte“ oder „Produkt finden“ auf den Stern tippen — oder ein Modell direkt hier hinzufügen.'],
      ['Arbeiten', 'Aus dieser Liste heraus öffnen, vergleichen, Datenblatt drucken oder ein Modell einem Projekt hinzufügen.'],
      ['Informiert bleiben', 'Nach jedem Monats-Update zeigt die Liste, was sich geändert hat (Listung, Daten, neue Modelle) — auf Wunsch per E-Mail.'],
    ],
    addTitle: 'Zur Merkliste hinzufügen',
    addSearchPh: 'Modell oder Hersteller suchen…',
    addNoResults: 'Kein passendes Modell.',
    addBtn: 'Hinzufügen',
    inList: 'In Ihrer Liste',
    addMfr: 'Ganzen Hersteller beobachten…',
    browse: 'Produkte durchsuchen',
    compareSel: n => `Auswahl vergleichen (${n})`,
    compareHint: '2–4 Modelle ankreuzen, um sie nebeneinander zu vergleichen.',
    compareSegment: 'Ein Vergleich bleibt in einem Segment — Modelle aus dem anderen Segment wurden ausgelassen.',
    dataSheet: 'Datenblatt',
    colSound: 'Schall',
    colRef: 'Kältemittel',
    starOn: 'In Ihrer Merkliste — klicken zum Entfernen',
    starOff: 'Zur Merkliste hinzufügen',
    emptyBody: 'Fügen Sie die Modelle hinzu, die Sie am häufigsten anbieten: oben suchen oder bei einem Produkt auf den Stern tippen.',
  },
  fr: {
    sub: 'Votre propre petit catalogue : les modèles que vous proposez et posez réellement, à un clic — toujours avec leurs données et leur statut à jour, et un signalement quand la mise à jour mensuelle les modifie.',
    howTitle: 'Comment ça marche',
    how: [
      ['Enregistrer', 'Touchez l’étoile d’un produit dans Produits ou Recherche — ou ajoutez un modèle directement ici.'],
      ['Travailler', 'Depuis cette liste : ouvrir, comparer, imprimer la fiche technique ou ajouter un modèle à un projet.'],
      ['Rester informé', 'Après chaque mise à jour mensuelle, la liste signale ce qui a changé (statut, données, nouveaux modèles) — par e-mail si vous le souhaitez.'],
    ],
    addTitle: 'Ajouter à votre liste de suivi',
    addSearchPh: 'Rechercher un modèle ou un fabricant…',
    addNoResults: 'Aucun modèle correspondant.',
    addBtn: 'Ajouter',
    inList: 'Dans votre liste',
    addMfr: 'Suivre un fabricant entier…',
    browse: 'Parcourir les produits',
    compareSel: n => `Comparer la sélection (${n})`,
    compareHint: 'Cochez 2 à 4 modèles pour les comparer côte à côte.',
    compareSegment: 'Un comparatif reste dans un seul segment — les modèles de l’autre segment ont été écartés.',
    dataSheet: 'Fiche technique',
    colSound: 'Bruit',
    colRef: 'Fluide',
    starOn: 'Dans votre liste de suivi — cliquer pour retirer',
    starOff: 'Ajouter à la liste de suivi',
    emptyBody: 'Ajoutez les modèles que vous proposez le plus souvent : recherchez ci-dessus, ou touchez l’étoile d’un produit.',
  },
  pl: {
    sub: 'Twój własny mały katalog: modele, które faktycznie oferujesz i montujesz, dostępne jednym kliknięciem — zawsze z aktualnymi danymi i statusem listy oraz informacją, gdy comiesięczna aktualizacja coś zmieni.',
    howTitle: 'Jak to działa',
    how: [
      ['Zapisz', 'Kliknij gwiazdkę przy produkcie w „Produkty” lub „Znajdź” — albo dodaj model bezpośrednio tutaj.'],
      ['Pracuj', 'Z tej listy: otwórz, porównaj, wydrukuj kartę danych lub dodaj model do projektu.'],
      ['Bądź na bieżąco', 'Po każdej comiesięcznej aktualizacji lista pokazuje, co się zmieniło (status, dane, nowe modele) — na życzenie także e-mailem.'],
    ],
    addTitle: 'Dodaj do obserwowanych',
    addSearchPh: 'Wyszukaj model lub producenta…',
    addNoResults: 'Brak pasującego modelu.',
    addBtn: 'Dodaj',
    inList: 'Na Twojej liście',
    addMfr: 'Obserwuj całego producenta…',
    browse: 'Przeglądaj produkty',
    compareSel: n => `Porównaj zaznaczone (${n})`,
    compareHint: 'Zaznacz 2–4 modele, aby porównać je obok siebie.',
    compareSegment: 'Porównanie obejmuje jeden segment — modele z drugiego segmentu pominięto.',
    dataSheet: 'Karta danych',
    colSound: 'Hałas',
    colRef: 'Czynnik',
    starOn: 'Na liście obserwowanych — kliknij, aby usunąć',
    starOff: 'Dodaj do obserwowanych',
    emptyBody: 'Dodaj modele, które oferujesz najczęściej: wyszukaj powyżej albo kliknij gwiazdkę przy produkcie.',
  },
  it: {
    sub: 'Il tuo piccolo catalogo personale: i modelli che proponi e installi davvero, a portata di clic — sempre con dati e stato aggiornati, e un avviso quando l’aggiornamento mensile li modifica.',
    howTitle: 'Come funziona',
    how: [
      ['Salva', 'Tocca la stella su un prodotto in Prodotti o Trova — oppure aggiungi un modello direttamente qui.'],
      ['Lavora', 'Da questa lista: apri, confronta, stampa la scheda tecnica o aggiungi un modello a un progetto.'],
      ['Resta informato', 'Dopo ogni aggiornamento mensile la lista segnala cosa è cambiato (stato, dati, nuovi modelli) — anche via e-mail, se vuoi.'],
    ],
    addTitle: 'Aggiungi alla lista di monitoraggio',
    addSearchPh: 'Cerca modello o produttore…',
    addNoResults: 'Nessun modello corrispondente.',
    addBtn: 'Aggiungi',
    inList: 'Nella tua lista',
    addMfr: 'Monitora un intero produttore…',
    browse: 'Sfoglia i prodotti',
    compareSel: n => `Confronta selezionati (${n})`,
    compareHint: 'Seleziona 2–4 modelli per confrontarli affiancati.',
    compareSegment: 'Un confronto resta in un solo segmento — i modelli dell’altro segmento sono stati esclusi.',
    dataSheet: 'Scheda tecnica',
    colSound: 'Rumore',
    colRef: 'Refrigerante',
    starOn: 'Nella tua lista di monitoraggio — clicca per rimuovere',
    starOff: 'Aggiungi alla lista di monitoraggio',
    emptyBody: 'Aggiungi i modelli che proponi più spesso: cerca qui sopra oppure tocca la stella su un prodotto.',
  },
};
export const watchPageStrings = (lang: Language | string): WatchPageStrings => pick(T, lang);
