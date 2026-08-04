#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
构建单文件版：把 css/js/库全部内联进一个 index.html
用法：python3 build/make-single.py  →  输出 初中英语科组工作平台.html
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'index.html')
OUT = os.path.join(ROOT, '初中英语科组工作平台.html')

with open(SRC, encoding='utf-8') as f:
    html = f.read()

# 1) 内联 CSS
def inline_css(m):
    path = os.path.join(ROOT, m.group(1))
    with open(path, encoding='utf-8') as f:
        css = f.read()
    return '<style>\n' + css + '\n</style>'

html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', inline_css, html)

# 2) 内联 JS（含 lib）
def inline_js(m):
    path = os.path.join(ROOT, m.group(1))
    with open(path, encoding='utf-8') as f:
        js = f.read()
    # 防止 </script> 提前闭合
    js = js.replace('</script', '<\\/script').replace('<!--', '<\\!--')
    return '<script>\n' + js + '\n</script>'

html = re.sub(r'<script src="([^"]+)"></script>', inline_js, html)

with open(OUT, 'w', encoding='utf-8') as f:
    f.write(html)

size = os.path.getsize(OUT) / 1024 / 1024
print(f'✅ 已生成单文件版：{OUT}（{size:.2f} MB）')
