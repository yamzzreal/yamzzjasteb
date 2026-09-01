/* YAMZZ MARKET PAYMENT
   One JSONBin database. Proof image is uploaded to Cloudinary.
*/
"use strict";
const PAYMENT_CONFIG={
  BIN_ID:"6a97221eda38895dfe2c57b6",
  MASTER_KEY:'$2a$10$tRG8bDyTqRiKD5eWmbVxLu3y2/3plKwKWTQgq3YnEtn2u/XjJzVGK',
  ACCESS_KEY:"$2a$10$XkuvGHYPmOrDazsHVKoqU.0bp.DPZQuLg8.vDg7RYec1WaXBZiSE6",
  API_URL:"https://api.jsonbin.io/v3/b",
  HOME:"index.html"
};
let DB={site:{},products:[],orders:[]};
const $=s=>document.querySelector(s);
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const rupiah=n=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(n)||0);
const makeId=()=>`INV-${Date.now()}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;

async function getDB(){
 const r=await fetch(`${PAYMENT_CONFIG.API_URL}/${PAYMENT_CONFIG.BIN_ID}/latest`,{headers:{"X-Access-Key":PAYMENT_CONFIG.ACCESS_KEY}});
 if(!r.ok)throw new Error(`JSONBin ${r.status}`);
 return (await r.json()).record||{};
}
async function putDB(){
 const r=await fetch(`${PAYMENT_CONFIG.API_URL}/${PAYMENT_CONFIG.BIN_ID}`,{method:"PUT",headers:{"Content-Type":"application/json","X-Master-Key":PAYMENT_CONFIG.MASTER_KEY},body:JSON.stringify(DB)});
 if(!r.ok)throw new Error(`JSONBin ${r.status}: ${await r.text()}`);
 return r.json();
}
function selected(){
 try{return JSON.parse(sessionStorage.getItem("yamzz_selected_product")||sessionStorage.getItem("yamzz_checkout")||"null")}catch{return null}
}
function render(){
 const p=selected();
 if(!p){$("#paymentApp").innerHTML=`<div class="payment-empty"><h2>Produk belum dipilih</h2><a href="${PAYMENT_CONFIG.HOME}">Kembali ke toko</a></div>`;return}
 document.title=`Pembayaran • ${DB.site?.name||"Yamzz Market"}`;
 $("#paymentApp").innerHTML=`
 <main class="payment-wrap">
   <a class="back-link" href="${PAYMENT_CONFIG.HOME}"><i class="fa-solid fa-arrow-left"></i> Kembali ke toko</a>
   <div class="payment-grid">
    <section class="payment-card">
      <div class="payment-head"><span class="badge">CHECKOUT</span><h1>Pembayaran</h1><p>Lengkapi data pelanggan dan upload bukti pembayaran.</p></div>
      <div class="selected-product"><div>${p.image?`<img src="${esc(p.image)}" alt="">`:`<i class="fa-solid fa-bolt"></i>`}</div><section><span>${esc(p.category||"Jasteb")}</span><strong>${esc(p.name)}</strong><small>${Number(p.ress||0)} Ress</small></section><b>${rupiah(p.price)}</b></div>
      <form id="paymentForm">
        <label>Nama Pelanggan<input id="customerName" required maxlength="80" placeholder="Nama kamu"></label>
        <label>WhatsApp<input id="customerWhatsapp" required maxlength="20" placeholder="08xxxxxxxxxx"></label>
        <label>Email<input id="customerEmail" type="email" required maxlength="120" placeholder="email@contoh.com"></label>
        <label>Catatan (opsional)<textarea id="customerNote" rows="3" maxlength="300" placeholder="Catatan tambahan"></textarea></label>
        <label>Bukti Pembayaran<input id="proofFile" type="file" accept="image/*" required><small>Maksimal 5MB. Bukti akan di kirim ke admin.</small></label>
        <button class="payment-submit" type="submit"><i class="fa-solid fa-paper-plane"></i> Kirim Pembayaran</button>
      </form>
      <div id="paymentMessage"></div>
    </section>
    <aside class="payment-card qris-card">
      <div class="payment-head"><span class="badge">QRIS ALLPAY</span><h2>Scan & Bayar</h2><p>Bayar sesuai nominal yang tertera.</p></div>
      <div class="qris-box">${DB.site?.qris?`<img src="${esc(DB.site.qris)}" alt="QRIS ${esc(DB.site?.name||"")}" id="qrisImage">`:`<div class="qris-missing"><i class="fa-solid fa-qrcode"></i><span>QRIS belum diatur admin.</span></div>`}</div>
      <div class="amount-box"><span>Total Pembayaran</span><strong>${rupiah(p.price)}</strong></div>
      <div class="payment-note"><i class="fa-solid fa-circle-info"></i><span>Setelah transfer, upload bukti pembayaran. Admin akan memverifikasi secara manual.</span></div>
    </aside>
   </div>
 </main>`;
 $("#paymentForm").onsubmit=submitPayment;
}
async function uploadCloudinary(file){
 const cloud=DB.site?.cloudinaryCloudName, preset=DB.site?.cloudinaryUploadPreset;
 if(!cloud||!preset)throw new Error("Cloudinary belum dikonfigurasi admin.");
 if(file.size>5*1024*1024)throw new Error("Ukuran bukti maksimal 5MB.");
 const fd=new FormData();fd.append("file",file);fd.append("upload_preset",preset);
 const r=await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/image/upload`,{method:"POST",body:fd});
 if(!r.ok)throw new Error("Upload bukti ke Cloudinary gagal.");
 const j=await r.json();return j.secure_url;
}
async function submitPayment(e){
 e.preventDefault();
 const btn=e.submitter, msg=$("#paymentMessage"), p=selected();
 btn.disabled=true;btn.innerHTML=`<i class="fa-solid fa-spinner fa-spin"></i> Memproses...`;
 msg.textContent="";
 try{
  const proof=await uploadCloudinary($("#proofFile").files[0]);
  const order={
   id:makeId(),productId:p.id,product:p.name,category:p.category||"jasteb",ress:Number(p.ress||0),price:Number(p.price||0),
   name:$("#customerName").value.trim(),whatsapp:$("#customerWhatsapp").value.trim(),email:$("#customerEmail").value.trim(),
   note:$("#customerNote").value.trim(),proof,status:"pending",createdAt:new Date().toISOString()
  };
  DB.orders=Array.isArray(DB.orders)?DB.orders:[];DB.orders.unshift(order);
  await putDB();
  sessionStorage.removeItem("yamzz_selected_product");
  msg.innerHTML=`<div class="success-box"><i class="fa-solid fa-circle-check"></i><h3>Pembayaran terkirim</h3><p>ID Transaksi: <strong>${esc(order.id)}</strong></p><p>Status saat ini <b>Pending</b>. Simpan ID transaksi dan hubungi admin jika diperlukan.</p><a href="${PAYMENT_CONFIG.HOME}">Kembali ke toko</a></div>`;
  $("#paymentForm").remove();
 }catch(err){console.error(err);msg.innerHTML=`<div class="error-box">${esc(err.message)}</div>`;btn.disabled=false;btn.innerHTML=`<i class="fa-solid fa-paper-plane"></i> Kirim Pembayaran`;}
}
async function init(){
 try{DB=await getDB();render()}catch(e){$("#paymentApp").innerHTML=`<div class="payment-empty"><h2>Gagal memuat pembayaran</h2><p>Periksa konfigurasi JSONBin.</p></div>`}
}
document.readyState==="loading"?document.addEventListener("DOMContentLoaded",init):init();
