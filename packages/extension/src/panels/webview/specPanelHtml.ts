/**
 * Generate the Webview HTML for the Spec Table panel.
 * Notion-like table with Description + Group columns.
 * Supports filtering, sorting, and group-by display.
 */

export function getSpecPanelHtml(nonce: string, cspSource: string): string {
  return /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src ${cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';" />
  <title>Specbook</title>
  <style nonce="${nonce}">
    :root {
      --bg: var(--vscode-editor-background);
      --fg: var(--vscode-editor-foreground);
      --input-bg: var(--vscode-input-background);
      --input-border: var(--vscode-input-border, #3c3c3c);
      --input-fg: var(--vscode-input-foreground);
      --btn-bg: var(--vscode-button-background);
      --btn-fg: var(--vscode-button-foreground);
      --btn-hover: var(--vscode-button-hoverBackground);
      --border: var(--vscode-panel-border, #2b2b2b);
      --hover-bg: var(--vscode-list-hoverBackground, rgba(255,255,255,0.04));
      --accent: var(--vscode-focusBorder, #007acc);
      --badge-bg: rgba(255,255,255,0.08);
      --success: var(--vscode-testing-iconPassed, #73c991);
      --error: var(--vscode-testing-iconFailed, #f48771);
      --muted: rgba(255,255,255,0.4);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--fg);
      background: var(--bg);
      padding: 16px 20px;
    }

    /* ─── Header ─── */
    .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
    .header h1 { font-size: 1.3em; font-weight: 600; }

    /* ─── Input bar ─── */
    .input-bar {
      display: flex; gap: 8px; margin-bottom: 16px;
      padding: 12px; border: 1px solid var(--border); border-radius: 6px;
      background: var(--input-bg);
    }
    .input-bar input, .input-bar select {
      padding: 6px 10px; background: var(--bg); color: var(--input-fg);
      border: 1px solid var(--input-border); border-radius: 4px;
      font-family: inherit; font-size: 0.9em;
    }
    .input-bar input:focus, .input-bar select:focus { outline: none; border-color: var(--accent); }
    .input-bar input.desc-input { flex: 1; min-width: 0; }
    .input-bar select { min-width: 120px; }
    .input-bar button {
      padding: 6px 16px; background: var(--btn-bg); color: var(--btn-fg);
      border: none; border-radius: 4px; cursor: pointer; font-size: 0.9em; white-space: nowrap;
    }
    .input-bar button:hover { background: var(--btn-hover); }

    /* ─── Toolbar ─── */
    .toolbar {
      display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;
    }
    .toolbar input {
      padding: 5px 10px; background: var(--input-bg); color: var(--input-fg);
      border: 1px solid var(--input-border); border-radius: 4px;
      font-size: 0.85em; width: 200px;
    }
    .toolbar input:focus { outline: none; border-color: var(--accent); }
    .toolbar label { font-size: 0.8em; opacity: 0.7; }
    .toolbar select {
      padding: 4px 8px; background: var(--input-bg); color: var(--input-fg);
      border: 1px solid var(--input-border); border-radius: 4px; font-size: 0.85em;
    }
    .toolbar .spacer { flex: 1; }
    .toolbar .count { font-size: 0.8em; opacity: 0.5; }

    /* ─── Table ─── */
    .table-wrap { border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
    table { width: 100%; border-collapse: collapse; }
    thead th {
      padding: 8px 12px; text-align: left; font-size: 0.8em; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.6;
      border-bottom: 1px solid var(--border); cursor: pointer; user-select: none;
      position: relative;
    }
    thead th:hover { opacity: 1; }
    thead th .sort-icon { margin-left: 4px; font-size: 0.9em; }
    tbody td {
      padding: 8px 12px; border-bottom: 1px solid var(--border); font-size: 0.9em;
      vertical-align: middle;
    }
    tbody tr:hover { background: var(--hover-bg); }
    tbody tr:last-child td { border-bottom: none; }
    td.desc-cell { max-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    td.group-cell .badge {
      display: inline-block; padding: 2px 8px; border-radius: 10px;
      background: var(--badge-bg); font-size: 0.85em;
    }
    td.actions-cell { width: 40px; text-align: center; }
    td.actions-cell button {
      background: none; border: none; color: var(--muted); cursor: pointer;
      font-size: 1em; padding: 2px 4px; border-radius: 3px;
    }
    td.actions-cell button:hover { color: var(--error); background: rgba(244,135,113,0.1); }

    /* ─── Editable cell ─── */
    td.editing { padding: 4px 8px; }
    td.editing input {
      width: 100%; padding: 4px 8px; background: var(--input-bg); color: var(--input-fg);
      border: 1px solid var(--accent); border-radius: 3px; font-size: inherit; font-family: inherit;
    }

    /* ─── Group header ─── */
    .group-header td {
      padding: 10px 12px; font-weight: 600; font-size: 0.9em;
      background: var(--badge-bg); border-bottom: 1px solid var(--border);
    }
    .group-header td .group-count {
      margin-left: 6px; font-weight: 400; opacity: 0.5; font-size: 0.85em;
    }

    /* ─── Empty state ─── */
    .empty-state { text-align: center; padding: 40px; opacity: 0.4; font-style: italic; }

    /* ─── Toast ─── */
    .toast {
      position: fixed; bottom: 16px; right: 16px; padding: 8px 16px;
      border-radius: 4px; font-size: 0.85em; display: none;
      animation: slideIn 0.2s ease;
    }
    .toast.show { display: block; }
    .toast.error { background: rgba(244,135,113,0.15); color: var(--error); }
    @keyframes slideIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📝 Specbook</h1>
  </div>

  <!-- Input bar -->
  <div class="input-bar">
    <input type="text" id="desc-input" class="desc-input" placeholder="Enter spec description..." />
    <input type="text" id="group-input" placeholder="Group" list="group-suggestions" />
    <datalist id="group-suggestions"></datalist>
    <button id="add-btn">Add</button>
  </div>

  <!-- Toolbar -->
  <div class="toolbar">
    <input type="text" id="filter-input" placeholder="🔍 Filter..." />
    <label>Sort:</label>
    <select id="sort-select">
      <option value="newest">Newest first</option>
      <option value="oldest">Oldest first</option>
      <option value="desc-asc">Description A→Z</option>
      <option value="desc-desc">Description Z→A</option>
      <option value="group-asc">Group A→Z</option>
      <option value="group-desc">Group Z→A</option>
    </select>
    <label>
      <input type="checkbox" id="group-by-check" /> Group by
    </label>
    <span class="spacer"></span>
    <span class="count" id="count-label"></span>
  </div>

  <!-- Table -->
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th data-col="description" style="width:60%">Description <span class="sort-icon"></span></th>
          <th data-col="group" style="width:30%">Group <span class="sort-icon"></span></th>
          <th style="width:10%"></th>
        </tr>
      </thead>
      <tbody id="table-body">
        <tr><td colspan="3" class="empty-state">No specs yet. Add one above.</td></tr>
      </tbody>
    </table>
  </div>

  <div id="toast" class="toast"></div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    // ─── State ──────────────────────────────────────
    let items = [];
    let editingId = null;
    let editingField = null;

    // ─── Elements ───────────────────────────────────
    const descInput = document.getElementById('desc-input');
    const groupInput = document.getElementById('group-input');
    const addBtn = document.getElementById('add-btn');
    const filterInput = document.getElementById('filter-input');
    const sortSelect = document.getElementById('sort-select');
    const groupByCheck = document.getElementById('group-by-check');
    const tableBody = document.getElementById('table-body');
    const countLabel = document.getElementById('count-label');
    const groupSuggestions = document.getElementById('group-suggestions');
    const toast = document.getElementById('toast');

    // ─── Add item ───────────────────────────────────
    addBtn.addEventListener('click', addItem);
    descInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addItem(); });
    groupInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addItem(); });

    function addItem() {
      const desc = descInput.value.trim();
      if (!desc) { showToast('Description cannot be empty.'); return; }
      const group = groupInput.value.trim() || 'Ungrouped';
      vscode.postMessage({ type: 'addItem', description: desc, group });
      descInput.value = '';
      descInput.focus();
    }

    // ─── Filter / Sort / Group ──────────────────────
    filterInput.addEventListener('input', render);
    sortSelect.addEventListener('change', render);
    groupByCheck.addEventListener('change', render);

    // ─── Messages from extension ────────────────────
    window.addEventListener('message', (e) => {
      const msg = e.data;
      if (msg.type === 'itemsLoaded') {
        items = msg.items;
        updateGroupSuggestions();
        render();
      }
      if (msg.type === 'error') { showToast(msg.message); }
    });

    // ─── Render table ───────────────────────────────
    function render() {
      const filter = filterInput.value.toLowerCase();
      const sort = sortSelect.value;
      const groupBy = groupByCheck.checked;

      // Filter
      let filtered = items.filter(item =>
        item.description.toLowerCase().includes(filter) ||
        item.group.toLowerCase().includes(filter)
      );

      // Sort
      filtered.sort((a, b) => {
        switch (sort) {
          case 'newest': return b.createdAt.localeCompare(a.createdAt);
          case 'oldest': return a.createdAt.localeCompare(b.createdAt);
          case 'desc-asc': return a.description.localeCompare(b.description);
          case 'desc-desc': return b.description.localeCompare(a.description);
          case 'group-asc': return a.group.localeCompare(b.group);
          case 'group-desc': return b.group.localeCompare(a.group);
          default: return 0;
        }
      });

      countLabel.textContent = filtered.length + ' / ' + items.length + ' items';

      if (filtered.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="3" class="empty-state">' +
          (items.length === 0 ? 'No specs yet. Add one above.' : 'No matching items.') +
          '</td></tr>';
        return;
      }

      if (groupBy) {
        renderGrouped(filtered);
      } else {
        tableBody.innerHTML = filtered.map(item => rowHtml(item)).join('');
      }

      bindRowEvents();
    }

    function renderGrouped(filtered) {
      const groups = {};
      for (const item of filtered) {
        const g = item.group || 'Ungrouped';
        if (!groups[g]) groups[g] = [];
        groups[g].push(item);
      }
      const sortedGroups = Object.keys(groups).sort();
      let html = '';
      for (const g of sortedGroups) {
        html += '<tr class="group-header"><td colspan="3">' +
          escapeHtml(g) + '<span class="group-count">(' + groups[g].length + ')</span></td></tr>';
        html += groups[g].map(item => rowHtml(item)).join('');
      }
      tableBody.innerHTML = html;
    }

    function rowHtml(item) {
      const isEditingDesc = editingId === item.id && editingField === 'description';
      const isEditingGroup = editingId === item.id && editingField === 'group';

      const descCell = isEditingDesc
        ? '<td class="desc-cell editing"><input type="text" class="edit-input" data-id="' + item.id + '" data-field="description" value="' + escapeAttr(item.description) + '" /></td>'
        : '<td class="desc-cell" data-id="' + item.id + '" data-field="description">' + escapeHtml(item.description) + '</td>';

      const groupCell = isEditingGroup
        ? '<td class="group-cell editing"><input type="text" class="edit-input" data-id="' + item.id + '" data-field="group" value="' + escapeAttr(item.group) + '" /></td>'
        : '<td class="group-cell" data-id="' + item.id + '" data-field="group"><span class="badge">' + escapeHtml(item.group) + '</span></td>';

      return '<tr data-id="' + item.id + '">' + descCell + groupCell +
        '<td class="actions-cell"><button class="delete-btn" data-id="' + item.id + '" title="Delete">✕</button></td></tr>';
    }

    function bindRowEvents() {
      // Double-click to edit
      tableBody.querySelectorAll('td.desc-cell:not(.editing), td.group-cell:not(.editing)').forEach(td => {
        td.addEventListener('dblclick', () => {
          editingId = td.dataset.id;
          editingField = td.dataset.field;
          render();
          // Focus input
          setTimeout(() => {
            const input = tableBody.querySelector('.edit-input[data-id="' + editingId + '"]');
            if (input) { input.focus(); input.select(); }
          }, 0);
        });
      });

      // Edit input handlers
      tableBody.querySelectorAll('.edit-input').forEach(input => {
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { commitEdit(input); }
          if (e.key === 'Escape') { editingId = null; editingField = null; render(); }
        });
        input.addEventListener('blur', () => { commitEdit(input); });
      });

      // Delete buttons
      tableBody.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          vscode.postMessage({ type: 'deleteItem', id: btn.dataset.id });
        });
      });
    }

    function commitEdit(input) {
      const id = input.dataset.id;
      const field = input.dataset.field;
      const value = input.value.trim();
      if (!value) { editingId = null; editingField = null; render(); return; }

      const item = items.find(i => i.id === id);
      if (item && item[field] !== value) {
        const updated = { ...item, [field]: value };
        vscode.postMessage({ type: 'updateItem', item: updated });
      }
      editingId = null;
      editingField = null;
      render();
    }

    // ─── Group suggestions ──────────────────────────
    function updateGroupSuggestions() {
      const groups = [...new Set(items.map(i => i.group).filter(g => g && g !== 'Ungrouped'))];
      groupSuggestions.innerHTML = groups.map(g => '<option value="' + escapeAttr(g) + '">').join('');
    }

    // ─── Helpers ────────────────────────────────────
    function escapeHtml(s) {
      const d = document.createElement('div'); d.textContent = s; return d.innerHTML;
    }
    function escapeAttr(s) { return s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }
    function showToast(msg) {
      toast.textContent = msg; toast.className = 'toast error show';
      setTimeout(() => { toast.className = 'toast'; }, 3000);
    }

    // ─── Init ───────────────────────────────────────
    vscode.postMessage({ type: 'loadItems' });
  </script>
</body>
</html>`;
}
