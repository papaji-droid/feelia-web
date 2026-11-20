
(()=>{
"use strict";
/* FREE.A: mã chạy trang bán hàng và trang quản trị (#quan-tri).
   Dữ liệu cửa hàng nằm ở khối script id="store" đầu trang, mỗi sản phẩm một dòng.
   Ảnh bìa và logo nằm ở khối id="media" cuối trang. Ảnh sản phẩm nằm trong kho ảnh của trang (/_blob/<id>).
   Trang quản trị ghi lại cả trang khi bấm Lưu. */

/* ---------- tiện ích ---------- */
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const money=n=>(+n||0).toLocaleString("vi-VN")+"₫";
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>"&#"+c.charCodeAt(0)+";");
const hex=c=>/^#[0-9a-f]{6}$/i.test(c||"")?c:"#b9a58f";
const web=u=>/^https:\/\/[^\s"'<>]+$/i.test(u||"")?u:"";
const okImg=s=>typeof s==="string"&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/.test(s);
const norm=s=>String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d");
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function box(n){let S=null;try{S=window[n]}catch(e){}
  return{get(k,d){try{const v=JSON.parse(S.getItem(k));return v==null?d:v}catch(e){return d}},
         set(k,v){try{S.setItem(k,JSON.stringify(v));return true}catch(e){return false}},
         del(k){try{S.removeItem(k)}catch(e){}}}}
const ls=box("localStorage"),ss=box("sessionStorage");
const use=n=>{try{return window.claude&&window.claude.use?Promise.resolve(window.claude.use(n)).catch(()=>null):Promise.resolve(null)}catch(e){return Promise.resolve(null)}};
let tt;function toast(m){const t=$("#toast");t.textContent=m;t.classList.add("on");clearTimeout(tt);tt=setTimeout(()=>t.classList.remove("on"),2800)}

/* ---------- hằng số ---------- */
const FONTS="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600&family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&display=swap";
/* cân nặng từ, đến (kg), ngực, eo, mông (cm) */
const SIZES={S:[40,47,"80–84","62–66","86–90"],M:[48,53,"84–88","66–70","90–94"],L:[54,59,"88–92","70–74","94–98"],XL:[60,66,"92–96","74–78","98–102"]};
const SIZE_OPTS=["S","M","L","XL","XXL","Freesize"];
const CAT_ORDER=["Váy","Áo","Quần","Chân váy","Set"];
const SHAPE_N={dress:"Váy liền",top:"Áo",pants:"Quần",skirt:"Chân váy",set:"Set hai món"};
const PAT_N={"":"Trơn",dots:"Chấm bi",stripe:"Kẻ sọc",check:"Caro"};
const QUICK=["Tư vấn size","Phí giao hàng","Đổi trả","Thanh toán","Mã giảm giá","Tra đơn của tôi","Gặp nhân viên"];
const MAX_PH=8,PAGE=24,APAGE=50;
const SH={dress:"M72 48C82 58 118 58 128 48L152 64 142 86 128 80 126 114 158 230Q100 246 42 230L74 114 72 80 58 86 48 64Z",top:"M70 48C80 60 120 60 130 48L168 72 156 102 134 92 136 172Q100 180 64 172L66 92 44 102 32 72Z",pants:"M62 50H138L152 232H106L100 100 94 232H48Z",skirt:"M70 50H130L162 196Q100 212 38 196Z",blazer:"M70 48L100 84 130 48 168 72 156 106 136 96 138 152H62L64 96 44 106 32 72Z"};
const DT={dress:'<path class="dt" d="M74 114Q100 122 126 114"/>',top:'<path class="dt" d="M100 58V176"/><circle class="bt" cx="100" cy="88" r="2"/><circle class="bt" cx="100" cy="116" r="2"/><circle class="bt" cx="100" cy="144" r="2"/>',pants:'<path class="dt" d="M62 62H138M100 62V100"/>',skirt:'<path class="dt" d="M70 62H130M86 62 72 202M114 62 128 202M100 62V208"/>'};
const HEART='<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>';

/* ---------- tham chiếu ảnh: "a:<id>" trong kho ảnh, "d:<khóa>" nhúng trong trang ---------- */
const okRef=r=>typeof r==="string"&&/^(a:[A-Za-z0-9_-]{16,64}|d:[\w-]{1,40})$/.test(r);
function refUrl(r){if(!okRef(r))return"";if(r[0]==="a")return"/_blob/"+r.slice(2);return MEDIA.p[r.slice(2)]||""}

/* ---------- đọc và làm sạch dữ liệu ---------- */
function readJson(id,d){try{return JSON.parse(document.getElementById(id).textContent)}catch(e){return d}}
function tidyM(m){
  m=m&&typeof m==="object"?m:{};const f=(v,a,b,d)=>{v=+v;return isFinite(v)?clamp(v,a,b):d};
  return{x:f(m.x,0,1,.5),y:f(m.y,0,1,.85),w:f(m.w,.1,.75,.34),v:["o","l","d"].includes(m.v)?m.v:"o",vm:["o","l","d"].includes(m.vm)?m.vm:"",st:m.st==="s"?"s":"f",a:m.a?1:0,sh:[1,2].includes(m.sh)?m.sh:0};
}
function tidy(d){
  d=d&&typeof d==="object"&&!Array.isArray(d)?d:{};
  const o={v:1,rev:+d.rev||0};
  o.shop=Object.assign({name:"FREE.A",by:"",title:"",desc:"",phone:"",zalo:"",hours:"",shipFee:0,freeShip:0,saleEnd:"",tryon:"",bank:"",notice:"",headline:"",intro:""},d.shop&&typeof d.shop==="object"?d.shop:{});
  Object.keys(o.shop).forEach(k=>{if(k==="shipFee"||k==="freeShip")o.shop[k]=Math.max(0,Math.round(+o.shop[k]||0));else o.shop[k]=String(o.shop[k]==null?"":o.shop[k])});
  const b=d.brand&&typeof d.brand==="object"?d.brand:{};
  o.brand={st:b.st==="s"?"s":"f",sz:clamp(Math.round(+b.sz||34),18,60)};
  /* mẫu xóa watermark: kiểu mới (v:2) là ảnh mẫu m (màu + độ đục từng điểm) và khung x,y,w,h trên khổ gốc rw×rh;
     kiểu cũ là danh sách khung chữ nhật r */
  o.wm=(Array.isArray(d.wm)?d.wm:[]).filter(w=>w&&typeof w==="object").slice(0,30).map((w,i)=>{
    const id=String(w.id||"").replace(/[^\w-]/g,"").slice(0,20)||"w"+i,name=String(w.name||"").slice(0,40)||"Nhà sỉ "+(i+1);
    if(w.v===2){const n=k=>Math.max(0,Math.min(20000,Math.round(+w[k]||0)));const t={id,name,v:2,m:String(w.m||""),rw:n("rw"),rh:n("rh"),x:n("x"),y:n("y"),w:n("w"),h:n("h"),n:n("n")};
      return okRef(t.m)&&t.rw&&t.rh&&t.w&&t.h&&t.x+t.w<=t.rw&&t.y+t.h<=t.rh?t:null}
    if(!Array.isArray(w.r))return null;
    const r=w.r.filter(r=>Array.isArray(r)&&r.length===4&&r.every(v=>isFinite(+v))).slice(0,12).map(r=>{const x=clamp(+r[0],0,1),y=clamp(+r[1],0,1);return[x,y,clamp(+r[2],0,1-x),clamp(+r[3],0,1-y)].map(v=>Math.round(v*1e4)/1e4)}).filter(r=>r[2]>0&&r[3]>0);
    return r.length?{id,name,r}:null}).filter(Boolean);
  o.vouchers=(Array.isArray(d.vouchers)?d.vouchers:[]).filter(v=>v&&typeof v==="object");
  o.vouchers.forEach(v=>{delete v.note;v.code=String(v.code||"").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,20)});
  o.looks=(Array.isArray(d.looks)?d.looks:[]).filter(l=>l&&Array.isArray(l.ids));
  o.products=(Array.isArray(d.products)?d.products:[]).filter(p=>p&&typeof p==="object");
  o.products.forEach(p=>{
    p.id=Math.round(+p.id)||0;p.name=String(p.name||"");p.cat=String(p.cat||"Khác");
    if(!SHAPE_N[p.shape])p.shape="dress";if(!p.pat||!PAT_N[p.pat])delete p.pat;
    p.price=Math.max(0,Math.round(+p.price||0));if(+p.sale>0)p.sale=Math.round(+p.sale);else delete p.sale;
    p.sizes=(Array.isArray(p.sizes)?p.sizes:[]).map(String);
    p.colors=(Array.isArray(p.colors)?p.colors:[]).filter(c=>Array.isArray(c)&&c.length>1).map(c=>c.slice(0,3).map(String));
    if(!p.colors.length)p.colors=[["Mặc định","#b9a58f"]];
    p.mat=String(p.mat||"");p.desc=String(p.desc||"");
    if(p.tag)p.tag=String(p.tag);else delete p.tag;
    if(p.sku)p.sku=String(p.sku).trim().slice(0,40);if(!p.sku)delete p.sku;
    if(p.img)p.img=String(p.img);else delete p.img;
    p.photos=(Array.isArray(p.photos)?p.photos:[]).filter(x=>x&&okRef(x.s)).slice(0,MAX_PH).map(x=>({s:x.s,o:okRef(x.o)?x.o:x.s,m:tidyM(x.m)}));
    if(!p.photos.length)delete p.photos;
    if(p.hidden)p.hidden=true;else delete p.hidden;
  });
  const seen=new Set();
  o.products.forEach(p=>{if(!p.id||seen.has(p.id))p.id=Math.max(0,...o.products.map(x=>x.id))+1;seen.add(p.id)});
  return o;
}
function tidyMedia(m){
  m=m&&typeof m==="object"?m:{};
  const png=s=>typeof s==="string"&&/^data:image\/png;base64,[A-Za-z0-9+\/=]+$/.test(s);
  const o={cover:okImg(m.cover)?m.cover:"",logo0:png(m.logo0)?m.logo0:"",logo:png(m.logo)?m.logo:"",p:{}};
  if(m.p&&typeof m.p==="object")Object.keys(m.p).forEach(k=>{if(/^[\w-]{1,40}$/.test(k)&&okImg(m.p[k]))o.p[k]=m.p[k]});
  return o;
}
let DB=tidy(readJson("store",{})),MEDIA=tidyMedia(readJson("media",{}));
const BASE_REV=DB.rev;
const copyMedia=m=>({cover:m.cover,logo0:m.logo0,logo:m.logo,p:Object.assign({},m.p)});
let ORIG=JSON.stringify(DB),ORIG_M=copyMedia(MEDIA);

/* dựng khung trang từ khuôn mẫu */
document.body.insertBefore(document.getElementById("tpl").content.cloneNode(true),document.body.firstChild);

/* ---------- dữ liệu suy ra ---------- */
let SHOP,PRODUCTS,SHOWN,VOUCHERS,LOOKS,FAQ,CATS;
const P=id=>SHOWN.find(p=>p.id===+id);
const A_=id=>PRODUCTS.find(p=>p.id===+id);
const saleOn=()=>Date.parse(SHOP.saleEnd)>Date.now();
const priceOf=p=>saleOn()&&p.sale&&p.sale<p.price?p.sale:p.price;
const vnote=v=>v.ship?"miễn phí giao hàng"+(v.min?" cho đơn từ "+money(v.min):""):"giảm "+(+v.pct||0)+"%"+(v.max?", tối đa "+money(v.max):"")+(v.min?", cho đơn từ "+money(v.min):"");
function bind(){
  SHOP=DB.shop;PRODUCTS=DB.products;
  SHOWN=PRODUCTS.filter(p=>!p.hidden&&p.name&&p.price>0&&p.sizes.length);
  VOUCHERS={};DB.vouchers.forEach(v=>{if(v.code&&(v.ship||+v.pct>0))VOUCHERS[v.code]=v});
  LOOKS=DB.looks.filter(l=>l.ids.length>1&&l.ids.every(id=>P(id)));
  const cs=[...new Set(SHOWN.map(p=>p.cat))];
  cs.sort((a,b)=>(CAT_ORDER.indexOf(a)+1||99)-(CAT_ORDER.indexOf(b)+1||99));
  CATS=["Tất cả",...cs];if(saleOn()&&SHOWN.some(p=>p.sale))CATS.push("Đang giảm");CATS.push("Yêu thích");
  FAQ=makeFaq();
}
function makeFaq(){
  const z=web(SHOP.zalo),ph=esc(SHOP.phone),vs=Object.keys(VOUCHERS),T=esc;
  const zl=z?`<a href="${esc(z)}" target="_blank" rel="noopener">Nhắn Zalo ${ph}</a>`:"Nhắn Zalo "+ph;
  return[
   {q:"Đổi trả thế nào?",k:["doi tra","tra hang","hoan tien","doi size","doi mau","bi loi","hang loi"],h:T("Bạn được đổi size hoặc đổi mẫu trong 7 ngày kể từ khi nhận, hàng còn nguyên tem và chưa giặt. Hàng lỗi do shop được đổi mới miễn phí. Nhắn Zalo kèm mã đơn để shop hướng dẫn.")},
   {q:"Chọn size nào cho vừa?",k:["size","so do","can nang","chieu cao","mac vua"],h:T("Bạn nhắn chiều cao và cân nặng, ví dụ 1m58 48kg, mình gợi ý size ngay. Tham khảo nhanh: S 40–47kg, M 48–53kg, L 54–59kg, XL 60–66kg.")},
   {q:"Phí giao hàng và thời gian giao?",k:["ship","giao","van chuyen","bao lau","may ngay","phi"],h:T("Phí giao "+money(SHOP.shipFee)+" toàn quốc"+(SHOP.freeShip?", miễn phí cho đơn từ "+money(SHOP.freeShip):"")+". Nội thành 1–2 ngày, tỉnh khác 2–4 ngày.")},
   {q:"Thanh toán bằng cách nào?",k:["thanh toan","chuyen khoan","cod","tra tien","ngan hang"],h:T("Bạn trả tiền khi nhận hàng (COD), hoặc chuyển khoản. "+(SHOP.bank?"Thông tin chuyển khoản: "+SHOP.bank+".":"Thông tin chuyển khoản do shop gửi qua Zalo sau khi xác nhận đơn."))},
   {q:"Có mã giảm giá không?",k:["ma giam","voucher","giam gia","khuyen mai","uu dai"],h:T(vs.length?"Mã đang có: "+vs.map(c=>c+" ("+vnote(VOUCHERS[c])+")").join("; ")+". Mỗi đơn dùng một mã.":"Hiện shop chưa có mã giảm giá.")},
   {q:"Có được kiểm hàng trước khi trả tiền không?",k:["kiem hang","xem hang","dong kiem","mo hang"],h:T("Có. Bạn được mở gói kiểm tra mẫu và size trước khi thanh toán cho người giao hàng.")},
   {q:"Giặt và bảo quản thế nào?",k:["chat lieu","giat","bao quan"],h:T("Chất liệu ghi trong trang chi tiết từng món. Nên giặt tay hoặc giặt túi lưới với nước lạnh, phơi mặt trái, tránh nắng gắt.")},
   {id:"order",k:["don hang","tra don","ma don","kiem tra don","don cua toi"]},
   {k:["con hang","co san","het hang","dat truoc"],h:T("Shop xác nhận còn hàng qua Zalo trong giờ làm việc trước khi giao. Nếu size bạn chọn tạm hết, shop báo ngay để bạn đổi mẫu hoặc hủy đơn.")},
   {k:["nhan vien","tu van","nguoi that","goi dien","lien he","gio lam","zalo","hotline"],h:"Nhân viên trực "+T(SHOP.hours)+". "+zl+" hoặc gọi số "+ph+"."}
  ];
}

/* ---------- trạng thái phía khách ---------- */
let cat="Tất cả",q="",sort="",code="",cur=null,lastTxt="",wasSale=true,lim=PAGE;
let cart=ls.get("fl_cart",[]),wish=ls.get("fl_wish",[]),orders=ls.get("fl_orders",[]);
if(!Array.isArray(cart))cart=[];if(!Array.isArray(wish))wish=[];if(!Array.isArray(orders))orders=[];
function liveCart(){
  cart=cart.filter(i=>i&&P(i.id));
  cart.forEach(i=>{const p=P(i.id);if(!(i.ci>=0&&i.ci<p.colors.length))i.ci=0;i.qty=Math.max(1,Math.round(+i.qty)||1);i.size=String(i.size||p.sizes[0])});
}

/* ---------- hình sản phẩm: ảnh thật nếu có, không thì hình minh họa có nhãn shop ---------- */
function photoUrls(p){const u=(p.photos||[]).map(x=>refUrl(x.s)).filter(Boolean);if(!u.length&&p.img&&MEDIA.p[p.img])u.push(MEDIA.p[p.img]);return u}
function art(p,ci){
  const c=p.colors[ci]||p.colors[0],f=hex(c[1]);let g,ly=63;
  if(p.shape==="set"){g=`<path class="gm" d="${SH.blazer}" fill="${f}"/><path class="dt" d="M100 84V152"/><path class="gm" d="M68 158H132L150 234Q100 246 50 234Z" fill="${hex(c[2]||c[1])}"/>`;ly=164}
  else{const d=SH[p.shape];g=`<path class="gm" d="${d}" fill="${f}"/>${p.pat?`<path d="${d}" fill="url(#pt-${p.pat})"/>`:""}${DT[p.shape]}`;if(p.shape==="pants"||p.shape==="skirt")ly=51.5}
  return `<svg viewBox="0 0 200 250" role="img" aria-label="Hình minh họa ${esc(p.name)}"><line class="rail" x1="0" y1="12" x2="200" y2="12"/><path class="hk" d="M100 12v10c0 7-9 6-9 13M58 50l42-15 42 15"/>${g}<rect class="lb" x="83" y="${ly}" width="34" height="9" rx="1.5"/><text class="lbt" x="100.3" y="${ly+6.8}">${esc(String(SHOP.name).slice(0,9))}</text></svg>`;
}
function pic(p,ci){const u=photoUrls(p)[0];return u?`<img class="ph" src="${esc(u)}" alt="${esc(p.name)}" loading="lazy" data-pid="${p.id}">`:art(p,ci)}
/* ảnh không tải được thì hiện hình minh họa */
document.addEventListener("error",e=>{const t=e.target;if(!t||t.tagName!=="IMG"||!t.classList.contains("ph")||t.dataset.dead)return;t.dataset.dead="1";const p=A_(t.dataset.pid);if(p){const s=document.createElement("span");s.innerHTML=art(p,0);t.replaceWith(s.firstChild)}},true);

/* ---------- danh sách sản phẩm ---------- */
function card(p){
  const pr=priceOf(p),off=pr<p.price?Math.round((1-pr/p.price)*100):0;
  return `<article class="card"><button class="tile" data-a="pd" data-id="${p.id}" aria-label="Xem ${esc(p.name)}">${pic(p,0)}${off?`<span class="tag sl">-${off}%</span>`:p.tag?`<span class="tag">${esc(p.tag)}</span>`:""}</button>
  <button class="heart" data-a="wish" data-id="${p.id}" aria-pressed="${wish.includes(p.id)}" aria-label="Lưu ${esc(p.name)}">${HEART}</button>
  <div class="nm">${esc(p.name)}</div><div class="pr"><b>${money(pr)}</b>${off?`<s>${money(p.price)}</s>`:""}</div>
  <div class="dots">${p.colors.map(c=>`<i style="background:${hex(c[1])}" title="${esc(c[0])}"></i>`).join("")}</div></article>`;
}
function render(){
  if(!CATS.includes(cat))cat="Tất cả";
  let l=SHOWN.filter(p=>{
    if(cat==="Đang giảm"&&!(saleOn()&&p.sale))return false;
    if(cat==="Yêu thích"&&!wish.includes(p.id))return false;
    if(!["Tất cả","Đang giảm","Yêu thích"].includes(cat)&&p.cat!==cat)return false;
    return norm(p.name).includes(q)});
  if(sort==="asc")l.sort((a,b)=>priceOf(a)-priceOf(b));if(sort==="desc")l.sort((a,b)=>priceOf(b)-priceOf(a));
  $("#grid").innerHTML=l.slice(0,lim).map(card).join("")||`<p class="mute">${cat==="Yêu thích"?"Bạn chưa lưu món nào. Bấm hình trái tim trên sản phẩm để lưu lại.":"Không có món nào khớp. Thử từ khóa khác hoặc chọn Tất cả."}</p>`;
  const more=l.length-lim;$("#moreW").innerHTML=more>0?`<button class="btn ghost" data-a="more">Xem thêm ${Math.min(PAGE,more)} món</button>`:"";
  $("#gt").textContent=cat==="Tất cả"?"Hàng mới về":cat;
  $("#count").textContent=l.length+" món";$("#wc").textContent=wish.filter(id=>P(id)).length||"";
}
function drawSale(){$("#saleRow").innerHTML=SHOWN.filter(p=>p.sale&&p.sale<p.price).slice(0,12).map(card).join("")}
function tick(){
  const on=saleOn();$("#sale").hidden=!(on&&SHOWN.some(p=>p.sale&&p.sale<p.price));
  if(on!==wasSale){wasSale=on;bind();shell();render();drawLooks()}
  if(!on)return;
  let s=Math.floor((Date.parse(SHOP.saleEnd)-Date.now())/1e3);const d=Math.floor(s/86400);s%=86400;const h=Math.floor(s/3600);s%=3600;const m=Math.floor(s/60);s%=60;
  $("#clock").innerHTML=[[d,"ngày"],[h,"giờ"],[m,"phút"],[s,"giây"]].map(x=>`<span>${String(x[0]).padStart(2,"0")}<small>${x[1]}</small></span>`).join("");
}
function drawLooks(){
  $("#looksS").hidden=!LOOKS.length;
  $("#looks").innerHTML=LOOKS.map((l,i)=>{const ps=l.ids.map(P),pc=Math.min(90,Math.max(0,+l.off||0)),sum=ps.reduce((s,p)=>s+priceOf(p),0),off=Math.round(sum*pc/100);
  return `<article class="look"><div class="pair" aria-hidden="true">${ps.map(p=>pic(p,0)).join("")}</div><h3>${esc(l.name)}</h3>
  ${ps.map((p,j)=>`<label class="ln"><span>${esc(p.name)}</span><select id="lk${i}_${j}" aria-label="Size ${esc(p.name)}">${p.sizes.map(s=>`<option${s==="M"?" selected":""}>${esc(s)}</option>`).join("")}</select></label>`).join("")}
  <div class="pr"><b>${money(sum-off)}</b>${off?`<s>${money(sum)}</s> <span class="save">Tiết kiệm ${money(off)}</span>`:""}</div>
  <button class="btn wide" data-a="look" data-i="${i}">Thêm cả bộ vào giỏ</button></article>`}).join("");
}

/* ---------- chi tiết sản phẩm ---------- */
function drawPD(){
  const p=cur.p,pr=priceOf(p),c=p.colors[cur.ci]||p.colors[0],us=photoUrls(p);$("#pdT").textContent=p.cat;
  const gal=us.length?`<div class="gal" id="gal">${us.map((u,i)=>`<img class="ph" src="${esc(u)}" alt="${esc(p.name)}${us.length>1?", ảnh "+(i+1):""}" data-pid="${p.id}"${i?' loading="lazy"':""}>`).join("")}</div>`:art(p,cur.ci);
  $("#pdB").innerHTML=`<div class="pdart">${gal}</div>${us.length>1?`<div class="gdots" id="gdots">${us.map((u,i)=>`<i${i?"":' class="on"'}></i>`).join("")}</div>`:""}${us.length?"":'<p class="mute sm" style="text-align:center">Hình minh họa. Ảnh thật đang được cập nhật.</p>'}
  <h3 class="pn">${esc(p.name)}</h3><div class="pr"><b style="font-size:20px">${money(pr)}</b>${pr<p.price?`<s>${money(p.price)}</s>`:""}</div>
  <div class="lbl"><span>Màu: ${esc(c[0])}</span></div><div class="opt">${p.colors.map((x,i)=>`<button class="c" style="background:${hex(x[1])}" data-a="pc" data-i="${i}" aria-pressed="${i===cur.ci}" aria-label="Màu ${esc(x[0])}"></button>`).join("")}</div>
  <div class="lbl"><span>Size</span><button class="lnk" data-a="sz">Tìm size của tôi</button></div><div class="opt">${p.sizes.map(s=>`<button class="o" data-a="ps" data-s="${esc(s)}" aria-pressed="${s===cur.size}">${esc(s)}</button>`).join("")}</div>
  <div class="lbl"><span>Số lượng</span></div><div class="qty"><button data-a="qty" data-d="-1" aria-label="Giảm">−</button><span>${cur.qty}</span><button data-a="qty" data-d="1" aria-label="Tăng">+</button></div>
  ${p.desc?`<p style="margin-top:16px">${esc(p.desc)}</p>`:""}<ul class="facts">${p.mat?`<li>Chất liệu: ${esc(p.mat)}</li>`:""}<li>Giặt tay hoặc giặt túi lưới với nước lạnh</li><li>Đổi size trong 7 ngày, được kiểm hàng khi nhận</li></ul>
  <div class="lbl"><span>Đánh giá</span></div><p class="mute sm">Chưa có đánh giá. Sau khi nhận hàng, bạn gửi cảm nhận qua Zalo để được hiện ở đây.</p>`;
  const g=$("#gal");if(g&&us.length>1)g.addEventListener("scroll",()=>{const k=Math.round(g.scrollLeft/Math.max(1,g.clientWidth));$$("#gdots i").forEach((d,i)=>d.classList.toggle("on",i===k))},{passive:true});
}

/* ---------- giỏ hàng, mã giảm giá, đặt hàng ---------- */
function add(id,ci,size,qty){const f=cart.find(i=>i.id===id&&i.ci===ci&&i.size===size);f?f.qty+=qty:cart.push({id,ci,size,qty});ls.set("fl_cart",cart);badge()}
function badge(){const n=cart.reduce((s,i)=>s+i.qty,0);$$(".cc").forEach(e=>e.textContent=n||"")}
function totals(){
  const sub=cart.reduce((s,i)=>s+priceOf(P(i.id))*i.qty,0);let look=0;
  LOOKS.forEach(l=>{const n=Math.min(...l.ids.map(id=>cart.filter(i=>i.id===id).reduce((s,i)=>s+i.qty,0)));if(n>0)look+=Math.round(n*l.ids.reduce((s,id)=>s+priceOf(P(id)),0)*Math.min(90,Math.max(0,+l.off||0))/100)});
  const v=VOUCHERS[code]||{},base=sub-look,okMin=base>=(+v.min||0);let vd=0;
  if(+v.pct>0&&okMin)vd=Math.min(Math.round(base*Math.min(90,+v.pct)/100),+v.max||1e12);
  const net=base-vd,free=(SHOP.freeShip>0&&net>=SHOP.freeShip)||(!!v.ship&&okMin)||!SHOP.shipFee,ship=cart.length&&!free?SHOP.shipFee:0;
  return{sub,look,vd,net,ship,okMin,total:net+ship};
}
function sumRows(t){return `<div class="rw"><span>Tạm tính</span><span>${money(t.sub)}</span></div>${t.look?`<div class="rw ok"><span>Giảm phối sẵn</span><span>−${money(t.look)}</span></div>`:""}${t.vd?`<div class="rw ok"><span>Mã ${esc(code)}</span><span>−${money(t.vd)}</span></div>`:""}<div class="rw"><span>Giao hàng</span><span>${t.ship?money(t.ship):"Miễn phí"}</span></div><div class="rw tt"><span>Tổng cộng</span><span>${money(t.total)}</span></div>`}
function drawCart(){
  liveCart();if(code&&!VOUCHERS[code])code="";
  $("#cartT").textContent="Giỏ hàng";
  if(!cart.length){$("#cartB").innerHTML='<p class="mute">Giỏ đang trống. Chọn món bạn thích rồi quay lại đây.</p>';$("#cartF").innerHTML='<button class="btn wide" data-a="close">Xem sản phẩm</button>';return}
  const t=totals(),v=VOUCHERS[code],vs=Object.keys(VOUCHERS);
  const vm=!v?(vs.length?"Mã đang có: "+vs.join(", "):""):!t.okMin?`Mã ${code} cần đơn từ ${money(v.min)}`:`Đã áp dụng ${code}: ${vnote(v)}`;
  $("#cartB").innerHTML=cart.map((i,k)=>{const p=P(i.id);return `<div class="it"><div class="th">${pic(p,i.ci)}</div><div><div class="nm" style="margin:0">${esc(p.name)}</div><div class="mute sm">${esc(p.colors[i.ci][0])}, size ${esc(i.size)}</div><div class="qty" style="margin-top:6px"><button data-a="ci" data-k="${k}" data-d="-1" aria-label="Giảm">−</button><span>${i.qty}</span><button data-a="ci" data-k="${k}" data-d="1" aria-label="Tăng">+</button></div></div><div class="tr"><b>${money(priceOf(p)*i.qty)}</b><button class="lnk" data-a="ci" data-k="${k}" data-d="x">Xóa</button></div></div>`}).join("")
  +`<div class="vc"><input id="vcI" placeholder="Nhập mã giảm giá" value="${esc(code)}" aria-label="Mã giảm giá" autocapitalize="characters"><button class="btn ghost" data-a="vc">Áp dụng</button></div><p class="sm ${v&&t.okMin?"ok":"mute"}" id="vcM">${esc(vm)}</p>`;
  const fs=SHOP.freeShip;
  $("#cartF").innerHTML=(fs>0&&SHOP.shipFee>0?`<div class="meter"><i style="width:${Math.min(100,t.net/fs*100)}%"></i></div><p class="sm mute" style="margin:0">${t.ship?`Mua thêm ${money(Math.max(0,fs-t.net))} để được miễn phí giao hàng`:"Đơn này được miễn phí giao hàng"}</p>`:"")+sumRows(t)+'<button class="btn wide" data-a="co">Đặt hàng</button>';
}
function checkout(){
  liveCart();if(!cart.length){drawCart();return}
  $("#cartT").textContent="Thông tin nhận hàng";
  $("#cartB").innerHTML=`<div class="f"><label>Họ và tên<input id="fN" autocomplete="name"></label><label>Số điện thoại<input id="fP" type="tel" inputmode="numeric" autocomplete="tel" placeholder="Ví dụ 0912345678"></label><label>Địa chỉ nhận hàng<textarea id="fA" rows="3" autocomplete="street-address" placeholder="Số nhà, đường, phường, quận, tỉnh"></textarea></label>
  <fieldset><legend>Thanh toán</legend><label class="rd"><input type="radio" name="pay" value="Trả tiền khi nhận hàng (COD)" checked>Trả tiền khi nhận hàng (COD)</label><label class="rd"><input type="radio" name="pay" value="Chuyển khoản">Chuyển khoản${SHOP.bank?"":" (shop gửi thông tin qua Zalo)"}</label></fieldset>
  <label>Ghi chú<textarea id="fG" rows="2" placeholder="Giờ nhận hàng, lời nhắn cho shop"></textarea></label><p class="sm bad" id="fE" role="alert"></p></div>`;
  $("#cartF").innerHTML=sumRows(totals())+'<button class="btn wide" data-a="place">Xác nhận đặt hàng</button><button class="btn ghost wide" data-a="back">Quay lại giỏ hàng</button>';
}
function place(){
  const err=m=>{$("#fE").textContent=m};
  const n=$("#fN").value.trim(),pn=$("#fP").value.replace(/\D/g,""),ad=$("#fA").value.trim(),g=$("#fG").value.trim(),pay=$("input[name=pay]:checked").value;
  if(n.length<2)return err("Nhập họ tên người nhận.");
  if(!/^0\d{9}$/.test(pn))return err("Số điện thoại cần đủ 10 số và bắt đầu bằng 0.");
  if(ad.length<10)return err("Nhập địa chỉ đầy đủ để shop giao đúng nơi.");
  const t=totals(),d=new Date(),z=x=>String(x).padStart(2,"0"),zalo=web(SHOP.zalo);
  const cd="FA"+String(d.getFullYear()).slice(2)+z(d.getMonth()+1)+z(d.getDate())+"-"+(Math.floor(Math.random()*900)+100);
  lastTxt=`ĐƠN HÀNG ${SHOP.name.toUpperCase()} ${cd}\nKhách: ${n}\nSĐT: ${pn}\nĐịa chỉ: ${ad}\nThanh toán: ${pay}\n${g?"Ghi chú: "+g+"\n":""}\n`
   +cart.map(i=>{const p=P(i.id);return `- ${p.name} (${p.colors[i.ci][0]}, size ${i.size}) x${i.qty}: ${money(priceOf(p)*i.qty)}`}).join("\n")
   +`\n\nTạm tính: ${money(t.sub)}`+(t.look?`\nGiảm phối sẵn: -${money(t.look)}`:"")+(t.vd?`\nMã ${code}: -${money(t.vd)}`:"")+`\nGiao hàng: ${t.ship?money(t.ship):"Miễn phí"}\nTỔNG CỘNG: ${money(t.total)}`;
  orders.unshift({code:cd,time:d.toLocaleString("vi-VN"),total:t.total,status:"đã tạo, chờ shop xác nhận qua Zalo"});orders=orders.slice(0,20);ls.set("fl_orders",orders);
  try{fetch("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},keepalive:true,body:JSON.stringify({code:cd,name:n,phone:pn,address:ad,pay,note:g,voucher:code,total:t.total,text:lastTxt,items:cart.map(i=>({id:i.id,ci:i.ci,size:i.size,qty:i.qty}))})}).catch(()=>{})}catch(e){}
  cart=[];code="";ls.set("fl_cart",cart);badge();
  $("#cartT").textContent="Đã tạo đơn "+cd;
  $("#cartB").innerHTML=`<p><b>Còn một bước:</b> gửi nội dung đơn cho shop qua Zalo để được xác nhận và giao hàng.</p><textarea class="out" id="oT" readonly></textarea>${SHOP.bank&&pay==="Chuyển khoản"?`<p><b>Chuyển khoản:</b> ${esc(SHOP.bank)}</p>`:""}<p class="sm mute">Lưu mã <b>${cd}</b> để tra đơn trong mục Chat.</p>`;
  $("#oT").value=lastTxt;
  $("#cartF").innerHTML='<button class="btn wide" data-a="copy">Sao chép đơn hàng</button>'+(zalo?`<a class="btn ghost wide" href="${esc(zalo)}" target="_blank" rel="noopener">Mở Zalo của shop</a>`:"");
}

/* ---------- trả lời tự động (mọi câu trả lời là HTML đã được làm sạch) ---------- */
function say(t,who){const d=document.createElement("div");d.className="m "+(who||"b");who==="u"?d.textContent=t:d.innerHTML=t;$("#msgs").appendChild(d);$("#chatB").scrollTop=1e6}
function sizeFrom(n){
  const h=n.match(/1\s*m\s*(\d{2})/)||n.match(/\b(1[4-8]\d)\b/),w=n.match(/(\d{2,3})\s*kg/)||n.match(/\b([3-9]\d)\b/);
  if(!h||!w)return null;
  const H=h[0].includes("m")?100+ +h[1]:+h[1],W=+w[1],ks=Object.keys(SIZES);let i=ks.findIndex(s=>W<=SIZES[s][1]);
  if(i<0||W<SIZES.S[0]-6)return `Với ${H}cm, ${W}kg, bảng size hiện tại chưa có số phù hợp. Bạn nhắn Zalo ${SHOP.phone} để shop tư vấn riêng.`;
  const up=H>=168&&i<ks.length-1;if(up)i++;
  return `Với ${H}cm, ${W}kg, bạn hợp size ${ks[i]}${up?" (tăng một size vì bạn cao)":""}. Thích mặc rộng thì chọn lớn hơn một size. Không vừa được đổi size trong 7 ngày.`;
}
function orderInfo(){return orders.length?"Đơn gần đây trên thiết bị này:\n"+orders.slice(0,3).map(o=>`${o.code}: ${o.status}, tổng ${money(o.total)}`).join("\n")+`\nCần kiểm tra chi tiết, bạn nhắn Zalo ${SHOP.phone} kèm mã đơn.`:`Thiết bị này chưa có đơn nào. Nếu bạn đặt ở máy khác, nhắn mã đơn (dạng FA261114-123) hoặc nhắn Zalo ${SHOP.phone}.`}
function bot(t){
  const n=norm(t),m=n.match(/f[al]\d{6}-\d{3}/);
  if(m){const o=orders.find(o=>String(o.code).toLowerCase()===m[0]);return esc(o?`Đơn ${o.code}: ${o.status}. Tổng ${money(o.total)}, tạo lúc ${o.time}.`:`Mình không thấy đơn ${m[0].toUpperCase()} trên thiết bị này. Bạn nhắn Zalo ${SHOP.phone} kèm mã đơn để shop kiểm tra.`)}
  const sz=sizeFrom(n);if(sz)return esc(sz);
  let best=null,sc=0;FAQ.forEach(f=>{const s=f.k.filter(k=>n.includes(k)).length;if(s>sc){sc=s;best=f}});
  if(!best){const z=web(SHOP.zalo);return "Mình là trợ lý tự động nên chưa hiểu câu này. Bạn chọn một chủ đề bên dưới, hoặc "+(z?`<a href="${esc(z)}" target="_blank" rel="noopener">nhắn Zalo cho nhân viên</a>`:"nhắn Zalo "+esc(SHOP.phone))+" ("+esc(SHOP.hours)+")."}
  return best.id==="order"?esc(orderInfo()):best.h;
}
function ask(t){say(t,"u");say(bot(t),"b")}
function greet(){say(esc(`Chào bạn, mình là trợ lý tự động của ${SHOP.name}. Mình trả lời ngay về size, giao hàng, đổi trả, thanh toán và tra đơn. Cần gặp nhân viên, bạn nhắn Zalo ${SHOP.phone}.`),"b")}

/* ---------- phần khung: tên shop, thông báo, ảnh bìa, chân trang ---------- */
function shell(){
  $("#logo").textContent=SHOP.name;
  const tk=$("#tick");tk.textContent=SHOP.notice;tk.hidden=!SHOP.notice;
  $("#hl").textContent=SHOP.headline;$("#intro").textContent=SHOP.intro;
  const cv=$("#cover");if(MEDIA.cover){if(cv.getAttribute("src")!==MEDIA.cover)cv.src=MEDIA.cover;cv.alt="Ảnh bìa "+SHOP.name;cv.parentNode.hidden=false}else cv.parentNode.hidden=true;
  $("#chips").innerHTML=CATS.map(c=>`<button class="chip" data-a="cat" data-c="${esc(c)}" aria-pressed="${c===cat}">${esc(c)}</button>`).join("");
  const se=Date.parse(SHOP.saleEnd);
  $("#saleT").textContent=se?"Giảm giá đến hết ngày "+new Date(se).toLocaleDateString("vi-VN",{day:"numeric",month:"numeric",timeZone:"Asia/Ho_Chi_Minh"}):"Đang giảm giá";
  $("#serveT").textContent=SHOP.name+" lo cho bạn";
  const sv=[["Nhận hàng rồi trả tiền","Thanh toán COD toàn quốc"],["Được kiểm hàng","Mở gói xem trước khi trả tiền"],["Đổi size 7 ngày","Hàng còn tem, chưa giặt"]];
  if(SHOP.freeShip>0)sv.push(["Miễn phí giao hàng","Cho đơn từ "+money(SHOP.freeShip)]);
  $("#serve").innerHTML=sv.map(s=>`<div><strong>${s[0]}</strong><span>${s[1]}</span></div>`).join("");
  $("#sizeT").innerHTML=Object.keys(SIZES).map(s=>{const v=SIZES[s];return `<tr><td><b>${s}</b></td><td>${v[0]}–${v[1]} kg</td><td>${v[2]} cm</td><td>${v[3]} cm</td><td>${v[4]} cm</td></tr>`}).join("");
  $("#faqL").innerHTML=FAQ.filter(f=>f.q).map(f=>`<details><summary>${esc(f.q)}</summary><p>${f.h}</p></details>`).join("");
  $("#qs").innerHTML=QUICK.map(t=>`<button class="q" data-a="q" data-t="${esc(t)}">${esc(t)}</button>`).join("");
  const z=web(SHOP.zalo);
  $("#foot").innerHTML=`<div class="logo">${esc(SHOP.name)}</div>${SHOP.by?`<p class="by">${esc(SHOP.by)}</p>`:""}<p>Thời trang nữ bán online. Đặt hàng trên web, shop xác nhận qua Zalo rồi giao tận nơi.</p><p>Hotline và Zalo: ${esc(SHOP.phone)}. Làm việc ${esc(SHOP.hours)}.</p>${z?`<p><a href="${esc(z)}" target="_blank" rel="noopener">Nhắn Zalo cho shop</a></p>`:""}<p>© ${new Date().getFullYear()} ${esc(SHOP.name)}</p>`;
}
function refreshAll(){bind();liveCart();shell();render();drawSale();drawLooks();badge();tick();bar()}

/* ================= CÔNG CỤ GÁN LOGO LÊN ẢNH SẢN PHẨM =================
   1. Cắt khung 4:5 quanh bộ đồ.  2. Chấm điểm mọi vị trí đặt logo: nền phẳng, không che bộ đồ,
   gần người mẫu, theo đường một phần ba.  3. Chọn màu logo đủ tương phản.  4. In logo vào ảnh.
   Lưu cả ảnh gốc đã cắt (để dời logo về sau) và ảnh đã gán logo (để khách xem). */
const OW=800,OH=1000,AW=64,AH=80;
const VCOL={o:null,l:"#f7f1e6",d:"#3b2a20"},VNAME={"":"Tự động",o:"Màu logo",l:"Kem",d:"Nâu đậm"};
const NAMED=[["Trắng","#f4f2ee"],["Kem","#ece2cc"],["Be","#d6c0a0"],["Nâu","#8a6347"],["Nâu socola","#57402f"],["Đen","#2a2828"],["Xám","#8e8a85"],["Xám nhạt","#c8c5c0"],["Hồng","#e7a2b4"],["Hồng đậm","#c95c7f"],["Đỏ","#b93a32"],["Cam","#dd7b3a"],["Vàng","#e3c24f"],["Xanh lá","#5d8a50"],["Xanh rêu","#6c7550"],["Xanh mint","#9ed2bf"],["Xanh dương","#4372b3"],["Xanh navy","#2c3a5e"],["Tím","#7b5aa3"]];
const cnv=(w,h)=>{const c=document.createElement("canvas");c.width=w;c.height=h;return c};
const c2d=c=>c.getContext("2d",{willReadFrequently:true});
const loadImg=src=>new Promise((ok,no)=>{const i=new Image();i.decoding="async";i.onload=()=>ok(i);i.onerror=()=>no({code:"load"});i.src=src});
const toBlob=(c,qq)=>new Promise((ok,no)=>c.toBlob(b=>b?ok(b):no({code:"encode"}),"image/jpeg",qq));
const blobToData=b=>new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=()=>no({code:"read"});r.readAsDataURL(b)});
function relLum(r,g,b){const f=c=>c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4);return .2126*f(r)+.7152*f(g)+.0722*f(b)}
const contrast=(a,b)=>(Math.max(a,b)+.05)/(Math.min(a,b)+.05);

/* logo: logo riêng do chủ shop tải lên, nếu không thì logo gốc */
let LG=null;
const logoSrc=()=>MEDIA.logo||MEDIA.logo0;
function trimAlpha(c,x0,y0,w,h){
  const d=c2d(c).getImageData(x0,y0,w,h).data;let a=w,b=h,e=-1,f=-1;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(d[(y*w+x)*4+3]>10){if(x<a)a=x;if(x>e)e=x;if(y<b)b=y;if(y>f)f=y}
  if(e<0)return null;const o=cnv(e-a+1,f-b+1);o.getContext("2d").drawImage(c,x0+a,y0+b,o.width,o.height,0,0,o.width,o.height);return o;
}
async function logoReady(){
  const src=logoSrc();if(!src)throw{code:"nologo"};if(LG&&LG.src===src)return LG;
  const im=await loadImg(src),w=im.naturalWidth,h=im.naturalHeight,f=cnv(w,h);c2d(f).drawImage(im,0,0);
  const d=c2d(f).getImageData(0,0,w,h).data,rows=new Uint32Array(h);let R=0,G=0,B=0,n=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;if(d[i+3]>40){rows[y]++;if(d[i+3]>200){R+=d[i];G+=d[i+1];B+=d[i+2];n++}}}
  /* khoảng trống dài nhất ở nửa dưới: tách phần chữ chính và dòng chữ nhỏ */
  let best=0,bs=0,run=0,st=0;for(let y=Math.floor(h*.35);y<h;y++){if(!rows[y]){if(!run)st=y;run++;if(run>best){best=run;bs=st}}else run=0}
  const full=trimAlpha(f,0,0,w,h),short=best>=h*.025?trimAlpha(f,0,0,w,bs):null;
  n=Math.max(1,n);LG={src,f:full,s:short,oy:relLum(R/n/255,G/n/255,B/n/255),cache:{}};return LG;
}
function logoOf(st,v){
  const base=st==="s"&&LG.s?LG.s:LG.f,k=(base===LG.s?"s":"f")+v;if(LG.cache[k])return LG.cache[k];
  let o=base;if(VCOL[v]){o=cnv(base.width,base.height);const x=o.getContext("2d");x.drawImage(base,0,0);x.globalCompositeOperation="source-in";x.fillStyle=VCOL[v];x.fillRect(0,0,o.width,o.height)}
  return LG.cache[k]=o;
}
const logoAsp=st=>{const L=logoOf(st,"o");return L.width/L.height};

/* phân tích ảnh trên lưới 64×80 ô */
let ANC=null;
function integ(a){const W=AW+1,I=new Float64Array(W*(AH+1));for(let y=0;y<AH;y++){let r=0;for(let x=0;x<AW;x++){r+=a[y*AW+x];I[(y+1)*W+x+1]=I[y*W+x+1]+r}}return I}
const S4=(I,x,y,w,h)=>{const W=AW+1;return I[(y+h)*W+x+w]-I[y*W+x+w]-I[(y+h)*W+x]+I[y*W+x]};
function otsu(a){const H=new Float64Array(64);let N=0,sum=0;for(const v of a){const b=Math.min(63,Math.max(0,Math.floor(v*64)));H[b]++;N++;sum+=b}
  let sb=0,wb=0,best=0,t=32;for(let i=0;i<64;i++){wb+=H[i];if(!wb)continue;const wf=N-wb;if(!wf)break;sb+=i*H[i];const mb=sb/wb,mf=(sum-sb)/wf,v=wb*wf*(mb-mf)*(mb-mf);if(v>best){best=v;t=i}}return(t+.5)/64}
function saliency(R,G,B,W,H,center){
  const N=W*H,ring=[];for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(x<2||y<2||x>=W-2||y>=H-2)ring.push(y*W+x);
  const med=a=>{const v=ring.map(i=>a[i]).sort((p,q)=>p-q);return v[v.length>>1]},bg=[med(R),med(G),med(B)];
  const Y=new Float32Array(N);for(let i=0;i<N;i++)Y[i]=.299*R[i]+.587*G[i]+.114*B[i];
  const E=new Float32Array(N);
  for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const i=y*W+x;
    const gx=Y[i-W+1]+2*Y[i+1]+Y[i+W+1]-Y[i-W-1]-2*Y[i-1]-Y[i+W-1],gy=Y[i+W-1]+2*Y[i+W]+Y[i+W+1]-Y[i-W-1]-2*Y[i-W]-Y[i-W+1];E[i]=Math.min(1,Math.hypot(gx,gy)/1.2)}
  const Es=new Float32Array(N);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){let s=0,n=0;for(let dy=-1;dy<2;dy++)for(let dx=-1;dx<2;dx++){const xx=x+dx,yy=y+dy;if(xx>=0&&yy>=0&&xx<W&&yy<H){s+=E[yy*W+xx];n++}}Es[y*W+x]=s/n}
  const S=new Float32Array(N);
  for(let i=0;i<N;i++){const cd=Math.min(1,Math.hypot(R[i]-bg[0],G[i]-bg[1],B[i]-bg[2])/.45);let s=.62*cd+.38*Math.min(1,Es[i]*1.6);
    if(center){const cx=((i%W)+.5)/W-.5,cy=(((i/W)|0)+.5)/H-.5;s*=.45+.55*Math.max(0,1-Math.hypot(cx*1.3,cy)*1.25)}S[i]=s}
  return{Y,E:Es,S,bg};
}
function analyze(src){
  ANC=ANC||cnv(AW,AH);const x=c2d(ANC);x.clearRect(0,0,AW,AH);x.drawImage(src,0,0,AW,AH);
  const d=x.getImageData(0,0,AW,AH).data,N=AW*AH,R=new Float32Array(N),G=new Float32Array(N),B=new Float32Array(N);
  for(let i=0;i<N;i++){R[i]=d[i*4]/255;G[i]=d[i*4+1]/255;B[i]=d[i*4+2]/255}
  const{Y,E,S}=saliency(R,G,B,AW,AH,true);
  const t=clamp(otsu(S),.12,.5),M0=new Uint8Array(N);for(let i=0;i<N;i++)M0[i]=S[i]>t?1:0;
  /* không đặt logo lên mặt, tay chân người mẫu */
  const sk=new Uint8Array(N);let ks=0;
  for(let i=0;i<N;i++){const r=R[i]*255,g=G[i]*255,b=B[i]*255,mx=Math.max(r,g,b),mn=Math.min(r,g,b);if(r>95&&g>40&&b>20&&mx-mn>15&&r-g>15&&r>g&&r>b){sk[i]=1;ks++}}
  if(ks<N*.35)for(let i=0;i<N;i++)if(sk[i]&&S[i]>.08)M0[i]=1;
  /* bỏ đốm nhỏ, giữ phần chính của bộ đồ */
  const lab=new Uint8Array(N);let x0=1,y0=1,x1=0,y1=0,any=false;
  for(let i=0;i<N;i++){if(!M0[i]||lab[i])continue;const st=[i],cells=[];lab[i]=1;
    while(st.length){const j=st.pop();cells.push(j);const jx=j%AW,jy=(j/AW)|0;for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const xx=jx+dx,yy=jy+dy;if(xx<0||yy<0||xx>=AW||yy>=AH)continue;const k=yy*AW+xx;if(M0[k]&&!lab[k]){lab[k]=1;st.push(k)}}}
    if(cells.length<12){cells.forEach(j=>M0[j]=0);continue}
    any=true;cells.forEach(j=>{const fx=(j%AW+.5)/AW,fy=(((j/AW)|0)+.5)/AH;if(fx<x0)x0=fx;if(fx>x1)x1=fx;if(fy<y0)y0=fy;if(fy>y1)y1=fy})}
  /* nới vùng bộ đồ 2 ô để logo không sát quá */
  const M=new Float32Array(N);
  for(let y=0;y<AH;y++)for(let xx=0;xx<AW;xx++){let h=0;for(let dy=-2;dy<3&&!h;dy++)for(let dx=-2;dx<3;dx++){const a=xx+dx,b=y+dy;if(a>=0&&b>=0&&a<AW&&b<AH&&M0[b*AW+a]){h=1;break}}M[y*AW+xx]=h}
  const Y2=Y.map(v=>v*v);
  return{iE:integ(E),iY:integ(Y),iY2:integ(Y2),iM:integ(M),iR:integ(R),iG:integ(G),iB:integ(B),sb:any?[x0,y0,x1,y1]:null,R,G,B,M0};
}
function pickV(col){
  const yb=relLum(col[0],col[1],col[2]),co=contrast(LG.oy,yb);
  if(co>=1.6)return{v:"o",c:co};const cl=contrast(.88,yb),cd=contrast(.026,yb);return cl>=cd?{v:"l",c:cl}:{v:"d",c:cd};
}
function shadowOf(busy,col){return busy>.16?(relLum(col[0],col[1],col[2])>.42?1:2):0}
function suggest(A,st,sz){
  const asp=logoAsp(st),mg=Math.max(2,Math.round(AW*.045)),res=[];
  for(const strict of[true,false]){
    for(const k of strict?[1,.86,.74]:[1,.86,.74,.6]){
      const bw=Math.max(6,Math.round(sz/100*AW*k)),bh=Math.max(2,Math.round(bw/asp));
      if(bw>AW-2*mg||bh>AH-2*mg)continue;
      for(let y=mg;y+bh<=AH-mg;y++)for(let x=mg;x+bw<=AW-mg;x++){
        const n=bw*bh,sub=S4(A.iM,x,y,bw,bh)/n;if(strict&&sub>.14)continue;
        const busy=S4(A.iE,x,y,bw,bh)/n,my=S4(A.iY,x,y,bw,bh)/n,vy=Math.max(0,S4(A.iY2,x,y,bw,bh)/n-my*my);
        const cx=(x+bw/2)/AW,cy=(y+bh/2)/AH,sb=A.sb;let dist=0;
        if(sb){const dx=Math.max(sb[0]-cx,0,cx-sb[2]),dy=Math.max(sb[1]-cy,0,cy-sb[3]);dist=Math.hypot(dx,dy*.8)}
        const th=Math.min(Math.abs(cx-1/3),Math.abs(cx-2/3),Math.abs(cx-.5)*1.3)+.7*Math.min(Math.abs(cy-.15),Math.abs(cy-.85),Math.abs(cy-.5)*1.4);
        const col=[S4(A.iR,x,y,bw,bh)/n,S4(A.iG,x,y,bw,bh)/n,S4(A.iB,x,y,bw,bh)/n],pv=pickV(col);
        const cost=1.3*busy+2.4*Math.sqrt(vy)+(strict?3.2:6)*sub+.6*Math.max(0,dist-.1)+.22*th+.3*Math.max(0,2.2-pv.c)-.25*k;
        res.push([cost,cx,cy,bw/AW,pv.v,shadowOf(busy,col)]);
      }
    }
    if(res.length)break;
  }
  if(!res.length)res.push([0,.5,.88,sz/100*.6,"o",2]);
  res.sort((a,b)=>a[0]-b[0]);
  const out=[];for(const r of res){if(out.every(o=>Math.hypot(o[1]-r[1],o[2]-r[2])>.2)){out.push(r);if(out.length===3)break}}
  return out.map(r=>clampM({x:r[1],y:r[2],w:r[3],v:r[4],vm:"",st,a:1,sh:r[5]}));
}
function clampM(m){const asp=logoAsp(m.st),wf=m.w,hf=m.w*OW/asp/OH;m.x=+clamp(m.x,wf/2+.02,1-wf/2-.02).toFixed(4);m.y=+clamp(m.y,hf/2+.02,1-hf/2-.02).toFixed(4);m.w=+m.w.toFixed(4);return m}
/* tính lại màu logo và bóng sau khi dời logo */
function fixVariant(A,m){
  const asp=logoAsp(m.st),bw=clamp(Math.round(m.w*AW),1,AW),bh=clamp(Math.round(m.w*AW/asp),1,AH);
  const x=clamp(Math.round(m.x*AW-bw/2),0,AW-bw),y=clamp(Math.round(m.y*AH-bh/2),0,AH-bh),n=bw*bh;
  const col=[S4(A.iR,x,y,bw,bh)/n,S4(A.iG,x,y,bw,bh)/n,S4(A.iB,x,y,bw,bh)/n];m.v=pickV(col).v;m.sh=shadowOf(S4(A.iE,x,y,bw,bh)/n,col);return m;
}
function stampTo(o,m,dst){
  const x=dst.getContext("2d");x.drawImage(o,0,0,OW,OH);if(!m)return dst;
  const v=m.vm||m.v,L=logoOf(m.st,v),w=m.w*OW,h=w*L.height/L.width,sh=m.sh?(m.vm==="l"?2:m.vm==="d"?1:m.sh):0;
  x.save();if(sh){x.shadowColor=sh===2?"rgba(20,14,10,.45)":"rgba(255,255,255,.65)";x.shadowBlur=Math.max(4,w*.035)}
  x.drawImage(L,m.x*OW-w/2,m.y*OH-h/2,w,h);x.restore();return dst;
}
function boxBlur(a,W,H,r){const t=new Float32Array(a.length),o=new Float32Array(a.length),n=2*r+1;
  for(let y=0;y<H;y++){let sm=0;for(let x=-r;x<=r;x++)sm+=a[y*W+clamp(x,0,W-1)];for(let x=0;x<W;x++){t[y*W+x]=sm/n;sm+=a[y*W+clamp(x+r+1,0,W-1)]-a[y*W+clamp(x-r,0,W-1)]}}
  for(let x=0;x<W;x++){let sm=0;for(let y=-r;y<=r;y++)sm+=t[clamp(y,0,H-1)*W+x];for(let y=0;y<H;y++){o[y*W+x]=sm/n;sm+=t[clamp(y+r+1,0,H-1)*W+x]-t[clamp(y-r,0,H-1)*W+x]}}
  return o}
/* cắt khung 4:5 quanh phần nổi bật nhất */
let CRC=null;
function cropRect(img){
  const iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height,RT=OW/OH;
  if(Math.abs(iw/ih-RT)<.01)return[0,0,iw,ih];
  const s=96/Math.max(iw,ih),tw=Math.max(8,Math.round(iw*s)),th=Math.max(8,Math.round(ih*s));
  CRC=CRC||cnv(96,96);CRC.width=tw;CRC.height=th;const x=c2d(CRC);x.drawImage(img,0,0,tw,th);
  const d=x.getImageData(0,0,tw,th).data,N=tw*th,R=new Float32Array(N),G=new Float32Array(N),B=new Float32Array(N);
  for(let i=0;i<N;i++){R[i]=d[i*4]/255;G[i]=d[i*4+1]/255;B[i]=d[i*4+2]/255}
  /* độ nổi bật so với vùng xung quanh + màu da người, rồi bỏ nét mảnh như chữ in trên ảnh */
  const sal=saliency(R,G,B,tw,th,false),r6=Math.max(3,Math.round(Math.max(tw,th)/14)),bR=boxBlur(R,tw,th,r6),bG=boxBlur(G,tw,th,r6),bB=boxBlur(B,tw,th,r6);
  const sk=new Uint8Array(N);let ks=0;
  for(let i=0;i<N;i++){const r=R[i]*255,g=G[i]*255,b=B[i]*255,mx=Math.max(r,g,b),mn=Math.min(r,g,b);if(r>95&&g>40&&b>20&&mx-mn>15&&r-g>15&&r>g&&r>b){sk[i]=1;ks++}}
  const useSk=ks<N*.35,S0=new Float32Array(N);
  for(let i=0;i<N;i++)S0[i]=.55*Math.min(1,Math.hypot(R[i]-bR[i],G[i]-bG[i],B[i]-bB[i])/.3)+.25*sal.E[i]+(useSk&&sk[i]?.9:0);
  const morph=(a,mx)=>{const o=new Float32Array(N);for(let y=0;y<th;y++)for(let xx=0;xx<tw;xx++){let v=mx?-1:9;for(let dy=-1;dy<2;dy++)for(let dx=-1;dx<2;dx++){const u=a[clamp(y+dy,0,th-1)*tw+clamp(xx+dx,0,tw-1)];v=mx?Math.max(v,u):Math.min(v,u)}o[y*tw+xx]=v}return o};
  const S=morph(morph(morph(morph(S0,0),0),1),1);let tot=0;for(const v of S)tot+=v;tot=Math.max(tot,1e-6);
  if(iw/ih>RT){const cw=Math.min(tw,Math.round(th*RT)),col=new Float64Array(tw+1);
    for(let xx=0;xx<tw;xx++){let c=0;for(let y=0;y<th;y++)c+=S[y*tw+xx];col[xx+1]=col[xx]+c}
    let best=-1e9,bo=0;for(let o=0;o+cw<=tw;o++){const sc=(col[o+cw]-col[o])/tot-.08*Math.abs(o+cw/2-tw/2)/tw;if(sc>best){best=sc;bo=o}}
    const sw=ih*RT;return[clamp(bo/tw*iw,0,iw-sw),0,sw,ih];
  }
  const ch=Math.min(th,Math.round(tw/RT)),row=new Float64Array(th+1);
  for(let y=0;y<th;y++){let c=0;for(let xx=0;xx<tw;xx++)c+=S[y*tw+xx];row[y+1]=row[y]+c}
  const pref=(th-ch)*.35;let best=-1e9,bo=0;
  for(let o=0;o+ch<=th;o++){const sc=(row[o+ch]-row[o])/tot-.1*Math.abs(o-pref)/th;if(sc>best){best=sc;bo=o}}
  const sh=iw/RT;return[0,clamp(bo/th*ih,0,ih-sh),iw,sh];
}
async function decode(file){
  try{return await createImageBitmap(file)}catch(e){}
  const u=URL.createObjectURL(file);try{return await loadImg(u)}finally{setTimeout(()=>URL.revokeObjectURL(u),3000)}
}
/* Công cụ xử lý ảnh nâng cao (src/imgtools.js): xóa watermark chính xác từng điểm, AI vẽ lại, nhận diện người mẫu.
   Chỉ tải khi chủ shop dùng tới, khách xem trang không phải tải. */
let IMGP=null;
function imgTools(){return IMGP||(IMGP=new Promise((ok,no)=>{if(window.FAIMG)return ok(window.FAIMG);
  const s=document.createElement("script");s.src="/imgtools.js";s.async=true;
  s.onload=()=>window.FAIMG?ok(window.FAIMG):no({code:"imgtools"});s.onerror=()=>{IMGP=null;s.remove();no({code:"imgtools"})};document.head.appendChild(s)}))}
const tools=async()=>{try{return await imgTools()}catch(e){return null}};
/* mẫu watermark kiểu mới: ảnh mẫu (màu và độ đục từng điểm) đọc một lần rồi giữ trong bộ nhớ */
const WMT=new Map();
function wmTpl(w){const k=w.id+"|"+w.m;if(WMT.has(k))return WMT.get(k);
  const p=(async()=>{const F=await imgTools(),im=await loadImg(refUrl(w.m));return F.tplFromImage(im,w)})();WMT.set(k,p);p.catch(()=>WMT.delete(k));return p}
async function wmApply(F,c,w){
  if(w.v===2)return F.applyTemplate(c,await wmTpl(w));
  if(w.r&&w.r.length){const r=await F.applyRects(c,w.r);return{found:!!r.changed,old:true}}
  return{found:false};
}
/* Đọc ảnh, xóa watermark theo mẫu ở độ phân giải gốc (chính xác hơn), rồi cắt khung 4:5 giữ trọn người mẫu.
   Không tải được công cụ (mất mạng) thì vẫn cắt khung theo cách cũ để không chặn việc nhập hàng. */
async function prepFile(file,W,wm){
  const b=await decode(file),iw=b.naturalWidth||b.width,ih=b.naturalHeight||b.height,k=Math.min(1,3200/Math.max(iw,ih));
  const c=cnv(Math.max(1,Math.round(iw*k)),Math.max(1,Math.round(ih*k))),g=c2d(c);g.imageSmoothingEnabled=true;g.imageSmoothingQuality="high";g.drawImage(b,0,0,c.width,c.height);if(b.close)b.close();
  const F=await tools(),info={wm:null,plan:null};
  if(wm&&F){try{info.wm=await wmApply(F,c,wm)}catch(e){info.wm={found:false,err:true}}}
  if(F){try{info.plan=F.cropPlan(c.width,c.height,await F.people(c))}catch(e){info.plan=null}}
  if(info.plan)await F.drawPlan(c,W.o,info.plan);
  else{const[sx,sy,sw,sh]=cropRect(c),x=W.o.getContext("2d");x.imageSmoothingEnabled=true;x.imageSmoothingQuality="high";x.fillStyle="#fff";x.fillRect(0,0,OW,OH);x.drawImage(c,sx,sy,sw,sh,0,0,OW,OH)}
  return info;
}
function domColor(A){
  const r=[],g=[],b=[];for(let i=0;i<A.M0.length;i++)if(A.M0[i]){r.push(A.R[i]);g.push(A.G[i]);b.push(A.B[i])}
  if(r.length<8)return["Màu 1","#b9a58f"];const md=a=>a.sort((p,q)=>p-q)[a.length>>1],c=[md(r),md(g),md(b)];
  const h="#"+c.map(v=>Math.round(v*255).toString(16).padStart(2,"0")).join("");
  let bn="Màu 1",bd=1e9;NAMED.forEach(([n,hx])=>{const qq=[1,3,5].map(i=>parseInt(hx.slice(i,i+2),16)/255),dd=Math.hypot(qq[0]-c[0],qq[1]-c[1],qq[2]-c[2]);if(dd<bd){bd=dd;bn=n}});
  return[bn,h];
}
/* kho ảnh của trang; không có thì nhúng ảnh vào trang */
let AS=null,asTried=false;
async function assets(){if(!asTried){asTried=true;AS=await use("assets")}return AS}
async function putImg(blob){
  const a=await assets();
  if(a){let tries=0;for(;;){try{const r=await a.upload(blob,{type:"image/jpeg"});if(!r||!/^[A-Za-z0-9_-]{16,64}$/.test(r.id))throw{code:"upstream_error"};return"a:"+r.id}
    catch(e){const c=e&&e.code;if((c==="rate_limited"&&tries<2)||(c==="store_unavailable"&&tries<1)){tries++;await sleep(c==="rate_limited"?4000*tries:1500);continue}throw e}}}
  const u=await blobToData(blob),k="m"+Date.now().toString(36)+Math.random().toString(36).slice(2,7);MEDIA.p[k]=u;mTouched=true;return"d:"+k;
}
/* ảnh PNG (mẫu watermark): lưu kho ảnh, không có kho thì nhúng vào trang */
async function putPng(blob){
  const a=await assets();
  if(a){const r=await a.upload(blob,{type:"image/png"});if(!r||!/^[A-Za-z0-9_-]{16,64}$/.test(r.id))throw{code:"upstream_error"};return"a:"+r.id}
  const u=await blobToData(blob),k="w"+Date.now().toString(36)+Math.random().toString(36).slice(2,7);MEDIA.p[k]=u;mTouched=true;return"d:"+k;
}
async function processFile(file,W,wm){
  await logoReady();const info=await prepFile(file,W,wm);
  const A=analyze(W.o),m=suggest(A,DB.brand.st,DB.brand.sz)[0];stampTo(W.o,m,W.s);
  const[ob,sb]=await Promise.all([toBlob(W.o,.9),toBlob(W.s,.85)]),[o,s]=await Promise.all([putImg(ob),putImg(sb)]);
  return{ph:{s,o,m},color:domColor(A),info};
}
async function restampOne(ph,W){
  await logoReady();const im=await loadImg(refUrl(ph.o));W.o.getContext("2d").drawImage(im,0,0,OW,OH);
  const A=analyze(W.o);let m;
  if(ph.m.a)m=suggest(A,DB.brand.st,DB.brand.sz)[0];
  else{m=Object.assign({},ph.m,{st:DB.brand.st,w:DB.brand.sz/100});clampM(m);fixVariant(A,m)}
  stampTo(W.o,m,W.s);return{s:await putImg(await toBlob(W.s,.85)),o:ph.o,m};
}
const workCanvas=()=>({o:cnv(OW,OH),s:cnv(OW,OH)});
const ERRMSG={quota_or_state:"Kho ảnh đã đầy hoặc tạm khóa.",too_large:"Ảnh quá nặng.",unsupported_type:"File này không phải ảnh dùng được.",rate_limited:"Tải ảnh lên quá nhanh, hãy chờ một lát.",upstream_auth:"Phiên đăng nhập hết hạn, hãy tải lại trang.",not_granted:"Tài khoản này chưa được lưu ảnh.",load:"Không mở được ảnh.",nologo:"Chưa có logo."};
const errText=e=>ERRMSG[e&&e.code]||"Có lỗi khi xử lý ảnh ("+((e&&e.code)||"không rõ")+").";

/* việc hàng loạt: vài ảnh xử lý song song (mặc định 3), có thể dừng giữa chừng */
let JOB=null;
function jobUI(){
  const j=$("#job");j.hidden=!JOB;if(!JOB)return;
  const pc=JOB.total?Math.round(JOB.done/JOB.total*100):100,sec=(performance.now()-JOB.t0)/1000;
  $("#jobT").textContent=JOB.end?JOB.summary:`${JOB.label}: ${JOB.done}/${JOB.total} ảnh`;
  $("#jobS").textContent=JOB.end?"":JOB.done?`Còn khoảng ${Math.max(1,Math.round(sec/JOB.done*(JOB.total-JOB.done)))} giây`:"Đang bắt đầu…";
  $("#jobBar").style.width=pc+"%";$("#jobStop").hidden=JOB.end||JOB.stop;$("#jobOk").hidden=!JOB.end;
}
async function runJob(label,items,fn,after,conc){
  if(JOB&&!JOB.end)return toast("Đang có việc chạy, chờ xong đã");
  try{await logoReady()}catch(e){return toast(errText(e))}
  JOB={label,total:items.length,done:0,fail:0,stop:false,end:false,t0:performance.now(),err:null};jobUI();
  let next=0;const J=JOB;
  await Promise.all(Array.from({length:Math.min(conc||3,items.length)},async()=>{const W=workCanvas();
    while(!J.stop){const k=next++;if(k>=items.length)break;
      try{await fn(items[k],W,k)}catch(e){J.fail++;J.err=e;if(e&&["quota_or_state","upstream_auth","not_granted"].includes(e.code))J.stop=true}
      J.done++;jobUI()}}));
  const sec=(performance.now()-J.t0)/1000,ok=J.done-J.fail;
  J.end=true;J.summary=after(ok)+` Mất ${sec<10?sec.toFixed(1).replace(".",","):Math.round(sec)} giây`+(ok?`, trung bình ${(sec/Math.max(1,J.done)).toFixed(2).replace(".",",")} giây mỗi ảnh`:"")+"."+(J.fail?` ${J.fail} ảnh lỗi: ${errText(J.err)}`:"")+(J.stop&&J.done<J.total?` Đã dừng, còn ${J.total-J.done} ảnh chưa làm.`:"");
  jobUI();touch();if(isAdm)drawAdmin();
}
function guessCat(n){const s=norm(n);return/chan vay|skirt/.test(s)?"Chân váy":/\bset\b|\bbo\b|do bo/.test(s)?"Set":/vay|dam|dress/.test(s)?"Váy":/quan|pants|jean/.test(s)?"Quần":/\bao\b|blazer|vest|so mi|shirt|croptop|khoac/.test(s)?"Áo":"Khác"}
function nameFrom(f,i){let n=String(f.name||"").replace(/\.[^.]+$/,"").replace(/[_\-]+/g," ").replace(/\s+/g," ").trim();if(!n||/^(img|dsc|dcim|pxl|photo|image|screenshot|z\d|\d)/i.test(n)||/^\d+$/.test(n))n="Sản phẩm mới "+(i+1);return n.slice(0,80)}
/* ================= NHẬP HÀNG LOẠT: gom ảnh thành sản phẩm =================
   Ảnh cùng một món được nhận ra nhờ: mỗi món một thư mục, hoặc tên file chung có số thứ tự
   (SP001-1.jpg, SP001-2.jpg), hoặc cột Ảnh trong bảng giá. Giá, tên, size, màu lấy từ bảng giá;
   không có bảng thì đọc giá ghi trong tên (vay-hoa-459k-1.jpg). */
let IMP=null,IMPURL=[],impT=0,WE=null;
const keyN=s=>norm(s).replace(/[^a-z0-9]+/g," ").trim();
const isImg=f=>/^image\//.test(f.type)||/\.(jpe?g|png|webp|heic|heif)$/i.test(f.name);
const CAM=/^(img|dsc|dscn|dcim|pxl|photo|image|screenshot|z\d|\d{8}[ _-]\d{6})/i;
const KRE=/(\d{1,4})(?:[.,](\d{1,3}))?\s*(k|nghìn|nghin|ngàn|ngan)(?![a-zà-ỹ])/i;
function priceIn(s,loose){
  s=String(s==null?"":s).trim();if(!s)return 0;let m,v=0;
  if(m=s.match(KRE))v=Math.round(parseFloat(m[1]+"."+(m[2]||"0"))*1000);
  else if(m=s.match(/(?:^|[^\d])(\d{1,3}(?:[.,]\d{3})+)(?!\d)/))v=+m[1].replace(/[.,]/g,"");
  else if(loose&&(m=s.match(/^\D{0,6}(\d{4,9})\s*(đ|d|vnd|₫)?\s*$/i)))v=+m[1];
  else if(m=s.match(/(?:^|[\s_\-])(\d{5,7})(?:\s*(?:đ|d|vnd|₫))?(?=$|[\s_\-])/i)){const n=+m[1];if(n%1000===0)v=n}
  return v>=1000&&v<=1e9?v:0;
}
function fromLabel(label){
  let s=String(label||"").replace(/_+/g," ").replace(/\s+/g," ").trim();const price=priceIn(s,0);
  s=s.replace(KRE," ").replace(/(^|[\s\-])\d{1,3}(?:[.,]\d{3})+(?:\s*(?:đ|d|vnd|₫))?(?=$|[\s\-])/i," ").replace(/(^|[\s\-])\d{5,7}(?:\s*(?:đ|d|vnd|₫))?(?=$|[\s\-])/i," ");
  let sku="";const m=s.match(/^\s*([A-Za-z]{1,4}[-]?\d{2,6})(?=$|[\s\-])/);if(m){sku=m[1].replace(/-/g,"").toUpperCase();s=s.slice(m[0].length)}
  s=s.replace(/-+/g," ").replace(/\s+/g," ").trim();
  return{price,sku,name:s?s[0].toUpperCase()+s.slice(1):""};
}
function fileInfo(f){
  const parts=String(f.webkitRelativePath||"").split("/").filter(Boolean),base=String(f.name).replace(/\.[^.]+$/,"");
  let stem=base,idx=0;const m=base.match(/^(.*?\S)(?:[\s_\-.]+\(?(\d{1,2})\)?|\s*\((\d{1,2})\))$/);
  if(m&&/[a-zà-ỹ]/i.test(m[1])){stem=m[1];idx=+(m[2]||m[3])}
  if(parts.length>=3){const dir=parts[parts.length-2];return{g:"d:"+keyN(dir),label:dir,idx,base:keyN(base),cam:false}}
  return{g:"f:"+keyN(stem),label:stem,idx,base:keyN(base),cam:CAM.test(base)};
}
function parseDelim(text){
  text=String(text||"").replace(/^﻿/,"");const first=text.split(/\r?\n/,1)[0]||"";
  const d=first.includes("\t")?"\t":first.split(";").length>first.split(",").length?";":",";
  const rows=[];let row=[],cell="",qq=false;
  for(let i=0;i<text.length;i++){const c=text[i];
    if(qq){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++}else qq=false}else cell+=c;continue}
    if(c==='"'&&cell==="")qq=true;else if(c===d){row.push(cell);cell=""}
    else if(c==="\n"||c==="\r"){if(c==="\r"&&text[i+1]==="\n")i++;row.push(cell);rows.push(row);row=[];cell=""}else cell+=c}
  if(cell!==""||row.length){row.push(cell);rows.push(row)}
  return rows.filter(r=>r.some(c=>String(c).trim()));
}
const COLS=[["sale",/giam|sale|khuyen mai/],["price",/gia|price/],["sku",/^ma\b|ma sp|ma san pham|sku|code|^id$/],["files",/(^|\s)(anh|hinh|file|image|photo)(\s|$)/],["name",/ten|name|san pham/],["sizes",/size|kich/],["colors",/mau|color/],["cat",/danh muc|loai|category|nhom/],["mat",/chat lieu|vai|material/],["desc",/mo ta|desc|ghi chu/]];
const COLN={sale:"Giá giảm",price:"Giá",sku:"Mã",files:"Ảnh",name:"Tên",sizes:"Size",colors:"Màu",cat:"Danh mục",mat:"Chất liệu",desc:"Mô tả"};
function readTable(rows){
  let hi=-1,map=null;
  for(let r=0;r<Math.min(rows.length,10)&&hi<0;r++){const m={};rows[r].forEach((c,i)=>{const h=norm(c).replace(/\s+/g," ").trim();if(!h)return;for(const[k,re]of COLS)if(re.test(h)){if(!(k in m))m[k]=i;break}});
    if(Object.keys(m).length>=2&&("price"in m||"name"in m||"sku"in m)){hi=r;map=m}}
  if(hi<0)return{err:"Chưa đọc được bảng. Dòng đầu bảng cần có tên cột như Mã, Tên, Giá, Size, Màu, Ảnh."};
  const out=[];
  for(let r=hi+1;r<rows.length;r++){const c=rows[r],g=k=>k in map?String(c[map[k]]==null?"":c[map[k]]).trim():"";
    const o={sku:g("sku").slice(0,40),name:g("name").slice(0,80),price:priceIn(g("price"),1),sale:priceIn(g("sale"),1),sizes:g("sizes"),colors:g("colors"),cat:g("cat").slice(0,30),mat:g("mat").slice(0,80),desc:g("desc").slice(0,400),
      files:g("files").split(/[,;\n]+/).map(x=>keyN(x.trim().replace(/\.[a-z0-9]{2,5}$/i,""))).filter(Boolean)};
    if(o.sku||o.name||o.files.length)out.push(o)}
  return{rows:out,cols:Object.keys(map)};
}
let XLS=null;
function loadXlsx(){return XLS||(XLS=new Promise((ok,no)=>{const sc=document.createElement("script");sc.src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";sc.onload=()=>window.XLSX?ok(window.XLSX):no({code:"xlsx"});sc.onerror=()=>{XLS=null;no({code:"xlsx"})};document.head.appendChild(sc)}))}
async function readSheetFile(f){
  if(/\.xlsx?$/i.test(f.name)){const X=await loadXlsx(),wb=X.read(new Uint8Array(await f.arrayBuffer()),{type:"array"});return parseDelim(X.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]],{FS:"\t",blankrows:false}))}
  return parseDelim(await f.text());
}
const colorHex=n=>{const k=keyN(n),hit=NAMED.find(([nm])=>keyN(nm)===k);return hit?hit[1]:""};
function planImport(){
  const T=IMP.table&&IMP.table.rows||[],bySku=new Map(),byName=new Map(),byFile=new Map();
  T.forEach((r,i)=>{if(r.sku)bySku.set(keyN(r.sku),i);if(r.name&&!byName.has(keyN(r.name)))byName.set(keyN(r.name),i);r.files.forEach(b=>byFile.set(b,i))});
  const G=new Map();
  for(const f of IMP.files){const fi=fileInfo(f);let key=fi.g,row=-1;if(byFile.has(fi.base)){row=byFile.get(fi.base);key="r:"+row}
    if(!G.has(key))G.set(key,{key,label:fi.label,items:[],row,cam:fi.cam});G.get(key).items.push({f,idx:fi.idx,base:fi.base})}
  const byRow=new Map(),groups=[];
  for(const g of G.values()){
    if(g.row<0){const k=keyN(g.label),tok=k.split(" ")[0],lab=fromLabel(g.label);
      g.row=bySku.has(k)?bySku.get(k):bySku.has(tok)?bySku.get(tok):lab.sku&&bySku.has(keyN(lab.sku))?bySku.get(keyN(lab.sku)):byName.has(k)?byName.get(k):-1}
    if(g.row>=0&&byRow.has(g.row)){byRow.get(g.row).items.push(...g.items);continue}
    if(g.row>=0)byRow.set(g.row,g);groups.push(g)}
  groups.sort((a,b)=>(a.row<0?1e9:a.row)-(b.row<0?1e9:b.row)||a.label.localeCompare(b.label,"vi",{numeric:true}));
  let extra=0,cam=0,nNew=0,nUpd=0,nHid=0,n=0;
  groups.forEach((g,gi)=>{
    g.items.sort((a,b)=>a.idx-b.idx||a.base.localeCompare(b.base,"vi",{numeric:true}));
    const r=g.row>=0?T[g.row]:null,lab=fromLabel(g.label),sku=(r&&r.sku)||lab.sku;
    g.ex=sku?PRODUCTS.find(p=>p.sku&&keyN(p.sku)===keyN(sku)):null;
    const room=MAX_PH-(g.ex&&g.ex.photos?g.ex.photos.length:0);if(g.items.length>room){extra+=g.items.length-Math.max(0,room);g.items=g.items.slice(0,Math.max(0,room))}
    const price=(r&&r.price)||lab.price||(g.ex?g.ex.price:0);
    g.info={sku,name:(r&&r.name)||(g.cam?"":lab.name)||(g.ex?g.ex.name:"")||(sku?"Sản phẩm "+sku:"Sản phẩm mới "+(gi+1)),price,sale:r&&r.sale&&r.sale<price?r.sale:0,r};
    if(g.cam&&!r)cam+=g.items.length;if(g.ex)nUpd++;else{nNew++;if(!(price>0))nHid++}n+=g.items.length;
  });
  return{groups:groups.filter(g=>g.items.length||g.ex),extra,cam,nNew,nUpd,nHid,n,unmatched:T.filter((r,i)=>!byRow.has(i))};
}
function impOpen(){if(busy())return;const lw=ls.get("fa_wm","");IMP={files:[],table:null,tname:"",paste:"",err:"",plan:null,lim:60,wm:DB.wm.some(w=>w.id===lw)?lw:""};
  $("#impB").innerHTML=`<div class="f">
  <div><div class="lbl" style="margin-top:0"><span>1. Ảnh sản phẩm</span></div><div class="opt"><label class="btn ghost sm2" for="impFiles">Chọn ảnh</label><label class="btn ghost sm2" for="impDir">Chọn thư mục</label><button class="lnk" data-a="impclear" id="impClr" hidden>Bỏ chọn</button></div><p class="sm mute" id="impFs" style="margin:6px 0 0"></p></div>
  <div><div class="lbl"><span>2. Bảng giá (không bắt buộc)</span></div><div class="opt"><label class="btn ghost sm2" for="impSheet">Chọn file Excel hoặc CSV</label><button class="lnk" data-a="impsheetx" id="impTx" hidden>Bỏ bảng</button></div>
  <textarea id="impPaste" rows="3" placeholder="Hoặc dán bảng từ Excel, Google Sheets vào đây" aria-label="Dán bảng giá"></textarea><p class="sm mute" id="impTs" style="margin:6px 0 0"></p></div>
  <div><div class="lbl"><span>3. Xóa watermark có sẵn (không bắt buộc)</span></div><select id="impWm" aria-label="Mẫu xóa watermark"></select>
  <div class="opt" style="margin-top:8px"><button class="btn ghost sm2" data-a="wmnew">Tạo mẫu từ ảnh đã chọn</button><button class="lnk" data-a="wmnew" data-e="1" id="impWmE" hidden>Sửa mẫu này</button></div><p class="sm mute" id="impWs" style="margin:6px 0 0"></p></div>
  <details class="hint"><summary>Cách đặt tên để trang tự gom ảnh đúng món</summary><ul class="facts">
  <li>Mỗi món một thư mục, tên thư mục là tên món, có thể kèm giá: <b>Váy hoa nhí 459k</b>. Chọn thư mục mẹ bằng nút Chọn thư mục (trên máy tính).</li>
  <li>Hoặc đặt tên file theo mã và số thứ tự: <b>SP001-1.jpg</b>, <b>SP001-2.jpg</b>, <b>SP002-1.jpg</b>. Có thể ghi tên và giá: <b>vay-hoa-nhi-459k-1.jpg</b>.</li>
  <li>Bảng giá: mỗi dòng một món. Cột Mã khớp với mã trong tên file, hoặc cột Ảnh ghi tên các file của món đó.</li>
  <li>Ảnh tên do máy ảnh đặt (IMG_1234.jpg) không cho biết thuộc món nào, nên mỗi ảnh thành một món riêng.</li></ul></details></div>
  <div id="impPrev"></div>`;
  updImp();$("#impB").scrollTop=0;show("imp");
}
function impThumbs(){IMPURL.forEach(u=>URL.revokeObjectURL(u));IMPURL=[]}
function updImp(){
  if(!IMP||!$("#impFs"))return;const I=IMP,nF=I.files.length,T=I.table;
  $("#impFs").textContent=nF?`Đã chọn ${nF} ảnh.`:"Chọn nhiều ảnh một lúc. Trên máy tính có thể chọn thư mục, mỗi thư mục con là một món.";$("#impFs").className="sm"+(nF?"":" mute");$("#impClr").hidden=!nF;
  const ts=$("#impTs");ts.className="sm "+(I.err?"bad":"mute");$("#impTx").hidden=!T&&!I.err;
  ts.textContent=I.err||(T?`Đọc được ${T.rows.length} dòng${I.tname?" từ "+I.tname:""}. Cột: ${T.cols.map(c=>COLN[c]).join(", ")}.`:"Cột nên có: Mã, Tên, Giá, Giá giảm, Size, Màu, Danh mục, Ảnh. Không có bảng thì trang đọc giá ghi trong tên file hoặc tên thư mục.");
  if(I.wm&&!wmById(I.wm))I.wm="";const sel=$("#impWm"),wmo=wmById(I.wm);
  sel.innerHTML='<option value="">Không xóa watermark</option>'+DB.wm.map(w=>`<option value="${esc(w.id)}">${esc(w.name)} (${esc(wmDesc(w))})</option>`).join("");sel.value=I.wm;$("#impWmE").hidden=!wmo;
  $("#impWs").textContent=wmo?(wmo.v===2?`Trước khi gán logo, trang xóa đúng từng điểm của watermark "${wmo.name}": chỗ mờ được tính ngược ra màu ảnh gốc, chỗ đặc do AI vẽ lại. Ảnh nào không có watermark này thì để nguyên. Chỉ dùng mẫu cho ảnh của đúng nhà sỉ đó.`
    :`"${wmo.name}" là mẫu cũ dạng khung chữ nhật: trang chỉ dò nét chữ trong từng khung, kém chính xác hơn. Nên bấm Sửa mẫu này để trang học lại chính xác từ các ảnh đã chọn.`)
    :"Ảnh của cùng một nhà sỉ thường có cùng một watermark. Chọn từ 10 ảnh của một nhà sỉ ở mục 1, bấm Tạo mẫu: trang so các ảnh để tìm chính xác từng điểm watermark, bạn xem lại rồi lưu. Lần sau chỉ cần chọn mẫu.";
  impThumbs();const pl=I.plan=nF?planImport():null,w=$("#impPrev");
  if(!pl){w.innerHTML="";$("#impF").innerHTML='<button class="btn ghost wide" data-a="close">Đóng</button>';return}
  const warn=[];
  if(pl.nHid)warn.push(["mute",`${pl.nHid} món chưa có giá sẽ để ẩn. Nhập giá rồi bỏ ẩn sau.`]);
  if(pl.cam)warn.push(["bad",`${pl.cam} ảnh có tên do máy ảnh đặt (IMG…), không biết thuộc món nào nên mỗi ảnh thành một món riêng.`]);
  if(pl.extra)warn.push(["bad",`${pl.extra} ảnh bị bỏ vì một món chỉ chứa tối đa ${MAX_PH} ảnh.`]);
  if(pl.unmatched.length)warn.push(["bad",`${pl.unmatched.length} dòng trong bảng không có ảnh khớp, chưa tạo: ${pl.unmatched.slice(0,5).map(r=>r.sku||r.name).join(", ")}${pl.unmatched.length>5?"…":""}.`]);
  const what=[pl.nNew?`${pl.nNew} món mới`:"",pl.nUpd?`${pl.nUpd} món đã có (cùng mã) sẽ được thêm ảnh và cập nhật`:""].filter(Boolean).join(", ");
  w.innerHTML=`<h2 class="asec">Xem trước</h2><p><b>Tìm thấy ${pl.groups.length} sản phẩm từ ${pl.n} ảnh.</b> ${what}.</p>${warn.map(x=>`<p class="sm ${x[0]}" style="margin:4px 0">${esc(x[1])}</p>`).join("")}
  <div class="alist" style="margin-top:12px">${pl.groups.slice(0,I.lim).map(g=>{const u=g.items[0]?URL.createObjectURL(g.items[0].f):"";if(u)IMPURL.push(u);const f=g.info,pills=[];
    pills.push(g.ex?'<span class="pill">Cập nhật</span>':f.price>0?'<span class="pill">Mới</span>':'<span class="pill warn">Chưa có giá</span>');pills.push(`<span class="pill">${g.items.length} ảnh</span>`);
    return `<div class="arow"><span class="th">${u?`<img class="ph" src="${u}" alt="">`:""}</span><span><b>${esc(f.name)}</b><span class="mute sm">${f.sku?esc(f.sku)+", ":""}${f.price?money(f.sale||f.price):"chưa có giá"}${f.sale?" (gốc "+money(f.price)+")":""}</span><span class="pills">${pills.join("")}</span></span></div>`}).join("")}</div>
  ${pl.groups.length>I.lim?`<div class="morew"><button class="btn ghost sm2" data-a="impmore">Xem thêm ${Math.min(60,pl.groups.length-I.lim)} món</button></div>`:""}`;
  $("#impF").innerHTML=pl.groups.length?`<button class="btn wide" data-a="impgo">${wmo?"Xóa watermark, gán logo":"Gán logo"}, ${[pl.nNew?`tạo ${pl.nNew} sản phẩm`:"",pl.nUpd?`cập nhật ${pl.nUpd} sản phẩm`:""].filter(Boolean).join(", ")}</button>`:'<button class="btn ghost wide" data-a="close">Đóng</button>';
}
async function impGo(){
  const pl=IMP&&IMP.plan;if(!pl||!pl.groups.length)return;const wm=wmById(IMP.wm)||null;closeAll();
  const tasks=[];pl.groups.forEach((g,gi)=>g.items.forEach((it,pi)=>tasks.push([gi,pi,it.f])));
  const res=pl.groups.map(()=>[]),dom=[];let wHit=0,wMiss=0,wErr=0,wAi=0,nPeople=0,nPad=0;
  /* nạp sẵn công cụ, mẫu, AI và bộ nhận diện người trước khi chạy song song */
  const F=await tools();
  if(F){F.detector();if(wm){if(wm.v===2){try{await wmTpl(wm)}catch(e){}}F.aiSession()}}
  else if(wm)toast("Chưa tải được công cụ xóa watermark (kiểm tra mạng). Ảnh vẫn được gán logo nhưng chưa xóa watermark.");
  await runJob(wm?"Đang xóa watermark và gán logo":"Đang gán logo cho ảnh",tasks,async([gi,pi,f],W)=>{const r=await processFile(f,W,wm);res[gi][pi]=r.ph;if(pi===0)dom[gi]=r.color;
      const i=r.info||{};if(wm){if(i.wm&&i.wm.err)wErr++;else if(i.wm&&i.wm.found){wHit++;if(i.wm.how==="ai")wAi++}else wMiss++}
      if(i.plan){nPeople++;if(i.plan.pl+i.plan.pr>1)nPad++}},ok=>{
    let id=Math.max(0,...PRODUCTS.map(p=>p.id)),nNew=0,nUpd=0,nHid=0;const fresh=[];
    pl.groups.forEach((g,gi)=>{
      const phs=res[gi].filter(Boolean),f=g.info,r=f.r;if(!phs.length&&!g.ex)return;
      const szs=r&&r.sizes?r.sizes.split(/[,;\/\s]+/).map(x=>x.trim().toUpperCase()).filter(Boolean).map(x=>/^FREE/.test(x)?"Freesize":x).slice(0,8):null;
      const cols=r&&r.colors?r.colors.split(/[,;\/]+/).map(x=>x.trim()).filter(Boolean).slice(0,8).map((n,i)=>[n.slice(0,30),colorHex(n)||(i===0&&dom[gi]?dom[gi][1]:"#b9a58f")]):null;
      if(g.ex){const p=g.ex;p.photos=(p.photos||[]).concat(phs).slice(0,MAX_PH);if(f.sku)p.sku=f.sku;
        if(r){if(r.name)p.name=r.name;if(r.price){p.price=r.price;if(f.sale)p.sale=f.sale;else delete p.sale}if(szs&&szs.length)p.sizes=szs;if(cols&&cols.length)p.colors=cols;if(r.cat)p.cat=r.cat;if(r.mat)p.mat=r.mat;if(r.desc)p.desc=r.desc}
        else if(f.price&&!p.price)p.price=f.price;nUpd++;return}
      const c=(r&&r.cat)||guessCat(f.name),p={id:++id,name:f.name.slice(0,80),cat:c,shape:c==="Áo"?"top":c==="Quần"?"pants":c==="Chân váy"?"skirt":c==="Set"?"set":"dress",price:f.price||0,sizes:szs&&szs.length?szs:["S","M","L"],colors:cols&&cols.length?cols:[dom[gi]||["Màu 1","#b9a58f"]],mat:r&&r.mat||"",desc:r&&r.desc||"",photos:phs};
      if(f.sku)p.sku=f.sku;if(f.sale)p.sale=f.sale;if(!(p.price>0)){p.hidden=true;nHid++}fresh.push(p);nNew++});
    PRODUCTS.unshift(...fresh);
    const wmTxt=wm?` Watermark: đã xóa trên ${wHit} ảnh${wAi?` (${wAi} ảnh có phần đặc do AI vẽ lại)`:""}${wMiss?`, ${wMiss} ảnh không thấy watermark của mẫu này nên để nguyên`:""}${wErr?`, ${wErr} ảnh lỗi khi xóa`:""}.`:"";
    const cropTxt=nPeople?` Cắt khung giữ trọn người mẫu ở ${nPeople} ảnh${nPad?` (${nPad} ảnh được nới nền hai bên để không cắt mất người)`:""}.`:"";
    return `Đã tạo ${nNew} sản phẩm${nUpd?`, cập nhật ${nUpd} sản phẩm`:""} từ ${ok} ảnh.${nHid?` ${nHid} món chưa có giá đang để ẩn.`:""}${wmTxt}${cropTxt} Xem lại rồi bấm Lưu để khách thấy.`},wm?2:3);
}
async function restampAll(){
  const items=[];PRODUCTS.forEach(p=>(p.photos||[]).forEach((ph,i)=>items.push([p.id,i])));
  if(!items.length)return toast("Chưa có ảnh sản phẩm nào");
  await runJob("Đang gán lại logo",items,async([pid,i],W)=>{const p=A_(pid);if(!p||!p.photos||!p.photos[i])return;const r=await restampOne(p.photos[i],W);if(p.photos[i])p.photos[i]=r},ok=>`Đã gán lại logo cho ${ok} ảnh.`);
}

/* ================= TRANG QUẢN TRỊ ================= */
let canEdit=false,checked=false,dirty=false,saving=false,atab="sp",ed=null,edNew=false,delArm=0,disArm=0,isAdm=false,mTouched=false,pend=0,aq="",alim=APAGE,cleanArm=0,ORPH=null;
const WAS_ADM=ss.get("fa_adm","")==="1";

function bar(msg){const b=$("#savebar");b.hidden=!dirty&&!msg;$("#saveMsg").textContent=msg||"Có thay đổi chưa lưu. Khách chưa thấy.";$("#discardB").textContent="Bỏ thay đổi";disArm=0}
function saveDraft(){
  if(!dirty){ls.del("fa_draft");ls.del("fa_dmedia");return}
  ls.set("fa_draft",{rev:BASE_REV,db:DB});if(mTouched){mTouched=false;if(!ls.set("fa_dmedia",MEDIA))ls.del("fa_dmedia")}
}
function restoreDraft(){
  const d=ls.get("fa_draft",null);if(!d||typeof d!=="object")return;
  if(d.rev!==BASE_REV){ls.del("fa_draft");ls.del("fa_dmedia");toast("Trang vừa được cập nhật ở nơi khác nên bản nháp cũ đã được bỏ.");return}
  const m=ls.get("fa_dmedia",null);DB=tidy(d.db);DB.rev=BASE_REV;if(m)MEDIA=tidyMedia(m);
  dirty=true;refreshAll();
}
function touch(){dirty=true;bind();saveDraft();bar()}
function prune(){
  const okP=r=>r[0]!=="d"||MEDIA.p[r.slice(2)];
  DB.vouchers=DB.vouchers.filter(v=>v.code);
  DB.products.forEach(p=>{if(p.img&&!MEDIA.p[p.img])delete p.img;if(p.photos){p.photos=p.photos.filter(x=>okP(x.s)).map(x=>okP(x.o)?x:Object.assign({},x,{o:x.s}));if(!p.photos.length)delete p.photos}});
  DB.wm=DB.wm.filter(w=>!w.m||okP(w.m));
  const used=new Set();DB.products.forEach(p=>{if(p.img)used.add(p.img);(p.photos||[]).forEach(x=>[x.s,x.o].forEach(r=>{if(r[0]==="d")used.add(r.slice(2))}))});
  DB.wm.forEach(w=>{if(w.m&&w.m[0]==="d")used.add(w.m.slice(2))});
  Object.keys(MEDIA.p).forEach(k=>{if(!used.has(k))delete MEDIA.p[k]});
}

/* ghi lại toàn bộ trang từ dữ liệu hiện có: đây là thứ được lưu khi bấm Lưu */
function dumpStore(d){
  const j=o=>JSON.stringify(o).replace(/</g,"\\u003c").replace(/\u2028/g,"\\u2028").replace(/\u2029/g,"\\u2029");
  const arr=a=>a.length?"[\n"+a.map(j).join(",\n")+"\n]":"[]";
  return '{"v":1,"rev":'+(+d.rev||0)+',\n"shop":'+j(d.shop)+',\n"brand":'+j(d.brand)+',\n"wm":'+j(d.wm)+',\n"vouchers":'+arr(d.vouchers)+',\n"looks":'+arr(d.looks)+',\n"products":'+arr(d.products)+'}';
}
function buildDoc(){
  const css=document.getElementById("css").textContent,js=document.getElementById("app").textContent,tpl=document.getElementById("tpl").innerHTML;
  const media=JSON.stringify(MEDIA).replace(/</g,"\\u003c");
  const t=esc(DB.shop.title||DB.shop.name),ds=esc(DB.shop.desc);
  return '<!DOCTYPE html>\n<html lang="vi">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<title>'+t+'</title>\n<meta name="description" content="'+ds+'">\n<meta property="og:title" content="'+t+'">\n<meta property="og:description" content="'+ds+'">\n<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link href="'+esc(FONTS)+'" rel="stylesheet">\n<script type="application/json" id="store">\n'+dumpStore(DB)+'\n<\/script>\n<style id="css">'+css+'</style>\n</head>\n<body>\n<template id="tpl">'+tpl+'</template>\n<script type="application/json" id="media">'+media+'<\/script>\n<script id="app">'+js+'<\/script>\n</body>\n</html>\n';
}
const SAVE_ERR={conflict:"Trang vừa được cập nhật ở nơi khác. Đang tải lại bản mới.",too_large:"Trang quá nặng để lưu. Hãy bớt ảnh nhúng trong trang rồi lưu lại.",rate_limited:"Bạn vừa lưu quá nhiều lần. Chờ một phút rồi lưu lại.",invalid_content:"Chưa lưu được vì nội dung trang có lỗi. Báo cho Claude mã lỗi invalid_content."};
const NO_WRITE=["not_writer","not_granted","not_declared","consent_required","capability_disabled","capability_removed"];
async function savepub(){
  if(saving||!dirty)return;
  if((JOB&&!JOB.end)||pend)return toast("Đang xử lý ảnh, chờ xong rồi lưu");
  saving=true;bar("Đang lưu…");
  const af=await use("artifact");
  if(!af){saving=false;bar("Chưa lưu được ở đây. Hãy đăng nhập quản trị lại.");return}
  prune();DB.rev=BASE_REV+1;let html="";
  try{html=buildDoc()}catch(e){DB.rev=BASE_REV;saving=false;bar("Chưa lưu được vì dữ liệu có lỗi.");return}
  try{
    ss.set("fa_after","saved");ls.del("fa_draft");ls.del("fa_dmedia");
    await af.publish(html);
    dirty=false;saving=false;ORIG=JSON.stringify(DB);ORIG_M=copyMedia(MEDIA);bar();toast("Đã lưu và đưa lên web");
  }catch(e){
    const c=e&&e.code||"upstream_error";DB.rev=BASE_REV;ss.del("fa_after");saving=false;mTouched=true;saveDraft();
    bar(NO_WRITE.includes(c)?"Tài khoản này chưa có quyền lưu trang. Hãy mở bằng tài khoản chủ trang.":SAVE_ERR[c]||"Chưa lưu được (mã "+c+"). Thử lại sau ít phút.");
  }
}
function discard(){
  if((JOB&&!JOB.end)||pend)return toast("Đang xử lý ảnh, chờ xong đã");
  if(!disArm){disArm=1;$("#discardB").textContent="Bấm lần nữa để bỏ";setTimeout(()=>{if(disArm){disArm=0;$("#discardB").textContent="Bỏ thay đổi"}},3500);return}
  DB=tidy(JSON.parse(ORIG));MEDIA=copyMedia(ORIG_M);LG=null;dirty=false;saveDraft();closeAll();refreshAll();if(isAdm)drawAdmin();toast("Đã bỏ các thay đổi chưa lưu");
}

/* ---- ba mục quản trị ---- */
function drawAdmin(){
  const b=$("#abody");
  if(!canEdit){$("#atabs").hidden=true;
    b.innerHTML=checked?`<form class="f" id="loginF" style="max-width:360px"><p class="mute">Nhập mật khẩu quản trị để chỉnh sửa cửa hàng.</p><label>Mật khẩu<input id="loginP" type="password" autocomplete="current-password" required></label><p class="sm bad" id="loginE" role="alert"></p><button class="btn" type="submit">Đăng nhập</button></form>`:`<p class="mute">Đang kiểm tra quyền chỉnh sửa…</p>`;
    const f=$("#loginF");if(f)f.onsubmit=async ev=>{ev.preventDefault();$("#loginE").textContent="";
      try{const r=await fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:$("#loginP").value})});
        if(r.ok){location.reload();return}$("#loginE").textContent=r.status===429?"Thử sai quá nhiều lần. Chờ vài phút rồi thử lại.":"Mật khẩu chưa đúng."}
      catch(e){$("#loginE").textContent="Chưa kết nối được máy chủ."}};
    return}
  $("#atabs").hidden=false;$$("#atabs .chip").forEach(c=>c.setAttribute("aria-pressed",c.dataset.t===atab));
  b.innerHTML=atab==="sp"?admProducts():atab==="shop"?admShop():admVouchers();
  if(atab==="sp")drawAList();if(atab==="shop")storage();
}
function admProducts(){
  const hid=PRODUCTS.filter(p=>p.hidden).length,nph=PRODUCTS.reduce((s,p)=>s+(p.photos||[]).length,0);
  return `<div class="abar"><span class="mute sm">${PRODUCTS.length} sản phẩm${hid?", "+hid+" đang ẩn":""}, ${nph} ảnh</span><span class="opt"><button class="btn ghost sm2" data-a="impopen">Nhập hàng loạt</button><button class="btn sm2" data-a="pnew">Thêm sản phẩm</button></span></div>
  <input class="aq" id="aq" type="search" placeholder="Tìm trong ${PRODUCTS.length} sản phẩm" value="${esc(aq)}" aria-label="Tìm sản phẩm trong quản trị"><div id="alistW"></div>`;
}
function drawAList(){
  const w=$("#alistW");if(!w)return;const qq=norm(aq),l=PRODUCTS.filter(p=>!qq||norm(p.name+" "+p.cat+" "+(p.sku||"")).includes(qq));
  w.innerHTML=(l.length?`<div class="alist">${l.slice(0,alim).map(p=>{const pr=priceOf(p),np=(p.photos||[]).length,pills=[];
    if(p.hidden)pills.push('<span class="pill off">Đang ẩn</span>');if(!p.price)pills.push('<span class="pill warn">Chưa có giá</span>');else if(pr<p.price)pills.push('<span class="pill">Đang giảm</span>');if(np)pills.push(`<span class="pill">${np} ảnh</span>`);
    return `<button class="arow" data-a="pedit" data-id="${p.id}"><span class="th">${pic(p,0)}</span><span><b>${esc(p.name||"Chưa đặt tên")}</b><span class="mute sm">${p.sku?esc(p.sku)+", ":""}${esc(p.cat)}, ${p.price?money(pr):"chưa có giá"}${pr<p.price?" (gốc "+money(p.price)+")":""}</span>${pills.length?`<span class="pills">${pills.join("")}</span>`:""}</span></button>`}).join("")}</div>`
   :`<p class="mute">${PRODUCTS.length?"Không có sản phẩm nào khớp.":"Chưa có sản phẩm nào. Bấm Thêm sản phẩm, hoặc Nhập hàng loạt để tạo nhiều món từ ảnh và bảng giá."}</p>`)
   +(l.length>alim?`<div class="morew"><button class="btn ghost sm2" data-a="amore">Xem thêm ${Math.min(APAGE,l.length-alim)} sản phẩm</button></div>`:"");
}
const SF=[["name","Tên shop"],["by","Dòng phụ dưới tên shop"],["notice","Dòng thông báo trên cùng"],["headline","Câu tiêu đề lớn"],["intro","Đoạn giới thiệu","t"],["phone","Số điện thoại và Zalo"],["zalo","Link Zalo, bắt đầu bằng https://"],["hours","Giờ làm việc"],["shipFee","Phí giao hàng (₫)","n"],["freeShip","Miễn phí giao hàng cho đơn từ (₫)","n"],["saleEnd","Giá giảm áp dụng đến hết ngày","d"],["bank","Thông tin chuyển khoản (để trống nếu gửi qua Zalo)"]];
function admShop(){
  const nph=PRODUCTS.reduce((s,p)=>s+(p.photos||[]).length,0),B=DB.brand;
  return '<div class="f">'+SF.map(f=>{const k=f[0],l=f[1],t=f[2],v=SHOP[k];
    if(t==="t")return `<label>${l}<textarea data-k="${k}" id="s_${k}" rows="3" maxlength="300">${esc(v)}</textarea></label>`;
    if(t==="n")return `<label>${l}<input data-k="${k}" id="s_${k}" type="number" inputmode="numeric" min="0" step="1000" value="${+v||0}"></label>`;
    if(t==="d")return `<label>${l}<input data-k="${k}" id="s_${k}" type="date" value="${esc(String(v).slice(0,10))}"></label>`;
    return `<label>${l}<input data-k="${k}" id="s_${k}" value="${esc(v)}" maxlength="200"></label>`}).join("")
  +`</div><h2 class="asec">Logo trên ảnh sản phẩm</h2><p class="sub">Mọi ảnh sản phẩm mới tự được cắt khung 4:5 và gán logo này ở chỗ đẹp nhất.</p>
  <div class="lgprev">${logoSrc()?`<img src="${esc(logoSrc())}" alt="Logo đang dùng">`:'<span class="mute">Chưa có logo</span>'}</div>
  <div class="f" style="margin-top:14px"><div><div class="lbl" style="margin-top:0"><span>Kiểu logo</span></div><div class="opt"><button class="o" data-a="bst" data-v="f" aria-pressed="${B.st==="f"}">Đầy đủ</button><button class="o" data-a="bst" data-v="s" aria-pressed="${B.st==="s"}">Chỉ chữ ${esc(SHOP.name)}</button></div></div>
  <label for="bsz"><span>Cỡ logo: <span id="bszV">${B.sz}</span>% bề ngang ảnh</span><input type="range" id="bsz" min="18" max="60" step="1" value="${B.sz}"></label></div>
  <p class="opt" style="margin-top:12px"><label class="btn ghost sm2" for="logoFile">Đổi logo</label>${MEDIA.logo?'<button class="btn ghost sm2" data-a="logoreset">Dùng logo gốc</button>':""}<button class="btn sm2" data-a="restamp"${nph?"":" disabled"}>Gán lại logo cho ${nph} ảnh</button></p>
  <p class="sm mute">Đổi kiểu, cỡ hoặc logo chỉ áp dụng cho ảnh mới. Bấm Gán lại để áp dụng cho ảnh đã có. Logo nên là file PNG nền trong suốt.</p>
  <h2 class="asec">Mẫu xóa watermark</h2><p class="sub">Mỗi nhà sỉ một mẫu. Tạo và chọn mẫu trong Nhập hàng loạt.</p>
  ${DB.wm.length?DB.wm.map((w,i)=>`<div class="vrow wmrow"><span><b>${esc(w.name)}</b> <span class="mute sm">${esc(wmDesc(w))}</span></span><button class="lnk" data-a="wmdel" data-i="${i}">Xóa mẫu</button></div>`).join(""):'<p class="sm mute">Chưa có mẫu nào.</p>'}
  <h2 class="asec">Kho ảnh</h2><p class="sm" id="stInfo">Đang kiểm tra…</p><p><button class="btn ghost sm2" data-a="clean" id="cleanB" hidden></button></p>
  <h2 class="asec">Ảnh bìa</h2><div class="covprev">${MEDIA.cover?`<img src="${MEDIA.cover}" alt="Ảnh bìa hiện tại">`:""}</div><p style="margin-top:10px"><label class="btn ghost sm2" for="covFile">Đổi ảnh bìa</label></p><p class="sm mute">Ảnh ngang, rộng từ 1400 px trở lên là đẹp nhất.</p>
  <h2 class="asec">Sao lưu</h2><p class="sm mute">Sao chép toàn bộ dữ liệu cửa hàng, không gồm ảnh, để lưu lại.</p><button class="btn ghost sm2" data-a="copydata">Sao chép dữ liệu</button><textarea class="out" id="dataOut" hidden readonly aria-label="Dữ liệu cửa hàng"></textarea>`;
}
function refsIn(db){const s=new Set();(db.products||[]).forEach(p=>(p.photos||[]).forEach(x=>[x.s,x.o].forEach(r=>{if(typeof r==="string"&&r[0]==="a")s.add(r.slice(2))})));
  (db.wm||[]).forEach(w=>{if(typeof w.m==="string"&&w.m[0]==="a")s.add(w.m.slice(2))});return s}
async function storage(){
  const el=$("#stInfo");if(!el)return;const a=await assets();
  if(!a){el.textContent="Kho ảnh chưa mở được, ảnh mới sẽ được nhúng thẳng vào trang (tối đa khoảng 60 ảnh).";return}
  try{const r=await a.list(),u=r.usage||{},mb=v=>(v/1048576).toFixed(v<1048576*10?1:0).replace(".",",");
    const used=refsIn(DB),saved=refsIn(JSON.parse(ORIG));ORPH=(r.assets||[]).filter(x=>!used.has(x.id)&&!saved.has(x.id)).map(x=>x.id);
    if(!$("#stInfo"))return;$("#stInfo").textContent=`Đang dùng ${u.files||0}${u.maxFiles?"/"+u.maxFiles:""} ảnh, ${mb(u.bytes||0)}${u.maxBytes?"/"+mb(u.maxBytes):""} MB. Mỗi ảnh sản phẩm chiếm 2 chỗ: bản gốc và bản đã gán logo.`;
    const b=$("#cleanB");b.hidden=!ORPH.length;b.textContent=`Dọn ${ORPH.length} ảnh không còn dùng`;cleanArm=0;
  }catch(e){if($("#stInfo"))$("#stInfo").textContent="Chưa đọc được kho ảnh: "+errText(e)}
}
function admVouchers(){
  const num=(k,i,v,ph,mx)=>`<input data-vk="${k}" data-i="${i}" id="v_${k}_${i}" type="number" inputmode="numeric" min="0"${mx?` max="${mx}"`:""} value="${v||""}" placeholder="${ph}">`;
  return '<p class="sub">Khách nhập mã ở giỏ hàng. Mỗi đơn dùng một mã.</p>'+DB.vouchers.map((v,i)=>`<div class="vrow f"><div class="two"><label>Mã<input data-vk="code" data-i="${i}" id="v_code_${i}" value="${esc(v.code)}" maxlength="20" autocapitalize="characters" placeholder="Ví dụ TET15"></label><label>Loại<select data-vk="type" data-i="${i}" id="v_type_${i}"><option value="pct"${v.ship?"":" selected"}>Giảm theo %</option><option value="ship"${v.ship?" selected":""}>Miễn phí giao hàng</option></select></label></div>
  <div class="two">${v.ship?"":`<label>Giảm (%)${num("pct",i,+v.pct,"10",90)}</label><label>Giảm tối đa (₫)${num("max",i,+v.max,"Không giới hạn")}</label>`}<label>Đơn tối thiểu (₫)${num("min",i,+v.min,"Không yêu cầu")}</label></div>
  <button class="lnk" data-a="vdel" data-i="${i}" style="justify-self:start">Xóa mã này</button></div>`).join("")+'<button class="btn ghost sm2" data-a="vadd">Thêm mã giảm giá</button>';
}

/* ---- sửa một sản phẩm ---- */
function drawEd(){
  const p=ed,cats=[...new Set([...CAT_ORDER,...PRODUCTS.map(x=>x.cat)])];
  $("#edT").textContent=edNew?"Thêm sản phẩm":"Sửa sản phẩm";$("#edDel").hidden=edNew;$("#edDel").textContent="Xóa sản phẩm";delArm=0;
  $("#edB").innerHTML=`<div class="f">
  <fieldset><legend>Ảnh sản phẩm</legend><div class="pgrid" id="pgrid"></div><p class="sm mute" style="margin:0">Ảnh tự cắt khung 4:5 và gán logo ở chỗ đẹp nhất. Bấm vào ảnh để dời logo hoặc tô xóa chữ.</p></fieldset>
  <label>Tên sản phẩm<input id="eName" value="${esc(p.name)}" maxlength="80"></label>
  <label>Mã sản phẩm<input id="eSku" value="${esc(p.sku||"")}" maxlength="40" placeholder="Ví dụ SP001, dùng để nhập hàng loạt"></label>
  <label>Danh mục<input id="eCat" list="catL" value="${esc(p.cat)}" maxlength="30"><datalist id="catL">${cats.map(c=>`<option value="${esc(c)}">`).join("")}</datalist></label>
  <div class="two"><label>Giá bán (₫)<input id="ePrice" type="number" inputmode="numeric" min="0" step="1000" value="${p.price||""}"></label><label>Giá khi giảm (₫)<input id="eSale" type="number" inputmode="numeric" min="0" step="1000" value="${p.sale||""}" placeholder="Để trống"></label></div>
  <fieldset><legend>Size đang bán</legend><div class="opt">${SIZE_OPTS.map(s=>`<button type="button" class="o" data-a="edsz" data-s="${s}" aria-pressed="${p.sizes.includes(s)}">${s}</button>`).join("")}</div></fieldset>
  <fieldset><legend>Màu</legend><div id="eCols" style="display:grid;gap:8px">${p.colors.map((c,i)=>`<div class="crow"><input type="color" class="cpick" value="${hex(c[1])}" aria-label="Chọn màu ${i+1}"><input class="cname" value="${esc(c[0])}" maxlength="30" aria-label="Tên màu ${i+1}">${p.colors.length>1?`<button type="button" class="x" data-a="edcolx" data-i="${i}" aria-label="Bỏ màu ${i+1}">×</button>`:"<span></span>"}</div>`).join("")}</div><button type="button" class="lnk" data-a="edcol" style="justify-self:start">Thêm màu</button></fieldset>
  <div class="two"><label>Kiểu hình minh họa<select id="eShape">${Object.keys(SHAPE_N).map(k=>`<option value="${k}"${k===p.shape?" selected":""}>${SHAPE_N[k]}</option>`).join("")}</select></label><label>Họa tiết<select id="ePat">${Object.keys(PAT_N).map(k=>`<option value="${k}"${k===(p.pat||"")?" selected":""}>${PAT_N[k]}</option>`).join("")}</select></label></div>
  <p class="sm mute" style="margin:-4px 0 0">Hình minh họa chỉ dùng khi sản phẩm chưa có ảnh.</p>
  <label>Chất liệu<input id="eMat" value="${esc(p.mat)}" maxlength="80"></label>
  <label>Mô tả<textarea id="eDesc" rows="3" maxlength="400">${esc(p.desc)}</textarea></label>
  <label>Nhãn nhỏ trên ảnh<input id="eTag" value="${esc(p.tag||"")}" maxlength="12" placeholder="Ví dụ: Mới"></label>
  <label class="rd"><input type="checkbox" id="eHide"${p.hidden?" checked":""}>Tạm ẩn khỏi cửa hàng</label>
  <p class="sm bad" id="eErr" role="alert"></p></div>`;
  drawPhotos();
}
function drawPhotos(){
  const g=$("#pgrid");if(!g||!ed)return;const ps=ed.photos||[];
  g.innerHTML=ps.map((x,i)=>`<button type="button" class="pth" data-a="phedit" data-i="${i}" aria-label="Chỉnh ảnh ${i+1}"><img src="${esc(refUrl(x.s))}" alt="">${i?"":'<span class="pmain">Ảnh chính</span>'}</button>`).join("")
   +(ed.img&&!ps.length&&MEDIA.p[ed.img]?`<span class="pth"><img src="${MEDIA.p[ed.img]}" alt="Ảnh cũ"></span>`:"")
   +(pend?`<span class="pth pend">Đang gán logo ${pend} ảnh…</span>`:"")
   +(ps.length+pend<MAX_PH?'<label class="pth padd" for="phFiles">Thêm ảnh</label>':"");
}
function readEd(){
  if(!ed||!$("#eName"))return;
  ed.name=$("#eName").value.trim();ed.cat=$("#eCat").value.trim()||"Khác";const sk=$("#eSku").value.trim();if(sk)ed.sku=sk;else delete ed.sku;
  ed.price=Math.max(0,Math.round(+$("#ePrice").value||0));const s=Math.round(+$("#eSale").value||0);if(s>0)ed.sale=s;else delete ed.sale;
  $$("#eCols .crow").forEach((r,i)=>{const c=ed.colors[i];if(!c)return;const h=r.querySelector(".cpick").value;if(h!==c[1])c.length=2;c[0]=r.querySelector(".cname").value.trim()||"Màu "+(i+1);c[1]=h});
  ed.shape=$("#eShape").value;const pt=$("#ePat").value;if(pt)ed.pat=pt;else delete ed.pat;
  ed.mat=$("#eMat").value.trim();ed.desc=$("#eDesc").value.trim();
  const tg=$("#eTag").value.trim();if(tg)ed.tag=tg;else delete ed.tag;
  if($("#eHide").checked)ed.hidden=true;else delete ed.hidden;
}
async function addPhotos(files){
  if(!ed)return;files=[...files].filter(f=>/^image\//.test(f.type)||/\.(jpe?g|png|webp|heic)$/i.test(f.name)).slice(0,MAX_PH-(ed.photos||[]).length-pend);
  if(!files.length)return toast("Mỗi sản phẩm tối đa "+MAX_PH+" ảnh");
  const tgt=ed,W=workCanvas();pend+=files.length;drawPhotos();
  for(const f of files){try{const r=await processFile(f,W);(tgt.photos=tgt.photos||[]).push(r.ph);
      if(tgt.photos.length===1&&tgt.colors.length===1&&/^(Be sữa|Mặc định|Màu 1)$/.test(tgt.colors[0][0])){tgt.colors=[r.color];if(ed===tgt&&$("#eCols")){const row=$("#eCols .crow");if(row){row.querySelector(".cpick").value=r.color[1];row.querySelector(".cname").value=r.color[0]}}}}
    catch(e){toast(errText(e))}pend--;if(ed===tgt)drawPhotos()}
}

/* ---- chỉnh một ảnh: dời logo, đổi màu, cỡ, tô xóa chữ ---- */
let PE=null,pvq=0;
function phDraw(){if(!PE||!PE.o)return;const c=$("#pvC");stampTo(PE.o,PE.m,c);if(PE.masked){const x=c.getContext("2d");x.save();x.globalAlpha=.5;x.drawImage(PE.mask,0,0);x.restore()}}
const reqDraw=()=>{if(pvq)return;pvq=requestAnimationFrame(()=>{pvq=0;phDraw()})};
function phUI(){
  if(!PE)return;const er=PE.mode==="erase";
  $$("#phMode .o").forEach(b=>b.setAttribute("aria-pressed",b.dataset.v===PE.mode));$("#phMove").hidden=er;$("#phErase").hidden=!er;
  $("#phHint").textContent=er?"Tô phủ lên chữ cần xóa (tô rộng hơn chữ một chút cũng được), rồi bấm Xóa chữ trong vùng tô. Trang tự dò đúng nét chữ, phần nền trong vùng tô giữ nguyên. Ảnh của nhà sỉ có nhiều ảnh thì dùng mẫu xóa watermark khi nhập hàng loạt sẽ chính xác hơn.":"Chạm hoặc kéo trên ảnh để đặt logo.";
  $("#phVar").innerHTML=["","o","l","d"].map(v=>`<button class="o" data-a="phvar" data-v="${v}" aria-pressed="${(PE.m.vm||"")===v}">${VNAME[v]}</button>`).join("");
  $("#phSz").value=Math.round(PE.m.w*100);$("#phUndo").hidden=!PE.undo;$("#phMain").hidden=!PE.i;$("#phDel").textContent=PE.del?"Bấm lần nữa để bỏ ảnh":"Bỏ ảnh này";
  $("#phDone").textContent="Xong";$("#phDone").disabled=false;
}
async function phOpen(i){
  readEd();const ph=ed&&ed.photos&&ed.photos[i];if(!ph)return;
  PE={i,o:null};show("phed");const c=$("#pvC"),x=c.getContext("2d");x.fillStyle="#ece7df";x.fillRect(0,0,OW,OH);
  try{await logoReady();const im=await loadImg(refUrl(ph.o)),o=cnv(OW,OH);o.getContext("2d").drawImage(im,0,0,OW,OH);if(!PE||PE.i!==i)return;
    const A=analyze(o),m=Object.assign({},ph.m);
    PE={i,o,A,m,alts:suggest(A,m.st,Math.round(m.w*100)),ai:-1,mask:cnv(OW,OH),masked:false,undo:null,oc:false,mc:false,mode:"move",del:0,drag:false,last:null};
    phUI();phDraw();
  }catch(e){toast(errText(e));PE=null;show("ed")}
}
function phPoint(e,first){
  const c=$("#pvC"),r=c.getBoundingClientRect(),px=(e.clientX-r.left)/r.width,py=(e.clientY-r.top)/r.height;
  if(PE.mode==="move"){PE.m.x=px;PE.m.y=py;PE.m.a=0;clampM(PE.m);PE.mc=true;PE.moved=true;reqDraw();return}
  const x=px*OW,y=py*OH,mx=PE.mask.getContext("2d"),bw=+$("#phBr").value||34;mx.fillStyle=mx.strokeStyle="#d6293e";mx.lineCap="round";mx.lineJoin="round";mx.lineWidth=bw;
  if(PE.last&&!first){mx.beginPath();mx.moveTo(PE.last[0],PE.last[1]);mx.lineTo(x,y);mx.stroke()}else{mx.beginPath();mx.arc(x,y,bw/2,0,Math.PI*2);mx.fill()}
  PE.last=[x,y];PE.masked=true;reqDraw();
}
async function phDone(){
  if(!PE||!PE.o)return;if(!PE.oc&&!PE.mc){PE=null;show("ed");return}
  const b=$("#phDone");b.disabled=true;b.textContent="Đang lưu ảnh…";const P0=PE,tgt=ed;
  try{let o=tgt.photos[P0.i].o;if(P0.oc)o=await putImg(await toBlob(P0.o,.9));const s2=cnv(OW,OH);stampTo(P0.o,P0.m,s2);const s=await putImg(await toBlob(s2,.85));
    if(tgt.photos[P0.i])tgt.photos[P0.i]={s,o,m:P0.m};if(PE===P0){PE=null;show("ed")}drawPhotos()}
  catch(e){toast(errText(e));if(PE===P0)phUI()}
}

/* ---------- điều khiển ---------- */
const openSheet=()=>{const s=$(".sheet.on");return s?s.id:""};
function show(id){$$(".sheet").forEach(s=>s.classList.toggle("on",s.id===id));$("#veil").classList.add("on");document.body.style.overflow="hidden"}
function closeAll(){$$(".sheet").forEach(s=>s.classList.remove("on"));$("#veil").classList.remove("on");document.body.style.overflow="";ed=null;PE=null;WE=null;if(IMP){impThumbs();IMP=null}}
const busy=()=>{if(JOB&&!JOB.end){toast("Đang xử lý ảnh hàng loạt, chờ xong đã");return true}return false};
const ACT={
  cat(d){cat=d.c;lim=PAGE;$$("#chips .chip").forEach(c=>c.setAttribute("aria-pressed",c.dataset.c===cat));render()},
  more(){lim+=PAGE;render()},
  pd(d){const p=P(d.id);if(!p)return;cur={p,ci:0,size:"",qty:1};drawPD();$("#pdB").scrollTop=0;show("pd")},
  wish(d){const id=+d.id;wish=wish.includes(id)?wish.filter(x=>x!==id):[...wish,id];ls.set("fl_wish",wish);render();drawSale();toast(wish.includes(id)?"Đã lưu vào Yêu thích":"Đã bỏ khỏi Yêu thích")},
  pc(d){cur.ci=+d.i;drawPD()},ps(d){cur.size=d.s;drawPD()},qty(d){cur.qty=Math.max(1,cur.qty+ +d.d);drawPD()},
  add(){if(!cur.size)return toast("Chọn size trước khi thêm vào giỏ");add(cur.p.id,cur.ci,cur.size,cur.qty);closeAll();toast("Đã thêm vào giỏ")},
  buy(){if(!cur.size)return toast("Chọn size trước khi mua");add(cur.p.id,cur.ci,cur.size,cur.qty);checkout();show("cart")},
  cart(){drawCart();show("cart")},
  ci(d){const k=+d.k;if(!cart[k])return;if(d.d==="x")cart.splice(k,1);else{cart[k].qty+= +d.d;if(cart[k].qty<1)cart.splice(k,1)}ls.set("fl_cart",cart);badge();drawCart()},
  vc(){const v=$("#vcI").value.trim().toUpperCase();if(v&&!VOUCHERS[v]){code="";drawCart();const m=$("#vcM");m.textContent="Mã "+v+" không đúng hoặc đã hết hạn";m.className="sm bad";return}code=v;drawCart()},
  co(){checkout();$("#cartB").scrollTop=0},back(){drawCart()},place(){place()},
  async copy(){try{await navigator.clipboard.writeText(lastTxt);toast("Đã sao chép đơn hàng")}catch(e){$("#oT").select();toast("Nhấn giữ vào nội dung để sao chép")}},
  chat(){show("chat");if(!$("#msgs").children.length)greet()},
  q(d){ask(d.t)},send(){const i=$("#chI"),t=i.value.trim();if(t){i.value="";ask(t)}},
  sz(){ACT.chat();ask("Tư vấn size")},
  look(d){const l=LOOKS[+d.i];if(!l)return;l.ids.forEach((id,j)=>add(id,0,$("#lk"+d.i+"_"+j).value,1));drawCart();show("cart");toast("Đã thêm cả bộ vào giỏ")},
  fav(){closeAll();ACT.cat({c:"Yêu thích"});$("#shop").scrollIntoView()},
  close(){if(openSheet()==="phed")return ACT.phclose();if(openSheet()==="wmed")return ACT.wmclose();if(pend&&openSheet()==="ed")return toast("Đang gán logo cho ảnh, chờ xong rồi đóng");closeAll()},top(){closeAll();scrollTo({top:0})},
  /* quản trị */
  adm(){location.hash="quan-tri"},shopview(){location.hash="cua-hang"},
  atab(d){atab=d.t;drawAdmin();scrollTo(0,0)},
  amore(){alim+=APAGE;drawAList()},
  pnew(){if(busy())return;edNew=true;ed={id:Math.max(0,...PRODUCTS.map(p=>p.id))+1,name:"",cat:"Váy",shape:"dress",price:0,sizes:["S","M","L"],colors:[["Be sữa","#d9c2a3"]],mat:"",desc:"",photos:[]};drawEd();$("#edB").scrollTop=0;show("ed")},
  pedit(d){if(busy())return;const p=A_(d.id);if(!p)return;const c=JSON.parse(JSON.stringify(p));closeAll();edNew=false;ed=c;drawEd();$("#edB").scrollTop=0;show("ed")},
  edsz(d){readEd();const i=ed.sizes.indexOf(d.s);i<0?ed.sizes.push(d.s):ed.sizes.splice(i,1);ed.sizes.sort((a,b)=>SIZE_OPTS.indexOf(a)-SIZE_OPTS.indexOf(b));drawEd()},
  edcol(){readEd();if(ed.colors.length<8)ed.colors.push(["Màu mới","#b9a58f"]);drawEd()},
  edcolx(d){readEd();if(ed.colors.length>1)ed.colors.splice(+d.i,1);drawEd()},
  eddone(){
    if(pend)return toast("Đang gán logo cho ảnh, chờ xong đã");
    readEd();const e=m=>{$("#eErr").textContent=m};
    if(ed.name.length<2)return e("Nhập tên sản phẩm.");
    if(!ed.hidden&&!(ed.price>0))return e("Nhập giá bán lớn hơn 0, hoặc tích Tạm ẩn nếu chưa có giá.");
    if(ed.sale&&ed.sale>=ed.price)return e("Giá khi giảm phải thấp hơn giá bán.");
    if(!ed.sizes.length)return e("Chọn ít nhất một size.");
    if(ed.sku&&PRODUCTS.some(p=>p.id!==ed.id&&p.sku&&keyN(p.sku)===keyN(ed.sku)))return e("Mã này đã dùng cho sản phẩm khác.");
    if(ed.photos&&!ed.photos.length)delete ed.photos;if(ed.photos)delete ed.img;
    const i=PRODUCTS.findIndex(p=>p.id===ed.id);i<0?PRODUCTS.unshift(ed):PRODUCTS[i]=ed;
    const n=edNew;closeAll();touch();drawAdmin();toast(n?"Đã thêm vào bản nháp":"Đã cập nhật bản nháp");
  },
  eddel(){
    if(pend)return toast("Đang gán logo cho ảnh, chờ xong đã");
    if(!delArm){delArm=1;$("#edDel").textContent="Bấm lần nữa để xóa";return}
    const i=PRODUCTS.findIndex(p=>p.id===ed.id);if(i>=0)PRODUCTS.splice(i,1);closeAll();touch();drawAdmin();toast("Đã xóa khỏi bản nháp");
  },
  phedit(d){phOpen(+d.i)},
  phclose(){PE=null;show("ed")},
  phdone(){phDone()},
  phmode(d){if(!PE||!PE.o)return;PE.mode=d.v;phUI()},
  phvar(d){if(!PE||!PE.o)return;PE.m.vm=d.v;if(!d.v)fixVariant(PE.A,PE.m);PE.mc=true;phUI();phDraw()},
  phalt(){if(!PE||!PE.o||!PE.alts.length)return;PE.ai=(PE.ai+1)%PE.alts.length;const a=PE.alts[PE.ai];PE.m=Object.assign({},a,{vm:PE.m.vm});PE.mc=true;phUI();phDraw()},
  /* xóa chữ trong vùng tô: trang dò đúng nét chữ trong vùng (không xóa cả vùng), tính ngược hoặc để AI vẽ lại đúng các nét đó */
  async pherase(){if(!PE||!PE.o||PE.busy)return;if(!PE.masked)return toast("Tô lên chữ cần xóa trước");
    const P0=PE,b=$("#phEraseB");P0.busy=true;b.disabled=true;b.textContent="Đang xóa…";
    const F=await tools();
    if(!F||PE!==P0){P0.busy=false;b.disabled=false;b.textContent="Xóa chữ trong vùng tô";if(!F)toast("Chưa tải được công cụ xóa chữ. Kiểm tra mạng rồi thử lại.");return}
    const u=cnv(OW,OH);u.getContext("2d").drawImage(P0.o,0,0);
    const md=c2d(P0.mask).getImageData(0,0,OW,OH).data,br=new Uint8Array(OW*OH);for(let i=0;i<br.length;i++)br[i]=md[i*4+3]>16?1:0;
    let r=null;try{r=await F.removeBrush(P0.o,br)}catch(e){r=null}
    P0.busy=false;b.disabled=false;b.textContent="Xóa chữ trong vùng tô";if(PE!==P0)return;
    if(!r||!r.changed){toast(r?"Không thấy nét chữ nào khác nền trong vùng tô. Tô sát chữ hơn rồi thử lại.":"Có lỗi khi xóa, thử lại.");return}
    P0.undo=u;P0.mask.getContext("2d").clearRect(0,0,OW,OH);P0.masked=false;P0.oc=true;P0.A=analyze(P0.o);
    if(P0.m.a){P0.alts=suggest(P0.A,P0.m.st,Math.round(P0.m.w*100));P0.m=Object.assign({},P0.alts[0],{vm:P0.m.vm});P0.ai=0}else fixVariant(P0.A,P0.m);P0.mc=true;phUI();phDraw();
    toast(r.how==="ai"?"Đã xóa đúng các nét chữ, phần chữ đặc do AI vẽ lại":"Đã xóa đúng các nét chữ trong vùng tô")},
  phmaskx(){if(!PE||!PE.o)return;PE.mask.getContext("2d").clearRect(0,0,OW,OH);PE.masked=false;phDraw()},
  phundo(){if(!PE||!PE.undo)return;PE.o=PE.undo;PE.undo=null;PE.A=analyze(PE.o);fixVariant(PE.A,PE.m);phUI();phDraw()},
  phmain(){if(!PE||!PE.i)return;const a=ed.photos.splice(PE.i,1)[0];ed.photos.unshift(a);PE.i=0;phUI();drawPhotos();toast("Đã đặt làm ảnh chính")},
  phdel(){if(!PE)return;if(!PE.del){PE.del=1;phUI();return}ed.photos.splice(PE.i,1);PE=null;show("ed");drawPhotos()},
  impopen(){impOpen()},
  impclear(){if(!IMP)return;IMP.files=[];IMP.lim=60;updImp()},
  impsheetx(){if(!IMP)return;IMP.table=null;IMP.tname="";IMP.err="";IMP.paste="";$("#impPaste").value="";updImp()},
  impmore(){if(!IMP)return;IMP.lim+=60;updImp()},
  impgo(){impGo()},
  wmnew(d){wmOpen(!!d.e)},
  wmclose(){if(WE&&WE.busy)return toast("Đang xử lý, chờ một chút");WE=null;if(IMP){show("imp");updImp()}else closeAll()},
  wmauto(){wmAuto()},
  wmtest(){if(!WE||WE.busy)return;if(WE.test){WE.test=false;wmUI();wmDraw()}else wmTestView()},
  wmnext(){if(!WE||WE.busy||WE.files.length<2)return;WE.fi=(WE.fi+1)%WE.files.length;wmLoad()},
  wmmode(d){if(!WE||WE.busy)return;WE.mode=d.v;WE.test=false;wmUI();wmDraw()},
  wmclr(){if(!WE||WE.busy)return;[WE.add,WE.cut].forEach(c=>c&&c.getContext("2d").clearRect(0,0,c.width,c.height));WE.painted=false;wmUI();wmDraw()},
  wmsave(){wmSave()},
  wmdel(d){const w=DB.wm[+d.i];if(!w)return;DB.wm.splice(+d.i,1);touch();drawAdmin();toast("Đã xóa mẫu "+w.name)},
  jobstop(){if(JOB&&!JOB.end){JOB.stop=true;jobUI();toast("Sẽ dừng sau các ảnh đang làm dở")}},
  jobok(){JOB=null;jobUI()},
  bst(d){DB.brand.st=d.v==="s"?"s":"f";touch();drawAdmin()},
  restamp(){restampAll()},
  logoreset(){MEDIA.logo="";LG=null;mTouched=true;touch();drawAdmin();toast("Đã dùng lại logo gốc")},
  async clean(){
    if(!ORPH||!ORPH.length)return;
    if(!cleanArm){cleanArm=1;$("#cleanB").textContent=`Bấm lần nữa để xóa vĩnh viễn ${ORPH.length} ảnh`;return}
    const a=await assets();if(!a)return;const ids=ORPH;ORPH=null;$("#cleanB").hidden=true;let n=0;
    for(const id of ids){try{await a.delete(id);n++}catch(e){}}toast(`Đã dọn ${n} ảnh`);storage();
  },
  vadd(){DB.vouchers.push({code:"",pct:10});touch();drawAdmin()},
  vdel(d){DB.vouchers.splice(+d.i,1);touch();drawAdmin()},
  async copydata(){const t=dumpStore(DB);try{await navigator.clipboard.writeText(t);toast("Đã sao chép dữ liệu")}catch(e){const o=$("#dataOut");o.hidden=false;o.value=t;o.select();toast("Nhấn giữ vào nội dung để sao chép")}},
  savepub(){savepub()},discard(){discard()}
};
document.addEventListener("click",e=>{const b=e.target.closest("[data-a]");if(b&&!b.disabled&&ACT[b.dataset.a])ACT[b.dataset.a](b.dataset)});
document.addEventListener("keydown",e=>{if(e.key==="Escape")ACT.close();if(e.key==="Enter"&&e.target.id==="chI")ACT.send();if(e.key==="Enter"&&e.target.id==="vcI")ACT.vc()});
$("#q").addEventListener("input",e=>{q=norm(e.target.value.trim());lim=PAGE;render()});
$("#sort").addEventListener("change",e=>{sort=e.target.value;lim=PAGE;render()});
document.addEventListener("input",e=>{
  const t=e.target;
  if(t.id==="aq"){aq=t.value;alim=APAGE;drawAList()}
  else if(t.id==="impPaste"&&IMP){clearTimeout(impT);impT=setTimeout(()=>{if(!IMP)return;IMP.paste=t.value;const tx=t.value.trim();if(tx){const r=readTable(parseDelim(tx));IMP.err=r.err||"";IMP.table=r.err?null:r;IMP.tname=""}else{IMP.err="";IMP.table=null}updImp()},350)}
  else if(t.id==="bsz"){$("#bszV").textContent=t.value}
  else if(t.id==="phSz"&&PE&&PE.o){PE.m.w=+t.value/100;clampM(PE.m);if(!PE.m.vm)fixVariant(PE.A,PE.m);PE.mc=true;reqDraw()}
});
/* ---------- mẫu xóa watermark theo nhà sỉ ----------
   Trang so nhiều ảnh của cùng nhà sỉ để học CHÍNH XÁC từng điểm watermark (độ đục và màu), xem src/imgtools.js.
   Kết quả tô đỏ lên ảnh (đậm nhạt theo độ đục). Chủ shop có thể tô chỗ bị sót hoặc chỗ nhận nhầm rồi tìm lại,
   xem thử trước/sau ở cỡ phóng to, rồi lưu. Mẫu lưu thành một ảnh PNG trong kho ảnh, dữ liệu cửa hàng chỉ giữ đường dẫn. */
const wmById=id=>DB.wm.find(w=>w.id===id);
const wmDesc=w=>w.v===2?`học từ ${w.n||"nhiều"} ảnh`:`mẫu cũ, ${(w.r||[]).length} khung`;
const wmPick=(fs,n)=>{if(fs.length<=n)return fs.slice();const o=[];for(let i=0;i<n;i++)o.push(fs[Math.floor(i*fs.length/n)]);return o};
async function wmOpen(edit){
  if(!IMP)return;const w=edit?wmById(IMP.wm):null;
  if(!IMP.files.length&&!w)return toast("Chọn ảnh của nhà sỉ đó ở mục 1 trước");
  WE={files:wmPick(IMP.files,40),fi:0,id:w?w.id:"",old:w&&!w.v,tpl:null,meta:null,n:0,test:false,base:null,view:null,mode:"view",add:null,cut:null,painted:false,msg:"",busy:false,prog:0,last:null,drag:false};
  $("#wmName").value=w?w.name:"";show("wmed");$("#wmB").scrollTop=0;wmUI();
  if(w&&w.v===2){try{WE.tpl=await wmTpl(w);WE.meta=w;WE.n=w.n||0;WE.msg=`Mẫu đã lưu, học từ ${w.n||"nhiều"} ảnh.`}catch(e){WE.msg="Chưa đọc được mẫu đã lưu."}}
  else if(WE.old)WE.msg="Mẫu cũ dạng khung chữ nhật. Trang sẽ tìm lại chính xác từng nét từ các ảnh đã chọn.";
  await wmLoad();
  if(WE&&!WE.tpl&&WE.files.length)wmAuto();
}
/* ảnh xem trước (rộng 800) và hai lớp tô sửa cùng cỡ */
async function wmLoad(){
  const W0=WE;if(!W0)return;W0.view=null;W0.test=false;
  if(!W0.files.length){W0.base=null;return wmUI()}
  let b;try{b=await decode(W0.files[W0.fi])}catch(e){W0.msg="Không đọc được ảnh này.";return wmUI()}
  if(WE!==W0){if(b.close)b.close();return}
  const iw=b.naturalWidth||b.width,ih=b.naturalHeight||b.height,cw=800,ch=Math.max(200,Math.min(2000,Math.round(cw*ih/iw))),c=cnv(cw,ch),x=c2d(c);
  x.imageSmoothingQuality="high";x.drawImage(b,0,0,cw,ch);if(b.close)b.close();
  W0.base=c;W0.iw=iw;W0.ih=ih;
  if(!W0.add||W0.add.width!==cw||W0.add.height!==ch){W0.add=cnv(cw,ch);W0.cut=cnv(cw,ch);W0.painted=false}
  const C=$("#wmC");C.width=cw;C.height=ch;wmUI();wmDraw();
}
function wmDraw(){
  if(!WE||!WE.base)return;const C=$("#wmC"),x=C.getContext("2d"),W=C.width,H=C.height;
  if(WE.test&&WE.view){C.width=WE.view.width;C.height=WE.view.height;C.getContext("2d").drawImage(WE.view,0,0);return}
  if(C.width!==WE.base.width||C.height!==WE.base.height){C.width=WE.base.width;C.height=WE.base.height}
  x.drawImage(WE.base,0,0);
  if(WE.tpl&&window.FAIMG)FAIMG.overlayPreview(C,WE.tpl);
  if(WE.painted){x.save();x.globalAlpha=.45;x.drawImage(WE.add,0,0);x.drawImage(WE.cut,0,0);x.restore()}
}
function wmUI(){
  if(!WE)return;const n=WE.files.length,bar=$("#wmBar");
  bar.hidden=!WE.busy;bar.firstElementChild.style.width=Math.round((WE.prog||0)*100)+"%";
  let s=WE.msg||"";
  if(!WE.busy&&!WE.tpl&&!s)s=n?"Chưa có mẫu.":"Chọn ảnh của nhà sỉ ở mục 1 để trang tìm watermark.";
  if(!WE.busy&&WE.tpl&&!WE.test)s+=(s?" ":"")+"Chỗ tô đỏ là watermark trang tìm được (đậm là đặc, nhạt là mờ). Bấm Ảnh khác để kiểm tra, Xem thử để so trước và sau.";
  if(n&&n<10&&!WE.busy)s+=` Đang có ${n} ảnh. Từ 10 ảnh trở lên trang tìm chính xác hơn.`;
  $("#wmS").textContent=s;
  $("#wmTest").textContent=WE.test?"Quay lại xem chỗ tìm được":"Xem thử sau khi xóa";$("#wmTest").disabled=WE.busy||!WE.tpl||!n;
  const nx=$("#wmNext");nx.hidden=n<2;nx.textContent=`Ảnh khác (${WE.fi+1}/${n})`;nx.disabled=WE.busy;
  $$("#wmTools .o").forEach(b=>{b.setAttribute("aria-pressed",b.dataset.v===WE.mode);b.disabled=WE.busy||!n});
  $("#wmRe").disabled=WE.busy||n<5;$("#wmRe").textContent=WE.painted?"Tìm lại theo chỗ đã tô":"Tìm lại";$("#wmClr").hidden=!WE.painted;
  $("#wmC").style.cursor=WE.mode==="view"?"default":"crosshair";
}
/* hai lớp tô (cỡ ảnh xem trước) -> mặt nạ ở cỡ ảnh gốc mà trang học */
function wmMask(c){if(!WE.painted)return null;const d=c2d(c).getImageData(0,0,c.width,c.height).data;let any=false;for(let i=3;i<d.length;i+=4)if(d[i]>40){any=true;break}return any?c:null}
async function wmAuto(){
  const W0=WE;if(!W0||W0.busy)return;
  if(W0.files.length<5){W0.msg="Cần ít nhất 5 ảnh của cùng nhà sỉ (nên từ 10 ảnh) để trang tìm chính xác.";return wmUI()}
  const F=await tools();if(!F){W0.msg="Chưa tải được công cụ tìm watermark. Kiểm tra mạng rồi thử lại.";return wmUI()}
  W0.busy=true;W0.test=false;W0.prog=0;W0.msg="Đang so các ảnh để tìm watermark…";wmUI();wmDraw();
  let r;try{r=await F.learnTemplate(W0.files,{addC:wmMask(W0.add),cutC:wmMask(W0.cut),onProgress:(t,p)=>{if(WE!==W0)return;W0.prog=p;W0.msg=t+"…";wmUI()}})}catch(e){r={ok:false,code:"err"}}
  if(WE!==W0)return;W0.busy=false;W0.view=null;
  if(r.ok){W0.tpl=r.tpl;W0.n=r.n;W0.meta=null;const px=r.tpl.a.reduce((s,a)=>s+(a>0),0);
    W0.msg=`Đã so ${r.n} ảnh cùng khổ ${r.rw}×${r.rh}, tìm thấy watermark gồm ${px.toLocaleString("vi-VN")} điểm ảnh.`}
  else W0.msg=r.code==="few"?`Cần ít nhất ${r.need||5} ảnh cùng khổ của một nhà sỉ, đang có ${r.n}.`:r.code==="none"?`Đã so ${r.n} ảnh nhưng không thấy dấu nào lặp lại đúng một chỗ. Có thể nhà sỉ đặt watermark mỗi ảnh một chỗ: hãy xóa tay từng ảnh trong khung Chỉnh ảnh.`:"Có lỗi khi tìm watermark, thử lại.";
  wmUI();wmDraw();
}
/* xem thử: vùng watermark của ảnh đang xem ở cỡ thật, trên là trước, dưới là sau khi xóa */
async function wmTestView(){
  const W0=WE;if(!W0||!W0.tpl||W0.busy)return;const F=await tools();if(!F)return;
  W0.busy=true;W0.msg="Đang xóa thử trên ảnh này…";wmUI();
  try{const b=await decode(W0.files[W0.fi]),iw=b.naturalWidth||b.width,ih=b.naturalHeight||b.height,k=Math.min(1,3200/Math.max(iw,ih)),c=cnv(Math.round(iw*k),Math.round(ih*k));
    c2d(c).drawImage(b,0,0,c.width,c.height);if(b.close)b.close();const before=cnv(c.width,c.height);before.getContext("2d").drawImage(c,0,0);
    const T=W0.tpl,r=await F.applyTemplate(c,T);
    const sx=c.width/T.rw,sy=c.height/T.rh,m=24,x0=Math.max(0,Math.floor(T.x*sx)-m),y0=Math.max(0,Math.floor(T.y*sy)-m),x1=Math.min(c.width,Math.ceil((T.x+T.w)*sx)+m),y1=Math.min(c.height,Math.ceil((T.y+T.h)*sy)+m);
    const bw=x1-x0,bh=y1-y0,z=Math.min(800/bw,3),vw=Math.round(bw*z),vh=Math.round(bh*z),v=cnv(vw,vh*2+6),vx=v.getContext("2d");
    vx.fillStyle="#c9a57a";vx.fillRect(0,0,vw,vh*2+6);vx.imageSmoothingQuality="high";vx.drawImage(before,x0,y0,bw,bh,0,0,vw,vh);vx.drawImage(c,x0,y0,bw,bh,0,vh+6,vw,vh);
    if(WE!==W0)return;W0.view=v;W0.test=true;
    W0.msg=r.found?`Trên: trước. Dưới: sau khi xóa${r.how==="ai"?" (phần watermark đặc do AI vẽ lại)":""}. Phóng to ${z.toFixed(1).replace(".",",")} lần.`:"Ảnh này không thấy watermark của mẫu, khi nhập hàng sẽ để nguyên ảnh.";
  }catch(e){if(WE===W0)W0.msg="Chưa xóa thử được ảnh này."}
  if(WE!==W0)return;W0.busy=false;wmUI();wmDraw();
}
async function wmSave(){
  if(!WE||!IMP||WE.busy)return;if(!WE.tpl)return toast("Chưa có mẫu. Chờ trang tìm xong watermark");
  const name=$("#wmName").value.trim().slice(0,40)||"Nhà sỉ "+(DB.wm.length+1);let w=WE.id&&wmById(WE.id);
  if(!w&&DB.wm.length>=30)return toast("Tối đa 30 mẫu, hãy xóa bớt mẫu cũ");
  let meta=WE.meta;
  if(!meta){const F=await tools();if(!F)return toast("Chưa tải được công cụ, thử lại");WE.busy=true;WE.msg="Đang lưu mẫu…";wmUI();
    try{const T=WE.tpl,blob=await new Promise((ok,no)=>F.tplToCanvas(T).toBlob(b=>b?ok(b):no({code:"encode"}),"image/png")),m=await putPng(blob);
      meta={v:2,m,rw:T.rw,rh:T.rh,x:T.x,y:T.y,w:T.w,h:T.h,n:WE.n||0};WMT.set((w?w.id:"")+"|"+m,Promise.resolve(T))}
    catch(e){WE.busy=false;WE.msg="Chưa lưu được mẫu: "+errText(e);return wmUI()}
    WE.busy=false}
  if(w){Object.keys(w).forEach(k=>{if(k!=="id")delete w[k]});Object.assign(w,{name},meta)}
  else{w=Object.assign({id:"w"+Date.now().toString(36),name},meta);DB.wm.push(w)}
  WMT.set(w.id+"|"+w.m,Promise.resolve(WE.tpl));
  IMP.wm=w.id;ls.set("fa_wm",w.id);WE=null;touch();show("imp");updImp();toast("Đã lưu mẫu "+name);
}
/* tô sửa trên ảnh xem trước: xanh = chỗ bị sót (trang tìm kỹ hơn ở đó), xanh dương = chỗ nhận nhầm (trang bỏ qua) */
const wc=$("#wmC");
function wmPaint(e,first){
  const r=wc.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*WE.base.width,y=(e.clientY-r.top)/r.height*WE.base.height,c=WE.mode==="add"?WE.add:WE.cut,g=c.getContext("2d"),bw=Math.max(10,WE.base.width*.035);
  g.strokeStyle=g.fillStyle=WE.mode==="add"?"#2fbf71":"#2f6fdf";g.lineCap="round";g.lineJoin="round";g.lineWidth=bw;
  if(WE.last&&!first){g.beginPath();g.moveTo(WE.last[0],WE.last[1]);g.lineTo(x,y);g.stroke()}else{g.beginPath();g.arc(x,y,bw/2,0,Math.PI*2);g.fill()}
  WE.last=[x,y];WE.painted=true;wmDraw();
}
wc.addEventListener("pointerdown",e=>{if(!WE||!WE.base||WE.busy||WE.mode==="view"||WE.test)return;e.preventDefault();try{wc.setPointerCapture(e.pointerId)}catch(_){}WE.drag=true;WE.last=null;wmPaint(e,true)});
wc.addEventListener("pointermove",e=>{if(WE&&WE.drag)wmPaint(e,false)});
["pointerup","pointercancel"].forEach(t=>wc.addEventListener(t,()=>{if(!WE||!WE.drag)return;WE.drag=false;WE.last=null;wmUI()}));
const pv=$("#pvC");
pv.addEventListener("pointerdown",e=>{if(!PE||!PE.o)return;e.preventDefault();try{pv.setPointerCapture(e.pointerId)}catch(_){}PE.drag=true;PE.last=null;phPoint(e,true)});
pv.addEventListener("pointermove",e=>{if(PE&&PE.o&&PE.drag)phPoint(e,false)});
["pointerup","pointercancel"].forEach(t=>pv.addEventListener(t,()=>{if(!PE||!PE.o)return;PE.drag=false;PE.last=null;if(PE.moved){PE.moved=false;if(!PE.m.vm)fixVariant(PE.A,PE.m);phUI();phDraw()}}));
document.addEventListener("change",e=>{
  const t=e.target,fs=t.files?[...t.files]:[],f=fs[0];
  if(t.id==="phFiles"){t.value="";if(fs.length){readEd();addPhotos(fs)}return}
  if(t.id==="impWm"){if(IMP){IMP.wm=t.value;ls.set("fa_wm",t.value);updImp()}return}
  if(t.id==="impFiles"||t.id==="impDir"){t.value="";if(IMP){IMP.files=fs.filter(isImg);IMP.lim=60;updImp();if(fs.length&&!IMP.files.length)toast("Không có file ảnh nào trong lựa chọn này")}return}
  if(t.id==="impSheet"){t.value="";if(!IMP||!f)return;(async()=>{try{const rows=await readSheetFile(f),r=readTable(rows);if(!IMP)return;IMP.err=r.err||"";IMP.table=r.err?null:r;IMP.tname=f.name;IMP.paste="";$("#impPaste").value=""}catch(e){if(IMP){IMP.err=e&&e.code==="xlsx"?"Chưa mở được file Excel. Thử lưu bảng thành CSV, hoặc dán bảng vào ô bên dưới.":"Chưa đọc được file này.";IMP.table=null}}updImp()})();return}
  if(t.id==="covFile"||t.id==="logoFile"){
    t.value="";if(!f)return;if(!/^image\//.test(f.type))return toast("Hãy chọn một file ảnh");
    const bad=()=>toast("Không đọc được ảnh này. Thử ảnh JPG hoặc PNG khác.");
    (async()=>{try{const b=await decode(f),iw=b.naturalWidth||b.width,ih=b.naturalHeight||b.height;
      if(t.id==="covFile"){const w=Math.min(1500,iw),c=cnv(w,Math.round(ih*w/iw)),x=c.getContext("2d");x.imageSmoothingQuality="high";x.drawImage(b,0,0,c.width,c.height);const u=c.toDataURL("image/jpeg",.8);if(!okImg(u))return bad();MEDIA.cover=u}
      else{const w=Math.min(1200,iw),c=cnv(w,Math.round(ih*w/iw)),x=c2d(c);x.drawImage(b,0,0,c.width,c.height);const d=x.getImageData(0,0,c.width,c.height).data;let tr=0;for(let i=3;i<d.length;i+=16)if(d[i]<200)tr++;
        if(tr<d.length/16*.05)return toast("Logo cần là ảnh PNG nền trong suốt");const u=c.toDataURL("image/png");MEDIA.logo=u;LG=null}
      if(b.close)b.close();mTouched=true;touch();shell();drawAdmin()}catch(err){bad()}})();
    return;
  }
  if(!canEdit)return;
  if(t.id==="bsz"){DB.brand.sz=clamp(Math.round(+t.value||34),18,60);touch();return}
  const k=t.dataset.k,vk=t.dataset.vk;
  if(k){
    let v=t.value;
    if(t.type==="number")v=Math.max(0,Math.round(+v||0));else if(t.type==="date")v=v?v+"T23:59:59+07:00":"";else v=v.trim();
    if(k==="zalo"&&v&&!web(v)){toast("Link cần bắt đầu bằng https://");t.value=SHOP[k];return}
    if(k==="name"&&!v){toast("Tên shop không được để trống");t.value=SHOP.name;return}
    SHOP[k]=v;if(k==="name"||k==="by")SHOP.title=(SHOP.name+" "+SHOP.by.split(",")[0]).trim();touch();
  }else if(vk){
    const v=DB.vouchers[+t.dataset.i];if(!v)return;
    if(vk==="code"){v.code=t.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,20);t.value=v.code}
    else if(vk==="type"){if(t.value==="ship"){v.ship=1;delete v.pct;delete v.max}else{delete v.ship;v.pct=10}touch();drawAdmin();return}
    else{const n=Math.max(0,Math.round(+t.value||0));if(vk==="pct"){v.pct=Math.min(90,Math.max(1,n));t.value=v.pct}else if(n)v[vk]=n;else delete v[vk]}
    touch();
  }
});

/* ---------- đường dẫn: #quan-tri mở trang quản trị ---------- */
function route(){
  const on=location.hash==="#quan-tri",was=isAdm;isAdm=on;
  document.body.classList.toggle("adm",on);$("#admin").hidden=!on;ss.set("fa_adm",on?"1":"");
  if(on){closeAll();drawAdmin();scrollTo(0,0)}else if(was){closeAll();refreshAll();scrollTo(0,0)}
}
addEventListener("hashchange",route);
addEventListener("beforeunload",e=>{if((JOB&&!JOB.end)||pend){e.preventDefault();e.returnValue=""}});

/* ---------- khởi động ---------- */
bind();wasSale=saleOn();refreshAll();setInterval(tick,1000);route();
(async()=>{
  let u=null;try{u=await use("user")}catch(e){}
  try{canEdit=!!(u&&await u.canEdit())}catch(e){canEdit=false}
  checked=true;
  if(canEdit){
    $("#admbar").hidden=false;restoreDraft();
    if(ss.get("fa_after","")==="saved"){ss.del("fa_after");toast("Đã lưu và đưa lên web")}
    if(WAS_ADM&&location.hash!=="#quan-tri")location.hash="quan-tri";
  }
  if(isAdm)drawAdmin();
})();
window.__fa={buildDoc,dumpStore,state:()=>({rev:DB.rev,dirty,canEdit,job:JOB&&{done:JOB.done,total:JOB.total,end:JOB.end,fail:JOB.fail,summary:JOB.summary},pend}),db:()=>DB};
})();
