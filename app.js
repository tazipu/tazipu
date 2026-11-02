/* =====================================================================
 * 好记帐 PWA · 业务逻辑（与桌面 Electron 版规则一致）
 * - 自动保存到 IndexedDB，关闭重开数据仍在
 * - 桌面宽表 / 手机卡片 双视图，同一套数据
 * - 兼容桌面版 JSON 备份、CSV、XLSX 导入导出
 * ===================================================================== */
'use strict';

const MAX_HISTORY = 5;
let dataList = [];
let trashList = [];
let historyStack = [];
let historyIndex = -1;

/* ----------------------------- 工具函数 ----------------------------- */

function getToday() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function debounce(fn, ms) {
  let t = null;
  return function () { clearTimeout(t); t = setTimeout(fn, ms); };
}

/* ----------------------------- 自动保存 ----------------------------- */

async function persistNow() {
  try { await DB.save({ dataList, trashList }); } catch (e) { console.warn('自动保存失败', e); }
}
const scheduleSave = debounce(persistNow, 300);

/* ----------------------------- 撤销 / 前进 ----------------------------- */

function saveHistory() {
  historyStack.splice(historyIndex + 1);
  historyStack.push(JSON.parse(JSON.stringify(dataList)));
  if (historyStack.length > MAX_HISTORY) historyStack.shift();
  else historyIndex++;
  updateUndoRedoBtn();
}

function undo() {
  if (historyIndex <= 0) return;
  historyIndex--;
  dataList = JSON.parse(JSON.stringify(historyStack[historyIndex]));
  renderAll();
}

function redo() {
  if (historyIndex >= historyStack.length - 1) return;
  historyIndex++;
  dataList = JSON.parse(JSON.stringify(historyStack[historyIndex]));
  renderAll();
}

function updateUndoRedoBtn() {
  const u = document.getElementById('undoBtn');
  const r = document.getElementById('redoBtn');
  if (u) u.disabled = historyIndex <= 0;
  if (r) r.disabled = historyIndex >= historyStack.length - 1;
}

/* ----------------------------- 行操作 ----------------------------- */

function insertAbove(idx) {
  saveHistory();
  dataList.splice(idx, 0, { date: getToday(), name: '', spec: '', price: '', qty: '', subtotal: '', remark: '' });
  renderAll(); scheduleSave();
}
function insertBelow(idx) {
  saveHistory();
  dataList.splice(idx + 1, 0, { date: getToday(), name: '', spec: '', price: '', qty: '', subtotal: '', remark: '' });
  renderAll(); scheduleSave();
}
function moveUp(idx) {
  if (idx <= 0) return;
  saveHistory();
  [dataList[idx - 1], dataList[idx]] = [dataList[idx], dataList[idx - 1]];
  renderAll(); scheduleSave();
}
function moveDown(idx) {
  if (idx >= dataList.length - 1) return;
  saveHistory();
  [dataList[idx], dataList[idx + 1]] = [dataList[idx + 1], dataList[idx]];
  renderAll(); scheduleSave();
}
function addRow() {
  saveHistory();
  dataList.push({ date: getToday(), name: '', spec: '', price: '', qty: '', subtotal: '', remark: '' });
  renderAll(); scheduleSave();
}
function delRow(idx) {
  if (!confirm('删除这一行？移入回收站。')) return;
  saveHistory();
  trashList.push(dataList[idx]);
  dataList.splice(idx, 1);
  renderAll(); renderTrash(); scheduleSave();
}
function clearAll() {
  if (dataList.length === 0) return;
  if (!confirm('清空全部，移入回收站？')) return;
  saveHistory();
  trashList = trashList.concat(dataList);
  dataList = [];
  renderAll(); renderTrash(); scheduleSave();
}

/* ----------------------------- 统计 ----------------------------- */

function updateStat() {
  let total = 0;
  for (let i = 0; i < dataList.length; i++) total += Number(dataList[i].subtotal || 0);
  const t = total.toFixed(2);
  setText('rowCount', dataList.length);
  setText('totalMoney', t);
  setText('footTotal', t);
  setText('trashCount', trashList.length);
  updateCheckedCount();
}
function setText(id, v) { const el = document.getElementById(id); if (el) el.innerText = v; }

/* ----------------------------- 勾选 ----------------------------- */

function getCheckedIndexes() {
  const arr = [];
  document.querySelectorAll('.row-check').forEach((ck, idx) => { if (ck.checked) arr.push(ck.dataset.rowIndex); });
  return arr.map(Number);
}
function updateCheckedCount() { setText('checkedCount', getCheckedIndexes().length); }
function selectAll() { document.querySelectorAll('.row-check').forEach(c => c.checked = true); updateCheckedCount(); }
function unSelectAll() { document.querySelectorAll('.row-check').forEach(c => c.checked = false); updateCheckedCount(); }

function batchDelete() {
  const checked = getCheckedIndexes();
  if (checked.length === 0) { alert('请先勾选要删除的行！'); return; }
  if (!confirm(`确定删除选中 ${checked.length} 条？移入回收站。`)) return;
  saveHistory();
  checked.sort((a, b) => b - a).forEach(i => { trashList.push(dataList[i]); dataList.splice(i, 1); });
  renderAll(); renderTrash(); scheduleSave();
}

/* ----------------------------- 渲染：桌面表格 ----------------------------- */

function renderDesktopTable() {
  const tbody = document.getElementById('tableBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  dataList.forEach((item, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="checkbox" class="row-check" data-row-index="${idx}"></td>
      <td><input type="date" class="inp-date" value="${escapeHtml(item.date || getToday())}"></td>
      <td><textarea class="inp-name">${escapeHtml(item.name || '')}</textarea></td>
      <td><textarea class="inp-spec">${escapeHtml(item.spec || '')}</textarea></td>
      <td><input type="number" class="inp-qty" value="${escapeHtml(item.qty || '')}"></td>
      <td><input type="number" step="0.01" class="inp-price" value="${escapeHtml(item.price || '')}"></td>
      <td><input type="text" class="inp-sub" value="${escapeHtml(item.subtotal || '')}" readonly></td>
      <td><textarea class="inp-remark">${escapeHtml(item.remark || '')}</textarea></td>
      <td class="row-ops">
        <button class="btn-blue btn-small" data-act="insertAbove">↑上插</button>
        <button class="btn-blue btn-small" data-act="insertBelow">↓下插</button>
        <button class="btn-gray btn-small" data-act="moveUp">▲上移</button>
        <button class="btn-gray btn-small" data-act="moveDown">▼下移</button>
        <button class="btn-red btn-small" data-act="delRow">删除</button>
      </td>`;
    tbody.appendChild(tr);
    bindRowControls(tr, idx);
  });
  tbody.querySelectorAll('.row-check').forEach(cb => cb.onchange = updateCheckedCount);
}

/* ----------------------------- 渲染：手机卡片 ----------------------------- */

function renderMobileCards() {
  const wrap = document.getElementById('mobileCards');
  if (!wrap) return;
  wrap.innerHTML = '';
  if (dataList.length === 0) {
    wrap.innerHTML = '<div class="m-empty">暂无记录，点下方「新增一行」开始记帐</div>';
    return;
  }
  dataList.forEach((item, idx) => {
    const card = document.createElement('div');
    card.className = 'm-card';
    card.dataset.idx = idx;
    card.innerHTML = `
      <div class="m-card-top">
        <label class="m-check"><input type="checkbox" class="row-check" data-row-index="${idx}"></label>
        <input type="date" class="inp-date m-date" value="${escapeHtml(item.date || getToday())}">
        <span class="m-subtotal">${escapeHtml(item.subtotal || '0.00')}</span>
      </div>
      <div class="m-field"><label>名称</label><textarea class="inp-name" rows="1">${escapeHtml(item.name || '')}</textarea></div>
      <div class="m-field"><label>规格/型号</label><textarea class="inp-spec" rows="1">${escapeHtml(item.spec || '')}</textarea></div>
      <div class="m-field-2">
        <div class="m-field"><label>数量</label><input type="number" class="inp-qty" value="${escapeHtml(item.qty || '')}"></div>
        <div class="m-field"><label>单价</label><input type="number" step="0.01" class="inp-price" value="${escapeHtml(item.price || '')}"></div>
      </div>
      <div class="m-field"><label>备注</label><textarea class="inp-remark" rows="1">${escapeHtml(item.remark || '')}</textarea></div>
      <div class="m-actions">
        <button class="btn-gray btn-small" data-act="moveUp">▲上移</button>
        <button class="btn-gray btn-small" data-act="moveDown">▼下移</button>
        <button class="btn-blue btn-small" data-act="insertAbove">上方插入</button>
        <button class="btn-blue btn-small" data-act="insertBelow">下方插入</button>
        <button class="btn-red btn-small" data-act="delRow">删除</button>
      </div>`;
    wrap.appendChild(card);
    bindRowControls(card, idx);
    card.querySelector('.row-check').onchange = updateCheckedCount;
  });
}

/* ----------------------------- 控件事件绑定 ----------------------------- */

function bindRowControls(scope, idx) {
  const date = scope.querySelector('.inp-date');
  const name = scope.querySelector('.inp-name');
  const spec = scope.querySelector('.inp-spec');
  const price = scope.querySelector('.inp-price');
  const qty = scope.querySelector('.inp-qty');
  const sub = scope.querySelector('.inp-sub');
  const remark = scope.querySelector('.inp-remark');

  function sync() {
    const p = Number(price.value);
    const q = Number(qty.value);
    let s = '';
    if (!isNaN(p) && !isNaN(q)) s = (p * q).toFixed(2);
    if (sub) sub.value = s;
    dataList[idx] = {
      date: date.value, name: name.value, spec: spec.value,
      price: price.value, qty: qty.value, subtotal: s, remark: remark.value
    };
    // 同步手机卡片顶部小计
    const subEl = scope.querySelector('.m-subtotal');
    if (subEl) subEl.textContent = s || '0.00';
    updateStat();
    scheduleSave();
  }

  date.oninput = sync; name.oninput = sync; spec.oninput = sync;
  price.oninput = sync; qty.oninput = sync; remark.oninput = sync;

  scope.querySelectorAll('[data-act]').forEach(btn => {
    btn.onclick = () => {
      const act = btn.dataset.act;
      if (act === 'insertAbove') insertAbove(idx);
      else if (act === 'insertBelow') insertBelow(idx);
      else if (act === 'moveUp') moveUp(idx);
      else if (act === 'moveDown') moveDown(idx);
      else if (act === 'delRow') delRow(idx);
    };
  });
}

function renderAll() { renderDesktopTable(); renderMobileCards(); updateStat(); updateUndoRedoBtn(); }

/* ----------------------------- 回收站 ----------------------------- */

function renderTrash() {
  const tbody = document.getElementById('trashBody');
  const wrap = document.getElementById('trashMobile');
  if (trashList.length === 0) {
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="trash-empty">回收站是空的</td></tr>';
    if (wrap) wrap.innerHTML = '<div class="m-empty">回收站是空的</div>';
  } else {
    if (tbody) {
      tbody.innerHTML = '';
      trashList.forEach((item, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escapeHtml(item.date || '')}</td>
          <td class="txt-left">${escapeHtml(item.name || '')}</td>
          <td class="txt-left">${escapeHtml(item.spec || '')}</td>
          <td>${escapeHtml(item.qty || '')}</td>
          <td>${escapeHtml(item.price || '')}</td>
          <td>${escapeHtml(item.subtotal || '')}</td>
          <td class="txt-left">${escapeHtml(item.remark || '')}</td>
          <td><button class="btn-green btn-small" data-tact="restoreRow" data-idx="${idx}">恢复</button>
              <button class="btn-red btn-small" data-tact="forceDelRow" data-idx="${idx}">彻底删</button></td>`;
        tbody.appendChild(tr);
      });
      tbody.querySelectorAll('[data-tact]').forEach(b => b.onclick = () => {
        if (b.dataset.tact === 'restoreRow') restoreRow(Number(b.dataset.idx));
        else forceDelRow(Number(b.dataset.idx));
      });
    }
    if (wrap) {
      wrap.innerHTML = '';
      trashList.forEach((item, idx) => {
        const card = document.createElement('div');
        card.className = 'm-card trash-card';
        card.innerHTML = `
          <div class="m-card-top"><span class="m-date">${escapeHtml(item.date || '')}</span><span class="m-subtotal">${escapeHtml(item.subtotal || '')}</span></div>
          <div class="m-field"><label>名称</label><div>${escapeHtml(item.name || '')}</div></div>
          <div class="m-field"><label>规格</label><div>${escapeHtml(item.spec || '')}</div></div>
          <div class="m-field"><label>备注</label><div>${escapeHtml(item.remark || '')}</div></div>
          <div class="m-actions">
            <button class="btn-green btn-small" data-tact="restoreRow" data-idx="${idx}">恢复</button>
            <button class="btn-red btn-small" data-tact="forceDelRow" data-idx="${idx}">彻底删</button>
          </div>`;
        wrap.appendChild(card);
        card.querySelectorAll('[data-tact]').forEach(b => b.onclick = () => {
          if (b.dataset.tact === 'restoreRow') restoreRow(Number(b.dataset.idx));
          else forceDelRow(Number(b.dataset.idx));
        });
      });
    }
  }
  updateStat();
}

function restoreRow(idx) {
  saveHistory();
  dataList.push(trashList[idx]);
  trashList.splice(idx, 1);
  renderAll(); renderTrash(); scheduleSave();
}
function forceDelRow(idx) {
  if (!confirm('彻底删除不可恢复？')) return;
  trashList.splice(idx, 1);
  renderTrash(); scheduleSave();
}
function restoreAll() {
  if (trashList.length === 0) return;
  saveHistory();
  dataList = dataList.concat(trashList);
  trashList = [];
  renderAll(); renderTrash(); scheduleSave();
}
function emptyTrash() {
  if (trashList.length === 0) return;
  if (!confirm('彻底清空回收站，不可恢复！')) return;
  trashList = [];
  renderTrash(); scheduleSave();
}
function openTrash() { renderTrash(); document.getElementById('trashModal').classList.add('show'); }
function closeTrash() { document.getElementById('trashModal').classList.remove('show'); }

/* ============================ 导入 / 导出 ============================ */

/* ---- CSV（与桌面版列顺序一致：日期,名称,规格/型号,单价,数量,小计,备注） ---- */

function csvCell(v) {
  v = v == null ? '' : String(v);
  if (v.includes('"') || v.includes(',') || v.includes('\n') || v.includes('\r')) {
    return '"' + v.replace(/"/g, '""') + '"';
  }
  return v;
}

function exportCSVCore(list, filename) {
  const header = ['日期', '名称', '规格/型号', '单价', '数量', '小计', '备注'];
  const lines = [header.map(csvCell).join(',')];
  list.forEach(d => {
    lines.push([d.date || '', d.name || '', d.spec || '', d.price || '', d.qty || '', d.subtotal || '', d.remark || ''].map(csvCell).join(','));
  });
  downloadBlob(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }), filename);
}
function exportCSV() { exportCSVCore(dataList, '录入明细.csv'); }
function batchExportCSV() {
  const checked = getCheckedIndexes();
  if (checked.length === 0) { alert('请先勾选行！'); return; }
  exportCSVCore(checked.map(i => dataList[i]), '选中明细.csv');
}

/* ---- XLSX（与桌面版列顺序一致：日期,名称,规格,数量,单价,小计,备注） ---- */

function exportXLSX() {
  if (!window.XLSX || !XLSX.utils) { alert('表格组件未加载！'); return; }
  const header = ['日期', '名称', '规格', '数量', '单价', '小计', '备注'];
  const sheetData = [header];
  dataList.forEach(d => sheetData.push([d.date || '', d.name || '', d.spec || '', d.qty || '', d.price || '', d.subtotal || '', d.remark || '']));
  let sum = 0; dataList.forEach(i => sum += Number(i.subtotal || 0));
  sheetData.push(['', '', '', '', '', '合计：' + sum.toFixed(2), '']);
  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '明细');
  XLSX.writeFile(wb, '录入明细表.xlsx');
}

/* ---- JSON 备份（兼容桌面版 { dataList, trashList, exportTime }） ---- */

function exportJsonBackup() {
  const backup = { dataList: JSON.parse(JSON.stringify(dataList)), trashList: JSON.parse(JSON.stringify(trashList)), exportTime: new Date().toLocaleString() };
  downloadBlob(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' }), '记帐备份_' + getToday().replace(/-/g, '') + '.json');
}

function importJsonFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let obj;
    try { obj = JSON.parse(reader.result); } catch (e) { alert('不是有效的 JSON 文件！'); return; }
    const list = obj.dataList || [];
    const trash = obj.trashList || [];
    if (!Array.isArray(list) || list.length === 0) { alert('文件里没有明细数据！'); return; }
    const mode = confirm('点「确定」覆盖当前数据（恢复备份）；点「取消」把备份追加到当前数据后面。');
    saveHistory();
    if (mode) {
      trashList = trashList.concat(dataList);
      dataList = normalizeRecords(list);
      trashList = trashList.concat(normalizeRecords(trash));
    } else {
      dataList = dataList.concat(normalizeRecords(list));
      trashList = trashList.concat(normalizeRecords(trash));
    }
    renderAll(); renderTrash(); scheduleSave();
    alert(`✅ 导入成功，共 ${list.length} 条`);
  };
  reader.readAsText(file, 'utf-8');
}

function normalizeRecords(arr) {
  return (arr || []).map(d => ({
    date: d.date || getToday(), name: d.name || '', spec: d.spec || '',
    price: d.price || '', qty: d.qty || '', subtotal: d.subtotal || '', remark: d.remark || ''
  }));
}

/* ---- CSV 文本解析（兼容桌面版规则） ---- */

function parseCSV(str) {
  const arr = []; let quote = false; let row = []; let cell = '';
  for (let i = 0; i < str.length; i++) {
    const c = str[i]; const n = str[i + 1];
    if (quote) {
      if (c === '"') { if (n === '"') { cell += '"'; i++; } else quote = false; } else cell += c;
    } else {
      if (c === '"') quote = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n') { row.push(cell); arr.push(row); cell = ''; row = []; }
      else if (c !== '\r') cell += c;
    }
  }
  row.push(cell); arr.push(row);
  return arr;
}

function parseAndImport(text, isCover) {
  const newList = [];
  const rows = parseCSV(text);
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    if (!cells || cells.length === 0) continue;
    const price = Number(cells[3] || 0);
    const qty = Number(cells[4] || 0);
    let sub = '';
    if (!isNaN(price) && !isNaN(qty)) sub = (price * qty).toFixed(2);
    newList.push({
      date: cells[0] || getToday(), name: cells[1] || '', spec: cells[2] || '',
      price: cells[3] || '', qty: cells[4] || '', subtotal: sub, remark: cells[6] || ''
    });
  }
  if (newList.length <= 0) { alert('没有解析到有效数据！'); return; }
  if (isCover) { trashList = trashList.concat(dataList); dataList = newList; }
  else { dataList = dataList.concat(newList); }
  renderAll(); renderTrash(); scheduleSave();
  alert(`✅ 导入成功，共 ${newList.length} 条`);
}

async function importCsvFile(file) {
  saveHistory();
  const buf = await file.arrayBuffer();
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); }
  catch { text = new TextDecoder('gbk').decode(buf); }
  parseAndImport(text, false);
}

function importFromPaste(cover) {
  const txt = document.getElementById('pasteText').value.trim();
  if (!txt) { alert('内容不能为空'); return; }
  saveHistory();
  parseAndImport(txt, cover);
  document.getElementById('pasteText').value = '';
  togglePasteImport();
}

function togglePasteImport() {
  const box = document.getElementById('pasteBox');
  box.style.display = box.style.display === 'block' ? 'none' : 'block';
}

/* ----------------------------- 文件下载 ----------------------------- */

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 200);
}

/* ----------------------------- 工具栏绑定 ----------------------------- */

function bindToolbar() {
  const on = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
  on('undoBtn', undo);
  on('redoBtn', redo);
  on('addRow', addRow);
  on('selectAll', selectAll);
  on('unSelectAll', unSelectAll);
  on('batchDelete', batchDelete);
  on('batchExportCSV', batchExportCSV);
  on('exportAllCsv', exportCSV);
  on('exportXlsx', exportXLSX);
  on('exportJsonBackup', exportJsonBackup);
  on('openTrash', openTrash);
  on('closeTrash', closeTrash);
  on('restoreAll', restoreAll);
  on('emptyTrash', emptyTrash);
  on('togglePaste', togglePasteImport);
  on('importFromPasteAppend', () => importFromPaste(false));
  on('importFromPasteCover', () => importFromPaste(true));
  on('clearAll', clearAll);
  on('closeTrash2', closeTrash);

  document.getElementById('csvFileInput').addEventListener('change', function () {
    if (this.files[0]) importCsvFile(this.files[0]);
    this.value = '';
  });
  document.getElementById('jsonFileInput').addEventListener('change', function () {
    if (this.files[0]) importJsonFile(this.files[0]);
    this.value = '';
  });
}

/* ----------------------------- 启动 ----------------------------- */

(async function boot() {
  bindToolbar();
  const saved = await DB.init();
  dataList = saved.dataList;
  trashList = saved.trashList;
  renderAll();
  renderTrash();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(e => console.warn('SW 注册失败', e));
  }
})();
