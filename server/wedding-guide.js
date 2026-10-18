'use strict';
// Production API is deployed flat; the repository keeps shared browser code one level up.
const path=require('node:path'),fs=require('node:fs');
const {build}=require(fs.existsSync(path.join(__dirname,'wedding-guide-knowledge.js'))?'./wedding-guide-knowledge':'../wedding-guide-knowledge');
// Explicit allowlist. Never scan guests, messages, payments, sessions or arbitrary settings.
const keys=['weddingFormal','weddingDateISO','weddingVenue','weddingHashtag','rsvpDeadline','storyText','storyItems','couplePhotoUrl','photo:sam-adult','events','receptionProgram','engagementProgram','liveBroadcast','entertainment','bridalTrain'];
module.exports=({app,db})=>{
  const get=db.prepare('SELECT value FROM settings WHERE key=?');
  app.get('/api/guide',(req,res)=>{
    const settings={};for(const key of keys){const row=get.get(key);if(row)settings[key]=row.value;}
    try{res.set('Cache-Control','no-store').json(build(settings));}catch{res.status(503).set('Cache-Control','no-store').json({error:'The guide is temporarily unavailable. Please use the app pages directly.'});}
  });
};
