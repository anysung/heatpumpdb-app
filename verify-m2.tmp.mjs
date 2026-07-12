import { chromium, devices } from 'playwright';
import { readFileSync } from 'fs';
const SHOT = '/private/tmp/claude-501/-Users-christophersung-heatpumpdb-app/880be212-84a9-459f-9879-aaaff38b2e21/scratchpad';
const PW = readFileSync(SHOT + '/e2e-pw.txt', 'utf8').trim();
const b = await chromium.launch();

const login = async (p) => {
  await p.goto('http://localhost:5199/', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(3500);
  await p.getByRole('button', { name: 'Log In' }).first().click();
  await p.waitForTimeout(1500);
  await p.locator('input[type="email"]').first().fill('e2e-verify@heatpumpdb.de');
  const pw = p.locator('input[type="password"]').first();
  await pw.fill(PW);
  await pw.press('Enter');
  await p.waitForTimeout(10000);
};
const overflow = (p) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

const phoneCtx = await b.newContext({ ...devices['iPhone 13'] });
const ph = await phoneCtx.newPage();
await login(ph);
const phBody = await ph.innerText('body');
console.log('PHONE:', JSON.stringify({
  inShell: phBody.includes('Find a heat pump') || phBody.includes('Search'),
  installBanner: phBody.includes('Install the app'),
  overflowPx: await overflow(ph),
}));
await ph.screenshot({ path: SHOT + '/m-phone-home.png' });
if (phBody.includes('Install the app')) {
  await ph.getByText('Install ›').first().click();
  await ph.waitForTimeout(800);
  console.log('IOS GUIDE:', (await ph.innerText('body')).includes('Add to Home Screen'));
  await ph.screenshot({ path: SHOT + '/m-phone-iosguide.png' });
  await ph.getByText('Not now').click().catch(() => {});
  await ph.waitForTimeout(500);
}
const tabs = ['Products', 'Funding', 'News', 'Account'];
for (const tab of tabs) {
  await ph.locator(`span:has-text("${tab}")`).last().click().catch(async () => {
    await ph.getByText(tab, { exact: false }).last().click().catch(() => {});
  });
  await ph.waitForTimeout(2200);
  console.log(`PHONE ${tab}: overflow=${await overflow(ph)}px`);
  await ph.screenshot({ path: SHOT + `/m-phone-${tab.toLowerCase()}.png` });
}
// detail sheet from products
await ph.locator(`span:has-text("Products")`).last().click().catch(() => {});
await ph.waitForTimeout(2000);
await ph.locator('text=COP A2').first().click().catch(() => {});
await ph.waitForTimeout(1500);
console.log('DETAIL backbar:', (await ph.innerText('body')).includes('‹ Products'));
await ph.screenshot({ path: SHOT + '/m-phone-detail.png' });
await phoneCtx.close();

const tabCtx = await b.newContext({ viewport: { width: 834, height: 1112 } });
const tb = await tabCtx.newPage();
await login(tb);
const tbBody = await tb.innerText('body');
console.log('TABLET:', JSON.stringify({
  desktopNav: tbBody.includes('EU energy label') && tbBody.includes('Data sheet'),
  searchHero: tbBody.includes('Find a product'),
  overflowPx: await overflow(tb),
}));
await tb.screenshot({ path: SHOT + '/m-tablet-home.png' });
await tabCtx.close();
await b.close();
