/* 纯逻辑测试：在 Node 中加载各模块（stub DOM/localStorage），验证核心算法 */
'use strict';
const path = require('path');
const ROOT = '/opt/data/english-workbench/eng-platform';

// ---- 最小 DOM / localStorage stub ----
const noopEl = {
  style: {}, dataset: {}, hidden: false, classList: { toggle(){}, add(){}, remove(){} },
  remove(){}, appendChild(){}, setAttribute(){}, addEventListener(){}, removeEventListener(){},
  querySelector: () => null, querySelectorAll: () => [], closest: () => null,
  textContent: '', innerHTML: '', value: ''
};
global.document = {
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: () => noopEl,
  body: { appendChild(){} },
  addEventListener(){}
};
const lsm = new Map();
global.localStorage = {
  getItem: k => (lsm.has(k) ? lsm.get(k) : null),
  setItem: (k, v) => lsm.set(k, String(v)),
  removeItem: k => lsm.delete(k),
  key: () => null,
  get length() { return lsm.size; }
};
global.XLSX = require(path.join(ROOT, 'lib/xlsx.full.min.js'));
global.Chart = undefined;

require(path.join(ROOT, 'js/utils.js'));
require(path.join(ROOT, 'js/store.js'));
require(path.join(ROOT, 'js/students.js'));
require(path.join(ROOT, 'js/grades.js'));
const App = global.EJWP;

let pass = 0, fail = 0;
function eq(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log('  ✅', name); }
  else { fail++; console.log('  ❌', name, '\n     got :', g, '\n     want:', w); }
}

console.log('== 统计函数 ==');
eq('statsOf 中位数/分差', (() => { const s = App.statsOf([3, 5, 5, 8, 9]); return [s.avg, s.max, s.min, s.range, s.median]; })(), [6, 9, 3, 6, 5]);
eq('statsOf 偶数个数', App.statsOf([70, 80]).median, 75);
eq('statsOf 空数组', App.statsOf([]).count, 0);
eq('满分合计(默认120分制)', App.fullTotal(App.DEFAULT_FULL), 120);
eq('周范围', App.weekRange('2026-09-07', 2).monday, '2026-09-14');

console.log('== 成绩解析 parseScoreRows ==');
const rosterArr = [{ id: 's1', no: '20260001', name: '张三' }, { id: 's2', no: '20260002', name: '李四' }];
const roster = { id: '1', name: '1班', students: rosterArr };
const rows = [
  ['班级', '学号', '姓名', '语法选择', '完形填空', '阅读理解', '回答问题', '选词填空', '完成句子', '短文填空', '作文', '口语', '总分', '排名'],
  ['1班', '20260001', '张三', 8, 9, 12, 8, 9, 8, 9, 13, 9, 85, 1],
  ['1班', '20260002', '李四', 7, 8, 10, 7, 8, 7, 8, 12, 8, '', ''],
  ['1班', '20260099', '转学生', 5, 5, 5, 5, 5, 5, 5, 5, 5, 45, 3]
];
const parsed = App.Grades.parseScoreRows(rows, roster, '1', App.DEFAULT_FULL);
eq('解析行数', parsed.total, 3);
eq('匹配数', parsed.matched, 2);
eq('未匹配数', parsed.unmatched.length, 1);
eq('张三总分', parsed.records[0].total, 85);
eq('张三匹配', parsed.records[0].studentId, 's1');
eq('李四总分自动计算', parsed.records[1].total, 75);
eq('李四排名留空', parsed.records[1].rank, null);
eq('未匹配保留', parsed.records[2].studentId, null);
// 乱序表头测试
const rows2 = [
  ['姓名', '口语', '学号', '作文', '总分'],
  ['王五', 9, '20260003', 14, 88]
];
const p2 = App.Grades.parseScoreRows(rows2, { id: '1', name: '1班', students: [{ id: 's3', no: '20260003', name: '王五' }] }, '1', App.DEFAULT_FULL);
eq('乱序表头姓名', p2.records[0].name, '王五');
eq('乱序表头口语', p2.records[0].speaking, 9);
eq('乱序表头总分', p2.records[0].total, 88);

console.log('== 班级统计 computeClassStats ==');
const recs = parsed.records;
// 用显式 100 分制结构验证统计口径（与默认 120 分制无关）
const fm100 = { grammar: 10, cloze: 10, reading: 15, answering: 10, wordFill: 10, sentence: 10, passage: 10, writing: 15, speaking: 10 };
const cs = App.Grades.computeClassStats(recs, fm100, { pass: 60, good: 85, low: 40 });
eq('总分平均', cs.total.avg, 68.33333333333333);
eq('总分最高', cs.total.max, 85);
eq('总分最低', cs.total.min, 45);
eq('总分分差', cs.total.range, 40);
eq('总分中位数', cs.total.median, 75);
eq('优秀率(85分1人)', cs.total.goodRate, 1 / 3);
eq('及格率(85,75,45→2人)', cs.total.passRate, 2 / 3);
eq('低分率(<40→0)', cs.total.lowRate, 0);
eq('语法选择得分率', cs.grammar.rate, (8 + 7 + 5) / 3 / 10);

console.log('== 排名 ensureRanks（并列同名次） ==');
const tr = [
  { studentId: 'a', no: '1', name: 'A', total: 85, rank: null },
  { studentId: 'b', no: '2', name: 'B', total: 85, rank: null },
  { studentId: 'c', no: '3', name: 'C', total: 80, rank: null },
  { studentId: 'd', no: '4', name: 'D', total: 70, rank: null },
  { studentId: 'e', no: '5', name: 'E', total: null, rank: null }
];
App.Grades.ensureRanks({ scores: { '1': tr } }, '1');
eq('并列第1', [tr[0].rank, tr[1].rank], [1, 1]);
eq('第三名', tr[2].rank, 3);
eq('第四名', tr[3].rank, 4);
eq('缺分不排名', tr[4].rank, null);

console.log('== Excel 模板往返 ==');
const wb = App.makeWorkbook([{ name: '成绩模板', aoa: rows, widths: [8] }]);
const fs = require('fs');
const tmp = path.join(ROOT, 'test/tmp-test.xlsx');
fs.writeFileSync(tmp, XLSX.write(wb, { type: 'buffer' }));
const wb2 = XLSX.read(fs.readFileSync(tmp), { type: 'buffer' });
const rowsBack = App.workbookToRows(wb2);
const p3 = App.Grades.parseScoreRows(rowsBack, roster, '1', App.DEFAULT_FULL);
eq('往返解析行数', p3.total, 3);
eq('往返总分', p3.records[1].total, 75);

console.log('== 全年级名单解析 parseAllRoster ==');
const allRows = [
  ['班级', '学号', '姓名'],
  ['1班', '20260101', '甲一'], ['1班', '20260102', '甲二'],
  ['二班', '20260201', '乙一'],
  ['15班', '20261501', '癸一'],
  ['3', '20260301', '丙一'],
  ['20班', '20269901', '超范围'],   // 班级超出 1-15 → 跳过
  ['16班', '20269902', '超范围二'],  // 同上
  ['1班', '', '缺学号'],            // 无学号但有姓名 → 保留（匹配按姓名或新增）
  ['', '20269903', ''],            // 有学号无姓名 → 跳过
  ['2班', '20260202', '']          // 缺姓名 → 跳过
];
const ar = App.Students.parseAllRoster(allRows);
eq('全年级总人数(有效6行)', ar.total, 6);
eq('1班人数', (ar.groups['1'] || []).length, 3);
eq('二班→2班', (ar.groups['2'] || []).length, 1);
eq('15班人数', (ar.groups['15'] || []).length, 1);
eq('数字班级3', (ar.groups['3'] || []).length, 1);
eq('跳过数(超范围2+缺姓名2)', ar.skipped.length, 4);
eq('跳过原因含超范围', ar.skipped.some(s => s.no === '20269901'), true);
eq('缺姓名跳过', ar.skipped.some(s => s.no === '20260202' && s.why.includes('姓名')), true);
eq('表头识别', ar.header, '班级 / 学号 / 姓名');
// 错误用例
eq('无表头报错', App.Students.parseAllRoster([['a', 'b'], ['c', 'd']]).error ? true : false, true);
eq('全部无法识别报错', App.Students.parseAllRoster([['班级', '学号', '姓名'], ['9班', 'x', '']]).error ? true : false, true);
// applyAllRoster 分发到班级
App.DB.load();
const applyR = App.Students.applyAllRoster(ar.groups);
eq('分发新增数', applyR.addN, 6);
eq('1班现有学生', App.DB.getClass('1').students.length, 3);
eq('2班现有学生', App.DB.getClass('2').students.length, 1);
eq('再次导入不重复(同名同学号更新)', App.Students.applyAllRoster(ar.groups).addN, 0);

console.log('== 分位数 / 箱线图 ==');
eq('quantile 中位', App.quantile([1, 2, 3, 4, 5], .5), 3);
eq('quantile Q1 线性插值', App.quantile([1, 2, 3, 4], .25), 1.75);
eq('quantile 单元素', App.quantile([7], .5), 7);
eq('boxplot 基础', (() => { const b = App.boxplotData([60, 70, 75, 80, 85, 90, 100]); return [b.median, b.q1, b.q3, b.min, b.max]; })(), [80, 72.5, 87.5, 60, 100]);
eq('boxplot 离群点', (() => { const b = App.boxplotData([10, 60, 70, 75, 80, 85, 90, 100]); return [b.outliers.length, b.min]; })(), [1, 60]);

console.log('== 试卷质量分析（难度 / 区分度） ==');
const qRecs = [10, 9, 8, 8, 7, 7, 6, 6, 5, 5, 4, 4, 3, 3, 2, 2, 1, 1].map((v, i) => ({
  studentId: 'q' + i, no: 'Q' + i, name: 'S' + i,
  grammar: v, cloze: v, reading: v * 2, answering: v, wordFill: v, sentence: v, passage: v, writing: v, speaking: v,
  total: v * 10, rank: i + 1
}));
const qa = App.Grades.computeItemQuality(qRecs, App.DEFAULT_FULL);
eq('质量分析行数(9题+总分)', qa.rows.length, 10);
eq('高分组人数(27%)', qa.highN, Math.max(1, Math.round(18 * 0.27)));
eq('语法难度(均值/满分)', qa.rows[0].difficulty, (91 / 18) / 10);
eq('区分度范围', qa.rows[0].discrimination >= 0 && qa.rows[0].discrimination <= 1, true);
eq('诊断文案含分隔', qa.rows[0].advice.includes('·'), true);
eq('人数不足报错', App.Grades.computeItemQuality([qRecs[0]], App.DEFAULT_FULL).error ? true : false, true);
// 高分组均值应高于低分组
const highAvg = qRecs.slice(0, qa.highN).reduce((s, r) => s + r.total, 0) / qa.highN;
const lowAvg = qRecs.slice(-qa.lowN).reduce((s, r) => s + r.total, 0) / qa.lowN;
eq('高分>低分', highAvg > lowAvg, true);

console.log('== 数据备份/恢复 ==');
App.DB.load();
App.DB.state.exams.push({ id: 'ex1', name: '期中考试', date: '2026-11-10', type: '期中考试', fullMarks: { ...App.DEFAULT_FULL }, classIds: ['1', '2'], scores: { '1': recs } });
const json = App.DB.exportJSON();
App.DB.importJSON(json, 'replace');
eq('恢复后考试数', App.DB.state.exams.length, 1);
eq('恢复后学生数', App.DB.state.classes.length, 15);
eq('恢复后成绩', App.DB.state.exams[0].scores['1'].length, 3);
// 合并模式
const json2 = JSON.stringify({ version: 1, settings: {}, plans: [], classes: [], exams: [{ id: 'ex2', name: '月考', date: '2026-12-01', type: '月考', fullMarks: {}, classIds: ['3'], scores: {} }], materials: [] });
App.DB.importJSON(json2, 'merge');
eq('合并后考试数', App.DB.state.exams.length, 2);
eq('合并不覆盖原考试', App.DB.state.exams[0].id, 'ex1');

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
