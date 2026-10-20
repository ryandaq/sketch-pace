(function () {
  "use strict";

  const STORAGE_KEY = "sketch-pace-history-v4";
  const FOCUS_KEY = "sketch-pace-focus-v2";
  const CHALLENGE_KEY = "sketch-pace-challenge-v2";
  const STATS_KEY = "sketch-pace-lifetime-stats-v2";
  const PREF_KEY = "sketch-pace-target-settings-v1";
  const LEGACY_KEYS = ["sketch-pace-history-v3","sketch-pace-focus-v1","sketch-pace-challenge-v1","sketch-pace-lifetime-stats-v1"];
  const groups = [{start:0,end:2,name:"Line control"},{start:3,end:5,name:"Circles & ellipses"},{start:6,end:6,name:"Perspective box"},{start:7,end:7,name:"Product form"}];
  const tasks = [
    { type: "line", title: "Connect the two points", category: "01 / LINE CONTROL", description: "Draw one confident stroke from one target dot to the other.", a: [.20, .69], b: [.79, .31] },
    { type: "line", title: "Hold a long straight line", category: "01 / LINE CONTROL", description: "Keep the mark steady across the page. Either direction works.", a: [.17, .47], b: [.84, .47] },
    { type: "line", title: "Control a rising diagonal", category: "01 / LINE CONTROL", description: "Connect the points without repeatedly correcting the stroke.", a: [.25, .76], b: [.70, .22] },
    { type: "ellipse", title: "Draw a circle", category: "02 / CIRCLES & ELLIPSES", description: "Pass through all four open axis dots in one smooth loop.", rx: .20, ry: .20, angle: 0 },
    { type: "ellipse", title: "Draw a wide ellipse", category: "02 / CIRCLES & ELLIPSES", description: "Keep the long and short axes balanced as you close the loop.", rx: .28, ry: .17, angle: 0 },
    { type: "ellipse", title: "Tilt the ellipse", category: "02 / CIRCLES & ELLIPSES", description: "Use the four axis dots to hold the tilt and proportion.", rx: .28, ry: .15, angle: -.38 },
    { type: "box", title: "Build a perspective box", category: "03 / PERSPECTIVE BOX", description: "Draw the highlighted edge next. Complete all nine edges to finish the form." },
    { type: "product", title: "Copy the cup form", category: "04 / PRODUCT FORM", description: "Use the reference on the left. Draw the body, rim, and handle in the empty study area." }
  ];
  const productNames = ["body contour", "top rim", "handle"];

  const $ = (id) => document.getElementById(id);
  const canvas = $("drawingCanvas");
  const ctx = canvas.getContext("2d", { alpha: true });
  const wrap = $("canvasWrap");
  const overlay = $("canvasOverlay");
  const state = {
    step: 0,
    records: [],
    drawing: false,
    current: [],
    downAt: 0,
    pointerId: null,
    sessionActive: false,
    focusActive: false,
    challengeActive: false,
    challengeGroup: 0,
    challengeScores: [],
    challengeHistory: [],
    stats: {circuits:{},focus:{},challenges:{}},
    inputMode: "auto",
    focusGroup: 0,
    focusCount: 0,
    level: 1,
    variant: 0,
    targetSpec: null,
    preferences: {lineWeights:[2,4,2],ellipseWeights:[2,4,2],lineGuide:true,ellipseGuide:true},
    lastResult: null,
    focusHistory: [],
    sessionStartedAt: 0,
    completed: Array(tasks.length).fill(null),
    completedMetrics: Array(tasks.length).fill(null),
    history: [],
    size: { w: 0, h: 0 }
  };

  function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
  function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function lengthOf(points) { let sum = 0; for (let i = 1; i < points.length; i++) sum += distance(points[i - 1], points[i]); return sum; }
  function fmtTime(seconds) { const n = Math.max(0, Math.floor(seconds)); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`; }
  function percent(value) { return `${Math.round(value)}%`; }
  function currentTask() { return tasks[state.step]; }
  function groupFor(index) { return groups.findIndex(group=>index>=group.start&&index<=group.end); }
  function targetTitle(task){const spec=state.targetSpec;if(!spec||spec.index!==state.step)return task.title;const size=(task.type==="ellipse"?["small","medium","large"]:["short","medium","long"])[spec.size];if(task.type==="line")return `Draw a ${size} line`;if(task.type==="ellipse")return `Draw a ${size} ${state.step===3?"circle":state.step===4?"ellipse":"tilted ellipse"}`;return task.title;}
  function between(low,high){return low+Math.random()*(high-low);}
  function weightedSize(weights){const total=weights.reduce((a,b)=>a+b,0);let pick=Math.random()*total;for(let i=0;i<weights.length;i++){pick-=weights[i];if(pick<0)return i;}return 2;}
  function makeTargetSpec(index){
    const task=tasks[index],w=Math.max(state.size.w,320),h=Math.max(state.size.h,320),unit=Math.min(w,h);
    if(task.type==="line"){
      const size=weightedSize(state.preferences.lineWeights),bands=[[.18,.30],[.38,.54],[.64,.82]],length=between(...bands[size])*unit,angle=between(0,Math.PI*2),dx=Math.cos(angle)*length/2,dy=Math.sin(angle)*length/2;
      const cx=between(Math.abs(dx)+w*.07,w-Math.abs(dx)-w*.07),cy=between(Math.abs(dy)+h*.08,h-Math.abs(dy)-h*.08);
      return {index,type:"line",size,a:[(cx-dx)/w,(cy-dy)/h],b:[(cx+dx)/w,(cy+dy)/h]};
    }
    if(task.type==="ellipse"){
      const size=weightedSize(state.preferences.ellipseWeights),bands=[[.105,.15],[.175,.225],[.255,.315]],major=between(...bands[size])*unit;
      const ratio=index===3?1:index===4?between(1.35,2.05):between(1.45,2.35),rx=major,ry=major/ratio,angle=index===3?0:index===4?between(-.25,.25):between(-1.1,1.1),ca=Math.cos(angle),sa=Math.sin(angle),boundX=Math.hypot(rx*ca,ry*sa),boundY=Math.hypot(rx*sa,ry*ca);
      const cx=between(boundX+w*.07,w-boundX-w*.07),cy=between(boundY+h*.08,h-boundY-h*.08);
      return {index,type:"ellipse",size,cx:cx/w,cy:cy/h,rx:rx/unit,ry:ry/unit,angle};
    }
    if(task.type==="box"){
      for(let attempt=0;attempt<60;attempt++){
        const frontX=between(.36,.64),frontTop=between(.24,.43),frontBottom=between(Math.max(.58,frontTop+.23),.84),leftVpX=between(-.95,-.25),rightVpX=between(1.25,1.95),vanishY=between(.03,.22);
        const leftMax=(frontX-.07)/(frontX-leftVpX),rightMax=(.93-frontX)/(rightVpX-frontX);
        const leftDepth=Math.min(between(.17,.36),leftMax*.92),rightDepth=Math.min(between(.17,.36),rightMax*.92);
        const spec={index,type:"box",frontX,frontTop,frontBottom,leftVpX,rightVpX,vanishY,leftDepth,rightDepth};
        const edges=getTargets({...task,...spec},320,320);
        if(edges.every(edge=>[edge.points[0],edge.points.at(-1)].every(p=>p.x>=320*.045&&p.x<=320*.955&&p.y>=320*.04&&p.y<=320*.95)))return spec;
      }
      return {index,type:"box",frontX:.5,frontTop:.32,frontBottom:.72,leftVpX:-.58,rightVpX:1.58,vanishY:.2,leftDepth:.24,rightDepth:.24};
    }
    return null;
  }
  function challengeTask() {
    const task=currentTask();
    if(state.targetSpec&&state.targetSpec.index===state.step)return {...task,...state.targetSpec};
    if(state.level===1&&!state.focusActive&&!state.challengeActive)return task;
    const v=state.variant+state.step*7+state.level*11;
    const wave=(n)=>Math.sin(v*n)*.5+Math.cos(v*(n+.37))*.5;
    if(task.type==="line")return {...task,a:[clamp(task.a[0]+wave(.73)*.035, .12,.88),clamp(task.a[1]+wave(.39)*.06,.15,.85)],b:[clamp(task.b[0]+wave(.51)*.035,.12,.88),clamp(task.b[1]+wave(.27)*.06,.15,.85)]};
    if(task.type==="ellipse")return {...task,rx:task.rx*(1+wave(.43)*.09),ry:task.ry*(1+wave(.61)*.09),angle:task.angle+(state.level-1)*wave(.31)*.19};
    if(task.type==="box")return {...task,boxShift:wave(.47)*.035,boxDepth:.25+wave(.67)*.035,boxVanishY:.23+wave(.29)*.05};
    if(task.type==="product")return {...task,cupScale:1+wave(.57)*.07,cupAspect:1+wave(.41)*.12};
    return task;
  }
  function currentTargets() { return getTargets(challengeTask(), state.size.w, state.size.h); }
  function toleranceScale(){return state.level===1?1:state.level===2?.82:.68;}
  function sampleLine(a, b, count = 70) { return Array.from({ length: count }, (_, i) => ({ x: a.x + (b.x - a.x) * i / (count - 1), y: a.y + (b.y - a.y) * i / (count - 1) })); }
  function sampleEllipse(cx, cy, rx, ry, angle = 0, count = 140) {
    const ca = Math.cos(angle), sa = Math.sin(angle);
    return Array.from({ length: count + 1 }, (_, i) => {
      const t = 2 * Math.PI * i / count, ex = rx * Math.cos(t), ey = ry * Math.sin(t);
      return { x: cx + ex * ca - ey * sa, y: cy + ex * sa + ey * ca };
    });
  }
  function bezier(a, b, c, d, count = 35) {
    return Array.from({ length: count }, (_, i) => {
      const t = i / (count - 1), u = 1 - t;
      return { x: u*u*u*a.x + 3*u*u*t*b.x + 3*u*t*t*c.x + t*t*t*d.x,
        y: u*u*u*a.y + 3*u*u*t*b.y + 3*u*t*t*c.y + t*t*t*d.y };
    });
  }
  function combine(...parts) { return parts.flatMap((p, i) => i ? p.slice(1) : p); }
  function getCup(cx, cy, s, aspect=1) {
    const topY = cy - .28*s, left = cx - .53*s, right = cx + .53*s, bottomY = cy + .70*s;
    const body = combine(
      bezier({x:left,y:topY},{x:left+.03*s,y:cy+.09*s},{x:left+.10*s,y:bottomY-.05*s},{x:cx-.41*s,y:bottomY}),
      bezier({x:cx-.41*s,y:bottomY},{x:cx-.18*s,y:bottomY+.09*s},{x:cx+.18*s,y:bottomY+.09*s},{x:cx+.41*s,y:bottomY}),
      bezier({x:cx+.41*s,y:bottomY},{x:right-.10*s,y:bottomY-.05*s},{x:right-.03*s,y:cy+.09*s},{x:right,y:topY})
    );
    const rim = sampleEllipse(cx, topY, .53*s, .15*s, 0, 100);
    const handle = combine(
      bezier({x:right-.01*s,y:topY+.12*s},{x:cx+.93*s,y:topY+.02*s},{x:cx+1.11*s,y:cy+.17*s},{x:cx+.96*s,y:cy+.44*s}),
      bezier({x:cx+.96*s,y:cy+.44*s},{x:cx+.84*s,y:cy+.64*s},{x:cx+.65*s,y:cy+.50*s},{x:cx+.48*s,y:cy+.45*s})
    );
    const shape=points=>points.map(p=>({x:cx+(p.x-cx)*aspect,y:p.y}));
    return [{ points: shape(body), closed: false, label: productNames[0] },{ points: shape(rim), closed: true, label: productNames[1] },{ points: shape(handle), closed: false, label: productNames[2] }];
  }
  function lineIntersection(a, b, c, d) {
    const den = (a.x-b.x)*(c.y-d.y)-(a.y-b.y)*(c.x-d.x);
    if (Math.abs(den) < .0001) return { x:(b.x+c.x)/2, y:(b.y+c.y)/2 };
    const det1=a.x*b.y-a.y*b.x, det2=c.x*d.y-c.y*d.x;
    return {x:(det1*(c.x-d.x)-(a.x-b.x)*det2)/den,y:(det1*(c.y-d.y)-(a.y-b.y)*det2)/den};
  }
  function getTargets(task, w, h) {
    if (task.type === "line") return [{ points: sampleLine({x:task.a[0]*w,y:task.a[1]*h},{x:task.b[0]*w,y:task.b[1]*h}), closed:false, label:"line" }];
    if (task.type === "ellipse") {
      const unit = Math.min(w, h);
      const cx=(task.cx??.5)*w,cy=(task.cy??.52)*h;
      return [{points:sampleEllipse(cx,cy,task.rx*unit,task.ry*unit,task.angle),closed:true,label:"ellipse",center:{x:cx,y:cy},rx:task.rx*unit,ry:task.ry*unit,angle:task.angle}];
    }
    if (task.type === "box") {
      const A={x:(task.frontX??(.5+(task.boxShift||0)))*w,y:(task.frontTop??.33)*h}, B={x:A.x,y:(task.frontBottom??.70)*h}, vl={x:(task.leftVpX??-.58)*w,y:(task.vanishY??task.boxVanishY??.23)*h},vr={x:(task.rightVpX??1.58)*w,y:(task.vanishY??task.boxVanishY??.23)*h};
      const mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
      const LT=mix(A,vl,task.leftDepth??task.boxDepth??.25), LB=mix(B,vl,task.leftDepth??task.boxDepth??.25), RT=mix(A,vr,task.rightDepth??task.boxDepth??.25), RB=mix(B,vr,task.rightDepth??task.boxDepth??.25);
      const C=lineIntersection(LT,vr,RT,vl);
      return [[A,B],[A,LT],[LT,LB],[B,LB],[A,RT],[RT,RB],[B,RB],[LT,C],[RT,C]].map((pair,i)=>({points:sampleLine(pair[0],pair[1]),closed:false,label:`edge ${i+1}`}));
    }
    const horizontal = w >= 590;
    const s = horizontal ? Math.min(h*.43,w*.19) : Math.min(h*.26,w*.28);
    const cx = horizontal ? .70*w : .50*w, cy = horizontal ? .43*h : .67*h;
    return getCup(cx,cy,s*(task.cupScale||1),task.cupAspect||1);
  }
  function getReferenceCup(w,h,task=challengeTask()) {
    const horizontal = w >= 590;
    const s = horizontal ? Math.min(h*.43,w*.19) : Math.min(h*.26,w*.28);
    return getCup(horizontal ? .25*w : .50*w, horizontal ? .43*h : .22*h, s*(task.cupScale||1),task.cupAspect||1);
  }
  function ellipseAxisDots(target) {
    const {center,rx,ry,angle}=target,ca=Math.cos(angle),sa=Math.sin(angle);
    return [
      {x:center.x+rx*ca,y:center.y+rx*sa},
      {x:center.x-rx*ca,y:center.y-rx*sa},
      {x:center.x-ry*sa,y:center.y+ry*ca},
      {x:center.x+ry*sa,y:center.y-ry*ca}
    ];
  }

  function pointToSegmentSquared(p,a,b) {
    const dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy;
    const t=den?clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/den,0,1):0;
    const ex=p.x-(a.x+t*dx),ey=p.y-(a.y+t*dy);
    return ex*ex+ey*ey;
  }
  function pointToSegment(p,a,b) { return Math.sqrt(pointToSegmentSquared(p,a,b)); }
  function nearestToPolyline(p, points) {
    let best=Infinity;
    for(let i=1;i<points.length;i++)best=Math.min(best,pointToSegmentSquared(p,points[i-1],points[i]));
    return Math.sqrt(best);
  }
  function resampleByLength(points,count) {
    if(points.length<2)return {points:[points[0]],length:0};
    const lengths=new Array(points.length-1);
    let total=0;
    for(let i=1;i<points.length;i++){const part=distance(points[i-1],points[i]);lengths[i-1]=part;total+=part;}
    if(total===0)return {points:[points[0]],length:0};
    const samples=[points[0]];
    let segment=1,walked=0,segmentLength=lengths[0];
    for(let i=1;i<count-1;i++){
      const wanted=total*i/(count-1);
      while(segment<points.length-1&&walked+segmentLength<wanted){walked+=segmentLength;segment++;segmentLength=lengths[segment-1];}
      const t=segmentLength?clamp((wanted-walked)/segmentLength,0,1):0;
      samples.push({x:points[segment-1].x+t*(points[segment].x-points[segment-1].x),y:points[segment-1].y+t*(points[segment].y-points[segment-1].y)});
    }
    samples.push(points.at(-1));
    return {points:samples,length:total};
  }
  function avg(values) { return values.reduce((a,b)=>a+b,0)/Math.max(1,values.length); }
  function qualityWord(score) { return score>=88?"Excellent control":score>=72?"Good control":score>=55?"Getting there":"Keep practicing"; }
  function gradeLine(user,target,strict=1) {
    const a=target.points[0],b=target.points.at(-1),len=distance(a,b);
    const forward=distance(user[0],a)+distance(user.at(-1),b);
    const reverse=distance(user[0],b)+distance(user.at(-1),a);
    const dotErrors=forward<=reverse?[distance(user[0],a),distance(user.at(-1),b)]:[distance(user.at(-1),a),distance(user[0],b)];
    const chord=Math.max(1,distance(user[0],user.at(-1)));
    const sampled=resampleByLength(user,64);
    const deviation=avg(sampled.points.map(p=>pointToSegment(p,user[0],user.at(-1))));
    const extra=Math.max(0,sampled.length/chord-1);
    const dotScores=dotErrors.map(error=>clamp(100-100*error/(len*.10*toleranceScale()*strict),0,100));
    const endpoints=avg(dotScores);
    const straightness=clamp(100-100*deviation/(chord*.05*toleranceScale()*strict)-80*extra/(toleranceScale()*strict),0,100);
    const score=.5*endpoints+.5*straightness;
    return {score,metrics:[endpoints,straightness],dotScores,detail:endpoints<straightness-8?"Bring both ends closer to their target dots.":straightness<endpoints-8?"Keep the stroke straighter between its ends.":"The endpoints and path are well controlled."};
  }
  function gradeBoxEdge(user,target){
    const base=gradeLine(user,target,.65),len=distance(target.points[0],target.points.at(-1));
    const fit=clamp(100-100*avg(resampleByLength(user,64).points.map(p=>nearestToPolyline(p,target.points)))/(len*.055*toleranceScale()),0,100);
    const placement=.65*base.metrics[0]+.35*fit,straightness=base.metrics[1],score=.7*placement+.3*straightness;
    return {score,metrics:[placement,straightness],dotScores:base.dotScores,detail:placement<straightness-8?"Place this edge closer to its guide and endpoint dots.":straightness<placement-8?"Keep this edge straighter in one confident stroke.":"The edge follows its guide closely."};
  }
  function gradeEllipse(user,target) {
    const {center,rx,ry,angle}=target,ca=Math.cos(angle),sa=Math.sin(angle),minR=Math.min(rx,ry);
    const sampled=resampleByLength(user,96),samples=sampled.points,signedRadial=samples.map(p=>{const dx=p.x-center.x,dy=p.y-center.y,x=dx*ca+dy*sa,y=-dx*sa+dy*ca;return Math.hypot(x/rx,y/ry)-1;}),radial=signedRadial.map(Math.abs);
    const bins=new Set(samples.map(p=>{const dx=p.x-center.x,dy=p.y-center.y,x=dx*ca+dy*sa,y=-dx*sa+dy*ca;return Math.floor(((Math.atan2(y/ry,x/rx)+Math.PI)/(2*Math.PI))*24)%24;}));
    const coverage=bins.size/24,closure=distance(user[0],user.at(-1)),ideal=Math.PI*(3*(rx+ry)-Math.sqrt((3*rx+ry)*(rx+3*ry))),extra=Math.max(0,sampled.length/ideal-1.25);
    const dotScores=ellipseAxisDots(target).map(dot=>clamp(100-100*nearestToPolyline(dot,user)/(minR*.35*toleranceScale()),0,100));
    const axes=avg(dotScores);
    const wobble=avg(signedRadial.slice(1,-1).map((r,i)=>Math.abs(signedRadial[i]-2*r+signedRadial[i+2])));
    const smoothness=clamp(100-(220*avg(radial)+65*(1-coverage)+35*closure/minR+90*extra+1100*wobble)/toleranceScale(),0,100);
    const score=.5*axes+.5*smoothness;
    return {score,metrics:[axes,smoothness],dotScores,detail:coverage<.78?"Complete more of the loop.":axes<smoothness-8?"Bring the curve closer to all four axis dots.":smoothness<axes-8?"Smooth the curve and close the loop cleanly.":"The curve reaches the dots and follows the ideal ellipse closely."};
  }
  function gradeProduct(user,target) {
    const u=resampleByLength(user,96).points,t=resampleByLength(target.points,96).points,scale=Math.min(state.size.w,state.size.h);
    const forward=avg(u.map(p=>nearestToPolyline(p,t)));
    const reverse=avg(t.map(p=>nearestToPolyline(p,u)));
    const endpoint=target.closed?distance(user[0],user.at(-1)):
      Math.min(distance(user[0],target.points[0])+distance(user.at(-1),target.points.at(-1)),distance(user[0],target.points.at(-1))+distance(user.at(-1),target.points[0]))/2;
    const contour=clamp(100-(forward*.58+reverse*.42)*450/(scale*toleranceScale()),0,100);
    const ends=clamp(100-100*endpoint/(scale*.22*toleranceScale()),0,100);
    const score=.85*contour+.15*ends;
    return {score,metrics:[contour,ends],detail:score>=85?"Shape and placement are close to the reference.":"Compare the largest proportions and placement with the reference."};
  }
  function grade(user,target) { const type=currentTask().type; return type==="line"?gradeLine(user,target):type==="box"?gradeBoxEdge(user,target):type==="ellipse"?gradeEllipse(user,target):gradeProduct(user,target); }

  function resizeCanvas() {
    const rect=wrap.getBoundingClientRect(),w=rect.width,h=rect.height,dpr=Math.min(window.devicePixelRatio||1,3);
    if(Math.abs(w-state.size.w)<1&&Math.abs(h-state.size.h)<1)return;
    const hadMarks=state.records.length>0||state.drawing;
    state.size={w,h}; canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
    if(hadMarks){retractFocusAttempt();retractChallengeAttempt();state.records=[];state.current=[];state.drawing=false;state.pointerId=null;state.completed[state.step]=null;state.completedMetrics[state.step]=null;overlay.hidden=true;$("milestoneBanner").hidden=true;$("challengeResultBanner").hidden=true;setFeedback("Canvas resized", "This drill restarted so its targets stay aligned.",null,null);updateControls();}
    draw();
  }
  function drawPath(points,color,width=2,dash=[]) {
    if(!points.length)return;
    ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
    for(let i=1;i<points.length;i++)ctx.lineTo(points[i].x,points[i].y);
    ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap="round";ctx.lineJoin="round";ctx.setLineDash(dash);ctx.stroke();ctx.setLineDash([]);
  }
  function dot(p,r=5,fill="#a5b69c") {ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();}
  function openDot(p) {ctx.beginPath();ctx.arc(p.x,p.y,7,0,Math.PI*2);ctx.fillStyle="#fbfbf7";ctx.fill();ctx.strokeStyle="#809b7b";ctx.lineWidth=2;ctx.stroke();}
  function drawLabel(str,x,y) {ctx.fillStyle="#8c9c8d";ctx.font="700 11px Inter, sans-serif";ctx.fillText(str,x,y);}
  function draw() {
    const {w,h}=state.size;if(!w||!h)return;ctx.clearRect(0,0,w,h);
    const task=currentTask(),targets=currentTargets(),currentIndex=state.records.length;
    if(task.type==="product"){
      const ref=getReferenceCup(w,h),horizontal=w>=590;
      if(horizontal){ctx.strokeStyle="#d9e0d5";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(w*.50,h*.12);ctx.lineTo(w*.50,h*.88);ctx.stroke();drawLabel("REFERENCE",w*.08,h*.12);drawLabel("YOUR STUDY",w*.56,h*.12);}
      else {ctx.strokeStyle="#d9e0d5";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(w*.12,h*.46);ctx.lineTo(w*.88,h*.46);ctx.stroke();drawLabel("REFERENCE",w*.09,h*.075);drawLabel("YOUR STUDY",w*.09,h*.53);}
      ref.forEach((path,i)=>drawPath(path.points,i===currentIndex?"#3f6549":"#607663",i===currentIndex?2.4:1.8));
      if(currentIndex<targets.length){const active=targets[currentIndex];if(!active.closed){dot(active.points[0],4,"#b1c2aa");dot(active.points.at(-1),4,"#b1c2aa");}}
    } else if(task.type==="box"){
      targets.forEach((target,i)=>{if(i>=currentIndex)drawPath(target.points,i===currentIndex?"#a1b49a":"#d0dccb",i===currentIndex?2.5:1.5,i===currentIndex?[6,6]:[3,7]);});
      if(currentIndex<targets.length){const a=targets[currentIndex].points[0],b=targets[currentIndex].points.at(-1);dot(a);dot(b);drawLabel("A",a.x+10,a.y-8);drawLabel("B",b.x+10,b.y-8);}
    } else {
      const target=targets[0];
      if(task.type==="line"){const a=target.points[0],b=target.points.at(-1);if(state.preferences.lineGuide)drawPath(target.points,"#a9bba4",2,[6,7]);dot(a);dot(b);drawLabel("A",a.x+10,a.y-8);drawLabel("B",b.x+10,b.y-8);}
      if(task.type==="ellipse"){
        const dots=ellipseAxisDots(target);
        if(state.preferences.ellipseGuide){drawPath([dots[0],dots[1]],"#d6ded2",1,[3,6]);drawPath([dots[2],dots[3]],"#d6ded2",1,[3,6]);}
        if(state.records.length&&state.preferences.ellipseGuide)drawPath(target.points,"#b7c6b0",1.5,[5,6]);
        dots.forEach((p,i)=>{openDot(p);drawLabel("ABCD"[i],p.x+10,p.y-8);});
      }
    }
    state.records.forEach(record=>drawPath(record.points,"#36533c",2.5));
    if(state.current.length)drawPath(state.current,"#df7651",2.6);
  }
  function pointerPoint(event){const r=canvas.getBoundingClientRect();return {x:event.clientX-r.left,y:event.clientY-r.top};}
  let framePending=false;
  function scheduleDraw(){if(framePending)return;if(typeof window.requestAnimationFrame!=="function"){draw();return;}framePending=true;window.requestAnimationFrame(()=>{framePending=false;draw();});}
  function onDown(event){
    if(state.inputMode==="pen"&&event.pointerType!=="pen")return;
    if(state.drawing||state.records.length>=currentTargets().length||!overlay.hidden)return;
    event.preventDefault();canvas.setPointerCapture(event.pointerId);state.pointerId=event.pointerId;state.drawing=true;state.downAt=performance.now();state.current=[pointerPoint(event)];draw();
  }
  function onMove(event){if(!state.drawing||event.pointerId!==state.pointerId)return;event.preventDefault();state.current.push(pointerPoint(event));scheduleDraw();}
  function onUp(event){
    if(!state.drawing||event.pointerId!==state.pointerId)return;
    event.preventDefault();state.current.push(pointerPoint(event));state.drawing=false;state.pointerId=null;
    const points=state.current;state.current=[];
    if(lengthOf(points)<16){setFeedback("Stroke too short", "Draw the full target in one stroke.",null,null);draw();return;}
    const target=currentTargets()[state.records.length],result=grade(points,target),duration=(performance.now()-state.downAt)/1000;
    state.records.push({points,score:result.score,metrics:result.metrics,dotScores:result.dotScores,duration});
    const done=state.records.length===currentTargets().length;
    const shownMetrics=done?[0,1].map(i=>avg(state.records.map(r=>r.metrics[i]))):result.metrics;
    if(done){state.completed[state.step]=Math.round(avg(state.records.map(r=>r.score)));state.completedMetrics[state.step]=shownMetrics.map(Math.round);
      if(state.focusActive){state.focusCount++;state.focusHistory.push({date:new Date().toISOString(),scoreVersion:4,group:state.focusGroup,level:state.level,score:state.completed[state.step],task:state.step});state.focusHistory=state.focusHistory.slice(-1200);saveFocus();recordStat("focus",`${state.focusGroup}:${state.level}`,state.completed[state.step],1);renderHistory();}
      if(state.challengeActive)state.challengeScores.push(state.completed[state.step]);}
    setFeedback(done?qualityWord(state.completed[state.step]):`Good. Next: ${nextStrokeName()}`,result.detail,done?state.completed[state.step]:Math.round(result.score),duration,shownMetrics,result.dotScores);
    if(done&&(currentTask().type==="line"||currentTask().type==="ellipse"))showPreviousResult(currentTask(),result,state.completed[state.step],duration);
    updateControls();draw();
    if(done&&state.focusActive&&state.focusCount%10===0){
      const recent=state.focusHistory.slice(-10),setScore=Math.round(avg(recent.map(x=>x.score)));
      $("nextButton").disabled=true;
      $("milestoneBanner").hidden=false;$("milestoneKicker").textContent=`FOCUS SET ${state.focusCount/10} COMPLETE`;$("milestoneTitle").textContent=`Ten targets · ${setScore}% average`;$("milestoneText").textContent="Inspect your final mark and feedback, then start the next set.";
    }
    if(done&&(currentTask().type==="line"||currentTask().type==="ellipse")&&!(state.focusActive&&state.focusCount%10===0))autoAdvance();
  }
  function showPreviousResult(task,result,score,duration){
    state.lastResult={type:task.type,score,metrics:result.metrics,detail:result.detail,duration};
    const meta=metricMeta();$("previousResult").hidden=false;$("previousScore").textContent=percent(score);
    $("previousInfo").textContent=`${targetTitle(task)} · ${meta.labels[0]} ${percent(result.metrics[0])} · ${meta.labels[1]} ${percent(result.metrics[1])} · ${duration.toFixed(1)}s · ${result.detail}`;
  }
  function autoAdvance(){
    if(state.challengeActive){advanceChallenge();return;}
    if(state.focusActive){advanceFocus();return;}
    if(state.sessionActive){goTo(state.step+1);return;}
    const group=groups[groupFor(state.step)];state.variant++;goTo(state.step>=group.end?group.start:state.step+1);
  }
  function nextStrokeName(){const task=currentTask();if(task.type==="box")return `edge ${state.records.length+1}`;if(task.type==="product")return productNames[state.records.length];return "the target";}
  function metricMeta(){
    const type=currentTask().type;
    if(type==="ellipse")return {labels:["Axis dots","Curve smoothness"],formula:"Accuracy = 50% axis dots + 50% curve smoothness"};
    if(type==="product")return {labels:["Contour match","Feature ends"],formula:"Accuracy = 85% contour match + 15% feature ends"};
    if(type==="box")return {labels:["Edge placement","Straightness"],formula:"Accuracy = 70% edge placement + 30% straightness"};
    return {labels:["Endpoint dots","Straightness"],formula:"Accuracy = 50% endpoint dots + 50% straightness"};
  }
  function setFeedback(title,message,score,seconds,metrics=null,dotScores=null){
    $("feedbackTitle").textContent=title;$("feedbackText").textContent=message;
    $("accuracyValue").textContent=score==null?"—":percent(score);$("timeValue").textContent=seconds==null?"—":`${seconds.toFixed(1)}s`;
    $("feedbackIcon").textContent=score==null?"◎":score>=80?"✓":"↗";
    const meta=metricMeta();$("metricFormula").textContent=meta.formula;
    for(let i=0;i<2;i++){
      $("metricLabel"+i).textContent=meta.labels[i];
      $("metricValue"+i).textContent=metrics?percent(metrics[i]):"—";
      $("metricFill"+i).style.width=metrics?`${clamp(metrics[i],0,100)}%`:"0%";
    }
    const dotLabels=currentTask().type==="ellipse"?["Dot A","Dot B","Dot C","Dot D"]:currentTask().type==="product"?[]:["Dot A","Dot B"];
    $("dotBreakdown").hidden=dotLabels.length===0;
    for(let i=0;i<4;i++){
      $("dotDetail"+i).hidden=i>=dotLabels.length;
      if(i<dotLabels.length){$("dotLabel"+i).textContent=dotLabels[i];$("dotValue"+i).textContent=dotScores?percent(dotScores[i]):"—";}
    }
  }
  function updateControls(){
    const targetCount=currentTargets().length,done=state.records.length>=targetCount;
    const auto=currentTask().type==="line"||currentTask().type==="ellipse";
    $("nextButton").disabled=!done;
    $("nextButton").hidden=auto;
    $("nextButton").innerHTML=state.challengeActive?(state.challengeScores.length>=5?"See challenge result <span aria-hidden=\"true\">→</span>":"Next target <span aria-hidden=\"true\">→</span>"):state.focusActive?"Next target <span aria-hidden=\"true\">→</span>":state.step===tasks.length-1?(state.sessionActive?"Finish circuit <span aria-hidden=\"true\">→</span>":"Practice again <span aria-hidden=\"true\">→</span>"):"Next drill <span aria-hidden=\"true\">→</span>";
    $("drillProgressLabel").textContent=auto?"New target after each stroke":done?`${targetCount} of ${targetCount} strokes complete`:`Stroke ${state.records.length+1} of ${targetCount}`;
    $("canvasPrompt").textContent=done?"Drill complete":currentTask().type==="product"?`Copy the ${productNames[state.records.length]}`:currentTask().type==="box"?`Draw edge ${state.records.length+1} of ${targetCount}`:auto?"Draw once · next target appears automatically":"Draw one stroke";
    $("resetButton").textContent=auto?(done?"Retry target":"New target"):"Restart drill";
    $("undoButton").disabled=state.records.length===0;
    const completed=state.completed.filter(x=>x!==null).length;
    $("progressText").textContent=state.challengeActive?`${state.challengeScores.length} of 5 targets`:state.focusActive?`${state.focusCount} focus targets`: `${completed} of ${tasks.length} drills`;
    $("sessionProgressFill").style.width=state.challengeActive?`${state.challengeScores.length*20}%`:state.focusActive?`${(state.focusCount%10||state.focusCount&&10)*10}%`:`${completed/tasks.length*100}%`;
    $("sessionStatus").textContent=state.challengeActive?"Challenge":state.focusActive?"Focus mode":state.sessionActive?"In progress":completed===tasks.length?"Complete":"Ready";
    $("startButton").innerHTML=state.sessionActive?"Restart circuit <span aria-hidden=\"true\">↗</span>":"Start circuit <span aria-hidden=\"true\">↗</span>";
    $("focusButton").innerHTML=state.focusActive?"Restart focus <span aria-hidden=\"true\">↗</span>":`Practice ${groups[groupFor(state.step)].name.toLowerCase()} <span aria-hidden="true">↗</span>`;
    $("challengeButton").innerHTML=state.challengeActive?"Restart challenge <span aria-hidden=\"true\">⚡</span>":`Challenge ${groups[groupFor(state.step)].name.toLowerCase()} <span aria-hidden="true">⚡</span>`;
    $("modeHint").textContent=state.challengeActive?`Five ${groups[state.challengeGroup].name.toLowerCase()} targets. Accuracy sets your result; time stays separate.`:state.focusActive?`Repeating ${groups[state.focusGroup].name.toLowerCase()} at ${["","Foundation","Control","Precision"][state.level]} level. Each completed target is saved.`:state.sessionActive?"Complete all eight drills to save a circuit score. You can retry any current drill.":"Circuit: eight drills. Focus: repeat a selected skill. Challenge: five targets and one score.";
    $("focusSummary").hidden=!state.focusActive;
    if(state.focusActive){const setNo=state.focusCount>0&&state.focusCount%10===0?state.focusCount/10:Math.floor(state.focusCount/10)+1,within=state.focusCount>0&&state.focusCount%10===0?10:state.focusCount%10;$("focusSet").textContent=`Set ${setNo} · ${within} of 10`;const best=bestStat("focus",`${state.focusGroup}:${state.level}`);$("focusBest").textContent=`Best in this skill: ${best===null?"—":percent(best)}`;}
  }
  function goTo(index){
    state.step=index;state.records=[];state.current=[];state.drawing=false;state.pointerId=null;overlay.hidden=true;$("milestoneBanner").hidden=true;$("challengeResultBanner").hidden=true;
    state.targetSpec=makeTargetSpec(index);
    $("skillSelect").value=String(groups[groupFor(index)].start);
    const task=currentTask();$("drillCategory").textContent=task.category+` · ${["","FOUNDATION","CONTROL","PRECISION"][state.level]}`;$("drillTitle").textContent=targetTitle(task);$("drillDescription").textContent=task.type==="line"?"Connect the two dots in one confident stroke. A new line appears when you finish.":task.type==="ellipse"?"Draw through all four dots in one smooth loop. A new target appears when you finish.":task.description;$("stepNumber").textContent=state.challengeActive?String(state.challengeScores.length+1).padStart(2,"0"):state.focusActive?String(state.focusCount+1).padStart(2,"0"):String(index+1).padStart(2,"0");$("stepTotal").textContent=state.challengeActive?"/ 05":state.focusActive?"/ ∞":"/ 08";
    document.querySelectorAll(".drill-row").forEach(row=>row.classList.toggle("active",Number(row.dataset.go)===groups[groupFor(index)].start));
    setFeedback("Ready when you are.",task.type==="product"?"Copy each feature from the reference. Start and end dots guide the open contours.":"Take your time. You can retry before moving on.",null,null);
    updateControls();renderHistory();draw();
  }
  function retractFocusAttempt(){if(!state.focusActive||state.records.length<currentTargets().length||state.completed[state.step]===null)return;const last=state.focusHistory.at(-1);if(last&&last.task===state.step&&last.group===state.focusGroup&&last.level===state.level){state.focusHistory.pop();state.focusCount=Math.max(0,state.focusCount-1);recordStat("focus",`${state.focusGroup}:${state.level}`,last.score,-1);saveFocus();renderHistory();}}
  function retractChallengeAttempt(){if(state.challengeActive&&state.records.length>=currentTargets().length&&state.completed[state.step]!==null)state.challengeScores.pop();}
  function resetDrill(){if(currentTask().type==="line"||currentTask().type==="ellipse")clearPreviousResult();retractFocusAttempt();retractChallengeAttempt();state.records=[];state.current=[];state.drawing=false;state.completed[state.step]=null;state.completedMetrics[state.step]=null;overlay.hidden=true;$("milestoneBanner").hidden=true;$("challengeResultBanner").hidden=true;setFeedback("Ready for another attempt.","Draw the target again. Accuracy and time will be measured separately.",null,null);updateControls();draw();}
  function newOrResetTarget(){if((currentTask().type==="line"||currentTask().type==="ellipse")&&state.records.length===0){state.variant++;goTo(state.step);}else resetDrill();}
  function undo(){if(state.drawing){state.drawing=false;state.current=[];}else if(state.records.length){if(currentTask().type==="line"||currentTask().type==="ellipse")clearPreviousResult();retractFocusAttempt();retractChallengeAttempt();state.records.pop();state.completed[state.step]=null;state.completedMetrics[state.step]=null;}else return;overlay.hidden=true;$("milestoneBanner").hidden=true;$("challengeResultBanner").hidden=true;setFeedback("Last stroke removed.","Try that mark again.",null,null);updateControls();draw();}
  function clearPreviousResult(){state.lastResult=null;$("previousResult").hidden=true;}
  function startCircuit(){clearPreviousResult();state.focusActive=false;state.challengeActive=false;state.sessionActive=true;state.sessionStartedAt=Date.now();state.variant++;state.completed=Array(tasks.length).fill(null);state.completedMetrics=Array(tasks.length).fill(null);$("elapsedText").textContent="0:00";goTo(0);updateControls();}
  function startFocus(){clearPreviousResult();state.sessionActive=false;state.challengeActive=false;state.focusActive=true;state.focusGroup=groupFor(state.step);state.focusCount=0;state.variant++;state.completed=Array(tasks.length).fill(null);state.completedMetrics=Array(tasks.length).fill(null);$("elapsedText").textContent="Untimed";goTo(groups[state.focusGroup].start);}
  function advanceFocus(){const group=groups[state.focusGroup],next=state.step>=group.end?group.start:state.step+1;state.variant++;goTo(next);}
  function startChallenge(){clearPreviousResult();state.sessionActive=false;state.focusActive=false;state.challengeActive=true;state.challengeGroup=groupFor(state.step);state.challengeScores=[];state.variant++;state.completed=Array(tasks.length).fill(null);state.completedMetrics=Array(tasks.length).fill(null);$("elapsedText").textContent="Untimed";goTo(groups[state.challengeGroup].start);}
  function advanceChallenge(){if(state.challengeScores.length>=5){completeChallenge();return;}const group=groups[state.challengeGroup],next=state.step>=group.end?group.start:state.step+1;state.variant++;goTo(next);}
  function completeChallenge(){const score=Math.round(avg(state.challengeScores)),best=bestStat("challenges",`${state.challengeGroup}:${state.level}`);state.challengeHistory.push({date:new Date().toISOString(),scoreVersion:4,group:state.challengeGroup,level:state.level,score});state.challengeHistory=state.challengeHistory.slice(-150);saveChallenges();recordStat("challenges",`${state.challengeGroup}:${state.level}`,score,1);state.challengeActive=false;updateControls();$("nextButton").disabled=true;$("challengeResultTitle").textContent=`${groups[state.challengeGroup].name} · ${score}% average`;overlay.hidden=false;overlay.innerHTML=`<div class="result-kicker">FIVE-TARGET CHALLENGE</div><h3>Five marks finished.</h3><div class="result-score">${score}<span>%</span></div><p>${groups[state.challengeGroup].name} · ${["","Foundation","Control","Precision"][state.level]}. ${best===null?"First challenge at this level.":score>best?`New challenge best · +${score-best} points.`:`${score-best} points vs. your best.`} Accuracy sets the result; speed does not.</p><div class="result-actions"><button class="button button-dark" id="againChallengeButton" type="button">Try again <span aria-hidden="true">⚡</span></button><button class="button button-light" id="viewMarkButton" type="button">View final mark <span aria-hidden="true">↗</span></button></div>`;$("againChallengeButton").addEventListener("click",startChallenge);$("viewMarkButton").addEventListener("click",()=>{overlay.hidden=true;$("challengeResultBanner").hidden=false;});renderHistory();}
  function completeCircuit(){
    const scores=state.completed.filter(x=>x!==null),overall=Math.round(avg(scores)),elapsed=Math.round((Date.now()-state.sessionStartedAt)/1000);
    const priorBest=bestStat("circuits",String(state.level));
    const groupScores=groups.map(g=>Math.round(avg(scores.slice(g.start,g.end+1)))),weakGroup=groupScores.indexOf(Math.min(...groupScores));
    const entry={date:new Date().toISOString(),scoreVersion:4,level:state.level,accuracy:overall,seconds:elapsed,drills:scores,components:state.completedMetrics};state.history.push(entry);state.history=state.history.slice(-60);saveHistory();recordStat("circuits",String(state.level),overall,1);renderHistory();
    state.sessionActive=false;updateControls();
    const nextLevel=overall>=80&&state.level<3?`Try ${["","Foundation","Control","Precision"][state.level+1]} level next.`:"Repeat this level and focus on your weakest skill.";
    const bestLine=priorBest===null?"First circuit at this level":overall>priorBest?`New personal best · +${overall-priorBest} points`:`${overall-priorBest} points vs. your best`;
    overlay.hidden=false;overlay.innerHTML=`<div class="result-kicker">CIRCUIT COMPLETE · ${["","FOUNDATION","CONTROL","PRECISION"][state.level]}</div><h3>Round complete.</h3><div class="result-score">${overall}<span>%</span></div><p>${bestLine} · ${fmtTime(elapsed)} elapsed. Weakest skill: ${groups[weakGroup].name} (${groupScores[weakGroup]}%). ${nextLevel}</p><div class="result-actions"><button class="button button-dark" id="againButton" type="button">Another circuit <span aria-hidden="true">↗</span></button><button class="button button-light" id="weakFocusButton" type="button">Practice ${groups[weakGroup].name.toLowerCase()} <span aria-hidden="true">→</span></button></div>`;
    $("againButton").addEventListener("click",startCircuit);
    $("weakFocusButton").addEventListener("click",()=>{state.step=groups[weakGroup].start;startFocus();});
  }
  function loadHistory(){try{const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]");state.history=Array.isArray(parsed)?parsed.filter(x=>x&&validScore(x.accuracy)&&[1,2,3].includes(x.level)&&Array.isArray(x.drills)&&x.drills.length===8&&x.drills.every(validScore)):[];}catch{state.history=[];$("saveState").textContent="Session storage unavailable";}}
  function saveHistory(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state.history));$("saveState").textContent="Saved on this device";}catch{$("saveState").textContent="Session storage unavailable";}}
  function loadFocus(){try{const parsed=JSON.parse(localStorage.getItem(FOCUS_KEY)||"[]");state.focusHistory=Array.isArray(parsed)?parsed.filter(x=>Number.isFinite(x.score)&&Number.isInteger(x.group)):[];}catch{state.focusHistory=[];}}
  function saveFocus(){try{localStorage.setItem(FOCUS_KEY,JSON.stringify(state.focusHistory));$("saveState").textContent="Saved on this device";}catch{$("saveState").textContent="Session storage unavailable";}}
  function loadChallenges(){try{const parsed=JSON.parse(localStorage.getItem(CHALLENGE_KEY)||"[]");state.challengeHistory=Array.isArray(parsed)?parsed.filter(x=>Number.isFinite(x.score)&&Number.isInteger(x.group)):[];}catch{state.challengeHistory=[];}}
  function saveChallenges(){try{localStorage.setItem(CHALLENGE_KEY,JSON.stringify(state.challengeHistory));$("saveState").textContent="Saved on this device";}catch{$("saveState").textContent="Session storage unavailable";}}
  function statBucket(kind,key){return state.stats[kind][key]||(state.stats[kind][key]={count:0,scores:{}});}
  function bestStat(kind,key){const scores=statBucket(kind,key).scores;for(let i=100;i>=0;i--)if(scores[i]>0)return i;return null;}
  function countStat(kind,key){return statBucket(kind,key).count;}
  function saveStats(){try{localStorage.setItem(STATS_KEY,JSON.stringify(state.stats));}catch{$("saveState").textContent="Session storage unavailable";}}
  function recordStat(kind,key,score,delta){const b=statBucket(kind,key),n=clamp(Math.round(score),0,100);b.scores[n]=Math.max(0,(b.scores[n]||0)+delta);b.count=Math.max(0,b.count+delta);saveStats();}
  function loadStats(){try{const parsed=JSON.parse(localStorage.getItem(STATS_KEY)||"null");if(parsed&&parsed.circuits&&parsed.focus&&parsed.challenges){state.stats=parsed;return;}}catch{}
    state.stats={circuits:{},focus:{},challenges:{}};
    state.history.forEach(x=>recordStat("circuits",String(x.level||1),x.accuracy,1));
    state.focusHistory.forEach(x=>recordStat("focus",`${x.group}:${x.level||1}`,x.score,1));
    state.challengeHistory.forEach(x=>recordStat("challenges",`${x.group}:${x.level||1}`,x.score,1));saveStats();}
  function validWeights(value){return Array.isArray(value)&&value.length===3&&value.every(n=>Number.isInteger(n)&&n>=0&&n<=5)&&value.some(n=>n>0);}
  function loadPreferences(){try{const saved=JSON.parse(localStorage.getItem(PREF_KEY)||"null");if(saved){if(validWeights(saved.lineWeights))state.preferences.lineWeights=saved.lineWeights;if(validWeights(saved.ellipseWeights))state.preferences.ellipseWeights=saved.ellipseWeights;state.preferences.lineGuide=saved.lineGuide!==false;state.preferences.ellipseGuide=saved.ellipseGuide!==false;}}catch{}renderPreferences();}
  function savePreferences(){try{localStorage.setItem(PREF_KEY,JSON.stringify(state.preferences));}catch{$("saveState").textContent="Settings storage unavailable";}}
  function renderPreferences(){for(const kind of ["line","ellipse"]){const weights=state.preferences[kind+"Weights"],total=weights.reduce((a,b)=>a+b,0);weights.forEach((weight,i)=>{$(kind+"Weight"+i).value=String(weight);$(kind+"Percent"+i).textContent=`${Math.round(weight/total*100)}%`;});$(kind+"Guide").checked=state.preferences[kind+"Guide"];}}
  function updateWeight(kind,index,value){const weights=state.preferences[kind+"Weights"],next=clamp(Math.round(Number(value)||0),0,5);weights[index]=next;if(weights.every(n=>n===0))weights[index]=1;renderPreferences();savePreferences();}
  function exportBackup(){
    const data={app:"Sketch Pace",formatVersion:2,scoringVersion:4,exportedAt:new Date().toISOString(),circuits:state.history,focus:state.focusHistory,challenges:state.challengeHistory,lifetimeStats:state.stats,preferences:state.preferences};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),link=document.createElement("a");
    link.href=url;link.download=`sketch-pace-backup-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function validScore(n){return Number.isFinite(n)&&n>=0&&n<=100;}
  function validateBackup(data){
    const legacy=data?.app==="Sketch Pace"&&data.formatVersion===1;
    if(!data||data.app!=="Sketch Pace"||(!legacy&&(data.formatVersion!==2||data.scoringVersion!==4))||![data.circuits,data.focus,data.challenges].every(Array.isArray))throw Error("This is not a supported Sketch Pace backup.");
    if(!data.circuits.every(x=>x&&validScore(x.accuracy)&&[1,2,3].includes(x.level)&&Array.isArray(x.drills)&&x.drills.length===8&&x.drills.every(validScore)))throw Error("Circuit data is invalid.");
    if(!data.focus.every(x=>validScore(x.score)&&[1,2,3].includes(x.level)&&Number.isInteger(x.group)&&x.group>=0&&x.group<4))throw Error("Focus data is invalid.");
    if(!data.challenges.every(x=>validScore(x.score)&&[1,2,3].includes(x.level)&&Number.isInteger(x.group)&&x.group>=0&&x.group<4))throw Error("Challenge data is invalid.");
    const stats=data.lifetimeStats;if(!stats||!["circuits","focus","challenges"].every(k=>stats[k]&&typeof stats[k]==="object"&&!Array.isArray(stats[k])))throw Error("Lifetime statistics are missing.");
    for(const kind of ["circuits","focus","challenges"])for(const [key,bucket] of Object.entries(stats[kind])){
      const keyValid=kind==="circuits"?/^[1-3]$/.test(key):/^[0-3]:[1-3]$/.test(key);
      if(!keyValid||!bucket||!Number.isSafeInteger(bucket.count)||bucket.count<0||!bucket.scores||typeof bucket.scores!=="object")throw Error("Lifetime statistics are invalid.");
      let total=0;for(const [score,n] of Object.entries(bucket.scores)){if(!/^([0-9]|[1-9][0-9]|100)$/.test(score)||!Number.isSafeInteger(n)||n<0)throw Error("Lifetime statistics are invalid.");total+=n;}
      if(total!==bucket.count)throw Error("Lifetime statistics are inconsistent.");
    }
    const preferences=data.preferences&&validWeights(data.preferences.lineWeights)&&validWeights(data.preferences.ellipseWeights)?{lineWeights:data.preferences.lineWeights,ellipseWeights:data.preferences.ellipseWeights,lineGuide:data.preferences.lineGuide!==false,ellipseGuide:data.preferences.ellipseGuide!==false}:state.preferences;
    return {circuits:data.circuits.slice(-60),focus:data.focus.slice(-1200),challenges:data.challenges.slice(-150),stats,preferences,legacy};
  }
  function renderLegacyNote(){try{const stats=JSON.parse(localStorage.getItem(LEGACY_KEYS[3])||"null");const total=Object.values(stats?.circuits||{}).reduce((sum,b)=>sum+(Number.isFinite(b?.count)?b.count:0),0);$("legacyNote").hidden=total===0;if(total)$("legacyNote").textContent=`${total} earlier-scoring circuit${total===1?"":"s"} remain saved separately. Their scores are not mixed with the current, stricter box scores.`;}catch{$("legacyNote").hidden=true;}}
  async function importBackup(file){
    if(!file)return;
    try{const restored=validateBackup(JSON.parse(await file.text()));
      if(restored.legacy){if(!window.confirm("Import this older Sketch Pace backup as separate earlier-scoring history? Current scores will stay as they are."))return;const before=LEGACY_KEYS.map(key=>localStorage.getItem(key));try{[restored.circuits,restored.focus,restored.challenges,restored.stats].forEach((value,i)=>localStorage.setItem(LEGACY_KEYS[i],JSON.stringify(value)));}catch(error){LEGACY_KEYS.forEach((key,i)=>{try{if(before[i]===null)localStorage.removeItem(key);else localStorage.setItem(key,before[i]);}catch{}});throw error;}renderLegacyNote();$("saveState").textContent="Earlier history imported separately";return;}
      if(!window.confirm(`Replace this browser's Sketch Pace data with the backup? It contains ${restored.circuits.length} recent circuits, ${restored.focus.length} recent focus targets, and ${restored.challenges.length} recent challenges. Export your current data first if you want to keep it.`))return;
      const keys=[STORAGE_KEY,FOCUS_KEY,CHALLENGE_KEY,STATS_KEY,PREF_KEY],before=keys.map(key=>localStorage.getItem(key));
      try{localStorage.setItem(STORAGE_KEY,JSON.stringify(restored.circuits));localStorage.setItem(FOCUS_KEY,JSON.stringify(restored.focus));localStorage.setItem(CHALLENGE_KEY,JSON.stringify(restored.challenges));localStorage.setItem(STATS_KEY,JSON.stringify(restored.stats));localStorage.setItem(PREF_KEY,JSON.stringify(restored.preferences));}
      catch(error){keys.forEach((key,i)=>{try{if(before[i]===null)localStorage.removeItem(key);else localStorage.setItem(key,before[i]);}catch{}});throw error;}
      state.history=restored.circuits;state.focusHistory=restored.focus;state.challengeHistory=restored.challenges;state.stats=restored.stats;state.preferences=restored.preferences;renderPreferences();state.sessionActive=false;state.focusActive=false;state.challengeActive=false;state.completed=Array(tasks.length).fill(null);state.completedMetrics=Array(tasks.length).fill(null);goTo(0);$("saveState").textContent="Backup imported";
    }catch(error){$("saveState").textContent=`Import failed: ${error.message}`;}
  }
  function renderHistory(){const h=state.history,levelH=h.filter(x=>(x.level||1)===state.level),count=Object.values(state.stats.circuits).reduce((sum,b)=>sum+(b.count||0),0),best=bestStat("circuits",String(state.level));$("historyCount").textContent=`${count} session${count===1?"":"s"}`;$("lastAccuracy").textContent=levelH.length?percent(levelH.at(-1).accuracy):"—";$("bestAccuracy").textContent=best===null?"—":percent(best);$("miniHistory").innerHTML=levelH.length?levelH.slice(-12).map(x=>`<span class="bar" title="${Math.round(x.accuracy)}%" style="height:${Math.max(8,Math.round(x.accuracy*.42))}px"></span>`).join(""):'<span class="empty-history">Your recent sessions at this level will appear here.</span>';
    renderLegacyNote();
    const recent=levelH.at(-1);if(recent&&Array.isArray(recent.drills)){const grouped=groups.map(g=>Math.round(avg(recent.drills.slice(g.start,g.end+1))));const weak=grouped.indexOf(Math.min(...grouped));$("progressAdvice").textContent=`Recommended focus: ${groups[weak].name} (${grouped[weak]}% last circuit). Scores shown for ${["","Foundation","Control","Precision"][state.level]} only.`;}else{$("progressAdvice").textContent=`Complete a ${["","Foundation","Control","Precision"][state.level]} circuit to see your recommended focus.`;}
    const group=state.focusActive?state.focusGroup:groupFor(state.step),focus=state.focusHistory.filter(x=>x.group===group&&x.level===state.level),lastFive=focus.slice(-5),previousFive=focus.slice(-10,-5),delta=previousFive.length===5?Math.round(avg(lastFive.map(x=>x.score))-avg(previousFive.map(x=>x.score))):null;
    $("focusHistoryTitle").textContent=`Focus practice · ${groups[group].name.toLowerCase()}`;
    const focusCount=countStat("focus",`${group}:${state.level}`);
    $("focusHistoryStat").textContent=focus.length?`${focusCount} targets · recent ${Math.round(avg(lastFive.map(x=>x.score)))}%${delta===null?"":` · ${delta>=0?"+":""}${delta} vs previous five`}`:focusCount?`${focusCount} targets · recent details unavailable`:"No targets yet";
    $("focusMiniHistory").innerHTML=focus.length?focus.slice(-12).map(x=>`<span class="bar" title="${Math.round(x.score)}%" style="height:${Math.max(8,Math.round(x.score*.42))}px"></span>`).join(""):'<span class="empty-history">Recent focus scores will appear here.</span>';
    const challenges=state.challengeHistory.filter(x=>x.group===group&&x.level===state.level),challengeBest=bestStat("challenges",`${group}:${state.level}`);
    $("challengeHistoryTitle").textContent=`Five-target challenge · ${groups[group].name.toLowerCase()}`;
    $("challengeHistoryStat").textContent=challengeBest===null?"No challenges yet":`${countStat("challenges",`${group}:${state.level}`)} played · last ${challenges.at(-1)?.score??"—"}% · best ${challengeBest}%`;}

  canvas.addEventListener("pointerdown",onDown);canvas.addEventListener("pointermove",onMove);canvas.addEventListener("pointerup",onUp);canvas.addEventListener("pointercancel",()=>{state.drawing=false;state.current=[];draw();});
  $("startButton").addEventListener("click",startCircuit);
  $("focusButton").addEventListener("click",startFocus);
  $("challengeButton").addEventListener("click",startChallenge);
  $("exportButton").addEventListener("click",exportBackup);
  $("importButton").addEventListener("click",()=>$("importFile").click());
  $("importFile").addEventListener("change",event=>{importBackup(event.target.files?.[0]);event.target.value="";});
  $("skillSelect").addEventListener("change",event=>{if(state.sessionActive){event.target.value=String(groups[groupFor(state.step)].start);setFeedback("Circuit in progress","Finish or restart the circuit before choosing a skill.",null,null);return;}state.focusActive=false;state.challengeActive=false;state.completed=Array(tasks.length).fill(null);state.completedMetrics=Array(tasks.length).fill(null);goTo(Number(event.target.value));});
  $("milestoneButton").addEventListener("click",advanceFocus);
  $("challengeResultButton").addEventListener("click",startChallenge);
  for(const kind of ["line","ellipse"]){for(let i=0;i<3;i++)$(kind+"Weight"+i).addEventListener("input",event=>updateWeight(kind,i,event.target.value));$(kind+"Guide").addEventListener("change",event=>{state.preferences[kind+"Guide"]=event.target.checked;savePreferences();draw();});}
  $("inputMode").addEventListener("change",event=>{state.inputMode=event.target.value==="pen"?"pen":"auto";resetDrill();});
  $("levelSelect").addEventListener("change",event=>{state.level=clamp(Number(event.target.value)||1,1,3);$("levelDescription").textContent=["","Foundation · generous scoring tolerance and familiar targets.","Control · varied targets and tighter scoring tolerance.","Precision · varied targets and the tightest scoring tolerance."][state.level];state.variant++;state.sessionActive=false;state.focusActive=false;state.challengeActive=false;state.completed=Array(tasks.length).fill(null);state.completedMetrics=Array(tasks.length).fill(null);renderHistory();goTo(state.step);});
  $("resetButton").addEventListener("click",newOrResetTarget);
  $("undoButton").addEventListener("click",undo);
  $("nextButton").addEventListener("click",()=>{if(state.records.length<currentTargets().length)return;if(state.challengeActive){advanceChallenge();return;}if(state.focusActive){advanceFocus();return;}if(state.step===tasks.length-1){if(state.sessionActive)completeCircuit();else goTo(0);}else goTo(state.step+1);});
  document.querySelectorAll(".drill-row").forEach(row=>row.addEventListener("click",()=>{if(state.sessionActive){setFeedback("Circuit in progress", "Finish or restart this circuit before choosing a drill.",null,null);return;}state.focusActive=false;state.challengeActive=false;state.completed=Array(tasks.length).fill(null);state.completedMetrics=Array(tasks.length).fill(null);goTo(Number(row.dataset.go));}));
  window.addEventListener("keydown",event=>{if(event.key==="Escape"){event.preventDefault();if(state.drawing){state.drawing=false;state.current=[];draw();}else resetDrill();}if((event.key==="z"||event.key==="Z")&&!event.ctrlKey&&!event.metaKey)undo();if(event.key==="Enter"&&!$("nextButton").disabled&&document.activeElement.tagName!=="BUTTON")$("nextButton").click();});
  const observer=new ResizeObserver(resizeCanvas);observer.observe(wrap);
  setInterval(()=>{if(state.sessionActive)$("elapsedText").textContent=fmtTime((Date.now()-state.sessionStartedAt)/1000);},1000);
  loadPreferences();loadHistory();loadFocus();loadChallenges();loadStats();renderHistory();resizeCanvas();goTo(0);
})();
