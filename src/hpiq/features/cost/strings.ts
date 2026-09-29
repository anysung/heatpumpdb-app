/** Running cost & CO₂ (Premium feature 6, 2026-09-29) — five-language strings. */
import type { Language } from '../../../types';
import type { BuildingStandard } from './costModel';
import { pick, FeatureLang } from '../lang';

export interface CostStrings {
  title: string;
  subtitle: string;
  estimate: string;
  disclaimer: string;
  teaserTitle: string;
  teaserBody: string;
  unlock: string;
  product: string;
  searchPh: string;
  change: string;
  noProduct: string;
  noResults: string;
  flow: string;
  flow35: string;
  flow55: string;
  scopUsed: string;
  basis: Record<'scop' | 'eta35' | 'eta55' | 'manual', string>;
  scopFlagged: string;
  scopMissing: string;
  scopOverride: string;
  scopUseRecord: string;
  demand: string;
  demandDirect: string;
  demandHelper: string;
  area: string;
  standard: string;
  standards: Record<BuildingStandard, string>;
  helperResult: (kwh: string) => string;
  helperSource: string;
  helperNote: string;
  prices: string;
  elecPrice: string;
  tariffHousehold: string;
  tariffHp: string;
  gasPrice: string;
  perKwh: (cur: string) => string;
  perYear: (cur: string) => string;
  standing: string;
  standingHint: string;
  boiler: string;
  boilerHint: string;
  advanced: string;
  gridCo2: string;
  gasCo2: string;
  defaultsAsOf: (d: string) => string;
  reset: string;
  sources: string;
  results: string;
  annualCost: string;
  hp: string;
  gas: string;
  saving: string;
  extraCost: string;
  co2: string;
  co2Saving: string;
  co2Extra: string;
  range: string;
  bandWhy: string;
  electricityUse: (kwh: string) => string;
  gasUse: (kwh: string) => string;
  missing: string;
  pdf: string;
  pdfTitle: string;
  pdfGenerated: string;
  pdfInputs: string;
  pdfResults: string;
  pdfAssumptions: string;
  pdfSources: string;
  pdfFailed: string;
  pdfCreate: string;
  cancel: string;
  pdfModel: string;
  custom: string;
  assumptions: (scopBasis: string) => string[];
}

const EN: CostStrings = {
  title: 'Running cost & CO₂',
  subtitle: 'Annual heating cost and CO₂ of a heat pump compared with a gas boiler, from the model’s seasonal efficiency and your energy prices.',
  estimate: 'Estimate',
  disclaimer: 'Estimate only — not a quote or a guarantee. Actual costs depend on the building, climate, installation, user behaviour and tariff. Space heating only; domestic hot water is not included.',
  teaserTitle: 'Show your customer what the heat pump costs to run',
  teaserBody: 'Premium estimates the annual running cost and CO₂ of any model against a gas boiler — with editable local energy prices and emission factors — and turns it into a customer PDF with your branding.',
  unlock: 'Unlock with Premium',
  product: 'Heat pump',
  searchPh: 'Search model, manufacturer or ID…',
  change: 'Change',
  noProduct: 'Choose a heat pump from the catalogue to start.',
  noResults: 'No matching model.',
  flow: 'Flow temperature',
  flow35: '35 °C · underfloor',
  flow55: '55 °C · radiators',
  scopUsed: 'SCOP used',
  basis: {
    scop: 'published SCOP (35 °C)',
    eta35: 'derived from ηs 35 °C (EU 811/2013)',
    eta55: 'derived from ηs 55 °C (EU 811/2013)',
    manual: 'entered by you',
  },
  scopFlagged: 'The published SCOP does not agree with the model’s ηs and is not used.',
  scopMissing: 'This record has no seasonal efficiency for this flow temperature — enter a SCOP.',
  scopOverride: 'Enter my own SCOP',
  scopUseRecord: 'Use the model’s value',
  demand: 'Annual heat demand',
  demandDirect: 'I know the demand',
  demandHelper: 'Estimate from floor area',
  area: 'Heated floor area (m²)',
  standard: 'Building standard',
  standards: {
    new: 'New build (current standard)',
    renovated: 'Fully renovated',
    partly: 'Partly renovated',
    unrenovated: 'Unrenovated',
  },
  helperResult: (k) => `≈ ${k} kWh per year (space heating)`,
  helperSource: 'Typical values',
  helperNote: 'German building stock, space heating only (consumption bands × 0.9 boiler efficiency) — adjust for your climate or enter the demand directly.',
  prices: 'Energy prices',
  elecPrice: 'Electricity price',
  tariffHousehold: 'Household tariff',
  tariffHp: 'Heat-pump tariff',
  gasPrice: 'Gas price',
  perKwh: (c) => `${c}/kWh`,
  perYear: (c) => `${c}/year`,
  standing: 'Standing charge difference',
  standingHint: 'Optional: fixed annual cost the gas side carries on top (e.g. the gas connection), minus any extra fixed cost of a heat-pump meter. Default 0.',
  boiler: 'Gas boiler seasonal efficiency',
  boilerHint: '0.90 ≈ a modern condensing boiler; older boilers often reach 0.75–0.85.',
  advanced: 'CO₂ factors',
  gridCo2: 'Grid electricity (kg CO₂/kWh)',
  gasCo2: 'Natural gas (kg CO₂/kWh)',
  defaultsAsOf: (d) => `Defaults as of ${d} — edit them to your tariff.`,
  reset: 'Reset to defaults',
  sources: 'Sources',
  results: 'Result',
  annualCost: 'Annual running cost',
  hp: 'Heat pump',
  gas: 'Gas boiler',
  saving: 'Saving per year',
  extraCost: 'Extra cost per year',
  co2: 'CO₂ per year',
  co2Saving: 'CO₂ saving per year',
  co2Extra: 'Extra CO₂ per year',
  range: 'Range',
  bandWhy: 'Range ±20 % on the heat pump: SCOP is rated for an average European climate — colder regions and higher flow temperatures run lower; domestic hot water is excluded.',
  electricityUse: (k) => `${k} kWh electricity`,
  gasUse: (k) => `${k} kWh gas`,
  missing: 'Complete the highlighted inputs to see the estimate.',
  pdf: 'Customer PDF',
  pdfTitle: 'Running cost & CO₂ estimate',
  pdfGenerated: 'Generated',
  pdfInputs: 'Inputs',
  pdfResults: 'Results',
  pdfAssumptions: 'Assumptions',
  pdfSources: 'Sources of the default values',
  pdfFailed: 'The PDF could not be created. Please try again.',
  pdfCreate: 'Create PDF',
  cancel: 'Cancel',
  pdfModel: 'Heat pump',
  custom: 'custom value',
  assumptions: (b) => [
    `Heat-pump electricity = annual heat demand ÷ SCOP (${b}).`,
    'SCOP relates to the EU average climate (EN 14825). Colder locations, higher flow temperatures and poor hydraulic balancing lower it.',
    'Gas = annual heat demand ÷ boiler seasonal efficiency.',
    'Space heating only — domestic hot water, auxiliary heaters and maintenance are not included.',
    'Range: ±20 % on the heat-pump electricity.',
    'Prices and emission factors are the values shown under Inputs; defaults are public statistics and can be edited.',
  ],
};

const DE: CostStrings = {
  title: 'Betriebskosten & CO₂',
  subtitle: 'Jährliche Heizkosten und CO₂ einer Wärmepumpe im Vergleich zum Gaskessel — aus der Jahresarbeitszahl des Modells und Ihren Energiepreisen.',
  estimate: 'Schätzung',
  disclaimer: 'Nur eine Schätzung — kein Angebot und keine Garantie. Die tatsächlichen Kosten hängen von Gebäude, Klima, Installation, Nutzerverhalten und Tarif ab. Nur Raumheizung; Warmwasser ist nicht enthalten.',
  teaserTitle: 'Zeigen Sie Ihren Kunden, was die Wärmepumpe im Betrieb kostet',
  teaserBody: 'Premium schätzt die jährlichen Betriebskosten und das CO₂ jedes Modells im Vergleich zum Gaskessel — mit anpassbaren Energiepreisen und Emissionsfaktoren — und erstellt daraus ein Kunden-PDF mit Ihrem Branding.',
  unlock: 'Mit Premium freischalten',
  product: 'Wärmepumpe',
  searchPh: 'Modell, Hersteller oder ID suchen…',
  change: 'Ändern',
  noProduct: 'Wählen Sie eine Wärmepumpe aus dem Katalog.',
  noResults: 'Kein passendes Modell.',
  flow: 'Vorlauftemperatur',
  flow35: '35 °C · Fußbodenheizung',
  flow55: '55 °C · Heizkörper',
  scopUsed: 'Verwendeter SCOP',
  basis: {
    scop: 'veröffentlichter SCOP (35 °C)',
    eta35: 'aus ηs 35 °C abgeleitet (EU 811/2013)',
    eta55: 'aus ηs 55 °C abgeleitet (EU 811/2013)',
    manual: 'von Ihnen eingegeben',
  },
  scopFlagged: 'Der veröffentlichte SCOP passt nicht zum ηs des Modells und wird nicht verwendet.',
  scopMissing: 'Für diese Vorlauftemperatur liegt keine Jahreseffizienz vor — bitte SCOP eingeben.',
  scopOverride: 'Eigenen SCOP eingeben',
  scopUseRecord: 'Wert des Modells verwenden',
  demand: 'Jährlicher Heizwärmebedarf',
  demandDirect: 'Bedarf bekannt',
  demandHelper: 'Aus Wohnfläche schätzen',
  area: 'Beheizte Wohnfläche (m²)',
  standard: 'Gebäudestandard',
  standards: {
    new: 'Neubau (aktueller Standard)',
    renovated: 'Vollsaniert',
    partly: 'Teilsaniert',
    unrenovated: 'Unsaniert',
  },
  helperResult: (k) => `≈ ${k} kWh pro Jahr (Raumheizung)`,
  helperSource: 'Typische Werte',
  helperNote: 'Deutscher Gebäudebestand, nur Raumheizung (Verbrauchsbänder × 0,9 Kesselnutzungsgrad) — für Ihr Klima anpassen oder den Bedarf direkt eingeben.',
  prices: 'Energiepreise',
  elecPrice: 'Strompreis',
  tariffHousehold: 'Haushaltstarif',
  tariffHp: 'Wärmepumpentarif',
  gasPrice: 'Gaspreis',
  perKwh: (c) => `${c}/kWh`,
  perYear: (c) => `${c}/Jahr`,
  standing: 'Differenz der Grundgebühren',
  standingHint: 'Optional: feste Jahreskosten, die zusätzlich auf der Gasseite anfallen (z. B. Gasanschluss), abzüglich zusätzlicher Fixkosten eines Wärmepumpenzählers. Standard 0.',
  boiler: 'Jahresnutzungsgrad Gaskessel',
  boilerHint: '0,90 ≈ moderner Brennwertkessel; ältere Kessel erreichen oft 0,75–0,85.',
  advanced: 'CO₂-Faktoren',
  gridCo2: 'Netzstrom (kg CO₂/kWh)',
  gasCo2: 'Erdgas (kg CO₂/kWh)',
  defaultsAsOf: (d) => `Standardwerte Stand ${d} — an Ihren Tarif anpassen.`,
  reset: 'Standardwerte',
  sources: 'Quellen',
  results: 'Ergebnis',
  annualCost: 'Jährliche Betriebskosten',
  hp: 'Wärmepumpe',
  gas: 'Gaskessel',
  saving: 'Ersparnis pro Jahr',
  extraCost: 'Mehrkosten pro Jahr',
  co2: 'CO₂ pro Jahr',
  co2Saving: 'CO₂-Einsparung pro Jahr',
  co2Extra: 'CO₂-Mehrausstoß pro Jahr',
  range: 'Spanne',
  bandWhy: 'Spanne ±20 % bei der Wärmepumpe: Der SCOP gilt für ein mittleres europäisches Klima — kältere Regionen und höhere Vorlauftemperaturen liegen darunter; Warmwasser ist nicht enthalten.',
  electricityUse: (k) => `${k} kWh Strom`,
  gasUse: (k) => `${k} kWh Gas`,
  missing: 'Bitte die markierten Eingaben ergänzen, um die Schätzung zu sehen.',
  pdf: 'Kunden-PDF',
  pdfTitle: 'Schätzung Betriebskosten & CO₂',
  pdfGenerated: 'Erstellt',
  pdfInputs: 'Eingaben',
  pdfResults: 'Ergebnis',
  pdfAssumptions: 'Annahmen',
  pdfSources: 'Quellen der Standardwerte',
  pdfFailed: 'Das PDF konnte nicht erstellt werden. Bitte erneut versuchen.',
  pdfCreate: 'PDF erstellen',
  cancel: 'Abbrechen',
  pdfModel: 'Wärmepumpe',
  custom: 'eigener Wert',
  assumptions: (b) => [
    `Strom der Wärmepumpe = Heizwärmebedarf ÷ SCOP (${b}).`,
    'Der SCOP bezieht sich auf das mittlere EU-Klima (EN 14825). Kältere Standorte, höhere Vorlauftemperaturen und fehlender hydraulischer Abgleich senken ihn.',
    'Gas = Heizwärmebedarf ÷ Jahresnutzungsgrad des Kessels.',
    'Nur Raumheizung — Warmwasser, Heizstab und Wartung sind nicht enthalten.',
    'Spanne: ±20 % beim Strom der Wärmepumpe.',
    'Preise und Emissionsfaktoren sind die unter „Eingaben“ genannten Werte; die Standardwerte stammen aus öffentlichen Statistiken und sind anpassbar.',
  ],
};

const FR: CostStrings = {
  title: 'Coût d’usage & CO₂',
  subtitle: 'Coût de chauffage annuel et CO₂ d’une pompe à chaleur comparés à une chaudière gaz, à partir de l’efficacité saisonnière du modèle et de vos prix de l’énergie.',
  estimate: 'Estimation',
  disclaimer: 'Estimation uniquement — ni devis ni garantie. Les coûts réels dépendent du bâtiment, du climat, de l’installation, des usages et du tarif. Chauffage seul ; l’eau chaude sanitaire n’est pas incluse.',
  teaserTitle: 'Montrez à votre client ce que coûte la pompe à chaleur à l’usage',
  teaserBody: 'Premium estime le coût annuel et le CO₂ de chaque modèle face à une chaudière gaz — avec prix de l’énergie et facteurs d’émission modifiables — et en fait un PDF client à vos couleurs.',
  unlock: 'Débloquer avec Premium',
  product: 'Pompe à chaleur',
  searchPh: 'Rechercher modèle, fabricant ou ID…',
  change: 'Changer',
  noProduct: 'Choisissez une pompe à chaleur dans le catalogue.',
  noResults: 'Aucun modèle correspondant.',
  flow: 'Température de départ',
  flow35: '35 °C · plancher chauffant',
  flow55: '55 °C · radiateurs',
  scopUsed: 'SCOP utilisé',
  basis: {
    scop: 'SCOP publié (35 °C)',
    eta35: 'dérivé de ηs 35 °C (UE 811/2013)',
    eta55: 'dérivé de ηs 55 °C (UE 811/2013)',
    manual: 'saisi par vous',
  },
  scopFlagged: 'Le SCOP publié ne concorde pas avec le ηs du modèle et n’est pas utilisé.',
  scopMissing: 'Aucune efficacité saisonnière pour cette température de départ — saisissez un SCOP.',
  scopOverride: 'Saisir mon propre SCOP',
  scopUseRecord: 'Utiliser la valeur du modèle',
  demand: 'Besoin annuel de chauffage',
  demandDirect: 'Je connais le besoin',
  demandHelper: 'Estimer à partir de la surface',
  area: 'Surface chauffée (m²)',
  standard: 'Niveau du bâtiment',
  standards: {
    new: 'Neuf (norme actuelle)',
    renovated: 'Entièrement rénové',
    partly: 'Partiellement rénové',
    unrenovated: 'Non rénové',
  },
  helperResult: (k) => `≈ ${k} kWh par an (chauffage)`,
  helperSource: 'Valeurs types',
  helperNote: 'Parc de bâtiments allemand, chauffage seul (tranches de consommation × 0,9 de rendement chaudière) — à adapter à votre climat, ou saisissez directement le besoin.',
  prices: 'Prix de l’énergie',
  elecPrice: 'Prix de l’électricité',
  tariffHousehold: 'Tarif résidentiel',
  tariffHp: 'Tarif pompe à chaleur',
  gasPrice: 'Prix du gaz',
  perKwh: (c) => `${c}/kWh`,
  perYear: (c) => `${c}/an`,
  standing: 'Écart d’abonnement',
  standingHint: 'Facultatif : coût fixe annuel supplémentaire côté gaz (abonnement gaz), moins un éventuel surcoût fixe côté pompe à chaleur. Par défaut 0.',
  boiler: 'Rendement saisonnier de la chaudière gaz',
  boilerHint: '0,90 ≈ chaudière à condensation récente ; les chaudières anciennes atteignent souvent 0,75–0,85.',
  advanced: 'Facteurs CO₂',
  gridCo2: 'Électricité réseau (kg CO₂/kWh)',
  gasCo2: 'Gaz naturel (kg CO₂/kWh)',
  defaultsAsOf: (d) => `Valeurs par défaut au ${d} — adaptez-les à votre tarif.`,
  reset: 'Valeurs par défaut',
  sources: 'Sources',
  results: 'Résultat',
  annualCost: 'Coût annuel',
  hp: 'Pompe à chaleur',
  gas: 'Chaudière gaz',
  saving: 'Économie par an',
  extraCost: 'Surcoût par an',
  co2: 'CO₂ par an',
  co2Saving: 'CO₂ évité par an',
  co2Extra: 'CO₂ supplémentaire par an',
  range: 'Fourchette',
  bandWhy: 'Fourchette ±20 % sur la pompe à chaleur : le SCOP correspond à un climat européen moyen — les régions plus froides et les températures de départ plus élevées donnent moins ; l’eau chaude sanitaire est exclue.',
  electricityUse: (k) => `${k} kWh d’électricité`,
  gasUse: (k) => `${k} kWh de gaz`,
  missing: 'Complétez les champs signalés pour voir l’estimation.',
  pdf: 'PDF client',
  pdfTitle: 'Estimation coût d’usage & CO₂',
  pdfGenerated: 'Généré le',
  pdfInputs: 'Données saisies',
  pdfResults: 'Résultat',
  pdfAssumptions: 'Hypothèses',
  pdfSources: 'Sources des valeurs par défaut',
  pdfFailed: 'Le PDF n’a pas pu être créé. Veuillez réessayer.',
  pdfCreate: 'Créer le PDF',
  cancel: 'Annuler',
  pdfModel: 'Pompe à chaleur',
  custom: 'valeur personnalisée',
  assumptions: (b) => [
    `Électricité de la PAC = besoin de chauffage ÷ SCOP (${b}).`,
    'Le SCOP se rapporte au climat moyen européen (EN 14825). Un site plus froid, une température de départ plus élevée ou un mauvais équilibrage le réduisent.',
    'Gaz = besoin de chauffage ÷ rendement saisonnier de la chaudière.',
    'Chauffage seul — eau chaude sanitaire, appoint électrique et entretien non inclus.',
    'Fourchette : ±20 % sur l’électricité de la PAC.',
    'Prix et facteurs d’émission : valeurs indiquées dans « Données saisies » ; les valeurs par défaut sont des statistiques publiques modifiables.',
  ],
};

const PL: CostStrings = {
  title: 'Koszty eksploatacji i CO₂',
  subtitle: 'Roczny koszt ogrzewania i emisja CO₂ pompy ciepła w porównaniu z kotłem gazowym — na podstawie sezonowej efektywności modelu i Twoich cen energii.',
  estimate: 'Szacunek',
  disclaimer: 'Wyłącznie szacunek — nie jest to oferta ani gwarancja. Rzeczywiste koszty zależą od budynku, klimatu, instalacji, sposobu użytkowania i taryfy. Tylko ogrzewanie pomieszczeń; ciepła woda użytkowa nie jest uwzględniona.',
  teaserTitle: 'Pokaż klientowi, ile kosztuje eksploatacja pompy ciepła',
  teaserBody: 'Premium szacuje roczny koszt eksploatacji i CO₂ każdego modelu w porównaniu z kotłem gazowym — z edytowalnymi cenami energii i wskaźnikami emisji — i tworzy z tego PDF dla klienta z Twoim logo.',
  unlock: 'Odblokuj w Premium',
  product: 'Pompa ciepła',
  searchPh: 'Szukaj modelu, producenta lub ID…',
  change: 'Zmień',
  noProduct: 'Wybierz pompę ciepła z katalogu.',
  noResults: 'Brak pasującego modelu.',
  flow: 'Temperatura zasilania',
  flow35: '35 °C · ogrzewanie podłogowe',
  flow55: '55 °C · grzejniki',
  scopUsed: 'Użyty SCOP',
  basis: {
    scop: 'opublikowany SCOP (35 °C)',
    eta35: 'wyliczony z ηs 35 °C (UE 811/2013)',
    eta55: 'wyliczony z ηs 55 °C (UE 811/2013)',
    manual: 'wprowadzony przez Ciebie',
  },
  scopFlagged: 'Opublikowany SCOP nie zgadza się z ηs modelu i nie jest używany.',
  scopMissing: 'Brak efektywności sezonowej dla tej temperatury zasilania — wprowadź SCOP.',
  scopOverride: 'Wprowadź własny SCOP',
  scopUseRecord: 'Użyj wartości modelu',
  demand: 'Roczne zapotrzebowanie na ciepło',
  demandDirect: 'Znam zapotrzebowanie',
  demandHelper: 'Oszacuj z powierzchni',
  area: 'Powierzchnia ogrzewana (m²)',
  standard: 'Standard budynku',
  standards: {
    new: 'Nowy budynek (obecne wymagania)',
    renovated: 'Po pełnej termomodernizacji',
    partly: 'Częściowo zmodernizowany',
    unrenovated: 'Bez termomodernizacji',
  },
  helperResult: (k) => `≈ ${k} kWh rocznie (ogrzewanie)`,
  helperSource: 'Wartości typowe',
  helperNote: 'Niemiecki zasób budynków, tylko ogrzewanie (przedziały zużycia × 0,9 sprawności kotła) — dostosuj do swojego klimatu lub wpisz zapotrzebowanie bezpośrednio.',
  prices: 'Ceny energii',
  elecPrice: 'Cena energii elektrycznej',
  tariffHousehold: 'Taryfa gospodarstwa domowego',
  tariffHp: 'Taryfa dla pompy ciepła',
  gasPrice: 'Cena gazu',
  perKwh: (c) => `${c}/kWh`,
  perYear: (c) => `${c}/rok`,
  standing: 'Różnica opłat stałych',
  standingHint: 'Opcjonalnie: dodatkowy stały koszt roczny po stronie gazu (np. przyłącze gazowe) minus ewentualny dodatkowy koszt stały licznika pompy ciepła. Domyślnie 0.',
  boiler: 'Sezonowa sprawność kotła gazowego',
  boilerHint: '0,90 ≈ nowoczesny kocioł kondensacyjny; starsze kotły osiągają często 0,75–0,85.',
  advanced: 'Wskaźniki CO₂',
  gridCo2: 'Energia z sieci (kg CO₂/kWh)',
  gasCo2: 'Gaz ziemny (kg CO₂/kWh)',
  defaultsAsOf: (d) => `Wartości domyślne na ${d} — dostosuj je do swojej taryfy.`,
  reset: 'Przywróć domyślne',
  sources: 'Źródła',
  results: 'Wynik',
  annualCost: 'Roczny koszt eksploatacji',
  hp: 'Pompa ciepła',
  gas: 'Kocioł gazowy',
  saving: 'Oszczędność rocznie',
  extraCost: 'Dodatkowy koszt rocznie',
  co2: 'CO₂ rocznie',
  co2Saving: 'Redukcja CO₂ rocznie',
  co2Extra: 'Dodatkowe CO₂ rocznie',
  range: 'Zakres',
  bandWhy: 'Zakres ±20 % dla pompy ciepła: SCOP dotyczy przeciętnego klimatu europejskiego — w chłodniejszych regionach i przy wyższej temperaturze zasilania jest niższy; ciepła woda użytkowa nie jest uwzględniona.',
  electricityUse: (k) => `${k} kWh energii elektrycznej`,
  gasUse: (k) => `${k} kWh gazu`,
  missing: 'Uzupełnij zaznaczone pola, aby zobaczyć szacunek.',
  pdf: 'PDF dla klienta',
  pdfTitle: 'Szacunek kosztów eksploatacji i CO₂',
  pdfGenerated: 'Utworzono',
  pdfInputs: 'Dane wejściowe',
  pdfResults: 'Wynik',
  pdfAssumptions: 'Założenia',
  pdfSources: 'Źródła wartości domyślnych',
  pdfFailed: 'Nie udało się utworzyć PDF. Spróbuj ponownie.',
  pdfCreate: 'Utwórz PDF',
  cancel: 'Anuluj',
  pdfModel: 'Pompa ciepła',
  custom: 'wartość własna',
  assumptions: (b) => [
    `Energia elektryczna pompy ciepła = zapotrzebowanie na ciepło ÷ SCOP (${b}).`,
    'SCOP dotyczy przeciętnego klimatu UE (EN 14825). Chłodniejsza lokalizacja, wyższa temperatura zasilania i brak równoważenia hydraulicznego go obniżają.',
    'Gaz = zapotrzebowanie na ciepło ÷ sezonowa sprawność kotła.',
    'Tylko ogrzewanie — ciepła woda użytkowa, grzałka i serwis nie są uwzględnione.',
    'Zakres: ±20 % energii elektrycznej pompy ciepła.',
    'Ceny i wskaźniki emisji to wartości podane w „Danych wejściowych”; wartości domyślne pochodzą z publicznych statystyk i można je zmienić.',
  ],
};

const IT: CostStrings = {
  title: 'Costi di esercizio e CO₂',
  subtitle: 'Costo annuo di riscaldamento e CO₂ di una pompa di calore rispetto a una caldaia a gas, dall’efficienza stagionale del modello e dai tuoi prezzi dell’energia.',
  estimate: 'Stima',
  disclaimer: 'Solo una stima — non è un preventivo né una garanzia. I costi reali dipendono da edificio, clima, installazione, abitudini d’uso e tariffa. Solo riscaldamento degli ambienti; l’acqua calda sanitaria non è inclusa.',
  teaserTitle: 'Mostra al cliente quanto costa far funzionare la pompa di calore',
  teaserBody: 'Premium stima il costo annuo di esercizio e la CO₂ di ogni modello rispetto a una caldaia a gas — con prezzi dell’energia e fattori di emissione modificabili — e lo trasforma in un PDF per il cliente con il tuo marchio.',
  unlock: 'Sblocca con Premium',
  product: 'Pompa di calore',
  searchPh: 'Cerca modello, produttore o ID…',
  change: 'Cambia',
  noProduct: 'Scegli una pompa di calore dal catalogo.',
  noResults: 'Nessun modello corrispondente.',
  flow: 'Temperatura di mandata',
  flow35: '35 °C · pavimento radiante',
  flow55: '55 °C · radiatori',
  scopUsed: 'SCOP utilizzato',
  basis: {
    scop: 'SCOP pubblicato (35 °C)',
    eta35: 'ricavato da ηs 35 °C (UE 811/2013)',
    eta55: 'ricavato da ηs 55 °C (UE 811/2013)',
    manual: 'inserito da te',
  },
  scopFlagged: 'Lo SCOP pubblicato non concorda con l’ηs del modello e non viene utilizzato.',
  scopMissing: 'Nessuna efficienza stagionale per questa temperatura di mandata — inserisci uno SCOP.',
  scopOverride: 'Inserisci il mio SCOP',
  scopUseRecord: 'Usa il valore del modello',
  demand: 'Fabbisogno annuo di calore',
  demandDirect: 'Conosco il fabbisogno',
  demandHelper: 'Stima dalla superficie',
  area: 'Superficie riscaldata (m²)',
  standard: 'Standard dell’edificio',
  standards: {
    new: 'Nuova costruzione (standard attuale)',
    renovated: 'Completamente riqualificato',
    partly: 'Parzialmente riqualificato',
    unrenovated: 'Non riqualificato',
  },
  helperResult: (k) => `≈ ${k} kWh all’anno (riscaldamento)`,
  helperSource: 'Valori tipici',
  helperNote: 'Parco edilizio tedesco, solo riscaldamento (fasce di consumo × 0,9 di rendimento caldaia) — adatta al tuo clima o inserisci direttamente il fabbisogno.',
  prices: 'Prezzi dell’energia',
  elecPrice: 'Prezzo dell’elettricità',
  tariffHousehold: 'Tariffa domestica',
  tariffHp: 'Tariffa pompa di calore',
  gasPrice: 'Prezzo del gas',
  perKwh: (c) => `${c}/kWh`,
  perYear: (c) => `${c}/anno`,
  standing: 'Differenza quote fisse',
  standingHint: 'Facoltativo: costo fisso annuo aggiuntivo lato gas (es. quota fissa del gas), meno un eventuale costo fisso aggiuntivo lato pompa di calore. Predefinito 0.',
  boiler: 'Rendimento stagionale caldaia a gas',
  boilerHint: '0,90 ≈ caldaia a condensazione moderna; le caldaie più vecchie raggiungono spesso 0,75–0,85.',
  advanced: 'Fattori CO₂',
  gridCo2: 'Elettricità di rete (kg CO₂/kWh)',
  gasCo2: 'Gas naturale (kg CO₂/kWh)',
  defaultsAsOf: (d) => `Valori predefiniti al ${d} — adattali alla tua tariffa.`,
  reset: 'Ripristina predefiniti',
  sources: 'Fonti',
  results: 'Risultato',
  annualCost: 'Costo annuo di esercizio',
  hp: 'Pompa di calore',
  gas: 'Caldaia a gas',
  saving: 'Risparmio annuo',
  extraCost: 'Costo aggiuntivo annuo',
  co2: 'CO₂ all’anno',
  co2Saving: 'CO₂ evitata all’anno',
  co2Extra: 'CO₂ aggiuntiva all’anno',
  range: 'Intervallo',
  bandWhy: 'Intervallo ±20 % sulla pompa di calore: lo SCOP si riferisce a un clima europeo medio — regioni più fredde e temperature di mandata più alte danno valori inferiori; l’acqua calda sanitaria è esclusa.',
  electricityUse: (k) => `${k} kWh di elettricità`,
  gasUse: (k) => `${k} kWh di gas`,
  missing: 'Completa i campi evidenziati per vedere la stima.',
  pdf: 'PDF per il cliente',
  pdfTitle: 'Stima costi di esercizio e CO₂',
  pdfGenerated: 'Generato il',
  pdfInputs: 'Dati inseriti',
  pdfResults: 'Risultato',
  pdfAssumptions: 'Ipotesi',
  pdfSources: 'Fonti dei valori predefiniti',
  pdfFailed: 'Impossibile creare il PDF. Riprova.',
  pdfCreate: 'Crea PDF',
  cancel: 'Annulla',
  pdfModel: 'Pompa di calore',
  custom: 'valore personalizzato',
  assumptions: (b) => [
    `Elettricità della pompa di calore = fabbisogno di calore ÷ SCOP (${b}).`,
    'Lo SCOP si riferisce al clima medio UE (EN 14825). Località più fredde, temperature di mandata più alte e un bilanciamento idraulico carente lo riducono.',
    'Gas = fabbisogno di calore ÷ rendimento stagionale della caldaia.',
    'Solo riscaldamento — acqua calda sanitaria, resistenza integrativa e manutenzione non inclusi.',
    'Intervallo: ±20 % sull’elettricità della pompa di calore.',
    'Prezzi e fattori di emissione sono i valori indicati in «Dati inseriti»; i predefiniti provengono da statistiche pubbliche e sono modificabili.',
  ],
};

const T: Record<FeatureLang, CostStrings> = { en: EN, de: DE, fr: FR, pl: PL, it: IT };
export const costStrings = (lang: Language | string): CostStrings => pick(T, lang);
