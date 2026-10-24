const assert=require('node:assert/strict'),{sideFor}=require('../server/guest-arrival');
for(const relation of ["Jossy's family",'Josephine colleague','bride friend'])assert.equal(sideFor({id:'g',relation}),'jossy');
for(const relation of ["Sam's family",'Samuel colleague','groom friend'])assert.equal(sideFor({id:'g',relation}),'sam');
for(const relation of ['',null,'Unknown','Sam and Jossy','Not Sam']){const g={id:'unknown-guest',relation};assert.ok(['sam','jossy'].includes(sideFor(g)));assert.equal(sideFor(g),sideFor(g));}
const qr=require('../assets/vendor/qrcode-generator-1.4.4'),decode=require('../assets/vendor/jsqr-1.4.0'),value='SJ1-'+'a'.repeat(64),code=qr(0,'M');code.addData(value);code.make();const count=code.getModuleCount(),size=(count+8)*5,pixels=new Uint8ClampedArray(size*size*4).fill(255);
for(let y=0;y<count;y++)for(let x=0;x<count;x++)if(code.isDark(y,x))for(let dy=0;dy<5;dy++)for(let dx=0;dx<5;dx++){const at=(((y+4)*5+dy)*size+(x+4)*5+dx)*4;pixels[at]=pixels[at+1]=pixels[at+2]=0;}
assert.equal(decode(pixels,size,size).data,value);
console.log('PASS relation-based companions, stable unknown/mixed fallback and locally bundled real QR generation/decoding roundtrip');
