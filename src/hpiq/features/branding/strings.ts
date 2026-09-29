/** Branded documents (Premium, 2026-09-29) — five-language strings. */
import type { Language } from '../../../types';
import { pick, FeatureLang } from '../lang';

export interface BrandingStrings {
  cardTitle: string;
  cardIntro: string;
  logo: string;
  logoHint: string;
  upload: string;
  replace: string;
  removeLogo: string;
  company: string;
  contact: string;
  contactPh: string;
  save: string;
  saving: string;
  saved: string;
  saveFailed: string;
  badType: string;
  tooLarge: string;
  readFailed: string;
  preview: string;
  locked: string;
  unlock: string;
  studioHead: string;
  toggle: string;
  noBranding: string;
  setUp: string;
  preparedForLabel: string;
  preparedForPh: string;
  pdfPreparedBy: string;
  pdfPreparedFor: string;
  cmpBtn: string;
  cmpTitle: string;
  cmpCreate: string;
  cancel: string;
  cmpFailed: string;
  cmpModels: (n: number) => string;
  generated: string;
  cmpSource: (date: string) => string;
  cmpDisclaimerTitle: string;
  cmpDisclaimer: string;
}

const EN: BrandingStrings = {
  cardTitle: 'Branded documents.',
  cardIntro: 'Your logo and contact details on the data sheets and comparisons you hand to customers. HeatPump DB stays the data source — you appear as the one who prepared the document.',
  logo: 'Company logo',
  logoHint: 'PNG, JPG, SVG or WebP · scaled to max. 600 × 200 px',
  upload: 'Upload logo',
  replace: 'Replace logo',
  removeLogo: 'Remove logo',
  company: 'Company name',
  contact: 'Contact line',
  contactPh: 'Phone · e-mail · website',
  save: 'Save branding',
  saving: 'Saving…',
  saved: 'Branding saved',
  saveFailed: 'Could not save — please try again.',
  badType: 'Please choose a PNG, JPG, SVG or WebP image.',
  tooLarge: 'This logo is too detailed to store — try a simpler or smaller file.',
  readFailed: 'The image could not be read.',
  preview: 'How it appears on your documents',
  locked: 'Premium feature — put your own logo and contact details on every data sheet and comparison PDF.',
  unlock: 'See Premium',
  studioHead: 'Your branding',
  toggle: 'Add my company branding',
  noBranding: 'No branding saved yet.',
  setUp: 'Set up in Account',
  preparedForLabel: 'Prepared for (customer / project)',
  preparedForPh: 'e.g. Smith family · 12 High Street',
  pdfPreparedBy: 'Prepared by',
  pdfPreparedFor: 'Prepared for',
  cmpBtn: 'PDF',
  cmpTitle: 'Heat pump comparison',
  cmpCreate: 'Create PDF',
  cancel: 'Cancel',
  cmpFailed: 'The PDF could not be created.',
  cmpModels: n => `${n} models compared`,
  generated: 'Generated',
  cmpSource: d => `Source: HeatPump DB technical dataset, data status ${d}. BEST marks the most favourable value per row among the compared models.`,
  cmpDisclaimerTitle: 'Disclaimer',
  cmpDisclaimer: 'Informational comparison compiled from published technical records. Manufacturer documentation and the official registry are authoritative — verify values, listing status and funding eligibility before quoting or contracting. No warranty is given for completeness or accuracy.',
};

const DE: BrandingStrings = {
  cardTitle: 'Dokumente mit Ihrem Branding.',
  cardIntro: 'Ihr Logo und Ihre Kontaktdaten auf den Datenblättern und Vergleichen, die Sie Ihren Kunden geben. HeatPump DB bleibt die Datenquelle — Sie erscheinen als Ersteller des Dokuments.',
  logo: 'Firmenlogo',
  logoHint: 'PNG, JPG, SVG oder WebP · skaliert auf max. 600 × 200 px',
  upload: 'Logo hochladen',
  replace: 'Logo ersetzen',
  removeLogo: 'Logo entfernen',
  company: 'Firmenname',
  contact: 'Kontaktzeile',
  contactPh: 'Telefon · E-Mail · Website',
  save: 'Branding speichern',
  saving: 'Speichern…',
  saved: 'Branding gespeichert',
  saveFailed: 'Speichern fehlgeschlagen — bitte erneut versuchen.',
  badType: 'Bitte ein PNG-, JPG-, SVG- oder WebP-Bild wählen.',
  tooLarge: 'Dieses Logo ist zu detailreich zum Speichern — bitte eine einfachere oder kleinere Datei wählen.',
  readFailed: 'Das Bild konnte nicht gelesen werden.',
  preview: 'So erscheint es auf Ihren Dokumenten',
  locked: 'Premium-Funktion — Ihr eigenes Logo und Ihre Kontaktdaten auf jedem Datenblatt und Vergleichs-PDF.',
  unlock: 'Premium ansehen',
  studioHead: 'Ihr Branding',
  toggle: 'Mein Firmen-Branding einfügen',
  noBranding: 'Noch kein Branding gespeichert.',
  setUp: 'Im Konto einrichten',
  preparedForLabel: 'Erstellt für (Kunde / Projekt)',
  preparedForPh: 'z. B. Familie Müller · Hauptstr. 5',
  pdfPreparedBy: 'Erstellt von',
  pdfPreparedFor: 'Erstellt für',
  cmpBtn: 'PDF',
  cmpTitle: 'Wärmepumpen-Vergleich',
  cmpCreate: 'PDF erstellen',
  cancel: 'Abbrechen',
  cmpFailed: 'Das PDF konnte nicht erstellt werden.',
  cmpModels: n => `${n} Modelle im Vergleich`,
  generated: 'Erstellt am',
  cmpSource: d => `Quelle: technischer Datensatz von HeatPump DB, Datenstand ${d}. BESTWERT kennzeichnet je Zeile den günstigsten Wert unter den verglichenen Modellen.`,
  cmpDisclaimerTitle: 'Haftungsausschluss',
  cmpDisclaimer: 'Informativer Vergleich auf Basis veröffentlichter technischer Datensätze. Maßgeblich sind die Herstellerunterlagen und das amtliche Verzeichnis — Werte, Listungsstatus und Förderfähigkeit vor Angebot oder Vertrag prüfen. Keine Gewähr für Vollständigkeit und Richtigkeit.',
};

const FR: BrandingStrings = {
  cardTitle: 'Documents à votre image.',
  cardIntro: 'Votre logo et vos coordonnées sur les fiches techniques et comparatifs que vous remettez à vos clients. HeatPump DB reste la source des données — vous apparaissez comme l’auteur du document préparé.',
  logo: 'Logo de l’entreprise',
  logoHint: 'PNG, JPG, SVG ou WebP · réduit à 600 × 200 px max.',
  upload: 'Importer un logo',
  replace: 'Remplacer le logo',
  removeLogo: 'Supprimer le logo',
  company: 'Nom de l’entreprise',
  contact: 'Ligne de contact',
  contactPh: 'Téléphone · e-mail · site web',
  save: 'Enregistrer',
  saving: 'Enregistrement…',
  saved: 'Personnalisation enregistrée',
  saveFailed: 'Échec de l’enregistrement — veuillez réessayer.',
  badType: 'Choisissez une image PNG, JPG, SVG ou WebP.',
  tooLarge: 'Ce logo est trop détaillé pour être enregistré — essayez un fichier plus simple ou plus petit.',
  readFailed: 'L’image n’a pas pu être lue.',
  preview: 'Aperçu sur vos documents',
  locked: 'Fonction Premium — votre logo et vos coordonnées sur chaque fiche technique et chaque comparatif PDF.',
  unlock: 'Voir Premium',
  studioHead: 'Votre personnalisation',
  toggle: 'Ajouter mon identité d’entreprise',
  noBranding: 'Aucune personnalisation enregistrée.',
  setUp: 'Configurer dans le compte',
  preparedForLabel: 'Préparé pour (client / projet)',
  preparedForPh: 'ex. Famille Martin · 5 rue de la Paix',
  pdfPreparedBy: 'Préparé par',
  pdfPreparedFor: 'Préparé pour',
  cmpBtn: 'PDF',
  cmpTitle: 'Comparatif de pompes à chaleur',
  cmpCreate: 'Créer le PDF',
  cancel: 'Annuler',
  cmpFailed: 'Le PDF n’a pas pu être créé.',
  cmpModels: n => `${n} modèles comparés`,
  generated: 'Généré le',
  cmpSource: d => `Source : jeu de données techniques HeatPump DB, état des données ${d}. MEILLEUR signale la valeur la plus favorable de chaque ligne parmi les modèles comparés.`,
  cmpDisclaimerTitle: 'Avertissement',
  cmpDisclaimer: 'Comparatif informatif établi à partir de données techniques publiées. La documentation du fabricant et le registre officiel font foi — vérifiez les valeurs, le statut de référencement et l’éligibilité aux aides avant tout devis ou contrat. Aucune garantie d’exhaustivité ni d’exactitude.',
};

const PL: BrandingStrings = {
  cardTitle: 'Dokumenty z Twoim logo.',
  cardIntro: 'Twoje logo i dane kontaktowe na kartach danych i porównaniach przekazywanych klientom. HeatPump DB pozostaje źródłem danych — Ty występujesz jako osoba, która przygotowała dokument.',
  logo: 'Logo firmy',
  logoHint: 'PNG, JPG, SVG lub WebP · skalowane do maks. 600 × 200 px',
  upload: 'Prześlij logo',
  replace: 'Zmień logo',
  removeLogo: 'Usuń logo',
  company: 'Nazwa firmy',
  contact: 'Linia kontaktowa',
  contactPh: 'Telefon · e-mail · strona www',
  save: 'Zapisz',
  saving: 'Zapisywanie…',
  saved: 'Zapisano',
  saveFailed: 'Nie udało się zapisać — spróbuj ponownie.',
  badType: 'Wybierz obraz PNG, JPG, SVG lub WebP.',
  tooLarge: 'To logo jest zbyt szczegółowe, aby je zapisać — wybierz prostszy lub mniejszy plik.',
  readFailed: 'Nie udało się odczytać obrazu.',
  preview: 'Tak będzie wyglądać na Twoich dokumentach',
  locked: 'Funkcja Premium — Twoje logo i dane kontaktowe na każdej karcie danych i każdym porównaniu PDF.',
  unlock: 'Zobacz Premium',
  studioHead: 'Twoje logo i dane',
  toggle: 'Dodaj dane mojej firmy',
  noBranding: 'Brak zapisanych danych firmy.',
  setUp: 'Ustaw w koncie',
  preparedForLabel: 'Przygotowano dla (klient / projekt)',
  preparedForPh: 'np. Państwo Kowalscy · ul. Lipowa 5',
  pdfPreparedBy: 'Przygotował(a)',
  pdfPreparedFor: 'Przygotowano dla',
  cmpBtn: 'PDF',
  cmpTitle: 'Porównanie pomp ciepła',
  cmpCreate: 'Utwórz PDF',
  cancel: 'Anuluj',
  cmpFailed: 'Nie udało się utworzyć pliku PDF.',
  cmpModels: n => `Porównywane modele: ${n}`,
  generated: 'Wygenerowano',
  cmpSource: d => `Źródło: techniczny zbiór danych HeatPump DB, stan danych ${d}. Oznaczenie najlepszej wartości wskazuje najkorzystniejszą wartość w wierszu spośród porównywanych modeli.`,
  cmpDisclaimerTitle: 'Zastrzeżenie',
  cmpDisclaimer: 'Porównanie informacyjne sporządzone na podstawie opublikowanych danych technicznych. Rozstrzygające są dokumentacja producenta i oficjalny rejestr — przed ofertą lub umową zweryfikuj wartości, status na liście i kwalifikowalność do dofinansowania. Bez gwarancji kompletności i poprawności.',
};

const IT: BrandingStrings = {
  cardTitle: 'Documenti con il tuo marchio.',
  cardIntro: 'Il tuo logo e i tuoi contatti sulle schede tecniche e sui confronti che consegni ai clienti. HeatPump DB resta la fonte dei dati — tu compari come chi ha preparato il documento.',
  logo: 'Logo aziendale',
  logoHint: 'PNG, JPG, SVG o WebP · ridotto a max. 600 × 200 px',
  upload: 'Carica logo',
  replace: 'Sostituisci logo',
  removeLogo: 'Rimuovi logo',
  company: 'Ragione sociale',
  contact: 'Riga contatti',
  contactPh: 'Telefono · e-mail · sito web',
  save: 'Salva',
  saving: 'Salvataggio…',
  saved: 'Personalizzazione salvata',
  saveFailed: 'Salvataggio non riuscito — riprova.',
  badType: 'Scegli un’immagine PNG, JPG, SVG o WebP.',
  tooLarge: 'Questo logo è troppo dettagliato per essere salvato — prova un file più semplice o più piccolo.',
  readFailed: 'Impossibile leggere l’immagine.',
  preview: 'Come appare sui tuoi documenti',
  locked: 'Funzione Premium — il tuo logo e i tuoi contatti su ogni scheda tecnica e ogni confronto PDF.',
  unlock: 'Scopri Premium',
  studioHead: 'Il tuo marchio',
  toggle: 'Aggiungi il mio marchio aziendale',
  noBranding: 'Nessuna personalizzazione salvata.',
  setUp: 'Configura nell’account',
  preparedForLabel: 'Preparato per (cliente / progetto)',
  preparedForPh: 'es. Famiglia Rossi · Via Roma 5',
  pdfPreparedBy: 'Preparato da',
  pdfPreparedFor: 'Preparato per',
  cmpBtn: 'PDF',
  cmpTitle: 'Confronto pompe di calore',
  cmpCreate: 'Crea PDF',
  cancel: 'Annulla',
  cmpFailed: 'Impossibile creare il PDF.',
  cmpModels: n => `${n} modelli a confronto`,
  generated: 'Generato il',
  cmpSource: d => `Fonte: dataset tecnico HeatPump DB, dati aggiornati al ${d}. Il contrassegno del valore migliore indica, per ogni riga, il valore più favorevole tra i modelli confrontati.`,
  cmpDisclaimerTitle: 'Avvertenza',
  cmpDisclaimer: 'Confronto informativo basato su dati tecnici pubblicati. Fanno fede la documentazione del produttore e il registro ufficiale — verifica valori, stato nel catalogo e ammissibilità agli incentivi prima di offerte o contratti. Nessuna garanzia di completezza o esattezza.',
};

const TABLE: Record<FeatureLang, BrandingStrings> = { en: EN, de: DE, fr: FR, pl: PL, it: IT };
export const brandingStrings = (lang: Language | string): BrandingStrings => pick(TABLE, lang);
