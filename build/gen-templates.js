#!/usr/bin/env node
/* 生成内置 Excel 模板文件 → templates/ */
'use strict';
const fs = require('fs');
const path = require('path');
const XLSX = require(path.join(__dirname, '../lib/xlsx.full.min.js'));

const TPL_DIR = path.join(__dirname, '../templates');
fs.mkdirSync(TPL_DIR, { recursive: true });

const HEADER = ['班级', '学号', '姓名', '语法选择', '完形填空', '阅读理解', '回答问题', '选词填空', '完成句子', '短文填空', '作文', '口语', '总分', '排名'];

// 成绩导入模板
{
  const s1 = [HEADER,
    ['1班', '20260101', '示例学生一', 8, 9, 12, 8, 9, 8, 9, 13, 9, 85, 1],
    ['1班', '20260102', '示例学生二', 7, 8, 10, 7, 8, 7, 8, 12, 8, '', '']];
  const s2 = [['成绩导入模板使用说明'],
    ['1. 表头固定为：' + HEADER.join('、')],
    ['2. 「总分」「排名」可以留空，导入后系统会自动计算'],
    ['3. 导入时会按「学号」自动匹配班级学生档案，未匹配的学生也会保留但标记'],
    ['4. 一个文件可以包含多个班的成绩（按「班级」列自动分发），也可以每班一个文件'],
    ['5. 也可以不导入，直接在平台的「查看/编辑」页面手工录入']];
  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.aoa_to_sheet(s1);
  ws1['!cols'] = [8, 14, 14, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 8, 8].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws1, '成绩模板');
  const ws2 = XLSX.utils.aoa_to_sheet(s2);
  ws2['!cols'] = [{ wch: 95 }];
  XLSX.utils.book_append_sheet(wb, ws2, '使用说明');
  fs.writeFileSync(path.join(TPL_DIR, '成绩导入模板.xlsx'), XLSX.write(wb, { type: 'buffer' }));
}

// 学生名单导入模板
{
  const aoa = [['班级', '学号', '姓名'], ['1班', '20260101', '示例学生一']];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [8, 14, 14].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, '名单');
  fs.writeFileSync(path.join(TPL_DIR, '学生名单导入模板.xlsx'), XLSX.write(wb, { type: 'buffer' }));
}

// 全年级学生导入模板（班级 / 学号 / 姓名）
{
  const s1 = [['班级', '学号', '姓名'],
    ['1班', '20260101', '示例学生一'],
    ['2班', '20260201', '示例学生二'],
    ['15班', '20261501', '示例学生十五']];
  const s2 = [['全年级学生导入模板使用说明'],
    ['1. 表头固定为：班级 / 学号 / 姓名'],
    ['2. 「班级」列填写 1-15 班（支持：1班、01班、一班、1 等写法），系统按班级自动分发'],
    ['3. 同一个学号重复导入会自动更新姓名，不重复的自动新增'],
    ['4. 班级列无法识别或缺少姓名的行会被跳过并在导入结果中提示']];
  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.aoa_to_sheet(s1);
  ws1['!cols'] = [8, 14, 14].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws1, '全年级名单');
  const ws2 = XLSX.utils.aoa_to_sheet(s2);
  ws2['!cols'] = [{ wch: 80 }];
  XLSX.utils.book_append_sheet(wb, ws2, '使用说明');
  fs.writeFileSync(path.join(TPL_DIR, '全年级学生导入模板.xlsx'), XLSX.write(wb, { type: 'buffer' }));
}

console.log('✅ 模板已生成到 templates/');
