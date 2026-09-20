
"use strict";
const {requireUser,savePrivateDb,clean,id,addNotification}=require("./_common");
module.exports=async(req,res)=>{
 try{
  const a=await requireUser(req);if(!a)return res.status(401).json({error:"Sesi tidak valid."});
  const {db,user}=a;
  if(req.method==="GET"){
   const messages=db.messages.filter(m=>String(m.userId)===String(user.id)).slice(-100);
   messages.filter(m=>m.sender==="admin").forEach(m=>m.read=true);
   await savePrivateDb(db);
   return res.json({success:true,messages});
  }
  if(req.method==="POST"){
   const msg=clean(req.body?.message,1000);if(!msg)return res.status(400).json({error:"Pesan wajib diisi."});
   db.messages.push({id:id("m"),userId:user.id,sender:"user",message:msg,createdAt:new Date().toISOString(),read:false});
   await savePrivateDb(db);return res.json({success:true});
  }
  return res.status(405).json({error:"Method not allowed"});
 }catch(e){return res.status(500).json({error:e.message||"Gagal memproses chat."});}
};
