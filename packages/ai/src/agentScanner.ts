/**
 * Agentic scanner — uses @anthropic-ai/sdk Messages API with tool use
 * to scan a single object by searching and reading project code.
 *
 * The agent loop continues until Claude calls `report_mapping` (terminal tool).
 */
import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';
import type { AiConfig, ObjectTreeNode, ObjectMappingResult, RelatedFile, TokenUsage } from '@specbook/shared';

declare const console: { log(...args: any[]): void; error(...args: any[]): void };

// ─── Tool definitions ───────────────────────────────

const IGNORE_DIRS = new Set([
    'node_modules', '.git', '.next', 'dist', 'out', 'build',
    '.cache', '.turbo', '.vscode', '.idea', '__pycache__',
    'coverage', '.nyc_output', '.spec', '.specbook',
]);

const tools: Anthropic.Tool[] = [
    {
        name: 'search_code',
        description: 'Search for text/regex patterns in the project source code using ripgrep. Returns matching file paths, line numbers, and line content. Use this to find code related to a feature by searching for keywords, function names, class names, etc.',
        input_schema: {
            type: 'object' as const,
            properties: {
                query: {
                    type: 'string',
                    description: 'Search query (text or regex pattern)',
                },
                file_pattern: {
                    type: 'string',
                    description: 'Optional glob pattern to filter files, e.g. "*.ts" or "*.tsx"',
                },
                case_insensitive: {
                    type: 'boolean',
                    description: 'Whether search should be case insensitive (default: true)',
                },
            },
            required: ['query'],
        },
    },
    {
        name: 'read_file',
        description: 'Read the contents of a source file. You can optionally specify a line range to read only part of the file.',
        input_schema: {
            type: 'object' as const,
            properties: {
                file_path: {
                    type: 'string',
                    description: 'Relative file path from project root',
                },
                start_line: {
                    type: 'number',
                    description: 'Optional start line (1-indexed)',
                },
                end_line: {
                    type: 'number',
                    description: 'Optional end line (1-indexed, inclusive)',
                },
            },
            required: ['file_path'],
        },
    },
    {
        name: 'list_directory',
        description: 'List files and subdirectories in a project directory. Useful for exploring the project structure.',
        input_schema: {
            type: 'object' as const,
            properties: {
                directory: {
                    type: 'string',
                    description: 'Relative directory path from project root (use "." for root)',
                },
                max_depth: {
                    type: 'number',
                    description: 'Maximum depth to list (default: 2)',
                },
            },
            required: ['directory'],
        },
    },
    {
        name: 'report_mapping',
        description: 'Report the final mapping result for this object. Call this ONLY when you have finished analyzing the codebase and have determined the implementation status. This is the terminal action — once called, the analysis ends.',
        input_schema: {
            type: 'object' as const,
            properties: {
                status: {
                    type: 'string',
                    enum: ['implemented', 'partial', 'not_found', 'unknown'],
                    description: 'Implementation status: implemented (fully), partial (some parts), not_found (no code found), unknown (cannot determine)',
                },
                summary: {
                    type: 'string',
                    description: 'Detailed analysis summary in Markdown. Include: what this feature does, how it is implemented, key files and their roles, notable patterns or concerns.',
                },
                impl_files: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            filePath: { type: 'string' },
                            description: { type: 'string' },
                            lineRange: {
                                type: 'object',
                                properties: {
                                    start: { type: 'number' },
                                    end: { type: 'number' },
                                },
                            },
                        },
                        required: ['filePath', 'description'],
                    },
                    description: 'Implementation source files related to this feature',
                },
                test_files: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            filePath: { type: 'string' },
                            description: { type: 'string' },
                            lineRange: {
                                type: 'object',
                                properties: {
                                    start: { type: 'number' },
                                    end: { type: 'number' },
                                },
                            },
                        },
                        required: ['filePath', 'description'],
                    },
                    description: 'Test files related to this feature',
                },
            },
            required: ['status', 'summary', 'impl_files', 'test_files'],
        },
    },
];

// ─── Tool execution ──────────────────────────────────

function executeSearchCode(workspace: string, input: { query: string; file_pattern?: string; case_insensitive?: boolean }): string {
    try {
        const { execSync } = require('child_process');
        const args = ['--json', '-n', '--max-count', '10', '--max-filesize', '500K'];

        // Add ignore patterns
        for (const dir of IGNORE_DIRS) {
            args.push('--glob', `!${dir}`);
        }

        if (input.case_insensitive !== false) args.push('-i');
        if (input.file_pattern) args.push('--glob', input.file_pattern);
        args.push('--', input.query, '.');

        const result = execSync(`rg ${args.map(a => `'${a}'`).join(' ')}`, {
            cwd: workspace,
            encoding: 'utf-8',
            maxBuffer: 1024 * 1024,
            timeout: 15000,
        });

        // Parse rg JSON output into readable format
        const lines = result.trim().split('\n').filter(Boolean);
        const matches: string[] = [];
        for (const line of lines) {
            try {
                const parsed = JSON.parse(line);
                if (parsed.type === 'match') {
                    const relPath = parsed.data.path.text;
                    const lineNum = parsed.data.line_number;
                    const text = parsed.data.lines.text.trim().substring(0, 200);
                    matches.push(`${relPath}:${lineNum}: ${text}`);
                }
            } catch { /* skip unparseable lines */ }
        }

        if (matches.length === 0) return 'No matches found.';
        return matches.slice(0, 30).join('\n') + (matches.length > 30 ? `\n... (${matches.length - 30} more matches)` : '');
    } catch (err: any) {
        if (err.status === 1) return 'No matches found.';
        return `Search error: ${err.message?.substring(0, 200) ?? 'unknown'}`;
    }
}

function executeReadFile(workspace: string, input: { file_path: string; start_line?: number; end_line?: number }): string {
    try {
        const fullPath = path.resolve(workspace, input.file_path);
        // Security: ensure the path is within the workspace
        if (!fullPath.startsWith(path.resolve(workspace))) {
            return 'Error: file path is outside the workspace.';
        }
        if (!fs.existsSync(fullPath)) return `File not found: ${input.file_path}`;

        const stat = fs.statSync(fullPath);
        if (stat.size > 500 * 1024) return `File too large (${Math.round(stat.size / 1024)}KB). Try specifying a line range.`;

        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');

        const start = Math.max(1, input.start_line ?? 1);
        const end = Math.min(lines.length, input.end_line ?? lines.length);

        if (end - start > 300) {
            return `File has ${lines.length} lines. Showing first 300 lines from L${start}. Specify a narrower range.\n\n` +
                lines.slice(start - 1, start - 1 + 300).map((l, i) => `${start + i}: ${l}`).join('\n');
        }

        return lines.slice(start - 1, end).map((l, i) => `${start + i}: ${l}`).join('\n');
    } catch (err: any) {
        return `Read error: ${err.message?.substring(0, 200) ?? 'unknown'}`;
    }
}

function executeListDirectory(workspace: string, input: { directory: string; max_depth?: number }): string {
    const maxDepth = input.max_depth ?? 2;
    const rootDir = path.resolve(workspace, input.directory);

    if (!rootDir.startsWith(path.resolve(workspace))) return 'Error: path outside workspace.';
    if (!fs.existsSync(rootDir)) return `Directory not found: ${input.directory}`;

    const lines: string[] = [];
    let fileCount = 0;

    function walk(dir: string, prefix: string, depth: number): void {
        if (depth > maxDepth || fileCount > 200) return;
        let entries: fs.Dirent[];
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }

        entries.sort((a, b) => {
            if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
            return a.name.localeCompare(b.name);
        });

        const filtered = entries.filter(e => {
            if (e.name.startsWith('.')) return false;
            if (e.isDirectory()) return !IGNORE_DIRS.has(e.name);
            return true;
        });

        for (let i = 0; i < filtered.length; i++) {
            if (fileCount > 200) { lines.push(`${prefix}... (truncated)`); return; }
            const entry = filtered[i];
            const isLast = i === filtered.length - 1;
            const connector = isLast ? '└── ' : '├── ';
            const childPrefix = isLast ? '    ' : '│   ';

            if (entry.isDirectory()) {
                lines.push(`${prefix}${connector}${entry.name}/`);
                walk(path.join(dir, entry.name), prefix + childPrefix, depth + 1);
            } else {
                fileCount++;
                lines.push(`${prefix}${connector}${entry.name}`);
            }
        }
    }

    walk(rootDir, '', 0);
    return lines.join('\n') || '(empty directory)';
}

function executeTool(workspace: string, name: string, input: any): string {
    switch (name) {
        case 'search_code': return executeSearchCode(workspace, input);
        case 'read_file': return executeReadFile(workspace, input);
        case 'list_directory': return executeListDirectory(workspace, input);
        default: return `Unknown tool: ${name}`;
    }
}

// ─── System prompt builder ───────────────────────────

function buildSystemPrompt(
    objectNode: ObjectTreeNode,
    ancestorPath: string[],
    childMappings: ObjectMappingResult[],
    objectDetail?: { content?: string; implRules?: { id: string; text: string }[]; testRules?: { id: string; text: string }[] },
): string {
    const lines: string[] = [];
    lines.push(`You are a code analyst. Your task is to find ALL source code that implements or tests the following feature object.`);
    lines.push('');
    lines.push(`## Target Object`);
    lines.push(`- **Name**: ${objectNode.title}`);
    lines.push(`- **ID**: ${objectNode.id}`);
    if (ancestorPath.length > 0) {
        lines.push(`- **Ancestor path**: ${ancestorPath.join(' → ')} → **${objectNode.title}**`);
    }
    if (objectDetail?.content) {
        lines.push('');
        lines.push('**Description:**');
        lines.push(objectDetail.content);
    }
    if (objectDetail?.implRules && objectDetail.implRules.length > 0) {
        lines.push('');
        lines.push('**Implementation Rules:**');
        for (const r of objectDetail.implRules) {
            lines.push(`- ${r.text}`);
        }
    }
    if (objectDetail?.testRules && objectDetail.testRules.length > 0) {
        lines.push('');
        lines.push('**Test Rules:**');
        for (const r of objectDetail.testRules) {
            lines.push(`- ${r.text}`);
        }
    }

    // Child mapping results as context
    if (childMappings.length > 0) {
        lines.push('');
        lines.push('## Child Feature Mappings (already scanned)');
        lines.push('The following child features have already been mapped. Use their file locations as hints for where this parent feature\'s code might be:');
        lines.push('');
        for (const child of childMappings) {
            lines.push(`### ${child.objectTitle} (${child.status})`);
            if (child.implFiles.length > 0) {
                lines.push('Impl files: ' + child.implFiles.map(f => f.filePath).join(', '));
            }
            if (child.testFiles.length > 0) {
                lines.push('Test files: ' + child.testFiles.map(f => f.filePath).join(', '));
            }
            if (child.summary) {
                lines.push(`Summary: ${child.summary.substring(0, 300)}`);
            }
            lines.push('');
        }
    }

    lines.push('');
    lines.push('## Instructions');
    lines.push('1. Use `list_directory` to explore the project structure');
    lines.push('2. Use `search_code` to find code related to this feature by searching for relevant keywords, class names, function names');
    lines.push('3. Use `read_file` to examine the most relevant files in detail');
    lines.push('4. When you have enough information, call `report_mapping` with your findings');
    lines.push('');
    lines.push('Be thorough but efficient. Focus on finding the primary implementation and test files.');
    lines.push('Classify files as impl (source/implementation) or test (test/spec files).');

    return lines.join('\n');
}

// ─── Main scan function ──────────────────────────────

const MAX_AGENT_TURNS = 15;

export interface ScanSingleObjectOptions {
    config: AiConfig;
    workspace: string;
    objectNode: ObjectTreeNode;
    ancestorPath: string[];
    childMappings?: ObjectMappingResult[];
    objectDetail?: { content?: string; implRules?: { id: string; text: string }[]; testRules?: { id: string; text: string }[] };
}

/**
 * Scan a single object using an agentic Claude loop with tool use.
 * Returns structured mapping result.
 */
export async function scanSingleObject(options: ScanSingleObjectOptions): Promise<ObjectMappingResult> {
    const { config, workspace, objectNode, ancestorPath, childMappings = [], objectDetail } = options;

    const client = new Anthropic({
        apiKey: config.apiKey,
        baseURL: config.baseUrl || 'https://api.anthropic.com',
    });

    const systemPrompt = buildSystemPrompt(objectNode, ancestorPath, childMappings, objectDetail);
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // Start the conversation
    const messages: Anthropic.MessageParam[] = [
        { role: 'user', content: `Analyze the implementation of "${objectNode.title}" in this project. Start by exploring the project structure and then search for related code.` },
    ];

    for (let turn = 0; turn < MAX_AGENT_TURNS; turn++) {
        console.log(`[AgentScanner] ${objectNode.title} — turn ${turn + 1}`);

        const response = await client.messages.create({
            model: config.model || 'claude-sonnet-4-20250514',
            max_tokens: 4096,
            system: systemPrompt,
            tools,
            messages,
        });

        totalInputTokens += response.usage?.input_tokens ?? 0;
        totalOutputTokens += response.usage?.output_tokens ?? 0;

        // Check if report_mapping was called
        const reportBlock = response.content.find(
            (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'report_mapping'
        );

        if (reportBlock) {
            const input = reportBlock.input as any;
            console.log(`[AgentScanner] ${objectNode.title} → report_mapping: ${input.status}`);

            return {
                objectId: objectNode.id,
                objectTitle: objectNode.title,
                scannedAt: new Date().toISOString(),
                status: input.status,
                summary: input.summary || '',
                implFiles: (input.impl_files || []).map((f: any) => ({
                    filePath: f.filePath,
                    description: f.description || '',
                    lineRange: f.lineRange,
                    type: 'impl' as const,
                })),
                testFiles: (input.test_files || []).map((f: any) => ({
                    filePath: f.filePath,
                    description: f.description || '',
                    lineRange: f.lineRange,
                    type: 'test' as const,
                })),
                tokenUsage: {
                    inputTokens: totalInputTokens,
                    outputTokens: totalOutputTokens,
                    model: config.model || 'claude-sonnet-4-20250514',
                    timestamp: new Date().toISOString(),
                },
            };
        }

        // Handle other tool_use blocks
        const toolBlocks = response.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
        );

        if (toolBlocks.length === 0 || response.stop_reason === 'end_turn') {
            // No more tools to call — force a report
            console.log(`[AgentScanner] ${objectNode.title} — no more tools, forcing report`);
            return {
                objectId: objectNode.id,
                objectTitle: objectNode.title,
                scannedAt: new Date().toISOString(),
                status: 'unknown',
                summary: 'Agent did not produce a structured report.',
                implFiles: [],
                testFiles: [],
                tokenUsage: {
                    inputTokens: totalInputTokens,
                    outputTokens: totalOutputTokens,
                    model: config.model || 'claude-sonnet-4-20250514',
                    timestamp: new Date().toISOString(),
                },
            };
        }

        // Execute tools and build tool_result messages
        messages.push({ role: 'assistant', content: response.content });

        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const block of toolBlocks) {
            console.log(`[AgentScanner] ${objectNode.title} → ${block.name}(${JSON.stringify(block.input).substring(0, 100)})`);
            const result = executeTool(workspace, block.name, block.input);
            toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: result,
            });
        }

        messages.push({ role: 'user', content: toolResults });
    }

    // Max turns reached
    console.log(`[AgentScanner] ${objectNode.title} — max turns reached`);
    return {
        objectId: objectNode.id,
        objectTitle: objectNode.title,
        scannedAt: new Date().toISOString(),
        status: 'unknown',
        summary: 'Max agent turns reached without producing a report.',
        implFiles: [],
        testFiles: [],
        tokenUsage: {
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
            model: config.model || 'claude-sonnet-4-20250514',
            timestamp: new Date().toISOString(),
        },
    };
}
