/**
 * Source scanner IPC handler.
 * Recursively walks workspace source files and collects all UUIDs found.
 */
import { ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { IPC } from '@specbook/shared';
import type { SourceScanResult } from '@specbook/shared';
import { getWorkspace } from './specHandlers';

/** Directories to skip during scanning. */
const SKIP_DIRS = new Set([
    'node_modules', '.git', '.spec', 'dist', 'build', '.next', '.cache',
    '.turbo', 'coverage', '__pycache__', '.venv', 'vendor',
]);

/** File extensions to scan. */
const SCAN_EXTENSIONS = new Set([
    '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
    '.py', '.rb', '.java', '.kt', '.go', '.rs', '.cs',
    '.vue', '.svelte', '.astro',
    '.html', '.css', '.scss', '.less',
    '.yaml', '.yml', '.toml', '.json', '.md',
    '.sh', '.bash', '.zsh',
]);

/**
 * UUID v4/v7 pattern — matches standard 8-4-4-4-12 hex format.
 */
const UUID_REGEX = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

function requireWorkspace(): string {
    const ws = getWorkspace();
    if (!ws) throw new Error('No workspace selected. Please open a folder first.');
    return ws;
}

/** Recursively collect file paths to scan. */
function collectFiles(dir: string): string[] {
    const results: string[] = [];
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return results;
    }
    for (const entry of entries) {
        if (SKIP_DIRS.has(entry.name)) continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...collectFiles(fullPath));
        } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (SCAN_EXTENSIONS.has(ext)) {
                results.push(fullPath);
            }
        }
    }
    return results;
}

/** Scan a single file for UUIDs, returning matches with line numbers. */
function scanFile(filePath: string): { uuid: string; line: number }[] {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        const results: { uuid: string; line: number }[] = [];
        for (let i = 0; i < lines.length; i++) {
            let m: RegExpExecArray | null;
            const re = new RegExp(UUID_REGEX.source, 'gi');
            while ((m = re.exec(lines[i])) !== null) {
                results.push({ uuid: m[0].toLowerCase(), line: i + 1 });
            }
        }
        return results;
    } catch {
        return [];
    }
}

export function registerScanHandlers(): void {
    ipcMain.handle(IPC.SCAN_SOURCE, async (): Promise<SourceScanResult> => {
        const ws = requireWorkspace();
        const files = collectFiles(ws);
        const idSet = new Set<string>();
        const scanLog: { filePath: string; matches: { uuid: string; line: number }[] }[] = [];

        for (const file of files) {
            const matches = scanFile(file);
            if (matches.length > 0) {
                scanLog.push({ filePath: path.relative(ws, file), matches });
                for (const m of matches) {
                    idSet.add(m.uuid);
                }
            }
        }

        return { foundIds: [...idSet], scannedFiles: files.length, scanLog };
    });
}
