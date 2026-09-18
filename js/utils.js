/* ============================================================
 * utils.js — 公共工具：常量 / 统计 / 弹窗 / 提示 / Excel / 日期 / 事件委托
 * 所有模块挂在 window.EJWP (App) 命名空间下
 * ============================================================ */
(function (global) {
  'use strict';
  const App = global.EJWP = global.EJWP || {};

  /* ---------------- 常量 ---------------- */
  // 题型定义（成绩表列顺序）
  App.ITEMS = [
    { key: 'grammar',   label: '语法选择' },
    { key: 'cloze',     label: '完形填空' },
    { key: 'reading',   label: '阅读理解' },
    { key: 'answering', label: '回答问题' },
    { key: 'wordFill',  label: '选词填空' },
    { key: 'sentence',  label: '完成句子' },
    { key: 'passage',   label: '短文填空' },
    { key: 'writing',   label: '作文' },
    { key: 'speaking',  label: '听说' }
  ];
  App.ITEM_KEYS = App.ITEMS.map(i => i.key);
  App.itemLabel = k => (App.ITEMS.find(i => i.key === k) || {}).label || k;
  // 题型别名（兼容旧模板 / 常见叫法）
  App.ITEM_ALIASES = { speaking: ['听说', '口语', '听力口语', '听说考试'] };
  App.itemAliases = k => [App.itemLabel(k), ...((App.ITEM_ALIASES || {})[k] || [])];

  // 资料分类
  App.MAT_CATEGORIES = ['课件', '教案', '试卷', '练习题', '默写卷', '背诵资料', '成绩'];

  // 默认各题型满分（合计 120 分，可在新建考试时调整）
  App.DEFAULT_FULL = { grammar: 10, cloze: 10, reading: 30, answering: 10, wordFill: 5, sentence: 5, passage: 5, writing: 15, speaking: 30 };
  App.fullTotal = fm => App.ITEM_KEYS.reduce((s, k) => s + (fm && fm[k] ? +fm[k] : 0), 0);

  /* ---------------- 基础工具 ---------------- */
  App.uid = (p) => (p || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  App.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  App.num = v => { if (v == null || v === '') return null; const n = parseFloat(String(v).replace(/[^\d.-]/g, '')); return isNaN(n) ? null : n; };
  App.fmt = (n, d) => { if (n == null || isNaN(n)) return '—'; const x = +(Number(n).toFixed(d == null ? 1 : d)); return x.toLocaleString('zh-CN', { maximumFractionDigits: d == null ? 1 : d }); };
  App.fmtPct = n => (n == null || isNaN(n)) ? '—' : App.fmt(n * 100, 1) + '%';
  App.today = () => { const d = new Date(); return d.toISOString().slice(0, 10); };

  /* ---------------- 统计 ---------------- */
  App.statsOf = arr => {
    const a = arr.filter(x => x != null && !isNaN(x));
    if (!a.length) return { count: 0, avg: null, max: null, min: null, range: null, median: null, sum: 0 };
    const sorted = [...a].sort((x, y) => x - y);
    const n = sorted.length;
    const sum = sorted.reduce((s, x) => s + x, 0);
    const mid = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
    return {
      count: n, sum,
      avg: sum / n,
      max: sorted[n - 1], min: sorted[0],
      range: sorted[n - 1] - sorted[0],
      median: mid
    };
  };

  // 线性插值分位数（q ∈ [0,1]）
  App.quantile = (arr, q) => {
    const a = arr.filter(x => x != null && !isNaN(x)).sort((x, y) => x - y);
    if (!a.length) return null;
    if (a.length === 1) return a[0];
    const pos = (a.length - 1) * q;
    const lo = Math.floor(pos), hi = Math.ceil(pos);
    return lo === hi ? a[lo] : a[lo] + (a[hi] - a[lo]) * (pos - lo);
  };
  // 箱线图数据：{min, q1, median, q3, max, outliers}
  App.boxplotData = arr => {
    const a = arr.filter(x => x != null && !isNaN(x)).sort((x, y) => x - y);
    if (!a.length) return null;
    const q1 = App.quantile(a, .25), q3 = App.quantile(a, .75);
    const iqr = q3 - q1;
    const loF = q1 - 1.5 * iqr, hiF = q3 + 1.5 * iqr;
    const whiskerMin = a.find(v => v >= loF) ?? a[0];
    const whiskerMax = [...a].reverse().find(v => v <= hiF) ?? a[a.length - 1];
    return {
      min: whiskerMin, q1, median: App.quantile(a, .5), q3, max: whiskerMax,
      outliers: a.filter(v => v < loF || v > hiF)
    };
  };
  // 分数分段（从高到低，每 10 分一段，最后一段汇总低分段）
  // 满分 120 → ["120-110","110-100",...,"40-30","30-0"]
  App.scoreSegments = full => {
    const segs = [];
    let hi = full;
    for (let i = 0; i < 9 && hi > 0; i++) {
      const lo = hi - 10;
      segs.push({ label: `${hi}-${lo}`, min: lo, max: hi });
      hi = lo;
    }
    if (hi > 0) segs.push({ label: `${hi}-0`, min: 0, max: hi });
    return segs;
  };
  // 分数所属分段索引（0=最高分段，依次递增，最后一段为低分段汇总）
  App.scoreBinIndex = (v, full) => {
    if (v == null || isNaN(v) || v < 0) return -1;
    if (v >= full) return 0;
    for (let i = 0; i < 9; i++) {
      const low = full - (i + 1) * 10;
      if (v >= low) return i;
    }
    return 9;
  };

  /* ---------------- 日期工具 ---------------- */
  App.addDays = (d, n) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  App.mondayOf = d => { const x = new Date(d + 'T00:00:00'); const w = (x.getDay() + 6) % 7; return App.addDays(d, -w); };
  App.dowCN = d => ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date(d + 'T00:00:00').getDay()];
  App.lsSize = () => { let total = 0; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i), v = localStorage.getItem(k); total += (k ? k.length : 0) * 2 + (v ? v.length : 0) * 2; } return total; };
  // 解析班级号 1-15（支持：1 / 01 / 1班 / 一班 / 801 / 801班 / 8(1)班 / 八年级1班 等写法）
  App.parseClassNo = s => {
    if (s == null || s === '') return null;
    const str = String(s).trim();
    const nums = str.match(/\d+/g);
    if (nums) {
      for (let i = nums.length - 1; i >= 0; i--) {
        const n = parseInt(nums[i], 10);
        if (n >= 1 && n <= 15) return String(n);      // "1" "01" "15" "1班" 中的 1~15
        if (n >= 100 && n <= 999) {                     // "801"~"815" 三位数：取后两位为班号
          const last2 = n % 100;
          if (last2 >= 1 && last2 <= 15) return String(last2);
        }
      }
    }
    const cn = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五'];
    const ci = cn.indexOf(str.replace(/班/g, ''));
    return ci >= 1 && ci <= 15 ? String(ci) : null;
  };
  // 班级显示名：prefix 为空 → "1班"~"15班"；prefix='8' → "801班"~"815班"
  App.className = (no, prefix) => {
    const p = (prefix != null ? prefix : (App.DB && App.DB.state ? (App.DB.state.settings.classPrefix || '') : '')) || '';
    return p ? p + String(no).padStart(2, '0') + '班' : no + '班';
  };
  // 解析班级列表输入："1-4,7-10,13-15" 或 "5,6" → ['1','2','3','4','7',...]
  App.parseClassList = s => {
    const out = [];
    String(s == null ? '' : s).split(/[,，、;；\s]+/).forEach(part => {
      if (!part) return;
      const m = part.match(/^(\d+)\s*[-~－—至]\s*(\d+)$/);
      if (m) {
        const a = +m[1], b = +m[2];
        for (let i = Math.min(a, b); i <= Math.max(a, b); i++) if (i >= 1 && i <= 15) out.push(String(i));
      } else {
        const n = parseInt((part.match(/\d+/) || [])[0], 10);
        if (n >= 1 && n <= 15) out.push(String(n));
      }
    });
    return [...new Set(out)];
  };
  // 班级所属层次（A/B/C…），未配置返回 null
  App.tierOf = classId => {
    const tiers = (App.DB && App.DB.state ? (App.DB.state.settings.classTiers || {}) : {});
    for (const t of Object.keys(tiers)) {
      if (App.parseClassList(tiers[t]).includes(String(classId))) return t;
    }
    return null;
  };
  // 某层次包含的班级 id 数组
  App.tierMembers = tier => {
    const tiers = (App.DB && App.DB.state ? (App.DB.state.settings.classTiers || {}) : {});
    return App.parseClassList(tiers[tier] || '');
  };
  // 学期开始（周一）=> 第 N 周的周一日期
  App.weekMonday = (termStart, n) => App.addDays(App.mondayOf(termStart), (n - 1) * 7);
  App.weekRange = (termStart, n) => { const m = App.weekMonday(termStart, n); return { monday: m, sunday: App.addDays(m, 6) }; };

  /* ---------------- DOM 小工具 ---------------- */
  App.$ = sel => document.querySelector(sel);
  App.$$ = sel => [...document.querySelectorAll(sel)];
  App.el = (tag, attrs, html) => {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (html != null) e.innerHTML = html;
    return e;
  };

  /* ---------------- Toast ---------------- */
  App.toast = (msg, type, ms) => {
    const wrap = App.$('#toastWrap') || (() => { const w = App.el('div', { id: 'toastWrap', class: 'toast-wrap' }); document.body.appendChild(w); return w; })();
    const t = App.el('div', { class: 'toast' + (type === 'err' ? ' err' : type === 'ok' ? ' ok' : '') }, App.esc(msg));
    wrap.appendChild(t);
    setTimeout(() => { t.style.transition = 'opacity .4s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 420); }, ms || 2600);
  };

  /* ---------------- 弹窗 ---------------- */
  App.modal = (opts) => {
    const mask = App.$('#modalMask'), box = App.$('#modalBox');
    App.closeAllCharts();
    App.$('#modalTitle').textContent = opts.title || '';
    App.$('#modalBody').innerHTML = opts.body || '';
    App.$('#modalFoot').innerHTML = opts.foot || '';
    box.className = 'modal' + (opts.wide ? ' wide' : '');
    mask.hidden = false;
    if (opts.onOpen) setTimeout(opts.onOpen, 10);
  };
  App.modalClose = () => { App.$('#modalMask').hidden = true; };
  App.closeAllCharts = () => { if (App.charts) { App.charts.forEach(c => { try { c.destroy(); } catch (e) {} }); App.charts = []; } };

  // 确认框
  App.confirm = (opts) => {
    const body = `<div style="font-size:14px;line-height:1.8">${opts.message || ''}</div>`;
    const foot = `<button class="btn btn-ghost" id="cfNo">取消</button>
                  <button class="btn ${opts.danger ? 'btn-danger' : 'btn-primary'}" id="cfOk">${opts.okText || '确定'}</button>`;
    App.modal({ title: opts.title || '请确认', body, foot });
    App.$('#cfNo').onclick = App.modalClose;
    App.$('#cfOk').onclick = () => { App.modalClose(); if (opts.onOk) opts.onOk(); };
  };

  /* ---------------- 文件读写 ---------------- */
  App.downloadBlob = (blob, filename) => {
    const a = App.el('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  };
  App.downloadText = (text, filename, mime) => App.downloadBlob(new Blob([text], { type: mime || 'application/json;charset=utf-8' }), filename);
  App.pickFile = (opts) => new Promise(res => {
    const inp = App.el('input', { type: 'file' });
    if (opts.accept) inp.accept = opts.accept;
    inp.multiple = !!opts.multiple;
    inp.onchange = () => { const f = opts.multiple ? [...inp.files] : (inp.files[0] || null); inp.remove(); res(f); };
    inp.click();
  });

  /* ---------------- Excel 工具（SheetJS） ---------------- */
  App.readWorkbook = (file) => {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => {
        try {
          let wb;
          try { wb = XLSX.read(fr.result, { type: 'array' }); } catch (e) { wb = XLSX.read(new TextDecoder('utf-8').decode(fr.result), { type: 'string' }); }
          if (!wb || !wb.SheetNames || !wb.SheetNames.length) return rej(new Error('文件中没有工作表'));
          res(wb);
        } catch (e) { rej(e); }
      };
      fr.onerror = () => rej(new Error('文件读取失败'));
      fr.readAsArrayBuffer(file);
    });
  };
  App.workbookToRows = (wb, sheetName) => {
    const sn = sheetName || wb.SheetNames[0];
    return XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '', raw: true });
  };
  // aoa → xlsx 下载；opts: {sheetName, widths:[], merges:[[r1,c1,r2,c2],...], title}
  App.downloadXlsx = (aoa, filename, opts) => {
    const o = opts || {};
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    if (o.widths) ws['!cols'] = o.widths.map(w => ({ wch: w }));
    if (o.merges) ws['!merges'] = o.merges;
    XLSX.utils.book_append_sheet(wb, ws, o.sheetName || 'Sheet1');
    XLSX.writeFile(wb, filename);
  };
  App.makeWorkbook = (sheets) => { // sheets: [{name, aoa, widths, merges}]
    const wb = XLSX.utils.book_new();
    sheets.forEach(s => {
      const ws = XLSX.utils.aoa_to_sheet(s.aoa);
      if (s.widths) ws['!cols'] = s.widths.map(w => ({ wch: w }));
      if (s.merges) ws['!merges'] = s.merges;
      XLSX.utils.book_append_sheet(wb, ws, s.name);
    });
    return wb;
  };

  /* ---------------- 事件委托 ---------------- */
  // App.delegate(rootEl, {click:{act:fn}, change:{...}, input:{...}}) — fn(e, el)
  App.delegate = (root, maps) => {
    const bind = (evt, map) => root.addEventListener(evt, e => {
      const el = e.target.closest('[data-' + (evt === 'click' ? 'act' : evt === 'change' ? 'cact' : 'iact') + ']');
      if (!el || !root.contains(el)) return;
      const key = el.dataset[evt === 'click' ? 'act' : evt === 'change' ? 'cact' : 'iact'];
      const fn = map[key];
      if (fn) { e.preventDefault(); fn(e, el); }
    });
    if (maps.click) bind('click', maps.click);
    if (maps.change) bind('change', maps.change);
    if (maps.input) bind('input', maps.input);
  };

  /* ---------------- 图表（Chart.js） ---------------- */
  App.charts = [];
  App.newChart = (ctx, cfg) => {
    const c = new Chart(ctx, cfg);
    App.charts.push(c);
    return c;
  };
  App.chartPalette = (n) => {
    const base = ['#34b57e', '#5ed09a', '#93e3bb', '#249966', '#1e7d54', '#7fd8b0', '#0f9d6e', '#4fc08d', '#2f8f63', '#a8e6c8', '#57c795', '#18794e', '#b9ecd3', '#3da97a', '#69d6a4'];
    return Array.from({ length: n }, (_, i) => base[i % base.length]);
  };

  /* ---------------- 其他 ---------------- */
  App.escapeReg = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
})(typeof window !== 'undefined' ? window : globalThis);
