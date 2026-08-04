/* ============================================================
 * materials.js — 资料管理板块
 *  课件 / 教案 / 试卷 / 练习题 / 默写卷 / 背诵资料 / 成绩
 *  · File System Access API 绑定本地文件夹直接读写
 *  · 未绑定时存入浏览器内置存储（IndexedDB）
 * ============================================================ */
(function (global) {
  'use strict';
  const App = global.EJWP;
  const DB = () => App.DB;

  const CAT_ICON = { '课件': '🎞️', '教案': '📝', '试卷': '📄', '练习题': '✏️', '默写卷': '📖', '背诵资料': '🗣️', '成绩': '📊' };

  App.Materials = {
    folderHandle: null,
    category: '课件',
    q: '',

    init() {
      App.$('#matBtnBind').onclick = () => this.bindFolder();
      App.$('#matBtnUpload').onclick = () => this.uploadModal();
      this.render();
    },

    /* ============ 文件夹绑定 ============ */
    hasFS() { return typeof global.showDirectoryPicker === 'function'; },

    async bindFolder() {
      if (!this.hasFS()) {
        App.toast('当前浏览器不支持文件夹读写（File System Access API），请使用 Chrome / Edge 浏览器。资料仍可存入内置存储。', 'err', 4200);
        return;
      }
      try {
        const handle = await global.showDirectoryPicker({ mode: 'readwrite' });
        // 创建 7 个分类子文件夹
        for (const cat of App.MAT_CATEGORIES) {
          await handle.getDirectoryHandle(cat, { create: true });
        }
        this.folderHandle = handle;
        DB().state.settings.materialFolderName = handle.name;
        DB().save('绑定资料文件夹');
        App.toast(`已绑定资料文件夹「${handle.name}」`, 'ok');
      } catch (e) {
        if (e && e.name === 'AbortError') return; // 用户取消
        App.toast('绑定失败：' + (e && e.message ? e.message : e), 'err');
      }
      this.render();
    },

    unbindFolder() {
      App.confirm({
        title: '解绑资料文件夹',
        message: '解绑后，资料文件仍保留在原来的文件夹中，但平台将改用内置存储保存新资料。',
        okText: '解绑',
        onOk: () => {
          this.folderHandle = null;
          DB().state.settings.materialFolderName = '';
          DB().save('解绑文件夹');
          App.toast('已解绑', 'ok');
          this.render();
        }
      });
    },

    catDir(cat) {
      return this.folderHandle.getDirectoryHandle(cat, { create: true });
    },

    render() {
      this.renderTip();
      const v = App.$('#materialsView');
      const st = DB().state.settings;
      const mats = DB().state.materials
        .filter(m => this.category === '*' || m.category === this.category)
        .filter(m => !this.q || (m.title + m.desc).toLowerCase().includes(this.q.toLowerCase()))
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      const catChips = `<button class="mat-cat ${this.category === '*' ? 'active' : ''}" data-cat="*">全部</button>` +
        App.MAT_CATEGORIES.map(c => `<button class="mat-cat ${this.category === c ? 'active' : ''}" data-cat="${c}">${CAT_ICON[c]} ${c}</button>`).join('');

      const cards = mats.length ? mats.map(m => {
        const size = this.fmtSize(m.size);
        return `<div class="mat-card">
          <div class="mc-ico">${CAT_ICON[m.category] || '📎'}</div>
          <div class="mc-title">${App.esc(m.title)}</div>
          <div class="mc-desc">${App.esc(m.desc || '（无描述）')}</div>
          <div class="mc-meta">
            <span>${App.esc(m.fileName || '')} · ${size}</span>
            <span>${m.stored === 'folder' ? '<span class="badge green">📁 文件夹</span>' : '<span class="badge gray">💾 内置存储</span>'}</span>
          </div>
          <div class="mc-acts">
            <button class="btn btn-xs btn-primary" data-act="open" data-id="${m.id}">⬇ 下载</button>
            <button class="btn btn-xs btn-ghost" data-act="edit" data-id="${m.id}">✏️</button>
            <button class="btn btn-xs btn-danger" data-act="del" data-id="${m.id}">🗑</button>
          </div>
          <div class="small muted">${App.esc((m.createdAt || '').slice(0, 10))}</div>
        </div>`;
      }).join('') : `<div class="empty" style="grid-column:1/-1"><div class="e-ico">📁</div><p>「${this.category === '*' ? '全部' : this.category}」分类下还没有资料，点击右上角「上传资料」添加</p></div>`;

      v.innerHTML = `
      <div class="card">
        <div class="flex mb12">
          <div class="card-title" style="margin:0">📂 资料分类</div>
          <div class="spacer"></div>
          <div class="search-box"><input type="search" id="matSearch" placeholder="搜索资料标题 / 描述…" value="${App.esc(this.q)}"></div>
        </div>
        <div class="mat-cats" id="matCats">${catChips}</div>
        <div class="mat-grid">${cards}</div>
      </div>`;
      App.$('#matCats').addEventListener('click', e => {
        const b = e.target.closest('.mat-cat');
        if (!b) return;
        this.category = b.dataset.cat;
        this.render();
      });
      App.$('#matSearch').addEventListener('input', e => {
        this.q = e.target.value.trim();
        this.render();
      });
      App.delegate(v, {
        click: {
          open: (e, el) => this.openMaterial(el.dataset.id),
          edit: (e, el) => this.editModal(el.dataset.id),
          del: (e, el) => this.deleteMaterial(el.dataset.id)
        }
      });
    },

    renderTip() {
      const t = App.$('#matStorageTip');
      const name = DB().state.settings.materialFolderName;
      const bound = this.folderHandle && name;
      t.innerHTML = bound
        ? `<span>✅ 已绑定资料文件夹：<b>${App.esc(name)}</b>（上传的资料将直接写入该文件夹的分类子目录）</span>
           <span><button class="btn btn-xs btn-ghost" id="matRebind">🔄 重新绑定</button>
           <button class="btn btn-xs btn-danger" id="matUnbind">解绑</button></span>`
        : `<span>${name ? `🗂 上次绑定了「${App.esc(name)}」，但浏览器不允许自动重连，请点击「绑定资料文件夹」重新连接` : '💡 未绑定文件夹：资料将保存在<b>浏览器内置存储</b>（刷新不丢失）。建议绑定一个本地文件夹，资料文件可直接在电脑上查看。'}</span>
           <button class="btn btn-xs btn-primary" id="matBindNow">🗂 绑定资料文件夹</button>`;
      const b1 = App.$('#matRebind'), b2 = App.$('#matUnbind'), b3 = App.$('#matBindNow');
      if (b1) b1.onclick = () => this.bindFolder();
      if (b2) b2.onclick = () => this.unbindFolder();
      if (b3) b3.onclick = () => this.bindFolder();
    },

    fmtSize(n) {
      if (n == null) return '—';
      if (n < 1024) return n + ' B';
      if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
      return (n / 1048576).toFixed(2) + ' MB';
    },

    /* ============ 上传 ============ */
    uploadModal(preCat) {
      let files = [];
      const cat = preCat || this.category || '课件';
      App.modal({
        title: '上传资料',
        body: `
        <div class="form-grid">
          <div class="field"><label>资料分类</label>
            <select id="upCat">${App.MAT_CATEGORIES.map(c => `<option ${c === cat ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
          <div class="field"><label>资料标题</label><input type="text" id="upTitle" placeholder="如：Unit 5 教案"></div>
        </div>
        <div class="field"><label>描述（可选）</label><input type="text" id="upDesc" placeholder="如：3.2 英语课使用"></div>
        <div class="field"><label>选择文件</label>
          <button class="btn btn-ghost btn-sm" id="upPick">📎 选择文件…</button>
          <div class="tip" id="upList">尚未选择文件</div>
        </div>`,
        foot: `<button class="btn btn-ghost" onclick="EJWP.modalClose()">取消</button>
               <button class="btn btn-primary" id="upOk" disabled>上传</button>`
      });
      App.$('#upPick').onclick = () => {
        App.pickFile({ multiple: true }).then(fl => {
          if (!fl || !fl.length) return;
          files = fl;
          App.$('#upList').textContent = `已选择 ${fl.length} 个文件：` + fl.map(f => f.name).join('、');
          App.$('#upOk').disabled = false;
        });
      };
      App.$('#upOk').onclick = async () => {
        const title = App.$('#upTitle').value.trim();
        if (!files.length) { App.toast('请先选择文件', 'err'); return; }
        const storeCat = App.$('#upCat').value;
        let n = 0;
        for (const f of files) {
          const t = title || f.name.replace(/\.[^.]+$/, '');
          await this.saveMaterial({ category: storeCat, title: t, desc: App.$('#upDesc').value.trim(), file: f });
          n++;
        }
        App.modalClose();
        App.toast(`已上传 ${n} 个资料到「${storeCat}」`, 'ok');
        this.category = storeCat;
        this.render();
      };
    },

    async saveMaterial({ category, title, desc, file }) {
      const m = { id: App.uid('mat'), category, title, desc, fileName: file.name, size: file.size, createdAt: new Date().toISOString() };
      if (this.folderHandle) {
        // 写入文件夹分类子目录
        try {
          const dir = await this.catDir(category);
          const safe = Date.now() + '-' + file.name.replace(/[\\/:*?"<>|]/g, '_');
          const fh = await dir.getFileHandle(safe, { create: true });
          const w = await fh.createWritable();
          await w.write(await file.arrayBuffer());
          await w.close();
          m.stored = 'folder';
          m.fileName = safe;
        } catch (e) {
          App.toast('写入文件夹失败，已改为内置存储：' + (e && e.message ? e.message : e), 'err', 3600);
          m.stored = 'idb';
          m.fileKey = App.uid('mf');
          await DB().idbPut(m.fileKey, file);
        }
      } else {
        m.stored = 'idb';
        m.fileKey = App.uid('mf');
        await DB().idbPut(m.fileKey, file);
      }
      DB().state.materials.push(m);
      DB().save('上传资料');
      return m;
    },

    /* ============ 下载 / 编辑 / 删除 ============ */
    async openMaterial(id) {
      const m = DB().state.materials.find(x => x.id === id);
      if (!m) { App.toast('资料不存在', 'err'); return; }
      try {
        let blob;
        if (m.stored === 'folder' && this.folderHandle) {
          const dir = await this.catDir(m.category);
          const fh = await dir.getFileHandle(m.fileName);
          blob = await fh.getFile();
        } else if (m.stored === 'idb') {
          blob = await DB().idbGet(m.fileKey);
          if (!blob) { App.toast('文件数据已丢失（可能被清理），请重新上传', 'err', 4000); return; }
        } else {
          App.toast('未绑定文件夹，无法读取该文件', 'err'); return;
        }
        App.downloadBlob(blob, m.fileName.replace(/^\d+-/, ''));
        App.toast(`正在下载「${m.title}」`, 'ok');
      } catch (e) {
        App.toast('下载失败：' + (e && e.message ? e.message : e), 'err');
      }
    },

    editModal(id) {
      const m = DB().state.materials.find(x => x.id === id);
      if (!m) return;
      App.modal({
        title: '编辑资料信息',
        body: `
        <div class="field"><label>分类</label>
          <select id="edCat">${App.MAT_CATEGORIES.map(c => `<option ${c === m.category ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
        <div class="field"><label>标题</label><input type="text" id="edTitle" value="${App.esc(m.title)}"></div>
        <div class="field"><label>描述</label><input type="text" id="edDesc" value="${App.esc(m.desc || '')}"></div>`,
        foot: `<button class="btn btn-ghost" onclick="EJWP.modalClose()">取消</button><button class="btn btn-primary" id="edOk">保存</button>`
      });
      App.$('#edOk').onclick = () => {
        m.category = App.$('#edCat').value;
        m.title = App.$('#edTitle').value.trim() || m.title;
        m.desc = App.$('#edDesc').value.trim();
        DB().save('编辑资料');
        App.modalClose();
        this.render();
      };
    },

    deleteMaterial(id) {
      const m = DB().state.materials.find(x => x.id === id);
      if (!m) return;
      App.confirm({
        title: '删除资料',
        danger: true, okText: '删除',
        message: `确定删除资料「<b>${App.esc(m.title)}</b>」吗？${m.stored === 'folder' && this.folderHandle ? '文件夹中的文件也将被删除。' : ''}`,
        onOk: async () => {
          if (m.stored === 'folder' && this.folderHandle) {
            try { const dir = await this.catDir(m.category); await dir.removeEntry(m.fileName); } catch (e) { /* 文件可能已不存在 */ }
          } else if (m.stored === 'idb' && m.fileKey) {
            await DB().idbDel(m.fileKey);
          }
          DB().state.materials = DB().state.materials.filter(x => x.id !== id);
          DB().save('删除资料');
          App.toast('已删除', 'ok');
          this.render();
        }
      });
    },

    /* ============ 备份辅助 ============ */
    async backupAllToFolder() {
      if (!this.folderHandle) return false;
      try {
        const json = DB().exportJSON();
        const fh = await this.folderHandle.getFileHandle('平台数据备份-' + App.today() + '.json', { create: true });
        const w = await fh.createWritable();
        await w.write(json);
        await w.close();
        return true;
      } catch (e) { return false; }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
