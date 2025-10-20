/* main.js — fixes: dimmer 3-dots, live duplicate marking, correct per-item buttons,
   stable queue order, bubble bold, smart menu positioning, unloading-only remove toggle,
   accurate status button states, adaptive time-ago updating, QI removal console,
   and NO duplicate removal logs. */
(() => {
  'use strict';

  // --- Firebase (UNLOADING project) ---
  const firebaseConfig = {
    apiKey: "AIzaSyBeQJVhgz1M_BoNoNOEv_VCfk4jfHCkvDo",
    authDomain: "unloading-90c43.firebaseapp.com",
    databaseURL: "https://unloading-90c43-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "unloading-90c43",
    storageBucket: "unloading-90c43.firebasestorage.app",
    messagingSenderId: "943213344061",
    appId: "1:943213344061:web:661d4ef207c6887fbd8154"
  };
  function ensureFirebase(){ return (typeof firebase !== 'undefined' && !!firebase?.initializeApp); }
  function initFirebase(){
    if(!ensureFirebase()) return null;
    try{
      if(firebase.apps && firebase.apps.length) return firebase.app();
      return firebase.initializeApp(firebaseConfig);
    }catch(e){ console.error('Firebase init failed', e); return null; }
  }

  // --- DOM helpers ---
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const on = (el, ev, fn) => el.addEventListener(ev, fn);
  const norm = s => (String(s||'').trim().toLowerCase());

  // --- Elements ---
  const appHeader = $('#appHeader');
  const mainPick  = $('#mainPick');
  const workspace = $('#workspace');
  const teamTitle = $('#teamTitle');
  const teamNote  = $('#teamNote');

  const skuInput = $('#skuInput');
  const addBtn   = $('#addBtn');
  const queueList= $('#queueList');
  const doneList = $('#doneList');

  const removeModeContainer = $('#removeModeContainer'); // near Add (Unloading only)
  const removeModeChk = $('#removeMode');

  const nameModal = $('#nameModal');
  const nameInput = $('#nameInput');
  const nameOk    = $('#nameOk');
  const logoutBtn = $('#logout');

  const fab = $('#qiFab');     // QI bulk actions
  const fabMain = $('#fabMain');
  const fabMenu = $('#fabMenu');
  const clearCompletedBtn = $('#clearCompleted');
  const removeAllBtn = $('#removeAll');

  const qiConsole = $('#qiConsole');
  const qiLog = $('#qiLog');

  // --- State ---
  function isCompactMobile(){ return document.body.classList.contains('mode-unloading'); }
  function formatAgoCompact(ms){
    const sec = Math.max(0, Math.floor((Date.now() - ms)/1000));
    if(sec < 1) return 'Just now';
    if(sec < 60) return sec + 's';
    const m = Math.floor(sec/60); if(m<60) return m + 'm';
    const h = Math.floor(m/60); return h + 'h';
  }

  function setBodyMode(){
    document.body.classList.toggle('mode-unloading', CURRENT_TEAM === 'UNLOADING');
    document.body.classList.toggle('mode-quality', CURRENT_TEAM === 'QUALITY');
  }

  let CURRENT_TEAM = null; // 'UNLOADING' | 'QUALITY' | null
  let CURRENT_USERNAME = localStorage.getItem('teamComm_username') || '';
  let removeMode = (localStorage.getItem('teamComm_removeMode') === '1'); // Unloading toggle

  // in-memory snapshot (key -> item)
  const items = Object.create(null);

  // Suppress duplicate "Unknown removed" when we already logged the removal locally
  const recentLogBySku = new Map();
  function markLogged(sku) {
    if (!sku) return;
    const k = String(sku);
    recentLogBySku.set(k, Date.now());
    setTimeout(() => recentLogBySku.delete(k), 10000); // expire after 10s
  }
  function wasLoggedRecently(sku, ms = 8000) {
    const t = recentLogBySku.get(String(sku));
    return !!t && (Date.now() - t) < ms;
  }

  // --- Age + colors ---
  function ageClass(ts){
    if(!ts) return 'age-now';
    const m = (Date.now() - ts) / 60000;
    if (m < 10) return 'age-now';       // green
    if (m < 20) return 'age-recent';    // orange
    if (m < 30) return 'age-mid';       // dark orange
    return 'age-stale';                 // gray
  }
  function formatAgo(ts){
    if(!ts) return 'Just now';
    const s = Math.floor((Date.now()-ts)/1000);
    if (s < 60) return 'Just now';
    const m = Math.floor(s/60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m/60);
    const mm = m%60;
    if (h < 24) return `${h}h ${mm? mm+'m ' : ''}ago`;
    const d = Math.floor(h/24);
    const hh = h%24;
    return `${d}d ${hh? hh+'h ' : ''}ago`;
  }

  // Adaptive refresh cadence: 0–1m:5s, 1–30m:60s, 30–40m:5m, 40–60m:10m, 60m+:60m
  let ageTimer = null;
  
function scheduleAges(){
    if(ageTimer) clearTimeout(ageTimer);
    refreshAges();
    const now = Date.now();
    const arr = Object.values(items);
    if(arr.length === 0){ ageTimer = setTimeout(scheduleAges, 60*1000); return; }
    let nextSec = 60;
    for(const it of arr){
      const t = it.updatedAt || it.createdAt || now;
      const m = (now - t) / 60000;
      if(m < 1) nextSec = Math.min(nextSec, 1);
      if(m < 7){
        const to7 = Math.max(1, Math.ceil((7 - m) * 60));
        nextSec = Math.min(nextSec, to7);
      }else if(m < 30) nextSec = Math.min(nextSec, 60);
      else if(m < 40) nextSec = Math.min(nextSec, 300);
      else if(m < 60) nextSec = Math.min(nextSec, 600);
      else nextSec = Math.min(nextSec, 3600);
    }
    ageTimer = setTimeout(scheduleAges, Math.max(1, nextSec) * 1000);
}
function refreshAges(){
    // Ready list
    $$('#doneList li.item').forEach(li => {
      const it = items[li.dataset.key]; if(!it) return;
      const t = it.updatedAt || it.createdAt || 0;
      const ageEl = li.querySelector('.age-text');
      if(ageEl){
        const name = it.updatedBy ? it.updatedBy : (it.teamAdded || '');
        ageEl.textContent = isCompactMobile() ? formatAgoCompact(t) : ((name ? (name + ' · ') : '') + formatAgo(t));
        ageEl.className = 'age-text ' + ageClass(t);
      }
      const min = (Date.now()-t)/60000;
      li.classList.toggle('faded-old', min >= 30);
      li.classList.toggle('recent-ready', min < 7);
    });
    // Queue (no fade)
    $$('#queueList li.item').forEach(li => {
      const it = items[li.dataset.key]; if(!it) return;
      const t = it.updatedAt || it.createdAt || 0;
      const ageEl = li.querySelector('.age-text');
      if(ageEl){
        const name = it.updatedBy ? it.updatedBy : (it.teamAdded || '');
        ageEl.textContent = isCompactMobile() ? formatAgoCompact(t) : ((name ? (name + ' · ') : '') + formatAgo(t));
        ageEl.className = 'age-text ' + ageClass(t);
      }
      li.classList.remove('faded-old');
    });
  }

  // --- Visual helpers ---
  function bubbleClassFor(status){
    const s = norm(status || 'New');
    if (s === 'ready') return 'ready';
    if (s.includes('progress')) return 'inprogress';
    if (s.includes('hold')) return 'onhold';
    return 'new';
  }
  function fitBubble(b){
    if(!b) return;
    const maxW = b.clientWidth - 14;
    const txt = (b.textContent || '').toString();
    if(!txt) return;
    const fw = getComputedStyle(b).fontWeight || '900';
    let fs = Math.min(36, Math.floor(b.clientHeight * 0.72));
    const span = document.createElement('span');
    span.style.cssText='visibility:hidden;position:absolute;white-space:nowrap;font-weight:'+fw;
    document.body.appendChild(span);
    while(fs >= 12){
      span.style.fontSize = fs + 'px';
      span.textContent = txt;
      if(span.offsetWidth <= maxW) break;
      fs--;
    }
    b.style.fontSize = fs + 'px';
    b.style.lineHeight = '1';
    span.remove();
  }

  // --- Firebase DB ---
  const app = initFirebase();
  if(!app){ console.error('Firebase SDK failed to load.'); return; }
  const db = firebase.database();
  const itemsRef = db.ref('items');
  const logsRef  = db.ref('logs/removals');

  // --- Duplicate computation (live, no DB writes needed) ---
  
function recomputeDuplicateFlags(){
  // Reset
  for(const v of Object.values(items)){ if(v) v._dup = false; }
  // Group by SKU
  const groups = new Map();
  for(const [id,v] of Object.entries(items)){
    const key = String(v?.sku ?? '').trim();
    if(!key) continue;
    if(!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ id, t:(v.updatedAt || v.createdAt || 0) });
  }
  // Mark only newest in each group
  for(const arr of groups.values()){
    if(arr.length <= 1) continue;
    arr.sort((a,b)=>a.t-b.t);
    const newest = arr[arr.length-1];
    if(items[newest.id]) items[newest.id]._dup = true;
  }
  // Reflect in DOM
  for(const id of Object.keys(items)){
    const li = document.querySelector(`li.item[data-key="${id}"]`);
    if(!li) continue;
    const flag = !!(items[id] && items[id]._dup);
    li.classList.toggle('dup', flag);
    const existing = li.querySelector('.badge');
    if(flag){ if(!existing){ const b=document.createElement('div'); b.className='badge'; b.textContent='Duplicate'; li.appendChild(b);} }
    else if(existing){ existing.remove(); }
  }
}

// --- Rendering ---

  function createLI(key, it){
    const li = document.createElement('li');
    li.className = 'item';
    li.dataset.key = key;

    const left = document.createElement('div'); left.className = 'left';
    const bubble = document.createElement('div'); bubble.className = 'bubble ' + bubbleClassFor(it.status); bubble.textContent = it.sku;
    left.appendChild(bubble);

    const meta = document.createElement('div'); meta.className = 'meta';
    const statusText = document.createElement('div'); statusText.className = 'status-text';
    const ageLine = document.createElement('div'); ageLine.className = 'age-text';
    meta.appendChild(statusText); meta.appendChild(ageLine);
    left.appendChild(meta);

    const controls = document.createElement('div'); controls.className = 'controls';

    li.appendChild(left); li.appendChild(controls);

    updateLI(li, it);
    attachControls(li, key, it);
    requestAnimationFrame(()=> fitBubble(bubble));
    return li;
  }
  function updateLI(li, it){
    const bubble = li.querySelector('.bubble');
    const statusText = li.querySelector('.status-text');
    const ageLine = li.querySelector('.age-text');

    if(bubble){ bubble.textContent = it.sku; bubble.className = 'bubble ' + bubbleClassFor(it.status); fitBubble(bubble); }

    // New SKUs: ONLY bubble number until first change
    const showStatus = (norm(it.status) !== 'new');
    if(statusText){
      statusText.textContent = showStatus ? (it.status || '') : '';
      statusText.style.display = showStatus ? '' : 'none';
    }

    if(ageLine){
      const t = it.updatedAt || it.createdAt || 0;
      const name = it.updatedBy ? it.updatedBy : (it.teamAdded || '');
      ageLine.textContent = isCompactMobile() ? formatAgoCompact(t) : ((name ? (name + ' · ') : '') + formatAgo(t));
      ageLine.className = 'age-text ' + ageClass(t);
    }
  }

  // Queue order fixed by createdAt; when missing, fall back to updatedAt
  function insertQueue(li, it){
    const ts = it.createdAt || it.updatedAt || 0;
    const nodes = Array.from(queueList.children);
    const idx = nodes.findIndex(n=>{
      const x = items[n.dataset.key] || {};
      return ts >= (x.createdAt || x.updatedAt || 0);
    });
    if(idx === -1) queueList.appendChild(li); else queueList.insertBefore(li, nodes[idx]);
  }
  function insertDone(li, it){
    const ts = it.updatedAt || it.createdAt || 0;
    const nodes = Array.from(doneList.children);
    const idx = nodes.findIndex(n=>{
      const x = items[n.dataset.key] || {};
      return ts >= (x.updatedAt || x.createdAt || 0);
    });
    if(idx === -1) doneList.appendChild(li); else doneList.insertBefore(li, nodes[idx]);
  }

  function upsertRow(key){
    const it = items[key]; if(!it) return;
    const isReady = (norm(it.status) === 'ready');
    const parent = isReady ? doneList : queueList;

    let li = document.querySelector(`li.item[data-key="${key}"]`);
    if(!li) li = createLI(key, it); else {
      updateLI(li, it);
      attachControls(li, key, it); // ensure per-item buttons reflect current status
    }

    if(li.parentElement !== parent){
      if(parent === queueList) insertQueue(li, it);
      else insertDone(li, it);
    } else {
      // keep queue order stable; re-sort Done only
      if(parent === doneList){ parent.removeChild(li); insertDone(li, it); }
    }

    // live duplicate indicator
    li.classList.toggle('dup', !!it._dup);
    const existing = li.querySelector('.badge');
    if(it._dup){
      if(!existing){ const b = document.createElement('div'); b.className='badge'; b.textContent='Duplicate'; li.appendChild(b); }
    }else if(existing){ existing.remove(); }
  }

  function removeRow(key){
    const el = document.querySelector(`li.item[data-key="${key}"]`);
    if(el && el.parentElement) el.parentElement.removeChild(el);
    delete items[key];
  }

  function rerenderAll(){
    queueList.innerHTML=''; doneList.innerHTML='';
    const keys = Object.keys(items);
    const q = keys.filter(k => (norm(items[k].status) !== 'ready'))
                  .sort((a,b)=>( (items[b].createdAt||items[b].updatedAt||0) - (items[a].createdAt||items[a].updatedAt||0) ));
    const d = keys.filter(k => (norm(items[k].status) === 'ready'))
                  .sort((a,b)=>( (items[b].updatedAt||items[b].createdAt||0) - (items[a].updatedAt||items[a].createdAt||0) ));
    q.forEach(k=> insertQueue(createLI(k, items[k]), items[k]));
    d.forEach(k=> insertDone(createLI(k, items[k]), items[k]));
    recomputeDuplicateFlags(); // duplicates visible after login
    refreshAges();
    scheduleAges();
  }

  // --- Controls ---
  function attachControls(li, key, it){
    const controls = li.querySelector('.controls');
    controls.innerHTML = '';

    const curStatus = norm(it.status || 'New');
    const isReady = (curStatus === 'ready');

    if(CURRENT_TEAM === 'UNLOADING'){
      // Only X (remove) — enabled when the global toggle is ON
      const x = document.createElement('button');
      x.className = 'remove-x'; x.title = 'Remove';
      x.textContent = '×';
      if(!removeMode) x.setAttribute('disabled','');
      on(x, 'click', async ()=>{
        if(!removeMode) return;
        const skuText = items[key]?.sku;
        try{
          await logsRef.push({ sku: skuText, by: 'Unloading', at: Date.now() });
          markLogged(skuText);
          await itemsRef.child(key).remove();
        }catch(e){ console.error(e); }
      });
      controls.appendChild(x);
      return;
    }

    // QUALITY:
    if(!isReady){
      const btn = document.createElement('button');
      btn.className = 'status-btn';
      const cs = curStatus;
      if(cs.includes('progress')) { btn.textContent='Ready'; btn.style.background='var(--success)'; }
      else { btn.textContent='In Progress'; btn.style.background='var(--accent-2)'; }
      on(btn, 'click', async ()=>{
        let next = 'In progress';
        if(norm(items[key]?.status || curStatus).includes('progress')) next = 'Ready';
        const now = Date.now();
        const by = CURRENT_USERNAME || 'QUALITY';
        items[key] = { ...(items[key]||{}), status: next, updatedAt: now, updatedBy: by };
        upsertRow(key);
        try{ await itemsRef.child(key).update({ status: next, updatedAt: now, updatedBy: by }); }
        catch(e){ console.error(e); }
      });
      controls.appendChild(btn);
    }

    // subtle 3-dots (dim) menu for QI only
    controls.appendChild(createMoreMenu(key, true));
  }

  function createMoreMenu(key, allowRemove){
    const wrap = document.createElement('div');
    wrap.style.display = 'inline-block';
    const btn = document.createElement('button'); btn.className='more-btn'; btn.textContent='⋯'; btn.title='More';
    wrap.appendChild(btn);

    let menu = null;
    function closeMenu(){
      if(menu && menu.parentElement) menu.parentElement.removeChild(menu);
      menu = null;
      document.removeEventListener('click', outsideListener, true);
      window.removeEventListener('resize', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
    }
    function outsideListener(ev){
      if(menu && !menu.contains(ev.target) && !btn.contains(ev.target)) closeMenu();
    }
    function mkItem(label, cb){
      const it = document.createElement('button');
      it.textContent = label;
      it.className = 'menu-item';
      it.addEventListener('click', ()=>{ cb(); closeMenu(); });
      return it;
    }
    function openMenu(){
      closeMenu();
      menu = document.createElement('div');
      menu.className = 'menu';
      document.body.appendChild(menu);

      // Build items
      const setStatus = async (next)=>{
        const now = Date.now();
        const by = CURRENT_USERNAME || 'QUALITY';
        items[key] = { ...(items[key]||{}), status: next, updatedAt: now, updatedBy: by };
        upsertRow(key);
        try{ await itemsRef.child(key).update({ status: next, updatedAt: now, updatedBy: by }); }
        catch(e){ console.error(e); }
      };

      menu.appendChild(mkItem('Set In Progress', ()=> setStatus('In progress')));
      menu.appendChild(mkItem('Set On Hold', ()=> setStatus('On Hold')));
      menu.appendChild(mkItem('Set New', ()=> setStatus('New')));
      menu.appendChild(mkItem('Mark Ready', ()=> setStatus('Ready')));
      if(allowRemove){
        menu.appendChild(mkItem('Remove SKU', async ()=> {
          const skuText = items[key]?.sku;
          try{
            await logsRef.push({ sku: skuText, by: 'QUALITY', at: Date.now() });
            markLogged(skuText);
            await itemsRef.child(key).remove();
          }catch(e){ console.error(e); }
        }));
      }

      // Position (flip up if near bottom)
      const r = btn.getBoundingClientRect();
      const menuW = Math.min(menu.offsetWidth || 220, 320);
      let left = Math.min(Math.max(8, r.left), Math.max(8, window.innerWidth - menuW - 12));
      requestAnimationFrame(()=>{
        const h = menu.offsetHeight || 200;
        let top = r.bottom + 8;
        if(top + h + 8 > window.innerHeight){ top = Math.max(8, r.top - h - 8); }
        Object.assign(menu.style, { left: left + 'px', top: top + 'px', width: menuW + 'px' });
        menu.classList.add('open');
      });

      setTimeout(()=>{
        document.addEventListener('click', outsideListener, true);
        window.addEventListener('resize', closeMenu);
        window.addEventListener('scroll', closeMenu, true);
      }, 0);
    }
    on(btn, 'click', (e)=>{ e.stopPropagation(); if(menu) closeMenu(); else openMenu(); });
    return wrap;
  }

  // --- Actions ---
  on(addBtn, 'click', async ()=>{
    if(!CURRENT_TEAM) { alert('Select role first'); return; }
    const sku = (skuInput.value || '').trim();
    if(!sku) return;
    if(!/^\d{1,4}$/.test(sku)) { alert('Enter 1 to 4 digits only'); skuInput.focus(); return; }

    // Add immediately; duplicate marking computed live
    const nr = itemsRef.push();
    const now = Date.now();
    const by = (CURRENT_TEAM === 'QUALITY' && CURRENT_USERNAME) ? CURRENT_USERNAME : 'Unloading';
    items[nr.key] = { sku, status:'New', createdAt: now, updatedAt: now, teamAdded: CURRENT_TEAM, updatedBy: by };
    upsertRow(nr.key);
    recomputeDuplicateFlags();
    try{ await nr.set(items[nr.key]); }
    catch(e){ console.error(e); removeRow(nr.key); }
    skuInput.value=''; skuInput.focus();
  });
  on(skuInput, 'keypress', e=>{ if(e.key==='Enter') addBtn.click(); });
  on(skuInput, 'input', e=>{
    const v = e.target.value || '';
    const filtered = v.replace(/\D/g, '').slice(0,4);
    if(filtered !== v) e.target.value = filtered;
  });
  on(skuInput, 'paste', e=>{
    const paste = (e.clipboardData || window.clipboardData).getData('text') || '';
    const filtered = (paste || '').replace(/\D/g, '').slice(0,4);
    e.preventDefault();
    document.execCommand('insertText', false, filtered);
  });

  // QI FAB (bulk)
  on(fabMain, 'click', ()=>{
    fab.classList.toggle('open');
    const open = fab.classList.contains('open');
    fabMenu.setAttribute('aria-hidden', String(!open));
  });
  on(clearCompletedBtn, 'click', async ()=>{
    if(CURRENT_TEAM !== 'QUALITY') return;
    const snap = await itemsRef.once('value'); const all = snap.val() || {};
    const del = Object.keys(all).filter(k => (norm(all[k].status) === 'ready'));
    // optimistic UI + logs
    for(const k of del){
      const skuText = all[k]?.sku;
      try {
        await logsRef.push({ sku: skuText, by: 'QUALITY', at: Date.now() });
        markLogged(skuText);
      } catch {}
      removeRow(k);
    }
    try{ await Promise.all(del.map(k => itemsRef.child(k).remove())); } catch(e){ console.error(e); }
    recomputeDuplicateFlags();
  });
  on(removeAllBtn, 'click', async ()=>{
    if(CURRENT_TEAM !== 'QUALITY') return;
    const snap = await itemsRef.once('value'); const all = snap.val() || {};
    for(const [k,v] of Object.entries(all)){
      try {
        await logsRef.push({ sku: v?.sku, by:'QUALITY', at: Date.now() });
        markLogged(v?.sku);
      } catch {}
    }
    Object.keys(items).forEach(removeRow);
    try{ await itemsRef.set(null); }catch(e){ console.error(e); }
  });

  // --- Role entry ---
  on($('#enterUnloading'), 'click', ()=>{
    CURRENT_TEAM = 'UNLOADING';
    setBodyMode();
    appHeader.style.display='none';
    mainPick.style.display='none'; workspace.style.display='flex';
    workspace.removeAttribute('aria-hidden');
    teamTitle.textContent='Unloading';
    teamNote.textContent='';
    removeModeContainer.hidden = false;
    removeModeChk.checked = removeMode;
    fab.hidden = true;
    qiConsole.hidden = true;
    rerenderAll();
  });

  on($('#enterQuality'), 'click', ()=>{
    nameModal.setAttribute('aria-hidden','false');
  });
  on(nameOk, 'click', ()=>{
    const n = (nameInput.value || '').trim();
    if(!n){ alert('Enter a name'); nameInput.focus(); return; }
    CURRENT_USERNAME = n;
    localStorage.setItem('teamComm_username', n);
    nameModal.setAttribute('aria-hidden','true');

    CURRENT_TEAM = 'QUALITY';
    setBodyMode();
    appHeader.style.display='none';
    mainPick.style.display='none'; workspace.style.display='flex';
    workspace.removeAttribute('aria-hidden');
    teamTitle.textContent='Quality Inspection';
    teamNote.textContent='';
    removeModeContainer.hidden = true; // unloading-only
    fab.hidden = false;
    qiConsole.hidden = false;
    rerenderAll();
  });
  on(nameInput, 'keypress', e=>{ if(e.key==='Enter') nameOk.click(); });

  on(removeModeChk, 'change', ()=>{
    removeMode = removeModeChk.checked;
    localStorage.setItem('teamComm_removeMode', removeMode ? '1' : '0');
    // refresh X enable state
    $$('#queueList li.item, #doneList li.item').forEach(li => {
      const k = li.dataset.key; const it = items[k];
      if(it) attachControls(li, k, it);
    });
  });

  on(logoutBtn, 'click', ()=>{
    CURRENT_TEAM = null;
    setBodyMode();
    CURRENT_USERNAME = '';
    localStorage.removeItem('teamComm_username');
    workspace.style.display='none'; mainPick.style.display='block';
    appHeader.style.display='flex';
    queueList.innerHTML=''; doneList.innerHTML='';
  });

  // --- Live listeners ---
  itemsRef.on('child_added', snap => {
    items[snap.key] = snap.val() || {};
    upsertRow(snap.key);
    recomputeDuplicateFlags();
    scheduleAges();
  });
  itemsRef.on('child_changed', snap => {
    items[snap.key] = snap.val() || {};
    upsertRow(snap.key);
    recomputeDuplicateFlags();
    scheduleAges();
  });
  itemsRef.on('child_removed', snap => {
    const removed = snap.val();
    const skuText = removed?.sku;
    // Only show "Unknown" if we didn't just log this removal ourselves
    if (CURRENT_TEAM === 'QUALITY' && skuText && !wasLoggedRecently(skuText)) {
      appendLog({ sku: skuText, by: 'Unknown', at: Date.now() });
    }
    removeRow(snap.key);
    recomputeDuplicateFlags();
    scheduleAges();
  });


  // Prune logs older than 2 hours (runs every 10 minutes)
  function pruneOldLogs(){
    const cutoff = Date.now() - 2*60*60*1000;
    logsRef.orderByChild('at').endAt(cutoff).limitToLast(200).once('value', snap => {
      snap.forEach(child => { try{ child.ref.remove(); }catch(e){} });
    });
  }
  pruneOldLogs();
  setInterval(pruneOldLogs, 10*60*1000);

  // QI console: stream logs of removals
  logsRef.limitToLast(50).on('child_added', s => {
    const v = s.val() || {};
    appendLog(v);
  });
  function appendLog({sku, by, at}){
    if(!qiLog) return;
    const li = document.createElement('li');
    const when = at ? formatAgo(at) : '';
    li.textContent = `${by || 'Unknown'} removed ${sku || '?'} · ${when}`;
    qiLog.appendChild(li);
    while(qiLog.children.length > 12) qiLog.removeChild(qiLog.firstChild);
  }

})();
