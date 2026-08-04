/* 生成 E2E 测试用 Excel 夹具（名单 / 单班成绩 / 整表成绩） */
'use strict';
const fs = require('fs');
const path = require('path');
const XLSX = require(path.join(__dirname, '../lib/xlsx.full.min.js'));
const OUT = path.join(__dirname, 'fixtures');
fs.mkdirSync(OUT, { recursive: true });

const NAMES = ['王小明', '李小红', '张伟', '刘洋', '陈静', '杨帆', '赵磊', '黄敏', '周涛', '吴倩'];
const HEADER = ['班级', '学号', '姓名', '语法选择', '完形填空', '阅读理解', '回答问题', '选词填空', '完成句子', '短文填空', '作文', '口语', '总分', '排名'];

// 1) 名单：3 个班 × 10 人
const rosterAoa = [['班级', '学号', '姓名']];
for (let c = 1; c <= 3; c++) {
  NAMES.forEach((n, i) => rosterAoa.push([c + '班', `2026${String(c).padStart(2, '0')}${String(i + 1).padStart(2, '0')}`, n]));
}
// 2) 成绩（1班单班 + 3班整表）：分数随机但固定种子
let seed = 42;
const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
const score = (lo, hi) => Math.round(lo + rnd() * (hi - lo));
function scoreRow(clsIdx, i, withCls) {
  const no = `2026${String(clsIdx).padStart(2, '0')}${String(i + 1).padStart(2, '0')}`;
  const name = NAMES[i];
  const vals = [score(6, 10), score(5, 10), score(9, 18), score(5, 10), score(5, 10), score(5, 10), score(5, 10), score(9, 15), score(5, 10)];
  return [clsIdx + '班', no, name, ...vals, '', '']; // 单班文件同样含「班级」列（与应用模板一致）
}
const class1Aoa = [HEADER, ...NAMES.map((_, i) => scoreRow(1, i, false))];
const allAoa = [HEADER];
for (let c = 1; c <= 3; c++) NAMES.forEach((_, i) => allAoa.push(scoreRow(c, i, true)));

function save(name, aoa, widths) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = (widths || []).map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  fs.writeFileSync(path.join(OUT, name), XLSX.write(wb, { type: 'buffer' }));
  console.log('生成', name);
}
save('roster.xlsx', rosterAoa, [8, 14, 12, 8]);
save('成绩1班.xlsx', class1Aoa, [12, 14, 12, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 8, 8]);
save('成绩整表.xlsx', allAoa, [8, 14, 12, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 8, 8]);
