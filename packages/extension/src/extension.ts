import * as vscode from 'vscode';
import { SpecPanel } from './panels/SpecPanel';

export function activate(context: vscode.ExtensionContext) {
    console.log('SpecBook extension activated');

    // Register open panel command
    const disposable = vscode.commands.registerCommand('specbook.openPanel', () => {
        SpecPanel.createOrShow(context.extensionUri);
    });

    // Status bar button — always visible, click to open panel
    const statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        100,
    );
    statusBarItem.text = '$(notebook) SpecBook';
    statusBarItem.tooltip = 'Open Spec Editor (⌘⇧B)';
    statusBarItem.command = 'specbook.openPanel';
    statusBarItem.show();

    context.subscriptions.push(disposable, statusBarItem);
}

export function deactivate() {
    // cleanup
}
