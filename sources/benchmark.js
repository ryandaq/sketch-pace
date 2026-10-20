// Runtime observations for current v5 scoring. Run: node sources/benchmark.js
const fs=require("fs"),vm=require("vm"),path=require("path");
const {performance}=require("perf_hooks");
const nodes=new Map(),ctx={setTransform(){},clearRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},setLineDash(){},arc(){},fill(){}};
function el(id){if(!nodes.has(id))nodes.set(id,{value:"",textContent:"",innerHTML:"",hidden:false,style:{},classList:{toggle(){}},children:[],addEventListener(){},append(){},replaceChildren(){},getContext(){return ctx;},getBoundingClientRect(){return {left:0,top:0,width:900,height:520};}});return nodes.get(id);}
const sandbox={document:{getElementById:el,querySelector(){return {classList:{toggle(){}}};},createElement(){return el("new"+Math.random());}},window:{devicePixelRatio:1,addEventListener(){}},localStorage:{getItem(){return null;},setItem(){}},ResizeObserver:class{observe(){}},performance,setInterval(){},Date,Math,JSON};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,"..","app.js"),"utf8"),sandbox);
const q=sandbox.window.SketchPaceDebug;
function bench(fn,count){for(let i=0;i<100;i++)fn();const samples=[];for(let trial=0;trial<5;trial++){const start=performance.now();for(let i=0;i<count;i++)fn();samples.push((performance.now()-start)*1000/count);}return samples.sort((a,b)=>a-b)[2];}
const line={points:[{x:100,y:100},{x:600,y:350}]},lineStroke=Array.from({length:180},(_,i)=>({x:100+500*i/179,y:100+250*i/179+Math.sin(i*.2)*2}));
const through={points:[{x:200,y:150},{x:500,y:300}]},throughStroke=Array.from({length:180},(_,i)=>({x:100+500*i/179,y:100+250*i/179+Math.sin(i*.2)*2}));
const spec={type:"ellipse",cx:450,cy:260,rx:130,ry:75,angle:.35},ellipse=q.targetEdges(spec)[0],ellipseStroke=ellipse.points.map((p,i)=>({x:p.x+Math.sin(i*.2)*2,y:p.y+Math.cos(i*.2)*2}));
const box=q.makeBoxSpec(900,520,"tall"),edges=q.boxGeometry(box,900,520).edges,strokes=edges.slice().reverse().map(e=>e.points);
for(const [name,fn,count] of [["line",()=>q.gradeLine(lineStroke,line),1000],["through dots",()=>q.gradeThroughLine(throughStroke,through),1000],["ellipse",()=>q.gradeEllipse(ellipseStroke,ellipse),300],["nine-edge box",()=>q.gradeBox(strokes,edges),100]])console.log(`${name.padEnd(14)} ${bench(fn,count).toFixed(1)} µs per completed target`);
