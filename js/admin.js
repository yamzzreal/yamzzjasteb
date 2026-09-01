/* YAMZZ MARKET ADMIN
   ONE JSONBIN DATABASE.
   IMPORTANT: MASTER KEY IN CLIENT JS IS NOT TRULY SECRET.
   For real security use a Vercel serverless API/proxy.
*/
"use strict";

const ADMIN_CONFIG={
  BIN_ID:"6a97221eda38895dfe2c57b6",
  MASTER_KEY:"$2a$10$tRG8bDyTqRiKD5eWmbVxLu3y2/3plKwKWTQgq3YnEtn2u/XjJzVGK",
  API_URL:"https://api.jsonbin.io/v3/b",
  LOGIN_PAGE:"login.html"
};
const AUTH_KEY="yamzz_admin_authenticated", AUTH_TIME="yamzz_admin_time";
let DB={site:{},products:[],orders:[]};

function auth(){
  if(sessionStorage.getItem(AUTH_KEY)!=="true") return false;
  const t=Number(sessionStorage.getItem(AUTH_TIME)||0);
  if(!t || Date.now()-t>12*60*60*1000){logout();return false;}
  return true;
}
function guard(){if(!auth()){location.replace(ADMIN_CONFIG.LOGIN_PAGE);return false}return true}
function logout(){sessionStorage.removeItem(AUTH_KEY);sessionStorage.removeItem(AUTH_TIME)}
if(!guard()) throw new Error("Admin authentication required");

const $=s=>document.querySelector(s);
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const rupiah=n=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(n)||0);
const id=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const cat=v=>String(v||"jasteb").toLowerCase().trim().replace(/\s+/g,"-");

async function request(method="GET",body=null){
  const r=await fetch(`${ADMIN_CONFIG.API_URL}/${ADMIN_CONFIG.BIN_ID}`,{
    method,headers:{"Content-Type":"application/json","X-Master-Key":ADMIN_CONFIG.MASTER_KEY},
    ...(body?{body:JSON.stringify(body)}:{})
  });
  if(!r.ok) throw new Error(`JSONBin ${r.status}: ${await r.text()}`);
  return r.json();
}
async function load(){
  const r=await fetch(`${ADMIN_CONFIG.API_URL}/${ADMIN_CONFIG.BIN_ID}/latest`,{headers:{"X-Master-Key":ADMIN_CONFIG.MASTER_KEY}});
  if(!r.ok) throw new Error(`JSONBin ${r.status}`);
  DB=normalize((await r.json()).record||{});
}
function normalize(d){
  return {
    site:{
      name:d.site?.name||"Yamzz Market",title:d.site?.title||"",description:d.site?.description||"",tagline:d.site?.tagline||"",
      logo:d.site?.logo||"",banner:d.site?.banner||"",whatsapp:d.site?.whatsapp||"",email:d.site?.email||"",qris:d.site?.qris||"",
      socials:{tiktok:d.site?.socials?.tiktok||"",instagram:d.site?.socials?.instagram||"",youtube:d.site?.socials?.youtube||"",telegram:d.site?.socials?.telegram||""},
      cloudinaryCloudName:d.site?.cloudinaryCloudName||"",cloudinaryUploadPreset:d.site?.cloudinaryUploadPreset||""
    },
    products:Array.isArray(d.products)?d.products:[],
    orders:Array.isArray(d.orders)?d.orders:[]
  };
}
async function save(){
  const r=await request("PUT",DB);
  return !!r.record;
}

window.Admin={
  async mount(){
    if(!guard())return;
    await load();
    this.render();
  },
  render(){
    document.title=`Admin Panel • ${DB.site.name}`;
    const app=$("#adminApp");
    app.innerHTML=`
    <div class="admin-layout">
      <aside class="sidebar">
        <div class="sidebar-brand"><div class="brand-logo">${DB.site.logo?`<img src="${esc(DB.site.logo)}" alt="">`:`<i class="fa-solid fa-bolt"></i>`}</div><div><strong>${esc(DB.site.name)}</strong><small>ADMIN PANEL</small></div></div>
        <nav class="sidebar-nav">
          <button class="nav-item active" data-section="dashboard" onclick="Admin.open('dashboard',this)"><i class="fa-solid fa-chart-line"></i><span>Dashboard</span></button>
          <button class="nav-item" data-section="products" onclick="Admin.open('products',this)"><i class="fa-solid fa-box"></i><span>Produk</span></button>
          <button class="nav-item" data-section="orders" onclick="Admin.open('orders',this)"><i class="fa-solid fa-receipt"></i><span>Transaksi</span></button>
          <button class="nav-item" data-section="settings" onclick="Admin.open('settings',this)"><i class="fa-solid fa-gear"></i><span>Pengaturan</span></button>
        </nav>
        <div class="sidebar-bottom"><a href="index.html" class="sidebar-store"><i class="fa-solid fa-store"></i>Lihat Toko</a><button class="logout-button" onclick="Admin.logout()"><i class="fa-solid fa-right-from-bracket"></i>Keluar</button></div>
      </aside>
      <main class="admin-main">
        <header class="admin-topbar"><div><button class="mobile-menu" onclick="Admin.toggleSidebar()"><i class="fa-solid fa-bars"></i></button><div><h1 id="pageTitle">Dashboard</h1><p>Kelola ${esc(DB.site.name)}</p></div></div><div class="admin-profile"><div class="online-dot"></div><div><strong>Administrator</strong><small>Online</small></div></div></header>
        <section id="section-dashboard" class="admin-section active"><div class="welcome-card"><div><span>DASHBOARD</span><h2>Selamat datang kembali 👋</h2><p>Kelola satu database JSONBin untuk produk, transaksi dan konfigurasi website.</p></div><i class="fa-solid fa-chart-pie"></i></div><div id="stats" class="stats-grid"></div><div class="dashboard-grid"><div class="panel-card"><div class="panel-header"><div><h3>Transaksi Terbaru</h3><p>Aktivitas pesanan</p></div><button onclick="Admin.open('orders')">Lihat semua</button></div><div id="recentOrders"></div></div><div class="panel-card"><div class="panel-header"><div><h3>Produk</h3><p>Produk aktif</p></div></div><div id="quickProducts"></div></div></div></section>
        <section id="section-products" class="admin-section"><div class="section-toolbar"><div><h2>Produk JASTEB</h2><p>Kelola produk dalam satu database.</p></div><button class="primary-button" onclick="Admin.addProduct()"><i class="fa-solid fa-plus"></i>Tambah Produk</button></div><div id="productList" class="product-admin-list"></div></section>
        <section id="section-orders" class="admin-section"><div class="section-toolbar"><div><h2>Transaksi</h2><p>Verifikasi bukti pembayaran pelanggan.</p></div></div><div id="orderList" class="order-list"></div></section>
        <section id="section-settings" class="admin-section"><div class="section-toolbar"><div><h2>Pengaturan Website</h2><p>Semua konfigurasi disimpan di record JSONBin yang sama.</p></div></div>
          <div class="settings-grid">
            <div class="panel-card"><div class="panel-header"><div><h3>Identitas</h3><p>Nama, deskripsi, kontak dan branding.</p></div></div>
              ${field("setName","Nama Store","text")}${field("setTitle","Title Browser","text")}${field("setTagline","Tagline","text")}${field("setDescription","Deskripsi Store","textarea")}${field("setWhatsapp","Nomor WhatsApp","text")}${field("setEmail","Email","email")}
              ${field("setLogo","URL Logo / Cloudinary","url")}${field("setBanner","URL Banner / Cloudinary","url")}
            </div>
            <div class="panel-card"><div class="panel-header"><div><h3>Pembayaran</h3><p>QRIS pribadi berbasis URL gambar.</p></div></div>
              <div class="qris-preview"><img id="qrisPreview" alt="QRIS"><div id="qrisEmpty" class="qris-empty"><i class="fa-solid fa-qrcode"></i><span>QRIS belum tersedia</span></div></div>
              ${field("setQris","URL QRIS / Cloudinary","url")}
              <h3 style="margin-top:22px">Cloudinary Upload</h3>
              ${field("setCloudName","Cloud Name","text")}${field("setUploadPreset","Unsigned Upload Preset","text")}
            </div>
            <div class="panel-card"><div class="panel-header"><div><h3>Sosial Media</h3><p>Link footer website.</p></div></div>
              ${field("setTiktok","TikTok","url")}${field("setInstagram","Instagram","url")}${field("setYoutube","YouTube","url")}${field("setTelegram","Telegram","url")}
            </div>
          </div>
          <div class="settings-save"><button class="primary-button" onclick="Admin.saveSettings()"><i class="fa-solid fa-floppy-disk"></i>Simpan Semua Pengaturan</button></div>
        </section>
      </main>
    </div>`;
    this.renderAll();
  },
  open(section,button){
    if(!guard())return;
    document.querySelectorAll(".admin-section").forEach(x=>x.classList.remove("active"));
    $("#section-"+section)?.classList.add("active");
    document.querySelectorAll(".nav-item").forEach(x=>x.classList.remove("active"));
    (button||document.querySelector(`[data-section="${section}"]`))?.classList.add("active");
    $("#pageTitle").textContent={dashboard:"Dashboard",products:"Produk",orders:"Transaksi",settings:"Pengaturan"}[section]||"Admin";
    this.closeSidebar();
  },
  renderAll(){this.renderStats();this.renderProducts();this.renderOrders();this.renderSettings()},
  renderStats(){
    const orders=DB.orders||[], products=DB.products||[];
    const pending=orders.filter(o=>o.status==="pending").length, paid=orders.filter(o=>["paid","completed"].includes(o.status)).length;
    const revenue=orders.filter(o=>["paid","completed"].includes(o.status)).reduce((a,o)=>a+Number(o.price||0),0);
    $("#stats").innerHTML=`<div class="stat-card"><div class="stat-icon blue"><i class="fa-solid fa-box"></i></div><div><span>Total Produk</span><strong>${products.length}</strong></div></div><div class="stat-card"><div class="stat-icon orange"><i class="fa-solid fa-clock"></i></div><div><span>Pending</span><strong>${pending}</strong></div></div><div class="stat-card"><div class="stat-icon green"><i class="fa-solid fa-circle-check"></i></div><div><span>Terbayar</span><strong>${paid}</strong></div></div><div class="stat-card"><div class="stat-icon purple"><i class="fa-solid fa-wallet"></i></div><div><span>Pendapatan</span><strong>${rupiah(revenue)}</strong></div></div>`;
  },
  renderProducts(){
    const c=$("#productList"), q=$("#quickProducts"), ps=DB.products||[];
    if(!ps.length){c.innerHTML=`<div class="empty-admin"><i class="fa-solid fa-box-open"></i><strong>Belum ada produk</strong><span>Tambahkan produk pertama.</span></div>`;q.innerHTML=`<div class="empty-mini">Belum ada produk.</div>`;return}
    c.innerHTML=ps.map(p=>`<div class="product-row"><div class="product-main"><div class="product-icon">${p.image?`<img src="${esc(p.image)}" alt="">`:`<i class="fa-solid fa-bolt"></i>`}</div><div><strong>${esc(p.name)}</strong><span>${Number(p.ress||0)} Ress • ${rupiah(p.price)} • Stok ${Number(p.stock||0)}</span></div></div><span class="status-badge ${p.active===false?"inactive":"active"}">${p.active===false?"Nonaktif":"Aktif"}</span><div class="row-actions"><button class="action-button edit" onclick="Admin.editProduct('${esc(p.id)}')"><i class="fa-solid fa-pen"></i></button><button class="action-button delete" onclick="Admin.deleteProduct('${esc(p.id)}')"><i class="fa-solid fa-trash"></i></button></div></div>`).join("");
    q.innerHTML=ps.slice(0,5).map(p=>`<div class="mini-product"><div><strong>${esc(p.name)}</strong><span>${Number(p.ress||0)} Ress • Stok ${Number(p.stock||0)}</span></div><b>${rupiah(p.price)}</b></div>`).join("");
  },
  addProduct(product=null){
    this.openProductModal(product);
  },
  editProduct(pid){
    const p=DB.products.find(x=>String(x.id)===String(pid));
    if(!p)return this.notify("Produk tidak ditemukan","error");
    this.openProductModal(p);
  },
  openProductModal(product=null){
    document.getElementById("yamzzProductModal")?.remove();
    const edit=!!product;
    const modal=document.createElement("div");
    modal.id="yamzzProductModal";
    modal.innerHTML=`
      <div style="position:fixed;inset:0;background:rgba(0,0,0,.72);backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto" onclick="if(event.target===this)this.remove()">
        <div style="width:min(720px,100%);max-height:92vh;overflow:auto;background:#0b1628;border:1px solid rgba(80,170,255,.25);border-radius:20px;box-shadow:0 25px 80px rgba(0,0,0,.5);color:#fff;font-family:Inter,Arial,sans-serif">
          <div style="padding:22px 24px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:#0b1628;z-index:2">
            <div><div style="font-size:20px;font-weight:800">${edit?'Edit Produk':'Tambah Produk'}</div><div style="font-size:12px;color:#8fa4bd;margin-top:4px">${edit?'Perbarui data produk yang dipilih':'Tambahkan produk baru ke database'}</div></div>
            <button type="button" id="pmClose" style="width:38px;height:38px;border:0;border-radius:10px;background:rgba(255,255,255,.07);color:#fff;font-size:18px;cursor:pointer"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <form id="yamzzProductForm" style="padding:24px">
            <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px">
              <div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:8px">Nama Produk</label><input id="pmName" required value="${esc(product?.name||'')}" placeholder="Contoh: 10K 100 Ress" style="width:100%;box-sizing:border-box;padding:13px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.1);background:#07111f;color:#fff;outline:none"></div>
              <div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:8px">Kategori</label><select id="pmCategory" style="width:100%;box-sizing:border-box;padding:13px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.1);background:#07111f;color:#fff;outline:none"><option value="jasteb">JASTEB</option><option value="sewa-jasteb">Sewa JASTEB</option><option value="pt-jasteb">PT JASTEB</option></select></div>
              <div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:8px">Jumlah Ress</label><input id="pmRess" required type="number" min="1" value="${Number(product?.ress||100)}" style="width:100%;box-sizing:border-box;padding:13px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.1);background:#07111f;color:#fff;outline:none"></div>
              <div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:8px">Harga (Rp)</label><input id="pmPrice" required type="number" min="1" value="${Number(product?.price||10000)}" style="width:100%;box-sizing:border-box;padding:13px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.1);background:#07111f;color:#fff;outline:none"></div>
              <div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:8px">Stok</label><input id="pmStock" required type="number" min="0" value="${Number(product?.stock||0)}" style="width:100%;box-sizing:border-box;padding:13px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.1);background:#07111f;color:#fff;outline:none"></div>
              <div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:8px">Gambar Produk</label><input id="pmImageFile" type="file" accept="image/png,image/jpeg,image/webp" style="width:100%;box-sizing:border-box;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,.1);background:#07111f;color:#aebed1"></div>
              <div style="grid-column:1/-1"><div id="pmImageStatus" style="font-size:12px;color:#8fa4bd;margin:-4px 0 12px">${product?.image?'Gambar saat ini tersimpan di Cloudinary. Pilih file baru jika ingin menggantinya.':'Pilih gambar untuk otomatis di-upload ke Cloudinary.'}</div><img id="pmPreview" src="${esc(product?.image||'')}" style="${product?.image?'display:block;':''}width:100%;max-height:190px;object-fit:contain;border-radius:12px;background:#07111f;border:1px solid rgba(255,255,255,.08);${product?.image?'':'display:none;'}"></div>
              <div style="grid-column:1/-1"><label style="display:block;font-size:13px;font-weight:700;margin-bottom:8px">Deskripsi</label><textarea id="pmDescription" rows="4" placeholder="Deskripsi produk..." style="width:100%;box-sizing:border-box;padding:13px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.1);background:#07111f;color:#fff;outline:none;resize:vertical">${esc(product?.description||'')}</textarea></div>
            </div>
            <div id="pmError" style="display:none;margin-top:16px;padding:12px;border-radius:10px;background:rgba(255,70,70,.1);border:1px solid rgba(255,70,70,.25);color:#ff9b9b;font-size:13px"></div>
            <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:22px">
              <button type="button" id="pmCancel" style="padding:12px 18px;border:0;border-radius:10px;background:rgba(255,255,255,.08);color:#fff;cursor:pointer">Batal</button>
              <button type="submit" id="pmSave" style="padding:12px 20px;border:0;border-radius:10px;background:linear-gradient(135deg,#168cff,#0066ff);color:#fff;font-weight:800;cursor:pointer"><i class="fa-solid fa-cloud-arrow-up"></i> ${edit?'Simpan Perubahan':'Tambah Produk'}</button>
            </div>
          </form>
        </div>
      </div>`;
    document.body.appendChild(modal);
    const root=modal.firstElementChild;
    const close=()=>modal.remove();
    modal.querySelector('#pmClose').onclick=close;
    modal.querySelector('#pmCancel').onclick=close;
    modal.querySelector('#pmCategory').value=cat(product?.category||'jasteb');
    const fileInput=modal.querySelector('#pmImageFile'), preview=modal.querySelector('#pmPreview');
    fileInput.onchange=()=>{
      const f=fileInput.files?.[0];
      if(!f)return;
      if(f.size>5*1024*1024)return this.notify('Ukuran gambar maksimal 5 MB','error');
      if(!f.type.startsWith('image/'))return this.notify('File harus berupa gambar','error');
      preview.src=URL.createObjectURL(f);preview.style.display='block';
      modal.querySelector('#pmImageStatus').textContent='Gambar siap di-upload ke Cloudinary saat disimpan.';
    };
    modal.querySelector('#yamzzProductForm').onsubmit=async(e)=>{
      e.preventDefault();
      const name=modal.querySelector('#pmName').value.trim();
      const category=cat(modal.querySelector('#pmCategory').value);
      const ress=Number(modal.querySelector('#pmRess').value);
      const price=Number(modal.querySelector('#pmPrice').value);
      const stock=Number(modal.querySelector('#pmStock').value);
      const description=modal.querySelector('#pmDescription').value.trim();
      const file=fileInput.files?.[0];
      const error=modal.querySelector('#pmError'), btn=modal.querySelector('#pmSave');
      if(!name||!ress||!price||stock<0){error.textContent='Data produk belum valid.';error.style.display='block';return;}
      btn.disabled=true;btn.style.opacity='.65';btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';error.style.display='none';
      try{
        let image=product?.image||'';
        if(file) image=await this.uploadProductImage(file);
        const data={name,category,ress,price,stock,image,description};
        if(edit) Object.assign(product,data);
        else DB.products.push({id:'p_'+id(),...data,active:true,createdAt:new Date().toISOString()});
        await this.commit(edit?'Produk diperbarui':'Produk ditambahkan');
        close();
      }catch(err){
        console.error(err);error.textContent=err.message||'Gagal menyimpan produk.';error.style.display='block';
        btn.disabled=false;btn.style.opacity='1';btn.innerHTML='<i class="fa-solid fa-cloud-arrow-up"></i> '+(edit?'Simpan Perubahan':'Tambah Produk');
      }
    };
  },
  async uploadProductImage(file){
    const cloudName=String(DB.site?.cloudinaryCloudName||'').trim();
    const uploadPreset=String(DB.site?.cloudinaryUploadPreset||'').trim();
    if(!cloudName||!uploadPreset) throw new Error('Cloudinary belum dikonfigurasi. Isi Cloud Name dan Unsigned Upload Preset di Pengaturan.');
    if(file.size>5*1024*1024) throw new Error('Ukuran gambar maksimal 5 MB.');
    if(!file.type.startsWith('image/')) throw new Error('File harus berupa gambar.');
    const form=new FormData();form.append('file',file);form.append('upload_preset',uploadPreset);
    const r=await fetch('https://api.cloudinary.com/v1_1/'+encodeURIComponent(cloudName)+'/image/upload',{method:'POST',body:form});
    const result=await r.json();
    if(!r.ok) throw new Error(result?.error?.message||'Upload Cloudinary gagal.');
    return result.secure_url;
  },
  async deleteProduct(pid){
    const p=DB.products.find(x=>String(x.id)===String(pid)); if(!p||!confirm(`Hapus "${p.name}"?`))return;
    DB.products=DB.products.filter(x=>String(x.id)!==String(pid)); await this.commit("Produk dihapus");
  },
  renderOrders(){
    const c=$("#orderList"), r=$("#recentOrders"), os=DB.orders||[];
    if(!os.length){c.innerHTML=`<div class="empty-admin"><i class="fa-solid fa-receipt"></i><strong>Belum ada transaksi</strong><span>Transaksi akan muncul di sini.</span></div>`;r.innerHTML=`<div class="empty-mini">Belum ada transaksi.</div>`;return}
    c.innerHTML=os.map(o=>this.orderHTML(o)).join("");
    r.innerHTML=os.slice(0,5).map(o=>`<div class="recent-order"><div class="recent-icon"><i class="fa-solid fa-receipt"></i></div><div class="recent-info"><strong>${esc(o.product)}</strong><span>${esc(o.name||o.whatsapp||"Pelanggan")}</span></div><div class="recent-price">${rupiah(o.price)}</div></div>`).join("");
  },
  orderHTML(o){
    const s=o.status||"pending";
    return `<article class="order-card"><div class="order-top"><div><span class="order-id">${esc(o.id)}</span><h3>${esc(o.product)}</h3></div><span class="order-status ${s}">${({pending:"Pending",paid:"Terbayar",completed:"Selesai",rejected:"Ditolak"}[s]||s)}</span></div>
    <div class="order-info"><div><span>Nama</span><strong>${esc(o.name)}</strong></div><div><span>WhatsApp</span><strong>${esc(o.whatsapp)}</strong></div><div><span>Email</span><strong>${esc(o.email)}</strong></div><div><span>Total</span><strong>${rupiah(o.price)}</strong></div></div>
    ${o.proof?`<div class="proof-box"><img src="${esc(o.proof)}" alt="Bukti" onclick="Admin.previewImage('${esc(o.proof)}')"><span>Klik gambar untuk memperbesar</span></div>`:`<div class="no-proof"><i class="fa-solid fa-image"></i> Bukti belum tersedia.</div>`}
    <div class="order-actions">${s==="pending"?`<button class="success-button" onclick="Admin.updateStatus('${esc(o.id)}','paid')"><i class="fa-solid fa-check"></i>Verifikasi</button><button class="danger-button" onclick="Admin.updateStatus('${esc(o.id)}','rejected')"><i class="fa-solid fa-xmark"></i>Tolak</button>`:""}${s==="paid"?`<button class="success-button" onclick="Admin.updateStatus('${esc(o.id)}','completed')"><i class="fa-solid fa-check-double"></i>Tandai Selesai</button>`:""}</div></article>`;
  },
  async updateStatus(oid,status){
    const o=DB.orders.find(x=>String(x.id)===String(oid));if(!o)return;
    if(!confirm(status==="paid"?"Verifikasi pembayaran ini?":status==="rejected"?"Tolak pembayaran ini?":"Tandai transaksi selesai?"))return;
    o.status=status;o.verifiedAt=new Date().toISOString();await this.commit("Status transaksi diperbarui");
  },
  renderSettings(){
    const s=DB.site;
    [["setName","name"],["setTitle","title"],["setTagline","tagline"],["setDescription","description"],["setWhatsapp","whatsapp"],["setEmail","email"],["setLogo","logo"],["setBanner","banner"],["setQris","qris"],["setCloudName","cloudinaryCloudName"],["setUploadPreset","cloudinaryUploadPreset"],["setTiktok","socials.tiktok"],["setInstagram","socials.instagram"],["setYoutube","socials.youtube"],["setTelegram","socials.telegram"]].forEach(([el,key])=>{
      const e=$("#"+el);if(!e)return;let v=key.includes(".")?s[key.split(".")[0]][key.split(".")[1]]:s[key];e.value=v||"";
    });
    this.updateQrisPreview(s.qris);
  },
  async saveSettings(){
    const val=id=>$("#"+id)?.value.trim()||"";
    DB.site={...DB.site,name:val("setName")||"Yamzz Market",title:val("setTitle")||`${val("setName")||"Yamzz Market"} • JASTEB`,tagline:val("setTagline"),description:val("setDescription"),whatsapp:val("setWhatsapp"),email:val("setEmail"),logo:val("setLogo"),banner:val("setBanner"),qris:val("setQris"),cloudinaryCloudName:val("setCloudName"),cloudinaryUploadPreset:val("setUploadPreset"),socials:{tiktok:val("setTiktok"),instagram:val("setInstagram"),youtube:val("setYoutube"),telegram:val("setTelegram")}};
    await this.commit("Semua pengaturan disimpan");
    this.updateQrisPreview(DB.site.qris);
  },
  updateQrisPreview(url){
    const i=$("#qrisPreview"),e=$("#qrisEmpty");if(!i||!e)return;
    if(url){i.src=url;i.style.display="block";e.style.display="none"}else{i.removeAttribute("src");i.style.display="none";e.style.display="flex"}
  },
  previewImage(url){const m=document.createElement("div");m.className="image-preview";m.innerHTML=`<div class="image-preview-inner"><button onclick="this.closest('.image-preview').remove()"><i class="fa-solid fa-xmark"></i></button><img src="${esc(url)}" alt=""></div>`;document.body.appendChild(m)},
  async commit(msg){try{await save();this.renderAll();this.notify(msg)}catch(e){console.error(e);this.notify("Gagal menyimpan: "+e.message,"error");await load();this.renderAll()}},
  toggleSidebar(){$(".sidebar")?.classList.toggle("show")},
  closeSidebar(){$(".sidebar")?.classList.remove("show")},
  logout(){if(confirm("Keluar dari Admin Panel?")){logout();location.replace("login.html")}},
  notify(msg,type="success"){const t=$("#adminToast");if(!t)return;t.textContent=msg;t.className=`admin-toast show ${type}`;setTimeout(()=>t.classList.remove("show"),3000)}
};

function field(id,label,type="text"){
 return `<div class="field"><label>${label}</label>${type==="textarea"?`<textarea id="${id}" rows="4"></textarea>`:`<input id="${id}" type="${type}">`}</div>`;
}
document.addEventListener("DOMContentLoaded",()=>Admin.mount());
