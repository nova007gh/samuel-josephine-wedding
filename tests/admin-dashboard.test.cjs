const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const names = ['overview','guests','content','photos','wedding','story','announcements','gifts','access'];
let admin = true;
const saved = new Map();
const handlers = {};
const tabs = names.map(name => ({
  dataset: {adminSection:name}, attrs: {},
  setAttribute(k,v){ this.attrs[k]=v; },
  closest(){ return this; }, focus(){ this.focused=true; }
}));
const panels = names.map(name => {
  const classes = new Set(name==='overview' ? [] : ['hidden']);
  return {id:'admin-panel-'+name, classList:{
    toggle(k,on){ on ? classes.add(k) : classes.delete(k); }, contains(k){return classes.has(k);}
  }};
});
const list = {querySelectorAll:()=>tabs, addEventListener:(name,fn)=>{handlers[name]=fn;}};
const dashboard = {querySelector:()=>list, querySelectorAll:()=>panels};
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../admin-dashboard.js'),'utf8'), {
  document:{querySelector:()=>dashboard}, isAdmin:()=>admin,
  sessionStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)}
});
for(let i=0;i<tabs.length;i++){
  handlers.click({target:tabs[i]});
  assert.equal(panels.filter(p=>!p.classList.contains('hidden')).length,1);
  assert.equal(panels[i].classList.contains('hidden'),false);
  assert.equal(tabs[i].attrs['aria-selected'],'true');
  assert.equal(tabs[i].tabIndex,0);
  assert.equal(saved.get('sj_admin_section'),names[i]);
}
let prevented=false;
handlers.keydown({target:tabs[8],key:'ArrowRight',preventDefault(){prevented=true;}});
assert.equal(prevented,true);
assert.equal(tabs[0].attrs['aria-selected'],'true');
assert.equal(tabs[0].focused,true);
admin=false;
handlers.click({target:tabs[5]});
assert.equal(tabs[0].attrs['aria-selected'],'true','Unauthenticated clicks cannot operate dashboard tabs');
console.log('PASS: all nine sections, one visible panel, ARIA/keyboard navigation, remembered selection and admin guard');
