'use strict';
module.exports=({app,db,requireAdmin,decorate=row=>row})=>{
  db.exec(`CREATE TABLE IF NOT EXISTS sj_gallery_order (memoryId TEXT PRIMARY KEY REFERENCES memories(id) ON DELETE CASCADE, position INTEGER NOT NULL)`);
  const select=`SELECT m.*, o.position AS sjOrder FROM memories m LEFT JOIN sj_gallery_order o ON o.memoryId=m.id`;
  const gallery=()=>db.prepare(select+` WHERE m.category='sj-gallery' ORDER BY (o.position IS NOT NULL), o.position, m.createdAt DESC, m.id`).all();
  const save=db.transaction((ids,expected)=>{
    const current=gallery();
    if(JSON.stringify(current.map(m=>m.id))!==JSON.stringify(expected))return null;
    if(ids.length!==current.length||new Set(ids).size!==ids.length||ids.some(id=>!current.some(m=>m.id===id)))throw new Error('Include every album item exactly once.');
    db.prepare('DELETE FROM sj_gallery_order').run();
    const stmt=db.prepare('INSERT INTO sj_gallery_order (memoryId,position) VALUES (?,?)');
    ids.forEach((id,i)=>stmt.run(id,i));
    return gallery();
  });
  app.patch('/api/admin/gallery/order',requireAdmin,(req,res)=>{
    const {ids,expected}=req.body||{};
    if(!Array.isArray(ids)||!Array.isArray(expected)||ids.length>10000||expected.length>10000||[...ids,...expected].some(id=>typeof id!=='string'||id.length>100))return res.status(400).json({error:'Invalid album order.'});
    try{
      const items=save(ids,expected);
      if(!items)return res.status(409).json({error:'The album changed on another device. Reload the album and try again.'});
      res.json({items:items.map(decorate)});
    }catch(err){res.status(400).json({error:err.message});}
  });
  return {select};
};
