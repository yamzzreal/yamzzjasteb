
"use strict";
const {requireUser,savePrivateDb,addNotification}=require("./_common");
module.exports=async(req,res)=>{
 try{
  const a=await requireUser(req); if(!a)return res.status(401).json({error:"Sesi tidak valid."});
  const {db,user}=a;
  if(req.method==="GET"){
   const list=db.notifications.filter(n=>String(n.userId)===String(user.id)).slice(0,100);
   return res.json({success:true,notifications:list});
  }
  if(req.method==="POST"){
   const id=String(req.body?.id||"");
   if(id){const n=db.notifications.find(x=>String(x.id)===id&&String(x.userId)===String(user.id));if(n)n.read=true;}
   else db.notifications.filter(n=>String(n.userId)===String(user.id)).forEach(n=>n.read=true);
   await savePrivateDb(db); return res.json({success:true});
  }
  return res.status(405).json({error:"Method not allowed"});
 }catch(e){return res.status(500).json({error:e.message||"Gagal memuat notifikasi."});}
};
