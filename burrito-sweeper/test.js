const E = require('./engine.js'); const assert = require('assert');
for (const [w,h,m] of [[9,9,10],[16,16,40],[30,16,99]]) for (let t=0;t<300;t++){
  const e=new E(w,h,m); const i=Math.floor(Math.random()*w*h); e.reveal(i);
  assert(!e.mine[i] && !e.over || e.won, 'first click safe');
  assert.equal(e.mine.filter(Boolean).length,m);
  // auto-solve by revealing all safe cells -> must win
  for(let j=0;j<w*h;j++) if(!e.mine[j]) e.reveal(j);
  assert(e.won && e.flags===m);
}
const e=new E(9,9,10); e.reveal(40); const mi=e.mine.indexOf(true);
e.toggleFlag(mi); assert.equal(e.flags,1); e.toggleFlag(mi); assert.equal(e.flags,0);
// chord test
const n=e.adj.findIndex((a,k)=>a>0&&e.state[k]===1);
e.neighbors(n).forEach(k=>{if(e.mine[k]&&e.state[k]===0)e.toggleFlag(k)});
e.chord(n); assert(!e.over||e.won);
e.reveal(mi); // may be flagged by chord? ensure lose path
const f=new E(9,9,10); f.reveal(0); const m2=f.mine.indexOf(true); f.reveal(m2); assert(f.over&&!f.won&&f.exploded===m2);
console.log('engine tests passed');
