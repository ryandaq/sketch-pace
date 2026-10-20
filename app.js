(() => {
  "use strict";
  const KEY = "sketch-pace-v5";
  const TYPES = ["line", "through", "ellipse", "arc", "box"];
  const NAMES = {line:"Lines",through:"Through-dot lines",ellipse:"Ellipses",arc:"Arcs",box:"Boxes"};
  const $ = id => document.getElementById(id);
  const canvas = $("drawingCanvas"), wrap = $("canvasWrap"), ctx = canvas.getContext("2d"), overlay = $("canvasOverlay");
  const defaults = () => ({enabled:{line:true,through:true,ellipse:true,arc:true,box:true},guide:{line:true,through:true,ellipse:true,arc:true,box:true},weights:{line:[2,4,2],ellipse:[2,4,2],arc:[3,3]},testLength:12,inputMode:"auto"});
  const emptyStats = () => ({line:{count:0,score:0,time:0},through:{count:0,score:0,time:0},ellipse:{count:0,score:0,time:0},arc:{count:0,score:0,time:0},box:{count:0,score:0,time:0}});
  const state = {mode:null,prefs:defaults(),stats:emptyStats(),tests:[],target:null,strokes:[],current:[],drawing:false,pointerId:null,targetStarted:0,sessionStarted:0,completed:0,testPlan:[],testResults:[],lastType:null,lastResult:null,size:{w:0,h:0}};
  const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
  const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
  const avg = a => a.reduce((x,y)=>x+y,0)/Math.max(1,a.length);
  const round = n => Math.round(n);
  const between = (a,b) => a+Math.random()*(b-a);
  const formatTime = s => s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s/60)}m ${String(Math.floor(s%60)).padStart(2,"0")}s`;
  const clockTime = s => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}`;
  function selected(){return TYPES.filter(type=>state.prefs.enabled[type]);}
  function weightedIndex(weights){const total=weights.reduce((a,b)=>a+b,0);let pick=Math.random()*total;for(let i=0;i<weights.length;i++){pick-=weights[i];if(pick<0)return i;}return weights.findIndex(x=>x>0);}
  function sampleLine(a,b,n=70){return Array.from({length:n},(_,i)=>({x:a.x+(b.x-a.x)*i/(n-1),y:a.y+(b.y-a.y)*i/(n-1)}));}
  function sampleEllipse(cx,cy,rx,ry,angle=0,n=140){const ca=Math.cos(angle),sa=Math.sin(angle);return Array.from({length:n+1},(_,i)=>{const t=2*Math.PI*i/n,x=rx*Math.cos(t),y=ry*Math.sin(t);return {x:cx+x*ca-y*sa,y:cy+x*sa+y*ca};});}
  function sampleArc(target,n=96){return Array.from({length:n+1},(_,i)=>{const a=target.start+target.sweep*i/n;return {x:target.cx+target.r*Math.cos(a),y:target.cy+target.r*Math.sin(a)};});}
  function makeArcSpec(w,h,variant){const unit=Math.min(w,h),r=between(.17,.31)*unit,start=between(-Math.PI,Math.PI),sweep=(Math.random()<.5?-1:1)*between(.9,2.55),probe=sampleArc({cx:0,cy:0,r,start,sweep});
    const xs=probe.map(p=>p.x),ys=probe.map(p=>p.y),marginX=w*.09,marginY=h*.09;
    return {type:"arc",variant:variant||(["three","tangent"][weightedIndex(state.prefs.weights.arc)]),cx:between(marginX-Math.min(...xs),w-marginX-Math.max(...xs)),cy:between(marginY-Math.min(...ys),h-marginY-Math.max(...ys)),r,start,sweep};}
  function intersection(a,b,c,d){const den=(a.x-b.x)*(c.y-d.y)-(a.y-b.y)*(c.x-d.x);if(Math.abs(den)<1e-5)return {x:(b.x+c.x)/2,y:(b.y+c.y)/2};const p=a.x*b.y-a.y*b.x,q=c.x*d.y-c.y*d.x;return {x:(p*(c.x-d.x)-(a.x-b.x)*q)/den,y:(p*(c.y-d.y)-(a.y-b.y)*q)/den};}
  function boxGeometry(spec,w,h){const p=(x,y)=>({x:x*w,y:y*h}),mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
    const a=p(spec.frontX,spec.frontTop),b=p(spec.frontX,spec.frontBottom),vl=p(spec.leftVpX,spec.vanishY),vr=p(spec.rightVpX,spec.vanishY);
    const lt=mix(a,vl,spec.leftDepth),lb=mix(b,vl,spec.leftDepth),rt=mix(a,vr,spec.rightDepth),rb=mix(b,vr,spec.rightDepth),back=intersection(lt,vr,rt,vl);
    const edges=[[a,b],[a,lt],[lt,lb],[b,lb],[a,rt],[rt,rb],[b,rb],[lt,back],[rt,back]];
    return {vertices:[a,b,lt,lb,rt,rb,back],edges:edges.map(pair=>({points:sampleLine(pair[0],pair[1]),closed:false}))};}
  function boxAspect(spec,w,h){const vertices=boxGeometry(spec,w,h).vertices,x=vertices.map(p=>p.x),y=vertices.map(p=>p.y);return (Math.max(...y)-Math.min(...y))/(Math.max(...x)-Math.min(...x));}
  function makeBoxSpec(w,h,shapeChoice){
    const shape=shapeChoice||(["tall","wide","balanced"][Math.floor(Math.random()*3)]);
    for(let i=0;i<240;i++){
      const top=between(.16,.32),height=shape==="tall"?between(.50,.67):shape==="wide"?between(.26,.40):between(.38,.53);
      const frontX=between(.43,.57),base=height*h/(2.3*w),range=shape==="tall"?[.48,.68]:shape==="wide"?[1.27,1.55]:[.91,1.08];
      const spec={type:"box",shape,frontX,frontTop:top,frontBottom:top+height,leftVpX:between(-.85,-.35),rightVpX:between(1.35,1.85),vanishY:between(.06,.20),
        leftDepth:base*between(...range),rightDepth:base*between(...range)};
      const vertices=boxGeometry(spec,w,h).vertices,inside=vertices.every(p=>p.x>=w*.06&&p.x<=w*.94&&p.y>=h*.05&&p.y<=h*.94),aspect=boxAspect(spec,w,h);
      if(inside&&((shape==="tall"&&aspect>=1.12)||(shape==="wide"&&aspect<=.86)||(shape==="balanced"&&aspect>.86&&aspect<1.12)))return spec;
    }
    const fallbackHeight=shape==="tall"?.55:shape==="wide"?.30:.42,base=fallbackHeight*h/(2.3*w),factor=shape==="tall"?.55:shape==="wide"?1.4:1;
    return {type:"box",shape,frontX:.5,frontTop:.20,frontBottom:.20+fallbackHeight,leftVpX:-.5,rightVpX:1.5,vanishY:.12,leftDepth:base*factor,rightDepth:base*factor};
  }
  function makeTarget(type,w,h){
    const unit=Math.min(w,h);
    if(type==="line"||type==="through"){
      const size=weightedIndex(state.prefs.weights.line),bands=[[.18,.29],[.37,.54],[.63,.82]],angle=between(0,Math.PI*2),ca=Math.cos(angle),sa=Math.sin(angle),extension=type==="through"?.25:0,desired=between(...bands[size])*unit;
      const horizontalLimit=w*.84/(Math.max(Math.abs(ca),1e-6)*(1+extension)),verticalLimit=h*.82/(Math.max(Math.abs(sa),1e-6)*(1+extension)),length=Math.min(desired,horizontalLimit,verticalLimit);
      const dx=ca*length/2,dy=sa*length/2,outerX=Math.abs(dx)*(1+extension),outerY=Math.abs(dy)*(1+extension);
      const cx=between(outerX+w*.08,w-outerX-w*.08),cy=between(outerY+h*.09,h-outerY-h*.09);
      const a={x:cx-dx,y:cy-dy},b={x:cx+dx,y:cy+dy};
      return {type,size,a,b,guideA:{x:cx-dx*(1+extension),y:cy-dy*(1+extension)},guideB:{x:cx+dx*(1+extension),y:cy+dy*(1+extension)}};
    }
    if(type==="ellipse"){
      const size=weightedIndex(state.prefs.weights.ellipse),bands=[[.10,.15],[.17,.22],[.24,.30]],rx=between(...bands[size])*unit,ratio=Math.random()<.28?1:between(1.3,2.25),ry=rx/ratio,angle=ratio===1?0:between(-1.1,1.1),ca=Math.cos(angle),sa=Math.sin(angle),bx=Math.hypot(rx*ca,ry*sa),by=Math.hypot(rx*sa,ry*ca);
      return {type,size,cx:between(bx+w*.08,w-bx-w*.08),cy:between(by+h*.09,h-by-h*.09),rx,ry,angle};
    }
    if(type==="arc")return makeArcSpec(w,h);
    return makeBoxSpec(w,h);
  }
  function targetEdges(target,w=state.size.w,h=state.size.h){
    if(target.type==="line"||target.type==="through")return [{points:sampleLine(target.a,target.b),closed:false}];
    if(target.type==="ellipse")return [{points:sampleEllipse(target.cx,target.cy,target.rx,target.ry,target.angle),closed:true,center:{x:target.cx,y:target.cy},rx:target.rx,ry:target.ry,angle:target.angle}];
    if(target.type==="arc")return [{points:sampleArc(target),closed:false,variant:target.variant,center:{x:target.cx,y:target.cy},r:target.r,start:target.start,sweep:target.sweep}];
    return boxGeometry(target,w,h).edges;
  }
  function axisDots(target){const {center,rx,ry,angle}=target,ca=Math.cos(angle),sa=Math.sin(angle);return [{x:center.x+rx*ca,y:center.y+rx*sa},{x:center.x-rx*ca,y:center.y-rx*sa},{x:center.x-ry*sa,y:center.y+ry*ca},{x:center.x+ry*sa,y:center.y-ry*ca}];}
  function pointSegmentSquared(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy,t=den?clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/den,0,1):0;return (p.x-a.x-t*dx)**2+(p.y-a.y-t*dy)**2;}
  function pointSegment(p,a,b){return Math.sqrt(pointSegmentSquared(p,a,b));}
  function nearestPolyline(p,points){let best=Infinity;for(let i=1;i<points.length;i++)best=Math.min(best,pointSegmentSquared(p,points[i-1],points[i]));return Math.sqrt(best);}
  function resample(points,count){if(points.length<2)return {points:points.slice(),length:0};const lengths=[],total=points.slice(1).reduce((sum,p,i)=>{const n=dist(p,points[i]);lengths.push(n);return sum+n;},0);if(total===0)return {points:Array(count).fill(points[0]),length:0};const samples=[points[0]];let segment=1,walked=0,part=lengths[0];for(let i=1;i<count-1;i++){const wanted=total*i/(count-1);while(segment<points.length-1&&walked+part<wanted){walked+=part;segment++;part=lengths[segment-1];}const t=part?clamp((wanted-walked)/part,0,1):0;samples.push({x:points[segment-1].x+t*(points[segment].x-points[segment-1].x),y:points[segment-1].y+t*(points[segment].y-points[segment-1].y)});}samples.push(points.at(-1));return {points:samples,length:total};}
  function gradeLine(user,target,strict=1,sampled=null){
    if(user.length<2)return {score:0,metrics:[0,0],detail:"Draw a full stroke."};
    const a=target.points[0],b=target.points.at(-1),length=dist(a,b),first=user[0],last=user.at(-1),forward=dist(first,a)+dist(last,b),reverse=dist(first,b)+dist(last,a);
    const errors=forward<=reverse?[dist(first,a),dist(last,b)]:[dist(last,a),dist(first,b)],endpoints=avg(errors.map(e=>clamp(100-100*e/(length*.10*strict),0,100)));
    const chord=Math.max(1,dist(first,last)),sample=sampled||resample(user,64),deviation=avg(sample.points.map(p=>pointSegment(p,first,last))),extra=Math.max(0,sample.length/chord-1);
    const straightness=clamp(100-100*deviation/(chord*.05*strict)-80*extra/strict,0,100),score=.5*endpoints+.5*straightness;
    return {score,metrics:[endpoints,straightness],detail:endpoints<straightness-8?"Bring both ends closer to the target dots.":straightness<endpoints-8?"Keep the path straighter between the dots.":"Your endpoints and path are well controlled."};
  }
  function gradeThroughLine(user,target){
    if(user.length<2)return {score:0,metrics:[0,0],detail:"Draw one stroke through both dots."};
    const a=target.points[0],b=target.points.at(-1),span=dist(a,b),tolerance=Math.max(8,span*.10);
    const checkpoints=Math.min(...[a,b].map(dot=>clamp(100-100*nearestPolyline(dot,user)/tolerance,0,100)));
    const first=user[0],last=user.at(-1),chord=Math.max(1,dist(first,last)),sample=resample(user,64),deviation=avg(sample.points.map(p=>pointSegment(p,first,last))),extra=Math.max(0,sample.length/chord-1);
    const straightness=clamp(100-100*deviation/(chord*.05)-80*extra,0,100);
    return {score:.7*checkpoints+.3*straightness,metrics:[checkpoints,straightness],detail:checkpoints<straightness-8?"Pass closer through both checkpoint dots.":straightness<checkpoints-8?"Keep the stroke straighter as it crosses the dots.":"The stroke passes cleanly through both dots."};
  }
  function gradeBoxEdge(user,target,sampled=null){const sample=sampled||resample(user,48),base=gradeLine(user,target,.72,sample),a=target.points[0],b=target.points.at(-1),length=dist(a,b),fit=clamp(100-100*avg(sample.points.map(p=>pointSegment(p,a,b)))/(length*.05),0,100),placement=.65*base.metrics[0]+.35*fit,control=base.metrics[1];return {score:.7*placement+.3*control,metrics:[placement,control]};}
  function gradeBox(strokes,edges){
    const valid=strokes.filter(s=>s.length>=2),ratings=valid.map(stroke=>{const sample=resample(stroke,48);return edges.map(edge=>gradeBoxEdge(stroke,edge,sample));}),n=edges.length,limit=1<<n;
    let dp=Array(limit).fill(null);dp[0]={score:0,metrics:[0,0]};
    for(const row of ratings){const next=dp.slice();for(let mask=0;mask<limit;mask++){const prior=dp[mask];if(!prior)continue;for(let j=0;j<n;j++){if(mask&(1<<j))continue;const bit=mask|(1<<j),r=row[j],score=prior.score+r.score;if(!next[bit]||score>next[bit].score)next[bit]={score,metrics:[prior.metrics[0]+r.metrics[0],prior.metrics[1]+r.metrics[1]]};}}dp=next;}
    let best={score:0,metrics:[0,0],matched:0};for(let mask=0;mask<limit;mask++){const item=dp[mask];if(!item)continue;const matched=mask.toString(2).replace(/0/g,"").length,extra=Math.max(0,valid.length-matched),factor=Math.max(.4,1-.06*extra),score=item.score/n*factor;if(score>best.score)best={score,metrics:item.metrics.map(x=>x/n*factor),matched};}
    const missing=n-best.matched,extra=Math.max(0,valid.length-best.matched);
    return {score:best.score,metrics:best.metrics,detail:missing?`${missing} edge${missing===1?"":"s"} missing or too far from the target.`:extra?`${extra} extra stroke${extra===1?"":"s"} reduced the score.`:"All nine edges were scored, regardless of drawing order."};
  }
  function gradeEllipse(user,target){
    if(user.length<3)return {score:0,metrics:[0,0],detail:"Draw a complete loop."};
    const {center,rx,ry,angle}=target,ca=Math.cos(angle),sa=Math.sin(angle),minR=Math.min(rx,ry),sample=resample(user,96),points=sample.points;
    const radial=points.map(p=>{const dx=p.x-center.x,dy=p.y-center.y,x=dx*ca+dy*sa,y=-dx*sa+dy*ca;return Math.hypot(x/rx,y/ry)-1;});
    const bins=new Set(points.map(p=>{const dx=p.x-center.x,dy=p.y-center.y,x=dx*ca+dy*sa,y=-dx*sa+dy*ca;return Math.floor((Math.atan2(y/ry,x/rx)+Math.PI)*24/(2*Math.PI))%24;}));
    const coverage=bins.size/24,closure=dist(user[0],user.at(-1)),ideal=Math.PI*(3*(rx+ry)-Math.sqrt((3*rx+ry)*(rx+3*ry))),extra=Math.max(0,sample.length/ideal-1.25);
    const axes=avg(axisDots(target).map(dot=>clamp(100-100*nearestPolyline(dot,user)/(minR*.35),0,100)));
    const wobble=avg(radial.slice(1,-1).map((r,i)=>Math.abs(radial[i]-2*r+radial[i+2])));
    const smooth=clamp(100-220*avg(radial.map(Math.abs))-65*(1-coverage)-35*closure/minR-90*extra-1100*wobble,0,100);
    return {score:.5*axes+.5*smooth,metrics:[axes,smooth],detail:coverage<.78?"Complete more of the loop.":axes<smooth-8?"Bring the curve closer to all four axis dots.":smooth<axes-8?"Smooth the curve and close the loop cleanly.":"The curve reaches its dots and follows the ideal ellipse."};
  }
  function gradeArc(user,target){
    if(user.length<3)return {score:0,metrics:[0,0],detail:"Draw one complete curved stroke."};
    const reference=target.points,start=reference[0],end=reference.at(-1),forward=dist(user[0],start)+dist(user.at(-1),end),reverse=dist(user[0],end)+dist(user.at(-1),start),ordered=reverse<forward?user.slice().reverse():user;
    const sample=resample(ordered,96),ideal=resample(reference,96),radius=target.r,ends=avg([dist(ordered[0],start),dist(ordered.at(-1),end)].map(e=>clamp(100-100*e/(radius*.23),0,100)));
    let placement;
    if(target.variant==="three"){
      const middle=reference[Math.floor((reference.length-1)/2)],middleScore=clamp(100-100*nearestPolyline(middle,ordered)/(radius*.23),0,100);
      placement=.5*ends+.5*middleScore;
    }else{
      const direction=Math.sign(target.sweep),tangent=a=>({x:-Math.sin(a)*direction,y:Math.cos(a)*direction}),angleError=(a,b)=>Math.acos(clamp((a.x*b.x+a.y*b.y)/(Math.hypot(a.x,a.y)*Math.hypot(b.x,b.y)||1),-1,1));
      const points=sample.points,k=4,entry={x:points[k].x-points[0].x,y:points[k].y-points[0].y},exit={x:points.at(-1).x-points.at(-1-k).x,y:points.at(-1).y-points.at(-1-k).y};
      const tangency=avg([angleError(entry,tangent(target.start)),angleError(exit,tangent(target.start+target.sweep))].map(e=>clamp(100-100*e/.85,0,100)));
      placement=.55*ends+.45*tangency;
    }
    const deviation=avg(sample.points.map((p,i)=>dist(p,ideal.points[i]))),lengthError=Math.abs(sample.length/ideal.length-1),radial=sample.points.map(p=>dist(p,target.center)-radius),wobble=avg(radial.slice(1,-1).map((v,i)=>Math.abs(radial[i]-2*v+radial[i+2])))/radius;
    const curve=clamp(100-78*deviation/(radius*.22)-65*lengthError-900*wobble,0,100),score=.5*placement+.5*curve;
    const detail=placement<curve-8?(target.variant==="three"?"Reach all three dots, including the middle one.":"Meet both endpoints and follow their tangent directions."):curve<placement-8?"Follow the intended arc with a smooth, even curve.":"The arc meets its targets and keeps a clean curve.";
    return {score,metrics:[placement,curve],detail};
  }
  function gradeTarget(type,strokes,edges){return type==="line"?gradeLine(strokes[0],edges[0]):type==="through"?gradeThroughLine(strokes[0],edges[0]):type==="ellipse"?gradeEllipse(strokes[0],edges[0]):type==="arc"?gradeArc(strokes[0],edges[0]):gradeBox(strokes,edges);}
  function load(){
    try{const data=JSON.parse(localStorage.getItem(KEY));if(!data||data.version!==5)return;
      const p=data.preferences||{},d=defaults();for(const type of TYPES){if(typeof p.enabled?.[type]==="boolean")d.enabled[type]=p.enabled[type];if(typeof p.guide?.[type]==="boolean")d.guide[type]=p.guide[type];}
      for(const type of ["line","ellipse","arc"]){const weights=p.weights?.[type];if(Array.isArray(weights)&&weights.length===d.weights[type].length&&weights.every(x=>Number.isInteger(x)&&x>=0&&x<=5)&&weights.some(x=>x>0))d.weights[type]=weights.slice();}
      if(!TYPES.some(type=>d.enabled[type]))d.enabled.line=true;
      if([6,12,18].includes(p.testLength))d.testLength=p.testLength;if(p.inputMode==="pen")d.inputMode="pen";state.prefs=d;
      if(data.practice&&typeof data.practice==="object")for(const type of TYPES){const s=data.practice[type];if(s&&Number.isInteger(s.count)&&s.count>=0&&Number.isFinite(s.score)&&s.score>=0&&Number.isFinite(s.time)&&s.time>=0)state.stats[type]={count:s.count,score:s.score,time:s.time};}
      if(Array.isArray(data.tests))state.tests=data.tests.filter(x=>x&&Number.isFinite(x.score)&&x.score>=0&&x.score<=100&&Number.isFinite(x.time)&&x.time>=0&&typeof x.date==="string"&&Array.isArray(x.types)).slice(-100);
    }catch(e){$("saveState").textContent="Saving unavailable";}
  }
  function save(){try{localStorage.setItem(KEY,JSON.stringify({version:5,preferences:state.prefs,practice:state.stats,tests:state.tests}));$("saveState").textContent="Saved on this device";}catch(e){$("saveState").textContent="Saving unavailable";}}
  function syncSettings(){for(const type of TYPES){$(type+"Enabled").checked=state.prefs.enabled[type];$(type+"Guide").checked=state.prefs.guide[type];document.querySelector(`[data-type="${type}"]`).classList.toggle("is-disabled",!state.prefs.enabled[type]);}
    for(const type of ["line","ellipse","arc"])for(let i=0;i<state.prefs.weights[type].length;i++){$(type+"Weight"+i).value=state.prefs.weights[type][i];$(type+"Percent"+i).textContent=`${state.prefs.weights[type][i]}/5`;}
    $("testLength").value=String(state.prefs.testLength);$("inputMode").value=state.prefs.inputMode;}
  function renderStats(){const stats=$("practiceStats");stats.replaceChildren();for(const type of TYPES){const s=state.stats[type],row=document.createElement("div");row.className="stat-row";row.innerHTML=`<strong>${NAMES[type]}</strong><span>${s.count?round(s.score/s.count)+"%":"—"}</span><small>${s.count?formatTime(s.time/s.count):"—"}</small>`;stats.append(row);}
    $("testCount").textContent=`${state.tests.length} test${state.tests.length===1?"":"s"}`;const history=$("testHistory");history.replaceChildren();if(!state.tests.length){history.innerHTML='<p class="empty-history">No tests yet</p>';return;}
    for(const test of state.tests.slice(-5).reverse()){const row=document.createElement("div");row.className="history-row";const label=document.createElement("span"),score=document.createElement("strong");label.textContent=`${new Date(test.date).toLocaleDateString()} · ${test.count} targets · ${formatTime(test.time)}`;score.textContent=`${round(test.score)}%`;row.append(label,score);history.append(row);}}
  function drawPath(points,color,width=2,dash=[]){if(!points||!points.length)return;ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);for(let i=1;i<points.length;i++)ctx.lineTo(points[i].x,points[i].y);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap="round";ctx.lineJoin="round";ctx.setLineDash(dash);ctx.stroke();ctx.setLineDash([]);}
  function dot(p,r=5,fill="#99ad96",open=false){ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);if(open){ctx.fillStyle="#fcfcf8";ctx.fill();ctx.strokeStyle=fill;ctx.lineWidth=2;ctx.stroke();}else{ctx.fillStyle=fill;ctx.fill();}}
  function draw(){const {w,h}=state.size;if(!w||!h)return;ctx.clearRect(0,0,w,h);if(state.target){const type=state.target.type,guide=state.prefs.guide[type],edges=targetEdges(state.target);
      if(type==="line"||type==="through"){if(guide)drawPath(type==="through"?sampleLine(state.target.guideA,state.target.guideB):edges[0].points,"#b7c8b1",1.6,[5,7]);dot(state.target.a,6,"#99ad96",type==="through");dot(state.target.b,6,"#99ad96",type==="through");}
      if(type==="ellipse"){const e=edges[0],dots=axisDots(e);if(guide){drawPath(sampleLine(dots[0],dots[1]),"#c2cfbd",1.5,[4,7]);drawPath(sampleLine(dots[2],dots[3]),"#c2cfbd",1.5,[4,7]);drawPath(e.points,"#d7e0d1",1,[3,9]);}dots.forEach(p=>dot(p,5,"#95aa92",true));}
      if(type==="arc"){const arc=edges[0],points=arc.points,start=points[0],end=points.at(-1);if(guide)drawPath(points,"#b7c8b1",1.5,[5,7]);
        if(arc.variant==="three")dot(points[Math.floor((points.length-1)/2)],5.5,"#95aa92",true);
        else for(const [p,a] of [[start,arc.start],[end,arc.start+arc.sweep]]){const span=Math.max(25,arc.r*.32),dx=Math.sin(a)*span,dy=-Math.cos(a)*span;drawPath([{x:p.x-dx,y:p.y-dy},{x:p.x+dx,y:p.y+dy}],"#8fa78e",1.6,[4,4]);}
        dot(start,6,"#95aa92",true);dot(end,6,"#95aa92",true);}
      if(type==="box"){if(guide)edges.forEach(e=>drawPath(e.points,"#b8c9b3",1.5,[5,6]));const seen=[];for(const edge of edges)for(const p of [edge.points[0],edge.points.at(-1)])if(!seen.some(q=>dist(q,p)<2))seen.push(p);seen.forEach(p=>dot(p,4.5));}
    }
    state.strokes.forEach(stroke=>drawPath(stroke,"#34563c",2.7));if(state.current.length)drawPath(state.current,"#34563c",2.7);}
  function resize(){const r=wrap.getBoundingClientRect();if(r.width<10||r.height<10)return;const w=r.width,h=r.height,dpr=Math.min(window.devicePixelRatio||1,3);if(Math.abs(w-state.size.w)<1&&Math.abs(h-state.size.h)<1)return;const old=state.size,hadStrokes=state.strokes.length||state.drawing;state.size={w,h};canvas.width=round(w*dpr);canvas.height=round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
    if(state.target&&old.w&&old.h){const sx=w/old.w,sy=h/old.h;if(state.target.type==="line"||state.target.type==="through"){for(const p of [state.target.a,state.target.b,state.target.guideA,state.target.guideB]){p.x*=sx;p.y*=sy;}}else if(state.target.type==="ellipse"){state.target.cx*=sx;state.target.cy*=sy;const scale=Math.min(w,h)/Math.min(old.w,old.h);state.target.rx*=scale;state.target.ry*=scale;}else if(state.target.type==="arc"){state.target=makeArcSpec(w,h,state.target.variant);state.targetStarted=performance.now();describeTarget();}else{state.target=makeBoxSpec(w,h,state.target.shape);state.targetStarted=performance.now();describeTarget();}
      if(hadStrokes){state.strokes=[];state.current=[];state.drawing=false;state.targetStarted=performance.now();setMessage("Canvas resized","This target restarted to keep your marks aligned.");}}
    draw();updateActions();}
  function setMessage(title,detail,score=null,seconds=null,metrics=null){$("feedbackTitle").textContent=title;$("feedbackText").textContent=detail;$("accuracyValue").textContent=score===null?"—":`${round(score)}%`;$("timeValue").textContent=seconds===null?"—":formatTime(seconds);for(let i=0;i<2;i++){$("metricValue"+i).textContent=metrics?`${round(metrics[i])}%`:"—";$("metricFill"+i).style.width=metrics?`${clamp(metrics[i],0,100)}%`:"0%";}}
  function updateActions(){const active=state.mode==="practice"||state.mode==="test",box=active&&state.target?.type==="box";$("undoButton").disabled=!box||!state.strokes.length;$("resetButton").disabled=state.mode!=="practice";$("scoreBoxButton").hidden=!box;$("scoreBoxButton").disabled=!box||state.strokes.length<9;$("drillProgressLabel").textContent=box?`${state.strokes.length} of 9 edges · score when finished`:active?"Draw one stroke":"Ready";}
  function updateSession(){const active=state.mode==="practice"||state.mode==="test";$("sessionStatus").textContent=state.mode==="practice"?"Practice running":state.mode==="test"?"Test running":state.mode==="complete"?"Test complete":"Ready";$("modeTitle").textContent=state.mode==="practice"?"Endless Practice":state.mode==="test"?"Progress Test":state.mode==="complete"?"Test complete":"Choose your mode";
    $("progressText").textContent=state.mode==="test"?`${state.completed} of ${state.testPlan.length} targets`:state.mode==="practice"?`${state.completed} targets completed`:state.mode==="complete"?`${state.completed} targets completed`:"No session started";
    $("sessionProgressFill").style.width=state.mode==="test"||state.mode==="complete"?`${100*state.completed/Math.max(1,state.testPlan.length)}%`:"0%";
    $("practiceButton").textContent=state.mode==="practice"?"Stop Practice":"Start Practice";$("testButton").textContent=state.mode==="test"?"Restart Test":"Start Test";
    $("testLength").disabled=state.mode==="test";for(const type of TYPES)$(type+"Enabled").disabled=state.mode==="test";$("elapsedText").textContent=active?clockTime((performance.now()-state.sessionStarted)/1000):"0:00";
    $("settingsNote").textContent=state.mode==="test"?"Test drill selection is fixed for this run; guides can still change.":"Selection changes apply to the next Practice target or new Test.";}
  function shuffled(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  function testPlan(types,length){const plan=[];while(plan.length<length)plan.push(...shuffled(types.slice()));return plan.slice(0,length);}
  function nextType(){const types=selected();return types[Math.floor(Math.random()*types.length)];}
  function describeTarget(){const target=state.target,type=target.type,number=state.completed+1;$("drillCategory").textContent=`${state.mode==="test"?"TEST":"PRACTICE"} / ${NAMES[type].toUpperCase()}`;
    $("stepNumber").textContent=String(number).padStart(2,"0");$("stepTotal").textContent=state.mode==="test"?`/ ${String(state.testPlan.length).padStart(2,"0")}`:"/ ∞";
    if(type==="line"){$("drillTitle").textContent=`Draw a ${["short","medium","long"][target.size]} line`;$("drillDescription").textContent="Connect the two dots with one straight stroke. Either direction counts.";$("canvasPrompt").textContent="One stroke · either direction";$("metricLabel0").textContent="Endpoint dots";$("metricLabel1").textContent="Straightness";$("metricFormula").textContent="Accuracy = 50% endpoints + 50% straightness";}
    if(type==="through"){$("drillTitle").textContent=`Draw through two dots`;$("drillDescription").textContent="Make one straight stroke through both open dots. Start and end wherever you like.";$("canvasPrompt").textContent="Cross both dots · endpoints ignored";$("metricLabel0").textContent="Weaker dot crossing";$("metricLabel1").textContent="Straightness";$("metricFormula").textContent="Accuracy = 70% weaker dot crossing + 30% straightness. Endpoints are not scored.";}
    if(type==="ellipse"){$("drillTitle").textContent=`Draw a ${["small","medium","large"][target.size]} ellipse`;$("drillDescription").textContent="Pass through all four open dots in one smooth loop.";$("canvasPrompt").textContent="One smooth loop";$("metricLabel0").textContent="Axis dots";$("metricLabel1").textContent="Curve smoothness";$("metricFormula").textContent="Accuracy = 50% axis dots + 50% curve smoothness";}
    if(type==="arc"){$("drillTitle").textContent=target.variant==="three"?"Draw a three-point arc":"Draw a tangent arc";$("drillDescription").textContent=target.variant==="three"?"Connect the end dots in one smooth arc through the middle dot. Either direction counts.":"Connect the end dots in one smooth arc, matching the tangent guides at both ends. Either direction counts.";$("canvasPrompt").textContent=target.variant==="three"?"One stroke · pass through three dots":"One stroke · meet both tangents";$("metricLabel0").textContent=target.variant==="three"?"Three dots":"Dots & tangency";$("metricLabel1").textContent="Curve control";$("metricFormula").textContent="Accuracy = 50% targets + 50% curve control";}
    if(type==="box"){$("drillTitle").textContent=`Draw a ${target.shape} perspective box`;$("drillDescription").textContent="Connect the corner dots with nine edges. Draw sides in any order; score when complete.";$("canvasPrompt").textContent="Any edge order · score whole box";$("metricLabel0").textContent="Edge placement";$("metricLabel1").textContent="Straightness";$("metricFormula").textContent="Accuracy = matched edge scores; missing and extra edges lower it.";}
  }
  function showNext(){const type=state.mode==="test"?state.testPlan[state.completed]:nextType();state.lastType=type;state.target=makeTarget(type,state.size.w,state.size.h);state.strokes=[];state.current=[];state.drawing=false;state.targetStarted=performance.now();overlay.hidden=true;describeTarget();draw();updateActions();updateSession();}
  function start(mode){state.mode=mode;state.completed=0;state.testResults=[];state.testPlan=mode==="test"?testPlan(selected(),state.prefs.testLength):[];state.lastType=null;state.lastResult=null;state.sessionStarted=performance.now();$("previousResult").hidden=true;setMessage("Ready for your first mark","Draw the target. Lines, through-dot lines, ellipses, and arcs advance after each stroke; boxes score when submitted.");showNext();}
  function stopPractice(){state.mode=null;state.target=null;state.strokes=[];state.current=[];state.drawing=false;overlay.hidden=true;$("drillCategory").textContent="READY TO DRAW";$("drillTitle").textContent="Practice paused";$("drillDescription").textContent="Your averages are saved. Start another session whenever you are ready.";$("stepNumber").textContent="—";$("stepTotal").textContent="";$("canvasPrompt").textContent="Start a session";draw();updateActions();updateSession();setMessage("Practice stopped","Choose Practice or Test to continue.");}
  function recordPractice(type,result,seconds){const s=state.stats[type];s.count++;s.score+=result.score;s.time+=seconds;save();renderStats();}
  function finishTest(){const score=avg(state.testResults.map(x=>x.score)),time=state.testResults.reduce((n,x)=>n+x.time,0),types=[...new Set(state.testPlan)],record={date:new Date().toISOString(),score,time,count:state.testPlan.length,types};state.tests.push(record);state.tests=state.tests.slice(-100);save();renderStats();state.mode="complete";state.target=null;state.strokes=[];state.current=[];draw();updateActions();updateSession();
    overlay.hidden=false;overlay.replaceChildren();const kicker=document.createElement("div"),title=document.createElement("h3"),number=document.createElement("div"),detail=document.createElement("p"),button=document.createElement("button");kicker.className="eyebrow";kicker.textContent="TEST COMPLETE";title.textContent=`${record.count} targets finished`;number.className="result-score";number.innerHTML=`${round(score)}<span>%</span>`;detail.textContent=`Overall accuracy · ${formatTime(time)} total target time · ${types.map(t=>NAMES[t]).join(", ")}. Saved to Test history.`;button.className="button button-dark";button.textContent="Start another Test";button.addEventListener("click",()=>start("test"));overlay.append(kicker,title,number,detail,button);}
  function completeTarget(result){const type=state.target.type,seconds=(performance.now()-state.targetStarted)/1000;state.lastResult={type,score:result.score,time:seconds,detail:result.detail};$("previousResult").hidden=false;$("previousScore").textContent=`${round(result.score)}%`;$("previousInfo").textContent=`${type==="arc"?(state.target.variant==="three"?"Three-point arc":"Tangent arc"):NAMES[type]} · ${formatTime(seconds)} · ${result.detail}`;setMessage(result.score>=85?"Excellent control":result.score>=70?"Good control":result.score>=50?"Keep refining":"Try a slower, cleaner mark",result.detail,result.score,seconds,result.metrics);if(state.mode==="practice")recordPractice(type,result,seconds);else state.testResults.push({type,score:result.score,time:seconds});state.completed++;if(state.mode==="test"&&state.completed>=state.testPlan.length){finishTest();return;}showNext();}
  function scoreBox(){if(!state.target||state.target.type!=="box"||state.strokes.length<9)return;completeTarget(gradeBox(state.strokes,targetEdges(state.target)));}
  function pointFromEvent(event){const r=canvas.getBoundingClientRect();return {x:clamp(event.clientX-r.left,0,r.width),y:clamp(event.clientY-r.top,0,r.height)};}
  function pointerDown(event){if(!(state.mode==="practice"||state.mode==="test")||!state.target||state.drawing)return;if(state.prefs.inputMode==="pen"&&event.pointerType!=="pen")return;if(event.pointerType==="mouse"&&event.button!==0)return;event.preventDefault();state.drawing=true;state.pointerId=event.pointerId;state.current=[pointFromEvent(event)];canvas.setPointerCapture?.(event.pointerId);draw();}
  function pointerMove(event){if(!state.drawing||event.pointerId!==state.pointerId)return;event.preventDefault();const p=pointFromEvent(event);if(dist(p,state.current.at(-1))>=.7)state.current.push(p);draw();}
  function pointerUp(event){if(!state.drawing||event.pointerId!==state.pointerId)return;event.preventDefault();const p=pointFromEvent(event);if(dist(p,state.current.at(-1))>.5)state.current.push(p);state.drawing=false;state.pointerId=null;const stroke=state.current;state.current=[];if(stroke.length<2||resample(stroke,2).length<6){draw();return;}state.strokes.push(stroke);
    if(state.target.type==="box"){draw();updateActions();setMessage("Keep building the box",state.strokes.length<9?`${state.strokes.length} of 9 edges drawn. Keep connecting the corner dots.`:"Nine or more edges drawn. Score the whole box when finished.");return;}
    completeTarget(gradeTarget(state.target.type,state.strokes,targetEdges(state.target)));}
  function cancelPointer(){state.drawing=false;state.pointerId=null;state.current=[];draw();}
  function exportData(){const data={version:5,exportedAt:new Date().toISOString(),preferences:state.prefs,practice:state.stats,tests:state.tests},blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download="sketch-pace-backup.json";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  async function importData(file){if(!file)return;try{const data=JSON.parse(await file.text());if(data.version!==5||!data.preferences||!data.practice||!Array.isArray(data.tests))throw Error("This backup is not Sketch Pace version 5.");localStorage.setItem(KEY,JSON.stringify(data));state.prefs=defaults();state.stats=emptyStats();state.tests=[];load();syncSettings();renderStats();state.mode=null;state.target=null;state.strokes=[];overlay.hidden=true;draw();updateActions();updateSession();setMessage("Backup imported","Choose Practice or Test to begin.");}catch(e){setMessage("Import failed",e.message||"The backup could not be read.");}}
  function bind(){
    $("mobileSettingsToggle").addEventListener("click",()=>{const open=$("settingsCard").classList.toggle("mobile-open");$("mobileSettingsToggle").setAttribute("aria-expanded",String(open));});
    $("practiceButton").addEventListener("click",()=>state.mode==="practice"?stopPractice():start("practice"));$("testButton").addEventListener("click",()=>start("test"));$("scoreBoxButton").addEventListener("click",scoreBox);
    $("undoButton").addEventListener("click",()=>{if(state.target?.type==="box"&&state.strokes.length){state.strokes.pop();draw();updateActions();setMessage("Last edge removed","Draw it again, then score the complete box.");}});
    $("resetButton").addEventListener("click",()=>{if(state.mode==="practice")showNext();});
    $("testLength").addEventListener("change",e=>{state.prefs.testLength=Number(e.target.value);save();});
    $("inputMode").addEventListener("change",e=>{state.prefs.inputMode=e.target.value==="pen"?"pen":"auto";save();cancelPointer();});
    for(const type of TYPES){$(type+"Enabled").addEventListener("change",e=>{state.prefs.enabled[type]=e.target.checked;if(!selected().length){state.prefs.enabled[type]=true;e.target.checked=true;setMessage("Keep one drill on","Practice and Test need at least one enabled drill.");}syncSettings();save();});
      $(type+"Guide").addEventListener("change",e=>{state.prefs.guide[type]=e.target.checked;save();draw();});}
    for(const type of ["line","ellipse","arc"])for(let i=0;i<state.prefs.weights[type].length;i++)$(type+"Weight"+i).addEventListener("input",e=>{const weights=state.prefs.weights[type];weights[i]=Number(e.target.value);if(!weights.some(x=>x>0)){weights[i]=1;e.target.value="1";}syncSettings();save();});
    $("exportButton").addEventListener("click",exportData);$("importButton").addEventListener("click",()=>$("importFile").click());$("importFile").addEventListener("change",e=>{importData(e.target.files?.[0]);e.target.value="";});
    canvas.addEventListener("pointerdown",pointerDown);canvas.addEventListener("pointermove",pointerMove);canvas.addEventListener("pointerup",pointerUp);canvas.addEventListener("pointercancel",cancelPointer);
    window.addEventListener("resize",resize);if(typeof ResizeObserver!=="undefined")new ResizeObserver(resize).observe(wrap);
    window.addEventListener("keydown",e=>{if(e.key==="Escape"&&state.drawing){cancelPointer();e.preventDefault();}else if((e.key==="z"||e.key==="Z")&&!e.ctrlKey&&!e.metaKey&&state.target?.type==="box")$("undoButton").click();else if(e.key==="Enter"&&state.target?.type==="box"&&document.activeElement===document.body&&!$("scoreBoxButton").disabled)$("scoreBoxButton").click();});
    setInterval(()=>{if(state.mode==="practice"||state.mode==="test")$("elapsedText").textContent=clockTime((performance.now()-state.sessionStarted)/1000);},1000);
  }
  load();syncSettings();renderStats();bind();resize();updateActions();updateSession();
  window.SketchPaceDebug={state,makeTarget,makeArcSpec,makeBoxSpec,boxAspect,boxGeometry,targetEdges,gradeLine,gradeThroughLine,gradeEllipse,gradeArc,gradeBox,gradeBoxEdge,testPlan};
})();
