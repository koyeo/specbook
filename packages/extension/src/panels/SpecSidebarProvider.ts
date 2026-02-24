/**
 * Sidebar Webview View Provider.
 * Renders a mini welcome panel in the activity bar sidebar.
 */
import * as vscode from 'vscode';

export class SpecSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'specbook.welcome';

  constructor(private readonly extensionUri: vscode.Uri) { }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    const nonce = getNonce();
    const cspSource = webviewView.webview.cspSource;

    webviewView.webview.html = /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src ${cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';" />
  <style nonce="${nonce}">
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      padding: 16px;
    }
    h2 { font-size: 1.1em; margin-bottom: 12px; }
    p { font-size: 0.85em; opacity: 0.8; margin-bottom: 16px; line-height: 1.5; }
    button {
      width: 100%;
      padding: 8px 16px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.9em;
      margin-bottom: 8px;
    }
    button:hover { background: var(--vscode-button-hoverBackground); }
    .shortcut {
      text-align: center;
      font-size: 0.8em;
      opacity: 0.6;
      margin-top: 4px;
    }
    kbd {
      padding: 2px 6px;
      background: var(--vscode-keybindingLabel-background, rgba(128,128,128,0.15));
      border: 1px solid var(--vscode-keybindingLabel-border, rgba(128,128,128,0.3));
      border-radius: 3px;
      font-family: var(--vscode-editor-font-family);
      font-size: 0.9em;
    }
  </style>
</head>
<body>
  <h2>📝 Specbook</h2>
  <p>Create and manage your project specs. Specs are saved as YAML files in the <code>.specbook/</code> directory.</p>
  <button id="open-btn">Open Spec Editor</button>
  <div class="shortcut"><kbd>⌘</kbd> + <kbd>⇧</kbd> + <kbd>B</kbd></div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    document.getElementById('open-btn').addEventListener('click', () => {
      vscode.postMessage({ type: 'openPanel' });
    });
  </script>
</body>
</html>`;

    webviewView.webview.onDidReceiveMessage((msg) => {
      if (msg.type === 'openPanel') {
        vscode.commands.executeCommand('specbook.openPanel');
      }
    });
  }
}

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let i = 0; i < 32; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}
