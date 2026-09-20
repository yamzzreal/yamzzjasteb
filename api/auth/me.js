
"use strict";
const {requireUser,publicUser}=require("./_common");
module.exports=async(req,res)=>{
 if(req.method!=="GET")return res.status(405).json({error:"Method not allowed"});
 try{const a=await requireUser(req);if(!a)return res.status(401).json({error:"Sesi tidak valid."});return res.json({success:true,user:publicUser(a.user)});}
 catch(e){console.error(e);return res.status(500).json({error:e.message||"Gagal mengambil profil."});}
};
