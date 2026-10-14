/* =========================================================
   let-us.farm — client-side app
   Everything (accounts, listings, messages) is stored in
   this browser's localStorage. No server required, works
   the moment you open the file.
   ========================================================= */

const DB_KEY = 'luf_db_v1';

/* ---------------- Game Hub (embedded mini-games) ----------------
   The whole game file is stored base64-encoded so it can be safely
   inlined here without any quoting/escaping headaches, then decoded
   and dropped into an iframe on demand. */
const CATEGORIES = {
  livestock: { label:'Livestock', icon:'🐄', desc:'Horses, cattle, goats, poultry & more — bought, sold, and bred close to home.',
    subs:['Horses','Cows','Goats','Chickens','Dogs','Cats','Reptiles','Exotic'] },
  feed: { label:'Feed', icon:'🌾', desc:'Grain, hay, and feed for every animal on the place.',
    subs:['Grain','Corn','Hay','Dog Food','Cat Food','Other'] },
  produce: { label:'Produce', icon:'🥬', desc:'Fresh off the vine, the stalk, and the ground.',
    subs:['Lettuce','Tomatoes','Corn','Potatoes','Okra','Other'] },
  equipment: { label:'Equipment', icon:'🚜', desc:'Tractors, tillers, trucks and iron that gets the work done.',
    subs:['Mowers','Tractors','Tillers','Trucks','Dozers','Backhoes','Cat Machines','ATVs'] },
  farmhand: { label:'Farm-Hand', icon:'🧑\u200d🌾', desc:'Find hands for the field, or offer yours. Paid, volunteer, or barter.',
    subs:['Help Wanted','Help Is Here','Volunteer','Barter'] },
  homegoods: { label:'Home Goods', icon:'🏺', desc:'Handmade, canned, pickled, and passed-down goods from farm kitchens.',
    subs:['Home Decor','Yard Decor','Canned Goods','Pickled Goods','Handmade','Antique'] },
  transportation: { label:'Transportation', icon:'🚚', desc:'Get animals, goods, and people where they need to go.',
    subs:['Trucking','Livestock Transport','Personal Delivery'] },
  events: { label:'Events', icon:'🎪', desc:'Auctions, shows, and gatherings happening near you.',
    subs:['Auctions','Breeder Shows','Concerts','Estate Sales','Yard Sales','Rodeos','Parties'] },
  free: { label:'Free Items', icon:'🎁', desc:'Post what you can give away, and claim what you need. No charge, ever.',
    subs:[] },
  freefood: { label:'Free Food', icon:'🍲', desc:'Surplus harvest and extra food, free for neighbors who need it.',
    subs:[] },
};

const CAT_ORDER = ['livestock','feed','produce','equipment','farmhand','homegoods','transportation','events','free','freefood'];

const CAT_PHOTOS = {
  livestock: "assets/categories/livestock.jpg",
  feed: "assets/categories/feed.jpg",
  produce: "assets/categories/produce.jpg",
  equipment: "assets/categories/equipment.jpg",
  farmhand: "assets/categories/farmhand.jpg",
  homegoods: "assets/categories/homegoods.jpg",
  transportation: "assets/categories/transportation.jpg",
  events: "assets/categories/events.jpg",
  free: "assets/categories/free.jpg",
  freefood: "assets/categories/freefood.jpg",
};

/* ---------------- DB helpers ---------------- */
function defaultDB(){
  return {
    users: {},        // username -> {username,password,email,location,joined,vendor,bio,avatar}
    currentUser: null,
    listings: [],      // {id,category,sub,title,desc,price,free,owner,location,contact,date,icon,photos,payLink}
    messages: {},      // "userA|userB" sorted -> [{from,to,text,date}]
  };
}
function loadDB(){
  try{
    const raw = localStorage.getItem(DB_KEY);
    if(!raw) { const d = defaultDB(); seedListings(d); saveDB(d); return d; }
    return JSON.parse(raw);
  }catch(e){ const d = defaultDB(); return d; }
}
function saveDB(db){
  try{
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    return true;
  }catch(e){
    toast("Storage is full on this device — try removing a photo or an old listing.", 'err');
    return false;
  }
}
let DB = loadDB();
const ADMIN_PASS = '12345678910';
let LOGO_TAPS = [];
function logoTap(){
  const now = Date.now();
  LOGO_TAPS = LOGO_TAPS.filter(t=>now-t<3000); LOGO_TAPS.push(now);
  if(LOGO_TAPS.length>=5){ LOGO_TAPS=[]; openAdminGate(); }
}
function openAdminGate(){
  if(document.getElementById('adminGate')) return;
  const d = document.createElement('div'); d.id='adminGate';
  d.style.cssText='position:fixed;inset:0;background:rgba(22,31,25,.6);z-index:999;display:flex;align-items:center;justify-content:center;padding:20px;';
  d.innerHTML = `<form class="form-card" style="margin:0;max-width:340px;width:100%;" onsubmit="return adminGateSubmit(event)">
    <h3>Admin</h3><div class="field"><input type="password" id="gatePass" autocomplete="off" placeholder="Password" autofocus></div>
    <div style="display:flex;gap:8px;"><button class="btn btn-primary" type="submit">Enter</button><button class="btn btn-ghost" type="button" onclick="document.getElementById('adminGate').remove()">Cancel</button></div></form>`;
  document.body.appendChild(d);
  setTimeout(()=>{const i=document.getElementById('gatePass'); if(i) i.focus();},0);
}
function adminGateSubmit(e){
  e.preventDefault();
  const v = document.getElementById('gatePass').value;
  if(v !== ADMIN_PASS){ toast('Incorrect password.','err'); document.getElementById('gatePass').value=''; return false; }
  document.getElementById('adminGate').remove();
  DB.currentUser = 'admin'; saveDB(DB);
  toast('Admin unlocked.','ok'); go('#/admin');
  return false;
}
function ensureAdmin(){
  if(!DB.promos) DB.promos = [];
  if(!DB.ads) DB.ads = [];
  if(!DB.users['admin']){
    DB.users['admin'] = {username:'admin', password:ADMIN_PASS, email:'admin@let-us.farm', location:'let-us.farm HQ', joined:Date.now(), vendor:false, bio:'Site administrator', admin:true};
  }
  DB.users['admin'].password = ADMIN_PASS;
  DB.users['admin'].admin = true;
  saveDB(DB);
}
ensureAdmin();

function seedListings(db){
  // A handful of starter listings so the marketplace doesn't feel empty on first run.
  const seeds = [
    {category:'produce', sub:'Tomatoes', title:'Heirloom Tomatoes, boxed', desc:'Vine-ripened heirlooms, picked this morning. Mixed colors, great for canning or the table.', price:'12/box', location:'Blount County, TN', owner:'demo_farmer', contact:'Message on site', icon:'🍅'},
    {category:'livestock', sub:'Chickens', title:'Rhode Island Red Layers', desc:'6-month-old hens, laying well. Vaccinated, friendly, used to kids.', price:'22 each', location:'Madison County, AL', owner:'demo_farmer', contact:'Message on site', icon:'🐔'},
    {category:'equipment', sub:'Tractors', title:'Kubota L3301, low hours', desc:'Well maintained compact tractor with loader. New tires last season.', price:'18,500', location:'Rutherford County, TN', owner:'demo_farmer', contact:'Message on site', icon:'🚜'},
    {category:'farmhand', sub:'Help Wanted', title:'Hay season help needed', desc:'Need two extra hands for baling the first week of June. Fair pay, lunch provided.', price:'Pay: $15/hr', location:'Greene County, TN', owner:'demo_farmer', contact:'Message on site', icon:'🧑\u200d🌾'},
    {category:'homegoods', sub:'Canned Goods', title:'Pickled Okra, pint jars', desc:'Small-batch pickled okra, a little spicy. Grown and canned here.', price:'7/jar', location:'Cullman County, AL', owner:'demo_farmer', contact:'Message on site', icon:'🥒'},
    {category:'free', sub:'', title:'Extra cedar fence posts', desc:'About 20 cedar posts left over from a fencing job. Come haul them off.', price:'', free:true, location:'Franklin County, TN', owner:'demo_farmer', contact:'Message on site', icon:'🎁'},
    {category:'freefood', sub:'', title:'Extra squash & zucchini', desc:'Garden went wild this year. Take what you need, no questions asked.', price:'', free:true, location:'Wilson County, TN', owner:'demo_farmer', contact:'Message on site', icon:'🍲'},
    {category:'transportation', sub:'Livestock Transport', title:'Stock trailer runs, weekly', desc:'Regular Knoxville–Nashville route, can haul livestock or hay along the way.', price:'Call for rate', location:'Knox County, TN', owner:'demo_farmer', contact:'Message on site', icon:'🚚'},
    {category:'events', sub:'Auctions', title:'Fall Goat & Livestock Auction', desc:'Annual fall auction — goats, sheep, and a few dairy cows going through the ring. Concessions on site.', price:'Free to attend', location:'Greene County, TN', owner:'demo_farmer', contact:'Message on site', icon:'🎪'},
  ];
  if(!db.users['demo_farmer']){
    db.users['demo_farmer'] = {username:'demo_farmer', password:'demo', email:'demo@let-us.farm', location:'Tennessee', joined: Date.now()-1000*60*60*24*40, vendor:true, bio:'Sample account so the market has a few listings to look at.'};
  }
  seeds.forEach(s=>{
    db.listings.push(Object.assign({id: uid(), date: Date.now() - Math.floor(Math.random()*1000*60*60*24*10)}, s));
  });
}

function uid(){ return 'id_'+Math.random().toString(36).slice(2,10)+Date.now().toString(36); }
function currentUser(){ return DB.currentUser ? DB.users[DB.currentUser] : null; }
function fmtDate(ts){
  const d = new Date(ts);
  return d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
}
function fmtTime(ts){
  const d = new Date(ts);
  return d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
}
function initials(name){ return (name||'?').slice(0,2).toUpperCase(); }
function escapeHtml(s){
  return String(s==null?'':s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

/* ---------------- Avatars (image or initials fallback) ---------------- */
function avatarHtml(username, sizeClass){
  const u = DB.users[username];
  const cls = sizeClass || 'avatar';
  if(u && u.avatar){
    return `<div class="${cls} has-photo" style="background-image:url('${u.avatar}');"></div>`;
  }
  return `<div class="${cls}">${initials(username)}</div>`;
}

/* ---------------- Image resizing (client-side, no server) ----------------
   Resizes any picked photo down to a reasonable size before it's stored,
   so a handful of photos don't blow past what a browser can hold. */
function resizeImageToDataURL(file, maxDim, quality){
  return new Promise((resolve, reject)=>{
    if(!file.type || !file.type.startsWith('image/')){ reject(new Error('not an image')); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('could not read file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('could not decode image'));
      img.onload = () => {
        let { width, height } = img;
        if(width > maxDim || height > maxDim){
          if(width >= height){ height = Math.round(height * (maxDim/width)); width = maxDim; }
          else { width = Math.round(width * (maxDim/height)); height = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* Pending photo/avatar state while a form is open (form HTML is rebuilt
   on every render, so these live outside it as the working buffer). */
let PENDING_PHOTOS = [];
/* ---------------- Video uploads (stored in IndexedDB — too big for localStorage) ---------------- */
const VIDEO_MAX_MB = 50, VIDEO_MAX_SEC = 120;
let PENDING_VIDEO = {file:null, keep:null};   // keep = existing videoId still attached
function vidDB(){
  return new Promise((res,rej)=>{
    const r = indexedDB.open('luf_videos',1);
    r.onupgradeneeded = ()=> r.result.createObjectStore('v');
    r.onsuccess = ()=> res(r.result); r.onerror = ()=> rej(r.error);
  });
}
function vidPut(id,blob){ return vidDB().then(db=>new Promise((res,rej)=>{const t=db.transaction('v','readwrite');t.objectStore('v').put(blob,id);t.oncomplete=()=>res();t.onerror=()=>rej(t.error);})); }
function vidGet(id){ return vidDB().then(db=>new Promise((res,rej)=>{const r=db.transaction('v').objectStore('v').get(id);r.onsuccess=()=>res(r.result||null);r.onerror=()=>rej(r.error);})); }
function vidDel(id){ if(!id) return Promise.resolve(); return vidDB().then(db=>new Promise(res=>{const t=db.transaction('v','readwrite');t.objectStore('v').delete(id);t.oncomplete=()=>res();t.onerror=()=>res();})).catch(()=>{}); }
function handleVideoSelect(input){
  const f = input.files && input.files[0]; input.value='';
  if(!f) return;
  if(!/^video\//.test(f.type)){ toast('Please choose a video file.','err'); return; }
  if(f.size > VIDEO_MAX_MB*1048576){ toast('Video is over '+VIDEO_MAX_MB+' MB — trim or compress it first.','err'); return; }
  const url = URL.createObjectURL(f), v = document.createElement('video');
  v.preload='metadata';
  v.onloadedmetadata = ()=>{
    if(v.duration > VIDEO_MAX_SEC){ URL.revokeObjectURL(url); toast('Video is longer than '+VIDEO_MAX_SEC+' seconds.','err'); return; }
    PENDING_VIDEO.file = f; renderVideoPreview(url);
  };
  v.onerror = ()=>{ URL.revokeObjectURL(url); toast("This browser can't play that video format — try an MP4.",'err'); };
  v.src = url;
}
function renderVideoPreview(url){
  const el = document.getElementById('videoPreview'); if(!el) return;
  if(url) el.innerHTML = `<video src="${url}" controls playsinline style="width:100%;max-height:240px;border-radius:10px;background:#000;"></video>
    <button type="button" class="btn btn-ghost btn-sm" style="margin-top:8px;" onclick="removePendingVideo()">Remove Video</button>`;
  else el.innerHTML = '';
}
function removePendingVideo(){ PENDING_VIDEO = {file:null, keep:null}; renderVideoPreview(null); }
function loadListingVideo(l){
  const wrap = document.getElementById('listingVideoWrap');
  if(!wrap || !l || !l.videoId) return;
  vidGet(l.videoId).then(b=>{
    if(!b){ wrap.innerHTML = '<p class="hint">🎥 This video lives on the device it was uploaded from.</p>'; return; }
    wrap.innerHTML = `<video src="${URL.createObjectURL(b)}" controls playsinline preload="metadata" style="width:100%;max-height:420px;border-radius:12px;background:#000;margin-top:14px;"></video>`;
  }).catch(()=>{});
}
let PENDING_AVATAR = null;
let PENDING_COVER = null;
function handleCoverSelect(input){
  const file = input.files && input.files[0];
  input.value = '';
  if(!file) return;
  resizeImageToDataURL(file, 1100, 0.7).then(d=>{
    PENDING_COVER = d;
    const el = document.getElementById('coverPreview');
    if(el) el.style.backgroundImage = `url('${d}')`;
  }).catch(()=> toast("Couldn't read that image — try another.", 'err'));
}

function handlePhotoSelect(input){
  const files = Array.from(input.files || []);
  input.value = '';
  if(!files.length) return;
  const room = 6 - PENDING_PHOTOS.length;
  if(room <= 0){ toast('You can add up to 6 photos per listing.', 'err'); return; }
  const toAdd = files.slice(0, room);
  if(files.length > toAdd.length) toast('Only added the first '+toAdd.length+' — 6 photos max.', 'err');
  Promise.all(toAdd.map(f => resizeImageToDataURL(f, 1000, 0.62).catch(()=>null)))
    .then(results=>{
      results.filter(Boolean).forEach(dataUrl => PENDING_PHOTOS.push(dataUrl));
      renderPhotoPreview();
    });
}
function removePendingPhoto(idx){
  PENDING_PHOTOS.splice(idx,1);
  renderPhotoPreview();
}
function renderPhotoPreview(){
  const wrap = document.getElementById('photoPreview');
  if(!wrap) return;
  wrap.innerHTML = PENDING_PHOTOS.map((src,i)=>`
    <div class="photo-thumb">
      <img src="${src}" alt="Listing photo ${i+1}">
      <button type="button" class="photo-remove" onclick="removePendingPhoto(${i})" title="Remove photo">✕</button>
    </div>
  `).join('') + (PENDING_PHOTOS.length < 6 ? `
    <label class="photo-add">
      <input type="file" accept="image/*" multiple onchange="handlePhotoSelect(this)" hidden>
      <span>+ Add<br>Photo</span>
    </label>` : '');
  const countEl = document.getElementById('photoCount');
  if(countEl) countEl.textContent = PENDING_PHOTOS.length + ' / 6 photos';
}

function handleAvatarSelect(input){
  const file = input.files && input.files[0];
  input.value = '';
  if(!file) return;
  resizeImageToDataURL(file, 320, 0.75).then(dataUrl=>{
    PENDING_AVATAR = dataUrl;
    renderAvatarPreview();
  }).catch(()=> toast("Couldn't read that image — try another.", 'err'));
}
function removePendingAvatar(){
  PENDING_AVATAR = '';
  renderAvatarPreview();
}
function renderAvatarPreview(){
  const wrap = document.getElementById('avatarPreview');
  if(!wrap) return;
  if(PENDING_AVATAR){
    wrap.innerHTML = `<div class="avatar has-photo" style="background-image:url('${PENDING_AVATAR}');width:74px;height:74px;margin:0;"></div>`;
  } else {
    const u = currentUser();
    wrap.innerHTML = `<div class="avatar" style="width:74px;height:74px;margin:0;">${initials(u.username)}</div>`;
  }
}

/* ---------------- Toasts ---------------- */
function toast(msg, type){
  const stack = document.getElementById('toastStack');
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' '+type : '');
  el.textContent = msg;
  stack.appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; el.style.transition='opacity .3s'; setTimeout(()=>el.remove(),300); }, 3200);
}

/* ---------------- Router ---------------- */
function go(hash){ location.hash = hash; }
window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', render);

function parseHash(){
  const h = location.hash.replace(/^#\/?/,'');
  const parts = h.split('/').filter(Boolean);
  return parts;
}

function render(){
  normalizeVendors();
  closeDrawer();
  const parts = parseHash();
  const root = document.getElementById('app');
  let html = '';
  const route = parts[0] || 'home';

  if(route === 'home') html = viewHome();
  else if(route === 'login') html = viewLogin();
  else if(route === 'signup') html = viewSignup();
  else if(route === 'vendor') html = viewVendor();
  else if(route === 'category' && parts[1] && CATEGORIES[parts[1]]) html = viewCategory(parts[1], parts[2]);
  else if(route === 'listing' && parts[1]) html = viewListingDetail(parts[1]);
  else if(route === 'post') html = viewPostForm(parts[1]);
  else if(route === 'edit' && parts[1]) html = viewPostForm(null, parts[1]);
  else if(route === 'profile') html = viewProfile(parts[1] || 'listings');
  else if(route === 'messages') html = viewMessages(parts[1]);
  else if(route === 'games') html = viewGames();
  else if(route === 'search') html = viewSearch(parts[1]);
  else if(route === 'privacy') html = viewPrivacy();
  else if(route === 'terms') html = viewTerms();
  else if(route === 'admin') html = viewAdmin(parts[1]||'users');
  else if(route === 'farm' && parts[1]) html = viewStorefront(decodeURIComponent(parts[1]));
  else html = view404();

  root.innerHTML = header() + html + adsWrap('footer') + footer() + '';
  wireGlobalUI();
  if(route === 'home' && !hasAgreed()) showAgreementSplash();
  if(route === 'post' || route === 'edit'){
    const editing = route === 'edit' ? DB.listings.find(l=>l.id===parts[1]) : null;
    refreshSubOptions(editing ? editing.sub : '');
    PENDING_PHOTOS = editing && editing.photos ? editing.photos.slice() : [];
    renderPhotoPreview();
    PENDING_VIDEO = {file:null, keep: editing && editing.videoId ? editing.videoId : null};
    if(PENDING_VIDEO.keep) vidGet(PENDING_VIDEO.keep).then(b=>{ if(b && PENDING_VIDEO.keep) renderVideoPreview(URL.createObjectURL(b)); });
  }
  if(route === 'profile' && (parts[1]||'listings') === 'info'){
    const u = currentUser();
    PENDING_AVATAR = u ? (u.avatar || '') : '';
    renderAvatarPreview();
  }
  if(route === 'listing') loadListingVideo(DB.listings.find(x=>x.id===parts[1]));
  if(route === 'games'){
    const frame = document.getElementById('gameFrame');
    if(frame) frame.src = 'games/game-hub.html';
  }
  window.scrollTo(0,0);
}


/* ---------------- Site agreement splash + legal pages ---------------- */
const AGREE_KEY = 'luf_agreed_v1';
function hasAgreed(){ try{ return localStorage.getItem(AGREE_KEY)==='1'; }catch(e){ return !!window.__agreedThisVisit; } }
function showAgreementSplash(){
  if(document.getElementById('agreeSplash')) return;
  const d = document.createElement('div'); d.id='agreeSplash'; d.className='agree-splash';
  d.setAttribute('role','dialog'); d.setAttribute('aria-modal','true'); d.setAttribute('aria-label','Welcome and site agreement');
  d.innerHTML = `
    <div class="agree-inner">
      <div class="agree-logo-wrap"><img class="agree-logo" src="assets/logo-transparent.png" alt="let-us.farm logo"></div>
      <h1 class="agree-title">Welcome to let-us.farm</h1>
      <p class="agree-sub">Real farms · real people. Before you come in, please review our site agreements.</p>
      <div class="agree-box">
        <p><b>By entering you agree that:</b></p>
        <ul>
          <li>You have read and accept the <a href="#/terms" target="_blank" rel="noopener">Terms of Use</a>.</li>
          <li>You have read the <a href="#/privacy" target="_blank" rel="noopener">Privacy Policy</a>, including that your account, listings and messages are stored in this browser.</li>
          <li>Listings are posted by members. You deal directly with buyers and sellers and are responsible for your own trades, animals, food and goods.</li>
          <li>You will not post anything illegal, unsafe, misleading or abusive.</li>
        </ul>
      </div>
      <label class="agree-check"><input type="checkbox" id="agreeBox" onchange="document.getElementById('agreeBtn').disabled=!this.checked"> <span>I agree to the Terms of Use and Privacy Policy</span></label>
      <button class="btn btn-cyan agree-btn" id="agreeBtn" disabled onclick="acceptAgreement()">Enter the Farm →</button>
    </div>`;
  document.body.appendChild(d);
  document.body.classList.add('no-scroll');
}
function acceptAgreement(){
  try{ localStorage.setItem(AGREE_KEY,'1'); }catch(e){ window.__agreedThisVisit = true; }
  const d = document.getElementById('agreeSplash');
  if(d){ d.classList.add('leaving'); setTimeout(()=>d.remove(),450); }
  document.body.classList.remove('no-scroll');
}
function legalPage(title, updated, bodyHtml){
  return `
  <section class="page-hero"><div class="wrap"><div>
    <div class="breadcrumb"><a href="#/home">Home</a> / ${title}</div>
    <h1>${title}</h1><p>Last updated ${updated}</p>
  </div></div></section>
  <section><div class="wrap"><div class="legal">${bodyHtml}</div></div></section>`;
}
function viewPrivacy(){
  return legalPage('Privacy Policy','October 14, 2026',`
  <p>let-us.farm (“we”, “us”, “the site”) is a marketplace and community for farms, farmers and farmhands. This policy explains what information the site handles and how. By using the site you agree to it.</p>
  <h3>1. Information you provide</h3>
  <p>When you create an account or use the site you may give us: a username and password, email address, location, bio, farm or business name, tagline, profile and cover photos, listings (text, prices, photos and video), messages to other members, follows and reviews, and any contact details you choose to put in a listing or profile.</p>
  <h3>2. Where your information is stored</h3>
  <p>This version of let-us.farm runs in your web browser and keeps its data in your browser's local storage on your device. Accounts, listings and messages you create are saved there; they are not sent to a central server by the site itself. That means clearing your browser data removes them, and anything you post is visible only where the site's data is shared. If the site later moves to a hosted database, this policy will be updated before your information is transferred.</p>
  <h3>3. What is public</h3>
  <p>Your profile (name, photos, bio, location, listings, follower and review counts) and anything you write in a listing or review can be seen by other visitors. Do not post information you want to keep private, such as home addresses, ID numbers, or bank or card details. Messages are meant for the people in the conversation.</p>
  <h3>4. How we use information</h3>
  <p>To run your account, display your listings and profile, let members contact each other, show relevant content, prevent misuse, and operate vendor plans and promotions. We do not sell your personal information.</p>
  <h3>5. Cookies and local storage</h3>
  <p>The site uses your browser's local storage to keep you logged in, remember your account data and remember that you accepted these agreements. It does not use advertising trackers of its own. Sponsored placements shown on the site are supplied by the site operator, and clicking one may take you to a third-party website with its own privacy practices.</p>
  <h3>6. Third parties</h3>
  <p>Some images, fonts and scripts are loaded from outside services (for example font and photo providers), which may receive your IP address and browser details when they load. If payments or vendor plans are enabled, a third-party payment processor handles your payment details; we do not store full card numbers.</p>
  <h3>7. Your choices</h3>
  <p>You can edit or delete your listings and profile information from your account at any time, and you can clear your data by clearing this site's storage in your browser. To ask us to remove content or an account, contact us at the address below.</p>
  <h3>8. Children</h3>
  <p>The site is intended for adults and is not directed to children under 13. If you believe a child has provided personal information, contact us and we will remove it.</p>
  <h3>9. Security</h3>
  <p>We take reasonable steps to protect information, but no method of storage or transmission is completely secure, and data kept in a browser is only as safe as the device you use. Use a strong password and keep your device secure.</p>
  <h3>10. Changes</h3>
  <p>We may update this policy and will change the date above when we do. Continued use of the site means you accept the updated policy.</p>
  <h3>11. Contact</h3>
  <p>Questions about privacy: <a href="mailto:letus.farmsupport@gmail.com">letus.farmsupport@gmail.com</a>.</p>`);
}
function viewTerms(){
  return legalPage('Terms of Use','October 14, 2026',`
  <p>Welcome to let-us.farm. By entering or using the site you agree to these terms and to our <a href="#/privacy">Privacy Policy</a>. If you do not agree, please do not use the site.</p>
  <h3>1. What the site is</h3>
  <p>let-us.farm is a marketplace and community where members post listings and contact each other. We provide the platform only. We are not a party to any sale, trade, hire or transport between members, and we do not inspect, guarantee or take responsibility for any listing, animal, food, item, job or event.</p>
  <h3>2. Your account</h3>
  <p>You must be at least 18 to post or trade. Keep your password private and give accurate information. You are responsible for activity on your account.</p>
  <h3>3. What you may post</h3>
  <p>You may post only things you have the right to sell, give away or share. You agree not to post anything that is illegal, stolen, unsafe, deceptive, hateful, harassing, or that infringes someone else's rights. Livestock, food and other regulated goods must comply with all laws and licensing that apply to you and your buyers, including animal welfare, health, labeling and transport rules.</p>
  <h3>4. Trades are between members</h3>
  <p>You deal directly with other members and are responsible for your own agreements, payments, pickup, delivery and safety. Meet in safe places, inspect goods and animals before paying, and use payment methods you trust. We are not liable for losses, injuries, disputes or damages arising from trades or meetings.</p>
  <h3>5. Vendors, plans and promotions</h3>
  <p>Vendor accounts, free trials, promo codes and fees, where offered, are described on the Become a Vendor page and may change. Features and pricing can be updated with notice on the site.</p>
  <h3>6. Content license</h3>
  <p>You keep ownership of what you post. You give us permission to display it on the site so the service can work. You promise you have the right to post it.</p>
  <h3>7. Removal and suspension</h3>
  <p>We may remove content or suspend accounts that break these terms or put others at risk, at our discretion.</p>
  <h3>8. Disclaimer and limits</h3>
  <p>The site is provided “as is” without warranties of any kind. To the fullest extent allowed by law, we are not liable for indirect or consequential losses or for anything arising from your use of the site or dealings with other members.</p>
  <h3>9. Changes</h3>
  <p>We may update these terms. Continued use after a change means you accept it.</p>
  <h3>10. Contact</h3>
  <p><a href="mailto:letus.farmsupport@gmail.com">letus.farmsupport@gmail.com</a></p>`);
}

/* ---------------- Game Hub ---------------- */
function playFab(){
  return `
  <button class="play-fab" onclick="go('#/games')" title="Play the let-us.farm mini-games!" aria-label="Play games">
    <span class="play-fab-icon">🎮</span>
    <span class="play-fab-label">Play!</span>
  </button>`;
}

function viewGames(){
  return `
  <section class="page-hero">
    <div class="wrap">
      <div>
        <div class="breadcrumb"><a href="#/home">Home</a> / Game Hub</div>
        <h1>🎮 Game Hub</h1>
        <p>Take a break and play a few farm-themed mini-games — no login needed.</p>
      </div>
    </div>
  </section>
  <section style="padding-top:22px;">
    <div class="wrap">
      <iframe id="gameFrame" title="let-us.farm Game Hub" class="game-frame"></iframe>
    </div>
  </section>`;
}

/* ---------------- Header / Footer ---------------- */
function header(){
  const u = currentUser();
  const parts = parseHash();
  const activeCat = parts[0]==='category' ? parts[1] : null;

  const catLinks = CAT_ORDER.map(k=>{
    const c = CATEGORIES[k];
    return `<a href="#/category/${k}">${c.icon} ${c.label}</a>`;
  }).join('');

  const authArea = u ? `
    <div class="dropdown" id="userDropdown">
      <button class="btn btn-ghost nav-btn" onclick="toggleDropdown('userDropdown')">👤 ${escapeHtml(u.username)} ▾</button>
      <div class="dropdown-menu">
        <a href="#/profile/listings">📋 My Listings</a>
        <a href="#/profile/info">⚙️ Account</a>
        <a href="#/messages">💬 Messages</a>
        <a href="#/vendor">🏷️ Vendor Info</a>
        ${u.admin?'<a href="#/admin">🛠️ Admin</a>':''}
        <a href="#" onclick="logout();return false;">🚪 Log Out</a>
      </div>
    </div>
  ` : `
    <a href="#/login" class="btn btn-ghost nav-btn">Log In</a>
    <a href="#/signup" class="btn btn-primary">Sign Up</a>
  `;

  return `
  <header class="site">
    <div class="wrap nav-row">
      <a href="#/home" class="brand" onclick="logoTap()"><img src="assets/logo.png" alt="let-us.farm lettuce logo"><span>let<span class="dot">-</span>us<span class="dot">.</span>farm</span></a>
      <nav class="primary">
        <div class="dropdown" id="marketDropdown">
          <button class="nav-btn ${activeCat&&activeCat!=='farmhand'&&activeCat!=='events'?'active':''}" onclick="toggleDropdown('marketDropdown')">Marketplace ▾</button>
          <div class="dropdown-menu">${catLinks}<a href="#/vendor">🏷️ Become a Vendor</a></div>
        </div>
        <a href="#/category/farmhand" class="nav-btn ${activeCat==='farmhand'?'active':''}">Farm Jobs</a>
        <a href="#/category/events" class="nav-btn ${activeCat==='events'?'active':''}">Community</a>
        <a href="#/games" class="nav-btn ${parts[0]==='games'?'active':''}">Games</a>
        <a href="#/category/farmhand/Barter" class="nav-btn">Trade &amp; Barter</a>
        <div class="dropdown" id="moreDropdown">
          <button class="nav-btn ${parts[0]==='profile'||parts[0]==='vendor'?'active':''}" onclick="toggleDropdown('moreDropdown')">More ▾</button>
          <div class="dropdown-menu"><a href="${u?'#/profile/listings':'#/login'}">🌾 My Farm</a><a href="#/vendor">🏷️ Become a Vendor</a><a href="#/category/free">🎁 Free Items</a><a href="#/category/freefood">🍲 Free Food</a><a href="${u?'#/messages':'#/login'}">💬 Messages</a></div>
        </div>
      </nav>
      <form class="search desktop-search" onsubmit="return doSearch(event)" role="search">⌕ <input id="globalSearch" type="search" placeholder="Search farms, items, people…" aria-label="Search farms, items, people" value="${parts[0]==='search'&&parts[1]?escapeHtml(decodeURIComponent(parts[1])):''}"></form>
      <div class="nav-icons">
        <a class="icon-btn hide-m" href="${u?'#/messages':'#/login'}" aria-label="Notifications"><svg viewBox="0 0 24 24"><path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15zM10 21h4"/></svg></a>
        <a class="icon-btn" href="${u?'#/messages':'#/login'}" aria-label="Messages"><svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/></svg></a>
        <a class="icon-btn hide-m" href="${u?'#/profile/info':'#/login'}" aria-label="Profile"><svg viewBox="0 0 24 24"><circle cx="12" cy="9" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></svg></a>
      </div>
      <div class="auth-area">${authArea}</div>
      <button class="mobile-menu-btn" aria-label="Open menu" onclick="openDrawer()">☰</button>
    </div>
  </header>`;
}

function footer(){
  const catLinks = CAT_ORDER.slice(0,5).map(k=>`<a href="#/category/${k}">${CATEGORIES[k].label}</a>`).join('');
  const u = currentUser();
  const parts = parseHash();
  const r = parts[0]||'home';
  return `
  <footer>
    <div class="wrap footer-grid">
      <div>
        <div class="footer-brand"><img src="assets/logo.png" alt=""> let-us.farm</div>
        <p class="footer-note">Connecting farms, farmers, farmhands, and rural communities through a shared marketplace for goods, services, jobs, and more.</p>
      </div>
      <div><h5>Marketplace</h5>${catLinks}<a href="#/category/farmhand/Barter">Trade &amp; barter</a></div>
      <div><h5>Community</h5>
        <a href="#/category/events">Events &amp; auctions</a>
        <a href="#/category/farmhand">Farm jobs</a>
        <a href="#/games">Farm arcade</a>
        <a href="#/category/free">Free items</a>
        <a href="#/category/freefood">Free food</a>
      </div>
      <div><h5>Your account</h5>
        <a href="${u?'#/profile/listings':'#/login'}">My dashboard</a>
        <a href="#/messages">Messages</a>
        <a href="#/vendor">Become a Vendor</a>
        ${u?'':'<a href="#/login">Log In</a><a href="#/signup">Sign Up</a>'}
      </div>
    </div>
    <div class="wrap footer-bottom">
      <span>© ${new Date().getFullYear()} let-us.farm — real farms · real people. · <a href="#/terms" style="display:inline;padding:0;text-decoration:underline;">Terms</a> · <a href="#/privacy" style="display:inline;padding:0;text-decoration:underline;">Privacy</a></span>
      <span>Runs entirely in this browser (local storage) — a working first version, ready to grow.</span>
    </div>
  </footer>
  <nav class="mobile-nav" aria-label="Mobile navigation">
    <a href="#/home" class="${r==='home'?'active':''}"><span>⌂</span>Home</a>
    <a href="#/search/" class="${r==='search'?'active':''}"><span>⌕</span>Search</a>
    <a href="${u?'#/post':'#/login'}" class="post"><span>＋</span>Post</a>
    <a href="${u?'#/messages':'#/login'}" class="${r==='messages'?'active':''}"><span>✉</span>Messages</a>
    <a href="${u?'#/profile/listings':'#/login'}" class="${r==='profile'?'active':''}"><span>♙</span>Profile</a>
  </nav>`;
}

function doSearch(e){
  e.preventDefault();
  const q = (document.getElementById('globalSearch').value||'').trim();
  go('#/search/'+encodeURIComponent(q));
  return false;
}

function viewSearch(qRaw){
  const q = (qRaw?decodeURIComponent(qRaw):'').toLowerCase().trim();
  const hits = DB.listings.filter(l=>!q || [l.title,l.desc,l.sub,l.owner,l.location,CATEGORIES[l.category]&&CATEGORIES[l.category].label].join(' ').toLowerCase().includes(q)).sort((a,b)=>b.date-a.date);
  const people = q ? Object.values(DB.users).filter(x=>!x.admin && (x.username+' '+(x.location||'')+' '+(x.bio||'')).toLowerCase().includes(q)) : [];
  return `
  <section class="page-hero"><div class="wrap"><div>
    <div class="breadcrumb"><a href="#/home">Home</a> / Search</div>
    <h1>${q?'Results for “'+escapeHtml(q)+'”':'Search the marketplace'}</h1>
    <p>Search listings by title, description, category, owner or location.</p>
  </div>
  <form class="search" style="max-width:340px;width:100%;" onsubmit="return doSearch2(event)">⌕ <input id="pageSearch" type="search" placeholder="Search farms, items, people…" value="${escapeHtml(q)}"></form>
  </div></section>
  <section class="page-listings" style="padding-top:28px;"><div class="wrap">
    ${people.length?`<div class="eyebrow">People &amp; farms</div><div class="nearby-list" style="margin-bottom:26px;">${people.slice(0,6).map(x=>`<div class="nearby-item"><div class="n-icon">${x.vendor?'🌱':'👤'}</div><div><h4>${escapeHtml(x.username)}</h4><p>${escapeHtml(x.location||'')}</p></div><a class="btn btn-primary" href="#/farm/${encodeURIComponent(x.username)}">View</a></div>`).join('')}</div>`:''}
    <div class="listing-count" style="margin-bottom:14px;">${hits.length} listing${hits.length===1?'':'s'}</div>
    ${hits.length?`<div class="listing-grid four">${hits.map(listingCard).join('')}</div>`:`<div class="empty-state"><div class="em-icon">🔍</div><h3>Nothing found</h3><p>Try a different word, or browse a category.</p><a href="#/home" class="btn btn-primary">Back home</a></div>`}
  </div></section>`;
}
function doSearch2(e){
  e.preventDefault();
  go('#/search/'+encodeURIComponent((document.getElementById('pageSearch').value||'').trim()));
  return false;
}

function wireGlobalUI(){
  document.addEventListener('click', function(e){
    document.querySelectorAll('.dropdown.open').forEach(d=>{
      if(!d.contains(e.target)) d.classList.remove('open');
    });
  }, {once:true});
  buildDrawer();
}

function toggleDropdown(id){
  const el = document.getElementById(id);
  const wasOpen = el.classList.contains('open');
  document.querySelectorAll('.dropdown.open').forEach(d=>d.classList.remove('open'));
  if(!wasOpen){ el.classList.add('open'); }
  event.stopPropagation();
}

function buildDrawer(){
  const u = currentUser();
  const catLinks = CAT_ORDER.map(k=>`<a href="#/category/${k}" onclick="closeDrawer()">${CATEGORIES[k].icon} ${CATEGORIES[k].label}</a>`).join('');
  const drawer = document.getElementById('mobileDrawer');
  drawer.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
      <strong class="mono" style="font-family:var(--font-display);">Menu</strong>
      <button class="modal-close" onclick="closeDrawer()" style="position:static;">✕</button>
    </div>
    <a href="#/home" onclick="closeDrawer()">Home</a>
    ${catLinks}
    <a href="#/vendor" onclick="closeDrawer()">Become a Vendor</a>
    <a href="#/games" onclick="closeDrawer()">🎮 Games</a>
    ${u ? `
      <a href="#/profile/listings" onclick="closeDrawer()">My Listings</a>
      <a href="#/messages" onclick="closeDrawer()">Messages</a>
      ${u.admin?'<a href="#/admin" onclick="closeDrawer()">Admin</a>':''}
      <a href="#" onclick="logout();return false;">Log Out</a>
    ` : `
      <a href="#/login" onclick="closeDrawer()">Log In</a>
      <a href="#/signup" onclick="closeDrawer()">Sign Up</a>
    `}
  `;
}
function openDrawer(){
  document.getElementById('mobileDrawer').classList.add('open');
  document.getElementById('drawerBackdrop').classList.add('show');
}
function closeDrawer(){
  const d = document.getElementById('mobileDrawer'), b = document.getElementById('drawerBackdrop');
  if(d) d.classList.remove('open');
  if(b) b.classList.remove('show');
}

/* ---------------- HOME ---------------- */
let HOME_FILTER = 'all';
const HOME_FILTERS = [['all','All'],['livestock','Livestock'],['produce','Produce'],['equipment','Equipment'],['feed','Feed'],['farmhand','Farm jobs']];
function homeFeaturedGrid(){
  const list = DB.listings.filter(l=>HOME_FILTER==='all'||l.category===HOME_FILTER).sort((a,b)=>b.date-a.date).slice(0,8);
  return list.length ? list.slice(0,6).map(listingCard).join('') : `<div class="empty">No listings in this category yet. <a href="#/post/${HOME_FILTER==='all'?'':HOME_FILTER}" style="color:var(--forest);font-weight:800">Post the first one →</a></div>`;
}
function setHomeFilter(k){
  HOME_FILTER = k;
  document.querySelectorAll('#filters .filter').forEach(b=>b.classList.toggle('active', b.dataset.k===k));
  const g = document.getElementById('listingGrid'); if(g) g.innerHTML = homeFeaturedGrid();
}
function viewHome(){
  HOME_FILTER = 'all';
  const u = currentUser();
  const tickerItems = DB.listings.slice(-14).reverse().map(l=>{
    const price = l.free ? 'FREE' : (l.price || 'Call');
    return `<span>${l.icon||'🌱'} ${escapeHtml(l.title)} — <b>${escapeHtml(price)}</b></span>`;
  }).join('');
  const tickerLoop = tickerItems + tickerItems;

  const ICONS = {
    livestock:'<path d="M5 9l-2-3M19 9l2-3M6 9h12v6a6 6 0 0 1-12 0zM9 13h.01M15 13h.01M10 17h4"/>',
    feed:'<path d="M12 21V8M12 8c0-3 2-5 4-5 0 3-1 5-4 5zM12 8c0-3-2-5-4-5 0 3 1 5 4 5zM12 14c0-3 2-5 4-5 0 3-1 5-4 5zM12 14c0-3-2-5-4-5 0 3 1 5 4 5z"/>',
    produce:'<path d="M5 19C5 9 11 4 20 4c0 9-5 15-15 15zM5 19c3-5 6-8 11-11"/>',
    equipment:'<circle cx="7" cy="17" r="3.5"/><circle cx="18" cy="18" r="2"/><path d="M10 14V6h6l2 6v4M3 17V9h4M13 9h4"/>',
    farmhand:'<circle cx="12" cy="8" r="3.5"/><path d="M4 21c1-5 4-7 8-7s7 2 8 7M6 6h12M8.5 6c0-2 1.5-3 3.5-3s3.5 1 3.5 3"/>',
    homegoods:'<path d="M8 3h8M9 3v3c-3 1-4 3-4 6v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7c0-3-1-5-4-6V3"/><path d="M5 12h14"/>',
    transportation:'<path d="M2 6h12v10H2zM14 9h4l3 3v4h-7"/><circle cx="6.5" cy="17.5" r="2"/><circle cx="17.5" cy="17.5" r="2"/>',
    events:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    free:'<rect x="4" y="10" width="16" height="10" rx="1"/><path d="M3 7h18v3H3zM12 7v13M12 7c-2-4-6-3-5 0M12 7c2-4 6-3 5 0"/>',
    freefood:'<path d="M3 12h18a9 9 0 0 1-18 0zM8 8c0-2 2-2 2-4M13 8c0-2 2-2 2-4"/>'
  };
  const catStrip = CAT_ORDER.map(k=>{
    const c = CATEGORIES[k];
    const sub = c.subs.slice(0,2).join(', ') || 'Browse all';
    const withPhoto = DB.listings.filter(l=>l.category===k && l.photos && l.photos.length).sort((a,b)=>b.date-a.date)[0];
    const img = withPhoto ? withPhoto.photos[0] : (CAT_PHOTOS[k]||'');
    return `<a class="cat" href="#/category/${k}"><span class="cat-img" style="background-image:url('${img}')"></span>${c.label}<small>${sub}</small></a>`;
  }).join('');

  const filters = HOME_FILTERS.map(([k,l])=>`<button class="filter ${k==='all'?'active':''}" data-k="${k}" onclick="setHomeFilter('${k}')">${l}</button>`).join('');

  const vendors = Object.values(DB.users).filter(x=>x.vendor && !x.admin).slice(0,3);
  const picks = vendors.length ? vendors.map(x=>{
    const n = DB.listings.filter(l=>l.owner===x.username).length;
    return `<div class="nearby-item"><div class="n-icon">🌱</div><div><h4>${escapeHtml(x.username)}</h4><p>${escapeHtml(x.location||'Local vendor')}</p><p>${n} listing${n===1?'':'s'}</p></div><a class="btn btn-primary" href="#/farm/${encodeURIComponent(x.username)}">View</a></div>`;
  }).join('') : `<div class="nearby-item"><div class="n-icon">🏷️</div><div><h4>Be the first vendor</h4><p>Get a badge and a storefront of your own.</p></div><a class="btn btn-primary" href="#/vendor">Learn more</a></div>`;

  const myCount = u ? DB.listings.filter(l=>l.owner===u.username).length : null;
  const unread = null;

  return `
  <section class="hero" id="home" style="padding:0">
    <div class="wrap hero-grid">
      <div class="hero-inner">
        <div class="eyebrow">Local · State · National</div>
        <h1>Let's put the farm<br>back <span class="accent">on the map.</span></h1>
        <p class="lead">Buy, sell, trade, find farm jobs, and connect with your community. A marketplace built for farmers, ranchers, farmhands, and the people who support them.</p>
        <div class="hero-actions">
          <a href="${u?'#/post':'#/signup'}" class="btn btn-cyan">${u?'＋ Post a Listing':'＋ Create Free Account'}</a>
          <a href="#marketplace" class="btn btn-outline" style="border-color:rgba(255,255,255,.55);color:#fff;background:rgba(21,62,50,.5)" onclick="document.getElementById('marketplace').scrollIntoView({behavior:'smooth'});return false;">Browse Listings&nbsp; →</a>
        </div>
        <div class="hero-badges">
          <div class="hero-badge"><b>✓</b> Local connections</div>
          <div class="hero-badge"><b>✓</b> Direct messaging</div>
          <div class="hero-badge"><b>✓</b> Built for rural communities</div>
        </div>
      </div>
    </div>
    <div class="hero-sign">Real People<br>Real Farms<br>Real Opportunities</div>
    <div class="ticker-wrap"><div class="ticker">${tickerLoop || '<span>Be the first to post a listing →</span>'}</div></div>
  </section>

  <div class="category-strip" aria-label="Marketplace categories"><div class="wrap categories">${catStrip}</div></div>

  ${adsWrap('home')}

  <section id="marketplace"><div class="wrap">
    <div class="section-head"><div><div class="eyebrow">Fresh from the farm</div><h2>Featured Listings</h2><p>Find what you need. Support the people who grow it.</p></div><a class="text-link" href="#/category/livestock">View all listings →</a></div>
    <div class="filters" id="filters" style="margin-top:18px">${filters}</div>
    <div class="feat-wrap">
      <div><div class="feat-row" id="listingGrid">${homeFeaturedGrid()}</div></div>
      <a class="game-promo" href="#/games"><div class="gp-title">Pickle<br>Barrel<br>Toss</div><div class="gp-art">🥒🛢️</div><span class="btn btn-cyan">▶ Play Now</span><small>Earn rewards • Climb the leaderboard • Have fun!</small></a>
    </div>
  </div></section>

  <section id="nearby" class="band-alt"><div class="wrap">
    <div class="section-head"><div><div class="eyebrow">Your farming community</div><h2>Discover farms near you</h2><p>Explore nearby growers, sellers, services, and opportunities.</p></div><a class="btn btn-outline" href="#/category/events">Events near you ↗</a></div>
    <div class="layout-two" style="margin-top:20px">
      <div class="panel"><div class="map-art" role="img" aria-label="Illustrative map with farm location pins"><div class="road"></div><span class="map-label" style="left:12%;top:20%">RIVER ROAD</span><span class="map-label" style="left:54%;top:33%">MAPLE GROVE</span><span class="map-label" style="left:20%;top:74%">PINE VALLEY</span><span class="pin" style="left:20%;top:34%"><span>🌱</span></span><span class="pin" style="left:49%;top:48%"><span>🐄</span></span><span class="pin" style="left:75%;top:26%"><span>🚜</span></span><span class="pin" style="left:70%;top:70%"><span>🥕</span></span><span class="pin" style="left:34%;top:72%"><span>🌾</span></span></div><div class="panel-content"><strong>Explore by distance</strong><p style="color:var(--muted);margin-bottom:0">Map shown is a visual placeholder. Connect a map provider to display real farm locations and directions.</p></div></div>
      <div class="panel"><div class="panel-head"><h3>Community picks</h3><a href="#/vendor" class="text-link">Become a vendor →</a></div><div class="panel-content nearby-list">${picks}</div></div>
    </div>
  </div></section>

  <section id="community"><div class="wrap">
    <div class="section-head"><div><div class="eyebrow">More than a marketplace</div><h2>Good things grow together</h2><p>Tools for the people who keep farming communities moving.</p></div></div>
    <div class="feature-grid" style="margin-top:20px">
      <article class="feature"><div class="icon">🧑‍🌾</div><h3>Farm jobs</h3><p>Help wanted, seasonal work, volunteers, and farmhands for hire. Make it easier for workers and farms to find each other.</p><a href="#/category/farmhand">Explore farm jobs →</a></article>
      <article class="feature"><div class="icon">🤝</div><h3>Trade &amp; barter</h3><p>Post what you have, what you need, and start a direct conversation to work out a fair exchange.</p><a href="#/category/farmhand/Barter">Explore barter →</a></article>
      <article class="feature"><div class="icon">📣</div><h3>Events &amp; auctions</h3><p>Share farm auctions, breeder shows, market days, and useful community events.</p><a href="#/category/events">Visit the events board →</a></article>
    </div>
  </div></section>

  <section class="mission band-alt">
    <div class="wrap mission-grid">
      <div>
        <div class="eyebrow">Our Story</div>
        <h2 style="max-width:none">Built by Mr. Green, for the backyard garden and the full-scale operation alike.</h2>
        <p>Whether you're tending three raised beds or three hundred acres, there's real money sitting in a local audience — buyers who'd rather pay a neighbor than a grocery chain, if only they knew you were there. let-us.farm exists to close that gap: one place for every size of grower, raiser, breeder, and maker to turn what they produce into real income, by trading directly online instead of through a giant platform that takes its cut and gives nothing back.</p>
        <p>A free account is all it takes to get found. Post what you have, browse what's nearby, and message buyers and sellers directly — no fees to start, no middleman in between. The real value is being in one place with people who care about the same things you do: farmers, farmhands, breeders, crafters, and neighbors, localized instead of scattered across a dozen different apps.</p>
        <p>It's a small idea trying to grow into something real. Every listing posted here helps it take root.</p>
        <div class="stat-row">
          <div class="stat"><b>0%</b><span>Listing fees to start</span></div>
          <div class="stat"><b>Direct</b><span>Messaging, no middleman</span></div>
          <div class="stat"><b>${CAT_ORDER.length}</b><span>Categories to trade in</span></div>
        </div>
      </div>
      <div>
        <div class="eyebrow">How It Works</div>
        <div class="steps" style="grid-template-columns:1fr">
          <div class="step-card"><div class="step-no">STEP 1</div><h4>Make a free account</h4><p>Sign up in under a minute — no fees, no middlemen, just your name and your patch of ground.</p></div>
          <div class="step-card"><div class="step-no">STEP 2</div><h4>Post or browse a category</h4><p>List livestock, produce, equipment, or a job in seconds — or browse what's near you.</p></div>
          <div class="step-card"><div class="step-no">STEP 3</div><h4>Message directly</h4><p>Talk straight to the buyer or seller through the site, and work out the details yourselves.</p></div>
        </div>
      </div>
    </div>
  </section>

  <section id="games" style="padding-top:48px"><div class="wrap"><div class="game-banner"><div><div class="eyebrow">Take a farm break</div><h2>Welcome to the Farm Arcade</h2><p>Play farm-themed games, chase high scores, and challenge your community. No login needed.</p><a class="btn btn-cyan" href="#/games">🎮 Play the Game Hub</a></div><div class="game-art" aria-label="Farm game artwork">🥒 🪵 🌽</div></div></div></section>

  <section id="dashboard" class="band-alt"><div class="wrap">
    <div class="section-head"><div><div class="eyebrow">Your farm at a glance</div><h2>One dashboard. Everything connected.</h2><p>Manage listings, messages, and opportunities in one place.</p></div><a class="btn btn-outline" href="${u?'#/profile/listings':'#/login'}">Open my dashboard ↗</a></div>
    <div class="dashboard" style="margin-top:20px">
      <a class="dash-stat" href="${u?'#/profile/listings':'#/login'}"><div class="stat-top"><span>${u?'My listings':'Active listings'}</span><span>📋</span></div><strong>${String(u?myCount:DB.listings.length).padStart(2,'0')}</strong><small>${u?'Posted by you':'Across the market'}</small></a>
      <a class="dash-stat" href="${u?'#/messages':'#/login'}"><div class="stat-top"><span>Messages</span><span>✉️</span></div><strong>→</strong><small>Talk directly with sellers</small></a>
      <div class="dash-stat"><div class="stat-top"><span>Members</span><span>👥</span></div><strong>${String(Object.keys(DB.users).filter(n=>!DB.users[n].admin).length).padStart(2,'0')}</strong><small>Growing community</small></div>
      <div class="dash-stat"><div class="stat-top"><span>Categories</span><span>↔</span></div><strong>${String(CAT_ORDER.length).padStart(2,'0')}</strong><small>Ways to trade</small></div>
    </div>
  </div></section>

  <section class="cta"><div class="wrap"><div class="cta-box"><div><h2>Selling regularly? Become a Vendor.</h2><p>Try it free for 30 days, no card. Vendor accounts get a badge, a standing storefront of listings, and priority placement across the market.</p></div><a class="btn btn-primary" href="#/vendor">See vendor benefits →</a></div></div></section>
  `;
}

/* ---------------- LOGIN / SIGNUP ---------------- */
function viewLogin(){
  return `
  <section class="center-page">
    <div class="wrap">
      <div class="form-card">
        <button class="back-link" onclick="history.length>1?history.back():go('#/home')">← Back</button>
        <div class="eyebrow">Welcome Back</div>
        <h2>Log in to your account</h2>
        <div class="form-alert err" id="loginAlert"></div>
        <form onsubmit="return doLogin(event)">
          <div class="field">
            <label for="li-user">Username</label>
            <input type="text" id="li-user" autocomplete="username" required>
          </div>
          <div class="field">
            <label for="li-pass">Password</label>
            <input type="password" id="li-pass" autocomplete="current-password" required>
          </div>
          <button class="btn btn-primary btn-block" type="submit">Log In</button>
        </form>
        <p class="field hint" style="text-align:center;margin-top:14px;">Try the demo account — username <b>demo_farmer</b>, password <b>demo</b></p>
        <div class="auth-switch">New here? <a href="#/signup">Create a free account</a></div>
      </div>
    </div>
  </section>`;
}

function doLogin(e){
  e.preventDefault();
  const user = document.getElementById('li-user').value.trim().toLowerCase();
  const pass = document.getElementById('li-pass').value;
  const alertEl = document.getElementById('loginAlert');
  const u = DB.users[user];
  if(!u || u.admin || u.password !== pass){
    alertEl.textContent = "That username and password don't match our records.";
    alertEl.className = 'form-alert err show';
    return false;
  }
  if(u.blocked){
    alertEl.textContent = 'This account has been blocked. Contact support if you think this is a mistake.';
    alertEl.className = 'form-alert err show';
    return false;
  }
  DB.currentUser = user;
  saveDB(DB);
  toast('Welcome back, '+u.username+'.', 'ok');
  go('#/home');
  return false;
}

function viewSignup(){
  return `
  <section class="center-page">
    <div class="wrap">
      <div class="form-card">
        <button class="back-link" onclick="history.length>1?history.back():go('#/home')">← Back</button>
        <div class="eyebrow">Join The Market</div>
        <h2>Create your free account</h2>
        <div class="form-alert err" id="signupAlert"></div>
        <form onsubmit="return doSignup(event)">
          <div class="field">
            <label for="su-user">Username</label>
            <input type="text" id="su-user" required placeholder="e.g. hollow-creek-farm">
          </div>
          <div class="field">
            <label for="su-email">Email</label>
            <input type="email" id="su-email" required placeholder="you@example.com">
          </div>
          <div class="field">
            <label for="su-location">Location (county / city, state)</label>
            <input type="text" id="su-location" required placeholder="e.g. Greene County, TN">
          </div>
          <div class="field">
            <label for="su-pass">Password</label>
            <input type="password" id="su-pass" required minlength="4">
          </div>
          <button class="btn btn-primary btn-block" type="submit">Create Account</button>
        </form>
        <div class="auth-switch">Already a member? <a href="#/login">Log in</a></div>
      </div>
    </div>
  </section>`;
}

function doSignup(e){
  e.preventDefault();
  const username = document.getElementById('su-user').value.trim().toLowerCase().replace(/\s+/g,'-');
  const email = document.getElementById('su-email').value.trim();
  const location = document.getElementById('su-location').value.trim();
  const pass = document.getElementById('su-pass').value;
  const alertEl = document.getElementById('signupAlert');

  if(!username || !email || !location || pass.length < 4){
    alertEl.textContent = 'Please fill out every field. Passwords need at least 4 characters.';
    alertEl.className = 'form-alert err show';
    return false;
  }
  if(DB.users[username] || username==='admin'){
    alertEl.textContent = 'That username is already taken — try another.';
    alertEl.className = 'form-alert err show';
    return false;
  }
  DB.users[username] = {username, email, location, password:pass, joined:Date.now(), vendor:false, bio:''};
  DB.currentUser = username;
  saveDB(DB);
  toast('Account created — welcome to let-us.farm!', 'ok');
  go('#/home');
  return false;
}

function logout(){
  DB.currentUser = null;
  saveDB(DB);
  toast('Logged out.');
  go('#/home');
}

/* ---------------- VENDOR ---------------- */
function viewVendor(){
  const u = currentUser();
  const isVendor = u && u.vendor;
  return `
  <section class="page-hero">
    <div class="wrap">
      <div>
        <div class="breadcrumb"><a href="#/home">Home</a> / Become a Vendor</div>
        <h1>Get Verified</h1>
        <p>Vendor verification confirms you're a real person and a real farm — and it's what unlocks accepting payments directly through let-us.farm.</p>
      </div>
    </div>
  </section>
  <section>
    <div class="wrap">
      <div class="vendor-price-card">
        <div class="vp-price"><span class="vp-amount">30 days free</span></div>
        <p class="vp-sub">No card needed to start. Then <b>$4.99 / month</b> — cancel anytime. One verified profile per farm.</p>
      </div>
      <div class="vendor-perks" style="margin-top:0;">
        <div class="perk-card"><div class="p-icon">🎁</div><h4>30-Day Free Trial</h4><p>Start verified with no credit card. Autopay only begins if you turn on in-app transactions — and your first charge always lands on the original trial end date.</p></div>
        <div class="perk-card"><div class="p-icon">💸</div><h4>5% Platform Fee</h4><p>When you sell through let-us.farm checkout we keep 5% of the sale. No fee on listings, messages, or links you handle yourself.</p></div>
        <div class="perk-card"><div class="p-icon">🏦</div><h4>Vendor Payouts</h4><p>Connect your bank through Stripe Connect from your vendor dashboard and get paid straight to you.</p></div>
      </div>
      <div class="vendor-perks">
        <div class="perk-card"><div class="p-icon">✅</div><h4>Identity Verification</h4><p>We confirm you're a real person attached to a real farm — not an anonymous listing.</p></div>
        <div class="perk-card"><div class="p-icon">💳</div><h4>Accept Payments</h4><p>Only verified vendors can add a Buy Now payment link — unverified accounts can post, but can't collect payment through the site.</p></div>
        <div class="perk-card"><div class="p-icon">🏷️</div><h4>Vendor Badge</h4><p>A visible ✓ Verified badge on your profile and every listing, so buyers can trust who they're dealing with.</p></div>
        <div class="perk-card"><div class="p-icon">📌</div><h4>Priority Placement</h4><p>Vendor listings surface first within their category, ahead of unverified posts.</p></div>
        <div class="perk-card"><div class="p-icon">🗂️</div><h4>Storefront Profile</h4><p>All of your listings, across every category, gathered on one shareable profile page.</p></div>
        <div class="perk-card"><div class="p-icon">🌱</div><h4>Grow With Us</h4><p>Early vendors help shape which tools and categories come next.</p></div>
      </div>
      <div class="text-center">
        ${!u ? `
          <p>Create a free account first, then start verification from your profile.</p>
          <a href="#/signup" class="btn btn-primary">Create Free Account</a>
        ` : isVendor ? `
          <p><span class="badge vendor">✓ You're Verified</span></p>
          <a href="#/profile/listings" class="btn btn-outline">Go to My Storefront</a> <a href="#/profile/plan" class="btn btn-ghost">Plan &amp; Payouts</a>
        ` : `
          <button class="btn btn-primary" onclick="becomeVendor()">Start 30-Day Free Trial</button>
          <p class="field hint" style="margin-top:12px;">No card required. Billing isn't wired to a live processor yet in this build — the trial, autopay and payout screens work locally so you can preview them.</p>
        `}
      </div>
    </div>
  </section>`;
}

/* ---------------- PLANS / TRIAL / FEES ---------------- */
const PLAN = { trialDays:30, price:4.99, feePct:5 };
function findPromo(code){ return (DB.promos||[]).find(p=>p.active && p.code===String(code||'').trim().toUpperCase()); }
function promoPrice(u){
  const pr = u && u.promo ? findPromo(u.promo) : null;
  if(!pr) return {price:PLAN.price, promo:null};
  const price = pr.type==='percent' ? PLAN.price*(1-pr.value/100) : PLAN.price-pr.value;
  return {price:Math.max(0,Math.round(price*100)/100), promo:pr};
}
function applyPromo(){
  const u = currentUser(); if(!u) return;
  const el = document.getElementById('promoIn'); const code = el.value.trim().toUpperCase();
  const pr = findPromo(code);
  if(!pr){ toast('That code isn\'t valid.','err'); return; }
  u.promo = code; pr.uses = (pr.uses||0)+1; saveDB(DB);
  toast('Code '+code+' applied.','ok'); render();
}
function removePromo(){ const u=currentUser(); if(u){ delete u.promo; saveDB(DB); render(); } }
const DAY_MS = 86400000;

// Lapse vendor status when a trial ends and in-app transactions (autopay) were never turned on.
function normalizeVendors(){
  let changed = false;
  const cu = DB.currentUser && DB.users[DB.currentUser];
  if(DB.currentUser && (!cu || cu.blocked)){ DB.currentUser = null; changed = true; }
  Object.values(DB.users).forEach(u=>{
    if(u.vendor && u.trialEnd && !u.autopay && Date.now() > u.trialEnd){
      u.vendor = false; u.trialExpired = true; changed = true;
    }
  });
  if(changed) saveDB(DB);
}
function trialDaysLeft(u){
  if(!u || !u.trialEnd) return null;
  return Math.max(0, Math.ceil((u.trialEnd - Date.now())/DAY_MS));
}
function becomeVendor(){
  const u = currentUser();
  if(!u){ go('#/signup'); return; }
  const ok = confirm('Start your 30-day free trial? No card needed. You\'ll get the Verified badge, priority placement and Buy Now links.\n\nAfter 30 days it is $4.99/month — but only if you turn on in-app transactions. Otherwise the trial simply ends.');
  if(!ok) return;
  u.vendor = true; u.trialExpired = false;
  u.trialStart = Date.now(); u.trialEnd = Date.now() + PLAN.trialDays*DAY_MS;
  u.autopay = false;
  saveDB(DB);
  toast('Trial started — 30 days of Verified, on us.', 'ok');
  go('#/profile/plan');
}
function toggleInApp(){
  const u = currentUser(); if(!u) return;
  if(!u.autopay){
    if(!u.stripeConnected){ toast('Connect payouts first, then turn on in-app transactions.', 'err'); return; }
    u.autopay = true;
    const when = u.trialEnd && Date.now() < u.trialEnd ? 'Your first $4.99 charge is on '+fmtDate(u.trialEnd)+'.' : 'Billing is $4.99/month.';
    toast('In-app transactions on. '+when, 'ok');
  } else {
    if(!confirm('Turn off in-app transactions? Autopay stops and your Verified status ends when the current period does.')) return;
    u.autopay = false;
    toast('In-app transactions off.');
  }
  saveDB(DB); render();
}
function connectPayouts(){
  const u = currentUser(); if(!u) return;
  // Hook: replace with a call to your backend that creates a Stripe Connect onboarding link.
  u.stripeConnected = true; saveDB(DB);
  toast('Payouts connected (demo mode — no live Stripe yet).', 'ok'); render();
}
function calcFee(){
  const v = parseFloat(document.getElementById('feeAmt').value)||0;
  const fee = v*PLAN.feePct/100;
  document.getElementById('feeOut').innerHTML = 'Platform fee: <b>$'+fee.toFixed(2)+'</b> · You receive: <b>$'+(v-fee).toFixed(2)+'</b>';
}
function planTabHtml(u){
  if(!u.vendor){
    return `<div class="form-card wide" style="margin:0;"><h3>Plan &amp; Payouts</h3>
      <p>${u.trialExpired?'Your free trial has ended. ':''}You\'re on the free Member plan. Vendors get a 30-day free trial with no card, then $4.99/month.</p>
      <a href="#/vendor" class="btn btn-primary">See Vendor Benefits</a></div>`;
  }
  const left = trialDaysLeft(u);
  const inTrial = u.trialEnd && Date.now() < u.trialEnd;
  const status = inTrial ? `Free trial — <b>${left} day${left===1?'':'s'}</b> left (ends ${fmtDate(u.trialEnd)})` : `Verified Vendor — $${promoPrice(u).price.toFixed(2)}/month`;
  return `
    <div class="form-card wide" style="margin:0 0 18px;">
      <h3>Your Plan</h3>
      <p>${status}</p>
      <div class="field"><label for="promoIn">Promo code</label>
        ${u.promo&&promoPrice(u).promo ? `<p style="margin:0 0 6px;">✅ <b>${escapeHtml(u.promo)}</b> applied — after your trial: <b>$${promoPrice(u).price.toFixed(2)}/month</b> <button class="btn btn-ghost btn-sm" onclick="removePromo()">Remove</button></p>` : `<div style="display:flex;gap:8px;"><input type="text" id="promoIn" placeholder="Enter code" style="flex:1;text-transform:uppercase;"><button class="btn btn-outline btn-sm" onclick="applyPromo()">Apply</button></div>`}
      </div>
      <div class="field"><label>In-app transactions &amp; autopay</label>
        <p class="hint" style="margin:0 0 10px;">${u.autopay?'On. '+(inTrial?'Your first charge is on '+fmtDate(u.trialEnd)+' — the original trial end date.':'Billed $4.99/month.'):'Off. Your trial ends '+(u.trialEnd?fmtDate(u.trialEnd):'')+' and Verified status lapses unless you turn this on. The 30 days is your total grace period, even if you enable it on day 29.'}</p>
        <button class="btn ${u.autopay?'btn-ghost':'btn-primary'}" onclick="toggleInApp()">${u.autopay?'Turn Off In-App Transactions':'Turn On In-App Transactions'}</button>
      </div>
    </div>
    <div class="form-card wide" style="margin:0;">
      <h3>Vendor Payouts</h3>
      <p>Get paid straight to your bank through Stripe Connect. let-us.farm keeps a <b>${PLAN.feePct}%</b> platform fee on sales made through checkout.</p>
      <p>${u.stripeConnected?'✅ Payouts connected.':'Not connected yet.'}</p>
      ${u.stripeConnected?'':'<button class="btn btn-cyan" onclick="connectPayouts()">Connect Payouts</button>'}
      <div class="field" style="margin-top:18px;"><label for="feeAmt">Fee calculator — sale amount ($)</label>
        <input type="number" id="feeAmt" min="0" step="0.01" value="100" oninput="calcFee()">
        <div class="hint" id="feeOut" style="margin-top:8px;">Platform fee: <b>$5.00</b> · You receive: <b>$95.00</b></div>
      </div>
    </div>`;
}

/* ---------------- STOREFRONT (public vendor profile) ---------------- */
function money(n){ return n.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}); }
const CART = {};   // owner -> {listingId: qty}
function priceNum(l){
  if(l.free || !l.price) return null;
  const m = String(l.price).replace(/,/g,'').match(/\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}
const ORDERABLE = ['livestock','feed','produce','equipment','homegoods'];
function cartAdd(owner,id,d){
  const c = CART[owner] || (CART[owner]={});
  c[id] = Math.max(0,(c[id]||0)+d);
  if(!c[id]) delete c[id];
  const el = document.getElementById('sfCart'); if(el) el.innerHTML = cartHtml(owner);
}
function cartHtml(owner){
  const c = CART[owner]||{};
  const rows = Object.keys(c).map(id=>{
    const l = DB.listings.find(x=>x.id===id); if(!l) return '';
    const n = priceNum(l), q=c[id];
    return `<div class="sf-cart-row"><span>${escapeHtml(l.title)}<br><span class="hint">${q} × $${money(n)}</span></span>
      <span><button class="btn btn-ghost btn-sm" onclick="cartAdd('${owner}','${id}',-1)">−</button> <button class="btn btn-ghost btn-sm" onclick="cartAdd('${owner}','${id}',1)">+</button></span></div>`;
  }).join('');
  const total = Object.keys(c).reduce((t,id)=>{const l=DB.listings.find(x=>x.id===id);return t+(l?priceNum(l)*c[id]:0);},0);
  return `<h4 style="margin-top:0;">Your Order</h4>
    ${rows || '<p class="hint">Add items to start an order.</p>'}
    <div class="sf-total"><span>Total</span><span>$${money(total)}</span></div>
    <button class="btn btn-primary btn-block" ${rows?'':'disabled'} onclick="sendOrder('${owner}')">Send Order to Farm</button>
    <p class="hint" style="margin:10px 0 0;">Orders go through in-app messages — no phone calls needed. Pay the farm directly when you pick up or arrange delivery.</p>`;
}
function sendOrder(owner){
  const u = currentUser();
  if(!u){ go('#/login'); return; }
  if(u.username===owner){ toast("That's your own storefront.",'err'); return; }
  const c = CART[owner]||{};
  let lines=[], total=0;
  Object.keys(c).forEach(id=>{const l=DB.listings.find(x=>x.id===id); if(!l) return; const t=priceNum(l)*c[id]; total+=t; lines.push(`• ${c[id]} × ${l.title} — $${money(t)}`);});
  if(!lines.length) return;
  const key = convoKey(u.username, owner);
  if(!DB.messages[key]) DB.messages[key]=[];
  DB.messages[key].push({from:u.username,to:owner,text:'🛒 New order\n'+lines.join('\n')+'\nTotal: $'+money(total),date:Date.now()});
  delete CART[owner];
  saveDB(DB);
  toast('Order sent!','ok');
  go('#/messages/'+encodeURIComponent(owner));
}
let SF_FILTER = 'all';
function setSfFilter(f,owner){ SF_FILTER=f; render(); }
function viewStorefront(username){
  const o = DB.users[username];
  if(!o) return view404();
  const u = currentUser();
  const own = !!(u && u.username===username);
  const name = o.farmName || o.username;
  const ful = o.fulfillment || 'both';
  const all = DB.listings.filter(l=>l.owner===username).sort((a,b)=>b.date-a.date);
  const cats = [...new Set(all.map(l=>l.category))];
  if(SF_FILTER!=='all' && !cats.includes(SF_FILTER)) SF_FILTER='all';
  const items = SF_FILTER==='all' ? all : all.filter(l=>l.category===SF_FILTER);
  const follows = (DB.follows||[]).filter(f=>f.to===username);
  const following = !!(u && follows.some(f=>f.from===u.username));
  const reviews = (DB.reviews||[]).filter(r=>r.to===username).sort((a,b)=>b.date-a.date);
  const handle = '@'+String(o.username).toLowerCase().replace(/[^a-z0-9]+/g,'');
  const photos = []; all.forEach(l=>(l.photos||[]).forEach(src=>{ if(photos.length<12) photos.push({src,id:l.id}); }));
  const pills = [`<button class="sub-chip ${SF_FILTER==='all'?'active':''}" onclick="setSfFilter('all')">All (${all.length})</button>`]
    .concat(cats.map(k=>`<button class="sub-chip ${SF_FILTER===k?'active':''}" onclick="setSfFilter('${k}')">${CATEGORIES[k].icon} ${CATEGORIES[k].label}</button>`)).join('');
  const cards = items.map(l=>{
    const n = priceNum(l);
    const orderable = n!==null && ORDERABLE.includes(l.category) && !own;
    const hasPhoto = l.photos && l.photos.length;
    return `<div class="sf-item">
      <a href="#/listing/${l.id}" class="thumb" style="background-image:url('${hasPhoto?l.photos[0]:(CAT_PHOTOS[l.category]||'')}');font-size:0;"></a>
      <div class="body"><h4>${escapeHtml(l.title)}${l.videoId?' 🎥':''}</h4>
        <span class="feat-price">${l.free?'FREE':escapeHtml(l.price||'Ask for price')}</span>
        <p style="font-size:.82rem;margin:0;flex:1;">${escapeHtml(l.desc.length>90?l.desc.slice(0,90)+'…':l.desc)}</p>
        ${orderable?`<button class="btn btn-primary btn-sm" onclick="cartAdd('${username}','${l.id}',1)">+ Add to Order</button>`:`<a href="#/listing/${l.id}" class="btn btn-ghost btn-sm">View</a>`}
      </div></div>`;
  }).join('');
  const anyOrderable = all.some(l=>priceNum(l)!==null && ORDERABLE.includes(l.category));
  const pic = o.avatar ? `<div class="vp-pic" style="background-image:url('${o.avatar}')"></div>` : `<div class="vp-pic">${escapeHtml(initials(o.username))}</div>`;
  const tabs = [['vp-about','About'],['vp-listings','Listings']];
  if(photos.length) tabs.push(['vp-photos','Photos']);
  tabs.push(['vp-reviews','Reviews']);
  const btns = (own ? `<a class="btn btn-primary" href="#/profile/info">✏️ Edit My Profile</a>`
      : `<button class="btn ${following?'btn-ghost':'btn-primary'}" onclick="toggleFollow('${username}')">${following?'✓ Following':'＋ Follow'}</button>
         <button class="btn btn-ghost" onclick="startConversation('${username}')">💬 Message</button>`)
    + `<button class="btn btn-ghost" onclick="vpShare('${escapeHtml(name).replace(/'/g,'')}')">↗ Share</button>`;
  const stars = r=>'★'.repeat(r)+'☆'.repeat(5-r);
  const avg = reviews.length ? (reviews.reduce((t,r)=>t+r.rating,0)/reviews.length).toFixed(1) : null;
  return `
  <div class="vp">
    <div class="vp-cover" ${o.cover?`style="background-image:url('${o.cover}')"`:''}>
      <button class="vp-back" onclick="history.length>1?history.back():go('#/home')">← Back</button>
    </div>
    <div class="wrap">
      <div class="vp-head">
        ${pic}
        <div class="vp-id">
          <h1>${escapeHtml(name)} ${o.vendor?'<span class="badge vendor" style="vertical-align:middle;">✓ Verified</span>':''}</h1>
          <div class="vp-handle">${escapeHtml(handle)}${avg?` · <span class="vp-stars">★ ${avg}</span> (${reviews.length})`:''}</div>
          ${o.tagline?`<p class="vp-tag">${escapeHtml(o.tagline)}</p>`:''}
        </div>
      </div>
      <div class="vp-chips">
        <span class="chip">${o.vendor?'Vendor':'Member'}</span>
        ${(ful==='onfarm'||ful==='both')?'<span class="chip">🚜 On-farm pickup</span>':''}
        ${(ful==='offfarm'||ful==='both')?'<span class="chip">🚚 Off-farm / delivery</span>':''}
        <span class="chip">📍 ${escapeHtml(o.location||'Location n/a')}</span>
      </div>
      <div class="vp-btns">${btns}</div>
      <div class="vp-stats">
        <div><b>${follows.length}</b><span>Followers</span></div>
        <div><b>${all.length}</b><span>Listings</span></div>
        <div><b>${reviews.length}</b><span>Reviews</span></div>
      </div>
      <div class="vp-tabs">${tabs.map((x,i)=>`<button class="vp-tab${i?'':' active'}" onclick="vpTab(this,'${x[0]}')">${x[1]}</button>`).join('')}</div>

      <div class="vp-card" id="vp-about"><h3>About</h3>
        <p style="white-space:pre-wrap;margin:0;">${o.bio?escapeHtml(o.bio):'No bio yet.'}</p>
        <div class="vp-info">
          <div><b>Location</b>${escapeHtml(o.location||'—')}</div>
          <div><b>Member since</b>${fmtDate(o.joined)}</div>
          <div><b>Account</b>${o.vendor?'Verified vendor':'Member'}</div>
          <div><b>Where they sell</b>${ful==='onfarm'?'On-farm pickup':ful==='offfarm'?'Off-farm / delivery':'On-farm &amp; delivery'}</div>
        </div>
      </div>

      <div class="vp-card" id="vp-listings"><h3>Listings</h3>
        <div class="sf-grid ${anyOrderable && !own?'':'nocart'}" style="margin-top:0">
          <div>
            ${all.length?`<div class="sub-filter" style="padding-top:0;">${pills}</div>`:''}
            <div class="sf-items" style="margin-top:12px;">${cards || '<div class="empty-state"><div class="em-icon">🌱</div><h3>Nothing listed yet</h3></div>'}</div>
          </div>
          ${anyOrderable && !own ? `<div><div class="sf-cart" id="sfCart">${cartHtml(username)}</div></div>` : '<div></div>'}
        </div>
      </div>

      ${photos.length?`<div class="vp-card" id="vp-photos"><h3>Photos</h3><div class="vp-photos">${photos.map(x=>`<a href="#/listing/${x.id}"><img src="${x.src}" alt=""></a>`).join('')}</div></div>`:''}

      <div class="vp-card" id="vp-reviews"><h3>Reviews</h3>
        ${reviews.length?reviews.map(r=>`<div class="vp-review"><div><b>${escapeHtml(r.from)}</b> <span class="vp-stars">${stars(r.rating)}</span> <span class="hint">· ${fmtDate(r.date)}</span></div><p style="margin:4px 0 0;">${escapeHtml(r.text)}</p></div>`).join(''):'<p>No reviews yet.</p>'}
        ${(!own)?(u?`<div class="vp-review-form">
          <select id="rv-rating" style="max-width:120px;"><option value="5">★★★★★</option><option value="4">★★★★☆</option><option value="3">★★★☆☆</option><option value="2">★★☆☆☆</option><option value="1">★☆☆☆☆</option></select>
          <input type="text" id="rv-text" maxlength="300" placeholder="Leave a review…">
          <button class="btn btn-primary" onclick="submitReview('${username}')">Post</button></div>`:`<p style="margin-top:10px;"><a href="#/login" style="color:var(--forest);font-weight:700;">Log in</a> to follow or review this farm.</p>`):''}
      </div>
    </div>
  </div>`;
}

function toggleFollow(username){
  const u = currentUser(); if(!u){ go('#/login'); return; }
  DB.follows = DB.follows || [];
  const i = DB.follows.findIndex(f=>f.from===u.username && f.to===username);
  if(i>=0) DB.follows.splice(i,1); else DB.follows.push({from:u.username,to:username,date:Date.now()});
  saveDB(DB); render();
}
function submitReview(username){
  const u = currentUser(); if(!u){ go('#/login'); return; }
  const text = document.getElementById('rv-text').value.trim();
  if(text.length<3){ toast('Write a short review first.','err'); return; }
  DB.reviews = DB.reviews || [];
  DB.reviews.push({from:u.username,to:username,rating:parseInt(document.getElementById('rv-rating').value,10)||5,text,date:Date.now()});
  if(saveDB(DB)){ toast('Review posted.','ok'); render(); setTimeout(()=>{const el=document.getElementById('vp-reviews'); if(el) el.scrollIntoView({block:'center'});},50); }
}
function vpTab(btn,id){
  document.querySelectorAll('.vp-tab').forEach(b=>b.classList.toggle('active',b===btn));
  const el=document.getElementById(id); if(el) el.scrollIntoView({behavior:'smooth',block:'start'});
}
function vpShare(name){
  const url = location.href;
  if(navigator.share){ navigator.share({title:name+' on let-us.farm',url}).catch(()=>{}); return; }
  try{ navigator.clipboard.writeText(url); toast('Profile link copied.','ok'); }catch(e){ toast(url); }
}

/* ---------------- ADS ---------------- */
const AD_PLACEMENTS = {home:'Homepage (below hero)', category:'Category pages (above listings)', grid:'Between listings (every 6th spot)', listing:'Listing page (sidebar)', footer:'Footer (every page)'};
const AD_SIZES = {small:90, medium:160, large:260};   // max height in px; width always fits the screen
const AD_SEEN = new Set();
function adsHtml(placement){
  const pool = (DB.ads||[]).filter(a=>a.active && a.placement===placement);
  if(!pool.length) return '';
  const a = pool[Math.floor(Math.random()*pool.length)];
  if(!AD_SEEN.has(a.id)){ AD_SEEN.add(a.id); a.views=(a.views||0)+1; try{localStorage.setItem(DB_KEY, JSON.stringify(DB));}catch(e){} }
  return `<div class="ad-slot ad-${placement}"><span class="ad-label">Sponsored</span>
    <a href="${escapeHtml(a.link||'#')}" target="_blank" rel="noopener noreferrer sponsored" onclick="adClick('${a.id}')">
      <img src="${a.image}" alt="${escapeHtml(a.title)}" style="max-height:${AD_SIZES[a.size]||160}px;"></a></div>`;
}
function adsWrap(pl){ const h=adsHtml(pl); return h?`<section style="padding:20px 0 0;"><div class="wrap">${h}</div></section>`:''; }
function gridWithAds(listings){
  const out=[];
  listings.forEach((l,i)=>{
    out.push(listingCard(l));
    if((i+1)%6===0 && i+1<listings.length){ const h=adsHtml('grid'); if(h) out.push(`<div style="grid-column:1/-1;">${h}</div>`); }
  });
  return out.join('');
}
function adClick(id){ const a=(DB.ads||[]).find(x=>x.id===id); if(a){ a.clicks=(a.clicks||0)+1; saveDB(DB); } }
let PENDING_AD = '';
function handleAdImage(input){
  const f=input.files&&input.files[0]; input.value=''; if(!f) return;
  resizeImageToDataURL(f, 1200, 0.8).then(d=>{ PENDING_AD=d; const el=document.getElementById('adPrev'); if(el) el.innerHTML=`<img src="${d}" style="max-width:100%;max-height:140px;border-radius:8px;">`; })
    .catch(()=>toast("Couldn't read that image.",'err'));
}
function adminAddAd(e){
  e.preventDefault(); if(!isAdmin()) return false;
  const title=document.getElementById('ad-title').value.trim();
  let link=document.getElementById('ad-link').value.trim();
  if(!title || !PENDING_AD || !link){ toast('Add a title, an image and a link.','err'); return false; }
  if(!/^https?:\/\//i.test(link)) link='https://'+link;
  DB.ads.push({id:uid(), title, link, image:PENDING_AD, placement:document.getElementById('ad-place').value, size:document.getElementById('ad-size').value, active:true, views:0, clicks:0, created:Date.now()});
  PENDING_AD=''; if(!saveDB(DB)){ DB.ads.pop(); return false; }
  toast('Ad created.','ok'); render(); return false;
}
function adminToggleAd(id){ if(!isAdmin()) return; const a=DB.ads.find(x=>x.id===id); if(a){a.active=!a.active; saveDB(DB); render();} }
function adminSetAdSize(id,v){ if(!isAdmin()) return; const a=DB.ads.find(x=>x.id===id); if(a){a.size=v; saveDB(DB); render();} }
function adminDeleteAd(id){ if(!isAdmin()||!confirm('Delete this ad?')) return; DB.ads=DB.ads.filter(x=>x.id!==id); saveDB(DB); render(); }

/* ---------------- ADMIN ---------------- */
function isAdmin(){ const u=currentUser(); return !!(u && u.admin); }
function adminToggleBlock(name){
  if(!isAdmin()) return; const t=DB.users[name]; if(!t||t.admin) return;
  t.blocked = !t.blocked; saveDB(DB);
  toast(t.blocked?name+' blocked.':name+' unblocked.'); render();
}
function adminDeleteUser(name){
  if(!isAdmin()) return; const t=DB.users[name]; if(!t||t.admin) return;
  if(!confirm('Permanently delete '+name+', their listings and messages?')) return;
  DB.listings.filter(l=>l.owner===name).forEach(l=>vidDel(l.videoId));
  DB.listings = DB.listings.filter(l=>l.owner!==name);
  Object.keys(DB.messages).forEach(k=>{ if(k.split('|').includes(name)) delete DB.messages[k]; });
  delete DB.users[name]; saveDB(DB); toast(name+' deleted.'); render();
}
function adminDeleteListing(id){
  if(!isAdmin()) return; if(!confirm('Delete this listing?')) return;
  vidDel((DB.listings.find(l=>l.id===id)||{}).videoId);
  DB.listings = DB.listings.filter(l=>l.id!==id); saveDB(DB); toast('Listing deleted.'); render();
}
function adminToggleVendor(name){
  if(!isAdmin()) return; const t=DB.users[name]; if(!t) return;
  t.vendor = !t.vendor; if(t.vendor){ t.trialEnd=null; t.autopay=true; } saveDB(DB); render();
}
function adminAddPromo(e){
  e.preventDefault(); if(!isAdmin()) return false;
  const code = document.getElementById('pc-code').value.trim().toUpperCase().replace(/\s+/g,'');
  const type = document.getElementById('pc-type').value;
  const value = parseFloat(document.getElementById('pc-val').value);
  if(!code || !(value>0) || (type==='percent' && value>100) || (type==='amount' && value>PLAN.price)){ toast('Enter a code and a valid amount (percent up to 100, or dollars up to $'+PLAN.price+').','err'); return false; }
  if(DB.promos.some(p=>p.code===code)){ toast('That code already exists.','err'); return false; }
  DB.promos.push({code,type,value,active:true,uses:0,created:Date.now()}); saveDB(DB); toast('Code '+code+' created.','ok'); render(); return false;
}
function adminTogglePromo(code){ if(!isAdmin()) return; const p=DB.promos.find(x=>x.code===code); if(p){p.active=!p.active; saveDB(DB); render();} }
function adminDeletePromo(code){ if(!isAdmin()) return; DB.promos=DB.promos.filter(x=>x.code!==code); saveDB(DB); render(); }
function adminSetPassword(e){
  e.preventDefault(); if(!isAdmin()) return false;
  const v = document.getElementById('ap-pass').value;
  if(v.length<6){ toast('Use at least 6 characters.','err'); return false; }
  currentUser().password = v; saveDB(DB); document.getElementById('ap-pass').value=''; toast('Admin password updated.','ok'); return false;
}
function viewAdmin(tab){
  if(!isAdmin()) return view404();
  const users = Object.values(DB.users);
  const tabs = [['users','👥 Users'],['listings','📋 Listings'],['promos','🏷️ Promo Codes'],['ads','📣 Ads'],['stats','📊 Overview']];
  const nav = `<div class="sub-filter" style="padding-top:0;">${tabs.map(([k,l])=>`<a href="#/admin/${k}" class="sub-chip ${tab===k?'active':''}">${l}</a>`).join('')}</div>`;
  let body='';
  if(tab==='users'){
    body = `<div style="overflow-x:auto;"><table class="admin-table"><thead><tr><th>User</th><th>Email</th><th>Location</th><th>Status</th><th>Joined</th><th></th></tr></thead><tbody>${
      users.map(t=>`<tr>
        <td><a href="#/farm/${encodeURIComponent(t.username)}"><b>${escapeHtml(t.username)}</b></a>${t.admin?' <span class="badge">admin</span>':''}</td>
        <td>${escapeHtml(t.email||'')}</td><td>${escapeHtml(t.location||'')}</td>
        <td>${t.blocked?'<span class="badge" style="color:#a14639;">blocked</span>':t.vendor?'<span class="badge vendor">vendor</span>':'member'}</td>
        <td>${fmtDate(t.joined)}</td>
        <td style="white-space:nowrap;">${t.admin?'':`
          <button class="btn btn-ghost btn-sm" onclick="adminToggleVendor('${t.username}')">${t.vendor?'Remove vendor':'Make vendor'}</button>
          <button class="btn btn-ghost btn-sm" onclick="adminToggleBlock('${t.username}')">${t.blocked?'Unblock':'Block'}</button>
          <button class="btn btn-danger btn-sm" onclick="adminDeleteUser('${t.username}')">Delete</button>`}</td></tr>`).join('')}</tbody></table></div>`;
  } else if(tab==='listings'){
    const ls = DB.listings.slice().sort((a,b)=>b.date-a.date);
    body = ls.length ? `<div style="overflow-x:auto;"><table class="admin-table"><thead><tr><th>Title</th><th>Category</th><th>Owner</th><th>Posted</th><th></th></tr></thead><tbody>${
      ls.map(l=>`<tr><td><a href="#/listing/${l.id}">${escapeHtml(l.title)}</a>${l.videoId?' 🎥':''}</td><td>${CATEGORIES[l.category].label}</td><td>${escapeHtml(l.owner)}</td><td>${fmtDate(l.date)}</td>
      <td><button class="btn btn-danger btn-sm" onclick="adminDeleteListing('${l.id}')">Delete</button></td></tr>`).join('')}</tbody></table></div>` : '<p>No listings.</p>';
  } else if(tab==='ads'){
    body = `<form onsubmit="return adminAddAd(event)" class="form-card wide" style="margin:0 0 20px;">
      <h3>Create an ad</h3>
      <div class="field"><label for="ad-title">Title <span class="hint" style="font-weight:400;">(also the image alt text)</span></label><input id="ad-title" required maxlength="80"></div>
      <div class="field"><label>Image</label><div id="adPrev"></div>
        <label class="btn btn-outline btn-sm" style="cursor:pointer;"><input type="file" accept="image/*" onchange="handleAdImage(this)" hidden>Choose Image</label>
        <div class="hint">Wide banners (about 3:1) look best. Any size works — it scales to fit the screen.</div></div>
      <div class="field"><label for="ad-link">Link</label><input id="ad-link" required placeholder="https://"></div>
      <div class="field-row">
        <div class="field"><label for="ad-place">Placement</label><select id="ad-place">${Object.entries(AD_PLACEMENTS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div>
        <div class="field"><label for="ad-size">Size</label><select id="ad-size"><option value="small">Small</option><option value="medium" selected>Medium</option><option value="large">Large</option></select></div>
      </div>
      <button class="btn btn-primary" type="submit">Create Ad</button></form>
      ${DB.ads.length ? `<div style="overflow-x:auto;"><table class="admin-table"><thead><tr><th>Ad</th><th>Placement</th><th>Size</th><th>Views</th><th>Clicks</th><th>Status</th><th></th></tr></thead><tbody>${DB.ads.map(a=>`<tr>
        <td><img src="${a.image}" alt="" style="height:36px;border-radius:6px;vertical-align:middle;"> ${escapeHtml(a.title)}</td><td>${AD_PLACEMENTS[a.placement]}</td>
        <td><select onchange="adminSetAdSize('${a.id}',this.value)">${Object.keys(AD_SIZES).map(k=>`<option value="${k}" ${a.size===k?'selected':''}>${k}</option>`).join('')}</select></td>
        <td>${a.views||0}</td><td>${a.clicks||0}</td><td>${a.active?'live':'paused'}</td>
        <td style="white-space:nowrap;"><button class="btn btn-ghost btn-sm" onclick="adminToggleAd('${a.id}')">${a.active?'Pause':'Activate'}</button> <button class="btn btn-danger btn-sm" onclick="adminDeleteAd('${a.id}')">Delete</button></td></tr>`).join('')}</tbody></table></div>` : '<p>No ads yet.</p>'}`;
  } else if(tab==='promos'){
    body = `<form onsubmit="return adminAddPromo(event)" class="form-card wide" style="margin:0 0 20px;">
      <h3>Create a promo code</h3>
      <div class="field-row">
        <div class="field"><label for="pc-code">Code</label><input id="pc-code" placeholder="e.g. HARVEST25" required></div>
        <div class="field"><label for="pc-type">Type</label><select id="pc-type"><option value="percent">Percent off</option><option value="amount">Dollar off</option></select></div>
        <div class="field"><label for="pc-val">Value</label><input id="pc-val" type="number" step="0.01" min="0.01" required></div>
      </div>
      <button class="btn btn-primary" type="submit">Create Code</button>
      <p class="hint" style="margin-top:10px;">Applies to the $${PLAN.price}/month vendor plan. Next step when Stripe is live: mirror each code as a Stripe coupon.</p></form>
      ${DB.promos.length ? `<table class="admin-table"><thead><tr><th>Code</th><th>Discount</th><th>Used</th><th>Status</th><th></th></tr></thead><tbody>${DB.promos.map(x=>`<tr><td><b>${escapeHtml(x.code)}</b></td><td>${x.type==='percent'?x.value+'% off':'$'+x.value.toFixed(2)+' off'}</td><td>${x.uses||0}</td><td>${x.active?'active':'paused'}</td>
        <td><button class="btn btn-ghost btn-sm" onclick="adminTogglePromo('${x.code}')">${x.active?'Pause':'Activate'}</button> <button class="btn btn-danger btn-sm" onclick="adminDeletePromo('${x.code}')">Delete</button></td></tr>`).join('')}</tbody></table>` : '<p>No codes yet.</p>'}`;
  } else {
    const vendors = users.filter(t=>t.vendor).length, trials = users.filter(t=>t.vendor&&t.trialEnd&&!t.autopay&&Date.now()<t.trialEnd).length, paying = users.filter(t=>t.vendor&&t.autopay).length;
    const stat=(n,l)=>`<div class="perk-card"><h2 style="margin:0;">${n}</h2><p style="margin:0;">${l}</p></div>`;
    body = `<div class="vendor-perks" style="margin-top:0;">${stat(users.length,'Accounts')}${stat(DB.listings.length,'Listings')}${stat(vendors,'Vendors')}${stat(trials,'In free trial')}${stat(paying,'On autopay')}${stat(users.filter(t=>t.blocked).length,'Blocked')}</div>
`;
  }
  return `<section class="page-hero"><div class="wrap"><div><div class="breadcrumb"><a href="#/home">Home</a> / Admin</div><h1>Admin</h1><p>View, block or delete accounts, moderate listings, and manage promo codes.</p></div></div></section>
  <section style="padding-top:28px;"><div class="wrap">${nav}<div style="margin-top:18px;">${body}</div></div></section>`;
}

/* ---------------- CATEGORY ---------------- */
function viewCategory(key, sub){
  const c = CATEGORIES[key];
  const activeSub = sub ? decodeURIComponent(sub) : null;
  let listings = DB.listings.filter(l=>l.category===key);
  if(activeSub) listings = listings.filter(l=>l.sub===activeSub);
  listings = listings.slice().sort((a,b)=>b.date-a.date);

  const subChips = c.subs.length ? `
    <div class="sub-filter">
      <a href="#/category/${key}" class="sub-chip ${!activeSub?'active':''}">All</a>
      ${c.subs.map(s=>`<a href="#/category/${key}/${encodeURIComponent(s)}" class="sub-chip ${activeSub===s?'active':''}">${s}</a>`).join('')}
    </div>` : '';

  const cards = listings.map(listingCard).join('');
  const empty = `
    <div class="empty-state">
      <div class="em-icon">${c.icon}</div>
      <h3>No listings here yet</h3>
      <p>Be the first to post in ${c.label}${activeSub ? ' → '+activeSub : ''}.</p>
      <a href="#/post/${key}" class="btn btn-primary">Post the First Listing</a>
    </div>`;

  return `
  <section class="page-hero">
    <div class="wrap">
      <div>
        <div class="breadcrumb"><a href="#/home">Home</a> / Marketplace / ${c.label}</div>
        <h1>${c.icon} ${c.label}</h1>
        <p>${c.desc}</p>
      </div>
      <a href="#/post/${key}" class="btn btn-cyan">+ Post in ${c.label}</a>
    </div>
  </section>
  <section style="padding-top:0;">
    <div class="wrap">
      ${adsHtml('category')}
      ${subChips}
      <div class="listing-toolbar">
        <div class="listing-count mono">${listings.length} listing${listings.length===1?'':'s'}${activeSub ? ' in '+activeSub : ''}</div>
      </div>
      ${listings.length ? `<div class="listing-grid">${gridWithAds(listings)}</div>` : empty}
    </div>
  </section>`;
}

function listingCard(l){
  const priceLabel = l.free ? 'FREE' : (l.price ? l.price : 'Call for price');
  const hasPhoto = l.photos && l.photos.length;
  return `
  <a href="#/listing/${l.id}" class="listing-card">
    <div class="listing-thumb" style="background-image:url('${hasPhoto ? l.photos[0] : (CAT_PHOTOS[l.category]||'')}');background-size:cover;background-position:center;font-size:0;">
      <span class="price-tag ${l.free?'free':''}">${escapeHtml(priceLabel)}</span>
      ${hasPhoto && l.photos.length>1 ? `<span class="photo-count-badge">📷 ${l.photos.length}</span>` : ''}${l.videoId ? `<span class="photo-count-badge" style="top:10px;bottom:auto;">🎥 Video</span>` : ''}
    </div>
    <div class="listing-body">
      <h4>${escapeHtml(l.title)}</h4>
      <div class="listing-meta"><span>📍 ${escapeHtml(l.location||'Location n/a')}</span><span>${fmtDate(l.date)}</span></div>
      <p>${escapeHtml(l.desc)}</p>
      <div class="listing-foot">
        <span class="feat-price">${escapeHtml(priceLabel)}</span>
        <span class="badge-sale">${l.free?'Free':(l.category==='farmhand'?'Hiring':(l.category==='events'?'Event':'For Sale'))}</span>
      </div>
    </div>
  </a>`;
}

/* ---------------- LISTING DETAIL ---------------- */
function viewListingDetail(id){
  const l = DB.listings.find(x=>x.id===id);
  if(!l) return view404();
  const c = CATEGORIES[l.category];
  const u = currentUser();
  const isOwner = u && u.username === l.owner;
  const priceLabel = l.free ? 'FREE' : (l.price ? l.price : 'Call for price');
  const owner = DB.users[l.owner];

  const photos = l.photos && l.photos.length ? l.photos : null;

  const galleryHtml = photos ? `
    <div class="gallery-main" id="galleryMain" style="background-image:url('${photos[0]}');">
      <span class="price-tag ${l.free?'free':''}" style="font-size:.9rem;padding:6px 14px;">${escapeHtml(priceLabel)}</span>
    </div>
    ${photos.length>1 ? `
      <div class="gallery-strip">
        ${photos.map((p,i)=>`<div class="gallery-thumb ${i===0?'active':''}" style="background-image:url('${p}');" onclick="setMainPhoto(${i}, this)"></div>`).join('')}
      </div>` : ''}
  ` : `
    <div class="listing-thumb" style="height:220px;border-radius:14px;border:1px solid var(--line);font-size:5rem;">
      ${l.icon || c.icon}
      <span class="price-tag ${l.free?'free':''}" style="font-size:.9rem;padding:6px 14px;">${escapeHtml(priceLabel)}</span>
    </div>
  `;

  return `
  <section class="page-hero">
    <div class="wrap">
      <div>
        <div class="breadcrumb"><a href="#/home">Home</a> / <a href="#/category/${l.category}">${c.label}</a> / ${escapeHtml(l.title)}</div>
        <h1>${escapeHtml(l.title)}</h1>
        <p>📍 ${escapeHtml(l.location||'Location n/a')} · Posted ${fmtDate(l.date)}</p>
      </div>
    </div>
  </section>
  <section style="padding-top:36px;">
    <div class="wrap" style="display:grid;grid-template-columns:1.3fr .8fr;gap:30px;align-items:start;">
      <div>
        ${galleryHtml}
        <div id="listingVideoWrap"></div>
        <div style="margin-top:22px;">
          <h3>Details</h3>
          <p style="white-space:pre-wrap;">${escapeHtml(l.desc)}</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
            <span class="chip">${escapeHtml(c.label)}</span>
            ${l.sub ? `<span class="chip">${escapeHtml(l.sub)}</span>` : ''}
          </div>
        </div>
      </div>
      <div class="form-card">
        ${avatarHtml(l.owner)}
        <h3 style="margin-bottom:2px;"><a href="#/farm/${encodeURIComponent(l.owner)}">${escapeHtml(owner&&owner.farmName||l.owner)}</a></h3>
        ${owner && owner.vendor ? `<span class="badge vendor">✓ Verified</span>` : ''}
        <p style="margin:6px 0;"><a href="#/farm/${encodeURIComponent(l.owner)}" style="color:var(--pine-2);font-weight:600;font-size:.85rem;">Visit storefront →</a></p>
        ${owner ? `<p class="field hint">Member since ${fmtDate(owner.joined)} · ${escapeHtml(owner.location||'')}</p>` : ''}
        <p style="font-size:.85rem;"><b>Contact preference:</b> ${escapeHtml(l.contact||'Message on site')}</p>
        ${isOwner ? `
          <a href="#/edit/${l.id}" class="btn btn-outline btn-block" style="margin-bottom:8px;">Edit Listing</a>
          <button class="btn btn-danger btn-block" onclick="deleteListing('${l.id}')">Delete Listing</button>
          ${!u.vendor ? `<div class="hint" style="text-align:center;margin-top:10px;">Want a Buy Now button here? <a href="#/vendor">Start your free trial — 30 days →</a></div>` : ''}
        ` : `
          ${l.payLink && owner && owner.vendor ? `<a href="${escapeHtml(l.payLink)}" target="_blank" rel="noopener noreferrer" class="btn btn-cyan btn-block" style="margin-bottom:8px;">💳 Buy Now</a>` : ''}
          ${u ? `
            <button class="btn btn-primary btn-block" onclick="startConversation('${l.owner}')">💬 Message Seller</button>
          ` : `
            <a href="#/login" class="btn btn-primary btn-block">Log In to Message Seller</a>
          `}
        `}
        ${l.payLink && owner && owner.vendor && !isOwner ? `<div class="hint" style="text-align:center;margin-top:10px;">Buy Now opens the seller's own payment link — let-us.farm doesn't process the payment.</div>` : ''}
        ${adsHtml('listing')}
      </div>
    </div>
  </section>`;
}

function setMainPhoto(idx, thumbEl){
  const l = DB.listings.find(x=>x.id===parseHash()[1]);
  if(!l || !l.photos) return;
  document.getElementById('galleryMain').style.backgroundImage = `url('${l.photos[idx]}')`;
  document.querySelectorAll('.gallery-thumb').forEach(t=>t.classList.remove('active'));
  thumbEl.classList.add('active');
}

function deleteListing(id){
  if(!confirm('Delete this listing? This cannot be undone.')) return;
  vidDel((DB.listings.find(l=>l.id===id)||{}).videoId);
  DB.listings = DB.listings.filter(l=>l.id!==id);
  saveDB(DB);
  toast('Listing deleted.');
  go('#/profile/listings');
}

/* ---------------- POST / EDIT FORM ---------------- */
function viewPostForm(categoryKey, editId){
  const u = currentUser();
  if(!u){
    return `
    <section class="center-page">
      <div class="wrap">
        <div class="form-card text-center">
          <div class="eyebrow">Log In Required</div>
          <h2>Log in to post a listing</h2>
          <p>Create a free account or log in to post to the market.</p>
          <a href="#/login" class="btn btn-primary btn-block" style="margin-bottom:10px;">Log In</a>
          <a href="#/signup" class="btn btn-outline btn-block">Sign Up</a>
        </div>
      </div>
    </section>`;
  }

  let editing = null;
  if(editId){
    editing = DB.listings.find(l=>l.id===editId);
    if(!editing || editing.owner !== u.username) return view404();
    categoryKey = editing.category;
  }

  const catOptions = CAT_ORDER.map(k=>`<option value="${k}" ${categoryKey===k?'selected':''}>${CATEGORIES[k].icon} ${CATEGORIES[k].label}</option>`).join('');
  const c = CATEGORIES[categoryKey] || CATEGORIES.produce;
  const isFreeCat = categoryKey === 'free' || categoryKey === 'freefood';

  return `
  <section class="center-page">
    <div class="wrap">
      <div class="form-card wide">
        <div class="eyebrow">${editing ? 'Edit Listing' : 'New Listing'}</div>
        <h2>${editing ? 'Update your listing' : 'Post to the market'}</h2>
        <div class="form-alert err" id="postAlert"></div>
        <form onsubmit="return doPost(event, ${editing ? `'${editing.id}'` : 'null'})">
          <div class="field-row">
            <div class="field">
              <label for="p-cat">Category</label>
              <select id="p-cat" onchange="refreshSubOptions()">${catOptions}</select>
            </div>
            <div class="field">
              <label for="p-sub">Subcategory</label>
              <select id="p-sub"></select>
            </div>
          </div>
          <div class="field">
            <label>Photos <span class="hint" id="photoCount" style="font-weight:400;">(${(editing&&editing.photos?editing.photos.length:0)} / 6 photos)</span></label>
            <div class="photo-grid" id="photoPreview"></div>
            <div class="hint">Up to 6 photos. Stored right on this device along with the rest of the listing.</div>
          </div>
          <div class="field">
            <label>Video <span class="hint" style="font-weight:400;">(optional · 1 video, up to ${VIDEO_MAX_SEC}s / ${VIDEO_MAX_MB} MB)</span></label>
            <div id="videoPreview"></div>
            <label class="btn btn-outline btn-sm" style="cursor:pointer;"><input type="file" accept="video/*" onchange="handleVideoSelect(this)" hidden>🎥 Choose Video</label>
          </div>
          <div class="field">
            <label for="p-title">Title</label>
            <input type="text" id="p-title" required maxlength="70" value="${editing?escapeHtml(editing.title):''}" placeholder="e.g. Nubian Goat Kids, wormed & tagged">
          </div>
          <div class="field">
            <label for="p-desc">Description</label>
            <textarea id="p-desc" required maxlength="900" placeholder="Tell buyers what they need to know">${editing?escapeHtml(editing.desc):''}</textarea>
          </div>
          <div class="field-row">
            <div class="field">
              <label for="p-price">Price ${isFreeCat ? '(leave blank — this category is free)' : '(or say "Call for price")'}</label>
              <input type="text" id="p-price" ${isFreeCat?'disabled':''} value="${editing&&!editing.free?escapeHtml(editing.price||''):''}" placeholder="e.g. 25 each, or 10/box">
            </div>
            <div class="field">
              <label for="p-location">Location</label>
              <input type="text" id="p-location" required value="${editing?escapeHtml(editing.location||''):escapeHtml(u.location||'')}" placeholder="County / City, State">
            </div>
          </div>
          <div class="field">
            <label for="p-contact">Preferred contact</label>
            <input type="text" id="p-contact" value="${editing?escapeHtml(editing.contact||''):'Message on site'}" placeholder="e.g. Message on site, or call after 5pm">
          </div>
          <div class="field">
            <label for="p-icon">Listing emoji (optional)</label>
            <input type="text" id="p-icon" maxlength="4" value="${editing?escapeHtml(editing.icon||''):''}" placeholder="🐐 🍅 🚜 ...">
            <div class="hint">Shown when there's no photo yet. Leave blank to use the category icon.</div>
          </div>
          <div class="field">
            <label for="p-paylink">Buy Now link ${u.vendor ? '(optional)' : ''}</label>
            ${u.vendor ? `
              <input type="text" id="p-paylink" value="${editing?escapeHtml(editing.payLink||''):''}" placeholder="e.g. your PayPal.me, Venmo, or Cash App link">
              <div class="hint">Adds a "Buy Now" button that sends buyers straight to your own payment link. Leave blank to sell by message only.</div>
            ` : `
              <input type="text" id="p-paylink" value="" placeholder="Verified vendors only" disabled>
              <div class="hint">Only verified vendors can accept payments through the site. <a href="#/vendor">Start your free trial — 30 days →</a></div>
            `}
          </div>
          <button class="btn btn-primary btn-block" type="submit">${editing ? 'Save Changes' : 'Post Listing'}</button>
        </form>
      </div>
    </div>
  </section>
  `;
}

function refreshSubOptions(preselect){
  const catSel = document.getElementById('p-cat');
  const subSel = document.getElementById('p-sub');
  if(!catSel || !subSel) return;
  const c = CATEGORIES[catSel.value];
  if(!c.subs.length){
    subSel.innerHTML = '<option value="">General</option>';
    subSel.disabled = true;
  } else {
    subSel.disabled = false;
    subSel.innerHTML = c.subs.map(s=>`<option value="${s}" ${preselect===s?'selected':''}>${s}</option>`).join('');
  }
}

function doPost(e, editId){
  e.preventDefault();
  const old = editId ? (DB.listings.find(x=>x.id===editId)||{}).videoId : null;
  const f = PENDING_VIDEO.file;
  if(f){
    const nid = 'vid_'+uid();
    const btn = e.target.querySelector('button[type=submit]'); if(btn){ btn.disabled = true; btn.textContent = 'Saving video…'; }
    vidPut(nid, f).then(()=>{ vidDel(old); doPostCore(null, editId, nid); })
      .catch(()=>{ if(btn){btn.disabled=false;btn.textContent='Save';} toast("Couldn't save the video on this device — storage may be full.",'err'); });
  } else if(PENDING_VIDEO.keep){
    doPostCore(null, editId, PENDING_VIDEO.keep);
  } else {
    vidDel(old); doPostCore(null, editId, '');
  }
  return false;
}
function doPostCore(e, editId, videoId){
  const u = currentUser();
  const category = document.getElementById('p-cat').value;
  const sub = document.getElementById('p-sub').value;
  const title = document.getElementById('p-title').value.trim();
  const desc = document.getElementById('p-desc').value.trim();
  const priceRaw = document.getElementById('p-price').value.trim();
  const location = document.getElementById('p-location').value.trim();
  const contact = document.getElementById('p-contact').value.trim() || 'Message on site';
  const icon = document.getElementById('p-icon').value.trim();
  let payLink = document.getElementById('p-paylink').value.trim();
  const isFreeCat = category === 'free' || category === 'freefood';
  const alertEl = document.getElementById('postAlert');

  if(!title || !desc || !location){
    alertEl.textContent = 'Please fill in the title, description, and location.';
    alertEl.className = 'form-alert err show';
    return false;
  }
  if(payLink && !/^https?:\/\//i.test(payLink)) payLink = 'https://' + payLink;
  const photos = PENDING_PHOTOS.slice(0,6);

  if(editId){
    const l = DB.listings.find(x=>x.id===editId);
    Object.assign(l, {videoId, category, sub, title, desc, location, contact, icon, payLink, photos, price: isFreeCat?'':priceRaw, free: isFreeCat});
    if(saveDB(DB)){
      toast('Listing updated.', 'ok');
      go('#/listing/'+editId);
    }
  } else {
    const listing = {
      id: uid(), videoId, category, sub, title, desc, location, contact, icon, payLink, photos,
      price: isFreeCat ? '' : priceRaw, free: isFreeCat,
      owner: u.username, date: Date.now()
    };
    DB.listings.push(listing);
    if(saveDB(DB)){
      toast('Listing posted!', 'ok');
      go('#/listing/'+listing.id);
    } else {
      DB.listings.pop();
    }
  }
  return false;
}

/* ---------------- PROFILE ---------------- */
function viewProfile(tab){
  const u = currentUser();
  if(!u){
    return `
    <section class="center-page"><div class="wrap"><div class="form-card text-center">
      <h2>Log in to view your profile</h2>
      <a href="#/login" class="btn btn-primary btn-block">Log In</a>
    </div></div></section>`;
  }
  const myListings = DB.listings.filter(l=>l.owner===u.username).sort((a,b)=>b.date-a.date);

  const myFollowers = (DB.follows||[]).filter(f=>f.to===u.username).length;
  const myReviews = (DB.reviews||[]).filter(r=>r.to===u.username).length;
  let content = '';
  if(tab === 'plan'){
    content = planTabHtml(u);
  } else if(tab === 'info'){
    content = `
      <div class="form-alert ok" id="infoAlert"></div>
      <form onsubmit="return saveProfileInfo(event)">
        <div class="vp-card dash-card">
          <h3>Profile Picture</h3>
          <div class="avatar-row2">
            <div id="avatarPreview"></div>
            <div style="display:flex;flex-direction:column;gap:8px;">
              <label class="btn btn-outline btn-sm" style="cursor:pointer;"><input type="file" accept="image/*" onchange="handleAvatarSelect(this)" hidden>Choose Photo</label>
              ${u.avatar ? `<button type="button" class="btn btn-ghost btn-sm" onclick="removePendingAvatar()">Remove Photo</button>` : ''}
              <span class="hint">Upload a square photo.</span>
            </div>
          </div>
        </div>
        <div class="vp-card dash-card">
          <h3>Cover Photo</h3>
          <div id="coverPreview" class="vp-cover-prev" style="${u.cover?`background-image:url('${u.cover}');`:''}"></div>
          <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
            <label class="btn btn-outline btn-sm" style="cursor:pointer;"><input type="file" accept="image/*" onchange="handleCoverSelect(this)" hidden>Upload cover photo</label>
            ${u.cover?'<button type="button" class="btn btn-ghost btn-sm" onclick="PENDING_COVER=\'\';document.getElementById(\'coverPreview\').style.backgroundImage=\'none\'">Remove cover photo</button>':''}
          </div>
          <span class="hint">Upload a wide banner photo.</span>
        </div>
        <div class="vp-card dash-card">
          <h3>Profile Details</h3>
          <div class="field"><label>Username</label><input type="text" value="${escapeHtml(u.username)}" disabled></div>
          <div class="field"><label for="pi-farm">Farm / business name</label><input type="text" id="pi-farm" maxlength="60" value="${escapeHtml(u.farmName||'')}"></div>
          <div class="field"><label for="pi-tag">Short bio / tagline</label><input type="text" id="pi-tag" maxlength="90" value="${escapeHtml(u.tagline||'')}" placeholder="e.g. Third-generation family farm"></div>
          <div class="field"><label for="pi-bio">Description</label><textarea id="pi-bio" placeholder="Tell the market about your farm or what you're after">${escapeHtml(u.bio||'')}</textarea></div>
          <div class="field"><label for="pi-location">Location</label><input type="text" id="pi-location" value="${escapeHtml(u.location||'')}" required></div>
          <div class="field"><label for="pi-email">Contact (email)</label><input type="email" id="pi-email" value="${escapeHtml(u.email||'')}" required></div>
          <div class="field"><label for="pi-ful">Where you sell</label>
            <select id="pi-ful">
              <option value="onfarm" ${u.fulfillment==='onfarm'?'selected':''}>On-farm pickup</option>
              <option value="offfarm" ${u.fulfillment==='offfarm'?'selected':''}>Off-farm / delivery / markets</option>
              <option value="both" ${(u.fulfillment==='both'||!u.fulfillment)?'selected':''}>Both</option>
            </select></div>
          <button class="btn btn-primary btn-block" type="submit">Save Changes</button>
          <p class="hint" style="margin:10px 0 0;text-align:center;"><a href="#/farm/${encodeURIComponent(u.username)}" style="color:var(--forest);font-weight:700;">Preview how customers see my profile →</a></p>
        </div>
      </form>`;
  } else {
    content = `
      <div class="section-head">
        <h3 class="mt-0">My Listings</h3>
        <a href="#/post/produce" class="btn btn-cyan btn-sm">+ New Listing</a>
      </div>
      ${myListings.length ? myListings.map(l=>`
        <div class="my-listing-row">
          <div class="lr-icon">${l.icon || CATEGORIES[l.category].icon}</div>
          <div class="lr-info">
            <h5>${escapeHtml(l.title)}</h5>
            <span>${CATEGORIES[l.category].label}${l.sub?' · '+l.sub:''} · ${l.free?'FREE':(l.price||'Call for price')} · ${fmtDate(l.date)}</span>
          </div>
          <div class="lr-actions">
            <a href="#/listing/${l.id}" class="btn btn-ghost btn-sm">View</a>
            <a href="#/edit/${l.id}" class="btn btn-ghost btn-sm">Edit</a>
            <button class="btn btn-danger btn-sm" onclick="deleteListing('${l.id}')">Delete</button>
          </div>
        </div>
      `).join('') : `
        <div class="empty-state">
          <div class="em-icon">📋</div>
          <h3>No listings yet</h3>
          <p>Post your first item, animal, or job to the market.</p>
          <a href="#/post/produce" class="btn btn-primary">Post a Listing</a>
        </div>`}
    `;
  }

  const name = u.farmName || u.username;
  const pic = u.avatar ? `<div class="vp-pic" style="background-image:url('${u.avatar}')"></div>` : `<div class="vp-pic">${escapeHtml(initials(u.username))}</div>`;
  const trial = (u.vendor && u.trialEnd && !u.autopay && Date.now()<u.trialEnd) ? ` · ${Math.ceil((u.trialEnd-Date.now())/86400000)} days of trial left` : '';
  const tabsP = [['listings','📋 My Listings','#/profile/listings'],['info','⚙️ Account Info','#/profile/info'],['plan','💳 Plan & Payouts','#/profile/plan'],['msg','💬 Messages','#/messages']];
  if(u.admin) tabsP.push(['admin','🛠️ Admin','#/admin']);
  return `
  <div class="vp">
    <div class="vp-cover" ${u.cover?`style="background-image:url('${u.cover}')"`:''}>
      <button class="vp-back" onclick="go('#/home')">← Back</button>
    </div>
    <div class="wrap">
      <div class="vp-head">
        ${pic}
        <div class="vp-id">
          <h1>${escapeHtml(name)} ${u.vendor?'<span class="badge vendor" style="vertical-align:middle;">✓ Verified</span>':''}</h1>
          <div class="vp-handle">@${escapeHtml(String(u.username).toLowerCase().replace(/[^a-z0-9]+/g,''))}</div>
        </div>
      </div>
      <div class="vp-chips">
        <span class="chip">${u.vendor?'Vendor'+trial:'Member'}</span>
        <span class="chip">📍 ${escapeHtml(u.location||'Location n/a')}</span>
      </div>
      <div class="vp-btns">
        <a class="btn btn-primary" href="#/profile/info">✏️ Edit My Profile</a>
        <a class="btn btn-ghost" href="#/farm/${encodeURIComponent(u.username)}">👤 View Public Profile</a>
        <a class="btn btn-ghost" href="#/post/produce">＋ New Listing</a>
        ${!u.vendor ? `<button class="btn btn-cyan" onclick="becomeVendor()">🏷️ Start Free Trial</button>` : ''}
        <button class="btn btn-danger" onclick="logout()">🚪 Log Out</button>
      </div>
      <div class="vp-stats">
        <div><b>${myFollowers}</b><span>Followers</span></div>
        <div><b>${myListings.length}</b><span>Listings</span></div>
        <div><b>${myReviews}</b><span>Reviews</span></div>
      </div>
      <div class="vp-tabs">${tabsP.map(x=>`<button class="vp-tab${(x[0]===tab||(tab==='listings'&&x[0]==='listings'))?' active':''}" onclick="go('${x[2]}')">${x[1]}</button>`).join('')}</div>
      ${tab==='info' ? content : `<div class="vp-card dash-card">${content}</div>`}
    </div>
  </div>`;
}

function saveProfileInfo(e){
  e.preventDefault();
  const u = currentUser();
  u.email = document.getElementById('pi-email').value.trim();
  u.location = document.getElementById('pi-location').value.trim();
  u.bio = document.getElementById('pi-bio').value.trim();
  u.avatar = PENDING_AVATAR || '';
  u.farmName = document.getElementById('pi-farm').value.trim();
  u.tagline = document.getElementById('pi-tag').value.trim();
  u.fulfillment = document.getElementById('pi-ful').value;
  if(PENDING_COVER !== null) u.cover = PENDING_COVER;
  PENDING_COVER = null;
  if(saveDB(DB)){
    const el = document.getElementById('infoAlert');
    el.textContent = 'Saved.';
    el.className = 'form-alert ok show';
    toast('Account updated.', 'ok');
    render();
  }
}

/* ---------------- MESSAGES ---------------- */
function convoKey(a,b){ return [a,b].sort().join('|'); }

function startConversation(otherUser){
  const u = currentUser();
  if(!u) { go('#/login'); return; }
  const key = convoKey(u.username, otherUser);
  if(!DB.messages[key]) DB.messages[key] = [];
  saveDB(DB);
  go('#/messages/'+encodeURIComponent(otherUser));
}

function viewMessages(otherUserEnc){
  const u = currentUser();
  if(!u){
    return `<section class="center-page"><div class="wrap"><div class="form-card text-center">
      <h2>Log in to view messages</h2>
      <a href="#/login" class="btn btn-primary btn-block">Log In</a>
    </div></div></section>`;
  }
  const otherUser = otherUserEnc ? decodeURIComponent(otherUserEnc) : null;

  // gather conversations involving this user
  const convos = Object.keys(DB.messages)
    .filter(k=>k.split('|').includes(u.username))
    .map(k=>{
      const other = k.split('|').find(n=>n!==u.username) || k.split('|')[0];
      const thread = DB.messages[k];
      const last = thread[thread.length-1];
      return {key:k, other, last};
    })
    .sort((a,b)=> (b.last?b.last.date:0) - (a.last?a.last.date:0));

  const listHtml = convos.length ? convos.map(c=>`
    <div class="msg-list-item ${otherUser===c.other?'active':''}" onclick="go('#/messages/${encodeURIComponent(c.other)}')">
      ${avatarHtml(c.other, 'mini-avatar')}
      <div style="min-width:0;">
        <b>${escapeHtml(c.other)}</b>
        <span>${c.last ? escapeHtml(c.last.text) : 'Say hello'}</span>
      </div>
    </div>
  `).join('') : `<div style="padding:20px;font-size:.85rem;color:var(--ink-soft);">No conversations yet. Message a seller from any listing to start one.</div>`;

  let paneHtml = `<div class="msg-empty"><div style="font-size:2rem;">💬</div><p>Pick a conversation, or visit a listing and tap "Message Seller."</p></div>`;
  if(otherUser){
    const key = convoKey(u.username, otherUser);
    const thread = DB.messages[key] || [];
    const bubbles = thread.map(m=>`
      <div class="bubble ${m.from===u.username?'me':'them'}">
        ${escapeHtml(m.text)}
        <time>${escapeHtml(m.from)} · ${fmtTime(m.date)} · ${fmtDate(m.date)}</time>
      </div>
    `).join('') || `<div class="msg-empty"><p>No messages yet — say hello to ${escapeHtml(otherUser)}.</p></div>`;

    paneHtml = `
      <div class="msg-pane-head">${escapeHtml(otherUser)}</div>
      <div class="msg-thread" id="msgThread">${bubbles}</div>
      <form class="msg-input-row" onsubmit="return sendMessage(event, '${escapeHtml(otherUser).replace(/'/g,"\\'")}')">
        <input type="text" id="msgInput" placeholder="Type a message..." autocomplete="off" required>
        <button class="btn btn-primary" type="submit">Send</button>
      </form>
    `;
  }

  return `
  <section class="page-hero">
    <div class="wrap"><div><div class="breadcrumb"><a href="#/home">Home</a> / Messages</div><h1>Messages</h1><p>Direct messages stay between you and the other member — no public replies.</p></div></div>
  </section>
  <section>
    <div class="wrap">
      <div class="msg-shell">
        <div class="msg-list">${listHtml}</div>
        <div class="msg-pane">${paneHtml}</div>
      </div>
    </div>
  </section>`;
}

function sendMessage(e, otherUser){
  e.preventDefault();
  const u = currentUser();
  const input = document.getElementById('msgInput');
  const text = input.value.trim();
  if(!text) return false;
  const key = convoKey(u.username, otherUser);
  if(!DB.messages[key]) DB.messages[key] = [];
  DB.messages[key].push({from:u.username, to:otherUser, text, date:Date.now()});
  saveDB(DB);
  input.value = '';
  render();
  // re-focus and scroll thread to bottom after re-render
  setTimeout(()=>{
    const t = document.getElementById('msgThread');
    if(t) t.scrollTop = t.scrollHeight;
    const i = document.getElementById('msgInput');
    if(i) i.focus();
  }, 0);
  return false;
}

/* ---------------- 404 ---------------- */
function view404(){
  return `
  <section class="center-page">
    <div class="wrap text-center">
      <div class="empty-state" style="max-width:480px;margin:0 auto;">
        <div class="em-icon">🌾</div>
        <h3>That page grew somewhere else</h3>
        <p>We couldn't find what you're looking for.</p>
        <a href="#/home" class="btn btn-primary">Back to Home</a>
      </div>
    </div>
  </section>`;
}
