/**
 * Infrastructure layer — File system operations for specs.
 * Encapsulates all VS Code workspace FS side effects.
 */
import * as vscode from 'vscode';
import { SPEC_DIR, SPEC_EXT } from '@specbook/shared';
import type { SpecEntry } from '@specbook/shared';

/**
 * Ensure the .spec/ directory exists in the workspace.
 */
async function ensureSpecDir(workspaceUri: vscode.Uri): Promise<vscode.Uri> {
    const specDirUri = vscode.Uri.joinPath(workspaceUri, SPEC_DIR);
    try {
        await vscode.workspace.fs.stat(specDirUri);
    } catch {
        await vscode.workspace.fs.createDirectory(specDirUri);
    }
    return specDirUri;
}

/**
 * Save a spec YAML file to .spec/{filename}.yaml.
 */
export async function saveSpec(
    workspaceUri: vscode.Uri,
    filename: string,
    content: string,
): Promise<vscode.Uri> {
    const specDirUri = await ensureSpecDir(workspaceUri);
    const fileUri = vscode.Uri.joinPath(specDirUri, `${filename}${SPEC_EXT}`);
    const encoder = new TextEncoder();
    await vscode.workspace.fs.writeFile(fileUri, encoder.encode(content));
    return fileUri;
}

/**
 * Load all spec files from .spec/ directory.
 */
export async function loadSpecs(workspaceUri: vscode.Uri): Promise<SpecEntry[]> {
    const specDirUri = vscode.Uri.joinPath(workspaceUri, SPEC_DIR);

    try {
        await vscode.workspace.fs.stat(specDirUri);
    } catch {
        return []; // directory doesn't exist yet
    }

    const entries = await vscode.workspace.fs.readDirectory(specDirUri);
    const decoder = new TextDecoder();
    const specs: SpecEntry[] = [];

    for (const [name, type] of entries) {
        if (type !== vscode.FileType.File || !name.endsWith(SPEC_EXT)) {
            continue;
        }

        const fileUri = vscode.Uri.joinPath(specDirUri, name);
        const raw = await vscode.workspace.fs.readFile(fileUri);
        const stat = await vscode.workspace.fs.stat(fileUri);

        specs.push({
            filename: name.replace(SPEC_EXT, ''),
            content: decoder.decode(raw),
            createdAt: new Date(stat.ctime).toISOString(),
        });
    }

    return specs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
