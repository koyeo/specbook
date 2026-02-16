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

// ─── Key-file reader for deep analysis ───────────────

/** Patterns that indicate a file is architecturally important. */
const KEY_FILE_PATTERNS = [
    // Type definitions & shared contracts
    /types?\.(ts|tsx|d\.ts)$/i,
    /interfaces?\.(ts|tsx)$/i,
    /shared\/.*index\.(ts|tsx)$/i,
    /shared\/.*types?\.(ts|tsx)$/i,
    // Entry points
    /^index\.(ts|tsx|js)$/,
    /^main\.(ts|tsx|js)$/,
    /^app\.(ts|tsx|js)$/,
    // Config & package
    /^package\.json$/,
    /^README\.md$/i,
    /^tsconfig\.json$/,
    // Domain / core logic
    /domain\//i,
    /model\//i,
    /prompt\.(ts|tsx)$/i,
    /service\.(ts|tsx)$/i,
    /store\.(ts|tsx)$/i,
    /handler[s]?\.(ts|tsx)$/i,
    /hook[s]?\//i,
    /messages\.(ts|tsx)$/i,
];

const MAX_FILE_LINES = 200;
const MAX_TOTAL_CHARS = 60_000;

/**
 * Read actual source code from architecturally important files.
 * Returns a formatted string with file path and content for each key file.
 */
export function scanKeyFiles(rootDir: string): string {
    const results: { rel: string; content: string }[] = [];
    let totalChars = 0;

    function walk(dir: string, relDir: string): void {
        if (totalChars >= MAX_TOTAL_CHARS) return;

        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }

        // Sort: directories first
        entries.sort((a, b) => {
            if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
            return a.name.localeCompare(b.name);
        });

        for (const entry of entries) {
            if (totalChars >= MAX_TOTAL_CHARS) break;
            const fullPath = path.join(dir, entry.name);
            const relPath = relDir ? `${relDir}/${entry.name}` : entry.name;

            if (entry.isDirectory()) {
                if (IGNORE_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
                walk(fullPath, relPath);
            } else {
                // Check if file matches key patterns
                const isKey = KEY_FILE_PATTERNS.some(p => p.test(relPath) || p.test(entry.name));
                if (!isKey) continue;

                try {
                    const raw = fs.readFileSync(fullPath, 'utf-8');
                    const lines = raw.split('\n');
                    const truncated = lines.length > MAX_FILE_LINES;
                    const content = lines.slice(0, MAX_FILE_LINES).join('\n')
                        + (truncated ? `\n// ... (${lines.length - MAX_FILE_LINES} more lines)` : '');

                    if (totalChars + content.length > MAX_TOTAL_CHARS) break;
                    results.push({ rel: relPath, content });
                    totalChars += content.length;
                } catch {
                    // skip unreadable files
                }
            }
        }
    }

    walk(rootDir, '');
    console.log(`[AI Scanner] Read ${results.length} key files (${totalChars} chars) from ${rootDir}`);

    return results
        .map(r => `### ${r.rel}\n\`\`\`\n${r.content}\n\`\`\``)
        .join('\n\n');
}
