'use strict';
// ═════════════════════════════ HWP(한글 5.0 바이너리) 읽기
// 복합 문서(CFB) → FileHeader로 압축·암호 확인 → BodyText/SectionN 풀기 → 레코드에서 문단 글자·표 꺼내기
// 반환: { pages:[{ n, lines, paras }], tables:[{ page, rows }] }
//  - lines: 문단 + 표는 행마다 「칸 | 칸」 한 줄 (과업지시서 읽기용, DOCX·HWPX와 같은 모양)
//  - paras: 문단 + 표는 칸마다 한 문단 (원고·원문 대조용)
const HWPTAG = { PARA_HEADER:66, PARA_TEXT:67, CTRL_HEADER:71, LIST_HEADER:72, TABLE:77 };
// 압축 풀기: SheetJS의 deflate 풀기를 먼저(끝에 남는 바이트를 견딤), 안 되면 브라우저 기본 DecompressionStream
async function hwpInflate(u8){
  const X = (typeof XLSX !== 'undefined' ? XLSX : null)?.CFB?.utils;
  if(X?._inflateRaw){ try{ const r = X._inflateRaw(u8); if(r && r.length) return r instanceof Uint8Array ? r : new Uint8Array(r); }catch(e){ /* 아래로 */ } }
  if(typeof DecompressionStream === 'function'){
    // 브라우저는 압축 끝 뒤에 남은 바이트가 있으면 오류를 내므로, 그때까지 읽은 것만 씀
    const parts = []; const rd = new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
    try{ for(;;){ const { done, value } = await rd.read(); if(done) break; parts.push(value); } }catch(e){ if(!parts.length) throw { user:'HWP 본문 압축을 풀지 못했습니다. 한글에서 HWPX 또는 PDF로 저장한 뒤 올려 주세요.' }; }
    const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0)); let o = 0; for(const p of parts){ out.set(p, o); o += p.length; } return out;
  }
  throw { user:'이 브라우저에서는 HWP 압축을 풀 수 없습니다. 한글에서 HWPX 또는 PDF로 저장한 뒤 올려 주세요.' };
}
function hwpRecords(u8){
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength); const out = []; let o = 0;
  while(o + 4 <= u8.length){ const h = dv.getUint32(o, true); o += 4; const tag = h & 0x3FF, level = (h >>> 10) & 0x3FF; let size = h >>> 20;
    if(size === 0xFFF){ if(o + 4 > u8.length) break; size = dv.getUint32(o, true); o += 4; }
    if(o + size > u8.length) break; out.push({ tag, level, data:u8.subarray(o, o + size) }); o += size; }
  return out;
}
// 문단 글자: UTF-16LE, 제어 문자는 1칸 또는 8칸(확장·인라인)
function hwpParaText(d){
  let s = ''; const n = d.length >> 1;
  for(let i = 0; i < n; i++){ const c = d[2 * i] | (d[2 * i + 1] << 8);
    if(c >= 32){ s += String.fromCharCode(c); continue; }
    if(c === 9){ s += '\t'; i += 7; continue; }
    if(c === 10){ s += '\n'; continue; }
    if(c === 13) continue;
    if([1,2,3,4,5,6,7,8,11,12,14,15,16,17,18,19,20,21,22,23].includes(c)){ i += 7; continue; }
    if(c === 30 || c === 31) s += ' '; // 묶음 빈칸·고정폭 빈칸
  }
  return s;
}
// 배포용 문서: ViewText 첫 레코드(256바이트)에서 열쇠를 꺼내 AES-128 ECB로 푼다.
// WebCrypto에는 ECB가 없어 CBC로 대신: IV 0으로 풀고 앞 암호 블록을 XOR, 끝에 맞춤 패딩 블록을 붙여 패딩 검사를 통과시킴
async function aesEcbDecrypt(key16, data){
  const n = data.length - (data.length % 16); if(!n) return new Uint8Array(0); const C = data.subarray(0, n);
  const k = await crypto.subtle.importKey('raw', key16, 'AES-CBC', false, ['encrypt', 'decrypt']);
  const pad = new Uint8Array(await crypto.subtle.encrypt({ name:'AES-CBC', iv:C.slice(n - 16, n) }, k, new Uint8Array(0))).subarray(0, 16);
  const buf = new Uint8Array(n + 16); buf.set(C); buf.set(pad, n);
  const P = new Uint8Array(await crypto.subtle.decrypt({ name:'AES-CBC', iv:new Uint8Array(16) }, k, buf));
  for(let i = 16; i < n; i++) P[i] ^= C[i - 16];
  return P.subarray(0, n);
}
async function hwpViewText(u8){
  const R = hwpRecords(u8.subarray(0, 4 + 256)); const rec = R[0];
  if(!rec || rec.tag !== 28 || rec.data.length !== 256) throw { user:'배포용 문서의 열쇠를 찾지 못했습니다. 한글에서 PDF로 저장한 뒤 올려 주세요.' };
  const d = rec.data; let st = (d[0] | (d[1] << 8) | (d[2] << 16) | (d[3] << 24)) >>> 0; const seed = st;
  const rand = () => { st = (Math.imul(st, 214013) + 2531011) >>> 0; return (st >>> 16) & 0x7FFF; };
  const rnd = new Uint8Array(256); for(let i = 0; i < 256;){ const fill = rand() & 0xFF, times = (rand() & 0x0F) + 1; for(let t = 0; t < times && i < 256; t++) rnd[i++] = fill; }
  const out = new Uint8Array(256); for(let i = 0; i < 256; i++) out[i] = d[i] ^ rnd[i];
  const off = (seed & 0xF) + 4; const key = out.slice(off, off + 16);
  return aesEcbDecrypt(key, u8.subarray(4 + 256));
}
const hwpCtrlId = d => d.length >= 4 ? String.fromCharCode(d[3], d[2], d[1], d[0]) : '';
async function readHwpBin(file){
  if(typeof XLSX === 'undefined' || !XLSX.CFB) throw { user:'HWP를 읽는 도구를 불러오지 못했습니다. 새로고침한 뒤 다시 올려 주세요.' };
  const u8 = new Uint8Array(await file.arrayBuffer());
  if(!(u8[0] === 0xD0 && u8[1] === 0xCF && u8[2] === 0x11 && u8[3] === 0xE0)){
    if(u8[0] === 0x50 && u8[1] === 0x4B) throw { user:`「${file.name}」은 이름은 HWP지만 실제로는 HWPX입니다. 확장자를 .hwpx로 바꿔 올려 주세요.` };
    throw { user:`「${file.name}」은 한글 2002 이전 형식이거나 HWP가 아닙니다. 한글에서 HWPX 또는 PDF로 저장한 뒤 올려 주세요.` };
  }
  const cfb = XLSX.CFB.read(u8, { type:'buffer' });
  const get = p => { const e = XLSX.CFB.find(cfb, p); return e?.content ? new Uint8Array(e.content) : null; };
  const fh = get('/FileHeader'); if(!fh) throw { user:`「${file.name}」에서 한글 문서 정보를 찾지 못했습니다.` };
  const sig = String.fromCharCode(...fh.subarray(0, 17)); if(!/HWP Document File/.test(sig)) throw { user:`「${file.name}」은 HWP 5.0 문서가 아닙니다. 한글에서 HWPX 또는 PDF로 저장한 뒤 올려 주세요.` };
  const prop = fh[36] | (fh[37] << 8) | (fh[38] << 16) | (fh[39] << 24);
  if(prop & 2) throw { user:`「${file.name}」은 암호가 걸린 문서입니다. 한글에서 암호를 푼 뒤 다시 올려 주세요.` };
  const dist = !!(prop & 4);   // 배포용 문서: 본문이 ViewText에 잠겨 있음
  const compressed = !!(prop & 1);
  const SEC = dist ? 'ViewText' : 'BodyText';
  const secs = cfb.FullPaths.map(p => p.match(dist ? /\/ViewText\/Section(\d+)$/i : /\/BodyText\/Section(\d+)$/i)).filter(Boolean).map(m => +m[1]).sort((a, b) => a - b);
  if(!secs.length) throw { user:`「${file.name}」에서 본문을 찾지 못했습니다.` };
  let page = 1; const pages = [{ n:1, lines:[], paras:[] }], tables = []; const cur = () => pages[pages.length - 1];
  const newPage = () => { if(cur().lines.length || cur().paras.length){ page++; pages.push({ n:page, lines:[], paras:[] }); } };
  const pushText = t => { for(const part of t.split('\n')){ const x = part.replace(/\t+/g, ' ').replace(/\s+/g, ' ').trim(); if(x){ cur().lines.push(x); cur().paras.push(x); } } };
  for(const sn of secs){
    let raw = get(`/${SEC}/Section${sn}`); if(!raw) continue;
    if(dist) raw = await hwpViewText(raw);
    if(compressed) raw = await hwpInflate(raw);
    const R = hwpRecords(raw);
    if(sn !== secs[0]) newPage();
    let lastVp = null;
    for(let i = 0; i < R.length; i++){ const r = R[i];
      // 쪽 나누기: 명시적 쪽·구역 나누기, 또는 줄 위치(LINE_SEG 세로 위치)가 위로 되돌아가면 새 쪽
      if(r.tag === HWPTAG.PARA_HEADER && r.level === 0){ if(r.data.length >= 12 && (r.data[11] & 0x05)) newPage();
        for(let j = i + 1; j < R.length && R[j].level > 0; j++){ const q = R[j]; if(q.tag !== 69 || q.level !== 1 || q.data.length < 36) continue;
          const dv = new DataView(q.data.buffer, q.data.byteOffset, q.data.byteLength); const first = dv.getInt32(4, true), last = dv.getInt32(4 + 36 * (Math.floor(q.data.length / 36) - 1), true);
          if(lastVp !== null && first < lastVp - 200) newPage(); lastVp = last; break; }
        continue; }
      if(r.tag === HWPTAG.CTRL_HEADER){ const id = hwpCtrlId(r.data); let end = i + 1; while(end < R.length && R[end].level > r.level) end++;
        if(id === 'head' || id === 'foot' || id === 'fn  ' || id === 'en  ' || id === 'atno' || id === 'pgnp'){ i = end - 1; continue; }   // 머리말·꼬리말·각주는 건너뜀
        if(id === 'tbl '){ const cells = []; let c = null;
          for(let j = i + 1; j < end; j++){ const q = R[j];
            if(q.tag === HWPTAG.LIST_HEADER && q.level === r.level + 1){ const dv = new DataView(q.data.buffer, q.data.byteOffset, q.data.byteLength);
              c = { col:q.data.length >= 10 ? dv.getUint16(8, true) : cells.length, row:q.data.length >= 12 ? dv.getUint16(10, true) : 0, t:[] }; cells.push(c); }
            else if(q.tag === HWPTAG.PARA_TEXT && c){ const t = hwpParaText(q.data).replace(/\s+/g, ' ').trim(); if(t) c.t.push(t); } }
          const rows = []; for(const x of cells){ (rows[x.row] ||= [])[x.col] = x.t.join(' '); }
          const rr = rows.filter(Boolean).map(r0 => Array.from(r0, v => v || ''));
          if(rr.length){ tables.push({ page, rows:rr }); for(const row of rr){ const t = row.filter(Boolean).join(' | '); if(t) cur().lines.push(t); } for(const x of cells) for(const t of x.t) cur().paras.push(t); }
          i = end - 1; continue; }
        continue; }   // 글상자·그림 속 글자는 아래 PARA_TEXT로 그대로 읽힘
      if(r.tag === HWPTAG.PARA_TEXT) pushText(hwpParaText(r.data));
    }
  }
  const out = pages.filter(p => p.lines.length || p.paras.length);
  if(!out.length) throw { user:`「${file.name}」에서 글자를 찾지 못했습니다.` };
  return { pages:out, tables };
}
if(typeof window !== 'undefined') window.readHwpBin = readHwpBin;
if(typeof module !== 'undefined') module.exports = { readHwpBin };
