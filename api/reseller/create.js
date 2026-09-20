
"use strict";
const {CASAKU_API,LICENSE_KEY,QRIS_ID,jsonbin,save,clean}=require("../casaku/_common");
const {requireUser,privateDb,savePrivateDb,id,addNotification}=require("../auth/_common");
function deep(input,keys,depth=0){if(!input||typeof input!=="object"||depth>6)return;for(const k of keys)if(input[k]!=null&&input[k]!=="")return input[k];for(const v of Object.values(input)){const x=deep(v,keys,depth+1);if(x!=null)return x;}}
function num(...v){for(const x of v){const n=Number(x);if(Number.isFinite(n)&&n>0)return n}return 0}
module.exports=async(req,res)=>{
 if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
 try{
  const a=await requireUser(req);if(!a)return res.status(401).json({error:"Silakan login."});
  const {user}=a;
  if(user.type==="reseller")return res.status(409).json({error:"Akun kamu sudah reseller."});
  const main=await jsonbin();const price=Number(main.site?.resellerPrice||0);
  if(!Number.isFinite(price)||price<1)return res.status(400).json({error:"Harga upgrade reseller belum diatur admin."});
  if(!LICENSE_KEY||!QRIS_ID)return res.status(500).json({error:"Casaku belum dikonfigurasi."});
  const gateway=await fetch(`${CASAKU_API}/api/generate/v2/qris`,{method:"POST",headers:{"x-license-key":LICENSE_KEY,"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({qr_id:QRIS_ID,amount:price,useUniqueCode:false,packageIds:["id.dana"],expiredInMinutes:15,qrType:"dynamic",paymentMethod:"qris",useQris:true,prefix:"YMZZRES"})});
  const raw=await gateway.text();let p={};try{p=raw?JSON.parse(raw):{}}catch{}
  if(!gateway.ok)return res.status(gateway.status||502).json({error:p.message||p.error||"Casaku gagal membuat pembayaran."});
  const transactionId=String(deep(p,["transactionId","transaction_id","trxId","trx_id"])||"").trim();
  const qrString=String(deep(p,["qr_string","qrString","qrCode","qr_code","qr"])||"").trim();
  const amount=num(deep(p,["totalAmount","total_amount","amount","total"]))||price;
  const expiredAt=String(deep(p,["expiredAt","expired_at","expiresAt","expires_at"])||new Date(Date.now()+15*60000).toISOString());
  if(!transactionId||!qrString)return res.status(502).json({error:"Data QRIS dari Casaku tidak lengkap."});
  const db=await privateDb();
  db.resellerPayments.unshift({id:id("rup"),userId:user.id,transactionId,amount,baseAmount:price,status:"pending",createdAt:new Date().toISOString(),expiredAt});
  addNotification(db,user.id,"Upgrade Reseller dibuat",`Pembayaran upgrade reseller sebesar Rp${amount.toLocaleString("id-ID")} menunggu pembayaran.`,"info");
  await savePrivateDb(db);
  return res.json({success:true,transactionId,amount,qrString,expiredAt});
 }catch(e){console.error(e);return res.status(500).json({error:e.message||"Gagal membuat pembayaran upgrade."});}
};
