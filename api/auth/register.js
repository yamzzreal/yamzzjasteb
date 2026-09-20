
"use strict";
const {privateDb,savePrivateDb,clean,id,hashPassword,makeToken,publicUser,addNotification}=require("./_common");
module.exports=async(req,res)=>{
 if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
 try{
  const b=req.body||{}, username=clean(b.username,40).toLowerCase(), name=clean(b.name,80), whatsapp=clean(b.whatsapp,20), email=clean(b.email,120).toLowerCase(), password=String(b.password||"");
  if(!/^[a-z0-9_.-]{3,40}$/.test(username))return res.status(400).json({error:"Username 3-40 karakter, hanya huruf kecil, angka, titik, garis bawah, atau minus."});
  if(name.length<2)return res.status(400).json({error:"Nama wajib diisi."});
  if(!/^62\d{8,13}$/.test(whatsapp))return res.status(400).json({error:"WhatsApp harus diawali 62 dan berisi 10-15 digit."});
  if(password.length<8)return res.status(400).json({error:"Password minimal 8 karakter."});
  const db=await privateDb();
  if(db.users.some(u=>String(u.username).toLowerCase()===username))return res.status(409).json({error:"Username sudah digunakan."});
  if(db.users.some(u=>String(u.whatsapp)===whatsapp))return res.status(409).json({error:"Nomor WhatsApp sudah terdaftar."});
  const user={id:id("u"),username,name,whatsapp,email,passwordHash:hashPassword(password),type:"customer",status:"active",createdAt:new Date().toISOString(),resellerAt:null};
  db.users.push(user);
  addNotification(db,user.id,"Akun berhasil dibuat","Selamat datang di Yamzz Market.","success");
  await savePrivateDb(db);
  return res.status(201).json({success:true,token:makeToken(user),user:publicUser(user)});
 }catch(e){console.error(e);return res.status(e.statusCode||500).json({error:e.message||"Gagal membuat akun."});}
};
