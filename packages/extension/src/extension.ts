import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('SpecBook extension activated');

    const disposable = vscode.commands.registerCommand('specbook.openPanel', () => {
        vscode.window.showInformationMessage('SpecBook: Coming soon!');
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {
    // cleanup
}
