/* ============================================================
 * store.js — 数据层
 *  · localStorage 数据库（自动存取，刷新不丢失）
 *  · IndexedDB 存储资料文件（二进制）
 *  · 备份 / 恢复 / 清空
 * ============================================================ */
(function (global) {
  'use strict';
  const App = global.EJWP;

  const KEY = 'ejwp:v1';
  const IDB_NAME = 'ejwp-files';
  const IDB_STORE = 'files';

  function defaultState() {
    return {
      version: 1,
      settings: {
        schoolName: '初中英语科组',
        gradeName: '九年级',
        classPrefix: '',   // 班级命名前缀：如 '8' → 801班~815班；留空 → 1班~15班
        // 班级分层（同层次对比用）：支持 "1-4,7-10" 简写
        classTiers: { A: '11,12', B: '5,6', C: '1-4,7-10,13-15' },
        termStart: App.mondayOf(App.today()),   // 学期开始（周一），用于周计划编号
        passPct: 60,      // 及格线（占满分百分比）
        goodPct: 85,      // 优秀线
        lowPct: 40        // 低分线
      },
      plans: [],          // 周计划 [{id, week, termStart, focus, lessons:[{id,date,period,content,homework,note}]}]
      classes: [],        // 15 个班 [{id:'1', name:'1班', students:[{id,no,name}]}]
      exams: [],          // 考试 [{id,name,date,type,fullMarks,classIds,scores:{classId:[rec]}}]
      materials: []       // 资料 [{id,category,title,desc,fileName,size,stored,fileKey,createdAt}]
    };
  }

  const DB = {
    KEY,
    state: null,
    saveTimer: null,

    /* ---------- 基础读写 ---------- */
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
          const st = JSON.parse(raw);
          // 与默认结构合并，保证字段完整
          const d = defaultState();
          this.state = {
            version: d.version,
            settings: Object.assign(d.settings, st.settings || {}),
            plans: st.plans || [],
            classes: st.classes || [],
            exams: st.exams || [],
            materials: st.materials || []
          };
        } else {
          this.state = defaultState();
        }
      } catch (e) {
        console.error('数据读取失败，已重置', e);
        this.state = defaultState();
      }
      this.ensureClasses();
      return this.state;
    },

    save(msg) {
      if (!this.state) return; // 尚未初始化（load 之前），忽略
      try {
        localStorage.setItem(KEY, JSON.stringify(this.state));
        const t = new Date();
        const pad = n => String(n).padStart(2, '0');
        const time = pad(t.getHours()) + ':' + pad(t.getMinutes()) + ':' + pad(t.getSeconds());
        const st = App.$('#saveStatus');
        if (st) st.textContent = '💾 数据已自动保存';
        const st2 = App.$('#saveTime');
        if (st2) st2.textContent = '最近保存 ' + time + (msg ? ' · ' + msg : '');
        // 存储用量显示
        const us = App.$('#lsUsage');
        if (us) {
          const sz = App.lsSize();
          const kb = (sz / 1024).toFixed(1), mb = (sz / 1048576).toFixed(2);
          const pct = Math.min(100, (sz / (5 * 1048576) * 100)).toFixed(0);
          us.textContent = `存储用量：${kb} KB (${pct}%)`;
          us.style.color = +pct > 80 ? '#f08080' : '#7fbd9e';
          if (+pct > 80) us.textContent += ' ⚠️ 建议导出备份';
        }
      } catch (e) {
        console.error('保存失败', e);
        App.toast('保存失败：浏览器存储空间不足？', 'err');
      }
    },

    touch(msg) { this.save(msg); },

    /* ---------- 15 个班初始化 ---------- */
    ensureClasses() {
      if (!this.state.classes || !this.state.classes.length) {
        this.state.classes = Array.from({ length: 15 }, (_, i) => ({
          id: String(i + 1),
          name: App.className(i + 1),
          students: []
        }));
        this.save();
      }
    },
    getClass(id) { return this.state.classes.find(c => c.id === String(id)) || null; },
    // 按当前班级命名前缀刷新所有班级显示名
    refreshClassNames() {
      this.state.classes.forEach(c => { c.name = App.className(c.id); });
      this.save('更新班级命名');
    },

    /* ---------- IndexedDB 文件存储 ---------- */
    idbOpen() {
      return new Promise((res, rej) => {
        if (!global.indexedDB) return rej(new Error('浏览器不支持 IndexedDB'));
        const req = indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(IDB_STORE)) req.result.createObjectStore(IDB_STORE); };
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      });
    },
    idbPut(key, blob) {
      return this.idbOpen().then(db => new Promise((res, rej) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(blob, key);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      }));
    },
    idbGet(key) {
      return this.idbOpen().then(db => new Promise((res, rej) => {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const rq = tx.objectStore(IDB_STORE).get(key);
        rq.onsuccess = () => res(rq.result || null);
        rq.onerror = () => rej(rq.error);
      }));
    },
    idbDel(key) {
      return this.idbOpen().then(db => new Promise((res, rej) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).delete(key);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      }));
    },
    idbClear() {
      return this.idbOpen().then(db => new Promise((res, rej) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).clear();
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      }));
    },

    /* ---------- 备份 / 恢复 ---------- */
    exportJSON() {
      return JSON.stringify({ app: '初中英语科组工作平台', exportedAt: new Date().toISOString(), ...this.state }, null, 2);
    },
    validateImport(obj) {
      return obj && typeof obj === 'object' && Array.isArray(obj.classes) && Array.isArray(obj.exams) &&
        Array.isArray(obj.plans) && Array.isArray(obj.materials) && obj.settings && typeof obj.settings === 'object';
    },
    // mode: 'replace' 覆盖  |  'merge' 合并
    importJSON(text, mode) {
      let obj;
      try { obj = JSON.parse(text); } catch (e) { throw new Error('不是有效的 JSON 文件'); }
      if (!this.validateImport(obj)) throw new Error('数据文件格式不正确，无法导入');
      if (mode === 'merge') {
        // 按 id 合并，避免重复
        const mergeById = (cur, inc, isClass) => {
          const map = new Map(cur.map(x => [x.id, x]));
          (inc || []).forEach(x => {
            if (map.has(x.id)) {
              const old = map.get(x.id);
              if (isClass && old.students && x.students) {
                const stuMap = new Map(old.students.map(s => [s.id, s]));
                x.students.forEach(s => { if (!stuMap.has(s.id)) old.students.push(s); });
              }
            } else { map.set(x.id, x); cur.push(x); }
          });
          return cur;
        };
        this.state.classes = mergeById(this.state.classes, obj.classes, true);
        this.state.exams = mergeById(this.state.exams, obj.exams);
        this.state.plans = mergeById(this.state.plans, obj.plans);
        this.state.materials = mergeById(this.state.materials, obj.materials);
        this.state.settings = Object.assign(this.state.settings, obj.settings);
      } else {
        // 覆盖前先自动备份
        this.autoBackup();
        this.state.classes = obj.classes;
        this.state.exams = obj.exams;
        this.state.plans = obj.plans;
        this.state.materials = obj.materials;
        this.state.settings = Object.assign(defaultState().settings, obj.settings || {});
      }
      this.ensureClasses();
      this.save();
      return obj;
    },
    autoBackup() {
      try {
        const bak = localStorage.getItem(KEY);
        if (bak) localStorage.setItem(KEY + ':bak:' + Date.now(), bak);
        // 只保留最近 5 份自动备份
        const keys = Object.keys(localStorage).filter(k => k.startsWith(KEY + ':bak:')).sort();
        while (keys.length > 5) { localStorage.removeItem(keys.shift()); }
      } catch (e) { /* 忽略备份失败 */ }
    },

    /* ---------- 清空 ---------- */
    resetAll() {
      this.autoBackup();
      localStorage.removeItem(KEY);
      this.state = defaultState();
      this.ensureClasses();
      this.save();
    }
  };

  App.DB = DB;
})(typeof window !== 'undefined' ? window : globalThis);
