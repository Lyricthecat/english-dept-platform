#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""第三方校验：直接解开 xlsx 的 XML（不经 SheetJS），核对工作表名/内容/数字格式。"""
import re, sys, zipfile
from xml.etree import ElementTree as ET

p = sys.argv[1]
z = zipfile.ZipFile(p)
NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'

wb = ET.fromstring(z.read('xl/workbook.xml'))
sheets = [(s.get('name'), s.get('sheetId'), s.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')) for s in wb.iter(NS + 'sheet')]
print('工作表 %d 个：' % len(sheets), [s[0] for s in sheets])

sst = []
if 'xl/sharedStrings.xml' in z.namelist():
    for si in ET.fromstring(z.read('xl/sharedStrings.xml')).iter(NS + 'si'):
        sst.append(''.join(t.text or '' for t in si.iter(NS + 't')))
print('共享字符串：%d 条' % len(sst))

st = ET.fromstring(z.read('xl/styles.xml'))
fmts = {}
for nf in st.iter(NS + 'numFmt'):
    fmts[nf.get('numFmtId')] = nf.get('formatCode')
print('自定义数字格式：')
for k, v in fmts.items():
    print('   numFmtId=%s  %s' % (k, v))

cxfs = st.find(NS + 'cellXfs')
if cxfs is None:
    cxfs = st.find(NS + 'cellStyleXfs')
xfs = [x.get('numFmtId') for x in cxfs]   # 只取 cellXfs，别把 cellStyleXfs 也算进来


def colnum(ref):
    m = re.match(r'([A-Z]+)', ref)
    n = 0
    for ch in m.group(1):
        n = n * 26 + (ord(ch) - 64)
    return n - 1


def dump(idx, label, rows=3):
    name = sheets[idx][0]
    xml = ET.fromstring(z.read('xl/worksheets/sheet%d.xml' % (idx + 1)))
    out = []
    for r in xml.iter(NS + 'row'):
        cells = {}
        for c in r.iter(NS + 'c'):
            v = c.find(NS + 'v')
            t = c.get('t')
            val = None
            if v is not None:
                val = sst[int(v.text)] if t == 's' else v.text
            cells[colnum(c.get('r'))] = (val, c.get('s'))
        out.append(cells)
    print('\n[%s] 共 %d 行；前 %d 行：' % (label, len(out), rows))
    for cells in out[:rows]:
        line = []
        for c in range(0, 22):
            if c in cells:
                val, s = cells[c]
                zf = fmts.get(xfs[int(s)]) if s is not None and int(s) < len(xfs) else None
                line.append('%s%s' % (val, ('{%s}' % zf) if zf and zf != 'General' else ''))
        print('   ' + ' | '.join(line))
    return out


dump(0, '年级汇总', 4)
dump(2, '1班', 2)
dump(5, '4班', 2)
dump(1, '全年级明细', 2)
print('\n✅ xlsx 结构正常（可被标准解析）')
