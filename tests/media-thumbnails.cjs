/* Actual ffmpeg in a disposable directory, never live uploads. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const crypto=require('node:crypto');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'wedding-thumb-test-'));
const create=require(path.join(process.argv[2]||'../server','media-thumbnails'));
(async()=>{
  try{
    const source=path.join(dir,'source.png');
    execFileSync('ffmpeg',['-loglevel','error','-f','lavfi','-i','testsrc=size=2400x1600:rate=1','-frames:v','1','-threads','1',source]);
    const hash=()=>crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'),before=hash();
    const worker=create({uploadsDir:dir});const row={type:'image/png',mediaUrl:'/uploads/source.png'};
    assert.equal(worker.decorate(row).thumbnailUrl,undefined);worker.enqueue(row);worker.enqueue(row);
    for(let i=0;i<300&&!fs.existsSync(source+'.thumb.jpg');i++)await new Promise(r=>setTimeout(r,100));
    assert.ok(fs.existsSync(source+'.thumb.jpg'));assert.equal(hash(),before);
    const thumb=worker.decorate(row);assert.equal(thumb.thumbnailUrl,'/uploads/source.png.thumb.jpg');
    const dims=JSON.parse(execFileSync('ffprobe',['-v','quiet','-show_streams','-of','json',source+'.thumb.jpg']).toString()).streams[0];
    assert.ok(dims.width<=640&&dims.height<=640);assert.ok(fs.statSync(source+'.thumb.jpg').size<fs.statSync(source).size);
    assert.equal(worker.decorate({type:'video/mp4',mediaUrl:'/uploads/clip.mp4'}).thumbnailUrl,undefined);
    console.log(`PASS actual thumbnail generation: ${fs.statSync(source).size} → ${fs.statSync(source+'.thumb.jpg').size} bytes, bounded dimensions, original hash retained, missing/video fallbacks`);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
})().catch(err=>{console.error(err);process.exitCode=1;});
