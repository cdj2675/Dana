'use strict';
// ═════════════════════════════ 학습(먹이 주기) — 성장 1단계
// 팀원이 완성 제안서 PDF를 먹이로 주면 숫자로 된 영양분만 공용 저장소에 쌓고 경험치를 올립니다.
// - 원본·파일 이름·문장·색 값은 저장하지 않음(파일 지문만)
// - 소화는 먹이를 준 사람의 브라우저에서(픽셀 + PDF 글자 크기). Claude 호출 없음
// - 공용 저장소: grow_feeds/<지문>(먹이 한 건씩), grow_meta/state(레벨·넘친 경험치·레벨 기록)
// - 레벨업 검토·확정은 2단계. 지금은 경험치와 레벨업 대기까지만
const GROW_NEED = [100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700, 3250];
const growNeed = lv => GROW_NEED[lv - 1] ?? (GROW_NEED[GROW_NEED.length - 1] + 600 * (lv - GROW_NEED.length));
const GROW_HUNGRY_MS = 7 * 24 * 3600 * 1000;
const GROW_RESULT = { unknown:'모름', win:'수주', lose:'탈락' };
const GROW_KIND = { proposal:'제안서', plan:'수행계획서', report:'보고서', etc:'기타' };
const GROW_FIELDS = ['환경·청소', 'IT', '교육', '건설', '복지', '문화·관광', '행정', '연구'];

// ───────────── 고양이(픽셀). 모든 레벨에서 같은 모습, 상태에 따라 눈과 소품만 바뀜
const CAT = [
  '....................',
  '...........K....K...',
  '..........KKK..KKK..',
  '.........KKWK.KKWK..',
  '.........KKKKKKKKKK.',
  '......KKKKKKKKKKKKK.',
  '....KKKKKKKKKKKKKKKK',
  '...KKKKKKKKKKWKKKWKK',
  '..KK.KKKKKKKKWKKKWKK',
  '.KK..KKKKKKKKKKKKKKK',
  '.....KKKKKKKKKKKKKK.',
];
// 흰 몸 + 진한 테두리(밝은 화면·어두운 화면 모두에서 보이도록), 눈은 진하게
const CAT_INK = '#26292D';
function catPixels(state){
  const g = CAT.map(r => r.split(''));
  const eyes = new Set(['13,7', '13,8', '17,7', '17,8']);
  const H = g.length, Wd = g[0].length, on = (x, y) => y >= 0 && y < H && x >= 0 && x < Wd && g[y][x] !== '.';
  const px = [];
  const put = (x, y, c) => px.push([x + 1, y + 1, c]);
  // 테두리: 몸 바로 바깥(상하좌우) 칸
  for(let y = -1; y <= H; y++) for(let x = -1; x <= Wd; x++){
    if(on(x, y)) continue;
    if(on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) put(x, y, CAT_INK);
  }
  g.forEach((r, y) => r.forEach((ch, x) => {
    if(ch === '.') return;
    const k = x + ',' + y;
    if(eyes.has(k)) put(x, y, state === 'hungry' ? '#FFFFFF' : CAT_INK);
    else if(ch === 'W') put(x, y, '#C9CED3'); // 귀 안쪽
    else put(x, y, '#FFFFFF');
  }));
  if(state === 'hungry') for(const x of [12, 13, 14, 16, 17, 18]) put(x, 8, CAT_INK); // 가로로 긴 눈
  // 소품은 테두리만큼 오른쪽으로 비켜 둠
  const add = (pts, c) => pts.forEach(([x, y]) => px.push([x + 2, y + 1, c]));
  const bowl = () => { add([21, 22, 23, 24, 25, 26].map(x => [x, 9]), '#9AA5AE'); add([22, 23, 24, 25].map(x => [x, 10]), '#9AA5AE'); };
  if(state === 'hungry'){ add([[21, 1], [21, 2], [20, 2], [21, 3], [20, 3]], '#7FB8E8'); bowl(); }
  if(state === 'eating'){ bowl(); for(let x = 21; x <= 26; x++) add([[x, 8]], x % 2 ? '#C08040' : '#8E5A2A'); for(let x = 22; x <= 25; x++) add([[x, 7]], x % 2 ? '#8E5A2A' : '#C08040'); add([[23, 6]], '#C08040'); add([[24, 6]], '#8E5A2A'); }
  if(state === 'full') for(const [cx, cy] of [[4, 2], [22, 1], [24, 7]]) add([[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [cx + dx, cy + dy]), '#F2C14E');
  return px;
}
function catSvg(state, s){
  const W = 30, H = 12;
  return `<svg class="pxcat ${state}" viewBox="0 1 ${W} ${H}" width="${W * s}" height="${H * s}" shape-rendering="crispEdges" aria-hidden="true">${catPixels(state).map(([x, y, c]) => `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${c}"/>`).join('')}</svg>`;
}

// ───────────── 소화: 한 문서에서 영양분 재기
const med = a => { if(!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const pct = (a, p) => { if(!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))]; };
const r3 = v => v == null ? null : Math.round(v * 1000) / 1000;
async function growPageInk(pg){
  const vp = pg.getViewport({ scale:1 }); const v = pg.getViewport({ scale:240 / Math.max(vp.width, vp.height) });
  const c = document.createElement('canvas'); c.width = Math.round(v.width); c.height = Math.round(v.height);
  const ctx = c.getContext('2d', { willReadFrequently:true }); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  await pg.render({ canvasContext:ctx, viewport:v }).promise;
  const w = c.width, h = c.height, d = ctx.getImageData(0, 0, w, h).data;
  const y0 = Math.floor(h * .12), y1 = Math.floor(h * .93), x0 = Math.floor(w * .06), x1 = Math.floor(w * .94), rw = x1 - x0;
  let ink = 0, col = 0, n = 0; const rows = [];
  for(let y = y0; y < y1; y++){ let ri = 0;
    for(let x = x0; x < x1; x++){ const i = (y * w + x) * 4; const [, sat, l] = rgb2hsl(d[i], d[i + 1], d[i + 2]); n++; if(l < .93){ ink++; ri++; } if(sat > .2 && l > .15 && l < .93) col++; }
    rows.push(ri / rw); }
  // 본문 채움: 본문 영역 위에서부터 마지막으로 무언가 있는 줄까지
  let last = -1; rows.forEach((v, i) => { if(v > .02) last = i; });
  const third = Math.ceil(rows.length / 3), th = [0, 0, 0]; rows.forEach((v, i) => { th[Math.min(2, Math.floor(i / third))] += v; });
  const ts = th[0] + th[1] + th[2];
  return { ink:ink / n, color:col / n, fill:(last + 1) / rows.length, thirds:ts ? th.map(t => t / ts) : [1 / 3, 1 / 3, 1 / 3] };
}
async function growPageText(pg){
  const tc = await pg.getTextContent(); const sizes = new Map(); let chars = 0;
  for(const it of tc.items){ const s = String(it.str || '').replace(/\s/g, ''); if(!s || !it.transform) continue;
    const fh = Math.hypot(it.transform[2], it.transform[3]); if(!(fh >= 4 && fh <= 80)) continue;
    const k = Math.round(fh * 2) / 2; sizes.set(k, (sizes.get(k) || 0) + s.length); chars += s.length; }
  return { chars, sizes };
}
async function growDigest(file, onStep){
  const fp = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
  const pdf = await openPdf(file); const N = pdf.numPages;
  // 표지·목차·간지(앞 3쪽)와 뒤표지를 뺀 본문. 너무 길면 고르게 80쪽까지
  const from = N >= 6 ? 4 : 1, to = N >= 10 ? N - 1 : N;
  let pick = []; for(let i = from; i <= to; i++) pick.push(i);
  if(pick.length > 80){ const k = 80; pick = [...new Set(Array.from({ length:k }, (_, i) => from + Math.round(i * (to - from) / (k - 1))))]; }
  const P = []; const sizes = new Map(); let divider = 0;
  for(const [i, n] of pick.entries()){
    onStep?.(i / pick.length, `${N}쪽 중 ${n}쪽`);
    const pg = await pdf.getPage(n);
    const [px, tx] = await Promise.all([growPageInk(pg), growPageText(pg)]); pg.cleanup();
    if(tx.chars < 40 && px.ink < .08){ divider++; continue; } // 간지·빈 쪽은 본문에서 뺌
    P.push({ ...px, chars:tx.chars }); for(const [k, v] of tx.sizes) sizes.set(k, (sizes.get(k) || 0) + v);
  }
  try{ pdf.destroy(); }catch(e){}
  const bodyPages = Math.round(P.length * (to - from + 1) / Math.max(1, pick.length)); // 80쪽 넘게 고른 경우 비례로
  const charsMed = med(P.map(p => p.chars)) || 0, textless = charsMed < 30;
  let type = null;
  if(!textless && sizes.size){
    const tot = [...sizes.values()].reduce((a, b) => a + b, 0);
    const body = [...sizes.entries()].filter(([k]) => k >= 7).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    if(body){
      const steps = [...sizes.entries()].filter(([k, v]) => k >= body - .5 && v / tot >= .015).length;
      const sorted = [...sizes.entries()].sort((a, b) => a[0] - b[0]); let acc = 0, big = body;
      for(const [k, v] of sorted){ acc += v; if(acc / tot >= .97){ big = k; break; } }
      type = { body, big, ratio:r3(big / body), steps };
    }
  }
  const nut = P.length ? {
    ink:r3(med(P.map(p => p.ink))), color:r3(med(P.map(p => p.color))),
    fill:r3(med(P.map(p => p.fill))), fillP10:r3(pct(P.map(p => p.fill), .1)),
    thirds:[0, 1, 2].map(j => r3(P.reduce((a, p) => a + p.thirds[j], 0) / P.length)),
    chars:Math.round(charsMed), type,
  } : null;
  return { fp, pages:N, bodyPages, measured:P.length, divider, textless, nut };
}

// ───────────── 경험치·확인 필요
function growXp(dg, meta, feeds){
  const base = Math.min(60, dg.bodyPages);
  const hi = meta.score != null && meta.max > 0 && meta.score / meta.max >= .9;
  let m = 1;
  if(meta.result === 'win' || hi) m = Math.max(meta.result === 'win' ? 2 : 1, hi ? 1.5 : 1);
  else if(meta.result === 'lose') m = .5;
  if(meta.kind !== 'proposal') m *= .5;
  const newField = !!meta.field && !feeds.some(f => f.meta?.field === meta.field);
  if(newField) m *= 1.2;
  const why = [];
  if(meta.result === 'win') why.push('수주 ×2'); else if(hi) why.push('고득점 ×1.5'); else if(meta.result === 'lose') why.push('탈락 ×0.5');
  if(meta.kind !== 'proposal') why.push(`${GROW_KIND[meta.kind] || '기타'} ×0.5`);
  if(newField) why.push('새 분야 +20%');
  return { xp:Math.round(base * m), mult:Math.round(m * 100) / 100, newField, hi, why };
}
const GROW_BASE = { ink:[.10, .50], color:[0, .30], fill:[.45, 1.01], body:[8.5, 14] };
const GROW_LABEL = { ink:'본문 밀도', color:'색 면적', fill:'본문 채움', body:'본문 글자 크기' };
function growVals(nut){ return nut ? { ink:nut.ink, color:nut.color, fill:nut.fill, body:nut.type?.body ?? null } : {}; }
function growCheck(dg, feeds){
  const why = [];
  if(dg.bodyPages < 10) why.push('본문 10쪽 미만');
  if(dg.textless) why.push('글자를 읽을 수 없음(스캔본)');
  if(!dg.nut) return why.length ? why : ['본문을 찾지 못함'];
  const v = growVals(dg.nut); const ref = feeds.filter(f => f.nut && !f.gray);
  const far = [];
  for(const k of Object.keys(GROW_BASE)){
    if(v[k] == null) continue;
    let lo, hi;
    if(ref.length >= 5){ const a = ref.map(f => growVals(f.nut)[k]).filter(x => x != null); if(a.length < 5) continue; const p10 = pct(a, .1), p90 = pct(a, .9), r = Math.max(p90 - p10, k === 'body' ? 1 : .03); lo = p10 - r; hi = p90 + r; }
    else [lo, hi] = GROW_BASE[k];
    if(v[k] < lo || v[k] > hi) far.push(GROW_LABEL[k]);
  }
  if(far.length) why.push(`다른 먹이와 동떨어진 수치(${far.join('·')})`);
  return why;
}

// ───────────── 상태
const Grow = {
  db:null, uid:null, canWrite:null, feeds:[], state:{ level:1, carry:0 }, inited:false, loaded:false,
  staged:[], log:[], busy:false, prog:null, meta:{ result:'unknown', score:'', max:'', field:'', kind:'proposal' }, unsubs:[],
  async init(){
    if(this.inited) return; this.inited = true;
    this.db = S.db || null; this.uid = S.uid || null;
    try{ const c = S.user?.can?.('data.write'); this.canWrite = c instanceof Promise ? await c : c; }catch(e){ this.canWrite = null; }
    if(this.db){
      try{
        this.unsubs.push(this.db.collection('grow_feeds').onSnapshot(snap => { this.feeds = snap.docs.map(d => ({ id:d.id, ...d.data() })); this.loaded = true; this.render(); }, () => {}));
        this.unsubs.push(this.db.doc('grow_meta/state').onSnapshot(snap => { const v = snap.exists ? snap.data() : null; this.state = { level:1, carry:0, ...(v || {}) }; this.render(); }, () => {}));
      }catch(e){ console.warn('grow subscribe', e); }
      setTimeout(() => { if(!this.loaded){ this.loaded = true; this.render(); } }, 10000);
    } else this.loaded = true;
    this.render();
  },
  async reload(){
    if(!this.db) return;
    try{ const s = await this.db.collection('grow_feeds').get(); this.feeds = s.docs.map(d => ({ id:d.id, ...d.data() })); }catch(e){}
    this.render();
  },
  pending(){ return this.feeds.filter(f => f.status === 'pending'); },
  sum(){
    const pend = this.pending(), ok = pend.filter(f => !f.gray), gray = pend.filter(f => f.gray);
    const lv = this.state.level || 1, need = growNeed(lv);
    const xp = (this.state.carry || 0) + ok.reduce((a, f) => a + (f.xp || 0), 0), gxp = gray.reduce((a, f) => a + (f.xp || 0), 0);
    const by = new Set(ok.map(f => f.by).filter(Boolean));
    const ready = xp >= need && ok.length >= 3 && by.size >= 2;
    const last = Math.max(0, ...this.feeds.map(f => f.at || 0));
    return { lv, need, xp, gxp, feeds:ok.length, grayN:gray.length, givers:by.size, ready, last };
  },
  mood(){
    if(this.busy) return 'eating';
    const s = this.sum(); if(s.ready) return 'full';
    if(this.loaded && (!s.last || Date.now() - s.last > GROW_HUNGRY_MS)) return 'hungry';
    return 'normal';
  },
  moodText(m){ return { eating:'먹는 중', full:'배부름 · 레벨업 대기', hungry:'배고픔', normal:'보통' }[m]; },

  // ───────────── 머리 줄 버튼
  renderBtn(){
    const b = document.getElementById('growBtn'); if(!b) return;
    const s = this.sum(), m = this.mood(), w = Math.min(100, s.xp / s.need * 100);
    b.innerHTML = `<span class="growtile">${catSvg(m, 2)}</span><span class="growmini"><b>Lv${s.lv}</b><span class="xpmini"><i style="width:${w}%"></i></span></span>`;
    b.setAttribute('aria-label', `학습 열기. Dana 고양이 Lv${s.lv}, ${this.moodText(m)}, 경험치 ${s.xp}/${s.need}`);
    const t = document.getElementById('growTip'); if(!t) return;
    const ck = ok => ok ? '✓' : '·';
    t.innerHTML = `<div class="gt1"><b>Dana 고양이 · Lv${s.lv}</b><span>${this.moodText(m)}</span></div>
      <p>완성 제안서 PDF를 먹이로 주면 경험치가 올라요. 레벨이 오르면 Dana의 기본 디자인 기준이 자라요.</p>
      <div class="gtnow"><span>${ck(s.xp >= s.need)} 경험치 ${s.xp}/${s.need}</span><span>${ck(s.feeds >= 3)} 먹이 ${s.feeds}/3</span><span>${ck(s.givers >= 2)} 준 사람 ${s.givers}/2</span></div>
      <ul><li><b>경험치</b> 본문 1쪽당 1(문서당 최대 60)</li><li><b>더 받기</b> 수주 ×2 · 고득점 ×1.5 · 새 분야 +20%</li><li><b>덜 받기</b> 탈락 ×0.5 · 제안서 아님 ×0.5 · 중복 0</li><li><b>레벨업</b> 경험치 + 먹이 3개 + 준 사람 2명 → 승인자 검토</li></ul>
      <p class="gtfoot">누르면 학습 화면이 열려요.</p>`;
  },
  render(){ this.renderBtn(); if(!document.getElementById('growOv')?.hidden) this.renderPanel(); },

  // ───────────── 학습 화면
  open(){ const o = document.getElementById('growOv'); o.hidden = false; document.body.classList.add('noscroll'); this.renderPanel(); document.getElementById('growClose')?.focus(); },
  close(){ if(this.busy) return; document.getElementById('growOv').hidden = true; document.body.classList.remove('noscroll'); document.getElementById('growBtn')?.focus(); },
  writable(){ return !!(this.db && this.uid) && this.canWrite !== false; },
  renderPanel(){
    const P = document.getElementById('growPanel'); if(!P) return;
    const s = this.sum(), m = this.mood(), w = Math.min(100, s.xp / s.need * 100), gw = Math.min(100 - w, s.gxp / s.need * 100);
    const cond = (ok, t) => `<span class="gcond ${ok ? 'ok' : ''}">${ok ? '✓' : '·'} ${t}</span>`;
    const stTxt = m === 'eating' ? '먹이를 소화하고 있어요.'
      : m === 'full' ? '경험치와 다양성 조건을 채워 레벨업 대기 중이에요. 승인자가 먹이를 검토해 확정하는 화면은 다음 업데이트에서 열려요.'
      : m === 'hungry' ? (s.last ? '7일 넘게 새 먹이가 없어 배가 고파요.' : '아직 먹이를 받지 못했어요. 완성 제안서 PDF를 주면 경험치가 올라요.')
      : s.xp >= s.need ? `경험치는 찼어요. ${s.feeds < 3 ? `먹이가 ${3 - s.feeds}개 더` : `다른 팀원 ${2 - s.givers}명의 먹이가 더`} 있으면 레벨업 대기가 돼요.`
      : `다음 레벨까지 경험치 ${s.need - s.xp} 남았어요.`;
    let h = `<div class="ghead"><h2 id="growTitle">학습</h2><button type="button" class="ghost" id="growClose">닫기</button></div>
    <div class="gtop"><div class="gcat">${catSvg(m, 7)}</div>
      <div class="gstat"><div class="glv">Lv${s.lv} <span class="gmood">${this.moodText(m)}</span></div>
        <div class="xpbar" role="img" aria-label="경험치 ${s.xp} / ${s.need}${s.gxp ? `, 확인 필요 ${s.gxp}` : ''}"><i style="width:${w}%"></i><i class="gray" style="width:${gw}%"></i></div>
        <div class="xpnum">경험치 <b>${s.xp}</b> / ${s.need}${s.gxp ? ` · <span class="muted">확인 필요 ${s.gxp}(승인 전까지 회색)</span>` : ''}</div>
        <div class="gconds">${cond(s.xp >= s.need, `경험치 ${Math.min(s.xp, s.need)}/${s.need}`)}${cond(s.feeds >= 3, `먹이 ${s.feeds}/3`)}${cond(s.givers >= 2, `준 사람 ${s.givers}/2`)}</div>
        <p class="gnote">${stTxt}</p></div></div>`;
    // 먹이 주기
    h += `<section class="gsec"><h3>먹이 주기</h3>`;
    if(!this.db || !this.uid) h += `<p class="msg warn">claude.ai에 로그인한 상태로 Dana 링크를 열어야 먹이를 줄 수 있어요.</p>`;
    else if(this.canWrite === false) h += `<p class="msg warn">이 계정은 보기·댓글 권한이라 먹이를 줄 수 없어요. 자란 체질은 그대로 받아 써요.</p>`;
    else {
      const M = this.meta; const fields = [...new Set([...GROW_FIELDS, ...this.feeds.map(f => f.meta?.field).filter(Boolean)])];
      h += `<label class="drop gdrop" id="growDrop"><span class="pick">PDF 선택</span><span class="or">또는 끌어다 놓기 · 완성 제안서 PDF · 여러 개 가능</span><input type="file" id="growFile" multiple accept=".pdf,application/pdf"${this.busy ? ' disabled' : ''}></label>`;
      if(this.staged.length) h += `<ul class="gfiles">${this.staged.map((f, i) => `<li><span>${esc(f.name)}</span><small class="muted">${(f.size / 1048576).toFixed(1)}MB</small>${this.busy ? '' : `<button type="button" class="linkbtn" data-gx="${i}" aria-label="${esc(f.name)} 빼기">빼기</button>`}</li>`).join('')}</ul>`;
      h += `<div class="gmeta"><div class="gmlbl">함께 적기 <small class="muted">선택 · 이번에 주는 먹이 모두에 적용</small></div>
        <label>결과<select id="gmResult">${Object.entries(GROW_RESULT).map(([k, v]) => `<option value="${k}"${M.result === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
        <label>점수<span class="gscore"><input type="number" id="gmScore" min="0" step="0.1" inputmode="decimal" value="${esc(M.score)}" placeholder="87.5" aria-label="받은 점수"> / <input type="number" id="gmMax" min="0" step="0.1" inputmode="decimal" value="${esc(M.max)}" placeholder="90" aria-label="만점"></span></label>
        <label>분야<input type="text" id="gmField" list="gmFields" value="${esc(M.field)}" placeholder="예: 환경·청소" maxlength="20"><datalist id="gmFields">${fields.map(f => `<option value="${esc(f)}">`).join('')}</datalist></label>
        <label>문서 종류<select id="gmKind">${Object.entries(GROW_KIND).map(([k, v]) => `<option value="${k}"${M.kind === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label></div>
        <p class="gnote">팀이 쓸 권리가 있는 문서만 주세요. 원본과 파일 이름은 어디에도 저장하지 않고, 쪽에서 잰 숫자만 남겨요. 결과를 비워 두면 「모름」(경험치 ×1)으로 셉니다.</p>
        <div class="gact"><button type="button" class="primary" id="growGo"${!this.staged.length || this.busy ? ' disabled' : ''}>${this.busy ? '소화하는 중…' : `먹이 주기${this.staged.length ? ` (${this.staged.length})` : ''}`}</button>${this.prog ? `<span class="gprog">${esc(this.prog)}</span>` : ''}</div>`;
    }
    if(this.log.length) h += `<ul class="glog">${this.log.map(l => `<li class="${l.lv}">${l.html}</li>`).join('')}</ul>`;
    h += `</section>`;
    // 이번 레벨 먹이
    const pend = this.pending().sort((a, b) => (b.at || 0) - (a.at || 0));
    h += `<section class="gsec"><h3>이번 레벨 먹이 <small class="muted">${pend.length}개</small></h3>`;
    if(!pend.length) h += `<p class="muted gnote">아직 없어요.</p>`;
    else h += `<div class="gtable"><table><thead><tr><th>날짜</th><th>준 사람</th><th>분야 · 종류</th><th>결과</th><th class="n">본문</th><th class="n">경험치</th></tr></thead><tbody>${pend.map(f => {
      const d = new Date(f.at || 0); const M = f.meta || {};
      return `<tr${f.gray ? ' class="gray"' : ''}><td>${d.getMonth() + 1}/${d.getDate()}</td><td>${f.by && f.by === this.uid ? '나' : '팀원'}</td><td>${esc(M.field || '—')} · ${GROW_KIND[M.kind] || '제안서'}</td><td>${GROW_RESULT[M.result] || '모름'}${M.score != null && M.max ? ` <small class="muted">${M.score}/${M.max}</small>` : ''}</td><td class="n">${f.bodyPages}쪽</td><td class="n">${f.gray ? `<span class="gtag" title="${esc((f.why || []).join(', '))}">확인 필요</span> ` : ''}${f.xp}</td></tr>`;
    }).join('')}</tbody></table></div>`;
    if(pend.some(f => f.gray)) h += `<p class="gnote muted">「확인 필요」 먹이는 회색 경험치예요. 레벨업 검토 때 승인자가 통과시키면 경험치로 채워져요.</p>`;
    h += `</section>`;
    P.innerHTML = h; this.bind(P);
  },
  bind(P){
    P.querySelector('#growClose').onclick = () => this.close();
    const f = P.querySelector('#growFile'); if(!f) return;
    f.addEventListener('change', () => { this.stage([...f.files]); f.value = ''; });
    const dz = P.querySelector('#growDrop');
    ['dragover', 'dragenter'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('over'); }));
    dz.addEventListener('drop', e => { const fs = [...(e.dataTransfer?.files || [])]; if(fs.length) this.stage(fs); });
    P.querySelectorAll('[data-gx]').forEach(b => b.addEventListener('click', () => { this.staged.splice(+b.dataset.gx, 1); this.renderPanel(); }));
    const keep = () => { const M = this.meta; M.result = P.querySelector('#gmResult').value; M.score = P.querySelector('#gmScore').value; M.max = P.querySelector('#gmMax').value; M.field = P.querySelector('#gmField').value.trim(); M.kind = P.querySelector('#gmKind').value; };
    ['#gmResult', '#gmScore', '#gmMax', '#gmField', '#gmKind'].forEach(s => P.querySelector(s).addEventListener('change', keep));
    P.querySelector('#growGo').addEventListener('click', () => { keep(); this.feed(); });
  },
  stage(files){
    if(this.busy) return; this.log = [];
    for(const f of files){
      if(!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf'){ this.log.push({ lv:'warn', html:`「${esc(f.name)}」은 PDF가 아니라 먹이로 줄 수 없어요.` }); continue; }
      if(!this.staged.some(x => x.name === f.name && x.size === f.size)) this.staged.push(f);
    }
    this.renderPanel();
  },
  metaOut(){
    const M = this.meta, sc = parseFloat(M.score), mx = parseFloat(M.max);
    const ok = isFinite(sc) && isFinite(mx) && mx > 0 && sc >= 0 && sc <= mx;
    return { result:M.result, score:ok ? sc : null, max:ok ? mx : null, field:M.field.slice(0, 20), kind:M.kind };
  },
  async feed(){
    if(this.busy || !this.staged.length || !this.writable()) return;
    const M = this.meta, sc = M.score !== '' || M.max !== '';
    const meta = this.metaOut(); this.log = [];
    if(sc && meta.score == null) this.log.push({ lv:'warn', html:'점수는 「받은 점수 / 만점」을 둘 다 숫자로 적어야 써요. 이번에는 점수 없이 셉니다.' });
    this.busy = true; this.render();
    const files = [...this.staged];
    for(const [i, f] of files.entries()){
      const nm = `「${esc(f.name)}」`;
      try{
        this.prog = `${i + 1}/${files.length} ${f.name} 여는 중`; this.render();
        const dg = await growDigest(f, (p, t) => { this.prog = `${i + 1}/${files.length} ${f.name} · ${t}`; this.renderProg(); });
        const ref = this.db.doc(`grow_feeds/${dg.fp}`);
        let dup = false; try{ dup = (await ref.get()).exists; }catch(e){}
        if(dup || this.feeds.some(x => x.id === dg.fp)){ this.log.push({ lv:'info', html:`${nm} 이미 먹은 문서예요. 경험치는 0이에요.` }); continue; }
        const why = growCheck(dg, this.feeds); const X = growXp(dg, meta, this.feeds);
        const doc = { v:1, fp:dg.fp, by:this.uid, at:Date.now(), meta, pages:dg.pages, bodyPages:dg.bodyPages, measured:dg.measured, nut:dg.nut, xp:X.xp, mult:X.mult, newField:X.newField, gray:why.length > 0, why, status:'pending', level:this.state.level || 1 };
        await ref.set(JSON.parse(JSON.stringify(doc)));
        if(!this.feeds.some(x => x.id === dg.fp)) this.feeds.push({ id:dg.fp, ...doc });
        const bits = [`본문 ${dg.bodyPages}쪽`, ...X.why].join(' · ');
        this.log.push(why.length ? { lv:'warn', html:`${nm} ${bits} · 확인 필요(${esc(why.join(', '))}) · 회색 경험치 +${X.xp}` } : { lv:'ok', html:`${nm} ${bits} · 경험치 <b>+${X.xp}</b>` });
      }catch(e){
        console.error('grow feed', e);
        const denied = /permission|denied|not_granted|not_writer|forbidden/i.test(String(e?.code || e?.message || ''));
        this.log.push({ lv:'err', html: denied ? `${nm} 저장할 권한이 없어요. 먹이는 Dana 편집자나 같은 조직 참여자만 줄 수 있어요.` : `${nm} 소화하지 못했어요. 암호가 걸렸거나 깨진 PDF인지 확인해 주세요.` });
        if(denied){ this.canWrite = false; break; }
      }
      this.render();
    }
    this.staged = []; this.busy = false; this.prog = null;
    this.meta = { result:'unknown', score:'', max:'', field:'', kind:'proposal' }; // 다음 먹이에 이번 결과가 따라가지 않도록
    await this.reload();
  },
  renderProg(){ const e = document.querySelector('#growPanel .gprog'); if(e) e.textContent = this.prog || ''; else this.renderPanel(); },
};
window.Grow = Grow;
(function(){
  const b = document.getElementById('growBtn'); if(!b) return;
  b.addEventListener('click', () => Grow.open());
  const o = document.getElementById('growOv');
  o.addEventListener('click', e => { if(e.target === o) Grow.close(); });
  document.addEventListener('keydown', e => { if(e.key === 'Escape' && !o.hidden) Grow.close(); });
  Grow.renderBtn();
  if(S.dbTried) Grow.init();
})();
