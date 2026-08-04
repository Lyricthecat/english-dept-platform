/* ============================================================
 * plan.js — 工作计划板块
 *  制定每周工作计划 · 确定每周授课进度 · 一键生成表格（打印/导出Excel）
 * ============================================================ */
(function (global) {
  'use strict';
  const App = global.EJWP;
  const DB = () => App.DB;

  App.Plan = {
    week: 1,
    saveTimer: null,
    weekMax: 40,

    /* ---------- 入口 ---------- */
    init() {
      const st = DB().state.settings;
      this.week = this.currentWeekOf();
      this.render();
    },

    currentWeekOf() {
      const st = DB().state.settings;
      const today = App.today();
      const days = Math.floor((new Date(today) - new Date(App.mondayOf(st.termStart))) / 86400000);
      const w = Math.floor(days / 7) + 1;
      return Math.min(Math.max(w, 1), this.weekMax);
    },

    getPlan() {
      let p = DB().state.plans.find(x => x.week === this.week);
      if (!p) {
        p = { id: App.uid('plan'), week: this.week, focus: '', daily: {}, lessons: [] };
        DB().state.plans.push(p);
        DB().save();
      }
      if (!p.daily) p.daily = {}; // 兼容旧数据
      return p;
    },

    /* ---------- 渲染 ---------- */
    render() {
      const v = App.$('#planView');
      const st = DB().state.settings;
      const { monday, sunday } = App.weekRange(st.termStart, this.week);
      const p = this.getPlan();
      const weekOpts = Array.from({ length: this.weekMax }, (_, i) => {
        const w = i + 1;
        const r = App.weekRange(st.termStart, w);
        return `<option value="${w}" ${w === this.week ? 'selected' : ''}>第 ${w} 周（${r.monday} ~ ${r.sunday}）</option>`;
      }).join('');

      let rows = '';
      if (p.lessons.length) {
        rows = p.lessons.map(l => this.rowHtml(l)).join('');
      } else {
        rows = `<tr class="empty-row"><td colspan="7" style="text-align:center;color:#8aa096;padding:26px">本周还没有安排，点击「生成本周五天」或「添加一行」开始制定计划</td></tr>`;
      }

      // —— 周历：一周 7 天的每日工作安排 ——
      const today = App.today();
      const cal = Array.from({ length: 7 }, (_, i) => {
        const d = App.addDays(monday, i);
        const text = p.daily[d] || '';
        const isToday = d === today;
        const isWeekend = i >= 5;
        return `<div class="cal-cell ${isToday ? 'today' : ''} ${isWeekend ? 'weekend' : ''} ${text ? 'has' : ''}" data-act="editDay" data-date="${d}" title="点击编辑当天安排">
          <div class="cal-head"><b>${App.dowCN(d)}</b><span>${d.slice(5)}</span></div>
          ${text ? `<div class="cal-body has">${App.esc(text)}</div>` : '<div class="cal-empty">＋ 添加安排</div>'}
          ${isToday ? '<div class="cal-foot">📌 今天</div>' : ''}
        </div>`;
      }).join('');

      v.innerHTML = `
      <div class="card">
        <div class="flex mb16">
          <div class="week-nav">
            <button class="btn btn-ghost btn-sm" data-act="prevWeek">‹ 上一周</button>
            <select class="week-select" data-cact="jumpWeek" style="padding:7px 10px;border:1.5px solid var(--mint-200);border-radius:9px;background:#fff;font-weight:600;color:var(--mint-900)">
              ${weekOpts}
            </select>
            <button class="btn btn-ghost btn-sm" data-act="nextWeek">下一周 ›</button>
            <button class="btn btn-primary btn-sm" data-act="thisWeek">📅 本周</button>
          </div>
          <div class="spacer"></div>
          <div class="wn-range"><b style="color:var(--mint-700)">${monday} ~ ${sunday}</b>（${st.schoolName} · ${st.gradeName}）</div>
        </div>
        <div class="card-title">🗓 本周教研重点 / 每日工作安排 <span class="hint">（周历视图 · 点击日期格子填写当天安排）</span></div>
        <div class="weekcal mb12" id="weekcal">${cal}</div>
        <div class="field" style="max-width:640px;margin-bottom:0">
          <label>📌 本周教研重点（选填，将出现在生成的表格中）</label>
          <input type="text" data-iact="focus" placeholder="如：集体备课 Unit 5，周二下午科组会…" value="${App.esc(p.focus)}">
        </div>
      </div>
      <div class="card">
        <div class="card-title">📖 本周授课进度 <span class="hint">（日期 · 节次 · 授课内容 · 作业，修改后自动保存）</span></div>
        <div class="tbl-wrap mb12">
          <table class="tbl plan-lessons">
            <thead><tr>
              <th style="width:120px">日期</th><th style="width:56px">星期</th>
              <th style="width:110px">节次</th><th>授课内容与进度</th>
              <th style="width:190px">作业布置</th><th style="width:150px">备注</th><th style="width:52px"></th>
            </tr></thead>
            <tbody data-tbody="lessons">${rows}</tbody>
          </table>
        </div>
        <div class="flex">
          <button class="btn btn-ghost btn-sm" data-act="genDays">🖐 生成本周五天</button>
          <button class="btn btn-ghost btn-sm" data-act="addRow">➕ 添加一行</button>
          <div class="spacer"></div>
          <button class="btn btn-primary" data-act="genTable">📄 一键生成表格</button>
        </div>
      </div>`;

      App.delegate(v, {
        click: {
          prevWeek: () => this.goto(this.week - 1),
          nextWeek: () => this.goto(this.week + 1),
          thisWeek: () => this.goto(this.currentWeekOf()),
          genDays: () => this.genWeekdays(),
          addRow: () => this.addRow(),
          genTable: () => this.genTable(),
          delRow: (e, el) => this.delRow(el.dataset.id),
          editDay: (e, el) => this.editDay(el.dataset.date)
        },
        change: {
          jumpWeek: (e) => this.goto(parseInt(e.target.value, 10))
        },
        input: {
          focus: (e) => this.scheduleSave(p, { focus: e.target.value }),
          row: (e, el) => this.onRowInput(el)
        }
      });
    },

    /* ---------- 周历：编辑某天安排 ---------- */
    editDay(date) {
      const p = this.getPlan();
      const text = p.daily[date] || '';
      App.modal({
        title: `${App.dowCN(date)} ${date} · 工作安排`,
        body: `<div class="field"><label>当天安排（教研活动 / 会议 / 公开课 / 监考等，可换行）</label>
          <textarea id="dayText" rows="6" style="width:100%">${App.esc(text)}</textarea></div>
          <div class="small muted">💡 留空保存即清除当天安排</div>`,
        foot: `<button class="btn btn-ghost" onclick="EJWP.modalClose()">取消</button>
               <button class="btn btn-danger" id="dayClear">🗑 清空</button>
               <button class="btn btn-primary" id="daySave">💾 保存</button>`
      });
      App.$('#daySave').onclick = () => {
        const v = App.$('#dayText').value.trim();
        if (v) p.daily[date] = v; else delete p.daily[date];
        DB().save('更新每日安排');
        App.modalClose();
        App.toast(v ? `已保存 ${date} 的安排` : '已清除当天安排', 'ok');
        this.render();
      };
      App.$('#dayClear').onclick = () => {
        delete p.daily[date];
        DB().save('清除每日安排');
        App.modalClose();
        App.toast('已清除当天安排', 'ok');
        this.render();
      };
    },

    rowHtml(l) {
      const date = l.date || App.addDays(App.weekMonday(DB().state.settings.termStart, this.week), 0);
      return `<tr data-row="${l.id}">
        <td><input data-iact="row" data-f="date" type="date" value="${App.esc(l.date || '')}"></td>
        <td style="text-align:center;color:var(--mint-700);font-weight:600">${l.date ? App.dowCN(l.date) : '—'}</td>
        <td><select data-iact="row" data-f="period">
          ${['第1-2节', '第3-4节', '第5-6节', '第7-8节', '自习课', '早读课', '课后延时'].map(o =>
            `<option ${l.period === o ? 'selected' : ''}>${o}</option>`).join('')}
          <option value="__custom" ${l.period && !['第1-2节','第3-4节','第5-6节','第7-8节','自习课','早读课','课后延时'].includes(l.period) ? 'selected' : ''}>自定义…</option>
        </select></td>
        <td><input data-iact="row" data-f="content" placeholder="如：Unit 5 词汇讲解 + 语法练习" value="${App.esc(l.content || '')}"></td>
        <td><input data-iact="row" data-f="homework" placeholder="如：P48 练习 + 背诵单词" value="${App.esc(l.homework || '')}"></td>
        <td><input data-iact="row" data-f="note" placeholder="备注" value="${App.esc(l.note || '')}"></td>
        <td><button class="btn-icon" title="删除本行" data-act="delRow" data-id="${l.id}">🗑</button></td>
      </tr>`;
    },

    goto(w) {
      if (w < 1) w = 1;
      if (w > this.weekMax) w = this.weekMax;
      this.week = w;
      this.render();
    },

    /* ---------- 编辑操作（自动保存） ---------- */
    scheduleSave(plan, patch) {
      Object.assign(plan, patch);
      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => { DB().save(); }, 500);
    },
    onRowInput(el) {
      const p = this.getPlan();
      const row = p.lessons.find(l => l.id === el.closest('tr').dataset.row);
      if (!row) return;
      const f = el.dataset.f;
      row[f] = el.value;
      if (f === 'date') { // 更新星期列
        const td = el.closest('tr').querySelector('td:nth-child(2)');
        if (td) td.textContent = el.value ? App.dowCN(el.value) : '—';
      }
      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => { DB().save(); }, 400);
    },
    addRow(date) {
      const p = this.getPlan();
      const st = DB().state.settings;
      const { monday } = App.weekRange(st.termStart, this.week);
      const d = date || (p.lessons.length ? p.lessons[p.lessons.length - 1].date || monday : monday);
      p.lessons.push({ id: App.uid('ls'), date: d, period: '第1-2节', content: '', homework: '', note: '' });
      DB().save();
      this.render();
    },
    genWeekdays() {
      const p = this.getPlan();
      const st = DB().state.settings;
      const { monday } = App.weekRange(st.termStart, this.week);
      for (let i = 0; i < 5; i++) {
        const d = App.addDays(monday, i);
        const exists = p.lessons.some(l => l.date === d);
        if (!exists) p.lessons.push({ id: App.uid('ls'), date: d, period: '第1-2节', content: '', homework: '', note: '' });
      }
      p.lessons.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      DB().save();
      this.render();
    },
    delRow(id) {
      const p = this.getPlan();
      p.lessons = p.lessons.filter(l => l.id !== id);
      DB().save();
      this.render();
    },

    /* ---------- 复制到下周 ---------- */
    copyToNextWeek() {
      const p = this.getPlan();
      if (!p.lessons.length && !p.focus && !Object.keys(p.daily || {}).length) { App.toast('本周还没有内容可复制', 'err'); return; }
      const nw = Math.min(this.week + 1, this.weekMax);
      let np = DB().state.plans.find(x => x.week === nw);
      if (!np) { np = { id: App.uid('plan'), week: nw, focus: '', daily: {}, lessons: [] }; DB().state.plans.push(np); }
      np.focus = p.focus;
      np.daily = Object.fromEntries(Object.entries(p.daily || {}).map(([d, t]) => [App.addDays(d, 7), t]));
      np.lessons = p.lessons.map(l => ({ ...l, id: App.uid('ls'), date: l.date ? App.addDays(l.date, 7) : l.date }));
      DB().save();
      App.toast(`已复制本周计划（含每日安排）到第 ${nw} 周`, 'ok');
    },

    /* ---------- 一键生成表格（可自由选择时间跨度） ---------- */
    // 单周 HTML：标题 + 每日工作安排表 + 授课进度表 + 教研重点 + 签名
    buildWeekHTML(w) {
      const st = DB().state.settings;
      const p = DB().state.plans.find(x => x.week === w);
      const { monday, sunday } = App.weekRange(st.termStart, w);
      const focus = p ? (p.focus || '') : '';
      const daily = (p && p.daily) || {};
      const dayEntries = Object.keys(daily).filter(d => daily[d]).sort();

      const dayTable = dayEntries.length ? `
        <div class="psub" style="text-align:left;font-weight:700;margin:10px 0 4px">📌 每日工作安排</div>
        <table class="ptable"><thead><tr><th style="width:110px">日期</th><th style="width:60px">星期</th><th>工作安排</th></tr></thead>
        <tbody>${dayEntries.map(d => `<tr><td>${d}</td><td>${App.dowCN(d)}</td><td>${App.esc(daily[d])}</td></tr>`).join('')}</tbody></table>` : '';

      const rows = (p && p.lessons.length) ? p.lessons.map((l, i) => {
        const date = l.date || '';
        return `<tr>
          <td>${i + 1}</td><td>${App.esc(date)}</td><td>${date ? App.dowCN(date) : ''}</td>
          <td>${App.esc(l.period || '')}</td><td>${App.esc(l.content || '')}</td>
          <td>${App.esc(l.homework || '')}</td><td>${App.esc(l.note || '')}</td>
        </tr>`;
      }).join('') : '<tr><td colspan="7" style="text-align:center">（本周尚未安排授课进度）</td></tr>';

      return `<div class="ptitle">${App.esc(st.schoolName)} · 第 ${w} 周英语教学工作计划表</div>
      <div class="psub">${st.gradeName}　时间：${monday}（周一）～ ${sunday}（周日）　制定日期：${App.today()}</div>
      ${dayTable}
      <div class="psub" style="text-align:left;font-weight:700;margin:10px 0 4px">📖 授课进度</div>
      <table class="ptable">
        <thead><tr><th style="width:40px">序号</th><th style="width:90px">日期</th><th style="width:48px">星期</th><th style="width:90px">节次</th><th>授课内容与进度</th><th style="width:170px">作业布置</th><th style="width:120px">备注</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="psig"><span>教研重点 / 工作安排：${App.esc(focus || '（无）')}</span></div>
      <div class="psig"><span>制定人：________</span><span>审核人：________</span><span>日期：____年__月__日</span></div>`;
    },

    // 多周拼接（每周之间分页，打印时每周一页）
    buildTableHTML(from, to) {
      const lo = Math.min(from, to), hi = Math.max(from, to);
      const parts = [];
      for (let w = lo; w <= hi; w++) parts.push(this.buildWeekHTML(w));
      return parts.join('<div class="page-break"></div>');
    },

    genTable() {
      const cur = this.week;
      const opts = Array.from({ length: this.weekMax }, (_, i) => {
        const w = i + 1;
        return `<option value="${w}" ${w === cur ? 'selected' : ''}>第 ${w} 周</option>`;
      }).join('');
      const selStyle = 'padding:7px 10px;border:1.5px solid var(--mint-200);border-radius:9px;background:#fff;font-weight:600;color:var(--mint-900)';
      const renderPreview = () => {
        const f = +App.$('#gtFrom').value, t = +App.$('#gtTo').value;
        const lo = Math.min(f, t), hi = Math.max(f, t);
        App.$('#gtPreview').innerHTML = this.buildTableHTML(lo, hi);
        App.$('#gtSpanInfo').textContent = `已选择 ${hi - lo + 1} 周（第 ${lo} ~ ${hi} 周）`;
      };
      const body = `
      <div class="field">
        <label>📅 时间跨度（自由选择起止周，默认当前周）</label>
        <div class="flex">
          从 <select id="gtFrom" style="${selStyle}">${opts}</select>
          到 <select id="gtTo" style="${selStyle}">${opts}</select>
          <button class="btn btn-xs btn-ghost" id="gtThisWeek">📅 本周</button>
          <button class="btn btn-xs btn-ghost" id="gtSem">🗓 整学期（1-40 周）</button>
          <span class="small muted" id="gtSpanInfo"></span>
        </div>
      </div>
      <div id="gtPreview" style="max-height:56vh;overflow:auto;border:1px solid var(--line);border-radius:10px;padding:16px;background:#fff"></div>
      <div class="mt8 small muted">💡 选择多周时：预览按周分页 · 打印时每周自动分页 · Excel 导出为每周一个工作表。</div>`;
      const foot = `
        <button class="btn btn-ghost" onclick="EJWP.modalClose()">关闭</button>
        <button class="btn btn-ghost" id="gtExcel">📊 导出 Excel</button>
        <button class="btn btn-primary" id="gtPrint">🖨 打印 / 导出 PDF</button>`;
      App.modal({ title: '一键生成 · 教学工作计划表', body, foot, wide: true });
      App.$('#gtFrom').onchange = renderPreview;
      App.$('#gtTo').onchange = renderPreview;
      App.$('#gtThisWeek').onclick = () => { App.$('#gtFrom').value = cur; App.$('#gtTo').value = cur; renderPreview(); };
      App.$('#gtSem').onclick = () => { App.$('#gtFrom').value = 1; App.$('#gtTo').value = this.weekMax; renderPreview(); };
      renderPreview();
      App.$('#gtPrint').onclick = () => {
        const f = +App.$('#gtFrom').value, t = +App.$('#gtTo').value;
        App.$('#printArea').innerHTML = this.buildTableHTML(f, t);
        setTimeout(() => window.print(), 80);
      };
      App.$('#gtExcel').onclick = () => {
        const f = +App.$('#gtFrom').value, t = +App.$('#gtTo').value;
        this.exportExcel(Math.min(f, t), Math.max(f, t));
      };
    },

    // 单周 Excel 工作表数据
    buildWeekSheet(w) {
      const st = DB().state.settings;
      const p = DB().state.plans.find(x => x.week === w);
      const { monday, sunday } = App.weekRange(st.termStart, w);
      const focus = p ? (p.focus || '') : '';
      const daily = (p && p.daily) || {};
      const dayEntries = Object.keys(daily).filter(d => daily[d]).sort();
      const aoa = [
        [`${st.schoolName} · 第 ${w} 周英语教学工作计划表`],
        [`${st.gradeName}`, `时间：${monday}（周一）～ ${sunday}（周日）`, '', '', '', '', '制定日期：' + App.today()]
      ];
      if (dayEntries.length) {
        aoa.push(['每日工作安排'], ['日期', '星期', '工作安排']);
        dayEntries.forEach(d => aoa.push([d, App.dowCN(d), daily[d]]));
        aoa.push([]);
      }
      aoa.push(['授课进度'], ['序号', '日期', '星期', '节次', '授课内容与进度', '作业布置', '备注']);
      (p && p.lessons ? p.lessons : []).forEach((l, i) =>
        aoa.push([i + 1, l.date || '', l.date ? App.dowCN(l.date) : '', l.period || '', l.content || '', l.homework || '', l.note || '']));
      if (!(p && p.lessons && p.lessons.length)) aoa.push(['', '', '', '', '（本周尚未安排授课进度）', '', '']);
      aoa.push([], ['教研重点 / 工作安排：', focus || '（无）'], [],
        ['制定人：', '', '审核人：', '', '日期：____年__月__日', '', '']);
      return {
        name: `第${w}周`,
        aoa,
        widths: [6, 12, 8, 10, 44, 26, 16],
        merges: [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }]
      };
    },

    exportExcel(from, to) {
      const lo = Math.min(from, to), hi = Math.max(from, to);
      const sheets = [];
      for (let w = lo; w <= hi; w++) sheets.push(this.buildWeekSheet(w));
      XLSX.writeFile(App.makeWorkbook(sheets), `英语教学工作计划表-第${lo}-${hi}周.xlsx`);
      App.toast(`已导出 ${hi - lo + 1} 周的计划表（${sheets.length} 个工作表）`, 'ok');
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
