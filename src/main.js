import './style.css';
import { hasBackend, createTable, updateTable, loadTable, loadCards, addCard, deleteCard } from './supabase.js';

const BASE_URL = import.meta.env.BASE_URL;

const foods = [
  ['turkey','Roast turkey','mains','main','center'], ['ham','Honey ham','mains','ham','center'], ['chicken','Roast chicken','mains','chicken','center'], ['beef','Sliced roast beef','mains','beef','center'], ['veg-roast','Herb meatloaf','mains','veg','center'],
  ['mash','Mashed potatoes','sides','mash','bowl'], ['gravy','Gravy boat','sides','gravy','bowl'], ['mac','Mac & cheese','sides','mac','bowl'], ['beans','Green bean bake','sides','beans','bowl'], ['yams','Candied yams','sides','yams','bowl'], ['corn','Sweet corn','sides','corn','bowl'], ['carrots','Glazed carrots','sides','carrots','bowl'], ['sprouts','Brussels sprouts','sides','sprouts','bowl'], ['stuffing','Sage stuffing','sides','stuffing','bowl'], ['rolls','Dinner rolls','sides','rolls','basket'], ['cornbread','Cornbread','sides','cornbread','bowl'], ['cranberry','Cranberry sauce','sides','cranberry','bowl'], ['eggs','Loaded baked potato','sides','eggs','plate'], ['salad','Garden salad','sides','salad','bowl'],
  ['pumpkin-pie','Pumpkin pie','desserts','pie','pie'], ['apple-pie','Apple pie','desserts','applepie','pie'], ['pecan','Pecan pie','desserts','pecan','pie'], ['cheesecake','Cheesecake','desserts','cake','cake'], ['rolls-sweet','Cinnamon rolls','desserts','rollsSweet','plate'], ['cookies','Spiced cookies','desserts','cookies','plate'], ['brownies','Brownies','desserts','brownies','plate'], ['cupcakes','Cupcakes','desserts','cupcakes','plate'],
  ['cider','Apple cider','drinks','cider','drink'], ['cocoa','Hot cocoa','drinks','cocoa','drink'], ['lemonade','Lemonade','drinks','lemonade','drink'], ['cran-juice','Cranberry fizz','drinks','cranjuice','drink'], ['milk','Milk bottle','drinks','milk','drink'],
  ['cheese','Cheese board','snacks','cheese','board'], ['fruit','Fruit platter','snacks','fruit','board'], ['bread','Bread basket','snacks','bread','basket'],
  ['pumpkin','Pumpkin','decor','pumpkin','decor'], ['mini-pumpkin','Mini pumpkin','decor','minipumpkin','decor'], ['candle','Taper candles','decor','candle','decor'], ['leaves','Autumn leaves','decor','leaves','decor'], ['flowers','Sunflowers','decor','flowers','decor'], ['pinecone','Pinecones','decor','pinecone','decor'], ['placecard','Place card','decor','placecard','card'], ['cornucopia','Cornucopia','decor','cornucopia','decor']
];
const categoryNames = { all:'All pieces', mains:'Turkey & mains', sides:'Sides', desserts:'Desserts', drinks:'Drinks', snacks:'Snacks', decor:'Decorations' };
const categoryArt = { mains:'🍗', sides:'🥔', desserts:'🥧', drinks:'🥂', snacks:'🧀', decor:'🍂' };
const assetCategory = { decor:'decorations' };
const assetSlugs = { turkey:'roast-turkey', ham:'honey-ham', chicken:'rotisserie-turkey', beef:'roast-chicken', 'veg-roast':'vegetarian-roast', mash:'mashed-potatoes', gravy:'gravy', mac:'mac-and-cheese', beans:'green-bean-casserole', yams:'sweet-potato-casserole', corn:'corn', carrots:'glazed-carrots', sprouts:'brussels-sprouts', stuffing:'stuffing', rolls:'dinner-rolls', cornbread:'cornbread', cranberry:'cranberry-sauce', eggs:'deviled-eggs', salad:'rice', 'pumpkin-pie':'pumpkin-pie', 'apple-pie':'apple-pie', pecan:'pecan-pie', cheesecake:'cheesecake', 'rolls-sweet':'cinnamon-rolls', cookies:'cookies', brownies:'brownies', cupcakes:'cupcakes', cider:'apple-cider', cocoa:'hot-chocolate', lemonade:'lemonade', 'cran-juice':'cranberry-juice', milk:'milk', cheese:'cheese-platter', fruit:'fruit-platter', bread:'bread-basket', pumpkin:'pumpkins', 'mini-pumpkin':'mini-pumpkin', candle:'candle', leaves:'autumn-leaves', flowers:'sunflowers', pinecone:'pinecones', placecard:'place-card', cornucopia:'cornucopia' };
function assetFor(item) { return `${BASE_URL}assets/foods/${assetCategory[item[2]] || item[2]}/${assetSlugs[item[0]] || item[0]}.png`; }
const newTableId = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const OWNER_KEY = id => `harvest-table:owner:${id}`;
const LAST_KEY = 'harvest-table:last';
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode: owner link just won't be remembered */ } }
};
let state = { page:'home', filter:'all', selected:null, tableId:newTableId(), remoteId:null, editToken:null, hostName:'', isOwner:true, items:[], cards:[], history:[], future:[], zoom:1, gratitude:'', musicMuted:true, modal:null, shareUrl:'' };
let drag = null;
let saveTimer = null;
let lastSaved = '';

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
const num = (v, d) => Number.isFinite(Number(v)) ? Number(v) : d;
const foodById = id => foods.find(f => f[0] === id);
const cardFoods = ['turkey','pumpkin-pie','apple-pie','mash','cranberry','rolls','cider','cocoa','cookies','cupcakes','pumpkin','flowers','leaves','candle','cornucopia','cheese'];
const hostLabel = () => state.hostName ? `${state.hostName}'s` : 'Our';
function encodeTable(value) { return btoa(unescape(encodeURIComponent(JSON.stringify(value)))); }
function decodeTable(value) { return JSON.parse(decodeURIComponent(escape(atob(value)))); }
function fixAsset(asset) { return String(asset || '').replace(/^\/assets\//, `${BASE_URL}assets/`); }
function sanitizeItem(x) { return { uid:num(x.uid, Date.now()+Math.random()), kind:String(x.kind||''), name:String(x.name||''), asset:fixAsset(x.asset), x:num(x.x,50), y:num(x.y,50), rotate:num(x.rotate,0), scale:num(x.scale,1), z:num(x.z,3) }; }
function sanitizeCard(c) { return { id:String(c.id ?? `${Date.now()}-${Math.random()}`), message:String(c.message||'').slice(0,600), name:String(c.name ?? c.sender_name ?? '').slice(0,60), anonymous:Boolean(c.anonymous), food:String(c.food ?? c.food_asset ?? '') }; }
function arrangement() { return { items:state.items.map(sanitizeItem), gratitude:state.gratitude }; }
function snapshotKey() { return JSON.stringify({ a:arrangement(), h:state.hostName }); }
function pageBase() { return `${location.origin}${location.pathname}`; }
function tableLink() { return state.remoteId ? `${pageBase()}?t=${state.remoteId}` : `${pageBase()}#table=${encodeTable({ ...arrangement(), cards:state.cards, hostName:state.hostName })}`; }

function toast(message) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast'; el.setAttribute('role', 'status'); el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}
async function copyText(text) { try { await navigator.clipboard.writeText(text); return true; } catch { return false; } }

async function init() {
  const id = new URLSearchParams(location.search).get('t');
  if (id) {
    if (!hasBackend) { state.page = 'missing'; render(); return; }
    state.page = 'loading'; render();
    try {
      const table = await loadTable(id);
      if (!table) throw new Error('Table not found');
      state.remoteId = state.tableId = table.id;
      state.hostName = table.host_name || '';
      state.items = (table.arrangement?.items || []).map(sanitizeItem);
      state.gratitude = table.arrangement?.gratitude || '';
      state.editToken = store.get(OWNER_KEY(table.id));
      state.isOwner = Boolean(state.editToken);
      state.page = state.isOwner ? 'studio' : 'guest';
      lastSaved = snapshotKey();
      state.cards = (await loadCards(table.id)).map(sanitizeCard);
    } catch (err) {
      console.warn(err);
      if (state.page === 'loading') state.page = 'missing';
    }
    render(); return;
  }
  const raw = location.hash.match(/^#table=(.+)$/);
  if (raw) {
    try {
      const shared = decodeTable(raw[1]);
      state.items = (shared.items || []).map(sanitizeItem);
      state.cards = (shared.cards || shared.notes || []).map(sanitizeCard);
      state.gratitude = shared.gratitude || '';
      state.hostName = shared.hostName || '';
      state.isOwner = false; state.page = 'guest';
    } catch { history.replaceState(null, '', location.pathname); }
  }
  render();
}

// Creates the table in Supabase the first time, then keeps it saved. Returns the share link.
async function ensureShared() {
  if (hasBackend && !state.remoteId) {
    const { id, edit_token } = await createTable(state.hostName, arrangement());
    state.remoteId = state.tableId = id; state.editToken = edit_token; state.isOwner = true;
    store.set(OWNER_KEY(id), edit_token); store.set(LAST_KEY, id);
    lastSaved = snapshotKey();
    history.replaceState(null, '', `${location.pathname}?t=${id}`);
  } else {
    await saveNow();
  }
  state.shareUrl = tableLink();
  return state.shareUrl;
}
async function saveNow() {
  if (!hasBackend || !state.remoteId || !state.editToken) return;
  const key = snapshotKey();
  if (key === lastSaved) return;
  await updateTable(state.remoteId, state.editToken, state.hostName, arrangement());
  lastSaved = key;
}
function scheduleSave() {
  if (!state.isOwner || !state.remoteId || !state.editToken) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveNow().catch(err => { console.warn(err); toast('Couldn’t save your latest changes. Check your connection.'); }), 900);
}


function render() {
  const pages = { home, pantry, finish, guest, loading:loadingPage, missing:missingPage };
  document.querySelector('#app').innerHTML = (pages[state.page] || studio)() + modal();
  bind();
  scheduleSave();
}
function music() { return `<button class="music-toggle" data-music aria-label="${state.musicMuted?'Play':'Mute'} theme song" title="Play or mute theme song">${state.musicMuted?'♫':'🔊'}</button>`; }
// The YouTube player lives outside #app so re-rendering the page doesn't restart the song.
function ensureMusicPlayer() {
  if (document.querySelector('.music-dock')) return;
  const dock = document.createElement('div');
  dock.className = 'music-dock'; dock.setAttribute('aria-hidden', 'true');
  dock.innerHTML = '<iframe src="https://www.youtube.com/embed/4KJeS1MdYWc?enablejsapi=1&autoplay=1&mute=1&loop=1&playlist=4KJeS1MdYWc&playsinline=1" title="Thanksgiving theme song" allow="autoplay; encrypted-media"></iframe>';
  document.body.appendChild(dock);
}
function musicCommand(func) { document.querySelector('.music-dock iframe')?.contentWindow?.postMessage(JSON.stringify({ event:'command', func, args:[] }), '*'); }
function brand(attr='data-page="home"') { return `<button class="brand" ${attr}><span class="brand-mark">✦</span><span>Harvest <i>table</i></span></button>`; }
function header(active='') { return `<header class="topbar">${brand()}<nav><button class="nav-link ${active==='studio'?'active':''}" data-page="studio">Table studio</button><button class="nav-link ${active==='pantry'?'active':''}" data-page="pantry">The pantry</button>${music()}<span class="season-pill">Thanksgiving 2026 <b>↗</b></span></nav></header>`; }
function guestHeader() { return `<header class="topbar">${brand('data-new-table')}<nav>${music()}<button class="share-button" data-new-table>Make your own table</button></nav></header>`; }
function home() { const last = store.get(LAST_KEY); return `<main class="home-page"><div class="home-leaves"><span class="home-leaf leaf-a">✦</span><span class="home-leaf leaf-b">✦</span><span class="home-leaf leaf-c">✦</span><span class="home-leaf leaf-d">✦</span></div><header class="home-top">${brand()}${music()}</header><section class="home-hero"><div class="home-table-frame"><img src="${BASE_URL}cozy-thanksgiving-feast.webp" alt="A fully decorated Thanksgiving feast at golden hour"/></div><div class="home-cta"><h1>Your Thanksgiving, <em>your way.</em></h1><p class="home-sub">Decorate a table, share the link, and let everyone leave you a thank-you card.</p><div class="home-buttons"><button class="primary home-button" data-page="studio">Create my table <span>→</span></button>${last?`<button class="secondary home-button" data-open-table="${esc(last)}">Open my shared table</button>`:''}</div></div></section></main>`; }
function loadingPage() { return `<main class="status-page">${guestHeader()}<div class="status-inner"><span class="status-icon">✦</span><h1>Setting the table…</h1></div></main>`; }
function missingPage() { return `<main class="status-page">${guestHeader()}<div class="status-inner"><span class="status-icon">🍂</span><h1>We couldn’t find that table</h1><p>${hasBackend?'The link may be incomplete. Ask whoever sent it to copy it again.':'Shared tables aren’t switched on for this site yet.'}</p><button class="primary" data-new-table>Make your own table <span>→</span></button></div></main>`; }
function pantry() { const groups = ['mains','sides','desserts','drinks','snacks','decor']; return `<main class="pantry-page">${header('pantry')}<div class="pantry-heading"><div><p class="eyebrow">Take your pick</p><h1>The pantry</h1><p>Every good table starts with a little bit of everything.</p></div><button class="secondary" data-page="studio">Back to my table <span>→</span></button></div><div class="pantry-tabs"><button class="tab ${state.filter==='all'?'active':''}" data-filter="all">All pieces <small>${foods.length}</small></button>${groups.map(g=>`<button class="tab ${state.filter===g?'active':''}" data-filter="${g}">${categoryNames[g]} <small>${foods.filter(x=>x[2]===g).length}</small></button>`).join('')}</div><div class="pantry-grid">${foods.filter(x=>state.filter==='all'||x[2]===state.filter).map(item=>foodCard(item)).join('')}</div></main>`; }
function foodCard(item) { return `<button class="food-card" data-add="${item[0]}" title="Add ${item[1]}"><span class="card-art"><img src="${assetFor(item)}" alt="${item[1]}"/></span><span class="card-info"><small>${categoryNames[item[2]]}</small><strong>${item[1]}</strong><i>+ add to table</i></span></button>`; }
function tableArt(cls='table-art') { return `<img class="${cls}" src="${BASE_URL}thanksgiving-table.webp" alt="Illustrated Thanksgiving dinner table" draggable="false"/>`; }
const cardFrom = c => c.anonymous ? 'Someone special' : (c.name || 'A friend');
function cardIcon(c) { const f = foodById(c.food); return f ? `<img src="${assetFor(f)}" alt=""/>` : '<span>♡</span>'; }
function cardSticker(card, i) {
  const angle = i * 2.39996;
  const r = 0.6 + 0.4 * ((i % 5) / 4);
  const x = Math.max(8, Math.min(92, 50 + Math.cos(angle) * 40 * r));
  const y = Math.max(12, Math.min(88, 52 + Math.sin(angle) * 34 * r));
  return `<button class="card-sticker" data-read="${esc(card.id)}" style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%" title="A card from ${esc(cardFrom(card))}" aria-label="Read the card from ${esc(cardFrom(card))}">${cardIcon(card)}<i>✉</i></button>`;
}
function cardLayer() { return state.cards.slice(-40).map((c, i) => cardSticker(c, i)).join(''); }
function studio() { const visible = foods.filter(x=>state.filter==='all'||x[2]===state.filter); return `<main class="studio-page">${header('studio')}<div class="studio-layout"><aside class="studio-aside"><div class="aside-top"><div><p class="eyebrow">Your canvas</p><h2>Table studio</h2></div><span class="count"><b>${state.items.length}</b><small>pieces</small></span></div><p class="aside-desc">Choose a piece, then give it a place at the table. There is no wrong way to gather.</p><div class="progress"><span style="width:${Math.min(100,Math.max(8,state.items.length*8))}%"></span></div><button class="received-cards" data-cards><span>♡</span><div><b>${state.cards.length}</b><small>thank-you cards received</small></div></button><div class="filter-list">${Object.keys(categoryNames).map(k=>`<button class="filter ${state.filter===k?'selected':''}" data-filter="${k}"><span>${k==='all'?'✦':categoryArt[k]}</span>${categoryNames[k]}<b>${k==='all'?foods.length:foods.filter(x=>x[2]===k).length}</b></button>`).join('')}</div><button class="random-button" data-random><span>✧</span> Surprise me</button><button class="pantry-link" data-page="pantry">Browse all pieces <span>→</span></button></aside><section class="workspace"><div class="workspace-top"><div><p class="eyebrow">Thursday, November 26</p><h3>${esc(hostLabel())} Thanksgiving table <span>·</span> <em>${state.remoteId?'shared · saves automatically':'just getting started'}</em></h3></div><div class="workspace-actions"><button class="icon-button" data-undo title="Undo">↶</button><button class="icon-button" data-clear title="Clear table">⌫</button><button class="share-button" data-share>Share table</button><button class="finish-button" data-finish>Finish decorating <span>→</span></button></div></div><div class="table-stage"><div class="table-canvas" id="table-canvas" style="--zoom:${state.zoom}">${tableArt()}<div class="placement-layer">${state.items.map(item=>placed(item)).join('')}${cardLayer()}<div class="drop-hint ${state.items.length?'hidden':''}"><span>✦</span><strong>Start with a little something</strong><small>Pick a favorite from the pantry</small></div></div></div></div><div class="studio-bottom"><div class="quick-tools"><button data-rotate>↻ Rotate</button><button data-duplicate>＋ Duplicate</button><button data-delete>× Remove</button></div><div class="zoom-tools"><button data-zoom="-">−</button><span>${Math.round(state.zoom*100)}%</span><button data-zoom="+">＋</button></div><div class="gratitude"><span>♡</span><button data-write>Write a thank-you card</button><button data-share class="gratitude-share">Invite friends to write one →</button></div></div></section><aside class="mini-pantry"><div class="mini-heading"><h3>Pick a piece</h3><button data-page="pantry">View all</button></div><div class="mini-tabs"><button class="mini-tab ${state.filter==='all'?'active':''}" data-filter="all">All</button><button class="mini-tab ${state.filter==='mains'?'active':''}" data-filter="mains">Mains</button><button class="mini-tab ${state.filter==='sides'?'active':''}" data-filter="sides">Sides</button><button class="mini-tab ${state.filter==='desserts'?'active':''}" data-filter="desserts">Sweet</button></div><div class="mini-grid">${visible.slice(0,12).map(item=>foodCard(item)).join('')}</div><button class="feast-button" data-feast><span>✦</span> Build the ultimate feast</button></aside></div></main>`; }
function guest() { const n = state.cards.length; const who = state.hostName ? esc(state.hostName) : 'the host'; return `<main class="guest-page">${guestHeader()}<section class="guest-layout"><div class="guest-copy"><p class="eyebrow">You’re invited to the table</p><h1>${state.hostName?`${esc(state.hostName)}’s`:'A friend’s'} <em>Thanksgiving table</em></h1><p>Leave ${who} a thank-you card. It’ll sit right on the table next to everyone else’s.</p><div class="guest-actions"><button class="primary" data-write>Write a thank-you card <span>♡</span></button><button class="secondary" data-cards>Read the cards <span>${n}</span></button></div><button class="text-link" data-new-table>Make your own table →</button></div><div class="table-stage guest-stage"><div class="table-canvas">${tableArt()}<div class="placement-layer">${state.items.map(item=>placed(item, true)).join('')}${cardLayer()}${n?'':`<div class="drop-hint"><span>♡</span><strong>No cards yet</strong><small>Be the first to leave one</small></div>`}</div></div></div></section></main>`; }
function placed(x, readonly=false) { return `<div class="placed-item ${readonly?'readonly':''} ${!readonly&&state.selected===x.uid?'chosen':''}" data-uid="${x.uid}" style="left:${x.x}%;top:${x.y}%;transform:translate(-50%,-50%) rotate(${x.rotate}deg) scale(${x.scale});z-index:${x.z}"><img src="${esc(x.asset)}" alt="${esc(x.name)}" draggable="false"/>${readonly?'':`<button class="item-remove" data-item-delete="${x.uid}">×</button>`}</div>`; }
function finish() { return `<main class="finish-page">${header()}<div class="finish-inner"><div class="finish-copy"><p class="eyebrow">A table made with love</p><h1>Your Thanksgiving<br/><em>feast is ready!</em></h1><p>Now share the link so everyone can pull up a chair and leave you a thank-you card.</p><div class="finish-actions"><button class="primary" data-share>Share my table <span>↗</span></button><button class="secondary" data-cards>Read cards (${state.cards.length})</button><button class="secondary" data-download>Download dinner <span>↓</span></button><button class="secondary" data-page="studio">Edit table</button></div><div class="thankful-quote">“${esc(state.gratitude||'The best memories are made around the table.')}”</div></div><div class="final-table"><div class="table-canvas">${tableArt()}<div class="placement-layer">${state.items.map(item=>placed(item, true)).join('')}${cardLayer()}</div></div><div class="final-label"><span>✦</span> gathered at our table</div></div></div></main>`; }

function modal() {
  const m = state.modal; if (!m) return '';
  const who = state.hostName ? esc(state.hostName) : 'the host';
  let body = '';
  if (m.type === 'write') {
    body = `<h2>Write a thank-you card</h2><p class="modal-sub">${state.isOwner?'Add a card to your own table':`For ${who}’s Thanksgiving table`}</p><form data-card-form novalidate><label class="field"><span>Your message</span><textarea name="message" maxlength="600" rows="5" placeholder="I’m thankful for you because…"></textarea></label><div class="field-row"><label class="field"><span>Your name</span><input name="name" maxlength="60" autocomplete="name" placeholder="Optional"/></label><label class="check"><input type="checkbox" name="anonymous"/> Send anonymously</label></div><fieldset class="sticker-pick"><legend>Pick a sticker for your card</legend>${cardFoods.map((id, i) => { const f = foodById(id); return `<label title="${f[1]}"><input type="radio" name="food" value="${id}" ${i===0?'checked':''}/><img src="${assetFor(f)}" alt="${f[1]}"/></label>`; }).join('')}</fieldset><p class="form-error" hidden></p><div class="modal-actions"><button type="button" class="secondary" data-close>Cancel</button><button type="submit" class="primary">Place card on table <span>♡</span></button></div></form>`;
  } else if (m.type === 'read') {
    const c = state.cards.find(x => x.id === m.id); if (!c) return '';
    body = `<div class="card-read"><div class="card-read-icon">${cardIcon(c)}</div><p class="card-message">${esc(c.message)}</p><p class="card-from">— ${esc(cardFrom(c))}</p></div><div class="modal-actions">${state.isOwner?`<button class="secondary danger" data-delete-card="${esc(c.id)}">Remove card</button>`:''}<button class="secondary" data-cards>All cards</button><button class="primary" data-close>Close</button></div>`;
  } else if (m.type === 'list') {
    const n = state.cards.length;
    body = `<h2>Thank-you cards <small>${n}</small></h2>${n?`<div class="card-list">${state.cards.map(c=>`<button class="card-row" data-read="${esc(c.id)}"><span class="card-row-icon">${cardIcon(c)}</span><span><strong>${esc(c.message)}</strong><small>${esc(cardFrom(c))}</small></span></button>`).join('')}</div>`:`<p class="modal-sub">No cards yet. ${state.isOwner?'Share your link so friends can leave some!':'Be the first to leave one!'}</p>`}<div class="modal-actions">${state.isOwner?'<button class="secondary" data-share>Share my link</button>':''}<button class="primary" data-write>Write a card <span>♡</span></button></div>`;
  } else if (m.type === 'share') {
    body = `<h2>Invite people to your table</h2><p class="modal-sub">Anyone with the link can see your table and leave you a thank-you card.</p><label class="field"><span>Whose table is this?</span><input id="host-name" maxlength="40" value="${esc(state.hostName)}" placeholder="e.g. The Garcia family"/></label>${state.shareUrl?`<div class="share-link"><input id="share-url" readonly value="${esc(state.shareUrl)}"/><button class="primary" data-copy>Copy</button></div>`:''}<p class="form-error" ${m.error?'':'hidden'}>${esc(m.error||'')}</p>${hasBackend?'':'<p class="modal-note">Card syncing isn’t connected on this site yet, so this link carries a snapshot of your table. Guests can read it, but their cards won’t reach you until Supabase is set up.</p>'}<div class="modal-actions">${state.shareUrl&&navigator.share?'<button class="secondary" data-native-share>Share…</button>':''}<button class="primary" data-make-link>${state.shareUrl?'Save &amp; copy link':'Get my share link'} <span>↗</span></button></div>`;
  }
  return `<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true"><button class="modal-x" data-close aria-label="Close">×</button>${body}</div></div>`;
}

function snapshot(){ state.history.push(JSON.stringify(state.items)); if(state.history.length>30)state.history.shift(); state.future=[]; }
function addItem(id, x=50, y=50) { const f=foods.find(a=>a[0]===id); if(!f)return; snapshot(); state.items.push({uid:Date.now()+Math.random(),kind:f[3],name:f[1],asset:assetFor(f),x:x+(Math.random()*8-4),y:y+(Math.random()*8-4),rotate:(Math.random()*8-4),scale:f[4]==='center'?1.2:.83,z:state.items.length+3}); state.selected=state.items.at(-1).uid; render(); }
function closeModal() { state.modal = null; render(); }
async function submitCard(form) {
  const data = new FormData(form);
  const errorEl = form.querySelector('.form-error');
  const message = String(data.get('message') || '').trim();
  if (!message) { errorEl.hidden = false; errorEl.textContent = 'Write a little something first.'; return; }
  const card = { message: message.slice(0, 600), name: String(data.get('name') || '').trim().slice(0, 60), anonymous: data.get('anonymous') === 'on', food: String(data.get('food') || '') };
  const submit = form.querySelector('[type=submit]');
  submit.disabled = true; submit.textContent = 'Placing your card…';
  try {
    if (hasBackend && (state.remoteId || state.isOwner)) {
      if (!state.remoteId) await ensureShared();
      state.cards.push(sanitizeCard(await addCard(state.remoteId, card)));
    } else {
      state.cards.push(sanitizeCard({ ...card, id: newTableId() }));
      if (!state.isOwner) history.replaceState(null, '', `${location.pathname}#table=${encodeTable({ ...arrangement(), cards: state.cards, hostName: state.hostName })}`);
    }
    if (state.isOwner) state.gratitude = card.message;
    closeModal();
    toast(hasBackend || state.isOwner ? 'Your card is on the table ♡' : 'Card added! Send this page’s link back so they can see it.');
  } catch (err) {
    console.warn(err);
    submit.disabled = false; submit.textContent = 'Place card on table ♡';
    errorEl.hidden = false; errorEl.textContent = err.message;
  }
}
function bind(){
  const on = (sel, fn) => document.querySelectorAll(sel).forEach(el => el.addEventListener('click', e => fn(e, el)));
  on('[data-page]', (e,b)=>{state.page=b.dataset.page;state.modal=null;render()});
  document.querySelector('[data-music]')?.addEventListener('click',e=>{state.musicMuted=!state.musicMuted;musicCommand(state.musicMuted?'mute':'unMute');if(!state.musicMuted)musicCommand('playVideo');e.currentTarget.textContent=state.musicMuted?'♫':'🔊';e.currentTarget.setAttribute('aria-label',state.musicMuted?'Play theme song':'Mute theme song')});
  on('[data-share]', ()=>{ state.shareUrl = state.remoteId ? tableLink() : ''; state.modal={type:'share'}; render(); document.querySelector('#host-name')?.focus(); });
  on('[data-write]', ()=>{ state.modal={type:'write'}; render(); document.querySelector('[data-card-form] textarea')?.focus(); });
  on('[data-cards]', ()=>{ state.modal={type:'list'}; render(); });
  on('[data-read]', (e,b)=>{ e.stopPropagation(); state.modal={type:'read', id:b.dataset.read}; render(); });
  on('[data-close]', closeModal);
  document.querySelector('.modal-backdrop')?.addEventListener('click', e=>{ if (e.target === e.currentTarget) closeModal(); });
  document.querySelector('[data-card-form]')?.addEventListener('submit', e=>{ e.preventDefault(); submitCard(e.currentTarget); });
  on('[data-new-table]', ()=>{ location.href = location.pathname; });
  on('[data-open-table]', (e,b)=>{ location.href = `${location.pathname}?t=${encodeURIComponent(b.dataset.openTable)}`; });
  on('[data-make-link]', async (e,b)=>{
    state.hostName = (document.querySelector('#host-name')?.value || '').trim().slice(0, 40);
    b.disabled = true; b.textContent = 'Saving…';
    try { const url = await ensureShared(); const copied = await copyText(url); state.modal = {type:'share'}; render(); toast(copied ? 'Link copied! Send it to your people.' : 'Your link is ready. Copy it below.'); }
    catch (err) { console.warn(err); state.modal = {type:'share', error: err.message}; render(); }
  });
  on('[data-copy]', async ()=>{ const input=document.querySelector('#share-url'); input?.select(); toast(await copyText(state.shareUrl) ? 'Link copied!' : 'Press Ctrl+C / ⌘C to copy the link.'); });
  on('[data-native-share]', async ()=>{ try { await navigator.share({ title:`${hostLabel()} Thanksgiving table`, text:'Pull up a chair and leave me a thank-you card on my Thanksgiving table 🦃', url:state.shareUrl }); } catch { /* user cancelled */ } });
  on('[data-delete-card]', async (e,b)=>{
    const id = b.dataset.deleteCard;
    if (!confirm('Remove this card from your table?')) return;
    try { if (hasBackend && state.remoteId) await deleteCard(state.remoteId, state.editToken, id); state.cards = state.cards.filter(c => c.id !== id); state.modal = {type:'list'}; render(); toast('Card removed'); }
    catch (err) { console.warn(err); toast(err.message); }
  });
  document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{state.filter=b.dataset.filter;render()});
  document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{const offscreen=state.page==='pantry'||innerWidth<=760;addItem(b.dataset.add);if(offscreen)toast(`Added ${foodById(b.dataset.add)?.[1]||'it'} to your table`);});
  document.querySelectorAll('[data-item-delete]').forEach(b=>b.onclick=e=>{e.stopPropagation();const i=state.items.findIndex(x=>String(x.uid)===b.dataset.itemDelete);if(i>-1){snapshot();state.items.splice(i,1);state.selected=null;render()}});
  document.querySelectorAll('#table-canvas .placed-item:not(.readonly)').forEach(el=>{const item=state.items.find(x=>String(x.uid)===el.dataset.uid);if(!item)return;el.onpointerdown=e=>{if(e.target.classList.contains('item-remove'))return;state.selected=item.uid;snapshot();el.setPointerCapture(e.pointerId);drag={item,startX:e.clientX,startY:e.clientY,ox:item.x,oy:item.y};el.classList.add('dragging')};el.onpointermove=e=>{if(!drag||drag.item!==item)return;const stage=document.querySelector('#table-canvas').getBoundingClientRect();item.x=Math.max(8,Math.min(92,drag.ox+(e.clientX-drag.startX)/stage.width*100));item.y=Math.max(12,Math.min(86,drag.oy+(e.clientY-drag.startY)/stage.height*100));el.style.left=item.x+'%';el.style.top=item.y+'%'};el.onpointerup=()=>{if(drag){drag=null;render()}};el.onclick=()=>{state.selected=item.uid;render()}});
  document.querySelector('[data-undo]')?.addEventListener('click',()=>{if(state.history.length){state.future.push(JSON.stringify(state.items));state.items=JSON.parse(state.history.pop());render()}});
  document.querySelector('[data-clear]')?.addEventListener('click',()=>{if(state.items.length){snapshot();state.items=[];render()}});
  document.querySelector('[data-rotate]')?.addEventListener('click',()=>{const i=state.items.find(x=>x.uid===state.selected);if(i){snapshot();i.rotate+=15;render()}});
  document.querySelector('[data-duplicate]')?.addEventListener('click',()=>{const i=state.items.find(x=>x.uid===state.selected);if(i){snapshot();state.items.push({...i,uid:Date.now(),x:i.x+5,y:i.y+4,z:state.items.length+3});render()}});
  document.querySelector('[data-delete]')?.addEventListener('click',()=>{const i=state.items.findIndex(x=>x.uid===state.selected);if(i>-1){snapshot();state.items.splice(i,1);state.selected=null;render()}});
  document.querySelector('[data-feast]')?.addEventListener('click',()=>{snapshot();['turkey','mash','stuffing','cranberry','pumpkin-pie','cider','rolls','candle','flowers'].forEach((id,i)=>{const f=foods.find(a=>a[0]===id);state.items.push({uid:Date.now()+i,kind:f[3],name:f[1],asset:assetFor(f),x:25+(i%3)*25,y:32+Math.floor(i/3)*23,rotate:(i%2?5:-4),scale:f[4]==='center'?1.12:.75,z:i+3})});render()});
  document.querySelector('[data-random]')?.addEventListener('click',()=>addItem(foods[Math.floor(Math.random()*foods.length)][0],30+Math.random()*40,30+Math.random()*35));
  document.querySelector('[data-finish]')?.addEventListener('click',()=>{state.page='finish';render()});
  document.querySelectorAll('[data-zoom]').forEach(b=>b.onclick=()=>{state.zoom=Math.max(.7,Math.min(1.3,state.zoom+(b.dataset.zoom==='+'?.1:-.1)));render()});
  document.querySelector('[data-download]')?.addEventListener('click',()=>{const abs=p=>esc(new URL(p,location.href).href);const inner=state.items.map(item=>`<image href="${abs(item.asset)}" x="${item.x*6.2-310}" y="${item.y*4.1-205}" width="145" height="115" preserveAspectRatio="xMidYMid meet" transform="rotate(${item.rotate} ${item.x*6.2-237.5} ${item.y*4.1-147.5})"/>`).join('');const file=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 410"><image href="${abs(`${BASE_URL}thanksgiving-table.webp`)}" width="620" height="410" preserveAspectRatio="xMidYMid slice"/>${inner}<text x="310" y="390" text-anchor="middle" fill="#a16b50" font-family="Georgia" font-size="14">gathered at our table</text></svg>`;const blob=new Blob([file],{type:'image/svg+xml'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='my-thanksgiving-table.svg';a.click()});
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && state.modal) closeModal(); });
ensureMusicPlayer();
init();
