
"use strict";
const {requireAdmin,privateDb,savePrivateDb,clean,id,hashPassword,addNotification}=require("./_common");
const {jsonbin}=require("../casaku/_common");
function safeUser(u,orders){
 const tx=orders.filter(o=>String(o.userId||"")===String(u.id) || (!o.userId && String(o.whatsapp||"")===String(u.whatsapp||"")));
 return {id:u.id,username:u.username,name:u.name,whatsapp:u.whatsapp,email:u.email,type:u.type,status:u.status,createdAt:u.createdAt,resellerAt:u.resellerAt||null,transactions:tx.map(o=>({id:o.id,product:o.product,status:o.status,price:o.price,createdAt:o.createdAt,paidAt:o.paidAt||null}))};
}
module.exports=async(req,res)=>{
 if(!requireAdmin(req))return res.status(401).json({error:"Admin session tidak valid."});
 try{
  const db=await privateDb();
  if(req.method==="GET"){
   const main=await jsonbin().catch(()=>({orders:[]}));
   const orders=Array.isArray(main.orders)?main.orders:[];
   return res.json({success:true,users:db.users.map(u=>safeUser(u,orders))});
  }
  if(req.method==="POST"){
   const b=req.body||{}, action=clean(b.action,40), uid=clean(b.userId,100);
   const u=db.users.find(x=>String(x.id)===uid);
   if(!u)return res.status(404).json({error:"Akun tidak ditemukan."});
   if(action==="block"||action==="unblock"){
    u.status=action==="block"?"blocked":"active";
    addNotification(db,u.id,action==="block"?"Akun diblokir":"Akun dibuka kembali",action==="block"?"Akun kamu diblokir oleh admin.":"Akun kamu sudah dapat digunakan kembali.",action==="block"?"warning":"success");
   } else if(action==="password"){
    const pw=String(b.password||"");
    if(pw.length<8)return res.status(400).json({error:"Sandi baru minimal 8 karakter."});
    u.passwordHash=hashPassword(pw);
    addNotification(db,u.id,"Sandi akun diubah","Admin telah mengubah sandi akun kamu.","info");
   } else if(action==="chat"){
    const msg=clean(b.message,1000);
    if(!msg)return res.status(400).json({error:"Pesan wajib diisi."});
    db.messages.push({id:id("m"),userId:u.id,sender:"admin",message:msg,createdAt:new Date().toISOString(),read:false});
    addNotification(db,u.id,"Pesan baru dari admin",msg,"chat");
   } else return res.status(400).json({error:"Aksi tidak dikenal."});
   await savePrivateDb(db);
   return res.json({success:true});
  }
  return res.status(405).json({error:"Method not allowed"});
 }catch(e){console.error(e);return res.status(e.statusCode||500).json({error:e.message||"Gagal mengelola akun."});}
};
