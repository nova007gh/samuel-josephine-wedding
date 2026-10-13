'use strict';
module.exports=function validateReceptionProgram(value){
  if(typeof value!=='string'||value.length>32000)throw new Error('Program must be valid text of at most 32,000 characters.');
  let data;try{data=JSON.parse(value);}catch{throw new Error('Program must contain valid JSON.');}
  if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('Invalid program.');
  const text=(value,max,label,required=false)=>{
    if(typeof value!=='string'||value.length>max)throw new Error(`${label} must be text of at most ${max} characters.`);
    const result=value.trim();if(required&&!result)throw new Error(`Enter ${label.toLowerCase()}.`);return result;
  };
  const out={};
  for(const [key,max] of Object.entries({title:120,names:200,tagline:200,dateLabel:160,timeLabel:160,hosts:300,footer:160}))out[key]=text(data[key],max,key,key==='title');
  if(!Array.isArray(data.items)||data.items.length<1||data.items.length>40)throw new Error('Program must have 1–40 activities.');
  out.items=data.items.map(item=>{
    if(!item||typeof item!=='object'||Array.isArray(item))throw new Error('Invalid program activity.');
    return {time:text(item.time,40,'Activity time',true),title:text(item.title,180,'Activity title',true),details:text(item.details,600,'Activity details')};
  });
  const result=JSON.stringify(out);if(result.length>32000)throw new Error('Program is too long.');return result;
};
