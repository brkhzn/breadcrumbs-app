// ═══════════════════════════════════════════════════════════
//  Breadcrumbs — app.js
// ═══════════════════════════════════════════════════════════

// ── Config ──────────────────────────────────────────────────
var ATP_COLLECTIONS = {
  book:    'app.breadcrumbs.book',
  show:    'app.breadcrumbs.show',
  movie:   'app.breadcrumbs.movie',
  game:    'app.breadcrumbs.game',
  podcast: 'app.breadcrumbs.podcast'
};
var ATP_LEGACY = 'app.breadcrumbs.entry';
var DEFAULT_PDS = 'https://bsky.social';

var STATUS = {
  wantTo:     'app.breadcrumbs.defs#wantTo',
  inProgress: 'app.breadcrumbs.defs#inProgress',
  completed:  'app.breadcrumbs.defs#completed',
  abandoned:  'app.breadcrumbs.defs#abandoned',
  onHold:     'app.breadcrumbs.defs#onHold'
};
var STATUS_LABELS = {
  'app.breadcrumbs.defs#wantTo':     'Want to',
  'app.breadcrumbs.defs#inProgress': 'In Progress',
  'app.breadcrumbs.defs#completed':  'Completed',
  'app.breadcrumbs.defs#abandoned':  'Abandoned',
  'app.breadcrumbs.defs#onHold':     'On Hold'
};

var LABELS = { book:'Book', show:'Show', movie:'Film', game:'Game', podcast:'Podcast' };
var DOT_COLORS = { book:'#5F6B43', show:'#6B4E71', movie:'#B08848', game:'#A45A3C', podcast:'#4F706D' };

// Palettes ordered darkest → lightest characteristic tone
var PALETTES = [
  { id:'forest', name:'Forest', light:{bg:'#EEF2EC',fg:'#1A2C20'}, dark:{bg:'#0D1410',fg:'#C8DEC4'}, accent:'#2D6B45' },
  { id:'ember',  name:'Ember',  light:{bg:'#F5EEE0',fg:'#2C1E0E'}, dark:{bg:'#1A1510',fg:'#E8D5B5'}, accent:'#B06820' },
  { id:'ocean',  name:'Ocean',  light:{bg:'#EBF0F5',fg:'#1A2535'}, dark:{bg:'#0C1118',fg:'#C0D4E8'}, accent:'#2C5F8A' },
  { id:'ink',    name:'Ink',    light:{bg:'#F5EFE2',fg:'#2A2520'}, dark:{bg:'#14110C',fg:'#F1E8D5'}, accent:'#8A3B3B' },
  { id:'slate',  name:'Slate',  light:{bg:'#F2F2F2',fg:'#1A1A1A'}, dark:{bg:'#141414',fg:'#E0E0E0'}, accent:'#4A6B8A' },
];

// Fallback CSS-gradient covers (used when no coverUrl)
var COVER_BG = {
  book:    'linear-gradient(160deg,#5F6B43,#3E4A27)',
  show:    'linear-gradient(160deg,#6B4E71,#44314A)',
  movie:   'linear-gradient(160deg,#B08848,#6F5528)',
  game:    'linear-gradient(160deg,#A45A3C,#6A3722)',
  podcast: 'linear-gradient(160deg,#4F706D,#334947)'
};


// ── State ────────────────────────────────────────────────────
var session        = null;
var entries        = [];
var editRkey       = null;
var editCollection = null;
var selType        = 'book';
var selGenre       = '';
var selRating      = 0;
var selStatus      = STATUS.inProgress;
var selectedMedia  = null;
var searchTimeout  = null;
var isDemo         = false;
var filterType     = 'all';

var filterStatuses = ['app.breadcrumbs.defs#inProgress'];

var themePalette = 'ink';
var themeMode    = 'system';
var _darkMQ      = window.matchMedia('(prefers-color-scheme: dark)');

var lists          = [];
var editListRkey   = null;
var listDetailRkey = null;
var listSelColor   = '#5F6B43';
var listSelItems   = [];     // array of entry rkeys selected in modal

var ATP_LIST_COLLECTION = 'app.breadcrumbs.list';
var LIST_COLORS = ['#5F6B43','#6B4E71','#B08848','#A45A3C','#4F706D','#8A3B3B','#8A7BA8','#6B6358'];
// ROYGBIV, then neutrals
var ACCENT_COLORS = [
  '#8A3B3B', // red   (crimson)
  '#A45A3C', // orange (rust)
  '#B08848', // yellow (ochre)
  '#5F6B43', // green  (moss)
  '#4F706D', // blue   (teal)
  '#8A7BA8', // indigo (lavender)
  '#6B4E71', // violet (plum)
  '#6B6358', // warm grey
  '#F5F5F5', // white
  '#9A9A9A', // grey
  '#1A1A1A'  // black
];

// ── Helpers ──────────────────────────────────────────────────
function $(id)  { return document.getElementById(id); }
function $$(sel) { return document.querySelectorAll(sel); }

function esc(s) {
  if (!s) return '';
  var d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function fmtDate(ts) {
  if (!ts) return '';
  var d = new Date(ts), now = new Date();
  var diff = Math.floor((now - d) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7)  return diff + 'd ago';
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[d.getMonth()] + ' ' + d.getDate();
}

function dayKey(ts) {
  var d = new Date(ts); d.setHours(0,0,0,0);
  return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
}

function fmtDayHeader(ts) {
  var d = new Date(ts); d.setHours(0,0,0,0);
  var now = new Date(); now.setHours(0,0,0,0);
  var diff = Math.round((now - d) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var label = months[d.getMonth()] + ' ' + d.getDate();
  if (d.getFullYear() !== now.getFullYear()) label += ', ' + d.getFullYear();
  return label;
}

function entryActivityTs(e) {
  return (e.progress && e.progress.updatedAt) || e.createdAt;
}

function fmtSecs(s) {
  var h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
  if (h > 0) return h+':'+String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0');
  return m+':'+String(sec).padStart(2,'0');
}

function parseSecs(str) {
  if (!str) return null;
  var p = str.split(':').map(Number);
  if (p.length === 2) return p[0]*60 + p[1];
  if (p.length === 3) return p[0]*3600 + p[1]*60 + p[2];
  return null;
}

// Inline SVG strings for category icons (used in pills + type buttons)
var CAT_SVG = {
  book:    '<svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="3" y="2" width="10" height="13" rx="1" stroke="currentColor" stroke-width="1.3" fill="none"/><line x1="6" y1="6" x2="11" y2="6" stroke="currentColor" stroke-width="1.3"/><line x1="6" y1="9" x2="9" y2="9" stroke="currentColor" stroke-width="1.3"/></svg>',
  show:    '<svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="2" y="3" width="12" height="9" rx="1.5" stroke="currentColor" stroke-width="1.3" fill="none"/><polygon points="6.5,6 10.5,8 6.5,10" fill="currentColor" opacity=".7"/></svg>',
  movie:   '<svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="2" y="3" width="12" height="10" rx="1" stroke="currentColor" stroke-width="1.3" fill="none"/><line x1="2" y1="6" x2="14" y2="6" stroke="currentColor" stroke-width="1"/><line x1="5" y1="3" x2="5" y2="6" stroke="currentColor" stroke-width="1"/><line x1="8" y1="3" x2="8" y2="6" stroke="currentColor" stroke-width="1"/><line x1="11" y1="3" x2="11" y2="6" stroke="currentColor" stroke-width="1"/></svg>',
  game:    '<svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="3" y="5" width="10" height="7" rx="2" stroke="currentColor" stroke-width="1.3" fill="none"/><line x1="8" y1="6.5" x2="8" y2="9.5" stroke="currentColor" stroke-width="1.3"/><line x1="6.5" y1="8" x2="9.5" y2="8" stroke="currentColor" stroke-width="1.3"/><circle cx="11" cy="8" r=".8" fill="currentColor"/></svg>',
  podcast: '<svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="6" r="2.5" stroke="currentColor" stroke-width="1.3" fill="none"/><path d="M5 9.5a4.5 4.5 0 006 0" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><line x1="8" y1="12" x2="8" y2="14" stroke="currentColor" stroke-width="1.3"/></svg>'
};

var SVG_CHEV = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" style="flex-shrink:0;color:var(--fg-4)"><polyline points="6,4 10,8 6,12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>';

var SVG_LOGOMARK = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="48" height="48" fill="none" aria-hidden="true"><circle cx="50" cy="50" r="46" fill="#7A2F2F"/><g fill="#F5EFE2"><circle cx="36" cy="22" r="2.4"/><circle cx="36" cy="32" r="2.4"/><circle cx="36" cy="42" r="2.4"/><circle cx="36" cy="52" r="2.4"/><circle cx="55" cy="66" r="14"/></g></svg>';

var SVG_ATP = '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M5.5 11L8 5l2.5 6M6.5 9h3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';

// ── Theme ────────────────────────────────────────────────────
function applyPalette(p) {
  themePalette = p;
  document.documentElement.setAttribute('data-palette', p);
  localStorage.setItem('bc_palette', p);
  renderSettings();
}

function _syncSystemMode() {
  if (themeMode === 'system') {
    document.documentElement.setAttribute('data-mode', _darkMQ.matches ? 'dark' : 'light');
  }
}

function applyMode(m) {
  themeMode = m;
  localStorage.setItem('bc_mode', m);
  if (m === 'system') {
    _darkMQ.addEventListener('change', _syncSystemMode);
    _syncSystemMode();
  } else {
    _darkMQ.removeEventListener('change', _syncSystemMode);
    document.documentElement.setAttribute('data-mode', m);
  }
  renderSettings();
}

function detectTheme() {
  var legacy = localStorage.getItem('bc_theme');
  if (legacy) {
    var legacyModeMap = { night:'dark', forest:'dark', sepia:'dark', slate:'light', dusk:'light', day:'light' };
    var legacyPaletteMap = { night:'ink', forest:'forest', sepia:'ember', slate:'ink', dusk:'ink', day:'ink' };
    localStorage.setItem('bc_mode', legacyModeMap[legacy] || 'system');
    localStorage.setItem('bc_palette', legacyPaletteMap[legacy] || 'ink');
    localStorage.removeItem('bc_theme');
  }
  var savedPalette = localStorage.getItem('bc_palette') || 'ink';
  var savedMode    = localStorage.getItem('bc_mode')    || 'system';
  applyPalette(savedPalette);
  applyMode(savedMode);
}

// ── AT Protocol ──────────────────────────────────────────────
function isExpiredTokenError(err) {
  if (!err || !err.message) return false;
  var m = err.message;
  return m.indexOf('ExpiredToken') !== -1
      || m.indexOf('InvalidToken') !== -1
      || m.indexOf('expired') !== -1;
}

var _refreshInflight = null;

async function atpRequest(method, endpoint, body, pds, _isRetry) {
  var url = (pds || session?.pds || DEFAULT_PDS) + '/xrpc/' + endpoint;
  var headers = {'Content-Type':'application/json'};
  if (session?.accessJwt) headers['Authorization'] = 'Bearer ' + session.accessJwt;
  var opts = {method:method, headers:headers};
  if (body && method !== 'GET') opts.body = JSON.stringify(body);
  var res = await fetch(url, opts);
  var data;
  try { data = await res.json(); } catch(e) { data = {}; }
  if (!res.ok) {
    var err = new Error(data.message || data.error || 'Request failed');
    err.error = data.error;
    err.status = res.status;
    if (!_isRetry && session?.refreshJwt && isExpiredTokenError(err)) {
      var refreshed = await atpRefreshSession();
      if (refreshed) return atpRequest(method, endpoint, body, pds, true);
      authExpired();
    }
    throw err;
  }
  return data;
}

async function atpLogin(handle, password) {
  var data = await atpRequest('POST', 'com.atproto.server.createSession',
    {identifier:handle, password:password}, DEFAULT_PDS);
  session = {did:data.did, handle:data.handle, accessJwt:data.accessJwt,
             refreshJwt:data.refreshJwt, pds:DEFAULT_PDS};
  localStorage.setItem('bc_atp_session', JSON.stringify(session));
  return session;
}

// Direct refresh call: must use the refresh JWT, not the (expired) access JWT.
// Single in-flight promise so concurrent requests share one refresh.
function atpRefreshSession() {
  if (!session?.refreshJwt) return Promise.resolve(false);
  if (_refreshInflight) return _refreshInflight;
  var url = (session.pds || DEFAULT_PDS) + '/xrpc/com.atproto.server.refreshSession';
  _refreshInflight = fetch(url, {
    method:'POST',
    headers:{'Authorization':'Bearer ' + session.refreshJwt}
  }).then(async function(res) {
    var data; try { data = await res.json(); } catch(e) { data = {}; }
    if (!res.ok) return false;
    session.accessJwt  = data.accessJwt;
    session.refreshJwt = data.refreshJwt;
    localStorage.setItem('bc_atp_session', JSON.stringify(session));
    return true;
  }).catch(function() { return false; })
    .finally(function() { _refreshInflight = null; });
  return _refreshInflight;
}

// Refresh token is gone or invalid. Stash any in-flight draft and send the
// user back to sign in.
var _authExpiredHandled = false;
function authExpired() {
  if (_authExpiredHandled) return;
  _authExpiredHandled = true;
  if (typeof captureFormDraft === 'function') captureFormDraft();
  try { localStorage.removeItem('bc_atp_session'); } catch(e) {}
  session = null;
  toast('Session expired. Please sign in again.', 'error');
  setTimeout(function() {
    var auth = $('auth-screen'); var main = $('main-screen');
    if (auth) auth.classList.add('active');
    if (main) main.classList.remove('active');
    var atp = $('atp-badge'); if (atp) atp.classList.add('hidden');
    var err = $('auth-error'); if (err) err.classList.add('hidden');
    _authExpiredHandled = false;
  }, 800);
}

async function atpGetEntries() {
  showSync(true);
  try {
    var cols = [...Object.values(ATP_COLLECTIONS), ATP_LEGACY];
    var results = await Promise.allSettled(cols.map(function(col) {
      return atpRequest('GET',
        'com.atproto.repo.listRecords?repo=' + encodeURIComponent(session.did) +
        '&collection=' + col + '&limit=100')
        .then(function(d) { return {col:col, records:d.records||[]}; });
    }));

    entries = [];
    results.forEach(function(r) {
      if (r.status !== 'fulfilled') return;
      r.value.records.forEach(function(rec) {
        entries.push(normalizeRecord(rec, r.value.col));
      });
    });

    // Deduplicate by URI
    var seen = new Set();
    entries = entries.filter(function(e) {
      if (seen.has(e.uri)) return false;
      seen.add(e.uri); return true;
    });

    entries.sort(function(a,b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    showSync(false);
    return entries;
  } catch(e) {
    showSync(false);
    if (e.message && (e.message.includes('expired') || e.message.includes('Invalid'))) {
      var ok = await atpRefreshSession();
      if (ok) return atpGetEntries();
    }
    throw e;
  }
}

function normalizeRecord(rec, collection) {
  var val  = rec.value;
  var rkey = rec.uri.split('/').pop();
  var type = Object.entries(ATP_COLLECTIONS).find(function(e) { return e[1] === collection; });
  type = type ? type[0] : (val.type === 'tv' ? 'show' : val.type || 'book');
  var authors = val.authors || (val.author ? [val.author] : undefined);
  var genres  = val.genres  || (val.genre  ? [val.genre]  : undefined);
  var status  = val.status  || (val.progress ? STATUS.inProgress : STATUS.wantTo);
  return Object.assign({}, val, {
    type:type, authors:authors, genres:genres, status:status,
    progress:val.progress||null, history:val.history||[], rkey:rkey, uri:rec.uri, collection:collection
  });
}

function buildRecord(entry, collection) {
  var rec = {$type:collection};
  if (entry.title)            rec.title       = entry.title;
  if (entry.status)           rec.status      = entry.status;
  if (entry.notes)            rec.notes       = entry.notes;
  if (entry.rating)           rec.rating      = entry.rating;
  if (entry.coverUrl)         rec.coverUrl    = entry.coverUrl;
  if (entry.genres?.length)   rec.genres      = entry.genres;
  if (entry.progress)         rec.progress    = entry.progress;
  if (entry.identifiers)      rec.identifiers = entry.identifiers;
  if (entry.startedAt)        rec.startedAt   = entry.startedAt;
  if (entry.finishedAt)       rec.finishedAt  = entry.finishedAt;
  if (entry.watchedAt)        rec.watchedAt   = entry.watchedAt;
  if (entry.type === 'book'    && entry.authors?.length) rec.authors   = entry.authors;
  if (entry.type === 'game'    && entry.developer)       rec.developer = entry.developer;
  if (entry.type === 'podcast' && entry.creator)         rec.creator   = entry.creator;
  if (entry.description)     rec.description = entry.description;
  if (entry.history?.length) rec.history = entry.history;
  return rec;
}

// ── ATP — Lists ───────────────────────────────────────────────
async function atpGetLists() {
  var data = await atpRequest('GET',
    'com.atproto.repo.listRecords?repo=' + encodeURIComponent(session.did) +
    '&collection=' + ATP_LIST_COLLECTION + '&limit=100');
  lists = (data.records || []).map(function(rec) {
    var v = rec.value;
    var rkey = rec.uri.split('/').pop();
    var itemRkeys = (v.items || []).map(function(it) {
      return it.subject && it.subject.uri ? it.subject.uri.split('/').pop() : null;
    }).filter(Boolean);
    return { rkey:rkey, uri:rec.uri, name:v.name, description:v.description||'',
             color:v.color||'#5F6B43', items:itemRkeys, createdAt:v.createdAt };
  });
}

async function atpSaveList(list) {
  var record = {
    $type: ATP_LIST_COLLECTION,
    name: list.name,
    description: list.description || '',
    color: list.color,
    items: list.items.map(function(rkey) {
      var entry = entries.find(function(e) { return e.rkey === rkey; });
      var uri = entry ? (entry.uri || ('at://' + session.did + '/' + (entry.collection||'app.breadcrumbs.book') + '/' + rkey)) : ('at://' + session.did + '/app.breadcrumbs.book/' + rkey);
      return { subject:{ uri:uri, cid:'' }, addedAt:new Date().toISOString() };
    }),
    createdAt: list.createdAt || new Date().toISOString()
  };
  if (list.rkey) {
    await atpRequest('POST', 'com.atproto.repo.putRecord',
      { repo:session.did, collection:ATP_LIST_COLLECTION, rkey:list.rkey, record:record });
  } else {
    var data = await atpRequest('POST', 'com.atproto.repo.createRecord',
      { repo:session.did, collection:ATP_LIST_COLLECTION, record:record });
    list.rkey = data.uri.split('/').pop();
    list.uri  = data.uri;
  }
}

async function atpDeleteList(rkey) {
  await atpRequest('POST', 'com.atproto.repo.deleteRecord',
    { repo:session.did, collection:ATP_LIST_COLLECTION, rkey:rkey });
}

async function atpCreateEntry(entry) {
  showSync(true);
  try {
    var collection = ATP_COLLECTIONS[entry.type] || ATP_COLLECTIONS.book;
    var record = buildRecord(entry, collection);
    record.createdAt = new Date().toISOString();
    var data = await atpRequest('POST', 'com.atproto.repo.createRecord',
      {repo:session.did, collection:collection, record:record});
    showSync(false);
    return data;
  } catch(e) { showSync(false); throw e; }
}

async function atpUpdateEntry(rkey, collection, entry) {
  showSync(true);
  try {
    var newCollection = ATP_COLLECTIONS[entry.type] || ATP_COLLECTIONS.book;
    if (collection !== newCollection) {
      await atpDeleteEntry(rkey, collection);
      var created = await atpCreateEntry(entry);
      showSync(false);
      return created;
    }
    var record = buildRecord(entry, collection);
    var original = entries.find(function(e) { return e.rkey === rkey && e.collection === collection; });
    record.createdAt = (original && original.createdAt) || new Date().toISOString();
    var data = await atpRequest('POST', 'com.atproto.repo.putRecord',
      {repo:session.did, collection:collection, rkey:rkey, record:record});
    showSync(false);
    return data;
  } catch(e) { showSync(false); throw e; }
}

async function atpDeleteEntry(rkey, collection) {
  showSync(true);
  try {
    await atpRequest('POST', 'com.atproto.repo.deleteRecord',
      {repo:session.did, collection:collection || ATP_LEGACY, rkey:rkey});
    showSync(false);
  } catch(e) { showSync(false); throw e; }
}

function showSync(show) { $('sync-indicator').style.display = show ? 'flex' : 'none'; }

// ── Init ─────────────────────────────────────────────────────
function init() {
  detectTheme();

  // Auth
  $('signin-btn').onclick  = signIn;
  $('demo-btn').onclick    = startDemo;
  if ($('auth-privacy-link')) {
    $('auth-privacy-link').onclick = function(e) {
      e.preventDefault();
      showPrivacy('auth-screen');
    };
  }
  if ($('privacy-back')) $('privacy-back').onclick = hidePrivacy;

  // Auth: submit on Enter
  $('auth-password').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') signIn();
  });

  // Modal
  $('add-btn').onclick     = openAdd;
  $('modal-close').onclick = closeModal;
  $('modal-cancel').onclick = closeModal;
  $('entry-modal').onclick = function(e) { if (e.target === this) closeModal(); };
  $('save-btn').onclick    = saveEntry;
  $('delete-btn').onclick  = deleteEntry;

  // Bug report modal
  if ($('bug-modal-close')) $('bug-modal-close').onclick = closeBugReport;
  if ($('bug-cancel'))      $('bug-cancel').onclick      = closeBugReport;
  if ($('bug-submit'))      $('bug-submit').onclick      = submitBugReport;
  if ($('bug-modal'))       $('bug-modal').onclick = function(e) { if (e.target === this) closeBugReport(); };

  // Detail panel
  $('detail-back').onclick = closeDetail;

  // Log modal
  $('log-modal-close').onclick  = closeLogModal;
  $('log-modal-cancel').onclick = closeLogModal;
  $('log-modal').onclick = function(e) { if (e.target === this) closeLogModal(); };
  $('log-modal-save').onclick   = submitLog;


  // Search
  $('f-search').oninput = function() {
    clearTimeout(searchTimeout);
    var q = this.value.trim();
    if (q.length < 2) { $('search-results').classList.add('hidden'); return; }
    searchTimeout = setTimeout(function() { searchMedia(q); }, 400);
  };
  $('f-search').onfocus = function() {
    if (this.value.length >= 2) $('search-results').classList.remove('hidden');
  };
  document.addEventListener('click', function(e) {
    if (!e.target.closest('.bc-search-wrap')) $('search-results').classList.add('hidden');
  });

  // Clear selection
  $('clear-selection').onclick = clearSelection;

  // Tabs
  $$('.bc-tab').forEach(function(t) {
    t.onclick = function() { switchTab(t.dataset.tab); };
  });

  // Type selector
  $$('.bc-type').forEach(function(b) {
    b.onclick = function() { pickType(b.dataset.t); };
  });

  // Status chips
  $$('.bc-sbtn').forEach(function(b) {
    b.onclick = function() { pickStatus(b.dataset.s); };
  });

  // Stars
  $$('.bc-star').forEach(function(s) {
    s.onclick = function() { pickRating(+s.dataset.r); };
  });

  // Filter chips
  $$('.bc-filter').forEach(function(b) {
    b.onclick = function() { setFilter(b.dataset.f); };
  });

  // Status filter chips
  $$('.bc-sfilter').forEach(function(b) {
    b.onclick = function() { setStatusFilter(b.dataset.sf); };
  });

  // List buttons
  $('new-list-btn').onclick = function() { openListModal(null); };
  $('list-modal-close').onclick  = closeListModal;
  $('list-modal-cancel').onclick = closeListModal;
  $('list-modal-save').onclick   = saveList;
  $('list-modal-delete').onclick = function() { deleteList(editListRkey); };
  $('list-modal').addEventListener('click', function(e) {
    if (e.target === $('list-modal')) closeListModal();
  });

  // Restore session
  var savedSession = localStorage.getItem('bc_atp_session');
  if (savedSession) {
    try {
      session = JSON.parse(savedSession);
      isDemo  = false;
      showMain();
      loadEntries();
      return;
    } catch(e) { localStorage.removeItem('bc_atp_session'); }
  }

  var demoMode = localStorage.getItem('bc_demo_mode');
  if (demoMode) { isDemo = true; showMain(); loadDemoEntries(); }
}

// ── Auth ─────────────────────────────────────────────────────
async function signIn() {
  var handle   = $('auth-handle').value.trim();
  var password = $('auth-password').value;
  var errorEl  = $('auth-error');

  if (!handle || !password) {
    showAuthError('Please enter your handle and app password.');
    return;
  }
  if (!handle.includes('.')) handle = handle + '.bsky.social';
  errorEl.classList.add('hidden');

  $('signin-btn').textContent = 'Signing in…';
  $('signin-btn').disabled = true;
  try {
    await atpLogin(handle, password);
    isDemo = false;
    localStorage.removeItem('bc_demo_mode');
    showMain();
    await loadEntries();
    toast('Signed in as @' + session.handle);
  } catch(e) {
    var msg = e.message || '';
    if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('password') || msg.toLowerCase().includes('identifier')) {
      showAuthError('Wrong handle or app password. Make sure you\'re using an App Password from bsky.app/settings, not your main password.');
    } else if (msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('resolve')) {
      showAuthError('Handle not found. Try including the full handle, e.g. you.bsky.social');
    } else if (msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('network') || msg === '') {
      showAuthError('Connection failed. Check your internet and try again.');
    } else {
      showAuthError(msg || 'Sign in failed. Check your handle and app password.');
    }
  } finally {
    $('signin-btn').textContent = 'Continue';
    $('signin-btn').disabled = false;
  }
}

function showAuthError(msg) {
  var el = $('auth-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function startDemo() {
  isDemo = true; session = null;
  localStorage.setItem('bc_demo_mode', 'true');
  showMain(); loadDemoEntries();
  toast('Welcome to Breadcrumbs!');
}

function logout() {
  session = null; isDemo = false; entries = [];
  localStorage.removeItem('bc_atp_session');
  localStorage.removeItem('bc_demo_mode');
  localStorage.removeItem('bc_demo_entries');
  $('auth-screen').classList.add('active');
  $('main-screen').classList.remove('active');
  $('auth-error').classList.add('hidden');
  $('auth-handle').value = '';
  $('auth-password').value = '';
  toast('Signed out');
}

function showPrivacy(returnTo) {
  ['auth-screen','main-screen'].forEach(function(id) {
    var el = $(id); if (el) el.classList.remove('active');
  });
  $('privacy-screen').classList.add('active');
  $('privacy-screen').dataset.returnTo = returnTo || (session || isDemo ? 'main-screen' : 'auth-screen');
  window.scrollTo(0, 0);
}
function hidePrivacy() {
  $('privacy-screen').classList.remove('active');
  var back = $('privacy-screen').dataset.returnTo || (session || isDemo ? 'main-screen' : 'auth-screen');
  $(back).classList.add('active');
}

function showMain() {
  $('auth-screen').classList.remove('active');
  $('main-screen').classList.add('active');
  if (session) {
    $('atp-badge').classList.remove('hidden');
    $('demo-banner').classList.add('hidden');
  } else {
    $('atp-badge').classList.add('hidden');
    $('demo-banner').classList.remove('hidden');
  }
  renderSettings();
  updateStats();
  renderLists();
  if (session) setTimeout(restoreFormDraftIfPresent, 200);
}


// ── Data ─────────────────────────────────────────────────────
async function loadEntries() {
  $('loading-entries').classList.remove('hidden');
  $('entries').innerHTML = '';
  $('empty').classList.add('hidden');
  try {
    await Promise.all([atpGetEntries(), atpGetLists()]);
    render(); updateStats(); renderLists();
  } catch(e) {
    toast('Failed to load: ' + e.message, 'error');
    render();
  } finally {
    $('loading-entries').classList.add('hidden');
  }
}

function loadDemoEntries() {
  var saved = localStorage.getItem('bc_demo_entries');
  if (saved) {
    try { entries = JSON.parse(saved); } catch(e) { entries = []; }
  } else {
    var now = Date.now();
    entries = [
      {rkey:'1',collection:'app.breadcrumbs.book',type:'book',title:'Project Hail Mary',
       authors:['Andy Weir'],
       progress:{currentPage:284,totalPages:476,updatedAt:new Date(now-2*86400000).toISOString()},
       status:STATUS.inProgress,genres:['Sci-Fi'],rating:5,
       description:'The lone survivor of a desperate last-chance mission wakes up with no memory of who he is or how he got here, millions of miles from home. His only companion is an alien from a distant star system. Together they must solve the greatest mystery in the universe to save Earth.',
       notes:'Rocky is the best first contact I\'ve read. Genuinely moved by the engineering.',
       coverUrl:'https://covers.openlibrary.org/b/isbn/9780593135204-M.jpg',
       createdAt:new Date(now-2*86400000).toISOString()},
      {rkey:'2',collection:'app.breadcrumbs.show',type:'show',title:'Severance',
       progress:{season:1,episode:7,updatedAt:new Date(now-4*86400000).toISOString()},
       status:STATUS.inProgress,genres:['Thriller'],
       description:'Mark leads a team of office workers whose memories have been surgically divided between their work and personal lives. When a mysterious colleague appears outside of work, it begins a journey to discover the truth about their jobs.',
       notes:'Waffle party coming up.',
       coverUrl:'https://image.tmdb.org/t/p/w200/lFf6LLrQjYZKqiPuqcvzL8Fmgmt.jpg',
       createdAt:new Date(now-4*86400000).toISOString()},
      {rkey:'3',collection:'app.breadcrumbs.movie',type:'movie',title:'Oppenheimer',
       status:STATUS.completed,genres:['Drama'],rating:4,
       description:'The story of J. Robert Oppenheimer and his role in the development of the atomic bomb during World War II, and the consequences that followed.',
       notes:'Trinity test was incredible.',
       coverUrl:'https://image.tmdb.org/t/p/w200/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg',
       createdAt:new Date(now-6*86400000).toISOString()},
      {rkey:'4',collection:'app.breadcrumbs.game',type:'game',title:"Baldur's Gate 3",
       developer:'Larian Studios',
       description:'Gather your party and return to the Forgotten Realms in a tale of fellowship and betrayal, sacrifice and survival, and the lure of absolute power.',
       progress:{playtimeMinutes:2520,completionPercent:42,narrativePosition:'Act 2: Moonrise Towers',
                 updatedAt:new Date(now-9*86400000).toISOString()},
       status:STATUS.inProgress,genres:['RPG'],rating:5,
       notes:'Dark Urge playthrough.',
       coverUrl:'https://media.rawg.io/media/games/699/69907ecf13f172e9e1069ff7a9fd7544.jpg',
       createdAt:new Date(now-9*86400000).toISOString()}
    ];
    saveDemoEntries();
  }
  render(); updateStats();
  loadDemoLists();
}

function saveDemoEntries() {
  localStorage.setItem('bc_demo_entries', JSON.stringify(entries));
}

// ── Lists — storage ───────────────────────────────────────────
function saveDemoLists() {
  localStorage.setItem('bc_demo_lists', JSON.stringify(lists));
}
function loadDemoLists() {
  var saved = localStorage.getItem('bc_demo_lists');
  try { lists = saved ? JSON.parse(saved) : []; } catch(e) { lists = []; }
  renderLists();
}

// ── Lists — render ────────────────────────────────────────────
function renderLists() {
  var container = $('lists-container');
  if (!container) return;

  if (listDetailRkey) { renderListDetail(listDetailRkey); return; }

  if (!lists.length) {
    container.innerHTML =
      '<div class="bc-empty">'
      + '<svg width="32" height="32" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M5 3h10a1 1 0 011 1v13l-6-3.5L4 17V4a1 1 0 011-1z" stroke="currentColor" stroke-width="1.5"/></svg>'
      + '<h3>No lists yet</h3>'
      + '<p>Gather your breadcrumbs into a list: winter reads, rewatch queue, anything.</p>'
      + '<button class="bc-btn bc-btn--secondary" style="margin-top:18px" id="create-list-btn">'
      + '<svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true"><line x1="10" y1="4" x2="10" y2="16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="4" y1="10" x2="16" y2="10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
      + ' New list</button>'
      + '</div>';
    var btn = $('create-list-btn');
    if (btn) btn.onclick = function() { openListModal(null); };
    return;
  }

  container.innerHTML = '<div class="bc-lists">'
    + lists.map(function(l) {
      var count = l.items ? l.items.length : 0;
      var itemEntries = (l.items || []).map(function(rkey) {
        return entries.find(function(e) { return e.rkey === rkey; });
      }).filter(Boolean);
      var uniqTypes = itemEntries.map(function(e) { return LABELS[e.type]; })
        .filter(function(t,i,a) { return a.indexOf(t) === i; });
      var meta = count + (count === 1 ? ' entry' : ' entries')
        + (uniqTypes.length ? ' · ' + uniqTypes.join(', ') : '');

      var covers = itemEntries.slice()
        .sort(function(a, b) { return (b.coverUrl ? 1 : 0) - (a.coverUrl ? 1 : 0); })
        .slice(0, 3).map(function(e) {
        return e.coverUrl
          ? 'background-image:url(' + esc(e.coverUrl) + ');background-size:cover;background-position:center'
          : 'background:' + (COVER_BG[e.type] || COVER_BG.book);
      });
      while (covers.length < 3) {
        covers.push('background:' + (COVER_BG.book));
      }

      var stackHtml = '<div class="bc-list-card__stack" aria-hidden="true">'
        + covers.map(function(s) { return '<div class="bc-list-card__stack-item" style="' + s + '"></div>'; }).join('')
        + '</div>';

      return '<button class="bc-list-card" onclick="openListDetail(\'' + l.rkey + '\')">'
        + stackHtml
        + '<div class="bc-list-card__info">'
        + '<div class="bc-list-card__name">' + esc(l.name) + '</div>'
        + '<div class="bc-list-card__count">' + esc(meta) + '</div>'
        + (l.description ? '<div class="bc-list-card__note">' + esc(l.description) + '</div>' : '')
        + '</div>'
        + SVG_CHEV
        + '</button>';
    }).join('')
    + '</div>';
}

function renderListDetail(rkey) {
  var container = $('lists-container');
  if (!container) return;
  var list = lists.find(function(l) { return l.rkey === rkey; });
  if (!list) { listDetailRkey = null; renderLists(); return; }

  var items = (list.items || []).map(function(rk) {
    return entries.find(function(e) { return e.rkey === rk; });
  }).filter(Boolean);

  var html =
    '<div class="bc-list-detail__head">'
    + '<button class="bc-icon-btn" onclick="backToLists()" aria-label="Back" style="margin-right:2px">'
    + '<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><polyline points="11,3 5,9 11,15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    + '</button>'
    + '<div class="bc-list-detail__dot" style="background:' + esc(list.color||'#5F6B43') + '"></div>'
    + '<div class="bc-list-detail__name">' + esc(list.name) + '</div>'
    + '<button class="bc-icon-btn" onclick="openListModal(\'' + rkey + '\')" aria-label="Edit list">'
    + '<svg width="17" height="17" viewBox="0 0 18 18" fill="none"><path d="M12 3l3 3-9 9H3v-3L12 3z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>'
    + '</button>'
    + '</div>';

  if (list.description) {
    html += '<p class="bc-list-detail__desc">' + esc(list.description) + '</p>';
  }

  if (!items.length) {
    html += '<div class="bc-list-detail__empty">No entries in this list yet.<br>Edit the list to add some.</div>';
  } else {
    html += '<div class="bc-content" style="padding:14px 18px 80px">'
      + '<div class="bc-entries">'
      + items.map(function(e) {
        var coverStyle = e.coverUrl
          ? 'background-image:url(' + esc(e.coverUrl) + ');background-size:cover;background-position:center'
          : 'background:' + (COVER_BG[e.type]||COVER_BG.book);
        var typeLabel = LABELS[e.type] || e.type;
        var subtitle  = e.authors ? e.authors[0] : (e.creator || e.developer || '');
        return '<button class="bc-card bc-card--' + e.type + '" onclick="openDetail(\'' + e.rkey + '\',\'' + (e.collection||'') + '\')">'
          + '<div class="bc-card__spine" aria-hidden="true"></div>'
          + '<div class="bc-card__body">'
          + '<div class="bc-card__cover" style="' + coverStyle + '" aria-hidden="true"></div>'
          + '<div class="bc-card__info">'
          + '<div class="bc-card__meta"><span class="bc-pill bc-pill--' + e.type + '">' + (CAT_SVG[e.type]||'') + ' ' + esc(typeLabel) + '</span></div>'
          + '<div class="bc-card__title">' + esc(e.title) + '</div>'
          + (subtitle ? '<div class="bc-card__subtitle">' + esc(subtitle) + '</div>' : '')
          + '</div></div></button>';
      }).join('')
      + '</div></div>';
  }

  container.innerHTML = html;
}

function openListDetail(rkey) {
  listDetailRkey = rkey;
  renderListDetail(rkey);
}

function backToLists() {
  listDetailRkey = null;
  renderLists();
}

// ── List modal ────────────────────────────────────────────────
function openListModal(rkey) {
  var list = rkey ? lists.find(function(l) { return l.rkey === rkey; }) : null;
  editListRkey = rkey || null;
  listSelColor = list ? (list.color || '#5F6B43') : '#5F6B43';
  listSelItems = list ? (list.items ? list.items.slice() : []) : [];

  $('list-modal-title').textContent = list ? 'Edit list' : 'New list';
  $('list-name').value = list ? list.name : '';
  $('list-desc').value = list ? (list.description || '') : '';
  $('list-modal-delete').style.display = list ? 'inline-flex' : 'none';

  renderColorSwatches();
  renderEntryPicker();
  $('list-modal').style.display = 'flex';
  setTimeout(function() { $('list-name').focus(); }, 60);
}

function closeListModal() {
  $('list-modal').style.display = 'none';
}

function renderColorSwatches() {
  var el = $('list-color-swatches');
  if (!el) return;
  el.innerHTML = LIST_COLORS.map(function(hex) {
    return '<button type="button" class="bc-color-swatch' + (listSelColor === hex ? ' is-active' : '') + '"'
      + ' style="background:' + hex + '" aria-label="Color ' + hex + '"'
      + ' onclick="pickListColor(\'' + hex + '\')"></button>';
  }).join('');
}

function pickListColor(hex) {
  listSelColor = hex;
  renderColorSwatches();
}

function pickAccentColor(hex) {
  document.documentElement.style.setProperty('--accent', hex);
  localStorage.setItem('bc_accent', hex);
  renderSettings();
}

function renderEntryPicker() {
  var el = $('list-entry-picker');
  if (!el) return;
  if (!entries.length) { el.innerHTML = ''; return; }
  el.innerHTML = entries.map(function(e) {
    var sel = listSelItems.indexOf(e.rkey) !== -1;
    var coverStyle = e.coverUrl
      ? 'background-image:url(' + esc(e.coverUrl) + ');background-size:cover;background-position:center'
      : 'background:' + (COVER_BG[e.type]||COVER_BG.book);
    var checkMark = sel ? '<svg width="11" height="9" viewBox="0 0 11 9" fill="none"><polyline points="1,4.5 4,7.5 10,1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' : '';
    return '<div class="bc-entry-pick' + (sel ? ' is-selected' : '') + '" onclick="toggleListItem(\'' + e.rkey + '\')">'
      + '<div class="bc-entry-pick__check">' + checkMark + '</div>'
      + '<div class="bc-entry-pick__cover" style="' + coverStyle + '"></div>'
      + '<div class="bc-entry-pick__info">'
      + '<div class="bc-entry-pick__title">' + esc(e.title) + '</div>'
      + '<div class="bc-entry-pick__sub">' + esc(LABELS[e.type]||e.type) + '</div>'
      + '</div>'
      + '</div>';
  }).join('');
  updateEntryCount();
}

function toggleListItem(rkey) {
  var idx = listSelItems.indexOf(rkey);
  if (idx === -1) listSelItems.push(rkey);
  else listSelItems.splice(idx, 1);
  renderEntryPicker();
}

function updateEntryCount() {
  var el = $('list-entry-count');
  if (el) el.textContent = listSelItems.length ? listSelItems.length + ' selected' : '';
}

async function saveList() {
  var name = ($('list-name').value || '').trim();
  if (!name) { $('list-name').focus(); toast('Give your list a name', 'error'); return; }

  var list = {
    rkey:        editListRkey,
    name:        name,
    description: ($('list-desc').value || '').trim(),
    color:       listSelColor,
    items:       listSelItems.slice(),
    createdAt:   editListRkey
      ? (lists.find(function(l){return l.rkey===editListRkey;})||{}).createdAt || new Date().toISOString()
      : new Date().toISOString()
  };

  $('list-modal-save').textContent = 'Saving…';
  $('list-modal-save').disabled = true;

  try {
    if (isDemo) {
      if (editListRkey) {
        var idx = lists.findIndex(function(l) { return l.rkey === editListRkey; });
        if (idx !== -1) lists[idx] = list;
        else lists.unshift(list);
      } else {
        list.rkey = 'list-' + Date.now();
        lists.unshift(list);
      }
      saveDemoLists();
    } else {
      await atpSaveList(list);
      if (editListRkey) {
        var idx = lists.findIndex(function(l) { return l.rkey === editListRkey; });
        if (idx !== -1) lists[idx] = list;
        else lists.unshift(list);
      } else {
        lists.unshift(list);
      }
    }
    closeListModal();
    if (listDetailRkey && listDetailRkey === editListRkey) {
      renderListDetail(list.rkey);
    } else {
      listDetailRkey = null;
      renderLists();
    }
    toast(editListRkey ? 'List updated' : 'List created');
  } catch(e) {
    toast('Could not save list: ' + e.message, 'error');
  } finally {
    $('list-modal-save').textContent = 'Save list';
    $('list-modal-save').disabled = false;
  }
}

async function deleteList(rkey) {
  if (!confirm('Delete this list? This cannot be undone.')) return;
  try {
    if (!isDemo) await atpDeleteList(rkey);
    lists = lists.filter(function(l) { return l.rkey !== rkey; });
    if (isDemo) saveDemoLists();
    closeListModal();
    listDetailRkey = null;
    renderLists();
    toast('List deleted');
  } catch(e) {
    toast('Could not delete list: ' + e.message, 'error');
  }
}

async function refreshEntries() {
  if (isDemo) { toast('Demo mode: no server to refresh'); return; }
  await loadEntries();
  toast('Refreshed from PDS');
}

// ── Progress formatting ───────────────────────────────────────
function formatProgress(entry) {
  var p = entry.progress;
  if (!p) return null;
  if (typeof p === 'string') return p;
  var t = entry.type;
  if (t === 'book') {
    if (p.currentPage && p.totalPages) return 'p.\u202f' + p.currentPage + '\u202f/\u202f' + p.totalPages;
    if (p.currentPage)    return 'p.\u202f' + p.currentPage;
    if (p.positionSeconds) return fmtSecs(p.positionSeconds);
    return null;
  }
  if (t === 'show') {
    var parts = [];
    if (p.season)  parts.push('S' + p.season);
    if (p.episode) parts.push('E' + p.episode);
    return parts.join('\u202f') || null;
  }
  if (t === 'movie') return p.positionSeconds ? fmtSecs(p.positionSeconds) : null;
  if (t === 'game') {
    var gp = [];
    if (p.playtimeMinutes)   gp.push(Math.round(p.playtimeMinutes/60) + 'h played');
    if (p.completionPercent) gp.push(p.completionPercent + '%');
    if (p.narrativePosition) gp.push(p.narrativePosition);
    return gp.join(' · ') || null;
  }
  if (t === 'podcast') {
    var pp = [];
    if (p.episodeNumber)  pp.push('Ep\u202f' + p.episodeNumber);
    if (p.positionSeconds) pp.push(fmtSecs(p.positionSeconds));
    return pp.join(' · ') || null;
  }
  return null;
}

// ── Render ───────────────────────────────────────────────────
function render() {
  var shown = filterType === 'all'
    ? entries
    : entries.filter(function(e) { return e.type === filterType; });

  if (filterStatuses.length > 0) {
    shown = shown.filter(function(e) {
      return filterStatuses.indexOf(e.status || STATUS.inProgress) !== -1;
    });
  }

  var list  = $('entries');
  var empty = $('empty');

  if (!shown.length) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    var isFiltered = filterType !== 'all' || filterStatuses.length > 0;
    $('empty-title').textContent = isFiltered ? 'No matches' : 'Drop your first breadcrumb';
    $('empty-body').textContent  = isFiltered
      ? 'Nothing here with those filters. Try clearing them, or tap + to add something new.'
      : 'Start tracking a book, show, film, game, or podcast. Always know exactly where you left off.';
    return;
  }
  empty.classList.add('hidden');

  var sorted = shown.slice().sort(function(a, b) {
    return new Date(entryActivityTs(b)) - new Date(entryActivityTs(a));
  });

  var lastKey = null;
  list.innerHTML = sorted.map(function(e) {
    var ts  = entryActivityTs(e);
    var key = dayKey(ts);
    var header = '';
    if (key !== lastKey) {
      header = '<div class="bc-day-header">' + esc(fmtDayHeader(ts)) + '</div>';
      lastKey = key;
    }

    var coverStyle = e.coverUrl
      ? 'background-image:url(' + esc(e.coverUrl) + ');background-size:cover;background-position:center'
      : 'background:' + (COVER_BG[e.type] || COVER_BG.book);

    var subtitle  = (e.authors||[]).join(', ') || e.creator || e.developer || '';
    var prog      = formatProgress(e);
    var statusStr = e.status !== STATUS.inProgress ? (STATUS_LABELS[e.status]||'') : '';
    var typeLabel = LABELS[e.type] || e.type;

    return header
      + '<button class="bc-card bc-card--' + e.type + '"'
      + ' onclick="openDetail(\'' + esc(e.rkey) + '\',\'' + esc(e.collection) + '\')"'
      + ' aria-label="' + esc(e.title) + '">'

      + '<div class="bc-card__spine" aria-hidden="true"></div>'

      + '<div class="bc-card__body">'

      + '<div class="bc-card__cover" style="' + coverStyle + '" aria-hidden="true"></div>'

      + '<div class="bc-card__info">'
      + '<div class="bc-card__meta">'
      + '<span class="bc-pill bc-pill--' + e.type + '">'
      + (CAT_SVG[e.type]||'') + ' ' + esc(typeLabel)
      + '</span>'
      + '<span class="bc-card__date">' + fmtDate(ts) + '</span>'
      + '</div>'

      + '<div class="bc-card__title">' + esc(e.title) + '</div>'
      + (subtitle  ? '<div class="bc-card__subtitle">' + esc(subtitle) + '</div>' : '')
      + (prog      ? '<div class="bc-card__progress">' + esc(prog) + '</div>' : '')
      + (statusStr ? '<div class="bc-card__status">' + esc(statusStr) + '</div>' : '')
      + (e.notes   ? '<div class="bc-card__notes">' + esc(e.notes) + '</div>' : '')

      + '</div>'  // .bc-card__info
      + '</div>'  // .bc-card__body
      + '</button>';
  }).join('');
  renderSidebar();
}

// ── Desktop sidebar ───────────────────────────────────────────
function renderSidebar() {
  var el = $('desktop-sidebar');
  if (!el) return;
  var inProg = entries.filter(function(e) { return e.status === STATUS.inProgress; }).slice(0, 6);
  var TYPE_LABEL = { book:'Book', show:'Show', movie:'Film', game:'Game', podcast:'Podcast' };
  if (!inProg.length) {
    el.innerHTML = '<div class="bc-sidebar__heading">Currently</div>'
      + '<div class="bc-sidebar__empty">Nothing in progress yet.</div>';
    return;
  }
  el.innerHTML = '<div class="bc-sidebar__heading">Currently</div>'
    + inProg.map(function(e) {
      var coverStyle = e.coverUrl
        ? 'background-image:url(' + esc(e.coverUrl) + ');background-size:cover;background-position:center'
        : 'background:' + (COVER_BG[e.type] || COVER_BG.book);
      var prog = '';
      if (e.type === 'book' && e.currentPage && e.totalPages)
        prog = 'p. ' + e.currentPage + ' / ' + e.totalPages;
      else if (e.type === 'show' && e.season)
        prog = 'S' + e.season + (e.episode ? ' E' + e.episode : '');
      else if ((e.type === 'movie' || e.type === 'podcast') && e.timestamp)
        prog = e.timestamp;
      return '<button class="bc-sidebar-card bc-card--' + e.type + '" onclick="openEdit(\'' + e.rkey + '\',\'app.breadcrumbs.' + e.type + '\')">'
        + '<div class="bc-sidebar-card__cover" style="' + coverStyle + '"></div>'
        + '<div class="bc-sidebar-card__info">'
        + '<div class="bc-sidebar-card__type">' + (CAT_SVG[e.type] || '') + ' ' + (TYPE_LABEL[e.type] || e.type) + '</div>'
        + '<div class="bc-sidebar-card__title">' + esc(e.title) + '</div>'
        + (e.creator ? '<div class="bc-sidebar-card__sub">' + esc(e.creator) + '</div>' : '')
        + (prog       ? '<div class="bc-sidebar-card__prog">' + esc(prog) + '</div>' : '')
        + '</div></button>';
    }).join('');
}

// ── Filter ───────────────────────────────────────────────────
function setFilter(f) {
  filterType = f;
  $$('.bc-filter').forEach(function(b) {
    var active = b.dataset.f === f;
    b.classList.toggle('is-active', active);
    b.setAttribute('aria-selected', active);
  });
  render();
}

function setStatusFilter(s) {
  var idx = filterStatuses.indexOf(s);
  if (idx === -1) {
    filterStatuses.push(s);
  } else if (filterStatuses.length > 1) {
    filterStatuses.splice(idx, 1);
  }
  $$('.bc-sfilter').forEach(function(b) {
    b.classList.toggle('is-active', filterStatuses.indexOf(b.dataset.sf) !== -1);
  });
  render();
}

// ── Tab switching ─────────────────────────────────────────────
function switchTab(tab) {
  window.scrollTo(0, 0);
  $$('.bc-tab').forEach(function(t) {
    var active = t.dataset.tab === tab;
    t.classList.toggle('is-active', active);
    t.setAttribute('aria-selected', active);
  });
  $$('.tab-panel').forEach(function(p) {
    p.classList.toggle('active', p.id === tab + '-panel');
  });
  if (tab === 'analytics') updateStats();
  if (tab === 'settings')  renderSettings();
  if (tab === 'lists')     renderLists();
}

// ── Modal ────────────────────────────────────────────────────
function openAdd() {
  editRkey = null; editCollection = null; selectedMedia = null;
  $('modal-title').textContent = 'Drop a breadcrumb';
  $('f-notes').value = '';
  $('f-search').value = '';
  $('delete-btn').classList.add('hidden');
  $('selected-media').classList.add('hidden');
  $('search-group').classList.remove('hidden');
  selGenre = ''; selRating = 0;
  pickType('book');
  pickStatus(STATUS.inProgress);
  updateStars();
  $('entry-modal').style.display = 'flex';
}

function openEdit(rkey, collection) {
  var e = entries.find(function(x) { return x.rkey === rkey && x.collection === collection; });
  if (!e) return;

  editRkey = rkey; editCollection = collection; selectedMedia = null;
  $('modal-title').textContent = 'Edit entry';
  $('f-notes').value = e.notes || '';
  $('f-search').value = '';
  $('delete-btn').classList.remove('hidden');

  if (e.coverUrl || e.description) {
    selectedMedia = {title:e.title, coverUrl:e.coverUrl||null, description:e.description||null};
    $('selected-media').classList.remove('hidden');
    $('selected-cover').style.cssText = 'background-image:url(' + esc(e.coverUrl) + ');background-size:cover;background-position:center';
    $('selected-title').textContent = e.title;
    $('selected-meta1').textContent = (e.authors||[]).join(', ') || e.creator || e.developer || '';
    $('selected-meta2').textContent = '';
    $('search-group').classList.add('hidden');
  } else {
    $('selected-media').classList.add('hidden');
    $('search-group').classList.remove('hidden');
    $('f-search').value = e.title || '';
  }

  selGenre  = (e.genres && e.genres[0]) || '';
  selRating = e.rating || 0;
  pickType(e.type);
  pickStatus(e.status || STATUS.inProgress);
  populateProgressFields(e);
  updateStars();
  $('entry-modal').style.display = 'flex';
}

function closeModal() { $('entry-modal').style.display = 'none'; }

// ── Bug report ────────────────────────────────────────────────
var APP_VERSION = 'v2.1.0';

function openBugReport() {
  $('bug-title').value = '';
  $('bug-body').value  = '';
  $('bug-include-meta').checked = true;
  $('bug-error').classList.add('hidden');
  $('bug-error').textContent = '';
  $('bug-submit').disabled = false;
  $('bug-submit').textContent = 'Send report';
  $('bug-modal').style.display = 'flex';
  setTimeout(function() { $('bug-title').focus(); }, 50);
}
function closeBugReport() { $('bug-modal').style.display = 'none'; }

async function submitBugReport() {
  var title = $('bug-title').value.trim();
  var body  = $('bug-body').value.trim();
  var err   = $('bug-error');
  err.classList.add('hidden'); err.textContent = '';

  if (!title) { err.textContent = 'A short title is required.'; err.classList.remove('hidden'); return; }
  if (!body)  { err.textContent = 'Please describe what happened.'; err.classList.remove('hidden'); return; }

  var includeMeta = $('bug-include-meta').checked;
  var payload = { title:title, body:body, version:APP_VERSION };
  if (includeMeta) {
    payload.ua       = navigator.userAgent || '';
    payload.viewport = window.innerWidth + 'x' + window.innerHeight;
    payload.palette  = localStorage.getItem('bc_palette') || '';
    payload.mode     = document.documentElement.getAttribute('data-mode') || '';
  }

  $('bug-submit').disabled = true;
  $('bug-submit').textContent = 'Sending…';

  try {
    var res = await fetch('/api/report-bug', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    var data;
    try { data = await res.json(); } catch(e) { data = {}; }
    if (!res.ok) {
      err.textContent = data.error || 'Could not send the report. Please try again.';
      err.classList.remove('hidden');
      $('bug-submit').disabled = false;
      $('bug-submit').textContent = 'Send report';
      return;
    }
    closeBugReport();
    var msg = data.number ? ('Reported as issue #' + data.number + '. Thank you.') : 'Report sent. Thank you.';
    toast(msg);
  } catch(e) {
    err.textContent = 'Network error. Please try again.';
    err.classList.remove('hidden');
    $('bug-submit').disabled = false;
    $('bug-submit').textContent = 'Send report';
  }
}

// ── Draft persistence (preserves an in-flight entry across re-auth) ───
var DRAFT_KEY = 'bc_draft_entry';
function captureFormDraft() {
  var modalOpen = $('entry-modal') && $('entry-modal').style.display === 'flex';
  if (!modalOpen) return;
  try {
    var draft = {
      editRkey:       editRkey,
      editCollection: editCollection,
      selType:        selType,
      selStatus:      selStatus,
      selGenre:       selGenre,
      selRating:      selRating,
      selectedMedia:  selectedMedia,
      title:          ($('f-search') && $('f-search').value) || '',
      notes:          ($('f-notes')  && $('f-notes').value)  || '',
      progress:       buildProgressObject(selType),
      savedAt:        new Date().toISOString()
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch(e) {}
}
function restoreFormDraftIfPresent() {
  var raw; try { raw = localStorage.getItem(DRAFT_KEY); } catch(e) { raw = null; }
  if (!raw) return;
  var d; try { d = JSON.parse(raw); } catch(e) { return; }
  localStorage.removeItem(DRAFT_KEY);
  if (!d) return;
  editRkey       = d.editRkey || null;
  editCollection = d.editCollection || null;
  selectedMedia  = d.selectedMedia || null;
  selGenre       = d.selGenre || '';
  selRating      = d.selRating || 0;
  pickType(d.selType || 'book');
  pickStatus(d.selStatus || STATUS.inProgress);
  if ($('f-search')) $('f-search').value = d.title || '';
  if ($('f-notes'))  $('f-notes').value  = d.notes || '';
  if (selectedMedia && (selectedMedia.coverUrl || selectedMedia.description)) {
    $('selected-media').classList.remove('hidden');
    $('search-group').classList.add('hidden');
    if (selectedMedia.coverUrl) {
      $('selected-cover').style.cssText = 'background-image:url(' + esc(selectedMedia.coverUrl) + ');background-size:cover;background-position:center';
    }
    $('selected-title').textContent = selectedMedia.title || '';
  }
  if (d.progress) {
    populateProgressFields({type:d.selType, progress:d.progress});
  }
  updateStars();
  $('modal-title').textContent = editRkey ? 'Finish your edit' : 'Finish your breadcrumb';
  $('entry-modal').style.display = 'flex';
  toast('We kept your unsaved entry.');
}

function pickType(t) {
  selType = t;
  $$('.bc-type').forEach(function(b) {
    b.classList.toggle('is-active', b.dataset.t === t);
  });
  ['book','show','movie','game','podcast'].forEach(function(mt) {
    var el = $('prog-' + mt);
    if (el) el.classList.toggle('hidden', mt !== t);
  });
  if (!editRkey) clearProgressFields();
}

function pickStatus(s) {
  selStatus = s;
  $$('.bc-sbtn').forEach(function(b) {
    b.classList.toggle('is-active', b.dataset.s === s);
  });
  $('progress-group').classList.toggle('hidden', s === STATUS.wantTo);
  $('rating-group').classList.toggle('hidden', s !== STATUS.completed);
}

function pickRating(r) { selRating = selRating === r ? 0 : r; updateStars(); }

function updateStars() {
  $$('.bc-star').forEach(function(s) {
    s.textContent = +s.dataset.r <= selRating ? '★' : '☆';
  });
}

function clearProgressFields() {
  ['f-curr-page','f-total-pages','f-season','f-episode',
   'f-playtime','f-completion','f-narrative','f-ep-num','f-ep-pos']
    .forEach(function(id) { var el = $(id); if (el) el.value = ''; });
}

function populateProgressFields(entry) {
  clearProgressFields();
  var p = entry.progress;
  if (!p || typeof p === 'string') return;
  var t = entry.type;
  if (t === 'book') {
    if ($('f-curr-page'))   $('f-curr-page').value   = p.currentPage  || '';
    if ($('f-total-pages')) $('f-total-pages').value  = p.totalPages   || '';
  } else if (t === 'show') {
    if ($('f-season'))  $('f-season').value  = p.season  || '';
    if ($('f-episode')) $('f-episode').value = p.episode || '';
  } else if (t === 'game') {
    if ($('f-playtime'))   $('f-playtime').value   = p.playtimeMinutes ? Math.round(p.playtimeMinutes/60) : '';
    if ($('f-completion')) $('f-completion').value = p.completionPercent || '';
    if ($('f-narrative'))  $('f-narrative').value  = p.narrativePosition || '';
  } else if (t === 'podcast') {
    if ($('f-ep-num')) $('f-ep-num').value = p.episodeNumber || '';
    if ($('f-ep-pos')) $('f-ep-pos').value = p.positionSeconds ? fmtSecs(p.positionSeconds) : '';
  }
}

function buildProgressObject(type) {
  var now = new Date().toISOString();
  if (type === 'book') {
    var cp = parseInt($('f-curr-page').value)||null;
    var tp = parseInt($('f-total-pages').value)||null;
    return (cp||tp) ? {currentPage:cp, totalPages:tp, updatedAt:now} : null;
  }
  if (type === 'show') {
    var ep = parseInt($('f-episode').value)||null;
    if (!ep) return null;
    return {season:parseInt($('f-season').value)||null, episode:ep, updatedAt:now};
  }
  if (type === 'movie') return null;
  if (type === 'game') {
    var pt = parseFloat($('f-playtime').value);
    var pm = (!isNaN(pt) && pt > 0) ? Math.round(pt*60) : null;
    var pc = parseInt($('f-completion').value)||null;
    var np = $('f-narrative').value.trim()||null;
    return (pm||pc||np) ? {playtimeMinutes:pm, completionPercent:pc, narrativePosition:np, updatedAt:now} : null;
  }
  if (type === 'podcast') {
    var en = parseInt($('f-ep-num').value)||null;
    var ps = parseSecs($('f-ep-pos').value.trim())||null;
    return (en||ps) ? {episodeNumber:en, positionSeconds:ps, updatedAt:now} : null;
  }
  return null;
}

async function saveEntry() {
  var title = ((selectedMedia && selectedMedia.title) || $('f-search').value || '').trim();
  if (!title) { toast('Title is required', 'error'); return; }

  var entryData = {
    type:      selType,
    title:     title,
    status:    selStatus,
    progress:  selStatus !== STATUS.wantTo ? buildProgressObject(selType) : null,
    notes:     $('f-notes').value.trim() || null,
    genres:    selGenre ? [selGenre] : null,
    rating:    selRating || null,
    coverUrl:    selectedMedia?.coverUrl    || null,
    authors:     selectedMedia?.authors     || null,
    creator:     selectedMedia?.creator     || null,
    developer:   selectedMedia?.developer   || null,
    description: selectedMedia?.description || null
  };

  $('save-btn').textContent = 'Saving…';
  $('save-btn').disabled = true;

  try {
    if (isDemo) {
      if (editRkey) {
        var idx = entries.findIndex(function(e) { return e.rkey === editRkey; });
        if (idx >= 0) entries[idx] = Object.assign({}, entries[idx], entryData);
      } else {
        entryData.rkey       = Date.now().toString();
        entryData.collection = ATP_COLLECTIONS[selType] || ATP_COLLECTIONS.book;
        entryData.createdAt  = new Date().toISOString();
        entries.unshift(entryData);
      }
      saveDemoEntries();
      toast(editRkey ? 'Entry updated!' : 'Breadcrumb saved!');
    } else {
      if (editRkey && editCollection) {
        await atpUpdateEntry(editRkey, editCollection, entryData);
        toast('Entry updated!');
      } else {
        await atpCreateEntry(entryData);
        toast('Saved to your PDS!');
      }
      await atpGetEntries();
    }
    render(); updateStats(); closeModal();
  } catch(e) {
    if (isExpiredTokenError(e)) {
      captureFormDraft();
      // authExpired() shows its own toast and routes to sign-in.
    } else {
      toast('Save failed: ' + e.message, 'error');
    }
  } finally {
    $('save-btn').textContent = 'Save';
    $('save-btn').disabled = false;
  }
}

async function deleteEntry() {
  if (!editRkey) return;
  $('delete-btn').textContent = 'Deleting…';
  $('delete-btn').disabled = true;
  try {
    if (isDemo) {
      entries = entries.filter(function(e) { return e.rkey !== editRkey; });
      saveDemoEntries();
    } else {
      await atpDeleteEntry(editRkey, editCollection);
      await atpGetEntries();
    }
    render(); updateStats(); closeModal();
    toast('Entry deleted');
  } catch(e) {
    toast('Delete failed: ' + e.message, 'error');
  } finally {
    $('delete-btn').textContent = 'Delete entry';
    $('delete-btn').disabled = false;
  }
}

// ── Search ───────────────────────────────────────────────────
function searchMedia(query) {
  var results = $('search-results');
  results.innerHTML = '<div class="bc-search-msg">Searching…</div>';
  results.classList.remove('hidden');
  if      (selType === 'book')  searchBooks(query);
  else if (selType === 'show')  searchTMDB(query, 'tv');
  else if (selType === 'movie') searchTMDB(query, 'movie');
  else if (selType === 'game')    searchGames(query);
  else if (selType === 'podcast') searchPodcasts(query);
  else results.innerHTML = '<div class="bc-search-msg">Enter title manually.</div>';
}

function renderSearchResults(items) {
  var results = $('search-results');
  if (!items.length) {
    results.innerHTML = '<div class="bc-search-msg">No results found.</div>';
    return;
  }
  results.innerHTML = items.map(function(item) {
    var coverStyle = item.cover
      ? 'background-image:url(' + esc(item.cover) + ');background-size:cover;background-position:center'
      : 'background:' + (COVER_BG[selType]||COVER_BG.book);
    return '<button class="bc-search-row"'
      + ' data-title="'     + esc(item.title)       + '"'
      + ' data-cover="'     + esc(item.cover||'')   + '"'
      + ' data-author="'    + esc(item.author||'')  + '"'
      + ' data-year="'      + esc(item.year||'')    + '"'
      + ' data-isbn13="'    + esc(item.isbn13||'')  + '"'
      + ' data-pages="'     + esc(String(item.pages||''))     + '"'
      + ' data-developer="'   + esc(item.developer||'')   + '"'
      + ' data-rawg-id="'     + esc(String(item.rawgId||''))  + '"'
      + ' data-description="' + esc((item.description||'').slice(0,600)) + '">'
      + '<div class="bc-search-row__cover" style="' + coverStyle + '" aria-hidden="true"></div>'
      + '<div>'
      + '<div class="bc-search-row__title">' + esc(item.title) + '</div>'
      + '<div class="bc-search-row__sub">' + esc(item.author||item.year||'') + '</div>'
      + '</div>'
      + '</button>';
  }).join('');
  results.querySelectorAll('.bc-search-row').forEach(function(row) {
    row.onclick = function() { selectResult(this); };
  });
}

function searchTMDB(query, type) {
  fetch('/api/tmdb?query=' + encodeURIComponent(query) + '&type=' + type)
    .then(function(r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function(data) {
      if (!data.results?.length) { renderSearchResults([]); return; }
      renderSearchResults(data.results.slice(0,6).map(function(item) {
        return {
          title:       item.title || item.name,
          year:        (item.release_date || item.first_air_date || '').slice(0,4),
          cover:       item.poster_path ? 'https://image.tmdb.org/t/p/w200' + item.poster_path : '',
          description: item.overview || ''
        };
      }));
    })
    .catch(function() {
      $('search-results').innerHTML = '<div class="bc-search-msg">Search unavailable. Enter title manually.</div>';
    });
}

function searchBooks(query) {
  fetch('https://www.googleapis.com/books/v1/volumes?q=' + encodeURIComponent(query) + '&maxResults=6')
    .then(function(r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function(data) {
      if (data.items?.length) {
        renderSearchResults(data.items.map(function(item) {
          var v = item.volumeInfo;
          var isbn = (v.industryIdentifiers||[]).find(function(x) { return x.type==='ISBN_13'; });
          return {
            title:       v.title || 'Unknown',
            author:      (v.authors||[]).join(', '),
            year:        (v.publishedDate||'').slice(0,4),
            cover:       v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail || '',
            isbn13:      isbn ? isbn.identifier : '',
            pages:       v.pageCount || '',
            description: v.description || ''
          };
        }));
      } else {
        searchOpenLibrary(query);
      }
    })
    .catch(function() { searchOpenLibrary(query); });
}

function searchOpenLibrary(query) {
  fetch('https://openlibrary.org/search.json?q=' + encodeURIComponent(query) + '&limit=8&fields=title,author_name,cover_i,number_of_pages_median,first_publish_year')
    .then(function(r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function(data) {
      if (!data.docs?.length) { renderSearchResults([]); return; }
      renderSearchResults(data.docs.slice(0, 6).map(function(doc) {
        return {
          title:  doc.title || 'Unknown',
          author: (doc.author_name||[]).join(', '),
          year:   doc.first_publish_year ? String(doc.first_publish_year) : '',
          cover:  doc.cover_i ? 'https://covers.openlibrary.org/b/id/' + doc.cover_i + '-M.jpg' : '',
          pages:  doc.number_of_pages_median || ''
        };
      }));
    })
    .catch(function() {
      $('search-results').innerHTML = '<div class="bc-search-msg">Search unavailable. Enter title manually.</div>';
    });
}

function searchPodcasts(query) {
  fetch('https://itunes.apple.com/search?term=' + encodeURIComponent(query) + '&media=podcast&entity=podcast&limit=6')
    .then(function(r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function(data) {
      if (!data.results?.length) { renderSearchResults([]); return; }
      renderSearchResults(data.results.map(function(item) {
        return {
          title:       item.collectionName || item.trackName || '',
          author:      item.artistName || '',
          cover:       item.artworkUrl100 || '',
          description: item.genres ? item.genres.join(', ') : ''
        };
      }));
    })
    .catch(function() {
      $('search-results').innerHTML = '<div class="bc-search-msg">Search unavailable. Enter title manually.</div>';
    });
}

function searchGames(query) {
  fetch('/api/rawg?query=' + encodeURIComponent(query))
    .then(function(r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function(data) {
      if (!data.results?.length) { renderSearchResults([]); return; }
      renderSearchResults(data.results.slice(0,6).map(function(item) {
        return {
          title:  item.name,
          year:   (item.released||'').slice(0,4),
          cover:  item.background_image || '',
          rawgId: item.id
        };
      }));
    })
    .catch(function() {
      $('search-results').innerHTML = '<div class="bc-search-msg">Search unavailable. Enter title manually.</div>';
    });
}

function selectResult(el) {
  var d = el.dataset;
  selectedMedia = {
    title:       d.title       || '',
    coverUrl:    d.cover       || '',
    authors:     d.author      ? [d.author] : null,
    isbn13:      d.isbn13      || null,
    developer:   d.developer   || null,
    description: d.description || null
  };
  $('selected-media').classList.remove('hidden');
  $('selected-cover').style.cssText = selectedMedia.coverUrl
    ? 'background-image:url(' + esc(selectedMedia.coverUrl) + ');background-size:cover;background-position:center'
    : 'background:' + (COVER_BG[selType]||COVER_BG.book);
  $('selected-title').textContent = selectedMedia.title;
  $('selected-meta1').textContent = d.author || d.year || '';
  $('selected-meta2').textContent = d.pages ? d.pages + ' pages' : (d.year && d.author ? d.year : '');
  $('f-search').value = '';
  $('search-results').classList.add('hidden');
  $('search-group').classList.add('hidden');

  // For games, async-fetch description from RAWG detail endpoint
  if (d.rawgId) {
    fetch('/api/rawg-detail?id=' + encodeURIComponent(d.rawgId))
      .then(function(r) { return r.json(); })
      .then(function(data) { if (selectedMedia && data.description_raw) selectedMedia.description = data.description_raw; })
      .catch(function() {});
  }

  // Auto-fill progress fields from API data
  if (selType === 'book' && d.pages) {
    var tp = $('f-total-pages');
    if (tp && !tp.value) tp.value = d.pages;
  }
}

function clearSelection() {
  selectedMedia = null;
  $('selected-media').classList.add('hidden');
  $('search-group').classList.remove('hidden');
  $('f-search').value = '';
}


// ── Analytics ────────────────────────────────────────────────
var HEAT_DAYS = 90;
function generateHeat(entries) {
  var today  = new Date();
  today.setHours(0,0,0,0);
  var dayMs  = 24 * 3600 * 1000;
  var types  = ['book','show','movie','game','podcast'];
  var heat   = {};
  types.forEach(function(t) {
    heat[t] = {};
    for (var i = 0; i < HEAT_DAYS; i++) heat[t][i] = 0;
  });
  entries.forEach(function(e) {
    if (!heat[e.type]) return;
    var stamp = e.progress && e.progress.updatedAt ? e.progress.updatedAt : e.createdAt;
    var d = new Date(stamp);
    d.setHours(0,0,0,0);
    var daysAgo = Math.floor((today - d) / dayMs);
    if (daysAgo >= 0 && daysAgo < HEAT_DAYS) {
      var idx = (HEAT_DAYS - 1) - daysAgo;
      heat[e.type][idx] = Math.min(3, heat[e.type][idx] + 1);
    }
  });
  return heat;
}

function updateStats() {
  var container = $('analytics-container');
  if (!container) return;

  var types = ['book','show','movie','game','podcast'];
  var counts = {book:0,show:0,movie:0,game:0,podcast:0};
  var sc = {};
  Object.values(STATUS).forEach(function(s) { sc[s] = 0; });

  entries.forEach(function(e) {
    if (counts.hasOwnProperty(e.type)) counts[e.type]++;
    if (sc.hasOwnProperty(e.status)) sc[e.status]++;
  });

  var max = Math.max(1, Math.max.apply(null, Object.values(counts)));
  var heatData = generateHeat(entries);

  // Build heat cells: 5 rows (one per category) × HEAT_DAYS cols (days)
  var heatTypes = ['book','show','movie','game','podcast'];
  var heatCells = '';
  for (var row = 0; row < 5; row++) {
    var t = heatTypes[row];
    for (var col = 0; col < HEAT_DAYS; col++) {
      var level = heatData[t] ? (heatData[t][col] || 0) : 0;
      heatCells += '<div class="bc-heat__cell bc-heat__cell--' + t + '"'
        + (level ? ' data-level="' + level + '"' : '') + '></div>';
    }
  }

  var html =
    '<div class="bc-stats">'
    + '<h2 class="bc-stats__title">Your year in <em>breadcrumbs</em></h2>'
    + '<p class="bc-stats__sub">' + entries.length + ' entries · ' + (sc[STATUS.completed]||0) + ' finished.</p>'
    + '<div class="bc-ornament">❦</div>'
    + types.map(function(t) {
        return '<div class="bc-bar">'
          + '<span class="bc-bar__label">'
          + '<span class="bc-bar__label-dot bc-bar__label-dot--' + t + '"></span>'
          + LABELS[t] + 's'
          + '</span>'
          + '<div class="bc-bar__track">'
          + '<div class="bc-bar__fill bc-bar__fill--' + t + '" style="width:' + (counts[t]/max*100) + '%"></div>'
          + '</div>'
          + '<span class="bc-bar__count">' + counts[t] + '</span>'
          + '</div>';
      }).join('')
    + '</div>'

    + '<div class="bc-heat">'
    + '<h3>The stopping points</h3>'
    + '<p class="bc-heat__sub">Every breadcrumb dropped, the past ' + HEAT_DAYS + ' days.</p>'
    + '<div class="bc-heat__grid" style="grid-template-columns:repeat(' + HEAT_DAYS + ',1fr)">' + heatCells + '</div>'
    + '<div class="bc-heat__legend"><span>90d ago</span><span>60d ago</span><span>30d ago</span><span>Today</span></div>'
    + '</div>'

    + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">'
    + [
        {n: sc[STATUS.inProgress]||0, l:'In progress'},
        {n: sc[STATUS.completed]||0,  l:'Completed'},
        {n: sc[STATUS.onHold]||0,     l:'On hold'},
        {n: sc[STATUS.wantTo]||0,     l:'Want to'},
        {n: sc[STATUS.abandoned]||0,  l:'Abandoned'},
        {n: entries.length,           l:'Total entries'}
      ].map(function(c) {
        return '<div class="bc-statuscell">'
          + '<span class="bc-statuscell__n">' + c.n + '</span>'
          + '<span class="bc-statuscell__l">' + c.l + '</span>'
          + '</div>';
      }).join('')
    + '</div>';

  // Consumption totals
  var totalPages = entries
    .filter(function(e) { return e.type === 'book' && e.progress && e.progress.currentPage; })
    .reduce(function(sum, e) { return sum + (e.progress.currentPage || 0); }, 0);
  var totalHours = Math.round(entries
    .filter(function(e) { return e.type === 'game' && e.progress && e.progress.playtimeMinutes; })
    .reduce(function(sum, e) { return sum + (e.progress.playtimeMinutes || 0); }, 0) / 60);
  var totalEpisodes = entries.reduce(function(sum, e) {
    if (!e.progress) return sum;
    if (e.type === 'show'    && e.progress.episode)       return sum + e.progress.episode;
    if (e.type === 'podcast' && e.progress.episodeNumber) return sum + e.progress.episodeNumber;
    return sum;
  }, 0);
  var filmsWatched = entries.filter(function(e) {
    return e.type === 'movie' && e.status === STATUS.completed;
  }).length;
  var podcastHours = Math.round(entries
    .filter(function(e) { return e.type === 'podcast' && e.progress && e.progress.positionSeconds; })
    .reduce(function(sum, e) { return sum + (e.progress.positionSeconds || 0); }, 0) / 3600);

  // Completion rate & avg rating
  var startedCount = (sc[STATUS.completed]||0) + (sc[STATUS.abandoned]||0);
  var completionRate = startedCount > 0 ? Math.round((sc[STATUS.completed]||0) / startedCount * 100) : null;
  var ratedEntries = entries.filter(function(e) { return e.rating; });
  var avgRating = ratedEntries.length > 0
    ? Math.round(ratedEntries.reduce(function(sum, e) { return sum + e.rating; }, 0) / ratedEntries.length * 10) / 10
    : null;

  if (totalPages || totalHours || totalEpisodes || filmsWatched || podcastHours) {
    html += '<div class="bc-consumption">'
      + '<div class="bc-consumption__title">Across all breadcrumbs</div>'
      + '<div class="bc-consumption__row">'
      + (totalPages    ? '<div class="bc-consumption__stat"><span class="bc-consumption__n">' + totalPages.toLocaleString() + '</span><span class="bc-consumption__l">pages read</span></div>' : '')
      + (totalEpisodes ? '<div class="bc-consumption__stat"><span class="bc-consumption__n">' + totalEpisodes + '</span><span class="bc-consumption__l">episodes</span></div>' : '')
      + (totalHours    ? '<div class="bc-consumption__stat"><span class="bc-consumption__n">' + totalHours + 'h</span><span class="bc-consumption__l">gaming</span></div>' : '')
      + (podcastHours  ? '<div class="bc-consumption__stat"><span class="bc-consumption__n">' + podcastHours + 'h</span><span class="bc-consumption__l">listening</span></div>' : '')
      + (filmsWatched  ? '<div class="bc-consumption__stat"><span class="bc-consumption__n">' + filmsWatched + '</span><span class="bc-consumption__l">films watched</span></div>' : '')
      + ((completionRate !== null) ? '<div class="bc-consumption__stat"><span class="bc-consumption__n">' + completionRate + '%</span><span class="bc-consumption__l">completion rate</span></div>' : '')
      + (avgRating ? '<div class="bc-consumption__stat"><span class="bc-consumption__n">★ ' + avgRating + '</span><span class="bc-consumption__l">avg rating</span></div>' : '')
      + '</div>'
      + '</div>';
  }

  container.innerHTML = html;
}

// ── Settings ─────────────────────────────────────────────────
function renderSettings() {
  var container = $('settings-container');
  if (!container) return;

  var handle  = session ? '@' + session.handle : 'Demo User';
  var did     = session ? session.did : 'Local storage only';
  var largeText  = document.getElementById('app').classList.contains('is-large-text');
  var hideCovers = document.getElementById('app').classList.contains('is-hide-covers');

  var html =
    // ── User
    '<div class="bc-settings__section">'
    + '<div class="bc-user">'
    + '<div class="bc-user__avatar">' + esc((session ? session.handle[0] : 'D').toUpperCase()) + '</div>'
    + '<div class="bc-user__info">'
    + '<div class="bc-user__handle">' + esc(handle) + '</div>'
    + '<div class="bc-user__did">' + esc(did) + '</div>'
    + (session ? '<div class="bc-user__badge">' + SVG_ATP + ' Connected to Bluesky</div>' : '')
    + '</div>'
    + '</div>'
    + '</div>'

    // ── Display
    + '<div class="bc-settings__section">'
    + '<div class="bc-settings__head">Display</div>'
    + '<div class="bc-settings__item bc-settings__item--stack">'
    + '<span class="bc-settings__item-label">Palette</span>'
    + '<div class="bc-palette-picker">'
    + PALETTES.map(function(p) {
        return '<button type="button" class="bc-palette-swatch' + (themePalette === p.id ? ' is-active' : '') + '"'
          + ' title="' + p.name + '"'
          + ' onclick="applyPalette(\'' + p.id + '\')">'
          + '<div class="bc-palette-swatch__light" style="background:' + p.light.bg + '">'
          + '<div class="bc-palette-swatch__dot" style="background:' + p.accent + '"></div>'
          + '</div>'
          + '<div class="bc-palette-swatch__dark" style="background:' + p.dark.bg + ';color:' + p.dark.fg + '">'
          + '<span class="bc-palette-swatch__name">' + p.name + '</span>'
          + '</div>'
          + '</button>';
      }).join('')
    + '</div>'
    + '</div>'
    + '<div class="bc-settings__item bc-settings__item--stack">'
    + '<span class="bc-settings__item-label">Mode</span>'
    + '<div class="bc-mode-btns">'
    + ['system','light','dark'].map(function(m) {
        return '<button type="button" class="bc-mode-btn' + (themeMode === m ? ' is-active' : '') + '"'
          + ' onclick="applyMode(\'' + m + '\')">'
          + (m === 'system' ? 'System' : m === 'light' ? 'Light' : 'Dark')
          + '</button>';
      }).join('')
    + '</div>'
    + '</div>'
    + '<button class="bc-settings__item" id="s-large-text">'
    + '<span class="bc-settings__item-label">Larger type</span>'
    + '<span class="bc-toggle' + (largeText ? ' is-on' : '') + '" role="switch" aria-checked="' + largeText + '"></span>'
    + '</button>'
    + '<button class="bc-settings__item" id="s-hide-covers">'
    + '<span class="bc-settings__item-label">Hide cover art</span>'
    + '<span class="bc-toggle' + (hideCovers ? ' is-on' : '') + '" role="switch" aria-checked="' + hideCovers + '"></span>'
    + '</button>'
    + '<div class="bc-settings__item bc-settings__item--stack">'
    + '<span class="bc-settings__item-label">Accent color</span>'
    + '<div class="bc-color-swatches bc-color-swatches--sm">'
    + ACCENT_COLORS.map(function(hex) {
        var active = (localStorage.getItem('bc_accent') || '') === hex;
        return '<button type="button" class="bc-color-swatch' + (active ? ' is-active' : '') + '"'
          + ' style="background:' + hex + '" aria-label="Accent ' + hex + '"'
          + ' onclick="pickAccentColor(\'' + hex + '\')"></button>';
      }).join('')
    + '</div>'
    + '</div>'
    + '</div>'

    // ── Your data
    + '<div class="bc-settings__section">'
    + '<div class="bc-settings__head">Your data</div>'
    + '<button class="bc-settings__item" id="s-export"><span class="bc-settings__item-label">Export as JSON</span><span class="bc-settings__item-detail">all entries &amp; lists</span>' + SVG_CHEV + '</button>'
    + '<button class="bc-settings__item" id="s-refresh"><span class="bc-settings__item-label">Refresh from PDS</span>' + SVG_CHEV + '</button>'
    + '<a class="bc-settings__item" href="https://bsky.app/profile/' + (session && session.did ? encodeURIComponent(session.did) : '') + '" target="_blank" rel="noopener" style="text-decoration:none"><span class="bc-settings__item-label">View on PDS</span><span class="bc-settings__item-detail">' + (session && session.pds ? session.pds.replace('https://','') : 'bsky.social') + '</span>' + SVG_CHEV + '</a>'
    + '</div>'

    // ── Privacy
    + '<div class="bc-settings__section">'
    + '<div class="bc-settings__head">Privacy</div>'
    + '<button class="bc-settings__item" id="s-privacy"><span class="bc-settings__item-label">Privacy details</span><span class="bc-settings__item-detail">what\'s public, what we collect</span>' + SVG_CHEV + '</button>'
    + '</div>'

    // ── Help
    + '<div class="bc-settings__section">'
    + '<div class="bc-settings__head">Help</div>'
    + '<button class="bc-settings__item" id="s-bug"><span class="bc-settings__item-label">Report a bug</span><span class="bc-settings__item-detail">files an issue on GitHub</span>' + SVG_CHEV + '</button>'
    + '</div>'

    // ── Account
    + '<div class="bc-settings__section">'
    + '<div class="bc-settings__head">Account</div>'
    + '<button class="bc-settings__item bc-settings__item--danger" id="s-logout"><span class="bc-settings__item-label">Sign out</span></button>'
    + '</div>'

    // ── About
    + '<div class="bc-settings__section">'
    + '<div class="bc-settings__head">About</div>'
    + '<div class="bc-about">'
    + SVG_LOGOMARK
    + '<div class="bc-about__name">Breadcrumbs</div>'
    + '<div class="bc-about__ver">v2.1.0 &middot; built on AT Protocol</div>'
    + '<div class="bc-about__tag">Made for keepers of reading journals.</div>'

    + '<div class="bc-about__desc">'
    + 'Breadcrumbs is a personal media log for people who never want to lose their place. '
    + 'Track where you left off in books, shows, films, games, and podcasts, then pick up right where you stopped.'
    + '</div>'

    + '<div class="bc-about__section">'
    + '<div class="bc-about__section-head">Your data, your rules</div>'
    + '<div class="bc-about__section-body">'
    + 'Everything you log is stored in your own Personal Data Server (PDS): a private database that belongs to you, not us. '
    + 'It uses AT Protocol, the same open standard that powers Bluesky. '
    + '<a href="https://atproto.com" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:underline">Learn more about the project</a>.'
    + '</div>'
    + '<div class="bc-about__perks">'
    + '<div class="bc-about__perk"><span class="bc-about__perk-dot"></span><span>Export all your data as JSON at any time</span></div>'
    + '<div class="bc-about__perk"><span class="bc-about__perk-dot"></span><span>Move to any compatible app, no lock-in</span></div>'
    + '<div class="bc-about__perk"><span class="bc-about__perk-dot"></span><span>Delete everything permanently, whenever you want</span></div>'
    + '<div class="bc-about__perk"><span class="bc-about__perk-dot"></span><span>We never sell or share your information</span></div>'
    + '</div>'
    + '</div>'

    + '<div class="bc-about__footer">'
    + '<a href="https://bsky.app/profile/breadcrumbs.app" style="font-family:var(--sans-ui);font-size:11px;color:var(--fg-4);text-decoration:none">Follow on Bluesky</a>'
    + '</div>'
    + '</div>'
    + '</div>';

  container.innerHTML = html;

  // Bind settings handlers
  $('s-large-text').onclick  = toggleLargeText;
  $('s-hide-covers').onclick = toggleHideCovers;
  $('s-export').onclick      = exportData;
  $('s-refresh').onclick     = refreshEntries;
  $('s-logout').onclick      = logout;
  if ($('s-privacy')) $('s-privacy').onclick = function() { showPrivacy('main-screen'); };
  if ($('s-bug'))     $('s-bug').onclick     = openBugReport;

}


function toggleLargeText() {
  var app = $('app');
  app.classList.toggle('is-large-text');
  var on = app.classList.contains('is-large-text');
  localStorage.setItem('bc_large_text', on);
  renderSettings();
}

function toggleHideCovers() {
  var app = $('app');
  app.classList.toggle('is-hide-covers');
  var on = app.classList.contains('is-hide-covers');
  localStorage.setItem('bc_hide_covers', on);
  renderSettings();
}

// ── Detail panel ─────────────────────────────────────────────
var detailRkey       = null;
var detailCollection = null;

async function _fetchDescription(e) {
  try {
    var desc = null;
    if (e.type === 'movie' || e.type === 'show') {
      var tmdbType = e.type === 'show' ? 'tv' : 'movie';
      var r = await fetch('/api/tmdb?query=' + encodeURIComponent(e.title) + '&type=' + tmdbType);
      if (r.ok) { var data = await r.json(); var first = data.results && data.results[0]; if (first && first.overview) desc = first.overview; }
    } else if (e.type === 'book') {
      var r = await fetch('https://www.googleapis.com/books/v1/volumes?q=' + encodeURIComponent(e.title) + '&maxResults=1');
      if (r.ok) { var data = await r.json(); var first = data.items && data.items[0]; if (first && first.volumeInfo && first.volumeInfo.description) desc = first.volumeInfo.description; }
    } else if (e.type === 'game') {
      var r = await fetch('/api/rawg?query=' + encodeURIComponent(e.title));
      if (r.ok) {
        var data = await r.json(); var first = data.results && data.results[0];
        if (first && first.id) {
          var dr = await fetch('/api/rawg-detail?id=' + encodeURIComponent(first.id));
          if (dr.ok) { var detail = await dr.json(); if (detail.description_raw) desc = detail.description_raw; }
        }
      }
    }
    if (desc) {
      e.description = desc;
      if (detailRkey === e.rkey && detailCollection === e.collection) renderDetail(e);
    }
  } catch(err) {}
}

function openDetail(rkey, collection) {
  var e = entries.find(function(x) { return x.rkey === rkey && x.collection === collection; });
  if (!e) return;
  detailRkey       = rkey;
  detailCollection = collection;
  renderDetail(e);
  if (!e.description) _fetchDescription(e);
  var panel = $('detail-panel');
  panel.classList.add('is-open');
  panel.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeDetail() {
  $('detail-panel').classList.remove('is-open');
  $('detail-panel').setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  detailRkey = null;
  detailCollection = null;
}

function _detailProgPct(entry) {
  var p = entry.progress;
  if (!p || typeof p === 'string') return null;
  if (entry.type === 'book'  && p.currentPage && p.totalPages) return Math.min(100, Math.round(p.currentPage / p.totalPages * 100));
  if (entry.type === 'game'  && p.completionPercent)            return Math.min(100, p.completionPercent);
  if (entry.status === STATUS.completed)                         return 100;
  return null;
}

function _detailProgLabel(entry) {
  var p = entry.progress;
  if (!p) return null;
  if (typeof p === 'string') return p;
  var t = entry.type;
  if (t === 'book') {
    if (p.currentPage && p.totalPages) return 'Page\u202f' + p.currentPage + '\u202f/\u202f' + p.totalPages;
    if (p.currentPage) return 'Page\u202f' + p.currentPage;
  }
  if (t === 'show') {
    var parts = [];
    if (p.season)  parts.push('Season\u202f' + p.season);
    if (p.episode) parts.push('Episode\u202f' + p.episode);
    return parts.join(', ') || null;
  }
  if (t === 'game') {
    var gp = [];
    if (p.playtimeMinutes)   gp.push(Math.round(p.playtimeMinutes / 60) + '\u202fh played');
    if (p.completionPercent) gp.push(p.completionPercent + '%\u202fdone');
    if (p.narrativePosition) gp.push(p.narrativePosition);
    return gp.join(' · ') || null;
  }
  if (t === 'podcast') {
    var pp = [];
    if (p.episodeNumber)   pp.push('Episode\u202f' + p.episodeNumber);
    if (p.positionSeconds) pp.push(fmtSecs(p.positionSeconds));
    return pp.join(' · ') || null;
  }
  return null;
}

function _historyItemDesc(item, type) {
  if (item.action === 'completed') return 'Marked complete';
  var p = item.progress;
  if (!p) return 'Progress logged';
  if (typeof p === 'string') return p;
  if (type === 'book') {
    if (p.currentPage && p.totalPages) return 'p.\u202f' + p.currentPage + ' / ' + p.totalPages;
    if (p.currentPage) return 'p.\u202f' + p.currentPage;
  }
  if (type === 'show') {
    var parts = [];
    if (p.season)  parts.push('S' + p.season);
    if (p.episode) parts.push('E' + p.episode);
    return parts.join('\u202f') || 'Progress logged';
  }
  if (type === 'game') {
    var gp = [];
    if (p.completionPercent) gp.push(p.completionPercent + '%');
    if (p.playtimeMinutes)   gp.push(Math.round(p.playtimeMinutes / 60) + 'h');
    return gp.join(' · ') || 'Progress logged';
  }
  if (type === 'podcast') {
    if (p.episodeNumber) return 'Ep\u202f' + p.episodeNumber;
  }
  return 'Progress logged';
}

function renderDetail(e) {
  var scroll = $('detail-scroll');
  var color  = DOT_COLORS[e.type] || '#888';
  var subtitle = (e.authors||[]).join(', ') || e.creator || e.developer || '';

  var heroStyle = e.coverUrl
    ? 'background-image:url(' + esc(e.coverUrl) + ');background-size:cover;background-position:center'
    : 'background:' + (COVER_BG[e.type] || COVER_BG.book);

  var pct   = _detailProgPct(e);
  var pLbl  = _detailProgLabel(e);
  var inProg = e.status === STATUS.inProgress;
  var isComplete = e.status === STATUS.completed;

  var heroHtml = '<div class="bc-detail__hero" style="' + heroStyle + '">'
    + '<div class="bc-detail__hero-scrim"></div>'
    + '<div class="bc-detail__hero-body">'
    + '<span class="bc-detail__stamp">' + esc(LABELS[e.type] || e.type) + '</span>'
    + '<h2 class="bc-detail__title">' + esc(e.title) + '</h2>'
    + (subtitle ? '<p class="bc-detail__sub">' + esc(subtitle) + '</p>' : '')
    + '</div>'
    + '</div>';

  var progCard = '';
  if (e.status !== STATUS.wantTo) {
    var trackHtml = '';
    if (pct !== null) {
      trackHtml = '<div class="bc-detail__track">'
        + '<div class="bc-detail__fill" style="width:' + pct + '%;background:' + color + '"></div>'
        + '</div>'
        + '<div class="bc-detail__track-row"><span>' + pct + '%</span><span>' + esc(STATUS_LABELS[e.status] || '') + '</span></div>';
    }

    var btns = '';
    if (!isComplete) {
      btns = '<div class="bc-detail__btns">'
        + '<button class="bc-btn bc-btn--secondary bc-detail__log-btn" onclick="openLogModal(\'' + esc(e.rkey) + '\',\'' + esc(e.collection) + '\')">'
        + '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.3"/><line x1="8" y1="5" x2="8" y2="8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><line x1="8" y1="8" x2="10" y2="10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>'
        + 'Log progress</button>'
        + '<button class="bc-btn bc-btn--secondary bc-detail__fin-btn" onclick="markDetailComplete()">'
        + 'Mark complete</button>'
        + '</div>';
    }

    progCard = '<div class="bc-detail__card">'
      + '<div class="bc-detail__card-head">Progress</div>'
      + (pLbl ? '<div class="bc-detail__prog-lbl">' + esc(pLbl) + '</div>' : '<p class="bc-detail__no-prog">No progress logged yet.</p>')
      + trackHtml
      + btns
      + '</div>';
  }

  var notesCard = '';
  if (e.notes) {
    notesCard = '<div class="bc-detail__card">'
      + '<div class="bc-detail__card-head">Notes</div>'
      + '<blockquote class="bc-margin-note">'
      + '<span class="bc-margin-note__mark" aria-hidden="true">\u201c</span>'
      + '<p class="bc-margin-note__text">' + esc(e.notes) + '</p>'
      + '</blockquote>'
      + '</div>';
  }

  var historyCard = '';
  var hist = (e.history || []).slice().reverse();
  if (hist.length) {
    historyCard = '<div class="bc-detail__card">'
      + '<div class="bc-detail__card-head">History <span class="bc-detail__count">' + hist.length + '</span></div>'
      + '<div class="bc-history">'
      + hist.map(function(item) {
          return '<div class="bc-history__item">'
            + '<div class="bc-history__dot" style="background:' + color + ';opacity:0.7"></div>'
            + '<div class="bc-history__body">'
            + '<div class="bc-history__when">' + esc(fmtDate(item.ts)) + '</div>'
            + '<div class="bc-history__what">' + esc(_historyItemDesc(item, e.type)) + '</div>'
            + (item.note ? '<div class="bc-history__note">' + esc(item.note) + '</div>' : '')
            + '</div>'
            + '</div>';
        }).join('')
      + '</div>'
      + '</div>';
  }

  var ratingHtml = '';
  if (e.rating) {
    var stars = '';
    for (var i = 1; i <= 5; i++) stars += (i <= e.rating ? '★' : '☆');
    ratingHtml = '<div class="bc-detail__card">'
      + '<div class="bc-detail__card-head">Rating</div>'
      + '<div style="font-size:22px;color:var(--accent);letter-spacing:2px">' + stars + '</div>'
      + '</div>';
  }

  var synopsisCard = '';
  if (e.description) {
    synopsisCard = '<div class="bc-detail__card">'
      + '<div class="bc-detail__card-head">Synopsis</div>'
      + '<p class="bc-detail__synopsis">' + esc(e.description) + '</p>'
      + '</div>';
  }

  scroll.innerHTML = heroHtml
    + '<div class="bc-detail__body">'
    + progCard
    + synopsisCard
    + notesCard
    + ratingHtml
    + historyCard
    + '</div>';

  $('detail-edit').onclick = function() {
    closeDetail();
    openEdit(e.rkey, e.collection);
  };
}

async function markDetailComplete() {
  var e = entries.find(function(x) { return x.rkey === detailRkey && x.collection === detailCollection; });
  if (!e) return;
  var updated = Object.assign({}, e, {
    status: STATUS.completed,
    history: (e.history || []).concat([{ ts: new Date().toISOString(), action: 'completed' }])
  });
  await _saveEntryUpdate(updated);
}

// ── Log modal ─────────────────────────────────────────────────
var logRkey       = null;
var logCollection = null;

function openLogModal(rkey, collection) {
  var e = entries.find(function(x) { return x.rkey === rkey && x.collection === collection; });
  if (!e) return;
  logRkey       = rkey;
  logCollection = collection;

  var p = (e.progress && typeof e.progress !== 'string') ? e.progress : {};
  var progFields = '';
  if (e.type === 'book') {
    progFields = '<div class="bc-progrow">'
      + '<input class="bc-input" id="lf-page" type="number" min="0" placeholder="Page" value="' + (p.currentPage || '') + '">'
      + '<span class="bc-progrow__of">of</span>'
      + '<input class="bc-input" id="lf-total" type="number" min="1" placeholder="Total" value="' + (p.totalPages || '') + '">'
      + '</div>';
  } else if (e.type === 'show') {
    progFields = '<div class="bc-progrow">'
      + '<input class="bc-input" id="lf-season" type="number" min="1" placeholder="Season" value="' + (p.season || '') + '">'
      + '<input class="bc-input" id="lf-episode" type="number" min="1" placeholder="Episode" value="' + (p.episode || '') + '">'
      + '</div>';
  } else if (e.type === 'game') {
    progFields = '<div class="bc-progrow" style="margin-bottom:8px">'
      + '<input class="bc-input" id="lf-hours" type="number" min="0" placeholder="Hours played" value="' + (p.playtimeMinutes ? Math.round(p.playtimeMinutes / 60) : '') + '">'
      + '<input class="bc-input" id="lf-pct" type="number" min="0" max="100" placeholder="% done" value="' + (p.completionPercent || '') + '">'
      + '</div>'
      + '<input class="bc-input" id="lf-narrative" placeholder="Where are you in the story? (optional)" maxlength="128" value="' + esc(p.narrativePosition || '') + '">';
  } else if (e.type === 'podcast') {
    progFields = '<div class="bc-progrow">'
      + '<input class="bc-input" id="lf-epnum" type="number" min="1" placeholder="Episode" value="' + (p.episodeNumber || '') + '">'
      + '<input class="bc-input" id="lf-pos" placeholder="Position (1:23:45)" value="' + (p.positionSeconds ? fmtSecs(p.positionSeconds) : '') + '">'
      + '</div>';
  } else if (e.type === 'movie') {
    progFields = '<p style="font-size:13px;color:var(--fg-3);font-style:italic;padding:4px 0">Status carries progress for films.</p>';
  }

  $('log-modal-body').innerHTML = '<div class="bc-log__entry-name">' + esc(e.title) + '</div>'
    + (progFields ? '<div class="bc-field"><div class="bc-label">Progress</div>' + progFields + '</div>' : '')
    + '<div class="bc-field">'
    + '<div class="bc-label">Note <span class="bc-label__hint">optional</span></div>'
    + '<textarea class="bc-textarea" id="lf-note" placeholder="Quick thought\u2026" rows="2"></textarea>'
    + '</div>';

  $('log-modal').style.display = 'flex';
}

function closeLogModal() {
  $('log-modal').style.display = 'none';
  logRkey = null; logCollection = null;
}

async function submitLog() {
  var e = entries.find(function(x) { return x.rkey === logRkey && x.collection === logCollection; });
  if (!e) return;
  var now = new Date().toISOString();
  var note = ($('lf-note') && $('lf-note').value.trim()) || null;

  var newProgress = null;
  if (e.type === 'book') {
    var cp = parseInt($('lf-page') && $('lf-page').value) || null;
    var tp = parseInt($('lf-total') && $('lf-total').value) || null;
    if (cp || tp) newProgress = Object.assign({}, e.progress && typeof e.progress !== 'string' ? e.progress : {}, { currentPage:cp, totalPages:tp, updatedAt:now });
  } else if (e.type === 'show') {
    var se = parseInt($('lf-season') && $('lf-season').value) || null;
    var ep = parseInt($('lf-episode') && $('lf-episode').value) || null;
    if (se || ep) newProgress = { season:se, episode:ep, updatedAt:now };
  } else if (e.type === 'game') {
    var hr = parseFloat($('lf-hours') && $('lf-hours').value);
    var pm = (!isNaN(hr) && hr > 0) ? Math.round(hr * 60) : null;
    var pc = parseInt($('lf-pct') && $('lf-pct').value) || null;
    var np = ($('lf-narrative') && $('lf-narrative').value.trim()) || null;
    if (pm || pc || np) newProgress = { playtimeMinutes:pm, completionPercent:pc, narrativePosition:np, updatedAt:now };
  } else if (e.type === 'podcast') {
    var en = parseInt($('lf-epnum') && $('lf-epnum').value) || null;
    var ps = parseSecs(($('lf-pos') && $('lf-pos').value.trim()) || '');
    if (en || ps) newProgress = { episodeNumber:en, positionSeconds:ps, updatedAt:now };
  }

  var histItem = { ts: now, progress: newProgress || e.progress, note: note };
  var updated = Object.assign({}, e, {
    progress: newProgress || e.progress,
    history:  (e.history || []).concat([histItem])
  });

  $('log-modal-save').textContent = 'Saving\u2026';
  $('log-modal-save').disabled = true;
  try {
    await _saveEntryUpdate(updated);
    closeLogModal();
    toast('Progress logged!');
  } catch(err) {
    toast('Save failed: ' + err.message, 'error');
  } finally {
    $('log-modal-save').textContent = 'Save';
    $('log-modal-save').disabled = false;
  }
}

async function _saveEntryUpdate(updated) {
  var idx = entries.findIndex(function(x) { return x.rkey === updated.rkey && x.collection === updated.collection; });
  if (isDemo) {
    if (idx >= 0) entries[idx] = updated;
    saveDemoEntries();
  } else {
    await atpUpdateEntry(updated.rkey, updated.collection, updated);
    await atpGetEntries();
  }
  render(); updateStats();
  if (detailRkey === updated.rkey) {
    var fresh = entries.find(function(x) { return x.rkey === updated.rkey && x.collection === updated.collection; });
    if (fresh) renderDetail(fresh);
  }
}

// ── Export ────────────────────────────────────────────────────
function exportData() {
  var blob = new Blob([JSON.stringify({
    entries: entries,
    exported: new Date().toISOString(),
    source: isDemo ? 'demo' : 'atp:' + session?.did
  }, null, 2)], {type:'application/json'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'breadcrumbs-' + new Date().toISOString().split('T')[0] + '.json';
  a.click();
  toast('Data exported!');
}

// ── Toast ─────────────────────────────────────────────────────
function toast(msg, type) {
  var t = document.createElement('div');
  t.className = 'bc-toast';
  if (type === 'error') t.style.background = 'var(--accent)';
  t.textContent = msg;
  $('toasts').appendChild(t);
  setTimeout(function() { t.remove(); }, 3000);
}

// ── Accessibility preferences ─────────────────────────────────
function restorePrefs() {
  if (localStorage.getItem('bc_large_text')  === 'true') $('app').classList.add('is-large-text');
  if (localStorage.getItem('bc_hide_covers') === 'true') $('app').classList.add('is-hide-covers');
  var savedAccent = localStorage.getItem('bc_accent');
  if (savedAccent) document.documentElement.style.setProperty('--accent', savedAccent);
}

// ── Boot ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  restorePrefs();
  init();

});
