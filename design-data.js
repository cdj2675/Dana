'use strict';
// ═════════════════════════════ 디자인 모드 · 자료 읽기와 분석
// 단위는 모두 pt(1/72인치). 원고 1쪽 = 디자인 1쪽.
const MM = 72 / 25.4, EMU = 12700;
const D = {
  step: 1, gates: { g1:false, g2:false, g3:false },
  rfp: null, ms: null,
  assets: { grids:[], refs:[], fonts:[], icons:[], tokens:null },
  fams: [], roles: { body:'@noto', title:'@noto', num:null },
  grid: null, mood: 'navy', colors: { primary:null, accent:null },
  guide: null, iconMap: {},
  mapping: null, plan: { pat:{}, dec:{} },
  samples: [], style: null,
  pages: {}, gen: { running:false, done:false },
  review: { ran:false, acked:{}, issues:[] },
  msgs: {}, busy: null,
};
const DESIGN_VERSION = '1.0';

// ───────────── 공통 도구
const uid = (p='x') => p + Math.random().toString(36).slice(2, 9);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
const stripMk = s => String(s).replace(/^\s*([□■◆◇▣◈▶►▷○●◦•▪∙·ㆍ\-–—]|\d{1,2}[.)]|[가-하][.)]|[①-⑳])\s*/, '').trim();
const HEAD_MK = /^\s*[□■◆◇▣◈▶►]/, ITEM_MK = /^\s*[○●◦•▪]/, SUB_MK = /^\s*[\-–—·∙ㆍ]/, NOTE_MK = /^\s*※/, CONC_MK = /^\s*[⇒☞➡➔]/;
function askJson(prompt, opts){ if(!S.sample) return Promise.reject({ code:'no_sample' }); return S.sample.json(prompt, opts); }

// ───────────── 색 계산
function hex2rgb(h){ const x = h.replace('#',''); return [0,2,4].map(i => parseInt(x.slice(i, i+2), 16)); }
function rgb2hex(r, g, b){ return '#' + [r,g,b].map(v => clamp(Math.round(v),0,255).toString(16).padStart(2,'0')).join('').toUpperCase(); }
function rgb2hsl(r, g, b){ r/=255; g/=255; b/=255; const mx = Math.max(r,g,b), mn = Math.min(r,g,b); let h = 0, s = 0; const l = (mx+mn)/2;
  if(mx !== mn){ const d = mx - mn; s = l > .5 ? d/(2-mx-mn) : d/(mx+mn); h = mx === r ? (g-b)/d + (g < b ? 6 : 0) : mx === g ? (b-r)/d + 2 : (r-g)/d + 4; h /= 6; } return [h, s, l]; }
function hsl2hex(h, s, l){ const f = n => { const k = (n + h*12) % 12, a = s * Math.min(l, 1-l); return l - a * Math.max(-1, Math.min(k-3, 9-k, 1)); }; return rgb2hex(f(0)*255, f(8)*255, f(4)*255); }
function shade(hex, l2, s2){ const [h, s] = rgb2hsl(...hex2rgb(hex)); return hsl2hex(h, s2 ?? s, l2); }
function mix(a, b, t){ const A = hex2rgb(a), B = hex2rgb(b); return rgb2hex(A[0]+(B[0]-A[0])*t, A[1]+(B[1]-A[1])*t, A[2]+(B[2]-A[2])*t); }
function lum(hex){ const c = hex2rgb(hex).map(v => { v /= 255; return v <= .03928 ? v/12.92 : ((v+.055)/1.055) ** 2.4; }); return .2126*c[0] + .7152*c[1] + .0722*c[2]; }
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); };

// ───────────── 폰트: 파일에서 이름·굵기·panose 읽기
function sfntInfo(buf){
  const dv = new DataView(buf); let off = 0;
  if(dv.byteLength < 12) return null;
  if(dv.getUint32(0) === 0x74746366) off = dv.getUint32(12);
  const sig = dv.getUint32(off);
  if(![0x00010000, 0x4F54544F, 0x74727565].includes(sig)) return null;
  const n = dv.getUint16(off + 4), T = {};
  for(let i=0;i<n;i++){ const r = off + 12 + i*16; T[String.fromCharCode(dv.getUint8(r), dv.getUint8(r+1), dv.getUint8(r+2), dv.getUint8(r+3))] = { o:dv.getUint32(r+8), l:dv.getUint32(r+12) }; }
  const names = {};
  if(T.name){ const b = T.name.o, cnt = dv.getUint16(b+2), so = b + dv.getUint16(b+4);
    for(let i=0;i<cnt;i++){ const r = b + 6 + i*12; const pid = dv.getUint16(r), eid = dv.getUint16(r+2), lid = dv.getUint16(r+4), nid = dv.getUint16(r+6), len = dv.getUint16(r+8), o = dv.getUint16(r+10);
      if(![1,2,4,16,17].includes(nid)) continue; let s = '';
      if(pid === 3 || pid === 0){ for(let k=0;k+1<len;k+=2) s += String.fromCharCode(dv.getUint16(so+o+k)); }
      else if(pid === 1 && eid === 0){ for(let k=0;k<len;k++) s += String.fromCharCode(dv.getUint8(so+o+k)); } else continue;
      const e = names[nid] ||= {}; if(pid === 3 && lid === 0x0409) e.en = s; else if(pid === 3 && lid === 0x0412) e.ko = s; else e.any ||= s; } }
  const nm = id => names[id] ? (names[id].en || names[id].any || names[id].ko || '') : '';
  let weight = 400, panose = null, italic = false;
  if(T['OS/2'] && T['OS/2'].l >= 64){ const b = T['OS/2'].o; weight = dv.getUint16(b+4) || 400; panose = [...new Uint8Array(buf, b+32, 10)].map(v => v.toString(16).padStart(2,'0')).join('').toUpperCase(); italic = !!(dv.getUint16(b+62) & 1); }
  return { family:nm(1), sub:nm(2), full:nm(4), typo:nm(16) || nm(1), ko:names[1]?.ko || '', weight:clamp(weight, 100, 900), panose, italic, cff:sig === 0x4F54544F };
}
const BUILTIN_FAM = { key:'@noto', alias:'Noto Sans KR', label:'Noto Sans KR', builtin:true, faces:[{ weight:400, family:'Noto Sans KR' }, { weight:500, family:'Noto Sans KR Medium' }, { weight:700, family:'Noto Sans KR', rbbi:true }] };
function families(){ return [BUILTIN_FAM, ...D.fams]; }
const famOf = key => families().find(f => f.key === key) || BUILTIN_FAM;
async function addFontFile(file){
  const buf = await file.arrayBuffer(); const info = sfntInfo(buf);
  if(!info || !info.family) throw { user:`「${file.name}」에서 서체 정보를 읽지 못했습니다. TTF·OTF 파일인지 확인해 주세요.` };
  const key = 'u:' + info.typo; let fam = D.fams.find(f => f.key === key);
  if(!fam){ fam = { key, alias:'DanaU' + (D.fams.length + 1), label:info.typo, faces:[] }; D.fams.push(fam); }
  if(fam.faces.some(f => f.weight === info.weight && f.italic === info.italic)) return fam;
  const ff = new FontFace(fam.alias, buf, { weight:String(info.weight), style:info.italic ? 'italic' : 'normal' });
  await ff.load(); document.fonts.add(ff);
  fam.faces.push({ ...info, file:file.name }); fam.faces.sort((a,b) => a.weight - b.weight);
  D.assets.fonts.push({ name:file.name, family:info.family, weight:info.weight });
  if(D.roles.body === '@noto') D.roles.body = fam.key; if(D.roles.title === '@noto') D.roles.title = fam.key;
  return fam;
}
// 파워포인트에 쓸 서체명(편집 프로그램이 보는 이름)과 굵게 처리
function pptxFace(key, weight){
  const fam = famOf(key); const faces = fam.faces.filter(f => !f.italic); if(!faces.length) return { face:fam.label, bold:weight >= 600, panose:null };
  const reg = faces.reduce((a, f) => Math.abs(f.weight - 400) < Math.abs(a.weight - 400) ? f : a, faces[0]);
  if(weight < 600){ const m = faces.reduce((a, f) => Math.abs(f.weight - weight) < Math.abs(a.weight - weight) ? f : a, faces[0]); return { face:m.family, bold:false, panose:m.panose || null }; }
  const bolds = faces.filter(f => f.weight >= 600);
  if(!bolds.length) return { face:reg.family, bold:true, panose:reg.panose || null };
  const b = bolds.reduce((a, f) => Math.abs(f.weight - 700) < Math.abs(a.weight - 700) ? f : a, bolds[0]);
  if(b.rbbi || b.family === reg.family) return { face:reg.family, bold:true, panose:reg.panose || null };
  return { face:b.family, bold:false, panose:b.panose || null };
}
const cssFont = (key, weight, size) => `${weight} ${r2(size)}px "${famOf(key).alias}", "Noto Sans KR", sans-serif`;
async function ensureFonts(text){
  const sample = (text || '가나다ABC123').slice(0, 20000);
  const keys = [...new Set([D.roles.body, D.roles.title, D.roles.num].filter(Boolean))];
  const jobs = []; for(const k of keys) for(const w of [400, 700]) jobs.push(document.fonts.load(cssFont(k, w, 16), sample).catch(() => {}));
  await Promise.all(jobs);
}
function fontReady(key){ const f = famOf(key); return f.builtin ? document.fonts.check(`400 16px "Noto Sans KR"`, '가') : f.faces.length > 0; }

// ───────────── 과업지시서: 글자·표 읽기
async function readDocText(file){
  const ext = extOf(file);
  if(ext === 'pdf'){
    const pdf = await openPdf(file); const pages = [];
    for(let i=1;i<=Math.min(pdf.numPages, 200);i++){ const pg = await pdf.getPage(i); const tc = await pg.getTextContent(); let line = '', lines = [];
      for(const it of tc.items){ line += it.str; if(it.hasEOL){ if(line.trim()) lines.push(line.trim()); line = ''; } }
      if(line.trim()) lines.push(line.trim()); pages.push({ n:i, lines }); pg.cleanup(); }
    return { pages, tables:[] };
  }
  if(ext === 'docx') return readDocxRich(file);
  if(ext === 'hwpx') return readHwpxRich(file);
  if(ext === 'txt' || ext === 'md'){ const t = await file.text(); return { pages:t.split('\f').map((p, i) => ({ n:i+1, lines:p.split(/\r?\n/).map(s => s.trim()).filter(Boolean) })), tables:[] }; }
  if(ext === 'hwp') return readHwpBin(file);
  throw { user:`「${file.name}」은 읽을 수 없는 형식입니다. PDF·HWP·HWPX·DOCX를 올려 주세요.` };
}
async function readDocxRich(file){
  const zip = await JSZip.loadAsync(file); const doc = parseXml(await zip.file('word/document.xml').async('string'));
  const body = desc(doc.documentElement, 'body')[0]; let page = 1; const pages = [{ n:1, lines:[] }], tables = [];
  const pText = p => { let s = ''; for(const e of p.getElementsByTagName('*')){ if(e.localName === 't') s += e.textContent; else if(e.localName === 'tab') s += ' '; } return s; };
  const brk = el => desc(el, 'lastRenderedPageBreak').length + desc(el, 'br').filter(b => b.getAttribute('w:type') === 'page').length;
  for(const el of body.children){
    if(el.localName === 'p'){ const b = brk(el); if(b){ page += b; pages.push({ n:page, lines:[] }); } const t = pText(el).trim(); if(t) pages[pages.length-1].lines.push(t); }
    else if(el.localName === 'tbl'){
      const rows = kids(el, 'tr').map(tr => kids(tr, 'tc').map(tc => desc(tc, 'p').map(p => pText(p)).join(' ').replace(/\s+/g, ' ').trim()));
      tables.push({ page, rows }); rows.forEach(r => { const t = r.filter(Boolean).join(' | '); if(t) pages[pages.length-1].lines.push(t); });
    }
  }
  return { pages:pages.filter(p => p.lines.length), tables };
}
async function readHwpxRich(file){
  const zip = await JSZip.loadAsync(file);
  const secs = Object.keys(zip.files).filter(k => /^Contents\/section\d+\.xml$/i.test(k)).sort((a,b) => (+a.match(/\d+/)[0]) - (+b.match(/\d+/)[0]));
  let page = 1; const pages = [{ n:1, lines:[] }], tables = [];
  const ptxt = p => desc(p, 't').filter(t => [...ancestors(t)].find(a => a.localName === 'p') === p).map(t => t.textContent).join('');
  for(const k of secs){
    const doc = parseXml(await zip.file(k).async('string'));
    const walk = el => { for(const c of el.children){
      if(c.localName === 'tbl'){
        const rows = kids(c, 'tr').map(tr => { const out = []; for(const tc of kids(tr, 'tc')){ const ad = desc(tc, 'cellAddr')[0]; const col = ad ? +ad.getAttribute('colAddr') : out.length; out[col] = desc(tc, 'p').map(ptxt).join(' ').replace(/\s+/g, ' ').trim(); } return Array.from(out, v => v || ''); });
        tables.push({ page, rows }); rows.forEach(r => { const t = r.filter(Boolean).join(' | '); if(t) pages[pages.length-1].lines.push(t); });
      } else if(c.localName === 'p'){
        if(c.getAttribute('pageBreak') === '1'){ page++; pages.push({ n:page, lines:[] }); }
        if(desc(c, 'tbl').length) walk(c); else { const t = ptxt(c).trim(); if(t) pages[pages.length-1].lines.push(t); }
      } else walk(c); } };
    walk(doc.documentElement);
  }
  return { pages:pages.filter(p => p.lines.length), tables };
}

// ───────────── 과업지시서: 평가 항목·배점과 제약 조항
const CON_KINDS = {
  font_min:{ name:'본문 최소 글자 크기', unit:'pt', num:true }, font_min_figure:{ name:'표·그림 최소 글자 크기', unit:'pt', num:true },
  font_face:{ name:'지정 서체' }, pages_max:{ name:'쪽수 상한', unit:'쪽', num:true }, paper:{ name:'용지' }, orientation:{ name:'방향' },
  duplex:{ name:'인쇄' }, binding:{ name:'제본' }, blind:{ name:'블라인드 평가' }, submit_format:{ name:'제출 형식' },
  cover:{ name:'표지 양식' }, toc_order:{ name:'목차 순서' }, page_number:{ name:'쪽 번호' }, other:{ name:'기타 주의' },
};
function itemsFromTables(tables){
  const out = [];
  for(const T of tables){
    const rows = T.rows.filter(r => r.some(Boolean)); const h = rows.findIndex(r => r.some(c => /배\s*점|점\s*수/.test(c)));
    if(h < 0) continue; const H = rows[h];
    const sc = H.findIndex(c => /배\s*점/.test(c)) >= 0 ? H.findIndex(c => /배\s*점/.test(c)) : H.findIndex(c => /점\s*수/.test(c));
    let nc = H.findIndex((c, i) => i !== sc && /세부/.test(c)); if(nc < 0) nc = H.findIndex((c, i) => i !== sc && /평가\s*항목|항\s*목|내\s*용|요\s*소/.test(c)); if(nc < 0) nc = sc - 1;
    let ac = H.findIndex((c, i) => i !== sc && i !== nc && /부\s*문|구\s*분|분\s*야|영\s*역|대\s*항목/.test(c));
    const kc = H.findIndex((c, i) => i !== sc && i !== nc && /^(번호|no\.?|순번|항목번호|연번)$/i.test(c.replace(/\s/g, '')));
    let area = '', got = 0;
    for(const r of rows.slice(h + 1)){
      const sv = String(r[sc] ?? '').replace(/점/g, '').trim(); const score = parseFloat(sv);
      if(ac >= 0 && r[ac]) area = r[ac];
      const name = (r[nc] || '').trim();
      if(!(score > 0) || /^(합\s*계|총\s*계|계|소\s*계|총\s*점)$/.test(name.replace(/\s/g,'')) || (!name && /합|계/.test(area))) continue;
      if(!name) continue;
      const pm = name.match(/^(\d{1,2}(?:[-.]\d{1,2})?)[.)]?\s+(.+)$/); const code = (kc >= 0 && /^\d{1,2}([-.]\d{1,2})?$/.test((r[kc] || '').trim()) ? r[kc].trim() : pm ? pm[1] : '') || null;
      out.push({ id:uid('i'), area, name:pm ? pm[2].trim() : name, code, score, page:T.page, quote:r.filter(Boolean).join(' | ').slice(0, 120) }); got++;
    }
    if(got) break;
  }
  return out;
}
function itemsFromLines(pages){
  const out = [];
  for(const p of pages){ let on = false;
    for(const l of p.lines){
      if(/배\s*점/.test(l)){ on = true; continue; }
      if(!on) continue;
      if(/^(합\s*계|총\s*계|계)\b/.test(l.replace(/\s/g,''))) { on = false; continue; }
      const m = l.match(/^(.*?[가-힣].*?)\s+(\d{1,2}(?:\.\d)?)\s*점?$/);
      if(m && m[1].length <= 60) out.push({ id:uid('i'), area:'', name:m[1].replace(/\s*\|\s*/g, ' ').trim(), score:+m[2], page:p.n, quote:l.slice(0, 120) });
    } }
  return out;
}
// ───────────── 배점표가 없을 때: 평가 기준·과업 요구사항으로 중요도 정하기
// 1) 배점 없는 평가 항목 표·목록이 있으면 그 항목을, 2) 없으면 「과업 내용·요구사항」 아래 소제목을 항목으로 삼고
// 강조 표현·요구 문장 수·반복 언급·평가 기준 언급으로 중요도(1~5)를 매긴 뒤 합 100으로 나눔
const REQ_SCOPE = /과업\s*(의\s*)?(내용|범위|세부|요구|목록)|세부\s*(과업|업무|추진)|요구\s*사항|제안\s*요청\s*(사항|내용)|수행\s*(내용|업무|사항|과업)|주요\s*(과업|업무|내용|사업)|업무\s*(내용|범위)|사업\s*(내용|범위)|추진\s*(내용|과제)|용역\s*(내용|범위)/;
const REQ_SKIP = /입찰|계약|제출\s*(서류|방법|부수)|작성\s*(요령|방법|기준|지침)|평가\s*(방법|절차|기준|항목|위원)|유의\s*사항|일반\s*사항|기타|보안|대금|지체\s*상금|하자|과업\s*(개요|기간|명|목적|장소|예산)|사업\s*(개요|기간|예산)|용어|정의|목적|배경/;
const REQ_SENT = /(할\s*것|하여야|해야\s*(함|한다|하며)|하도록\s*(함|한다)|제시\s*(할|하여|바람|요망)|포함\s*(할|하여)|바람\.?$|요망|필수|반드시)/;
const EMPH = /반드시|필수|중점|핵심|최우선|우선적|특히|중요|강조|집중|역점|극대화/g;
function headLevel(l){
  const t = l.trim(); if(t.length > 48 || /(다|함|것|음|요)[.)]?$/.test(t.replace(/\s/g,''))) return 0;
  if(/^(제\s*\d+\s*(장|편)|[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ][.\s])/.test(t)) return 1;
  if(/^제\s*\d+\s*조/.test(t)) return 2;
  if(/^\d{1,2}\s*[.)]\s*\S/.test(t) && !/^\d+\.\d/.test(t)) return 2;
  if(/^[가-하]\s*[.)]\s*\S/.test(t)) return 3;
  if(/^[□■◆◇▣▶]/.test(t)) return 3;
  if(/^(\(\d{1,2}\)|[①-⑳])\s*\S/.test(t)) return 4;
  return 0;
}
const headName = l => l.trim().replace(/^(제\s*\d+\s*(장|편|조)|[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]|\d{1,2}|[가-하]|\(\d{1,2}\)|[①-⑳□■◆◇▣▶])\s*[.)]?\s*/, '').replace(/[(（]\s*$/, '').trim();
function outline(pages){
  const nodes = [{ lv:0, title:'', lines:[], page:1 }];
  for(const p of pages) for(const l of p.lines){ const lv = headLevel(l);
    if(lv) nodes.push({ lv, title:headName(l), raw:l, lines:[], page:p.n }); else nodes[nodes.length - 1].lines.push(l); }
  return nodes;
}
// 배점 없는 평가 항목: 표 머리에 평가 항목·요소·지표가 있고 배점이 없거나, 「평가 항목」 소제목 아래 목록
function criteriaFrom(doc){
  for(const T of doc.tables){ const rows = T.rows.filter(r => r.some(Boolean)); const h = rows.findIndex(r => r.some(c => /평가\s*(항목|요소|지표|기준)/.test(c)));
    if(h < 0 || rows[h].some(c => /배\s*점|점\s*수/.test(c))) continue; const H = rows[h];
    let nc = H.findIndex(c => /세부/.test(c)); if(nc < 0) nc = H.findIndex(c => /평가\s*(항목|요소|지표)/.test(c)); if(nc < 0) nc = H.findIndex(c => /평가\s*기준/.test(c));
    const ac = H.findIndex((c, i) => i !== nc && /부\s*문|구\s*분|분\s*야|영\s*역|대\s*항목/.test(c)); let area = '';
    const out = []; for(const r of rows.slice(h + 1)){ if(ac >= 0 && r[ac]) area = r[ac]; const name = (r[nc] || '').trim(); if(!name || name.length > 60 || /^(합\s*계|계|소\s*계)$/.test(name)) continue;
      const others = r.filter((c, i) => i !== nc && i !== ac && c).join(' '); out.push({ name, area, body:[others], page:T.page }); }
    if(out.length >= 2) return out; }
  const N = outline(doc.pages);
  for(let i = 0; i < N.length; i++){ const n = N[i]; if(!/평가\s*(항목|요소|지표)/.test(n.title) || /방법|절차|위원/.test(n.title)) continue;
    const kids = []; for(let j = i + 1; j < N.length && N[j].lv > n.lv; j++) if(N[j].lv === n.lv + 1 || (kids.length && N[j].lv === kids[0].lv)) kids.push(N[j]);
    if(kids.length >= 2) return kids.map(k => ({ name:k.title, raw:k.raw, area:'', body:k.lines, page:k.page }));
    const bul = n.lines.filter(l => /^[○●◦·•\-–]\s*\S/.test(l) && l.length <= 50).map(l => l.replace(/^[○●◦·•\-–]\s*/, '').replace(/\s*[:：].*$/, '').trim());
    if(bul.length >= 2) return bul.map(b => ({ name:b, area:'', body:[], page:n.page })); }
  return [];
}
function reqsFromOutline(doc){
  const N = outline(doc.pages); const out = [];
  const scopes = N.map((n, i) => i).filter(i => N[i].lv && REQ_SCOPE.test(N[i].title) && !REQ_SKIP.test(N[i].title.replace(REQ_SCOPE, '')));
  const take = (i, end) => { const n = N[i]; let cl = 0; for(let j = i + 1; j < end; j++) if(N[j].lv > n.lv && (!cl || N[j].lv < cl)) cl = N[j].lv;
    const kids = []; for(let j = i + 1; j < end; j++) if(N[j].lv === cl){ const body = [...N[j].lines]; for(let k = j + 1; k < end && N[k].lv > cl; k++) body.push(N[k].raw, ...N[k].lines); kids.push({ name:N[j].title, raw:N[j].raw, area:n.title, body, page:N[j].page }); }
    if(kids.length >= 2) return kids;
    const bul = n.lines.filter(l => /^[○●◦·•]\s*\S/.test(l)).map(l => l.replace(/^[○●◦·•]\s*/, ''));
    return bul.length >= 2 ? bul.map(b => ({ name:b.replace(/\s*(을|를)?\s*(제시|수립|포함|구축|마련)\s*(할\s*것|하여야\s*함|해야\s*함).*$/, '').slice(0, 40), area:n.title, body:[b], page:n.page })) : []; };
  for(const i of scopes){ let end = i + 1; while(end < N.length && N[end].lv > N[i].lv) end++; out.push(...take(i, end)); }
  if(out.length >= 2) return out.filter(x => !REQ_SKIP.test(x.name) || x.body.some(l => REQ_SENT.test(l)));
  // 「과업 내용」 같은 제목이 없으면: 요구 문장이 2개 이상 달린 소제목
  return N.filter(n => n.lv >= 2 && n.title && !REQ_SKIP.test(n.title) && n.lines.filter(l => REQ_SENT.test(l)).length >= 2).map(n => ({ name:n.title, raw:n.raw, area:'', body:n.lines, page:n.page }));
}
function weighItems(list, doc, basis){
  const all = doc.pages.flatMap(p => p.lines); const evalL = all.filter(l => /평가/.test(l) && !/평가\s*(위원|절차|일정)/.test(l));
  const raw = list.map(x => { const own = new Set(x.body); const txt = [x.name, ...x.body].join(' ');
    const req = x.body.filter(l => REQ_SENT.test(l)).length; const emph = (txt.match(EMPH) || []).length;
    if(x.raw) own.add(x.raw); const hit = l => !own.has(l) && l.trim() !== x.name && (l.includes(x.name) || simText(l, x.name) >= .5);
    const ment = x.name.length >= 2 ? all.filter(hit).length : 0;
    const ev = evalL.some(l => hit(l) && /중점|중요|특히|우선/.test(l));
    const r = 2 + .35 * Math.min(req, 10) + .7 * Math.min(emph, 4) + .4 * Math.min(ment, 5) + .3 * Math.log2(1 + txt.length / 200) + (ev ? 1.5 : 0);
    const why = [req && `요구 ${req}건`, emph && `강조 ${emph}회`, ment && `다른 곳 언급 ${ment}회`, ev && '평가 중점'].filter(Boolean).join(' · ');
    return { x, r, why }; });
  const lo = Math.min(...raw.map(v => v.r)), hi = Math.max(...raw.map(v => v.r));
  return raw.map(({ x, r, why }) => ({ id:uid('i'), area:x.area || '', name:x.name, w:hi - lo < .3 ? 3 : clamp(Math.round(10 * r / hi) / 2, 1, 5), why:why || '기본', page:x.page, quote:(x.body.find(l => REQ_SENT.test(l)) || x.body[0] || '').slice(0, 120), detail:x.body.join(' ').slice(0, 400), basis }));
}
// 중요도(w 1~5) → score(합 100)
function normDerived(items){ const t = items.reduce((a, i) => a + (+i.w || 0), 0) || 1; for(const i of items) i.score = 100 * (+i.w || 0) / t; return items; }
const tierOf = w => w >= 4 ? '상' : w >= 2.5 ? '중' : '하';
const TIER_W = { '상':5, '중':3, '하':1 };
const derived = () => D.rfp?.mode === 'derived';
const WT = () => derived() ? '중요도' : '배점';
const ptLabel = v => derived() ? `${Math.round(v)}%` : `${r1(v)}점`;
function consFromLines(pages){
  const out = []; const add = (kind, value, label, l, p, sure = true) => { if(out.some(c => c.kind === kind && String(c.value) === String(value))) return; out.push({ id:uid('c'), kind, value, label, quote:l.slice(0, 160), page:p, status:sure ? 'ok' : 'check', by:'auto' }); };
  for(const p of pages) for(const l of p.lines){
    let m;
    if((m = l.match(/(본문|글자|글씨|문자|폰트)[^.\n]{0,24}?(\d{1,2}(?:\.\d)?)\s*(?:pt|포인트|point|p\b)\s*이상/i))) add('font_min', +m[2], `본문 ≥ ${+m[2]}pt`, l, p.n, true);
    if((m = l.match(/(표|그림|도표|그래프)[^.\n]{0,24}?(\d{1,2}(?:\.\d)?)\s*(?:pt|포인트|point)\s*이상/i))) add('font_min_figure', +m[2], `표·그림 ≥ ${+m[2]}pt`, l, p.n, true);
    if((m = l.match(/(\d{1,3})\s*(?:쪽|페이지|매|면|page)\s*이내/i))) add('pages_max', +m[1], `${+m[1]}쪽 이내`, l, p.n, /제안서|본문|분량/.test(l));
    if((m = l.match(/\b(A4|A3|B4|B5)\b/i)) && /용지|규격|크기|작성/.test(l)) add('paper', m[1].toUpperCase(), m[1].toUpperCase(), l, p.n, true);
    if(/세로\s*(방향)?/.test(l) && /용지|방향|작성/.test(l)) add('orientation', '세로', '세로', l, p.n, true); else if(/가로\s*(방향)/.test(l)) add('orientation', '가로', '가로', l, p.n, true);
    if(/양면/.test(l)) add('duplex', '양면', '양면', l, p.n, true); else if(/단면/.test(l) && /인쇄|출력/.test(l)) add('duplex', '단면', '단면', l, p.n, true);
    if((m = l.match(/(좌측|왼쪽|상단|좌)\s*(제본|철)|좌철|상철/))) add('binding', /상/.test(m[0]) ? '상철' : '좌철', /상/.test(m[0]) ? '상철' : '좌철', l, p.n, true);
    if(/블라인드/.test(l) || (/(회사명|업체명|로고|상호|대표자)/.test(l) && /(금지|아니\s*된다|안\s*된다|표시하지|기재하지|노출)/.test(l))) add('blind', true, '블라인드 평가', l, p.n, true);
    if(/PDF/i.test(l) && /(제출|파일)/.test(l)) add('submit_format', /컬러|칼라/.test(l) ? 'PDF 컬러' : 'PDF', /컬러|칼라/.test(l) ? 'PDF 컬러' : 'PDF', l, p.n, /컬러|칼라/.test(l));
    if((m = l.match(/(서체|글꼴|폰트|글자체)[^.\n]{0,16}?(맑은\s?고딕|나눔\s?고딕|나눔\s?명조|KoPub\S*|한컴\S*|휴먼\S*|바탕체?|굴림체?|돋움체?|본고딕|Noto\s?Sans\s?KR|Pretendard)/i))) add('font_face', m[2], `서체 ${m[2]}`, l, p.n, false);
    if(/표지/.test(l) && /(서식|양식|따른다|따르)/.test(l)) add('cover', '양식 따름', '표지 양식', l, p.n, false);
    if(/목차/.test(l) && /(순서|순으로|동일|같게)/.test(l)) add('toc_order', '평가 항목 순서', '목차 순서', l, p.n, false);
    if(/(쪽|페이지)\s?번호/.test(l)) add('page_number', /표시하지|넣지|생략|없/.test(l) ? '넣지 않음' : '표시', /표시하지|넣지|생략|없/.test(l) ? '쪽 번호 없음' : '쪽 번호 표시', l, p.n, false);
  }
  return out;
}
const RFP_PROMPT = `다음은 공공 입찰 과업지시서(제안요청서) 본문입니다. 쪽마다 [p.N] 표시가 있습니다. 제안서 디자인에 필요한 정보만 아래 JSON 하나로 답하세요. 문서에 없는 내용은 넣지 말고, 추측하지 마세요.
{"items":[{"area":"평가 부문(없으면 빈 문자열)","name":"평가 항목 이름(문서 그대로)","score":배점 숫자,"page":쪽 번호}],
 "reqs":[{"area":"상위 묶음(없으면 빈 문자열)","name":"요구사항 이름(짧게, 문서 표현 위주)","weight":1~5,"why":"중요도 근거(20자 이내)","quote":"대표 근거 원문(문서 그대로, 120자 이내)","page":쪽 번호}],
 "constraints":[{"kind":"font_min|font_min_figure|font_face|pages_max|paper|orientation|duplex|binding|blind|submit_format|cover|toc_order|page_number|other","value":"값(숫자는 숫자만)","label":"배너에 쓸 아주 짧은 말(예: 본문 ≥ 11pt, 60쪽 이내)","page":쪽 번호,"quote":"근거 조항 원문(문서 그대로, 160자 이내)","sure":true 또는 false}]}
- items: 문서에 평가 항목별 점수(배점)가 숫자로 적혀 있을 때만, 가장 작은 단위 항목을 넣습니다. 합계·소계는 넣지 않습니다. 점수가 없으면 빈 배열로 둡니다.
- reqs: items가 비었을 때만 채웁니다. 배점 없는 평가 항목(평가 요소·지표)이 있으면 그것을, 없으면 발주처가 대행업체(수행사)에게 요구하는 과업·요구사항을 제안서 목차 한 절로 쓸 만한 단위(4~12개)로 묶어 넣습니다. 입찰·계약·제출 서류·제안서 작성 요령처럼 제안서 모양이나 행정 절차에 관한 것은 넣지 않습니다.
  weight는 문서 근거로만 매깁니다: 「반드시·필수·중점·최우선·특히」 같은 강조, 요구 문장과 세부 조건의 수, 여러 곳에서 반복 언급, 평가 방법에서 중점 평가한다고 한 것. 근거가 비슷하면 같은 값을 줍니다.
- constraints: 제안서 분량·용지·방향·인쇄·제본, 글자 크기, 지정 서체, 업체 식별 금지(블라인드), 제출 형식, 표지·목차·쪽 번호 규칙처럼 제안서 모양을 제한하는 조항만 넣습니다. 해석이 애매하면 sure를 false로 둡니다.

본문:
`;
async function extractRfp(file){
  const doc = await readDocText(file);
  let items = itemsFromTables(doc.tables); if(!items.length) items = itemsFromLines(doc.pages);
  let cons = consFromLines(doc.pages); let by = 'auto', mode = 'score', basis = 'score';
  // 배점표가 없으면: 배점 없는 평가 항목 → 과업 요구사항 순으로 찾아 중요도를 매김
  let reqs = [];
  if(!items.length){ const cr = criteriaFrom(doc); if(cr.length >= 2){ reqs = weighItems(cr, doc, 'criteria'); basis = 'criteria'; } else { const rq = reqsFromOutline(doc); if(rq.length >= 2){ reqs = weighItems(rq, doc, 'req'); basis = 'req'; } } }
  if(S.sample){
    try{
      const text = doc.pages.map(p => `[p.${p.n}]\n` + p.lines.join('\n')).join('\n').slice(0, 80000);
      const raw = await askJson(RFP_PROMPT + text);
      const flat = norm(doc.pages.map(p => p.lines.join('')).join(''));
      const it2 = (raw?.items || []).filter(x => x && x.name && +x.score > 0).map(x => ({ id:uid('i'), area:String(x.area||'').trim(), name:String(x.name).trim(), score:+x.score, page:+x.page || null, quote:'' }));
      const c2 = (raw?.constraints || []).filter(x => x && CON_KINDS[x.kind]).map(x => { const q = String(x.quote || '').trim(); const found = q && flat.includes(norm(q).slice(0, 40));
        const num = CON_KINDS[x.kind].num ? parseFloat(x.value) || null : null; const numOk = !CON_KINDS[x.kind].num || (q.match(/\d+(?:\.\d+)?/g) || []).map(Number).includes(num);
        return { id:uid('c'), kind:x.kind, value:CON_KINDS[x.kind].num ? num : (x.kind === 'blind' ? true : String(x.value || '').trim()), label:String(x.label || CON_KINDS[x.kind].name).slice(0, 24), quote:q.slice(0, 160), page:+x.page || null, status:x.sure && found && numOk ? 'ok' : 'check', by:'claude' }; })
        .filter(c => !CON_KINDS[c.kind].num || c.value > 0);
      // Claude가 말한 배점은 문서에 그 숫자가 있을 때만 믿음
      const docTxt = doc.pages.map(p => p.lines.join(' ')).join(' ');
      const it2ok = it2.every(x => new RegExp(`(^|[^\\d.])${String(x.score).replace('.', '\\.')}\\s*(점|[^\\d.]|$)`).test(docTxt));
      if(it2.length && it2ok && it2.length >= items.length) items = it2;
      const rq2 = (raw?.reqs || []).filter(x => x && x.name).map(x => { const q = String(x.quote || '').trim(); return { id:uid('i'), area:String(x.area || '').trim(), name:String(x.name).trim().slice(0, 40), w:clamp(Math.round((+x.weight || 3) * 2) / 2, 1, 5), why:String(x.why || '').slice(0, 30) || '기본', page:+x.page || null, quote:q && flat.includes(norm(q).slice(0, 30)) ? q.slice(0, 120) : '', detail:q, basis:'claude' }; });
      if(!items.length && rq2.length >= 2){ reqs = rq2; basis = 'claude'; }
      if(c2.length){ for(const c of cons){ const k = c2.findIndex(x => x.kind === c.kind); if(k < 0) c2.push(c); else if(c.status === 'ok' && c2[k].status !== 'ok') c2[k] = c; } cons = c2; }
      by = 'claude';
    }catch(e){ console.warn('rfp claude', e); }
  }
  if(!items.length && reqs.length){ items = normDerived(reqs); mode = 'derived'; } else basis = items.length ? 'score' : 'none';
  for(const c of cons) c.src = file.name;
  const head = (file.name + ' ' + (doc.pages[0]?.lines || []).slice(0, 6).join(' ')).replace(/\s/g, '');
  const kind = /제안요청/.test(head) ? '제안요청서' : /과업지시|과업내용서/.test(head) ? '과업지시서' : /공고/.test(head) ? '입찰 공고' : '참고 문서';
  return { name:file.name, kind, items, cons:mergeCons(cons), by, mode, basis, pages:doc.pages.length };
}
// 같은 종류가 둘 이상이면 하나로(확정된 것 우선, 같으면 가장 엄격한 값)
function mergeCons(cons){
  const merged = [];
  for(const c0 of cons){ const c = { ...c0 }; const o = merged.find(x => x.kind === c.kind && x.kind !== 'other');
    if(!o){ merged.push(c); continue; }
    if(o.status === 'ok' && c.status !== 'ok') continue; if(c.status === 'ok' && o.status !== 'ok'){ Object.assign(o, c); continue; }
    if(c.kind === 'font_min' || c.kind === 'font_min_figure'){ if(c.value > o.value) Object.assign(o, c); }
    else if(c.kind === 'pages_max'){ if(c.value < o.value) Object.assign(o, c); } }
  return merged;
}
// 여러 문서(과업지시서 + 제안요청서 + 공고)를 하나로: 배점표가 있는 문서를 우선, 없으면 배점 없는 평가 항목 > Claude 요구사항 > 과업 요구사항
function combineRfp(docs, prev){
  const scored = docs.filter(d => d.mode === 'score' && d.items.length).sort((a, b) => b.items.length - a.items.length);
  const rank = { criteria:3, claude:2, req:1 };
  const der = docs.filter(d => d.mode === 'derived' && d.items.length).sort((a, b) => (rank[b.basis] || 0) - (rank[a.basis] || 0) || b.items.length - a.items.length);
  const pick = scored[0] || der[0] || null;
  const items = pick ? pick.items.map(i => ({ ...i })) : [];
  // 배점 항목에 과업 내용(다른 문서의 요구사항)을 붙여 원고 절 연결을 돕기
  if(scored[0]) for(const it of items){ let best = null, bv = .45; for(const d of der) for(const r of d.items){ const v = simText(it.name, r.name); if(v > bv){ bv = v; best = r; } } if(best && !it.detail) it.detail = best.detail || best.quote || ''; }
  let cons = mergeCons(docs.flatMap(d => d.cons));
  // 사용자가 확정·해당 없음으로 바꾼 것과 직접 추가한 조항은 유지
  const was = new Map((prev?.cons || []).map(c => [c.kind + '|' + c.value + '|' + (c.src || ''), c.status]));
  for(const c of cons){ const st = was.get(c.kind + '|' + c.value + '|' + (c.src || '')); if(st) c.status = st; }
  cons = [...cons, ...(prev?.cons || []).filter(c => c.by === 'user')];
  return { name:docs.map(d => d.name).join(' · '), docs, items, cons, by:docs.some(d => d.by === 'claude') ? 'claude' : 'auto', mode:pick?.mode || 'score', basis:pick ? pick.basis : 'none', itemsFrom:pick ? pick.name : null, pages:docs.reduce((a, d) => a + (d.pages || 0), 0) };
}

const con = kind => (D.rfp?.cons || []).find(c => c.kind === kind && c.status === 'ok');
const conAny = kind => (D.rfp?.cons || []).find(c => c.kind === kind && c.status !== 'off');
function locks(){
  const fm = con('font_min'), ff = con('font_min_figure'), pm = con('pages_max');
  return { bodyMin: fm ? +fm.value : null, figMin: ff ? +ff.value : (fm ? null : null), pagesMax: pm ? +pm.value : null, blind: !!con('blind'), face: con('font_face')?.value || null,
    pageNumber: con('page_number')?.value || null, paper: con('paper')?.value || null, orientation: con('orientation')?.value || null };
}

// ───────────── 원고: 쪽·장·절·문단·표·사진
async function parseManuscript(file){
  const ext = extOf(file);
  if(ext === 'pptx') return parseMsPptx(file);
  let src;
  if(ext === 'docx') src = await parseDocx(file); else if(ext === 'hwpx') src = await parseHwpx(file);
  else if(ext === 'pdf') src = await parsePdfSource(file); else if(ext === 'txt' || ext === 'md') src = await parseTxt(file);
  else if(ext === 'hwp') src = await parseHwp(file);
  else throw { user:`「${file.name}」은 원고로 쓸 수 없는 형식입니다. PPTX·DOCX·HWP·HWPX·PDF를 올려 주세요.` };
  const pages = Object.keys(src.pages).map(Number).sort((a,b) => a-b).map(n => {
    let paras = src.pages[n].paras.map(s => String(s).trim()).filter(Boolean);
    if(ext === 'pdf'){ const m = []; for(const l of paras){ const prev = m[m.length-1]; if(prev && !/^\s*([□■◆◇▣○●◦•▪\-–·※⇒]|\d{1,2}[.)]|[가-하][.)])/.test(l) && !/[.다:]$/.test(prev)) m[m.length-1] = prev + ' ' + l; else m.push(l); } paras = m; }
    let title = '';
    if(paras.length > 1 && paras[0].length <= 50 && !ITEM_MK.test(paras[0]) && !SUB_MK.test(paras[0])) title = paras.shift();
    return { n, title, src:src.pages[n].src || null, blocks:paras.map(t => ({ k:'p', text:t, lvl:0 })), pics:[] };
  });
  return finishMs(file.name, ext, { w:595.28, h:841.89 }, pages);
}
async function parseMsPptx(file){
  const zip = await JSZip.loadAsync(file);
  const pres = parseXml(await zip.file('ppt/presentation.xml').async('string'));
  const sz = desc(pres.documentElement, 'sldSz')[0];
  const W = sz ? +sz.getAttribute('cx') / EMU : 720, H = sz ? +sz.getAttribute('cy') / EMU : 540;
  const relsOf = async path => { const rp = path.replace(/([^/]+)$/, '_rels/$1.rels'); const f = zip.file(rp); const m = {}; if(!f) return m;
    desc(parseXml(await f.async('string')).documentElement, 'Relationship').forEach(r => { m[r.getAttribute('Id')] = { t:r.getAttribute('Target'), type:r.getAttribute('Type') || '' }; }); return m; };
  const resolve = (base, t) => { if(t.startsWith('/')) return t.slice(1); const parts = base.split('/'); parts.pop(); for(const s of t.split('/')){ if(s === '..') parts.pop(); else if(s !== '.') parts.push(s); } return parts.join('/'); };
  const prel = await relsOf('ppt/presentation.xml');
  const ids = desc(pres.documentElement, 'sldId').map(e => e.getAttribute('r:id') || [...e.attributes].find(a => a.localName === 'id' && a.prefix === 'r')?.value);
  const targets = ids.map(id => prel[id]?.t).filter(Boolean).map(t => resolve('ppt/presentation.xml', t));
  const layoutCache = {};
  const phPos = async layoutPath => {
    if(layoutCache[layoutPath]) return layoutCache[layoutPath]; const m = {}; const f = zip.file(layoutPath); if(!f) return m;
    const doc = parseXml(await f.async('string'));
    for(const sp of desc(doc.documentElement, 'sp')){ const ph = desc(sp, 'ph')[0]; if(!ph) continue; const x = xfrmOf(sp); if(!x) continue; const k = ph.getAttribute('type') || 'body'; m['t:' + k] ||= x; if(ph.getAttribute('idx')) m['i:' + ph.getAttribute('idx')] ||= x; }
    return layoutCache[layoutPath] = m;
  };
  const pages = [];
  for(let i=0;i<targets.length;i++){
    const path = targets[i], f = zip.file(path); if(!f) continue;
    const doc = parseXml(await f.async('string')); const rels = await relsOf(path);
    const lay = Object.values(rels).find(r => /slideLayout/.test(r.type)); const lpos = lay ? await phPos(resolve(path, lay.t)) : {};
    const shapes = [];
    const walk = async (parent, T) => {
      for(const el of parent.children){
        const tag = el.localName;
        if(tag === 'grpSp'){ const gx = desc(el, 'grpSpPr')[0]; const xf = gx && kid(gx, 'xfrm'); let T2 = T;
          if(xf){ const o = kid(xf,'off'), e = kid(xf,'ext'), co = kid(xf,'chOff'), ce = kid(xf,'chExt');
            if(o && e && co && ce){ const sx = (+e.getAttribute('cx') || 1) / (+ce.getAttribute('cx') || 1), sy = (+e.getAttribute('cy') || 1) / (+ce.getAttribute('cy') || 1);
              const inner = { a:sx, b:sy, c:+o.getAttribute('x') - +co.getAttribute('x') * sx, d:+o.getAttribute('y') - +co.getAttribute('y') * sy };
              T2 = { a:T.a * inner.a, b:T.b * inner.b, c:T.a * inner.c + T.c, d:T.b * inner.d + T.d }; } }
          await walk(el, T2); continue; }
        const ph = desc(el, 'ph')[0]; const phType = ph ? (ph.getAttribute('type') || 'body') : null;
        let x = xfrmOf(el); if(!x && ph) x = lpos['t:' + phType] || (ph.getAttribute('idx') && lpos['i:' + ph.getAttribute('idx')]) || null;
        const box = x ? { x:(T.a * x.x + T.c) / EMU, y:(T.b * x.y + T.d) / EMU, w:T.a * x.w / EMU, h:T.b * x.h / EMU } : null;
        if(tag === 'sp'){
          if(['sldNum','dt','ftr'].includes(phType)) continue;
          const tx = desc(el, 'txBody')[0]; if(!tx) continue;
          const paras = desc(tx, 'p').filter(p => p.namespaceURI?.includes('drawingml')).map(p => {
            let t = ''; for(const c of p.children){ if(c.localName === 'r' || c.localName === 'fld') t += desc(c, 't').map(e => e.textContent).join(''); else if(c.localName === 'br') t += ' '; }
            const ppr = kid(p, 'pPr'); const lvl = ppr ? +(ppr.getAttribute('lvl') || 0) : 0; const bu = ppr && kid(ppr, 'buChar') ? kid(ppr, 'buChar').getAttribute('char') : (ppr && kid(ppr, 'buAutoNum') ? '#' : '');
            const rpr = desc(p, 'rPr')[0]; const szv = rpr && rpr.getAttribute('sz') ? +rpr.getAttribute('sz') / 100 : null; const b = rpr && rpr.getAttribute('b') === '1';
            return { text:t.replace(/\s+/g, ' ').trim(), lvl, bu, sz:szv, b };
          }).filter(p => p.text);
          if(paras.length) shapes.push({ k:'text', box, ph:phType, paras });
        } else if(tag === 'graphicFrame'){
          const tbl = desc(el, 'tbl')[0]; if(!tbl) continue;
          const rows = kids(tbl, 'tr').map(tr => kids(tr, 'tc').map(tc => ({ text:desc(tc, 'p').map(p => desc(p, 't').map(e => e.textContent).join('')).filter(s => s.trim()).join(' ').replace(/\s+/g, ' ').trim(), hm:tc.getAttribute('hMerge') === '1', vm:tc.getAttribute('vMerge') === '1', span:+(tc.getAttribute('gridSpan') || 1) })));
          shapes.push({ k:'table', box, rows });
        } else if(tag === 'pic'){
          const blip = desc(el, 'blip')[0]; const rid = blip && (blip.getAttribute('r:embed') || [...blip.attributes].find(a => a.localName === 'embed')?.value);
          const rel = rid && rels[rid]; if(!rel) continue; const mp = resolve(path, rel.t); const mf = zip.file(mp); if(!mf) continue;
          const ext = (mp.match(/\.(\w+)$/)?.[1] || '').toLowerCase(); if(!['png','jpg','jpeg','gif','bmp','webp'].includes(ext)) continue;
          const blob = new Blob([await mf.async('uint8array')], { type:ext === 'jpg' ? 'image/jpeg' : 'image/' + ext });
          const nv = desc(el, 'cNvPr')[0];
          shapes.push({ k:'pic', box, blob, descr:nv?.getAttribute('descr') || '' });
        }
      }
    };
    const tree = desc(doc.documentElement, 'spTree')[0]; if(tree) await walk(tree, { a:1, b:1, c:0, d:0 });
    pages.push(slideToPage(i + 1, shapes, W, H));
  }
  return finishMs(file.name, 'pptx', { w:W, h:H }, pages);
}
function xfrmOf(el){ const sp = kid(el, 'spPr') || kid(el, 'xfrm') ? el : null; let xf = null;
  const spPr = kid(el, 'spPr'); if(spPr) xf = kid(spPr, 'xfrm'); if(!xf) xf = kid(el, 'xfrm'); if(!xf){ const g = kid(el, 'grpSpPr'); if(g) xf = kid(g, 'xfrm'); }
  if(!xf) return null; const o = kid(xf, 'off'), e = kid(xf, 'ext'); if(!o || !e) return null;
  return { x:+o.getAttribute('x'), y:+o.getAttribute('y'), w:+e.getAttribute('cx'), h:+e.getAttribute('cy') }; }
function slideToPage(n, shapes, W, H){
  let title = '';
  const tShape = shapes.find(s => s.k === 'text' && (s.ph === 'title' || s.ph === 'ctrTitle'));
  if(tShape){ title = tShape.paras.map(p => p.text).join(' '); shapes = shapes.filter(s => s !== tShape); }
  else { const top = shapes.filter(s => s.k === 'text' && s.box && s.box.y < H * .14 && s.paras.length <= 2).sort((a,b) => (b.paras[0].sz || 0) - (a.paras[0].sz || 0))[0];
    if(top && top.paras[0].text.length <= 60){ title = top.paras.map(p => p.text).join(' '); shapes = shapes.filter(s => s !== top); } }
  let src = null; const pics = []; const blocks = [];
  // 쪽 번호처럼 보이는 아래쪽 숫자 빼기
  shapes = shapes.filter(s => !(s.k === 'text' && s.box && s.box.y > H * .9 && s.paras.length === 1 && /^\s*[-–]?\s*\d{1,3}\s*[-–]?\s*$/.test(s.paras[0].text)));
  for(const s of shapes) if(s.k === 'text'){ s.paras = s.paras.filter(p => { if(/^\s*(자료|출처)\s*[:：]/.test(p.text)){ src = src ? src + ' ' + p.text : p.text; return false; } return true; }); }
  // 사진 캡션: 사진 바로 아래·오른쪽의 짧은 글이나 [사진] 표시
  for(const s of shapes.filter(s => s.k === 'pic')){
    const cap = shapes.find(t => t.k === 'text' && !t.used && t.paras.length <= 2 && t.paras.every(p => p.text.length <= 70) && t.box && s.box && (
      /^\s*[\[<(【]?\s*(사진|그림|Photo)\b/.test(t.paras[0].text) ||
      (t.box.y >= s.box.y + s.box.h - 4 && t.box.y - (s.box.y + s.box.h) < 30 && t.box.x < s.box.x + s.box.w && t.box.x + t.box.w > s.box.x) ||
      (t.box.x >= s.box.x + s.box.w - 4 && t.box.x - (s.box.x + s.box.w) < 30 && t.box.y < s.box.y + s.box.h && t.box.y + t.box.h > s.box.y)));
    if(cap){ cap.used = true; }
    pics.push({ blob:s.blob, url:URL.createObjectURL(s.blob), descr:s.descr, cap:cap ? cap.paras.map(p => p.text).join(' ') : '', box:s.box });
  }
  const order = shapes.filter(s => (s.k === 'text' && !s.used && s.paras.length) || s.k === 'table').sort((a, b) => ((a.box?.y ?? 0) - (b.box?.y ?? 0)) || ((a.box?.x ?? 0) - (b.box?.x ?? 0)));
  for(const s of order){
    if(s.k === 'table'){ const rows = s.rows.map(r => r.filter(c => !c.hm).map(c => c.vm ? '' : c.text)); if(rows.length && rows.some(r => r.some(Boolean))) blocks.push({ k:'table', rows }); continue; }
    for(const p of s.paras) blocks.push({ k:'p', text:p.text, lvl:p.lvl, bu:p.bu, sz:p.sz, b:p.b });
  }
  return { n, title, src, blocks, pics };
}
// 문단 → 소제목 묶음(□ 머리 + ○ 항목 + - 세부)
function structure(pg){
  const subs = []; let cur = null, lead = [], concs = [];
  const open = head => { cur = { head, items:[], tables:[] }; subs.push(cur); };
  const bl = pg.blocks;
  for(let i=0;i<bl.length;i++){
    const b = bl[i];
    if(b.k === 'table'){ if(!cur) open(null); cur.tables.push(b.rows); continue; }
    const t = b.text, nx = bl[i+1];
    // ⇒ 결론: 쪽 끝에 몰려 있는 ⇒ 줄(뒤에 ⇒·표만 남은 경우)을 모두 모음
    if(CONC_MK.test(t) && bl.slice(i + 1).every(x => x.k === 'table' || CONC_MK.test(x.text) || SUB_MK.test(x.text))){ concs.push(stripMk(t.replace(CONC_MK, ''))); continue; }
    if(concs.length && SUB_MK.test(t)){ concs[concs.length - 1] += ' — ' + stripMk(t); continue; }
    const mk = (b.bu && b.bu !== '#') ? b.bu : (t.match(/^\s*(\S)/) || [])[1];
    const isHead = HEAD_MK.test(t) || (b.bu && /[□■◆◇▣◈▶►]/.test(b.bu)) || (!ITEM_MK.test(t) && !SUB_MK.test(t) && !NOTE_MK.test(t) && b.lvl === 0 && t.length <= 44 && nx && nx.k === 'p' && (ITEM_MK.test(nx.text) || SUB_MK.test(nx.text) || nx.lvl > 0) && !/[.다]$/.test(t));
    if(isHead){ open(stripMk(t)); continue; }
    let lvl = ITEM_MK.test(t) || (b.bu && /[○●◦•▪]/.test(b.bu)) ? 1 : SUB_MK.test(t) || (b.bu && /[\-–·∙ㆍ]/.test(b.bu)) ? 2 : NOTE_MK.test(t) ? 3 : (b.lvl > 0 ? Math.min(2, b.lvl) : 1);
    const text = NOTE_MK.test(t) ? t.trim() : stripMk(t);
    if(!text) continue;
    // 헤드 메시지: 첫 소제목 앞의 기호 없는 문장(10자 이상)
    if(!cur && lvl === 1 && !ITEM_MK.test(t) && !SUB_MK.test(t) && !NOTE_MK.test(t) && !b.bu && t.length >= 10 && !subs.length && lead.length < 2){ lead.push(text); continue; }
    if(!cur) open(null);
    if(lvl === 2 && cur.items.length && !cur.items[cur.items.length-1].note){ (cur.items[cur.items.length-1].kids ||= []).push({ text, note:false }); }
    else cur.items.push({ text, kids:[], note:lvl === 3, num:b.bu === '#' });
    void mk;
  }
  return { lead, subs:subs.filter(s => s.head || s.items.length || s.tables.length), conc:concs[0] || null, concs };
}
const ROMAN = 'ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ';
function secKey(t){ return String(t || '').replace(/[(（]\s*(계속|續|cont\.?|\d+\s*\/\s*\d+)\s*[)）]/gi, '').replace(/\s*[-–]\s*\d+\s*$/, '').replace(/\s+/g, ' ').trim(); }
function chapterOf(t){ const m = String(t || '').match(/^\s*([ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+|[IVX]{1,4}(?=[\-.\s]))/); return m ? m[1] : null; }
function finishMs(name, kind, size, pages){
  const chapters = {}; const sections = [];
  for(const pg of pages){
    pg.st = structure(pg);
    const ch = chapterOf(pg.title); pg.chapter = ch;
    const nPara = pg.blocks.filter(b => b.k === 'p').length;
    pg.divider = !!(ch && /^\s*[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩIVX]+\s*[.\s]/.test(pg.title) && !/^\s*[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩIVX]+\s*[-–]\s*\d/.test(pg.title) && nPara <= 2 && !pg.pics.length && !pg.blocks.some(b => b.k === 'table'));
    if(pg.divider){ chapters[ch] = pg.title; continue; }
    const key = secKey(pg.title) || (sections.length ? sections[sections.length-1].key : '(제목 없음)');
    let s = sections[sections.length-1];
    if(!s || s.key !== key){ s = { id:'s' + (sections.length + 1), key, title:key, chapter:ch, pages:[] }; sections.push(s); }
    s.pages.push(pg.n); pg.sec = s.id;
  }
  for(const s of sections) s.chapterTitle = s.chapter ? (chapters[s.chapter] || '') : '';
  const text = pages.map(p => [p.title, ...p.blocks.map(b => b.k === 'p' ? b.text : b.rows.flat().join(' ')), ...p.pics.map(x => x.cap), p.src].filter(Boolean).join('\n')).join('\n');
  return { name, kind, size, pages, sections, chapters, text };
}
const msPage = n => D.ms?.pages.find(p => p.n === n);
const contentPages = () => (D.ms?.pages || []).filter(p => !p.divider);

// ───────────── 디자인 자료: 그리드·레퍼런스·폰트·아이콘 판별
const DEFAULT_GRID = () => ({ name:'A4 기본 그리드', src:'default', w:210*MM, h:297*MM, bleed:3*MM, ml:15*MM, mr:15*MM, mt:10*MM, bodyTop:30*MM, mb:15*MM });
async function parseGridPptx(file){
  const zip = await JSZip.loadAsync(file);
  const presX = await zip.file('ppt/presentation.xml').async('string'); const pres = parseXml(presX);
  const sz = desc(pres.documentElement, 'sldSz')[0]; const W = +sz.getAttribute('cx') / EMU, H = +sz.getAttribute('cy') / EMU;
  const gs = { v:[], h:[] };
  const take = doc => { for(const g of desc(doc.documentElement, 'guide')){ const pos = +(g.getAttribute('pos') || 0) / 8; (g.getAttribute('orient') === 'horz' ? gs.h : gs.v).push(pos); } };
  take(pres);
  for(const p of ['ppt/viewProps.xml', 'ppt/slideMasters/slideMaster1.xml']){ const f = zip.file(p); if(f) take(parseXml(await f.async('string'))); }
  gs.v = [...new Set(gs.v.map(r1))].sort((a,b) => a-b); gs.h = [...new Set(gs.h.map(r1))].sort((a,b) => a-b);
  const G = { name:file.name, src:'guides', w:W, h:H, bleed:3*MM, ml:15*MM, mr:15*MM, mt:10*MM, bodyTop:30*MM, mb:15*MM, guides:gs };
  const L = gs.v.filter(x => x < W/3), R = gs.v.filter(x => x > W*2/3), T = gs.h.filter(y => y < H/3), B = gs.h.filter(y => y > H*2/3);
  if(L.length) G.ml = L[0]; if(R.length) G.mr = W - R[R.length-1];
  if(T.length){ G.mt = T[0]; G.bodyTop = T.length > 1 ? T[1] : T[0] + 20*MM; }
  if(B.length) G.mb = H - B[B.length-1];
  if(!gs.v.length && !gs.h.length){
    G.src = 'layout';
    const lf = Object.keys(zip.files).filter(k => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(k)).sort((a,b) => (+a.match(/(\d+)\.xml/)[1]) - (+b.match(/(\d+)\.xml/)[1]));
    for(const k of lf){ const doc = parseXml(await zip.file(k).async('string')); let t = null, b = null;
      for(const sp of desc(doc.documentElement, 'sp')){ const ph = desc(sp, 'ph')[0]; if(!ph) continue; const x = xfrmOf(sp); if(!x) continue; const ty = ph.getAttribute('type') || 'body'; if(ty === 'title' && !t) t = x; if((ty === 'body' || ty === 'obj') && !b) b = x; }
      if(t && b){ G.ml = b.x / EMU; G.mr = W - (b.x + b.w) / EMU; G.mt = t.y / EMU; G.bodyTop = b.y / EMU; G.mb = H - (b.y + b.h) / EMU; break; } }
  }
  return G;
}
function gridOK(G){ return G && G.w > 100 && G.h > 100 && G.ml >= 0 && G.mr >= 0 && G.ml + G.mr < G.w - 100 && G.bodyTop > G.mt && G.h - G.mb - G.bodyTop > 200; }
async function paletteOf(blobOrCanvas){
  let c;
  if(blobOrCanvas instanceof HTMLCanvasElement) c = blobOrCanvas;
  else { const bmp = await createImageBitmap(blobOrCanvas); c = document.createElement('canvas'); c.width = 72; c.height = Math.max(1, Math.round(72 * bmp.height / bmp.width)); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); bmp.close?.(); }
  const small = document.createElement('canvas'); small.width = 72; small.height = Math.max(1, Math.round(72 * c.height / c.width)); small.getContext('2d', { willReadFrequently:true }).drawImage(c, 0, 0, small.width, small.height);
  const d = small.getContext('2d', { willReadFrequently:true }).getImageData(0, 0, small.width, small.height).data; const cnt = new Map();
  for(let i=0;i<d.length;i+=4){ const [r,g,b] = [d[i], d[i+1], d[i+2]]; const [, s, l] = rgb2hsl(r, g, b); if(l > .9 || l < .12 || s < .18) continue; const k = (r >> 4) << 8 | (g >> 4) << 4 | (b >> 4); cnt.set(k, (cnt.get(k) || 0) + 1); }
  const out = [];
  for(const [k] of [...cnt.entries()].sort((a,b) => b[1]-a[1])){ const hex = rgb2hex(((k >> 8) & 15) * 17, ((k >> 4) & 15) * 17, (k & 15) * 17); if(out.every(o => colorDist(o, hex) > 60)) out.push(hex); if(out.length >= 6) break; }
  return out;
}
async function classifyAssets(files){
  const notes = [];
  for(const f of files){
    const ext = extOf(f);
    try{
      if(['ttf','otf','ttc'].includes(ext)){ await addFontFile(f); }
      else if(['woff','woff2'].includes(ext)) notes.push(`「${f.name}」: WOFF 폰트는 읽을 수 없습니다. TTF·OTF로 올려 주세요.`);
      else if(ext === 'pptx'){ const g = await parseGridPptx(f); if(gridOK(g)){ D.assets.grids = [g]; D.grid = { ...g }; } else notes.push(`「${f.name}」에서 쪽 크기와 여백을 읽지 못해 기본 그리드를 씁니다.`); }
      else if(ext === 'json'){ const j = JSON.parse(await f.text()); if(j && j.page && j.color){ D.assets.tokens = j; notes.push(`디자인 시스템 「${j.name || f.name}」을 불러왔습니다.`); } else notes.push(`「${f.name}」은 Dana 디자인 시스템(tokens.json)이 아닙니다.`); }
      else if(['png','jpg','jpeg','webp','svg'].includes(ext)){
        const topic = Object.keys(ICON_TOPICS).find(t => f.name.includes(t));
        if(topic && (ext === 'svg' || ext === 'png')){ const url = await blobToDataURL(f); D.assets.icons.push({ topic, name:f.name, url }); D.iconMap[topic] = 'file:' + f.name; continue; }
        const url = URL.createObjectURL(f); const pal = ext === 'svg' ? [] : await paletteOf(f).catch(() => []);
        D.assets.refs.push({ name:f.name, kind:'image', url, palette:pal });
      }
      else if(ext === 'pdf'){
        // 여러 쪽 PDF(지난 제안서 등): 표지·간지·목차(앞 3쪽)를 건너뛰고 본문에서 고르게 최대 6쪽을 읽어 색을 뽑음
        const pdf = await openPdf(f); const N = pdf.numPages; const from = N >= 6 ? 4 : 1; const k = Math.min(6, N - from + 1);
        const pick = [...new Set(Array.from({ length:k }, (_, i) => from + Math.round(i * (N - from) / Math.max(1, k - 1))))];
        const thumbs = [];
        for(const [i, n] of pick.entries()){ if(pick.length > 1) busy(`「${f.name}」 ${N}쪽 중 ${n}쪽을 보는 중…`, .2 + .7 * i / pick.length);
          const pg = await pdf.getPage(n); const vp = pg.getViewport({ scale:1 }); const v = pg.getViewport({ scale:300 / Math.max(vp.width, vp.height) });
          const c = document.createElement('canvas'); c.width = Math.round(v.width); c.height = Math.round(v.height); const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
          await pg.render({ canvasContext:ctx, viewport:v }).promise; pg.cleanup(); thumbs.push(c); }
        const all = document.createElement('canvas'); all.width = thumbs[0].width; all.height = thumbs.reduce((a, c) => a + c.height, 0); let yy = 0; for(const c of thumbs){ all.getContext('2d').drawImage(c, 0, yy); yy += c.height; }
        D.assets.refs.push({ name:f.name, kind:'pdf', pages:N, read:pick, url:thumbs[0].toDataURL('image/jpeg', .85), palette:await paletteOf(all) });
        if(N > 1) notes.push(`「${f.name}」 ${N}쪽 중 본문 ${pick.length}쪽(${pick.join('·')}쪽)에서 색을 뽑았습니다. 레퍼런스는 색 후보로만 쓰고 모양은 따라 하지 않습니다.`);
      }
      else notes.push(`「${f.name}」은 디자인 자료로 쓸 수 없는 형식입니다.`);
    }catch(e){ console.error(e); notes.push(e?.user || `「${f.name}」을 읽지 못했습니다.`); }
  }
  return notes;
}

// ───────────── 분석: 배점 ↔ 원고 절
function bigrams(s){ const t = String(s).replace(/^[\sⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩIVX\d.\-–]+/, '').replace(/[^가-힣A-Za-z0-9]/g, ''); const o = new Set(); for(let i=0;i<t.length-1;i++) o.add(t.slice(i, i+2)); if(t.length === 1) o.add(t); return o; }
function simText(a, b){ const A = bigrams(a), B = bigrams(b); if(!A.size || !B.size) return 0; let i = 0; A.forEach(x => { if(B.has(x)) i++; }); return .7 * i / Math.min(A.size, B.size) + .3 * i / (A.size + B.size - i); }
function autoMap(){
  const map = {}; const items = D.rfp?.items || []; for(const it of items) map[it.id] = [];
  if(!items.length) return map;
  for(const s of D.ms.sections){
    let best = null, bv = 0;
    for(const it of items){ const v = Math.max(simText(s.title, it.name), simText(s.title, (it.area || '') + it.name) * .9, it.detail ? simText(s.title, it.detail) * .55 : 0); if(v > bv){ bv = v; best = it; } }
    if(best && bv >= .34) map[best.id].push(s.id);
  }
  return map;
}
const MAP_PROMPT = `제안서 평가 항목과 원고의 절 목록입니다. 각 평가 항목을 다루는 절을 고르세요. 한 절은 한 항목에만 넣고, 맞는 절이 없으면 빈 배열로 둡니다. JSON 하나로만 답하세요: {"map":[{"item":"항목 id","sections":["절 id", ...]}]}\n\n`;
async function claudeMap(){
  const items = D.rfp.items.map(i => `${i.id}: ${i.area ? i.area + ' > ' : ''}${i.name} (${derived() ? '중요도 ' + tierOf(i.w) : i.score + '점'})${i.detail ? ' — ' + i.detail.slice(0, 120) : ''}`).join('\n');
  const secs = D.ms.sections.map(s => { const p = msPage(s.pages[0]); const first = p ? p.st.subs.map(x => x.head).filter(Boolean).slice(0, 4).join(' / ') : ''; return `${s.id}: ${s.title} — ${first}`; }).join('\n');
  const raw = await askJson(MAP_PROMPT + '[평가 항목]\n' + items + '\n\n[원고 절]\n' + secs);
  const map = {}; for(const it of D.rfp.items) map[it.id] = []; const used = new Set();
  for(const r of (raw?.map || [])){ if(!map[r.item]) continue; for(const s of (r.sections || [])){ if(D.ms.sections.some(x => x.id === s) && !used.has(s)){ map[r.item].push(s); used.add(s); } } }
  const auto = autoMap(); for(const id in map) if(!map[id].length) for(const s of auto[id] || []) if(!used.has(s)){ map[id].push(s); used.add(s); }
  return map;
}
function analysis(){
  const secs = D.ms.sections.map(s => ({ ...s, score:0, items:[] }));
  const items = D.rfp?.items || []; const map = D.mapping || {};
  for(const it of items){ const ss = (map[it.id] || []).map(id => secs.find(s => s.id === id)).filter(Boolean); const pages = ss.reduce((a, s) => a + s.pages.length, 0);
    for(const s of ss){ const share = pages ? it.score * s.pages.length / pages : 0; s.score += share; s.items.push(it.id); } }
  const T = items.reduce((a, i) => a + i.score, 0), P = secs.reduce((a, s) => a + s.pages.length, 0);
  for(const s of secs){ s.density = s.pages.length ? s.score / s.pages.length : 0;
    if(!items.length){ s.status = 'ok'; s.expected = s.pages.length; continue; }
    s.expected = T ? P * s.score / T : 0; const ratio = s.expected ? s.pages.length / s.expected : Infinity;
    s.status = !s.score ? 'zero' : (ratio > 1.6 && s.pages.length - s.expected >= 1) ? 'over' : (ratio < .6 && s.expected - s.pages.length >= .75) ? 'lack' : 'ok'; }
  const unmapped = items.filter(i => !(map[i.id] || []).length);
  return { secs, T, P, unmapped };
}
const pageDensity = n => { const p = msPage(n); if(!p || !D.ms) return 0; const A = D._an || analysis(); const s = A.secs.find(x => x.id === p.sec); return s ? s.density : 0; };
