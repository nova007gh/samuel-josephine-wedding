'use strict';
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const defaults={title:'Our Bridal Train',subtitle:'The amazing people walking this journey with us',bridesmaidsTitle:'Bridesmaids',groomsmenTitle:'Groomsmen',heroPhotoUrl:'',footer:'Together in Love\nDifferent roles, one beautiful story',bridesmaids:['Cynthia','Becky','Abigail','Jennifer','Esther','Victoria','Vennessa','Evelyn','Lian'].map((name,i)=>({id:'bride-'+(i+1),name,role:'Bridesmaid',photoUrl:''})),groomsmen:['Sammy Jay','Mike','Charles','Fada Ignatious','Mr. Larbi','Paak','Dave','Kojo','Alhaji','Nana Kojo Ignis'].map((name,i)=>({id:'groom-'+(i+1),name,role:'Groomsman',photoUrl:''}))};
function validate(value){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid bridal train.');
  const text=(v,max,label,required=false)=>{if(typeof v!=='string'||v.length>max)throw new Error(`${label} must be text of at most ${max} characters.`);const s=v.trim();if(required&&!s)throw new Error(`Enter ${label.toLowerCase()}.`);return s;};
  const photo=v=>{v=text(v,200,'Photo');if(v&&!/^\/uploads\/[a-zA-Z0-9-]+\.(jpg|jpeg|png|webp)$/i.test(v))throw new Error('Use a photo uploaded through the bridal train editor.');return v;};
  const out={};
  for(const [key,max]of Object.entries({title:120,subtitle:240,bridesmaidsTitle:80,groomsmenTitle:80,footer:200}))out[key]=text(value[key],max,key,['title','bridesmaidsTitle','groomsmenTitle'].includes(key));
  out.heroPhotoUrl=photo(value.heroPhotoUrl);
  const ids=new Set();
  for(const group of ['bridesmaids','groomsmen']){
    if(!Array.isArray(value[group])||value[group].length>50)throw new Error('Each group supports up to 50 people.');
    out[group]=value[group].map(m=>{
      if(!m||typeof m!=='object'||Array.isArray(m)||typeof m.id!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(m.id)||ids.has(m.id))throw new Error('Every person needs a unique ID.');
      ids.add(m.id);return {id:m.id,name:text(m.name,100,'Name',true),role:text(m.role,80,'Role',true),photoUrl:photo(m.photoUrl)};
    });
  }
  return out;
}
module.exports=({app,db,requireAdmin,multer,storage,uploadsDir,previews})=>{
  const revision=raw=>crypto.createHash('sha256').update(raw||'').digest('hex');
  const raw=()=>db.prepare('SELECT value FROM settings WHERE key=?').get('bridalTrain')?.value||null;
  const response=()=>{
    const stored=raw(),data=stored?validate(JSON.parse(stored)):structuredClone(defaults),photos={};
    for(const url of [data.heroPhotoUrl,...data.bridesmaids.map(m=>m.photoUrl),...data.groomsmen.map(m=>m.photoUrl)]){
      if(!url)continue;previews.enqueue({mediaUrl:url,type:'image/jpeg'});
      const preview=previews.decorate({mediaUrl:url,type:'image/jpeg'}).thumbnailUrl;if(preview)photos[url]=preview;
    }
    return {data,revision:revision(stored),previews:photos};
  };
  app.get('/api/bridal-train',(req,res)=>{try{res.json(response());}catch{res.status(500).json({error:'The bridal train could not be loaded. Please try again.'});}});
  const save=db.transaction((data,expected)=>{
    if(expected!==revision(raw()))return false;
    db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('bridalTrain',JSON.stringify(data));return true;
  });
  app.patch('/api/admin/bridal-train',requireAdmin,(req,res)=>{
    let data;try{data=validate(req.body?.data);for(const url of [data.heroPhotoUrl,...data.bridesmaids.map(m=>m.photoUrl),...data.groomsmen.map(m=>m.photoUrl)])if(url&&!fs.existsSync(path.join(uploadsDir,path.basename(url))))throw new Error('A selected photo is missing. Upload it again before saving.');}
    catch(err){return res.status(400).json({error:err.message});}
    if(!save(data,req.body?.expectedRevision))return res.status(409).json({error:'The bridal train changed on another device. Your draft is kept. Reload saved content before editing again.'});
    res.json(response());
  });
  const photoUpload=multer({storage,limits:{fileSize:10*1024*1024,files:1},fileFilter:(req,file,cb)=>cb(null,['image/jpeg','image/png','image/webp'].includes(file.mimetype))});
  app.post('/api/admin/bridal-train/photo',requireAdmin,photoUpload.single('file'),(req,res)=>{
    if(!req.file)return res.status(400).json({error:'Choose a JPEG, PNG or WebP portrait.'});
    const url='/uploads/'+req.file.filename;previews.enqueue({mediaUrl:url,type:req.file.mimetype});res.json({url});
  });
};
module.exports.validate=validate;
module.exports.defaults=defaults;
