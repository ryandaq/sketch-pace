const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { performance } = require('perf_hooks');

function loadApi(file) {
  const nodes = new Map();
  const ctx = { setTransform() {}, clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, setLineDash() {}, arc() {}, fill() {}, fillText() {} };
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, { hidden: true, disabled: false, style: {}, classList: { toggle() {} }, addEventListener() {}, getBoundingClientRect() { return { left: 0, top: 0, width: 900, height: 520 }; }, getContext() { return ctx; } });
    return nodes.get(id);
  }
  const sandbox = {
    document: { getElementById: node, querySelectorAll() { return []; }, activeElement: { tagName: 'DIV' } },
    window: { devicePixelRatio: 1, addEventListener() {} },
    localStorage: { getItem() { return null; }, setItem() {} },
    ResizeObserver: class { observe() {} },
    performance, setInterval() {}, Date, Math, JSON
  };
  const source = fs.readFileSync(file, 'utf8').replace(/\}\)\(\);\s*$/, 'globalThis.qa = { state, currentTargets, gradeLine, gradeEllipse, gradeProduct }; })();');
  vm.runInNewContext(source, sandbox, { filename: file });
  return sandbox.qa;
}
function densify(points, count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const position = i / (count - 1) * (points.length - 1);
    const index = Math.min(points.length - 2, Math.floor(position));
    const t = position - index;
    out.push({ x: points[index].x * (1-t) + points[index+1].x * t, y: points[index].y * (1-t) + points[index+1].y * t });
  }
  return out;
}
function median(values) { return values.sort((a,b) => a-b)[Math.floor(values.length/2)]; }
function bench(fn, iterations) {
  for (let i = 0; i < Math.min(100, iterations); i++) fn();
  const times = [];
  for (let trial = 0; trial < 5; trial++) {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) fn();
    times.push((performance.now()-start) * 1000 / iterations);
  }
  return median(times);
}

const projectRoot = path.resolve(__dirname, '..');
const base = loadApi(path.join(__dirname, 'baseline-app.js'));
const newer = loadApi(path.join(__dirname, 'previous-app-v4.js'));
for (const [name, step, gradeName, count] of [['line',0,'gradeLine',1000],['circle',3,'gradeEllipse',400],['ellipse',5,'gradeEllipse',400],['product',7,'gradeProduct',30]]) {
  if(process.argv[2]&&process.argv[2]!==name)continue;
  base.state.step = step; newer.state.step = step;
  const oldTarget = base.currentTargets()[0], newTarget = newer.currentTargets()[0];
  const original = oldTarget.points;
  const stroke = densify(original, 600).map((p,i) => ({ x:p.x+Math.sin(i*.083)*1.5, y:p.y+Math.sin(i*.061)*1.5 }));
  const oldTime = bench(() => base[gradeName](stroke, oldTarget), count);
  const newTime = bench(() => newer[gradeName](stroke, newTarget), count);
  console.log(`${name.padEnd(8)} old ${oldTime.toFixed(2)} µs  new ${newTime.toFixed(2)} µs  ratio ${(oldTime/newTime).toFixed(2)}×`);
}
