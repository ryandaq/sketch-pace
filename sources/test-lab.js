const assert=require('node:assert/strict');
require('../lab.js');
const {MODE,IDS,makeChallenge,scorePaths,scoreDots,pathQuality,mergeBackup}=globalThis.SketchPaceLabCore;
assert.equal(IDS.length,34,'catalog breadth');
for(const id of IDS){
  for(let run=0;run<10;run++){
    const c=makeChallenge(id,run%3+1);
    assert.equal(c.id,id);
    assert.ok(Array.isArray(c.paths)&&Array.isArray(c.reference)&&Array.isArray(c.guides));
    for(const item of c.paths){const path=item.points||item;assert.ok(path.length>=2,`${id} path has points`);for(const p of path){assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y),`${id} finite coordinates`);assert.ok(p.x>=0&&p.x<=1000&&p.y>=0&&p.y<=650,`${id} target within canvas`);}}
  }
  assert.ok(MODE[id].name&&MODE[id].category&&MODE[id].note,`${id} catalog metadata`);
}
for(const id of IDS.filter(x=>MODE[x].kind==='auto'&&x!=='dots')){
  const c=makeChallenge(id,2),ideal=c.paths.map(item=>({points:item.points||item,width:item.width||3}));
  assert.equal(scorePaths(ideal,c.paths,id==='weight'),100,`${id} perfect trace`);
  const shifted=ideal.map(s=>({...s,points:s.points.map(p=>({x:p.x+70,y:p.y+55}))}));
  assert.ok(scorePaths(shifted,c.paths,id==='weight')<scorePaths(ideal,c.paths,id==='weight'),`${id} displaced drawing scores lower`);
}
const d=makeChallenge('dots',2);
assert.equal(scoreDots([{points:d.paths[0]}],d.landmarks),100,'dot route permits matching through points');
const extended=[{x:d.paths[0][0].x-50,y:d.paths[0][0].y+27},...d.paths[0],{x:d.paths[0].at(-1).x+50,y:d.paths[0].at(-1).y-27}];
assert.ok(scoreDots([{points:extended}],d.landmarks)>=85,'dot route permits extended endpoints');
assert.ok(scoreDots([{points:d.paths[0].slice().reverse()}],d.landmarks)<60,'dot route checks numbered order');
const plane=makeChallenge('ellipsoid',2);
for(const dot of plane.landmarks)assert.ok(globalThis.SketchPaceLabCore.nearest(dot,plane.paths[0])<2,'plane ellipse passes through its dots');
const shadow=makeChallenge('shadow',2);
assert.ok((shadow.paths[1].reduce((n,p)=>n+p.x,0)/shadow.paths[1].length-500)*(shadow.landmarks[0].x-500)<0,'shadow casts away from light');
for(const id of ['thumbnail','storyboard','remix'])assert.match(makeChallenge(id,2,'Repairable desk lamp').prompt,/Repairable desk lamp/i,'custom product brief reaches idea mode');
assert.ok(pathQuality([{x:0,y:0},{x:10,y:0}],[{x:0,y:0},{x:10,y:0}])>99);
const attempt={id:'trace',date:'2026-10-14T12:00:00.000Z',score:76,rating:null,time:21,level:2};
const backup=mergeBackup({history:[attempt],favorites:['trace'],prompts:['Desk lamp'],pinned:{},xp:12,lastDay:'2026-10-14',streak:1},{version:1,history:[attempt,{...attempt,id:'ghost',date:'2026-10-15T12:00:00.000Z',score:81},{...attempt,id:'invalid'}],favorites:['ghost'],prompts:['Desk lamp','Travel kettle'],pinned:{trace:{level:2,challenge:makeChallenge('trace',2)}},xp:30,lastDay:'2026-10-15',streak:2});
assert.equal(backup.data.history.length,2,'backup merges and deduplicates valid attempts');
assert.deepEqual(backup.data.favorites,['trace','ghost']);
assert.deepEqual(backup.data.prompts,['Desk lamp','Travel kettle']);
assert.ok(backup.data.pinned.trace);
assert.equal(backup.data.xp,30);
const badPin=mergeBackup({history:[],favorites:[],prompts:[],pinned:{},xp:0,lastDay:'',streak:0},{version:1,pinned:{trace:{level:2,challenge:{...makeChallenge('trace',2),guides:[[{x:-1,y:0},{x:10,y:10}]]}}}});
assert.equal(badPin.data.pinned.trace,undefined,'malformed pinned geometry is rejected');
assert.throws(()=>mergeBackup({},{}),/not a Sketch Pace Lab/);
console.log(`Lab checks passed: ${IDS.length} modes, geometry scoring, through-dot route.`);
