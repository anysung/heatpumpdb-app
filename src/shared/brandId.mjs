/**
 * Brand identity: which company a registered manufacturer name belongs to.
 * One rule for the Heatpump Finder export and the app's brand images.
 */
import ALIASES from '../../scripts/finder/brand-aliases.json' with { type: 'json' };

const LEGAL = /\b(gmbh|co|kg|ag|se|spa|s\.p\.a|ltd|limited|sas|bv|srl|sa|inc|llc|corporation|corp|group|brand|climate|solutions|werke|deutschland|france|europe|heating|hvac|products|electronics|electric)\b/g;
export const normBrand = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(LEGAL, ' ').replace(/[^a-z0-9]/g, '');

// Legal forms say nothing about the brand and never belong on a consumer screen.
const COMPANY_FORM = /[\s,.]*\b(gmbh(\s*&\s*co\.?\s*kg)?|ug|kg|d\.o\.o\.?|s\.r\.o\.?|a\.s\.?|sp\.?\s*z\s*o\.?\s*o\.?(\s*sp\.?\s*k\.?)?|s\.?p\.?a\.?|s\.?a\.?s?|ab|a\/s|b\.?v\.?|s\.?r\.?l\.?|ltd\.?|limited|inc\.?|llc|co\.?,?\s*ltd\.?|corp\.?|corporation)\b\.?[\s,.]*$/i;
export const stripCompanyForm = (s) => {
  let out = String(s ?? '').trim();
  for (let prev = ''; prev !== out; ) { prev = out; out = out.replace(COMPANY_FORM, '').trim(); }
  return out || String(s ?? '').trim();
};

export const aliasTo = new Map();
for (const [name, variants] of Object.entries(ALIASES.aliases)) for (const v of [name, ...variants]) aliasTo.set(normBrand(stripCompanyForm(v)), name);
/** The identity a brand is counted under. Same value means the same company on screen. */
export const brandId = (s) => {
  const k = normBrand(stripCompanyForm(s));
  if (aliasTo.has(k)) return normBrand(aliasTo.get(k));
  // normBrand drops generic words, so a name made only of them keeps its own spelling.
  return k || String(s ?? '').trim().toLowerCase();
};
