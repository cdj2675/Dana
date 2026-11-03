'use strict';
// ═════════════════════════════ 올린 파일 보관(다른 컴퓨터에서도 이어서)
// 아티팩트 파일 보관함(assets)에 암호화해 넣고, 목록은 작업 공간(db)에 둡니다.
// - 보관함은 이미지·PDF·폰트·텍스트만 받으므로 파일을 AES-GCM으로 잠근 뒤 base64 텍스트로 넣음
// - 한 조각 20MiB 한도 → 12MiB씩 잘라 넣음(base64로 약 16MiB)
// - 내 공간: 사람마다 무작위 열쇠(본인만 읽는 db 칸), 파티: 파티 코드 열쇠
// - 편집 권한이 있는 사람만 보관 가능(보관함 기능은 편집자·소유자에게만 열림)
const VAULT_CHUNK = 12 * 1024 * 1024;
const SLOT_NAME = { 'design:ms':'원고', 'design:assets':'디자인 자료', 'review:des':'검수 디자인', 'review:src':'검수 기준 원문' };
async function encBytes(key, u8){ const iv = crypto.getRandomValues(new Uint8Array(12)); const ct = new Uint8Array(await crypto.subtle.encrypt({ name:'AES-GCM', iv }, key, u8)); const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12); return out; }
async function decBytes(key, u8){ return new Uint8Array(await crypto.subtle.decrypt({ name:'AES-GCM', iv:u8.subarray(0, 12) }, key, u8.subarray(12))); }
const mb = n => (n / 1048576).toFixed(n >= 10485760 ? 0 : 1) + 'MB';
const Vault = {
  as:null, tried:false, keep:true, man:null, restoring:false, usage:null, err:null, saving:0, wsTok:-1, restoredTok:-1,
  async init(){ if(!this.tried){ this.tried = true; try{ this.as = await (window.claude?.use?.('assets') ?? null); }catch(e){ this.as = null; } } return this.as; },
  ok(){ return !!(this.as && W.ok()); },
  async key(){
    if(S.ws.kind === 'party') return S.ws.key;
    let d = null; try{ d = await W.get('config/vaultkey'); }catch(e){}
    if(!d?.k){ d = { k:b64e(crypto.getRandomValues(new Uint8Array(32))) }; await W.set('config/vaultkey', d); }
    return crypto.subtle.importKey('raw', b64d(d.k), 'AES-GCM', false, ['encrypt', 'decrypt']);
  },
  async load(){
    if(this.wsTok === S.wsTok && this.man) return; this.wsTok = S.wsTok; this.man = { slots:{} }; this.keep = true;
    if(!W.ok()) return;
    try{ const st = await W.get('files/settings'); this.keep = st ? st.keep !== false : true; }catch(e){}
    try{ this.man = (await W.get('files/manifest')) || { slots:{} }; this.man.slots ||= {}; }catch(e){ this.man = { slots:{} }; }
  },
  async refreshUsage(){ try{ this.usage = (await this.as.list()).usage; }catch(e){ this.usage = null; } },
  count(){ return Object.values(this.man?.slots || {}).reduce((a, l) => a + l.length, 0); },
  bytes(){ return Object.values(this.man?.slots || {}).reduce((a, l) => a + l.reduce((b, e) => b + e.size, 0), 0); },
  async saveMan(){ try{ await W.set('files/manifest', this.man); }catch(e){ console.warn('vault manifest', e); this.err = '보관 목록을 저장하지 못했습니다.'; } },
  async delAssets(e){ for(const id of e.ids || []) try{ await this.as.delete(id); }catch(x){ /* 다른 사람이 올린 것은 지울 수 없음 */ } },
  // 파일 넣기: append면 같은 이름만 바꾸고 나머지는 둠
  async put(slot, files, { append = false } = {}){
    if(this.restoring || !files?.length) return; await this.init(); await this.load();
    if(!this.ok() || !this.keep) return;
    this.saving++; this.err = null; this.render();
    try{
      const k = await this.key(); const cur = this.man.slots[slot] || []; const names = new Set(files.map(f => f.name));
      const gone = append ? cur.filter(e => names.has(e.name)) : cur; const keep = append ? cur.filter(e => !names.has(e.name)) : [];
      const added = [];
      for(const f of files){ const u8 = new Uint8Array(await f.arrayBuffer()); const ids = [];
        for(let o = 0; o === 0 || o < u8.length; o += VAULT_CHUNK){
          const enc = await encBytes(k, u8.subarray(o, o + VAULT_CHUNK));
          const r = await this.as.upload(new Blob([b64e(enc)], { type:'text/plain' }), { type:'text/plain' }); ids.push(r.id);
          if(!u8.length) break; }
        added.push({ name:f.name, type:f.type || '', size:u8.length, ids, at:Date.now() }); }
      this.man.slots[slot] = [...keep, ...added]; await this.saveMan();
      for(const e of gone) await this.delAssets(e);
    }catch(e){ console.warn('vault put', e); this.err = e?.code === 'quota_or_state' ? '보관함이 가득 찼습니다. 쓰지 않는 보관 파일을 지워 주세요.' : e?.code === 'not_granted' ? '파일을 보관할 권한이 없습니다(편집 권한 필요).' : '파일을 보관하지 못했습니다. 이 화면에서는 계속 쓸 수 있습니다.'; }
    this.saving--; await this.refreshUsage(); this.render();
  },
  async drop(slot, names){
    await this.init(); await this.load(); if(!this.ok()) return; const cur = this.man.slots[slot] || []; if(!cur.length) return;
    const gone = names ? cur.filter(e => names.includes(e.name)) : cur; this.man.slots[slot] = names ? cur.filter(e => !names.includes(e.name)) : [];
    await this.saveMan(); for(const e of gone) await this.delAssets(e); await this.refreshUsage(); this.render();
  },
  async clearAll(){ await this.load(); if(!this.ok()) return; const all = Object.values(this.man.slots).flat(); this.man = { slots:{} }; await this.saveMan(); for(const e of all) await this.delAssets(e); await this.refreshUsage(); this.render(); },
  async setKeep(v){ this.keep = v; try{ await W.set('files/settings', { keep:v }); }catch(e){} this.render(); },
  async getFile(e, k){ const parts = [];
    for(const id of e.ids){ const r = await fetch('/_blob/' + id); if(!r.ok) throw new Error('missing'); parts.push(await decBytes(k, b64d((await r.text()).trim()))); }
    return new File(parts, e.name, { type:e.type }); },
  // 작업 공간을 열 때 한 번: 아직 아무 파일도 없는 탭에만 되살림
  async restore(){
    await this.init(); if(!this.ok()) { this.render(); return; }
    await this.load(); await this.refreshUsage(); this.render();
    if(!this.keep || this.restoredTok === S.wsTok || !this.count()) return; this.restoredTok = S.wsTok;
    this.restoring = true; let miss = 0;
    try{
      const k = await this.key(); const sl = this.man.slots;
      const pull = async slot => { const out = []; for(const e of sl[slot] || []){ try{ out.push(await this.getFile(e, k)); }catch(x){ console.warn('vault get', x); miss++; } } return out; };
      if(!D.ms && ((sl['design:ms'] || []).length || (sl['design:assets'] || []).length)){
        busy('보관한 디자인 자료를 불러오는 중…', .2); const grid = D.grid;
        const da = await pull('design:assets'); if(da.length) await takeFiles('assets', da);
        if(grid) D.grid = grid;
        busy('보관한 원고를 불러오는 중…', .5); const dm = await pull('design:ms'); if(dm.length) await takeFiles('ms', dm);
      }
      if(!S.source && !S.batches.some(b => !b.isSaved && !b.isDefault)){
        const rd = await pull('review:des'); if(rd.length) await takeDesign(rd);
        const rs = await pull('review:src'); if(rs.length) await takeSource(rs);
      }
      if(miss) this.err = `보관한 파일 ${miss}개를 찾지 못했습니다. 다시 올려 주세요.`;
    }catch(e){ console.warn('vault restore', e); this.err = '보관한 파일을 열지 못했습니다. 파티 코드가 바뀌었거나 파일이 지워졌을 수 있습니다.'; }
    this.restoring = false; busy(null); this.render(); renderDesign();
  },
  where(){ return S.ws.kind === 'party' ? `파티 「${S.ws.name}」` : '내 공간'; },
  // 짧은 안내 줄(디자인 1단계·검수 자료 올리기)
  noteHtml(){
    if(!window.claude?.use) return '';
    if(!this.tried || !S.dbTried) return '';
    if(!this.ok()) return '<span class="muted">올린 파일은 이 화면에만 있습니다(보관은 편집 권한이 있어야 합니다).</span>';
    if(this.saving) return '<span class="muted">올린 파일을 보관하는 중…</span>';
    if(this.err) return `<span style="color:var(--warn)">${esc(this.err)}</span>`;
    return this.keep ? `<span class="muted">올린 파일은 ${esc(this.where())}에 암호화해 보관해 다른 컴퓨터에서도 이어집니다.</span>` : `<span class="muted">파일 보관이 꺼져 있어 올린 파일은 이 화면에만 있습니다.</span>`;
  },
  render(){ for(const el of document.querySelectorAll('[data-vault-note]')) el.innerHTML = this.noteHtml(); if(!$('#wsPanel')?.hidden) renderWs(); },
  panelHtml(){
    if(!this.ok()) return '<p class="note">올린 파일은 이 화면에만 있습니다. 파일 보관은 이 Dana의 편집 권한이 있어야 쓸 수 있습니다.</p>';
    const n = this.count(), u = this.usage;
    const by = Object.entries(this.man?.slots || {}).filter(([, l]) => l.length).map(([s, l]) => `${SLOT_NAME[s] || s} ${l.length}`).join(' · ');
    return `<div class="wsbox"><div class="lbl">올린 파일 보관</div>
      <label class="chk"><input type="checkbox" id="vKeep" ${this.keep ? 'checked' : ''}> 올린 파일을 ${esc(this.where())}에 암호화해 보관</label>
      <p class="note">${n ? `보관 중 ${n}개(${mb(this.bytes())})${by ? ` · ${esc(by)}` : ''}` : '보관한 파일이 없습니다.'}${u ? ` · 보관함 전체 ${mb(u.bytes)} / ${mb(u.maxBytes)}` : ''}</p>
      ${this.err ? `<div class="msg warn">${esc(this.err)}</div>` : ''}
      ${n ? (this.confirmClear ? `<div class="row"><span class="note">보관한 파일 ${n}개를 지웁니다. 되돌릴 수 없습니다.</span><button type="button" id="vClearYes">지우기</button><button type="button" class="ghost" id="vClearNo">취소</button></div>` : '<button type="button" class="ghost" id="vClear">보관 파일 지우기</button>') : ''}</div>`;
  },
  bindPanel(p){
    p.querySelector('#vKeep')?.addEventListener('change', e => this.setKeep(e.target.checked));
    p.querySelector('#vClear')?.addEventListener('click', () => { this.confirmClear = true; renderWs(); });
    p.querySelector('#vClearNo')?.addEventListener('click', () => { this.confirmClear = false; renderWs(); });
    p.querySelector('#vClearYes')?.addEventListener('click', async () => { this.confirmClear = false; await this.clearAll(); });
  },
};
window.Vault = Vault;
