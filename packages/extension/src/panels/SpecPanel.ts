/**
 * SpecPanel — Application layer.
 * Manages the Webview panel and orchestrates
 * Domain (validation) + Infrastructure (file I/O).
 */
import * as vscode from 'vscode';
import {
    generateId,
} from '@specbook/shared';
import {
    validateDescription,
} from '../legacyTypes';
import type {
    SpecItem,
    WebviewToExtensionMessage,
    ExtensionToWebviewMessage,
} from '../legacyTypes';
import { loadSpecItems, saveSpecItems } from '../infrastructure/specFileSystem';
import { getSpecPanelHtml } from './webview/specPanelHtml';

export class SpecPanel {
    public static readonly viewType = 'specbook.specPanel';
    private static instance: SpecPanel | undefined;

    /** In-memory items cache. */
    private items: SpecItem[] = [];

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

    public static createOrShow(extensionUri: vscode.Uri): void {
        if (SpecPanel.instance) {
            SpecPanel.instance.panel.reveal(vscode.ViewColumn.One);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            SpecPanel.viewType,
            'Specbook',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [extensionUri],
            },
        );

        SpecPanel.instance = new SpecPanel(panel, extensionUri);
    }

    // ─── Message orchestration ────────────────────────

    private async handleMessage(msg: WebviewToExtensionMessage): Promise<void> {
        switch (msg.type) {
            case 'loadItems':
                await this.handleLoad();
                break;
            case 'addItem':
                await this.handleAdd(msg.description, msg.group);
                break;
            case 'deleteItem':
                await this.handleDelete(msg.id);
                break;
            case 'updateItem':
                await this.handleUpdate(msg.item);
                break;
        }
    }

    private async handleLoad(): Promise<void> {
        const workspaceUri = this.getWorkspaceUri();
        if (!workspaceUri) {
            this.postMessage({ type: 'itemsLoaded', items: [] });
            return;
        }
        try {
            this.items = await loadSpecItems(workspaceUri);
            this.postMessage({ type: 'itemsLoaded', items: this.items });
        } catch {
            this.postMessage({ type: 'error', message: 'Failed to load specs.' });
        }
    }

    private async handleAdd(description: string, group: string): Promise<void> {
        // Domain: pure validation
        const validation = validateDescription(description);
        if (!validation.valid) {
            this.postMessage({ type: 'error', message: validation.error! });
            return;
        }

        const newItem: SpecItem = {
            id: generateId(),
            description: description.trim(),
            group: group.trim() || 'Ungrouped',
            createdAt: new Date().toISOString(),
        };

        this.items.push(newItem);
        await this.persist();
        this.postMessage({ type: 'itemsLoaded', items: this.items });
    }

    private async handleDelete(id: string): Promise<void> {
        this.items = this.items.filter(item => item.id !== id);
        await this.persist();
        this.postMessage({ type: 'itemsLoaded', items: this.items });
    }

    private async handleUpdate(updated: SpecItem): Promise<void> {
        const idx = this.items.findIndex(item => item.id === updated.id);
        if (idx >= 0) {
            this.items[idx] = { ...this.items[idx], ...updated };
            await this.persist();
            this.postMessage({ type: 'itemsLoaded', items: this.items });
        }
    }

    // ─── Helpers ──────────────────────────────────────

    private async persist(): Promise<void> {
        const workspaceUri = this.getWorkspaceUri();
        if (!workspaceUri) return;
        try {
            await saveSpecItems(workspaceUri, this.items);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Save failed';
            this.postMessage({ type: 'error', message: msg });
        }
    }

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
