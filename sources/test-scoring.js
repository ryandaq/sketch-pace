const fs = require("fs");
const vm = require("vm");
const path = require("path");
const assert = require("assert");
const html=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
const appSource=fs.readFileSync(path.join(__dirname,"..","app.js"),"utf8");
for(const match of appSource.matchAll(/\$\("([^"]+)"\)/g))assert(html.includes(`id="${match[1]}"`),`missing HTML control ${match[1]}`);
for(const type of ["line","through","ellipse","arc","box"])for(const suffix of ["Enabled","Guide"])assert(html.includes(`id="${type+suffix}"`));
for(const type of ["line","ellipse","arc"])for(let i=0;i<(type==="arc"?2:3);i++)for(const suffix of ["Weight","Percent"])assert(html.includes(`id="${type+suffix+i}"`));

const listeners = {}, elements = new Map(), storage = new Map();
const ctx = {setTransform(){},clearRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},setLineDash(){},arc(){},fill(){}};
function element(id){
  if(!elements.has(id))elements.set(id,{
    id,textContent:"",innerHTML:"",hidden:false,disabled:false,checked:true,value:"",style:{},children:[],
    classList:{toggle(){}},
    addEventListener(name,fn){listeners[`${id}:${name}`]=fn;},
    click(){listeners[`${id}:click`]?.();},
    append(...items){this.children.push(...items);},
    replaceChildren(...items){this.children=items;},
    getBoundingClientRect(){return {left:0,top:0,width:900,height:520};},
    setPointerCapture(){},
    getContext(){return ctx;}
  });
  return elements.get(id);
}
const sandbox={
  document:{getElementById:element,querySelector(){return {classList:{toggle(){}}};},createElement(tag){return element(`created-${tag}-${Math.random()}`);},activeElement:{tagName:"BODY"}},
  window:{devicePixelRatio:1,addEventListener(){}},
  localStorage:{getItem(k){return storage.get(k)??null;},setItem(k,v){storage.set(k,v);}},
  ResizeObserver:class{observe(){}},performance:{now:()=>Date.now()},setInterval(){},
  console,Date,Math,JSON,Blob,URL
};
vm.runInNewContext(appSource,sandbox,{filename:"app.js"});
const qa=sandbox.window.SketchPaceDebug;
const state=qa.state;
function draw(points){
  const event=p=>({pointerType:"mouse",pointerId:1,button:0,clientX:p.x,clientY:p.y,preventDefault(){}});
  listeners["drawingCanvas:pointerdown"](event(points[0]));
  for(let i=1;i<points.length-1;i++)listeners["drawingCanvas:pointermove"](event(points[i]));
  listeners["drawingCanvas:pointerup"](event(points.at(-1)));
}
function completeCurrent(){
  const type=state.target.type,edges=qa.targetEdges(state.target);
  if(type==="box"){for(const edge of edges.slice().reverse())draw(edge.points.slice().reverse());element("scoreBoxButton").click();}
  else if(type==="through")draw([state.target.guideA,state.target.guideB]);
  else draw(edges[0].points);
}

// A line is judged by its two dots, whichever direction it was drawn.
const lineTarget={points:[{x:100,y:100},{x:400,y:100}]};
const straight=[{x:100,y:100},{x:400,y:100}];
assert(qa.gradeLine(straight,lineTarget).score>99);
assert(Math.abs(qa.gradeLine(straight,lineTarget).score-qa.gradeLine(straight.slice().reverse(),lineTarget).score)<1e-9);
const shifted=straight.map(p=>({x:p.x,y:p.y+50}));
assert(qa.gradeLine(shifted,lineTarget).metrics[0]<20);
assert(qa.gradeLine(shifted,lineTarget).metrics[1]>99);
const wavy=Array.from({length:60},(_,i)=>({x:100+300*i/59,y:100+20*Math.sin(4*Math.PI*i/59)}));
assert(qa.gradeLine(wavy,lineTarget).metrics[1]<80);

// Through-dot scoring depends on crossing both dots, never matching stroke ends.
const throughTarget={points:[{x:100,y:100},{x:200,y:100}]};
const shortThrough=[{x:75,y:100},{x:225,y:100}];
const longThrough=[{x:0,y:100},{x:300,y:100}];
assert(qa.gradeThroughLine(shortThrough,throughTarget).score>99);
assert(qa.gradeThroughLine(longThrough,throughTarget).score>99);
assert(Math.abs(qa.gradeThroughLine(longThrough,throughTarget).score-qa.gradeThroughLine(longThrough.slice().reverse(),throughTarget).score)<1e-9);
assert(qa.gradeThroughLine([{x:75,y:100},{x:150,y:100}],throughTarget).score<=30,"missing either checkpoint must be costly");
assert(qa.gradeThroughLine([{x:0,y:125},{x:300,y:125}],throughTarget).metrics[0]<20);
assert(qa.gradeThroughLine([{x:75,y:100},{x:125,y:135},{x:175,y:65},{x:225,y:100}],throughTarget).metrics[1]<80);
for(let i=0;i<100;i++){const target=qa.makeTarget("through",900,520);for(const p of [target.guideA,target.guideB])assert(p.x>=0&&p.x<=900&&p.y>=0&&p.y<=520);}

// Perfect ellipses score higher than distorted loops.
const ellipseTarget={type:"ellipse",cx:300,cy:240,rx:130,ry:70,angle:.3};
const ellipse=qa.targetEdges(ellipseTarget)[0];
assert(qa.gradeEllipse(ellipse.points,ellipse).score>95);
const distorted=ellipse.points.map((p,i)=>({x:ellipse.center.x+(p.x-ellipse.center.x)*(1+.1*Math.sin(i*.7)),y:ellipse.center.y+(p.y-ellipse.center.y)*(1+.1*Math.sin(i*.7))}));
assert(qa.gradeEllipse(distorted,ellipse).score<qa.gradeEllipse(ellipse.points,ellipse).score);

// Both arc variants fit the canvas and score the intended branch in either direction.
for(const variant of ["three","tangent"])for(const [w,h] of [[900,520],[520,520],[390,520]])for(let i=0;i<80;i++){
  const spec=qa.makeArcSpec(w,h,variant),edge=qa.targetEdges(spec)[0],perfect=qa.gradeArc(edge.points,edge),backward=qa.gradeArc(edge.points.slice().reverse(),edge);
  assert(edge.points.every(p=>p.x>=w*.08&&p.x<=w*.92&&p.y>=h*.08&&p.y<=h*.92),`${variant} arc outside ${w}×${h}`);
  assert(perfect.score>95,`${variant} perfect arc score ${perfect.score}`);
  assert(Math.abs(perfect.score-backward.score)<1e-7,`${variant} score changes with direction`);
  const [a,b]=[edge.points[0],edge.points.at(-1)],chord=Array.from({length:61},(_,j)=>({x:a.x+(b.x-a.x)*j/60,y:a.y+(b.y-a.y)*j/60}));
  assert(qa.gradeArc(chord,edge).score<perfect.score-20,`${variant} chord should score poorly`);
  const shifted=edge.points.map(p=>({x:p.x+Math.min(25,w*.06),y:p.y}));
  assert(qa.gradeArc(shifted,edge).score<perfect.score-15,`${variant} shifted arc should score poorly`);
}

// Tall, balanced, and wide constructions must actually vary in canvas space.
for(const [shape,min,max] of [["tall",1.12,Infinity],["wide",0,.86],["balanced",.86,1.12]]){
  for(const [w,h] of [[900,520],[520,520],[390,520]]){
    for(let i=0;i<100;i++){const spec=qa.makeBoxSpec(w,h,shape),aspect=qa.boxAspect(spec,w,h);assert(aspect>=min&&aspect<=max,`${shape} box aspect ${aspect} at ${w}×${h}`);assert(qa.boxGeometry(spec,w,h).vertices.every(p=>p.x>=w*.05&&p.x<=w*.95&&p.y>=h*.04&&p.y<=h*.95),`${shape} box leaves ${w}×${h} canvas`);}
  }
}
const box=qa.makeBoxSpec(900,520,"tall"),edges=qa.boxGeometry(box,900,520).edges;
const complete=qa.gradeBox(edges.map(x=>x.points),edges);
const reversed=qa.gradeBox(edges.slice().reverse().map(x=>x.points.slice().reverse()),edges);
assert(complete.score>90,`perfect box ${complete.score}`);
assert(Math.abs(complete.score-reversed.score)<1e-7,"box score must ignore edge order and direction");
assert(qa.gradeBox(edges.slice(0,4).map(x=>x.points),edges).score<55,"missing edges lower score");
assert(qa.gradeBox([...edges.map(x=>x.points),edges[0].points],edges).score<complete.score,"extra edge lowers score");

// Frequency values are independent 0–5 weights, and at least one size stays on.
listeners["lineWeight0:input"]({target:{value:"0"}});
listeners["lineWeight1:input"]({target:{value:"0"}});
listeners["lineWeight2:input"]({target:{value:"0"}});
assert(state.prefs.weights.line.some(x=>x>0));
assert.equal(element("linePercent2").textContent,"1/5");
listeners["arcWeight0:input"]({target:{value:"0"}});
assert.equal(qa.makeTarget("arc",900,520).variant,"tangent");
listeners["arcWeight1:input"]({target:{value:"0"}});
assert(state.prefs.weights.arc.some(x=>x>0));

element("practiceButton").click();
assert.equal(state.mode,"practice");
for(let i=0;i<18;i++){completeCurrent();assert.equal(state.mode,"practice");assert.equal(state.completed,i+1);}
assert.equal(element("previousResult").hidden,false);
assert.equal(state.stats.line.count+state.stats.through.count+state.stats.ellipse.count+state.stats.arc.count+state.stats.box.count,18);
assert(storage.has("sketch-pace-v5"));

// Box strokes accumulate without scoring until explicit submission.
state.prefs.enabled={line:false,through:false,ellipse:false,arc:false,box:true};
element("practiceButton").click();
assert.equal(state.mode,null);
element("practiceButton").click();
const firstBox=qa.targetEdges(state.target);
draw(firstBox[2].points);
assert.equal(state.completed,0);
assert.equal(state.strokes.length,1);
element("undoButton").click();
assert.equal(state.strokes.length,0);
for(const edge of firstBox.slice().reverse())draw(edge.points);
assert.equal(state.completed,0);
element("scoreBoxButton").click();
assert.equal(state.completed,1);

// The new drill can run by itself; hiding its guide keeps checkpoint scoring.
element("practiceButton").click();
state.prefs.enabled={line:false,through:true,ellipse:false,arc:false,box:false};
element("practiceButton").click();
assert.equal(state.target.type,"through");
const beforeThrough=state.stats.through.count;
const checkpointPair=[state.target.a,state.target.b];
listeners["throughGuide:change"]({target:{checked:false}});
assert.equal(state.prefs.guide.through,false);
assert.equal(state.target.a,checkpointPair[0]);
assert.equal(state.target.b,checkpointPair[1]);
completeCurrent();
assert.equal(state.stats.through.count,beforeThrough+1);

// Arc variants can each run alone, with guide visibility independent of scoring.
element("practiceButton").click();
state.prefs.enabled={line:false,through:false,ellipse:false,arc:true,box:false};
state.prefs.weights.arc=[5,0];
element("practiceButton").click();
assert.equal(state.target.type,"arc");
assert.equal(state.target.variant,"three");
const beforeArcs=state.stats.arc.count;
listeners["arcGuide:change"]({target:{checked:false}});
assert.equal(state.prefs.guide.arc,false);
completeCurrent();
assert.equal(state.stats.arc.count,beforeArcs+1);
state.prefs.weights.arc=[0,5];
element("resetButton").click();
assert.equal(state.target.variant,"tangent");
completeCurrent();
assert.equal(state.stats.arc.count,beforeArcs+2);

// Test freezes selected types, advances exactly its length, and records one overall result.
state.prefs.enabled={line:true,through:true,ellipse:true,arc:true,box:true};
element("testLength").value="6";
listeners["testLength:change"]({target:{value:"6"}});
element("testButton").click();
assert.equal(state.mode,"test");
assert.equal(state.testPlan.length,6);
assert.equal(new Set(state.testPlan).size,5);
for(let i=0;i<6;i++)completeCurrent();
assert.equal(state.mode,"complete");
assert.equal(state.tests.length,1);
assert.equal(state.tests[0].count,6);
assert(state.tests[0].score>85);
assert.equal(element("canvasOverlay").hidden,false);

// Loading an older version-5 save preserves progress and adds arc defaults.
storage.set("sketch-pace-v5",JSON.stringify({version:5,preferences:{enabled:{line:true,through:false,ellipse:false,box:false},guide:{line:false,through:true,ellipse:true,box:true},weights:{line:[1,2,3],ellipse:[2,4,2]},testLength:12,inputMode:"auto"},practice:{line:{count:3,score:240,time:18}},tests:[{date:"2026-10-01T00:00:00.000Z",score:80,time:45,count:6,types:["line"]}]}));
vm.runInNewContext(appSource,sandbox,{filename:"app.js"});
const migrated=sandbox.window.SketchPaceDebug.state;
assert.equal(migrated.stats.line.count,3);
assert.equal(migrated.tests.length,1);
assert.equal(migrated.prefs.enabled.arc,true);
assert.deepEqual(Array.from(migrated.prefs.weights.arc),[3,3]);
console.log("Sketch Pace v5 scoring and session checks passed.");
