
"use strict";
const crypto=require("crypto");
const {privateDb,savePrivateDb,clean,id,hashPassword,verifyPassword,addNotification}=require("../auth/_common");
function adminPayload(token){
 try{
  const [body,sig]=String(token||"").split(".");
  const secret=process.env.YAMZZ_AUTH_SECRET;
  if(!secret||!body||!sig)return null;
  const expected=crypto.createHmac("sha256",secret).update(body).digest("base64url");
  if(expected.length!==sig.length||!crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(sig)))return null;
  const p=JSON.parse(Buffer.from(body,"base64url").toString("utf8"));
  return p.role==="admin"&&Number(p.exp)>Date.now()?p:null;
 }catch{return null;}
}
function adminToken(){
 const secret=process.env.YAMZZ_AUTH_SECRET;
 if(!secret)throw new Error("YAMZZ_AUTH_SECRET belum dikonfigurasi.");
 const payload={role:"admin",exp:Date.now()+12*60*60*1000};
 const body=Buffer.from(JSON.stringify(payload)).toString("base64url");
 const sig=crypto.createHmac("sha256",secret).update(body).digest("base64url");
 return body+"."+sig;
}
function requireAdmin(req){
 const h=String(req.headers?.authorization||"");
 return adminPayload(h.toLowerCase().startsWith("bearer ")?h.slice(7):"");
}
module.exports={privateDb,savePrivateDb,clean,id,hashPassword,verifyPassword,addNotification,adminToken,requireAdmin};
