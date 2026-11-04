'use strict';
// ═════════════════════════════ 디자인 모드 · 디자인 시스템과 쪽 배치
// ───────────── 내장 무드 3개
const MOODS = {
  navy:{ name:'공공 네이비', primary:'#1F3A68', point:'#2E7BC4', accent:'#E0782B', ink:'#1D232B', ink2:'#4B5562', header:'panel', icon:'light',
    primaries:['#1F3A68','#23497F','#173054','#2D4A7A','#0F4C81','#3B4F7A'], accents:['#E0782B','#D9A21B','#C8402E','#2E9C7A','#7A4FB5','#2E7BC4'] },
  green:{ name:'그린', primary:'#1E6B52', point:'#3C9E7A', accent:'#D98A22', ink:'#1B2621', ink2:'#4A5750', header:'plain', icon:'light',
    primaries:['#1E6B52','#24745A','#2F7D4F','#16594A','#3A7A3A','#1F6F6B'], accents:['#D98A22','#E0782B','#C8402E','#2E7BC4','#B8962E','#7A4FB5'] },
  mono:{ name:'모노', primary:'#2E3338', point:'#5C6670', accent:'#C8372D', ink:'#1A1D20', ink2:'#50575E', header:'line', icon:'light',
    primaries:['#2E3338','#3A3F45','#1F2328','#44494F','#2B3440','#3B3B3B'], accents:['#C8372D','#E0782B','#2E7BC4','#1E8A5A','#D9A21B','#7A4FB5'] },
};
const STYLE_A = { sub:'A', card:'A', table:'A', flow:'A', hub:'A', kpi:'A', timeline:'A', vs:'A' };
const STYLE_B = { sub:'B', card:'B', table:'B', flow:'B', hub:'B', kpi:'B', timeline:'B', vs:'B' };

function tokens(over){
  const m = MOODS[over?.mood || D.mood] || MOODS.navy; const L = locks();
  const prim = (over?.colors || D.colors).primary || m.primary, acc = (over?.colors || D.colors).accent || m.accent;
  const G = D.grid || DEFAULT_GRID();
  const body = Math.max(11, L.bodyMin || 0), fig = Math.max(9, L.figMin || L.bodyMin || 0);   // 표·그림 하한이 따로 없으면 본문 하한을 모든 글자에
  const c = { p0:mix(prim, '#000000', .28), p1:prim, p2:mix(prim, '#FFFFFF', .88), p3:mix(prim, '#FFFFFF', .55), bg:'#FFFFFF', bg2:mix(prim, '#FFFFFF', .95),
    line:mix(prim, '#FFFFFF', .7), point:prim !== m.primary ? mix(prim, '#FFFFFF', .3) : m.point, accent:acc, ink:m.ink, ink2:m.ink2, white:'#FFFFFF',
    page:'#FFFFFF', note:mix(prim, '#FFFFFF', .9), gray:mix(m.ink, '#FFFFFF', .92), thead:mix(prim, '#FFFFFF', .9), shadow:mix(m.ink, '#FFFFFF', .86), accL:mix(acc, '#FFFFFF', .3) };
  c.onP1 = contrast('#FFFFFF', prim) >= 4.5 ? '#FFFFFF' : m.ink;
  return { mood:over?.mood || D.mood, moodName:m.name, header:m.header, iconTone:m.icon, grid:G,
    size:{ title:body + 7, sub:body + 2.5, msg:body + 3.5, body, table:Math.max(fig, 10.5), caption:Math.max(fig, 9), head:Math.max(fig, 11), evalNo:Math.max(fig, 15), kpi:Math.max(24, body * 2), pno:Math.max(fig, 9.5) },
    lh:1.6, r:4, color:c, fonts:{ ...D.roles }, locks:L,
    // 레퍼런스 성향(켜져 있을 때만): 밀도 → 묶음 간격, 색 면적 → 카드·헤드 메시지·라벨 열 바탕, 아이콘 사용
    // 레퍼런스가 없으면 내장 기본값(제출본 측정: 색 면적 9~12% → 옅은 바탕을 기본으로)
    ref:(t => t ? { dens:t.density, rich:t.colorUse !== 'minimal', icon:t.comp ? t.comp.icon > 0 : true } : { dens:'mid', rich:true, icon:true, base:true })(over?.ref === undefined ? refOn() : over.ref) };
}
function allowedSizes(tk){ return [...new Set(Object.values(tk.size))].sort((a,b) => a-b); }
function paletteOf2(tk){ return [...new Set(Object.values(tk.color))]; }

// ───────────── 아이콘(24 격자, 선 아이콘). 모든 쪽이 같은 세트를 씁니다.
const ICONS = {
  truck:[['r',2,7,11,9,1],['p','M13 10h4l3 3.2V16h-7z'],['c',6.5,17.8,1.9],['c',16.5,17.8,1.9]],
  people:[['c',9,8,3],['p','M3.5 19.5c0-3.2 2.5-5.5 5.5-5.5s5.5 2.3 5.5 5.5'],['c',16.5,9,2.3],['p','M16.5 13.6c2.4 0 4.3 1.8 4.3 4.6']],
  calendar:[['r',3,5,18,16,2],['l',3,10,21,10],['l',8,3,8,7],['l',16,3,16,7],['r',7,13,3.5,3.5,.6]],
  shield:[['p','M12 3l7.5 3v5.5c0 4.6-3.2 8.2-7.5 9.5c-4.3-1.3-7.5-4.9-7.5-9.5V6z'],['p','M8.5 12l2.4 2.4l4.6-4.8']],
  chat:[['p','M4.5 5h15a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-8.5l-4.5 3.5V16H4.5A1.5 1.5 0 0 1 3 14.5v-8A1.5 1.5 0 0 1 4.5 5z'],['l',7.5,9.5,16.5,9.5],['l',7.5,12.5,13,12.5]],
  building:[['r',4,4,10,17,1],['p','M14 10h6v11h-6'],['p','M7 8h1.5M10 8h1.5M7 11.5h1.5M10 11.5h1.5M7 15h1.5M10 15h1.5M16.5 13.5h1M16.5 17h1'],['l',2.5,21,21.5,21]],
  leaf:[['p','M5 19c0-8 5.5-13.5 14-14c.5 8.5-5 14-13 14z'],['p','M5 19l8-8']],
  check:[['r',5,4,14,17,2],['r',9,2.5,6,3,1],['p','M8.5 13l2.3 2.3l4.7-4.8']],
  book:[['p','M3 5.5c3-1 6-1 9 1c3-2 6-2 9-1v13c-3-1-6-1-9 1c-3-2-6-2-9-1z'],['l',12,6.5,12,19.5]],
  medal:[['c',12,9,5.5],['p','M8.5 13.5L7 21l5-2.5l5 2.5l-1.5-7.5'],['p','M9.8 9l1.6 1.6L14.4 7.6']],
  monitor:[['r',3,4,18,12,1.5],['l',9,20,15,20],['l',12,16,12,20]],
  coin:[['c',12,12,8.5],['p','M8 8.5l2 7l2-5l2 5l2-7'],['l',7.5,11.5,16.5,11.5]],
  doc:[['p','M6 3h8l4 4v14H6z'],['p','M14 3v4h4'],['l',8.5,12,15.5,12],['l',8.5,15.5,15.5,15.5]],
  pin:[['p','M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z'],['c',12,10,2.3]],
  clock:[['c',12,12,8.5],['p','M12 7.5V12l3 2']],
  gear:[['c',12,12,3],['c',12,12,6.5],['p','M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1']],
  target:[['c',12,12,8.5],['c',12,12,5],['c',12,12,1.6]],
  chart:[['l',4,20,20,20],['r',6,12,3,8,.5],['r',10.5,8,3,12,.5],['r',15,4.5,3,15.5,.5]],
  alert:[['p','M12 4L21 19.5H3z'],['l',12,10,12,14],['l',12,16.8,12,16.9]],
  recycle:[['p','M19 12a7 7 0 0 1-12.2 4.7'],['p','M5 12a7 7 0 0 1 12.2-4.7'],['p','M17.6 3.6v3.8h-3.8'],['p','M6.4 20.4v-3.8h3.8']],
  broom:[['l',16,3,11,12],['p','M7 12h7.5l2 8.5H5z'],['l',9.2,15,8.7,20.5],['l',12.2,15,12.5,20.5]],
  phone:[['p','M5 4h3.5l1.5 4.5l-2.2 1.4a11 11 0 0 0 6.3 6.3l1.4-2.2L20 15.5V19a1 1 0 0 1-1 1C10.7 20 4 13.3 4 5a1 1 0 0 1 1-1z']],
  meeting:[['c',12,7,2.6],['c',5.5,10,2],['c',18.5,10,2],['r',4,14,16,3,1],['l',7,17,6,21],['l',17,17,18,21]],
  bin:[['l',5,7,19,7],['p','M9.5 7V4.5h5V7'],['p','M6.5 7l1 13.5h9l1-13.5'],['l',10.5,10.5,10.5,17.5],['l',13.5,10.5,13.5,17.5]],
  route:[['c',6,18,2],['c',18,6,2],['p','M8 18h6.5a3.5 3.5 0 0 0 0-7h-5a3.5 3.5 0 0 1 0-7H16']],
  dot:[['c',12,12,8.5],['p','M8.5 12l2.4 2.4l4.6-4.8']],
};
const ICON_NAMES = { truck:'차량', people:'인력', calendar:'일정', shield:'안전', chat:'민원', building:'시설', leaf:'환경', check:'점검', book:'교육', medal:'품질',
  monitor:'정보 시스템', coin:'비용', doc:'문서', pin:'위치', clock:'시간', gear:'장비', target:'목표', chart:'실적', alert:'비상', recycle:'재활용', broom:'청소', phone:'연락', meeting:'회의', bin:'폐기물', route:'노선', dot:'확인' };
const ICON_TOPICS = {
  '차량':{ re:/차량|수거차|진개차|운반|운행|트럭/, icon:'truck' }, '인력':{ re:/인력|인원|작업자|직원|운전원|미화원|근로자|조직/, icon:'people' },
  '안전':{ re:/안전|사고|보호구|예방|무사고/, icon:'shield' }, '민원':{ re:/민원|주민|의견|간담회|소통|만족도/, icon:'chat' },
  '교육':{ re:/교육|훈련|연수/, icon:'book' }, '점검':{ re:/점검|확인|검사|모니터링/, icon:'check' }, '일정':{ re:/일정|연간|월간|착수|완료|기간/, icon:'calendar' },
  '시간':{ re:/시간|당일|신속|즉시|24시/, icon:'clock' }, '환경':{ re:/환경|친환경|온실가스|탄소|녹색/, icon:'leaf' }, '재활용':{ re:/재활용|분리배출|자원/, icon:'recycle' },
  '폐기물':{ re:/폐기물|쓰레기|무단\s?투기|배출/, icon:'bin' }, '청소':{ re:/청소|청결|정리|미화/, icon:'broom' }, '정보 시스템':{ re:/시스템|위치\s?확인|전산|앱|GPS|장치|데이터|자동/, icon:'monitor' },
  '시설':{ re:/시설|건물|처리장|센터|사무실/, icon:'building' }, '구역':{ re:/구역|지역|노선|동\b/, icon:'pin' }, '장비':{ re:/장비|정비|차량\s?점검/, icon:'gear' },
  '비용':{ re:/예산|비용|원가|절감/, icon:'coin' }, '문서':{ re:/보고|기록|일지|서류|안내문|매뉴얼/, icon:'doc' }, '목표':{ re:/목표|전략|방향|비전|달성/, icon:'target' },
  '실적':{ re:/실적|성과|처리량|지표/, icon:'chart' }, '비상':{ re:/비상|위험|폭염|한파|결빙|재난/, icon:'alert' }, '연락':{ re:/연락|전화|콜센터|신고/, icon:'phone' }, '회의':{ re:/회의|협의|협력/, icon:'meeting' },
};
function topicOf(text){ for(const [t, v] of Object.entries(ICON_TOPICS)) if(v.re.test(text)) return t; return null; }
function iconFor(topic){ const m = D.iconMap[topic]; if(m && m.startsWith('file:')) return m; return m || ICON_TOPICS[topic]?.icon || 'dot'; }
function iconPathD(name){
  const P = ICONS[name] || ICONS.dot; let d = '';
  for(const p of P){
    if(p[0] === 'c'){ const [, cx, cy, r] = p; d += `M${cx-r} ${cy}a${r} ${r} 0 1 0 ${2*r} 0a${r} ${r} 0 1 0 ${-2*r} 0`; }
    else if(p[0] === 'l'){ const a = p.slice(1); d += `M${a[0]} ${a[1]}`; for(let i=2;i<a.length;i+=2) d += `L${a[i]} ${a[i+1]}`; }
    else if(p[0] === 'r'){ const [, x, y, w, h, r] = p; const k = Math.min(r || 0, w/2, h/2); d += k ? `M${x+k} ${y}H${x+w-k}a${k} ${k} 0 0 1 ${k} ${k}V${y+h-k}a${k} ${k} 0 0 1 ${-k} ${k}H${x+k}a${k} ${k} 0 0 1 ${-k} ${-k}V${y+k}a${k} ${k} 0 0 1 ${k} ${-k}z` : `M${x} ${y}h${w}v${h}h${-w}z`; }
    else d += p[1];
  }
  return d;
}
function iconSvg(name, fg, bg){
  if(name.startsWith('file:')){ const f = D.assets.icons.find(i => 'file:' + i.name === name); if(f) return null; }
  const d = iconPathD(name);
  return bg ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="${bg}"/><path transform="translate(4 4)" d="${d}" fill="none" stroke="${fg}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${d}" fill="none" stroke="${fg}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
function iconDataURL(name, fg, bg){
  if(name.startsWith('file:')){ const f = D.assets.icons.find(i => 'file:' + i.name === name); if(f) return f.url; name = 'dot'; }
  return 'data:image/svg+xml;base64,' + b64utf8(iconSvg(name, fg, bg));
}

// ───────────── 글자 재기
const MC = document.createElement('canvas').getContext('2d');
const roleKey = role => role === 'title' ? D.roles.title : role === 'num' ? (D.roles.num || D.roles.title) : D.roles.body;
function tw(text, role, weight, size){ MC.font = cssFont(roleKey(role), weight, size); return MC.measureText(text).width; }
const MET = {};
function vmet(role, weight){ const k = roleKey(role) + ':' + weight; if(MET[k]) return MET[k]; MC.font = cssFont(roleKey(role), weight, 100); const m = MC.measureText('가나다');
  return MET[k] = { a:(m.actualBoundingBoxAscent || 80) / 100, d:(m.actualBoundingBoxDescent || 10) / 100 }; }
function resetMetrics(){ for(const k in MET) delete MET[k]; }
// 어절 단위로 줄을 나눔. 한 어절이 줄보다 길 때만 글자 단위로 자름.
function wrap(text, width, role, weight, size){
  const words = String(text).replace(/\s+/g, ' ').trim().split(' '); const lines = []; let cur = '';
  const fits = s => tw(s, role, weight, size) <= width + .01;
  for(const w of words){
    const t = cur ? cur + ' ' + w : w;
    if(fits(t)){ cur = t; continue; }
    if(cur){ lines.push(cur); cur = ''; }
    if(fits(w)){ cur = w; continue; }
    let part = ''; for(const ch of w){ if(fits(part + ch)) part += ch; else { if(part) lines.push(part); part = ch; } } cur = part;
  }
  if(cur) lines.push(cur);
  // 마지막 줄이 한두 글자만 남으면 앞줄에서 한 어절 내려 균형
  if(lines.length >= 2 && lines[lines.length-1].length <= 2){ const prev = lines[lines.length-2].split(' '); if(prev.length > 1){ const mv = prev.pop(); const nl = mv + ' ' + lines[lines.length-1]; if(fits(nl)){ lines[lines.length-2] = prev.join(' '); lines[lines.length-1] = nl; } } }
  return lines.length ? lines : [''];
}
const maxLineW = (lines, role, weight, size) => Math.max(0, ...lines.map(l => tw(l, role, weight, size)));

// ───────────── 장면 요소
const E = {
  rect:(x, y, w, h, o = {}) => ({ t:'rect', x, y, w, h, ...o }),
  ell:(x, y, w, h, o = {}) => ({ t:'ellipse', x, y, w, h, ...o }),
  line:(x1, y1, x2, y2, o = {}) => ({ t:'line', x1, y1, x2, y2, ...o }),
  poly:(pts, o = {}) => ({ t:'poly', pts, ...o }),
  img:(x, y, w, h, o = {}) => ({ t:'img', x, y, w, h, ...o }),
  icon:(x, y, s, name, o = {}) => ({ t:'icon', x, y, s, name, ...o }),
};
function T(lines, x, y, w, o){ const lh = o.lh || o.size * 1.6; return { t:'text', lines, x, y, w, h:lines.length * lh, lh, size:o.size, weight:o.weight || 400, role:o.role || 'body', color:o.color, align:o.align || 'left', skip:!!o.skip, suffix:o.suffix || null }; }
function textBox(text, x, y, w, o){ const lines = wrap(text, w, o.role || 'body', o.weight || 400, o.size); return T(lines, x, y, w, o); }

// ───────────── 원고 문단의 형태 판별 → 인포그래픽 패턴 후보
const PATTERNS = {
  list:{ name:'불릿', big:false, kind:'card' }, enum:{ name:'구분 카드', big:false, kind:'card' }, cards:{ name:'카드', big:false, kind:'card' }, ltable:{ name:'라벨 표', big:false, kind:'table' },
  table:{ name:'표', big:false, kind:'table' }, kpi:{ name:'KPI 타일', big:false, kind:'card' }, flow:{ name:'흐름', big:true, kind:'diagram' },
  cycle:{ name:'순환', big:true, kind:'diagram' }, hub:{ name:'허브', big:true, kind:'diagram' }, timeline:{ name:'타임라인', big:true, kind:'diagram' },
  vs:{ name:'VS 대비', big:true, kind:'diagram' },
};
const NUM_UNIT = /(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(%|명|대|건|톤|개소|개|회|일|시간|분|km|㎡|m2|억\s?원|만\s?원|천\s?원|원|곳|년|개월|배|점|t)(?![가-힣A-Za-z])/;
const TIME_RE = /^(매일|매주|매월|매분기|매년|연도별|분기별?|반기별?|월\s*\d+\s*회|주\s*\d+\s*회|연\s*\d+\s*회|(?:20)?\d{2,4}\s*년(?:\s*\d{1,2}\s*월)?|\d{1,2}\s*월|\d+\s*차\s*년도|\d+\s*분기|\d+\s*주\s*차|[상하]\s*반기|착수|중간|완료|준비|1단계|2단계|3단계)\s*[:：]?\s*/;
function stepsOf(sub){
  const its = sub.items.filter(i => !i.note);
  const lab = its.map(i => i.text.match(/^((?:\d+|[①-⑩])\s*단계|STEP\s*\d+|Step\s*\d+|단계\s*\d+|[①-⑩])\s*[:：.]?\s*/));
  if(its.length >= 3 && lab.filter(Boolean).length >= Math.ceil(its.length * .6)) return { steps:its.map((i, k) => lab[k] ? { label:lab[k][1].trim(), text:i.text.slice(lab[k][0].length).trim() } : { label:'', text:i.text }), rest:[], via:'items' };
  // 「A, B, C 순으로/단계로 진행」 문장: 쉼표로 나눈 짧은 말들을 단계로(글자는 원고 그대로)
  for(let k = 0; k < its.length; k++){ const m = its[k].text.match(/^(.*?)((?:[^,，]{2,18}[,，]\s*){2,6}[^,，]{2,18}?)\s*(?:의\s*)?(순으로|순서로|단계로|절차로|순서를\s*거쳐|과정으로)/);
    if(m){ const parts = m[2].split(/[,，]\s*/).map(x => x.trim()).filter(Boolean); if(parts[0]){ const q = parts[0].replace(/^.*?[은는]\s+/, ''); if(q.length >= 2) parts[0] = q; } if(parts.length >= 3 && parts.every(p => p.length <= 18)) return { steps:parts.map(p => ({ label:'', text:p })), rest:its, via:'seq', keep:true }; } }
  const arr = its.findIndex(i => (i.text.match(/\s*(→|⇒|➔|➡|->)\s*/g) || []).length >= 2);
  if(arr >= 0){ const parts = its[arr].text.split(/\s*(?:→|⇒|➔|➡|->)\s*/).map(s => s.trim()).filter(Boolean);
    if(parts.length >= 3 && parts.length <= 8 && parts.every(p => p.length <= 24)) return { steps:parts.map(p => ({ label:'', text:p })), rest:its.filter((_, k) => k !== arr), via:'arrow' }; }
  return null;
}
function timelineOf(sub){ const its = sub.items.filter(i => !i.note); if(its.length < 3 || its.length > 10) return null;
  const m = its.map(i => i.text.match(TIME_RE)); if(m.filter(Boolean).length < Math.ceil(its.length * .7)) return null;
  return its.map((i, k) => m[k] ? { label:m[k][1].trim(), text:i.text.slice(m[k][0].length).trim() } : { label:'', text:i.text }); }
function kpiOf(sub){ const its = sub.items.filter(i => !i.note); if(its.length < 2 || its.length > 6) return null;
  const out = []; for(const i of its){ if(i.text.length > 52 || (i.kids || []).length) return null; const all = i.text.match(new RegExp(NUM_UNIT.source, 'g')) || []; if(all.length !== 1) return null;
    const m = i.text.match(NUM_UNIT); const label = (i.text.slice(0, m.index) + i.text.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim(); if(!label) return null;
    out.push({ value:m[1], unit:m[2].replace(/\s/g, ''), label, text:i.text }); }
  return out; }
function labelPairs(sub){ const its = sub.items.filter(i => !i.note); if(its.length < 2) return null;
  const m = its.map(i => i.text.match(/^(.{1,16}?)(?<!\d)\s*[:：]\s*(?!\d)(.+)$/)); if(m.some(x => !x)) return null; return m.map(x => [x[1].trim(), x[2].trim()]); }
function enumOf(sub){ const its = sub.items.filter(i => !i.note);
  for(const it of its){ const ms = [...it.text.matchAll(/([가-힣A-Za-z0-9·\s]{2,16}?)\s*\(([^()]{2,40})\)/g)];
    if(ms.length >= 3 && ms.length <= 6){ const parts = ms.map(m => ({ title:m[1].replace(/^[,，\s]+|^(및|또는|와|과)\s+/g, '').trim(), desc:m[2].trim() })); if(parts.every(p => p.title.length >= 2 && p.title.length <= 14)) return { item:it, parts }; } }
  return null; }
function hubOk(sub){ const its = sub.items.filter(i => !i.note); return !!sub.head && its.length >= 3 && its.length <= 6 && its.every(i => i.text.length <= 28 && !(i.kids || []).length) &&
  (/(위한|위해|통한|향한|실현|달성)/.test(sub.head) && /(\d|세|네|다섯|여섯)\s*(가지|대|개)|전략|과제|방향|목표|원칙/.test(sub.head)); }
const CYCLE_RE = /순환|환류|PDCA|반복|재점검|다시\s*점검|피드백/;
function patCandidates(sub){
  const c = []; const its = sub.items.filter(i => !i.note); const avg = its.length ? its.reduce((a, i) => a + i.text.length, 0) / its.length : 0;
  if(sub.tables.length && !its.length) c.push(['table', 100]);
  const st = stepsOf(sub); if(st){ const cyc = CYCLE_RE.test((sub.head || '') + ' ' + its.map(i => i.text).join(' ')); c.push([cyc ? 'cycle' : 'flow', cyc ? 95 : 92]); if(cyc) c.push(['flow', 70]); }
  if(timelineOf(sub)) c.push(['timeline', 90]);
  if(enumOf(sub)) c.push(['enum', 84]);
  if(kpiOf(sub)) c.push(['kpi', 86]);
  if(hubOk(sub)) c.push(['hub', 84]);
  // 카드는 「제목 : 설명」이거나 짧은 구절일 때만. 「~함.」 같은 긴 문장은 개조식 목록으로
  const lp = labelPairs(sub); const kids = its.some(i => (i.kids || []).length); const sentence = its.filter(i => i.text.length > 34 && /[함음임다됨][.]?$/.test(i.text.trim())).length >= Math.ceil(its.length / 2);
  if(lp && its.length >= 2 && its.length <= 6 && kids) c.push(['cards', 82]);
  if(lp && its.length >= 3 && lp.every(p => p[0].length <= 14) && !kids) c.push(['ltable', 78]);
  if(lp && !kids && its.length >= 2 && its.length <= 4 && avg <= 130) c.push(['cards', 80]);
  if(its.length >= 2 && its.length <= 6 && avg <= 90 && !sentence) c.push(['cards', lp ? 66 : its.length >= 3 && avg <= 30 ? 60 : 45]);
  if(its.length) c.push(['list', sentence || avg > 60 || its.length === 1 || its.length > 6 ? 75 : 40]);
  if(!c.length) c.push(['list', 10]);
  // 레퍼런스가 자주 쓰는 구성은 점수를 올리고, 거의 안 쓰는 구성은 내림(0~3 → -9~+9)
  const R = refOn()?.comp; if(R){ const map = { table:'table', ltable:'table', cards:'cards', enum:'cards', flow:'flow', cycle:'flow', kpi:'kpi', timeline:'timeline' }; for(const x of c){ const k = map[x[0]]; if(k && R[k] != null) x[1] += (R[k] - 1.5) * 6; } }
  const seen = new Set(); return c.sort((a,b) => b[1]-a[1]).filter(([id]) => !seen.has(id) && seen.add(id)).map(([id, score]) => ({ id, score }));
}
const VS_L = /^(기존|현행|현황|종전|AS-?IS|문제|과거)/i, VS_R = /^(개선|향후|변경|TO-?BE|대책|제안|미래|해결)/i;
function vsPair(subs){ for(let i=0;i+1<subs.length;i++){ const a = subs[i], b = subs[i+1]; if(a.head && b.head && VS_L.test(a.head) && VS_R.test(b.head) && !a.tables.length && !b.tables.length && a.items.length && b.items.length) return i; } return -1; }
// 쪽마다 자동 패턴: 큰 도식은 1개, 배점 낮은 절은 표·카드 우선, 같은 패턴 3쪽 연속이면 두 번째 후보
function autoPatterns(){
  const out = {}; if(!D.ms) return out;
  const pages = contentPages(); const dens = pages.map(p => pageDensity(p.n)).filter(v => v > 0).sort((a,b) => a-b);
  const low = dens.length >= 3 ? dens[Math.max(0, Math.floor(dens.length / 3) - 1)] : -1;
  const hist = [];
  for(const pg of pages){
    const subs = pg.st.subs; const vi = vsPair(subs); const ids = []; let big = false;
    const lowP = low > 0 && pageDensity(pg.n) > 0 && pageDensity(pg.n) <= low;
    subs.forEach((s, i) => {
      if(vi >= 0 && (i === vi || i === vi + 1)){ ids.push(i === vi ? 'vs' : 'vs+'); big = true; return; }
      let cs = patCandidates(s).map(c => ({ ...c }));
      if(lowP) cs.forEach(c => { if(['hub','timeline'].includes(c.id)) c.score -= 30; }); cs.sort((a,b) => b.score - a.score);
      let pick = cs[0];
      if(PATTERNS[pick.id].big && big){ pick = cs.find(c => !PATTERNS[c.id].big) || pick; }
      if(PATTERNS[pick.id].big) big = true;
      ids.push(pick.id);
    });
    // 완성도: 쪽에 표·사진이 없고 모두 불릿이면, 도식 후보가 있는 소제목 하나를 도식으로
    if(!pg.pics.length && !subs.some(s => s.tables.length) && ids.every(id => id === 'list')){
      let bi = -1, bs = 0, bid = null; subs.forEach((s, i) => { const c = patCandidates(s).find(c => c.id !== 'list'); if(c && c.score > bs){ bs = c.score; bi = i; bid = c.id; } });
      if(bi >= 0) ids[bi] = bid; }
    const dom = ids.find(id => PATTERNS[id]?.big) || ids.find(id => id !== 'list') || 'list';
    if(hist.length >= 2 && hist[hist.length-1] === dom && hist[hist.length-2] === dom && dom !== 'list' && dom !== 'table'){
      const k = ids.indexOf(dom); const cs = patCandidates(subs[k]); const alt = cs.find(c => c.id !== dom && (!PATTERNS[c.id].big || !ids.some((x, j) => j !== k && PATTERNS[x]?.big)));
      if(alt) ids[k] = alt.id;
    }
    hist.push(ids.find(id => PATTERNS[id]?.big) || ids.find(id => id !== 'list') || 'list');
    out[pg.n] = ids;
  }
  return out;
}
function patternsFor(n){ const auto = (D._auto ||= autoPatterns())[n] || []; const ov = D.plan.pat[n] || {}; return auto.map((id, i) => ov[i] || id); }
function pageKind(n){ const ids = patternsFor(n); if(ids.some(id => PATTERNS[id]?.kind === 'diagram' || id === 'vs')) return 'diagram'; if(ids.some(id => PATTERNS[id]?.kind === 'table')) return 'table'; return 'card'; }

// ───────────── 쪽 배치: 블록을 쌓고, 남는 높이를 나눠 본문 끝선까지 채움
function makeCtx(tk, style, level){
  // level < 0 = 여유 배치(원고가 짧은 쪽): 줄 간격·상자 안 여백·간격을 조금씩 넓힘(상자를 비우며 늘리지는 않음)
  const fs = tk.size.body; const air = Math.max(0, -level); const lhm = level >= 4 ? 1.38 : level >= 2 ? 1.48 : 1.6 + .07 * air;
  return { tk, st:style, c:tk.color, fs, lh:fs * lhm, lhm, level, air, tf:tk.size.table, cf:tk.size.caption, r:tk.r,
    pad:level >= 2 ? 8 : 11 + 2 * air, gap:level >= 1 ? 8 : 10 + 2 * air, useIcons:level < 2 && (!tk.ref || tk.ref.icon) };
}
// 소제목: A = 세로 막대 + 굵은 글자, B = 두 자리 번호(01) + 굵은 글자
function blkSubtitle(text, C, W, num){
  const sz = C.tk.size.sub, A = C.st.sub !== 'B' || !num; const ind = A ? 11 : 26;
  const lines = wrap(text, W - ind, 'title', 700, sz); const lh = sz * 1.38, th = lines.length * lh;
  return { kind:'sub', h:th + 1, stretch:0, draw:(x, y) => A
    ? [E.rect(x, y + lh * .2, 3.5, lh * .6, { fill:C.c.p1, r:1.5 }), T(lines, x + ind, y, W - ind, { size:sz, weight:700, role:'title', color:C.c.ink, lh })]
    : [T([String(num).padStart(2, '0')], x, y, 24, { size:sz, weight:700, role:'num', color:C.c.p1, lh, skip:true }), T(lines, x + ind, y, W - ind, { size:sz, weight:700, role:'title', color:C.c.ink, lh })] };
}
// 헤드 메시지: 머리틀 바로 아래, 옅은 바탕 + 왼쪽 굵은 선 + 굵은 문장(왼쪽 정렬)
function blkHeadMsg(texts, C, W){
  const sz = C.tk.size.msg, lh = sz * 1.45; const pad = 12 + 2 * (C.air || 0), padL = 20, padR = 16;
  const lines = texts.flatMap(t => wrap(t, W - padL - padR, 'title', 700, sz)); const h = lines.length * lh + pad * 2;
  return { kind:'msg', h, stretch:0, draw:(x, y) => [E.rect(x, y, W, h, { fill:C.tk.ref?.rich ? C.c.note : C.c.bg2 }), E.rect(x, y, 4.5, h, { fill:C.c.p1 }),
    T(lines, x + padL, y + pad, W - padL - padR, { size:sz, weight:700, role:'title', color:C.c.p0, lh })] };
}
function blkNotes(notes, C, W){
  const pad = 11, ind = 11; const rows = notes.map(n => wrap(n.text.replace(/^\s*※\s*/, ''), W - pad * 2 - ind, 'body', 400, C.fs));
  const h = rows.reduce((a, l) => a + l.length * C.lh, 0) + 5 * (rows.length - 1) + pad * 2;
  return { kind:'notes', h, stretch:0, draw:(x, y) => { const out = [E.rect(x, y, W, h, { fill:C.c.note, r:6 })]; let yy = y + pad;
    for(const l of rows){ out.push(E.ell(x + pad + 1, yy + C.lh / 2 - 1.6, 3.2, 3.2, { fill:C.c.ink2 })); out.push(T(l, x + pad + ind, yy, W - pad * 2 - ind, { size:C.fs, color:C.c.ink, lh:C.lh })); yy += l.length * C.lh + 5; }
    return out; } };
}
// ⇒ 핵심 실행 사항: 왼쪽 세로 꼬리표(핵심 실행) + 오른쪽 목록. 한 줄이면 굵게
function blkConc(concs, C, W){
  const pad = 12, lab = 54, ind = 11; const one = concs.length === 1; const sz = one ? C.fs + 1 : C.fs, lh = one ? sz * 1.5 : C.lh;
  const tW = W - lab - pad * 2 - (one ? 0 : ind); const rows = concs.map(t => wrap(t, tW, one ? 'title' : 'body', one ? 700 : 500, sz));
  const h = Math.max(46, rows.reduce((a, l) => a + l.length * lh, 0) + 4 * (rows.length - 1) + pad * 2); const ls = C.fs, llh = ls * 1.3;
  return { kind:'conc', h, stretch:0, draw:(x, y) => { const out = [E.rect(x, y, W, h, { fill:'#FFFFFF', stroke:C.c.p1, sw:1 }), E.rect(x, y, lab, h, { fill:C.c.p1 }),
      T(['핵심', '실행'], x, y + (h - llh * 2) / 2, lab, { size:ls, weight:700, role:'title', color:C.c.onP1, lh:llh, align:'center', skip:true })];
    let yy = y + (h - (rows.reduce((a, l) => a + l.length * lh, 0) + 4 * (rows.length - 1))) / 2; const tx = x + lab + pad;
    for(const l of rows){ if(!one) out.push(E.rect(tx + 1, yy + lh / 2 - 2, 4, 4, { fill:C.c.p1 })); out.push(T(l, tx + (one ? 0 : ind), yy, tW, { size:sz, weight:one ? 700 : 500, role:one ? 'title' : 'body', color:one ? C.c.p0 : C.c.ink, lh })); yy += l.length * lh + 4; }
    return out; } };
}
function blkList(items, C, W){
  const ind = 13, kidInd = 26, rows = [];
  for(const it of items){
    const note = it.note; const sz = note ? Math.max(C.cf, C.fs - 1) : C.fs;
    rows.push({ k:note ? 'note' : it.plain ? 'para' : 'item', lines:wrap(it.text, W - (note || it.plain ? 0 : ind), 'body', 400, sz), sz });
    for(const k of (it.kids || [])) rows.push({ k:k.note ? 'note' : 'kid', lines:wrap(k.text, W - kidInd, 'body', 400, k.note ? Math.max(C.cf, C.fs - 1) : C.fs), sz:k.note ? Math.max(C.cf, C.fs - 1) : C.fs });
  }
  const g = 4 + 2 * (C.air || 0); const nat = rows.reduce((a, r) => a + r.lines.length * (r.sz === C.fs ? C.lh : r.sz * 1.5), 0) + g * Math.max(0, rows.length - 1);
  return { kind:'list', h:nat, stretch:Math.max(0, rows.length - 1) * 10, draw:(x, y, _w, ex = 0) => {
    const out = []; const gg = g + (rows.length > 1 ? ex / (rows.length - 1) : 0); let yy = y;
    for(const r of rows){ const lh = r.sz === C.fs ? C.lh : r.sz * 1.5;
      if(r.k === 'item'){ out.push(E.ell(x + 2, yy + lh / 2 - 2.4, 4.8, 4.8, { fill:C.c.point })); out.push(T(r.lines, x + ind, yy, W - ind, { size:r.sz, color:C.c.ink, lh })); }
      else if(r.k === 'kid'){ out.push(E.line(x + ind + 2, yy + lh / 2, x + ind + 7, yy + lh / 2, { stroke:C.c.ink2, sw:1 })); out.push(T(r.lines, x + kidInd, yy, W - kidInd, { size:r.sz, color:C.c.ink2, lh })); }
      else if(r.k === 'para') out.push(T(r.lines, x, yy, W, { size:r.sz, color:C.c.ink, lh }));
      else out.push(T(r.lines, x, yy, W, { size:r.sz, color:C.c.ink2, lh }));
      yy += r.lines.length * lh + gg; }
    return out; } };
}
function splitTitle(t){ const m = t.match(/^(.{2,22}?)(?<!\d)\s*[:：]\s*(?!\d)(.+)$/); if(m) return { title:m[1].trim(), desc:m[2].trim() }; if(t.length <= 16) return { title:t, desc:'' }; return { title:'', desc:t }; }
const check = (x, y, c) => [E.line(x, y + 3.2, x + 2.6, y + 5.8, { stroke:c, sw:1.4 }), E.line(x + 2.6, y + 5.8, x + 7.4, y, { stroke:c, sw:1.4 })];
function blkCards(items, C, W){
  const its = items.filter(i => !i.note); const n = its.length; const short = its.every(i => i.text.length <= 24 && !(i.kids || []).length); const cols = n <= 2 ? n : n === 4 ? (short ? 4 : 2) : 3; const gap = 10;
  const cw = (W - gap * (cols - 1)) / cols, pad = 12 + 2 * (C.air || 0), A = C.st.card !== 'B';
  const parts = its.map(i => ({ ...splitTitle(i.text), kids:i.kids || [], topic:topicOf(i.text) }));
  const icons = C.useIcons && parts.filter(p => p.topic).length >= Math.ceil(n / 2); const isz = 24; const ts = C.fs + 1;
  const cards = parts.map(p => {
    const tx = pad + (icons ? isz + 9 : 0); const tW = cw - tx - pad;
    const tl = p.title ? wrap(p.title, tW, 'title', 700, ts) : [];
    const bl = [...(p.title && p.desc ? [p.desc] : []), ...p.kids.map(k => k.text)].map(t => wrap(t, cw - pad * 2 - 12, 'body', 400, C.fs));
    const dl = !p.title && p.desc ? wrap(p.desc, cw - pad * 2, 'body', 400, C.fs) : [];
    const headH = Math.max(icons ? isz : 0, tl.length * ts * 1.35);
    const h = pad + headH + (dl.length ? (headH ? 7 : 0) + dl.length * C.lh : 0) + (bl.length ? 7 + bl.reduce((a, l) => a + l.length * C.lh + 3, -3) : 0) + pad;
    return { ...p, tl, bl, dl, h, headH, tx };
  });
  const rows = []; for(let i=0;i<cards.length;i+=cols) rows.push(cards.slice(i, i + cols));
  const rh = rows.map(r => Math.max(...r.map(c => c.h)));
  const nat = rh.reduce((a, b) => a + b, 0) + gap * (rows.length - 1);
  return { kind:'cards', h:nat, stretch:0, draw:(x, y) => {
    const out = []; let yy = y;
    rows.forEach((r, ri) => { const h = rh[ri]; const off = (W - (r.length * cw + (r.length - 1) * gap)) / 2;
      r.forEach((c, ci) => { const cx = x + off + ci * (cw + gap);
        out.push(A && !C.tk.ref?.rich ? E.rect(cx, yy, cw, h, { fill:'#FFFFFF', stroke:C.c.line, sw:.8, r:7 }) : A ? E.rect(cx, yy, cw, h, { fill:C.c.note, r:7 }) : E.rect(cx, yy, cw, h, { fill:'#FFFFFF', stroke:C.c.p1, sw:1, r:7 }));
        let ty = yy + pad;
        // 기본(색 면적 넓음): 카드 제목 줄을 주색 띠로 — 제출본의 색 있는 면 비율(9~12%)에 맞춤
        const strip = false; const tone = A && C.tk.ref?.rich ? 'dark' : C.tk.iconTone; if(A && C.tk.ref?.rich){ out.push(E.rect(cx, yy, cw, 4, { fill:C.c.p1 })); }
        if(icons) out.push(E.icon(cx + pad, ty, isz, iconFor(c.topic || '목표'), { tone:strip ? 'dark' : tone }));
        if(c.tl.length) out.push(T(c.tl, cx + c.tx, ty + (c.headH - c.tl.length * ts * 1.35) / 2, cw - c.tx - pad, { size:ts, weight:700, role:'title', color:strip ? C.c.onP1 : C.c.ink, lh:ts * 1.35 }));
        ty += c.headH;
        if(c.dl.length){ ty += c.headH ? 7 : 0; out.push(T(c.dl, cx + pad, ty, cw - pad * 2, { size:C.fs, color:C.c.ink, lh:C.lh })); ty += c.dl.length * C.lh; }
        if(c.bl.length){ ty += 7; c.bl.forEach(l => { out.push(...check(cx + pad, ty + C.lh / 2 - 3.5, C.c.p1)); out.push(T(l, cx + pad + 12, ty, cw - pad * 2 - 12, { size:C.fs, color:C.c.ink, lh:C.lh })); ty += l.length * C.lh + 3; }); }
      });
      yy += h + gap; });
    return out; } };
}
function blkFlow(steps, C, W, cycle){
  const n = steps.length; const nr = n <= 5 ? 1 : n <= 10 ? 2 : 3; const per = Math.ceil(n / nr); const A = C.st.flow !== 'B';
  const ag = A ? 5 : 16; const bw = (W - ag * (per - 1)) / per; const pad = 8; const inset = A ? 14 : pad;
  const cs = C.tk.size.caption, clh = cs * 1.35;
  // 단계 글: 「이름 : 설명」이면 이름은 도형 안, 설명은 아래(A) 또는 상자 안(B)
  const items = steps.map((s, i) => { const sp = splitTitle(s.text); const two = !!(sp.title && sp.desc);
    const title = two ? sp.title : s.text, desc = two ? sp.desc : '';
    return { label:s.label || (A ? String(i + 1).padStart(2, '0') : ''), deco:!s.label, tl:wrap(title, bw - inset * 2, 'title', 700, C.fs), dl:desc ? wrap(desc, bw - (A ? 4 : pad * 2), 'body', 400, C.fs) : [] }; });
  const tH = Math.max(...items.map(it => it.tl.length)) * C.lh, dH = Math.max(0, ...items.map(it => it.dl.length)) * C.lh; const circ = 22;
  const bh = A ? tH + clh + pad * 2 : circ / 2 + 5 + clh + tH + (dH ? 4 + dH : 0) + pad;
  const rowH = A ? bh + (dH ? 7 + dH : 0) : circ / 2 + bh; const rowsN = Math.ceil(n / per); const back = cycle ? 24 : 0;
  const nat = rowsN * rowH + (rowsN - 1) * 14 + back;
  return { kind:'flow', h:nat, stretch:0, draw:(x, y) => {
    const out = []; let last = null, first = null;
    for(let r=0;r<rowsN;r++){ const row = items.slice(r * per, r * per + per); const yy = y + r * (rowH + 14); const h = bh;
      const off = (W - (row.length * bw + (row.length - 1) * ag)) / 2;
      row.forEach((it, i) => { const bx = x + off + i * (bw + ag); const idx = r * per + i;
        if(A){ const tip = 10; const pts = idx === 0 ? [[bx, yy], [bx + bw - tip, yy], [bx + bw, yy + h / 2], [bx + bw - tip, yy + h], [bx, yy + h]]
              : [[bx - 4, yy], [bx + bw - tip, yy], [bx + bw, yy + h / 2], [bx + bw - tip, yy + h], [bx - 4, yy + h], [bx - 4 + tip, yy + h / 2]];
          const last1 = idx === n - 1; out.push(E.poly(pts, { fill:last1 ? C.c.accent : idx % 2 ? C.c.p0 : C.c.p1, shape:idx === 0 ? 'homePlate' : 'chevron', box:[bx - (idx ? 4 : 0), yy, bw + (idx ? 4 : 0), h] }));
          const ty = yy + (h - clh - it.tl.length * C.lh) / 2;
          out.push(T([it.label], bx + inset, ty, bw - inset * 2, { size:cs, weight:700, color:mix(C.c.onP1 === '#FFFFFF' ? '#FFFFFF' : C.c.ink, C.c.p1, .3), lh:clh, align:'center', skip:it.deco }));
          out.push(T(it.tl, bx + inset, ty + clh, bw - inset * 2, { size:C.fs, weight:700, role:'title', color:'#FFFFFF', lh:C.lh, align:'center' }));
          if(it.dl.length) out.push(T(it.dl, bx + 2, yy + h + 7, bw - 4, { size:C.fs, color:C.c.ink, lh:C.lh, align:'center' }));
          if(idx === 0) first = [bx, yy, bw, h]; last = [bx, yy, bw, h];
        } else {
          const by = yy + circ / 2;
          out.push(E.rect(bx, by, bw, h, { fill:'#FFFFFF', stroke:C.c.line, sw:.9, r:7 }));
          out.push(E.ell(bx + bw / 2 - circ / 2, yy, circ, circ, { fill:C.c.p1 }));
          out.push(T([String(idx + 1)], bx + bw / 2 - circ / 2, yy + (circ - clh) / 2, circ, { size:cs, weight:700, color:C.c.onP1, lh:clh, align:'center', skip:true }));
          let ty = by + circ / 2 + 5;
          if(it.label && !it.deco){ out.push(T([it.label], bx + pad, ty, bw - pad * 2, { size:cs, weight:700, color:C.c.p1, lh:clh, align:'center' })); } ty += clh;
          out.push(T(it.tl, bx + pad, ty, bw - pad * 2, { size:C.fs, weight:700, role:'title', color:C.c.ink, lh:C.lh, align:'center' })); ty += tH + 4;
          if(it.dl.length) out.push(T(it.dl, bx + pad, ty, bw - pad * 2, { size:C.fs, color:C.c.ink2, lh:C.lh, align:'center' }));
          if(i < row.length - 1){ const ax = bx + bw + 3.5, aym = by + h / 2; out.push(E.poly([[ax, aym - 5], [ax + 9, aym], [ax, aym + 5]], { fill:C.c.point, shape:'triangle90', box:[ax, aym - 5, 9, 10] })); }
          if(idx === 0) first = [bx, by, bw, h]; last = [bx, by, bw, h];
        }
      });
    }
    if(cycle && first && last){ const y2 = y + nat - 6; const x1 = last[0] + last[2] / 2, x0 = first[0] + first[2] / 2; const fb = first[1] + first[3] + (A && dH ? 7 + dH : 0);
      out.push(E.line(x1, last[1] + last[3] + (A && dH ? 7 + dH : 0) + 2, x1, y2, { stroke:C.c.accent, sw:1.2, dash:true }));
      out.push(E.line(x1, y2, x0, y2, { stroke:C.c.accent, sw:1.2, dash:true }));
      out.push(E.line(x0, y2, x0, fb + 7, { stroke:C.c.accent, sw:1.2, dash:true }));
      out.push(E.poly([[x0 - 4.5, fb + 8], [x0, fb + 2], [x0 + 4.5, fb + 8]], { fill:C.c.accent, shape:'triangle', box:[x0 - 4.5, fb + 2, 9, 6] })); }
    return out; } };
}
function blkHub(head, items, C, W){
  const its = items.filter(i => !i.note); const n = its.length; const A = C.st.hub !== 'B';
  const Dm = clamp(W * .26, 104, 140); const gx = 24; const bw = (W - Dm - gx * 2) / 2; const pad = 9;
  const cl = wrap(head, Dm * .74, 'body', 700, C.fs); const cfs = C.fs;
  const parts = its.map(i => ({ lines:wrap(i.text, bw - pad * 2 - (C.useIcons ? 24 : 0), 'body', 500, C.fs), topic:topicOf(i.text) }));
  const icons = C.useIcons && parts.filter(p => p.topic).length >= Math.ceil(n / 2);
  if(icons) parts.forEach(p => { p.lines = wrap(its[parts.indexOf(p)].text, bw - pad * 2 - 24, 'body', 500, C.fs); });
  const bh = Math.max(...parts.map(p => p.lines.length)) * C.lh + pad * 2; const vg = 10;
  const L = n === 3 ? 1 : Math.ceil(n / 2), R = n === 3 ? 1 : n - L, bottom = n === 3 ? 1 : 0;
  const colH = Math.max(L, R) * bh + (Math.max(L, R) - 1) * vg; const core = Math.max(Dm, colH);
  const nat = core + (bottom ? vg + 12 + bh : 0);
  return { kind:'hub', h:nat, stretch:nat * .5, draw:(x, y, _w, ex = 0) => {
    const out = []; const k = 1 + ex / nat; const BH = bh * k, VG = vg * k; const CORE = Math.max(Dm, Math.max(L, R) * BH + (Math.max(L, R) - 1) * VG);
    const cx = x + W / 2, cy = y + CORE / 2;
    const place = []; const colY = q => cy - (q * BH + (q - 1) * VG) / 2;
    for(let i=0;i<L;i++) place.push([x, colY(L) + i * (BH + VG)]);
    for(let i=0;i<R;i++) place.push([x + W - bw, colY(R) + i * (BH + VG)]);
    if(bottom) place.push([cx - bw / 2, y + CORE + VG + 12]);
    place.forEach(([bx, by], i) => { const tx = bx + bw / 2, ty = by + BH / 2; const ang = Math.atan2(ty - cy, tx - cx); const sx = cx + Math.cos(ang) * Dm / 2, sy = cy + Math.sin(ang) * Dm / 2;
      const ex2 = i < L ? bx + bw : i < L + R ? bx : tx, ey2 = i < L + R ? ty : by;
      out.push(E.line(sx, sy, ex2, ey2, { stroke:A ? C.c.p3 : C.c.line, sw:1.2, dash:!A })); });
    out.push(E.ell(cx - Dm / 2, cy - Dm / 2, Dm, Dm, { fill:A ? C.c.p1 : C.c.p0 }));
    out.push(E.ell(cx - Dm / 2 + 5, cy - Dm / 2 + 5, Dm - 10, Dm - 10, { stroke:C.c.p3, sw:.8 }));
    out.push(T(cl, cx - Dm * .37, cy - cl.length * C.lh / 2, Dm * .74, { size:cfs, weight:700, color:C.c.onP1, lh:C.lh, align:'center' }));
    place.forEach(([bx, by], i) => { const p = parts[i];
      out.push(E.rect(bx, by, bw, BH, A ? { fill:C.c.bg, stroke:C.c.p1, sw:1, r:C.r } : { fill:C.c.p2, r:C.r }));
      let tx = bx + pad; if(icons){ out.push(E.icon(bx + pad, by + BH / 2 - 10, 20, iconFor(p.topic || '목표'), { tone:C.tk.iconTone })); tx += 24; }
      out.push(T(p.lines, tx, by + (BH - p.lines.length * C.lh) / 2, bx + bw - pad - tx, { size:C.fs, weight:500, color:C.c.ink, lh:C.lh, align:icons ? 'left' : 'center' })); });
    return out; } };
}
function blkKpi(k, C, W){
  const n = k.length, cols = n <= 4 ? n : 3, gap = 10, cw = (W - gap * (cols - 1)) / cols, pad = 10, A = C.st.kpi !== 'B';
  const ks = C.tk.size.kpi; const tiles = k.map(t => ({ ...t, ll:wrap(t.label, cw - pad * 2, 'body', 400, C.fs) }));
  const lh2 = ks * 1.2; const th = Math.max(...tiles.map(t => t.ll.length)) * C.lh + lh2 + pad * 2 + 4 + (A ? 0 : 2);
  const rows = Math.ceil(n / cols); const nat = rows * th + (rows - 1) * gap;
  return { kind:'kpi', h:nat, stretch:rows * th * .3, draw:(x, y, _w, ex = 0) => {
    const out = []; const add = ex / rows;
    tiles.forEach((t, i) => { const r = Math.floor(i / cols), c = i % cols; const rowCnt = Math.min(cols, n - r * cols); const off = (W - (rowCnt * cw + (rowCnt - 1) * gap)) / 2;
      const tx = x + off + c * (cw + gap), ty = y + r * (th + add + gap); const h = th + add;
      if(A) out.push(E.rect(tx, ty, cw, h, { fill:C.tk.ref?.rich ? C.c.note : C.c.bg2, r:C.r })); else { out.push(E.rect(tx, ty, cw, h, { fill:C.c.bg, stroke:C.c.line, sw:.75, r:C.r })); out.push(E.rect(tx, ty, cw, 2.5, { fill:C.c.p1 })); }
      const vw = tw(t.value, 'num', 700, ks), uw = tw(t.unit, 'body', 500, C.fs); const sx = tx + (cw - vw - uw - 3) / 2; const vy = ty + pad + add / 2;
      out.push(T([t.value], sx, vy, vw + uw + 6, { size:ks, weight:700, role:'num', color:A ? C.c.p1 : C.c.accent, lh:lh2, suffix:{ text:t.unit, size:C.fs, weight:500, role:'body', color:C.c.ink2, gap:3 } }));
      out.push(T(t.ll, tx + pad, vy + lh2 + 4, cw - pad * 2, { size:C.fs, color:C.c.ink, lh:C.lh, align:'center' })); });
    return out; } };
}
function tableModel(rows, C, W, labelMode){
  const ncol = Math.max(...rows.map(r => r.length)); const R = rows.map(r => Array.from({ length:ncol }, (_, i) => String(r[i] ?? '')));
  const fs = C.tf, lh = fs * 1.42, px = 7, py = (labelMode ? 6.5 : 5.5) + 2 * (C.air || 0);
  const head = !labelMode && R.length > 1 && R[0].every(c => c.length <= 20 && !/\d{3,}/.test(c)) && R[0].some(Boolean);
  // 머리가 있고 첫 열이 짧은 이름들이면 첫 열을 라벨 열로(회색·굵게)
  const labCol = labelMode || (head && ncol >= 2 && R.slice(1).every(r => r[0].length <= 12));
  const isB = (ri, ci) => (head && ri === 0) || (labCol && ci === 0 && !(head && ri === 0)) ? 700 : 400;
  const want = [], min = [];
  for(let c=0;c<ncol;c++){ let w = 0, m = 30; for(let r=0;r<R.length;r++){ const wt = isB(r, c); w = Math.max(w, tw(R[r][c], 'body', wt, fs)); for(const word of R[r][c].split(' ')) m = Math.max(m, tw(word, 'body', wt, fs)); } want.push(w + px * 2); min.push(Math.min(m + px * 2, W / ncol)); }
  let cw; const sw = want.reduce((a, b) => a + b, 0), sm = min.reduce((a, b) => a + b, 0);
  if(sw <= W){ const fixed = labCol ? 1 : 0; const flex = want.reduce((a, w, i) => a + (i < fixed ? 0 : w), 0) || 1; cw = want.map((w, i) => i < fixed ? w + 6 : w + (W - sw - (fixed ? 6 : 0)) * w / flex); }
  else { const extra = W - sm, need = want.map((w, i) => w - min[i]), sn = need.reduce((a, b) => a + b, 0) || 1; cw = min.map((m, i) => m + extra * need[i] / sn); }
  const cells = R.map((r, ri) => r.map((t, ci) => { const wt = isB(ri, ci); return { text:t, lines:wrap(t, cw[ci] - px * 2, 'body', wt, fs), wt, num:/^[\d,.\s%~-]+[가-힣%]{0,2}$/.test(t.trim()) && t.trim().length <= 10 }; }));
  const rh = cells.map(r => Math.max(...r.map(c => c.lines.length)) * lh + py * 2);
  return { R, cells, cw, rh, head, fs, lh, px, py, labelMode, labCol };
}
function blkTable(rows, C, W, labelMode){
  const M = tableModel(rows, C, W, labelMode); const A = C.st.table !== 'B';
  const nat = M.rh.reduce((a, b) => a + b, 0);
  return { kind:'table', h:nat, stretch:0, draw:(x, y) => {
    const cells = M.cells.map((r, ri) => r.map((c, ci) => {
      const isHead = M.head && ri === 0, isLab = M.labCol && ci === 0 && !isHead;
      const fill = isHead ? (A ? (C.tk.ref?.rich ? C.c.p1 : '#FFFFFF') : C.c.p1) : isLab ? (A ? (C.tk.ref?.rich ? C.c.note : C.c.gray) : C.c.p2) : '#FFFFFF';
      const color = isHead ? (A ? (C.tk.ref?.rich ? C.c.onP1 : C.c.p0) : C.c.onP1) : isLab ? C.c.ink : C.c.ink;
      return { lines:c.lines, text:c.text, weight:c.wt, color, fill, align:isHead || c.num ? 'center' : 'left' }; }));
    return [{ t:'table', x, y, colW:M.cw, rowH:M.rh, cells, size:M.fs, lh:M.lh, px:M.px, line:C.c.line, edge:C.c.p1, vlines:!A, headRule:A && M.head }]; } };
}
function blkTimeline(tl, C, W){
  const n = tl.length, nr = n <= 5 ? 1 : 2, per = Math.ceil(n / nr), sw = W / per, A = C.st.timeline !== 'B';
  const items = tl.map(t => ({ ll:wrap(t.label || '', sw - 12, 'body', 700, C.fs), dl:wrap(t.text, sw - 12, 'body', 400, C.fs) }));
  const lH = Math.max(...items.map(i => i.ll.length)) * C.lh, dH = Math.max(...items.map(i => i.dl.length)) * C.lh;
  const rowH = lH + 8 + 12 + 8 + dH; const nat = nr * rowH + (nr - 1) * 16;
  return { kind:'timeline', h:nat, stretch:0, draw:(x, y) => {
    const out = [];
    for(let r=0;r<nr;r++){ const row = items.slice(r * per, r * per + per); const yy = y + r * (rowH + 16); const ly = yy + lH + 8 + 6;
      out.push(E.line(x, ly, x + W, ly, { stroke:A ? C.c.p1 : C.c.line, sw:A ? 2 : 1.2 }));
      row.forEach((it, i) => { const cx = x + sw * i + sw / 2;
        if(A) out.push(E.ell(cx - 6, ly - 6, 12, 12, { fill:C.c.p1 })); else out.push(E.ell(cx - 6, ly - 6, 12, 12, { fill:C.c.bg, stroke:C.c.p1, sw:2.2 }));
        if(!A && it.ll.length){ const lw = maxLineW(it.ll, 'body', 700, C.fs) + 14; out.push(E.rect(cx - lw / 2, yy + lH - it.ll.length * C.lh - 1, lw, it.ll.length * C.lh + 2, { fill:C.c.p2, r:C.lh / 2 })); }
        out.push(T(it.ll, cx - sw / 2 + 6, yy + lH - it.ll.length * C.lh, sw - 12, { size:C.fs, weight:700, color:C.c.p0, lh:C.lh, align:'center' }));
        out.push(T(it.dl, cx - sw / 2 + 6, ly + 14, sw - 12, { size:C.fs, color:C.c.ink, lh:C.lh, align:'center' })); }); }
    return out; } };
}
function blkVs(a, b, C, W){
  const gw = 30, bw = (W - gw) / 2, pad = C.pad, A = C.st.vs !== 'B', hs = C.fs;
  const side = s => ({ hl:wrap(s.head, bw - pad * 2, 'body', 700, hs), its:s.items.map(i => wrap(i.text, bw - pad * 2 - 12, 'body', 400, C.fs)) });
  const L = side(a), R = side(b); const hh = Math.max(L.hl.length, R.hl.length) * C.lh + 12;
  const bodyH = s => s.its.reduce((t, l) => t + l.length * C.lh + 5, 0) + pad * 2 - 5; const bh = Math.max(bodyH(L), bodyH(R));
  const nat = hh + bh;
  return { kind:'vs', h:nat, stretch:bh * .8, draw:(x, y, _w, ex = 0) => {
    const out = []; const h = nat + ex;
    [[L, x, C.c.ink2, A ? C.c.bg : C.c.bg2], [R, x + bw + gw, C.c.p1, A ? C.c.bg : C.c.p2]].forEach(([s, sx, hc, bc]) => {
      out.push(E.rect(sx, y, bw, h, { fill:bc, stroke:A ? C.c.line : undefined, sw:A ? .75 : undefined, r:C.r }));
      out.push(E.rect(sx, y, bw, hh, { fill:hc, r:C.r })); out.push(E.rect(sx, y + hh - C.r, bw, C.r, { fill:hc }));
      out.push(T(s.hl, sx + pad, y + 6, bw - pad * 2, { size:hs, weight:700, color:'#FFFFFF', lh:C.lh, align:'center' }));
      let yy = y + hh + pad + (ex * .5) / Math.max(1, s.its.length); for(const l of s.its){ out.push(E.ell(sx + pad + 1, yy + C.lh / 2 - 2.4, 4.8, 4.8, { fill:hc })); out.push(T(l, sx + pad + 12, yy, bw - pad * 2 - 12, { size:C.fs, color:C.c.ink, lh:C.lh })); yy += l.length * C.lh + 5 + ex * .5 / Math.max(1, s.its.length); } });
    const ax = x + bw + 5, ay = y + h / 2; out.push(E.poly([[ax, ay - 9], [ax + 11, ay - 9], [ax + 11, ay - 14], [ax + 20, ay], [ax + 11, ay + 14], [ax + 11, ay + 9], [ax, ay + 9]], { fill:C.c.accent, shape:'rightArrow', box:[ax, ay - 14, 20, 28] }));
    return out; } };
}
function blkPhotos(pics, C, W){
  const k = Math.min(3, pics.length); const ps = pics.slice(0, 3); const gap = 10; const cs = C.tk.size.caption;
  if(k === 1){ const p = ps[0]; const pw = Math.min(W * .52, 270); const ph = Math.min(pw * (p.h / p.w || .62), 200); const cl = p.cap ? wrap(p.cap, W - pw - 16, 'body', 400, cs) : [];
    return { kind:'photo', h:ph, stretch:0, draw:(x, y) => { const out = [E.img(x, y, pw, ph, { src:p.url, pic:p, r:C.r, stroke:C.c.line })];
      if(cl.length){ out.push(E.line(x + pw + 12, y + ph - cl.length * cs * 1.45 - 6, x + pw + 40, y + ph - cl.length * cs * 1.45 - 6, { stroke:C.c.p1, sw:1.5 })); out.push(T(cl, x + pw + 12, y + ph - cl.length * cs * 1.45, W - pw - 14, { size:cs, color:C.c.ink2, lh:cs * 1.45 })); }
      return out; } }; }
  const pw = (W - gap * (k - 1)) / k; const ph = Math.min(...ps.map(p => pw * (p.h / p.w || .62)), 170 + 30 * (C.air || 0));
  const cls = ps.map(p => p.cap ? wrap(p.cap, pw, 'body', 400, cs) : []); const ch = Math.max(0, ...cls.map(l => l.length)) * cs * 1.45;
  return { kind:'photo', h:ph + (ch ? ch + 5 : 0), stretch:0, draw:(x, y) => { const out = [];
    ps.forEach((p, i) => { const px = x + i * (pw + gap); out.push(E.img(px, y, pw, ph, { src:p.url, pic:p, r:C.r, stroke:C.c.line })); if(cls[i].length) out.push(T(cls[i], px, y + ph + 5, pw, { size:cs, color:C.c.ink2, lh:cs * 1.45, align:'center' })); });
    return out; } };
}
function blkBanner(text, C, W){ const pad = 10; const lines = wrap(text, W - pad * 4, 'body', 700, C.fs); const h = lines.length * C.lh + pad * 2;
  return { kind:'banner', h, stretch:0, draw:(x, y) => [E.rect(x, y, W, h, { fill:C.c.p1, r:C.r }), T(lines, x + pad * 2, y + pad, W - pad * 4, { size:C.fs, weight:700, color:C.c.onP1, lh:C.lh, align:'center' })] }; }
function blocksForSub(sub, pat, C, W, num){
  const out = []; const all = sub.items; const notes = all.filter(i => i.note); const its = all.filter(i => !i.note);
  const sbt = () => sub.head ? [blkSubtitle(sub.head, C, W, num)] : [];
  const tail = () => { for(const t of sub.tables) out.push(blkTable(t, C, W, false)); if(notes.length) out.push(blkNotes(notes, C, W)); };
  if(pat === 'hub' && hubOk(sub)){ out.push(...sbt(), blkHub(sub.head, its, C, W)); tail(); return out; }
  out.push(...sbt());
  if(pat === 'table' && !its.length){ tail(); return out; }
  if(pat === 'enum'){ const en = enumOf(sub); out.push(blkList(its, C, W)); if(en) out.push(blkCards(en.parts.map(p => ({ text:`${p.title} : ${p.desc}`, kids:[] })), C, W)); tail(); return out; }
  if(pat === 'flow' || pat === 'cycle'){ const st = stepsOf(sub); if(st && st.keep){ out.push(blkList(its, C, W)); out.push(blkFlow(st.steps, C, W, pat === 'cycle')); tail(); return out; } if(st){ out.push(blkFlow(st.steps, C, W, pat === 'cycle')); if(st.rest.filter(i => !i.note).length) out.push(blkList(st.rest.filter(i => !i.note), C, W)); } else if(its.length) out.push(blkList(its, C, W)); }
  else if(pat === 'timeline'){ const tl = timelineOf(sub); out.push(tl ? blkTimeline(tl, C, W) : blkList(its, C, W)); }
  else if(pat === 'kpi'){ const k = kpiOf(sub); out.push(k ? blkKpi(k, C, W) : blkList(its, C, W)); }
  else if(pat === 'ltable'){ const lp = labelPairs(sub); out.push(lp ? blkTable(lp, C, W, true) : blkList(its, C, W)); }
  else if(pat === 'cards'){ out.push(its.length >= 2 ? blkCards(its, C, W) : blkList(its, C, W)); }
  else if(its.length) out.push(blkList(its, C, W));
  tail(); return out;
}
// ───────────── 완성도 기준(최소선): 실제 제출본 2종(엘앤케이비즈 76쪽·금성환경 56쪽)에서 잰 값보다 조금 낮게
//  본문 세로 사용률: 제출본 10분위 74%·99% → 70% / 구조화 요소 없는 쪽: 제출본 0쪽 → 쪽마다 1개 이상
//  본문 글자 크기 단계: 엘앤케이비즈 3단계 → 4단계 이하 / 쪽당 원고 글자: 제출본 10분위 580자 → 400자
const QUALITY = { useTarget:.70, steps:4, chars:400 };
const QUALITY_ITEMS = [
  { id:'eval', name:'평가 항목 표시', must:true, when:() => !!(D.rfp?.items.length), ok:m => m.evalOk, fix:'배점 연결에서 이 쪽의 절을 평가 항목에 이으세요.' },
  { id:'msg', name:'헤드 메시지', must:true, ok:m => m.msg, fix:'원고 첫 줄(소제목 앞)에 이 쪽의 핵심 주장을 한 문장으로 넣으세요.' },
  { id:'struct', name:'표·도식·사진 1개 이상', must:true, ok:m => m.struct, fix:'원고에 단계(1단계…), 「이름 : 설명」, 표, 사진 중 하나를 넣으면 도식이 됩니다.' },
  { id:'use', name:'본문 채움 70% 이상', must:true, ok:m => m.use >= QUALITY.useTarget - .005, val:m => `${Math.round(m.use * 100)}%`, fix:'원고 분량을 늘리거나 사진·표를 더하세요(여유 배치까지 적용한 값).' },
  { id:'steps', name:'글자 크기 4단계 이하', must:false, ok:m => m.steps <= QUALITY.steps, val:m => `${m.steps}단계` },
  { id:'chars', name:'원고 400자 이상', must:false, ok:m => m.chars >= QUALITY.chars, val:m => `${m.chars}자`, fix:'제출본은 쪽당 600자 안팎입니다. 원고 보강 후보입니다.' },
];
function pageQuality(sc, pg){
  if(pg?.divider) return { items:[], pass:true, score:1 };
  const items = QUALITY_ITEMS.filter(q => !q.when || q.when()).map(q => ({ id:q.id, name:q.name, must:q.must, ok:!!q.ok(sc.m), val:q.val ? q.val(sc.m) : '', fix:q.fix || '' }));
  items.push({ id:'fit', name:'넘침 없음·글자 하한', must:true, ok:!sc.overflow && !sc.issues.some(i => i.id === 'font'), val:'', fix:'원고 분량을 줄이세요.' });
  const must = items.filter(i => i.must); return { items, pass:must.every(i => i.ok), score:items.filter(i => i.ok).length / items.length };
}
// 넘칠 때 단계별로 줄이기: 0 기본 → 1 간격 → 2 카드 아이콘·여백 → 3 큰 도식을 카드·표로 → 4 줄 간격
const COMPACT = { hub:'cards', timeline:'ltable', flow:'flow', cycle:'flow', cards:'list', kpi:'kpi' };
function composePage(n, opt = {}){
  const pg = msPage(n); const tk = opt.tk || tokens(); const style = opt.style || D.style || STYLE_A;
  const G = tk.grid; const W = G.w, H = G.h; const x0 = G.ml, x1 = W - G.mr, BW = x1 - x0;
  const pats0 = opt.pats || patternsFor(n);
  let best = null;
  for(let level = opt.level || 0; level <= 4; level++){
    const pats = pats0.map(p => level >= 3 ? (COMPACT[p] && p !== 'flow' && p !== 'kpi' ? COMPACT[p] : p) : p);
    const r = layoutOnce(pg, tk, style, level, pats, { x0, x1, BW, W, H, G, fontStep:opt.fontStep || 0 });
    best = r; if(!r.overflow) break;
  }
  // 본문 사용률이 기준(70%)에 못 미치면 여유 배치를 차례로 시도해 넘치지 않는 가장 꽉 찬 배치를 고름
  if(!best.overflow && best.level === 0 && best.m.use < QUALITY.useTarget && !opt.level){
    for(const lv of [-1, -2]){ const r = layoutOnce(pg, tk, style, lv, pats0, { x0, x1, BW, W, H, G, fontStep:opt.fontStep || 0 }); if(r.overflow || r.m.use > .97) break; best = r; if(r.m.use >= QUALITY.useTarget) break; }
  }
  best.quality = pageQuality(best, pg);
  return best;
}
// 이 쪽이 답하는 평가 항목(배점 연결에서): 번호·이름·전체 번호 목록
function evalOf(pg){
  const items = D.rfp?.items || []; if(!items.length || !D.mapping) return null;
  const idx = items.findIndex(it => (D.mapping[it.id] || []).includes(pg.sec)); if(idx < 0) return null;
  const code = it => it.code || String(items.indexOf(it) + 1); const it = items[idx];
  const total = items.reduce((a, i) => a + (+i.score || 0), 0);
  return { id:it.id, code:code(it), label:it.name + (it.area && !/부문$/.test(it.area) ? `(${it.area})` : ''), all:items.map(code), cur:code(it), score:+it.score || 0, total, derived:D.rfp?.mode === 'derived', tier:typeof tierOf === 'function' && it.w ? tierOf(it.w) : '' };
}
// 머리틀(Dana): 평가 줄(번호 | 평가 항목 이름 ·· 배점) → 절 제목 → 배점 비중 막대(평가 항목마다 한 칸, 폭 = 배점, 이 쪽 항목만 색)
//  panel = 머리틀 뒤 옅은 바탕 / plain = 흰 바탕 / line = 무채색 막대
function headerEls(pg, tk, G, x0, BW, W){
  const c = tk.color, els = []; const ev = evalOf(pg); const sec = D.ms.sections.find(s => s.id === pg.sec); const hd = tk.header;
  const label = ev ? ev.label : (sec?.chapterTitle || ''); const hs = tk.size.head; const lh2 = hs * 1.4;
  const title = pg.title || ''; let tsz = tk.size.title; let y = G.mt;
  const wTxt = ev ? (ev.derived ? `중요도 ${ev.tier} · ${Math.round(ev.score)}%` : `배점 ${r1(ev.score)}점 / ${r1(ev.total)}점`) : '';
  const back = []; els.push({ placeholder:true });
  if(label || ev){ let lx = x0; const ww = wTxt ? tw(wTxt, 'body', 500, hs) + 4 : 0;
    if(ev){ const cw = tw(ev.code, 'num', 700, hs + 1); els.push(T([ev.code], x0, y, cw + 2, { size:hs + 1, weight:700, role:'num', color:c.p1, lh:lh2 })); lx += cw + 9;
      els.push(E.line(lx, y + lh2 * .2, lx, y + lh2 * .8, { stroke:c.line, sw:1 })); lx += 9; }
    els.push(T([label], lx, y, x0 + BW - lx - ww - 8, { size:hs, weight:500, color:c.ink2, lh:lh2 }));
    if(wTxt) els.push(T([wTxt], x0 + BW - ww, y, ww, { size:hs, weight:500, color:c.ink2, lh:lh2, align:'right' }));
    y += lh2 + 5; }
  let tl = wrap(title, BW, 'title', 700, tsz); if(tl.length > 2){ tsz = tk.size.sub + 1; tl = wrap(title, BW, 'title', 700, tsz); }
  const tlh = tsz * 1.3; els.push(T(tl, x0, y, BW, { size:tsz, weight:700, role:'title', color:hd === 'line' ? c.ink : c.p0, lh:tlh })); y += tl.length * tlh + 8;
  // 배점 비중 막대
  const bh = 4; const items = D.rfp?.items || [];
  if(ev && items.length > 1){ const gap = 2, tot = items.reduce((a, i) => a + (+i.score || 0), 0) || 1; const free = BW - gap * (items.length - 1); let bx = x0;
    items.forEach(it => { const w = Math.max(3, free * (+it.score || 0) / tot); const on = (ev.id === it.id); els.push(E.rect(bx, y, w, bh, { fill:on ? (hd === 'line' ? c.ink : c.p1) : (hd === 'line' ? mix(c.ink, '#FFFFFF', .8) : c.line) })); bx += w + gap; }); }
  else { els.push(E.rect(x0, y + 1.5, BW, 1, { fill:c.line })); els.push(E.rect(x0, y, 36, bh, { fill:hd === 'line' ? c.ink : c.p1 })); }
  y += bh;
  if(hd === 'panel') back.push(E.rect(-G.bleed, -G.bleed, W + G.bleed * 2, y + 12 + G.bleed, { fill:c.bg2 }));
  els.splice(0, 1, ...back);
  return { els, bodyY:Math.max(G.bodyTop, y + (hd === 'panel' ? 26 : 18)) };
}
function layoutOnce(pg, tk0, style, level, pats, g){
  const tk = g.fontStep ? { ...tk0, size:{ ...tk0.size, body:stepSize(tk0, g.fontStep) } } : tk0;
  const C = makeCtx(tk, style, level); const { x0, BW, W, H, G } = g; const c = tk.color;
  const groups = []; const issues = [];
  const hd = headerEls(pg, tk, G, x0, BW, W); groups.push({ id:'part-head', title:'머리틀', skip:true, els:hd.els });
  // 바닥: 쪽 번호·출처
  const L = tk.locks; const showNo = L.pageNumber !== '넣지 않음';
  const yEnd = H - G.mb; let y1 = yEnd;
  if(pg.src){ const cs = tk.size.caption; const sl = wrap(pg.src, BW, 'body', 400, cs); const sh = sl.length * cs * 1.45;
    groups.push({ id:'part-src', title:'자료 출처', els:[T(sl, x0, yEnd - sh, BW, { size:cs, color:c.ink2, lh:cs * 1.45 })] }); y1 = yEnd - sh - 10; }
  if(showNo){ const ps = tk.size.pno; groups.push({ id:'part-pageno', title:'쪽 번호', skip:true, els:[T([String(pg.n)], W / 2 - 20, yEnd + (G.mb - ps * 1.4) / 2, 40, { size:ps, weight:500, color:c.ink2, lh:ps * 1.4, align:'center' })] }); }
  // 본문: 헤드 메시지 → 소제목 묶음 → 사진 → 결론
  const secs = []; const subs = pg.st.subs; const vi = pats.indexOf('vs'); let num = 0;
  if(pg.st.lead.length) secs.push({ title:'헤드 메시지', blocks:[blkHeadMsg(pg.st.lead, C, BW)], gapAfter:level >= 2 ? 14 : 20 + 4 * Math.max(0, -level) });
  subs.forEach((s, i) => {
    if(pats[i] === 'vs+') return;
    if(s.head) num++;
    if(pats[i] === 'vs' && vi === i && subs[i+1]){ num++; secs.push({ title:`${s.head} · ${subs[i+1].head}`, blocks:[blkVs(s, subs[i+1], C, BW)] }); return; }
    secs.push({ title:s.head || `내용 ${i + 1}`, blocks:blocksForSub(s, pats[i] === 'vs' ? 'cards' : pats[i], C, BW, num) });
  });
  if(pg.pics.length) secs.push({ title:'사진', blocks:[blkPhotos(pg.pics, C, BW)] });
  const concs = pg.st.concs || (pg.st.conc ? [pg.st.conc] : []);
  if(concs.length) secs.push({ title:'핵심 실행 사항', blocks:[blkConc(concs, C, BW)] });
  const air = Math.max(0, -level); const dg = tk.ref ? { high:-4, mid:0, low:4 }[tk.ref.dens] || 0 : 0; const inGap = level >= 2 ? 6 : 8 + 3 * air, subGap = 7 + 2 * air, secGap0 = level >= 1 ? 14 : 20 + dg + 6 * air;
  const bodyTop = hd.bodyY; const avail = y1 - bodyTop;
  const gapOf = (s, i) => i < secs.length - 1 ? (s.gapAfter ?? secGap0) : 0;
  const nat = secs.reduce((a, s, i) => a + s.blocks.reduce((b, k) => b + k.h, 0) + s.blocks.slice(0, -1).reduce((b, k) => b + (k.kind === 'sub' ? subGap : inGap), 0) + gapOf(s, i), 0);
  let extra = avail - nat; const overflow = extra < -0.5;
  // 상자를 늘리지 않음: 남는 높이는 묶음 사이 간격에만 조금(묶음당 최대 10pt), 나머지는 아래 여백
  const gaps = Math.max(0, secs.length - 1); const gapAdd = extra > 0 && gaps ? Math.min(extra > avail * .3 ? 18 : 10, extra * .4 / gaps) : 0;
  const slack = Math.max(0, extra - gapAdd * gaps);
  let y = bodyTop; let bottom = y;
  secs.forEach((s, si) => {
    const grp = { id:'part-' + (si + 1), title:s.title, els:[] };
    s.blocks.forEach((b, bi) => { grp.els.push(...b.draw(x0, y, BW, 0)); y += b.h; if(bi < s.blocks.length - 1) y += b.kind === 'sub' ? subGap : inGap; });
    bottom = y; groups.push(grp); if(si < secs.length - 1) y += gapOf(s, si) + gapAdd;
  });
  const gapLeft = y1 - bottom;
  if(overflow) issues.push({ id:'overflow', lv:'err', msg:`원고가 한 쪽에 다 들어가지 않습니다 (${Math.round(-gapLeft)}pt 넘침). 분량 조정이 필요합니다.` });
  if(L.blind){ const txt = [pg.title, ...pg.blocks.map(b => b.k === 'p' ? b.text : b.rows.flat().join(' '))].join(' '); const m = txt.match(/주식회사|㈜|\(주\)|대표이사|대표자/);
    if(m) issues.push({ id:'blind', lv:'err', con:true, msg:`블라인드 평가: 원고에 업체를 알아볼 수 있는 말(「${m[0]}」)이 있습니다. 원고 담당자에게 전달하세요.` });
    if(pg.pics.length) issues.push({ id:'blindpic', lv:'warn', msg:'블라인드 평가: 사진 속 회사명·로고가 없는지 눈으로 확인하세요.' }); }
  const used = []; for(const gr of groups) for(const e of gr.els) if(e.t === 'text' && !gr.skip && !e.skip) used.push(e.size);
  const floor = L.figMin || L.bodyMin; if(floor && used.some(s => s < floor - .01)) issues.push({ id:'font', lv:'err', con:true, msg:`과업지시서 최소 글자 크기보다 작은 글자가 있습니다.` });
  // 완성도 지표: 본문 사용률, 본문 영역 글자 크기 단계, 구조화 요소, 헤드 메시지, 평가 항목 연결, 원고 글자 수
  const kinds = new Set(secs.flatMap(s => s.blocks.map(b => b.kind)));
  const bodySizes = new Set(); for(const gr of groups) if(/^part-\d+$/.test(gr.id)) for(const e of gr.els) if(e.t === 'text' && !e.skip && e.role !== 'num') bodySizes.add(r1(e.size)); else if(e.t === 'table') bodySizes.add(r1(e.size));
  const chars = [...pg.st.lead, ...subs.flatMap(s => [s.head || '', ...s.items.flatMap(i => [i.text, ...(i.kids || []).map(k => k.text)]), ...s.tables.flat(2)]), ...(pg.st.concs || [])].join('').replace(/\s/g, '').length;
  const m = { use:avail > 0 ? (bottom - bodyTop) / avail : 1, steps:bodySizes.size, struct:['table','cards','flow','hub','kpi','timeline','vs','photo','notes'].some(k => kinds.has(k)), msg:!!pg.st.lead.length, sub:subs.some(s => s.head), evalOk:!!evalOf(pg), chars, body:tk.size.body };
  return { n:pg.n, w:W, h:H, bleed:G.bleed, bg:c.page, groups, issues, level, overflow, slack, m, pats:pats.filter(p => p !== 'vs+'), tk, style, fontStep:g.fontStep };
}
function stepSize(tk, step){ const base = tk.size.body; const min = tk.locks.bodyMin || 9; return clamp(base + step * .5, min, base + 3); }

// ───────────── 그리기: 캔버스(미리보기 PNG)
const IMG_CACHE = new Map();
function loadImg(src){ if(IMG_CACHE.has(src)) return IMG_CACHE.get(src); const p = new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; }); IMG_CACHE.set(src, p); return p; }
async function preloadScene(sc){ const jobs = []; for(const g of sc.groups) for(const e of g.els){ if(e.t === 'img') jobs.push(loadImg(e.src)); if(e.t === 'icon') jobs.push(loadImg(iconURLFor(e, sc.tk))); } await Promise.all(jobs); }
function iconColors(tone, c){ return tone === 'dark' ? { fg:'#FFFFFF', bg:c.p1 } : { fg:c.p1, bg:c.p2 }; }
const iconURLFor = (e, tk) => { const cc = iconColors(e.tone, tk.color); return iconDataURL(e.name, cc.fg, cc.bg); };
function baseline(e, i){ const m = vmet(e.role, e.weight); return e.y + i * e.lh + e.lh / 2 + (m.a - m.d) / 2 * e.size; }
function yForBaseline(b, role, weight, size, lh){ const m = vmet(role, weight); return b - lh / 2 - (m.a - m.d) / 2 * size; }
function rrect(ctx, x, y, w, h, r){ ctx.beginPath(); if(r && ctx.roundRect) ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2)); else ctx.rect(x, y, w, h); }
async function drawScene(ctx, sc, scale, bleed = 0){
  await preloadScene(sc);
  ctx.save(); ctx.scale(scale, scale); ctx.translate(bleed, bleed);
  ctx.fillStyle = sc.bg || '#FFFFFF'; ctx.fillRect(-bleed, -bleed, sc.w + bleed * 2, sc.h + bleed * 2);
  for(const g of sc.groups) for(const e of g.els) await drawEl(ctx, e, sc);
  ctx.restore();
}
async function drawEl(ctx, e, sc){
  if(e.t === 'rect'){ rrect(ctx, e.x, e.y, e.w, e.h, e.r); if(e.fill){ ctx.fillStyle = e.fill; ctx.fill(); } if(e.stroke){ ctx.strokeStyle = e.stroke; ctx.lineWidth = e.sw || 1; ctx.stroke(); } }
  else if(e.t === 'ellipse'){ ctx.beginPath(); ctx.ellipse(e.x + e.w / 2, e.y + e.h / 2, e.w / 2, e.h / 2, 0, 0, Math.PI * 2); if(e.fill){ ctx.fillStyle = e.fill; ctx.fill(); } if(e.stroke){ ctx.strokeStyle = e.stroke; ctx.lineWidth = e.sw || 1; ctx.stroke(); } }
  else if(e.t === 'line'){ ctx.beginPath(); ctx.setLineDash(e.dash ? [3.5, 3] : []); ctx.moveTo(e.x1, e.y1); ctx.lineTo(e.x2, e.y2); ctx.strokeStyle = e.stroke; ctx.lineWidth = e.sw || 1; ctx.stroke(); ctx.setLineDash([]); }
  else if(e.t === 'poly'){ ctx.beginPath(); e.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); if(e.fill){ ctx.fillStyle = e.fill; ctx.fill(); } if(e.stroke){ ctx.strokeStyle = e.stroke; ctx.lineWidth = e.sw || 1; ctx.stroke(); } }
  else if(e.t === 'text') drawText(ctx, e);
  else if(e.t === 'img'){ const im = await loadImg(e.src); ctx.save(); rrect(ctx, e.x, e.y, e.w, e.h, e.r); ctx.clip();
    if(im){ const s = Math.max(e.w / im.width, e.h / im.height); const iw = im.width * s, ih = im.height * s; ctx.drawImage(im, e.x + (e.w - iw) / 2, e.y + (e.h - ih) / 2, iw, ih); } else { ctx.fillStyle = '#ECEEED'; ctx.fillRect(e.x, e.y, e.w, e.h); }
    ctx.restore(); if(e.stroke){ rrect(ctx, e.x, e.y, e.w, e.h, e.r); ctx.strokeStyle = e.stroke; ctx.lineWidth = .75; ctx.stroke(); } }
  else if(e.t === 'icon'){ const im = await loadImg(iconURLFor(e, sc.tk)); if(im) ctx.drawImage(im, e.x, e.y, e.s, e.s); }
  else if(e.t === 'table') drawTable(ctx, e);
}
function drawText(ctx, e){ ctx.fillStyle = e.color; ctx.font = cssFont(roleKey(e.role), e.weight, e.size); ctx.textAlign = e.align; ctx.textBaseline = 'alphabetic';
  const ax = e.align === 'center' ? e.x + e.w / 2 : e.align === 'right' ? e.x + e.w : e.x; e.lines.forEach((l, i) => ctx.fillText(l, ax, baseline(e, i))); ctx.textAlign = 'left';
  if(e.suffix){ const f = e.suffix; const x2 = e.x + tw(e.lines[0], e.role, e.weight, e.size) + (f.gap || 0); ctx.fillStyle = f.color; ctx.font = cssFont(roleKey(f.role), f.weight, f.size); ctx.fillText(f.text, x2, baseline(e, 0)); } }
function tableCells(e){ const out = []; let yy = e.y;
  e.cells.forEach((r, ri) => { let xx = e.x; r.forEach((c, ci) => { const w = e.colW[ci], h = e.rowH[ri];
    const th = c.lines.length * e.lh; out.push({ ri, ci, x:xx, y:yy, w, h, c, tx:{ t:'text', lines:c.lines, x:xx + e.px, y:yy + (h - th) / 2, w:w - e.px * 2, h:th, lh:e.lh, size:e.size, weight:c.weight, role:'body', color:c.color, align:c.align } }); xx += w; }); yy += e.rowH[ri]; });
  return out; }
function drawTable(ctx, e){
  const cs = tableCells(e); const W = e.colW.reduce((a, b) => a + b, 0), H = e.rowH.reduce((a, b) => a + b, 0);
  for(const k of cs){ ctx.fillStyle = k.c.fill; ctx.fillRect(k.x, k.y, k.w, k.h); }
  ctx.strokeStyle = e.line; ctx.lineWidth = .6; let yy = e.y;
  for(let r=1;r<e.rowH.length;r++){ yy += e.rowH[r-1]; ctx.beginPath(); ctx.moveTo(e.x, yy); ctx.lineTo(e.x + W, yy); ctx.stroke(); }
  if(e.vlines){ let xx = e.x; for(let c=1;c<e.colW.length;c++){ xx += e.colW[c-1]; ctx.beginPath(); ctx.moveTo(xx, e.y); ctx.lineTo(xx, e.y + H); ctx.stroke(); } }
  ctx.strokeStyle = e.edge; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + W, e.y); ctx.moveTo(e.x, e.y + H); ctx.lineTo(e.x + W, e.y + H); ctx.stroke();
  if(e.headRule){ ctx.strokeStyle = e.edge; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(e.x, e.y + e.rowH[0]); ctx.lineTo(e.x + W, e.y + e.rowH[0]); ctx.stroke(); }
  for(const k of cs) drawText(ctx, k.tx);
}
async function scenePng(sc, scale = 100 / 72, type = 'image/png', bleed = 0){
  const c = document.createElement('canvas'); c.width = Math.round((sc.w + bleed * 2) * scale); c.height = Math.round((sc.h + bleed * 2) * scale);
  await drawScene(c.getContext('2d'), sc, scale, bleed); return canvasBlob(c, type, .92);
}

// ───────────── SVG(검수 탭 입력·SVG 내보내기)
const xa = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n2 = v => +(+v).toFixed(2);
function famAttr(role){ const f = famOf(roleKey(role)); const face = f.builtin ? 'Noto Sans KR' : (f.faces.find(x => x.weight >= 350 && x.weight <= 450) || f.faces[0])?.family || f.label;
  return f.builtin ? `'Noto Sans KR', sans-serif` : `'${face.replace(/'/g, '')}', '${f.alias}', sans-serif`; }
function svgText(e){ const m = vmet(e.role, e.weight); const ax = e.align === 'center' ? e.x + e.w / 2 : e.align === 'right' ? e.x + e.w : e.x; const anc = e.align === 'center' ? ' text-anchor="middle"' : e.align === 'right' ? ' text-anchor="end"' : '';
  void m; const suf = e.suffix ? `<tspan dx="${n2(e.suffix.gap || 0)}" font-family="${xa(famAttr(e.suffix.role))}" font-size="${n2(e.suffix.size)}" font-weight="${e.suffix.weight}" fill="${e.suffix.color}">${xa(e.suffix.text)}</tspan>` : '';
  return `<text font-family="${xa(famAttr(e.role))}" font-size="${n2(e.size)}" font-weight="${e.weight}" fill="${e.color}"${anc}${e.skip ? ' data-review="skip"' : ''}>` + e.lines.map((l, i) => `<tspan x="${n2(ax)}" y="${n2(baseline(e, i))}">${xa(l)}</tspan>`).join('') + suf + '</text>'; }
function svgEl(e, sc){
  if(e.t === 'rect') return `<rect x="${n2(e.x)}" y="${n2(e.y)}" width="${n2(e.w)}" height="${n2(e.h)}"${e.r ? ` rx="${n2(Math.min(e.r, e.w / 2, e.h / 2))}"` : ''} fill="${e.fill || 'none'}"${e.stroke ? ` stroke="${e.stroke}" stroke-width="${e.sw || 1}"` : ''}/>`;
  if(e.t === 'ellipse') return `<ellipse cx="${n2(e.x + e.w / 2)}" cy="${n2(e.y + e.h / 2)}" rx="${n2(e.w / 2)}" ry="${n2(e.h / 2)}" fill="${e.fill || 'none'}"${e.stroke ? ` stroke="${e.stroke}" stroke-width="${e.sw || 1}"` : ''}/>`;
  if(e.t === 'line') return `<line x1="${n2(e.x1)}" y1="${n2(e.y1)}" x2="${n2(e.x2)}" y2="${n2(e.y2)}" stroke="${e.stroke}" stroke-width="${e.sw || 1}"${e.dash ? ' stroke-dasharray="3.5 3"' : ''}/>`;
  if(e.t === 'poly') return `<polygon points="${e.pts.map(p => n2(p[0]) + ',' + n2(p[1])).join(' ')}" fill="${e.fill || 'none'}"/>`;
  if(e.t === 'text') return svgText(e);
  if(e.t === 'img') return `<image href="${xa(e.data || e.src)}" x="${n2(e.x)}" y="${n2(e.y)}" width="${n2(e.w)}" height="${n2(e.h)}" preserveAspectRatio="xMidYMid slice"/>` + (e.stroke ? `<rect x="${n2(e.x)}" y="${n2(e.y)}" width="${n2(e.w)}" height="${n2(e.h)}" fill="none" stroke="${e.stroke}" stroke-width=".75"/>` : '');
  if(e.t === 'icon') return `<image href="${iconURLFor(e, sc.tk)}" x="${n2(e.x)}" y="${n2(e.y)}" width="${n2(e.s)}" height="${n2(e.s)}"/>`;
  if(e.t === 'table'){ const cs = tableCells(e); const W = e.colW.reduce((a, b) => a + b, 0), H = e.rowH.reduce((a, b) => a + b, 0); let s = '';
    for(const k of cs) s += `<rect x="${n2(k.x)}" y="${n2(k.y)}" width="${n2(k.w)}" height="${n2(k.h)}" fill="${k.c.fill}"/>`;
    let yy = e.y; for(let r=1;r<e.rowH.length;r++){ yy += e.rowH[r-1]; s += `<line x1="${n2(e.x)}" y1="${n2(yy)}" x2="${n2(e.x + W)}" y2="${n2(yy)}" stroke="${e.line}" stroke-width=".6"/>`; }
    if(e.vlines){ let xx = e.x; for(let c=1;c<e.colW.length;c++){ xx += e.colW[c-1]; s += `<line x1="${n2(xx)}" y1="${n2(e.y)}" x2="${n2(xx)}" y2="${n2(e.y + H)}" stroke="${e.line}" stroke-width=".6"/>`; } }
    s += `<line x1="${n2(e.x)}" y1="${n2(e.y)}" x2="${n2(e.x + W)}" y2="${n2(e.y)}" stroke="${e.edge}" stroke-width="1.2"/><line x1="${n2(e.x)}" y1="${n2(e.y + H)}" x2="${n2(e.x + W)}" y2="${n2(e.y + H)}" stroke="${e.edge}" stroke-width="1.2"/>`;
    if(e.headRule) s += `<line x1="${n2(e.x)}" y1="${n2(e.y + e.rowH[0])}" x2="${n2(e.x + W)}" y2="${n2(e.y + e.rowH[0])}" stroke="${e.edge}" stroke-width="1"/>`;
    for(const k of cs) s += svgText(k.tx); return s; }
  return '';
}
async function picData(e){ if(e.data) return e.data; if(e.pic){ e.pic.data ||= await blobToDataURL(e.pic.blob); return e.data = e.pic.data; } return e.src; }
async function sceneSvg(sc){
  for(const g of sc.groups) for(const e of g.els) if(e.t === 'img') await picData(e);
  const body = sc.groups.map(g => `<g id="${g.id}" data-title="${xa(g.title)}"${g.skip ? ' data-review="skip"' : ''}>` + g.els.map(e => svgEl(e, sc)).join('') + '</g>').join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n2(sc.w)} ${n2(sc.h)}" width="${n2(sc.w)}" height="${n2(sc.h)}"><g><g id="part-bg" data-title="바탕" data-review="skip"><rect x="0" y="0" width="${n2(sc.w)}" height="${n2(sc.h)}" fill="${sc.bg || '#FFFFFF'}"/></g>` + body + '</g></svg>';
}

// ───────────── 파워포인트(글상자·도형·표로 편집 가능하게)
const IN = v => v / 72;
const hx = c => String(c || '#000000').replace('#', '').toUpperCase();
async function iconPng(e, tk){ const key = 'png:' + e.name + e.tone + tk.color.p1; if(IMG_CACHE.has(key)) return IMG_CACHE.get(key);
  const p = (async () => { const im = await loadImg(iconURLFor(e, tk)); const c = document.createElement('canvas'); c.width = c.height = 128; if(im) c.getContext('2d').drawImage(im, 0, 0, 128, 128); return c.toDataURL('image/png'); })();
  IMG_CACHE.set(key, p); return p; }
function pptRuns(e, tk){ const f = pptxFace(roleKey(e.role), e.weight); const runs = e.lines.map((l, i) => ({ text:l, options:{ softBreakBefore:i > 0, fontFace:f.face, bold:f.bold } }));
  if(e.suffix){ const g = pptxFace(roleKey(e.suffix.role), e.suffix.weight); runs.push({ text:' ' + e.suffix.text, options:{ fontFace:g.face, bold:g.bold, fontSize:e.suffix.size, color:hx(e.suffix.color) } }); } void tk; return runs; }
async function addScene(pptx, sc, notes){
  const slide = pptx.addSlide(); slide.background = { color:hx(sc.bg || '#FFFFFF') };
  const tk = sc.tk;
  for(const g of sc.groups) for(const e of g.els){
    if(e.t === 'rect'){
      const x = Math.max(e.x, 0), y = Math.max(e.y, 0), w = Math.min(e.x + e.w, sc.w) - x, h = Math.min(e.y + e.h, sc.h) - y; if(w <= 0 || h <= 0) continue;
      slide.addShape(e.r ? 'roundRect' : 'rect', { x:IN(x), y:IN(y), w:IN(w), h:IN(h), rectRadius:e.r ? IN(Math.min(e.r, w / 2, h / 2)) : undefined, fill:e.fill ? { color:hx(e.fill) } : { type:'none' }, line:e.stroke ? { color:hx(e.stroke), width:e.sw || 1 } : { type:'none' } });
    } else if(e.t === 'ellipse') slide.addShape('ellipse', { x:IN(e.x), y:IN(e.y), w:IN(e.w), h:IN(e.h), fill:e.fill ? { color:hx(e.fill) } : { type:'none' }, line:e.stroke ? { color:hx(e.stroke), width:e.sw || 1 } : { type:'none' } });
    else if(e.t === 'line'){ const x = Math.min(e.x1, e.x2), y = Math.min(e.y1, e.y2), w = Math.abs(e.x2 - e.x1), h = Math.abs(e.y2 - e.y1);
      slide.addShape('line', { x:IN(x), y:IN(y), w:IN(w || .01), h:IN(h || .01), flipH:(e.x2 < e.x1) !== (e.y2 < e.y1) && w > 0 && h > 0, line:{ color:hx(e.stroke), width:e.sw || 1, dashType:e.dash ? 'dash' : 'solid' } }); }
    else if(e.t === 'poly'){ const [bx, by, bw, bh] = e.box || bbox(e.pts);
      const shape = { homePlate:'homePlate', chevron:'chevron', rightArrow:'rightArrow', triangle:'triangle', triangle90:'triangle' }[e.shape];
      if(shape) slide.addShape(shape, { x:IN(bx), y:IN(by), w:IN(bw), h:IN(bh), rotate:e.shape === 'triangle90' ? 90 : 0, fill:{ color:hx(e.fill) }, line:{ type:'none' } });
      else slide.addShape('custGeom', { x:IN(bx), y:IN(by), w:IN(bw), h:IN(bh), fill:{ color:hx(e.fill) }, line:{ type:'none' }, points:[...e.pts.map(([px, py], i) => ({ x:IN(px - bx), y:IN(py - by), moveTo:i === 0 })), { close:true }] }); }
    else if(e.t === 'text'){
      const sl = e.w * .03 + 2; const tx = e.align === 'center' ? e.x - sl / 2 : e.align === 'right' ? e.x - sl : e.x;
      slide.addText(pptRuns(e, tk), { x:IN(tx), y:IN(e.y), w:IN(e.w + sl), h:IN(e.h), fontSize:e.size, color:hx(e.color), align:e.align, valign:'top', margin:0, lineSpacing:e.lh, paraSpaceBefore:0, paraSpaceAfter:0, fit:'none', wrap:true });
    }
    else if(e.t === 'img'){ const data = await picData(e); const im = await loadImg(e.src); const sz = im ? { type:'cover', w:IN(e.w), h:IN(e.h) } : undefined;
      slide.addImage({ data, x:IN(e.x), y:IN(e.y), w:IN(e.w), h:IN(e.h), sizing:sz }); }
    else if(e.t === 'icon') slide.addImage({ data:await iconPng(e, tk), x:IN(e.x), y:IN(e.y), w:IN(e.s), h:IN(e.s) });
    else if(e.t === 'table'){
      const rows = e.cells.map(r => r.map(c => { const f = pptxFace(D.roles.body, c.weight); return { text:c.lines.map((l, i) => ({ text:l, options:{ softBreakBefore:i > 0 } })), options:{ fill:{ color:hx(c.fill) }, color:hx(c.color), bold:f.bold, fontFace:f.face, align:c.align, valign:'middle' } }; }));
      const nr = e.rowH.length;
      rows.forEach((r, ri) => r.forEach(c => { c.options.border = [{ type:'solid', pt:ri === 0 ? 1.2 : .6, color:hx(ri === 0 ? e.edge : e.line) }, e.vlines ? { type:'solid', pt:.6, color:hx(e.line) } : { type:'none' }, { type:'solid', pt:ri === nr - 1 ? 1.2 : .6, color:hx(ri === nr - 1 ? e.edge : e.line) }, e.vlines ? { type:'solid', pt:.6, color:hx(e.line) } : { type:'none' }]; }));
      if(e.headRule) rows[0].forEach(c => { c.options.border[2] = { type:'solid', pt:1, color:hx(e.edge) }; });
      rows.forEach(r => { r[0].options.border[3] = { type:'none' }; r[r.length - 1].options.border[1] = { type:'none' }; });
      slide.addTable(rows, { x:IN(e.x), y:IN(e.y), w:IN(e.colW.reduce((a, b) => a + b, 0)), colW:e.colW.map(IN), rowH:e.rowH.map(IN), fontSize:e.size, margin:[0, IN(e.px), 0, IN(e.px)], lineSpacing:e.lh, autoPage:false });
    }
  }
  if(notes) slide.addNotes(notes);
}
const bbox = pts => { const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)]; };
async function scenesPptx(scenes, title){
  await loadScript(PPTX_URL);
  const pptx = new PptxGenJS(); const sc0 = scenes[0];
  pptx.defineLayout({ name:'DANA', width:IN(sc0.w), height:IN(sc0.h) }); pptx.layout = 'DANA'; pptx.title = title || '제안서 초안';
  const bf = pptxFace(D.roles.body, 400).face, tf = pptxFace(D.roles.title, 700).face; pptx.theme = { headFontFace:tf, bodyFontFace:bf };
  for(const sc of scenes){ const pg = msPage(sc.n); await addScene(pptx, sc, `원고 ${sc.n}쪽 · ${pg?.title || ''}\n패턴: ${sc.pats.map(p => PATTERNS[p]?.name || p).join(', ')}${sc.issues.length ? '\n확인: ' + sc.issues.map(i => i.msg).join(' / ') : ''}`); }
  const buf = await pptx.write({ outputType:'arraybuffer' });
  return fixPptxFonts(buf);
}
// 한글 서체 속성 보강: ea 문자 집합을 한글(129 → -127)로, 서체 panose 기록
async function fixPptxFonts(buf){
  const zip = await JSZip.loadAsync(buf); const pan = {}; const ours = new Set();
  for(const f of families()) for(const fc of f.faces){ ours.add(fc.family); if(fc.panose) pan[fc.family] = fc.panose; }
  const files = Object.keys(zip.files).filter(k => /^ppt\/(slides\/slide\d+|theme\/theme\d+)\.xml$/.test(k));
  for(const k of files){ let x = await zip.file(k).async('string');
    x = x.replace(/<a:(latin|ea|cs) typeface="([^"]+)"([^>]*?)\/>/g, (m, tag, face) => { if(face.startsWith('+') || !ours.has(face)) return m; const p = pan[face] ? ` panose="${pan[face]}"` : '';
      const cs = tag === 'ea' ? '-127' : tag === 'cs' ? '0' : '0'; return `<a:${tag} typeface="${face}"${p} pitchFamily="34" charset="${cs}"/>`; });
    zip.file(k, x); }
  return zip.generateAsync({ type:'blob', mimeType:'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
}

// ───────────── PDF(인쇄·제출: 도련 포함 이미지 PDF)
const JSPDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
async function scenesPdf(scenes, dpi = 250, onPage){
  await new Promise((res, rej) => { if(window.jspdf) return res(); const s = document.createElement('script'); s.src = JSPDF_URL; s.onload = res; s.onerror = () => rej(new Error('script')); document.head.appendChild(s); });
  const { jsPDF } = window.jspdf; const sc0 = scenes[0]; const b = sc0.bleed || 0;
  const doc = new jsPDF({ unit:'pt', format:[sc0.w + b * 2, sc0.h + b * 2], orientation:sc0.w > sc0.h ? 'l' : 'p', compress:true });
  for(let i=0;i<scenes.length;i++){ const sc = scenes[i]; if(i) doc.addPage([sc.w + b * 2, sc.h + b * 2], sc.w > sc.h ? 'l' : 'p');
    const blob = await scenePng(sc, dpi / 72, 'image/jpeg', b); const url = await blobToDataURL(blob);
    doc.addImage(url, 'JPEG', 0, 0, sc.w + b * 2, sc.h + b * 2, undefined, 'FAST'); onPage?.(i + 1); }
  doc.setProperties({ title:'제안서 초안' });
  return doc.output('blob');
}
