import './style.css';
import { hasBackend, createTable, updateTable, loadTable, loadCards, addCard, deleteCard } from './supabase.js';

const BASE_URL = import.meta.env.BASE_URL;

const foods = [
  ['turkey','Roast turkey','mains','main','center'], ['ham','Honey ham','mains','ham','center'], ['chicken','Roast chicken','mains','chicken','center'], ['beef','Sliced roast beef','mains','beef','center'], ['veg-roast','Herb meatloaf','mains','veg','center'],
  ['mash','Mashed potatoes','sides','mash','bowl'], ['gravy','Gravy boat','sides','gravy','bowl'], ['mac','Mac & cheese','sides','mac','bowl'], ['beans','Green bean bake','sides','beans','bowl'], ['yams','Candied yams','sides','yams','bowl'], ['corn','Sweet corn','sides','corn','bowl'], ['carrots','Glazed carrots','sides','carrots','bowl'], ['sprouts','Brussels sprouts','sides','sprouts','bowl'], ['stuffing','Sage stuffing','sides','stuffing','bowl'], ['rolls','Dinner rolls','sides','rolls','basket'], ['cornbread','Cornbread','sides','cornbread','bowl'], ['cranberry','Cranberry sauce','sides','cranberry','bowl'], ['eggs','Deviled eggs','sides','eggs','plate'], ['salad','Garden salad','sides','salad','bowl'],
  ['pumpkin-pie','Pumpkin pie','desserts','pie','pie'], ['apple-pie','Apple pie','desserts','applepie','pie'], ['pecan','Pecan pie','desserts','pecan','pie'], ['cheesecake','Cheesecake','desserts','cake','cake'], ['rolls-sweet','Cinnamon rolls','desserts','rollsSweet','plate'], ['cookies','Spiced cookies','desserts','cookies','plate'], ['brownies','Brownies','desserts','brownies','plate'], ['cupcakes','Cupcakes','desserts','cupcakes','plate'],
  ['cider','Apple cider','drinks','cider','drink'], ['cocoa','Hot cocoa','drinks','cocoa','drink'], ['lemonade','Lemonade','drinks','lemonade','drink'], ['cran-juice','Cranberry fizz','drinks','cranjuice','drink'], ['milk','Milk bottle','drinks','milk','drink'],
  ['cheese','Cheese board','snacks','cheese','board'], ['fruit','Fruit platter','snacks','fruit','board'], ['bread','Bread basket','snacks','bread','basket'],
  ['pumpkin','Pumpkin','decor','pumpkin','decor'], ['mini-pumpkin','Mini pumpkin','decor','minipumpkin','decor'], ['candle','Taper candles','decor','candle','decor'], ['leaves','Autumn leaves','decor','leaves','decor'], ['flowers','Sunflowers','decor','flowers','decor'], ['pinecone','Pinecones','decor','pinecone','decor'], ['placecard','Place card','decor','placecard','card'], ['cornucopia','Cornucopia','decor','cornucopia','decor']
];
const categoryNames = { all:'All pieces', mains:'Turkey & mains', sides:'Sides', desserts:'Desserts', drinks:'Drinks', snacks:'Snacks', decor:'Decorations' };
const categoryArt = { mains:'🍗', sides:'🥔', desserts:'🥧', drinks:'🥂', snacks:'🧀', decor:'🍂' };
const assetCategory = { decor:'decorations' };
const assetSlugs = { turkey:'roast-turkey', ham:'honey-ham', chicken:'rotisserie-turkey', beef:'roast-chicken', 'veg-roast':'vegetarian-roast', mash:'mashed-potatoes', gravy:'gravy', mac:'mac-and-cheese', beans:'green-bean-casserole', yams:'sweet-potato-casserole', corn:'corn', carrots:'glazed-carrots', sprouts:'brussels-sprouts', stuffing:'gravy', rolls:'dinner-rolls', cornbread:'cornbread', cranberry:'cranberry-sauce', eggs:'stuffing', salad:'rice', 'pumpkin-pie':'pumpkin-pie', 'apple-pie':'apple-pie', pecan:'pecan-pie', cheesecake:'cheesecake', 'rolls-sweet':'cinnamon-rolls', cookies:'cookies', brownies:'brownies', cupcakes:'cupcakes', cider:'apple-cider', cocoa:'hot-chocolate', lemonade:'lemonade', 'cran-juice':'cranberry-juice', milk:'milk', cheese:'cheese-platter', fruit:'fruit-platter', bread:'bread-basket', pumpkin:'pumpkins', 'mini-pumpkin':'mini-pumpkin', candle:'candle', leaves:'autumn-leaves', flowers:'sunflowers', pinecone:'pinecones', placecard:'place-card', cornucopia:'cornucopia' };
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

function svg(kind, thumb=false) {
  const scale = thumb ? 'viewBox="0 0 100 80"' : 'viewBox="0 0 180 140"';
  const w = thumb ? 100 : 180;
  const common = `<svg ${scale} xmlns="http://www.w3.org/2000/svg" width="${w}" height="${thumb?80:140}" aria-hidden="true">`;
  const plate = `<ellipse cx="90" cy="108" rx="70" ry="17" fill="#6d3b2b" opacity=".17"/><ellipse cx="90" cy="100" rx="58" ry="25" fill="#fff8eb" stroke="#d8c5aa" stroke-width="3"/>`;
  const map = {
    turkey:`${plate}<path d="M50 90c-10-22 5-48 34-45 8-28 43-27 52-2 24 1 31 26 17 43l-18 14H61z" fill="#b84f28" stroke="#7f321e" stroke-width="3"/><path d="M62 54c18 9 43 7 61-2M61 71c23 8 41 7 61-1" fill="none" stroke="#e98b43" stroke-width="5" stroke-linecap="round"/><circle cx="90" cy="67" r="5" fill="#efc46b"/>`,
    ham:`${plate}<path d="M54 88c-7-34 10-56 43-55 29 1 38 23 29 55z" fill="#d8844f" stroke="#8e452d" stroke-width="3"/><path d="M60 48l64 24M58 60l63 21M66 42l54 38" stroke="#f5c17e" stroke-width="4" opacity=".7"/>`,
    chicken:`${plate}<path d="M61 90c-15-30 8-52 29-45 13-20 43-8 40 15 18 13 2 38-18 34z" fill="#c2763b" stroke="#844324" stroke-width="3"/><path d="M70 57q25 12 48 0M70 73q21 11 43 4" stroke="#f4bb68" stroke-width="4" fill="none"/>`,
    drumstick:`${plate}<path d="M70 86Q43 55 65 40q17-10 32 6l16 26-11 19z" fill="#bf5c30" stroke="#813b24" stroke-width="3"/><path d="M101 69l22 24q5 6 0 11l-6 3-28-28z" fill="#f0c48e" stroke="#9f704b" stroke-width="3"/>`,
    beef:`${plate}<path d="M47 83q6-40 43-43 39 2 43 41-35 26-86 2z" fill="#873d32" stroke="#612b27" stroke-width="3"/><path d="M57 70q28 10 65 0M61 80q24 8 54 1" fill="none" stroke="#c96d55" stroke-width="5"/>`,
    veg:`${plate}<path d="M45 81q8-40 45-41t45 41q-44 24-90 0z" fill="#9d7434" stroke="#6b4f28" stroke-width="3"/><path d="M56 72q15-20 29 0 16-21 30 0" fill="none" stroke="#739347" stroke-width="9"/>`,
    mash:`${plate}<path d="M51 87q-6-34 39-39 45 5 39 39-37 18-78 0z" fill="#ead7a7" stroke="#a88c5d" stroke-width="3"/><path d="M68 69q20-16 43 0" fill="none" stroke="#fff3cd" stroke-width="6"/><circle cx="91" cy="71" r="7" fill="#d09a4a"/>`,
    gravy:`<path d="M50 70h70l-7 27H58z" fill="#c8b38b" stroke="#826950" stroke-width="3"/><path d="M120 76q22-6 20 10-2 11-15 8" fill="none" stroke="#826950" stroke-width="5"/><ellipse cx="85" cy="72" rx="31" ry="10" fill="#8b492e"/>`,
    mac:`${plate}<ellipse cx="90" cy="78" rx="42" ry="25" fill="#efb451" stroke="#9d5b32" stroke-width="3"/><path d="M62 75q12-15 22 3t20 0 15 3M62 88q12-15 22 2t20 0 15 2" fill="none" stroke="#ffe18c" stroke-width="5"/>`,
    beans:`${plate}<ellipse cx="90" cy="78" rx="45" ry="25" fill="#9c7545" stroke="#765331" stroke-width="3"/><path d="M55 76q20-25 31 0t27 0 15 2M60 87q17-18 27 0t24 0" fill="none" stroke="#668343" stroke-width="7"/>`,
    yams:`${plate}<ellipse cx="90" cy="80" rx="44" ry="25" fill="#dd8331" stroke="#9a4d25" stroke-width="3"/><path d="M57 77q30 20 66 0" stroke="#f5bc54" stroke-width="6" fill="none"/><circle cx="77" cy="72" r="4" fill="#fff0b1"/><circle cx="103" cy="89" r="4" fill="#fff0b1"/>`,
    corn:`${plate}<path d="M55 77q35-23 70 0-8 27-70 0z" fill="#f4c84f" stroke="#ba782d" stroke-width="3"/><path d="M66 76l43 0M70 84l36 0" stroke="#fff09a" stroke-width="4"/>`,
    carrots:`${plate}<path d="M48 82q42-29 84 0-40 28-84 0z" fill="#cc6d32" stroke="#904322" stroke-width="3"/><path d="M65 75l10 12M80 71l8 15M97 71l-2 14M112 76l-8 12" stroke="#f6c05c" stroke-width="7"/>`,
    sprouts:`${plate}<ellipse cx="90" cy="80" rx="43" ry="24" fill="#738347" stroke="#4c5e35" stroke-width="3"/><circle cx="65" cy="75" r="11" fill="#a5aa58"/><circle cx="90" cy="69" r="12" fill="#a5aa58"/><circle cx="114" cy="79" r="11" fill="#a5aa58"/>`,
    stuffing:`${plate}<ellipse cx="90" cy="80" rx="44" ry="24" fill="#b7864d" stroke="#80542e" stroke-width="3"/><path d="M57 80l12-10 10 12 11-13 10 13 11-9" stroke="#d9ac69" stroke-width="7" fill="none"/>`,
    rolls:`${plate}<circle cx="66" cy="77" r="16" fill="#d9994a"/><circle cx="91" cy="69" r="16" fill="#e0a154"/><circle cx="113" cy="81" r="16" fill="#d18b43"/><path d="M60 76h13M85 68h13M107 80h13" stroke="#f5c379" stroke-width="3"/>`,
    cornbread:`${plate}<rect x="51" y="54" width="78" height="43" rx="5" fill="#d9993e" stroke="#92562c" stroke-width="3"/><path d="M58 67h64M58 80h64" stroke="#f4c45f" stroke-width="4"/>`,
    cranberry:`${plate}<ellipse cx="90" cy="79" rx="43" ry="24" fill="#a72f3e" stroke="#762735" stroke-width="3"/><circle cx="69" cy="74" r="4" fill="#de6a62"/><circle cx="86" cy="87" r="4" fill="#e17a68"/><circle cx="108" cy="73" r="4" fill="#e17a68"/>`,
    eggs:`${plate}<ellipse cx="64" cy="76" rx="15" ry="10" fill="#fff2c8"/><ellipse cx="90" cy="69" rx="15" ry="10" fill="#fff2c8"/><ellipse cx="116" cy="78" rx="15" ry="10" fill="#fff2c8"/><circle cx="64" cy="76" r="5" fill="#dda446"/><circle cx="90" cy="69" r="5" fill="#dda446"/><circle cx="116" cy="78" r="5" fill="#dda446"/>`,
    salad:`${plate}<ellipse cx="90" cy="79" rx="46" ry="24" fill="#78a050" stroke="#476b3d" stroke-width="3"/><path d="M58 81q16-29 29 0 15-31 28 0 14-22 22 1" fill="none" stroke="#d4df78" stroke-width="8"/><circle cx="75" cy="73" r="4" fill="#d56a4a"/><circle cx="105" cy="88" r="4" fill="#d56a4a"/>`,
    pie:`${plate}<path d="M48 78l15-28h55l14 28q-40 24-84 0z" fill="#d79545" stroke="#8a4d2a" stroke-width="3"/><path d="M63 59h50" stroke="#f0c275" stroke-width="5"/><path d="M71 67q19 8 38 0" fill="none" stroke="#b66b35" stroke-width="3"/>`,
    applepie:`${plate}<path d="M48 78l15-28h55l14 28q-40 24-84 0z" fill="#b65b37" stroke="#773426" stroke-width="3"/><path d="M63 59h50M69 69h40" stroke="#e7aa5b" stroke-width="5"/>`,
    pecan:`${plate}<path d="M48 78l15-28h55l14 28q-40 24-84 0z" fill="#8f542d" stroke="#613625" stroke-width="3"/><path d="M65 65q8-11 16 0t16 0 16 0" fill="none" stroke="#d39a4e" stroke-width="6"/>`,
    cake:`${plate}<path d="M53 70h74v26H53z" fill="#e9d7b7" stroke="#9b6a51" stroke-width="3"/><path d="M53 70q37 15 74 0" fill="#b85b4e"/><path d="M61 84h58" stroke="#fff2d5" stroke-width="5"/>`,
    rollsSweet:`${plate}<circle cx="70" cy="76" r="20" fill="#c17a3e" stroke="#86502e" stroke-width="3"/><circle cx="108" cy="76" r="20" fill="#c17a3e" stroke="#86502e" stroke-width="3"/><path d="M62 76q8-12 16 0t-4 12M100 76q8-12 16 0t-4 12" fill="none" stroke="#f3c176" stroke-width="4"/>`,
    cookies:`${plate}<circle cx="68" cy="77" r="16" fill="#c78143"/><circle cx="91" cy="70" r="16" fill="#dda057"/><circle cx="114" cy="79" r="16" fill="#b96f3c"/><g fill="#713d2c"><circle cx="64" cy="73" r="3"/><circle cx="72" cy="82" r="3"/><circle cx="88" cy="66" r="3"/><circle cx="101" cy="77" r="3"/><circle cx="115" cy="72" r="3"/></g>`,
    brownies:`${plate}<rect x="52" y="55" width="76" height="40" rx="4" fill="#603b2c" stroke="#43291f" stroke-width="3"/><path d="M72 55v40M96 55v40M52 75h76" stroke="#8f6043" stroke-width="2"/>`,
    cupcakes:`${plate}<path d="M62 68h56l-7 29H69z" fill="#d87c56" stroke="#91452f" stroke-width="3"/><path d="M59 68q4-25 31-17 27-8 31 17" fill="#d79bca" stroke="#9a5c94" stroke-width="3"/>`,
    icecream:`${plate}<path d="M68 61h44l-8 39H76z" fill="#d89043" stroke="#92552f" stroke-width="3"/><circle cx="80" cy="58" r="15" fill="#f2af9d"/><circle cx="102" cy="58" r="15" fill="#f5d28c"/>`,
    cider:`<path d="M68 45h44l-5 57H73z" fill="#b96738" stroke="#7c432e" stroke-width="3"/><path d="M73 64h34" stroke="#e4a359" stroke-width="5"/><path d="M90 45V29" stroke="#718345" stroke-width="4"/><circle cx="90" cy="25" r="9" fill="#c55e37"/>`,
    cocoa:`<path d="M57 63h65l-7 38H64z" fill="#d46d45" stroke="#843f2e" stroke-width="3"/><ellipse cx="89" cy="63" rx="33" ry="10" fill="#713d2d"/><circle cx="77" cy="58" r="7" fill="#fff5dc"/><circle cx="96" cy="58" r="7" fill="#fff5dc"/>`,
    lemonade:`<path d="M65 45h50l-4 56H69z" fill="#e4c35d" stroke="#9d773c" stroke-width="3"/><path d="M67 66h46" stroke="#fff0a1" stroke-width="5"/><circle cx="92" cy="44" r="13" fill="#f4e68c"/><path d="M92 44l9-16" stroke="#6b8b55" stroke-width="4"/>`,
    cranjuice:`<path d="M66 45h48l-4 56H70z" fill="#b43c4b" stroke="#7d2d36" stroke-width="3"/><circle cx="90" cy="44" r="13" fill="#e3a5a0"/><path d="M90 44l6-15" stroke="#6b8b55" stroke-width="4"/>`,
    water:`<path d="M69 42h42l-5 60H74z" fill="#d7e7dc" fill-opacity=".9" stroke="#8fb3a0" stroke-width="3"/><path d="M73 69h34" stroke="#91c9cf" stroke-width="5"/>`,
    latte:`<path d="M64 58h52l-5 42H69z" fill="#c58855" stroke="#805139" stroke-width="3"/><ellipse cx="90" cy="58" rx="26" ry="9" fill="#805139"/><path d="M78 56q12-9 24 0" stroke="#f6e0c1" stroke-width="4" fill="none"/>`,
    milk:`<path d="M70 39h40v65H70z" fill="#f8f0d7" stroke="#ad9c7a" stroke-width="3"/><path d="M70 54h40" stroke="#d48352" stroke-width="9"/><path d="M78 39v-9h24v9" fill="#c97048"/>`,
    cheese:`${plate}<path d="M46 88l29-36 59 13-18 29z" fill="#f0c455" stroke="#a8752d" stroke-width="3"/><circle cx="90" cy="73" r="4" fill="#bc8734"/><circle cx="110" cy="78" r="3" fill="#bc8734"/>`,
    fruit:`${plate}<path d="M48 84q42-39 84 0-42 24-84 0z" fill="#cc7560" stroke="#8e4d40" stroke-width="3"/><circle cx="67" cy="75" r="8" fill="#dfb044"/><circle cx="88" cy="70" r="9" fill="#7fa053"/><circle cx="108" cy="80" r="9" fill="#ad5360"/>`,
    grapes:`${plate}<path d="M90 50v10" stroke="#5b783d" stroke-width="4"/><g fill="#7c8c3e"><circle cx="82" cy="65" r="9"/><circle cx="98" cy="65" r="9"/><circle cx="82" cy="80" r="9"/><circle cx="98" cy="80" r="9"/><circle cx="90" cy="94" r="9"/></g>`,
    apples:`${plate}<circle cx="75" cy="73" r="18" fill="#c9533e"/><circle cx="105" cy="78" r="18" fill="#d9a347"/><path d="M76 55q3-10 10-10M106 60q2-9 9-10" stroke="#5c743f" stroke-width="4"/>`,
    bread:`${plate}<path d="M50 84q0-32 40-32t40 32z" fill="#c98a4a" stroke="#86502d" stroke-width="3"/><path d="M68 65l9 11M90 61v14M111 65l-9 11" stroke="#f4c37a" stroke-width="5"/>`,
    nuts:`${plate}<ellipse cx="90" cy="80" rx="45" ry="24" fill="#ae703d" stroke="#704327" stroke-width="3"/><circle cx="70" cy="75" r="7" fill="#d09a57"/><circle cx="88" cy="87" r="7" fill="#d09a57"/><circle cx="108" cy="72" r="7" fill="#d09a57"/>`,
    pumpkin:`<ellipse cx="90" cy="78" rx="32" ry="28" fill="#d77932" stroke="#934523" stroke-width="3"/><path d="M90 50v56M72 55q-12 23 0 46M108 55q12 23 0 46" fill="none" stroke="#eea34d" stroke-width="5"/><path d="M90 50V39" stroke="#5d763b" stroke-width="6"/>`,
    minipumpkin:`<ellipse cx="90" cy="80" rx="22" ry="20" fill="#d77932" stroke="#934523" stroke-width="3"/><path d="M90 61v37M78 64q-8 16 0 31M102 64q8 16 0 31" fill="none" stroke="#eea34d" stroke-width="4"/><path d="M90 62v-8" stroke="#5d763b" stroke-width="4"/>`,
    candle:`<path d="M71 91h38l-5 12H76z" fill="#b28350"/><rect x="77" y="43" width="26" height="50" rx="8" fill="#f8efc9" stroke="#b89c68" stroke-width="2"/><path d="M90 43q-8-13 0-23 8 10 0 23" fill="#ec9f3f" stroke="#d26732" stroke-width="2"/>`,
    leaves:`<path d="M90 97q-35-23-40-57 35 8 40 45 5-37 40-45-5 34-40 57z" fill="#c45735" stroke="#8b3e2a" stroke-width="3"/><path d="M90 97V42M90 69L63 51M90 73l27-22" stroke="#e28a46" stroke-width="3"/>`,
    flowers:`<path d="M90 65v46" stroke="#688249" stroke-width="5"/><circle cx="90" cy="53" r="13" fill="#8c6f34"/><g fill="#e58d3b"><ellipse cx="90" cy="35" rx="8" ry="20"/><ellipse cx="90" cy="71" rx="8" ry="20"/><ellipse cx="72" cy="53" rx="20" ry="8"/><ellipse cx="108" cy="53" rx="20" ry="8"/></g>`,
    pinecone:`<path d="M90 40q-26 20-18 61h36q8-41-18-61z" fill="#875334" stroke="#5e3827" stroke-width="3"/><path d="M78 55l24 37M73 68l33 21M73 82l28 12" stroke="#be8151" stroke-width="5"/>`,
    placecard:`<path d="M45 93l45-55 45 55z" fill="#f8ebcf" stroke="#a77f5a" stroke-width="3"/><text x="90" y="78" text-anchor="middle" font-family="Georgia" font-size="12" fill="#8f4d3b">GIVE</text><text x="90" y="90" text-anchor="middle" font-family="Georgia" font-size="12" fill="#8f4d3b">THANKS</text>`,
    lights:`<path d="M37 75q53-46 106 0" fill="none" stroke="#9b6a47" stroke-width="3"/><circle cx="52" cy="65" r="5" fill="#f4c65c"/><circle cx="74" cy="53" r="5" fill="#e57945"/><circle cx="106" cy="54" r="5" fill="#f4c65c"/><circle cx="129" cy="66" r="5" fill="#db664c"/>`,
    cornucopia:`<path d="M45 56q10 50 75 39 15-2 15-18-20 16-47 5-22-10-23-38z" fill="#b7793f" stroke="#75472c" stroke-width="3"/><circle cx="112" cy="69" r="10" fill="#d48b3b"/><circle cx="127" cy="76" r="8" fill="#b54d3c"/>`,
    acorns:`<path d="M65 68q-5-23 18-25 20 2 16 25z" fill="#9c663c" stroke="#67442d" stroke-width="3"/><path d="M62 58q27-15 41 0" stroke="#d19a5d" stroke-width="5"/><path d="M80 68v24" stroke="#5d743b" stroke-width="4"/><path d="M112 60q-3 17 13 21 15-3 13-20z" fill="#ad733d" stroke="#6d482d" stroke-width="3"/>`
  };
  return common + (map[kind] || map.pumpkin) + '</svg>';
}

function render() {
  const pages = { home, pantry, finish, guest, loading:loadingPage, missing:missingPage };
  document.querySelector('#app').innerHTML = (pages[state.page] || studio)() + modal();
  bind();
  scheduleSave();
}
function music() { return `<button class="music-toggle" data-music title="Mute or unmute theme song">${state.musicMuted?'♫':'🔊'}</button><div class="music-dock" aria-hidden="true"><iframe src="https://www.youtube.com/embed/4KJeS1MdYWc?enablejsapi=1&autoplay=1&mute=${state.musicMuted?'1':'0'}&loop=1&playlist=4KJeS1MdYWc" title="Thanksgiving theme song" allow="autoplay; encrypted-media"></iframe></div>`; }
function brand(attr='data-page="home"') { return `<button class="brand" ${attr}><span class="brand-mark">✦</span><span>Harvest <i>table</i></span></button>`; }
function header(active='') { return `<header class="topbar">${brand()}<nav><button class="nav-link ${active==='studio'?'active':''}" data-page="studio">Table studio</button><button class="nav-link ${active==='pantry'?'active':''}" data-page="pantry">The pantry</button>${music()}<span class="season-pill">Thanksgiving 2026 <b>↗</b></span></nav></header>`; }
function guestHeader() { return `<header class="topbar">${brand('data-new-table')}<nav>${music()}<button class="share-button" data-new-table>Make your own table</button></nav></header>`; }
function home() { const last = store.get(LAST_KEY); return `<main class="home-page"><div class="home-leaves"><span class="home-leaf leaf-a">✦</span><span class="home-leaf leaf-b">✦</span><span class="home-leaf leaf-c">✦</span><span class="home-leaf leaf-d">✦</span></div><header class="home-top">${brand()}${music()}</header><section class="home-hero"><div class="home-table-frame"><img src="${BASE_URL}cozy-thanksgiving-feast.png" alt="A fully decorated Thanksgiving feast at golden hour"/></div><div class="home-cta"><h1>Your Thanksgiving, <em>your way.</em></h1><p class="home-sub">Decorate a table, share the link, and let everyone leave you a thank-you card.</p><div class="home-buttons"><button class="primary home-button" data-page="studio">Create my table <span>→</span></button>${last?`<button class="secondary home-button" data-open-table="${esc(last)}">Open my shared table</button>`:''}</div></div></section></main>`; }
function loadingPage() { return `<main class="status-page">${guestHeader()}<div class="status-inner"><span class="status-icon">✦</span><h1>Setting the table…</h1></div></main>`; }
function missingPage() { return `<main class="status-page">${guestHeader()}<div class="status-inner"><span class="status-icon">🍂</span><h1>We couldn’t find that table</h1><p>${hasBackend?'The link may be incomplete. Ask whoever sent it to copy it again.':'Shared tables aren’t switched on for this site yet.'}</p><button class="primary" data-new-table>Make your own table <span>→</span></button></div></main>`; }
function pantry() { const groups = ['mains','sides','desserts','drinks','snacks','decor']; return `<main class="pantry-page">${header('pantry')}<div class="pantry-heading"><div><p class="eyebrow">Take your pick</p><h1>The pantry</h1><p>Every good table starts with a little bit of everything.</p></div><button class="secondary" data-page="studio">Back to my table <span>→</span></button></div><div class="pantry-tabs"><button class="tab active" data-filter="all">All pieces <small>${foods.length}</small></button>${groups.map(g=>`<button class="tab" data-filter="${g}">${categoryNames[g]} <small>${foods.filter(x=>x[2]===g).length}</small></button>`).join('')}</div><div class="pantry-grid">${foods.map(item=>foodCard(item)).join('')}</div></main>`; }
function foodCard(item) { return `<button class="food-card" data-add="${item[0]}" title="Add ${item[1]}"><span class="card-art"><img src="${assetFor(item)}" alt="${item[1]}"/></span><span class="card-info"><small>${categoryNames[item[2]]}</small><strong>${item[1]}</strong><i>+ add to table</i></span></button>`; }
function tableArt(cls='table-art') { return `<img class="${cls}" src="${BASE_URL}thanksgiving-table.png" alt="Illustrated Thanksgiving dinner table" draggable="false"/>`; }
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
function studio() { const visible = foods.filter(x=>state.filter==='all'||x[2]===state.filter); return `<main class="studio-page">${header('studio')}<div class="studio-layout"><aside class="studio-aside"><div class="aside-top"><div><p class="eyebrow">Your canvas</p><h2>Table studio</h2></div><span class="count"><b>${state.items.length}</b><small>pieces</small></span></div><p class="aside-desc">Choose a piece, then give it a place at the table. There is no wrong way to gather.</p><div class="progress"><span style="width:${Math.min(100,Math.max(8,state.items.length*8))}%"></span></div><button class="received-cards" data-cards><span>♡</span><div><b>${state.cards.length}</b><small>thank-you cards received</small></div></button><div class="filter-list">${Object.keys(categoryNames).map(k=>`<button class="filter ${state.filter===k?'selected':''}" data-filter="${k}"><span>${k==='all'?'✦':categoryArt[k]}</span>${categoryNames[k]}<b>${k==='all'?foods.length:foods.filter(x=>x[2]===k).length}</b></button>`).join('')}</div><button class="random-button" data-random><span>✧</span> Surprise me</button><button class="pantry-link" data-page="pantry">Browse all pieces <span>→</span></button></aside><section class="workspace"><div class="workspace-top"><div><p class="eyebrow">Thursday, November 26</p><h3>${esc(hostLabel())} Thanksgiving table <span>·</span> <em>${state.remoteId?'shared · saves automatically':'just getting started'}</em></h3></div><div class="workspace-actions"><button class="icon-button" data-undo title="Undo">↶</button><button class="icon-button" data-clear title="Clear table">⌫</button><button class="share-button" data-share>Share table</button><button class="finish-button" data-finish>Finish decorating <span>→</span></button></div></div><div class="table-stage" id="table-stage">${tableArt()}<div class="placement-layer">${state.items.map(item=>placed(item)).join('')}${cardLayer()}<div class="drop-hint ${state.items.length?'hidden':''}"><span>✦</span><strong>Start with a little something</strong><small>Pick a favorite from the pantry</small></div></div></div><div class="studio-bottom"><div class="quick-tools"><button data-rotate>↻ Rotate</button><button data-duplicate>＋ Duplicate</button><button data-delete>× Remove</button></div><div class="zoom-tools"><button data-zoom="-">−</button><span>${Math.round(state.zoom*100)}%</span><button data-zoom="+">＋</button></div><div class="gratitude"><span>♡</span><button data-write>Write a thank-you card</button><button data-share class="gratitude-share">Invite friends to write one →</button></div></div></section><aside class="mini-pantry"><div class="mini-heading"><h3>Pick a piece</h3><button data-page="pantry">View all</button></div><div class="mini-tabs"><button class="mini-tab ${state.filter==='all'?'active':''}" data-filter="all">All</button><button class="mini-tab ${state.filter==='mains'?'active':''}" data-filter="mains">Mains</button><button class="mini-tab ${state.filter==='sides'?'active':''}" data-filter="sides">Sides</button><button class="mini-tab ${state.filter==='desserts'?'active':''}" data-filter="desserts">Sweet</button></div><div class="mini-grid">${visible.slice(0,12).map(item=>foodCard(item)).join('')}</div><button class="feast-button" data-feast><span>✦</span> Build the ultimate feast</button></aside></div></main>`; }
function guest() { const n = state.cards.length; const who = state.hostName ? esc(state.hostName) : 'the host'; return `<main class="guest-page">${guestHeader()}<section class="guest-layout"><div class="guest-copy"><p class="eyebrow">You’re invited to the table</p><h1>${state.hostName?`${esc(state.hostName)}’s`:'A friend’s'} <em>Thanksgiving table</em></h1><p>Leave ${who} a thank-you card. It’ll sit right on the table next to everyone else’s.</p><div class="guest-actions"><button class="primary" data-write>Write a thank-you card <span>♡</span></button><button class="secondary" data-cards>Read the cards <span>${n}</span></button></div><button class="text-link" data-new-table>Make your own table →</button></div><div class="table-stage guest-stage">${tableArt()}<div class="placement-layer">${state.items.map(item=>placed(item, true)).join('')}${cardLayer()}${n?'':`<div class="drop-hint"><span>♡</span><strong>No cards yet</strong><small>Be the first to leave one</small></div>`}</div></div></section></main>`; }
function placed(x, readonly=false) { return `<div class="placed-item ${readonly?'readonly':''} ${!readonly&&state.selected===x.uid?'chosen':''}" data-uid="${x.uid}" style="left:${x.x}%;top:${x.y}%;transform:translate(-50%,-50%) rotate(${x.rotate}deg) scale(${x.scale});z-index:${x.z}"><img src="${esc(x.asset)}" alt="${esc(x.name)}" draggable="false"/>${readonly?'':`<button class="item-remove" data-item-delete="${x.uid}">×</button>`}</div>`; }
function finish() { return `<main class="finish-page">${header()}<div class="finish-inner"><div class="finish-copy"><p class="eyebrow">A table made with love</p><h1>Your Thanksgiving<br/><em>feast is ready!</em></h1><p>Now share the link so everyone can pull up a chair and leave you a thank-you card.</p><div class="finish-actions"><button class="primary" data-share>Share my table <span>↗</span></button><button class="secondary" data-cards>Read cards (${state.cards.length})</button><button class="secondary" data-download>Download dinner <span>↓</span></button><button class="secondary" data-page="studio">Edit table</button></div><div class="thankful-quote">“${esc(state.gratitude||'The best memories are made around the table.')}”</div></div><div class="final-table">${tableArt('')}<div class="final-items">${state.items.map(item=>placed(item, true)).join('')}</div><div class="final-label"><span>✦</span> gathered at our table</div></div></div></main>`; }

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
  document.querySelector('[data-music]')?.addEventListener('click',e=>{const frame=document.querySelector('.music-dock iframe');state.musicMuted=!state.musicMuted;frame?.contentWindow.postMessage(JSON.stringify({event:'command',func:state.musicMuted?'mute':'unMute',args:[]}), '*');e.currentTarget.textContent=state.musicMuted?'♫':'🔊';e.currentTarget.setAttribute('aria-label',state.musicMuted?'Unmute theme song':'Mute theme song')});
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
  document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{addItem(b.dataset.add)});
  document.querySelectorAll('[data-item-delete]').forEach(b=>b.onclick=e=>{e.stopPropagation();const i=state.items.findIndex(x=>String(x.uid)===b.dataset.itemDelete);if(i>-1){snapshot();state.items.splice(i,1);state.selected=null;render()}});
  document.querySelectorAll('#table-stage .placed-item:not(.readonly)').forEach(el=>{const item=state.items.find(x=>String(x.uid)===el.dataset.uid);if(!item)return;el.onpointerdown=e=>{if(e.target.classList.contains('item-remove'))return;state.selected=item.uid;snapshot();el.setPointerCapture(e.pointerId);drag={item,startX:e.clientX,startY:e.clientY,ox:item.x,oy:item.y};el.classList.add('dragging')};el.onpointermove=e=>{if(!drag||drag.item!==item)return;const stage=document.querySelector('#table-stage').getBoundingClientRect();item.x=Math.max(8,Math.min(92,drag.ox+(e.clientX-drag.startX)/stage.width*100));item.y=Math.max(12,Math.min(86,drag.oy+(e.clientY-drag.startY)/stage.height*100));el.style.left=item.x+'%';el.style.top=item.y+'%'};el.onpointerup=()=>{if(drag){drag=null;render()}};el.onclick=()=>{state.selected=item.uid;render()}});
  document.querySelector('[data-undo]')?.addEventListener('click',()=>{if(state.history.length){state.future.push(JSON.stringify(state.items));state.items=JSON.parse(state.history.pop());render()}});
  document.querySelector('[data-clear]')?.addEventListener('click',()=>{if(state.items.length){snapshot();state.items=[];render()}});
  document.querySelector('[data-rotate]')?.addEventListener('click',()=>{const i=state.items.find(x=>x.uid===state.selected);if(i){snapshot();i.rotate+=15;render()}});
  document.querySelector('[data-duplicate]')?.addEventListener('click',()=>{const i=state.items.find(x=>x.uid===state.selected);if(i){snapshot();state.items.push({...i,uid:Date.now(),x:i.x+5,y:i.y+4,z:state.items.length+3});render()}});
  document.querySelector('[data-delete]')?.addEventListener('click',()=>{const i=state.items.findIndex(x=>x.uid===state.selected);if(i>-1){snapshot();state.items.splice(i,1);state.selected=null;render()}});
  document.querySelector('[data-feast]')?.addEventListener('click',()=>{snapshot();['turkey','mash','stuffing','cranberry','pumpkin-pie','cider','rolls','candle','flowers'].forEach((id,i)=>{const f=foods.find(a=>a[0]===id);state.items.push({uid:Date.now()+i,kind:f[3],name:f[1],asset:assetFor(f),x:25+(i%3)*25,y:32+Math.floor(i/3)*23,rotate:(i%2?5:-4),scale:f[4]==='center'?1.12:.75,z:i+3})});render()});
  document.querySelector('[data-random]')?.addEventListener('click',()=>addItem(foods[Math.floor(Math.random()*foods.length)][0],30+Math.random()*40,30+Math.random()*35));
  document.querySelector('[data-finish]')?.addEventListener('click',()=>{state.page='finish';render()});
  document.querySelectorAll('[data-zoom]').forEach(b=>b.onclick=()=>{state.zoom=Math.max(.7,Math.min(1.3,state.zoom+(b.dataset.zoom==='+'?.1:-.1)));render()});
  document.querySelector('[data-download]')?.addEventListener('click',()=>{const abs=p=>esc(new URL(p,location.href).href);const inner=state.items.map(item=>`<image href="${abs(item.asset)}" x="${item.x*6.2-310}" y="${item.y*4.1-205}" width="145" height="115" preserveAspectRatio="xMidYMid meet" transform="rotate(${item.rotate} ${item.x*6.2-237.5} ${item.y*4.1-147.5})"/>`).join('');const file=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 410"><image href="${abs(`${BASE_URL}thanksgiving-table.png`)}" width="620" height="410" preserveAspectRatio="xMidYMid slice"/>${inner}<text x="310" y="390" text-anchor="middle" fill="#a16b50" font-family="Georgia" font-size="14">gathered at our table</text></svg>`;const blob=new Blob([file],{type:'image/svg+xml'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='my-thanksgiving-table.svg';a.click()});
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && state.modal) closeModal(); });
init();
