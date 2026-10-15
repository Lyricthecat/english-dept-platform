/* 用用户真实数据复现 compareData，定位「对比没有数据」的原因 */
'use strict';
const path = require('path');
const fs = require('fs');
const ROOT = '/opt/data/english-dept-platform';

const noopEl = {
  style: {}, dataset: {}, hidden: false, classList: { toggle(){}, add(){}, remove(){} },
  remove(){}, appendChild(){}, setAttribute(){}, addEventListener(){}, removeEventListener(){},
  querySelector: () => null, querySelectorAll: () => [], closest: () => null,
  textContent: '', innerHTML: '', value: ''
};
global.document = { querySelector: () => null, querySelectorAll: () => [], createElement: () => noopEl, body: { appendChild(){} }, addEventListener(){} };
const lsm = new Map();
global.localStorage = { getItem: k => (lsm.has(k) ? lsm.get(k) : null), setItem: (k, v) => lsm.set(k, String(v)), removeItem: k => lsm.delete(k), key: () => null, get length(){ return lsm.size; } };
global.XLSX = require(path.join(ROOT, 'lib/xlsx.full.min.js'));
if (XLSX.set_fs) XLSX.set_fs(require('fs'));   // Node 下才需要，浏览器不用
global.Chart = undefined;
require(path.join(ROOT, 'js/utils.js'));
require(path.join(ROOT, 'js/store.js'));
require(path.join(ROOT, 'js/students.js'));
require(path.join(ROOT, 'js/grades.js'));
const App = global.EJWP;

const raw = JSON.parse(fs.readFileSync(process.argv[2], 'utf-8'));
lsm.set('ejwp:v1', JSON.stringify(raw));
App.DB.load();

const exs = App.DB.state.exams;
console.log('考试数:', exs.length);
exs.forEach(e => console.log(' -', e.id, e.name, e.date, 'classIds', e.classIds.length));
const sorted = [...exs].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
const A = sorted[0], B = sorted[1];
console.log('\nA(本次) =', A && A.name, '| B(对比) =', B && B.name);

// 逐班看原始记录数 / 缺考数
[A, B].forEach(ex => {
  if (!ex) return;
  let tot = 0, absent = 0, noTotal = 0;
  ex.classIds.forEach(cid => ((ex.scores || {})[cid] || []).forEach(r => {
    tot++; if (App.isAbsent(r)) absent++; if (App.num(r.total) == null) noTotal++;
  }));
  console.log(`  ${ex.name}: 记录 ${tot} · isAbsent ${absent} · 无总分 ${noTotal}`);
});

const data = App.Grades.compareData(A, B);
console.log('\ncompareData → 班级数:', data.classes.length, '总行数:', data.rows.length);
console.log('各班行数:', data.classes.map(c => c.name + ':' + c.rows.length).join(' '));
console.log('全年级 stat:', JSON.stringify(data.stat));
const c1 = data.classes[0];
if (c1) console.log('第一班前 3 行:', JSON.stringify(c1.rows.slice(0, 3), null, 1));

// 真实导出一次 Excel 到磁盘，便于用第三方工具校验
process.chdir(ROOT);
App.Grades.cmpA = A.id; App.Grades.cmpB = B.id;
App.Grades.exportCompare();
console.log('导出完成，目录：' + ROOT);
