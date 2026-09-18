/* ============================================================
 * settings.js — 设置板块
 *  基本信息 · 数据导入导出（JSON 备份）· 备份/恢复到资料文件夹 · 清空数据 · 说明
 * ============================================================ */
(function (global) {
  'use strict';
  const App = global.EJWP;
  const DB = () => App.DB;

  App.Settings = {
    init() { this.render(); },

    render() {
      const v = App.$('#settingsView');
      const st = DB().state.settings;
      const folderName = st.materialFolderName;
      const bound = App.Materials.folderHandle && folderName;

      v.innerHTML = `
      <!-- 基本信息 -->
      <div class="card">
        <div class="card-title">🏫 基本信息</div>
        <div class="form-grid">
          <div class="field"><label>科组名称</label><input type="text" id="stSchool" value="${App.esc(st.schoolName)}"></div>
          <div class="field"><label>年级</label><input type="text" id="stGrade" value="${App.esc(st.gradeName)}"></div>
        </div>
        <div class="field"><label>班级命名前缀 <span class="hint">（留空显示 1班~15班；填「8」则显示 801班~815班，与 801/802 格式班级匹配）</span></label>
          <input type="text" id="stPrefix" value="${App.esc(st.classPrefix || '')}" placeholder="如：8" style="max-width:160px">
          <div class="tip">💡 保存后班级卡片、名单、导出的「班级」列都会用新命名；导入时仍能识别 1班 / 801 等多种写法。</div>
        </div>
        <div class="form-grid">
          <div class="field"><label>学期开始日期（周一，用于周计划编号）</label><input type="date" id="stTerm" value="${App.esc(st.termStart)}"></div>
          <div class="field"><label>成绩分数线（占满分百分比）</label>
            <div class="flex">
              优秀 ≥ <input type="number" id="stGood" value="${st.goodPct}" style="width:64px;padding:6px 8px;border:1.5px solid var(--line);border-radius:8px">%
              及格 ≥ <input type="number" id="stPass" value="${st.passPct}" style="width:64px;padding:6px 8px;border:1.5px solid var(--line);border-radius:8px">%
              低分 &lt; <input type="number" id="stLow" value="${st.lowPct}" style="width:64px;padding:6px 8px;border:1.5px solid var(--line);border-radius:8px">%
            </div>
          </div>
        </div>
        <button class="btn btn-primary" id="stSave">💾 保存设置</button>
      </div>

      <!-- 数据管理 -->
      <div class="card">
        <div class="card-title">📦 数据管理 <span class="hint">（localStorage 自动存取 · 建议定期导出备份）</span></div>
        <div class="set-row">
          <div class="sr-info"><div class="sr-title">📤 导出数据备份</div><div class="sr-desc">将全部数据（计划 / 学生 / 考试 / 资料目录）导出为 JSON 文件，妥善保存</div></div>
          <button class="btn btn-ghost btn-sm" id="stExport">导出 JSON</button>
        </div>
        <div class="set-row">
          <div class="sr-info"><div class="sr-title">📥 导入数据备份</div><div class="sr-desc">从之前导出的 JSON 恢复数据，可选择「覆盖」或「合并」</div></div>
          <select id="stImpMode" style="padding:6px 10px;border:1.5px solid var(--line);border-radius:8px">
            <option value="replace">覆盖全部数据</option><option value="merge">合并到现有数据</option>
          </select>
          <button class="btn btn-ghost btn-sm" id="stImport">导入 JSON</button>
        </div>
        <div class="set-row">
          <div class="sr-info"><div class="sr-title">🗂 备份到资料文件夹</div><div class="sr-desc">${bound ? '写入当前绑定的文件夹「' + App.esc(folderName) + '」' : '需先绑定资料文件夹（推荐用 Chrome / Edge）'}</div></div>
          <button class="btn btn-ghost btn-sm" id="stBakFolder" ${bound ? '' : 'disabled'}>备份到文件夹</button>
        </div>
        <div class="set-row">
          <div class="sr-info"><div class="sr-title">🗂 从资料文件夹恢复</div><div class="sr-desc">读取文件夹中的「平台数据备份-日期.json」并导入（覆盖模式）</div></div>
          <button class="btn btn-ghost btn-sm" id="stRestFolder" ${bound ? '' : 'disabled'}>从文件夹恢复</button>
        </div>
      </div>

      <!-- 资料存储 -->
      <div class="card">
        <div class="card-title">📁 资料存储方式</div>
        <div class="set-row">
          <div class="sr-info">
            <div class="sr-title">${bound ? '已绑定文件夹：' + App.esc(folderName) : '未绑定文件夹'}</div>
            <div class="sr-desc">${bound ? '资料直接读写电脑文件夹（分类子目录），文件可在资源管理器中直接查看' : '资料保存在浏览器内置存储中；绑定文件夹后可直读直写'}</div>
          </div>
          <button class="btn btn-ghost btn-sm" id="stBind">${bound ? '🔄 重新绑定' : '🗂 绑定文件夹'}</button>
          ${bound ? '<button class="btn btn-danger btn-sm" id="stUnbind">解绑</button>' : ''}
        </div>
        <div class="set-row">
          <div class="sr-info"><div class="sr-title">🧹 清空内置存储资料文件</div><div class="sr-desc">删除所有保存在浏览器内置存储中的资料文件（文件夹中的不受影响）</div></div>
          <button class="btn btn-danger btn-sm" id="stIdbClear">清空内置资料</button>
        </div>
      </div>

      <!-- 危险区 -->
      <div class="card danger-zone">
        <div class="card-title" style="color:var(--danger)">⚠️ 危险操作</div>
        <div class="set-row">
          <div class="sr-info"><div class="sr-title">清空全部数据</div><div class="sr-desc">删除所有计划 / 学生 / 考试 / 资料记录（执行前会自动备份一份到浏览器）</div></div>
          <button class="btn btn-danger" id="stReset">🗑 清空全部数据</button>
        </div>
      </div>

      <!-- 关于 -->
      <div class="card">
        <div class="card-title">ℹ️ 关于本平台</div>
        <div class="small" style="line-height:2;color:var(--ink-2)">
          <b>初中英语科组工作平台 v1.0</b> — 纯前端 SPA，双击即用，完全离线可用。<br>
          · 技术栈：HTML + CSS + JavaScript 三件套，localStorage 自动存取（刷新不丢失）<br>
          · Chart.js 本地打包（成绩走势 / 比对图表），SheetJS 本地打包（Excel 导入导出）<br>
          · File System Access API：可绑定本地文件夹直接读写资料（需 Chrome / Edge 浏览器）<br>
          · 数据保存在<b>当前浏览器</b>中：换浏览器 / 清缓存会丢失，请定期在「数据管理」导出 JSON 备份<br>
          · 推荐把本文件夹复制到电脑任意位置，双击 index.html（或单文件版）即可使用
        </div>
      </div>`;

      /* ---- 事件 ---- */
      App.$('#stSave').onclick = () => {
        const newPrefix = App.$('#stPrefix').value.trim();
        const prefixChanged = newPrefix !== (st.classPrefix || '');
        st.schoolName = App.$('#stSchool').value.trim() || '初中英语科组';
        st.gradeName = App.$('#stGrade').value.trim() || '九年级';
        st.classPrefix = newPrefix;
        st.termStart = App.$('#stTerm').value || App.mondayOf(App.today());
        st.goodPct = +App.$('#stGood').value || 85;
        st.passPct = +App.$('#stPass').value || 60;
        st.lowPct = +App.$('#stLow').value || 40;
        if (prefixChanged) DB().refreshClassNames();
        else DB().save('更新设置');
        App.toast(prefixChanged ? '设置已保存，班级命名已更新' : '设置已保存', 'ok');
        App.reinitAll();
      };
      App.$('#stExport').onclick = () => {
        App.downloadText(DB().exportJSON(), `英语科组数据备份-${App.today()}.json`);
        App.toast('备份文件已导出，请妥善保存', 'ok');
      };
      App.$('#stImport').onclick = () => this.importFromFile();
      App.$('#stBakFolder').onclick = async () => {
        const ok = await App.Materials.backupAllToFolder();
        if (ok) App.toast('已备份到资料文件夹', 'ok');
        else App.toast('备份失败：请先绑定资料文件夹', 'err');
      };
      App.$('#stRestFolder').onclick = () => this.restoreFromFolder();
      App.$('#stBind').onclick = () => App.Materials.bindFolder();
      const ub = App.$('#stUnbind');
      if (ub) ub.onclick = () => App.Materials.unbindFolder();
      App.$('#stIdbClear').onclick = () => {
        App.confirm({
          title: '清空内置存储资料', danger: true, okText: '清空',
          message: '将删除所有「内置存储」中的资料文件（资料目录也会同步移除）。绑定文件夹中的文件不受影响。',
          onOk: async () => {
            await DB().idbClear();
            DB().state.materials = DB().state.materials.filter(m => m.stored !== 'idb');
            DB().save('清空内置资料');
            App.toast('已清空内置存储资料', 'ok');
          }
        });
      };
      App.$('#stReset').onclick = () => {
        App.confirm({
          title: '清空全部数据', danger: true, okText: '继续',
          message: '即将删除<b>全部</b>数据（计划 / 学生 / 考试 / 资料）。执行前会自动在浏览器中留一份备份。确定继续吗？',
          onOk: () => {
            App.confirm({
              title: '再次确认', danger: true, okText: '确认清空',
              message: '这是最后一步确认。<b>清空后无法恢复</b>（除非之前导出过 JSON 备份）。确定清空全部数据？',
              onOk: () => {
                DB().resetAll();
                App.toast('已清空全部数据', 'ok');
                App.reinitAll();
              }
            });
          }
        });
      };
    },

    importFromFile() {
      App.pickFile({ accept: '.json' }).then(file => {
        if (!file) return;
        const fr = new FileReader();
        fr.onload = () => this.doImport(fr.result, App.$('#stImpMode').value);
        fr.readAsText(file, 'utf-8');
      });
    },

    doImport(text, mode) {
      try {
        const obj = JSON.parse(text);
        if (!DB().validateImport(obj)) throw new Error('格式不正确');
        const nCls = (obj.classes || []).length, nStu = obj.classes.reduce((s, c) => s + (c.students || []).length, 0);
        const nEx = (obj.exams || []).length, nPl = (obj.plans || []).length, nMat = (obj.materials || []).length;
        App.confirm({
          title: '导入数据确认',
          message: `将按「${mode === 'merge' ? '合并' : '覆盖'}」方式导入：<br>班级 ${nCls} 个 · 学生 ${nStu} 人 · 考试 ${nEx} 次 · 周计划 ${nPl} 份 · 资料 ${nMat} 条<br>${mode === 'replace' ? '<span class="text-danger">覆盖模式会替换当前全部数据（已自动备份当前数据）</span>' : ''}`,
          okText: '确认导入',
          onOk: () => {
            try {
              DB().importJSON(text, mode);
              App.toast('数据导入成功', 'ok');
              App.reinitAll();
            } catch (e) { App.toast('导入失败：' + e.message, 'err'); }
          }
        });
      } catch (e) { App.toast('导入失败：' + e.message, 'err'); }
    },

    async restoreFromFolder() {
      const M = App.Materials;
      if (!M.folderHandle) { App.toast('请先绑定资料文件夹', 'err'); return; }
      try {
        if (global.showOpenFilePicker) {
          const [fh] = await global.showOpenFilePicker({
            types: [{ description: 'JSON 备份', accept: { 'application/json': ['.json'] } }]
          });
          const f = await fh.getFile();
          const text = await f.text();
          this.doImport(text, 'replace');
        } else {
          App.toast('当前浏览器不支持文件选择 API，请用「导入数据备份」按钮', 'err');
        }
      } catch (e) {
        if (e && e.name === 'AbortError') return;
        App.toast('恢复失败：' + (e && e.message ? e.message : e), 'err');
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
