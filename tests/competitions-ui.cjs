/* Serve the candidate frontend locally with empty read-only API responses.
   Competition interactions are mocked by competitions-browser-checks.cjs. */
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname.startsWith('/api/')){
    if(req.method!=='GET'){res.writeHead(405);res.end();return;}
    res.setHeader('Content-Type','application/json');
    res.end(JSON.stringify(pathname==='/api/settings'?{}:pathname==='/api/momo-settings'?{number:'+233000000000',accountName:'Mock preview'}:[]));return;
  }
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':decodeURIComponent(pathname)));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
server.listen(0,'127.0.0.1',()=>{
  const child=spawn(process.execPath,[path.join(__dirname,'gifts-design.cjs'),process.argv[2],process.argv[3]||'--competitions'],{stdio:'inherit',env:{...process.env,WEDDING_TEST_URL:'http://127.0.0.1:'+server.address().port+'/'}});
  child.on('exit',code=>{server.close();process.exitCode=code||0;});
});
