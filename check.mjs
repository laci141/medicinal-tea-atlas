import { chromium, devices } from 'playwright';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath, pathToFileURL } from 'url';

const FILE = process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), 'index.html');
const SHOTS = path.join(os.tmpdir(), 'tea-shots');
fs.mkdirSync(SHOTS, { recursive: true });

const URL = pathToFileURL(path.resolve(FILE)).href;
const LANGS = ['hu', 'ro', 'en', 'de'];
const VIEWPORTS = [
  { name: 'mobile-320', width: 320, height: 568, mobile: true },
  { name: 'mobile-375', width: 375, height: 667, mobile: true },
  { name: 'mobile-390', width: 390, height: 844, mobile: true },
  { name: 'tablet-768', width: 768, height: 1024, mobile: true },
  { name: 'desktop-1280', width: 1280, height: 900, mobile: false },
];

const ONLY = process.env.ONLY_VP;
const problems = [];
const notes = [];
function fail(m) { problems.push(m); }

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium/chrome-linux/chrome' }).catch(() => chromium.launch());

for (const vp of VIEWPORTS.filter(v => !ONLY || v.name === ONLY)) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2,
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
    userAgent: vp.mobile
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      : undefined,
  });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));

  await page.goto(URL);
  await page.waitForSelector('.card');

  for (const lang of LANGS) {
    const tag = `${vp.name}_${lang}`;
    await page.click(`.lang[data-lang="${lang}"]`);
    await page.waitForTimeout(220);

    // 1) nyelv tényleg átváltott?
    const active = await page.getAttribute('.lang.active', 'data-lang');
    if (active !== lang) fail(`${tag}: nyelvváltó nem aktív (${active})`);
    const htmlLang = await page.getAttribute('html', 'lang');
    if (htmlLang !== lang) fail(`${tag}: <html lang> = ${htmlLang}`);

    // 2) nincs vízszintes túlcsordulás
    const overflow = await page.evaluate(() => {
      const de = document.documentElement;
      const wide = [];
      document.querySelectorAll('body *').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && (r.right > window.innerWidth + 1.5 || r.left < -1.5)) {
          if (el.closest('.goals')) return; // a célsor vízszintesen görgethető
          const st = getComputedStyle(el);
          if (st.position === 'fixed' && st.transform !== 'none') return; // becsukott sidebar
          wide.push(el.className + '|' + Math.round(r.left) + '..' + Math.round(r.right));
        }
      });
      return { scrollW: de.scrollWidth, inner: window.innerWidth, wide: wide.slice(0, 6) };
    });
    if (overflow.scrollW > overflow.inner + 1) {
      fail(`${tag}: vízszintes görgetés (scrollWidth ${overflow.scrollW} > ${overflow.inner}) ${overflow.wide.join(' , ')}`);
    }

    // 3) kártyák: minden kártya látszik, semmi nincs levágva
    const cards = await page.evaluate(() => {
      const out = { count: 0, clipped: [], zero: [] };
      document.querySelectorAll('.card').forEach((c, i) => {
        out.count++;
        const r = c.getBoundingClientRect();
        if (r.width < 40 || r.height < 40) out.zero.push(i);
        c.querySelectorAll('.face').forEach(fc => {
          if (fc.scrollHeight > fc.clientHeight + 2) {
            out.clipped.push(i + ':' + (fc.classList.contains('back') ? 'back' : 'front') +
              ' ' + fc.scrollHeight + '>' + fc.clientHeight +
              ' [' + (fc.querySelector('.name,.back-title')?.textContent || '').slice(0, 24) + ']');
          }
        });
      });
      return out;
    });
    if (cards.count !== 34) fail(`${tag}: ${cards.count} kártya (várt 34)`);
    if (cards.zero.length) fail(`${tag}: 0 méretű kártyák: ${cards.zero.join(',')}`);
    if (cards.clipped.length) fail(`${tag}: levágott kártyaszöveg -> ${cards.clipped.slice(0, 5).join(' | ')}`);

    // 4) érintőfelületek elég nagyok
    const small = await page.evaluate(() => {
      const bad = [];
      document.querySelectorAll('button, a, input, .card').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        if (getComputedStyle(el).visibility === 'hidden') return;
        if (r.height < 32) bad.push((el.className || el.tagName) + ' h=' + Math.round(r.height));
      });
      return [...new Set(bad)].slice(0, 8);
    });
    if (small.length) notes.push(`${tag}: kis érintőfelület -> ${small.join(', ')}`);

    // 5) modal + vizsgálat-linkek (klinikai kártya)
    await page.evaluate(() => document.querySelector('.card[data-i="21"]').click());
    await page.waitForTimeout(320);
    await page.click('.card[data-i="21"] .btn-clin');
    await page.waitForTimeout(320);
    const modal = await page.evaluate(() => {
      const m = document.querySelector('.modal');
      const ov = document.getElementById('overlay');
      const links = [...m.querySelectorAll('.st-link')].map(a => a.getAttribute('href'));
      const r = m.getBoundingClientRect();
      return {
        open: ov.classList.contains('open'),
        inView: r.top >= -1 && r.bottom <= window.innerHeight + 1,
        scrollable: m.scrollHeight > m.clientHeight,
        canReachBottom: (m.scrollTop = m.scrollHeight, m.scrollTop + m.clientHeight >= m.scrollHeight - 2),
        links,
        hasStudies: !!m.querySelector('.studies'),
        studiesTitle: m.querySelector('.st-title')?.textContent?.trim() || '',
        text: (m.querySelector('#mBody p')?.textContent || '').slice(0, 60),
        kicker: m.querySelector('#mKicker')?.textContent?.trim() || '',
      };
    });
    if (!modal.open) fail(`${tag}: a modal nem nyílt meg`);
    if (!modal.inView) fail(`${tag}: a modal kilóg a képernyőről`);
    if (modal.scrollable && !modal.canReachBottom) fail(`${tag}: a modal alja nem érhető el görgetéssel`);
    if (!modal.hasStudies) fail(`${tag}: hiányzik a vizsgálat-link blokk`);
    if (!modal.links.length) fail(`${tag}: nincs PubMed link a modalban`);
    if (modal.links.some(h => !/^https:\/\/(pubmed\.ncbi\.nlm\.nih\.gov\/(\d+\/|\?term=.+)|doi\.org\/10\..+|api\.openalex\.org\/works.+)$/.test(h || ''))) {
      fail(`${tag}: hibás link formátum -> ${modal.links.join(',')}`);
    }
    if (vp.name === 'mobile-375') {
      await page.screenshot({ path: path.join(SHOTS, `modal_${tag}.png`) });
    }
    await page.click('#closeBtn');
    await page.waitForTimeout(250);
    await page.evaluate(() => document.querySelector('.card[data-i="21"]')?.classList.remove('flipped'));

    // 6) elkészítés-modal (sortörések)
    await page.evaluate(() => { document.querySelector('.card[data-i="27"]').click(); });
    await page.waitForTimeout(300);
    await page.click('.card[data-i="27"] .btn-prep');
    await page.waitForTimeout(280);
    const prepOk = await page.evaluate(() => {
      const b = document.getElementById('mBody');
      return {
        br: b.querySelectorAll('p:first-child br').length,
        len: b.textContent.trim().length,
        links: b.querySelectorAll('.st-link').length,
      };
    });
    if (prepOk.br < 3) fail(`${tag}: a recept sortörései elvesztek (${prepOk.br} <br>)`);
    if (prepOk.len < 80) fail(`${tag}: üres/rövid elkészítés-szöveg`);
    if (prepOk.links < 1) fail(`${tag}: az elkészítés-ablakban nincs link`);
    await page.click('#closeBtn');
    await page.waitForTimeout(220);
    await page.evaluate(() => document.querySelector('.card[data-i="27"]')?.classList.remove('flipped'));

    // 7) hagyományos használat kártya
    await page.evaluate(() => { document.querySelector('.card[data-i="11"]').click(); });
    await page.waitForTimeout(300);
    const tradBtn = await page.$('.card[data-i="11"] .btn-trad');
    if (!tradBtn) fail(`${tag}: hiányzik a "hagyományos használat" gomb (11)`);
    else {
      await tradBtn.click();
      await page.waitForTimeout(280);
      const tl = await page.evaluate(() => (document.getElementById('mBody').textContent || '').trim().length);
      if (tl < 80) fail(`${tag}: üres hagyományos-használat szöveg`);
      await page.click('#closeBtn');
      await page.waitForTimeout(200);
    }
    await page.evaluate(() => document.querySelector('.card[data-i="11"]')?.classList.remove('flipped'));

    // 8) menü nyit / keresés / zár
    await page.evaluate(() => document.body.classList.add('menu-closed'));
    await page.waitForTimeout(120);
    await page.click('#menuToggle');
    // a csúszó animáció végét várjuk meg, ne fix időt
    await page.waitForFunction(() => {
      const r = document.getElementById('sidebar').getBoundingClientRect();
      return !document.body.classList.contains('menu-closed') && r.left > -1 && r.width > 100;
    }, null, { timeout: 5000 }).catch(() => fail(`${tag}: az oldalsáv nem nyílt ki 5 mp alatt`));
    const menuState = await page.evaluate(() => {
      const s = document.getElementById('sidebar');
      const r = s.getBoundingClientRect();
      return { visible: r.left > -5 && r.width > 100, items: document.querySelectorAll('.m-item').length, right: r.right, iw: window.innerWidth };
    });
    if (!menuState.visible) fail(`${tag}: az oldalsáv nem jelent meg`);
    if (menuState.items < 37) fail(`${tag}: kevés menüpont (${menuState.items})`);
    if (menuState.right > menuState.iw + 1) fail(`${tag}: az oldalsáv kilóg (${menuState.right} > ${menuState.iw})`);
    await page.fill('#search', 'zzzz');
    await page.waitForTimeout(150);
    const nh = await page.evaluate(() => getComputedStyle(document.getElementById('noHit')).display);
    if (nh === 'none') fail(`${tag}: "nincs találat" üzenet nem jelent meg`);
    await page.fill('#search', '');
    await page.waitForTimeout(150);
    if (vp.name === 'mobile-375' && lang === 'hu') {
      await page.screenshot({ path: path.join(SHOTS, `menu_${tag}.png`) });
    }
    // menü bezárása
    if (vp.width <= 900) {
      await page.click('#backdrop', { force: true, position: { x: vp.width - 8, y: 300 } }); // a sáv melletti látható háttér
      await page.waitForTimeout(450);
      const closedByBackdrop = await page.evaluate(() => document.body.classList.contains('menu-closed'));
      if (!closedByBackdrop) fail(`${tag}: a háttérre koppintás nem zárja be a menüt`);
      await page.click('#menuToggle');
      await page.waitForFunction(() => !document.body.classList.contains('menu-closed') &&
        document.getElementById('sidebar').getBoundingClientRect().left > -1, null, { timeout: 5000 });
    }
    await page.click('#collapseBtn');
    await page.waitForTimeout(450);
    const closedByX = await page.evaluate(() => document.body.classList.contains('menu-closed'));
    if (!closedByX) fail(`${tag}: az × gomb nem zárja be a menüt`);

    // 9) források oldal
    await page.evaluate(() => { document.querySelector('.m-item[data-key="sources"]').click(); });
    await page.waitForTimeout(300);
    const srcInfo = await page.evaluate(() => ({
      items: document.querySelectorAll('.src-item').length,
      links: document.querySelectorAll('.src-links a').length,
      scrollW: document.documentElement.scrollWidth, iw: window.innerWidth,
    }));
    if (srcInfo.items !== 34) fail(`${tag}: források: ${srcInfo.items} elem (várt 34)`);
    if (srcInfo.links === 0) fail(`${tag}: a források oldalon nincs PubMed link`);
    if (srcInfo.scrollW > srcInfo.iw + 1) fail(`${tag}: források oldal vízszintesen görgethető`);
    if (vp.name === 'mobile-375' && lang === 'en') {
      await page.screenshot({ path: path.join(SHOTS, `sources_${tag}.png`), fullPage: false });
    }

    // 9b) videos page: 16 slots, each either a lazy youtube-nocookie iframe or a placeholder
    await page.evaluate(() => { document.querySelector('.m-item[data-key="videos"]').click(); });
    await page.waitForTimeout(300);
    const vidInfo = await page.evaluate(() => ({
      cards: document.querySelectorAll('.vid-card').length,
      iframes: document.querySelectorAll('.vid-wrap iframe').length,
      ph: document.querySelectorAll('.vid-wrap .vid-ph').length,
      badFrames: [...document.querySelectorAll('.vid-wrap iframe')]
        .filter(f => !(f.getAttribute('src') || '').startsWith('https://www.youtube-nocookie.com/embed/') || f.getAttribute('loading') !== 'lazy')
        .map(f => f.getAttribute('src')),
      scrollW: document.documentElement.scrollWidth, iw: window.innerWidth,
    }));
    if (vidInfo.cards !== 16) fail(`${tag}: videos: ${vidInfo.cards} cards (expected 16)`);
    if (vidInfo.iframes + vidInfo.ph !== 16) fail(`${tag}: videos: ${vidInfo.iframes} iframes + ${vidInfo.ph} placeholders != 16`);
    if (vidInfo.badFrames.length) fail(`${tag}: videos: bad iframe src or not lazy -> ${vidInfo.badFrames.slice(0, 3).join(' , ')}`);
    if (vidInfo.scrollW > vidInfo.iw + 1) fail(`${tag}: videos page scrolls horizontally (scrollWidth ${vidInfo.scrollW} > ${vidInfo.iw})`);

    // 10) vissza az összes teára + szűrő
    await page.evaluate(() => { document.querySelector('.m-item[data-key="all"]').click(); });
    await page.waitForTimeout(300);
    await page.evaluate(() => { document.querySelector('.chip[data-goal="sleepcalm"]').click(); });
    await page.waitForTimeout(250);
    const filtered = await page.evaluate(() => document.querySelectorAll('.card').length);
    if (filtered === 0 || filtered === 34) fail(`${tag}: a cél-szűrő nem működik (${filtered} kártya)`);
    await page.evaluate(() => { document.querySelector('.chip[data-goal=""]').click(); });
    await page.waitForTimeout(250);

    if (lang === 'hu' || lang === 'de') {
      await page.screenshot({ path: path.join(SHOTS, `page_${tag}.png`), fullPage: false });
    }

    // 11) MÉLY ELLENŐRZÉS: MINDEN teánál legyen link a leírás alatt (csak egy méreten, de mind a 4 nyelven)
    if (vp.name === 'mobile-375') {
      for (let i = 0; i < 34; i++) {
        await page.evaluate(n => {
          const c = document.querySelector(`.card[data-i="${n}"]`);
          c.classList.add('flipped');
          (c.querySelector('.btn-clin') || c.querySelector('.btn-trad')).click();
        }, i);
        await page.waitForTimeout(90);
        const r = await page.evaluate(() => {
          const b = document.getElementById('mBody');
          const as = [...b.querySelectorAll('.st-link')];
          return {
            n: as.length,
            bad: as.map(a => a.getAttribute('href')).filter(h => !/^https:\/\/(pubmed\.ncbi\.nlm\.nih\.gov\/(\d+\/|\?term=.+)|doi\.org\/10\..+|api\.openalex\.org\/works.+)$/.test(h || '')),
            desc: (b.querySelector('p') || {}).textContent?.trim().length || 0,
            empty: [...b.querySelectorAll('.st-lbl')].filter(e => !e.textContent.trim()).length,
            pubmed: [...b.querySelectorAll('.st-link')].filter(a => /pubmed/.test(a.href)).length,
            openalex: [...b.querySelectorAll('.st-link')].filter(a => /openalex/.test(a.href)).length,
            afterDesc: !!b.querySelector('p ~ .studies, .warn ~ .studies'),
          };
        });
        if (r.n < 1) fail(`${tag}: tea ${i} – NINCS link a leírás alatt`);
        if (r.bad.length) fail(`${tag}: tea ${i} – rossz link: ${r.bad.join(',')}`);
        if (r.desc < 60) fail(`${tag}: tea ${i} – hiányzó/rövid leírás (${r.desc})`);
        if (r.empty) fail(`${tag}: tea ${i} – üres link-felirat`);
        if (!r.afterDesc) fail(`${tag}: tea ${i} – a link nem a leírás UTÁN van`);
        if (!r.pubmed) fail(`${tag}: tea ${i} – nincs PubMed link`);
        if (!r.openalex) fail(`${tag}: tea ${i} – nincs OpenAlex link`);
        await page.click('#closeBtn');
        await page.waitForTimeout(60);
        await page.evaluate(n => document.querySelector(`.card[data-i="${n}"]`)?.classList.remove('flipped'), i);
      }
    }
  }

  if (consoleErrors.length) fail(`${vp.name}: JS hibák -> ${[...new Set(consoleErrors)].slice(0, 4).join(' | ')}`);
  await ctx.close();
}

await browser.close();

console.log('\n================ EREDMÉNY ================');
if (!problems.length) console.log('✅ Minden ellenőrzés sikeres (5 képernyőméret × 4 nyelv).');
else {
  console.log(`❌ ${problems.length} hiba:`);
  problems.forEach(p => console.log('  - ' + p));
}
if (notes.length) {
  console.log(`\nℹ️  megjegyzés (${notes.length}):`);
  [...new Set(notes)].slice(0, 12).forEach(n => console.log('  · ' + n));
}
console.log('\nKépernyőképek: ' + SHOTS);
process.exit(problems.length ? 1 : 0);
