// review-icons.js — 검수 「아이콘」
// 쪽마다 아이콘을 찾아 생김새(바탕·색·선 굵기·모양)를 재고,
// 라이브러리가 없으면 스타일 묶음과 꼭 섞이면 안 되는 경우만, 있으면 라이브러리 대조 결과를 보여 줍니다.
const IC_MIN = 9, IC_MAX = 80, IC_SCALE = 3, IC_D = 20;
const ICON = { cache:new Map(), scanning:null, tok:0, res:null, libs:[], lib:null, libSel:'', msg:null, busy:null, saveGrp:null, claude:null, cv:new Map(), isIcon:new Map(), hide:new Set(), loadedFor:null };
try{ (JSON.parse(localStorage.getItem('rev:icHide') || '[]') || []).forEach(k => ICON.hide.add(k)); }catch(e){}

// ───────── 기하
const icT = (m, n) => pdfjsLib.Util.transform(m, n);
function icBox(m, x0, x1, y0, y1){
  const ps = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].map(p => pdfjsLib.Util.applyTransform(p, m));
  const xs = ps.map(p => p[0]), ys = ps.map(p => p[1]);
  return { x:Math.min(...xs), y:Math.min(...ys), r:Math.max(...xs), b:Math.max(...ys) };
}
// PDF 쪽의 그림 조각(경로·이미지)을 쪽 좌표(pt, 위→아래)로
async function icPdfParts(page){
  const vp = page.getViewport({ scale:1 }); const O = pdfjsLib.OPS;
  const ol = await page.getOperatorList(); const F = ol.fnArray, A = ol.argsArray;
  const PAINT = new Set([O.fill, O.eoFill, O.stroke, O.closeStroke, O.fillStroke, O.eoFillStroke, O.closeFillStroke, O.closeEOFillStroke]);
  const IMG = new Set([O.paintImageXObject, O.paintInlineImageXObject, O.paintImageMaskXObject, O.paintSolidColorImageMask]);
  let ctm = vp.transform.slice(), pend = null; const st = [], parts = [];
  for(let i = 0; i < F.length; i++){
    const f = F[i], a = A[i];
    if(f === O.save) st.push(ctm);
    else if(f === O.restore) ctm = st.pop() || ctm;
    else if(f === O.transform) ctm = icT(ctm, a);
    else if(f === O.paintFormXObjectBegin){ st.push(ctm); if(Array.isArray(a?.[0]) && a[0].length === 6) ctm = icT(ctm, a[0]); }
    else if(f === O.paintFormXObjectEnd) ctm = st.pop() || ctm;
    else if(f === O.constructPath){
      const ops = a?.[0] || [], ar = a?.[1] || []; let k = 0; if(!pend) pend = { x0:1e9, y0:1e9, x1:-1e9, y1:-1e9, n:0, rect:0, ctm };
      const add = (x, y) => { if(!Number.isFinite(x) || !Number.isFinite(y)) return; if(x < pend.x0) pend.x0 = x; if(x > pend.x1) pend.x1 = x; if(y < pend.y0) pend.y0 = y; if(y > pend.y1) pend.y1 = y; };
      for(const op of ops){
        if(op === O.rectangle){ const [x, y, ww, hh] = ar.slice(k, k + 4); add(x, y); add(x + ww, y + hh); k += 4; pend.rect++; }
        else { const n = op === O.moveTo || op === O.lineTo ? 2 : op === O.curveTo ? 6 : op === O.curveTo2 || op === O.curveTo3 ? 4 : 0; for(let q = 0; q < n; q += 2) add(ar[k + q], ar[k + q + 1]); k += n; }
        pend.n++;
      }
    }
    else if(PAINT.has(f)){
      if(pend && pend.x1 >= pend.x0) parts.push({ ...icBox(pend.ctm, pend.x0, pend.x1, pend.y0, pend.y1), k:'p', n:pend.n, rect:pend.n === 1 && pend.rect === 1 });
      pend = null;
    }
    else if(f === O.endPath) pend = null;
    else if(IMG.has(f)) parts.push({ ...icBox(ctm, 0, 1, 0, 1), k:'i' });
  }
  return { parts, W:vp.width, H:vp.height };
}
// 작은 조각을 겹침·인접으로 묶어 아이콘 크기 덩어리만 남김
function icClusters(parts, texts, { min = IC_MIN, max = IC_MAX, gap = 1.2 } = {}){
  const els = parts.filter(p => { const w = p.r - p.x, h = p.b - p.y;
    if(w > max || h > max || (w < .8 && h < .8)) return false;
    if(Math.min(w, h) < 1.6 && Math.max(w, h) > 5) return false; // 가는 선
    return true; });
  const par = els.map((_, i) => i); const fd = i => { while(par[i] !== i){ par[i] = par[par[i]]; i = par[i]; } return i; };
  for(let i = 0; i < els.length; i++) for(let j = i + 1; j < els.length; j++){
    const a = els[i], b = els[j];
    if(a.x - gap <= b.r && b.x - gap <= a.r && a.y - gap <= b.b && b.y - gap <= a.b) par[fd(i)] = fd(j);
  }
  const cl = new Map();
  els.forEach((e, i) => { const k = fd(i); const c = cl.get(k) || { x:1e9, y:1e9, r:-1e9, b:-1e9, img:0, paths:0, ops:0, rects:0 };
    c.x = Math.min(c.x, e.x); c.y = Math.min(c.y, e.y); c.r = Math.max(c.r, e.r); c.b = Math.max(c.b, e.b);
    if(e.k === 'i') c.img++; else { c.paths++; c.ops += e.n; if(e.rect) c.rects++; } cl.set(k, c); });
  const out = [];
  for(const c of cl.values()){
    const w = c.r - c.x, h = c.b - c.y;
    if(w < min || h < min || w > max || h > max || Math.max(w, h) / Math.min(w, h) > 1.8) continue;
    if(!c.img && (c.paths - c.rects < 1 || c.ops - c.rects < 3)) continue;
    const inX = w * .12, inY = h * .12;
    if(texts.some(t => { const cx = (t.x + t.r) / 2, cy = (t.y + t.b) / 2; return cx > c.x + inX && cx < c.r - inX && cy > c.y + inY && cy < c.b - inY; })) continue;
    out.push({ x:c.x, y:c.y, r:c.r, b:c.b, w, h });
  }
  return out;
}

// ───────── 픽셀 분석
const icDist = (r1, g1, b1, r2, g2, b2) => Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
function icHsv(r, g, b){ r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0;
  if(d){ h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if(h < 0) h += 360; }
  return { h, s:mx ? d / mx : 0, v:mx }; }
// 그림 칸 하나(ImageData, 흰 바탕 합성) → 생김새
function icAnalyze(id){
  const w = id.width, h = id.height, d = id.data, N = w * h; if(w < 8 || h < 8) return null;
  const ring = []; for(let x = 0; x < w; x++){ ring.push(x, x + (h - 1) * w); } for(let y = 1; y < h - 1; y++){ ring.push(y * w, y * w + w - 1); }
  const med = c => { const a = ring.map(i => d[i * 4 + c]).sort((p, q) => p - q); return a[a.length >> 1]; };
  const bg = [med(0), med(1), med(2)];
  const D = new Float32Array(N); let fgN = 0;
  for(let i = 0; i < N; i++){ D[i] = icDist(d[i * 4], d[i * 4 + 1], d[i * 4 + 2], bg[0], bg[1], bg[2]); if(D[i] > 48) fgN++; }
  if(fgN < N * .03) return null;
  // 색 덩어리
  const bins = new Map();
  for(let i = 0; i < N; i++){ if(D[i] <= 48) continue; const k = (d[i * 4] >> 3) << 10 | (d[i * 4 + 1] >> 3) << 5 | (d[i * 4 + 2] >> 3); bins.set(k, (bins.get(k) || 0) + 1); }
  const cls = [];
  for(const [k, n] of [...bins.entries()].sort((a, b) => b[1] - a[1])){
    const r = ((k >> 10) & 31) * 8 + 4, g = ((k >> 5) & 31) * 8 + 4, b = (k & 31) * 8 + 4;
    let best = null, bd = 56; for(const c of cls){ const dd = icDist(r, g, b, c.c[0], c.c[1], c.c[2]); if(dd < bd){ bd = dd; best = c; } }
    if(best){ best.s[0] += r * n; best.s[1] += g * n; best.s[2] += b * n; best.n += n; } else cls.push({ c:[r, g, b], s:[r * n, g * n, b * n], n });
  }
  cls.forEach(c => { c.m = c.s.map(v => v / c.n); }); cls.sort((a, b) => b.n - a.n);
  let acc = 0, cover = 0; for(const c of cls){ acc += c.n; cover++; if(acc >= fgN * .85) break; }
  const sat = cls.filter(c => c.n >= fgN * .06).map(c => icHsv(...c.m)).filter(x => x.s > .28 && x.v > .2);
  const hues = []; sat.forEach(x => { if(!hues.some(hh => Math.min(Math.abs(hh - x.h), 360 - Math.abs(hh - x.h)) < 35)) hues.push(x.h); });
  // 잘게 바뀌는 색(그러데이션·사진·입체): 이웃과 조금씩 다른 화소 비율
  let soft = 0, softN = 0;
  for(let y = 1; y < h - 1; y++) for(let x = 1; x < w - 1; x++){ const i = y * w + x; if(D[i] <= 48) continue; softN++;
    const j = i + 1, k = i + w; const a1 = icDist(d[i * 4], d[i * 4 + 1], d[i * 4 + 2], d[j * 4], d[j * 4 + 1], d[j * 4 + 2]), a2 = icDist(d[i * 4], d[i * 4 + 1], d[i * 4 + 2], d[k * 4], d[k * 4 + 1], d[k * 4 + 2]);
    if((a1 > 3 && a1 < 30) || (a2 > 3 && a2 < 30)) soft++; }
  const softR = softN ? soft / softN : 0;
  const kind = cover >= 9 || (cover >= 6 && softR > .55) ? 'photo' : (hues.length >= 3 || cover >= 6) ? 'multi' : 'flat';
  // 바탕 도형(용기): 진한 화소의 가장 큰 덩어리 → 구멍 메움 → 테두리 띠 색과 다른 안쪽 화소가 그림
  const C1 = cls[0], g = new Float32Array(N); let cont = null, gcol = null;
  const strong = Uint8Array.from(D, v => v > 70 ? 1 : 0), comp = icLargest(strong, w, h);
  if(comp && comp.n > N * .08){
    let sx0 = w, sy0 = h, sx1 = -1, sy1 = -1; for(let y = 0; y < h; y++) for(let x = 0; x < w; x++) if(strong[y * w + x]){ if(x < sx0) sx0 = x; if(x > sx1) sx1 = x; if(y < sy0) sy0 = y; if(y > sy1) sy1 = y; }
    // 구멍 메우고, 붙어 있는 가는 선(연결선·밑줄)은 열림 연산으로 떼어 냄
    let solid = icFill(comp.mask, w, h); const rr = Math.max(2, Math.round(Math.min(comp.x1 - comp.x0, comp.y1 - comp.y0) * .11));
    let op = solid; for(let k = 0; k < rr; k++) op = icErode(op, w, h); for(let k = 0; k < rr; k++) op = icDilate(op, w, h);
    const oc = icLargest(op, w, h); if(oc && oc.n > comp.n * .4){ solid = oc.mask; Object.assign(comp, { x0:oc.x0, y0:oc.y0, x1:oc.x1, y1:oc.y1, mask:comp.mask.map((v, i) => v && solid[i] ? 1 : 0) }); }
    const bw = comp.x1 - comp.x0 + 1, bh = comp.y1 - comp.y0 + 1;
    let sn = 0; for(let i = 0; i < N; i++) sn += solid[i];
    if(sn / (bw * bh) >= .6 && bw >= (sx1 - sx0 + 1) * .8 && bh >= (sy1 - sy0 + 1) * .8 && Math.max(bw, bh) / Math.min(bw, bh) <= 1.5){
      const e1 = icErode(solid, w, h), e2 = icErode(e1, w, h);
      const body = []; for(let i = 0; i < N; i++) if(e2[i] && comp.mask[i]) body.push(i);
      const main = icLeader(d, body, 48)[0];
      if(main){
        const dn = new Float32Array(N), vals = [];
        for(let i = 0; i < N; i++){ if(!e2[i]) continue; dn[i] = icDist(d[i * 4], d[i * 4 + 1], d[i * 4 + 2], ...main.m); vals.push(dn[i]); }
        const { t, lo, hi, p1 } = icOtsu(vals);
        if(hi - lo > 60 && p1 >= .025 && p1 <= .7){
          let gs = [0, 0, 0], gN = 0; const tc = (t + hi) / 2; for(let i = 0; i < N; i++) if(e2[i] && dn[i] > tc){ gs[0] += d[i * 4]; gs[1] += d[i * 4 + 1]; gs[2] += d[i * 4 + 2]; gN++; }
          gcol = gs.map(v => Math.round(v / gN));
          for(let i = 0; i < N; i++) if(e2[i]) g[i] = Math.min(1, Math.max(0, (dn[i] - lo) / (hi - lo)));
          const cc = new Float32Array(w), rc = new Float32Array(h); for(let y = 0; y < h; y++) for(let x = 0; x < w; x++) if(solid[y * w + x]){ cc[x]++; rc[y]++; }
          const ext = (A, n) => { const mx = Math.max(...A); let a0 = 0, a1 = n - 1; while(a0 < n && A[a0] < mx * .35) a0++; while(a1 > 0 && A[a1] < mx * .35) a1--; return [a0, a1]; };
          const [qx0, qx1] = ext(cc, w), [qy0, qy1] = ext(rc, h); let qa = 0; for(let y = qy0; y <= qy1; y++) for(let x = qx0; x <= qx1; x++) qa += solid[y * w + x];
          const fr = qa / Math.max(1, (qx1 - qx0 + 1) * (qy1 - qy0 + 1));
          cont = { shape: fr < .89 ? 'circle' : 'square', col:main.m.map(Math.round), fr:+fr.toFixed(2) };
        }
      }
    }
  }
  if(!cont){
    gcol = C1.m.map(Math.round); const sc = Math.max(40, icDist(...gcol, ...bg));
    for(let i = 0; i < N; i++) g[i] = Math.min(1, Math.max(0, (D[i] - 18) / (sc - 18)));
  }
  let gx0 = w, gy0 = h, gx1 = -1, gy1 = -1, A = 0; const B = new Uint8Array(N);
  for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){ const i = y * w + x; A += g[i]; if(g[i] > .5){ B[i] = 1; if(x < gx0) gx0 = x; if(x > gx1) gx1 = x; if(y < gy0) gy0 = y; if(y > gy1) gy1 = y; } }
  if(gx1 < 0) return null;
  const gw = gx1 - gx0 + 1, gh = gy1 - gy0 + 1, gs = Math.max(gw, gh);
  const L = icSkelLen(B, w, h, gx0, gy0, gx1, gy1);
  const relW = (A / Math.max(L, 1)) / gs, fill = A / (gw * gh);
  if(!cont && fill >= .8 && kind === 'flat' && cover <= 3) return null; // 속이 꽉 찬 단색 도형(점·네모·장식)
  const desc = icResample(g, w, gx0, gy0, gw, gh), sil = icResample(Float32Array.from(icFill(B, w, h)), w, gx0, gy0, gw, gh);
  return { kind, cover, hues:hues.length, soft:+softR.toFixed(2), bg, cont, gcol, relW:+relW.toFixed(3), fill:+fill.toFixed(2), line: relW < .1 && fill < .42, gs, desc, sil };
}
// 가장 큰 4방향 연결 덩어리
function icLargest(B, w, h){
  const lab = new Int32Array(B.length).fill(-1); let best = null;
  for(let i = 0; i < B.length; i++){ if(!B[i] || lab[i] >= 0) continue; const q = [i], mem = []; lab[i] = i; let x0 = w, y0 = h, x1 = -1, y1 = -1;
    while(q.length){ const j = q.pop(); mem.push(j); const x = j % w, y = (j / w) | 0; if(x < x0) x0 = x; if(x > x1) x1 = x; if(y < y0) y0 = y; if(y > y1) y1 = y;
      if(x > 0 && B[j - 1] && lab[j - 1] < 0){ lab[j - 1] = i; q.push(j - 1); } if(x < w - 1 && B[j + 1] && lab[j + 1] < 0){ lab[j + 1] = i; q.push(j + 1); }
      if(y > 0 && B[j - w] && lab[j - w] < 0){ lab[j - w] = i; q.push(j - w); } if(y < h - 1 && B[j + w] && lab[j + w] < 0){ lab[j + w] = i; q.push(j + w); } }
    if(!best || mem.length > best.n) best = { mem, n:mem.length, x0, y0, x1, y1 }; }
  if(!best) return null; const mask = new Uint8Array(B.length); best.mem.forEach(j => { mask[j] = 1; }); return { mask, n:best.n, x0:best.x0, y0:best.y0, x1:best.x1, y1:best.y1 };
}
// 두 무리로 나누는 경계(Otsu) — 무리별 평균과 위 무리 비율
function icOtsu(vals){
  const H = new Float64Array(256); let n = 0; for(const v of vals){ H[Math.min(255, Math.max(0, Math.round(v / 442 * 255)))]++; n++; }
  if(!n) return { t:0, lo:0, hi:0, p1:0 };
  let sum = 0; for(let i = 0; i < 256; i++) sum += i * H[i];
  let wB = 0, sB = 0, best = -1, bt = 0; for(let i = 0; i < 256; i++){ wB += H[i]; if(!wB) continue; const wF = n - wB; if(!wF) break; sB += i * H[i]; const mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) ** 2; if(v > best){ best = v; bt = i; } }
  let a0 = 0, n0 = 0, a1 = 0, n1 = 0; for(let i = 0; i < 256; i++){ if(i <= bt){ a0 += i * H[i]; n0 += H[i]; } else { a1 += i * H[i]; n1 += H[i]; } }
  const k = 442 / 255; return { t:(bt + .5) * k, lo:n0 ? a0 / n0 * k : 0, hi:n1 ? a1 / n1 * k : 0, p1:n1 / n };
}
// 화소 목록의 색을 가까운 것끼리 묶음
function icLeader(d, idx, thr){
  const bins = new Map(); for(const i of idx){ const k = (d[i * 4] >> 3) << 10 | (d[i * 4 + 1] >> 3) << 5 | (d[i * 4 + 2] >> 3); bins.set(k, (bins.get(k) || 0) + 1); }
  const cls = [];
  for(const [k, n] of [...bins.entries()].sort((a, b) => b[1] - a[1])){
    const r = ((k >> 10) & 31) * 8 + 4, g = ((k >> 5) & 31) * 8 + 4, b = (k & 31) * 8 + 4;
    let best = null, bd = thr; for(const c of cls){ const dd = icDist(r, g, b, ...c.m); if(dd < bd){ bd = dd; best = c; } }
    if(best){ best.s[0] += r * n; best.s[1] += g * n; best.s[2] += b * n; best.n += n; } else cls.push({ m:[r, g, b], s:[r * n, g * n, b * n], n });
  }
  cls.forEach(c => { c.m = c.s.map(v => v / c.n); }); return cls.sort((a, b) => b.n - a.n);
}
// 바깥에서 닿지 않는 빈 곳(구멍)을 메움
function icFill(B, w, h){
  const out = new Uint8Array(B.length), seen = new Uint8Array(B.length), q = [];
  for(let x = 0; x < w; x++){ q.push(x, x + (h - 1) * w); } for(let y = 0; y < h; y++){ q.push(y * w, y * w + w - 1); }
  while(q.length){ const i = q.pop(); if(seen[i] || B[i]) continue; seen[i] = 1; const x = i % w, y = (i / w) | 0;
    if(x > 0) q.push(i - 1); if(x < w - 1) q.push(i + 1); if(y > 0) q.push(i - w); if(y < h - 1) q.push(i + w); }
  for(let i = 0; i < B.length; i++) out[i] = seen[i] ? 0 : 1; return out;
}
function icDilate(B, w, h){ const o = new Uint8Array(B.length);
  for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){ const i = y * w + x; o[i] = B[i] || (x > 0 && B[i - 1]) || (x < w - 1 && B[i + 1]) || (y > 0 && B[i - w]) || (y < h - 1 && B[i + w]) ? 1 : 0; } return o; }
function icErode(B, w, h){ const o = new Uint8Array(B.length);
  for(let y = 1; y < h - 1; y++) for(let x = 1; x < w - 1; x++){ const i = y * w + x; o[i] = B[i] && B[i - 1] && B[i + 1] && B[i - w] && B[i + w] ? 1 : 0; } return o; }
// 뼈대(Zhang-Suen) 길이
function icSkelLen(B0, w, h, x0, y0, x1, y1){
  const W2 = x1 - x0 + 3, H2 = y1 - y0 + 3, M = new Uint8Array(W2 * H2);
  for(let y = y0; y <= y1; y++) for(let x = x0; x <= x1; x++) M[(y - y0 + 1) * W2 + (x - x0 + 1)] = B0[y * w + x];
  let ch = true, it = 0;
  while(ch && it++ < 60){ ch = false;
    for(const pass of [0, 1]){ const del = [];
      for(let y = 1; y < H2 - 1; y++) for(let x = 1; x < W2 - 1; x++){ const i = y * W2 + x; if(!M[i]) continue;
        const p = [M[i - W2], M[i - W2 + 1], M[i + 1], M[i + W2 + 1], M[i + W2], M[i + W2 - 1], M[i - 1], M[i - W2 - 1]];
        const bn = p.reduce((a, b) => a + b, 0); if(bn < 2 || bn > 6) continue;
        let an = 0; for(let k = 0; k < 8; k++) if(!p[k] && p[(k + 1) % 8]) an++; if(an !== 1) continue;
        if(pass === 0 ? (p[0] * p[2] * p[4] || p[2] * p[4] * p[6]) : (p[0] * p[2] * p[6] || p[0] * p[4] * p[6])) continue;
        del.push(i); }
      if(del.length){ ch = true; del.forEach(i => { M[i] = 0; }); } } }
  let L = 0; for(let y = 1; y < H2 - 1; y++) for(let x = 1; x < W2 - 1; x++){ const i = y * W2 + x; if(!M[i]) continue;
    L += (M[i + 1] ? .5 : 0) + (M[i - 1] ? .5 : 0) + (M[i + W2] ? .5 : 0) + (M[i - W2] ? .5 : 0) + ((M[i + W2 + 1] && !M[i + 1] && !M[i + W2]) ? .71 : 0) + ((M[i + W2 - 1] && !M[i - 1] && !M[i + W2]) ? .71 : 0) + ((M[i - W2 + 1] && !M[i + 1] && !M[i - W2]) ? .71 : 0) + ((M[i - W2 - 1] && !M[i - 1] && !M[i - W2]) ? .71 : 0);
    if(!M[i + 1] && !M[i - 1] && !M[i + W2] && !M[i - W2] && !M[i + W2 + 1] && !M[i + W2 - 1] && !M[i - W2 + 1] && !M[i - W2 - 1]) L += 1; }
  return L;
}
// 덮임 지도를 IC_D×IC_D 칸에 비율 유지해 맞춰 줄이고 살짝 흐림(0..255)
function icResample(g, w, x0, y0, gw, gh){
  const S = IC_D, inner = S - 2, sc = inner / Math.max(gw, gh), ow = gw * sc, oh = gh * sc, ox = (S - ow) / 2, oy = (S - oh) / 2;
  const acc = new Float32Array(S * S), cnt = new Float32Array(S * S);
  for(let y = 0; y < gh; y++) for(let x = 0; x < gw; x++){ const tx = Math.min(S - 1, Math.floor(ox + (x + .5) * sc)), ty = Math.min(S - 1, Math.floor(oy + (y + .5) * sc)); const k = ty * S + tx; acc[k] += g[(y0 + y) * w + x0 + x]; cnt[k]++; }
  const a = new Float32Array(S * S); for(let k = 0; k < S * S; k++) a[k] = cnt[k] ? acc[k] / cnt[k] : 0;
  const o = new Uint8Array(S * S);
  for(let y = 0; y < S; y++) for(let x = 0; x < S; x++){ let s = 0, n = 0; for(let dy = -1; dy <= 1; dy++) for(let dx = -1; dx <= 1; dx++){ const xx = x + dx, yy = y + dy; if(xx < 0 || yy < 0 || xx >= S || yy >= S) continue; const wt = dx || dy ? 1 : 4; s += a[yy * S + xx] * wt; n += wt; } o[y * S + x] = Math.round(s / n * 255); }
  return o;
}
function icNcc(a, b){ const n = a.length; let ma = 0, mb = 0; for(let i = 0; i < n; i++){ ma += a[i]; mb += b[i]; } ma /= n; mb /= n;
  let s = 0, sa = 0, sb = 0; for(let i = 0; i < n; i++){ const x = a[i] - ma, y = b[i] - mb; s += x * y; sa += x * x; sb += y * y; }
  return sa && sb ? s / Math.sqrt(sa * sb) : 0; }
function icHash(f){ let h = 2166136261; const s = f.kind + (f.cont ? f.cont.shape : 'n') + (f.gcol || []).map(v => v >> 4).join(','); for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } for(const v of f.desc){ h ^= v >> 3; h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
const icB64 = u8 => btoa(String.fromCharCode(...u8));
const icU8 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

// ───────── 캔버스 잘라 내기
function icCropData(cv, box, sc, pad = 1.5){
  const x = Math.max(0, Math.floor((box.x - pad) * sc)), y = Math.max(0, Math.floor((box.y - pad) * sc));
  const r = Math.min(cv.width, Math.ceil((box.r + pad) * sc)), b = Math.min(cv.height, Math.ceil((box.b + pad) * sc));
  const w = r - x, h = b - y; if(w < 4 || h < 4) return null;
  const c2 = document.createElement('canvas'); c2.width = w; c2.height = h; const cx = c2.getContext('2d', { willReadFrequently:true });
  cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h); cx.drawImage(cv, x, y, w, h, 0, 0, w, h);
  return { cv:c2, id:cx.getImageData(0, 0, w, h) };
}
function icThumb(cv, px = 56){
  const s = Math.min(1, px / Math.max(cv.width, cv.height)); const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(cv.width * s)); c.height = Math.max(1, Math.round(cv.height * s));
  const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(cv, 0, 0, c.width, c.height); return c.toDataURL('image/png');
}
function icTitleOf(bx, texts){
  const cx = (bx.x + bx.r) / 2, cy = (bx.y + bx.b) / 2; let best = 1e9, title = '';
  for(const pref of [true, false]){
    for(const t of texts){ if(!t.box || t.src || (pref && !(t.title || t.w >= 500))) continue; const tb = t.box;
      const s = Math.max(10, bx.r - bx.x);
      const right = tb.x >= bx.r - 2 && tb.x - bx.r < s * 3 && tb.b > bx.y - 4 && tb.y < bx.b + 4;
      const below = tb.y >= bx.b - 2 && tb.y - bx.b < s * 1.2 && tb.x < cx + 4 && tb.r > cx - 4;
      if(!(right || below)) continue;
      const dd = Math.hypot((tb.x + tb.r) / 2 - cx, (tb.y + tb.b) / 2 - cy); if(dd < best){ best = dd; title = t.lines.join(' '); } }
    if(title) break;
  }
  return title.slice(0, 40);
}

// ───────── 쪽 훑기
function icKeyOf(it){ return it.kind === 'pdf' ? `pdf:${it.__bid}:${it.pdfPage}` : it.kind === 'svg' ? `svg:${it.name}:${(it.text || '').length}` : `img:${it.name}`; }
function icTargets(){
  const out = [];
  for(const b of S.batches) for(const it of b.items){ it.__bid = b.id; it.__file = b.file; }
  for(const n of designPages()){ const it = S.design[n]; if(!it || !S.res[n]) continue; out.push({ n, it, key:icKeyOf(it) }); }
  return out;
}
const icTick = () => new Promise(r => setTimeout(r, 0));
async function icScan(){
  if(ICON.scanning) return ICON.scanning;
  const tok = ++ICON.tok;
  ICON.scanning = (async () => {
    const todo = icTargets().filter(t => !ICON.cache.has(t.key) && (t.it.kind === 'pdf' || t.it.kind === 'svg'));
    const docs = new Map(); let k = 0;
    for(const t of todo){
      if(tok !== ICON.tok) break;
      ICON.busy = { t:`쪽마다 아이콘을 찾는 중… ${++k}/${todo.length}`, p:k / todo.length }; icRenderStatus();
      try{ ICON.cache.set(t.key, t.it.kind === 'pdf' ? await icScanPdf(t.it, docs) : await icScanSvg(t.it)); }
      catch(e){ console.warn('icon scan', e); ICON.cache.set(t.key, { icons:[], err:true }); }
      await icTick();
    }
    for(const d of docs.values()){ try{ (await d)?.destroy?.(); }catch(e){} }
    ICON.busy = null;
  })();
  try{ await ICON.scanning; } finally { ICON.scanning = null; }
  icCompute(); Icons.render();
  if(Icons.visible()) icClaudeRun();
}
async function icScanPdf(it, docs){
  if(!it.__file) return { icons:[], nofile:true };
  if(!docs.has(it.__bid)) docs.set(it.__bid, openPdf(it.__file).catch(() => null));
  const pdf = await docs.get(it.__bid); if(!pdf) return { icons:[], err:true };
  const page = await pdf.getPage(it.pdfPage);
  const { parts } = await icPdfParts(page);
  const texts = (it.model?.textEls || []).map(t => t.box).filter(Boolean);
  const cands = icClusters(parts, texts);
  if(!cands.length){ page.cleanup(); return { icons:[] }; }
  const vp = page.getViewport({ scale:IC_SCALE }); const cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
  const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
  await page.render({ canvasContext:ctx, viewport:vp }).promise; page.cleanup();
  const icons = [];
  for(const c of cands){
    const cr = icCropData(cv, c, IC_SCALE); if(!cr) continue; const f = icAnalyze(cr.id); if(!f) continue;
    icons.push({ ...f, box:c, title:icTitleOf(c, it.model?.textEls || []), thumb:icThumb(cr.cv) });
  }
  cv.width = cv.height = 0;
  return { icons };
}
async function icScanSvg(it){
  const list = (it.model?.icons || []).filter(i => i.box && i.box.w >= IC_MIN && i.box.w <= IC_MAX * 1.4);
  if(!list.length) return { icons:[] };
  const img = new Image(); img.src = it.url; await img.decode();
  const sc = 2, cv = document.createElement('canvas'); cv.width = img.naturalWidth * sc; cv.height = img.naturalHeight * sc;
  const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.drawImage(img, 0, 0, cv.width, cv.height);
  const icons = [];
  for(const i of list){ const cr = icCropData(cv, i.box, sc, 1); if(!cr) continue; const f = icAnalyze(cr.id); if(!f) continue;
    icons.push({ ...f, box:i.box, title:i.title || '', thumb:icThumb(cr.cv) }); }
  cv.width = cv.height = 0;
  return { icons };
}

// ───────── 묶기·판정
const ICV_LINE = /(^|[^a-z])(line|lines|outline|outlined|stroke|linear|regular|thin|light)([^a-z]|$)|선|라인|외곽/i;
const ICV_FILL = /(^|[^a-z])(fill|filled|solid|bold|glyph|duotone)([^a-z]|$)|면|채움|솔리드/i;
const icNm = (e, both) => e ? e.nm + (both && e.v ? ` (${e.v === 'line' ? '선' : '면'})` : '') : '';
const icCol = c => c ? `rgb(${c.join(',')})` : 'transparent';
function icColName(c){
  if(!c) return ''; const { h, s, v } = icHsv(...c);
  if(s < .16 || v < .12){ return v > .82 ? '흰' : v > .7 ? '밝은 회색' : v > .42 ? '회색' : v > .2 ? '진한 회색' : '검정'; }
  const nm = h < 15 || h >= 345 ? '빨강' : h < 40 ? '주황' : h < 65 ? '노랑' : h < 160 ? '초록' : h < 195 ? '청록' : h < 250 ? '파랑' : h < 290 ? '보라' : '분홍';
  return (v < .45 ? '짙은 ' : s < .35 ? '연한 ' : '') + nm;
}
function icStyleName(f){
  if(f.kind === 'photo') return '사진·입체처럼 보이는 그림';
  if(f.kind === 'multi') return '여러 색 그림';
  const g = `${icColName(f.gcol)} 그림`;
  if(!f.cont) return `바탕 없음 · ${g}`;
  return `${icColName(f.cont.col)} ${f.cont.shape === 'circle' ? '동그라미' : '네모'} 바탕 · ${g}`;
}
const icSameStyle = (a, b) => a.kind === b.kind && (a.kind !== 'flat' || (!!a.cont === !!b.cont && (!a.cont || (a.cont.shape === b.cont.shape && icDist(...a.cont.col, ...b.cont.col) < 70)) && icDist(...a.gcol, ...b.gcol) < 90));
function icCompute(){
  const uses = [], R0 = {};
  for(const t of icTargets()){ const c = ICON.cache.get(t.key); if(!c) continue; c.icons.forEach((f, i) => uses.push({ n:t.n, i, f })); }
  // 같은 아이콘끼리(모양·바탕 같음)
  const uniq = [];
  for(const u of uses){
    let hit = null; for(const q of uniq){ if(q.f.kind === u.f.kind && !!q.f.cont === !!u.f.cont && (!q.f.cont || q.f.cont.shape === u.f.cont.shape) && icNcc(q.f.desc, u.f.desc) > .93 && icDist(...q.f.gcol, ...u.f.gcol) < 60 && (Math.min(q.f.gs, u.f.gs) < 30 || Math.abs(Math.log((q.f.relW + .01) / (u.f.relW + .01))) < .3) && Math.abs(q.f.fill - u.f.fill) < .15){ hit = q; break; } }
    if(!hit){ hit = { id:icHash(u.f), f:u.f, uses:[] }; uniq.push(hit); }
    hit.uses.push(u);
  }
  const vis = uniq.filter(q => !ICON.hide.has(q.id) && ICON.isIcon.get(q.id) !== false);
  R0.notIcon = uniq.filter(q => ICON.isIcon.get(q.id) === false && !ICON.hide.has(q.id));
  vis.forEach(q => { q.pages = [...new Set(q.uses.map(u => u.n))].sort((a, b) => a - b); q.titles = [...new Set(q.uses.map(u => u.f.title).filter(Boolean))]; q.flags = []; });
  // 스타일 묶음
  const groups = [];
  for(const q of [...vis].sort((a, b) => b.uses.length - a.uses.length)){
    let g = groups.find(G => icSameStyle(G.f, q.f) || (q.f.kind === 'flat' && G.name === icStyleName(q.f))); if(!g){ g = { f:q.f, items:[], name:icStyleName(q.f) }; groups.push(g); } g.items.push(q); q.g = g;
  }
  groups.forEach((g, i) => { g.i = i; g.uses = g.items.reduce((a, q) => a + q.uses.length, 0); g.pages = [...new Set(g.items.flatMap(q => q.pages))].sort((a, b) => a - b); });
  groups.sort((a, b) => b.uses - a.uses);
  const R = { uniq:vis, all:uniq, groups, total:uses.length, lib:null, flags:[], notIcon:R0.notIcon };
  const lib = ICON.libSel && ICON.lib?.id === ICON.libSel ? ICON.lib : null;
  if(!lib){
    // ① 사진·입체·이모지·여러 색 그림이 납작한 아이콘과 섞임
    const flatU = vis.filter(q => q.f.kind === 'flat').reduce((a, q) => a + q.uses.length, 0), allU = vis.reduce((a, q) => a + q.uses.length, 0);
    if(allU && flatU / allU >= .6) vis.filter(q => q.f.kind !== 'flat').forEach(q => q.flags.push({ k:'kind', t: q.f.kind === 'photo' ? '사진·입체·이모지처럼 보여요' : '여러 색 그림이에요', d:'다른 아이콘은 대부분 단색 납작한 아이콘이에요.' }));
    // ② 선 아이콘끼리 굵기가 눈에 띄게 다름
    const lines = vis.filter(q => q.f.kind === 'flat' && q.f.fill < .42 && q.f.gs >= 24 && q.f.relW < .45);
    if(lines.length >= 4){
      const ws = lines.map(q => q.f.relW).sort((a, b) => a - b), m = ws[ws.length >> 1];
      lines.forEach(q => { const r = q.f.relW / m; if(r >= 1.8 || r <= .55) q.flags.push({ k:'weight', t: r > 1 ? '선이 눈에 띄게 굵어요' : '선이 눈에 띄게 가늘어요', d:`다른 아이콘보다 약 ${r > 1 ? r.toFixed(1) : (1 / r).toFixed(1)}배 ${r > 1 ? '굵어요' : '가늘어요'}.` }); });
    }
  } else {
    const hasV = { line:lib.icons.some(e => e.v === 'line'), fill:lib.icons.some(e => e.v === 'fill') };
    R.lib = { name:lib.name, n:lib.icons.length, both:hasV.line && hasV.fill };
    for(const q of vis){
      let best = null, bs = -1; for(const e of lib.icons){ const s = icNcc(q.f.desc, e.d); if(s > bs){ bs = s; best = e; } }
      q.match = bs >= .8 ? best : null; q.near = !q.match && bs >= .55 ? best : null; q.sim = bs;
      if(!q.match) q.flags.push({ k:'nolib', t:'라이브러리에 없는 아이콘', d: q.near ? `가장 비슷한 것: 「${icNm(q.near, hasV.line && hasV.fill)}」` : '' });
    }
    if(hasV.line && hasV.fill){
      const byPage = new Map();
      for(const q of vis) if(q.match?.v) for(const p of q.pages){ if(!byPage.has(p)) byPage.set(p, { line:[], fill:[] }); byPage.get(p)[q.match.v].push(q); }
      R.mixPages = [...byPage.entries()].filter(([, v]) => v.line.length && v.fill.length).map(([p, v]) => ({ p, line:v.line, fill:v.fill }));
    }
  }
  if(!lib) for(const q of vis){ const v = ICON.cv.get(q.id); if(v && (!v.mixed || v.notIcon)) q.flags = q.flags.filter(f => f.k !== 'kind' && f.k !== 'weight'); }
  R.flagged = vis.filter(q => q.flags.length);
  ICON.res = R; return R;
}

// ───────── Claude: ① 아이콘이 아닌 것 거르기 ② 섞임 표시 다시 보기(라이브러리 없을 때)
async function icSheet(cells, colorOf){
  const C = 8, cs = 96, rows = Math.ceil(cells.length / C);
  const cv = document.createElement('canvas'); cv.width = C * cs; cv.height = rows * cs; const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height);
  for(let i = 0; i < cells.length; i++){ const im = new Image(); im.src = cells[i].f.thumb; try{ await im.decode(); }catch(e){ continue; }
    const cx = (i % C) * cs, cy = Math.floor(i / C) * cs, s = Math.min(70 / im.width, 70 / im.height);
    x.drawImage(im, cx + (cs - im.width * s) / 2, cy + 16 + (cs - 16 - im.height * s) / 2, im.width * s, im.height * s);
    x.fillStyle = colorOf ? colorOf(i) : '#333'; x.font = 'bold 13px sans-serif'; x.fillText(String(i + 1), cx + 4, cy + 14); x.strokeStyle = '#ddd'; x.strokeRect(cx + .5, cy + .5, cs - 1, cs - 1); }
  const blob = await new Promise(r => cv.toBlob(r, 'image/png')); cv.width = cv.height = 0; return blob;
}
const IC_SORT_PROMPT = n => `제안서 쪽에서 아이콘 후보로 잘라 낸 그림 ${n}개입니다. 칸마다 번호가 있습니다. 번호마다 아이콘(뜻을 나타내는 작은 그림 기호)인지 판단하세요.
- 아이콘이 아닌 것: 숫자·글자·낱말(예: 01, 10-1, 3대), 화살표·꺾쇠만 있는 것, 점·원·글머리표, 차트·그래프 조각, 그림자·장식 도형, 큰 사진이나 그림의 일부.
- 사진·3D·이모지·여러 색 일러스트라도 아이콘 자리에 쓰였으면 아이콘입니다.
JSON으로만 답하세요: {"r":[{"i":번호,"icon":true|false}]}`;
async function icClaudeRun(){
  if(!S.sample || !S.imgLimits || ICON.claude?.running) return;
  const todo = (ICON.res?.all || []).filter(q => !ICON.isIcon.has(q.id) && !ICON.hide.has(q.id));
  if(todo.length){
    ICON.claude = { running:true, t:'Claude가 아이콘이 아닌 것을 거르는 중…' }; icRenderStatus();
    for(let k = 0; k < todo.length; k += 40){
      const cells = todo.slice(k, k + 40);
      try{ const raw = await S.sample.json(IC_SORT_PROMPT(cells.length), { images:[await icSheet(cells)] });
        for(const r of (Array.isArray(raw?.r) ? raw.r : [])){ const q = cells[(+r.i || 0) - 1]; if(q && typeof r.icon === 'boolean') ICON.isIcon.set(q.id, r.icon); } }
      catch(e){ console.warn('icon sort', e); if(e?.code === 'not_granted' || e?.code === 'rate_limited') break; }
    }
    todo.forEach(q => { if(!ICON.isIcon.has(q.id)) ICON.isIcon.set(q.id, true); });
    ICON.claude = null; icCompute(); Icons.render();
  }
  await icClaudeCheck();
}
async function icClaudeCheck(){
  const R = ICON.res; if(!R || R.lib || !S.sample || !S.imgLimits || ICON.claude?.running) return;
  const cand = R.flagged.filter(q => q.flags.some(f => f.k === 'kind' || f.k === 'weight') && !ICON.cv.has(q.id)).slice(0, 24);
  if(!cand.length) return;
  const ref = R.uniq.filter(q => !q.flags.length).sort((a, b) => b.uses.length - a.uses.length).slice(0, 12);
  const cells = [...ref, ...cand]; const blob = await icSheet(cells, i => i < ref.length ? '#666' : '#c00');
  ICON.claude = { running:true, t:'Claude가 표시한 아이콘을 다시 보는 중…' }; icRenderStatus();
  try{
    const raw = await S.sample.json(`한 제안서에 쓰인 아이콘들입니다. 회색 번호 1~${ref.length}은 문서에 가장 많이 쓰인 아이콘(기준)이고, 빨간 번호 ${ref.length + 1}~${cells.length}은 규칙이 「섞였을 수 있다」고 표시한 아이콘입니다.
빨간 번호마다, 기준 아이콘들과 같은 아이콘 시스템으로 봐도 되는지 판단하세요.
- 선 아이콘과 면 아이콘이 함께 있는 것, 색이 다른 것은 같은 시스템일 수 있으니 섞였다고 하지 마세요.
- 섞였다고 할 것은 두 가지뿐입니다: (a) 사진·3D·이모지·여러 색 일러스트가 납작한 아이콘 사이에 낀 것, (b) 선 아이콘인데 선 굵기가 기준과 눈에 띄게 다른 것.
- 아이콘이 아닌 것(장식 도형·차트 조각·글머리표)이면 notIcon을 true로.
JSON으로만 답하세요: {"r":[{"i":번호,"mixed":true|false,"notIcon":true|false,"why":"20자 이내"}]}`, { images:[blob] });
    for(const r of (Array.isArray(raw?.r) ? raw.r : [])){ const q = cells[(+r.i || 0) - 1]; if(!q || !cand.includes(q)) continue;
      ICON.cv.set(q.id, { mixed:!!r.mixed, notIcon:!!r.notIcon, why:String(r.why || '').slice(0, 30) }); if(r.notIcon) ICON.isIcon.set(q.id, false); }
    cand.forEach(q => { if(!ICON.cv.has(q.id)) ICON.cv.set(q.id, { mixed:true }); });
    ICON.claude = { done:true, n:cand.length };
  }catch(e){ console.warn('icon claude', e); ICON.claude = { err:true }; }
  icCompute(); Icons.render();
}

// ───────── 라이브러리 읽기
async function icCanvasFromImage(src, max = 160){
  const im = new Image(); im.src = src; await im.decode();
  let w = im.naturalWidth || 128, h = im.naturalHeight || 128; if(!w || !h){ w = h = 128; }
  const s = Math.min(8, max / Math.max(w, h)); const cv = document.createElement('canvas'); cv.width = Math.max(8, Math.round(w * s)); cv.height = Math.max(8, Math.round(h * s));
  const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height); x.drawImage(im, 0, 0, cv.width, cv.height); return cv;
}
function icPadCanvas(cv, pad){ const c = document.createElement('canvas'); c.width = cv.width + pad * 2; c.height = cv.height + pad * 2; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(cv, pad, pad); return c; }
// 큰 그림 한 장에 여러 아이콘이 있으면 나눔
function icSplitSheet(cv){
  const w = cv.width, h = cv.height; if(w < 220 && h < 220) return [cv];
  const id = cv.getContext('2d').getImageData(0, 0, w, h), d = id.data, N = w * h;
  const bg = [d[0], d[1], d[2]]; const B = new Uint8Array(N); for(let i = 0; i < N; i++) B[i] = icDist(d[i * 4], d[i * 4 + 1], d[i * 4 + 2], ...bg) > 48 ? 1 : 0;
  const r = Math.max(2, Math.round(Math.min(w, h) * .012)); const Dl = new Uint8Array(N);
  for(let y = 0; y < h; y++) for(let x = 0; x < w; x++) if(B[y * w + x]) for(let dy = -r; dy <= r; dy++) for(let dx = -r; dx <= r; dx++){ const xx = x + dx, yy = y + dy; if(xx >= 0 && yy >= 0 && xx < w && yy < h) Dl[yy * w + xx] = 1; }
  const lab = new Int32Array(N).fill(-1), boxes = [];
  for(let i = 0; i < N; i++){ if(!Dl[i] || lab[i] >= 0) continue; const q = [i]; lab[i] = boxes.length; const bx = { x:1e9, y:1e9, r:-1, b:-1 };
    while(q.length){ const j = q.pop(); const x = j % w, y = (j / w) | 0; if(B[j]){ bx.x = Math.min(bx.x, x); bx.y = Math.min(bx.y, y); bx.r = Math.max(bx.r, x); bx.b = Math.max(bx.b, y); }
      for(const k of [j - 1, j + 1, j - w, j + w]){ if(k < 0 || k >= N || lab[k] >= 0 || !Dl[k]) continue; if((k === j - 1 && x === 0) || (k === j + 1 && x === w - 1)) continue; lab[k] = boxes.length; q.push(k); } }
    if(bx.r >= 0) boxes.push(bx); }
  const big = boxes.filter(b => b.r - b.x >= 12 && b.b - b.y >= 12);
  if(big.length < 3) return [cv];
  const hs = big.map(b => b.b - b.y).sort((a, b) => a - b), mh = hs[hs.length >> 1];
  const ok = big.filter(b => { const bw = b.r - b.x + 1, bh = b.b - b.y + 1; return bh >= mh * .5 && bw / bh <= 1.9 && bh / bw <= 1.9; });
  return ok.sort((a, b) => (a.y - b.y) || (a.x - b.x)).map(b => { const c = document.createElement('canvas'); c.width = b.r - b.x + 1; c.height = b.b - b.y + 1; c.getContext('2d').drawImage(cv, b.x, b.y, c.width, c.height, 0, 0, c.width, c.height); return icPadCanvas(c, 4); });
}
function icEntry(cv, nm, cat){
  const id = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height); const f = icAnalyze(id); if(!f) return null;
  const hint = `${cat || ''}/${nm}`; const v = ICV_FILL.test(hint) ? 'fill' : ICV_LINE.test(hint) ? 'line' : '';
  return { nm, cat:cat || '', v, vAuto: f.line ? 'line' : 'fill', k:f.kind, w:f.relW, f:f.fill, d:f.desc, t:icThumb(cv, 48) };
}
async function icLibFromFiles(files, onStep){
  const out = []; const queue = files.map(f => ({ f, path:f.name }));
  const base = p => p.split('/').pop().replace(/\.[^.]+$/, ''), dir = p => p.split('/').slice(0, -1).filter(Boolean).pop() || '';
  let k = 0;
  while(queue.length){
    const { f, path } = queue.shift(); const e = (path.split('.').pop() || '').toLowerCase(); onStep?.(`라이브러리 읽는 중… ${++k}개째 파일 · 아이콘 ${out.length}개`);
    try{
      if(e === 'zip'){ const z = await JSZip.loadAsync(f); for(const [p, ent] of Object.entries(z.files)){ if(ent.dir || /(^|\/)(__MACOSX|\.)/.test(p)) continue; const ex = (p.split('.').pop() || '').toLowerCase(); if(!['svg', 'png', 'jpg', 'jpeg', 'webp', 'pdf', 'ai'].includes(ex)) continue; queue.push({ f:new File([await ent.async('blob')], p.split('/').pop()), path:p }); } continue; }
      if(e === 'svg'){
        let t = await f.text(); if(!/xmlns=/.test(t)) t = t.replace(/<svg\b/, '<svg xmlns="http://www.w3.org/2000/svg"');
        t = t.replace(/currentColor/g, '#000');
        const url = URL.createObjectURL(new Blob([t], { type:'image/svg+xml' })); try{ const cv = icPadCanvas(await icCanvasFromImage(url, 120), 6); const en = icEntry(cv, base(path), dir(path)); if(en) out.push(en); } finally { URL.revokeObjectURL(url); }
        continue; }
      if(['png', 'jpg', 'jpeg', 'webp'].includes(e)){
        const url = URL.createObjectURL(f); let cv; try{ cv = await icCanvasFromImage(url, 1600); } finally { URL.revokeObjectURL(url); }
        const parts = icSplitSheet(cv);
        if(parts.length === 1){ const c1 = parts[0] === cv ? icPadCanvas(await icCanvasFromImage(cv.toDataURL(), 120), 6) : parts[0]; const en = icEntry(c1, base(path), dir(path)); if(en) out.push(en); }
        else parts.forEach((c, i) => { const en = icEntry(c, `${base(path)} ${i + 1}`, dir(path)); if(en) out.push(en); });
        continue; }
      if(e === 'pdf' || e === 'ai'){
        const pdf = await openPdf(f).catch(() => null); if(!pdf){ ICON.msg = { lv:'warn', t:`「${f.name}」을 열지 못했어요. AI 파일은 「PDF 호환 파일 만들기」를 켜고 저장해야 읽을 수 있어요.` }; continue; }
        for(let p = 1; p <= Math.min(pdf.numPages, 40); p++){
          const page = await pdf.getPage(p); const vp1 = page.getViewport({ scale:1 });
          const tc = await page.getTextContent(); const texts = tc.items.filter(t => t.str?.trim()).map(t => { const m = pdfjsLib.Util.transform(vp1.transform, t.transform); const fh = Math.hypot(m[2], m[3]); return { box:{ x:m[4], y:m[5] - fh * .82, r:m[4] + t.width, b:m[5] + fh * .2 }, lines:[t.str.trim()], w:500 }; });
          const { parts } = await icPdfParts(page);
          let cl = icClusters(parts, texts.map(t => t.box), { min:5, max:Math.max(80, Math.min(400, Math.min(vp1.width, vp1.height) * .9)), gap:.8 });
          const single = !cl.length || (vp1.width <= 200 && vp1.height <= 200);
          if(single) cl = [{ x:0, y:0, r:vp1.width, b:vp1.height, w:vp1.width, h:vp1.height }];
          const med = cl.map(c => Math.max(c.w, c.h)).sort((a, b) => a - b)[cl.length >> 1] || 40;
          let sc = Math.min(8, Math.max(1, 110 / med)); while(vp1.width * sc * vp1.height * sc > 16e6 && sc > 1) sc *= .8;
          const vp = page.getViewport({ scale:sc }); const cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
          const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height); await page.render({ canvasContext:x, viewport:vp }).promise;
          cl.forEach((c, i) => { const cr = icCropData(cv, c, sc, single ? 0 : 1.5); if(!cr) return;
            let nm = single ? `${base(path)}${pdf.numPages > 1 ? ' ' + p : ''}` : '';
            if(!nm){ const below = texts.filter(t => t.box.y >= c.b - 2 && t.box.y - c.b < Math.max(14, c.h * .8) && t.box.x < c.r + 4 && t.box.r > c.x - 4).sort((a, b) => a.box.y - b.box.y)[0]; nm = below ? below.lines[0].slice(0, 30) : `${base(path)} ${p}-${i + 1}`; }
            const en = icEntry(cr.cv, nm, dir(path) || base(path)); if(en) out.push(en); });
          cv.width = cv.height = 0; page.cleanup(); await icTick();
        }
        pdf.destroy?.(); continue; }
    }catch(err){ console.warn('icon lib', path, err); }
    await icTick();
  }
  // 이름·폴더에 선/면 표시가 없으면 생김새로 나눔(라이브러리 안에서 둘 다 넉넉할 때만)
  if(!out.some(e => e.v)){ const l = out.filter(e => e.vAuto === 'line').length; if(l >= out.length * .15 && l <= out.length * .85) out.forEach(e => { e.v = e.vAuto; e.vGuess = true; }); }
  return out;
}

// ───────── 라이브러리 저장(작업 공간)
const icPack = icons => JSON.stringify(icons.map(e => ({ nm:e.nm, cat:e.cat, v:e.v, k:e.k, w:e.w, f:e.f, d:icB64(e.d), t:e.t })));
const icUnpack = s => JSON.parse(s).map(e => ({ ...e, d:icU8(e.d) }));
async function icLibList(){
  if(!W.ok()){ return; }
  try{ ICON.libs = (await W.list('iconlib')).map(m => ({ id:m.id, name:m.name, n:m.n, at:m.at, chunks:m.chunks })).sort((a, b) => (b.at || 0) - (a.at || 0)); }catch(e){ console.warn('iconlib list', e); }
}
async function icLibLoad(id){
  if(!id){ ICON.lib = null; return; }
  if(ICON.lib?.id === id) return;
  const local = ICON.libs.find(l => l.id === id && l.icons); if(local){ ICON.lib = local; return; }
  const m = ICON.libs.find(l => l.id === id); if(!m || !W.ok()){ ICON.lib = null; return; }
  ICON.busy = { t:`라이브러리 「${m.name}」을 불러오는 중…` }; icRenderStatus();
  try{ let s = ''; for(let i = 0; i < (m.chunks || 0); i++){ const c = await W.get(`iconlibc/${id}_${i}`); s += c?.t || ''; } ICON.lib = { id, name:m.name, icons:icUnpack(s) }; }
  catch(e){ console.warn('iconlib load', e); ICON.lib = null; ICON.msg = { lv:'warn', t:'라이브러리를 불러오지 못했어요.' }; }
  ICON.busy = null;
}
async function icLibSave(name, icons){
  const id = 'L' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const meta = { id, name, n:icons.length, at:Date.now() };
  if(W.ok()){
    const s = icPack(icons), CH = 50000, k = Math.ceil(s.length / CH);
    for(let i = 0; i < k; i++) await W.set(`iconlibc/${id}_${i}`, { t:s.slice(i * CH, (i + 1) * CH) });
    await W.set(`iconlib/${id}`, { ...meta, chunks:k });
    meta.chunks = k;
  }
  ICON.libs = [{ ...meta, icons }, ...ICON.libs.filter(l => l.id !== id)];
  ICON.lib = { id, name, icons };
  icSelect(id);
  return id;
}
async function icLibDelete(id){
  const m = ICON.libs.find(l => l.id === id); if(!m) return;
  if(W.ok() && m.chunks != null){ try{ for(let i = 0; i < (m.chunks || 0); i++) await W.del(`iconlibc/${id}_${i}`); await W.del(`iconlib/${id}`); }catch(e){ console.warn('iconlib del', e); } }
  ICON.libs = ICON.libs.filter(l => l.id !== id); if(ICON.lib?.id === id) ICON.lib = null; icSelect('');
}
const icSelKey = () => 'rev:iconlib:' + (typeof wsKey === 'function' ? wsKey() : 'me');
function icSelect(id){ ICON.libSel = id; try{ localStorage.setItem(icSelKey(), id); }catch(e){} }

// ───────── 화면
function icRenderStatus(){
  const el = document.getElementById('icStatus'); if(!el) return;
  const b = ICON.busy; el.innerHTML = b ? `${esc(b.t)}` : ICON.claude?.running ? esc(ICON.claude.t) : '';
  el.hidden = !el.innerHTML;
}
const icPg = ps => ps.length > 8 ? `${ps.slice(0, 8).join(', ')} 외 ${ps.length - 8}쪽` : ps.join(', ') + '쪽';
function icCell(q, { flags = false, name = '' } = {}){
  const tt = q.titles.length ? q.titles.slice(0, 2).join(' · ') : '';
  return `<figure class="iccell${q.flags.length ? ' flag' : ''}" title="${esc((name ? name + ' · ' : '') + (tt ? tt + ' · ' : '') + icPg(q.pages))}">
    <button type="button" class="ichide" data-ichide="${esc(q.id)}" aria-label="아이콘이 아니에요 — 목록에서 빼기">×</button>
    <img src="${q.f.thumb}" alt="">
    <figcaption><i>${name ? `<b>${esc(name)}</b>` : tt ? esc(tt) : '<span class="muted">제목 없음</span>'}</i><span>${esc(icPg(q.pages))}${q.uses.length > 1 ? ` · ${q.uses.length}번` : ''}</span>
    ${flags ? q.flags.map(f => `<em>${esc(f.t)}</em>${f.d ? `<small>${esc(f.d)}</small>` : ''}`).join('') : ''}</figcaption></figure>`;
}
const Icons = {
  init(){ try{ ICON.libSel = localStorage.getItem(icSelKey()) || ''; }catch(e){} },
  async onWs(){ ICON.libs = ICON.libs.filter(l => l.chunks == null); ICON.lib = null; try{ ICON.libSel = localStorage.getItem(icSelKey()) || ''; }catch(e){ ICON.libSel = ''; } await icLibList(); ICON.loadedFor = null; if(this.visible()) this.open(); },
  visible(){ return !document.getElementById('tab-icons')?.hidden; },
  async open(){
    if(ICON.loadedFor !== S.wsTok){ ICON.loadedFor = S.wsTok; await icLibList(); }
    if(ICON.libSel && !ICON.libs.some(l => l.id === ICON.libSel)) ICON.libSel = '';
    await icLibLoad(ICON.libSel);
    const need = icTargets().some(t => (t.it.kind === 'pdf' || t.it.kind === 'svg') && !ICON.cache.has(t.key));
    if(need) icScan(); else { icCompute(); this.render(); icClaudeRun(); }
    this.render();
  },
  render(){
    const box = document.getElementById('icons'); if(!box) return;
    const R = ICON.res, T = icTargets(); const imgOnly = T.length && T.every(t => t.it.kind === 'image');
    let h = `<h2>아이콘</h2><div class="icbar"><label>아이콘 라이브러리 <select id="icLib"><option value="">없음 — 스타일 묶음으로 보기</option>${ICON.libs.map(l => `<option value="${esc(l.id)}"${l.id === ICON.libSel ? ' selected' : ''}>${esc(l.name)} · ${l.n}개</option>`).join('')}</select></label>
      <label class="btn ghost">라이브러리 올리기<input type="file" id="icUp" multiple hidden accept=".svg,.png,.jpg,.jpeg,.webp,.zip,.pdf,.ai"></label>
      ${ICON.libSel ? (ICON.delAsk ? `<span class="muted">「${esc(ICON.libs.find(l => l.id === ICON.libSel)?.name || '')}」을 지울까요?${S.ws?.kind === 'party' ? ' 파티원 모두에게서 사라져요.' : ''}</span><button type="button" id="icDelYes">지우기</button><button type="button" class="ghost" id="icDelNo">취소</button>` : '<button type="button" class="ghost" id="icDel">이 라이브러리 지우기</button>') : ''}</div>
      <div class="note" style="margin-top:6px">${ICON.libSel ? '라이브러리에 있는 아이콘인지 모양으로 맞춰 봐요. 라이브러리에 선·면 두 버전이 있으면 한 쪽 안에 두 버전이 섞인 곳도 찾아요.' : '라이브러리가 없으면 선·면처럼 한 시스템 안에 함께 있을 수 있는 차이는 판단하지 않고, 생김새가 비슷한 것끼리 묶어 보여 줘요. 사진·입체·이모지·여러 색 그림이 섞였거나 선 굵기가 눈에 띄게 다른 것만 따로 표시해요.'} SVG·PNG·JPG·ZIP·PDF·AI 모두 올릴 수 있어요. 파일 이름이 아이콘 이름이 돼요.</div>
      <div id="icStatus" class="icstatus" hidden></div>`;
    if(ICON.msg) h += `<div class="msg ${ICON.msg.lv === 'warn' ? 'warn' : ''}" style="margin-top:8px">${esc(ICON.msg.t)}</div>`;
    if(imgOnly){ box.innerHTML = h + '<p class="muted" style="margin-top:12px">PNG·JPG 쪽은 아이콘을 따로 찾지 않아요. PDF나 SVG로 올리면 아이콘을 살펴볼 수 있어요.</p>'; this.bind(); icRenderStatus(); return; }
    if(!R){ box.innerHTML = h + '<p class="muted" style="margin-top:12px">아이콘을 찾는 중이에요.</p>'; this.bind(); icRenderStatus(); return; }
    if(!R.uniq.length){ box.innerHTML = h + '<p class="muted" style="margin-top:12px">쪽에서 아이콘을 찾지 못했어요.</p>'; this.bind(); icRenderStatus(); return; }
    const C = ICON.claude;
    const cnote = R.lib ? '' : (C?.done || ICON.cv.size) ? ` <span class="muted">Claude가 다시 보고 같은 시스템이라고 본 것은 뺐어요.</span>` : (!S.sample ? ' <span class="muted">이 화면에서는 Claude 확인 없이 규칙으로만 찾았어요.</span>' : '');
    h += `<p class="muted" style="margin-top:10px">아이콘 ${R.uniq.length}종 · ${R.uniq.reduce((a, q) => a + q.uses.length, 0)}번 쓰임${R.lib ? ` · 라이브러리 「${esc(R.lib.name)}」(${R.lib.n}개)와 대조` : ` · 스타일 묶음 ${R.groups.length}개`}</p>`;
    if(R.flagged.length) h += `<h3>확인할 아이콘 ${R.flagged.length}종${cnote}</h3><div class="icgrid">${R.flagged.map(q => icCell(q, { flags:true })).join('')}</div>`;
    else h += `<h3>확인할 아이콘 없음${cnote}</h3><p class="muted">${R.lib ? '모든 아이콘이 라이브러리에 있어요.' : '꼭 섞이면 안 되는 경우는 찾지 못했어요. 아래 묶음을 한눈에 훑어 보세요.'}</p>`;
    if(R.mixPages?.length) h += `<h3>한 쪽에 선·면 버전이 섞인 곳</h3><ul class="list">${R.mixPages.map(m => li('warn', `${m.p}쪽`, `선: ${[...new Set(m.line.map(q => q.match.nm))].join(', ')} · 면: ${[...new Set(m.fill.map(q => q.match.nm))].join(', ')}`)).join('')}</ul>`;
    if(R.lib){
      const ok = R.uniq.filter(q => q.match);
      h += `<h3>라이브러리에 있는 아이콘 ${ok.length}종</h3>${ok.length ? `<div class="icgrid">${ok.map(q => icCell(q, { name:icNm(q.match, R.lib.both) })).join('')}</div>` : '<p class="muted">없어요.</p>'}`;
    } else {
      h += `<h3>스타일 묶음</h3>`;
      for(const g of R.groups){
        const sv = ICON.saveGrp === g.i;
        h += `<div class="icgrp"><div class="icgh"><span class="icsw" style="background:${icCol(g.f.cont?.col || [255, 255, 255])};color:${icCol(g.f.gcol)}">●</span><b>${esc(g.name)}</b><span class="muted">${g.items.length}종 · ${g.uses}번 · ${esc(icPg(g.pages))}</span>
          ${sv ? `<form class="icsave" data-g="${g.i}"><input type="text" name="nm" placeholder="라이브러리 이름" value="${esc(g.name)}" required maxlength="40"><button type="submit">저장</button><button type="button" class="ghost" data-iccancel>취소</button></form>` : `<button type="button" class="ghost" data-icsave="${g.i}">우리 아이콘 시스템으로 저장</button>`}</div>
          <div class="icgrid">${g.items.map(q => icCell(q)).join('')}</div></div>`;
      }
    }
    if(R.notIcon?.length) h += `<details class="icno"><summary>Claude가 아이콘이 아니라고 본 것 ${R.notIcon.length}종(숫자·화살표·장식 등)</summary><div class="icgrid">${R.notIcon.map(q => `<figure class="iccell"><img src="${q.f.thumb}" alt=""><figcaption><button type="button" class="linklike" data-icyes="${esc(q.id)}">아이콘 맞아요</button></figcaption></figure>`).join('')}</div></details>`;
    if(ICON.hide.size) h += `<p class="muted" style="margin-top:12px">아이콘이 아니라고 뺀 것 ${ICON.hide.size}종 · <button type="button" class="linklike" id="icUnhide">다시 보이기</button></p>`;
    box.innerHTML = h; this.bind(); icRenderStatus();
  },
  bind(){
    const box = document.getElementById('icons');
    box.querySelector('#icLib')?.addEventListener('change', async e => { ICON.delAsk = false; icSelect(e.target.value); ICON.msg = null; await icLibLoad(ICON.libSel); icCompute(); this.render(); icClaudeRun(); });
    box.querySelector('#icUp')?.addEventListener('change', async e => { const fs = [...e.target.files]; e.target.value = ''; if(fs.length) await this.upload(fs); });
    box.querySelector('#icDel')?.addEventListener('click', () => { ICON.delAsk = true; this.render(); });
    box.querySelector('#icDelNo')?.addEventListener('click', () => { ICON.delAsk = false; this.render(); });
    box.querySelector('#icDelYes')?.addEventListener('click', async () => { ICON.delAsk = false; const id = ICON.libSel; await icLibDelete(id); ICON.msg = { lv:'info', t:'라이브러리를 지웠어요.' }; icCompute(); this.render(); icClaudeRun(); });
    box.querySelectorAll('[data-ichide]').forEach(b => b.addEventListener('click', () => { ICON.hide.add(b.dataset.ichide); try{ localStorage.setItem('rev:icHide', JSON.stringify([...ICON.hide].slice(-400))); }catch(e){} icCompute(); this.render(); }));
    box.querySelectorAll('[data-icyes]').forEach(b => b.addEventListener('click', () => { ICON.isIcon.set(b.dataset.icyes, true); icCompute(); this.render(); }));
    box.querySelector('#icUnhide')?.addEventListener('click', () => { ICON.hide.clear(); try{ localStorage.removeItem('rev:icHide'); }catch(e){} icCompute(); this.render(); });
    box.querySelectorAll('[data-icsave]').forEach(b => b.addEventListener('click', () => { ICON.saveGrp = +b.dataset.icsave; this.render(); box.querySelector('.icsave input')?.focus(); }));
    box.querySelector('[data-iccancel]')?.addEventListener('click', () => { ICON.saveGrp = null; this.render(); });
    box.querySelector('.icsave')?.addEventListener('submit', async e => { e.preventDefault(); const g = ICON.res?.groups.find(G => G.i === +e.target.dataset.g); const nm = e.target.nm.value.trim(); if(!g || !nm) return;
      const icons = g.items.map((q, i) => ({ nm:q.titles[0] || `아이콘 ${i + 1}`, cat:'', v:'', k:q.f.kind, w:q.f.relW, f:q.f.fill, d:q.f.desc, t:q.f.thumb }));
      ICON.saveGrp = null; ICON.busy = { t:'라이브러리로 저장하는 중…' }; this.render();
      try{ await icLibSave(nm, icons); ICON.msg = { lv:'info', t:`「${nm}」 라이브러리로 저장했어요(아이콘 ${icons.length}개).${W.ok() ? ` ${typeof wsName === 'function' ? wsName() : '작업 공간'}에 남아 다음 검수에서도 고를 수 있어요.` : ' 로그인하지 않아 이 화면에만 남아요.'}` }; }
      catch(err){ console.warn(err); ICON.msg = { lv:'warn', t:'라이브러리를 저장하지 못했어요.' }; }
      ICON.busy = null; icCompute(); this.render(); });
  },
  async upload(files){
    ICON.msg = null; ICON.busy = { t:'라이브러리 읽는 중…' }; this.render();
    let icons = [];
    try{ icons = await icLibFromFiles(files, t => { ICON.busy = { t }; icRenderStatus(); }); }catch(e){ console.warn(e); }
    if(!icons.length){ ICON.busy = null; ICON.msg = ICON.msg || { lv:'warn', t:'올린 파일에서 아이콘을 찾지 못했어요.' }; this.render(); return; }
    const nm = files.length === 1 ? files[0].name.replace(/\.[^.]+$/, '') : `아이콘 라이브러리 ${new Date().toLocaleDateString('ko-KR')}`;
    ICON.busy = { t:`라이브러리 「${nm}」을 저장하는 중…` }; icRenderStatus();
    try{ await icLibSave(nm, icons);
      const vs = icons.filter(e => e.v === 'line').length, vf = icons.filter(e => e.v === 'fill').length;
      ICON.msg = { lv:'info', t:`「${nm}」 라이브러리를 만들었어요 — 아이콘 ${icons.length}개${vs && vf ? ` (선 ${vs} · 면 ${vf}${icons.some(e => e.vGuess) ? ', 생김새로 나눔' : ''})` : ''}.${W.ok() ? '' : ' 로그인하지 않아 이 화면에만 남아요.'}` }; }
    catch(e){ console.warn(e); ICON.msg = { lv:'warn', t:'라이브러리를 저장하지 못했어요. 파일이 너무 크면 나눠서 올려 주세요.' }; }
    ICON.busy = null; icCompute(); this.render();
  },
  // 엑셀 내보내기용
  rows(){ const R = ICON.res; if(!R) return [];
    return R.uniq.flatMap(q => q.uses.map(u => [q.match?.nm || (R.lib ? '' : q.g?.name || ''), u.n, u.f.title || '', q.flags.map(f => f.t).join(', ')])); },
  changed(){
    if(this.visible()) return this.open();
    clearTimeout(ICON.bgT); ICON.bgT = setTimeout(() => { if(S.ready && !S.running && !this.visible() && icTargets().some(t => (t.it.kind === 'pdf' || t.it.kind === 'svg') && !ICON.cache.has(t.key))) icScan(); }, 2500);
  },
};
window.Icons = Icons;
