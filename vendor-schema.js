/* Shared public content schema. No sample vendors or bookings. */
((root,factory)=>{if(typeof module==='object'&&module.exports)module.exports=factory();else root.WeddingVendors=factory();})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';
  const copy={eyebrow:'Our',title:'Vendors',subtitle:'Amazing partners making our day special',heroAlt:'Samuel and Josephine',heading:'Our Vendors',tagline:'Our trusted partners',allLabel:'All Vendors',searchLabel:'Search vendors…',filterLabel:'Filter',featuredLabel:'Featured only',callLabel:'Call',whatsappLabel:'WhatsApp',refreshLabel:'Refresh vendors',emptyLabel:'Confirmed vendors will appear here soon.',noResultsLabel:'No vendors match your search.',contactNote:'Contact vendors directly for availability and services.'};
  const icons=['store','catering','decor','camera','music','beauty','grid'];
  const defaults=()=>({...copy,heroUrl:'',heroPosition:50,categories:['Catering','Decor','Photo & Video','Entertainment','Beauty','Others'].map((name,i)=>({id:'category-'+i,name,icon:icons[i+1]})),vendors:[]});
  function validate(input){
    if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid vendor page.');
    const text=(v,max,label,required=false)=>{if(typeof v!=='string'||v.length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v))throw new Error(label+': invalid text or too long.');const s=v.trim();if(required&&!s)throw new Error(label+' is required.');return s;};
    const id=v=>{if(typeof v!=='string'||! /^[a-zA-Z0-9_-]{1,80}$/.test(v))throw new Error('Invalid row ID.');return v;};
    const photo=v=>{const s=text(v,300,'Photo');if(s&&!/^\/uploads\/[a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|webp)$/i.test(s))throw new Error('Use an uploaded JPEG, PNG or WebP photo.');return s;};
    const phone=v=>{const s=text(v,20,'Contact number');if(s&&!/^\+[1-9]\d{7,14}$/.test(s))throw new Error('Contact numbers need a country code, e.g. +233… (no spaces).');return s;};
    const out={};for(const key of Object.keys(copy))out[key]=text(input[key],key==='subtitle'||key.endsWith('Label')||key==='contactNote'?240:120,key,true);
    out.heroUrl=photo(input.heroUrl);if(!Number.isInteger(input.heroPosition)||input.heroPosition<0||input.heroPosition>100)throw new Error('Banner position must be 0–100.');out.heroPosition=input.heroPosition;
    if(!Array.isArray(input.categories)||input.categories.length<1||input.categories.length>12)throw new Error('Use 1–12 categories.');
    const cats=new Set();out.categories=input.categories.map(c=>{if(!c||cats.has(id(c.id)))throw new Error('Duplicate or invalid category.');if(!icons.includes(c.icon))throw new Error('Choose a category icon.');cats.add(c.id);return {id:c.id,name:text(c.name,60,'Category name',true),icon:c.icon};});
    if(!Array.isArray(input.vendors)||input.vendors.length>60)throw new Error('Maximum 60 vendors.');const ids=new Set();
    out.vendors=input.vendors.map(v=>{if(!v||ids.has(id(v.id)))throw new Error('Duplicate or invalid vendor.');ids.add(v.id);if(!cats.has(v.category))throw new Error('Choose an existing category for every vendor.');if(typeof v.published!=='boolean'||typeof v.featured!=='boolean')throw new Error('Invalid publication option.');return {id:v.id,name:text(v.name,120,'Vendor name',true),category:v.category,badge:text(v.badge,60,'Card label'),description:text(v.description,600,'Description'),photoUrl:photo(v.photoUrl),phone:phone(v.phone),whatsapp:phone(v.whatsapp),published:v.published,featured:v.featured};});return out;
  }
  return {defaults,validate,copy,icons};
});
