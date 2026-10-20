(function () {
  "use strict";

  const STORAGE_KEY = "sketch-pace-history-v1";
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
    sessionStartedAt: 0,
    completed: Array(tasks.length).fill(null),
    completedMetrics: Array(tasks.length).fill(null),
    history: [],
    penSeen: false,
    size: { w: 0, h: 0 }
  };

  function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
  function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function lengthOf(points) { let sum = 0; for (let i = 1; i < points.length; i++) sum += distance(points[i - 1], points[i]); return sum; }
  function fmtTime(seconds) { const n = Math.max(0, Math.floor(seconds)); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`; }
  function percent(value) { return `${Math.round(value)}%`; }
  function currentTask() { return tasks[state.step]; }
  function currentTargets() { return getTargets(currentTask(), state.size.w, state.size.h); }
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
  function getCup(cx, cy, s) {
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
    return [{ points: body, closed: false, label: productNames[0] },{ points: rim, closed: true, label: productNames[1] },{ points: handle, closed: false, label: productNames[2] }];
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
      return [{points:sampleEllipse(.5*w,.52*h,task.rx*unit,task.ry*unit,task.angle),closed:true,label:"ellipse",center:{x:.5*w,y:.52*h},rx:task.rx*unit,ry:task.ry*unit,angle:task.angle}];
    }
    if (task.type === "box") {
      const A={x:.5*w,y:.33*h}, B={x:.5*w,y:.70*h}, vl={x:-.58*w,y:.23*h},vr={x:1.58*w,y:.23*h};
      const mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
      const LT=mix(A,vl,.25), LB=mix(B,vl,.25), RT=mix(A,vr,.25), RB=mix(B,vr,.25);
      const C=lineIntersection(LT,vr,RT,vl);
      return [[A,B],[A,LT],[LT,LB],[B,LB],[A,RT],[RT,RB],[B,RB],[LT,C],[RT,C]].map((pair,i)=>({points:sampleLine(pair[0],pair[1]),closed:false,label:`edge ${i+1}`}));
    }
    const horizontal = w >= 590;
    const s = horizontal ? Math.min(h*.43,w*.19) : Math.min(h*.26,w*.28);
    const cx = horizontal ? .70*w : .50*w, cy = horizontal ? .43*h : .67*h;
    return getCup(cx,cy,s);
  }
  function getReferenceCup(w,h) {
    const horizontal = w >= 590;
    const s = horizontal ? Math.min(h*.43,w*.19) : Math.min(h*.26,w*.28);
    return getCup(horizontal ? .25*w : .50*w, horizontal ? .43*h : .22*h, s);
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

  function pointToSegment(p,a,b) {
    const dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy;
    const t=den?clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/den,0,1):0;
    return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy));
  }
  function nearestToPolyline(p, points) { let best=Infinity; for(let i=1;i<points.length;i++) best=Math.min(best,pointToSegment(p,points[i-1],points[i])); return best; }
  function spaced(points,max=160) { const stride=Math.max(1,Math.ceil(points.length/max)); const out=points.filter((_,i)=>i%stride===0); if(out.at(-1)!==points.at(-1))out.push(points.at(-1)); return out; }
  function avg(values) { return values.reduce((a,b)=>a+b,0)/Math.max(1,values.length); }
  function qualityWord(score) { return score>=88?"Excellent control":score>=72?"Good control":score>=55?"Getting there":"Keep practicing"; }
  function gradeLine(user,target) {
    const a=target.points[0],b=target.points.at(-1),len=distance(a,b);
    const forward=distance(user[0],a)+distance(user.at(-1),b);
    const reverse=distance(user[0],b)+distance(user.at(-1),a);
    const dotErrors=forward<=reverse?[distance(user[0],a),distance(user.at(-1),b)]:[distance(user.at(-1),a),distance(user[0],b)];
    const chord=Math.max(1,distance(user[0],user.at(-1)));
    const deviation=avg(spaced(user).map(p=>pointToSegment(p,user[0],user.at(-1))));
    const extra=Math.max(0,lengthOf(user)/chord-1);
    const dotScores=dotErrors.map(error=>clamp(100-100*error/(len*.10),0,100));
    const endpoints=avg(dotScores);
    const straightness=clamp(100-100*deviation/(chord*.05)-80*extra,0,100);
    const score=.5*endpoints+.5*straightness;
    return {score,metrics:[endpoints,straightness],dotScores,detail:endpoints<straightness-8?"Bring both ends closer to their target dots.":straightness<endpoints-8?"Keep the stroke straighter between its ends.":"The endpoints and path are well controlled."};
  }
  function gradeEllipse(user,target) {
    const {center,rx,ry,angle}=target,ca=Math.cos(angle),sa=Math.sin(angle),minR=Math.min(rx,ry);
    const samples=spaced(user),radial=samples.map(p=>{const dx=p.x-center.x,dy=p.y-center.y,x=dx*ca+dy*sa,y=-dx*sa+dy*ca;return Math.abs(Math.hypot(x/rx,y/ry)-1);});
    const bins=new Set(samples.map(p=>{const dx=p.x-center.x,dy=p.y-center.y,x=dx*ca+dy*sa,y=-dx*sa+dy*ca;return Math.floor(((Math.atan2(y/ry,x/rx)+Math.PI)/(2*Math.PI))*24)%24;}));
    const coverage=bins.size/24,closure=distance(user[0],user.at(-1)),ideal=Math.PI*(3*(rx+ry)-Math.sqrt((3*rx+ry)*(rx+3*ry))),extra=Math.max(0,lengthOf(user)/ideal-1.25);
    const dotScores=ellipseAxisDots(target).map(dot=>clamp(100-100*nearestToPolyline(dot,user)/(minR*.35),0,100));
    const axes=avg(dotScores);
    const smoothness=clamp(100-220*avg(radial)-65*(1-coverage)-35*closure/minR-90*extra,0,100);
    const score=.5*axes+.5*smoothness;
    return {score,metrics:[axes,smoothness],dotScores,detail:coverage<.78?"Complete more of the loop.":axes<smoothness-8?"Bring the curve closer to all four axis dots.":smoothness<axes-8?"Smooth the curve and close the loop cleanly.":"The curve reaches the dots and follows the ideal ellipse closely."};
  }
  function gradeProduct(user,target) {
    const u=spaced(user,130),t=spaced(target.points,130),scale=Math.min(state.size.w,state.size.h);
    const forward=avg(u.map(p=>nearestToPolyline(p,target.points)));
    const reverse=avg(t.map(p=>nearestToPolyline(p,user)));
    const endpoint=target.closed?distance(user[0],user.at(-1)):
      Math.min(distance(user[0],target.points[0])+distance(user.at(-1),target.points.at(-1)),distance(user[0],target.points.at(-1))+distance(user.at(-1),target.points[0]))/2;
    const contour=clamp(100-(forward*.58+reverse*.42)*450/scale,0,100);
    const ends=clamp(100-100*endpoint/(scale*.22),0,100);
    const score=.85*contour+.15*ends;
    return {score,metrics:[contour,ends],detail:score>=85?"Shape and placement are close to the reference.":"Compare the largest proportions and placement with the reference."};
  }
  function grade(user,target) { const type=currentTask().type; return type==="line"||type==="box"?gradeLine(user,target):type==="ellipse"?gradeEllipse(user,target):gradeProduct(user,target); }

  function resizeCanvas() {
    const rect=wrap.getBoundingClientRect(),w=rect.width,h=rect.height,dpr=Math.min(window.devicePixelRatio||1,3);
    if(Math.abs(w-state.size.w)<1&&Math.abs(h-state.size.h)<1)return;
    const hadMarks=state.records.length>0;
    state.size={w,h}; canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
    if(hadMarks){state.records=[];state.completed[state.step]=null;state.completedMetrics[state.step]=null;setFeedback("Canvas resized", "This drill restarted so its targets stay aligned.",null,null);updateControls();}
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
      if(task.type==="line"){const a=target.points[0],b=target.points.at(-1);drawPath(target.points,"#a9bba4",2,[6,7]);dot(a);dot(b);drawLabel("A",a.x+10,a.y-8);drawLabel("B",b.x+10,b.y-8);}
      if(task.type==="ellipse"){
        const dots=ellipseAxisDots(target);
        drawPath([dots[0],dots[1]],"#d6ded2",1,[3,6]);
        drawPath([dots[2],dots[3]],"#d6ded2",1,[3,6]);
        if(state.records.length)drawPath(target.points,"#b7c6b0",1.5,[5,6]);
        dots.forEach((p,i)=>{openDot(p);drawLabel("ABCD"[i],p.x+10,p.y-8);});
      }
    }
    state.records.forEach(record=>drawPath(record.points,"#36533c",2.5));
    if(state.current.length)drawPath(state.current,"#df7651",2.6);
  }
  function pointerPoint(event){const r=canvas.getBoundingClientRect();return {x:event.clientX-r.left,y:event.clientY-r.top};}
  function onDown(event){
    if(event.pointerType==="pen")state.penSeen=true;
    if(state.penSeen&&event.pointerType==="touch")return;
    if(state.drawing||state.records.length>=currentTargets().length||!overlay.hidden)return;
    event.preventDefault();canvas.setPointerCapture(event.pointerId);state.pointerId=event.pointerId;state.drawing=true;state.downAt=performance.now();state.current=[pointerPoint(event)];draw();
  }
  function onMove(event){if(!state.drawing||event.pointerId!==state.pointerId)return;event.preventDefault();state.current.push(pointerPoint(event));draw();}
  function onUp(event){
    if(!state.drawing||event.pointerId!==state.pointerId)return;
    event.preventDefault();state.current.push(pointerPoint(event));state.drawing=false;state.pointerId=null;
    const points=state.current;state.current=[];
    if(lengthOf(points)<16){setFeedback("Stroke too short", "Draw the full target in one stroke.",null,null);draw();return;}
    const target=currentTargets()[state.records.length],result=grade(points,target),duration=(performance.now()-state.downAt)/1000;
    state.records.push({points,score:result.score,metrics:result.metrics,dotScores:result.dotScores,duration});
    const done=state.records.length===currentTargets().length;
    const shownMetrics=done?[0,1].map(i=>avg(state.records.map(r=>r.metrics[i]))):result.metrics;
    if(done){state.completed[state.step]=Math.round(avg(state.records.map(r=>r.score)));state.completedMetrics[state.step]=shownMetrics.map(Math.round);}
    setFeedback(done?qualityWord(state.completed[state.step]):`Good. Next: ${nextStrokeName()}`,result.detail,done?state.completed[state.step]:Math.round(result.score),duration,shownMetrics,result.dotScores);
    updateControls();draw();
  }
  function nextStrokeName(){const task=currentTask();if(task.type==="box")return `edge ${state.records.length+1}`;if(task.type==="product")return productNames[state.records.length];return "the target";}
  function metricMeta(){
    const type=currentTask().type;
    if(type==="ellipse")return {labels:["Axis dots","Curve smoothness"],formula:"Accuracy = 50% axis dots + 50% curve smoothness"};
    if(type==="product")return {labels:["Contour match","Feature ends"],formula:"Accuracy = 85% contour match + 15% feature ends"};
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
    $("nextButton").disabled=!done;
    $("nextButton").innerHTML=state.step===tasks.length-1?(state.sessionActive?"Finish circuit <span aria-hidden=\"true\">→</span>":"Practice again <span aria-hidden=\"true\">→</span>"):"Next drill <span aria-hidden=\"true\">→</span>";
    $("drillProgressLabel").textContent=done?`${targetCount} of ${targetCount} strokes complete`:`Stroke ${state.records.length+1} of ${targetCount}`;
    $("canvasPrompt").textContent=done?"Drill complete":currentTask().type==="product"?`Copy the ${productNames[state.records.length]}`:currentTask().type==="box"?`Draw edge ${state.records.length+1} of ${targetCount}`:"Draw one stroke";
    const completed=state.completed.filter(x=>x!==null).length;
    $("progressText").textContent=`${completed} of ${tasks.length} drills`;
    $("sessionProgressFill").style.width=`${completed/tasks.length*100}%`;
    $("sessionStatus").textContent=state.sessionActive?"In progress":completed===tasks.length?"Complete":"Ready";
    $("startButton").innerHTML=state.sessionActive?"Restart circuit <span aria-hidden=\"true\">↗</span>":"Start circuit <span aria-hidden=\"true\">↗</span>";
  }
  function goTo(index){
    state.step=index;state.records=[];state.current=[];state.drawing=false;state.pointerId=null;overlay.hidden=true;
    const task=currentTask();$("drillCategory").textContent=task.category;$("drillTitle").textContent=task.title;$("drillDescription").textContent=task.description;$("stepNumber").textContent=String(index+1).padStart(2,"0");
    document.querySelectorAll(".drill-row").forEach(row=>row.classList.toggle("active",Number(row.dataset.go)===([0,0,0,3,3,3,6,7][index])));
    setFeedback("Ready when you are.",task.type==="product"?"Copy each feature from the reference. Start and end dots guide the open contours.":"Take your time. You can retry before moving on.",null,null);
    updateControls();draw();
  }
  function resetDrill(){state.records=[];state.current=[];state.drawing=false;state.completed[state.step]=null;state.completedMetrics[state.step]=null;overlay.hidden=true;setFeedback("Ready for another attempt.","Draw the target again. Accuracy and time will be measured separately.",null,null);updateControls();draw();}
  function undo(){if(state.drawing){state.drawing=false;state.current=[];}else if(state.records.length){state.records.pop();state.completed[state.step]=null;state.completedMetrics[state.step]=null;}else return;overlay.hidden=true;setFeedback("Last stroke removed.","Try that mark again.",null,null);updateControls();draw();}
  function startCircuit(){state.sessionActive=true;state.sessionStartedAt=Date.now();state.completed=Array(tasks.length).fill(null);state.completedMetrics=Array(tasks.length).fill(null);$("elapsedText").textContent="0:00";goTo(0);updateControls();}
  function completeCircuit(){
    const scores=state.completed.filter(x=>x!==null),overall=Math.round(avg(scores)),elapsed=Math.round((Date.now()-state.sessionStartedAt)/1000);
    const entry={date:new Date().toISOString(),accuracy:overall,seconds:elapsed,drills:scores,components:state.completedMetrics};state.history.push(entry);state.history=state.history.slice(-60);saveHistory();renderHistory();
    state.sessionActive=false;updateControls();
    overlay.hidden=false;overlay.innerHTML=`<div class="result-kicker">CIRCUIT COMPLETE</div><h3>Nice work today.</h3><div class="result-score">${overall}<span>%</span></div><p>Average accuracy across ${tasks.length} drills · ${fmtTime(elapsed)} elapsed. Your session was saved on this device.</p><button class="button button-dark" id="againButton" type="button">Start another circuit <span aria-hidden="true">↗</span></button>`;
    $("againButton").addEventListener("click",startCircuit);
  }
  function loadHistory(){try{const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]");state.history=Array.isArray(parsed)?parsed.filter(x=>Number.isFinite(x.accuracy)):[];}catch{state.history=[];$("saveState").textContent="Session storage unavailable";}}
  function saveHistory(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state.history));$("saveState").textContent="Saved on this device";}catch{$("saveState").textContent="Session storage unavailable";}}
  function renderHistory(){const h=state.history;$("historyCount").textContent=`${h.length} session${h.length===1?"":"s"}`;$("lastAccuracy").textContent=h.length?percent(h.at(-1).accuracy):"—";$("bestAccuracy").textContent=h.length?percent(Math.max(...h.map(x=>x.accuracy))):"—";$("miniHistory").innerHTML=h.length?h.slice(-12).map(x=>`<span class="bar" title="${Math.round(x.accuracy)}%" style="height:${Math.max(8,Math.round(x.accuracy*.42))}px"></span>`).join(""):'<span class="empty-history">Your recent sessions will appear here.</span>';}

  canvas.addEventListener("pointerdown",onDown);canvas.addEventListener("pointermove",onMove);canvas.addEventListener("pointerup",onUp);canvas.addEventListener("pointercancel",()=>{state.drawing=false;state.current=[];draw();});
  $("startButton").addEventListener("click",startCircuit);
  $("resetButton").addEventListener("click",resetDrill);
  $("undoButton").addEventListener("click",undo);
  $("nextButton").addEventListener("click",()=>{if(state.records.length<currentTargets().length)return;if(state.step===tasks.length-1){if(state.sessionActive)completeCircuit();else goTo(0);}else goTo(state.step+1);});
  document.querySelectorAll(".drill-row").forEach(row=>row.addEventListener("click",()=>{if(state.sessionActive){setFeedback("Circuit in progress", "Finish or restart this circuit before choosing a drill.",null,null);return;}state.completed=Array(tasks.length).fill(null);state.completedMetrics=Array(tasks.length).fill(null);goTo(Number(row.dataset.go));}));
  window.addEventListener("keydown",event=>{if(event.key==="Escape"){event.preventDefault();if(state.drawing){state.drawing=false;state.current=[];draw();}else resetDrill();}if((event.key==="z"||event.key==="Z")&&!event.ctrlKey&&!event.metaKey)undo();if(event.key==="Enter"&&!$("nextButton").disabled&&document.activeElement.tagName!=="BUTTON")$("nextButton").click();});
  const observer=new ResizeObserver(resizeCanvas);observer.observe(wrap);
  setInterval(()=>{if(state.sessionActive)$("elapsedText").textContent=fmtTime((Date.now()-state.sessionStartedAt)/1000);},1000);
  loadHistory();renderHistory();resizeCanvas();goTo(0);
})();
