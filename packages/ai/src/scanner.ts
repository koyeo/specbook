/**
 * Scans a project directory and builds an ASCII tree representation.
 *
 * Used to provide real file system context to the AI model so it can
 * match objects to actual source files instead of hallucinating.
 */

declare const console: { log(...args: any[]): void; error(...args: any[]): void };

import * as fs from 'fs';
import * as path from 'path';

/** Directories to always skip when scanning. */
const IGNORE_DIRS = new Set([
    'node_modules', '.git', '.next', 'dist', 'out', 'build',
    '.cache', '.turbo', '.vscode', '.idea', '__pycache__',
    'coverage', '.nyc_output', '.spec', '.specbook',
]);

/** File extensions to include (source code & config). */
const INCLUDE_EXTS = new Set([
    '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
    '.vue', '.svelte',
    '.json', '.yaml', '.yml', '.toml',
    '.css', '.scss', '.less',
    '.html', '.md',
    '.py', '.rs', '.go', '.java', '.kt',
    '.sh', '.sql',
]);

interface ScanOptions {
    /** Max depth to scan (default: 6) */
    maxDepth?: number;
    /** Max total files to include (default: 500) */
    maxFiles?: number;
}

/**
 * Scan a project directory and return an ASCII directory tree string.
 */
export function scanProjectTree(rootDir: string, options: ScanOptions = {}): string {
    const maxDepth = options.maxDepth ?? 6;
    const maxFiles = options.maxFiles ?? 500;
    let fileCount = 0;
    let truncated = false;

    function walk(dir: string, prefix: string, depth: number): string[] {
        if (depth > maxDepth || truncated) return [];

        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return [];
        }

        // Sort: directories first, then files, alphabetically
        entries.sort((a, b) => {
            if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
            return a.name.localeCompare(b.name);
        });

        // Filter
        const filtered = entries.filter(e => {
            if (e.name.startsWith('.') && e.isDirectory()) return false;
            if (e.isDirectory()) return !IGNORE_DIRS.has(e.name);
            const ext = path.extname(e.name).toLowerCase();
            return INCLUDE_EXTS.has(ext);
        });

        const lines: string[] = [];
        filtered.forEach((entry, idx) => {
            if (truncated) return;
            const isLast = idx === filtered.length - 1;
            const connector = isLast ? '└── ' : '├── ';
            const childPrefix = isLast ? '    ' : '│   ';

            if (entry.isDirectory()) {
                lines.push(`${prefix}${connector}${entry.name}/`);
                const children = walk(path.join(dir, entry.name), prefix + childPrefix, depth + 1);
                lines.push(...children);
            } else {
                fileCount++;
                if (fileCount > maxFiles) {
                    truncated = true;
                    lines.push(`${prefix}${connector}... (truncated, ${maxFiles}+ files)`);
                    return;
                }
                lines.push(`${prefix}${connector}${entry.name}`);
            }
        });

        return lines;
    }

    const rootName = path.basename(rootDir);
    const treeLines = [`${rootName}/`, ...walk(rootDir, '', 0)];

    if (truncated) {
        treeLines.push(`\n(Showing first ${maxFiles} source files, more exist)`);
    }

    console.log(`[AI Scanner] Scanned ${fileCount} files in ${rootDir}`);
    return treeLines.join('\n');
}
