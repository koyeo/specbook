/**
 * Generate the Webview HTML content for the Spec Input panel.
 * UI Layer — inline HTML/CSS/JS for the webview.
 */

/**
 * Returns the full HTML document for the spec input panel.
 * @param nonce - CSP nonce for inline scripts
 * @param cspSource - Webview CSP source for styles
 */
export function getSpecPanelHtml(nonce: string, cspSource: string): string {
    return /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src ${cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';" />
  <title>SpecBook</title>
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
      --success: var(--vscode-testing-iconPassed, #73c991);
      --error: var(--vscode-testing-iconFailed, #f48771);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--fg);
      background: var(--bg);
      padding: 20px;
    }
    h1 {
      font-size: 1.4em;
      margin-bottom: 16px;
      font-weight: 600;
    }
    .form-group {
      margin-bottom: 16px;
    }
    label {
      display: block;
      margin-bottom: 6px;
      font-weight: 500;
      font-size: 0.9em;
      opacity: 0.85;
    }
    textarea {
      width: 100%;
      min-height: 300px;
      padding: 10px 12px;
      background: var(--input-bg);
      color: var(--input-fg);
      border: 1px solid var(--input-border);
      border-radius: 4px;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: var(--vscode-editor-font-size, 13px);
      line-height: 1.5;
      resize: vertical;
    }
    textarea:focus {
      outline: none;
      border-color: var(--btn-bg);
    }
    .actions {
      display: flex;
      gap: 10px;
      align-items: center;
    }
    button {
      padding: 8px 20px;
      background: var(--btn-bg);
      color: var(--btn-fg);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.9em;
      font-weight: 500;
    }
    button:hover { background: var(--btn-hover); }
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .toast {
      display: none;
      padding: 8px 14px;
      border-radius: 4px;
      font-size: 0.85em;
      animation: fadeIn 0.2s ease;
    }
    .toast.success {
      display: inline-block;
      background: color-mix(in srgb, var(--success) 15%, transparent);
      color: var(--success);
    }
    .toast.error {
      display: inline-block;
      background: color-mix(in srgb, var(--error) 15%, transparent);
      color: var(--error);
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* Spec list */
    .spec-list { margin-top: 28px; }
    .spec-list h2 {
      font-size: 1.1em;
      margin-bottom: 12px;
      font-weight: 600;
    }
    .spec-item {
      padding: 10px 14px;
      border: 1px solid var(--border);
      border-radius: 4px;
      margin-bottom: 8px;
      background: var(--input-bg);
    }
    .spec-item-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }
    .spec-item-name {
      font-weight: 500;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 0.9em;
    }
    .spec-item-time {
      font-size: 0.8em;
      opacity: 0.6;
    }
    .spec-item-preview {
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 0.85em;
      white-space: pre-wrap;
      opacity: 0.75;
      max-height: 60px;
      overflow: hidden;
    }
    .empty-state {
      text-align: center;
      padding: 24px;
      opacity: 0.5;
      font-style: italic;
    }
  </style>
</head>
<body>
  <h1>📝 SpecBook</h1>

  <div class="form-group">
    <label for="spec-content">Spec Content (YAML)</label>
    <textarea
      id="spec-content"
      placeholder="Enter your spec in YAML format..."
      spellcheck="false"
    ></textarea>
  </div>

  <div class="actions">
    <button id="save-btn">Save Spec</button>
    <span id="toast" class="toast"></span>
  </div>

  <div class="spec-list">
    <h2>Saved Specs</h2>
    <div id="specs-container">
      <div class="empty-state">No specs saved yet.</div>
    </div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    const contentEl = document.getElementById('spec-content');
    const saveBtn = document.getElementById('save-btn');
    const toast = document.getElementById('toast');
    const specsContainer = document.getElementById('specs-container');

    // Save
    saveBtn.addEventListener('click', () => {
      const content = contentEl.value.trim();
      if (!content) {
        showToast('Spec content cannot be empty.', 'error');
        return;
      }
      if (content.length < 3) {
        showToast('Spec content is too short (minimum 3 characters).', 'error');
        return;
      }
      saveBtn.disabled = true;
      vscode.postMessage({ type: 'saveSpec', content: contentEl.value });
    });

    // Handle messages from extension
    window.addEventListener('message', (event) => {
      const msg = event.data;

      if (msg.type === 'saveResult') {
        saveBtn.disabled = false;
        if (msg.success) {
          showToast('Saved as ' + msg.filename + '.yaml', 'success');
          contentEl.value = '';
          vscode.postMessage({ type: 'loadSpecs' });
        } else {
          showToast(msg.error || 'Save failed.', 'error');
        }
      }

      if (msg.type === 'specsList') {
        renderSpecs(msg.specs);
      }
    });

    function showToast(text, type) {
      toast.textContent = text;
      toast.className = 'toast ' + type;
      setTimeout(() => { toast.className = 'toast'; }, 4000);
    }

    function renderSpecs(specs) {
      if (!specs || specs.length === 0) {
        specsContainer.innerHTML = '<div class="empty-state">No specs saved yet.</div>';
        return;
      }
      specsContainer.innerHTML = specs.map(s => {
        const preview = s.content.length > 120 ? s.content.slice(0, 120) + '...' : s.content;
        const time = new Date(s.createdAt).toLocaleString();
        return '<div class="spec-item">'
          + '<div class="spec-item-header">'
          + '<span class="spec-item-name">' + escapeHtml(s.filename) + '.yaml</span>'
          + '<span class="spec-item-time">' + escapeHtml(time) + '</span>'
          + '</div>'
          + '<div class="spec-item-preview">' + escapeHtml(preview) + '</div>'
          + '</div>';
      }).join('');
    }

    function escapeHtml(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    // Load specs on init
    vscode.postMessage({ type: 'loadSpecs' });
  </script>
</body>
</html>`;
}
