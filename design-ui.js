'use strict';
// ═════════════════════════════ 디자인 모드 · 화면
// 화면은 4단계. 1~3단계는 확정 버튼으로 끝나고, 4단계에서 만들고 내보냄. (안쪽 화면 번호 1·2 / 4 / 5 / 6)
const STAGES = [
  { n:1, t:'자료·스타일', s:'자료 올리기 → 디자인 시스템', steps:[1, 2], gate:1, done:() => `디자인 가이드 v${D.guide?.version || '1.0'}` },
  { n:2, t:'쪽 계획', s:'배점 연결 → 페이지 플랜', steps:[4], gate:2, done:() => `${D.ms?.pages.length || 0}쪽 플랜` },
  { n:3, t:'시안 고르기', s:'샘플 3쪽 A/B', steps:[5], gate:3, done:() => '스타일 확정' },
  { n:4, t:'완성', s:'전체 생성 → 검수·내보내기', steps:[6], done:() => '내보냄' },
];
const stageOf = k => STAGES.find(s => s.steps.includes(k)) || STAGES[0];
const stageDone = st => st.gate ? D.gates['g' + st.gate] : !!D.review.exported;
const DZ = () => $('#modeDesign');
const PV = new Map();
const KIND_NAME = { diagram:'도식형', card:'카드형', table:'표형' };
function canGo(k){ if(k === 1) return true; if(k === 2) return !!D.ms; if(k <= 4) return D.gates.g1; if(k === 5) return D.gates.g2; if(k >= 6) return D.gates.g3; return false; }
function go(k){ k = k === 3 ? 4 : k === 7 ? 6 : k; if(!canGo(k)) return; D.step = k; renderDesign(); DZ().scrollIntoView({ behavior:'smooth', block:'start' }); if(k === 4 && !D.mapping) runMapping(); if(k === 6 && !D.gen.running && !Object.keys(D.pages).length) generateAll(); }
function busy(text, frac){ D.busy = text ? { text, frac } : null; const b = $('#dBusy'); if(!b) return; b.hidden = !text; if(text){ b.querySelector('.t').textContent = text; b.querySelector('.progress i').style.width = Math.round((frac || 0) * 100) + '%'; } }
const dmsg = (k, lv, t) => { D.msgs[k] = t ? { lv, t } : null; };
const msgHtml = k => D.msgs[k] ? `<div class="msg ${D.msgs[k].lv}">${esc(D.msgs[k].t)}</div>` : '';
async function dl(name, data){ if(!S.dl){ runText('이 화면에서는 파일을 내려받을 수 없습니다.'); return false; } try{ await S.dl.save({ filename:name, data }); return true; }catch(e){ if(e?.code !== 'declined') console.error(e); return false; } }
const today = () => new Date().toLocaleDateString('sv-SE');

// ───────────── 상단 탭
function setTab(m, save = true){
  $('#modeDesign').hidden = m !== 'design'; $('#modeReview').hidden = m !== 'review';
  $('#tabDesign').setAttribute('aria-selected', String(m === 'design')); $('#tabReview').setAttribute('aria-selected', String(m === 'review'));
  if(save){ try{ localStorage.setItem('dana:mode', m); }catch(e){} }
  if(m === 'design') renderDesign();
}

// ───────────── 과업지시서 제약 배너(두 탭 모두 위에 고정)
function renderBanner(){
  const bar = $('#conBar'); const cons = (D.rfp?.cons || []).filter(c => c.status !== 'off');
  const fontWarn = D.ms && !D.fams.length; const L = locks(); const faceMiss = L.face && !families().some(f => famMatch(f.label, L.face) || f.faces.some(x => famMatch(x.family, L.face)));
  if(!cons.length && !fontWarn && !faceMiss){ bar.hidden = true; return; }
  bar.hidden = false;
  const ok = cons.filter(c => c.status === 'ok'), chk = cons.filter(c => c.status === 'check');
  const lock = '<svg viewBox="0 0 12 12" aria-hidden="true"><rect x="2" y="5.5" width="8" height="5.5" rx="1" fill="currentColor"/><path d="M4 5.5V4a2 2 0 0 1 4 0v1.5" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>';
  let h = `<span class="ttl">과업지시서 제약</span><span class="csum">잠금 ${ok.length}개</span>`;
  h += ok.map(c => `<span class="cchip" title="${esc(c.quote)}${c.page ? ` (${c.page}쪽)` : ''}">${lock}${esc(c.label)}</span>`).join('');
  if(chk.length) h += `<button type="button" class="cchip check" data-act="conOpen">확인 필요 ${chk.length}</button>`;
  if(fontWarn) h += `<span class="cchip check" title="디자인 자료에 TTF·OTF 폰트를 올리면 미리보기와 파워포인트 줄바꿈이 같아집니다.">폰트 0 · 내장 서체로 그림</span>`;
  if(faceMiss) h += `<span class="cchip check">지정 서체 「${esc(L.face)}」 파일 필요</span>`;
  h += `<button type="button" class="ghost more" data-act="conOpen" aria-expanded="${!!D.conOpen}">${D.conOpen ? '접기' : '조항 보기'}</button>`;
  if(D.conOpen){
    h += '<div class="conlist">' + (D.rfp?.cons || []).map(c => `<div class="ci"><span class="tag ${c.status === 'ok' ? 't-done' : c.status === 'off' ? 't-wait' : 'c-warn'}">${c.status === 'ok' ? '잠금' : c.status === 'off' ? '해당 없음' : '확인 필요'}</span>
      <span><b>${esc(c.label)}</b> <q>${esc(c.quote || '직접 추가')}</q></span>
      <span class="row" style="gap:4px"><span class="pg">${c.page ? c.page + '쪽' : ''}</span>${c.status !== 'ok' ? `<button type="button" data-act="conOk" data-id="${c.id}">확정</button>` : ''}${c.status !== 'off' ? `<button type="button" class="ghost" data-act="conOff" data-id="${c.id}">해당 없음</button>` : ''}</span></div>`).join('')
      + `<form class="conadd" id="conAdd"><span class="muted">직접 추가</span><select id="caKind">${Object.entries(CON_KINDS).filter(([k]) => k !== 'other').map(([k, v]) => `<option value="${k}">${v.name}</option>`).join('')}<option value="other">기타 주의</option></select><input type="text" id="caVal" placeholder="값 (예: 11, 60, A4)" style="width:120px"><button type="submit">추가</button></form>`
      + '<p class="note">잠금 항목은 디자인 시스템의 하한·상한이 되고, 검수 탭 검사 기준에도 들어갑니다. 「글자 줄이기」를 눌러도 잠금 아래로는 내려가지 않습니다.</p></div>';
  }
  bar.innerHTML = h; bar.classList.toggle("open", !!D.conOpen);
  $('#conAdd')?.addEventListener('submit', e => { e.preventDefault(); const kind = $('#caKind').value, v = $('#caVal').value.trim(); const K = CON_KINDS[kind];
    if(K.num && !(parseFloat(v) > 0)){ $('#caVal').focus(); return; }
    D.rfp ||= { name:'직접 입력', items:[], cons:[], by:'user' };
    D.rfp.cons.push({ id:uid('c'), kind, value:K.num ? parseFloat(v) : (kind === 'blind' ? true : v), label:K.num ? (kind === 'pages_max' ? `${parseFloat(v)}쪽 이내` : `${K.name.replace(' 최소 글자 크기','')} ≥ ${parseFloat(v)}pt`) : (v || K.name), quote:'', page:null, status:'ok', by:'user' });
    afterConChange(); });
}
function afterConChange(){ D._auto = null; renderBanner(); PV.clear(); renderDesign(); saveSoon(); }

// ───────────── 화면 그리기
function stepper(){
  const cur = stageOf(D.step);
  return '<nav class="dstages" aria-label="디자인 단계">' + STAGES.map(st => { const done = stageDone(st), on = st === cur, k = on ? D.step : st.steps[0];
    const sub = done && !on ? `<span class="ok">✓ ${esc(st.done())}</span>` : esc(st.s);
    return `<button type="button" data-act="go" data-k="${k}" class="${done ? 'done' : ''} ${on ? 'cur' : ''}" ${canGo(st.steps[0]) ? '' : 'disabled'} ${on ? 'aria-current="step"' : ''}><span class="sn">${done ? '✓' : st.n}</span><span class="st"><b>${st.t}</b><small>${sub}</small></span></button>`; }).join('') + '</nav>';
}
// 단계 안의 작은 화면(1단계만 둘)
function subnav(){ const st = stageOf(D.step); if(st.steps.length < 2) return '';
  const names = { 1:'자료 올리기', 2:'디자인 시스템' };
  return `<div class="subnav" role="group" aria-label="${st.t} 안의 화면">${st.steps.map((k, i) => `<button type="button" data-act="go" data-k="${k}" aria-pressed="${D.step === k}" ${canGo(k) ? '' : 'disabled'}><i>${i + 1}</i>${names[k]}</button>`).join('<span aria-hidden="true">›</span>')}</div>`; }
const phead = (title, desc, extra = '') => { const st = stageOf(D.step); return `<header><span class="num">${st.n}</span><div><h2>${title}</h2><p>${desc}</p></div>${extra}</header>${subnav()}`; };
function renderDesign(){
  const z = DZ(); if(!z || z.hidden) return;
  if(D.step === 3) D.step = 4; if(D.step === 7) D.step = 6;
  const body = ({ 1:P1, 2:P2, 4:P4, 5:P5, 6:P6 })[D.step]();
  z.innerHTML = `<div class="dz">${stepper()}<div class="busy" id="dBusy" ${D.busy ? '' : 'hidden'}><span class="t">${esc(D.busy?.text || '')}</span><div class="progress"><i style="width:${Math.round((D.busy?.frac || 0) * 100)}%"></i></div></div>${body}</div>`;
  bindDesign(); fillPreviews();
}
const foot = (left, btn) => `<div class="dfoot"><span class="t">${left || ''}</span>${btn || ''}</div>`;
const gateBtn = (n, label, dis, why) => `${why ? `<span class="lockmsg">${esc(why)}</span>` : ''}<button type="button" class="primary big gatebtn" data-act="gate" data-g="${n}" ${dis ? 'disabled' : ''}><span class="dia" aria-hidden="true"></span>${label}</button>`;

// ── 1 자료 올리기
function dropZone(id, label, fmts, accept, multi){ return `<label class="drop" id="dz-${id}"><svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M10 4h14l8 8v22a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="2"/><path d="M24 4v8h8" stroke="currentColor" stroke-width="2"/><path d="M20 30V18m-5 5 5-5 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="pick">${label}</span><span class="or">또는 끌어다 놓기 · ${fmts}</span><input type="file" id="in-${id}" data-drop="${id}" accept="${accept}" ${multi ? 'multiple' : ''}></label>`; }
function P1(){
  const R = D.rfp, M = D.ms, A = D.assets;
  let rf = '';
  if(R && R.name !== '직접 입력'){ const tot = R.items.reduce((a, i) => a + i.score, 0);
    rf = `<div class="xcard ${R.itemsOk ? 'ok' : ''}"><div class="xh"><b>평가 항목 ${R.items.length}개 · ${r1(tot)}점</b><span class="fname">${esc(R.name)}</span><button type="button" class="ghost" data-act="rmRfp">빼기</button></div>`
      + (R.items.length ? `<div class="tablewrap" style="max-height:220px"><table><thead><tr><th>부문</th><th>평가 항목</th><th class="n">배점</th></tr></thead><tbody>${R.items.map(i => `<tr><td>${esc(i.area)}</td><td>${esc(i.name)}</td><td class="n">${r1(i.score)}</td></tr>`).join('')}</tbody></table></div>
        <div class="row">${R.itemsOk ? '<span class="tag t-done">배점표 확인함</span>' : '<span class="muted" style="font-size:12.5px">배점표가 맞나요?</span><button type="button" data-act="itemsOk">맞아요</button>'}</div>`
        : '<div class="msg warn">배점표를 찾지 못했습니다. 배점 없이 모든 절을 같은 밀도로 다룹니다.</div>')
      + `<div class="note">제약 조항 ${R.cons.length}개${R.cons.filter(c => c.status === 'check').length ? ` · 확인 필요 ${R.cons.filter(c => c.status === 'check').length}개는 위 배너에서 확정하세요` : ''}${R.by === 'claude' ? ' · Claude가 읽음' : ' · 문서에서 직접 찾음'}</div></div>`; }
  else rf = `<div class="note">없으면 배점 없이 모든 절을 같은 밀도로 다룹니다.</div>`;
  let ms = '';
  if(M){ const ct = contentPages(); const chs = [...new Set(M.sections.map(s => s.chapter).filter(Boolean))];
    ms = `<div class="xcard ${M.ok ? 'ok' : ''}"><div class="xh"><b>${M.pages.length}쪽 · 장 ${chs.length || '-'} · 절 ${M.sections.length}</b><span class="fname">${esc(M.name)}</span><button type="button" class="ghost" data-act="rmMs">빼기</button></div>
      <ul class="toc">${tocHtml()}</ul>
      <div class="note">표 ${M.pages.reduce((a, p) => a + p.blocks.filter(b => b.k === 'table').length, 0)}개 · 사진 ${M.pages.reduce((a, p) => a + p.pics.length, 0)}장${ct.length !== M.pages.length ? ` · 장 표지 ${M.pages.length - ct.length}쪽` : ''}</div>
      <div class="row">${M.ok ? '<span class="tag t-done">목차·쪽수 확인함</span>' : '<span class="muted" style="font-size:12.5px">절 목차와 쪽수가 맞나요?</span><button type="button" data-act="msOk">맞아요</button>'}</div></div>`; }
  const G = D.grid || DEFAULT_GRID(); const nG = A.grids.length, nR = A.refs.length, nF = D.fams.reduce((a, f) => a + f.faces.length, 0), nI = A.icons.length;
  const da = `<div class="xcard"><div class="kinds"><span class="${nG ? '' : 'zero-ok'}">그리드 ${nG}</span><span>레퍼런스 ${nR}</span><span class="${nF ? '' : 'zero'}">폰트 ${nF}</span>${nI ? `<span>아이콘 ${nI}</span>` : ''}${A.tokens ? '<span>디자인 시스템 1</span>' : ''}</div>
    ${nF ? '' : '<div class="msg warn">폰트가 없어 내장 서체(Noto Sans KR)로 그립니다. 쓸 서체의 TTF·OTF를 올리면 미리보기와 파워포인트 줄바꿈이 같아집니다.</div>'}
    <div class="gridfig">${gridSvg(G)}<div class="gv"><b>${esc(G.name)}</b><span>${r1(G.w / MM)}×${r1(G.h / MM)}mm · 본문 ${r1((G.w - G.ml - G.mr) / MM)}×${r1((G.h - G.mb - G.bodyTop) / MM)}mm</span>
      <div class="numrow">여백 좌 <input type="number" step="0.5" data-grid="ml" value="${r1(G.ml / MM)}"> 우 <input type="number" step="0.5" data-grid="mr" value="${r1(G.mr / MM)}"> 아래 <input type="number" step="0.5" data-grid="mb" value="${r1(G.mb / MM)}"> mm</div>
      <div class="numrow">머리틀 위 <input type="number" step="0.5" data-grid="mt" value="${r1(G.mt / MM)}"> 본문 시작 <input type="number" step="0.5" data-grid="bodyTop" value="${r1(G.bodyTop / MM)}"> mm</div></div></div>
    <div class="fontrow"><span>본문 서체</span>${fontSel('body')}<span>제목 서체</span>${fontSel('title')}<span>숫자 강조</span>${fontSel('num', true)}</div>
    ${nR ? `<div class="row" style="gap:6px">${A.refs.map(r => `<img src="${r.url}" alt="${esc(r.name)}" title="${esc(r.name)}" style="width:44px;height:44px;object-fit:cover;border-radius:6px;border:1px solid var(--line)">`).join('')}</div>` : ''}
    ${msgHtml('assets')}</div>`;
  const okNext = !!M;
  return `<section class="dpanel">${phead('자료 올리기', '가진 파일을 칸에 끌어다 놓기만 하면 됩니다. 원고는 꼭 필요하고, 나머지는 없어도 진행됩니다.')}
    ${D.restored && !M ? `<div class="msg info">저장된 프로젝트(${esc(D.restored)})를 불러왔습니다. 원고 파일을 다시 올리면 이어서 작업합니다. 올린 파일은 저장하지 않습니다.</div>` : ''}
    <div class="dcols">
      <div class="dcol"><h3>과업지시서 <span class="pill">선택</span></h3><p class="hint2">과업지시서·제안요청서·입찰 공고</p>${dropZone('rfp', '과업지시서 선택', 'PDF·HWPX·DOCX', '.pdf,.hwpx,.docx,.txt,.hwp')}${msgHtml('rfp')}${rf}</div>
      <div class="dcol"><h3>원고 <span class="pill req">필수</span></h3><p class="hint2">주제별 원고. 원고 1쪽이 디자인 1쪽이 됩니다.</p>${dropZone('ms', '원고 선택', 'PPTX·DOCX·HWPX·PDF', '.pptx,.docx,.hwpx,.pdf,.txt,.hwp')}${msgHtml('ms')}${ms}</div>
      <div class="dcol"><h3>디자인 자료 <span class="pill">선택</span></h3><p class="hint2">그리드·레퍼런스·폰트를 한 번에. 종류는 Dana가 나눕니다.</p>${dropZone('assets', '디자인 자료 선택', 'PPTX·이미지·PDF·TTF·OTF', '.pptx,.png,.jpg,.jpeg,.webp,.pdf,.ttf,.otf,.ttc,.json,.svg,.woff,.woff2', true)}${da}</div>
    </div>${foot(okNext ? '' : '원고를 올리면 다음으로 갈 수 있습니다.', `<button type="button" class="primary big" data-act="go" data-k="2" ${okNext ? '' : 'disabled'}>다음: 디자인 시스템 →</button>`)}</section>`;
}
function tocHtml(){ const M = D.ms; let h = '', lastCh = null;
  for(const s of M.sections){ if(s.chapter && s.chapter !== lastCh){ lastCh = s.chapter; h += `<li class="ch"><span class="t">${esc(s.chapterTitle || s.chapter)}</span></li>`; }
    h += `<li><span class="t">${esc(s.title)}</span><span class="n">${rangeText(s.pages)} · ${s.pages.length}쪽</span></li>`; }
  return h; }
function fontSel(role, none){ const cur = role === 'num' ? D.roles.num : D.roles[role];
  return `<select data-role="${role}">${none ? `<option value="" ${!cur ? 'selected' : ''}>따로 두지 않음</option>` : ''}${families().map(f => `<option value="${esc(f.key)}" ${f.key === cur ? 'selected' : ''}>${esc(f.label)}${f.builtin ? ' (내장)' : ` · ${f.faces.length}종`}</option>`).join('')}</select>`; }
function gridSvg(G){ const s = 96 / G.w, w = 96, h = G.h * s; return `<svg viewBox="0 0 ${w} ${r1(h)}" aria-label="그리드 미리보기"><rect x="${r1(G.ml * s)}" y="${r1(G.mt * s)}" width="${r1((G.w - G.ml - G.mr) * s)}" height="${r1((G.bodyTop - G.mt - 6) * s)}" fill="#DCE4F0"/><rect x="${r1(G.ml * s)}" y="${r1(G.bodyTop * s)}" width="${r1((G.w - G.ml - G.mr) * s)}" height="${r1((G.h - G.mb - G.bodyTop) * s)}" fill="none" stroke="#2E7BC4" stroke-dasharray="2 1.5" stroke-width=".8"/></svg>`; }

// ── 2 디자인 시스템
function moodSamplePage(){ const ps = contentPages(); let best = ps[0], bv = -1;
  for(const p of ps){ const ids = patternsFor(p.n); const v = new Set(ids).size * 2 + ids.filter(id => id !== 'list').length + (p.st.subs.length >= 2 ? 1 : 0) - (p.pics.length ? 1 : 0); if(v > bv){ bv = v; best = p; } }
  return best?.n; }
function topicsInMs(){ const t = D.ms?.text || ''; return Object.keys(ICON_TOPICS).filter(k => ICON_TOPICS[k].re.test(t)); }
function P2(){
  const n = moodSamplePage(); const L = locks(); const m = MOODS[D.mood]; const refCols = [...new Set(D.assets.refs.flatMap(r => r.palette || []))].slice(0, 8);
  const prim = D.colors.primary || m.primary, acc = D.colors.accent || m.accent; const tk = tokens();
  const sw = (list, cur, k) => list.map(c => `<button type="button" data-act="color" data-k="${k}" data-v="${c}" aria-pressed="${c.toUpperCase() === cur.toUpperCase()}" style="background:${c}" title="${c}"></button>`).join('');
  const topics = topicsInMs();
  const faceMiss = L.face && !families().some(f => famMatch(f.label, L.face) || f.faces.some(x => famMatch(x.family, L.face)));
  const g1 = D.gates.g1; const dirty = g1 && guideDirty();
  return `<section class="dpanel">${phead('디자인 시스템', `같은 쪽(원고 ${n}쪽)을 세 가지 무드로 그렸습니다. 하나를 고르고, 필요하면 색만 한두 개 바꾸세요.`, g1 ? `<span class="vtag">디자인 가이드 v${esc(D.guide.version)}</span>` : '')}
    <div class="moods">${Object.entries(MOODS).map(([id, mm]) => `<button type="button" class="mood" data-act="mood" data-v="${id}" aria-pressed="${D.mood === id}"><div class="pv"><img alt="${esc(mm.name)} 무드로 그린 ${n}쪽" data-pv="mood:${id}:${n}"></div><div class="mh"><b>${esc(mm.name)}</b><span class="sw">${[id === D.mood ? prim : mm.primary, mix(id === D.mood ? prim : mm.primary, '#FFFFFF', .88), mm.point, id === D.mood ? acc : mm.accent].map(c => `<i style="background:${c}"></i>`).join('')}</span>${id === 'navy' ? '<span class="tag rec">권장</span>' : ''}</div></button>`).join('')}</div>
    <div class="sysgrid2">
      <div class="blk"><h3>색 조정 (${esc(m.name)})</h3>
        <div class="swpick"><span class="lbl">주색</span>${sw([...m.primaries, ...refCols.filter(c => lum(c) < .25)], prim, 'primary')}</div>
        <div class="swpick"><span class="lbl">강조색</span>${sw([...m.accents, ...refCols.filter(c => lum(c) >= .12)], acc, 'accent')}</div>
        ${refCols.length ? '<p class="note">뒤쪽 색은 레퍼런스에서 뽑았습니다.</p>' : ''}
        <h3 style="margin-top:6px">글꼴</h3><div class="fontrow"><span>본문</span><span>${esc(famOf(D.roles.body).label)} ${tk.size.body}pt · 줄 간격 ${tk.lh}</span><span>제목</span><span>${esc(famOf(D.roles.title).label)} ${tk.size.title}pt</span><span>표·캡션</span><span>${tk.size.table}pt · ${tk.size.caption}pt</span></div>
        <h3 style="margin-top:6px">과업지시서 잠금</h3><ul class="issues">${[L.bodyMin ? `<li>🔒 본문 글자 ${L.bodyMin}pt 아래로 내려가지 않음</li>` : '', L.figMin ? `<li>🔒 표·그림 글자 ${L.figMin}pt 이상</li>` : '', L.pagesMax ? `<li>🔒 총 ${L.pagesMax}쪽 이내</li>` : '', L.blind ? '<li>🔒 블라인드 평가 — 업체 식별 요소 금지</li>' : '', L.face ? `<li>🔒 지정 서체 ${esc(L.face)}</li>` : ''].join('') || '<li class="muted">잠금 항목 없음</li>'}<li>그림자 쓰지 않음 · 쪽마다 큰 도식 1개 · 본문 아래 빈 공간 5mm 이하</li></ul>
      </div>
      <div class="blk"><h3>아이콘 세트 · 원고 주제 ${topics.length}개</h3><p class="note">모든 쪽이 같은 세트를 씁니다. 바꿀 주제를 누르세요.</p>
        <div class="icons">${topics.map(t => `<button type="button" data-act="iconOpen" data-v="${esc(t)}" aria-pressed="${D.iconOpen === t}"><img alt="" src="${iconDataURL(iconFor(t), iconColors(tk.iconTone, tk.color).fg, iconColors(tk.iconTone, tk.color).bg)}">${esc(t)}${String(D.iconMap[t] || '').startsWith('file:') ? '<small>올린 파일</small>' : ''}</button>`).join('') || '<span class="muted">아이콘이 필요한 주제를 찾지 못했습니다.</span>'}</div>
        ${D.iconOpen ? `<div class="iconpick" role="group" aria-label="${esc(D.iconOpen)} 아이콘 고르기">${Object.keys(ICONS).map(k => `<button type="button" data-act="iconSet" data-v="${k}" title="${ICON_NAMES[k] || k}"><img alt="${ICON_NAMES[k] || k}" src="${iconDataURL(k, tk.color.p1)}"></button>`).join('')}</div>` : ''}
      </div>
    </div>
    ${foot(g1 ? (dirty ? '바뀐 내용이 있습니다. 가이드를 갱신하면 버전이 올라갑니다.' : `확정됨 · ${esc(D.guide.date)}`) : '확정하면 디자인 가이드 v1.0이 만들어지고 2단계로 넘어갑니다.',
      g1 ? `<button type="button" data-act="dlGuide">가이드 받기(.md·.json)</button>${dirty ? '<button type="button" class="primary" data-act="bump">가이드 갱신</button>' : ''}<button type="button" class="primary big" data-act="go" data-k="4">다음: 쪽 계획 →</button>`
         : gateBtn(1, '이 디자인 시스템으로 확정', faceMiss, faceMiss ? `과업지시서 지정 서체 「${L.face}」 파일을 디자인 자료에 올려 주세요.` : ''))}
    ${D.bumpAsk ? `<div class="msg info">가이드를 v${esc(D.guide.version)}로 올렸습니다. 이미 만든 쪽에도 다시 적용할까요? <button type="button" data-act="bumpAll">모든 쪽에 다시 적용</button> <button type="button" class="ghost" data-act="bumpLater">이후 쪽부터(기본)</button></div>` : ''}
  </section>`;
}
function guideSig(){ return JSON.stringify([D.mood, D.colors, D.roles, D.iconMap, D.grid, locks()]); }
function guideDirty(){ return D.guide && D.guide.sig !== guideSig(); }
function tokensJson(){
  const tk = D.guide?.tk || tokens(); const G = tk.grid; const st = D.style || STYLE_A;
  return { name:'Dana 디자인 시스템', mood:tk.moodName, version:D.guide?.version || '0', date:D.guide?.date || today(), unit:'pt',
    page:{ size:{ w:r2(G.w), h:r2(G.h) }, bleed:r2(G.bleed), margin:{ left:r2(G.ml), right:r2(G.mr), top:r2(G.mt), bottom:r2(G.mb) }, body:{ x:[r2(G.ml), r2(G.w - G.mr)], y:[r2(G.bodyTop), r2(G.h - G.mb)] }, binding:conAny('binding')?.value || null },
    font:{ body:{ family:pptxFace(D.roles.body, 400).face, size:tk.size.body, lineHeight:tk.lh }, title:{ family:pptxFace(D.roles.title, 700).face, size:tk.size.title }, subtitle:{ size:tk.size.sub }, table:{ size:tk.size.table }, caption:{ size:tk.size.caption },
      number:D.roles.num ? { family:pptxFace(D.roles.num, 700).face, use:'강조 숫자와 짧은 단어에만' } : null, min:{ body:tk.locks.bodyMin, figure:tk.locks.figMin } },
    color:{ primary:[tk.color.p0, tk.color.p1, tk.color.p2], background:[tk.color.bg, tk.color.bg2], line:tk.color.line, point:tk.color.point, accent:tk.color.accent, ink:[tk.color.ink, tk.color.ink2] },
    component:{ radius:tk.r, header:tk.header, subtitle:st.sub, card:st.card, table:st.table, flow:st.flow, hub:st.hub, kpi:st.kpi, timeline:st.timeline, vs:st.vs },
    icon:{ style:'line', weight:1.8, corner:'round', tone:tk.iconTone === 'dark' ? '진한 바탕+밝은 글리프' : '연한 바탕+진한 글리프', sizes:{ card:22, hub:20 }, topics:Object.fromEntries(topicsInMs().map(t => [t, iconFor(t)])) },
    rules:{ shadow:false, bigDiagramPerPage:1, bottomGapMaxMm:5, blind:!!tk.locks.blind, pagesMax:tk.locks.pagesMax },
    history:D.guide?.history || [] };
}
function guideMd(){ const j = tokensJson(); const c = j.color;
  return `# 디자인 가이드 v${j.version}\n\n${j.mood} 무드 · ${j.date}\n\n## 페이지\n- 크기 ${r1(j.page.size.w / MM)}×${r1(j.page.size.h / MM)}mm, 도련 ${r1(j.page.bleed / MM)}mm${j.page.binding ? `, ${j.page.binding}` : ''}\n- 여백 좌 ${r1(j.page.margin.left / MM)} · 우 ${r1(j.page.margin.right / MM)} · 위 ${r1(j.page.margin.top / MM)} · 아래 ${r1(j.page.margin.bottom / MM)}mm\n- 본문 영역 x ${j.page.body.x.join('~')}pt, y ${j.page.body.y.join('~')}pt\n\n## 글꼴\n- 본문 ${j.font.body.family} ${j.font.body.size}pt, 줄 간격 ${j.font.body.lineHeight}\n- 제목 ${j.font.title.family} ${j.font.title.size}pt · 소제목 ${j.font.subtitle.size}pt · 표 ${j.font.table.size}pt · 캡션 ${j.font.caption.size}pt\n${j.font.number ? `- 숫자 강조 ${j.font.number.family} (${j.font.number.use})\n` : ''}${j.font.min.body ? `- 과업지시서 잠금: 본문 ${j.font.min.body}pt 이상\n` : ''}\n## 색\n- 주색 ${c.primary.join(' / ')}\n- 바탕 ${c.background.join(' / ')} · 괘선 ${c.line}\n- 포인트 ${c.point} · 강조 ${c.accent} · 글자 ${c.ink.join(' / ')}\n\n## 컴포넌트\n- 머리틀 ${j.component.header} · 모서리 ${j.component.radius}pt\n- 소제목 ${j.component.subtitle}안 · 카드 ${j.component.card}안 · 표 ${j.component.table}안 · 흐름 ${j.component.flow}안 · 허브 ${j.component.hub}안 · KPI ${j.component.kpi}안\n\n## 아이콘\n- ${j.icon.style} · 굵기 ${j.icon.weight} · ${j.icon.tone}\n${Object.entries(j.icon.topics).map(([t, i]) => `- ${t}: ${i}`).join('\n')}\n\n## 규칙\n- 그림자 쓰지 않음\n- 쪽마다 큰 도식 1개\n- 본문 아래 빈 공간 ${j.rules.bottomGapMaxMm}mm 이하\n${j.rules.blind ? '- 블라인드 평가: 회사명·로고·인물 노출 금지\n' : ''}${j.rules.pagesMax ? `- 총 ${j.rules.pagesMax}쪽 이내\n` : ''}\n## 변경 이력\n${j.history.map(h => `- ${h.date} v${h.v} ${h.note}`).join('\n')}\n`; }

// ── 3 자료 분석
async function runMapping(force){
  if(!D.rfp?.items.length){ D.mapping = {}; renderDesign(); return; }
  if(D.mapping && !force) return;
  busy('평가 항목과 원고 절을 잇는 중…', .4);
  try{ D.mapping = S.sample ? await claudeMap() : autoMap(); }catch(e){ console.warn(e); D.mapping = autoMap(); }
  if(!Object.values(D.mapping).some(a => a.length)) D.mapping = autoMap();
  D._an = null; D._auto = null; busy(null); renderDesign(); saveSoon();
}
function mapBlock(){
  const items = D.rfp?.items || [];
  if(!items.length) return `<div class="blk"><h3>배점 연결</h3><p class="muted" style="font-size:13px">과업지시서 배점이 없어 모든 절을 같은 밀도로 다룹니다.</p></div>`;
  if(!D.mapping) return `<div class="blk"><h3>배점 연결</h3><p class="muted" style="font-size:13px">평가 항목과 원고 절을 잇고 있습니다…</p></div>`;
  const A = D._an = analysis(); const maxD = Math.max(.01, ...A.secs.map(s => s.density));
  const used = new Set(Object.values(D.mapping).flat()); const free = D.ms.sections.filter(s => !used.has(s.id));
  const linked = items.length - A.unmapped.length;
  const rows = items.map(it => { const ss = (D.mapping[it.id] || []).map(id => D.ms.sections.find(s => s.id === id)).filter(Boolean); const pages = ss.reduce((a, s) => a + s.pages.length, 0);
    return `<tr><td>${esc(it.area)}</td><td><b>${esc(it.name)}</b></td><td class="n">${r1(it.score)}</td>
      <td><div class="secchips">${ss.map(s => `<span>${esc(s.title)}<button type="button" data-act="unmap" data-i="${it.id}" data-s="${s.id}" aria-label="${esc(s.title)} 빼기">×</button></span>`).join('')}
        <select data-map="${it.id}" aria-label="${esc(it.name)}에 절 더하기"><option value="">+ 절 더하기</option>${D.ms.sections.filter(s => !ss.includes(s)).map(s => `<option value="${s.id}">${esc(s.title)}${used.has(s.id) ? ' (다른 항목에서 옮김)' : ''}</option>`).join('')}</select></div></td>
      <td class="n">${pages || '<span class="tag c-warn">없음</span>'}</td><td>${pages ? `<span class="dens" style="width:${Math.round(60 * (it.score / pages) / maxD)}px"></span>${r1(it.score / pages)}점/쪽` : ''}</td></tr>`; }).join('');
  return `<details class="blk dfold" ${D.mapOpen ? 'open' : ''} data-fold="mapOpen"><summary><b>배점 연결</b><span class="tag ${A.unmapped.length ? 'c-warn' : 't-done'}">평가 항목 ${linked}/${items.length} 연결</span>${free.length ? `<span class="tag t-wait">배점 없는 절 ${free.length}</span>` : ''}<span class="muted">${D.mapOpen ? '접기' : '틀린 연결이 있으면 열어서 고치기'}</span></summary>
    <p class="note">평가 항목마다 원고의 어느 절이 답하는지 이었습니다. 배점 ÷ 쪽수가 도식 밀도와 샘플 순서를 정합니다. <button type="button" class="ghost" data-act="remap">다시 자동 연결</button></p>
    <div class="tablewrap"><table class="maptbl"><thead><tr><th>부문</th><th>평가 항목</th><th class="n">배점</th><th>원고 절</th><th class="n">쪽수</th><th>밀도</th></tr></thead><tbody>${rows}</tbody></table></div>
    ${free.length ? `<div class="msg info">배점이 이어지지 않은 절: ${free.map(s => esc(s.title)).join(', ')}</div>` : ''}
    ${A.unmapped.length ? `<div class="msg warn">원고에서 찾지 못한 평가 항목: ${A.unmapped.map(i => `${esc(i.name)}(${r1(i.score)}점)`).join(', ')} — 보완 제안의 「부족」으로 넘어갑니다.</div>` : ''}</details>`;
}

// ── 4 보완 제안 + 페이지 플랜
function suggestions(){
  const A = D._an = analysis(); const out = []; const items = D.rfp?.items || [];
  for(const it of A.unmapped) out.push({ id:'lack:' + it.name, type:'부족', text:`「${it.name}」(${r1(it.score)}점) 항목을 다루는 원고가 없습니다.` });
  if(items.length) for(const s of A.secs){
    if(s.status === 'lack') out.push({ id:'lack:' + s.id, type:'부족', text:`「${s.title}」 ${s.pages.length}쪽 — 배점 ${r1(s.score)}점에 비해 분량이 적습니다(배점 비율로 약 ${Math.max(1, Math.round(s.expected))}쪽).` });
    if(s.status === 'over') out.push({ id:'over:' + s.id, type:'과잉', text:`「${s.title}」 ${s.pages.length}쪽 — 배점 ${r1(s.score)}점에 비해 분량이 많습니다. 줄여도 되는 후보입니다(약 ${Math.max(1, Math.round(s.expected))}쪽).` });
    if(s.status === 'zero') out.push({ id:'zero:' + s.id, type:'과잉', text:`「${s.title}」 ${s.pages.length}쪽 — 이어진 평가 항목이 없습니다.` });
  }
  for(const pg of contentPages()){ const ids = patternsFor(pg.n);
    pg.st.subs.forEach((s, i) => { if(ids[i] !== 'list') return; const txt = s.items.map(x => x.text).join(' ');
      if((txt.match(new RegExp(NUM_UNIT.source, 'g')) || []).length >= 2 || /→|단계|절차|순서/.test(txt)) out.push({ id:`viz:${pg.n}:${i}`, type:'도식화', text:`${pg.n}쪽 「${s.head || '내용'}」 — 수치·단계가 있어 인포그래픽으로 바꿀 수 있습니다. 원고를 항목별로 나눠 쓰면 자동으로 도식이 됩니다.` }); }); }
  for(const pg of contentPages()){ const sc = composePage(pg.n, { tk:D.guide?.tk }); if(sc.overflow) out.push({ id:'fit:' + pg.n, type:'분량 조정', text:`${pg.n}쪽 원고가 한 쪽에 다 들어가지 않습니다. 원고 담당자가 줄인 뒤 다시 올려 주세요.` });
    for(const is of sc.issues.filter(x => x.id === 'blind')) out.push({ id:'blind:' + pg.n, type:'블라인드', text:`${pg.n}쪽 ${is.msg.replace('블라인드 평가: ', '')}` }); }
  return out;
}
function P4(){
  const A = D._an = analysis(); const L = locks(); const total = D.ms.pages.length; const over = L.pagesMax && total > L.pagesMax;
  const sg = D._sugg = suggestions(); const maxD = Math.max(.01, ...A.secs.map(s => s.density)); const items = D.rfp?.items || [];
  const stName = { lack:'부족', over:'과잉', ok:'적정', zero:'배점 없음' }; const edit = !!D.patEdit;
  let rows = '';
  for(const s of A.secs){
    const pageCells = s.pages.map(n => { const pg = msPage(n); const ids = patternsFor(n);
      const cells = pg.st.subs.map((sub, i) => { if(ids[i] === 'vs+') return ''; if(!edit) return `<span class="pchip">${PATTERNS[ids[i]]?.name || ids[i]}</span>`;
        const cs = ids[i] === 'vs' ? [{ id:'vs' }, ...patCandidates(sub)] : patCandidates(sub); const auto = (D._auto ||= autoPatterns())[n]?.[i];
        return `<select data-pat="${n}:${i}" title="${esc(sub.head || '내용')}" aria-label="${n}쪽 ${esc(sub.head || '내용')} 인포그래픽">${cs.map(c => `<option value="${c.id}" ${c.id === ids[i] ? 'selected' : ''}>${PATTERNS[c.id]?.name || c.id}${c.id === auto ? ' (권장)' : ''}</option>`).join('')}</select>`; }).join('');
      return `<div class="patchips"><b style="font-size:12px;min-width:34px">${n}쪽</b>${cells}${pg.pics.length ? '<span class="pchip">사진</span>' : ''}</div>`; }).join('');
    rows += `<tr><td><b>${esc(s.title)}</b></td><td class="n">${items.length ? r1(s.score) : '-'}</td><td class="n">${s.pages.length}</td><td>${items.length ? `<span class="dens" style="width:${Math.round(50 * s.density / maxD)}px"></span>` : ''}<span class="tag st-${s.status}">${stName[s.status]}</span></td><td>${pageCells}</td></tr>`;
  }
  const dec = D.plan.dec; const g2 = D.gates.g2;
  return `<section class="dpanel">${phead('쪽 계획', '쪽수는 원고가 정하고, 배점은 쪽 안의 도식 밀도와 샘플 순서를 정합니다. 이상이 없으면 바로 확정하세요.')}
    <div class="totalbar"><span>원고 총 <b>${total}</b>쪽 = 플랜 <b>${total}</b>쪽 🔒</span>${L.pagesMax ? `<span class="${over ? 'tag c-err' : 'tag t-done'}">과업지시서 ${L.pagesMax}쪽 이내 ${over ? '· 넘침' : '✓'}</span>` : ''}${items.length ? `<span>배점 합계 <b>${r1(A.T)}</b>점</span>` : '<span class="muted">배점 없음 · 같은 밀도</span>'}${D.ms.pages.length !== contentPages().length ? `<span class="muted">장 표지 ${D.ms.pages.length - contentPages().length}쪽 포함</span>` : ''}</div>
    ${over ? `<div class="msg err">원고가 과업지시서 상한(${L.pagesMax}쪽)보다 ${total - L.pagesMax}쪽 많습니다. Dana는 쪽수를 바꾸지 않습니다. 원고 담당자가 분량을 줄인 뒤 다시 올려 주세요.</div>` : ''}
    ${mapBlock()}
    <div class="blk"><div class="row" style="justify-content:space-between"><h3>페이지 플랜</h3><button type="button" class="ghost" data-act="patEdit" aria-pressed="${edit}">${edit ? '바꾸기 끝' : '인포그래픽 유형 바꾸기'}</button></div>
      <div class="tablewrap"><table><thead><tr><th>절</th><th class="n">배점</th><th class="n">쪽수</th><th>상태</th><th>쪽별 인포그래픽</th></tr></thead><tbody>${rows}</tbody></table></div></div>
    <details class="blk dfold" ${D.suggOpen ? 'open' : ''} data-fold="suggOpen"><summary><b>보완 제안</b><span class="tag ${sg.length ? 'c-warn' : 't-done'}">${sg.length}건</span><span class="muted">원고 담당자에게 전달할 목록 · 확정에는 필요 없음</span></summary>
      ${sg.length ? `<ul class="list sugg">${sg.map(x => `<li><span class="tag ${x.type === '부족' || x.type === '분량 조정' || x.type === '블라인드' ? 'c-warn' : x.type === '과잉' ? 'c-info' : 't-svg'}">${x.type}</span><span class="tx">${esc(x.text)}</span><span class="seg" role="group" aria-label="결정"><button type="button" data-act="dec" data-id="${esc(x.id)}" data-v="accept" aria-pressed="${dec[x.id] === 'accept'}">수용</button><button type="button" data-act="dec" data-id="${esc(x.id)}" data-v="hold" aria-pressed="${dec[x.id] === 'hold'}">보류</button></span></li>`).join('')}</ul>` : '<p class="muted">제안할 것이 없습니다.</p>'}
      <div class="row"><button type="button" data-act="xlsPlan">배점 매핑표·보완 제안 엑셀로 받기</button></div></details>
    ${foot(g2 ? '페이지 플랜 확정됨' : '확정하면 배점 높은 절에서 샘플 3쪽을 만들고 3단계로 넘어갑니다.', g2 ? `<button type="button" class="primary big" data-act="go" data-k="5">다음: 시안 고르기 →</button>` : gateBtn(2, '이 플랜으로 확정'))}</section>`;
}

// ── 5 샘플 3쪽 A/B
function pickSamples(){
  const A = D._an = analysis(); const order = [...A.secs].sort((a, b) => b.density - a.density || a.pages[0] - b.pages[0]);
  const pages = order.flatMap(s => s.pages); const out = []; const used = new Set();
  for(const kind of ['diagram', 'card', 'table']){ const n = pages.find(p => !used.has(p) && pageKind(p) === kind); if(n){ used.add(n); out.push({ n, kind }); } }
  for(const n of pages){ if(out.length >= 3) break; if(!used.has(n)){ used.add(n); out.push({ n, kind:pageKind(n) }); } }
  return out.slice(0, 3).map(s => ({ ...s, pick:'A' }));
}
function P5(){
  if(!D.samples.length) D.samples = pickSamples();
  const g3 = D.gates.g3;
  return `<section class="dpanel">${phead('시안 고르기', '배점 높은 절에서 유형이 다른 3쪽을 두 가지로 그렸습니다. 쪽마다 마음에 드는 쪽을 누르세요. 권장안이 미리 골라져 있어 그대로 확정해도 됩니다.')}
    <div class="ab">${D.samples.map((s, i) => { const pg = msPage(s.n); return `<div class="abrow"><div class="abh"><b>샘플 ${i + 1} · ${s.n}쪽</b><span class="tag t-pdf">${KIND_NAME[s.kind]}</span><span class="muted" style="font-size:12.5px">${esc(pg.title)}</span></div>
      <div class="abpair">${['A', 'B'].map(v => `<button type="button" data-act="pick" data-i="${i}" data-v="${v}" aria-pressed="${s.pick === v}"><div class="pv"><img alt="${s.n}쪽 ${v}안" data-pv="ab:${s.n}:${v}"></div><div class="cap"><b>${v}안</b>${v === 'A' ? '<span class="tag rec">권장</span>' : ''}<span class="muted">${v === 'A' ? styleDesc(STYLE_A, s.kind) : styleDesc(STYLE_B, s.kind)}</span></div></button>`).join('')}</div></div>`; }).join('')}</div>
    ${foot(g3 ? `스타일 확정됨 · 디자인 가이드 v${esc(D.guide.version)}` : '확정하면 고른 스타일로 모든 쪽을 만들고 4단계로 넘어갑니다.', g3 ? `<button type="button" class="primary big" data-act="go" data-k="6">다음: 완성 →</button>` : gateBtn(3, '이 스타일로 확정'))}</section>`;
}
function styleDesc(st, kind){ const A = st === STYLE_A; return kind === 'table' ? (A ? '진한 머리행 표 · 테두리 카드' : '연한 머리행·줄무늬 표 · 색 채운 카드') : kind === 'diagram' ? (A ? '화살표 흐름 · 원형 허브' : '번호 원 흐름 · 색 채운 상자') : (A ? '테두리 카드 · 소제목 밑줄' : '색 채운 카드 · 소제목 띠'); }
function styleFromSamples(){
  const st = { ...STYLE_A }; const vote = { A:0, B:0 };
  for(const s of D.samples){ vote[s.pick]++; const B = s.pick === 'B' ? 'B' : 'A';
    if(s.kind === 'table') st.table = B; if(s.kind === 'card'){ st.card = B; st.kpi = B; } if(s.kind === 'diagram'){ st.flow = B; st.hub = B; st.timeline = B; st.vs = B; } }
  st.sub = vote.B > vote.A ? 'B' : 'A';
  if(!D.samples.some(s => s.kind === 'card')) st.card = st.kpi = st.sub; if(!D.samples.some(s => s.kind === 'table')) st.table = st.sub; if(!D.samples.some(s => s.kind === 'diagram')) st.flow = st.hub = st.timeline = st.vs = st.sub;
  return st;
}

// ── 6 전체 생성(디자인 보드)
async function genPage(n, opt){
  const P = D.pages[n] ||= { n, opt:{}, hist:[] };
  if(opt){ P.hist.push({ ...P.opt }); if(P.hist.length > 20) P.hist.shift(); P.opt = { ...P.opt, ...opt }; }
  const pg = msPage(n); const tk = P.tk || D.guide?.tk || tokens(); P.tk = tk;
  const sc = pg.divider ? composeDivider(n, tk) : composePage(n, { tk, style:P.opt.style || D.style, pats:P.opt.pats, level:P.opt.level || 0, fontStep:P.opt.fontStep || 0 });
  P.sc = sc; const blob = await scenePng(sc); if(P.url) URL.revokeObjectURL(P.url); P.url = URL.createObjectURL(blob); P.svg = null;
  return P;
}
function composeDivider(n, tk){
  const pg = msPage(n); const G = tk.grid, c = tk.color; const W = G.w, H = G.h;
  const lines = wrap(pg.title, W - G.ml - G.mr, 'title', 700, tk.size.title + 8); const lh = (tk.size.title + 8) * 1.3;
  const rest = pg.blocks.filter(b => b.k === 'p').map(b => b.text); const y = H * .42;
  const els = [E.rect(-G.bleed, -G.bleed, W + G.bleed * 2, H * .62 + G.bleed, { fill:c.p1 }), E.rect(G.ml, y - 18, 40, 4, { fill:c.accent }), T(lines, G.ml, y, W - G.ml - G.mr, { size:tk.size.title + 8, weight:700, role:'title', color:c.onP1, lh })];
  let yy = y + lines.length * lh + 10; for(const t of rest){ const l = wrap(t, W - G.ml - G.mr, 'body', 400, tk.size.sub); els.push(T(l, G.ml, yy, W - G.ml - G.mr, { size:tk.size.sub, color:c.p2, lh:tk.size.sub * 1.5 })); yy += l.length * tk.size.sub * 1.5 + 4; }
  return { n, w:W, h:H, bleed:G.bleed, groups:[{ id:'part-1', title:'장 표지', els }], issues:[], level:0, overflow:false, pats:['divider'], tk, style:D.style || STYLE_A };
}
async function generateAll(only){
  if(D.gen.running) return; D.gen.running = true; D.gen.done = false;
  const ns = only || D.ms.pages.map(p => p.n);
  if(!only) for(const n of ns){ const P = D.pages[n]; if(P){ P.tk = D.guide.tk; } }
  await ensureFonts(D.ms.text); resetMetrics();
  for(let i=0;i<ns.length;i++){ busy(`쪽을 만드는 중… ${i + 1}/${ns.length}`, (i + 1) / ns.length); await genPage(ns[i]); if(D.step === 6) renderBoard(); await tick(); }
  D.gen.running = false; D.gen.done = true; busy(null); if(D.step === 6) renderDesign(); saveSoon();
}
function P6(){
  const ns = D.ms.pages.map(p => p.n); const made = ns.filter(n => D.pages[n]?.url).length;
  const errs = ns.filter(n => D.pages[n]?.sc?.issues.some(i => i.lv === 'err')).length;
  const R = D.review; const blockN = (R.issues || []).filter(i => !i.ok && !R.acked[i.key] && i.lv === 'err').length;
  return `<section class="dpanel">${phead('완성', '확정한 스타일로 모든 쪽을 만들었습니다. 고칠 쪽만 눌러 프리셋으로 고치고, 맨 아래에서 내보내세요.', `<div class="row"><span class="muted" style="font-size:13px">${made}/${ns.length}쪽${errs ? ` · <span class="tag c-err">확인 ${errs}쪽</span>` : ''}</span><button type="button" class="ghost" data-act="regenAll" ${D.gen.running ? 'disabled' : ''}>전체 다시 만들기</button></div>`)}
    <div class="board" id="dBoard">${boardHtml()}</div>
    <div id="dDetail">${D.sel ? detailHtml(D.sel) : ''}</div>
    ${exportBlock()}
    ${foot(R.ran ? (blockN ? '「반영」을 누르면 그 쪽만 다시 만들고 다시 검수합니다.' : '') : '내보내기 전에 검수가 먼저 돌아갑니다.', `<button type="button" class="primary big" data-act="export" ${made ? '' : 'disabled'}>${R.ran && !blockN ? '내보내기' : '검수하고 내보내기'}</button>`)}</section>`;
}
function boardHtml(){ return D.ms.pages.map(p => { const P = D.pages[p.n]; const iss = P?.sc?.issues || []; const e = iss.filter(i => i.lv === 'err').length, w = iss.length - e;
  return `<button type="button" class="pg" data-act="sel" data-n="${p.n}" aria-current="${D.sel === p.n}"><div class="pv">${P?.url ? `<img alt="${p.n}쪽" src="${P.url}">` : '<span class="spin">만드는 중…</span>'}${e ? `<span class="tag c-err err">${e}</span>` : w ? `<span class="tag c-warn err">${w}</span>` : ''}</div>
    <div class="meta"><b>${p.n}</b>${P?.sc ? `<span class="muted">${esc(P.sc.pats.filter(x => x !== 'list' || P.sc.pats.length === 1).map(x => x === 'divider' ? '장 표지' : PATTERNS[x]?.name || x).slice(0, 2).join('·') || '불릿')}</span>` : ''}${P?.hist.length ? '<span class="tag t-pdf">고침</span>' : ''}</div></button>`; }).join(''); }
function renderBoard(){ const b = $('#dBoard'); if(b) b.innerHTML = boardHtml(); }
function detailHtml(n){
  const P = D.pages[n]; const pg = msPage(n); if(!P?.sc) return '';
  const sc = P.sc; const subs = pg.st.subs; const ids = sc.pats; const L = locks(); const tk = P.tk;
  const fsNow = stepSize(tk, P.opt.fontStep || 0); const minB = L.bodyMin || 9;
  return `<div class="pgdetail"><div class="big"><img alt="${n}쪽 크게 보기" src="${P.url}"></div>
    <div class="presets"><div><h3 style="margin:0">${n}쪽 · ${esc(pg.title)}</h3><p class="note">${sc.level ? `줄이기 ${sc.level}단계 적용 · ` : ''}본문 ${r1(fsNow)}pt${P.hist.length ? ` · 고친 횟수 ${P.hist.length}` : ''}</p></div>
      ${sc.issues.length ? `<ul class="issues">${sc.issues.map(i => `<li><span class="tag ${i.lv === 'err' ? 'c-err' : 'c-warn'}">${i.lv === 'err' ? '오류' : '확인'}</span><span>${esc(i.msg)}</span></li>`).join('')}</ul>` : '<p class="note">자동 검사 통과: 겹침·넘침·최소 글자·하단 여백 이상 없음</p>'}
      ${pg.divider ? '' : `<div class="pr"><b>쪽 전체</b><div class="row"><button type="button" data-act="pre" data-v="fill">여백 채우기</button><button type="button" data-act="pre" data-v="shrink">상자 줄이기</button><button type="button" data-act="pre" data-v="alt">다른 유형으로</button><button type="button" data-act="pre" data-v="ab">시안 2개 보기</button></div></div>
      ${D.altFor === n ? `<div class="strat" id="dStrat">${altOptions(n).map((o, i) => `<button type="button" data-act="altPick" data-i="${i}"><img alt="" data-pv="alt:${n}:${i}"><b>${esc(o.name)}</b>${o.rec ? '<span class="tag rec">권장</span>' : ''}<span class="muted">${esc(o.why)}</span></button>`).join('')}</div>` : ''}
      ${D.abFor === n ? `<div class="abpair">${['A', 'B'].map(v => `<button type="button" data-act="abPick" data-v="${v}"><div class="pv"><img alt="${v}안" data-pv="pab:${n}:${v}"></div><div class="cap"><b>${v === ((P.opt.style || D.style || STYLE_A).sub) ? '지금' : '다른'} 시안</b></div></button>`).join('')}</div>` : ''}
      <div class="pr"><b>섹션별 유형</b>${subs.map((s, i) => { if(ids[i] === 'vs+' || !ids[i]) return ''; const cs = ids[i] === 'vs' ? [{ id:'vs' }, ...patCandidates(s)] : patCandidates(s); return `<div class="row"><span style="font-size:12.5px;flex:1 1 140px;min-width:0">${esc(s.head || '내용 ' + (i + 1))}</span><select data-ppat="${n}:${i}">${cs.map(c => `<option value="${c.id}" ${c.id === ids[i] ? 'selected' : ''}>${PATTERNS[c.id]?.name || c.id}</option>`).join('')}</select></div>`; }).join('')}</div>
      <div class="pr"><b>글자</b><div class="row"><button type="button" data-act="pre" data-v="up">키우기</button><button type="button" data-act="pre" data-v="down" ${fsNow <= minB ? 'aria-disabled="true"' : ''}>줄이기</button></div>${D.lockMsg?.n === n ? `<p class="note" style="color:var(--warn)">${esc(D.lockMsg.t)}</p>` : ''}</div>`}
      <div class="pr"><b>되돌리기 · 전체 적용</b><div class="row"><button type="button" data-act="pre" data-v="undo" ${P.hist.length ? '' : 'disabled'}>되돌리기</button><button type="button" data-act="pre" data-v="all" ${P.hist.length ? '' : 'disabled'} title="이 쪽의 글자 크기·줄이기 설정을 다른 쪽에도 적용">같은 수정을 전체 적용</button></div></div>
      <div class="pr"><b>파일로 받기</b><div class="row"><button type="button" data-act="one" data-v="png">PNG 2배</button><button type="button" data-act="one" data-v="svg">SVG</button><button type="button" data-act="one" data-v="pptx">PPTX</button></div></div>
    </div></div>`;
}
function mainSub(n){ const ids = patternsForPage(n); const k = ids.findIndex(id => PATTERNS[id]?.big); return k >= 0 ? k : Math.max(0, ids.findIndex(id => id !== 'list')); }
function patternsForPage(n){ return D.pages[n]?.opt.pats || patternsFor(n); }
const WHY = { list:'문단을 그대로 불릿으로', cards:'항목을 카드로 나란히', ltable:'이름 : 내용을 표로', table:'원고 표 그대로', kpi:'수치를 크게', flow:'순서를 화살표로', cycle:'반복을 되돌이표로', hub:'중심 개념과 구성 요소', timeline:'시간 순서를 선 위에', vs:'두 묶음을 나란히 비교' };
function altOptions(n){ const pg = msPage(n); const ids = patternsForPage(n); const k = mainSub(n); const sub = pg.st.subs[k]; if(!sub) return [];
  const auto = (D._auto ||= autoPatterns())[n]?.[k]; return patCandidates(sub).filter(c => c.id !== ids[k]).slice(0, 3).map(c => { const pats = [...ids]; pats[k] = c.id; return { name:PATTERNS[c.id].name, why:WHY[c.id] || '', pats, rec:c.id === auto }; }); }
async function preset(v){
  const n = D.sel; const P = D.pages[n]; if(!P) return; const tk = P.tk; const L = locks(); D.lockMsg = null;
  if(v === 'fill'){ const gap = P.sc.issues.find(i => i.id === 'gap'); if(gap && (P.opt.fontStep || 0) < 2) await genPage(n, { fontStep:(P.opt.fontStep || 0) + 1, level:0 }); else await genPage(n, { level:0 }); }
  else if(v === 'shrink') await genPage(n, { level:Math.min(4, (P.sc.level || 0) + 1) });
  else if(v === 'up') await genPage(n, { fontStep:(P.opt.fontStep || 0) + 1 });
  else if(v === 'down'){ const now = stepSize(tk, P.opt.fontStep || 0); const min = L.bodyMin || 9;
    if(now - .5 < min){ D.lockMsg = { n, t:L.bodyMin ? `과업지시서 「본문 ${L.bodyMin}pt 이상」 때문에 더 줄일 수 없습니다. 「상자 줄이기」를 써 보세요.` : `디자인 시스템 최소 크기(${min}pt)보다 작게 할 수 없습니다.` }; }
    else await genPage(n, { fontStep:(P.opt.fontStep || 0) - 1 }); }
  else if(v === 'alt'){ D.altFor = D.altFor === n ? null : n; D.abFor = null; }
  else if(v === 'ab'){ D.abFor = D.abFor === n ? null : n; D.altFor = null; }
  else if(v === 'undo'){ if(P.hist.length){ P.opt = P.hist.pop(); await genPage(n); } }
  else if(v === 'all'){ const o = { fontStep:P.opt.fontStep || 0, level:P.opt.level || 0, style:P.opt.style };
    const ns = D.ms.pages.map(p => p.n).filter(x => x !== n); for(let i=0;i<ns.length;i++){ busy(`같은 수정을 전체에 적용하는 중… ${i + 1}/${ns.length}`, (i + 1) / ns.length); await genPage(ns[i], o); } busy(null); }
  renderDesign(); saveSoon();
}

// ── 7 검수·출력
const OUT_FMTS = [['pptx', 'PowerPoint (.pptx)', '기본 산출물. 글상자·도형·표로 만들어 바로 고칠 수 있습니다.'], ['pdf', 'PDF (도련 포함)', '인쇄·제출용. 쪽 그림을 250dpi로 담습니다.'], ['png', 'PNG 이미지', '검토 공유용. 1·2·3배'], ['jpg', 'JPG 이미지', '가벼운 공유용'], ['svg', 'SVG', '검수 탭에서 직접 고치거나 피그마로'], ['xlsx', '엑셀', '배점 매핑표·보완 제안·검수 결과']];
D.out = { fmts:new Set(['pptx', 'pdf']), scale:2, part:false, text:'' };
function exportBlock(){
  const R = D.review; const iss = R.issues || []; const open = iss.filter(i => !i.ok && !R.acked[i.key]);
  const blockN = open.filter(i => i.lv === 'err').length;
  return `<div class="blk"><h3>검수 · 내보내기</h3>
      <div class="fmts2">${OUT_FMTS.map(([k, name, how]) => `<label class="chk" title="${esc(how)}"><input type="checkbox" data-fmt="${k}" ${D.out.fmts.has(k) ? 'checked' : ''}> ${name}</label>`).join('')}</div>
      <div class="row" style="gap:8px 20px"><div class="opt">이미지 배율<div class="seg" role="group" aria-label="배율">${[1, 2, 3].map(s => `<button type="button" data-act="oscale" data-v="${s}" aria-pressed="${D.out.scale === s}">${s}배</button>`).join('')}</div></div>
      <div class="opt">범위<div class="seg" role="group" aria-label="범위"><button type="button" data-act="opart" data-v="0" aria-pressed="${!D.out.part}">전체</button><button type="button" data-act="opart" data-v="1" aria-pressed="${D.out.part}">일부</button></div>${D.out.part ? `<input type="text" id="oRange" value="${esc(D.out.text)}" placeholder="예: 3-12" style="width:110px">` : ''}</div></div>
      <p class="note">과업지시서 위반은 「확인함」으로 넘길 수 없습니다.</p>
    ${R.ran ? `<div class="revh"><b>검수 결과 · ${R.at}</b> ${blockN ? `<span class="tag c-err">남은 오류 ${blockN}</span>` : '<span class="tag t-done">내보내기 가능</span>'}<button type="button" class="ghost" data-act="toReview">검수 탭에서 자세히</button></div>
      ${iss.length ? `<ul class="revlist">${iss.map(i => `<li><span class="tag ${i.ok ? 't-done' : R.acked[i.key] ? 't-wait' : i.lv === 'err' ? 'c-err' : 'c-warn'}">${i.ok ? '고침' : R.acked[i.key] ? '확인함' : i.con ? '과업지시서' : i.lv === 'err' ? '오류' : '확인'}</span><span>${i.n ? `<b>${i.n}쪽</b> ` : ''}${esc(i.msg)}</span><span class="acts2">${!i.ok && i.n && i.fix ? `<button type="button" data-act="rfix" data-key="${esc(i.key)}">반영</button>` : ''}${!i.ok && !i.con && !R.acked[i.key] ? `<button type="button" class="ghost" data-act="rack" data-key="${esc(i.key)}">확인함</button>` : ''}</span></li>`).join('')}</ul>` : '<p class="muted">오류가 없습니다.</p>'}` : ''}
    ${msgHtml('out')}</div>`;
}
function sourceFromMs(){
  const pages = {};
  for(const pg of D.ms.pages){ const paras = [];
    if(pg.divider) paras.push(pg.title);
    for(const b of pg.blocks){ if(b.k === 'p') paras.push(b.text); else for(const r of b.rows) for(const c of r) if(c) paras.push(c); }
    for(const p of pg.pics) if(p.cap) paras.push(p.cap);
    pages[pg.n] = { paras, src:pg.src, pics:[] }; }
  return { kind:'pptx', name:D.ms.name, pages, renders:{}, paged:true, fromDesign:true };
}
function sysFromDesign(){
  const tk = D.guide.tk; const G = tk.grid; const used = new Set(allowedSizes(tk));
  for(const n in D.pages){ const sc = D.pages[n].sc; if(sc) for(const g of sc.groups) for(const e of g.els){ if(e.t === 'text') used.add(r1(e.size)); if(e.t === 'table') used.add(r1(e.size)); } }
  const fam = k => pptxFace(k, 400).face; const L = tk.locks;
  return { name:`디자인 탭 · 가이드 v${D.guide.version}`, origin:'upload', file:null, at:Date.now(), page:{ w:r1(G.w), h:r1(G.h) }, margin:{ left:r1(G.ml), right:r1(G.mr), bottom:r1(G.mb) }, headerTop:0,
    fonts:{ body:fam(D.roles.body), title:fam(D.roles.title), others:[D.roles.num ? fam(D.roles.num) : null, 'Noto Sans KR'].filter(Boolean) }, titleMin:999,
    sizes:{ allowed:[...used].sort((a, b) => a - b), min:Math.min(...used) }, palette:paletteOf2(tk).filter(c => c !== '#FFFFFF'), whiteUnify:false, shadow:null,
    pageNumber:L.pageNumber === '넣지 않음' ? 'none' : 'required', sourceLine:true, emptyBottom:r1(5 * MM + 14), rules:['디자인 탭에서 만든 쪽입니다.'], missing:[] };
}
async function handoff(){
  busy('검수용 SVG를 만드는 중…', .1);
  const items = [];
  for(const pg of D.ms.pages){ const P = D.pages[pg.n] || await genPage(pg.n); P.svg ||= await sceneSvg(P.sc);
    items.push({ n:pg.n, kind:'svg', name:`디자인 ${pg.n}쪽`, text:P.svg, url:P.url, model:null, fromDesign:true }); }
  S.batches = [{ id:++batchSeq, kind:'svg', label:`디자인 탭 초안 (${items.length}쪽)`, items, fromDesign:true }]; buildDesign();
  S.source = sourceFromMs(); S.mode = 'page'; S.firstMap = 1; S.srcScope = { part:false, text:'', set:null }; S.desScope = { part:false, text:'', set:null };
  S.sysLocal = sysFromDesign(); S.sysOff = false; S.gov = buildGov(); S.sysConfirmed = true;
  for(const t of topicsInMs()){ const tk = D.guide.tk; const cc = iconColors(tk.iconTone, tk.color); const url = iconDataURL(iconFor(t), cc.fg, cc.bg); const b64 = url.split('base64,')[1]; if(b64){ const sig = await sha1(b64); if(sig) S.data.icons[sig] = '아이콘 · ' + t; } }
  renderCards(); renderSys(); renderHelp();
  busy('검수 탭에서 원고·디자인 시스템과 대조하는 중…', .6);
  await runAll({ ocr:false });
  busy(null);
}
function collectIssues(){
  const out = []; const L = locks(); const total = D.ms.pages.length;
  if(L.pagesMax && total > L.pagesMax) out.push({ key:'con:pages', lv:'err', con:true, msg:`총 ${total}쪽으로 과업지시서 상한 ${L.pagesMax}쪽을 넘습니다. 원고 분량을 줄여야 합니다.` });
  for(const pg of D.ms.pages){ const n = pg.n; const P = D.pages[n]; const R = S.res[n];
    for(const i of (P?.sc?.issues || [])) out.push({ key:`d:${n}:${i.id}`, n, lv:i.lv, con:!!i.con, msg:i.msg, fix:i.id === 'gap' || i.id === 'overflow' });
    if(!R || R.pending) continue;
    (R.A.missingF || []).forEach((m, k) => out.push({ key:`m:${n}:${norm(m.text).slice(0, 40)}`, n, lv:'err', msg:`원고 문단이 디자인에 없습니다: ${m.text.slice(0, 60)}`, fix:true }));
    (R.A.diffF || []).forEach(d => out.push({ key:`f:${n}:${norm(d.line).slice(0, 40)}`, n, lv:'err', msg:`원고와 글자가 다릅니다: ${d.line.slice(0, 60)}`, fix:true }));
    (R.A.extraF || []).forEach(e => out.push({ key:`x:${n}:${norm(e.line).slice(0, 40)}`, n, lv:'warn', msg:`원고에서 찾지 못한 글자: ${e.line.slice(0, 60)}` }));
    R.B.forEach(b => out.push({ key:`b:${n}:${b.id}:${norm(b.msg).slice(0, 30)}`, n, lv:b.lv === 'err' ? 'err' : 'warn', msg:`${b.rule}: ${b.msg}${b.ex ? ` (${String(b.ex).slice(0, 60)})` : ''}`, fix:b.lv === 'err' }));
    if(R.C.miss.length || R.C.extra.length) out.push({ key:`num:${n}`, n, lv:'warn', msg:`수치·조항 차이: ${[...R.C.miss, ...R.C.extra].slice(0, 4).join(' · ')}` });
  }
  return out;
}
async function runReview(){
  await handoff(); const prev = new Set((D.review.issues || []).filter(i => !i.ok).map(i => i.key)); const now = collectIssues();
  for(const k of prev) if(!now.some(i => i.key === k)){ const old = D.review.issues.find(i => i.key === k); now.push({ ...old, ok:true }); }
  D.review.issues = now; D.review.ran = true; D.review.at = new Date().toLocaleTimeString('ko-KR', { hour:'2-digit', minute:'2-digit' });
}
async function dExport(){
  dmsg('out');
  if(D.out.part){ const r = parseRange(D.out.text); if(r.err){ dmsg('out', 'err', r.err); renderDesign(); return; } }
  await runReview(); renderDesign();
  const open = D.review.issues.filter(i => !i.ok && !D.review.acked[i.key] && i.lv === 'err');
  if(open.length){ dmsg('out', 'warn', `오류 ${open.length}건이 남아 내보내지 않았습니다. 「반영」으로 고치거나 「확인함」으로 처리하세요.`); renderDesign(); return; }
  const set = D.out.part ? parseRange(D.out.text).set : null;
  const ns = D.ms.pages.map(p => p.n).filter(n => !set || set.has(n)); const scenes = ns.map(n => D.pages[n].sc);
  const base = (D.ms.name.replace(/\.[^.]+$/, '') || '제안서') + '_디자인'; const date = today(); const saved = [];
  try{
    if(D.out.fmts.has('pptx')){ busy('파워포인트 파일을 만드는 중…', .2); if(await dl(`${base}_${date}.pptx`, await scenesPptx(scenes, base))) saved.push('PPTX'); }
    if(D.out.fmts.has('pdf')){ busy('PDF를 만드는 중…', .3); if(await dl(`${base}_${date}.pdf`, await scenesPdf(scenes, 250, i => busy(`PDF를 만드는 중… ${i}/${scenes.length}`, i / scenes.length)))) saved.push('PDF'); }
    for(const f of ['png', 'jpg', 'svg']) if(D.out.fmts.has(f)){ const zip = new JSZip(); for(let i=0;i<scenes.length;i++){ busy(`${f.toUpperCase()} 만드는 중… ${i + 1}/${scenes.length}`, (i + 1) / scenes.length); const sc = scenes[i];
        zip.file(`${base}_p${String(sc.n).padStart(2, '0')}.${f}`, f === 'svg' ? (D.pages[sc.n].svg ||= await sceneSvg(sc)) : await scenePng(sc, D.out.scale * 100 / 72, f === 'png' ? 'image/png' : 'image/jpeg')); }
      if(await dl(`${base}_${f.toUpperCase()}_${date}.zip`, await zip.generateAsync({ type:'blob' }))) saved.push(f.toUpperCase()); }
    if(D.out.fmts.has('xlsx')){ if(await dl(`${base}_검수보고서_${date}.xlsx`, planXlsx(true))) saved.push('엑셀'); }
    D.review.exported = true; dmsg('out', 'info', saved.length ? `${saved.join(' · ')} 파일을 내려받았습니다 · ${scenes.length}쪽` : '내려받기를 취소했습니다.');
  }catch(e){ console.error(e); dmsg('out', 'err', e?.message === 'script' ? '내보내기 도구를 불러오지 못했습니다. 새로 고친 뒤 다시 시도해 주세요.' : '파일을 만들지 못했습니다. 다시 시도해 주세요.'); }
  busy(null); renderDesign();
}
function planXlsx(withReview){
  const wb = XLSX.utils.book_new(); const sheet = (name, rows) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  const A = D._an = analysis(); const items = D.rfp?.items || [];
  sheet('배점 매핑표', [['부문', '평가 항목', '배점', '원고 절', '쪽수', '밀도(점/쪽)'], ...items.map(it => { const ss = (D.mapping?.[it.id] || []).map(id => D.ms.sections.find(s => s.id === id)).filter(Boolean); const p = ss.reduce((a, s) => a + s.pages.length, 0); return [it.area, it.name, it.score, ss.map(s => s.title).join(', '), p, p ? r2(it.score / p) : '']; })]);
  sheet('페이지 플랜', [['쪽', '절', '배점', '상태', '인포그래픽'], ...D.ms.pages.map(pg => { const s = A.secs.find(x => x.id === pg.sec); return [pg.n, pg.divider ? '(장 표지)' : s?.title || '', s ? r2(s.score / s.pages.length) : '', s?.status || '', pg.divider ? '장 표지' : patternsForPage(pg.n).filter(x => x !== 'vs+').map(x => PATTERNS[x]?.name || x).join(', ')]; })]);
  const sg = D._sugg || suggestions(); sheet('보완 제안', [['유형', '내용', '결정'], ...sg.map(x => [x.type, x.text, D.plan.dec[x.id] === 'accept' ? '수용' : D.plan.dec[x.id] === 'hold' ? '보류' : ''])]);
  if(withReview && D.review.ran) sheet('검수 결과', [['쪽', '수준', '내용', '처리'], ...D.review.issues.map(i => [i.n || '전체', i.lv === 'err' ? '오류' : '확인', i.msg, i.ok ? '고침' : D.review.acked[i.key] ? '확인함' : ''])]);
  return new Blob([XLSX.write(wb, { bookType:'xlsx', type:'array' })]);
}

// ───────────── 미리보기 채우기(그린 순서대로 바로)
async function previewFor(key){
  if(PV.has(key)) return PV.get(key);
  const p = (async () => { const [kind, a, b, c] = key.split(':'); let sc;
    if(kind === 'mood'){ const tk = tokens({ mood:a, colors:a === D.mood ? D.colors : {} }); sc = composePage(+b, { tk, style:STYLE_A }); }
    else if(kind === 'ab') sc = composePage(+a, { tk:D.guide.tk, style:b === 'A' ? STYLE_A : STYLE_B });
    else if(kind === 'alt'){ const o = altOptions(+a)[+b]; const P = D.pages[+a]; sc = composePage(+a, { tk:P.tk, style:P.opt.style || D.style, pats:o.pats, fontStep:P.opt.fontStep || 0 }); }
    else if(kind === 'pab'){ const P = D.pages[+a]; sc = composePage(+a, { tk:P.tk, style:b === 'A' ? STYLE_A : STYLE_B, pats:P.opt.pats, fontStep:P.opt.fontStep || 0, level:P.opt.level || 0 }); }
    void c; return URL.createObjectURL(await scenePng(sc, kind === 'alt' ? .7 : 100 / 72)); })();
  PV.set(key, p); return p;
}
async function fillPreviews(){
  if(D.ms) await ensureFonts(D.ms.text);
  for(const img of DZ().querySelectorAll('img[data-pv]')){ const k = img.dataset.pv; try{ const u = await previewFor(k); if(img.isConnected) img.src = u; }catch(e){ console.error(e); } }
}

// ───────────── 이벤트
function bindDesign(){
  const z = DZ();
  z.querySelectorAll('input[data-drop]').forEach(inp => { const id = inp.dataset.drop; const dz = $('#dz-' + id);
    inp.addEventListener('change', e => { const f = [...e.target.files]; e.target.value = ''; if(f.length) takeFiles(id, f); });
    ['dragover', 'dragenter'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('over'); }));
    dz.addEventListener('drop', e => { const f = [...(e.dataTransfer?.files || [])]; if(f.length) takeFiles(id, f); }); });
  z.querySelectorAll('select[data-role]').forEach(s => s.addEventListener('change', async () => { const r = s.dataset.role; if(r === 'num') D.roles.num = s.value || null; else D.roles[r] = s.value; resetMetrics(); PV.clear(); await ensureFonts(D.ms?.text); renderDesign(); saveSoon(); }));
  z.querySelectorAll('input[data-grid]').forEach(inp => inp.addEventListener('change', () => { const v = parseFloat(inp.value); if(!(v >= 0)) return; D.grid = { ...(D.grid || DEFAULT_GRID()), [inp.dataset.grid]:v * MM, name:(D.grid?.name || 'A4 기본 그리드').replace(/ \(고침\)$/, '') + ' (고침)' };
    if(!gridOK(D.grid)){ dmsg('assets', 'err', '여백이 너무 커서 본문 영역이 없습니다. 값을 확인해 주세요.'); } else dmsg('assets'); PV.clear(); renderDesign(); saveSoon(); }));
  z.querySelectorAll('select[data-map]').forEach(s => s.addEventListener('change', () => { if(!s.value) return; const it = s.dataset.map; for(const k in D.mapping) D.mapping[k] = D.mapping[k].filter(x => x !== s.value); D.mapping[it].push(s.value); D._an = null; D._auto = null; renderDesign(); saveSoon(); }));
  z.querySelectorAll('select[data-pat]').forEach(s => s.addEventListener('change', () => { const [n, i] = s.dataset.pat.split(':').map(Number); (D.plan.pat[n] ||= {})[i] = s.value; PV.clear(); renderDesign(); saveSoon(); }));
  z.querySelectorAll('select[data-ppat]').forEach(s => s.addEventListener('change', async () => { const [n, i] = s.dataset.ppat.split(':').map(Number); const pats = [...patternsForPage(n)]; pats[i] = s.value; await genPage(n, { pats }); renderDesign(); saveSoon(); }));
  z.querySelectorAll('input[data-fmt]').forEach(c => c.addEventListener('change', () => { c.checked ? D.out.fmts.add(c.dataset.fmt) : D.out.fmts.delete(c.dataset.fmt); }));
  $('#oRange')?.addEventListener('input', e => { D.out.text = e.target.value; });
  z.querySelectorAll('details[data-fold]').forEach(d => d.addEventListener('toggle', () => { D[d.dataset.fold] = d.open; const m = d.querySelector('summary .muted'); if(m && d.dataset.fold === 'mapOpen') m.textContent = d.open ? '접기' : '틀린 연결이 있으면 열어서 고치기'; }));
}
const ACT = {
  go:el => go(+el.dataset.k),
  conOpen:() => { D.conOpen = !D.conOpen; renderBanner(); },
  conOk:el => { const c = D.rfp.cons.find(x => x.id === el.dataset.id); if(c) c.status = 'ok'; afterConChange(); },
  conOff:el => { const c = D.rfp.cons.find(x => x.id === el.dataset.id); if(c) c.status = 'off'; afterConChange(); },
  rmRfp:() => { D.rfp = null; D.mapping = null; D._an = null; afterConChange(); },
  rmMs:() => { D.ms = null; resetProject(); renderDesign(); renderBanner(); },
  itemsOk:() => { D.rfp.itemsOk = true; renderDesign(); },
  msOk:() => { D.ms.ok = true; renderDesign(); },
  mood:el => { if(D.mood !== el.dataset.v){ D.mood = el.dataset.v; D.colors = { primary:null, accent:null }; } for(const k of [...PV.keys()]) if(k.startsWith('mood:')) PV.delete(k); renderDesign(); saveSoon(); },
  color:el => { D.colors[el.dataset.k] = el.dataset.v; for(const k of [...PV.keys()]) if(k.startsWith('mood:' + D.mood)) PV.delete(k); renderDesign(); saveSoon(); },
  iconOpen:el => { D.iconOpen = D.iconOpen === el.dataset.v ? null : el.dataset.v; renderDesign(); },
  iconSet:el => { if(D.iconOpen){ D.iconMap[D.iconOpen] = el.dataset.v; D.iconOpen = null; PV.clear(); renderDesign(); saveSoon(); } },
  gate:el => confirmGate(+el.dataset.g),
  dlGuide:async () => { await dl(`디자인가이드_v${D.guide.version}.md`, guideMd()); await dl(`tokens_v${D.guide.version}.json`, JSON.stringify(tokensJson(), null, 2)); },
  bump:() => { const [a, b] = D.guide.version.split('.').map(Number); D.guide.version = `${a}.${b + 1}`; D.guide.history.push({ v:D.guide.version, date:today(), note:'디자인 시스템 고침' }); D.guide.tk = tokens(); D.guide.sig = guideSig(); D.guide.date = today(); D.bumpAsk = Object.keys(D.pages).length > 0; PV.clear(); renderDesign(); saveSoon(); },
  bumpAll:async () => { D.bumpAsk = false; for(const n in D.pages) D.pages[n].tk = D.guide.tk; await generateAll(D.ms.pages.map(p => p.n)); },
  bumpLater:() => { D.bumpAsk = false; renderDesign(); },
  remap:() => runMapping(true),
  patEdit:() => { D.patEdit = !D.patEdit; renderDesign(); },
  unmap:el => { D.mapping[el.dataset.i] = D.mapping[el.dataset.i].filter(x => x !== el.dataset.s); D._an = null; D._auto = null; renderDesign(); saveSoon(); },
  dec:el => { D.plan.dec[el.dataset.id] = D.plan.dec[el.dataset.id] === el.dataset.v ? null : el.dataset.v; renderDesign(); saveSoon(); },
  xlsPlan:async () => { await dl(`배점매핑_보완제안_${today()}.xlsx`, planXlsx(false)); },
  pick:el => { D.samples[+el.dataset.i].pick = el.dataset.v; renderDesign(); },
  sel:el => { const n = +el.dataset.n; D.sel = D.sel === n ? null : n; D.altFor = D.abFor = null; D.lockMsg = null; renderDesign(); if(D.sel) $('#dDetail')?.scrollIntoView({ behavior:'smooth', block:'nearest' }); },
  pre:el => preset(el.dataset.v),
  altPick:async el => { const o = altOptions(D.sel)[+el.dataset.i]; D.altFor = null; await genPage(D.sel, { pats:o.pats }); renderDesign(); saveSoon(); },
  abPick:async el => { const st = el.dataset.v === 'A' ? STYLE_A : STYLE_B; D.abFor = null; await genPage(D.sel, { style:st }); renderDesign(); saveSoon(); },
  regenAll:() => { for(const n in D.pages) D.pages[n].tk = D.guide.tk; generateAll(); },
  one:async el => { const P = D.pages[D.sel]; const v = el.dataset.v; const nm = `${D.ms.name.replace(/\.[^.]+$/, '')}_p${String(D.sel).padStart(2, '0')}`;
    if(v === 'png') await dl(nm + '.png', await scenePng(P.sc, 200 / 72)); else if(v === 'svg') await dl(nm + '.svg', P.svg ||= await sceneSvg(P.sc)); else { busy('파워포인트 파일을 만드는 중…', .5); await dl(nm + '.pptx', await scenesPptx([P.sc])); busy(null); } },
  oscale:el => { D.out.scale = +el.dataset.v; renderDesign(); },
  opart:el => { D.out.part = el.dataset.v === '1'; renderDesign(); },
  export:() => dExport(),
  rack:el => { D.review.acked[el.dataset.key] = true; renderDesign(); saveSoon(); },
  rfix:async el => { const i = D.review.issues.find(x => x.key === el.dataset.key); if(!i?.n) return; const P = D.pages[i.n];
    const o = i.key.includes(':gap') ? { level:0, fontStep:Math.min(2, (P.opt.fontStep || 0) + 1) } : i.key.includes(':overflow') ? { level:Math.min(4, (P.sc.level || 0) + 1) } : { pats:undefined, level:0 };
    busy(`${i.n}쪽을 다시 만드는 중…`, .3); await genPage(i.n, o); await runReview(); busy(null); renderDesign(); },
  toReview:() => { setTab('review'); $('#results').scrollIntoView({ behavior:'smooth' }); },
};
async function confirmGate(g){
  if(g === 1){ await ensureFonts(D.ms.text); resetMetrics(); D.gates.g1 = true; D.guide = { version:'1.0', date:today(), tk:tokens(), sig:guideSig(), history:[{ v:'1.0', date:today(), note:`처음 확정 · ${MOODS[D.mood].name}` }] }; go(4); }
  else if(g === 2){ D.gates.g2 = true; D.samples = pickSamples(); go(5); }
  else if(g === 3){ D.style = styleFromSamples(); D.gates.g3 = true; const [a, b] = D.guide.version.split('.').map(Number); D.guide.version = `${a}.${b + 1}`; D.guide.history.push({ v:D.guide.version, date:today(), note:`스타일 확정 · 샘플 ${D.samples.map(s => s.n + '쪽 ' + s.pick).join(', ')}` }); D.pages = {}; go(6); }
  saveSoon();
}
function resetProject(){ D.gates = { g1:false, g2:false, g3:false }; D.mapping = null; D.plan = { pat:{}, dec:{} }; D.samples = []; D.style = null; D.pages = {}; D.guide = null; D.review = { ran:false, acked:{}, issues:[] }; D._an = null; D._auto = null; D.sel = null; PV.clear(); D.step = 1; }
async function takeFiles(id, files){
  dmsg(id);
  try{
    if(id === 'rfp'){ busy(`과업지시서 「${files[0].name}」을 읽는 중…`, .3); D.rfp = await extractRfp(files[0]); D.mapping = null; D._an = null; D._auto = null; if(D.gates.g1) D.gates.g2 = false; }
    else if(id === 'ms'){ busy(`원고 「${files[0].name}」을 읽는 중…`, .3); const ms = await parseManuscript(files[0]);
      if(!ms.pages.length || !ms.text.trim()) throw { user:`「${files[0].name}」에서 글자를 찾지 못했습니다.` };
      for(const p of ms.pages) for(const pic of p.pics){ const im = await loadImg(pic.url); pic.w = im?.naturalWidth || 4; pic.h = im?.naturalHeight || 3; }
      const same = D.ms && D.ms.name === ms.name && D.ms.pages.length === ms.pages.length || (D.restoredSig && D.restoredSig.name === ms.name && D.restoredSig.pages === ms.pages.length);
      D.ms = ms; if(!same) resetProject(); else { D.pages = {}; D._auto = null; D._an = null; }
      D.restored = null; await ensureFonts(ms.text); }
    else { busy('디자인 자료를 나누는 중…', .3); const notes = await classifyAssets(files); if(notes.length) dmsg('assets', 'info', notes.join(' '));
      if(D.assets.tokens) applyTokensFile(D.assets.tokens); resetMetrics(); PV.clear(); await ensureFonts(D.ms?.text); }
  }catch(e){ console.error(e); dmsg(id, 'err', e?.user || `「${files[0].name}」을 읽지 못했습니다. 파일이 손상되지 않았는지 확인해 주세요.`); }
  busy(null); D.step = 1; renderBanner(); renderDesign(); saveSoon();
}
function applyTokensFile(j){
  const mood = Object.entries(MOODS).find(([, m]) => m.name === j.mood)?.[0]; if(mood) D.mood = mood;
  if(j.color?.primary?.[1]) D.colors.primary = j.color.primary[1]; if(j.color?.accent) D.colors.accent = j.color.accent;
  const byFace = face => families().find(f => f.faces.some(x => x.family === face) || f.label === face)?.key;
  if(j.font?.body?.family && byFace(j.font.body.family)) D.roles.body = byFace(j.font.body.family); if(j.font?.title?.family && byFace(j.font.title.family)) D.roles.title = byFace(j.font.title.family);
  if(j.page?.size){ const m = j.page.margin || {}; D.grid = { name:`${j.name || '디자인 시스템'} 그리드`, src:'tokens', w:j.page.size.w, h:j.page.size.h, bleed:j.page.bleed || 3 * MM, ml:m.left ?? 15 * MM, mr:m.right ?? 15 * MM, mt:m.top ?? 10 * MM, bodyTop:j.page.body?.y?.[0] ?? 30 * MM, mb:m.bottom ?? 15 * MM }; }
  if(j.icon?.topics) for(const [t, i] of Object.entries(j.icon.topics)) if(ICONS[i]) D.iconMap[t] = i;
  if(j.component) D.importStyle = { sub:j.component.subtitle, card:j.component.card, table:j.component.table, flow:j.component.flow, hub:j.component.hub, kpi:j.component.kpi, timeline:j.component.timeline, vs:j.component.vs };
}

// ───────────── 작업 공간에 프로젝트 저장(올린 파일은 저장하지 않음)
let saveT = null;
function saveSoon(){ clearTimeout(saveT); saveT = setTimeout(saveState, 1200); }
async function saveState(){
  if(!W.ok() || !D.ms) return;
  const st = { v:1, at:Date.now(), msSig:{ name:D.ms.name, pages:D.ms.pages.length }, rfp:D.rfp ? { name:D.rfp.name, items:D.rfp.items, cons:D.rfp.cons, by:D.rfp.by, itemsOk:!!D.rfp.itemsOk } : null,
    grid:D.grid, mood:D.mood, colors:D.colors, roles:{ body:famOf(D.roles.body).label, title:famOf(D.roles.title).label, num:D.roles.num ? famOf(D.roles.num).label : null }, iconMap:D.iconMap,
    mapping:D.mapping, plan:D.plan, gates:D.gates, guide:D.guide ? { version:D.guide.version, date:D.guide.date, history:D.guide.history } : null, style:D.style, samples:D.samples.map(s => ({ n:s.n, kind:s.kind, pick:s.pick })),
    pageOpt:Object.fromEntries(Object.entries(D.pages).map(([n, P]) => [n, P.opt])), acked:D.review.acked };
  try{ await W.set('design/state', st); }catch(e){ console.warn('design save', e); }
}
async function loadState(){
  if(!W.ok()) return; let st = null; try{ st = await W.get('design/state'); }catch(e){} if(!st || st.v !== 1) return;
  if(D.ms) return;
  Object.assign(D, { grid:st.grid || null, mood:st.mood || 'navy', colors:st.colors || {}, iconMap:st.iconMap || {}, mapping:st.mapping || null, plan:st.plan || { pat:{}, dec:{} }, style:st.style || null, samples:st.samples || [] });
  if(st.rfp) D.rfp = { ...st.rfp, pages:0 };
  D.restoredGates = st.gates; D.restoredGuide = st.guide; D.restoredPageOpt = st.pageOpt || {}; D.review.acked = st.acked || {};
  D.restored = `${st.msSig.name} · ${new Date(st.at).toLocaleDateString('ko-KR')}`; D.restoredSig = st.msSig; D.restoredRoles = st.roles;
  renderBanner(); renderDesign();
}
// 원고를 다시 올리면 저장된 확정 상태를 이어 붙임
const _takeFiles = takeFiles;
takeFiles = async function(id, files){
  await _takeFiles(id, files);
  if(id === 'ms' && D.ms && D.restoredSig && D.restoredSig.name === D.ms.name && D.restoredSig.pages === D.ms.pages.length && D.restoredGates){
    const rr = D.restoredRoles || {}; const byLabel = l => families().find(f => f.label === l)?.key; if(rr.body && byLabel(rr.body)) D.roles.body = byLabel(rr.body); if(rr.title && byLabel(rr.title)) D.roles.title = byLabel(rr.title);
    D.gates = { ...D.restoredGates }; if(D.restoredGuide && D.gates.g1){ D.guide = { ...D.restoredGuide, tk:tokens(), sig:guideSig() }; }
    for(const [n, o] of Object.entries(D.restoredPageOpt || {})) D.pages[n] = { n:+n, opt:o, hist:[] };
    D.restoredSig = null; D.restoredGates = null; dmsg('ms', 'info', '저장된 확정 상태를 이어 붙였습니다.');
    if(D.gates.g3){ D.step = 6; generateAll(); } else if(D.gates.g2) D.step = 5; else if(D.gates.g1) D.step = 4; renderDesign();
  }
};

// ───────────── 시작
window.Design = {
  init(){
    $('#tabDesign').addEventListener('click', () => setTab('design')); $('#tabReview').addEventListener('click', () => setTab('review'));
    for(const id of ['tabDesign', 'tabReview']) $('#' + id).addEventListener('keydown', e => { if(e.key === 'ArrowRight' || e.key === 'ArrowLeft'){ e.preventDefault(); const o = id === 'tabDesign' ? 'tabReview' : 'tabDesign'; $('#' + o).focus(); $('#' + o).click(); } });
    DZ().addEventListener('click', e => { const b = e.target.closest('[data-act]'); if(!b || b.disabled || b.getAttribute('aria-disabled') === 'true' && b.dataset.v !== 'down') return; const f = ACT[b.dataset.act]; if(f) f(b); });
    $('#conBar').addEventListener('click', e => { const b = e.target.closest('[data-act]'); if(!b) return; const f = ACT[b.dataset.act]; if(f) f(b); });
    let m = 'design'; try{ m = localStorage.getItem('dana:mode') || 'design'; }catch(e){}
    setTab(m, false); renderBanner();
    if(S.dbTried) loadState();
  },
  onWs(){ if(!D.ms){ loadState(); } },
};
window.Design.init();
