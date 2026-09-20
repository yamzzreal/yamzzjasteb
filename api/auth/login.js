
"use strict";
const {privateDb,verifyPassword,makeToken,publicUser}=require("./_common");
module.exports=async(req,res)=>{
 if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
 try{
  const b=req.body||{}, identity=String(b.identity||"").trim().toLowerCase(), password=String(b.password||"");
  if(!identity||!password)return res.status(400).json({error:"Username/WhatsApp dan password wajib diisi."});
  const db=await privateDb();
  const user=db.users.find(u=>String(u.username).toLowerCase()===identity || String(u.whatsapp)===identity);
  if(!user||!verifyPassword(password,user.passwordHash))return res.status(401).json({error:"Login gagal. Data akun tidak cocok."});
  if(user.status==="blocked")return res.status(403).json({error:"Akun kamu diblokir admin."});
  return res.json({success:true,token:makeToken(user),user:publicUser(user)});
 }catch(e){console.error(e);return res.status(e.statusCode||500).json({error:e.message||"Gagal login."});}
};
