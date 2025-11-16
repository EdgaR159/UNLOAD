
function showToast(text, type){
  let host=document.getElementById('toastHost');
  if(!host){ host=document.createElement('div'); host.id='toastHost'; host.className='toast-host'; document.body.appendChild(host); }
  const t=document.createElement('div');
  t.className='toast'+(type?' '+type:'');
  t.textContent=text;
  host.appendChild(t);
  setTimeout(()=>{ t.style.opacity='0'; setTimeout(()=>t.remove(),250); }, 2500);
}
/* BUILD_VERSION_STAMP */
console.log('[BUILD]', 'QI-UNLOADING v2 • 2025-11-14 20:49:36 CET');
/* main.js – Unloading / QI
   - Uses local Firebase compat SDKs (firebase-app-compat.js, firebase-database-compat.js)
   - Sticky top input only
   - Strict numeric input (hot-fix) for SKU field
   - Unloading: toggleable remove (X), can only remove from Queue
   - QI: hover X on bubble to remove; status buttons update immediately
   - QI console: 3 rows, newest at bottom, auto-prune > 1h
   - Ready highlight: 7 min thin border; age text turns gray after 30 min
*/

(() => {
  'use strict';

  // ----- Firebase (local compat) -----
  const firebaseConfig = {
    apiKey: "AIzaSyBeQJVhgz1M_BoNoNOEv_VCfk4jfHCkvDo",
    authDomain: "unloading-90c43.firebaseapp.com",
    databaseURL: "https://unloading-90c43-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "unloading-90c43",
    storageBucket: "unloading-90c43.firebasestorage.app",
    messagingSenderId: "943213344061",
    appId: "1:943213344061:web:661d4ef207c6887fbd8154"
  };

  if (!window.firebase) {
    alert('Local Firebase SDK files not found. Place firebase-app-compat.js and firebase-database-compat.js next to index.html.');
    return;
  }
  firebase.initializeApp(firebaseConfig);

  const db = firebase.database(undefined, {
    experimentalForceLongPolling: true,
    experimentalAutoDetectLongPolling: false,
  });

  // ----- Team Chat (Teams only: UNLOADING / QI) -----
  (function teamChatModule(){
    const CHAT_PATH = window.CHAT_PATH || 'chat/messages';

    function getTeam() {
      if (window.UNL_ONLY) return 'UNLOADING';
      if (window.QI_ONLY)  return 'QI';
      if (typeof TEAM === 'string' && TEAM && TEAM.trim()) return TEAM;
      return 'UNKNOWN';
    }

    function teamLabel(team) {
      if (team === 'QI') return '💻';
      if (team === 'UNLOADING') return '🗿';
      return '❔';
    }

    document.addEventListener('DOMContentLoaded', function(){
      const qs = (id) => document.getElementById(id);
      const bubble   = qs('chatBubble');
      const win      = qs('chatWindow');
      const closeBtn = qs('chatClose');
      const form     = qs('chatForm');
      const input    = qs('chatInput');
      const msgs     = qs('chatMessages');

      if (!bubble || !win || !form || !input || !msgs) {
        console.warn('Chat: missing DOM elements');
        return;
      }

      function openChat() {
        win.classList.add('visible');
        win.setAttribute('aria-hidden', 'false');
        try { input.focus(); } catch (e) {}
        msgs.scrollTop = msgs.scrollHeight;
      }

      function closeChat() {
        win.classList.remove('visible');
        win.setAttribute('aria-hidden', 'true');
      }

      bubble.onclick = () => {
        if (win.classList.contains('visible')) closeChat();
        else openChat();
      };
      if (closeBtn) closeBtn.onclick = () => closeChat();

      let chatRef = null;
      try {
        chatRef = db.ref(CHAT_PATH);
      } catch (e) {
        console.error('Chat: failed to init Firebase ref', e);
      }

      if (!chatRef) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          if (typeof showToast === 'function') {
            showToast('Chat unavailable.', 'error');
          }
        });
        return;
      }

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = (input.value || '').trim();
        if (!text) return;
        const payload = {
          user: getTeam(),
          text: text,
          ts: Date.now()
        };
        chatRef.push(payload).catch((err) => {
          console.error('Chat: send failed', err);
          if (typeof showToast === 'function') {
            showToast('Failed to send chat message.', 'error');
          }
        });
        input.value = '';
      });


      function appendMessage(msg) {
        const team = msg.user || 'UNKNOWN';
        const me = (team === getTeam());

        const bubble = document.createElement('div');
        bubble.className = 'msg' + (me ? ' me' : '');

        const line = document.createElement('span');
        const teamSpan = document.createElement('span');
        teamSpan.className = 'username';
        teamSpan.textContent = teamLabel(team) + ' ';

        const textNode = document.createTextNode(msg.text || '');
        line.appendChild(teamSpan);
        line.appendChild(textNode);

        bubble.appendChild(line);

        const dt = new Date(msg.ts || Date.now());
        const timeDiv = document.createElement('div');
        timeDiv.className = 'msg-time' + (me ? ' me' : '');
        timeDiv.textContent = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        msgs.appendChild(bubble);
        msgs.appendChild(timeDiv);
        msgs.scrollTop = msgs.scrollHeight;
      }


      // Stream + trim (>8h) on the fly
      chatRef.on('child_added', (snap) => {
        const val = snap.val() || {};
        const ts = val.ts || Date.now();
        const eightHours = 8 * 60 * 60 * 1000;
        if (Date.now() - ts > eightHours) {
          try { snap.ref.remove(); } catch (e) {}
          return;
        }
        appendMessage(val);
      }, (err) => {
        console.error('Chat: listener error', err);
      });

      // Periodic cleanup: delete all messages older than 8h
      setInterval(() => {
        const cutoff = Date.now() - 8 * 60 * 60 * 1000;
        chatRef.orderByChild('ts').endAt(cutoff).once('value', (snap) => {
          snap.forEach(child => {
            try { child.ref.remove(); } catch (e) {}
          });
        });
      }, 60 * 60 * 1000);
    });
  })();
;
;
;





  // ----- DOM helpers -----
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  // Shell
  const siteHeader = $('#siteHeader');
  const rolePick   = $('#rolePick');
  const appEl      = $('#app');
  const teamTitle  = $('#teamTitle');
  const teamNote   = $('#teamNote');
  const netBanner  = $('#netBanner');

  // Role picker
  const enterUnloading = $('#enterUnloading');
  const enterQuality   = $('#enterQuality');
  const nameDlg   = $('#nameDlg');
  const nameOk    = $('#nameOk');
  const nameInput = $('#nameInput');

  // Lists
  const queueList = $('#queueList');
  const doneList  = $('#doneList');

  // QI console
  const qiConsole = $('#qiConsole');
  const qiLogList = $('#qiLogList');

  // Sticky add bar (both teams)
  const skuInputCenter      = $('#skuInputCenter');
  const toggleRemoveCenter  = $('#toggleRemoveCenter');
  const addBtnCenter        = $('#addBtnCenter');

  // QI top action buttons
  const btnRemoveAll   = $('#btnRemoveAll');
  const btnRemoveReady = $('#btnRemoveReady');

  // SKU plan DOM (QI only)
  const skuPlanInput  = $('#skuPlanInput');
  const skuPlanLoad   = $('#skuPlanLoad');
  const skuPlanClear  = $('#skuPlanClear');
  const skuPlanListEl = $('#skuPlanList');
  const skuPlanCount  = $('#skuPlanCount');
  const skuPlanPanel  = document.querySelector('.sku-plan-panel');

  // ----- State -----
  let TEAM = null; // 'UNLOADING' | 'QUALITY'
  let USER = localStorage.getItem('tc_user') || '';
  let removeMode = localStorage.getItem('tc_remove') === '1';
  let skuPlan = [];

  const itemsRef = db.ref('items');
  const logsRef  = db.ref('logs/removals'); // QI console
  const items    = {}; // key -> object

  // ----- Utils -----
  const norm = s => String(s || '').trim().toLowerCase();
  const now  = () => Date.now();
  const who  = it => it.updatedBy || it.teamAdded || '';

  function updateSkuPlanCount() {
    if (!skuPlanCount) return;
    if (!skuPlan || !skuPlan.length) {
      skuPlanCount.textContent = 'No SKUs loaded';
    } else {
      skuPlanCount.textContent = skuPlan.length + ' SKUs';
    }
  }

  function renderSkuPlan() {
    if (!skuPlanListEl) return;
    skuPlanListEl.innerHTML = '';
    (skuPlan || []).forEach((item, idx) => {
      const li = document.createElement('li');
      const status = item.status || 'unmatched';
      li.className = 'sku-plan-item ' + status;
      li.dataset.idx = String(idx + 1);

      const idxSpan = document.createElement('span');
      idxSpan.className = 'sku-plan-idx';
      idxSpan.textContent = String(idx + 1).padStart(2, '0');

      const skuSpan = document.createElement('span');
      skuSpan.className = 'sku-plan-sku';
      skuSpan.textContent = String(item.sku || '');

      const dot = document.createElement('span');
      dot.className = 'sku-plan-status-dot';

      li.appendChild(idxSpan);
      li.appendChild(skuSpan);
      li.appendChild(dot);

      skuPlanListEl.appendChild(li);
    });
    updateSkuPlanCount();
  }

  function resetSkuPlan(raw) {
    const text = String(raw || '');
    const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    skuPlan = lines.map(sku => ({ sku, status: 'unmatched' }));
    recalcSkuPlanFromItems();
  }

  function clearSkuPlan() {
    skuPlan = [];
    if (skuPlanInput) skuPlanInput.value = '';
    renderSkuPlan();
  }

  function itemMatchesSkuPlan(it) {
    if (!skuPlan || !skuPlan.length) return false;
    const raw = String(it && it.sku ? it.sku : '');
    const digits = raw.replace(/\D/g, '');
    if (!digits) return false;
    const n = parseInt(digits, 10);
    for (let idx = 0; idx < skuPlan.length; idx++) {
      const entry = skuPlan[idx];
      if (!entry) continue;
      const full = String(entry.sku || '');
      const d = full.replace(/\D/g, '');
      if (!d) continue;
      const last4 = d.slice(-4);
      const listIndex = idx + 1;
      const matchIndex  = Number.isFinite(n) && n === listIndex;
      const matchSuffix = last4 && digits === last4;
      if (matchIndex || matchSuffix) return true;
    }
    return false;
  }

  function recalcSkuPlanFromItems() {
    if (!skuPlan || !skuPlan.length) {
      renderSkuPlan();
      return;
    }
    const all = Object.values(items || {});
    skuPlan.forEach((entry, idx) => {
      const full = String(entry.sku || '');
      const digits = full.replace(/\D/g, '');
      const last4 = digits.slice(-4);
      const listIndex = idx + 1;
      let state = 'unmatched';
      if (all.length) {
        for (let i = 0; i < all.length; i++) {
          const it = all[i];
          if (!it) continue;
          const raw = String(it.sku || '');
          const dbDigits = raw.replace(/\D/g, '');
          if (!dbDigits) continue;
          const n = parseInt(dbDigits, 10);
          const matchIndex  = Number.isFinite(listIndex) && n === listIndex;
          const matchSuffix = last4 && dbDigits === last4;
          if (!(matchIndex || matchSuffix)) continue;
          if (norm(it.status) === 'ready') {
            state = 'done';
            break;
          }
        }
      }
      entry.status = state;
    });
    renderSkuPlan();
  }

  function bubbleClass(status) {
    const s = norm(status || 'new');
    if (s === 'ready') return 'ready';
    if (s.includes('progress')) return 'inprogress';
    if (s.includes('hold')) return 'onhold';
    return 'new';
  }

  function fmtAgo(ts) {
    if (!ts) return 'Just now';
    const d = Math.floor((Date.now() - ts) / 1000);
    if (d < 60) return 'Just now';
    const m = Math.floor(d / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60), mm = m % 60;
    if (h < 24) return `${h}h${mm ? ' ' + mm + 'm' : ''} ago`;
    const dd = Math.floor(h / 24), hh = h % 24;
    return `${dd}d${hh ? ' ' + hh + 'h' : ''} ago`;
  }

  // Age updater (dynamic cadence)
  let ageTimer = null;
  function scheduleAges() {
    if (ageTimer) clearTimeout(ageTimer);
    refreshAges();
    let nxt = 60;
    for (const it of Object.values(items)) {
      const t = it.updatedAt || it.createdAt || 0;
      const m = (Date.now() - t) / 60000;
      if (m < 1) nxt = Math.min(nxt, 1);
      else if (m < 30) nxt = Math.min(nxt, 60);
      else nxt = Math.min(nxt, 300);
    }
    ageTimer = setTimeout(scheduleAges, Math.max(1, nxt) * 1000);
  }
  function refreshAges() {
    $$('#queueList li.item, #doneList li.item').forEach(li => {
      const it = items[li.dataset.key];
      if (!it) return;
      const t = it.updatedAt || it.createdAt || 0;
      const age = li.querySelector('.age');
      if (age) {
        const n = who(it);
        age.textContent = (n ? n + ' · ' : '') + fmtAgo(t);
        age.classList.toggle('stale', (Date.now() - t) / 60000 >= 30);
      }
      // highlight Ready for 7 minutes
      if (norm(it.status) === 'ready') {
        li.classList.toggle('recent-ready', (Date.now() - t) / 60000 < 7);
      } else {
        li.classList.remove('recent-ready');
      }
    });
  }

  // Only newest duplicate gets a badge
  function markDuplicates() {
    const map = new Map(); // sku -> [keys]
    Object.entries(items).forEach(([k, v]) => {
      const s = (v.sku || '').trim();
      if (!s) return;
      if (!map.has(s)) map.set(s, []);
      map.get(s).push(k);
    });
    $$('.badge').forEach(b => b.parentElement.classList.remove('dup'));
    for (const arr of map.values()) {
      if (arr.length <= 1) continue;
      arr.sort((a, b) => (items[b].createdAt || 0) - (items[a].createdAt || 0));
      const newest = arr[0];
      const li = document.querySelector(`li.item[data-key="${newest}"]`);
      if (li) {
        li.classList.add('dup');
        if (!li.querySelector('.badge')) {
          const badge = document.createElement('div');
          badge.className = 'badge';
          badge.textContent = 'Duplicate';
          li.appendChild(badge);
        }
      }
    }
  }

  function fitBubble(el) {
    const maxW = el.clientWidth - 12, maxH = el.clientHeight - 12;
    let fs = Math.min(36, Math.floor(maxH * 0.66));
    const tmp = document.createElement('span');
    tmp.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font-weight:900';
    document.body.appendChild(tmp);
    const text = el.textContent || '';
    while (fs >= 12) {
      tmp.style.fontSize = fs + 'px';
      tmp.textContent = text;
      if (tmp.offsetWidth <= maxW) break;
      fs--;
    }
    document.body.removeChild(tmp);
    el.style.fontSize = fs + 'px';
  }

  // ----- Rendering -----
  function liFor(key, it) {
    const li = document.createElement('li');
    li.className = 'item';
    li.dataset.key = key;

    const left = document.createElement('div');
    left.className = 'left';

    const wrap = document.createElement('div');
    wrap.className = 'bubble-wrap';
    const bubble = document.createElement('div');
    const raw = String(it.sku || '');
    const isShort = raw.length > 0 && raw.length <= 3;
    bubble.className = 'bubble ' + bubbleClass(it.status) + (isShort ? ' bubble-circle' : ' bubble-long');
    bubble.textContent = raw;
    wrap.appendChild(bubble);

    // QI hover "X" remove
    if (TEAM === 'QUALITY') {
      const hx = document.createElement('button');
      hx.className = 'hover-x';
      hx.textContent = '×';
      hx.title = 'Remove';
      hx.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await logsRef.push({ sku: it.sku, by: USER || 'QUALITY', at: now() });
          await itemsRef.child(key).remove();
        } catch (err) { console.error(err); }
      });
      wrap.appendChild(hx);
    }

    left.appendChild(wrap);

    const meta = document.createElement('div');
    meta.className = 'meta';
    const st = document.createElement('div');
    st.className = 'status';
    st.textContent = norm(it.status) === 'new' ? '' : (it.status || '');
    const age = document.createElement('div');
    age.className = 'age';
    meta.append(st, age);
    left.appendChild(meta);

    const controls = document.createElement('div');
    controls.className = 'controls';

    // Unloading: X only on Queue (not Ready), gated by toggle
    if (TEAM === 'UNLOADING' && norm(it.status) !== 'ready') {
      const x = document.createElement('button');
      x.className = 'btn-mini';
      x.textContent = '×';
      x.disabled = !removeMode;
      x.title = removeMode ? 'Remove SKU' : 'Toggle X to enable';
      x.addEventListener('click', async () => {
        if (!removeMode) return;
        try {
          await logsRef.push({ sku: it.sku, by: 'UNLOADING', at: now() });
          await itemsRef.child(key).remove();
        } catch (e) { console.error(e); }
      });
      controls.appendChild(x);
    }

    // QI: status buttons (only if not ready)
    if (TEAM === 'QUALITY' && norm(it.status) !== 'ready') {
      const inProg = norm(it.status).includes('progress');
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.textContent = inProg ? 'Ready' : 'In Progress';
      btn.style.background = inProg ? 'var(--ok)' : 'var(--accent2)';
      btn.addEventListener('click', async () => {
        const next = inProg ? 'Ready' : 'In progress';
        const t = now();
        items[key] = { ...items[key], status: next, updatedAt: t, updatedBy: USER || 'QUALITY' };
        upsert(key); markDuplicates(); refreshAges();
        try {
          await itemsRef.child(key).update({ status: next, updatedAt: t, updatedBy: USER || 'QUALITY' });
        } catch (e) { console.error(e); }
      });
      controls.appendChild(btn);
    }

    li.append(left, controls);
    requestAnimationFrame(() => fitBubble(bubble));
    return li;
  }

  function insertSorted(parent, li, ts) {
    const nodes = Array.from(parent.children);
    const idx = nodes.findIndex(n => {
      const it = items[n.dataset.key];
      const t = (parent === doneList)
        ? (it.updatedAt || it.createdAt || 0)
        : (it.createdAt || it.updatedAt || 0);
      return ts >= t;
    });
    if (idx === -1) parent.appendChild(li);
    else parent.insertBefore(li, nodes[idx]);
  }

  function upsert(key) {
    const it = items[key];
    if (!it) return;
    const isReady = norm(it.status) === 'ready';
    const parent = isReady ? doneList : queueList;
    const ts = isReady ? (it.updatedAt || it.createdAt || 0) : (it.createdAt || it.updatedAt || 0);

    let li = document.querySelector(`li.item[data-key="${key}"]`);
    if (!li) {
      li = liFor(key, it);
      insertSorted(parent, li, ts);
    } else {
      if (li.parentElement !== parent) {
        li.parentElement.removeChild(li);
        insertSorted(parent, li, ts);
      }
      const bb = li.querySelector('.bubble');
      const raw = String(it.sku || '');
      const isShort = raw.length > 0 && raw.length <= 3;
      bb.className = 'bubble ' + bubbleClass(it.status) + (isShort ? ' bubble-circle' : ' bubble-long');
      bb.textContent = raw;
      li.querySelector('.status').textContent = norm(it.status) === 'new' ? '' : (it.status || '');

      // rebuild controls
      const controls = li.querySelector('.controls');
      controls.innerHTML = '';
      if (TEAM === 'UNLOADING' && norm(it.status) !== 'ready') {
        const x = document.createElement('button');
        x.className = 'btn-mini';
        x.textContent = '×';
        x.disabled = !removeMode;
        x.title = removeMode ? 'Remove SKU' : 'Toggle X to enable';
        x.addEventListener('click', async () => {
          if (!removeMode) return;
          try {
            await logsRef.push({ sku: it.sku, by: 'UNLOADING', at: now() });
            await itemsRef.child(key).remove();
          } catch (e) { console.error(e); }
        });
        controls.appendChild(x);
      } else if (TEAM === 'QUALITY' && norm(it.status) !== 'ready') {
        const inProg = norm(it.status).includes('progress');
        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.textContent = inProg ? 'Ready' : 'In Progress';
        btn.style.background = inProg ? 'var(--ok)' : 'var(--accent2)';
        btn.addEventListener('click', async () => {
          const next = inProg ? 'Ready' : 'In progress';
          const t = now();
          items[key] = { ...items[key], status: next, updatedAt: t, updatedBy: USER || 'QUALITY' };
          upsert(key); markDuplicates(); refreshAges();
          try {
            await itemsRef.child(key).update({ status: next, updatedAt: t, updatedBy: USER || 'QUALITY' });
          } catch (e) { console.error(e); }
        });
        controls.appendChild(btn);
      }
      // Match error decoration (QI + plan loaded + not ready + no match)
      li.classList.remove('match-error');
      const existingBadge = li.querySelector('.match-error-badge');
      if (existingBadge) existingBadge.remove();
      if (TEAM === 'QUALITY' && skuPlan && skuPlan.length && !isReady && !itemMatchesSkuPlan(it)) {
        li.classList.add('match-error');
        const badge = document.createElement('div');
        badge.className = 'match-error-badge';
        badge.textContent = 'Match error';
        const controls = li.querySelector('.controls');
        if (controls) controls.appendChild(badge);
        else li.appendChild(badge);
      }
    }
  }

  function removeRow(key) {
    const el = document.querySelector(`li.item[data-key="${key}"]`);
    if (el && el.parentElement) el.parentElement.removeChild(el);
    delete items[key];
  }

  function repaintAll() {
    queueList.innerHTML = '';
    doneList.innerHTML  = '';
    Object.entries(items)
      .filter(([, v]) => norm(v.status) !== 'ready')
      .sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0))
      .forEach(([k, v]) => insertSorted(queueList, liFor(k, v), v.createdAt || 0));
    Object.entries(items)
      .filter(([, v]) => norm(v.status) === 'ready')
      .sort((a, b) => (b[1].updatedAt || b[1].createdAt || 0) - (a[1].updatedAt || a[1].createdAt || 0))
      .forEach(([k, v]) => insertSorted(doneList, liFor(k, v), v.updatedAt || v.createdAt || 0));
    refreshAges(); scheduleAges(); markDuplicates();
  }

  // ----- Realtime listeners -----
  itemsRef.on('child_added',   s => { items[s.key] = s.val() || {}; upsert(s.key); markDuplicates(); refreshAges(); recalcSkuPlanFromItems(); });
  itemsRef.on('child_changed', s => { items[s.key] = s.val() || {}; upsert(s.key); markDuplicates(); refreshAges(); recalcSkuPlanFromItems(); });
  itemsRef.on('child_removed', s => { removeRow(s.key);             markDuplicates(); refreshAges(); recalcSkuPlanFromItems(); });

  // Network banner
  db.ref('.info/connected').on('value', snap => {
    netBanner.hidden = !!snap.val();
  }, _ => { netBanner.hidden = false; });

  // ----- QI console (max 3 rows, newest at bottom) -----
  function refreshQiLog(val) {
    const cutoff = Date.now() - 60 * 60 * 1000; // 1 hour
    const all = Object.values(val || {}).filter(x => x.at >= cutoff).sort((a, b) => a.at - b.at);
    const arr = all.slice(-3); // last 3, ascending so newest is bottom
    qiLogList.innerHTML = arr.map(x => `<li>${x.sku} · ${x.by || '—'} · ${fmtAgo(x.at)}</li>`).join('');
  }
  logsRef.on('value', s => refreshQiLog(s.val() || {}));

  // prune logs > 1h
  async function pruneLogs() {
    const cutoff = Date.now() - 60 * 60 * 1000;
    try {
      const snap = await logsRef.orderByChild('at').endAt(cutoff).once('value');
      const val = snap.val() || {};
      const updates = {};
      Object.keys(val).forEach(k => updates[k] = null);
      if (Object.keys(updates).length) await logsRef.update(updates);
    } catch (e) { console.warn('pruneLogs', e); }
  }
  pruneLogs();
  setInterval(pruneLogs, 5 * 60 * 1000);

  // ----- Role entry -----
  function enter(team) {
    TEAM = team;
    document.body.classList.add('in-app');
    rolePick.hidden = true;
    appEl.hidden = false;
    siteHeader.style.display = 'none';

    teamTitle.textContent = team === 'UNLOADING' ? 'Unloading' : 'Quality Inspection';
    teamNote.textContent  = team === 'UNLOADING' ? 'Center bar: add / toggle X' : `You: ${USER || 'QUALITY'}`;

    // Sticky bar: show toggle only for Unloading
    toggleRemoveCenter.hidden = (TEAM !== 'UNLOADING');
    updateRemoveToggle();

    // QI-only widgets
    const isQI = (TEAM === 'QUALITY');
    qiConsole.hidden = !isQI;

    repaintAll();
    skuInputCenter.focus();
  }

  enterUnloading.addEventListener('click', () => enter('UNLOADING'));
  enterQuality.addEventListener('click', () => {
    nameDlg.showModal();
    nameInput.value = USER || '';
    nameInput.focus();
  });
  nameOk.addEventListener('click', () => {
    const v = (nameInput.value || '').trim();
    if (!v) { nameInput.focus(); return; }
    USER = v;
    localStorage.setItem('tc_user', v);
    nameDlg.close();
    enter('QUALITY');
  });
  nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') nameOk.click(); });

  // Dedicated pages auto-enter
  if (window.QI_ONLY) {
    // For QI, show name dialog immediately
    enterQuality.click();
  } else if (window.UNL_ONLY) {
    enterUnloading.click();
  }


  // ----- Remove toggle (Unloading) -----
  function updateRemoveToggle() {
    const on = (TEAM === 'UNLOADING') && removeMode;
    toggleRemoveCenter.classList.toggle('on', on);
    if (TEAM === 'UNLOADING') {
      $$('#queueList .btn-mini').forEach(b => b.disabled = !removeMode);
    }
  }
  toggleRemoveCenter.addEventListener('click', () => {
    if (TEAM !== 'UNLOADING') return;
    removeMode = !removeMode;
    localStorage.setItem('tc_remove', removeMode ? '1' : '0');
    updateRemoveToggle();
  });

  // ----- Strict numeric input HOT-FIX (apply immediately after grabbing the element) -----
  (function enforceNumeric(el){
    const allow = new Set(['Backspace','Delete','ArrowLeft','ArrowRight','Tab','Home','End']);
    el.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) return;         // allow copy/paste shortcuts
      if (allow.has(e.key)) return;               // editing/navigation
      if (e.key === 'Enter') {                    // submit on Enter
        e.preventDefault();
        addSkuFrom(el);
        return;
      }
      if (/^[0-9]$/.test(e.key)) return;          // digits only
      e.preventDefault();                         // block everything else
    });
    el.addEventListener('paste', (e) => {         // sanitize paste
      e.preventDefault();
      const t = (e.clipboardData || window.clipboardData).getData('text') || '';
      const digits = t.replace(/\D/g, '').slice(0, 12);
      document.execCommand('insertText', false, digits);
    });
    el.addEventListener('drop', (e) => e.preventDefault()); // block drag-drop
    el.addEventListener('input', (e) => {          // safety net (IME etc.)
      const v = e.target.value.replace(/\D/g, '').slice(0, 12);
      if (e.target.value !== v) e.target.value = v;
    });
  })(skuInputCenter);

  // Add SKU
  const sanitizeSKU = v => (v || '').replace(/\D/g, '').slice(0, 12);
  async function addSkuFrom(input) {
    if (!TEAM) { alert('Pick a role first'); return; }
    const sku = sanitizeSKU(input.value);
    if (!sku) { input.focus(); return; }
    const t = now();
    const ref = itemsRef.push();
    const payload = {
      sku,
      status: 'New',
      createdAt: t,
      updatedAt: t,
      teamAdded: TEAM,
      updatedBy: TEAM === 'QUALITY' ? (USER || 'QUALITY') : 'UNLOADING'
    };
    try { await ref.set(payload); } catch (e) { console.error(e); }
    input.value = '';
    input.focus();
  }
  addBtnCenter.addEventListener('click', () => addSkuFrom(skuInputCenter));

  // SKU plan buttons
  if (skuPlanLoad && skuPlanInput) {
    skuPlanLoad.addEventListener('click', () => resetSkuPlan(skuPlanInput.value));
  }
  if (skuPlanClear) {
    skuPlanClear.addEventListener('click', () => clearSkuPlan());
  }

  // ----- QI clear buttons -----
  if (btnRemoveReady) btnRemoveReady.addEventListener('click', async () => {
    const ok = confirm('Remove ALL completed (Ready)?');
    if (!ok) return;
    const updates = {};
    for (const [k, v] of Object.entries(items)) {
      if (norm(v.status) === 'ready') updates[k] = null;
    }
    try {
      if (Object.keys(updates).length) await itemsRef.update(updates);
    } catch (e) { console.error(e); }
  });
  if (btnRemoveAll) btnRemoveAll.addEventListener('click', async () => {
    const ok = confirm('Remove ALL SKUs?');
    if (!ok) return;
    try {
      const snap = await itemsRef.once('value');
      const val = snap.val() || {};
      const updates = {};
      Object.keys(val).forEach(k => { updates[k] = null; });
      if (Object.keys(updates).length) await itemsRef.update(updates);
    } catch (e) { console.error(e); }
  });

  // Initial
  repaintAll();
})();