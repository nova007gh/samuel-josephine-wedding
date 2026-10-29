/* App-scoped safe storage. Never changes native Storage or authenticates a guest. */
(()=>{
  const make=kind=>{const memory=new Map(),pending=new Set();return {
    getItem(key){key=String(key);if(pending.has(key))return memory.get(key)??null;try{const value=window[kind].getItem(key);if(value===null)memory.delete(key);else memory.set(key,value);return value;}catch{return memory.get(key)??null;}},
    setItem(key,value){key=String(key);value=String(value);memory.set(key,value);pending.add(key);try{window[kind].setItem(key,value);pending.delete(key);}catch{}},
    removeItem(key){key=String(key);memory.delete(key);pending.add(key);try{window[kind].removeItem(key);pending.delete(key);}catch{}},
    changed(key){if(key===null){memory.clear();pending.clear();}else{memory.delete(key);pending.delete(key);}}
  };};
  const local=make('localStorage'),session=make('sessionStorage');window.WeddingStorage={local,session};window.addEventListener('storage',e=>local.changed(e.key));
  document.documentElement.classList.add('session-restoring');let timer;const settled=()=>{clearTimeout(timer);document.documentElement.classList.remove('session-restoring');};window.WeddingSessionUI={settled};timer=setTimeout(settled,8000);
})();
