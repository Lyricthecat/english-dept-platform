/* ============================================================
 * app.js — 主框架
 *  标签页路由（hash）· 模块初始化 / 重载 · 弹窗全局事件
 * ============================================================ */
(function (global) {
  'use strict';
  const App = global.EJWP;

  const TABS = ['plans', 'students', 'grades', 'materials', 'settings'];

  App.curTab = 'plans';

  App.switchTab = function (name) {
    if (!TABS.includes(name)) name = 'plans';
    App.curTab = name;
    App.$$('.tab-page').forEach(p => p.hidden = true);
    const page = App.$('#page-' + name);
    if (page) page.hidden = false;
    App.$$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.tab === name));
    if (global.location && global.location.hash !== '#/' + name) {
      try { history.replaceState(null, '', '#/' + name); } catch (e) {}
    }
    App.closeAllCharts();
    // 渲染对应板块
    switch (name) {
      case 'plans': App.Plan.render(); break;
      case 'students': App.Students.render(); break;
      case 'grades': App.Grades.render(); break;
      case 'materials': App.Materials.render(); break;
      case 'settings': App.Settings.render(); break;
    }
  };

  App.reinitAll = function () {
    App.Plan.init();
    App.Students.init();
    App.Grades.init();
    App.Materials.init();
    App.Settings.init();
    App.switchTab(App.curTab);
  };

  App.init = function () {
    // 环境检查
    if (!global.Chart) { App.toast('Chart.js 未加载，图表功能不可用（请确认 lib/chart.umd.js 存在）', 'err', 5000); }
    if (!global.XLSX) { App.toast('SheetJS 未加载，Excel 功能不可用（请确认 lib/xlsx.full.min.js 存在）', 'err', 5000); }

    App.DB.load();

    // 导航
    App.$$('.nav-item').forEach(n => {
      n.onclick = () => App.switchTab(n.dataset.tab);
    });

    // 弹窗全局事件
    App.$('#modalClose').onclick = App.modalClose;
    App.$('#modalMask').addEventListener('click', e => { if (e.target === App.$('#modalMask')) App.modalClose(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !App.$('#modalMask').hidden) App.modalClose(); });

    // 各模块初始化（绑定静态控件）
    App.Plan.init();
    App.Students.init();
    App.Grades.init();
    App.Materials.init();
    App.Settings.init();

    // 路由
    const fromHash = () => {
      const h = (global.location.hash || '').replace(/^#\//, '');
      if (h && TABS.includes(h)) return h;
      return 'plans';
    };
    global.addEventListener('hashchange', () => App.switchTab(fromHash()));
    App.switchTab(fromHash());
  };

  document.addEventListener('DOMContentLoaded', () => App.init());
})(typeof window !== 'undefined' ? window : globalThis);
