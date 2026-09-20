
"use strict";
const {adminToken}=require("./_common");
module.exports=async(req,res)=>{
 if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
 const u=String(process.env.YAMZZ_ADMIN_USERNAME||"").trim(), p=String(process.env.YAMZZ_ADMIN_PASSWORD||"");
 const b=req.body||{};
 if(!u||!p)return res.status(500).json({error:"Admin auth belum dikonfigurasi. Isi YAMZZ_ADMIN_USERNAME dan YAMZZ_ADMIN_PASSWORD."});
 if(String(b.username||"")!==u || String(b.password||"")!==p)return res.status(401).json({error:"Username atau password admin salah."});
 try{return res.json({success:true,token:adminToken()});}catch(e){return res.status(500).json({error:e.message});}
};
