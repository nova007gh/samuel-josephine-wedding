const assert=require('node:assert/strict'),{defaults,validate}=require('../vendor-schema');
const initial=defaults();assert.deepEqual(validate(initial),initial);assert.equal(initial.vendors.length,0,'No sample bookings');
const vendor={id:'vendor-1',name:'Confirmed Partner',category:initial.categories[0].id,badge:'Catering',description:'Published service',photoUrl:'',phone:'+233240000001',whatsapp:'+233240000001',published:true,featured:true};
const good={...initial,vendors:[vendor]};assert.deepEqual(validate(good),good);
for(const change of [{phone:'javascript:alert(1)'},{whatsapp:'0240000001'},{photoUrl:'https://example.com/photo.jpg'},{photoUrl:'/uploads/../secret.png'},{category:'missing'},{name:''},{published:'true'},{id:'<script>'}])assert.throws(()=>validate({...good,vendors:[{...vendor,...change}]}));
for(const change of [{heroPosition:-1},{heroPosition:101},{heroPosition:2.5},{heroUrl:'data:image/png,x'},{categories:[]},{categories:[initial.categories[0],initial.categories[0]]},{vendors:[vendor,vendor]},{title:''},{subtitle:'a'.repeat(241)},{vendors:Array.from({length:61},(_,i)=>({...vendor,id:'vendor-'+i}))}])assert.throws(()=>validate({...good,...change}));
assert.equal(validate({...good,title:'<img src=x onerror=alert(1)>'}).title,'<img src=x onerror=alert(1)>','Text remains text and is escaped by renderers');
console.log('PASS vendors defaults, editable copy, categories, contacts, photo boundaries, publication types and limits');
