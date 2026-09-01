"use strict";
const CONFIG={
  BIN_ID:"6a97221eda38895dfe2c57b6",
  ACCESS_KEY:"$2a$10$XkuvGHYPmOrDazsHVKoqU.0bp.DPZQuLg8.vDg7RYec1WaXBZiSE6",
  API_URL:"https://api.jsonbin.io/v3/b"
};
let DB={site:{},orders:[]};
const $=s=>document.querySelector(s);
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const rupiah=n=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(n)||0);
const normalizePhone=v=>String(v||"").replace(/\D/g,"").replace(/^62/,"0").replace(/^0+/,"0");
const formatDate=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?"-":d.toLocaleString("id-ID",{dateStyle:"medium",timeStyle:"short"});};
const statusMap={
 pending:{label:"Menunggu Verifikasi",icon:"fa-clock",class:"pending",desc:"Pembayaran kamu sudah diterima sistem dan sedang menunggu verifikasi admin."},
 paid:{label:"Pembayaran Terverifikasi",icon:"fa-circle-check",class:"paid",desc:"Pembayaran sudah diverifikasi. Pesanan sedang diproses."},
 completed:{label:"Selesai",icon:"fa-check-double",class:"completed",desc:"Transaksi sudah selesai diproses."},
 rejected:{label:"Ditolak",icon:"fa-circle-xmark",class:"rejected",desc:"Pembayaran ditolak. Silakan hubungi admin untuk informasi lebih lanjut."}
};
async function getDB(){
 const r=await fetch(`${CONFIG.API_URL}/${CONFIG.BIN_ID}/latest`,{headers:{"X-Access-Key":CONFIG.ACCESS_KEY,"Accept":"application/json"}});
 if(!r.ok)throw new Error(`Gagal mengambil database (${r.status}).`);
 const j=await r.json();return j.record||{};
}
function renderSite(){
 const site=DB.site||{};
 const name=site.name||"Yamzz Market";
 document.title=`Cek Transaksi • ${name}`;
 $("#brandName").textContent=name;$("#footerName").textContent=name;
 if(site.logo)$("#brandLogo").innerHTML=`<img src="${esc(site.logo)}" alt="${esc(name)}">`;
}
function showMessage(text,type="error"){$("#message").className=`message ${type}`;$(("#message")).innerHTML=`<i class="fa-solid ${type==="success"?"fa-circle-check":"fa-circle-exclamation"}"></i><span>${esc(text)}</span>`;}
function clearMessage(){$("#message").className="message";$(("#message")).innerHTML="";}
function renderResult(order){
 const s=statusMap[order.status]||{label:order.status||"Tidak diketahui",icon:"fa-circle-question",class:"unknown",desc:"Status transaksi belum dikenali."};
 $("#result").hidden=false;
 $("#result").innerHTML=`
 <div class="result-head">
   <div><span class="result-label">HASIL TRANSAKSI</span><h2>${esc(order.id)}</h2></div>
   <span class="status ${s.class}"><i class="fa-solid ${s.icon}"></i>${s.label}</span>
 </div>
 <p class="status-desc">${s.desc}</p>
 <div class="detail-grid">
   <div><span>Produk</span><strong>${esc(order.product||"-")}</strong></div>
   <div><span>Ress</span><strong>${Number(order.ress||0).toLocaleString("id-ID")} Ress</strong></div>
   <div><span>Total</span><strong>${rupiah(order.price)}</strong></div>
   <div><span>Nama</span><strong>${esc(order.name||"-")}</strong></div>
   <div><span>Dibuat</span><strong>${formatDate(order.createdAt)}</strong></div>
   <div><span>Terakhir diperbarui</span><strong>${formatDate(order.verifiedAt||order.createdAt)}</strong></div>
 </div>
 ${order.status==="rejected"&&DB.site?.whatsapp?`<a class="contact-btn" target="_blank" href="https://wa.me/${encodeURIComponent(String(DB.site.whatsapp).replace(/\D/g,""))}"><i class="fa-brands fa-whatsapp"></i> Hubungi Admin</a>`:""}`;
 $("#result").scrollIntoView({behavior:"smooth",block:"nearest"});
}
async function submit(e){
 e.preventDefault();clearMessage();$("#result").hidden=true;
 const btn=$("#checkButton"), id=$("#transactionId").value.trim().toUpperCase(), phone=normalizePhone($("#transactionWhatsapp").value);
 if(!id||phone.length<8){showMessage("ID transaksi dan nomor WhatsApp harus diisi.");return;}
 btn.disabled=true;btn.innerHTML=`<i class="fa-solid fa-spinner fa-spin"></i> Mengecek...`;
 try{
   DB=await getDB();renderSite();
   const orders=Array.isArray(DB.orders)?DB.orders:[];
   const order=orders.find(o=>String(o.id||"").toUpperCase()===id && normalizePhone(o.whatsapp)===phone);
   if(!order){showMessage("Transaksi tidak ditemukan. Pastikan ID transaksi dan nomor WhatsApp sudah benar.");return;}
   renderResult(order);showMessage("Transaksi ditemukan.","success");
 }catch(err){console.error(err);showMessage(err.message||"Terjadi kesalahan saat mengecek transaksi.");}
 finally{btn.disabled=false;btn.innerHTML=`<i class="fa-solid fa-magnifying-glass"></i> Cek Transaksi`;}
}
$("#checkForm").addEventListener("submit",submit);
$("#year").textContent=new Date().getFullYear();
(async()=>{try{DB=await getDB();renderSite();}catch(e){console.warn(e);}})();
