'use strict';
// ═════════════════════════════ 레퍼런스형 시안: Claude가 레퍼런스를 보고 쪽을 설계
// 1) 레퍼런스 키트(한 번): 레퍼런스 쪽 모음을 보고 머리틀·장식·소제목·헤드 메시지·목록·카드·단계·표·수치·요약 상자 모양과 밀도를 정함
// 2) 쪽 설계(쪽마다 한 번): 레퍼런스 + 이 쪽 원고 구조를 보고 행·열 배치와 블록 종류를 정함
// 3) Dana가 글자를 재며 그림(넘치면 촘촘하게 다시, 그래도 넘치면 기본 배치)
// 색은 디자인 시스템 색을 역할 이름(p0·p1·p2·note·accent)으로만 씀. 원고 글자는 바꾸지 않음
const PK = {
  header:['band', 'panel', 'plain', 'line'], deco:['none', 'sidebar', 'corner', 'topstripe', 'bottomstripe', 'frame'], density:['tight', 'normal', 'airy'],
  sub:['bar', 'num', 'pill', 'underline', 'box', 'dot'], msg:['tint', 'solid', 'underline', 'quote', 'outline'],
  bullet:['dot', 'check', 'dash', 'num', 'square'], listBox:['none', 'tint', 'outline'],
  cardFill:['none', 'tint', 'solid', 'alt'], cardBorder:['none', 'line', 'p1', 'left', 'top'], cardNumber:['none', 'badge', 'big'], cardIcon:['none', 'left', 'top'], align:['left', 'center'],
  flow:['chevron', 'box', 'circle', 'arrow', 'vertical'], tableHead:['p0', 'p1', 'tint', 'none'], kpi:['tint', 'solid', 'outline', 'plain', 'circle'], conc:['label', 'tint', 'outline', 'solid'], timeline:['dots', 'pills'],
};
const PK_DESC = {
  header:'band=진한 색 띠 위 흰 제목, panel=옅은 바탕 머리틀, plain=흰 바탕 제목+선, line=무채색 제목+선',
  deco:'sidebar=쪽 왼쪽 세로 색 띠, corner=오른쪽 위 모서리 삼각 면, topstripe=맨 위 가는 강조 띠, bottomstripe=맨 아래 색 띠, frame=본문 둘레 얇은 테두리, none=없음',
  sub:'bar=앞 세로 막대, num=01 번호, pill=색 꼬리표 안 흰 글자, underline=굵은 글자+아래 선, box=옅은 바탕 띠, dot=앞 동그라미',
  msg:'tint=옅은 바탕+왼쪽 선, solid=진한 색 상자 흰 글자, underline=큰 굵은 글자+밑줄, quote=따옴표 강조, outline=테두리 상자',
  bullet:'dot·check·dash·num(번호 원)·square', listBox:'목록을 감싸는 상자: none·tint·outline',
  cards:'fill(none 흰·tint 옅은·solid 진한·alt 진한 두 색 번갈아) border(none·line 회색 선·p1 주색 선·left 왼쪽 굵은 선·top 위 굵은 선) band(머리 띠 여부) number(none·badge 작은 번호 원·big 큰 번호) icon(none·left·top) radius(0~12) align(left·center)',
  flow:'chevron=화살표 모양 단계, box=번호 원+상자, circle=큰 원을 선으로 이음, arrow=둥근 상자 사이 화살표, vertical=세로로 번호와 설명',
  table:'head(p0 진한 머리·p1 주색 머리·tint 옅은 머리·none) zebra(줄무늬) vlines(세로줄)', kpi:'tint·solid·outline·plain(상자 없이 큰 숫자)·circle(원 안 숫자)',
  conc:'label=왼쪽 색 꼬리표+목록, tint=옅은 상자, outline=테두리 상자, solid=진한 상자 흰 글자', timeline:'dots=선 위 점, pills=선 위 점+이름 알약',
};
const KIT_PROMPT = n => `첨부 이미지는 제안서·보고서 디자인 레퍼런스 ${n}쪽입니다(번호 1~${n}). 새 제안서를 이 레퍼런스와 최대한 똑같은 디자인 언어로 만들려고 합니다. 레퍼런스의 머리틀·장식·소제목·핵심 문장·목록·카드·단계 도식·표·수치·요약 상자 모양과 밀도를 아래 보기에서 가장 가까운 것으로 고르세요. 색은 따라 하지 않으니 진한 색 면을 쓰는지, 옅은 바탕을 쓰는지만 보세요. JSON 하나로만 답하세요.
{"header":"${PK.header.join('|')}","deco":"${PK.deco.join('|')}","density":"${PK.density.join('|')}","sub":"${PK.sub.join('|')}","msg":"${PK.msg.join('|')}","list":{"bullet":"${PK.bullet.join('|')}","box":"${PK.listBox.join('|')}"},"cards":{"fill":"${PK.cardFill.join('|')}","border":"${PK.cardBorder.join('|')}","band":true|false,"number":"${PK.cardNumber.join('|')}","icon":"${PK.cardIcon.join('|')}","radius":0~12,"align":"left|center"},"flow":"${PK.flow.join('|')}","table":{"head":"${PK.tableHead.join('|')}","zebra":true|false,"vlines":true|false},"kpi":"${PK.kpi.join('|')}","conc":"${PK.conc.join('|')}","timeline":"${PK.timeline.join('|')}","columns":"single|two|mixed","components":{"table":0~3,"cards":0~3,"flow":0~3,"kpi":0~3,"timeline":0~3,"photo":0~3,"icon":0~3},"note":"이 레퍼런스 디자인의 특징 한 줄(50자 이내)"}
보기 뜻: header ${PK_DESC.header} / deco ${PK_DESC.deco} / sub ${PK_DESC.sub} / msg ${PK_DESC.msg} / list.bullet ${PK_DESC.bullet}, list.box ${PK_DESC.listBox} / cards ${PK_DESC.cards} / flow ${PK_DESC.flow} / table ${PK_DESC.table} / kpi ${PK_DESC.kpi} / conc ${PK_DESC.conc} / timeline ${PK_DESC.timeline} / columns: 쪽 본문을 한 단으로 쓰는지(single), 두 단으로 나누는지(two), 섞는지(mixed) / components: 그 요소가 얼마나 자주 쓰이는지 0~3.`;
const pickOf = (v, list, d) => list.includes(v) ? v : d;
function kitClean(r){
  if(!r || typeof r !== 'object') return null;
  const c = r.cards || {}, t = r.table || {}, l = r.list || {};
  return { header:pickOf(r.header, PK.header, 'panel'), deco:pickOf(r.deco, PK.deco, 'none'), density:pickOf(r.density, PK.density, 'normal'), sub:pickOf(r.sub, PK.sub, 'bar'), msg:pickOf(r.msg, PK.msg, 'tint'),
    list:{ bullet:pickOf(l.bullet, PK.bullet, 'dot'), box:pickOf(l.box, PK.listBox, 'none') },
    cards:{ fill:pickOf(c.fill, PK.cardFill, 'tint'), border:pickOf(c.border, PK.cardBorder, 'none'), band:!!c.band, number:pickOf(c.number, PK.cardNumber, 'none'), icon:pickOf(c.icon, PK.cardIcon, 'left'), radius:clamp(Math.round(+c.radius || 0), 0, 12), align:pickOf(c.align, PK.align, 'left') },
    flow:pickOf(r.flow, PK.flow, 'chevron'), table:{ head:pickOf(t.head, PK.tableHead, 'p1'), zebra:!!t.zebra, vlines:!!t.vlines }, kpi:pickOf(r.kpi, PK.kpi, 'tint'), conc:pickOf(r.conc, PK.conc, 'label'), timeline:pickOf(r.timeline, PK.timeline, 'dots'),
    columns:pickOf(r.columns, ['single', 'two', 'mixed'], 'single') };
}

// ───────────── 쪽 원고 구조 → Claude에게 보낼 요약(쓸 수 있는 블록 종류 포함)
function planSubKinds(s){
  const its = s.items.filter(i => !i.note); const k = ['list'];
  if(its.length >= 2 && its.length <= 8) k.push('cards', 'iconlist');
  if(stepsOf(s)) k.push('flow'); if(kpiOf(s)) k.push('kpi'); if(timelineOf(s)) k.push('timeline'); if(hubOk(s)) k.push('hub');
  if(s.tables.length || labelPairs(s)) k.push('table');
  return k;
}
function planContent(pg){
  const cut = (t, n = 70) => t.length > n ? t.slice(0, n) + '…' : t;
  const subs = pg.st.subs.map((s, i) => ({ id:'s' + i, head:s.head || '', items:s.items.filter(x => !x.note).map(x => cut(x.text) + ((x.kids || []).length ? ` (+하위 ${x.kids.length})` : '')), tables:s.tables.map(t => `${t.length}행×${Math.max(...t.map(r => r.length))}열`), kinds:planSubKinds(s) }));
  return { title:pg.title, lead:pg.st.lead.map(t => cut(t, 90)), subs, pics:pg.pics.length, conc:(pg.st.concs || (pg.st.conc ? [pg.st.conc] : [])).map(t => cut(t, 60)) };
}
const PLAN_PROMPT = (kit, content, size) => `첨부 이미지는 디자인 레퍼런스 쪽들입니다. 아래 원고 한 쪽을 이 레퍼런스와 최대한 비슷한 배치로 설계하세요. 레퍼런스에서 정한 모양(키트)은 그대로 씁니다. 원고 글자는 Dana가 넣으니 배치만 정하세요. JSON 하나로만 답하세요.
본문 영역: 폭 ${Math.round(size.w)}pt × 높이 ${Math.round(size.h)}pt (머리틀 아래)
키트: ${JSON.stringify(kit)}
원고 구조: ${JSON.stringify(content)}
형식: {"rows":[{"cols":[{"w":0.5,"items":[{"src":"lead|s0|s1|…|pics|conc","kind":"…","cols":2}]}]}],"note":"설계 의도 한 줄"}
- rows는 위에서 아래, cols는 왼쪽에서 오른쪽. w는 행 안에서의 폭 비율(합 1). 한 행에 1~3열.
- src는 원고 구조의 lead(핵심 문장), s0·s1…(소제목 묶음), pics(사진), conc(핵심 실행) 중 하나. 모든 src를 정확히 한 번씩, 원고 순서대로 배치하세요.
- kind: lead는 msg, pics는 photos, conc는 conc, 소제목 묶음은 그 묶음의 kinds 중 하나(list·cards·iconlist·flow·kpi·timeline·hub·table). 레퍼런스처럼 도식을 적극적으로 쓰되 kinds에 없는 것은 쓰지 마세요.
- cards·iconlist는 "cols"(1~4)로 한 줄에 몇 개 놓을지 정할 수 있습니다. 좁은 열(w 0.5 이하)에서는 1~2.
- 레퍼런스가 두 단으로 나누면 짧은 묶음끼리 한 행에 나란히 두세요. 표·단계 도식·긴 목록은 보통 전체 폭.
- 높이 안에 들어가도록 너무 많은 열을 만들지 마세요.`;

// ───────────── 블록(키트 모양으로)
const roleColor = (C, r) => ({ p0:C.c.p0, p1:C.c.p1, p2:C.c.p2, note:C.c.note, accent:C.c.accent, ink:C.c.ink, gray:C.c.gray, white:'#FFFFFF' })[r] || C.c.p1;
function pkSub(text, C, W, num, shape){
  if(['bar', 'num', 'pill'].includes(shape)) return blkSubtitle(text, { ...C, st:{ ...C.st, sub:{ bar:'A', num:'B', pill:'C' }[shape] } }, W, num || 1);
  const sz = C.tk.size.sub, lh = sz * 1.35;
  if(shape === 'underline'){ const lines = wrap(text, W, 'title', 700, sz); const h = lines.length * lh + 6;
    return { kind:'sub', h, stretch:0, draw:(x, y) => [T(lines, x, y, W, { size:sz, weight:700, role:'title', color:C.c.p0, lh }), E.rect(x, y + h - 1.5, W, 1, { fill:C.c.line }), E.rect(x, y + h - 2.5, Math.min(48, W), 3, { fill:C.c.p1 })] }; }
  if(shape === 'box'){ const pad = 7; const lines = wrap(text, W - pad * 2 - 6, 'title', 700, sz); const h = lines.length * lh + pad * 1.4;
    return { kind:'sub', h, stretch:0, draw:(x, y) => [E.rect(x, y, W, h, { fill:C.c.p2, r:Math.min(C.r, 6) }), E.rect(x, y, 4, h, { fill:C.c.p1 }), T(lines, x + pad + 6, y + pad * .7, W - pad * 2 - 6, { size:sz, weight:700, role:'title', color:C.c.p0, lh })] }; }
  const lines = wrap(text, W - 16, 'title', 700, sz); const h = lines.length * lh;
  return { kind:'sub', h, stretch:0, draw:(x, y) => [E.ell(x, y + lh / 2 - 4, 8, 8, { fill:C.c.p1 }), T(lines, x + 16, y, W - 16, { size:sz, weight:700, role:'title', color:C.c.ink, lh })] };
}
function pkMsg(texts, C, W, shape){
  if(shape === 'tint' || shape === 'solid') return blkHeadMsg(texts, { ...C, st:{ ...C.st, msg:shape === 'solid' ? 'C' : 'A' } }, W);
  const sz = C.tk.size.msg + (shape === 'underline' ? 1.5 : 0), lh = sz * 1.45;
  if(shape === 'underline'){ const lines = texts.flatMap(t => wrap(t, W, 'title', 700, sz)); const h = lines.length * lh + 10;
    return { kind:'msg', h, stretch:0, draw:(x, y) => [T(lines, x, y, W, { size:sz, weight:700, role:'title', color:C.c.p0, lh }), E.rect(x, y + h - 3, 56, 3, { fill:C.c.accent })] }; }
  if(shape === 'quote'){ const qs = sz * 2.2; const lines = texts.flatMap(t => wrap(t, W - 40, 'title', 700, sz)); const h = Math.max(qs, lines.length * lh) + 8;
    return { kind:'msg', h, stretch:0, draw:(x, y) => [T(['“'], x, y - qs * .18, 34, { size:qs, weight:700, role:'title', color:C.c.p3, lh:qs, skip:true }), T(lines, x + 38, y + 4, W - 40, { size:sz, weight:700, role:'title', color:C.c.p0, lh }), E.rect(x + 38, y + h - 1, W - 38, 1, { fill:C.c.line })] }; }
  const pad = 12; const lines = texts.flatMap(t => wrap(t, W - pad * 2 - 8, 'title', 700, sz)); const h = lines.length * lh + pad * 2;
  return { kind:'msg', h, stretch:0, draw:(x, y) => [E.rect(x, y, W, h, { fill:'#FFFFFF', stroke:C.c.p1, sw:1.5, r:C.r }), T(lines, x + pad + 4, y + pad, W - pad * 2 - 8, { size:sz, weight:700, role:'title', color:C.c.p0, lh, align:'center' })] };
}
function pkList(items, C, W, v){
  const bx = v.box !== 'none' ? 12 : 0, b = v.bullet; const ind = b === 'num' ? 20 : 13, kidInd = ind + 13; const IW = W - bx * 2; const rows = []; let k = 0;
  for(const it of items){ const note = it.note; const sz = note ? Math.max(C.cf, C.fs - 1) : C.fs;
    rows.push({ k:note ? 'note' : 'item', no:note ? 0 : ++k, lines:wrap(it.text, IW - (note ? 0 : ind), 'body', 400, sz), sz });
    for(const kd of (it.kids || [])) rows.push({ k:'kid', lines:wrap(kd.text, IW - kidInd, 'body', 400, C.fs), sz:C.fs }); }
  const g = 4 + 2 * (C.air || 0); const inner = rows.reduce((a, r) => a + r.lines.length * (r.sz === C.fs ? C.lh : r.sz * 1.5), 0) + g * Math.max(0, rows.length - 1); const h = inner + bx * 1.6;
  return { kind:'list', h, stretch:0, draw:(x, y) => { const out = [];
    if(v.box === 'tint') out.push(E.rect(x, y, W, h, { fill:C.c.note, r:C.r })); else if(v.box === 'outline') out.push(E.rect(x, y, W, h, { fill:'#FFFFFF', stroke:C.c.line, sw:1, r:C.r }));
    let yy = y + bx * .8; const xx = x + bx;
    for(const r of rows){ const lh = r.sz === C.fs ? C.lh : r.sz * 1.5;
      if(r.k === 'item'){ const cy = yy + lh / 2;
        if(b === 'check') out.push(...check(xx, cy - 3.5, C.c.p1)); else if(b === 'dash') out.push(E.rect(xx, cy - .8, 7, 1.6, { fill:C.c.p1 })); else if(b === 'square') out.push(E.rect(xx + 1, cy - 2.6, 5.2, 5.2, { fill:C.c.p1 }));
        else if(b === 'num'){ out.push(E.ell(xx, cy - 7, 14, 14, { fill:C.c.p1 })); out.push(T([String(r.no)], xx, cy - C.cf * .7, 14, { size:C.cf, weight:700, role:'num', color:C.c.onP1, lh:C.cf * 1.4, align:'center', skip:true })); }
        else out.push(E.ell(xx + 2, cy - 2.4, 4.8, 4.8, { fill:C.c.point }));
        out.push(T(r.lines, xx + ind, yy, IW - ind, { size:r.sz, color:C.c.ink, lh })); }
      else if(r.k === 'kid'){ out.push(E.line(xx + ind + 2, yy + lh / 2, xx + ind + 7, yy + lh / 2, { stroke:C.c.ink2, sw:1 })); out.push(T(r.lines, xx + kidInd, yy, IW - kidInd, { size:r.sz, color:C.c.ink2, lh })); }
      else out.push(T(r.lines, xx, yy, IW, { size:r.sz, color:C.c.ink2, lh }));
      yy += r.lines.length * lh + g; }
    return out; } };
}
function pkCards(items, C, W, v, colsWant){
  const its = items.filter(i => !i.note); const n = its.length; const gap = 10;
  const maxCols = Math.max(1, Math.floor((W + gap) / (118 + gap))); let cols = clamp(Math.round(colsWant || (n <= 2 ? n : n === 4 ? 2 : 3)), 1, Math.min(4, n, maxCols));
  const cw = (W - gap * (cols - 1)) / cols, pad = 11 + 2 * (C.air || 0), ts = C.fs + 1, isz = 22; const solid = v.fill === 'solid' || v.fill === 'alt';
  const parts = its.map(i => ({ ...splitTitle(i.text), kids:i.kids || [], topic:topicOf(i.text) }));
  const icons = v.icon !== 'none' && C.useIcons && parts.filter(p => p.topic).length >= Math.ceil(n / 2);
  const cards = parts.map((p, i) => {
    const big = v.number === 'big' ? C.fs * 2 : 0; const badge = v.number === 'badge' ? 20 : 0; const top = icons && v.icon === 'top';
    const hx = pad + (icons && !top ? isz + 8 : 0) + (badge ? badge + 6 : 0); const head = p.title || (v.band || badge || big ? '' : '');
    const tl = head ? wrap(head, cw - hx - pad, 'title', 700, ts) : [];
    const desc = [...(p.title ? (p.desc ? [p.desc] : []) : [p.desc])].filter(Boolean).map(t => wrap(t, cw - pad * 2, 'body', 400, C.fs));
    const kids = p.kids.map(k => wrap(k.text, cw - pad * 2 - 12, 'body', 400, C.fs));
    const headH = Math.max(top ? 0 : icons ? isz : 0, badge, tl.length * ts * 1.3);
    const bandH = v.band && tl.length ? headH + pad * 1.2 : 0;
    const bodyH = desc.reduce((a, l) => a + l.length * C.lh + 3, 0) + kids.reduce((a, l) => a + l.length * C.lh + 3, 0);
    const h = pad + (big ? big * 1.1 + 4 : 0) + (top ? isz + 6 : 0) + (bandH ? bandH - pad : headH) + (bodyH ? 7 + bodyH - 3 : 0) + pad;
    return { ...p, i, tl, desc, kids, headH, bandH, big, badge, top, hx, h };
  });
  const rows = []; for(let i = 0; i < cards.length; i += cols) rows.push(cards.slice(i, i + cols));
  const rh = rows.map(r => Math.max(...r.map(c => c.h))); const nat = rh.reduce((a, b) => a + b, 0) + gap * (rows.length - 1); const R = v.radius ?? C.r;
  return { kind:'cards', h:nat, stretch:0, draw:(x, y) => { const out = []; let yy = y;
    rows.forEach((r, ri) => { const h = rh[ri]; const off = (W - (r.length * cw + (r.length - 1) * gap)) / 2;
      r.forEach((c, ci) => { const cx = x + off + ci * (cw + gap); const fill = v.fill === 'solid' ? C.c.p1 : v.fill === 'alt' ? (c.i % 2 ? C.c.p0 : C.c.p1) : v.fill === 'tint' ? C.c.note : '#FFFFFF';
        const ink = solid ? '#FFFFFF' : C.c.ink, tink = solid ? '#FFFFFF' : v.band ? C.c.onP1 : C.c.p0;
        out.push(E.rect(cx, yy, cw, h, { fill, stroke:v.border === 'line' ? C.c.line : v.border === 'p1' ? C.c.p1 : undefined, sw:v.border === 'p1' ? 1.2 : .8, r:R }));
        if(v.border === 'left') out.push(E.rect(cx, yy, 4, h, { fill:solid ? C.c.accent : C.c.p1 })); if(v.border === 'top') out.push(E.rect(cx, yy, cw, 4, { fill:solid ? C.c.accent : C.c.p1 }));
        if(c.bandH){ out.push(E.rect(cx, yy, cw, c.bandH, { fill:v.fill === 'alt' && c.i % 2 ? C.c.p1 : C.c.p0, r:R })); if(R) out.push(E.rect(cx, yy + c.bandH - R, cw, R, { fill:v.fill === 'alt' && c.i % 2 ? C.c.p1 : C.c.p0 })); }
        let ty = yy + pad; const al = v.align === 'center' && !c.badge && !(icons && !c.top);
        if(c.big){ out.push(T([String(c.i + 1).padStart(2, '0')], cx + pad, ty, cw - pad * 2, { size:c.big, weight:700, role:'num', color:solid ? C.c.p2 : C.c.p3, lh:c.big * 1.1, align:v.align === 'center' ? 'center' : 'left', skip:true })); ty += c.big * 1.1 + 4; }
        if(c.top){ out.push(E.icon(cx + (al ? cw / 2 - isz / 2 : pad), ty, isz, iconFor(c.topic || '목표'), { tone:solid || c.bandH ? 'dark' : C.tk.iconTone })); ty += isz + 6; }
        const hy = c.bandH ? yy + (c.bandH - c.headH) / 2 : ty; let hx = cx + pad;
        if(c.badge){ out.push(E.ell(hx, hy + (c.headH - c.badge) / 2, c.badge, c.badge, { fill:solid || c.bandH ? '#FFFFFF' : C.c.p1 })); out.push(T([String(c.i + 1)], hx, hy + (c.headH - C.cf * 1.4) / 2, c.badge, { size:C.cf, weight:700, role:'num', color:solid || c.bandH ? C.c.p1 : C.c.onP1, lh:C.cf * 1.4, align:'center', skip:true })); hx += c.badge + 6; }
        if(icons && !c.top){ out.push(E.icon(hx, hy + (c.headH - isz) / 2, isz, iconFor(c.topic || '목표'), { tone:solid || c.bandH ? 'dark' : C.tk.iconTone })); hx += isz + 8; }
        if(c.tl.length) out.push(T(c.tl, al ? cx + pad : hx, hy + (c.headH - c.tl.length * ts * 1.3) / 2, al ? cw - pad * 2 : cx + cw - pad - hx, { size:ts, weight:700, role:'title', color:c.bandH ? C.c.onP1 : tink, lh:ts * 1.3, align:al ? 'center' : 'left' }));
        ty = c.bandH ? yy + c.bandH + 7 : ty + c.headH + 7;
        for(const l of c.desc){ out.push(T(l, cx + pad, ty, cw - pad * 2, { size:C.fs, color:ink, lh:C.lh, align:al ? 'center' : 'left' })); ty += l.length * C.lh + 3; }
        for(const l of c.kids){ out.push(...check(cx + pad, ty + C.lh / 2 - 3.5, solid ? '#FFFFFF' : C.c.p1)); out.push(T(l, cx + pad + 12, ty, cw - pad * 2 - 12, { size:C.fs, color:ink, lh:C.lh })); ty += l.length * C.lh + 3; }
      });
      yy += h + gap; });
    return out; } };
}
function pkIconList(items, C, W, colsWant){
  const its = items.filter(i => !i.note); const gap = 12, cols = clamp(colsWant || (W > 360 && its.length >= 4 ? 2 : 1), 1, Math.max(1, Math.floor((W + gap) / 180))); const cw = (W - gap * (cols - 1)) / cols, D0 = 30;
  const rows = its.map(i => { const p = splitTitle(i.text); const tl = p.title ? wrap(p.title, cw - D0 - 10, 'title', 700, C.fs) : []; const dl = wrap(p.title ? p.desc : p.desc || i.text, cw - D0 - 10, 'body', 400, C.fs).filter(Boolean);
    const kd = (i.kids || []).map(k => wrap('· ' + k.text, cw - D0 - 10, 'body', 400, C.fs)); return { topic:topicOf(i.text), tl, dl:p.title && !p.desc ? [] : dl, kd, h:Math.max(D0, (tl.length + (p.title && !p.desc ? 0 : dl.length) + kd.reduce((a, l) => a + l.length, 0)) * C.lh) }; });
  const lines = []; for(let i = 0; i < rows.length; i += cols) lines.push(rows.slice(i, i + cols)); const lh = lines.map(r => Math.max(...r.map(x => x.h)));
  const nat = lh.reduce((a, b) => a + b, 0) + 10 * (lines.length - 1);
  return { kind:'cards', h:nat, stretch:0, draw:(x, y) => { const out = []; let yy = y;
    lines.forEach((r, ri) => { r.forEach((it, ci) => { const cx = x + ci * (cw + gap);
      out.push(E.ell(cx, yy, D0, D0, { fill:C.c.p2 })); out.push(E.icon(cx + 5, yy + 5, D0 - 10, iconFor(it.topic || '목표'), { tone:'light' }));
      let ty = yy; if(it.tl.length){ out.push(T(it.tl, cx + D0 + 10, ty, cw - D0 - 10, { size:C.fs, weight:700, role:'title', color:C.c.p0, lh:C.lh })); ty += it.tl.length * C.lh; }
      if(it.dl.length){ out.push(T(it.dl, cx + D0 + 10, ty, cw - D0 - 10, { size:C.fs, color:C.c.ink, lh:C.lh })); ty += it.dl.length * C.lh; }
      for(const l of it.kd){ out.push(T(l, cx + D0 + 10, ty, cw - D0 - 10, { size:C.fs, color:C.c.ink2, lh:C.lh })); ty += l.length * C.lh; } });
      yy += lh[ri] + 10; });
    return out; } };
}
function pkFlow(steps, C, W, shape){
  if(['chevron', 'box', 'circle'].includes(shape)) return blkFlow(steps, { ...C, st:{ ...C.st, flow:{ chevron:'A', box:'B', circle:'C' }[shape] } }, W, false);
  const items = steps.map((s, i) => { const sp = splitTitle(s.text); const two = !!(sp.title && sp.desc); return { no:String(i + 1).padStart(2, '0'), lab:s.label && !/^\d+$/.test(s.label) ? s.label : '', title:two ? sp.title : s.text, desc:two ? sp.desc : '' }; });
  if(shape === 'vertical'){ const D0 = 26, tx = D0 + 12; const rows = items.map(it => ({ ...it, tl:wrap((it.lab ? it.lab + ' ' : '') + it.title, W - tx, 'title', 700, C.fs), dl:it.desc ? wrap(it.desc, W - tx, 'body', 400, C.fs) : [] }));
    const hs = rows.map(r => Math.max(D0, (r.tl.length + r.dl.length) * C.lh)); const nat = hs.reduce((a, b) => a + b, 0) + 8 * (rows.length - 1);
    return { kind:'flow', h:nat, stretch:0, draw:(x, y) => { const out = [E.rect(x + D0 / 2 - 1, y + D0 / 2, 2, Math.max(0, nat - hs[hs.length - 1] + D0 / 2 - D0 / 2), { fill:C.c.p3 })]; let yy = y;
      rows.forEach((r, i) => { out.push(E.ell(x, yy, D0, D0, { fill:i === rows.length - 1 ? C.c.accent : C.c.p1 })); out.push(T([r.no], x, yy + (D0 - C.cf * 1.4) / 2, D0, { size:C.cf, weight:700, role:'num', color:'#FFFFFF', lh:C.cf * 1.4, align:'center', skip:true }));
        out.push(T(r.tl, x + tx, yy + (r.dl.length ? 0 : (D0 - C.lh) / 2), W - tx, { size:C.fs, weight:700, role:'title', color:C.c.p0, lh:C.lh })); if(r.dl.length) out.push(T(r.dl, x + tx, yy + r.tl.length * C.lh, W - tx, { size:C.fs, color:C.c.ink, lh:C.lh }));
        yy += hs[i] + 8; }); return out; } }; }
  // arrow: 둥근 상자 사이 화살표
  const n = items.length, nr = n <= 5 ? 1 : 2, per = Math.ceil(n / nr), ag = 16, bw = (W - ag * (per - 1)) / per, pad = 8;
  const rows = items.map(it => ({ ...it, tl:wrap((it.lab ? it.lab + ' ' : '') + it.title, bw - pad * 2, 'title', 700, C.fs), dl:it.desc ? wrap(it.desc, bw - pad * 2, 'body', 400, C.fs) : [] }));
  const bh = Math.max(...rows.map(r => r.tl.length)) * C.lh + (Math.max(0, ...rows.map(r => r.dl.length)) ? 6 + Math.max(...rows.map(r => r.dl.length)) * C.lh : 0) + pad * 2 + C.cf * 1.4;
  const nat = nr * bh + (nr - 1) * 12;
  return { kind:'flow', h:nat, stretch:0, draw:(x, y) => { const out = [];
    for(let r = 0; r < nr; r++){ const row = rows.slice(r * per, r * per + per), yy = y + r * (bh + 12), off = (W - (row.length * bw + (row.length - 1) * ag)) / 2;
      row.forEach((it, i) => { const bx = x + off + i * (bw + ag), last = r * per + i === n - 1;
        out.push(E.rect(bx, yy, bw, bh, { fill:last ? C.c.p1 : C.c.note, r:Math.max(6, C.r) }));
        out.push(T([it.no], bx + pad, yy + pad, bw - pad * 2, { size:C.cf, weight:700, role:'num', color:last ? C.c.p2 : C.c.p1, lh:C.cf * 1.4, align:'center', skip:true }));
        out.push(T(it.tl, bx + pad, yy + pad + C.cf * 1.4, bw - pad * 2, { size:C.fs, weight:700, role:'title', color:last ? '#FFFFFF' : C.c.p0, lh:C.lh, align:'center' }));
        if(it.dl.length) out.push(T(it.dl, bx + pad, yy + pad + C.cf * 1.4 + it.tl.length * C.lh + 6, bw - pad * 2, { size:C.fs, color:last ? '#FFFFFF' : C.c.ink, lh:C.lh, align:'center' }));
        if(i < row.length - 1){ const ax = bx + bw + 4, ay = yy + bh / 2; out.push(E.poly([[ax, ay - 6], [ax + 8, ay], [ax, ay + 6]], { fill:C.c.p1, shape:'triangle90', box:[ax, ay - 6, 8, 12] })); } }); }
    return out; } };
}
function pkTable(rows, C, W, v, labelMode){
  const M = tableModel(rows, C, W, labelMode); const nat = M.rh.reduce((a, b) => a + b, 0);
  return { kind:'table', h:nat, stretch:0, draw:(x, y) => {
    const cells = M.cells.map((r, ri) => r.map((c, ci) => { const isHead = M.head && ri === 0, isLab = M.labCol && ci === 0 && !isHead; const body = M.head ? ri - 1 : ri;
      const hf = v.head === 'p0' ? C.c.p0 : v.head === 'p1' ? C.c.p1 : v.head === 'tint' ? C.c.p2 : '#FFFFFF';
      return { lines:c.lines, text:c.text, weight:isHead || isLab ? 700 : c.wt, color:isHead ? (v.head === 'p0' || v.head === 'p1' ? '#FFFFFF' : C.c.p0) : isLab ? C.c.p0 : C.c.ink,
        fill:isHead ? hf : isLab ? (v.zebra ? C.c.p2 : C.c.note) : v.zebra && body % 2 ? C.c.note : '#FFFFFF', align:isHead || c.num ? 'center' : 'left' }; }));
    return [{ t:'table', x, y, colW:M.cw, rowH:M.rh, cells, size:M.fs, lh:M.lh, px:M.px, line:v.zebra ? C.c.note : C.c.line, edge:v.head === 'none' ? C.c.ink : C.c.p0, vlines:!!v.vlines, headRule:v.head === 'none' || v.head === 'tint' }]; } };
}
function pkKpi(k, C, W, shape){
  if(['tint', 'solid', 'outline'].includes(shape)) return blkKpi(k, { ...C, st:{ ...C.st, kpi:{ tint:'A', outline:'B', solid:'C' }[shape] } }, W);
  const n = k.length, cols = n <= 4 ? n : 3, gap = 10, cw = (W - gap * (cols - 1)) / cols, ks = C.tk.size.kpi, lh2 = ks * 1.2;
  const tiles = k.map(t => ({ ...t, ll:wrap(t.label, cw - 16, 'body', 400, C.fs) })); const D0 = shape === 'circle' ? Math.min(cw - 10, ks * 3.2) : 0;
  const th = (shape === 'circle' ? D0 + 8 : lh2 + 6) + Math.max(...tiles.map(t => t.ll.length)) * C.lh; const rows = Math.ceil(n / cols); const nat = rows * th + (rows - 1) * gap;
  return { kind:'kpi', h:nat, stretch:0, draw:(x, y) => { const out = [];
    tiles.forEach((t, i) => { const r = Math.floor(i / cols), c = i % cols; const rowCnt = Math.min(cols, n - r * cols); const off = (W - (rowCnt * cw + (rowCnt - 1) * gap)) / 2; const tx = x + off + c * (cw + gap), ty = y + r * (th + gap);
      const vw = tw(t.value, 'num', 700, ks), uw = tw(t.unit, 'body', 500, C.fs);
      if(shape === 'circle'){ out.push(E.ell(tx + cw / 2 - D0 / 2, ty, D0, D0, { fill:'#FFFFFF', stroke:C.c.p1, sw:3 })); out.push(T([t.value], tx + (cw - vw - uw - 3) / 2, ty + (D0 - lh2) / 2, vw + uw + 6, { size:ks, weight:700, role:'num', color:C.c.p1, lh:lh2, suffix:{ text:t.unit, size:C.fs, weight:500, role:'body', color:C.c.ink2, gap:3 } })); out.push(T(t.ll, tx + 8, ty + D0 + 8, cw - 16, { size:C.fs, color:C.c.ink, lh:C.lh, align:'center' })); }
      else { if(c > 0) out.push(E.line(tx - gap / 2, ty + 4, tx - gap / 2, ty + th - 4, { stroke:C.c.line, sw:1 })); out.push(T([t.value], tx + (cw - vw - uw - 3) / 2, ty, vw + uw + 6, { size:ks, weight:700, role:'num', color:C.c.p1, lh:lh2, suffix:{ text:t.unit, size:C.fs, weight:500, role:'body', color:C.c.ink2, gap:3 } })); out.push(E.rect(tx + cw / 2 - 12, ty + lh2 + 1, 24, 2, { fill:C.c.accent })); out.push(T(t.ll, tx + 8, ty + lh2 + 6, cw - 16, { size:C.fs, color:C.c.ink, lh:C.lh, align:'center' })); } });
    return out; } };
}
function pkConc(concs, C, W, shape){
  if(shape === 'label') return blkConc(concs, C, W);
  const pad = 12, solid = shape === 'solid'; const rows = concs.map(t => wrap(t, W - pad * 2 - 16, 'body', 600, C.fs)); const lbh = C.fs * 1.4;
  const h = pad * 2 + lbh + 4 + rows.reduce((a, l) => a + l.length * C.lh + 3, -3);
  return { kind:'conc', h, stretch:0, draw:(x, y) => { const out = [E.rect(x, y, W, h, { fill:solid ? C.c.p1 : shape === 'tint' ? C.c.note : '#FFFFFF', stroke:shape === 'outline' ? C.c.p1 : undefined, sw:1.4, r:C.r })];
    out.push(T(['핵심 실행'], x + pad, y + pad, W - pad * 2, { size:C.fs, weight:700, role:'title', color:solid ? C.c.p2 : C.c.p1, lh:lbh, skip:true })); let yy = y + pad + lbh + 4;
    for(const l of rows){ out.push(...check(x + pad, yy + C.lh / 2 - 3.5, solid ? '#FFFFFF' : C.c.accent)); out.push(T(l, x + pad + 16, yy, W - pad * 2 - 16, { size:C.fs, weight:600, color:solid ? '#FFFFFF' : C.c.ink, lh:C.lh })); yy += l.length * C.lh + 3; }
    return out; } };
}
function pkDeco(kind, tk, G, W, H){ const c = tk.color, b = G.bleed || 0;
  if(kind === 'sidebar') return [E.rect(-b, -b, 11 + b, H + b * 2, { fill:c.p1 })];
  if(kind === 'corner') return [E.poly([[W - 110, -b], [W + b, -b], [W + b, 110]], { fill:c.p3 })];
  if(kind === 'topstripe') return [E.rect(-b, -b, W + b * 2, 5 + b, { fill:c.accent })];
  if(kind === 'bottomstripe') return [E.rect(-b, H - 7, W + b * 2, 7 + b, { fill:c.p1 })];
  if(kind === 'frame') return [E.rect(G.ml - 8, G.mt - 6, W - G.ml - G.mr + 16, H - G.mt - G.mb + 12, { stroke:c.line, sw:.8 })];
  return []; }

// ───────────── 한 묶음(소제목 + 내용) 블록 목록
function pkSection(src, s, kind, C, W, num, kit, it){
  const out = []; const notes = s.items.filter(i => i.note), its = s.items.filter(i => !i.note);
  const tv = kit.table; const tail = skipTables => { if(!skipTables) for(const t of s.tables) out.push(pkTable(t, C, W, tv, false)); if(notes.length) out.push(blkNotes(notes, C, W)); };
  if(kind === 'hub' && hubOk(s)){ out.push(blkHub(s.head, its, C, W)); tail(); return out; }
  if(s.head) out.push(pkSub(s.head, C, W, num, kit.sub));
  const list = arr => arr.length ? [pkList(arr, C, W, kit.list)] : [];
  if(kind === 'flow'){ const st = stepsOf(s); if(st){ if(st.keep) out.push(...list(its)); out.push(pkFlow(st.steps, C, W, kit.flow)); if(!st.keep) out.push(...list(st.rest.filter(i => !i.note))); tail(); return out; } }
  if(kind === 'kpi'){ const k = kpiOf(s); if(k){ out.push(pkKpi(k, C, W, kit.kpi)); tail(); return out; } }
  if(kind === 'timeline'){ const tl = timelineOf(s); if(tl){ out.push(blkTimeline(tl, { ...C, st:{ ...C.st, timeline:kit.timeline === 'pills' ? 'B' : 'A' } }, W)); tail(); return out; } }
  if(kind === 'table'){ const lp = !s.tables.length && labelPairs(s); if(lp){ out.push(pkTable(lp, C, W, tv, true)); tail(); return out; } if(s.tables.length && !its.length){ tail(); return out; } }
  if(kind === 'cards' && its.length >= 2){ out.push(pkCards(its, C, W, kit.cards, it.cols)); tail(); return out; }
  if(kind === 'iconlist' && its.length >= 2){ out.push(pkIconList(its, C, W, it.cols)); tail(); return out; }
  out.push(...list(its)); tail(); return out;
}

// ───────────── 쪽 그리기(키트 + 설계)
function planOnce(pg, tk, plan, kit, level){
  const G = tk.grid; const W = G.w, H = G.h, x0 = G.ml, BW = W - G.ml - G.mr; const c = tk.color; const L = tk.locks;
  const style = { ...STYLE_A, ref:true, head:kit.header, r:kit.cards.radius };
  const dens = { tight:-1, normal:0, airy:1 }[kit.density] || 0;
  const C = makeCtx(tk, style, level); if(level <= 0){ C.pad += 2 * dens; C.gap += 2 * dens; C.lh = C.fs * (C.lhm + .06 * dens); }
  const groups = []; const issues = [];
  const deco = pkDeco(kit.deco, tk, G, W, H); if(deco.length) groups.push({ id:'part-deco', title:'장식', skip:true, els:deco });
  const hd = headerEls(pg, tk, G, x0, BW, W, style); groups.push({ id:'part-head', title:'머리틀', skip:true, els:hd.els });
  const yEnd = H - G.mb; let y1 = yEnd;
  if(pg.src){ const cs = tk.size.caption; const sl = wrap(pg.src, BW, 'body', 400, cs); const sh = sl.length * cs * 1.45; groups.push({ id:'part-src', title:'자료 출처', els:[T(sl, x0, yEnd - sh, BW, { size:cs, color:c.ink2, lh:cs * 1.45 })] }); y1 = yEnd - sh - 10; }
  if(L.pageNumber !== '넣지 않음'){ const ps = tk.size.pno; groups.push({ id:'part-pageno', title:'쪽 번호', skip:true, els:[T([String(pg.n)], W / 2 - 20, yEnd + (G.mb - ps * 1.4) / 2, 40, { size:ps, weight:500, color:c.ink2, lh:ps * 1.4, align:'center' })] }); }
  const subs = pg.st.subs; const concs = pg.st.concs || (pg.st.conc ? [pg.st.conc] : []); let num = 0; const numOf = {}; subs.forEach((s, i) => { if(s.head) numOf[i] = ++num; });
  const colGap = 16, rowGap = level >= 1 ? 12 : 18 + 4 * dens, inGap = level >= 2 ? 6 : 8 + 2 * dens, subGap = 7;
  const built = plan.rows.map(row => { const tot = row.cols.reduce((a, c2) => a + c2.w, 0) || 1; const free = BW - colGap * (row.cols.length - 1);
    const cols = row.cols.map(col => { const w = free * col.w / tot; const blocks = [];
      for(const it of col.items){
        if(it.src === 'lead') blocks.push({ t:'헤드 메시지', bs:[pkMsg(pg.st.lead, C, w, kit.msg)] });
        else if(it.src === 'conc') blocks.push({ t:'핵심 실행 사항', bs:[pkConc(concs, C, w, kit.conc)] });
        else if(it.src === 'pics') blocks.push({ t:'사진', bs:[blkPhotos(pg.pics, C, w)] });
        else { const i = +it.src.slice(1); const s = subs[i]; blocks.push({ t:s.head || `내용 ${i + 1}`, bs:pkSection(it.src, s, it.kind, C, w, numOf[i], kit, it) }); } }
      const h = blocks.reduce((a, b, bi) => a + b.bs.reduce((x, k, ki) => x + k.h + (ki < b.bs.length - 1 ? (k.kind === 'sub' ? subGap : inGap) : 0), 0) + (bi < blocks.length - 1 ? rowGap : 0), 0);
      return { w, blocks, h }; });
    return { cols, h:Math.max(0, ...cols.map(c2 => c2.h)) }; });
  const bodyTop = hd.bodyY; const avail = y1 - bodyTop; const nat = built.reduce((a, r) => a + r.h, 0) + rowGap * Math.max(0, built.length - 1);
  const extra = avail - nat; const overflow = extra < -.5; const gapAdd = extra > 0 && built.length > 1 ? Math.min(12, extra * .4 / (built.length - 1)) : 0;
  let y = bodyTop, bottom = y, gi = 0;
  built.forEach((r, ri) => { let cx = x0;
    for(const col of r.cols){ let yy = y;
      col.blocks.forEach((b, bi) => { const grp = { id:'part-' + (++gi), title:b.t, els:[] };
        b.bs.forEach((k, ki) => { grp.els.push(...k.draw(cx, yy, col.w, 0)); yy += k.h; if(ki < b.bs.length - 1) yy += k.kind === 'sub' ? subGap : inGap; });
        groups.push(grp); if(bi < col.blocks.length - 1) yy += rowGap; });
      bottom = Math.max(bottom, yy); cx += col.w + colGap; }
    y += r.h + (ri < built.length - 1 ? rowGap + gapAdd : 0); });
  if(overflow) issues.push({ id:'overflow', lv:'err', msg:`원고가 한 쪽에 다 들어가지 않습니다 (${Math.round(-extra)}pt 넘침). 분량 조정이 필요합니다.` });
  const kinds = new Set(built.flatMap(r => r.cols.flatMap(c2 => c2.blocks.flatMap(b => b.bs.map(k => k.kind)))));
  const bodySizes = new Set(); for(const gr of groups) if(/^part-\d+$/.test(gr.id)) for(const e of gr.els) if(e.t === 'text' && !e.skip && e.role !== 'num') bodySizes.add(r1(e.size)); else if(e.t === 'table') bodySizes.add(r1(e.size));
  const chars = [...pg.st.lead, ...subs.flatMap(s => [s.head || '', ...s.items.flatMap(i => [i.text, ...(i.kids || []).map(k => k.text)]), ...s.tables.flat(2)]), ...concs].join('').replace(/\s/g, '').length;
  const m = { use:avail > 0 ? (bottom - bodyTop) / avail : 1, steps:bodySizes.size, struct:['table','cards','flow','hub','kpi','timeline','vs','photo','notes'].some(k => kinds.has(k)), msg:!!pg.st.lead.length, sub:subs.some(s => s.head), evalOk:!!evalOf(pg), chars, body:tk.size.body };
  return { n:pg.n, w:W, h:H, bleed:G.bleed, bg:c.page, groups, issues, level, overflow, slack:Math.max(0, extra), m, pats:['plan'], tk, style:{ ...style, plan:true }, fontStep:0, plan:true };
}
function planCompose(n, tk){
  const P = D.plans?.[n], kit = refKit(); if(!P?.plan || !kit) return null; const pg = msPage(n); if(!pg || pg.divider) return null;
  let best = null; for(const lv of [0, 1, 2, 3]){ const r = planOnce(pg, tk, P.plan, kit, lv); best = r; if(!r.overflow) break; }
  if(best.overflow) return null; best.quality = pageQuality(best, pg); return best;
}

// ───────────── Claude 호출: 키트(레퍼런스당 한 번)·쪽 설계(쪽당 한 번)
const refKit = () => refOn()?.kit || null;
let PLAN_SHEET = null;
async function refSheet(){
  const refs = D.assets.refs, sig = refs.map(r => r.name).join('|'); if(PLAN_SHEET?.sig === sig) return PLAN_SHEET.blob;
  const ims = (await Promise.all(refs.flatMap(r => r.thumbs || []).slice(0, 4).map(u => loadImg(u)))).filter(Boolean); if(!ims.length) return null;
  const blob = await growSheet(ims); PLAN_SHEET = { sig, blob }; return blob;
}
function planSig(pg, kit){ return JSON.stringify([kit, pg.title, pg.st.lead, pg.st.subs.map(s => [s.head, s.items.length, s.tables.length]), pg.pics.length, (pg.st.concs || []).length, D.grid?.w, D.grid?.h]); }
function planValidate(raw, pg){
  const need = []; if(pg.st.lead.length) need.push('lead'); pg.st.subs.forEach((_, i) => need.push('s' + i)); if(pg.pics.length) need.push('pics'); if((pg.st.concs || (pg.st.conc ? [1] : [])).length) need.push('conc');
  const seen = new Set(); const rows = [];
  for(const r of Array.isArray(raw?.rows) ? raw.rows : []){
    const cols = []; for(const c of Array.isArray(r?.cols) ? r.cols.slice(0, 3) : []){
      const items = []; for(const it of Array.isArray(c?.items) ? c.items : []){ const src = String(it?.src || ''); if(!need.includes(src) || seen.has(src)) continue; seen.add(src);
        let kind = String(it.kind || ''); if(src.startsWith('s')){ const ks = planSubKinds(pg.st.subs[+src.slice(1)]); if(!ks.includes(kind)) kind = ks.includes('cards') ? 'cards' : 'list'; }
        items.push({ src, kind, cols:it.cols ? clamp(Math.round(+it.cols), 1, 4) : null }); }
      if(items.length) cols.push({ w:clamp(+c.w || 1 / (r.cols.length || 1), .2, 1), items }); }
    if(cols.length) rows.push({ cols }); }
  // 빠진 것은 원래 순서 자리에 전체 폭으로
  for(const src of need) if(!seen.has(src)){ const kind = src === 'lead' ? 'msg' : src === 'pics' ? 'photos' : src === 'conc' ? 'conc' : (planSubKinds(pg.st.subs[+src.slice(1)]).includes('cards') ? 'cards' : 'list');
    const at = rows.findIndex(r => r.cols.some(c => c.items.some(x => need.indexOf(x.src) > need.indexOf(src)))); const row = { cols:[{ w:1, items:[{ src, kind, cols:null }] }] }; if(at < 0) rows.push(row); else rows.splice(at, 0, row); }
  return { rows };
}
async function ensurePlan(n, onStep){
  const kit = refKit(); if(!kit || !S.sample) return false; const pg = msPage(n); if(!pg || pg.divider) return false;
  D.plans ||= {}; const sig = planSig(pg, kit); if(D.plans[n]?.sig === sig) return true;
  if(D.plans[n]?.busy) return D.plans[n].busy;
  const job = (async () => {
    onStep?.(`Claude가 ${n}쪽을 레퍼런스에 맞춰 설계하는 중…`);
    const tk = D.guide?.tk || tokens(); const G = tk.grid; const size = { w:G.w - G.ml - G.mr, h:G.h - G.mb - G.bodyTop - 20 };
    try{ const img = S.imgLimits ? await refSheet() : null;
      const raw = await S.sample.json(PLAN_PROMPT(kit, planContent(pg), size), img ? { images:[img] } : undefined);
      D.plans[n] = { sig, plan:planValidate(raw, pg), note:String(raw?.note || '').slice(0, 80) }; return true; }
    catch(e){ console.warn('plan', e); D.plans[n] = { sig, plan:null, err:true }; return false; }
  })();
  D.plans[n] = { ...(D.plans[n] || {}), busy:job }; return job;
}
// 키트 읽기(analyzeRefs 뒤에): 레퍼런스 쪽 모음 한 장 → kit
async function analyzeKit(){
  const T = D.refTraits; if(!T || T.kit || !S.sample || !S.imgLimits) return;
  const ths = D.assets.refs.flatMap(r => r.thumbs || []).slice(0, 4); if(!ths.length) return;
  try{ const raw = await S.sample.json(KIT_PROMPT(ths.length), { images:[await refSheet()] }); const kit = kitClean(raw); if(kit && D.refTraits === T){ T.kit = kit; if(!T.note && raw?.note) T.note = String(raw.note).slice(0, 70); } }
  catch(e){ console.warn('ref kit', e); }
}
