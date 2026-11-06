/** Picture caption and the site's small-print data note (EN/DE/FR/PL/IT), resolved with `pick`. */
import { pick, FeatureLang } from '../lang';
import type { Language } from '../../../types';
import { SUPPORT_EMAIL } from '../../../config/legal';

interface UnitImageStrings { caption: string; dataNote: string; correctionNote: string; }

const T: Record<FeatureLang, UnitImageStrings> = {
  en: {
    caption: 'Representative image of the brand. The actual model may differ.',
    dataNote: 'Data on this site is updated regularly, but some of it may differ from the manufacturer’s latest information. Please confirm final specifications with the manufacturer.',
    correctionNote: `Product data comes from official sources, so corrections follow when the official data is updated. To correct product images or other material, write to ${SUPPORT_EMAIL}.`,
  },
  de: {
    caption: 'Repräsentatives Bild der Marke. Das tatsächliche Modell kann abweichen.',
    dataNote: 'Die Daten auf dieser Website werden regelmäßig aktualisiert, einzelne Angaben können jedoch von den neuesten Herstellerinformationen abweichen. Bitte bestätigen Sie die endgültigen Spezifikationen beim Hersteller.',
    correctionNote: `Produktdaten stammen aus offiziellen Quellen; Korrekturen erfolgen durch die Aktualisierung der offiziellen Daten. Korrekturen an Produktbildern und anderem Material nehmen wir gerne unter ${SUPPORT_EMAIL} entgegen.`,
  },
  fr: {
    caption: 'Image représentative de la marque. Le modèle réel peut différer.',
    dataNote: 'Les données de ce site sont mises à jour régulièrement, mais certaines peuvent différer des dernières informations du fabricant. Veuillez confirmer les spécifications définitives auprès du fabricant.',
    correctionNote: `Les données produits proviennent de sources officielles : elles sont corrigées lors de la mise à jour de ces données. Pour corriger une image produit ou un autre contenu, écrivez à ${SUPPORT_EMAIL}.`,
  },
  pl: {
    caption: 'Poglądowy obraz marki. Rzeczywisty model może się różnić.',
    dataNote: 'Dane w serwisie są regularnie aktualizowane, ale niektóre mogą różnić się od najnowszych informacji producenta. Ostateczną specyfikację prosimy potwierdzić u producenta.',
    correctionNote: `Dane produktów pochodzą ze źródeł oficjalnych, dlatego korekty następują wraz z aktualizacją tych danych. W sprawie korekty zdjęć produktów lub innych materiałów prosimy pisać na ${SUPPORT_EMAIL}.`,
  },
  it: {
    caption: 'Immagine rappresentativa del marchio. Il modello reale può differire.',
    dataNote: 'I dati di questo sito sono aggiornati regolarmente, ma alcuni possono differire dalle ultime informazioni del produttore. Si consiglia di confermare le specifiche definitive con il produttore.',
    correctionNote: `I dati dei prodotti provengono da fonti ufficiali: le correzioni seguono l’aggiornamento dei dati ufficiali. Per correggere immagini di prodotto o altri materiali scrivere a ${SUPPORT_EMAIL}.`,
  },
};
export const unitImageStrings = (lang: Language | string) => pick(T, lang);
