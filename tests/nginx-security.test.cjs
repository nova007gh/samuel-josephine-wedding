const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../server/nginx-snybena.conf'),'utf8');
for(const block of source.split(/location[^\n]+\{/)){
  const body=block.split(/^    \}/m)[0];
  if(!body.includes('add_header Cache-Control'))continue;
  for(const [name,value] of [['X-Content-Type-Options','nosniff'],['X-Frame-Options','SAMEORIGIN'],['Referrer-Policy','strict-origin-when-cross-origin']]){
    assert.ok(body.includes(`add_header ${name} "${value}" always;`),'Cache-specific location retains '+name);
  }
}
assert.match(source,/proxy_set_header X-Forwarded-For \$remote_addr;/);
assert.doesNotMatch(source,/proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;/);
assert.match(source,/proxy_request_buffering off;/);assert.match(source,/proxy_read_timeout 3600s;/);
assert.match(source,/audio\/webm weba;/);assert.match(source,/audio\/wav wav;/);
console.log('PASS security header inheritance, trusted edge client-IP replacement, streaming limits and recording MIME types');
