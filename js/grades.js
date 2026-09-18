/* ============================================================
 * grades.js — 成绩管理板块
 *  新建考试（选班 1-15 可全选）· 分班导入成绩（统一模板）· 整表导入
 *  成绩查看/编辑 · 一键比对分析（平均/最高/最低/分差/中位数/及格/优秀/低分/得分率）
 *  Chart.js 可视化 + Excel / PNG 导出
 * ============================================================ */
(function (global) {
  'use strict';
  const App = global.EJWP;
  const DB = () => App.DB;

  // 导入模板列（统一表头）
  const TEMPLATE_HEADER = ['班级', '学号', '姓名', ...App.ITEMS.map(i => i.label), '总分', '排名'];

  App.Grades = {
    view: 'list',           // list | exam:<id> | analysis:<id> | classanalysis:<examId>:<classId>
    examId: null,
    // 分析视图状态（会话级）
    anMetric: 'avg',        // avg|max|min|range|median|passRate|goodRate|lowRate|rate
    anClasses: null,        // null=全部
    anThr: null,            // {pass, good, low} 会话级覆盖
    charts: {},

    init() {
      App.$('#examBtnNew').onclick = () => this.openExamForm(null);
      this.anThr = { ...DB().state.settings };
      this.render();
    },

    getExam() { return DB().state.exams.find(x => x.id === this.examId) || null; },

    render() {
      App.closeAllCharts();
      this.charts = {};
      const v = App.$('#gradesView');
      if (this.view.startsWith('classanalysis:')) { this.renderClassAnalysis(v); return; }
      if (this.view.startsWith('exam:')) { this.renderExam(v); return; }
      if (this.view.startsWith('analysis:')) { this.renderAnalysis(v); return; }
      this.renderList(v);
    },

    /* ================= 列表 ================= */
    renderList(v) {
      const exams = [...DB().state.exams].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      v.innerHTML = exams.length ? `<div class="exam-grid">
        ${exams.map(ex => {
          let imported = 0, expected = 0;
          ex.classIds.forEach(cid => {
            const cls = DB().getClass(cid);
            imported += ((ex.scores || {})[cid] || []).length;
            expected += cls ? cls.students.length : 0;
          });
          const pct = expected ? Math.round(imported / expected * 100) : 0;
          return `<div class="exam-card" data-act="openExam" data-id="${ex.id}">
            <div class="ec-name">${App.esc(ex.name)} <span class="ec-tag">${App.esc(ex.type || '考试')}</span></div>
            <div class="ec-meta">
              <span>📅 ${App.esc(ex.date)} · 参考 ${ex.classIds.length} 个班</span>
              <span>✅ 已导入 <b>${imported}</b> / ${expected} 人</span>
            </div>
            <div class="ec-prog"><i style="width:${pct}%"></i></div>
            <div class="ec-bar"><span>${pct}%</span><span>满分 ${App.fullTotal(ex.fullMarks)} 分</span></div>
          </div>`;
        }).join('')}
      </div>` : `<div class="empty"><div class="e-ico">📊</div><p>还没有考试记录，点击右上角「新建考试」开始<br>新建后可一键全选 1-15 班，并分班导入统一模板的成绩</p></div>`;

      App.delegate(v, { click: { openExam: (e, el) => { this.view = 'exam:' + el.dataset.id; this.examId = el.dataset.id; this.render(); } } });
    },

    /* ================= 新建 / 编辑考试 ================= */
    openExamForm(exam) {
      const isEdit = !!exam;
      const d = App.today();
      const fm = exam ? { ...(exam.fullMarks || App.DEFAULT_FULL) } : { ...App.DEFAULT_FULL };
      const cls = DB().state.classes.map(c => {
        const on = isEdit ? (exam.classIds || []).includes(c.id) : true;
        return `<label><input type="checkbox" class="cls-chk" value="${c.id}" ${on ? 'checked' : ''}> ${App.esc(c.name)}</label>`;
      }).join('');

      const itemInputs = App.ITEMS.map(i =>
        `<div class="field" style="margin-bottom:8px"><label>${i.label}</label>
         <input type="number" class="fm-input" data-k="${i.key}" min="0" step="0.5" value="${fm[i.key] ?? 0}"></div>`).join('');

      const body = `
      <div class="form-grid">
        <div class="field"><label>考试名称 <span class="req">*</span></label>
          <input type="text" id="exName" value="${isEdit ? App.esc(exam.name) : ''}" placeholder="如：2026 学年第一学期期中考试"></div>
        <div class="field"><label>考试日期</label><input type="date" id="exDate" value="${isEdit ? App.esc(exam.date) : d}"></div>
      </div>
      <div class="field"><label>考试类型</label>
        <select id="exType">${['单元检测', '月考', '期中考试', '期末考试', '模拟考试', '其他'].map(t => `<option ${isEdit && exam.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
      </div>
      <div class="field"><label>各题型满分（默认 120 分制，可按试卷实际调整）</label>
        <div class="form-grid-3">${itemInputs}</div>
        <div class="tip mt8">合计满分：<b id="fmTotal">${App.fullTotal(fm)}</b> 分</div>
      </div>
      <div class="field"><label>参与考试的班级（共 15 个班）</label>
        <div class="flex mb12">
          <button class="btn btn-xs btn-ghost" id="fmAll">✅ 全选</button>
          <button class="btn btn-xs btn-ghost" id="fmNone">⬜ 清空</button>
          <button class="btn btn-xs btn-ghost" id="fmInvert">🔃 反选</button>
          <span class="small muted" id="fmCount">已选 15 个班</span>
        </div>
        <div class="cls-pick">${cls}</div>
      </div>`;

      App.modal({
        title: isEdit ? '编辑考试信息' : '新建考试',
        body, wide: true,
        foot: `<button class="btn btn-ghost" onclick="EJWP.modalClose()">取消</button>
               <button class="btn btn-primary" id="exSave">${isEdit ? '保存修改' : '创建考试'}</button>`
      });

      const count = () => App.$('#fmCount').textContent = '已选 ' + App.$$('.cls-chk:checked').length + ' 个班';
      App.$$('.cls-chk').forEach(c => c.onchange = count);
      App.$('#fmAll').onclick = () => { App.$$('.cls-chk').forEach(c => c.checked = true); count(); };
      App.$('#fmNone').onclick = () => { App.$$('.cls-chk').forEach(c => c.checked = false); count(); };
      App.$('#fmInvert').onclick = () => { App.$$('.cls-chk').forEach(c => c.checked = !c.checked); count(); };
      App.$$('.fm-input').forEach(inp => inp.oninput = () => {
        const fms = {};
        App.$$('.fm-input').forEach(i => fms[i.dataset.k] = +i.value || 0);
        App.$('#fmTotal').textContent = App.fullTotal(fms);
      });

      App.$('#exSave').onclick = () => {
        const name = App.$('#exName').value.trim();
        if (!name) { App.toast('请填写考试名称', 'err'); return; }
        const classIds = App.$$('.cls-chk:checked').map(c => c.value);
        if (!classIds.length) { App.toast('请至少选择一个班级', 'err'); return; }
        const fullMarks = {};
        App.$$('.fm-input').forEach(i => fullMarks[i.dataset.k] = +i.value || 0);
        if (isEdit) {
          exam.name = name; exam.date = App.$('#exDate').value || d; exam.type = App.$('#exType').value;
          exam.fullMarks = fullMarks; exam.classIds = classIds;
          DB().save('已更新考试');
          App.toast('考试信息已更新', 'ok');
        } else {
          DB().state.exams.push({
            id: App.uid('ex'), name, date: App.$('#exDate').value || d, type: App.$('#exType').value,
            fullMarks, classIds, scores: {}
          });
          DB().save('新建考试');
          App.toast(`考试「${name}」创建成功`, 'ok');
        }
        App.modalClose();
        if (isEdit) this.renderExam(App.$('#gradesView')); else this.render();
      };
    },

    deleteExam(ex) {
      let scoreCount = 0;
      ex.classIds.forEach(cid => scoreCount += ((ex.scores || {})[cid] || []).length);
      App.confirm({
        title: '删除考试', danger: true, okText: '删除',
        message: `确定删除「<b>${App.esc(ex.name)}</b>」及其全部 <b>${scoreCount}</b> 条成绩数据吗？<br>建议先到 ⚙️ 设置 → 导出 JSON 备份。`,
        onOk: () => {
          DB().autoBackup();
          DB().state.exams = DB().state.exams.filter(e => e.id !== ex.id);
          DB().save('删除考试');
          this.view = 'list'; this.render();
          App.toast(`考试「${ex.name}」已删除`, 'ok');
        }
      });
    },

    /* ================= 考试详情 ================= */
    renderExam(v) {
      const ex = this.getExam();
      if (!ex) { this.view = 'list'; this.render(); return; }
      const full = App.fullTotal(ex.fullMarks);
      const cards = ex.classIds.map(cid => {
        const cls = DB().getClass(cid);
        const recs = (ex.scores || {})[cid] || [];
        const rosterN = cls ? cls.students.length : 0;
        const pct = rosterN ? Math.round(recs.length / rosterN * 100) : 0;
        const avg = App.statsOf(recs.map(r => App.num(r.total))).avg;
        return `<div class="cls-import-card">
          <div class="flex"><div class="cic-name">📚 ${App.esc(cls ? cls.name : cid + '班')}</div>
            <div class="spacer"></div>${avg != null ? `<span class="badge green">均分 ${App.fmt(avg)}</span>` : '<span class="badge gray">未导入</span>'}</div>
          <div class="cic-status">班级 <b>${rosterN}</b> 人 · 已导入 <b>${recs.length}</b> 人</div>
          <div class="ec-prog"><i style="width:${pct}%"></i></div>
          <div class="cic-acts mt8">
            <button class="btn btn-xs btn-primary" data-act="impCls" data-id="${cid}">📥 导入成绩</button>
            <button class="btn btn-xs btn-ghost" data-act="clsAnalysis" data-id="${cid}">📈 分析</button>
            <button class="btn btn-xs btn-ghost" data-act="editCls" data-id="${cid}">✏️ 查看/编辑</button>
            <button class="btn btn-xs btn-ghost" data-act="expCls" data-id="${cid}">📤 导出</button>
            <button class="btn btn-xs btn-danger" data-act="clearCls" data-id="${cid}">🗑</button>
          </div>
        </div>`;
      }).join('');

      v.innerHTML = `
      <div class="crumb"><button data-act="backList">← 返回考试列表</button><span>/</span><b>${App.esc(ex.name)}</b></div>
      <div class="card">
        <div class="flex">
          <div>
            <div class="card-title" style="font-size:19px">📊 ${App.esc(ex.name)} <span class="badge green">${App.esc(ex.type || '考试')}</span></div>
            <div class="card-sub">📅 ${App.esc(ex.date)} · 参考 ${ex.classIds.length} 个班 · 满分 ${full} 分 · 题型满分：${App.ITEMS.map(i => `${i.label}${ex.fullMarks ? (ex.fullMarks[i.key] ?? 0) : 0}`).join(' / ')}</div>
          </div>
          <div class="spacer"></div>
          <button class="btn btn-ghost btn-sm" data-act="editExam">⚙️ 编辑考试</button>
          <button class="btn btn-danger btn-sm" data-act="delExam">🗑 删除考试</button>
          <button class="btn btn-ghost btn-sm" data-act="dlTpl">⬇ 导入模板</button>
          <button class="btn btn-ghost btn-sm" data-act="impAll">📥 整表导入</button>
          <button class="btn btn-primary" data-act="analyze">🔍 一键分析</button>
        </div>
      </div>
      <div class="card">
        <div class="card-title">🏫 分班导入成绩 <span class="hint">（每个班旁边都有独立的「导入成绩」按钮，可分别上传各班成绩）</span></div>
        <div class="cls-import-grid">${cards}</div>
      </div>`;

      App.delegate(v, {
        click: {
          backList: () => { this.view = 'list'; this.render(); },
          editExam: () => this.openExamForm(ex),
          delExam: () => this.deleteExam(ex),
          analyze: () => { this.view = 'analysis:' + ex.id; this.render(); },
          dlTpl: () => this.downloadTemplate(ex),
          impAll: () => this.importAll(ex),
          impCls: (e, el) => this.importForClass(ex, el.dataset.id),
          clsAnalysis: (e, el) => { this.view = 'classanalysis:' + ex.id + ':' + el.dataset.id; this.render(); },
          editCls: (e, el) => this.editClassScores(ex, el.dataset.id),
          expCls: (e, el) => this.exportClassScores(ex, el.dataset.id),
          clearCls: (e, el) => this.clearClassScores(ex, el.dataset.id)
        }
      });
    },

    /* ================= 模板下载 ================= */
    downloadTemplate(ex) {
      const full = ex.fullMarks || App.DEFAULT_FULL;
      const s1 = [TEMPLATE_HEADER,
        [ex.classIds[0] + '班', '20260001', '示例学生一', 8, 9, 12, 8, 9, 8, 9, 13, 9, 85, 1],
        [ex.classIds[0] + '班', '20260002', '示例学生二', 7, 8, 10, 7, 8, 7, 8, 12, 8, '', '']];
      const s2 = [['成绩导入模板使用说明'],
        ['1. 表头固定为：' + TEMPLATE_HEADER.join('、')],
        ['2. 「总分」「排名」可以留空，导入后系统会自动计算'],
        ['3. 各题型满分：' + App.ITEMS.map(i => `${i.label} ${full[i.key] ?? 0} 分`).join('，')],
        ['4. 导入时会按「学号」自动匹配班级学生档案，未匹配的学生也会保留但标记'],
        ['5. 也可以从本班「查看/编辑」页面直接录入成绩']];
      XLSX.writeFile(App.makeWorkbook([
        { name: '成绩模板', aoa: s1, widths: [8, 12, 12, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 8, 8] },
        { name: '使用说明', aoa: s2, widths: [90] }
      ]), `${ex.name}-成绩导入模板.xlsx`);
      App.toast('模板已下载', 'ok');
    },

    /* ================= 分班导入 ================= */
    importForClass(ex, classId) {
      App.pickFile({ accept: '.xlsx,.xls,.csv' }).then(file => {
        if (!file) return;
        this.importFromFile(ex, classId, file);
      });
    },
    // 完整导入流程（file → 解析 → 预览 → 确认保存），供 UI 与测试调用
    async importFromFile(ex, classId, file) {
      try {
        const wb = await App.readWorkbook(file);
        const rows = App.workbookToRows(wb);
        const roster = DB().getClass(classId);
        const parsed = this.parseScoreRows(rows, roster, classId, ex.fullMarks || App.DEFAULT_FULL);
        if (parsed.error) { App.toast(parsed.error, 'err'); return null; }
        this.showImportPreview(ex, classId, parsed);
        return parsed;
      } catch (e) { App.toast('导入失败：' + e.message, 'err'); return null; }
    },

    // 解析成绩行（纯函数，可测试）：返回 {records, matched, unmatched, total, error}
    parseScoreRows(rows, roster, classId, fullMarks) {
      if (!rows || !rows.length) return { error: '文件为空' };
      let hi = -1;
      for (let i = 0; i < Math.min(rows.length, 15); i++) {
        const cells = rows[i].map(c => String(c == null ? '' : c));
        if (cells.some(c => /学号|学籍号|编号/.test(c)) && cells.some(c => /姓名|名字/.test(c))) { hi = i; break; }
      }
      if (hi < 0) return { error: '未找到表头（需包含「学号」「姓名」列）' };
      const header = rows[hi].map(c => String(c == null ? '' : c).trim());
      const findCol = (...kws) => {
        for (let i = 0; i < header.length; i++) {
          const h = header[i];
          if (!h) continue;
          if (kws.some(k => h === k || h.includes(k) || k.includes(h))) return i;
        }
        return -1;
      };
      const iNo = findCol('学号'), iName = findCol('姓名');
      const colMap = {}; // itemKey → col index
      App.ITEM_KEYS.forEach(k => { const ci = findCol(...App.itemAliases(k)); if (ci >= 0) colMap[k] = ci; });
      const iTotal = findCol('总分'), iRank = findCol('排名');

      const records = [];
      const unmatched = [];
      for (let r = hi + 1; r < rows.length; r++) {
        const cells = rows[r].map(c => String(c == null ? '' : c).trim());
        const no = iNo >= 0 ? cells[iNo] : '';
        const name = iName >= 0 ? cells[iName] : '';
        if (!no && !name) continue;
        const rec = { studentId: null, no, name, rank: null };
        let hasAny = false;
        App.ITEM_KEYS.forEach(k => {
          const v = colMap[k] != null ? App.num(cells[colMap[k]]) : null;
          rec[k] = v;
          if (v != null) hasAny = true;
        });
        let total = iTotal >= 0 ? App.num(cells[iTotal]) : null;
        if (!hasAny) {
          // 各题型全空 → 缺考：忽略总分列的 0，不计入统计
          total = null;
          rec.absent = true;
        } else if (total == null) {
          total = App.ITEM_KEYS.reduce((s, k) => s + (rec[k] || 0), 0);
        }
        rec.total = total;
        rec.rank = iRank >= 0 ? App.num(cells[iRank]) : null;
        // 匹配学生档案：优先学号，其次姓名
        if (roster && roster.students) {
          let stu = roster.students.find(s => s.no === no);
          if (!stu && !no) stu = roster.students.find(s => s.name === name);
          if (stu) rec.studentId = stu.id; else unmatched.push({ no, name });
        }
        records.push(rec);
      }
      if (!records.length) return { error: '表格中没有有效成绩行（学号/姓名均为空的行已跳过）' };
      return { records, unmatched, matched: records.length - unmatched.length, total: records.length, error: null };
    },

    showImportPreview(ex, classId, parsed) {
      const cls = DB().getClass(classId);
      const oldN = ((ex.scores || {})[classId] || []).length;
      const sample = parsed.records.slice(0, 8).map(r =>
        `<tr><td>${App.esc(r.no)}</td><td>${App.esc(r.name)}</td>${App.ITEM_KEYS.map(k => `<td class="num">${r[k] != null ? App.fmt(r[k]) : '—'}</td>`).join('')}<td class="num"><b>${r.total != null ? App.fmt(r.total) : '—'}</b></td></tr>`).join('');
      const unm = parsed.unmatched.slice(0, 6).map(u => `${App.esc(u.name)}(${App.esc(u.no || '无学号')})`).join('、');
      const body = `
      <div class="flex mb12">
        <span class="badge green">解析 ${parsed.total} 条</span>
        <span class="badge green">匹配学生 ${parsed.matched} 条</span>
        ${parsed.unmatched.length ? `<span class="badge orange">未匹配 ${parsed.unmatched.length} 条</span>` : ''}
        ${oldN ? `<span class="badge red">将覆盖原 ${oldN} 条</span>` : ''}
      </div>
      <div class="tbl-wrap" style="max-height:280px;overflow:auto">
        <table class="tbl"><thead><tr><th>学号</th><th>姓名</th>${App.ITEMS.map(i => `<th class="num">${i.label}</th>`).join('')}<th class="num">总分</th></tr></thead>
        <tbody>${sample}</tbody></table>
      </div>
      ${unm ? `<div class="small muted mt8">⚠️ 未匹配到班级档案的学生（导入后仍保留，可在查看/编辑中手动关联）：${unm}</div>` : ''}
      <div class="small muted mt8">💡 「总分」「排名」留空的行已自动计算；导入后可用「重新计算排名」一键更新。</div>`;
      App.modal({
        title: `导入成绩 → ${cls ? cls.name : classId + '班'} · 预览`,
        body, wide: true,
        foot: `<button class="btn btn-ghost" onclick="EJWP.modalClose()">取消</button>
               <button class="btn btn-primary" id="ipOk">确认导入 ${parsed.total} 条</button>`
      });
      App.$('#ipOk').onclick = () => {
        this.importRecords(ex, classId, parsed.records);
        App.modalClose();
        App.toast(`已导入 ${parsed.total} 条成绩到${cls ? cls.name : classId + '班'}`, 'ok');
        this.renderExam(App.$('#gradesView'));
      };
    },

    // 保存导入结果（纯数据操作）
    importRecords(ex, classId, records) {
      if (!ex.scores) ex.scores = {};
      ex.scores[classId] = records;
      this.ensureRanks(ex, classId);
      DB().save('导入成绩');
    },

    // 计算班内排名（并列同名次，如 1,1,3），只填补缺失/标记重算
    ensureRanks(ex, classId) {
      const recs = (ex.scores || {})[classId] || [];
      const hasVal = recs.filter(r => r.total != null);
      const need = recs.some(r => r.rank == null);
      if (!hasVal.length) return;
      const sorted = [...hasVal].sort((a, b) => b.total - a.total);
      let prev = null, prevRank = 0;
      sorted.forEach((r, i) => {
        if (prev != null && r.total === prev) r.rank = prevRank;
        else { r.rank = i + 1; prevRank = i + 1; }
        prev = r.total;
      });
      if (need) DB().save('更新排名');
    },

    /* ================= 整表导入（一个文件含多个班） ================= */
    importAll(ex) {
      App.pickFile({ accept: '.xlsx,.xls,.csv' }).then(file => {
        if (!file) return;
        App.readWorkbook(file).then(wb => {
          const rows = App.workbookToRows(wb);
          // 找班级列
          let hi = -1, iCls = -1;
          for (let i = 0; i < Math.min(rows.length, 15); i++) {
            const cells = rows[i].map(c => String(c == null ? '' : c));
            const ci = cells.findIndex(c => /班级|班别|班$/.test(c));
            if (ci >= 0 && cells.some(c => /学号/.test(c))) { hi = i; iCls = ci; break; }
          }
          if (hi < 0 || iCls < 0) { App.toast('整表导入需包含「班级」「学号」列，或改用各班「导入成绩」按钮', 'err'); return; }
          const groups = {};
          for (let r = hi + 1; r < rows.length; r++) {
            const cells = rows[r].map(c => String(c == null ? '' : c).trim());
            const clsCell = cells[iCls];
            if (!clsCell) continue;
            const cid = App.parseClassNo(clsCell);
            if (!cid) continue;
            if (!ex.classIds.includes(cid)) continue;
            (groups[cid] = groups[cid] || []).push(rows[r]);
          }
          const cids = Object.keys(groups);
          if (!cids.length) { App.toast('文件中没有匹配的班级数据', 'err'); return; }
          const parsedAll = {};
          cids.forEach(cid => {
            const roster = DB().getClass(cid);
            const sub = [rows[hi], ...groups[cid]];
            parsedAll[cid] = this.parseScoreRows(sub, roster, cid, ex.fullMarks || App.DEFAULT_FULL);
          });
          const errs = Object.values(parsedAll).filter(p => p.error);
          if (errs.length) { App.toast('解析失败：' + errs[0].error, 'err'); return; }
          const lines = cids.map(cid => {
            const p = parsedAll[cid];
            return `<tr><td><b>${App.esc(DB().getClass(cid) ? DB().getClass(cid).name : cid + '班')}</b></td><td class="num">${p.total}</td><td class="num">${p.matched}</td><td class="num">${p.unmatched.length}</td></tr>`;
          }).join('');
          App.modal({
            title: '整表导入 · 预览',
            body: `<div class="small muted mb12">共识别 <b>${cids.length}</b> 个班的成绩：</div>
              <div class="tbl-wrap"><table class="tbl"><thead><tr><th>班级</th><th class="num">行数</th><th class="num">匹配学生</th><th class="num">未匹配</th></tr></thead><tbody>${lines}</tbody></table></div>`,
            foot: `<button class="btn btn-ghost" onclick="EJWP.modalClose()">取消</button><button class="btn btn-primary" id="iaOk">确认导入全部</button>`
          });
          App.$('#iaOk').onclick = () => {
            cids.forEach(cid => this.importRecords(ex, cid, parsedAll[cid].records));
            App.modalClose();
            App.toast(`整表导入完成：${cids.length} 个班`, 'ok');
            this.renderExam(App.$('#gradesView'));
          };
        }).catch(e => App.toast('导入失败：' + e.message, 'err'));
      });
    },

    /* ================= 查看 / 编辑成绩 ================= */
    editClassScores(ex, classId) {
      const cls = DB().getClass(classId);
      // 未保存的编辑暂存，避免增删行后重新渲染丢失
      if (!(this._pending && this._pending.examId === ex.id && this._pending.classId === classId)) {
        this._pending = { examId: ex.id, classId, recs: [...((ex.scores || {})[classId] || [])] };
      }
      const recs = this._pending.recs;
      const roster = cls ? cls.students : [];
      const importedIds = new Set(recs.map(r => r.studentId));
      const pool = roster.filter(s => !importedIds.has(s.id));
      const rowHtml = (r, i) => `<tr data-row="${i}">
        <td>${App.esc(r.no || '—')}</td><td><b>${App.esc(r.name)}</b></td>
        ${App.ITEM_KEYS.map(k => `<td><input type="number" class="cell" data-k="${k}" value="${r[k] != null ? r[k] : ''}" style="width:58px;padding:4px 6px;border:1px solid var(--line);border-radius:6px"></td>`).join('')}
        <td class="num"><b class="cell-total">${r.total != null ? App.fmt(r.total) : '—'}</b></td>
        <td class="num"><span class="cell-rank">${r.rank == null ? '—' : r.rank}</span></td>
        <td><button class="btn btn-xs btn-danger" data-del="${i}">🗑</button></td></tr>`;
      const rowsHtml = recs.length ? recs.map(rowHtml).join('') :
        `<tr><td colspan="16" style="text-align:center;color:#8aa096;padding:24px">还没有成绩，点「添加学生行」从班级名单选择，或直接用「导入成绩」上传 Excel</td></tr>`;
      const body = `
      <div class="flex mb12">
        <span class="badge green">${cls ? cls.name : classId + '班'} · ${recs.length} 人</span>
        <div class="spacer"></div>
        <button class="btn btn-xs btn-ghost" id="esAdd">➕ 添加学生行</button>
        <button class="btn btn-xs btn-ghost" id="esRecalc">🧮 重新计算总分/排名</button>
        <button class="btn btn-xs btn-danger" id="esClear">清空本班</button>
      </div>
      <div class="tbl-wrap" style="max-height:56vh;overflow:auto">
        <table class="tbl"><thead><tr>
          <th>学号</th><th>姓名</th>
          ${App.ITEMS.map(i => `<th class="num">${i.label}<br><span class="small" style="color:var(--mint-600)">满分${ex.fullMarks ? (ex.fullMarks[i.key] ?? 0) : 0}</span></th>`).join('')}
          <th class="num">总分</th><th class="num">排名</th><th></th>
        </tr></thead><tbody id="esBody">${rowsHtml}</tbody></table>
      </div>
      ${pool.length ? `<div class="small muted mt8">可添加的学生：${pool.slice(0, 8).map(s => App.esc(s.name)).join('、')}${pool.length > 8 ? '…' : ''}</div>` : ''}`;
      App.modal({
        title: `查看 / 编辑成绩 · ${ex.name}`,
        body, wide: true,
        foot: `<button class="btn btn-ghost" onclick="EJWP.modalClose()">取消</button><button class="btn btn-primary" id="esSave">💾 保存</button>`
      });
      const sync = () => {
        [...App.$$('#esBody tr')].forEach(tr => {
          const total = App.ITEM_KEYS.reduce((s, k) => s + (App.num(tr.querySelector(`input[data-k="${k}"]`).value) || 0), 0);
          tr.querySelector('.cell-total').textContent = total || '—';
        });
      };
      App.$$('#esBody input').forEach(inp => inp.oninput = sync);
      App.$('#esAdd').onclick = () => {
        if (!pool.length) { App.toast('班级名单里的学生都已添加', 'err'); return; }
        const opts = pool.map(s => `<option value="${s.id}">${App.esc(s.name)}（${App.esc(s.no || '无学号')}）</option>`).join('');
        App.modal({
          title: '添加学生',
          body: `<div class="field"><label>选择学生</label><select id="esPick">${opts}</select></div>`,
          foot: `<button class="btn btn-ghost" onclick="EJWP.modalClose()">取消</button><button class="btn btn-primary" id="esPickOk">添加</button>`
        });
        App.$('#esPickOk').onclick = () => {
          const sid = App.$('#esPick').value;
          const s = roster.find(x => x.id === sid);
          if (s) { recs.push({ studentId: s.id, no: s.no, name: s.name, rank: null }); }
          App.modalClose(); this.editClassScores(ex, classId);
        };
      };
      App.$('#esRecalc').onclick = () => {
        [...App.$$('#esBody tr')].forEach(tr => {
          App.ITEM_KEYS.forEach(k => {
            const v = App.num(tr.querySelector(`input[data-k="${k}"]`).value);
            if (v != null) tr.querySelector(`input[data-k="${k}"]`).value = v;
          });
        });
        sync(); App.toast('请在保存后查看排名（按总分自动重算）', 'ok');
      };
      App.$('#esClear').onclick = () => {
        if (recs.length) { recs.length = 0; this.editClassScores(ex, classId); }
      };
      App.$('#esBody').addEventListener('click', e => {
        const btn = e.target.closest('[data-del]');
        if (!btn) return;
        recs.splice(+btn.dataset.del, 1);
        this.editClassScores(ex, classId);
      });
      App.$('#esSave').onclick = () => {
        const out = [];
        [...App.$$('#esBody tr')].forEach(tr => {
          const row = recs[+tr.dataset.row];
          if (!row) return;
          const rec = { studentId: row.studentId, no: row.no, name: row.name, rank: null };
          App.ITEM_KEYS.forEach(k => {
            const v = App.num(tr.querySelector(`input[data-k="${k}"]`).value);
            rec[k] = v;
          });
          // 所有题型都空 → 视为缺考，总分记 null（不计入统计）
          const hasAny = App.ITEM_KEYS.some(k => rec[k] != null);
          rec.total = hasAny ? App.ITEM_KEYS.reduce((s, k) => s + (rec[k] || 0), 0) : null;
          if (!hasAny) rec.absent = true; else delete rec.absent;
          out.push(rec);
        });
        if (!ex.scores) ex.scores = {};
        ex.scores[classId] = out;
        this.ensureRanks(ex, classId);
        this._pending = null;
        DB().save('保存成绩');
        App.modalClose();
        App.toast('成绩已保存', 'ok');
        this.renderExam(App.$('#gradesView'));
      };
    },

    exportClassScores(ex, classId) {
      const recs = (ex.scores || {})[classId] || [];
      const cls = DB().getClass(classId);
      const aoa = [TEMPLATE_HEADER,
        ...recs.map(r => [cls ? cls.name : classId + '班', r.no || '', r.name || '', ...App.ITEM_KEYS.map(k => r[k] != null ? r[k] : ''), r.total != null ? r.total : '', r.rank != null ? r.rank : ''])];
      App.downloadXlsx(aoa, `${ex.name}-${cls ? cls.name : classId + '班'}成绩.xlsx`, { widths: [8, 12, 12, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 8, 8] });
      App.toast('本班成绩已导出', 'ok');
    },

    clearClassScores(ex, classId) {
      const n = ((ex.scores || {})[classId] || []).length;
      if (!n) { App.toast('本班还没有成绩', 'err'); return; }
      App.confirm({
        title: '清空本班成绩', danger: true, okText: '清空',
        message: `确定清空 ${App.esc(DB().getClass(classId) ? DB().getClass(classId).name : classId + '班')} 的 ${n} 条成绩吗？此操作不可撤销。`,
        onOk: () => { delete ex.scores[classId]; DB().save('清空成绩'); App.toast('已清空', 'ok'); this.renderExam(App.$('#gradesView')); }
      });
    },

    /* ================= 统计分析 ================= */
    thresholds() {
      const st = DB().state.settings;
      const t = this.anThr || {};
      return { pass: t.passPct ?? st.passPct, good: t.goodPct ?? st.goodPct, low: t.lowPct ?? st.lowPct };
    },

    // 计算一个班某题型/总分的统计指标（纯函数）
    computeClassStats(recs, fullMarks, thr) {
      const all = recs || [];
      // 缺考 / 未录入的学生不纳入统计（不算入最低分、平均分、参考人数等）
      const valid = all.filter(r => !App.isAbsent(r));
      const keys = [...App.ITEM_KEYS, 'total'];
      const res = {};
      keys.forEach(k => {
        const vals = valid.map(r => App.num(r[k]));
        const st = App.statsOf(vals);
        const fm = k === 'total' ? App.fullTotal(fullMarks) : (fullMarks ? (fullMarks[k] || 0) : 0);
        const cnt = st.count;
        const pass = vals.filter(v => v != null && fm && v >= fm * thr.pass / 100).length;
        const good = vals.filter(v => v != null && fm && v >= fm * thr.good / 100).length;
        const low = vals.filter(v => v != null && fm && v < fm * thr.low / 100).length;
        res[k] = {
          ...st,
          passRate: cnt ? pass / cnt : null,
          goodRate: cnt ? good / cnt : null,
          lowRate: cnt ? low / cnt : null,
          passN: pass, goodN: good, lowN: low,
          rate: fm ? (st.avg != null ? st.avg / fm : null) : null
        };
      });
      res.absentN = all.length - valid.length;   // 缺考人数
      res.totalRecs = all.length;                // 含缺考的总记录数
      return res;
    },

    // 指标取值格式化
    metricVal(st, m) {
      if (!st) return '—';
      const v = st[m];
      if (v == null || isNaN(v)) return '—';
      if (m === 'passRate' || m === 'goodRate' || m === 'lowRate' || m === 'rate') return App.fmtPct(v);
      return App.fmt(v);
    },

    /* ============ 试卷质量分析（难度 / 区分度） ============ */
    // 难度 = 平均分/满分；区分度 = (前27%高分组均分 − 后27%低分组均分)/满分
    computeItemQuality(recs, fullMarks) {
      const withTotal = (recs || []).filter(r => r.total != null);
      const n = withTotal.length;
      if (n < 2) return { error: '参考人数不足（至少 2 人），无法计算区分度' };
      const sorted = [...withTotal].sort((a, b) => b.total - a.total);
      const k = Math.max(1, Math.round(n * 0.27));
      const high = sorted.slice(0, k), low = sorted.slice(-k);
      const avgOf = (group, key) => group.reduce((s, r) => s + (r[key] != null ? r[key] : 0), 0) / group.length;
      const rows = App.ITEM_KEYS.map(key => {
        const fm = fullMarks ? (fullMarks[key] || 0) : 0;
        if (!fm) return { key, label: App.itemLabel(key), full: 0, avg: null, difficulty: null, discrimination: null, advice: '未设置满分' };
        const avg = avgOf(withTotal, key);
        const diff = avg / fm;
        const disc = (avgOf(high, key) - avgOf(low, key)) / fm;
        return { key, label: App.itemLabel(key), full: fm, avg, difficulty: diff, discrimination: disc, advice: this.qualityAdvice(diff, disc) };
      });
      const fmT = App.fullTotal(fullMarks);
      const avgT = avgOf(withTotal, 'total');
      rows.push({ key: 'total', label: '总分', full: fmT, avg: avgT, difficulty: avgT / fmT, discrimination: (avgOf(high, 'total') - avgOf(low, 'total')) / fmT, advice: this.qualityAdvice(avgT / fmT, (avgOf(high, 'total') - avgOf(low, 'total')) / fmT) });
      return { rows, highN: k, lowN: k, totalN: n, highAvg: avgOf(high, 'total'), lowAvg: avgOf(low, 'total') };
    },
    qualityAdvice(diff, disc) {
      const d = diff == null ? '—' : (diff >= .85 ? '偏易' : diff >= .7 ? '较易' : diff >= .4 ? '适中' : diff >= .2 ? '较难' : '偏难');
      const g = disc == null ? '—' : (disc >= .4 ? '区分度优秀' : disc >= .3 ? '区分度良好' : disc >= .2 ? '区分度尚可' : '区分度差');
      return `${d} · ${g}`;
    },

    metricName(m) {
      return { avg: '平均分', max: '最高分', min: '最低分', range: '班内分差', median: '中位数', passRate: '及格率', goodRate: '优秀率', lowRate: '低分率', rate: '得分率' }[m] || m;
    },

    /* ================= 单班成绩分析（同层次对比） ================= */
    // 计算单班的对比基准：默认同层次其他班，无分层则全年级其他班
    _classCompare(ex, classId) {
      const tier = App.tierOf(classId);
      const tierIds = tier ? App.tierMembers(tier).filter(id => ex.classIds.includes(String(id))) : [];
      let cmpIds = [], cmpLabel = '全年级';
      if (tier) {
        const others = tierIds.filter(id => String(id) !== String(classId));
        if (others.length) { cmpIds = others; cmpLabel = tier + ' 层其他班'; }
      }
      if (!cmpIds.length) {
        const others = ex.classIds.filter(id => String(id) !== String(classId));
        if (others.length) { cmpIds = others; cmpLabel = '全年级其他班'; }
        else { cmpIds = ex.classIds.slice(); cmpLabel = '全年级'; }
      }
      const cmpRecs = [];
      cmpIds.forEach(cid => cmpRecs.push(...((ex.scores || {})[cid] || [])));
      return { tier, tierIds, cmpIds, cmpLabel, cmpRecs };
    },

    renderClassAnalysis(v) {
      const parts = this.view.split(':');
      const exId = parts[1], classId = parts[2];
      const ex = DB().state.exams.find(x => x.id === exId);
      if (!ex) { this.view = 'list'; this.render(); return; }
      const cls = DB().getClass(classId);
      const clsLabel = cls ? cls.name : classId + '班';
      const recs = (ex.scores || {})[classId] || [];
      const thr = this.thresholds();
      const full = App.fullTotal(ex.fullMarks);

      // —— 对比基准（同层次）——
      const cmpInfo = this._classCompare(ex, classId);
      const { tier, tierIds, cmpLabel, cmpRecs } = cmpInfo;
      const cs = this.computeClassStats(recs, ex.fullMarks, thr);
      const gs = this.computeClassStats(cmpRecs, ex.fullMarks, thr);

      // 统计摘要（含与同层次的差值）
      const diffText = (mine, ref, isPct) => {
        if (mine == null || ref == null) return '';
        const d = isPct ? (mine - ref) * 100 : (mine - ref);
        const sign = d >= 0 ? '+' : '';
        const color = d >= 0 ? '#249966' : '#d64545';
        return ` <span style="font-size:11px;color:${color}">(${sign}${App.fmt(d, 1)}${isPct ? '%' : ''})</span>`;
      };
      const statCards = [
        ['参考人数', cs.total.count + ' 人' + (cs.absentN ? `（缺考 ${cs.absentN} 人）` : ''), ''],
        ['平均分', App.fmt(cs.total.avg), diffText(cs.total.avg, gs.total.avg, false)],
        ['最高分', cs.total.max != null ? cs.total.max : '—', gs.total.max != null ? ` <span style="font-size:11px;color:#7c9185">(${cmpLabel} ${gs.total.max})</span>` : ''],
        ['最低分', cs.total.min != null ? cs.total.min : '—', gs.total.min != null ? ` <span style="font-size:11px;color:#7c9185">(${cmpLabel} ${gs.total.min})</span>` : ''],
        ['中位数', App.fmt(cs.total.median), diffText(cs.total.median, gs.total.median, false)],
        ['优秀率', App.fmtPct(cs.total.goodRate), diffText(cs.total.goodRate, gs.total.goodRate, true)],
        ['及格率', App.fmtPct(cs.total.passRate), diffText(cs.total.passRate, gs.total.passRate, true)],
        ['低分率', App.fmtPct(cs.total.lowRate), diffText(cs.total.lowRate, gs.total.lowRate, true)]
      ].map(([k, val, extra]) => `<div class="stat-item"><div class="k">${k}</div><div class="v">${val}${extra}</div></div>`).join('');

      // —— 同层次各班对比表 ——
      let tierTable = '';
      if (tier && tierIds.length) {
        const tierAll = [];
        tierIds.forEach(cid => tierAll.push(...((ex.scores || {})[cid] || [])));
        const ts = this.computeClassStats(tierAll, ex.fullMarks, thr).total;
        const rows = tierIds.map(cid => {
          const st = this.computeClassStats((ex.scores || {})[cid] || [], ex.fullMarks, thr).total;
          const isSelf = String(cid) === String(classId);
          const nm = (DB().getClass(cid) || { name: cid + '班' }).name;
          return `<tr${isSelf ? ' class="row-top"' : ''}>
            <td>${isSelf ? '▶ ' : ''}<b>${App.esc(nm)}</b>${isSelf ? ' <span class="badge green">本班</span>' : ''}</td>
            <td class="num">${st.count}</td><td class="num">${App.fmt(st.avg)}</td>
            <td class="num">${st.max != null ? st.max : '—'}</td><td class="num">${st.min != null ? st.min : '—'}</td>
            <td class="num">${App.fmt(st.median)}</td><td class="num">${App.fmtPct(st.goodRate)}</td>
            <td class="num">${App.fmtPct(st.passRate)}</td><td class="num">${App.fmtPct(st.lowRate)}</td></tr>`;
        }).join('');
        const totalRow = `<tr class="row-good"><td>🏆 ${tier} 层合计（${tierIds.length} 个班）</td>
          <td class="num"><b>${ts.count}</b></td><td class="num"><b>${App.fmt(ts.avg)}</b></td>
          <td class="num"><b>${ts.max != null ? ts.max : '—'}</b></td><td class="num"><b>${ts.min != null ? ts.min : '—'}</b></td>
          <td class="num"><b>${App.fmt(ts.median)}</b></td><td class="num"><b>${App.fmtPct(ts.goodRate)}</b></td>
          <td class="num"><b>${App.fmtPct(ts.passRate)}</b></td><td class="num"><b>${App.fmtPct(ts.lowRate)}</b></td></tr>`;
        tierTable = `
      <div class="card">
        <div class="card-title">🏫 同层次各班对比 <span class="hint">（${tier} 层：${tierIds.map(cid => App.esc((DB().getClass(cid) || { name: cid + '班' }).name)).join('、')}）</span></div>
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>班级</th><th class="num">参考人数</th><th class="num">平均分</th><th class="num">最高分</th><th class="num">最低分</th><th class="num">中位数</th><th class="num">优秀率</th><th class="num">及格率</th><th class="num">低分率</th></tr></thead>
          <tbody>${rows}${totalRow}</tbody></table></div>
      </div>`;
      }

      // 排名明细表
      const sorted = [...recs].sort((a, b) => (b.total != null ? b.total : -1) - (a.total != null ? a.total : -1));
      const rankRows = sorted.length ? sorted.map((r, i) => {
        const absent = App.isAbsent(r);
        return `<tr${absent ? ' style="color:#a4b8ac"' : ''}>
        <td class="num">${absent ? '缺考' : (r.rank != null ? r.rank : i + 1)}</td><td>${App.esc(r.no || '—')}</td><td><b>${App.esc(r.name)}</b></td>
        ${App.ITEM_KEYS.map(k => `<td class="num">${absent ? '—' : (r[k] != null ? App.fmt(r[k]) : '—')}</td>`).join('')}
        <td class="num"><b>${absent ? '缺考' : (r.total != null ? App.fmt(r.total) : '—')}</b></td></tr>`;
      }).join('')
        : '<tr><td colspan="13" style="text-align:center;color:#8aa096;padding:22px">本班还没有成绩，请先「导入成绩」</td></tr>';

      v.innerHTML = `
      <div class="crumb"><button data-act="backExam">← 返回 ${App.esc(ex.name)}</button><span>/</span><b>${App.esc(clsLabel)} · 成绩分析</b></div>
      <div class="card">
        <div class="flex">
          <div class="card-title" style="margin:0;font-size:19px">📈 ${App.esc(clsLabel)} · 成绩分析</div>
          <div class="spacer"></div>
          ${tier ? `<span class="badge green">${tier} 层</span>` : '<span class="badge gray">未分层</span>'}
          <span class="badge green">${App.esc(ex.name)}</span>
          <span class="badge gray">满分 ${full} 分</span>
          <button class="btn btn-ghost btn-sm" data-act="exportClassAnalysis">📊 导出本班分析 Excel</button>
          <button class="btn btn-primary btn-sm" data-act="exportClassPdf">📄 导出 PDF 报告</button>
        </div>
        <div class="stat-strip mt12">${statCards}</div>
        <div class="small muted mt8">💡 下图与表均为「本班」与「${App.esc(cmpLabel)}」对比${tier ? `（分层可在设置中调整）` : '（未配置班级分层，可在设置中配置）'}</div>
      </div>
${tierTable}
      <div class="chart-grid">
        <div class="chart-card">
          <h4>🕸 各题型得分率（本班 vs ${App.esc(cmpLabel)}）
            <span><button class="btn btn-xs btn-ghost" data-act="pngCaRadar">⬇ PNG</button></span>
          </h4>
          <div class="chart-box tall"><canvas id="chCaRadar"></canvas></div>
        </div>
        <div class="chart-card">
          <h4>📊 各题型平均分（本班 vs ${App.esc(cmpLabel)}）
            <span><button class="btn btn-xs btn-ghost" data-act="pngCaRate">⬇ PNG</button></span>
          </h4>
          <div class="chart-box tall"><canvas id="chCaRate"></canvas></div>
        </div>
        <div class="chart-card">
          <h4>📦 总分分布箱线图（本班 vs ${App.esc(cmpLabel)}）
            <span><button class="btn btn-xs btn-ghost" data-act="pngCaBox">⬇ PNG</button></span>
          </h4>
          <div class="chart-box"><canvas id="chCaBox"></canvas></div>
        </div>
        <div class="chart-card">
          <h4>🔢 各分段人数（本班 vs ${App.esc(cmpLabel)}）
            <span><button class="btn btn-xs btn-ghost" data-act="pngCaHist">⬇ PNG</button></span>
          </h4>
          <div class="chart-box tall"><canvas id="chCaHist"></canvas></div>
        </div>
      </div>
      <div class="card">
        <div class="card-title">🏆 本班成绩排名明细</div>
        <div class="tbl-wrap" style="max-height:420px;overflow:auto">
          <table class="tbl"><thead><tr>
            <th class="num">排名</th><th>学号</th><th>姓名</th>
            ${App.ITEMS.map(i => `<th class="num">${i.label}</th>`).join('')}
            <th class="num">总分</th>
          </tr></thead><tbody>${rankRows}</tbody></table>
        </div>
      </div>`;

      App.delegate(v, {
        click: {
          backExam: () => { this.view = 'exam:' + ex.id; this.render(); },
          exportClassAnalysis: () => this.exportClassAnalysis(ex, classId),
          exportClassPdf: () => this.exportClassAnalysisPDF(ex, classId),
          pngCaRadar: () => this.exportChartPNG('chCaRadar'),
          pngCaRate: () => this.exportChartPNG('chCaRate'),
          pngCaBox: () => this.exportChartPNG('chCaBox'),
          pngCaHist: () => this.exportChartPNG('chCaHist')
        }
      });

      // —— 绘制图表（本班 vs 同层次）——
      const clsTotals = recs.map(r => App.num(r.total)).filter(v => v != null);
      const cmpTotals = cmpRecs.map(r => App.num(r.total)).filter(v => v != null);

      // 1. 雷达图：各题型得分率
      App.newChart(App.$('#chCaRadar'), {
        type: 'radar',
        data: {
          labels: App.ITEMS.map(i => i.label),
          datasets: [
            { label: clsLabel, data: App.ITEM_KEYS.map(k => cs[k].rate != null ? +(cs[k].rate * 100).toFixed(1) : 0), borderColor: '#249966', backgroundColor: 'rgba(36,153,102,.15)', pointRadius: 3 },
            { label: cmpLabel, data: App.ITEM_KEYS.map(k => gs[k].rate != null ? +(gs[k].rate * 100).toFixed(1) : 0), borderColor: '#d9a013', backgroundColor: 'rgba(217,160,19,.10)', pointRadius: 2, borderDash: [6, 4] }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'top' }, tooltip: { callbacks: { label: c => c.dataset.label + '：' + c.parsed.r + '%' } } },
          scales: { r: { min: 0, max: 100, ticks: { stepSize: 20, callback: v => v + '%' }, pointLabels: { font: { size: 11 } } } }
        }
      });
      // 2. 各题型平均分分组柱状（含总分）
      App.newChart(App.$('#chCaRate'), {
        type: 'bar',
        data: {
          labels: [...App.ITEMS.map(i => i.label), '总分'],
          datasets: [
            { label: clsLabel, data: [...App.ITEM_KEYS.map(k => cs[k].avg != null ? +cs[k].avg.toFixed(1) : 0), cs.total.avg != null ? +cs.total.avg.toFixed(1) : 0], backgroundColor: '#34b57e' },
            { label: cmpLabel, data: [...App.ITEM_KEYS.map(k => gs[k].avg != null ? +gs[k].avg.toFixed(1) : 0), gs.total.avg != null ? +gs.total.avg.toFixed(1) : 0], backgroundColor: '#f0b429' }
          ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true } } }
      });
      // 3. 箱线图：本班 vs 同层次
      const boxOk = window.ChartBoxPlot || (Chart && Chart.BoxPlotController);
      if (boxOk) {
        App.newChart(App.$('#chCaBox'), {
          type: 'boxplot',
          data: {
            labels: [clsLabel, cmpLabel],
            datasets: [{
              label: '总分分布',
              data: [App.boxplotData(clsTotals), App.boxplotData(cmpTotals)],
              backgroundColor: 'rgba(52,181,126,.35)',
              borderColor: '#249966', borderWidth: 1.5, outlierColor: '#d64545', itemRadius: 3
            }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => {
              const d = c.raw || {};
              return `最高 ${d.max ?? '—'} · Q3 ${d.q3 != null ? +d.q3.toFixed(1) : '—'} · 中位 ${d.median ?? '—'} · Q1 ${d.q1 != null ? +d.q1.toFixed(1) : '—'} · 最低 ${d.min ?? '—'}${(d.outliers || []).length ? ' · 离群 ' + d.outliers.length + ' 人' : ''}`;
            } } } },
            scales: { y: { beginAtZero: true, suggestedMax: full, title: { display: true, text: '总分' } } }
          }
        });
      } else {
        const b = App.$('#chCaBox'); if (b) b.parentElement.innerHTML = '<div style="padding:40px;text-align:center;color:#8aa096">箱线图插件未加载</div>';
      }
      // 4. 各分段人数（本班 vs 同层次）
      const segs = App.scoreSegments(full);
      const countSeg = (arr) => segs.map((_, si) => arr.reduce((s, r) => s + (App.scoreBinIndex(App.num(r.total), full) === si ? 1 : 0), 0));
      App.newChart(App.$('#chCaHist'), {
        type: 'bar',
        data: {
          labels: segs.map(s => s.label),
          datasets: [
            { label: clsLabel, data: countSeg(recs), backgroundColor: '#34b57e' },
            { label: cmpLabel, data: countSeg(cmpRecs), backgroundColor: '#f0b429' }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'top' }, tooltip: { callbacks: { label: c => c.dataset.label + '：' + c.parsed.y + ' 人' } } },
          scales: { x: { title: { display: true, text: '分数段（从高到低）' } }, y: { beginAtZero: true, title: { display: true, text: '人数' } } }
        }
      });
    },

    exportClassAnalysis(ex, classId) {
      const cls = DB().getClass(classId);
      const clsLabel = cls ? cls.name : classId + '班';
      const recs = (ex.scores || {})[classId] || [];
      const thr = this.thresholds();
      const full = App.fullTotal(ex.fullMarks);
      const cmpInfo = this._classCompare(ex, classId);
      const { tier, tierIds, cmpLabel, cmpRecs } = cmpInfo;
      const cs = this.computeClassStats(recs, ex.fullMarks, thr);
      const gs = this.computeClassStats(cmpRecs, ex.fullMarks, thr);
      const keyLabel = k => k === 'total' ? '总分' : App.itemLabel(k);
      const keys = [...App.ITEM_KEYS, 'total'];
      const s1 = [['指标', ...keys.map(keyLabel), '平均分', '最高分', '最低分', '中位数', '优秀率', '及格率', '低分率', '得分率'],
        [clsLabel, ...keys.map(k => this.metricVal(cs[k], 'avg')), ...['avg', 'max', 'min', 'median', 'goodRate', 'passRate', 'lowRate', 'rate'].map(m => this.metricVal(cs.total, m))],
        [cmpLabel, ...keys.map(k => this.metricVal(gs[k], 'avg')), ...['avg', 'max', 'min', 'median', 'goodRate', 'passRate', 'lowRate', 'rate'].map(m => this.metricVal(gs.total, m))]];
      const s2 = [[...TEMPLATE_HEADER], ...recs.map(r => [clsLabel, r.no || '', r.name || '', ...App.ITEM_KEYS.map(k => r[k] != null ? r[k] : ''), r.total != null ? r.total : '', r.rank != null ? r.rank : ''])];
      const segs = App.scoreSegments(full);
      const countSeg = arr => segs.map((_, si) => arr.reduce((s, r) => s + (App.scoreBinIndex(App.num(r.total), full) === si ? 1 : 0), 0));
      const s3 = [['分数段', clsLabel, cmpLabel], ...segs.map((seg, si) => [seg.label, countSeg(recs)[si], countSeg(cmpRecs)[si]])];
      // 同层次各班对比
      const sheets = [
        { name: '统计对比', aoa: s1, widths: [10, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9] },
        { name: '成绩明细', aoa: s2, widths: [8, 12, 12, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 8, 8] },
        { name: '各分段人数', aoa: s3, widths: [10, 10, 10] }
      ];
      if (tier && tierIds.length) {
        const s4 = [['班级', '参考人数', '平均分', '最高分', '最低分', '中位数', '优秀率', '及格率', '低分率'],
          ...tierIds.map(cid => {
            const st = this.computeClassStats((ex.scores || {})[cid] || [], ex.fullMarks, thr).total;
            return [(DB().getClass(cid) || { name: cid + '班' }).name, st.count, st.avg != null ? +st.avg.toFixed(1) : '', st.max ?? '', st.min ?? '', st.median != null ? +st.median.toFixed(1) : '', st.goodRate != null ? +(st.goodRate * 100).toFixed(1) + '%' : '', st.passRate != null ? +(st.passRate * 100).toFixed(1) + '%' : '', st.lowRate != null ? +(st.lowRate * 100).toFixed(1) + '%' : ''];
          })];
        sheets.push({ name: tier + '层各班对比', aoa: s4, widths: [10, 10, 9, 9, 9, 9, 9, 9, 9] });
      }
      XLSX.writeFile(App.makeWorkbook(sheets), `${ex.name}-${clsLabel}成绩分析.xlsx`);
      App.toast('本班分析已导出 Excel', 'ok');
    },

    renderAnalysis(v) {
      const ex = this.getExam();
      if (!ex) { this.view = 'list'; this.render(); return; }
      const thr = this.thresholds();
      const allIds = ex.classIds;
      const selIds = this.anClasses ? allIds.filter(id => this.anClasses.has(id)) : allIds;
      const full = App.fullTotal(ex.fullMarks);
      const clsName = cid => (DB().getClass(cid) || { name: cid + '班' }).name;

      // 各班统计（全部班级）
      const statsMap = {};
      allIds.forEach(cid => { statsMap[cid] = this.computeClassStats((ex.scores || {})[cid] || [], ex.fullMarks, thr); });
      const allRecs = [];
      allIds.forEach(cid => allRecs.push(...((ex.scores || {})[cid] || [])));
      const gradeStats = this.computeClassStats(allRecs, ex.fullMarks, thr);

      const td = (x, bold) => `<td class="num">${bold ? '<b>' + x + '</b>' : x}</td>`;
      const tr = (cells, bold) => `<tr${bold ? ' class="row-good"' : ''}>${cells}</tr>`;
      const nameCell = (label, bold) => `<td>${bold ? '🏆 ' : ''}<b>${App.esc(label)}</b></td>`;

      // —— 表格 A：各班成绩总览 ——
      const headA = '<tr><th>班级</th><th class="num">参考人数</th><th class="num">缺考</th><th class="num">平均分</th><th class="num">最高分</th><th class="num">最低分</th><th class="num">中位数</th><th class="num">班内分差</th><th class="num">优秀率</th><th class="num">及格率</th><th class="num">低分率</th><th class="num">得分率</th></tr>';
      const rowA = (st, label, bold, absentN) => tr(nameCell(label, bold) +
        td(st.count, bold) + td(absentN ? absentN : '—', bold) + td(App.fmt(st.avg), bold) + td(st.max != null ? st.max : '—', bold) + td(st.min != null ? st.min : '—', bold) +
        td(App.fmt(st.median), bold) + td(App.fmt(st.range), bold) + td(App.fmtPct(st.goodRate), bold) + td(App.fmtPct(st.passRate), bold) +
        td(App.fmtPct(st.lowRate), bold) + td(App.fmtPct(st.rate), bold), bold);
      const rowsA = allIds.map(cid => rowA(statsMap[cid].total, clsName(cid), false, statsMap[cid].absentN)).join('') + rowA(gradeStats.total, '全年级', true, gradeStats.absentN);

      // —— 表格 B：各班各题型得分率（%）——
      const headB = '<tr><th>班级</th>' + [...App.ITEMS.map(i => `<th class="num">${i.label}</th>`), '<th class="num">总分</th>'].join('') + '</tr>';
      const rowB = (st, label, bold) => tr(nameCell(label, bold) +
        [...App.ITEM_KEYS.map(k => td(App.fmtPct(st[k].rate), bold)), td(App.fmtPct(st.total.rate), bold)].join(''), bold);
      const rowsB = allIds.map(cid => rowB(statsMap[cid], clsName(cid), false)).join('') + rowB(gradeStats, '全年级', true);

      // —— 表格 C：各班总分最高 / 最低 / 中位数 ——
      const headC = '<tr><th>班级</th><th class="num">最高分</th><th class="num">最低分</th><th class="num">中位数</th></tr>';
      const rowC = (st, label, bold) => tr(nameCell(label, bold) +
        td(st.max != null ? st.max : '—', bold) + td(st.min != null ? st.min : '—', bold) + td(App.fmt(st.median), bold), bold);
      const rowsC = allIds.map(cid => rowC(statsMap[cid].total, clsName(cid), false)).join('') + rowC(gradeStats.total, '全年级', true);

      // —— 表格 D：各分段人数（班级 × 分数段）——
      const segs = App.scoreSegments(full);
      const countSeg = (recs, si) => recs.reduce((s, r) => s + (App.scoreBinIndex(App.num(r.total), full) === si ? 1 : 0), 0);
      const headD = '<tr><th>班级</th>' + segs.map(seg => `<th class="num">${seg.label}</th>`).join('') + '<th class="num">合计</th></tr>';
      const rowD = (recs, label, bold) => {
        const validN = recs.filter(r => !App.isAbsent(r)).length;
        return tr(nameCell(label, bold) + segs.map((seg, si) => td(countSeg(recs, si), bold)).join('') + td(validN, bold), bold);
      };
      const rowsD = allIds.map(cid => rowD((ex.scores || {})[cid] || [], clsName(cid), false)).join('') + rowD(allRecs, '全年级', true);

      // —— 试卷质量分析 ——
      const quality = allRecs.length >= 2 ? this.computeItemQuality(allRecs, ex.fullMarks) : null;
      const qualityRows = quality && !quality.error ? quality.rows.map(r => `<tr>
        <td><b>${App.esc(r.label)}</b></td><td class="num">${r.full}</td>
        <td class="num">${r.avg != null ? App.fmt(r.avg, 1) : '—'}</td>
        <td class="num">${r.difficulty != null ? App.fmt(r.difficulty, 2) : '—'}</td>
        <td class="num">${r.discrimination != null ? App.fmt(r.discrimination, 2) : '—'}</td>
        <td>${App.esc(r.advice)}</td></tr>`).join('')
        : `<tr><td colspan="6" style="text-align:center;color:#8aa096;padding:20px">${quality && quality.error ? App.esc(quality.error) : '暂无成绩数据'}</td></tr>`;

      const classChips = allIds.map(cid => `<button class="chip ${selIds.includes(cid) ? 'on' : ''}" data-cls="${cid}">${App.esc(clsName(cid))}</button>`).join('');

      v.innerHTML = `
      <div class="crumb"><button data-act="backExam">← 返回 ${App.esc(ex.name)}</button></div>
      <div class="card">
        <div class="flex mb12">
          <div class="card-title" style="margin:0">📐 ${App.esc(ex.name)} · 成绩分析 <span class="hint">（${App.esc(ex.date)} · 满分 ${full} 分）</span></div>
          <div class="spacer"></div>
          <button class="btn btn-ghost btn-sm" data-act="expAnalysis">📊 导出分析 Excel</button>
          <button class="btn btn-ghost btn-sm" data-act="expPdf">📄 导出 PDF 报告</button>
          <button class="btn btn-primary btn-sm" data-act="expAllPdf">📦 一键打包导出（全年级 + 各班 PDF）</button>
        </div>
        <div class="field"><label>班级筛选（下方图表用）</label><div class="chips">${classChips}</div></div>
        <div class="field"><label>分数线设置（占满分百分比，影响优秀率 / 及格率 / 低分率）</label>
          <div class="flex">
            优秀 ≥ <input type="number" class="thr-inp" data-t="good" value="${thr.good}" style="width:70px;padding:6px 8px;border:1.5px solid var(--line);border-radius:8px">%
            及格 ≥ <input type="number" class="thr-inp" data-t="pass" value="${thr.pass}" style="width:70px;padding:6px 8px;border:1.5px solid var(--line);border-radius:8px">%
            低分 &lt; <input type="number" class="thr-inp" data-t="low" value="${thr.low}" style="width:70px;padding:6px 8px;border:1.5px solid var(--line);border-radius:8px">%
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">📊 各班成绩总览（总分）</div>
        <div class="tbl-wrap"><table class="tbl"><thead>${headA}</thead><tbody>${rowsA}</tbody></table></div>
      </div>

      <div class="card">
        <div class="card-title">🧩 各班各题型得分率对比（%）</div>
        <div class="tbl-wrap"><table class="tbl"><thead>${headB}</thead><tbody>${rowsB}</tbody></table></div>
      </div>

      <div class="card">
        <div class="card-title">📈 各班总分最高 / 最低 / 中位数</div>
        <div class="tbl-wrap"><table class="tbl"><thead>${headC}</thead><tbody>${rowsC}</tbody></table></div>
      </div>

      <div class="card">
        <div class="card-title">🔢 各分段人数 <span class="hint">（120-110 · 110-100 · … · 40-30 · 30-0）</span></div>
        <div class="tbl-wrap"><table class="tbl"><thead>${headD}</thead><tbody>${rowsD}</tbody></table></div>
      </div>

      <div class="card">
        <div class="card-title">🧪 试卷质量分析 <span class="hint">（难度系数 = 平均分 ÷ 满分；区分度 = 高分组前 27% 均分 − 低分组后 27% 均分 ÷ 满分）</span></div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>题型</th><th class="num">满分</th><th class="num">平均分</th><th class="num">难度系数</th><th class="num">区分度</th><th>诊断建议</th></tr></thead><tbody>${qualityRows}</tbody></table></div>
      </div>

      <div class="chart-grid">
        <div class="chart-card wide">
          <h4>🏆 各班总分平均分对比（含年级平均）
            <span class="flex"><button class="btn btn-xs btn-ghost" data-act="pngAvg">⬇ PNG</button></span>
          </h4>
          <div class="chart-box"><canvas id="chAvg"></canvas></div>
        </div>
        <div class="chart-card wide">
          <h4>📦 各班总分分布箱线图
            <span class="flex"><button class="btn btn-xs btn-ghost" data-act="pngBox">⬇ PNG</button></span>
          </h4>
          <div class="chart-box"><canvas id="chBox"></canvas></div>
        </div>
        <div class="chart-card wide">
          <h4>🧩 各题型得分率对比（所选班级）
            <span class="flex"><button class="btn btn-xs btn-ghost" data-act="pngRate">⬇ PNG</button></span>
          </h4>
          <div class="chart-box tall"><canvas id="chRate"></canvas></div>
        </div>
        <div class="chart-card wide">
          <h4>🕸 各题型得分率雷达图（每班一条线）
            <span class="flex"><button class="btn btn-xs btn-ghost" data-act="pngRadar">⬇ PNG</button></span>
          </h4>
          <div class="chart-box tall"><canvas id="chRadar"></canvas></div>
        </div>
        <div class="chart-card">
          <h4>📈 总分最高 / 最低 / 中位数
            <span class="flex"><button class="btn btn-xs btn-ghost" data-act="pngHlm">⬇ PNG</button></span>
          </h4>
          <div class="chart-box"><canvas id="chHlm"></canvas></div>
        </div>
        <div class="chart-card">
          <h4>📊 分数段分布（优秀 / 及格 / 待及格）
            <span class="flex"><button class="btn btn-xs btn-ghost" data-act="pngSeg">⬇ PNG</button></span>
          </h4>
          <div class="chart-box"><canvas id="chSeg"></canvas></div>
        </div>
        <div class="chart-card wide">
          <h4>🔢 各分段人数（堆叠显示各班）
            <span class="flex"><button class="btn btn-xs btn-ghost" data-act="pngHist">⬇ PNG</button></span>
          </h4>
          <div class="chart-box tall"><canvas id="chHist"></canvas></div>
        </div>
      </div>`;

      App.delegate(v, {
        click: {
          backExam: () => { this.view = 'exam:' + ex.id; this.render(); },
          expAnalysis: () => this.exportAnalysis(ex),
          expPdf: () => this.exportAnalysisPDF(ex),
          expAllPdf: () => this.exportAllPDFs(ex),
          'pngAvg': () => this.exportChartPNG('chAvg'),
          'pngBox': () => this.exportChartPNG('chBox'),
          'pngRate': () => this.exportChartPNG('chRate'),
          'pngRadar': () => this.exportChartPNG('chRadar'),
          'pngHlm': () => this.exportChartPNG('chHlm'),
          'pngSeg': () => this.exportChartPNG('chSeg'),
          'pngHist': () => this.exportChartPNG('chHist')
        }
      });
      v.querySelectorAll('.chip[data-cls]').forEach(c => c.onclick = () => {
        if (!this.anClasses) this.anClasses = new Set(allIds);
        if (this.anClasses.has(c.dataset.cls)) this.anClasses.delete(c.dataset.cls); else this.anClasses.add(c.dataset.cls);
        if (!this.anClasses.size) this.anClasses = null;
        this.render();
      });
      v.querySelectorAll('.thr-inp').forEach(inp => inp.onchange = () => {
        if (!this.anThr) this.anThr = { ...DB().state.settings };
        this.anThr[inp.dataset.t] = +inp.value || 0;
        this.render();
      });

      // —— 绘制图表 ——
      if (!selIds.length) { App.toast('请至少选择一个班级', 'err'); return; }
      this.drawCharts(ex, selIds, statsMap, gradeStats);
    },

    drawCharts(ex, selIds, statsMap, gradeStats) {
      const full = App.fullTotal(ex.fullMarks);
      const palette = App.chartPalette(selIds.length);
      const clsName = cid => App.esc((DB().getClass(cid) || { name: cid + '班' }).name);
      const labels = selIds.map(clsName);

      // 1. 总分平均分对比
      const avgs = selIds.map(cid => statsMap[cid].total.avg);
      App.newChart(App.$('#chAvg'), {
        type: 'bar',
        data: { labels, datasets: [{ label: '班级平均分', data: avgs.map(v => v != null ? +v.toFixed(1) : 0), backgroundColor: palette }] },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.parsed.y + ' 分' } } },
          scales: { y: { beginAtZero: true, suggestedMax: full, title: { display: true, text: '总分' } } }
        }
      });
      // 2. 各题型得分率对比（分组柱状）
      const rateDs = selIds.map((cid, i) => ({
        label: clsName(cid),
        data: App.ITEM_KEYS.map(k => statsMap[cid][k].rate != null ? +(statsMap[cid][k].rate * 100).toFixed(1) : 0),
        backgroundColor: palette[i % palette.length]
      }));
      App.newChart(App.$('#chRate'), {
        type: 'bar',
        data: { labels: App.ITEMS.map(i => i.label), datasets: rateDs },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'top', labels: { boxWidth: 12 } }, tooltip: { callbacks: { label: c => c.dataset.label + '：' + c.parsed.y + '%' } } },
          scales: { y: { min: 0, max: 100, ticks: { callback: v => v + '%' }, title: { display: true, text: '得分率' } } }
        }
      });
      // 3. 总分最高/最低/中位数
      App.newChart(App.$('#chHlm'), {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label: '最高分', data: selIds.map(cid => statsMap[cid].total.max ?? 0), backgroundColor: '#34b57e' },
            { label: '中位数', data: selIds.map(cid => statsMap[cid].total.median ?? 0), backgroundColor: '#f0b429' },
            { label: '最低分', data: selIds.map(cid => statsMap[cid].total.min ?? 0), backgroundColor: '#d64545' }
          ]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
      });
      // 4. 分数段分布（堆叠柱）
      const segDs = [
        { label: `优秀（≥${this.thresholds().good}%）`, data: selIds.map(cid => statsMap[cid].total.goodN), backgroundColor: '#249966' },
        { label: '及格', data: selIds.map(cid => statsMap[cid].total.passN - statsMap[cid].total.goodN), backgroundColor: '#f0b429' },
        { label: '待及格', data: selIds.map(cid => statsMap[cid].total.count - statsMap[cid].total.passN), backgroundColor: '#d64545' }
      ];
      App.newChart(App.$('#chSeg'), {
        type: 'bar',
        data: { labels, datasets: segDs },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } }, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, title: { display: true, text: '人数' } } } }
      });
      // 5. 各班总分分布箱线图
      const boxOk = window.ChartBoxPlot || (Chart && Chart.BoxPlotController);
      if (boxOk) {
        const boxData = selIds.map(cid => {
          const vals = ((ex.scores || {})[cid] || []).map(r => App.num(r.total)).filter(v => v != null);
          return App.boxplotData(vals);
        });
        App.newChart(App.$('#chBox'), {
          type: 'boxplot',
          data: {
            labels,
            datasets: [{
              label: '总分分布',
              data: boxData,
              backgroundColor: 'rgba(52,181,126,.35)',
              borderColor: '#249966',
              borderWidth: 1.5,
              outlierColor: '#d64545',
              itemRadius: 3
            }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => {
              const d = c.raw || {};
              return `最高 ${d.max ?? '—'} · Q3 ${d.q3 != null ? +d.q3.toFixed(1) : '—'} · 中位 ${d.median ?? '—'} · Q1 ${d.q1 != null ? +d.q1.toFixed(1) : '—'} · 最低 ${d.min ?? '—'}${(d.outliers || []).length ? ' · 离群 ' + d.outliers.length + ' 人' : ''}`;
            } } } },
            scales: { y: { beginAtZero: true, suggestedMax: full, title: { display: true, text: '总分' } } }
          }
        });
      } else {
        const boxEl = App.$('#chBox');
        if (boxEl) boxEl.parentElement.innerHTML = '<div style="padding:40px;text-align:center;color:#8aa096">箱线图插件未加载（lib/chartjs-chart-boxplot.umd.min.js）</div>';
      }
      // 6. 各题型得分率雷达图（每班一条线）
      const radarDs = selIds.map((cid, i) => ({
        label: clsName(cid),
        data: App.ITEM_KEYS.map(k => statsMap[cid][k].rate != null ? +(statsMap[cid][k].rate * 100).toFixed(1) : 0),
        borderColor: palette[i % palette.length],
        backgroundColor: palette[i % palette.length] + '22',
        pointRadius: 2
      }));
      App.newChart(App.$('#chRadar'), {
        type: 'radar',
        data: { labels: App.ITEMS.map(i => i.label), datasets: radarDs },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } }, tooltip: { callbacks: { label: c => c.dataset.label + '：' + c.parsed.r + '%' } } },
          scales: { r: { min: 0, max: 100, ticks: { stepSize: 20, callback: v => v + '%' }, pointLabels: { font: { size: 12 } } } }
        }
      });
      // 7. 各分段人数（每 10 分一段，从高到低，堆叠显示各班）
      const segs = App.scoreSegments(full);
      const histDs = selIds.map((cid, i) => ({
        label: clsName(cid),
        data: segs.map(() => 0),
        backgroundColor: palette[i % palette.length]
      }));
      selIds.forEach((cid, di) => {
        ((ex.scores || {})[cid] || []).forEach(r => {
          const idx = App.scoreBinIndex(App.num(r.total), full);
          if (idx >= 0) histDs[di].data[idx]++;
        });
      });
      App.newChart(App.$('#chHist'), {
        type: 'bar',
        data: { labels: segs.map(s => s.label), datasets: histDs },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top', labels: { boxWidth: 12, font: { size: 10 } } },
            tooltip: { callbacks: { label: c => c.dataset.label + '：' + c.parsed.y + ' 人' } }
          },
          scales: { x: { stacked: true, title: { display: true, text: '分数段（从高到低）' } }, y: { stacked: true, beginAtZero: true, title: { display: true, text: '人数' } } }
        }
      });
    },

    exportChartPNG(id) {
      const c = App.charts.find(ch => ch.canvas && ch.canvas.id === id);
      if (!c) { App.toast('图表尚未生成', 'err'); return; }
      App.downloadBlob(this.dataURLtoBlob(c.toBase64Image()), `图表-${id}.png`);
      App.toast('图表已导出 PNG', 'ok');
    },
    dataURLtoBlob(dataURL) {
      const arr = dataURL.split(',');
      const mime = arr[0].match(/:(.*?);/)[1];
      const bstr = atob(arr[1]);
      const n = bstr.length;
      const u8 = new Uint8Array(n);
      for (let i = 0; i < n; i++) u8[i] = bstr.charCodeAt(i);
      return new Blob([u8], { type: mime });
    },

    /* ================= 导出分析 Excel ================= */
    exportAnalysis(ex) {
      const thr = this.thresholds();
      const allIds = ex.classIds;
      const keys = [...App.ITEM_KEYS, 'total'];
      const keyLabel = k => k === 'total' ? '总分' : App.itemLabel(k);
      const statsMap = {};
      allIds.forEach(cid => { statsMap[cid] = this.computeClassStats((ex.scores || {})[cid] || [], ex.fullMarks, thr); });
      const allRecs = [];
      allIds.forEach(cid => allRecs.push(...((ex.scores || {})[cid] || [])));
      const gs = this.computeClassStats(allRecs, ex.fullMarks, thr);
      const full = App.fullTotal(ex.fullMarks);
      const clsName = cid => (DB().getClass(cid) || { name: cid + '班' }).name;

      // Sheet1 综合对比表（各指标）
      const s1 = [['班级', ...keys.map(keyLabel), ...['平均分', '最高分', '最低分', '班内分差', '中位数', '及格率', '优秀率', '低分率', '得分率'].map(m => '总分' + m)],
        ...allIds.map(cid => {
          const st = statsMap[cid];
          return [clsName(cid), ...keys.map(k => this.metricVal(st[k], 'avg')), ...['avg', 'max', 'min', 'range', 'median', 'passRate', 'goodRate', 'lowRate', 'rate'].map(m => this.metricVal(st.total, m))];
        }),
        ['全年级', ...keys.map(k => this.metricVal(gs[k], 'avg')), ...['avg', 'max', 'min', 'range', 'median', 'passRate', 'goodRate', 'lowRate', 'rate'].map(m => this.metricVal(gs.total, m))]];

      // Sheet2 各班各题型统计明细
      const s2 = [['班级', '题型', '满分', '平均分', '最高分', '最低分', '班内分差', '中位数', '及格率', '优秀率', '低分率', '得分率'],
        ...allIds.flatMap(cid => keys.map(k => {
          const st = statsMap[cid][k];
          const fm = k === 'total' ? full : (ex.fullMarks ? (ex.fullMarks[k] || 0) : 0);
          return [clsName(cid), keyLabel(k), fm, st.avg != null ? +st.avg.toFixed(1) : '', st.max ?? '', st.min ?? '', st.range ?? '', st.median != null ? +st.median.toFixed(1) : '', st.passRate != null ? +(st.passRate * 100).toFixed(1) + '%' : '', st.goodRate != null ? +(st.goodRate * 100).toFixed(1) + '%' : '', st.lowRate != null ? +(st.lowRate * 100).toFixed(1) + '%' : '', st.rate != null ? +(st.rate * 100).toFixed(1) + '%' : ''];
        }))];

      // Sheet3 分数段统计
      const s3 = [['班级', '参考人数', '优秀人数', '及格人数', '待及格人数'],
        ...allIds.map(cid => {
          const st = statsMap[cid].total;
          return [clsName(cid), st.count, st.goodN, st.passN, st.count - st.passN];
        }),
        ['全年级', gs.total.count, gs.total.goodN, gs.total.passN, gs.total.count - gs.total.passN]];

      // Sheet4 学生成绩明细
      const s4 = [[...TEMPLATE_HEADER], ...allIds.flatMap(cid => ((ex.scores || {})[cid] || []).map(r =>
        [clsName(cid), r.no || '', r.name || '', ...App.ITEM_KEYS.map(k => r[k] != null ? r[k] : ''), r.total != null ? r.total : '', r.rank != null ? r.rank : '']))];

      // Sheet5 试卷质量分析
      const q = allRecs.length >= 2 ? this.computeItemQuality(allRecs, ex.fullMarks) : null;
      const s5 = [['题型', '满分', '平均分', '难度系数', '区分度', '诊断建议'],
        ...(q && !q.error ? q.rows.map(r => [r.label, r.full, r.avg != null ? +r.avg.toFixed(1) : '', r.difficulty != null ? +r.difficulty.toFixed(2) : '', r.discrimination != null ? +r.discrimination.toFixed(2) : '', r.advice]) : [['—', '', '', '', '', q && q.error ? q.error : '暂无成绩数据']])];

      // Sheet6 各分段人数（班级 × 分数段）
      const segs6 = App.scoreSegments(full);
      const cntSeg = (recs, si) => recs.reduce((s, r) => s + (App.scoreBinIndex(App.num(r.total), full) === si ? 1 : 0), 0);
      const s6 = [['班级', ...segs6.map(s => s.label), '合计'],
        ...allIds.map(cid => { const recs = ((ex.scores || {})[cid] || []).filter(r => !App.isAbsent(r)); return [clsName(cid), ...segs6.map((_, si) => cntSeg(recs, si)), recs.length]; }),
        ['全年级', ...segs6.map((_, si) => cntSeg(allRecs.filter(r => !App.isAbsent(r)), si)), allRecs.filter(r => !App.isAbsent(r)).length]];

      XLSX.writeFile(App.makeWorkbook([
        { name: '综合比对', aoa: s1, widths: [8, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 10, 10, 10, 10, 10, 10, 10, 10, 10] },
        { name: '各班题型统计', aoa: s2, widths: [8, 10, 7, 9, 9, 9, 9, 9, 9, 9, 9, 9] },
        { name: '分数段统计', aoa: s3, widths: [8, 10, 10, 10, 10] },
        { name: '学生成绩明细', aoa: s4, widths: [8, 12, 12, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 8, 8] },
        { name: '试卷质量分析', aoa: s5, widths: [10, 8, 9, 9, 9, 30] },
        { name: '各分段人数', aoa: s6, widths: [10, ...allIds.map(() => 8), 9] }
      ]), `${ex.name}-成绩比对分析.xlsx`);
      App.toast('分析报告已导出 Excel', 'ok');
    },

    /* ================= PDF 报告（Canvas 自绘中文表格 → jsPDF） ================= */
    _pdfReady() {
      if (!window.jspdf || !window.jspdf.jsPDF) { App.toast('PDF 组件未加载（lib/jspdf.umd.min.js）', 'err'); return false; }
      return true;
    },
    // 初始化 PDF 上下文（A4 竖版，画布按 96dpi）
    _pdfInit() {
      const doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'a4' });
      return {
        doc, pageNo: 0,
        FONT: '"Microsoft YaHei","PingFang SC",sans-serif',
        PW: 595, PH: 842, PXW: 794, PXH: 1123, PXM: 40
      };
    },
    _pdfWrap(ctx, text, maxW) {
      const lines = []; let cur = '';
      for (const ch of String(text)) {
        if (ctx.measureText(cur + ch).width > maxW && cur) { lines.push(cur); cur = ch; }
        else cur += ch;
      }
      if (cur) lines.push(cur);
      return lines.length ? lines : [''];
    },
    // 绘制表格（画布像素坐标），返回表尾 y
    _pdfTable(ctx, x, y, colWidths, header, rows, opt) {
      const o = Object.assign({ fontSize: 11, headerBg: '#d9f2e4', line: '#b8c9bf', pad: 6, lineH: 15 }, opt || {});
      const FONT = '"Microsoft YaHei","PingFang SC",sans-serif';
      const totalW = colWidths.reduce((a, b) => a + b, 0);
      const cellH = r => Math.max(...r.map((c, i) => this._pdfWrap(ctx, String(c), colWidths[i] - o.pad * 2).length)) * o.lineH + o.pad * 2;
      const drawRow = (cells, y0, isHeader) => {
        const h = cellH(cells);
        if (isHeader) { ctx.fillStyle = o.headerBg; ctx.fillRect(x, y0, totalW, h); }
        ctx.strokeStyle = o.line; ctx.lineWidth = 1; ctx.strokeRect(x, y0, totalW, h);
        let cx = x;
        for (let i = 0; i < colWidths.length; i++) {
          if (i > 0) { ctx.beginPath(); ctx.moveTo(cx, y0); ctx.lineTo(cx, y0 + h); ctx.stroke(); }
          ctx.fillStyle = isHeader ? '#14503a' : '#20352b';
          ctx.font = (isHeader ? 'bold ' : '') + o.fontSize + 'px ' + FONT;
          const lines = this._pdfWrap(ctx, String(cells[i]), colWidths[i] - o.pad * 2);
          lines.forEach((ln, li) => ctx.fillText(ln, cx + o.pad, y0 + o.pad + o.lineH * (li + 1) - 4));
          cx += colWidths[i];
        }
        return h;
      };
      let yy = y;
      yy += drawRow(header, yy, true);
      rows.forEach(r => { yy += drawRow(r, yy, false); });
      return yy;
    },
    // 新增一页
    _pdfPage(P, drawFn, footer) {
      const c = document.createElement('canvas');
      c.width = P.PXW; c.height = P.PXH;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, P.PXW, P.PXH);
      drawFn(ctx);
      P.pageNo++;
      ctx.fillStyle = '#8aa096'; ctx.font = '10px ' + P.FONT;
      ctx.fillText(footer || '', P.PXM, P.PXH - 22);
      ctx.fillText('第 ' + P.pageNo + ' 页', P.PXW - P.PXM - 44, P.PXH - 22);
      if (P.pageNo > 1) P.doc.addPage();
      P.doc.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, P.PW, P.PH);
    },
    _pdfTitle(ctx, P, main, sub) {
      ctx.fillStyle = '#14503a'; ctx.font = 'bold 21px ' + P.FONT;
      ctx.fillText(main, P.PXM, 52);
      if (sub) { ctx.fillStyle = '#5c7266'; ctx.font = '12px ' + P.FONT; ctx.fillText(sub, P.PXM, 74); }
    },
    _pdfSection(ctx, P, text, y) {
      ctx.fillStyle = '#14503a'; ctx.font = 'bold 13px ' + P.FONT;
      ctx.fillText(text, P.PXM, y);
    },

    // ---------- 全年级成绩分析 PDF（3 页，表格为主）----------
    _buildGradeAnalysisPdf(ex) {
      if (!this._pdfReady()) return null;
      const st = DB().state.settings;
      const thr = this.thresholds();
      const allIds = ex.classIds;
      const full = App.fullTotal(ex.fullMarks);
      const clsName = cid => (DB().getClass(cid) || { name: cid + '班' }).name;
      const statsMap = {};
      allIds.forEach(cid => { statsMap[cid] = this.computeClassStats((ex.scores || {})[cid] || [], ex.fullMarks, thr); });
      const allRecs = [];
      allIds.forEach(cid => allRecs.push(...((ex.scores || {})[cid] || [])));
      const gs = this.computeClassStats(allRecs, ex.fullMarks, thr);
      const P = this._pdfInit();
      const foot = `${st.schoolName} · ${ex.name} 成绩分析报告`;

      // 页1：总览 + 最高/最低/中位数
      this._pdfPage(P, ctx => {
        this._pdfTitle(ctx, P, `${st.schoolName} · ${ex.name} 成绩分析报告`,
          `考试类型：${ex.type || '—'}　日期：${ex.date}　参考班级：${allIds.length} 个　参考人数：${gs.total.count} 人${gs.absentN ? `（缺考 ${gs.absentN} 人）` : ''}　满分：${full} 分`);
        ctx.fillStyle = '#7c9185'; ctx.font = '11px ' + P.FONT;
        ctx.fillText(`全年级：平均分 ${App.fmt(gs.total.avg)} · 最高 ${gs.total.max ?? '—'} · 最低 ${gs.total.min ?? '—'} · 中位数 ${App.fmt(gs.total.median)} · 优秀率 ${App.fmtPct(gs.total.goodRate)} · 及格率 ${App.fmtPct(gs.total.passRate)} · 低分率 ${App.fmtPct(gs.total.lowRate)}`, P.PXM, 96);
        this._pdfSection(ctx, P, '一、各班成绩总览（总分）', 126);
        const h1 = ['班级', '参考人数', '平均分', '最高分', '最低分', '中位数', '班内分差', '优秀率', '及格率', '低分率', '得分率'];
        const rows1 = allIds.map(cid => {
          const s = statsMap[cid].total;
          return [clsName(cid), s.count, App.fmt(s.avg), s.max ?? '—', s.min ?? '—', App.fmt(s.median), App.fmt(s.range), App.fmtPct(s.goodRate), App.fmtPct(s.passRate), App.fmtPct(s.lowRate), App.fmtPct(s.rate)];
        });
        rows1.push(['全年级', gs.total.count, App.fmt(gs.total.avg), gs.total.max ?? '—', gs.total.min ?? '—', App.fmt(gs.total.median), App.fmt(gs.total.range), App.fmtPct(gs.total.goodRate), App.fmtPct(gs.total.passRate), App.fmtPct(gs.total.lowRate), App.fmtPct(gs.total.rate)]);
        let y = this._pdfTable(ctx, P.PXM, 138, [58, ...Array(10).fill(65)], h1, rows1, { fontSize: 10 });
        y += 30;
        this._pdfSection(ctx, P, '二、各班总分最高 / 最低 / 中位数', y); y += 12;
        const rows2 = allIds.map(cid => { const s = statsMap[cid].total; return [clsName(cid), s.max ?? '—', s.min ?? '—', App.fmt(s.median)]; });
        rows2.push(['全年级', gs.total.max ?? '—', gs.total.min ?? '—', App.fmt(gs.total.median)]);
        this._pdfTable(ctx, P.PXM, y, [160, 184, 184, 186], ['班级', '最高分', '最低分', '中位数'], rows2, { fontSize: 10 });
      }, foot);

      // 页2：各题型得分率 + 各分段人数
      this._pdfPage(P, ctx => {
        this._pdfSection(ctx, P, '三、各班各题型得分率对比（%）', 48);
        const rows3 = allIds.map(cid => [clsName(cid), ...App.ITEM_KEYS.map(k => App.fmtPct(statsMap[cid][k].rate)), App.fmtPct(statsMap[cid].total.rate)]);
        rows3.push(['全年级', ...App.ITEM_KEYS.map(k => App.fmtPct(gs[k].rate)), App.fmtPct(gs.total.rate)]);
        let y = this._pdfTable(ctx, P.PXM, 60, [58, ...Array(10).fill(65)], ['班级', ...App.ITEMS.map(i => i.label), '总分'], rows3, { fontSize: 10 });
        y += 30;
        this._pdfSection(ctx, P, '四、各分段人数', y); y += 12;
        const segs = App.scoreSegments(full);
        const cntSeg = (recs, si) => recs.reduce((s, r) => s + (App.scoreBinIndex(App.num(r.total), full) === si ? 1 : 0), 0);
        const rows4 = allIds.map(cid => { const recs = ((ex.scores || {})[cid] || []).filter(r => !App.isAbsent(r)); return [clsName(cid), ...segs.map((_, si) => cntSeg(recs, si)), recs.length]; });
        rows4.push(['全年级', ...segs.map((_, si) => cntSeg(allRecs.filter(r => !App.isAbsent(r)), si)), allRecs.filter(r => !App.isAbsent(r)).length]);
        this._pdfTable(ctx, P.PXM, y, [58, ...Array(11).fill(60)], ['班级', ...segs.map(s => s.label), '合计'], rows4, { fontSize: 9.5 });
      }, foot);

      // 页3：试卷质量分析
      this._pdfPage(P, ctx => {
        this._pdfSection(ctx, P, '五、试卷质量分析', 48);
        ctx.fillStyle = '#7c9185'; ctx.font = '10.5px ' + P.FONT;
        ctx.fillText('难度系数 = 平均分 ÷ 满分；区分度 = （高分组前 27% 均分 − 低分组后 27% 均分）÷ 满分', P.PXM, 68);
        const q = allRecs.length >= 2 ? this.computeItemQuality(allRecs, ex.fullMarks) : null;
        const rows5 = q && !q.error ? q.rows.map(r => [r.label, r.full, r.avg != null ? App.fmt(r.avg, 1) : '—', r.difficulty != null ? App.fmt(r.difficulty, 2) : '—', r.discrimination != null ? App.fmt(r.discrimination, 2) : '—', r.advice])
          : [['—', '', '', '', '', q && q.error ? q.error : '暂无成绩数据']];
        this._pdfTable(ctx, P.PXM, 82, [92, 58, 70, 84, 84, 326], ['题型', '满分', '平均分', '难度系数', '区分度', '诊断建议'], rows5, { fontSize: 10 });
      }, foot);
      return P.doc;
    },

    // ---------- 单班成绩分析 PDF（3 页，含同层次对比）----------
    _buildClassAnalysisPdf(ex, classId) {
      if (!this._pdfReady()) return null;
      const st = DB().state.settings;
      const thr = this.thresholds();
      const cls = DB().getClass(classId);
      const clsLabel = cls ? cls.name : classId + '班';
      const recs = (ex.scores || {})[classId] || [];
      const full = App.fullTotal(ex.fullMarks);
      const cmpInfo = this._classCompare(ex, classId);
      const { tier, tierIds, cmpLabel, cmpRecs } = cmpInfo;
      const cs = this.computeClassStats(recs, ex.fullMarks, thr);
      const gs = this.computeClassStats(cmpRecs, ex.fullMarks, thr);
      const P = this._pdfInit();
      const foot = `${st.schoolName} · ${clsLabel} 成绩分析报告`;
      const dv = (a, b, isPct) => {
        if (a == null || b == null) return '—';
        const d = isPct ? (a - b) * 100 : (a - b);
        return (d >= 0 ? '+' : '') + App.fmt(d, 1) + (isPct ? '%' : '');
      };

      // 页1：统计摘要 + 各题型得分率对比
      this._pdfPage(P, ctx => {
        this._pdfTitle(ctx, P, `${st.schoolName} · ${clsLabel} 成绩分析报告`,
          `考试：${ex.name}（${ex.date}）　层次：${tier ? tier + ' 层' : '未分层'}　对比基准：${cmpLabel}　满分：${full} 分`);
        this._pdfSection(ctx, P, '一、统计摘要', 106);
        const rows1 = [
          ['参考人数', cs.total.count, gs.total.count, dv(cs.total.count, gs.total.count, false)],
          ['平均分', App.fmt(cs.total.avg), App.fmt(gs.total.avg), dv(cs.total.avg, gs.total.avg, false)],
          ['最高分', cs.total.max ?? '—', gs.total.max ?? '—', dv(cs.total.max, gs.total.max, false)],
          ['最低分', cs.total.min ?? '—', gs.total.min ?? '—', dv(cs.total.min, gs.total.min, false)],
          ['中位数', App.fmt(cs.total.median), App.fmt(gs.total.median), dv(cs.total.median, gs.total.median, false)],
          ['优秀率', App.fmtPct(cs.total.goodRate), App.fmtPct(gs.total.goodRate), dv(cs.total.goodRate, gs.total.goodRate, true)],
          ['及格率', App.fmtPct(cs.total.passRate), App.fmtPct(gs.total.passRate), dv(cs.total.passRate, gs.total.passRate, true)],
          ['低分率', App.fmtPct(cs.total.lowRate), App.fmtPct(gs.total.lowRate), dv(cs.total.lowRate, gs.total.lowRate, true)],
          ['得分率', App.fmtPct(cs.total.rate), App.fmtPct(gs.total.rate), dv(cs.total.rate, gs.total.rate, true)]
        ];
        let y = this._pdfTable(ctx, P.PXM, 118, [160, 184, 184, 186], ['指标', clsLabel, cmpLabel, '差值'], rows1, { fontSize: 10.5 });
        y += 30;
        this._pdfSection(ctx, P, '二、各题型得分率对比（%）', y); y += 12;
        const rows2 = [...App.ITEM_KEYS.map(k => [App.itemLabel(k), App.fmtPct(cs[k].rate), App.fmtPct(gs[k].rate), dv(cs[k].rate, gs[k].rate, true)]),
          ['总分', App.fmtPct(cs.total.rate), App.fmtPct(gs.total.rate), dv(cs.total.rate, gs.total.rate, true)]];
        this._pdfTable(ctx, P.PXM, y, [160, 184, 184, 186], ['题型', clsLabel, cmpLabel, '差值'], rows2, { fontSize: 10.5 });
      }, foot);

      // 页2：同层次各班对比 + 各分段人数
      this._pdfPage(P, ctx => {
        const hasTier = tier && tierIds.length;
        this._pdfSection(ctx, P, hasTier ? `三、同层次（${tier} 层）各班对比` : '三、各班对比', 48);
        let y = 60;
        if (hasTier) {
          const tierAll = [];
          tierIds.forEach(cid => tierAll.push(...((ex.scores || {})[cid] || [])));
          const ts = this.computeClassStats(tierAll, ex.fullMarks, thr).total;
          const rows3 = tierIds.map(cid => {
            const s = this.computeClassStats((ex.scores || {})[cid] || [], ex.fullMarks, thr).total;
            const nm = (DB().getClass(cid) || { name: cid + '班' }).name;
            return [String(cid) === String(classId) ? nm + '（本班）' : nm, s.count, App.fmt(s.avg), s.max ?? '—', s.min ?? '—', App.fmt(s.median), App.fmtPct(s.goodRate), App.fmtPct(s.passRate), App.fmtPct(s.lowRate)];
          });
          rows3.push([`${tier} 层合计`, ts.count, App.fmt(ts.avg), ts.max ?? '—', ts.min ?? '—', App.fmt(ts.median), App.fmtPct(ts.goodRate), App.fmtPct(ts.passRate), App.fmtPct(ts.lowRate)]);
          y = this._pdfTable(ctx, P.PXM, y, [112, 62, 64, 64, 64, 64, 90, 90, 96], ['班级', '参考人数', '平均分', '最高分', '最低分', '中位数', '优秀率', '及格率', '低分率'], rows3, { fontSize: 10 });
        } else {
          ctx.fillStyle = '#7c9185'; ctx.font = '11px ' + P.FONT;
          ctx.fillText('（未配置班级分层，可在「设置」中配置后再查看同层次对比）', P.PXM, y); y += 20;
        }
        y += 30;
        this._pdfSection(ctx, P, '四、各分段人数', y); y += 12;
        const segs = App.scoreSegments(full);
        const cntSeg = (arr, si) => arr.reduce((s, x) => s + (App.scoreBinIndex(App.num(x.total), full) === si ? 1 : 0), 0);
        const rows4 = segs.map((seg, si) => [seg.label, cntSeg(recs, si), cntSeg(cmpRecs, si), cntSeg(recs, si) + cntSeg(cmpRecs, si)]);
        const validN = a => a.filter(r => !App.isAbsent(r)).length;
        rows4.push(['合计', validN(recs), validN(cmpRecs), validN(recs) + validN(cmpRecs)]);
        this._pdfTable(ctx, P.PXM, y, [130, 194, 194, 196], ['分数段', clsLabel, cmpLabel, '合计'], rows4, { fontSize: 10 });
      }, foot);

      // 页3：本班成绩排名明细
      this._pdfPage(P, ctx => {
        this._pdfSection(ctx, P, '五、本班成绩排名明细', 48);
        const sorted = [...recs].sort((a, b) => (b.total != null ? b.total : -1) - (a.total != null ? a.total : -1));
        const rows5 = sorted.map((r, i) => {
          const ab = App.isAbsent(r);
          return [ab ? '缺考' : (r.rank != null ? r.rank : i + 1), r.no || '—', r.name, ...App.ITEM_KEYS.map(k => ab ? '—' : (r[k] != null ? App.fmt(r[k]) : '—')), ab ? '缺考' : (r.total != null ? App.fmt(r.total) : '—')];
        });
        const shown = rows5.slice(0, 32);
        this._pdfTable(ctx, P.PXM, 60, [46, 76, 76, ...Array(9).fill(52), 58], ['排名', '学号', '姓名', ...App.ITEMS.map(i => i.label), '总分'], shown, { fontSize: 9 });
        if (rows5.length > shown.length) {
          ctx.fillStyle = '#8aa096'; ctx.font = '10px ' + P.FONT;
          ctx.fillText(`（本页仅显示前 ${shown.length} 名，共 ${rows5.length} 人，完整名单请导出 Excel）`, P.PXM, P.PXH - 60);
        }
      }, foot);
      return P.doc;
    },

    // 导出：全年级 PDF
    exportAnalysisPDF(ex) {
      const doc = this._buildGradeAnalysisPdf(ex);
      if (!doc) return;
      try { doc.save(`${ex.name}-全年级成绩分析报告.pdf`); App.toast('已导出全年级成绩分析 PDF', 'ok'); }
      catch (e) { App.toast('PDF 导出失败：' + e.message, 'err'); }
    },

    // 导出：单班 PDF
    exportClassAnalysisPDF(ex, classId) {
      const doc = this._buildClassAnalysisPdf(ex, classId);
      if (!doc) return;
      const nm = (DB().getClass(classId) || { name: classId + '班' }).name;
      try { doc.save(`${ex.name}-${nm}成绩分析报告.pdf`); App.toast(`已导出 ${nm} 成绩分析 PDF`, 'ok'); }
      catch (e) { App.toast('PDF 导出失败：' + e.message, 'err'); }
    },

    // 一键打包导出：全年级 + 各班 PDF（zip）
    async exportAllPDFs(ex) {
      if (!this._pdfReady()) return;
      if (!window.JSZip) { App.toast('打包组件未加载（lib/jszip.min.js）', 'err'); return; }
      const clsName = cid => (DB().getClass(cid) || { name: cid + '班' }).name;
      const zip = new window.JSZip();
      let n = 0;
      App.toast('正在生成 PDF，请稍候…', 'ok');
      try {
        const gradeDoc = this._buildGradeAnalysisPdf(ex);
        if (gradeDoc) { zip.file('全年级-成绩分析报告.pdf', gradeDoc.output('blob')); n++; }
      } catch (e) { console.warn('全年级 PDF 失败', e); }
      ex.classIds.forEach(cid => {
        const recs = (ex.scores || {})[cid] || [];
        if (!recs.length) return;
        try {
          const doc = this._buildClassAnalysisPdf(ex, cid);
          if (doc) { zip.file(`${clsName(cid)}-成绩分析报告.pdf`, doc.output('blob')); n++; }
        } catch (e) { console.warn(clsName(cid) + ' PDF 失败', e); }
      });
      if (!n) { App.toast('没有可导出的成绩数据', 'err'); return; }
      try {
        const blob = await zip.generateAsync({ type: 'blob' });
        App.downloadBlob(blob, `${ex.name}-成绩分析报告（含各班）.zip`);
        App.toast(`已打包导出 ${n} 份 PDF`, 'ok');
      } catch (e) { App.toast('打包失败：' + e.message, 'err'); }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
