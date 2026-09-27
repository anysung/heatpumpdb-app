#!/usr/bin/env node
/**
 * onboarding-gates.unit.mjs — who gets stopped, and who does not.
 *
 * Two gates were added with social signup (2026-08-31) and they pull in
 * opposite directions, which is exactly why they are tested together:
 *
 *  · the profile step (REQUIRED since 2026-09-27) must stop every account
 *    missing name / company / company type until it is complete — and
 *    nothing else (admins exempt, team members name only);
 *  · the team-name gate must stop a Team checkout with no name on file, and
 *    must NOT stop anything else. Everything the old billing form asked for is
 *    now Paddle's job, and a form between a decided buyer and their card is
 *    the most expensive place in the product to put one.
 *
 * The predicates are re-implemented here rather than imported: the source is
 * TSX and this suite runs on plain node. They are three lines each; the point
 * is to pin the DECISIONS, and a drift between these and the component shows
 * up as the component failing its own e2e.
 *
 * Run: node tests/onboarding-gates.unit.mjs
 */
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; } else { fail++; console.error(`  ✗ ${n}`); } };

const trim = (s) => String(s ?? '').trim();
const hasDisplayName = (u) => !!(u && trim(u.firstName));
const nameNeededForCheckout = (u, isTeam) => isTeam && !hasDisplayName(u);
/* Profile step (2026-09-27): REQUIRED — name, company name, company type
   (+ description for "other"); team members give a name only; admins never.
   Mirrors src/components/OnboardingSheet.tsx profileIncomplete(). */
const ADMIN_ROLES = ['owner', 'admin', 'support', 'ops'];
const profileIncomplete = (u) => {
  if (!u || ADMIN_ROLES.includes(u.role)) return false;
  if (!hasDisplayName(u) || !trim(u.lastName)) return true;
  if (u.orgRole === 'member') return false;
  if (!trim(u.companyName) || !u.companyType) return true;
  return u.companyType === 'other' && !trim(u.companyTypeOther);
};

const blank = { firstName: '', lastName: '', companyType: '', jobRole: '' };
const named = { ...blank, firstName: 'Alex' };
const full  = { firstName: 'Alex', lastName: 'Schneider', companyType: 'installer', jobRole: 'sales' };

/* ── The team-name gate ─────────────────────────────────────────────────── */
ok('Team plan + no name → stopped',            nameNeededForCheckout(blank, true) === true);
ok('Team plan + name → straight through',      nameNeededForCheckout(named, true) === false);
ok('Professional + no name → NOT stopped',     nameNeededForCheckout(blank, false) === false);
ok('Professional + name → not stopped',        nameNeededForCheckout(named, false) === false);
// The old gate demanded company name, type and city as well. Nothing but the
// name may block a checkout now — this is the assertion that keeps it that way.
ok('no company name does not block a Team checkout',
   nameNeededForCheckout({ ...named, companyName: '' }, true) === false);
ok('no company type does not block a Team checkout',
   nameNeededForCheckout({ ...named, companyType: '' }, true) === false);
ok('a name of only spaces still counts as missing',
   nameNeededForCheckout({ ...blank, firstName: '   ' }, true) === true);

/* ── The profile step (required since 2026-09-27) ───────────────────── */
const complete = { firstName: 'Alex', lastName: 'Schneider', companyName: 'Schneider GmbH', companyType: 'installer' };
ok('first name without last name → asked',   profileIncomplete({ ...complete, lastName: '' }) === true);
ok('brand-new account is asked',               profileIncomplete(blank) === true);
ok('a name alone is not enough',               profileIncomplete(named) === true);
ok('name + company but no type → asked',       profileIncomplete({ ...named, companyName: 'X' }) === true);
ok('name + type but no company → asked',       profileIncomplete({ ...named, companyType: 'installer' }) === true);
ok('complete required fields → not asked',     profileIncomplete(complete) === false);
ok('optional fields never force it',           profileIncomplete({ ...complete, jobRole: '', companyCity: '' }) === false);
ok('"other" needs its description',            profileIncomplete({ ...complete, companyType: 'other' }) === true);
ok('"other" with a description is complete',   profileIncomplete({ ...complete, companyType: 'other', companyTypeOther: 'Utility' }) === false);
ok('team member: the name is enough',          profileIncomplete({ ...named, lastName: 'S', orgRole: 'member' }) === false);
ok('team member without a name is asked',      profileIncomplete({ ...blank, orgRole: 'member' }) === true);
ok('admins are never asked',                   profileIncomplete({ ...blank, role: 'admin' }) === false);
ok('the owner is never asked',                 profileIncomplete({ ...blank, role: 'owner' }) === false);
ok('spaces do not count as an answer',         profileIncomplete({ ...complete, companyName: '   ' }) === true);
ok('no user, no sheet',                        profileIncomplete(null) === false);

console.log(`\nonboarding gates: ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
