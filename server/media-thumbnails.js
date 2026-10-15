'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
module.exports=({uploadsDir,ffmpegBin='ffmpeg',enabled=true,width=640,suffix='.thumb.jpg'})=>{
  const queue=[],pending=new Set();let busy=false;
  const thumbnailPath=row=>path.join(uploadsDir,path.basename(row.mediaUrl||'')+suffix);
  function pump(){
    if(busy||!queue.length)return;
    busy=true;
    const row=queue.shift(),target=thumbnailPath(row),temp=target+'.tmp.jpg';
    const child=spawn(ffmpegBin,['-nostdin','-y','-threads','1','-filter_threads','1','-i',path.join(uploadsDir,path.basename(row.mediaUrl)),'-vf',`scale='min(${width},iw)':'min(${width},ih)':force_original_aspect_ratio=decrease`,'-frames:v','1','-q:v','4','-threads','1',temp],{stdio:'ignore'});
    let settled=false;
    const timeout=setTimeout(()=>child.kill('SIGKILL'),60000);
    const finish=ok=>{
      if(settled)return;settled=true;clearTimeout(timeout);
      try{if(ok&&fs.statSync(temp).size>0&&fs.existsSync(path.join(uploadsDir,path.basename(row.mediaUrl))))fs.renameSync(temp,target);else fs.rmSync(temp,{force:true});}catch{try{fs.rmSync(temp,{force:true});}catch{}}
      pending.delete(row.mediaUrl);busy=false;setImmediate(pump);
    };
    child.once('error',()=>finish(false));child.once('close',code=>finish(code===0));
  }
  function enqueue(row){
    if(!enabled||!/^image\//.test(row.type||'')||!row.mediaUrl||pending.has(row.mediaUrl)||fs.existsSync(thumbnailPath(row)))return;
    pending.add(row.mediaUrl);queue.push({mediaUrl:row.mediaUrl});pump();
  }
  function decorate(row){
    if(/^image\//.test(row.type||'')&&row.mediaUrl&&fs.existsSync(thumbnailPath(row)))return {...row,thumbnailUrl:row.mediaUrl+suffix};
    return row;
  }
  return {enqueue,decorate};
};
