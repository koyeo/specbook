/**
 * SpecPanel — Application layer.
 * Manages the Webview panel lifecycle and orchestrates
 * Domain (validation) + Infrastructure (file I/O) on incoming messages.
 */
import * as vscode from 'vscode';
import {
    validateSpecContent,
    generateSpecFilename,
} from '@specbook/shared';
import type {
    WebviewToExtensionMessage,
    ExtensionToWebviewMessage,
} from '@specbook/shared';
import { saveSpec, loadSpecs } from '../infrastructure/specFileSystem';
import { getSpecPanelHtml } from './webview/specPanelHtml';

export class SpecPanel {
    public static readonly viewType = 'specbook.specPanel';
    private static instance: SpecPanel | undefined;

    private constructor(
        private readonly panel: vscode.WebviewPanel,
        private readonly extensionUri: vscode.Uri,
    ) {
        this.panel.webview.html = this.getHtml();

        this.panel.webview.onDidReceiveMessage(
            (msg: WebviewToExtensionMessage) => this.handleMessage(msg),
        );

        this.panel.onDidDispose(() => {
            SpecPanel.instance = undefined;
        });
    }

    /** Show or create the panel (singleton). */
    public static createOrShow(extensionUri: vscode.Uri): void {
        if (SpecPanel.instance) {
            SpecPanel.instance.panel.reveal(vscode.ViewColumn.One);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            SpecPanel.viewType,
            'SpecBook',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [extensionUri],
            },
        );

        SpecPanel.instance = new SpecPanel(panel, extensionUri);
    }

    // ─── Message orchestration (semi-pure) ────────────────────────────

    private async handleMessage(msg: WebviewToExtensionMessage): Promise<void> {
        switch (msg.type) {
            case 'saveSpec':
                await this.handleSaveSpec(msg.content);
                break;
            case 'loadSpecs':
                await this.handleLoadSpecs();
                break;
        }
    }

    private async handleSaveSpec(content: string): Promise<void> {
        // Domain: pure validation
        const validation = validateSpecContent(content);
        if (!validation.valid) {
            this.postMessage({ type: 'saveResult', success: false, error: validation.error });
            return;
        }

        // Domain: pure filename generation
        const filename = generateSpecFilename();

        // Infrastructure: file I/O
        const workspaceUri = this.getWorkspaceUri();
        if (!workspaceUri) {
            this.postMessage({
                type: 'saveResult',
                success: false,
                error: 'No workspace folder is open.',
            });
            return;
        }

        try {
            await saveSpec(workspaceUri, filename, content);
            this.postMessage({ type: 'saveResult', success: true, filename });
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error';
            this.postMessage({ type: 'saveResult', success: false, error: errorMsg });
        }
    }

    private async handleLoadSpecs(): Promise<void> {
        const workspaceUri = this.getWorkspaceUri();
        if (!workspaceUri) {
            this.postMessage({ type: 'specsList', specs: [] });
            return;
        }

        try {
            const specs = await loadSpecs(workspaceUri);
            this.postMessage({ type: 'specsList', specs });
        } catch {
            this.postMessage({ type: 'specsList', specs: [] });
        }
    }

    // ─── Helpers ──────────────────────────────────────────────────────

    private postMessage(msg: ExtensionToWebviewMessage): void {
        this.panel.webview.postMessage(msg);
    }

    private getWorkspaceUri(): vscode.Uri | undefined {
        return vscode.workspace.workspaceFolders?.[0]?.uri;
    }

    private getHtml(): string {
        const nonce = getNonce();
        const cspSource = this.panel.webview.cspSource;
        return getSpecPanelHtml(nonce, cspSource);
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
