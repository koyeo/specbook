/**
 * Infrastructure layer — File system operations for spec.yaml.
 * Uses simple YAML serialization (no external deps).
 */
import * as vscode from 'vscode';
import { SPEC_DIR, SPEC_FILENAME } from '@specbook/shared';
import type { SpecItem, SpecFile } from '@specbook/shared';

/**
 * Minimal YAML serializer for SpecFile.
 * Output format:
 *   version: "1.0"
 *   items:
 *     - id: "abc123"
 *       description: "Some description"
 *       group: "GroupName"
 *       createdAt: "2026-01-01T00:00:00Z"
 */
function serializeToYaml(specFile: SpecFile): string {
    const lines: string[] = [];
    lines.push(`version: "${specFile.version}"`);
    lines.push('items:');

    for (const item of specFile.items) {
        lines.push(`  - id: "${escapeYaml(item.id)}"`);
        lines.push(`    description: "${escapeYaml(item.description)}"`);
        lines.push(`    group: "${escapeYaml(item.group)}"`);
        lines.push(`    createdAt: "${item.createdAt}"`);
    }

    if (specFile.items.length === 0) {
        lines.push('  []');
    }

    return lines.join('\n') + '\n';
}

function escapeYaml(s: string): string {
    return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

/**
 * Minimal YAML parser for SpecFile.
 * Handles the specific format we serialize.
 */
function parseFromYaml(yaml: string): SpecFile {
    const items: SpecItem[] = [];
    const lines = yaml.split('\n');
    let version = '1.0';
    let currentItem: Partial<SpecItem> | null = null;

    for (const line of lines) {
        const versionMatch = line.match(/^version:\s*"?([^"]*)"?/);
        if (versionMatch) {
            version = versionMatch[1];
            continue;
        }

        if (line.match(/^\s*- id:\s*"?([^"]*)"?/)) {
            if (currentItem && currentItem.id) {
                items.push(currentItem as SpecItem);
            }
            const m = line.match(/^\s*- id:\s*"?([^"]*)"?/);
            currentItem = { id: m![1] };
            continue;
        }

        if (currentItem) {
            const descMatch = line.match(/^\s+description:\s*"(.*)"/);
            if (descMatch) {
                currentItem.description = unescapeYaml(descMatch[1]);
                continue;
            }

            const groupMatch = line.match(/^\s+group:\s*"(.*)"/);
            if (groupMatch) {
                currentItem.group = unescapeYaml(groupMatch[1]);
                continue;
            }

            const timeMatch = line.match(/^\s+createdAt:\s*"?([^"]*)"?/);
            if (timeMatch) {
                currentItem.createdAt = timeMatch[1];
                continue;
            }
        }
    }

    if (currentItem && currentItem.id) {
        items.push(currentItem as SpecItem);
    }

    return { version, items };
}

function unescapeYaml(s: string): string {
    return s.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

// ─── Public API ──────────────────────────────────────────────────

async function ensureSpecDir(workspaceUri: vscode.Uri): Promise<vscode.Uri> {
    const specDirUri = vscode.Uri.joinPath(workspaceUri, SPEC_DIR);
    try {
        await vscode.workspace.fs.stat(specDirUri);
    } catch {
        await vscode.workspace.fs.createDirectory(specDirUri);
    }
    return specDirUri;
}

function getSpecFileUri(workspaceUri: vscode.Uri): vscode.Uri {
    return vscode.Uri.joinPath(workspaceUri, SPEC_DIR, SPEC_FILENAME);
}

/** Load all spec items from .specbook/spec.yaml. */
export async function loadSpecItems(workspaceUri: vscode.Uri): Promise<SpecItem[]> {
    const fileUri = getSpecFileUri(workspaceUri);
    try {
        const raw = await vscode.workspace.fs.readFile(fileUri);
        const yaml = new TextDecoder().decode(raw);
        const specFile = parseFromYaml(yaml);
        return specFile.items;
    } catch {
        return [];
    }
}

/** Save all spec items to .specbook/spec.yaml. */
export async function saveSpecItems(
    workspaceUri: vscode.Uri,
    items: SpecItem[],
): Promise<void> {
    await ensureSpecDir(workspaceUri);
    const fileUri = getSpecFileUri(workspaceUri);
    const specFile: SpecFile = { version: '1.0', items };
    const yaml = serializeToYaml(specFile);
    await vscode.workspace.fs.writeFile(fileUri, new TextEncoder().encode(yaml));
}
