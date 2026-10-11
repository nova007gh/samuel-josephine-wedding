const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../server/server.js'),'utf8');
const fn=source.slice(source.indexOf('function queueTranscode('),source.indexOf('\nfunction pumpTranscode('));
let row,stats=0,pumps=0;
const queue=[],ids=new Set();
const context={ffmpegOk:true,db:{prepare:()=>({get:()=>row})},fs:{statSync:()=>{stats++;return {size:50*1024*1024};}},
  path,UPLOADS_DIR:'/isolated',TRANSCODE_MIN_BYTES:12*1024*1024,WEB_SAFE_VIDEO_EXT:new Set(['.mp4','.webm','.m4v']),
  transcodeQueue:queue,transcodeIds:ids,pumpTranscode:()=>{pumps++;}};
vm.createContext(context);vm.runInContext(fn,context);
for(const mediaUrl of ['/uploads/video.web.mp4','/uploads/video.web.web.web.web.mp4']){
  row={mediaUrl,type:'video/mp4'};context.queueTranscode(mediaUrl);
}
assert.equal(queue.length,0);assert.equal(stats,0);
row={mediaUrl:'/uploads/original.mov',type:'video/quicktime'};context.queueTranscode('original');context.queueTranscode('original');
assert.equal(queue.length,1);assert.equal(pumps,1);assert.equal(stats,1);
console.log('PASS: compressed video outputs are not recompressed on restart; original videos still queue once');
