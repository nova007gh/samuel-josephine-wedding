((root,factory)=>{const s=factory();if(typeof module==='object'&&module.exports)module.exports=s;else root.TablesFoodSchema=s;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  const categories={local:'Local Chops',main:'Main Dishes',drinks:'Drinks',desserts:'Desserts'};
  const normal=v=>String(v||'').normalize('NFKC').trim().replace(/[’‘]/g,"'").replace(/\s+/g,' ').toLowerCase();
  const defaults=()=>({autoEnabled:false,tables:[],rules:[],menu:{published:false,title:'Food & Drinks Menu',subtitle:'Eat · Drink · Celebrate',heroPhotoUrl:'',items:[]}});
  const text=(v,max,label)=>{if(typeof v!=='string'||v.length>max)throw Error(label+' is invalid or too long.');return v.trim();};
  const photo=v=>{v=text(v,200,'Photo');if(v&&!/^\/uploads\/[\w-]+\.(jpe?g|png|webp)$/i.test(v))throw Error('Choose an uploaded JPEG, PNG or WebP photo.');return v;};
  const id=v=>{if(typeof v!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(v))throw Error('Invalid record ID.');return v;};
  const flag=v=>{if(typeof v!=='boolean')throw Error('Choose on/off.');return v;};
  function rows(v,max){if(!Array.isArray(v)||v.length>max)throw Error('Too many rows or invalid list.');const ids=new Set();for(const r of v){if(!r||ids.has(id(r.id)))throw Error('Each record needs a unique ID.');ids.add(r.id);}return v;}
  function validate(v){if(!v||!v.menu)throw Error('Choose valid table and food settings.');const names=new Set();
    const tables=rows(v.tables,100).map(t=>{const name=text(t.name,60,'Table name');if(!name||names.has(normal(name)))throw Error('Table names must be non-empty and unique.');names.add(normal(name));if(!Number.isSafeInteger(t.capacity)||t.capacity<1||t.capacity>100)throw Error('Table capacity must be 1–100 people.');return {id:t.id,name,capacity:t.capacity,location:text(t.location,400,'Table location'),enabled:flag(t.enabled)};});
    const rules=rows(v.rules,100).map(r=>{if(!['relation','sam','jossy'].includes(r.match))throw Error('Choose an exact relation or inviter side.');const value=text(r.value,120,'Relation');if(r.match==='relation'&&!value)throw Error('Enter the exact saved relation.');if(!Array.isArray(r.tableIds)||!r.tableIds.length||r.tableIds.some(x=>!tables.some(t=>t.id===x))||new Set(r.tableIds).size!==r.tableIds.length)throw Error('Choose at least one saved table for each rule.');return {id:r.id,match:r.match,value:r.match==='relation'?value:'',tableIds:[...r.tableIds],enabled:flag(r.enabled)};});
    const keys=new Set();for(const r of rules.filter(r=>r.enabled)){const k=r.match+':'+normal(r.value);if(keys.has(k))throw Error('Only one enabled rule per exact relation or side.');keys.add(k);}
    const m=v.menu,title=text(m.title,100,'Menu title');if(!title)throw Error('Enter the menu title.');const menu={published:flag(m.published),title,subtitle:text(m.subtitle,200,'Menu subtitle'),heroPhotoUrl:photo(m.heroPhotoUrl),items:rows(m.items,120).map(i=>{if(!Object.hasOwn(categories,i.category))throw Error('Choose a food category.');const name=text(i.name,100,'Dish name');if(!name)throw Error('Enter a dish name.');return {id:i.id,name,category:i.category,description:text(i.description,400,'Dish description'),allergens:text(i.allergens,200,'Dietary / allergen note'),photoUrl:photo(i.photoUrl),published:flag(i.published)};})};
    return {autoEnabled:flag(v.autoEnabled),tables,rules,menu};
  }
  function chooseRule(data,relation,side){const exact=data.rules.find(r=>r.enabled&&r.match==='relation'&&normal(r.value)===normal(relation));return exact||data.rules.find(r=>r.enabled&&r.match===side)||null;}
  return {categories,normal,defaults,validate,chooseRule};
});
