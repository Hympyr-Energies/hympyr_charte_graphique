/* =========================================================
   EXPORT PDF de la charte (A4 paysage, texte vectoriel)
   Chargé à la demande par index.html : utilise ACT, BRANDS, CREAS, QUIZ, REDAC, roleHex, ratio...
   Règles appliquées : un message par page, titres affirmatifs, Craie pour les grands aplats,
   marges de 15 mm, fonds perdus de 3 mm en version imprimeur, Filet pour les séparateurs uniquement,
   logo en haut à gauche, QR code vers hympyr.fr en bas à droite, sommaire cliquable,
   chaque texte tient dans son encart (réduction progressive, sinon passage à la page suivante).
   ========================================================= */
(function () {
  const FONT_BASE = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/';
  const SITE = 'https://www.hympyr.fr';
  const TOOL = 'https://quentindebrie-code.github.io/hympyr_charte_graphique/';
  const PT = 0.3528; /* mm per point */
  const TW = 297, TH = 210, M = 15;
  const WEIGHTS = { 300: ['Light', 'l'], 400: ['Regular', 'r'], 500: ['Medium', 'm'], 600: ['SemiBold', 'sb'], 700: ['Bold', 'b'], 800: ['ExtraBold', 'xb'] };
  const fontCache = {};

  const b64 = buf => { let s = ''; const a = new Uint8Array(buf); for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(s); };
  async function fetchFont(url) { if (fontCache[url] !== undefined) return fontCache[url]; try { const r = await fetch(url); if (!r.ok) throw 0; fontCache[url] = b64(await r.arrayBuffer()); } catch (e) { fontCache[url] = null; } return fontCache[url]; }
  const loadScript = src => new Promise((ok, ko) => { if ([...document.scripts].some(s => s.src === src)) return ok(); const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => ko(new Error('script')); document.head.appendChild(s); });
  const hex = h => { const m = String(h || '#000000').replace('#', '').match(/../g) || ['00', '00', '00']; return m.map(x => parseInt(x, 16)); };
  const cmyk = h => { const [r, g, b] = hex(h).map(v => v / 255); const k = 1 - Math.max(r, g, b); if (k >= 1) return '0 0 0 100'; return [(1 - r - k) / (1 - k), (1 - g - k) / (1 - k), (1 - b - k) / (1 - k), k].map(v => Math.round(v * 100)).join(' '); };
  function loadImg(url) {
    return new Promise(res => {
      if (!url) return res(null);
      const im = new Image(); im.crossOrigin = 'anonymous';
      im.onload = () => { try { const w = im.naturalWidth || 600, h = im.naturalHeight || 200, sc = Math.min(4, 1600 / w); const c = document.createElement('canvas'); c.width = Math.round(w * sc); c.height = Math.round(h * sc); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res({ data: c.toDataURL('image/png'), r: w / h }); } catch (e) { res(null); } };
      im.onerror = () => res(null); im.src = url;
    });
  }

  async function build(opt, onStep) {
    const step = (p, t) => onStep && onStep(p, t);
    step(4, 'Chargement des outils');
    if (!window.jspdf) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    if (!window.qrcode) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js');
    const global = opt.scope === 'all' || opt.scope === 'groupe';
    const KEY = global ? 'groupe' : opt.scope;
    const BL = opt.print ? 3 : 0;
    const PW = TW + 2 * BL, PH = TH + 2 * BL;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [PW, PH], compress: true });
    const warns = [];

    /* ---------- fonts ---------- */
    step(10, 'Chargement des polices');
    const usedW = new Set([400, 500, 600, 700]);
    const brandKeys = global ? BRAND_KEYS : [KEY];
    brandKeys.forEach(k => (ACT.brands[k].weights || []).forEach(w => { if (WEIGHTS[w.w]) usedW.add(w.w); }));
    const FAM = {};
    await Promise.all([...usedW].map(async w => { const d = await fetchFont(`${FONT_BASE}poppins/Poppins-${WEIGHTS[w][0]}.ttf`); if (d) { const n = `Poppins-${WEIGHTS[w][0]}.ttf`; doc.addFileToVFS(n, d); doc.addFont(n, 'P' + w, 'normal'); FAM[w] = 'P' + w; } }));
    if (!FAM[400]) throw new Error('fonts');
    /* other typefaces of the charter, for the specimens (static TTF on Google Fonts, otherwise Poppins) */
    const SPEC = {};
    const fams = [...new Set(brandKeys.flatMap(k => (ACT.brands[k].fonts || []).map(f => f.family)).filter(f => f && f !== 'Poppins'))];
    await Promise.all(fams.map(async f => {
      const all = brandKeys.flatMap(k => ACT.brands[k].fonts).find(x => x.family === f) || {};
      const url = /\.ttf(\?|$)/i.test(all.src || '') ? all.src : `${FONT_BASE}${f.toLowerCase().replace(/\s+/g, '')}/${f.replace(/\s+/g, '')}-Regular.ttf`;
      const d = await fetchFont(url); if (d) { const n = 'spec-' + f.replace(/\W/g, '') + '.ttf'; doc.addFileToVFS(n, d); doc.addFont(n, 'S' + f, 'normal'); SPEC[f] = 'S' + f; }
    }));
    const W = w => FAM[w] || FAM[[400, 500, 600, 700].reduce((a, b) => Math.abs(b - w) < Math.abs(a - w) ? b : a)] || FAM[400];

    /* ---------- logos ---------- */
    step(26, 'Préparation des logos');
    const LOGO = {};
    for (const k of (global ? BRAND_KEYS : [KEY])) {
      LOGO[k] = await Promise.all((ACT.brands[k].logos || []).map(async l => ({ ...l, img: await loadImg(l.url) })));
    }

    /* ---------- theme ---------- */
    const G = ACT.brands.groupe.colors;
    const findHex = (list, re, d) => (list.find(c => re.test(c.n)) || {}).h || d;
    const CRAIE = findHex(G, /craie/i, '#F5F4F0'), INK = findHex(G, /graphite/i, '#1D2226'), MUTED = findHex(G, /gris texte/i, '#5B636A'), FILET = findHex(G, /filet/i, '#DEDCD5'), WHITE = '#FFFFFF';
    const T = global
      ? { deep: roleHex('groupe', 'profond'), action: MUTED, accent: MUTED, soft: FILET }
      : { deep: roleHex(KEY, 'profond'), action: roleHex(KEY, 'action'), accent: roleHex(KEY, 'accent'), soft: roleHex(KEY, 'clair') };
    const onDark = h => ratio(h, WHITE) >= ratio(h, INK) ? WHITE : INK;
    const label = ratio(T.action, CRAIE) >= 4.5 ? T.action : T.deep; /* small coloured text on Craie */
    const docName = global ? 'Charte graphique du groupe Hympyr' : `Charte graphique ${BRANDS[KEY].nom}`;

    /* ---------- primitives ---------- */
    const X = x => x + BL, Y = y => y + BL;
    const fill = h => doc.setFillColor(...hex(h));
    const ink = h => doc.setTextColor(...hex(h));
    const stroke = h => doc.setDrawColor(...hex(h));
    const rect = (x, y, w, h, c, r = 0) => { fill(c); r ? doc.roundedRect(X(x), Y(y), w, h, r, r, 'F') : doc.rect(X(x), Y(y), w, h, 'F'); };
    const bleedRect = c => { fill(c); doc.rect(0, 0, PW, PH, 'F'); };
    const alpha = a => { try { doc.setGState(new doc.GState({ opacity: a })); } catch (e) {} };
    const font = (w, size, f) => { doc.setFont(f || W(w), 'normal'); doc.setFontSize(size); };
    const lineH = (size, lh) => size * PT * lh;
    const frSp = t => String(t || '').replace(/ ([?!:;»%€])/g, '\u00A0$1').replace(/« /g, '«\u00A0');
    function wrap(text, w, size, wt, f) { font(wt, size, f); return frSp(text).split('\n').flatMap(p => p.trim() ? doc.splitTextToSize(p.trim(), w) : ['']); }
    /* measure the height a text needs at its largest size that fits */
    function fitLines(text, w, h, o) {
      const lh = o.lh || 1.35; let size = o.size;
      for (; size >= (o.min || o.size); size -= 0.5) { const L = wrap(text, w, size, o.w || 400, o.f); if (L.length * lineH(size, lh) <= h + 0.01) return { L, size, lh }; }
      size = o.min || o.size; let L = wrap(text, w, size, o.w || 400, o.f); const max = Math.max(1, Math.floor((h + 0.01) / lineH(size, lh)));
      if (L.length > max) { L = L.slice(0, max); let last = L[max - 1]; font(o.w || 400, size, o.f); while (last && doc.getTextWidth(last + '…') > w) last = last.replace(/\s*\S+$/, ''); L[max - 1] = (last || '') + '…'; warns.push(String(text).slice(0, 60)); }
      return { L, size, lh };
    }
    /* draw a text inside its box ; returns the height used */
    function box(text, x, y, w, h, o = {}) {
      if (!String(text || '').trim()) return 0;
      const f = fitLines(text, w, h, o); font(o.w || 400, f.size, o.f); ink(o.c || INK);
      const step = lineH(f.size, f.lh); const used = f.L.length * step;
      let y0 = y; if (o.v === 'bottom') y0 = y + h - used; else if (o.v === 'middle') y0 = y + (h - used) / 2;
      f.L.forEach((l, i) => doc.text(l, X(o.a === 'right' ? x + w : o.a === 'center' ? x + w / 2 : x), Y(y0 + i * step), { baseline: 'top', align: o.a || 'left', charSpace: o.cs || 0 }));
      return used;
    }
    /* height a text will take at a fixed size (for pagination) */
    const need = (text, w, size, wt = 400, lh = 1.35) => String(text || '').trim() ? wrap(text, w, size, wt).length * lineH(size, lh) : 0;
    const mark = (x, y, ok, c) => { /* check or cross in a small disc */
      fill(ok ? T.soft : '#F3D9D3'); doc.circle(X(x + 2.2), Y(y + 2.2), 2.2, 'F'); stroke(ok ? T.deep : '#A3341F'); doc.setLineWidth(0.45);
      if (ok) { doc.line(X(x + 1.2), Y(y + 2.3), X(x + 1.9), Y(y + 3.1)); doc.line(X(x + 1.9), Y(y + 3.1), X(x + 3.3), Y(y + 1.4)); }
      else { doc.line(X(x + 1.4), Y(y + 1.4), X(x + 3), Y(y + 3)); doc.line(X(x + 3), Y(y + 1.4), X(x + 1.4), Y(y + 3)); }
    };

    /* generated logo (when no file is set) */
    function genLogo(k, x, y, h, dark) {
      const deep = k === 'groupe' ? INK : roleHex(k, 'profond'), acc = k === 'groupe' ? (dark ? CRAIE : INK) : roleHex(k, 'accent');
      rect(x, y, h, h, acc, h * 0.22);
      stroke(k === 'groupe' ? (dark ? INK : WHITE) : (dark ? deep : WHITE)); doc.setLineWidth(h * 0.08);
      const s = h / 24; doc.line(X(x + 7 * s), Y(y + 5 * s), X(x + 7 * s), Y(y + 19 * s)); doc.line(X(x + 17 * s), Y(y + 5 * s), X(x + 17 * s), Y(y + 19 * s)); doc.line(X(x + 7 * s), Y(y + 12 * s), X(x + 17 * s), Y(y + 12 * s));
      font(800 in FAM ? 800 : 700, h * 1.55); ink(dark ? WHITE : deep); doc.text('HYMPYR', X(x + h * 1.25), Y(y - h * 0.02), { baseline: 'top', charSpace: h * 0.02 });
      const tw = doc.getTextWidth('HYMPYR');
      font(600, h * 0.62); ink(k === 'groupe' ? (dark ? CRAIE : MUTED) : acc); doc.text(BRANDS[k].sub, X(x + h * 1.25), Y(y + h * 0.66), { baseline: 'top', charSpace: Math.max(0, (tw - doc.getTextWidth(BRANDS[k].sub)) / Math.max(1, BRANDS[k].sub.length - 1)) });
      return h * 1.25 + tw;
    }
    const logoKindOf = f => f === 'clair' || f === 'sombre' ? f : (lum(f) < .3 ? 'sombre' : 'clair');
    function pickLogo(k, dark) { const L = (LOGO[k] || []).filter(l => l.img); return L.find(l => logoKindOf(l.fond) === (dark ? 'sombre' : 'clair')) || null; }
    function drawLogo(k, x, y, h, dark, maxW = 70) {
      const l = pickLogo(k, dark);
      if (l) { let w = h * l.img.r, hh = h; if (w > maxW) { w = maxW; hh = w / l.img.r; } doc.addImage(l.img.data, 'PNG', X(x), Y(y + (h - hh) / 2), w, hh); return w; }
      return genLogo(k, x, y, h, dark);
    }
    function qr(text, x, y, s, link) {
      const q = window.qrcode(0, 'M'); q.addData(text); q.make(); const n = q.getModuleCount(), cell = s / (n + 2);
      rect(x, y, s, s, WHITE, 1.2); fill(INK);
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) doc.rect(X(x + (c + 1) * cell), Y(y + (r + 1) * cell), cell + 0.02, cell + 0.02, 'F');
      doc.link(X(x), Y(y), s, s, { url: link || text });
    }

    /* ---------- pages ---------- */
    const SECTIONS = []; let cur = null, pageNo = 0, TOTAL = 1;
    const CB = { x: M, y: 30, w: TW - 2 * M, b: TH - M - 20 }; /* content box */
    function chrome(dark) {
      drawLogo(global ? 'groupe' : KEY, M, 11, 8, dark);
      /* footer : document, progress through the parts, page number, QR */
      const fy = TH - M - 4;
      font(400, 7.5); ink(dark ? onDark(T.deep) : MUTED);
      doc.text(docName, X(M), Y(fy), { baseline: 'top' });
      const n = TOTAL, idx = cur ? cur.n - 1 : -1, bw = 54, sw = (bw - (n - 1) * 1.2) / n, bx = TW / 2 - bw / 2;
      if (cur) for (let i = 0; i < n; i++) rect(bx + i * (sw + 1.2), fy + 1, sw, 1.4, i <= idx ? (dark ? onDark(T.deep) : T.deep) : (dark ? T.action : FILET), 0.7);
      font(600, 8); ink(dark ? onDark(T.deep) : INK); doc.text(String(pageNo).padStart(2, '0'), X(TW - M - 19), Y(fy), { baseline: 'top', align: 'right' });
      font(400, 6.5); ink(dark ? onDark(T.deep) : MUTED); doc.text('hympyr.fr', X(TW - M - 19), Y(fy + 4), { baseline: 'top', align: 'right' });
      qr(SITE, TW - M - 16, TH - M - 16, 16, SITE);
    }
    function page(kind = 'light') { if (pageNo > 0) doc.addPage([PW, PH], 'landscape'); pageNo++; bleedRect(kind === 'dark' ? T.deep : CRAIE); return pageNo; }
    function content(title, lab) {
      page('light');
      font(600, 7.5); ink(label); doc.text((lab || (cur ? cur.t : '')).toUpperCase(), X(CB.x + 80), Y(13), { baseline: 'top', charSpace: 0.6 });
      const h = box(title, CB.x + 80, 17, CB.w - 80, 11, { size: 17, min: 12, w: 700, c: T.deep, lh: 1.15 });
      chrome(false);
      return { y: Math.max(32, 17 + h + 5), page: pageNo };
    }
    function section(num, t, intro, key) {
      cur = { n: num, t, key, intro, page: 0 }; SECTIONS.push(cur);
      cur.page = page('dark');
      const on = onDark(T.deep);
      /* soft circle and blocks, as in the reference layout */
      alpha(0.16); fill(T.soft); doc.circle(X(TW * 0.62), Y(TH * 0.98), TH * 0.62, 'F'); alpha(1);
      rect(TW - M - 44, 0 - BL, 22, 22 + BL, T.soft); rect(TW - M - 22, 22, 22, 22, T.accent === T.deep ? T.action : T.accent);
      /* ghost word + title */
      alpha(0.22); box(global ? 'hympyr' : BRANDS[KEY].court.toLowerCase(), M - 2, 42, TW - 2 * M, 42, { size: 96, min: 40, w: 700, c: T.soft, lh: 1 }); alpha(1);
      box(t.toLowerCase(), M + 30, 80, TW - 2 * M - 30, 40, { size: 84, min: 34, w: 700, c: on, lh: 1 });
      stroke(on); doc.setLineWidth(0.6); doc.circle(X(M + 11), Y(100), 10, 'S');
      box(String(num).padStart(2, '0'), M + 1, 94, 20, 12, { size: 20, w: 500, c: on, a: 'center', v: 'middle' });
      box(intro, M + 30, 128, 140, 30, { size: 11, min: 9, c: on, lh: 1.45 });
      chrome(true);
    }

    /* lists flowing over columns and pages ; render(item, x, y, w) returns height, need(item, w) returns height */
    function flow(items, { cols = 2, gap = 8, title, lab, measure, render, startY }) {
      if (!items.length) return;
      const colW = (CB.w - (cols - 1) * 10) / cols;
      let y0 = startY != null ? startY : content(title, lab).y, col = 0, y = y0, first = true;
      items.forEach(it => {
        const h = measure(it, colW);
        if (y + h > CB.b && !(y === y0)) {
          col++; y = y0;
          if (col >= cols) { col = 0; y0 = content(title + ' (suite)', lab).y; y = y0; }
        }
        first = false;
        render(it, CB.x + col * (colW + 10), y, colW, Math.min(h, CB.b - y));
        y += h + gap;
      });
    }
    const card = (x, y, w, h, c = WHITE) => rect(x, y, w, h, c, 3);
    const bullet = (ok) => ({
      measure: (t, w) => Math.max(5, need(t, w - 9, 10.5)),
      render: (t, x, y, w, h) => { mark(x, y + 0.3, ok); box(t, x + 8, y, w - 9, h, { size: 10.5, min: 8.5, c: INK }); }
    });

    /* ---------- blocks ---------- */
    function logoPages(k) {
      const B = ACT.brands[k], L = LOGO[k] || [];
      const n = L.length;
      const p = content(n ? `Le logotype se décline en ${n} version${n > 1 ? 's' : ''}, chacune pour son fond` : 'Le logotype de la marque', BRANDS[k].nom);
      let y = p.y;
      if (B.logoIntro) { y += box(B.logoIntro, CB.x, y, CB.w * 0.62, 14, { size: 10.5, min: 9, c: MUTED, lh: 1.45 }) + 6; }
      const per = 3, cw = (CB.w - (per - 1) * 8) / per, rows = Math.min(2, Math.max(1, Math.ceil(n / per))), ch = Math.max(44, Math.min(84, (CB.b - y - rows * 16) / rows));
      L.forEach((l, i) => {
        if (i && i % per === 0) { y += ch + 16; if (y + ch + 14 > CB.b) y = content('Les déclinaisons du logotype (suite)', BRANDS[k].nom).y; }
        const x = CB.x + (i % per) * (cw + 8), bg = l.fond === 'clair' ? CRAIE : l.fond === 'sombre' ? roleHex(k, 'profond') : l.fond;
        card(x, y, cw, ch, bg); stroke(FILET); doc.setLineWidth(0.25); doc.roundedRect(X(x), Y(y), cw, ch, 3, 3, 'S');
        const dark = logoKindOf(l.fond) === 'sombre';
        if (l.img) { let w = Math.min(cw - 24, Math.min(34, ch * 0.4) * l.img.r), h = w / l.img.r; if (h > ch - 20) { h = ch - 20; w = h * l.img.r; } doc.addImage(l.img.data, 'PNG', X(x + (cw - w) / 2), Y(y + (ch - h) / 2), w, h); }
        else genLogo(k, x + 12, y + ch / 2 - 5, 10, dark);
        box(l.n || 'Logo', x, y + ch + 3, cw, 6, { size: 9.5, w: 600, c: T.deep });
        box(l.fond === 'clair' ? 'Fond clair' : l.fond === 'sombre' ? 'Fond sombre' : 'Fond ' + l.fond, x, y + ch + 8, cw, 5, { size: 8, c: MUTED });
      });
      /* rules */
      const lists = [[B.logoDo, true, 'À respecter'], [B.logoDont, false, 'À ne jamais faire']], idx = [0, 0], cw2 = (CB.w - 10) / 2;
      for (let pg = 0; pg === 0 || idx.some((v, i) => v < lists[i][0].length); pg++) {
        const P = content(pg ? 'Le logo se respecte sans exception (suite)' : 'Le logo se respecte sans exception', BRANDS[k].nom);
        lists.forEach(([list, ok, t], ci) => {
          if (pg && idx[ci] >= list.length) return;
          const x = CB.x + ci * (cw2 + 10); let yy = P.y; const top = yy + 18;
          card(x, yy, cw2, CB.b - yy); box(t + (pg && idx[ci] < list.length ? ' (suite)' : ''), x + 8, yy + 7, cw2 - 16, 8, { size: 12.5, w: 600, c: T.deep }); yy = top;
          while (idx[ci] < list.length) { const r = list[idx[ci]], h = Math.max(5, need(r, cw2 - 25, 10.5)); if (yy + h > CB.b - 4 && yy > top) break;
            mark(x + 8, yy + 0.3, ok); box(r, x + 16, yy, cw2 - 25, Math.min(h, CB.b - 4 - yy), { size: 10.5, min: 8.5 }); yy += h + 5; idx[ci]++; }
          if (!list.length) box('Aucune règle définie.', x + 8, yy, cw2 - 16, 6, { size: 10, c: MUTED });
        });
      }
    }
    function palettePages(k, title) {
      const cs = ACT.brands[k].colors, per = cs.length <= 6 ? Math.max(3, cs.length) : 4;
      for (let i = 0; i < cs.length; i += per) {
        const part = cs.slice(i, i + per), p = content(i ? `${title} (suite)` : title, BRANDS[k].nom);
        const cw = (CB.w - (per - 1) * 8) / per, ch = CB.b - p.y;
        part.forEach((c, j) => {
          const x = CB.x + j * (cw + 8), y = p.y; card(x, y, cw, ch);
          rect(x, y, cw, ch * 0.42, c.h, 3); rect(x, y + ch * 0.42 - 3, cw, 3, c.h);
          const t = bestText(c.h);
          box(c.n, x + 6, y + 6, cw - 12, 12, { size: 13, min: 9, w: 600, c: t.c, lh: 1.15 });
          box(c.h, x + 6, y + ch * 0.42 - 11, cw - 12, 6, { size: 9.5, w: 500, c: t.c });
          let yy = y + ch * 0.42 + 6;
          [['RVB', hex(c.h).join(' ')], ['CMJN', cmyk(c.h)]].forEach(([a, b]) => {
            box(a, x + 6, yy, 16, 5, { size: 8, w: 600, c: MUTED }); box(b, x + 22, yy, cw - 28, 5, { size: 8.5, min: 7, c: INK }); yy += 6.5; });
          box('Contraste', x + 6, yy, cw - 12, 5, { size: 8, w: 600, c: MUTED }); yy += 5;
          yy += box(`${t.n} ${fr(t.r)}:1, ${grade(t.r)}`, x + 6, yy, cw - 12, 9, { size: 8.5, min: 7, c: INK, lh: 1.25 }) + 1.5;
          stroke(FILET); doc.setLineWidth(0.25); doc.line(X(x + 6), Y(yy + 1), X(x + cw - 6), Y(yy + 1)); yy += 5;
          box(c.u || '', x + 6, yy, cw - 12, y + ch - yy - 5, { size: 9.5, min: 7.5, c: INK, lh: 1.4 });
        });
        box('Valeurs CMJN indicatives : validez la conversion sur épreuve avant impression.', CB.x, CB.b + 1.5, CB.w * 0.6, 5, { size: 7.5, c: MUTED });
      }
    }
    function questionReveal() {
      /* question to the audience, then the key figures */
      const p = content('Quelle part de la surface reçoit les fonds clairs ?', 'Question à l\'assemblée');
      const opts = ['30 %', '60 %', '80 %'], w = (CB.w - 16) / 3;
      const qh = CB.b - p.y - 24;
      opts.forEach((o, i) => { const x = CB.x + i * (w + 8); card(x, p.y + 6, w, qh); box(String.fromCharCode(65 + i), x + 8, p.y + 14, 20, 10, { size: 16, w: 600, c: label }); box(o, x, p.y + 6, w, qh, { size: 64, min: 30, w: 700, c: T.deep, a: 'center', v: 'middle' }); });
      box('Votez à main levée, puis tournez la page pour la réponse.', CB.x, CB.b - 10, CB.w, 8, { size: 12, c: MUTED });
      const r = content('Les fonds clairs couvrent 60 % de la surface', 'Réponse');
      const figs = [['60 %', 'Fonds clairs', 'Craie, Blanc et teinte claire de la marque. Ils portent le contenu et laissent respirer.', T.soft, T.deep], ['30 %', 'Teinte profonde', 'Titres, texte de marque, fonds sombres et recto des cartes.', T.deep, onDark(T.deep)], ['10 %', 'Accent', 'Boutons, liens, pictogrammes, étiquettes. Rare, donc remarqué.', T.accent, onDark(T.accent)]];
      const fw = (CB.w - 16) / 3;
      figs.forEach(([n, t, d, bg, fg], i) => { const x = CB.x + i * (fw + 8), y = r.y + 4; rect(x, y, fw, CB.b - y, bg, 3);
        box(n, x + 8, y + 8, fw - 16, 34, { size: 54, min: 28, w: 700, c: fg }); box(t, x + 8, y + 46, fw - 16, 8, { size: 13, w: 600, c: fg }); box(d, x + 8, y + 58, fw - 16, CB.b - y - 64, { size: 10.5, min: 8.5, c: fg, lh: 1.45 }); });
      box('Source : répartition de référence de la charte Hympyr.', CB.x, CB.b + 1.5, CB.w * 0.6, 5, { size: 7.5, c: MUTED });
    }
    function typoPages(k) {
      const B = ACT.brands[k], fonts = B.fonts.length ? B.fonts : [{ n: 'Texte', family: 'Poppins', r: [], u: '' }];
      const n = fonts.length, per = Math.min(3, n);
      for (let i = 0; i < n; i += 3) {
        const part = fonts.slice(i, i + 3), p = content(i ? 'Les typographies (suite)' : (n === 1 ? `${fonts[0].family} porte tous les textes` : `${n} typographies, un rôle chacune`), BRANDS[k].nom);
        const cw = (CB.w - (part.length - 1) * 8) / part.length;
        part.forEach((f, j) => { const x = CB.x + j * (cw + 8), y = p.y, h = CB.b - y; card(x, y, cw, h);
          box((f.n || 'Police').toUpperCase(), x + 8, y + 7, cw - 16, 5, { size: 8, w: 600, c: label, cs: 0.4 });
          doc.setFont(SPEC[f.family] || (f.family === 'Poppins' ? W(700) : W(700)), 'normal'); doc.setFontSize(Math.min(78, cw * 0.9)); ink(T.deep); doc.text('Aa', X(x + 8), Y(y + 15), { baseline: 'top' });
          box(f.family, x + 8, y + 50, cw - 16, 9, { size: 16, min: 11, w: 600, c: INK });
          if (!SPEC[f.family] && f.family !== 'Poppins') box('Spécimen affiché en Poppins : la police n\'est pas intégrable au PDF.', x + 8, y + 60, cw - 16, 8, { size: 7.5, c: MUTED });
          box(f.u || '', x + 8, y + 70, cw - 16, h - 108, { size: 10, min: 8, c: INK, lh: 1.45 });
          stroke(FILET); doc.setLineWidth(0.25); doc.line(X(x + 8), Y(y + h - 34), X(x + cw - 8), Y(y + h - 34));
          box('ABCDEFGHIJKLMNOPQRSTUVWXYZ\nabcdefghijklmnopqrstuvwxyz\n0123456789 éèàçù « » € %', x + 8, y + h - 30, cw - 16, 24, { size: 10.5, min: 6.5, w: 500, f: SPEC[f.family], c: T.deep, lh: 1.5 }); });
      }
      const p = content('Une échelle fixe hiérarchise chaque écran', BRANDS[k].nom);
      const lw = CB.w * 0.6 - 38 - 50; let y = p.y;
      B.scale.forEach(s => { const sz = Math.min(s.s * 0.62, 26); const h = Math.max(9, sz * PT * 1.25 + 4);
        if (y + h > CB.b) y = content('Une échelle fixe hiérarchise chaque écran (suite)', BRANDS[k].nom).y;
        box(s.n, CB.x, y, 34, h, { size: 9, w: 600, c: INK, v: 'middle' }); box(s.ex, CB.x + 38, y, lw, h, { size: sz, min: 7, w: s.w, c: T.deep, v: 'middle', lh: 1.1 }); box(s.sp, CB.x + 38 + lw + 4, y, 44, h, { size: 8.5, c: MUTED, v: 'middle', a: 'right' });
        y += h + 1; stroke(FILET); doc.setLineWidth(0.25); doc.line(X(CB.x), Y(y), X(CB.x + 38 + lw + 48), Y(y)); y += 2; });
      if (doc.getCurrentPageInfo().pageNumber !== p.page) doc.setPage(p.page);
      const wx = CB.x + CB.w * 0.64, ww = CB.x + CB.w - wx; let wy = p.y; card(wx, wy, ww, CB.b - wy);
      box('GRAISSES', wx + 7, wy + 7, ww - 14, 5, { size: 8, w: 600, c: label, cs: 0.4 }); wy += 16;
      const wst = Math.min(13, (CB.b - 3 - wy) / Math.max(1, B.weights.length)), wsc = wst / 13;
      B.weights.forEach(w => { box(`${w.n} ${w.w}`, wx + 7, wy, ww - 14, 6 * wsc, { size: 11 * Math.max(0.7, wsc), min: 7, w: w.w, c: INK }); box(w.u, wx + 7, wy + 6 * wsc, ww - 14, 5 * wsc, { size: 8 * Math.max(0.8, wsc), min: 6.5, c: MUTED }); wy += wst; });
      doc.setPage(doc.getNumberOfPages()); pageNo = doc.getNumberOfPages();
      const rules = [...B.typoDo.map(t => [t, true]), ...B.typoDont.map(t => [t, false])];
      if (rules.length) flow(rules, { cols: 2, title: 'Le texte suit cinq repères de mise en forme'.replace('cinq', rules.length === 1 ? 'un' : String(rules.length)), lab: BRANDS[k].nom,
        measure: ([t], w) => Math.max(6, need(t, w - 9, 11)), render: ([t, ok], x, y, w, h) => { mark(x, y + 0.6, ok); box(t, x + 8, y, w - 9, h, { size: 11, min: 9 }); } });
    }
    function spacePages(k) {
      const B = ACT.brands[k], p = content('Les espacements suivent une échelle unique', BRANDS[k].nom);
      let y = p.y; if (B.spaceNote) y += box(B.spaceNote, CB.x, y, CB.w * 0.7, 12, { size: 10.5, min: 9, c: MUTED, lh: 1.45 }) + 6;
      const mx = Math.max(64, ...B.spaces.map(s => s.v)), bw = 70;
      const sst = Math.max(5.5, Math.min(9.5, (CB.b - y) / Math.max(1, B.spaces.length)));
      B.spaces.forEach(s => { if (y + 5 > CB.b) { warns.push(s.u); return; } box(`${s.v} px`, CB.x, y, 22, 7, { size: 10, w: 600, c: T.deep, v: 'middle' }); rect(CB.x + 26, y + 2, Math.max(1, s.v / mx * bw), 3, T.accent === T.deep ? T.action : T.accent, 1.5); box(s.u, CB.x + 26 + bw + 6, y, CB.w * 0.62 - bw - 32, Math.max(5, sst - 1.5), { size: 9.5, min: 7, c: INK, v: 'middle' }); y += sst; });
      const rx = CB.x + CB.w * 0.66, rw = CB.w * 0.34; let ry = p.y + (B.spaceNote ? 18 : 0);
      box('ARRONDIS', rx, ry, rw, 5, { size: 8, w: 600, c: label, cs: 0.4 }); ry += 9;
      const rst = Math.max(11, Math.min(23, (CB.b - ry) / Math.max(1, B.radii.length))), rs = rst - 5;
      B.radii.forEach(r => { if (ry + rs > CB.b) { warns.push(r.u); return; } const rr = Math.min(r.v >= 999 ? rs / 2 : r.v * 0.35, rs / 2); fill(T.soft); doc.roundedRect(X(rx), Y(ry), rs, rs, rr, rr, 'F');
        box(r.v >= 999 ? 'Pilule' : `${r.v} px`, rx + rs + 5, ry, rw - rs - 5, rs * 0.45, { size: 10.5, min: 8, w: 600, c: T.deep }); box(r.u, rx + rs + 5, ry + rs * 0.45, rw - rs - 5, rs * 0.55, { size: 9, min: 7, c: MUTED }); ry += rst; });
    }
    function creaPages() {
      Object.entries(CREAS).forEach(([k, c]) => {
        const rules = (ACT.creas[k] || { rules: [] }).rules;
        const p = content(`${c.t} : ${c.prio.toLowerCase()}`, 'Créations');
        const lw = CB.w * 0.6; let y = p.y;
        rules.forEach(r => { const h = Math.max(6, need(r, lw - 9, 10.5)); if (y + h > CB.b) y = content(`${c.t} (suite)`, 'Créations').y; mark(CB.x, y + 0.4, true); box(r, CB.x + 8, y, lw - 9, Math.min(h, CB.b - y), { size: 10.5, min: 8.5 }); y += h + 4.5; });
        const sx = CB.x + lw + 10, sw = CB.w - lw - 10; let sy = p.y;
        card(sx, sy, sw, 42, T.deep); box('GAMIFICATION', sx + 7, sy + 6, sw - 14, 5, { size: 8, w: 600, c: onDark(T.deep), cs: 0.4 }); box(c.game, sx + 7, sy + 13, sw - 14, 26, { size: 9.5, min: 7.5, c: onDark(T.deep), lh: 1.4 }); sy += 48;
        const gw = (sw - 6) / 2, gh = (CB.b - sy - 6 * 2) / 3;
        c.specs.slice(0, 6).forEach((s, i) => { const x = sx + (i % 2) * (gw + 6), y2 = sy + Math.floor(i / 2) * (gh + 6); card(x, y2, gw, gh); box(s[0], x + 5, y2 + 4, gw - 10, 5, { size: 7.5, c: MUTED }); box(s[1], x + 5, y2 + 10, gw - 10, gh - 13, { size: 10, min: 7.5, w: 600, c: INK, lh: 1.25 }); });
      });
    }
    function rulePages() {
      const gold = ACT.rules.gold;
      if (gold.length) { const per = 8; for (let i = 0; i < gold.length; i += per) {
        const part = gold.slice(i, i + per), p = content(i ? 'Les règles d\'or (suite)' : `${gold.length === 1 ? 'Une règle d\'or rend' : nbTxt(gold.length).replace(/^./, m => m.toUpperCase()) + ' règles d\'or rendent'} une production livrable`, 'Règles d\'or');
        const cols = 4, cw = (CB.w - 3 * 8) / cols, ch = (CB.b - p.y - 8) / 2;
        part.forEach((g, j) => { const x = CB.x + (j % cols) * (cw + 8), y = p.y + Math.floor(j / cols) * (ch + 8); card(x, y, cw, ch);
          box(String(i + j + 1).padStart(2, '0'), x + 6, y + 6, cw - 12, 12, { size: 22, w: 700, c: label }); box(g.t, x + 6, y + 20, cw - 12, 12, { size: 11.5, min: 9, w: 600, c: T.deep, lh: 1.2 }); box(g.d, x + 6, y + 34, cw - 12, ch - 38, { size: 9, min: 7.2, c: INK, lh: 1.4 }); }); } }
      const red = (typeof REDAC !== 'undefined' ? REDAC : []).map(r => [r.t, r.ok]);
      if (red.length) flow(red, { cols: 2, title: 'Vous écrivez court, direct et au vouvoiement', lab: 'Rédaction', measure: ([t], w) => Math.max(6, need(t, w - 9, 11)), render: ([t, ok], x, y, w, h) => { mark(x, y + 0.6, ok); box(t, x + 8, y, w - 9, h, { size: 11, min: 9 }); } });
      if (ACT.qa.length) flow(ACT.qa, { cols: 2, title: 'Le contrôle qualité arrête toute production défaillante', lab: 'Contrôle qualité', measure: (q, w) => Math.max(6, need(q.t, w - 9, 11)), render: (q, x, y, w, h) => { mark(x, y + 0.6, q.ok); box(q.t, x + 8, y, w - 9, h, { size: 11, min: 9 }); } });
      const laws = ACT.rules.laws;
      if (laws.length) flow(laws, { cols: 3, gap: 6, title: 'Les lois de l\'UX guident chaque arbitrage', lab: 'Lois UX',
        measure: (l, w) => 14 + need(l.p, w - 12, 8.5, 400, 1.35) + (l.a ? 9 + need(l.a, w - 12, 8.5, 400, 1.35) : 0) + 5,
        render: (l, x, y, w, h) => { card(x, y, w, h); let yy = y + 5; yy += box(l.n, x + 6, yy, w - 12, 7, { size: 11, min: 9, w: 600, c: T.deep }) + 2; yy += box(l.p, x + 6, yy, w - 12, y + h - yy - 3, { size: 8.5, min: 7, c: MUTED }) + 3;
          if (l.a) { stroke(FILET); doc.setLineWidth(0.25); doc.line(X(x + 6), Y(yy), X(x + w - 6), Y(yy)); yy += 2.5; box('CHEZ HYMPYR', x + 6, yy, w - 12, 4, { size: 6.5, w: 600, c: label, cs: 0.3 }); yy += 4.5; box(l.a, x + 6, yy, w - 12, y + h - yy - 3, { size: 8.5, min: 7, c: INK }); } } });
      const copy = ACT.rules.copy;
      if (copy.length) flow(copy, { cols: 2, gap: 6, title: 'Des structures éprouvées pour convaincre', lab: 'Copywriting',
        measure: (c, w) => 14 + need(c.p, w - 12, 8.5) + c.s.reduce((a, [x, y]) => a + need(`0. ${x}${y ? ' : ' + y : ''}`, w - 12, 8.5, 400, 1.3) + 0.8, 0) + (c.w ? 4 + need('Vigilance : ' + c.w, w - 12, 8) : 0) + 6,
        render: (c, x, y, w, h) => { card(x, y, w, h); let yy = y + 5; yy += box(c.n, x + 6, yy, w - 12, 7, { size: 11, min: 9, w: 600, c: T.deep }) + 2; yy += box(c.p, x + 6, yy, w - 12, 20, { size: 8.5, min: 7, c: MUTED }) + 2;
          c.s.forEach(([a, b], i) => { const t = `${i + 1}. ${a}${b ? ' : ' + b : ''}`, sh = need(t, w - 12, 8.5, 400, 1.3); if (yy + sh > y + h - 2) return; box(t, x + 6, yy, w - 12, sh, { size: 8.5, min: 7, c: INK, lh: 1.3 }); yy += sh + 0.8; });
          if (c.w && yy + 6 < y + h) { yy += 2; box('Vigilance : ' + c.w, x + 6, yy, w - 12, y + h - yy - 2, { size: 8, min: 6.5, c: '#A3341F' }); } } });
    }
    function quizPages() {
      const Q = (typeof QUIZ !== 'undefined' ? QUIZ : []).slice(0, 10);
      if (!Q.length) return;
      const qw = (CB.w - 10) / 2, avail = CB.b - 34;
      let qs = 10.5; for (; qs > 7.5; qs -= 0.25) { const hs = Q.map((q, i) => need(`${i + 1}. ${q.q}`, qw, qs, 600, 1.3) + q.o.length * qs * PT * 1.45 + 4); let c = 0, y = 0; for (const h of hs) { if (y + h > avail) { c++; y = 0; } y += h; } if (c < 2) break; }
      flow(Q.map((q, i) => ({ ...q, i })), { cols: 2, gap: 4, title: `${Q.length} questions pour valider vos acquis`, lab: 'Quiz final',
        measure: (q, w) => need(`${q.i + 1}. ${q.q}`, w, qs, 600, 1.3) + q.o.length * qs * PT * 1.45 + 0,
        render: (q, x, y, w, h) => { let yy = y + box(`${q.i + 1}. ${q.q}`, x, y, w, h, { size: qs, min: 7, w: 600, c: T.deep, lh: 1.3 }) + 0.6; q.o.forEach((o, j) => { box(`${String.fromCharCode(65 + j)}   ${o}`, x + 4, yy, w - 4, qs * PT * 1.4, { size: qs - 1, min: 6.5, c: INK }); yy += qs * PT * 1.45; }); } });
      const p = content('Les réponses, et le quiz interactif en ligne', 'Quiz final');
      const lw = CB.w - 70; let y = p.y;
      const ans = Q.map((q, i) => `${i + 1}. ${String.fromCharCode(65 + q.a)}, ${q.o[q.a]}. ${q.e}`);
      let as = 9; for (; as > 6.5; as -= 0.25) { if (ans.reduce((a, t) => a + need(t, lw, as) + 2.2, 0) <= CB.b - y) break; }
      ans.forEach(t => { const h = need(t, lw, as); if (y + h > CB.b) { warns.push(t.slice(0, 60)); return; } box(t, CB.x, y, lw, h, { size: as, min: 6.5, c: INK }); y += h + 2.2; });
      const qx = CB.x + CB.w - 56; card(qx, p.y, 56, 82, T.deep); qr(TOOL + '#regles', qx + 10, p.y + 8, 36, TOOL + '#regles');
      box('Le quiz interactif, en ligne', qx + 6, p.y + 50, 44, 12, { size: 10, w: 600, c: onDark(T.deep), a: 'center', lh: 1.2 });
      box('Onglet Règles, puis Quiz', qx + 6, p.y + 64, 44, 10, { size: 8, c: onDark(T.deep), a: 'center' });
    }
    function brandOverview() {
      const p = content('Quatre marques partagent un même socle', 'Le groupe');
      const cw = (CB.w - 3 * 8) / 4, ch = CB.b - p.y;
      BRAND_KEYS.forEach((k, i) => { const x = CB.x + i * (cw + 8), y = p.y; card(x, y, cw, ch);
        const deep = roleHex(k, 'profond'); rect(x, y, cw, 34, deep, 3); rect(x, y + 31, cw, 3, deep);
        drawLogo(k, x + 6, y + 12, 9, true, cw - 12);
        box(BRANDS[k].nom, x + 6, y + 40, cw - 12, 8, { size: 12, min: 9, w: 600, c: INK });
        box(BRANDS[k].desc, x + 6, y + 50, cw - 12, 22, { size: 9.5, min: 7.5, c: MUTED, lh: 1.4 });
        const cs = ACT.brands[k].colors, sw = (cw - 12) / Math.max(1, cs.length); cs.forEach((c, j) => rect(x + 6 + j * sw, y + ch - 16, sw, 10, c.h));
      });
    }

    /* ---------- assembly ---------- */
    step(40, 'Mise en page');
    /* cover */
    page('light');
    rect(TW - 112, -BL, 112 + BL, TH * 0.62 + BL, T.soft); rect(TW - 150, 34, 46, 46, T.deep); rect(TW - 104, 80, 26, 26, T.accent === T.deep ? T.action : T.accent);
    drawLogo(global ? 'groupe' : KEY, M, 14, 12, false, 90);
    box('charte', M, 96, 160, 26, { size: 62, min: 36, w: 700, c: T.deep, lh: 1 });
    box('graphique', M, 120, 180, 26, { size: 62, min: 36, w: 700, c: T.deep, lh: 1 });
    box(global ? 'Groupe Hympyr · toutes les marques' : BRANDS[KEY].nom, M, 150, 160, 8, { size: 14, w: 500, c: INK });
    box('Identité visuelle et standards de communication', M, 159, 160, 7, { size: 10.5, c: MUTED });
    stroke(T.deep); doc.setLineWidth(0.6); doc.circle(X(TW - 127), Y(57), 13, 'S');
    box('2027', TW - 140, 51, 26, 12, { size: 13, w: 600, c: onDark(T.deep), a: 'center', v: 'middle' });
    box(`Édition du ${new Date().toLocaleDateString('fr-FR')}`, M, TH - M - 6, 120, 5, { size: 8, c: MUTED });
    qr(SITE, TW - M - 16, TH - M - 16, 16, SITE);
    /* contents page, filled at the end */
    const tocPage = page('light');

    const parts = [];
    if (global) {
      parts.push(['Le groupe', 'Quatre marques, une exigence commune. Chaque marque garde sa palette, le socle reste partagé.', () => { brandOverview(); }]);
      BRAND_KEYS.filter(k => k !== 'groupe').forEach(k => parts.push([BRANDS[k].nom, `Logotype, palette et typographies de ${BRANDS[k].nom}.`, () => { logoPages(k); palettePages(k, `La palette ${BRANDS[k].court} tient en ${ACT.brands[k].colors.length} teinte${ACT.brands[k].colors.length > 1 ? 's' : ''}`); typoPages(k); }]));
      parts.push(['Socle commun', 'Les nuances de gris servent seules les productions qui concernent plusieurs marques.', () => { logoPages('groupe'); palettePages('groupe', 'Les nuances de gris sont communes à toutes les marques'); questionReveal(); typoPages('groupe'); spacePages('groupe'); }]);
    } else {
      parts.push(['Logotype', 'Le logo signe chaque production. Il se place en haut à gauche et garde toujours sa zone de protection.', () => logoPages(KEY)]);
      parts.push(['Couleurs', `La palette ${BRANDS[KEY].court} et les nuances de gris du socle commun.`, () => { palettePages(KEY, `La palette ${BRANDS[KEY].court} tient en ${ACT.brands[KEY].colors.length} teinte${ACT.brands[KEY].colors.length > 1 ? 's' : ''}`); palettePages('groupe', 'Les nuances de gris complètent la palette'); questionReveal(); }]);
      parts.push(['Typographie', 'Une typographie par rôle, une échelle fixe, des règles de mise en forme.', () => typoPages(KEY)]);
      parts.push(['Espacements', 'Une échelle unique d\'espacements et d\'arrondis : les encarts ne se touchent jamais.', () => spacePages(KEY)]);
    }
    parts.push(['Créations', 'Les règles de conception par type de production : outils, sites, réseaux sociaux, présentations et print.', creaPages]);
    parts.push(['Règles', 'Règles d\'or, rédaction, contrôle qualité, lois de l\'UX et copywriting.', rulePages]);
    parts.push(['Quiz', 'Dix questions pour valider vos acquis, avec les réponses et le quiz en ligne.', quizPages]);
    const pct0 = 40; TOTAL = parts.length;
    parts.forEach(([t, intro, fn], i) => { section(i + 1, t, intro); fn(); step(pct0 + Math.round((i + 1) / parts.length * 45), 'Mise en page : ' + t); });

    /* back cover */
    cur = null; page('dark');
    drawLogo(global ? 'groupe' : KEY, M, 14, 12, true, 90);
    alpha(0.16); fill(T.soft); doc.circle(X(TW * 0.3), Y(TH * 1.05), TH * 0.6, 'F'); alpha(1);
    box('Merci', M, 70, 150, 30, { size: 60, min: 30, w: 700, c: onDark(T.deep), lh: 1 });
    box('Retrouvez la charte interactive, toujours à jour : couleurs à copier, aperçus par marque et quiz.', M, 104, 130, 18, { size: 12, min: 10, c: onDark(T.deep), lh: 1.45 });
    card(TW - M - 70, 52, 70, 90); qr(TOOL, TW - M - 60, 60, 50, TOOL);
    box('Charte interactive', TW - M - 70, 114, 70, 8, { size: 11, w: 600, c: T.deep, a: 'center' });
    box('Scannez ou cliquez', TW - M - 70, 123, 70, 6, { size: 8.5, c: MUTED, a: 'center' });
    box('hympyr.fr', M, TH - M - 6, 60, 6, { size: 9, w: 600, c: onDark(T.deep) });
    doc.link(X(M), Y(TH - M - 6), 30, 6, { url: SITE });

    /* contents : interactive, with progress */
    step(90, 'Sommaire cliquable');
    doc.setPage(tocPage); cur = null; pageNo = tocPage;
    rect(-BL, -BL, 100 + BL, TH + 2 * BL, T.deep);
    drawLogo(global ? 'groupe' : KEY, M, 11, 8, true);
    box('Sommaire', M, 40, 75, 20, { size: 34, min: 22, w: 700, c: onDark(T.deep), lh: 1 });
    box(`${SECTIONS.length} parties, ${doc.getNumberOfPages()} pages. Cliquez sur une partie pour l'ouvrir. Le quiz final valide votre lecture.`, M, 64, 70, 22, { size: 10, min: 8.5, c: onDark(T.deep), lh: 1.45 });
    const tx = 115, tw2 = TW - M - tx, rowH = Math.min(20, (CB.b - 22) / SECTIONS.length);
    SECTIONS.forEach((s, i) => {
      const y = 26 + i * rowH;
      /* progress path : a dot per part, linked by a line */
      stroke(FILET); doc.setLineWidth(0.5); if (i < SECTIONS.length - 1) doc.line(X(tx + 4), Y(y + rowH / 2), X(tx + 4), Y(y + rowH * 1.5));
      fill(i === 0 ? T.deep : WHITE); stroke(T.deep); doc.setLineWidth(0.5); doc.circle(X(tx + 4), Y(y + rowH / 2), 2.4, 'FD');
      box(String(i + 1).padStart(2, '0'), tx + 12, y, 14, rowH, { size: 13, w: 600, c: label, v: 'middle' });
      box(s.t, tx + 28, y + rowH * 0.12, tw2 - 60, rowH * 0.42, { size: 14, min: 10, w: 600, c: T.deep, v: 'bottom' });
      box(s.intro || '', tx + 28, y + rowH * 0.56, tw2 - 60, rowH * 0.4, { size: 8, min: 6.5, c: MUTED, lh: 1.25 });
      box(String(s.page).padStart(2, '0'), tx + tw2 - 22, y, 22, rowH, { size: 12, w: 500, c: INK, v: 'middle', a: 'right' });
      stroke(FILET); doc.setLineWidth(0.25); doc.line(X(tx + 12), Y(y + rowH - 0.5), X(tx + tw2), Y(y + rowH - 0.5));
      doc.link(X(tx), Y(y), tw2, rowH, { pageNumber: s.page });
      try { doc.outline.add(null, `${String(i + 1).padStart(2, '0')}  ${s.t}`, { pageNumber: s.page }); } catch (e) {}
    });
    font(400, 7.5); ink(MUTED); doc.text(docName, X(115), Y(TH - M - 4), { baseline: 'top' });
    font(600, 8); ink(INK); doc.text(String(tocPage).padStart(2, '0'), X(TW - M - 19), Y(TH - M - 4), { baseline: 'top', align: 'right' });
    qr(SITE, TW - M - 16, TH - M - 16, 16, SITE);

    doc.setProperties({ title: docName, subject: 'Identité visuelle et standards de communication', author: 'Groupe Hympyr', creator: 'Charte graphique Hympyr' });
    step(100, 'Finalisation');
    const slug = global ? 'groupe' : KEY;
    return { doc, pages: doc.getNumberOfPages(), warns, file: `charte-graphique-hympyr-${slug}${opt.print ? '-imprimeur' : ''}.pdf` };
  }
  window.CHARTE_PDF = { build };
})();
