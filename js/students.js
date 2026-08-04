/* ============================================================
 * students.js — 学生管理板块
 *  15 个班班级档案 · 名单增删改 · Excel 导入导出 · 全局搜索 · 学生卡片（历次成绩+走势图）
 * ============================================================ */
(function (global) {
  'use strict';
  const App = global.EJWP;
  const DB = () => App.DB;

  App.Students = {
    view: 'grid',       // grid | class:<id>
    classId: null,
    searchQ: '',

    init() {
      const inp = App.$('#stuSearchInput');
      const btn = App.$('#stuSearchBtn');
      const run = () => this.doSearch(inp.value.trim());
      btn.onclick = run;
      inp.onkeydown = e => { if (e.key === 'Enter') run(); };
      if (inp._onInput) inp.removeEventListener('input', inp._onInput);
      inp._onInput = () => { clearTimeout(inp._t); inp._t = setTimeout(run, 350); };
      inp.addEventListener('input', inp._onInput);
      inp.value = '';
      this.render();
    },

    /* ---------- 渲染 ---------- */
    render() {
      const st = DB().state.settings;
      const total = DB().state.classes.reduce((s, c) => s + c.students.length, 0);
      const latest = this.latestExam();
      const refCount = latest ? latest.classIds.reduce((s, cid) => s + (latest.scores[cid] ? latest.scores[cid].length : 0), 0) : 0;

      const strip = `<div class="stat-item"><div class="k">班级数</div><div class="v">15 <small>个班</small></div></div>
        <div class="stat-item"><div class="k">学生总数</div><div class="v">${total} <small>人</small></div></div>
        <div class="stat-item"><div class="k">最近一次考试</div><div class="v" style="font-size:15px">${latest ? App.esc(latest.name) : '暂无'}</div></div>
        <div class="stat-item"><div class="k">该次参考人数</div><div class="v">${refCount} <small>人</small></div></div>
        <div class="stat-item"><div class="k">所在年级</div><div class="v" style="font-size:15px">${App.esc(st.gradeName)}</div></div>`;
      App.$('#stuSummary').innerHTML = strip;

      const v = App.$('#studentsView');
      if (this.searchQ) { v.innerHTML = this.searchResultsHTML(); this.bindGrid(v); return; }
      if (this.view.startsWith('class:')) { this.renderClass(v); return; }
      this.renderGrid(v);
    },

    /* ---------- 班级卡片网格 ---------- */
    latestExam() {
      const exams = [...DB().state.exams].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      return exams[0] || null;
    },
    classLatestAvg(classId, exam) {
      if (!exam) exam = this.latestExam();
      if (!exam) return null;
      const recs = (exam.scores || {})[classId];
      if (!recs || !recs.length) return null;
      const s = App.statsOf(recs.map(r => App.num(r.total)));
      return s.avg;
    },

    renderGrid(v) {
      v.innerHTML = `
      <div class="card">
        <div class="flex">
          <div>
            <div class="card-title" style="margin:0">🏫 一键添加班级和学生（全年级导入）</div>
            <div class="card-sub" style="margin-bottom:0">下载全年级模板（班级 / 学号 / 姓名）→ 填写 15 个班的学生 → 一键导入，系统按「班级」列自动分发到各班</div>
          </div>
          <div class="spacer"></div>
          <button class="btn btn-ghost btn-sm" data-act="dlAllTpl">⬇ 下载全年级模板</button>
          <button class="btn btn-primary" data-act="importAllCls">📥 一键导入全年级名单</button>
        </div>
      </div>
      <div class="class-grid">
        ${(() => {
          const latest = this.latestExam();
          return DB().state.classes.map(c => {
            const avg = this.classLatestAvg(c.id, latest);
            const imported = latest ? ((latest.scores || {})[c.id] || []).length : 0;
          return `<div class="class-card" data-act="openClass" data-id="${c.id}" title="点击进入班级名单管理">
            <span class="cc-badge">${App.esc(c.name)}</span>
            <div class="cc-name">📚 ${App.esc(c.name)}</div>
            <div class="cc-meta">
              <span>👩‍🎓 学生：<b style="color:var(--mint-700)">${c.students.length}</b> 人</span>
              ${latest ? `<span>📊 最近考试「${App.esc(latest.name)}」已导入 <b style="color:var(--mint-700)">${imported}</b> 人</span>` : ''}
            </div>
            ${avg != null ? `<div class="cc-score">🏆 班级均分：${App.fmt(avg)}</div>` : ''}
          </div>`;
        }).join(''); })()}
      </div>
      <div class="empty mt16" style="padding:22px"><p>💡 点击班级卡片进入名单管理；也可用上方「一键导入全年级名单」批量添加 15 个班的学生。</p></div>`;
      this.bindGrid(v);
    },

    /* ---------- 班级名单 ---------- */
    renderClass(v) {
      const c = DB().getClass(this.classId);
      if (!c) { this.view = 'grid'; this.render(); return; }
      const latest = this.latestExam();
      const recs = latest ? (latest.scores || {})[c.id] || [] : [];
      const rows = c.students.length ? c.students.map((s, i) => {
        const score = recs.find(r => r.studentId === s.id) || recs.find(r => r.no === s.no) || null;
        const recent = score ? `<span class="badge green">${App.fmt(score.total)} 分 · 第 ${score.rank == null ? '—' : score.rank} 名</span>` : '<span class="badge gray">暂无成绩</span>';
        return `<tr>
          <td class="num">${i + 1}</td><td>${App.esc(s.no || '—')}</td><td><b>${App.esc(s.name)}</b></td>
          <td>${recent}</td>
          <td>
            <button class="btn btn-xs btn-ghost" data-act="viewStu" data-id="${s.id}">👀 档案</button>
            <button class="btn btn-xs btn-ghost" data-act="editStu" data-id="${s.id}">✏️</button>
            <button class="btn btn-xs btn-danger" data-act="delStu" data-id="${s.id}">🗑</button>
          </td></tr>`;
      }).join('') : '<tr><td colspan="6" style="text-align:center;color:#8aa096;padding:26px">本班还没有学生，可手动添加或批量导入名单</td></tr>';

      v.innerHTML = `
      <div class="crumb"><button data-act="backGrid">← 返回班级列表</button><span>/</span><b>${App.esc(c.name)} · 学生名单</b><span class="muted">（共 ${c.students.length} 人）</span></div>
      <div class="card">
        <div class="card-title">➕ 添加学生</div>
        <div class="form-row">
          <input type="text" id="newStuNo" placeholder="学号，如 20260001" style="width:170px;padding:9px 12px;border:1.5px solid var(--line);border-radius:9px">
          <input type="text" id="newStuName" placeholder="姓名" style="width:140px;padding:9px 12px;border:1.5px solid var(--line);border-radius:9px">
          <button class="btn btn-primary btn-sm" data-act="addStu">添加学生</button>
        </div>
      </div>
      <div class="card">
        <div class="flex mb12">
          <div class="card-title" style="margin:0">📋 学生名单</div>
          <div class="spacer"></div>
          <button class="btn btn-ghost btn-sm" data-act="dlTemplate">⬇ 名单模板</button>
          <button class="btn btn-ghost btn-sm" data-act="importRoster">📥 导入名单</button>
          <button class="btn btn-ghost btn-sm" data-act="exportRoster">📤 导出名单</button>
        </div>
        <div class="tbl-wrap">
          <table class="tbl">
            <thead><tr><th class="num">序号</th><th>学号</th><th>姓名</th><th>最近一次成绩</th><th>操作</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
      this.bindGrid(v);
    },

    bindGrid(v) {
      App.delegate(v, {
        click: {
          backGrid: () => { this.view = 'grid'; this.render(); },
          openClass: (e, el) => { this.view = 'class:' + el.dataset.id; this.classId = el.dataset.id; this.render(); },
          addStu: () => this.addStudent(),
          viewStu: (e, el) => this.openStudentCard(el.dataset.id),
          editStu: (e, el) => this.editStudent(el.dataset.id),
          delStu: (e, el) => this.deleteStudent(el.dataset.id),
          dlTemplate: () => this.downloadTemplate(),
          importRoster: () => this.importRoster(),
          exportRoster: () => this.exportRoster(),
          dlAllTpl: () => this.downloadAllTemplate(),
          importAllCls: () => this.importAllClasses(),
          hitStu: (e, el) => this.openStudentCard(el.dataset.id)
        }
      });
    },

    /* ---------- 添加 / 编辑 / 删除 ---------- */
    addStudent() {
      const c = DB().getClass(this.classId);
      const no = App.$('#newStuNo').value.trim();
      const name = App.$('#newStuName').value.trim();
      if (!name) { App.toast('请填写学生姓名', 'err'); return; }
      if (!no) { App.toast('请填写学号', 'err'); return; }
      if (c.students.some(s => s.no === no)) { App.toast(`学号 ${no} 已存在`, 'err'); return; }
      c.students.push({ id: App.uid('s'), no, name });
      DB().save('已添加学生');
      App.toast(`已在${c.name}添加学生「${name}」`, 'ok');
      App.$('#newStuNo').value = ''; App.$('#newStuName').value = '';
      this.render();
    },
    editStudent(id) {
      const c = DB().getClass(this.classId);
      const s = c.students.find(x => x.id === id);
      if (!s) return;
      App.modal({
        title: `编辑学生档案 · ${App.esc(s.name)}`,
        body: `<div class="field"><label>学号</label><input type="text" id="edNo" value="${App.esc(s.no || '')}"></div>
               <div class="field"><label>姓名</label><input type="text" id="edName" value="${App.esc(s.name)}"></div>`,
        foot: `<button class="btn btn-ghost" onclick="EJWP.modalClose()">取消</button>
               <button class="btn btn-primary" id="edSave">保存</button>`
      });
      App.$('#edSave').onclick = () => {
        const no = App.$('#edNo').value.trim(), name = App.$('#edName').value.trim();
        if (!name) { App.toast('姓名不能为空', 'err'); return; }
        const dup = c.students.find(x => x.id !== id && x.no === no);
        if (dup) { App.toast('该学号已被其他学生使用', 'err'); return; }
        s.no = no; s.name = name;
        DB().save(); App.modalClose(); App.toast('已保存', 'ok'); this.render();
      };
    },
    deleteStudent(id) {
      const c = DB().getClass(this.classId);
      const s = c.students.find(x => x.id === id);
      if (!s) return;
      App.confirm({
        title: '删除学生',
        message: `确定从 ${App.esc(c.name)} 删除学生「<b>${App.esc(s.name)}</b>」吗？该生所有考试成绩记录将一并移除。`,
        danger: true, okText: '删除',
        onOk: () => {
          c.students = c.students.filter(x => x.id !== id);
          DB().state.exams.forEach(ex => {
            Object.values(ex.scores || {}).forEach(recs => {
              for (let i = recs.length - 1; i >= 0; i--) {
                const r = recs[i];
                if (r.studentId === id || (r.no && r.no === s.no)) recs.splice(i, 1);
              }
            });
          });
          DB().save('已删除学生'); App.toast('已删除', 'ok'); this.render();
        }
      });
    },

    /* ---------- 名单 Excel ---------- */
    downloadTemplate() {
      App.downloadXlsx([['班级', '学号', '姓名'], [this.classId + '班', '20260001', '示例学生']], '学生名单导入模板.xlsx', { widths: [8, 14, 12] });
    },
    exportRoster() {
      const c = DB().getClass(this.classId);
      const aoa = [['班级', '学号', '姓名'], ...c.students.map(s => [c.name, s.no || '', s.name])];
      App.downloadXlsx(aoa, `${c.name}学生名单.xlsx`, { widths: [8, 14, 12] });
      App.toast('名单已导出', 'ok');
    },
    /* ---------- 全年级一键导入（班级 / 学号 / 姓名 统一模板） ---------- */
    downloadAllTemplate() {
      const st = DB().state.settings;
      const s1 = [['班级', '学号', '姓名'],
        ['1班', '20260101', '示例学生一'],
        ['2班', '20260201', '示例学生二'],
        ['15班', '20261501', '示例学生十五']];
      const s2 = [['全年级学生导入模板使用说明'],
        ['1. 表头固定为：班级 / 学号 / 姓名'],
        ['2. 「班级」列填写 1-15 班（支持：1班、01班、一班、1 等写法），系统按班级自动分发'],
        ['3. 同一个学号重复导入会自动更新姓名，不重复的自动新增'],
        ['4. 班级列无法识别或缺少姓名的行会被跳过并在导入结果中提示']];
      XLSX.writeFile(App.makeWorkbook([
        { name: '全年级名单', aoa: s1, widths: [8, 14, 14] },
        { name: '使用说明', aoa: s2, widths: [80] }
      ]), `${st.gradeName}全年级学生导入模板.xlsx`);
      App.toast('全年级模板已下载', 'ok');
    },

    // 解析全年级名单（纯函数，可测试）
    parseAllRoster(rows) {
      if (!rows || !rows.length) return { error: '文件为空' };
      let hi = -1;
      for (let i = 0; i < Math.min(rows.length, 15); i++) {
        const cells = rows[i].map(c => String(c == null ? '' : c));
        if (cells.some(c => /班级|班别/.test(c)) && cells.some(c => /学号|学籍号|编号/.test(c)) && cells.some(c => /姓名|名字/.test(c))) { hi = i; break; }
      }
      if (hi < 0) return { error: '未找到表头（需包含「班级」「学号」「姓名」列）' };
      const header = rows[hi].map(c => String(c).trim());
      const idx = key => header.findIndex(h => h.includes(key));
      const iCls = idx('班级') >= 0 ? idx('班级') : idx('班别');
      const iNo = idx('学号'), iName = idx('姓名');
      const cn = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五'];
      const parseCls = s => {
        if (!s) return null;
        const m = String(s).match(/(\d+)/);
        if (m) { const n = parseInt(m[1], 10); return (n >= 1 && n <= 15) ? String(n) : null; }
        const ci = cn.indexOf(String(s).replace(/班/g, ''));
        return ci >= 1 && ci <= 15 ? String(ci) : null;
      };
      const groups = {}, skipped = [];
      for (let r = hi + 1; r < rows.length; r++) {
        const cells = rows[r].map(c => String(c == null ? '' : c).trim());
        const no = iNo >= 0 ? cells[iNo] : '';
        const name = iName >= 0 ? cells[iName] : '';
        if (!no && !name) continue;
        if (!name) { skipped.push({ no, name, why: '缺少姓名' }); continue; }
        const cid = parseCls(iCls >= 0 ? cells[iCls] : '');
        if (!cid) { skipped.push({ no, name, why: '班级列无法识别（需为 1-15 班）' }); continue; }
        (groups[cid] = groups[cid] || []).push({ no, name });
      }
      const total = Object.keys(groups).reduce((s, k) => s + groups[k].length, 0);
      if (!total) return { error: '没有可导入的数据行（请检查「班级」列是否填写 1-15 班）' };
      return { groups, skipped, total, header: header.join(' / ') };
    },

    importAllClasses() {
      App.pickFile({ accept: '.xlsx,.xls,.csv' }).then(file => {
        if (!file) return;
        App.readWorkbook(file).then(wb => {
          const parsed = this.parseAllRoster(App.workbookToRows(wb));
          if (parsed.error) { App.toast(parsed.error, 'err'); return; }
          this.showAllRosterPreview(parsed);
        }).catch(e => App.toast('导入失败：' + e.message, 'err'));
      });
    },

    showAllRosterPreview(parsed) {
      // 统计每班新增/更新
      const stats = {};
      Object.keys(parsed.groups).forEach(cid => {
        const c = DB().getClass(cid);
        let addN = 0, updN = 0;
        parsed.groups[cid].forEach(r => {
          const hit = c.students.find(s => s.no === r.no) || (r.no ? null : c.students.find(s => s.name === r.name));
          if (hit) updN++; else addN++;
        });
        stats[cid] = { addN, updN };
      });
      const cids = Object.keys(parsed.groups).sort((a, b) => +a - +b);
      const rowsHtml = cids.map(cid => {
        const c = DB().getClass(cid);
        const s = stats[cid];
        return `<tr><td><b>${App.esc(c ? c.name : cid + '班')}</b></td><td class="num">${parsed.groups[cid].length}</td>
          <td class="num" style="color:var(--ok)">+${s.addN}</td><td class="num">${s.updN}</td><td class="num">${c ? c.students.length : 0}</td></tr>`;
      }).join('');
      const skipHtml = parsed.skipped.length ? `<div class="small muted mt8">⚠️ 跳过 ${parsed.skipped.length} 行：${parsed.skipped.slice(0, 5).map(s => `${App.esc(s.name || s.no)}（${s.why}）`).join('、')}${parsed.skipped.length > 5 ? '…' : ''}</div>` : '';
      App.modal({
        title: '全年级学生导入 · 预览',
        body: `
        <div class="flex mb12">
          <span class="badge green">共 ${parsed.total} 人</span>
          <span class="badge green">涉及 ${cids.length} 个班</span>
          <span class="badge orange">表头：${App.esc(parsed.header)}</span>
        </div>
        <div class="tbl-wrap" style="max-height:320px;overflow:auto">
          <table class="tbl"><thead><tr><th>班级</th><th class="num">本次行数</th><th class="num">新增</th><th class="num">更新</th><th class="num">导入后人数</th></tr></thead>
          <tbody>${rowsHtml}</tbody></table>
        </div>
        ${skipHtml}
        <div class="small muted mt8">💡 按「班级」列自动分发到 1-15 班；同名同学号自动更新。确认后将立即写入各班级档案。</div>`,
        wide: true,
        foot: `<button class="btn btn-ghost" onclick="EJWP.modalClose()">取消</button>
               <button class="btn btn-primary" id="arOk">确认导入 ${parsed.total} 人</button>`
      });
      App.$('#arOk').onclick = () => {
        const r = this.applyAllRoster(parsed.groups);
        App.modalClose();
        App.toast(`全年级导入完成：新增 ${r.addN} 人，更新 ${r.updN} 人，涉及 ${cids.length} 个班`, 'ok');
        this.render();
      };
    },

    applyAllRoster(groups) {
      let addN = 0, updN = 0;
      Object.keys(groups).forEach(cid => {
        const c = DB().getClass(cid);
        groups[cid].forEach(r => {
          const hit = c.students.find(s => s.no === r.no) || (r.no ? null : c.students.find(s => s.name === r.name));
          if (hit) { if (r.name) hit.name = r.name; updN++; }
          else { c.students.push({ id: App.uid('s'), no: r.no, name: r.name }); addN++; }
        });
      });
      DB().save('全年级导入名单');
      return { addN, updN };
    },

    importRoster() {
      App.pickFile({ accept: '.xlsx,.xls,.csv' }).then(file => {
        if (!file) return;
        App.readWorkbook(file).then(wb => {
          const rows = App.workbookToRows(wb);
          const parsed = this.parseRosterRows(rows);
          if (parsed.error) { App.toast(parsed.error, 'err'); return; }
          this.showRosterPreview(parsed);
        }).catch(e => App.toast('导入失败：' + e.message, 'err'));
      });
    },
    parseRosterRows(rows) {
      // 找表头行
      let hi = -1;
      for (let i = 0; i < Math.min(rows.length, 12); i++) {
        const cells = rows[i].map(String);
        if (cells.some(c => /学号|学籍号|编号/.test(c)) && cells.some(c => /姓名|名字/.test(c))) { hi = i; break; }
      }
      if (hi < 0) return { error: '未找到表头（需包含「学号」「姓名」列）' };
      const header = rows[hi].map(c => String(c).trim());
      const idx = key => header.findIndex(h => h.includes(key));
      const iNo = idx('学号'), iName = idx('姓名');
      const out = [];
      for (let r = hi + 1; r < rows.length; r++) {
        const cells = rows[r].map(c => String(c == null ? '' : c).trim());
        const no = iNo >= 0 ? cells[iNo] : '';
        const name = iName >= 0 ? cells[iName] : '';
        if (!no && !name) continue;
        out.push({ no, name });
      }
      if (!out.length) return { error: '表格中没有有效数据行' };
      return { ok: true, records: out };
    },
    showRosterPreview(parsed) {
      const c = DB().getClass(this.classId);
      const recs = parsed.records;
      const existing = new Map(c.students.map(s => [s.no, s]));
      let addN = 0, updN = 0, skipN = 0;
      const sample = recs.slice(0, 6).map(r => `<tr><td>${App.esc(r.no)}</td><td>${App.esc(r.name)}</td></tr>`).join('');
      const body = `<div class="small muted mb12">共解析 <b>${recs.length}</b> 行 → 新增 ${'<b>' + addN + '</b>'}（预览后确认）</div>
        <div class="tbl-wrap" style="max-height:300px;overflow:auto"><table class="tbl"><thead><tr><th>学号</th><th>姓名</th></tr></thead><tbody>${sample}</tbody></table></div>
        <div class="small muted mt8">💡 同名同学号自动更新，学号不重复的新记录将添加到 ${App.esc(c.name)}。</div>`;
      App.modal({
        title: `导入名单到 ${c.name} · 预览`,
        body, foot: `<button class="btn btn-ghost" onclick="EJWP.modalClose()">取消</button><button class="btn btn-primary" id="rpOk">确认导入 ${recs.length} 条</button>`
      });
      App.$('#rpOk').onclick = () => {
        recs.forEach(r => {
          if (!r.name) { skipN++; return; }
          const hit = c.students.find(s => s.no === r.no) || (r.no ? null : c.students.find(s => s.name === r.name));
          if (hit) { if (r.name) hit.name = r.name; updN++; }
          else { c.students.push({ id: App.uid('s'), no: r.no, name: r.name }); addN++; }
        });
        DB().save('导入名单');
        App.modalClose();
        App.toast(`导入完成：新增 ${addN} 人，更新 ${updN} 人${skipN ? '，跳过 ' + skipN + ' 行' : ''}`, 'ok');
        this.render();
      };
    },

    /* ---------- 全局搜索 ---------- */
    doSearch(q) {
      this.searchQ = q;
      if (!q) { this.searchQ = ''; this.render(); return; }
      this.render();
    },
    searchResultsHTML() {
      const q = this.searchQ.toLowerCase();
      const hits = [];
      DB().state.classes.forEach(c => {
        c.students.forEach(s => {
          if ((s.name || '').toLowerCase().includes(q) || (s.no || '').toLowerCase().includes(q)) {
            hits.push({ s, c });
          }
        });
      });
      if (!hits.length) return `<div class="empty"><div class="e-ico">🔍</div><p>没有找到与「${App.esc(this.searchQ)}」匹配的学生，请检查姓名或学号</p></div>`;
      return `<div class="search-res">
        <div class="card-title mb12">🔍 搜索结果：${hits.length} 名学生</div>
        ${hits.map(({ s, c }) => `<div class="stu-hit" data-act="hitStu" data-id="${s.id}">
          <span class="sh-name">${App.esc(s.name)}</span>
          <span class="sh-no">学号：${App.esc(s.no || '—')}</span>
          <span class="sh-cls">${App.esc(c.name)}</span>
        </div>`).join('')}
      </div>`;
    },

    /* ---------- 学生卡片（档案 + 历次成绩 + 走势图） ---------- */
    findStudentInClass(sid) {
      for (const c of DB().state.classes) {
        const s = c.students.find(x => x.id === sid);
        if (s) return { s, c };
      }
      return null;
    },
    studentHistory(s) {
      const out = [];
      [...DB().state.exams].sort((a, b) => (a.date || '').localeCompare(b.date || '')).forEach(ex => {
        for (const cid of ex.classIds || []) {
          const rec = (ex.scores[cid] || []).find(r => r.studentId === s.id || (r.no && r.no === s.no));
          if (rec) {
            const clsAvg = App.statsOf((ex.scores[cid] || []).map(r => App.num(r.total))).avg;
            out.push({ exam: ex, classId: cid, rec, clsAvg });
            break;
          }
        }
      });
      return out;
    },
    openStudentCard(sid) {
      const found = this.findStudentInClass(sid);
      if (!found) { App.toast('学生不存在', 'err'); return; }
      const { s, c } = found;
      const history = this.studentHistory(s);
      const rows = history.length ? history.map(h => {
        const full = App.fullTotal(h.exam.fullMarks);
        const rate = h.rec.total != null ? (h.rec.total / full * 100) : null;
        const diff = h.rec.rank != null && h.rec.total != null ? '' : '';
        return `<tr>
          <td><b>${App.esc(h.exam.name)}</b> <span class="badge gray">${App.esc(h.exam.type || '考试')}</span></td>
          <td>${App.esc(h.exam.date)}</td>
          <td class="num"><b>${App.fmt(h.rec.total)}</b> / ${full}</td>
          <td class="num">${rate != null ? App.fmt(rate, 1) + '%' : '—'}</td>
          <td class="num">${h.rec.rank == null ? '—' : h.rec.rank}</td>
          <td class="num">${h.clsAvg != null ? App.fmt(h.clsAvg) : '—'}</td>
          <td>${h.rec.total != null && h.clsAvg != null ? (h.rec.total >= h.clsAvg ? '<span class="badge green">↑ 超班级均分</span>' : '<span class="badge orange">↓ 低于班级均分</span>') : '—'}</td>
        </tr>`;
      }).join('') : '<tr><td colspan="7" style="text-align:center;color:#8aa096;padding:22px">该生还没有考试成绩记录</td></tr>';

      const hasChart = history.length >= 2;
      const body = `
      <div class="flex mb12">
        <div style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,var(--mint-300),var(--mint-500));display:flex;align-items:center;justify-content:center;font-size:22px;color:#fff;font-weight:800">${App.esc((s.name || '?')[0])}</div>
        <div>
          <div style="font-size:19px;font-weight:800;color:var(--mint-900)">${App.esc(s.name)}</div>
          <div class="muted small">${App.esc(c.name)} · 学号 ${App.esc(s.no || '—')} · 参加考试 ${history.length} 次</div>
        </div>
      </div>
      <div class="card-title mb12">📈 历次考试成绩走势（总分）</div>
      <div style="position:relative;height:240px"><canvas id="stuTrendChart"></canvas></div>
      <div class="card-title mt16 mb12">📋 历次考试成绩明细</div>
      <div class="tbl-wrap" style="max-height:260px;overflow:auto">
        <table class="tbl"><thead><tr><th>考试</th><th>日期</th><th class="num">总分/满分</th><th class="num">得分率</th><th class="num">班内排名</th><th class="num">班级均分</th><th>对比</th></tr></thead>
        <tbody>${rows}</tbody></table>
      </div>`;
      App.modal({
        title: '学生档案卡片',
        body,
        wide: true,
        foot: `<button class="btn btn-ghost" onclick="EJWP.modalClose()">关闭</button>
               <button class="btn btn-ghost" id="scExport">📤 导出成绩明细</button>
               <button class="btn btn-primary" id="scEdit">✏️ 编辑信息</button>`,
        onOpen: () => { if (hasChart) this.drawTrend(history); }
      });
      App.$('#scEdit').onclick = () => { App.modalClose(); this.view = 'class:' + c.id; this.classId = c.id; this.render(); this.editStudent(s.id); };
      App.$('#scExport').onclick = () => this.exportHistory(s, c, history);
    },

    drawTrend(history) {
      const labels = history.map(h => App.esc(h.exam.name) + ' ' + h.exam.date.slice(5));
      const mine = history.map(h => (h.rec.total != null ? h.rec.total : null));
      const avg = history.map(h => h.clsAvg != null ? +h.clsAvg.toFixed(1) : null);
      App.newChart(App.$('#stuTrendChart'), {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label: '本人总分', data: mine, borderColor: '#249966', backgroundColor: 'rgba(36,153,102,.12)', tension: .3, pointRadius: 4, fill: true },
            { label: '班级平均分', data: avg, borderColor: '#d9a013', borderDash: [6, 4], tension: .3, pointRadius: 3, fill: false }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { labels: { usePointStyle: true } } },
          scales: { y: { beginAtZero: true, title: { display: true, text: '总分' } } }
        }
      });
    },

    exportHistory(s, c, history) {
      const aoa = [['考试名称', '日期', '考试类型', '总分', '满分', '得分率', '班内排名', '班级平均分'],
        ...history.map(h => {
          const full = App.fullTotal(h.exam.fullMarks);
          const rate = h.rec.total != null ? (h.rec.total / full * 100).toFixed(1) + '%' : '';
          return [h.exam.name, h.exam.date, h.exam.type || '', h.rec.total, full, rate, h.rec.rank, h.clsAvg != null ? +h.clsAvg.toFixed(1) : ''];
        })];
      App.downloadXlsx(aoa, `${c.name}-${s.name}-历次成绩.xlsx`, { widths: [16, 12, 10, 8, 8, 10, 10, 10] });
      App.toast('成绩明细已导出', 'ok');
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
