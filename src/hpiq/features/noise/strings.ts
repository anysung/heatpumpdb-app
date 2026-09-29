/**
 * Noise check (Premium, 2026-09-29) — five-language strings.
 *
 * Two layers: `noiseStrings(lang)` = the page chrome in every UI language;
 * `regimeStrings(regime, lang)` = the market rule's wording, written in English
 * and in the language(s) of the edition that uses it (DE edition: de/en, GB: en,
 * FR: fr/en, PL: pl/en, IT: it/en); anything else falls back to English.
 * Every limit value cited here is sourced in noiseModel.ts.
 */
import type { Language } from '../../../types';
import { pick, FeatureLang } from '../lang';
import type { DeArea, NoiseRegime, Placement, Screening, Verdict } from './noiseModel';

export interface NoiseStrings {
  title: string;
  sub: string;
  teaserTitle: string;
  teaserBody: string;
  upgrade: string;
  inputs: string;
  product: string;
  searchPh: string;
  change: string;
  noProduct: string;
  noMatches: string;
  lwDataset: string;
  lwNone: string;
  lwRemoved: string;
  lwFlagged: string;
  override: string;
  overrideHint: string;
  overrideRequired: string;
  overridePh: string;
  lwInvalid: string;
  lwUsed: string;
  lwSourceDataset: string;
  lwSourceOverride: string;
  distance: string;
  distanceInvalid: string;
  placement: string;
  placements: Record<Placement, string>;
  screening: string;
  screenings: Record<Screening, string>;
  result: string;
  atDistance: (r: string) => string;
  needLw: string;
  tableTitle: string;
  colDist: string;
  colLp: string;
  yours: string;
  formulaTitle: string;
  formulaBody: string;
  assumptionsTitle: string;
  assumptions: string[];
  disclaimer: string;
  sources: string;
  pdfBtn: string;
  pdfTitle: string;
  pdfFailed: string;
  generated: string;
  pdfInputs: string;
  pdfManual: string;
  meters: string;
}

export interface RegimeStrings {
  /** Short name of the rule, e.g. "TA Lärm (night)". */
  rule: string;
  distanceHint: string;
  verdict?: Record<Verdict, string>;
  verdictBody?: Record<Verdict, string>;
  limitLine?: (v: string) => string;
  targetLine?: (v: string) => string;
  rLimitLine?: (m: string) => string;
  rTargetLine?: (m: string) => string;
  /** GB: the permanent "reference only" label. */
  reference?: string;
  /** FR/PL/IT: why there is no pass/fail. */
  noVerdict?: string;
  area?: string;
  areas?: Record<DeArea, string>;
  nightValue?: (v: string) => string;
  tonal?: string;
  tonalHint?: string;
  source: string;
}

const EN: NoiseStrings = {
  title: 'Noise check',
  sub: 'Estimate the outdoor unit’s sound level at the neighbour’s window from its sound power, placement, screening and distance — for pre-planning and customer conversations.',
  teaserTitle: 'Check the neighbour noise before you quote.',
  teaserBody: 'Premium estimates the sound level at the neighbour’s window for any model, compares it with the local rule where one exists, finds the minimum distance and creates a customer PDF with your branding.',
  upgrade: 'See Premium',
  inputs: 'Inputs',
  product: 'Heat pump',
  searchPh: 'Search manufacturer or model…',
  change: 'Change',
  noProduct: 'No model selected — you can still enter a sound power below.',
  noMatches: 'No matching models.',
  lwDataset: 'Outdoor sound power (dataset)',
  lwNone: 'No outdoor sound power in the dataset for this model — enter the manufacturer’s value below.',
  lwRemoved: 'The dataset value failed the plausibility check (physically impossible) and was removed — enter the manufacturer’s value below.',
  lwFlagged: 'This model’s record carries a “manufacturer check needed” mark — confirm the sound power with the manufacturer.',
  override: 'Manufacturer maximum / night-mode sound power',
  overrideHint: 'Recommended. The energy-label (ErP) value is not always the unit’s loudest operation — use the highest sound power it can reach at night, or a guaranteed night-mode value.',
  overrideRequired: 'Required — no usable dataset value.',
  overridePh: 'e.g. 58',
  lwInvalid: 'Enter a sound power between 30 and 100 dB(A).',
  lwUsed: 'Sound power used',
  lwSourceDataset: 'rated value from the dataset',
  lwSourceOverride: 'entered manufacturer value',
  distance: 'Distance to the neighbour’s window (m)',
  distanceInvalid: 'Enter a distance between 0.5 and 500 m.',
  placement: 'Placement',
  placements: { free: 'Free-standing on the ground (Q = 2)', wall: 'Against one wall (Q = 4)', corner: 'In a corner / recess (Q = 8)' },
  screening: 'Screening',
  screenings: { none: 'None — full view (0 dB)', partial: 'Partially screened, line of sight partly blocked (−5 dB)', full: 'Fully screened, no line of sight (−10 dB)' },
  result: 'Result',
  atDistance: r => `Sound pressure at ${r} m`,
  needLw: 'Enter a sound power to see the estimate.',
  tableTitle: 'Sound pressure by distance',
  colDist: 'Distance',
  colLp: 'Sound pressure',
  yours: 'your distance',
  formulaTitle: 'How it is calculated',
  formulaBody: 'Lp = Lw + 10·log10(Q / (4·π·r²)) − A_B. Lw is the sound power, Q the directivity (2 on open ground, 4 against a wall, 8 in a corner), r the distance in metres and A_B the screening. The minimum distance solves the same equation for r.',
  assumptionsTitle: 'Assumptions',
  assumptions: [
    'Point source radiating freely; ground and walls within about 1 m reflect fully.',
    'No air absorption, ground effect, weather or low-frequency effects; screening values are simple steps.',
    'One heat pump; other sources and existing background noise are not included.',
    'The result is only as good as the sound power entered — use the manufacturer’s maximum or night-mode value.',
  ],
  disclaimer: 'Estimate for pre-planning — not an acoustic report.',
  sources: 'Sources',
  pdfBtn: 'Noise estimate (PDF)',
  pdfTitle: 'Noise estimate',
  pdfFailed: 'Could not create the PDF — please try again.',
  generated: 'Created',
  pdfInputs: 'Inputs',
  pdfManual: 'Manual entry',
  meters: 'm',
};

const DE: NoiseStrings = {
  title: 'Schallcheck',
  sub: 'Schätzt den Schallpegel des Außengeräts am Fenster des Nachbarn aus Schallleistung, Aufstellung, Abschirmung und Abstand — für die Vorplanung und das Kundengespräch.',
  teaserTitle: 'Nachbarschaftslärm prüfen, bevor Sie anbieten.',
  teaserBody: 'Premium schätzt für jedes Modell den Pegel am Nachbarfenster, vergleicht ihn mit dem Immissionsrichtwert, ermittelt den Mindestabstand und erstellt ein Kunden-PDF mit Ihrem Branding.',
  upgrade: 'Premium ansehen',
  inputs: 'Eingaben',
  product: 'Wärmepumpe',
  searchPh: 'Hersteller oder Modell suchen…',
  change: 'Ändern',
  noProduct: 'Kein Modell gewählt — Sie können die Schallleistung auch unten eingeben.',
  noMatches: 'Keine passenden Modelle.',
  lwDataset: 'Schallleistung außen (Datensatz)',
  lwNone: 'Für dieses Modell ist keine Schallleistung außen im Datensatz — bitte den Herstellerwert unten eingeben.',
  lwRemoved: 'Der Datensatzwert hat die Plausibilitätsprüfung nicht bestanden (physikalisch unmöglich) und wurde entfernt — bitte den Herstellerwert unten eingeben.',
  lwFlagged: 'Der Datensatz dieses Modells trägt die Markierung „Herstellerprüfung nötig“ — Schallleistung beim Hersteller bestätigen.',
  override: 'Maximale / Nachtbetrieb-Schallleistung laut Hersteller',
  overrideHint: 'Empfohlen. Der Wert vom Energielabel (ErP) ist nicht immer der lauteste Betrieb — den höchsten im Nachtbetrieb möglichen Schallleistungspegel oder einen garantierten Nachtmodus-Wert verwenden (LAI-Leitfaden 4.1.3).',
  overrideRequired: 'Erforderlich — kein verwendbarer Datensatzwert.',
  overridePh: 'z. B. 58',
  lwInvalid: 'Schallleistung zwischen 30 und 100 dB(A) eingeben.',
  lwUsed: 'Verwendete Schallleistung',
  lwSourceDataset: 'Nennwert aus dem Datensatz',
  lwSourceOverride: 'eingegebener Herstellerwert',
  distance: 'Abstand zum Nachbarfenster (m)',
  distanceInvalid: 'Abstand zwischen 0,5 und 500 m eingeben.',
  placement: 'Aufstellung',
  placements: { free: 'Freistehend auf dem Boden (Q = 2)', wall: 'Vor einer Wand (Q = 4)', corner: 'In einer Ecke / Nische (Q = 8)' },
  screening: 'Abschirmung',
  screenings: { none: 'Keine — freie Sicht (0 dB)', partial: 'Teilweise abgeschirmt, Sichtlinie teils verdeckt (−5 dB)', full: 'Vollständig abgeschirmt, keine Sichtverbindung (−10 dB)' },
  result: 'Ergebnis',
  atDistance: r => `Schalldruckpegel in ${r} m`,
  needLw: 'Schallleistung eingeben, um die Schätzung zu sehen.',
  tableTitle: 'Schalldruckpegel nach Abstand',
  colDist: 'Abstand',
  colLp: 'Schalldruckpegel',
  yours: 'Ihr Abstand',
  formulaTitle: 'So wird gerechnet',
  formulaBody: 'Lp = Lw + 10·log10(Q / (4·π·r²)) − A_B (+ K_T). Lw ist die Schallleistung, Q der Richtfaktor (2 auf freier Fläche, 4 vor einer Wand, 8 in einer Ecke), r der Abstand in Metern, A_B die Abschirmung und K_T der Tonzuschlag. Der Mindestabstand löst dieselbe Gleichung nach r auf.',
  assumptionsTitle: 'Annahmen',
  assumptions: [
    'Punktquelle mit freier Ausbreitung; Boden und Wände im Umkreis von etwa 1 m reflektieren vollständig.',
    'Keine Luftabsorption, kein Bodeneffekt, keine Witterung, keine tieffrequenten Effekte; Abschirmung als einfache Stufen.',
    'Eine Wärmepumpe; andere Quellen und die Vorbelastung sind nicht enthalten.',
    'Das Ergebnis ist nur so gut wie die eingegebene Schallleistung — den maximalen oder Nachtbetrieb-Wert des Herstellers verwenden.',
  ],
  disclaimer: 'Schätzung für die Vorplanung — kein Schallgutachten.',
  sources: 'Quellen',
  pdfBtn: 'Schallschätzung (PDF)',
  pdfTitle: 'Schallschätzung',
  pdfFailed: 'PDF konnte nicht erstellt werden — bitte erneut versuchen.',
  generated: 'Erstellt',
  pdfInputs: 'Eingaben',
  pdfManual: 'Manuelle Eingabe',
  meters: 'm',
};

const FR: NoiseStrings = {
  title: 'Contrôle acoustique',
  sub: 'Estime le niveau sonore de l’unité extérieure à la fenêtre du voisin à partir de sa puissance acoustique, de son implantation, de l’écran et de la distance — pour l’avant-projet et l’échange avec le client.',
  teaserTitle: 'Vérifiez le bruit chez le voisin avant de chiffrer.',
  teaserBody: 'Premium estime, pour chaque modèle, le niveau à la fenêtre du voisin, donne les niveaux par distance et crée un PDF client à vos couleurs.',
  upgrade: 'Voir Premium',
  inputs: 'Données',
  product: 'Pompe à chaleur',
  searchPh: 'Rechercher un fabricant ou un modèle…',
  change: 'Modifier',
  noProduct: 'Aucun modèle choisi — vous pouvez saisir la puissance acoustique ci-dessous.',
  noMatches: 'Aucun modèle correspondant.',
  lwDataset: 'Puissance acoustique extérieure (base)',
  lwNone: 'Pas de puissance acoustique extérieure dans la base pour ce modèle — saisissez la valeur du fabricant ci-dessous.',
  lwRemoved: 'La valeur de la base n’a pas passé le contrôle de plausibilité (physiquement impossible) et a été retirée — saisissez la valeur du fabricant ci-dessous.',
  lwFlagged: 'La fiche de ce modèle porte la mention « vérification fabricant requise » — confirmez la puissance acoustique auprès du fabricant.',
  override: 'Puissance acoustique maximale / mode nuit (fabricant)',
  overrideHint: 'Recommandé. La valeur de l’étiquette énergie (ErP) ne correspond pas toujours au fonctionnement le plus bruyant — utilisez la puissance maximale atteignable la nuit, ou une valeur garantie en mode nuit.',
  overrideRequired: 'Obligatoire — aucune valeur exploitable dans la base.',
  overridePh: 'ex. 58',
  lwInvalid: 'Saisissez une puissance acoustique entre 30 et 100 dB(A).',
  lwUsed: 'Puissance acoustique utilisée',
  lwSourceDataset: 'valeur nominale de la base',
  lwSourceOverride: 'valeur fabricant saisie',
  distance: 'Distance à la fenêtre du voisin (m)',
  distanceInvalid: 'Saisissez une distance entre 0,5 et 500 m.',
  placement: 'Implantation',
  placements: { free: 'Posée au sol, dégagée (Q = 2)', wall: 'Contre un mur (Q = 4)', corner: 'Dans un angle / une niche (Q = 8)' },
  screening: 'Écran',
  screenings: { none: 'Aucun — vue directe (0 dB)', partial: 'Partiellement masquée, vue en partie bloquée (−5 dB)', full: 'Entièrement masquée, aucune vue directe (−10 dB)' },
  result: 'Résultat',
  atDistance: r => `Pression acoustique à ${r} m`,
  needLw: 'Saisissez une puissance acoustique pour voir l’estimation.',
  tableTitle: 'Pression acoustique selon la distance',
  colDist: 'Distance',
  colLp: 'Pression acoustique',
  yours: 'votre distance',
  formulaTitle: 'Méthode de calcul',
  formulaBody: 'Lp = Lw + 10·log10(Q / (4·π·r²)) − A_B. Lw est la puissance acoustique, Q la directivité (2 en terrain dégagé, 4 contre un mur, 8 dans un angle), r la distance en mètres et A_B l’effet d’écran.',
  assumptionsTitle: 'Hypothèses',
  assumptions: [
    'Source ponctuelle en champ libre ; sol et murs à moins d’environ 1 m réfléchissent totalement.',
    'Sans absorption de l’air, effet de sol, météo ni basses fréquences ; l’écran est modélisé par paliers simples.',
    'Une seule pompe à chaleur ; les autres sources et le bruit résiduel ne sont pas inclus.',
    'Le résultat dépend de la puissance saisie — utilisez la valeur maximale ou mode nuit du fabricant.',
  ],
  disclaimer: 'Estimation d’avant-projet — pas une étude acoustique.',
  sources: 'Sources',
  pdfBtn: 'Estimation acoustique (PDF)',
  pdfTitle: 'Estimation acoustique',
  pdfFailed: 'Impossible de créer le PDF — veuillez réessayer.',
  generated: 'Créé le',
  pdfInputs: 'Données',
  pdfManual: 'Saisie manuelle',
  meters: 'm',
};

const PL: NoiseStrings = {
  title: 'Kontrola hałasu',
  sub: 'Szacuje poziom dźwięku jednostki zewnętrznej przy oknie sąsiada na podstawie mocy akustycznej, ustawienia, ekranowania i odległości — do wstępnego planowania i rozmowy z klientem.',
  teaserTitle: 'Sprawdź hałas u sąsiada przed wyceną.',
  teaserBody: 'Premium szacuje dla każdego modelu poziom przy oknie sąsiada, podaje poziomy dla różnych odległości i tworzy PDF dla klienta z Twoim logo.',
  upgrade: 'Zobacz Premium',
  inputs: 'Dane wejściowe',
  product: 'Pompa ciepła',
  searchPh: 'Szukaj producenta lub modelu…',
  change: 'Zmień',
  noProduct: 'Nie wybrano modelu — moc akustyczną można wpisać poniżej.',
  noMatches: 'Brak pasujących modeli.',
  lwDataset: 'Moc akustyczna na zewnątrz (baza)',
  lwNone: 'Baza nie zawiera mocy akustycznej zewnętrznej dla tego modelu — wpisz wartość producenta poniżej.',
  lwRemoved: 'Wartość z bazy nie przeszła kontroli wiarygodności (fizycznie niemożliwa) i została usunięta — wpisz wartość producenta poniżej.',
  lwFlagged: 'Rekord tego modelu ma oznaczenie „wymagana weryfikacja u producenta” — potwierdź moc akustyczną u producenta.',
  override: 'Maksymalna / nocna moc akustyczna wg producenta',
  overrideHint: 'Zalecane. Wartość z etykiety energetycznej (ErP) nie zawsze odpowiada najgłośniejszej pracy — użyj najwyższej mocy akustycznej osiągalnej w nocy lub gwarantowanej wartości trybu nocnego.',
  overrideRequired: 'Wymagane — brak użytecznej wartości w bazie.',
  overridePh: 'np. 58',
  lwInvalid: 'Wpisz moc akustyczną od 30 do 100 dB(A).',
  lwUsed: 'Użyta moc akustyczna',
  lwSourceDataset: 'wartość znamionowa z bazy',
  lwSourceOverride: 'wpisana wartość producenta',
  distance: 'Odległość do okna sąsiada (m)',
  distanceInvalid: 'Wpisz odległość od 0,5 do 500 m.',
  placement: 'Ustawienie',
  placements: { free: 'Wolnostojąca na gruncie (Q = 2)', wall: 'Przy jednej ścianie (Q = 4)', corner: 'W narożniku / wnęce (Q = 8)' },
  screening: 'Ekranowanie',
  screenings: { none: 'Brak — pełna widoczność (0 dB)', partial: 'Częściowe, linia widzenia częściowo zasłonięta (−5 dB)', full: 'Pełne, brak linii widzenia (−10 dB)' },
  result: 'Wynik',
  atDistance: r => `Poziom ciśnienia akustycznego w odległości ${r} m`,
  needLw: 'Wpisz moc akustyczną, aby zobaczyć oszacowanie.',
  tableTitle: 'Poziom ciśnienia akustycznego wg odległości',
  colDist: 'Odległość',
  colLp: 'Ciśnienie akustyczne',
  yours: 'Twoja odległość',
  formulaTitle: 'Sposób obliczenia',
  formulaBody: 'Lp = Lw + 10·log10(Q / (4·π·r²)) − A_B. Lw to moc akustyczna, Q współczynnik kierunkowości (2 na otwartym terenie, 4 przy ścianie, 8 w narożniku), r odległość w metrach, A_B tłumienie przez ekran.',
  assumptionsTitle: 'Założenia',
  assumptions: [
    'Źródło punktowe w wolnej przestrzeni; grunt i ściany w promieniu ok. 1 m odbijają całkowicie.',
    'Bez pochłaniania w powietrzu, wpływu gruntu, pogody i niskich częstotliwości; ekranowanie w prostych stopniach.',
    'Jedna pompa ciepła; inne źródła i istniejące tło akustyczne nie są uwzględnione.',
    'Wynik zależy od wpisanej mocy akustycznej — użyj wartości maksymalnej lub nocnej producenta.',
  ],
  disclaimer: 'Szacunek do wstępnego planowania — nie jest to opinia akustyczna.',
  sources: 'Źródła',
  pdfBtn: 'Oszacowanie hałasu (PDF)',
  pdfTitle: 'Oszacowanie hałasu',
  pdfFailed: 'Nie udało się utworzyć PDF — spróbuj ponownie.',
  generated: 'Utworzono',
  pdfInputs: 'Dane wejściowe',
  pdfManual: 'Wpis ręczny',
  meters: 'm',
};

const IT: NoiseStrings = {
  title: 'Verifica rumore',
  sub: 'Stima il livello sonoro dell’unità esterna alla finestra del vicino a partire da potenza sonora, posizionamento, schermatura e distanza — per la progettazione preliminare e il colloquio con il cliente.',
  teaserTitle: 'Verifica il rumore verso il vicino prima del preventivo.',
  teaserBody: 'Premium stima per ogni modello il livello alla finestra del vicino, fornisce i livelli per distanza e crea un PDF per il cliente con il tuo marchio.',
  upgrade: 'Scopri Premium',
  inputs: 'Dati',
  product: 'Pompa di calore',
  searchPh: 'Cerca produttore o modello…',
  change: 'Cambia',
  noProduct: 'Nessun modello selezionato — puoi inserire la potenza sonora qui sotto.',
  noMatches: 'Nessun modello corrispondente.',
  lwDataset: 'Potenza sonora esterna (banca dati)',
  lwNone: 'Nessuna potenza sonora esterna nella banca dati per questo modello — inserisci il valore del produttore qui sotto.',
  lwRemoved: 'Il valore della banca dati non ha superato il controllo di plausibilità (fisicamente impossibile) ed è stato rimosso — inserisci il valore del produttore qui sotto.',
  lwFlagged: 'Il record di questo modello riporta il segno «verifica del produttore necessaria» — conferma la potenza sonora con il produttore.',
  override: 'Potenza sonora massima / modalità notturna (produttore)',
  overrideHint: 'Consigliato. Il valore dell’etichetta energetica (ErP) non è sempre il funzionamento più rumoroso — usa la potenza sonora massima raggiungibile di notte o un valore garantito in modalità notturna.',
  overrideRequired: 'Obbligatorio — nessun valore utilizzabile nella banca dati.',
  overridePh: 'es. 58',
  lwInvalid: 'Inserisci una potenza sonora tra 30 e 100 dB(A).',
  lwUsed: 'Potenza sonora usata',
  lwSourceDataset: 'valore nominale dalla banca dati',
  lwSourceOverride: 'valore del produttore inserito',
  distance: 'Distanza dalla finestra del vicino (m)',
  distanceInvalid: 'Inserisci una distanza tra 0,5 e 500 m.',
  placement: 'Posizionamento',
  placements: { free: 'A terra, libera (Q = 2)', wall: 'Contro una parete (Q = 4)', corner: 'In un angolo / nicchia (Q = 8)' },
  screening: 'Schermatura',
  screenings: { none: 'Nessuna — vista libera (0 dB)', partial: 'Parziale, linea di vista in parte ostruita (−5 dB)', full: 'Completa, nessuna linea di vista (−10 dB)' },
  result: 'Risultato',
  atDistance: r => `Pressione sonora a ${r} m`,
  needLw: 'Inserisci una potenza sonora per vedere la stima.',
  tableTitle: 'Pressione sonora per distanza',
  colDist: 'Distanza',
  colLp: 'Pressione sonora',
  yours: 'la tua distanza',
  formulaTitle: 'Come si calcola',
  formulaBody: 'Lp = Lw + 10·log10(Q / (4·π·r²)) − A_B. Lw è la potenza sonora, Q la direttività (2 in campo aperto, 4 contro una parete, 8 in un angolo), r la distanza in metri e A_B l’attenuazione della schermatura.',
  assumptionsTitle: 'Ipotesi',
  assumptions: [
    'Sorgente puntiforme in campo libero; suolo e pareti entro circa 1 m riflettono completamente.',
    'Nessun assorbimento atmosferico, effetto suolo, meteo o basse frequenze; schermatura a gradini semplici.',
    'Una sola pompa di calore; altre sorgenti e il rumore residuo non sono inclusi.',
    'Il risultato dipende dalla potenza sonora inserita — usa il valore massimo o notturno del produttore.',
  ],
  disclaimer: 'Stima per la progettazione preliminare — non è una relazione acustica.',
  sources: 'Fonti',
  pdfBtn: 'Stima del rumore (PDF)',
  pdfTitle: 'Stima del rumore',
  pdfFailed: 'Impossibile creare il PDF — riprova.',
  generated: 'Creato il',
  pdfInputs: 'Dati',
  pdfManual: 'Inserimento manuale',
  meters: 'm',
};

export const noiseStrings = (lang: Language | string): NoiseStrings =>
  pick({ en: EN, de: DE, fr: FR, pl: PL, it: IT } as Record<FeatureLang, NoiseStrings>, lang);

/* ── Market rules ────────────────────────────────────────────────────────── */

const TA_SOURCE_EN = 'TA Lärm (6th General Administrative Regulation to the BImSchG, 1998, amended 2017), No. 6.1 immission guide values, No. 6.4 night 22:00–06:00; LAI guideline “Lärm bei stationären Geräten”, 3rd update, 28 Aug 2023 (UMK circular resolution 47/2023): night values, 6 dB irrelevance margin, 3 dB tonality surcharge when unknown, loudest night-time sound power.';
const TA_SOURCE_DE = 'TA Lärm (Sechste Allgemeine Verwaltungsvorschrift zum BImSchG, 1998, geändert 2017), Nr. 6.1 Immissionsrichtwerte, Nr. 6.4 Nachtzeit 22–6 Uhr; LAI-Leitfaden „Lärm bei stationären Geräten“, 3. Aktualisierung, Stand 28.08.2023 (UMK-Umlaufbeschluss 47/2023): Nachtwerte, 6 dB Irrelevanz, 3 dB Tonzuschlag wenn unbekannt, lautester Nachtbetrieb.';

const REGIME: Record<NoiseRegime, Partial<Record<FeatureLang, RegimeStrings>> & { en: RegimeStrings }> = {
  'de-ta-laerm': {
    en: {
      rule: 'TA Lärm night value',
      distanceHint: 'To the relevant immission point: 0.5 m outside the middle of the open window of the most affected habitable room (TA Lärm Annex A.1.3).',
      verdict: { pass: 'Meets the planning target', tight: 'Tight — within the night value, not the 6 dB margin', over: 'Over the night value' },
      verdictBody: {
        pass: 'At least 6 dB below the night value — the LAI guideline’s planning target (the contribution counts as irrelevant, TA Lärm No. 3.2.1).',
        tight: 'Within the TA Lärm night value but less than 6 dB below it: other devices in the neighbourhood could add up to an exceedance. Consider more distance, screening or a quieter model.',
        over: 'Above the TA Lärm night value. Increase the distance, change placement or screening, or choose a quieter model / guaranteed night mode.',
      },
      limitLine: v => `Night value (TA Lärm No. 6.1): ${v} dB(A)`,
      targetLine: v => `Planning target (night value − 6 dB, LAI): ${v} dB(A)`,
      rLimitLine: m => `Minimum distance for the night value: ${m} m`,
      rTargetLine: m => `Minimum distance for the planning target: ${m} m`,
      area: 'Area type at the neighbour (development plan)',
      areas: {
        pure: 'Pure residential (WR)', general: 'General residential / small settlement (WA)', mixed: 'Core, village or mixed area (MK/MD/MI)',
        urban: 'Urban area (MU)', commercial: 'Commercial area (GE)', industrial: 'Industrial area (GI)', spa: 'Spa area, hospitals, care homes',
      },
      nightValue: v => `night ${v} dB(A)`,
      tonal: 'Tonality surcharge +3 dB',
      tonalHint: 'LAI guideline: if nothing is known about audible tones, add 3 dB to be safe (6 dB if tones are clearly audible).',
      source: TA_SOURCE_EN,
    },
    de: {
      rule: 'Nacht-Immissionsrichtwert TA Lärm',
      distanceHint: 'Bis zum maßgeblichen Immissionsort: 0,5 m außerhalb vor der Mitte des geöffneten Fensters des am stärksten betroffenen schutzbedürftigen Raumes (TA Lärm Anhang A.1.3).',
      verdict: { pass: 'Planungsziel eingehalten', tight: 'Knapp — Nachtwert eingehalten, 6-dB-Abstand nicht', over: 'Nachtwert überschritten' },
      verdictBody: {
        pass: 'Mindestens 6 dB unter dem Nachtwert — das Planungsziel des LAI-Leitfadens (Zusatzbelastung irrelevant, TA Lärm Nr. 3.2.1).',
        tight: 'Nachtwert der TA Lärm eingehalten, aber weniger als 6 dB darunter: weitere Geräte in der Nachbarschaft können zu einer Überschreitung führen. Mehr Abstand, Abschirmung oder ein leiseres Modell prüfen.',
        over: 'Über dem Nacht-Immissionsrichtwert der TA Lärm. Abstand vergrößern, Aufstellung oder Abschirmung ändern oder ein leiseres Modell / einen garantierten Nachtmodus wählen.',
      },
      limitLine: v => `Nachtwert (TA Lärm Nr. 6.1): ${v} dB(A)`,
      targetLine: v => `Planungsziel (Nachtwert − 6 dB, LAI): ${v} dB(A)`,
      rLimitLine: m => `Mindestabstand für den Nachtwert: ${m} m`,
      rTargetLine: m => `Mindestabstand für das Planungsziel: ${m} m`,
      area: 'Gebietsart beim Nachbarn (Bebauungsplan)',
      areas: {
        pure: 'Reines Wohngebiet (WR)', general: 'Allgemeines Wohngebiet / Kleinsiedlungsgebiet (WA)', mixed: 'Kern-, Dorf- oder Mischgebiet (MK/MD/MI)',
        urban: 'Urbanes Gebiet (MU)', commercial: 'Gewerbegebiet (GE)', industrial: 'Industriegebiet (GI)', spa: 'Kurgebiet, Krankenhaus, Pflegeanstalt',
      },
      nightValue: v => `nachts ${v} dB(A)`,
      tonal: 'Tonzuschlag +3 dB',
      tonalHint: 'LAI-Leitfaden: Ist über die Tonhaltigkeit nichts bekannt, zur Sicherheit 3 dB ansetzen (6 dB bei deutlich hörbaren Tönen).',
      source: TA_SOURCE_DE,
    },
  },
  'gb-mcs020a': {
    en: {
      rule: 'MCS 020 a) permitted-development limit',
      distanceHint: 'To the assessment position: 1 m outside the centre of the nearest window or door of a neighbour’s habitable room, measured to 0.1 m from the centre of the unit. Check every neighbouring window — the closest is not always the loudest.',
      verdict: { pass: 'At or below 37.0 dB(A)', tight: 'At or below 37.0 dB(A)', over: 'Above 37.0 dB(A)' },
      verdictBody: {
        pass: 'The estimate is equal to or lower than the MCS 020 a) limit of 37.0 dB(A) at this position (rounded to 0.1 dB, no background-noise term).',
        tight: 'The estimate is equal to or lower than the MCS 020 a) limit of 37.0 dB(A) at this position.',
        over: 'Above the MCS 020 a) limit of 37.0 dB(A): as calculated, this would not be permitted development. Move the unit, add a solid barrier or choose a quieter model.',
      },
      limitLine: v => `MCS 020 a) limit: ${v} dB(A) at the assessment position`,
      rLimitLine: m => `Minimum distance for 37.0 dB(A): ${m} m`,
      reference: 'Reference only — MCS 020 a) requires the manufacturer’s sound power level (never a low-noise-mode value); unless you enter the maximum above, this uses the rated (ErP) value. MCS 020 a) screening: −5 dB / −10 dB apply to a solid barrier at least 18 mm thick (thinner solid fences: −2.5 / −5 dB).',
      source: 'MCS 020 a) “Air Source Heat Pump Sound Calculation”, Issue 1.0, 20/03/2025 (mandatory for permitted development from 20/09/2025), Steps 3–8: 37.0 dB(A) LAeq,5min at every assessment position, no background-noise term.',
    },
  },
  'fr-emergence': {
    en: {
      rule: 'Émergence (France)',
      distanceHint: 'To the neighbour’s nearest window or outdoor living area.',
      noVerdict: 'No pass/fail: in France neighbour noise is judged by “émergence” — how far the unit raises the existing background noise (Code de la santé publique art. R1336-7: max. +5 dB(A) by day 07:00–22:00, +3 dB(A) at night), measured on site. Without a background-noise measurement the check cannot be decided from the sound level alone.',
      source: 'Code de la santé publique, art. R1334-31, R1336-6 and R1336-7 (émergence limits).',
    },
    fr: {
      rule: 'Émergence',
      distanceHint: 'Jusqu’à la fenêtre ou l’espace extérieur du voisin le plus proche.',
      noVerdict: 'Pas de verdict : en France, le bruit de voisinage s’apprécie par l’“émergence” — l’augmentation par rapport au bruit résiduel existant (Code de la santé publique, art. R1336-7 : +5 dB(A) max. le jour, 7 h–22 h, +3 dB(A) la nuit), mesurée sur place. Sans mesure du bruit résiduel, le niveau sonore seul ne permet pas de conclure.',
      source: 'Code de la santé publique, art. R1334-31, R1336-6 et R1336-7 (valeurs d’émergence).',
    },
  },
  'pl-zoning': {
    en: {
      rule: 'Local acoustic zoning (Poland)',
      distanceHint: 'To the neighbour’s nearest window or protected area boundary.',
      noVerdict: 'No pass/fail: in Poland the permissible level depends on the protected area type that the local zoning plan assigns to the neighbour’s plot (Regulation of the Minister of the Environment of 14 June 2007 on permissible noise levels in the environment, consolidated text Dz.U. 2014 poz. 112 — e.g. single-family housing 50 dB day / 40 dB night for installations). Compare the table with the value that applies there.',
      source: 'Rozporządzenie Ministra Środowiska z dnia 14 czerwca 2007 r. w sprawie dopuszczalnych poziomów hałasu w środowisku (Dz.U. 2014 poz. 112), Annex 1, Table 1.',
    },
    pl: {
      rule: 'Lokalne przeznaczenie terenu',
      distanceHint: 'Do najbliższego okna sąsiada lub granicy terenu chronionego.',
      noVerdict: 'Bez oceny: dopuszczalny poziom zależy od rodzaju terenu chronionego, jaki miejscowy plan zagospodarowania przestrzennego przypisuje działce sąsiada (rozporządzenie Ministra Środowiska z 14 czerwca 2007 r. w sprawie dopuszczalnych poziomów hałasu w środowisku, Dz.U. 2014 poz. 112 — np. zabudowa jednorodzinna: 50 dB w dzień / 40 dB w nocy dla instalacji). Porównaj tabelę z wartością obowiązującą na tym terenie.',
      source: 'Rozporządzenie Ministra Środowiska z dnia 14 czerwca 2007 r. w sprawie dopuszczalnych poziomów hałasu w środowisku (Dz.U. 2014 poz. 112), załącznik nr 1, tabela 1.',
    },
  },
  'it-zoning': {
    en: {
      rule: 'Municipal acoustic zoning (Italy)',
      distanceHint: 'To the neighbour’s nearest window.',
      noVerdict: 'No pass/fail: in Italy limits follow the municipal acoustic classification (classes I–VI, Law 447/1995, DPCM 14/11/1997), and inside dwellings the differential criterion applies — max. +5 dB by day and +3 dB at night above the residual noise (DPCM 14/11/1997 art. 4), which needs an on-site measurement.',
      source: 'Legge 26 ottobre 1995, n. 447; DPCM 14 novembre 1997 (limit values by acoustic class; art. 4 differential limits 5 dB day / 3 dB night).',
    },
    it: {
      rule: 'Classificazione acustica comunale',
      distanceHint: 'Fino alla finestra del vicino più vicina.',
      noVerdict: 'Nessun verdetto: in Italia i limiti dipendono dalla classificazione acustica comunale (classi I–VI, Legge 447/1995, DPCM 14/11/1997) e negli ambienti abitativi vale il criterio differenziale — max. +5 dB di giorno e +3 dB di notte rispetto al rumore residuo (DPCM 14/11/1997 art. 4), che richiede una misura sul posto.',
      source: 'Legge 26 ottobre 1995, n. 447; DPCM 14 novembre 1997 (valori limite per classe acustica; art. 4 valori limite differenziali 5 dB diurno / 3 dB notturno).',
    },
  },
};

export const regimeStrings = (regime: NoiseRegime, lang: Language | string): RegimeStrings => {
  const r = REGIME[regime];
  return (r as Record<string, RegimeStrings | undefined>)[lang] ?? r.en;
};

/** Formula line shared by page + PDF (always shown next to the numbers). */
export const formulaLine = (lw: string, q: number, r: string, ab: number, kt: number): string =>
  `Lp = ${lw} + 10·log10(${q} / (4·π·${r}²)) − ${ab}${kt ? ` + ${kt}` : ''}`;
