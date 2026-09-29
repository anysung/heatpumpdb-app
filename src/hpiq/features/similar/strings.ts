/**
 * Alternatives finder strings (EN/DE/FR/PL/IT). Resolved with `pick` from
 * features/lang.ts. Listing wording follows CLAUDE.md: a filter selects the
 * LISTED products; nothing here ever says "not listed".
 */
import { pick, FeatureLang } from '../lang';
import type { Language } from '../../../types';

export interface SimilarStrings {
  title: string;
  found: (n: number) => string;
  none: string;
  noneFiltered: string;
  noCapacity: string;
  band: (pct: number) => string;
  widened: string;
  r290: string;
  quieter: string;
  listedOnly: (source: string) => string;
  colModel: string;
  colKw: string;
  colScop: string;
  colSound: string;
  compare: string;
  inCompare: string;
  locked: string;
  unlock: string;
  sameType: string;
}

const EN: SimilarStrings = {
  title: 'Alternatives',
  found: n => (n === 1 ? '1 alternative found' : `${n} alternatives found`),
  none: 'No comparable model in this capacity band.',
  noneFiltered: 'No alternative matches the selected filters.',
  noCapacity: 'No rated capacity published for this model, so alternatives cannot be matched.',
  band: pct => `Same heat source · rated capacity ±${pct} %`,
  widened: 'Fewer than 3 matches at ±10 % — band widened to ±15 %.',
  r290: 'R290 only',
  quieter: 'Quieter',
  listedOnly: s => `${s} listed only`,
  colModel: 'Model',
  colKw: 'kW',
  colScop: 'SCOP',
  colSound: 'Sound',
  compare: '+ compare',
  inCompare: '✓ compared',
  locked: 'Ranked by SCOP and sound power — part of Premium.',
  unlock: 'Unlock alternatives',
  sameType: 'same heat source',
};

const DE: SimilarStrings = {
  title: 'Alternativen',
  found: n => (n === 1 ? '1 Alternative gefunden' : `${n} Alternativen gefunden`),
  none: 'Kein vergleichbares Modell in diesem Leistungsbereich.',
  noneFiltered: 'Keine Alternative passt zu den gewählten Filtern.',
  noCapacity: 'Für dieses Modell ist keine Nennleistung veröffentlicht – Alternativen lassen sich nicht zuordnen.',
  band: pct => `Gleiche Wärmequelle · Nennleistung ±${pct} %`,
  widened: 'Weniger als 3 Treffer bei ±10 % – Bereich auf ±15 % erweitert.',
  r290: 'Nur R290',
  quieter: 'Leiser',
  listedOnly: s => `Nur ${s}-gelistet`,
  colModel: 'Modell',
  colKw: 'kW',
  colScop: 'SCOP',
  colSound: 'Schall',
  compare: '+ Vergleich',
  inCompare: '✓ im Vergleich',
  locked: 'Sortiert nach SCOP und Schallleistung – Teil von Premium.',
  unlock: 'Alternativen freischalten',
  sameType: 'gleiche Wärmequelle',
};

const FR: SimilarStrings = {
  title: 'Alternatives',
  found: n => (n === 1 ? '1 alternative trouvée' : `${n} alternatives trouvées`),
  none: 'Aucun modèle comparable dans cette plage de puissance.',
  noneFiltered: 'Aucune alternative ne correspond aux filtres choisis.',
  noCapacity: 'Aucune puissance nominale publiée pour ce modèle : impossible de trouver des alternatives.',
  band: pct => `Même source de chaleur · puissance nominale ±${pct} %`,
  widened: 'Moins de 3 résultats à ±10 % – plage élargie à ±15 %.',
  r290: 'R290 uniquement',
  quieter: 'Plus silencieux',
  listedOnly: s => `${s} uniquement`,
  colModel: 'Modèle',
  colKw: 'kW',
  colScop: 'SCOP',
  colSound: 'Son',
  compare: '+ comparer',
  inCompare: '✓ comparé',
  locked: 'Classées par SCOP et puissance acoustique – inclus dans Premium.',
  unlock: 'Débloquer les alternatives',
  sameType: 'même source de chaleur',
};

const PL: SimilarStrings = {
  title: 'Alternatywy',
  found: n => (n === 1 ? 'Znaleziono 1 alternatywę' : `Znaleziono alternatyw: ${n}`),
  none: 'Brak porównywalnego modelu w tym zakresie mocy.',
  noneFiltered: 'Żadna alternatywa nie spełnia wybranych filtrów.',
  noCapacity: 'Dla tego modelu nie opublikowano mocy znamionowej – nie można dobrać alternatyw.',
  band: pct => `To samo dolne źródło · moc znamionowa ±${pct} %`,
  widened: 'Mniej niż 3 wyniki przy ±10 % – zakres poszerzono do ±15 %.',
  r290: 'Tylko R290',
  quieter: 'Cichsze',
  listedOnly: s => `Tylko na liście ${s}`,
  colModel: 'Model',
  colKw: 'kW',
  colScop: 'SCOP',
  colSound: 'Hałas',
  compare: '+ porównaj',
  inCompare: '✓ w porównaniu',
  locked: 'Ranking według SCOP i mocy akustycznej – w pakiecie Premium.',
  unlock: 'Odblokuj alternatywy',
  sameType: 'to samo źródło',
};

const IT: SimilarStrings = {
  title: 'Alternative',
  found: n => (n === 1 ? '1 alternativa trovata' : `${n} alternative trovate`),
  none: 'Nessun modello confrontabile in questa fascia di potenza.',
  noneFiltered: 'Nessuna alternativa corrisponde ai filtri scelti.',
  noCapacity: 'Nessuna potenza nominale pubblicata per questo modello: impossibile trovare alternative.',
  band: pct => `Stessa sorgente · potenza nominale ±${pct} %`,
  widened: 'Meno di 3 risultati a ±10 % – fascia ampliata a ±15 %.',
  r290: 'Solo R290',
  quieter: 'Più silenziose',
  listedOnly: s => `Solo ${s}`,
  colModel: 'Modello',
  colKw: 'kW',
  colScop: 'SCOP',
  colSound: 'Rumore',
  compare: '+ confronta',
  inCompare: '✓ nel confronto',
  locked: 'Ordinate per SCOP e potenza sonora – incluso in Premium.',
  unlock: 'Sblocca le alternative',
  sameType: 'stessa sorgente',
};

const TABLE: Record<FeatureLang, SimilarStrings> = { en: EN, de: DE, fr: FR, pl: PL, it: IT };
export const similarStrings = (lang: Language | string): SimilarStrings => pick(TABLE, lang);
