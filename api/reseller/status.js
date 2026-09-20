
"use strict";
const {CASAKU_API,LICENSE_KEY}=require("../casaku/_common");
const {requireUser,savePrivateDb,addNotification}=require("../auth/_common");
module.exports=async(req,res)=>{
 if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
 try{
  const a=await requireUser(req);if(!a)return res.status(401).json({error:"Sesi tidak valid."});
  const {db,user}=a; const tid=String(req.body?.transactionId||"").trim();
  const pay=db.resellerPayments.find(x=>String(x.transactionId)===tid&&String(x.userId)===String(user.id));
  if(!pay)return res.status(404).json({error:"Pembayaran upgrade tidak ditemukan."});
  if(user.type==="reseller")return res.json({success:true,status:"paid",upgraded:true});
  if(!LICENSE_KEY)return res.status(500).json({error:"Casaku belum dikonfigurasi."});
  const r=await fetch(`${CASAKU_API}/api/generate/check-status`,{method:"POST",headers:{"x-license-key":LICENSE_KEY,"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({transactionId:tid})});
  const raw=await r.text();let p={};try{p=raw?JSON.parse(raw):{}}catch{}
  if(!r.ok)return res.status(r.status||502).json({error:p.message||p.error||"Gagal mengecek pembayaran."});
  const data=p.data||p.result||{}, status=String(data.status||p.status||"").toLowerCase();
  if(status==="paid"){
   pay.status="paid";pay.paidAt=pay.paidAt||new Date().toISOString();
   user.type="reseller";user.resellerAt=user.resellerAt||pay.paidAt;
   addNotification(db,user.id,"Akun Reseller aktif","Pembayaran berhasil. Akun kamu sekarang berstatus Reseller.","success");
   await savePrivateDb(db);
  }else if(["expired","cancel"].includes(status)){pay.status="rejected";await savePrivateDb(db);}
  return res.json({success:true,status,upgraded:user.type==="reseller"});
 }catch(e){console.error(e);return res.status(500).json({error:e.message||"Gagal mengecek upgrade."});}
};
