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

// Fallback CSS-gradient covers (used when no coverUrl)
var COVER_BG = {
  book:    'linear-gradient(160deg,#5F6B43,#3E4A27)',
  show:    'linear-gradient(160deg,#6B4E71,#44314A)',
  movie:   'linear-gradient(160deg,#B08848,#6F5528)',
  game:    'linear-gradient(160deg,#A45A3C,#6A3722)',
  podcast: 'linear-gradient(160deg,#4F706D,#334947)'
};

// Preset summaries for demo mode
var SUMMARIES = {
  'Project Hail Mary':'<strong>Where you left off:</strong><br><br>Dr. Ryland Grace made contact with <strong>Rocky</strong>, an alien from Erid. They\'re working together to save both planets.<br><br>You stopped right after discovering how Astrophage reproduces.',
  'Severance':'<strong>Where you left off:</strong><br><br>Deep in the Lumon mystery. Helly is trying to escape. Mark found a secret map.<br><br>You stopped right before the <strong>waffle party</strong>.',
  'Oppenheimer':'<strong>Where you left off:</strong><br><br>You just witnessed the <strong>Trinity test</strong>. The Manhattan Project succeeded.',
  "Baldur's Gate 3":'<strong>Where you left off:</strong><br><br>Playing as <strong>Dark Urge</strong> in Act 2. Moonrise Towers. Jaheira just joined your party.'
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
var catchupDismissed = false;
var subActive      = false;
var subTier        = null;   // 'monthly' | 'annual' | 'lifetime' | null

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

var SVG_LOGOMARK = '<svg viewBox="0 0 64 64" width="28" height="28" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="none" stroke="currentColor" stroke-width="1.4" opacity="0.45"/><circle cx="32" cy="32" r="24" fill="currentColor" opacity="0.08"/><text x="32" y="42" text-anchor="middle" font-family="Cormorant Garamond,serif" font-style="italic" font-weight="600" font-size="34" fill="currentColor">B</text><circle cx="48" cy="46" r="1.8" fill="currentColor"/><circle cx="52" cy="42" r="1.2" fill="currentColor"/><circle cx="50" cy="50" r="1" fill="currentColor"/></svg>';

var SVG_ATP = '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M5.5 11L8 5l2.5 6M6.5 9h3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';

// ── Theme ────────────────────────────────────────────────────
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('bc_theme', t);
}

function detectTheme() {
  var saved = localStorage.getItem('bc_theme');
  if (saved) { applyTheme(saved); return; }
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) applyTheme('night');
}

function toggleTheme() {
  var current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'night' ? 'day' : 'night');
  var lbl = $('theme-label');
  if (lbl) lbl.textContent = document.documentElement.getAttribute('data-theme') === 'night' ? 'Night library' : 'Parchment';
}

// ── AT Protocol ──────────────────────────────────────────────
async function atpRequest(method, endpoint, body, pds) {
  var url = (pds || session?.pds || DEFAULT_PDS) + '/xrpc/' + endpoint;
  var headers = {'Content-Type':'application/json'};
  if (session?.accessJwt) headers['Authorization'] = 'Bearer ' + session.accessJwt;
  var opts = {method:method, headers:headers};
  if (body && method !== 'GET') opts.body = JSON.stringify(body);
  var res = await fetch(url, opts);
  var data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || 'Request failed');
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

async function atpRefreshSession() {
  if (!session?.refreshJwt) return false;
  try {
    var data = await atpRequest('POST', 'com.atproto.server.refreshSession', {});
    session.accessJwt  = data.accessJwt;
    session.refreshJwt = data.refreshJwt;
    localStorage.setItem('bc_atp_session', JSON.stringify(session));
    return true;
  } catch(e) { return false; }
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
    progress:val.progress||null, rkey:rkey, uri:rec.uri, collection:collection
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
  return rec;
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

  // AI modal
  $('ai-close').onclick  = closeAI;
  $('ai-modal').onclick  = function(e) { if (e.target === this) closeAI(); };

  // Catchup hero
  $('catchup-dismiss-btn').onclick = function() {
    catchupDismissed = true;
    $('catchup-hero').classList.add('hidden');
  };
  $('catchup-open-btn').onclick = function() {
    if (!subActive && !isDemo) {
      switchTab('settings');
      toast('Breadcrumbs+ required for AI features', 'info');
      return;
    }
    var first = entries.find(function(e) { return e.status === STATUS.inProgress; });
    if (first) showAI(first.rkey);
  };

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
    showAuthError(e.message || 'Sign in failed. Check your handle and app password.');
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

function showMain() {
  $('auth-screen').classList.remove('active');
  $('main-screen').classList.add('active');
  if (session) {
    $('atp-badge').classList.remove('hidden');
    $('demo-banner').classList.add('hidden');
    checkSubStatus();
  } else {
    $('atp-badge').classList.add('hidden');
    $('demo-banner').classList.remove('hidden');
  }
  renderSettings();
  updateStats();
}

// ── Subscription ─────────────────────────────────────────────
async function checkSubStatus() {
  if (!session || !session.did) return;
  try {
    var resp = await fetch('/api/sub-status?did=' + encodeURIComponent(session.did));
    var data = await resp.json();
    subActive = !!data.active;
    subTier   = data.tier || null;
    renderSettings();
  } catch(e) {
    // Non-fatal — sub check failure doesn't block the app
  }
}

async function startCheckout(tier) {
  if (!session || !session.did) {
    toast('Sign in with Bluesky to subscribe', 'error');
    return;
  }
  try {
    var resp = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ did: session.did, tier: tier })
    });
    var data = await resp.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      toast(data.error || 'Could not start checkout', 'error');
    }
  } catch(e) {
    toast('Checkout unavailable — try again later', 'error');
  }
}

async function openBillingPortal() {
  if (!session || !session.did) return;
  try {
    var resp = await fetch('/api/billing-portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ did: session.did })
    });
    var data = await resp.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      toast(data.error || 'Could not open billing portal', 'error');
    }
  } catch(e) {
    toast('Billing portal unavailable — try again later', 'error');
  }
}

// ── Data ─────────────────────────────────────────────────────
async function loadEntries() {
  $('loading-entries').classList.remove('hidden');
  $('entries').innerHTML = '';
  $('empty').classList.add('hidden');
  try {
    await atpGetEntries();
    render(); updateStats();
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
       notes:'Rocky is the best first contact I\'ve read. Genuinely moved by the engineering.',
       coverUrl:'https://covers.openlibrary.org/b/isbn/9780593135204-M.jpg',
       createdAt:new Date(now-2*86400000).toISOString()},
      {rkey:'2',collection:'app.breadcrumbs.show',type:'show',title:'Severance',
       progress:{season:1,episode:7,updatedAt:new Date(now-4*86400000).toISOString()},
       status:STATUS.inProgress,genres:['Thriller'],
       notes:'Waffle party coming up.',
       coverUrl:'https://image.tmdb.org/t/p/w200/lFf6LLrQjYZKqiPuqcvzL8Fmgmt.jpg',
       createdAt:new Date(now-4*86400000).toISOString()},
      {rkey:'3',collection:'app.breadcrumbs.movie',type:'movie',title:'Oppenheimer',
       status:STATUS.completed,genres:['Drama'],rating:4,
       notes:'Trinity test was incredible.',
       coverUrl:'https://image.tmdb.org/t/p/w200/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg',
       createdAt:new Date(now-6*86400000).toISOString()},
      {rkey:'4',collection:'app.breadcrumbs.game',type:'game',title:"Baldur's Gate 3",
       developer:'Larian Studios',
       progress:{playtimeMinutes:2520,completionPercent:42,narrativePosition:'Act 2 — Moonrise Towers',
                 updatedAt:new Date(now-9*86400000).toISOString()},
       status:STATUS.inProgress,genres:['RPG'],rating:5,
       notes:'Dark Urge playthrough.',
       coverUrl:'https://media.rawg.io/media/games/699/69907ecf13f172e9e1069ff7a9fd7544.jpg',
       createdAt:new Date(now-9*86400000).toISOString()}
    ];
    saveDemoEntries();
  }
  render(); updateStats();
  // Show catchup after a moment
  if (!catchupDismissed) setTimeout(function() {
    $('catchup-hero').classList.remove('hidden');
  }, 800);
}

function saveDemoEntries() {
  localStorage.setItem('bc_demo_entries', JSON.stringify(entries));
}

async function refreshEntries() {
  if (isDemo) { toast('Demo mode — no server to refresh'); return; }
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

  var list  = $('entries');
  var empty = $('empty');

  if (!shown.length) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  list.innerHTML = shown.map(function(e) {
    var coverStyle = e.coverUrl
      ? 'background-image:url(' + esc(e.coverUrl) + ');background-size:cover;background-position:center'
      : 'background:' + (COVER_BG[e.type] || COVER_BG.book);

    var subtitle  = (e.authors||[]).join(', ') || e.creator || e.developer || '';
    var prog      = formatProgress(e);
    var statusStr = e.status !== STATUS.inProgress ? (STATUS_LABELS[e.status]||'') : '';
    var typeLabel = LABELS[e.type] || e.type;

    return '<button class="bc-card bc-card--' + e.type + '"'
      + ' onclick="openEdit(\'' + esc(e.rkey) + '\',\'' + esc(e.collection) + '\')"'
      + ' aria-label="' + esc(e.title) + '">'

      + '<div class="bc-card__spine" aria-hidden="true"></div>'

      + '<div class="bc-card__body">'

      + '<div class="bc-card__cover" style="' + coverStyle + '" aria-hidden="true"></div>'

      + '<div class="bc-card__info">'
      + '<div class="bc-card__meta">'
      + '<span class="bc-pill bc-pill--' + e.type + '">'
      + (CAT_SVG[e.type]||'') + ' ' + esc(typeLabel)
      + '</span>'
      + '<span class="bc-card__date">' + fmtDate(e.createdAt) + '</span>'
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
      return '<button class="bc-sidebar-card bc-card--' + e.type + '" onclick="openEdit('
        + JSON.stringify(e.rkey) + ',' + JSON.stringify('app.breadcrumbs.' + e.type) + ')">'
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
}

// ── Modal ────────────────────────────────────────────────────
function openAdd() {
  editRkey = null; editCollection = null; selectedMedia = null;
  $('modal-title').textContent = 'Drop a breadcrumb';
  $('f-title').value = '';
  $('f-notes').value = '';
  $('f-search').value = '';
  $('delete-btn').classList.add('hidden');
  $('selected-media').classList.add('hidden');
  $('search-group').classList.remove('hidden');
  $('title-group').classList.remove('hidden');
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
  $('f-title').value = e.title || '';
  $('f-notes').value = e.notes || '';
  $('f-search').value = '';
  $('delete-btn').classList.remove('hidden');

  if (e.coverUrl) {
    selectedMedia = {title:e.title, coverUrl:e.coverUrl};
    $('selected-media').classList.remove('hidden');
    $('selected-cover').style.cssText = 'background-image:url(' + esc(e.coverUrl) + ');background-size:cover;background-position:center';
    $('selected-title').textContent = e.title;
    $('selected-meta1').textContent = (e.authors||[]).join(', ') || e.creator || e.developer || '';
    $('selected-meta2').textContent = '';
    $('search-group').classList.add('hidden');
    $('title-group').classList.add('hidden');
  } else {
    $('selected-media').classList.add('hidden');
    $('search-group').classList.remove('hidden');
    $('title-group').classList.remove('hidden');
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
  var title = ($('f-title').value || (selectedMedia && selectedMedia.title) || '').trim();
  if (!title) { toast('Title is required', 'error'); return; }

  var entryData = {
    type:      selType,
    title:     title,
    status:    selStatus,
    progress:  selStatus !== STATUS.wantTo ? buildProgressObject(selType) : null,
    notes:     $('f-notes').value.trim() || null,
    genres:    selGenre ? [selGenre] : null,
    rating:    selRating || null,
    coverUrl:  selectedMedia?.coverUrl || null,
    authors:   selectedMedia?.authors  || null,
    creator:   selectedMedia?.creator  || null,
    developer: selectedMedia?.developer || null
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
    toast('Save failed: ' + e.message, 'error');
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
  else if (selType === 'game')  searchGames(query);
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
      + ' data-title="'  + esc(item.title)  + '"'
      + ' data-cover="'  + esc(item.cover||'')  + '"'
      + ' data-author="' + esc(item.author||'') + '"'
      + ' data-year="'   + esc(item.year||'')   + '"'
      + ' data-isbn13="' + esc(item.isbn13||'') + '">'
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
          title: item.title || item.name,
          year:  (item.release_date || item.first_air_date || '').slice(0,4),
          cover: item.poster_path ? 'https://image.tmdb.org/t/p/w200' + item.poster_path : ''
        };
      }));
    })
    .catch(function() {
      $('search-results').innerHTML = '<div class="bc-search-msg">Search unavailable — enter title manually.</div>';
    });
}

function searchBooks(query) {
  fetch('https://www.googleapis.com/books/v1/volumes?q=' + encodeURIComponent(query) + '&maxResults=6')
    .then(function(r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function(data) {
      if (!data.items?.length) { renderSearchResults([]); return; }
      renderSearchResults(data.items.map(function(item) {
        var v = item.volumeInfo;
        var isbn = (v.industryIdentifiers||[]).find(function(x) { return x.type==='ISBN_13'; });
        return {
          title:  v.title || 'Unknown',
          author: (v.authors||[]).join(', '),
          cover:  v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail || '',
          isbn13: isbn ? isbn.identifier : ''
        };
      }));
    })
    .catch(function() {
      $('search-results').innerHTML = '<div class="bc-search-msg">Search unavailable — enter title manually.</div>';
    });
}

function searchGames(query) {
  fetch('/api/rawg?query=' + encodeURIComponent(query))
    .then(function(r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function(data) {
      if (!data.results?.length) { renderSearchResults([]); return; }
      renderSearchResults(data.results.slice(0,6).map(function(item) {
        return {
          title: item.name,
          year:  (item.released||'').slice(0,4),
          cover: item.background_image || ''
        };
      }));
    })
    .catch(function() {
      $('search-results').innerHTML = '<div class="bc-search-msg">Search unavailable — enter title manually.</div>';
    });
}

function selectResult(el) {
  var d = el.dataset;
  selectedMedia = {
    title:    d.title  || '',
    coverUrl: d.cover  || '',
    authors:  d.author ? [d.author] : null,
    isbn13:   d.isbn13 || null
  };
  $('selected-media').classList.remove('hidden');
  $('selected-cover').style.cssText = selectedMedia.coverUrl
    ? 'background-image:url(' + esc(selectedMedia.coverUrl) + ');background-size:cover;background-position:center'
    : 'background:' + (COVER_BG[selType]||COVER_BG.book);
  $('selected-title').textContent = selectedMedia.title;
  $('selected-meta1').textContent = d.author || d.year || '';
  $('selected-meta2').textContent = '';
  $('f-title').value  = selectedMedia.title;
  $('f-search').value = '';
  $('search-results').classList.add('hidden');
  $('search-group').classList.add('hidden');
  $('title-group').classList.add('hidden');
}

function clearSelection() {
  selectedMedia = null;
  $('selected-media').classList.add('hidden');
  $('search-group').classList.remove('hidden');
  $('title-group').classList.remove('hidden');
  $('f-title').value  = '';
  $('f-search').value = '';
}

// ── AI / Catch me up ──────────────────────────────────────────
function showAI(rkey) {
  var e = entries.find(function(x) { return x.rkey === rkey; });
  if (!e) return;
  $('ai-title').textContent = e.title;
  $('ai-body').innerHTML = '<div style="text-align:center;padding:32px 0"><div class="bc-spinner"></div><p style="margin-top:14px;font-style:italic;color:var(--fg-3);font-family:var(--serif-body)">Generating recap…</p></div>';
  $('ai-modal').style.display = 'flex';
  setTimeout(function() {
    var prog = formatProgress(e);
    var fallback = '<strong>Where you left off in ' + esc(e.title) + ':</strong><br><br>'
      + (prog ? 'You\'re at <strong>' + esc(prog) + '</strong>.<br><br>' : '')
      + (e.notes ? 'Your notes: "' + esc(e.notes) + '"<br><br>' : '')
      + '<em style="color:var(--fg-3)">Connect a Breadcrumbs+ account for a full AI-generated recap.</em>';
    $('ai-body').innerHTML = SUMMARIES[e.title] || fallback;
  }, 1200);
}

function closeAI() { $('ai-modal').style.display = 'none'; }

// ── Analytics ────────────────────────────────────────────────
function generateHeat(entries) {
  var now   = new Date();
  var weekMs = 7 * 24 * 3600 * 1000;
  var heat  = {};
  entries.forEach(function(e) {
    var d = new Date(e.createdAt);
    var weeksAgo = Math.floor((now - d) / weekMs);
    if (weeksAgo >= 0 && weeksAgo < 26) {
      var idx = 25 - weeksAgo;
      if (!heat[idx]) heat[idx] = {level:0, type:e.type};
      heat[idx].level = Math.min(3, heat[idx].level + 1);
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

  // Build heat cells (26 cols × 5 rows = 130 cells, one per week per "row")
  var heatCells = '';
  for (var i = 0; i < 130; i++) {
    var weekIdx = i % 26;  // columns first
    var h = heatData[weekIdx] || {level:0, type:'book'};
    heatCells += '<div class="bc-heat__cell bc-heat__cell--' + h.type + '"'
      + (h.level ? ' data-level="' + h.level + '"' : '') + '></div>';
  }

  var html =
    '<div class="bc-stats">'
    + '<h2 class="bc-stats__title">Your year in <em>breadcrumbs</em></h2>'
    + '<p class="bc-stats__sub">' + entries.length + ' entries · ' + (sc[STATUS.completed]||0) + ' finished.</p>'
    + '<div class="bc-ornament">❦</div>'
    + types.map(function(t) {
        return '<div class="bc-bar">'
          + '<span class="bc-bar__label">'
          + '<span class="bc-bar__label-dot" style="background:' + DOT_COLORS[t] + '"></span>'
          + LABELS[t] + 's'
          + '</span>'
          + '<div class="bc-bar__track">'
          + '<div class="bc-bar__fill" style="width:' + (counts[t]/max*100) + '%;background:' + DOT_COLORS[t] + '"></div>'
          + '</div>'
          + '<span class="bc-bar__count">' + counts[t] + '</span>'
          + '</div>';
      }).join('')
    + '</div>'

    + '<div class="bc-heat">'
    + '<h3>The stopping points</h3>'
    + '<p class="bc-heat__sub">Every breadcrumb dropped, the past six months.</p>'
    + '<div class="bc-heat__grid">' + heatCells + '</div>'
    + '<div class="bc-heat__legend"><span>6 mo ago</span><span>3 mo ago</span><span>Today</span></div>'
    + '<div class="bc-heat__swatches">'
    + types.map(function(t) {
        return '<span class="bc-heat__swatch">'
          + '<span class="bc-heat__swatch-dot bc-heat__swatch-dot--' + t + '"></span>'
          + '<span>' + LABELS[t] + 's</span>'
          + '</span>';
      }).join('')
    + '</div>'
    + '</div>'

    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'
    + [
        {n: sc[STATUS.inProgress]||0, l:'In progress'},
        {n: sc[STATUS.completed]||0,  l:'Completed'},
        {n: sc[STATUS.onHold]||0,     l:'On hold'},
        {n: entries.length,           l:'Total entries'}
      ].map(function(c) {
        return '<div class="bc-statuscell">'
          + '<span class="bc-statuscell__n">' + c.n + '</span>'
          + '<span class="bc-statuscell__l">' + c.l + '</span>'
          + '</div>';
      }).join('')
    + '</div>';

  container.innerHTML = html;
}

// ── Settings ─────────────────────────────────────────────────
function renderSettings() {
  var container = $('settings-container');
  if (!container) return;

  var handle = session ? '@' + session.handle : 'Demo User';
  var did    = session ? session.did : 'Local storage only';
  var theme  = document.documentElement.getAttribute('data-theme') || 'day';
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
    + '<button class="bc-settings__item" id="s-theme">'
    + '<span class="bc-settings__item-label">Theme</span>'
    + '<span class="bc-settings__item-detail" id="theme-label">' + (theme === 'night' ? 'Night library' : 'Parchment') + '</span>'
    + SVG_CHEV
    + '</button>'
    + '<button class="bc-settings__item" id="s-large-text">'
    + '<span class="bc-settings__item-label">Larger type</span>'
    + '<span class="bc-toggle' + (largeText ? ' is-on' : '') + '" role="switch" aria-checked="' + largeText + '"></span>'
    + '</button>'
    + '<button class="bc-settings__item" id="s-hide-covers">'
    + '<span class="bc-settings__item-label">Hide cover art</span>'
    + '<span class="bc-toggle' + (hideCovers ? ' is-on' : '') + '" role="switch" aria-checked="' + hideCovers + '"></span>'
    + '</button>'
    + '</div>'

    // ── Subscription
    + buildSubSection()

    // ── AI features (only shown when subscribed)
    + (subActive
      ? '<div class="bc-settings__section">'
        + '<div class="bc-settings__head">AI features</div>'
        + '<button class="bc-settings__item"><span class="bc-settings__item-label">Catch me up</span><span class="bc-settings__item-detail">Weekly</span>' + SVG_CHEV + '</button>'
        + '<button class="bc-settings__item"><span class="bc-settings__item-label">Summarize new entries</span><span class="bc-toggle is-on" role="switch" aria-checked="true"></span></button>'
        + '<button class="bc-settings__item"><span class="bc-settings__item-label">Personal reading insights</span><span class="bc-toggle is-on" role="switch" aria-checked="true"></span></button>'
        + '</div>'
      : '')

    // ── Your data
    + '<div class="bc-settings__section">'
    + '<div class="bc-settings__head">Your data</div>'
    + '<button class="bc-settings__item" id="s-export"><span class="bc-settings__item-label">Export as JSON</span><span class="bc-settings__item-detail">all entries &amp; lists</span>' + SVG_CHEV + '</button>'
    + '<button class="bc-settings__item" id="s-refresh"><span class="bc-settings__item-label">Refresh from PDS</span>' + SVG_CHEV + '</button>'
    + '<button class="bc-settings__item"><span class="bc-settings__item-label">View on PDS</span><span class="bc-settings__item-detail">bsky.social</span>' + SVG_CHEV + '</button>'
    + '</div>'

    // ── Account
    + '<div class="bc-settings__section">'
    + '<div class="bc-settings__head">Account</div>'
    + '<button class="bc-settings__item bc-settings__item--danger" id="s-logout"><span class="bc-settings__item-label">Sign out</span></button>'
    + '</div>'

    // ── About
    + '<div class="bc-about">'
    + SVG_LOGOMARK
    + '<div class="bc-about__name">Breadcrumbs</div>'
    + '<div class="bc-about__ver">v2.1.0 · built on AT Protocol</div>'
    + '<div class="bc-about__tag">Made for keepers of reading journals.</div>'
    + '</div>';

  container.innerHTML = html;

  // Bind settings handlers
  $('s-theme').onclick       = toggleTheme;
  $('s-large-text').onclick  = toggleLargeText;
  $('s-hide-covers').onclick = toggleHideCovers;
  $('s-export').onclick      = exportData;
  $('s-refresh').onclick     = refreshEntries;
  $('s-logout').onclick      = logout;

  // Subscription handlers
  if ($('s-manage-sub'))   $('s-manage-sub').onclick   = openBillingPortal;
  if ($('s-upgrade-mo'))   $('s-upgrade-mo').onclick   = function() { startCheckout('monthly'); };
  if ($('s-upgrade-yr'))   $('s-upgrade-yr').onclick   = function() { startCheckout('annual'); };
  if ($('s-upgrade-life')) $('s-upgrade-life').onclick = function() { startCheckout('lifetime'); };
}

function buildSubSection() {
  var TIER_LABELS = { monthly:'Monthly', annual:'Annual', lifetime:'Lifetime' };
  if (subActive) {
    var tierLabel = TIER_LABELS[subTier] || 'Active';
    var isLifetime = subTier === 'lifetime';
    return '<div class="bc-settings__section">'
      + '<div class="bc-settings__head">Subscription</div>'
      + '<div class="bc-sub-card bc-sub-card--active">'
      + '<div class="bc-sub-card__mark">✦</div>'
      + '<div class="bc-sub-card__body">'
      + '<div class="bc-sub-card__tier">Breadcrumbs+</div>'
      + '<div class="bc-sub-card__plan">' + tierLabel + (isLifetime ? ' · never expires' : '') + '</div>'
      + '</div>'
      + '</div>'
      + (isLifetime
          ? ''
          : '<button class="bc-settings__item" id="s-manage-sub"><span class="bc-settings__item-label">Manage subscription</span>' + SVG_CHEV + '</button>')
      + '</div>';
  }

  // Upgrade UI — not subscribed
  var canBuy = !!(session && session.did);
  var disabledAttr = canBuy ? '' : ' disabled title="Sign in with Bluesky to subscribe"';
  return '<div class="bc-settings__section">'
    + '<div class="bc-settings__head">Breadcrumbs+</div>'
    + '<p class="bc-sub-pitch">AI recaps, personalized insights, and priority support. Pay only enough to cover costs.</p>'
    + '<div class="bc-sub-tiers">'

    // Monthly
    + '<div class="bc-sub-tier">'
    + '<div class="bc-sub-tier__name">Monthly</div>'
    + '<div class="bc-sub-tier__price">$1.99<span>/mo</span></div>'
    + '<button class="bc-btn bc-btn--secondary bc-btn--block bc-sub-tier__btn" id="s-upgrade-mo"' + disabledAttr + '>Choose</button>'
    + '</div>'

    // Annual — highlighted
    + '<div class="bc-sub-tier bc-sub-tier--featured">'
    + '<div class="bc-sub-tier__badge">Best value</div>'
    + '<div class="bc-sub-tier__name">Annual</div>'
    + '<div class="bc-sub-tier__price">$14.99<span>/yr</span></div>'
    + '<div class="bc-sub-tier__save">Save 37%</div>'
    + '<button class="bc-btn bc-btn--primary bc-btn--block bc-sub-tier__btn" id="s-upgrade-yr"' + disabledAttr + '>Choose</button>'
    + '</div>'

    // Lifetime
    + '<div class="bc-sub-tier">'
    + '<div class="bc-sub-tier__name">Lifetime</div>'
    + '<div class="bc-sub-tier__price">$39<span> once</span></div>'
    + '<div class="bc-sub-tier__save">Founding member</div>'
    + '<button class="bc-btn bc-btn--secondary bc-btn--block bc-sub-tier__btn" id="s-upgrade-life"' + disabledAttr + '>Choose</button>'
    + '</div>'

    + '</div>'
    + (!canBuy ? '<p class="bc-sub-note">Sign in with Bluesky to subscribe.</p>' : '')
    + '</div>';
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
}

// ── Boot ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  restorePrefs();
  init();

  // Handle Stripe return redirects
  var params = new URLSearchParams(window.location.search);
  if (params.get('sub') === 'success') {
    history.replaceState(null, '', window.location.pathname);
    // Re-check after a brief delay to let webhook settle
    setTimeout(function() {
      checkSubStatus().then(function() {
        toast('Welcome to Breadcrumbs+! AI features are now unlocked.', 'success');
        switchTab('settings');
      });
    }, 1500);
  } else if (params.get('sub') === 'cancel') {
    history.replaceState(null, '', window.location.pathname);
    toast('Checkout cancelled — no charge was made.', 'info');
  }

  // Return from settings billing portal
  if (params.get('tab') === 'settings') {
    history.replaceState(null, '', window.location.pathname);
    switchTab('settings');
  }
});
