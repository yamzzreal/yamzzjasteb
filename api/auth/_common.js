
"use strict";
const crypto = require("crypto");

const PRIVATE_BIN_ID = process.env.YAMZZ_PRIVATE_BIN_ID;
const PRIVATE_MASTER_KEY = process.env.YAMZZ_PRIVATE_MASTER_KEY;
const JWT_SECRET = process.env.YAMZZ_AUTH_SECRET;

function assertConfig() {
  if (!PRIVATE_BIN_ID || !PRIVATE_MASTER_KEY || !JWT_SECRET) {
    const e = new Error("Auth belum dikonfigurasi. Isi YAMZZ_PRIVATE_BIN_ID, YAMZZ_PRIVATE_MASTER_KEY, dan YAMZZ_AUTH_SECRET di Vercel.");
    e.statusCode = 500;
    throw e;
  }
}
async function privateDb() {
  assertConfig();
  const r = await fetch(`https://api.jsonbin.io/v3/b/${PRIVATE_BIN_ID}/latest`, {
    headers: {"X-Master-Key": PRIVATE_MASTER_KEY, "Accept":"application/json"}
  });
  if (!r.ok) throw new Error(`Private JSONBin GET ${r.status}`);
  const j = await r.json();
  const db = j.record || {};
  db.users = Array.isArray(db.users) ? db.users : [];
  db.notifications = Array.isArray(db.notifications) ? db.notifications : [];
  db.messages = Array.isArray(db.messages) ? db.messages : [];
  db.resellerPayments = Array.isArray(db.resellerPayments) ? db.resellerPayments : [];
  return db;
}
async function savePrivateDb(db) {
  assertConfig();
  const r = await fetch(`https://api.jsonbin.io/v3/b/${PRIVATE_BIN_ID}`, {
    method:"PUT",
    headers:{"Content-Type":"application/json","X-Master-Key":PRIVATE_MASTER_KEY},
    body:JSON.stringify(db)
  });
  if (!r.ok) throw new Error(`Private JSONBin PUT ${r.status}: ${await r.text()}`);
}
function clean(v,max=300){return String(v ?? "").trim().slice(0,max);}
function id(prefix="u"){
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
}
function hashPassword(password){
  const salt=crypto.randomBytes(16);
  const derived=crypto.scryptSync(String(password),salt,64);
  return `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`;
}
function verifyPassword(password,stored){
  try{
    const [scheme,saltHex,hashHex]=String(stored||"").split(":");
    if(scheme!=="scrypt"||!saltHex||!hashHex)return false;
    const actual=crypto.scryptSync(String(password),Buffer.from(saltHex,"hex"),64);
    const expected=Buffer.from(hashHex,"hex");
    return expected.length===actual.length && crypto.timingSafeEqual(expected,actual);
  }catch{return false;}
}
function b64(v){return Buffer.from(JSON.stringify(v)).toString("base64url");}
function signToken(payload){
  const body=b64(payload);
  const sig=crypto.createHmac("sha256",JWT_SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}
function readToken(token){
  try{
    const [body,sig]=String(token||"").split(".");
    if(!body||!sig)return null;
    const expected=crypto.createHmac("sha256",JWT_SECRET).update(body).digest("base64url");
    if(expected.length!==sig.length||!crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(sig)))return null;
    const p=JSON.parse(Buffer.from(body,"base64url").toString("utf8"));
    if(!p.exp||Date.now()>Number(p.exp))return null;
    return p;
  }catch{return null;}
}
function bearer(req){
  const h=String(req.headers?.authorization||"");
  return h.toLowerCase().startsWith("bearer ")?h.slice(7).trim():"";
}
async function requireUser(req){
  const token=bearer(req);
  const session=readToken(token);
  if(!session?.uid) return null;
  const db=await privateDb();
  const user=db.users.find(u=>String(u.id)===String(session.uid));
  if(!user||user.status==="blocked")return null;
  return {db,user};
}
function publicUser(u){
  if(!u)return null;
  return {id:u.id,username:u.username,name:u.name,whatsapp:u.whatsapp,email:u.email,type:u.type,status:u.status,createdAt:u.createdAt,resellerAt:u.resellerAt||null};
}
function makeToken(user){
  return signToken({uid:user.id,exp:Date.now()+7*24*60*60*1000});
}
function addNotification(db,userId,title,message,type="info"){
  db.notifications.unshift({id:id("n"),userId:String(userId),title:clean(title,100),message:clean(message,500),type,read:false,createdAt:new Date().toISOString()});
  db.notifications=db.notifications.slice(0,5000);
}
module.exports={privateDb,savePrivateDb,clean,id,hashPassword,verifyPassword,makeToken,bearer,readToken,requireUser,publicUser,addNotification};
