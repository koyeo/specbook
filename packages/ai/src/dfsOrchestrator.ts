/**
 * DFS Orchestrator — traverses the Object Tree depth-first (bottom-up)
 * and scans each object using the agentic scanner.
 *
 * Flow:
 * 1. Flatten tree, compute depth for each node
 * 2. Group by depth (deepest first)
 * 3. For each level: scan all objects, using child results as context
 * 4. Bubble up to parent level
 */
import type { AiConfig, ObjectTreeNode, ObjectMappingResult, ScanProgressEvent } from '@specbook/shared';
import { scanSingleObject } from './agentScanner';

declare const console: { log(...args: any[]): void; error(...args: any[]): void };

interface FlatNode {
    node: ObjectTreeNode;
    depth: number;
    ancestorPath: string[];  // titles of ancestors, root → parent
    parentId: string | null;
}

/** Flatten tree into a list with depth and ancestor info. */
function flattenTree(nodes: ObjectTreeNode[], depth = 0, ancestors: string[] = [], parentId: string | null = null): FlatNode[] {
    const result: FlatNode[] = [];
    for (const node of nodes) {
        result.push({ node, depth, ancestorPath: [...ancestors], parentId });
        if (node.children && node.children.length > 0) {
            result.push(...flattenTree(node.children, depth + 1, [...ancestors, node.title], node.id));
        }
    }
    return result;
}

/** Get object detail — needs to be provided externally since we don't have IPC access here. */
export type GetObjectDetailFn = (objectId: string) => Promise<{
    content?: string;
    implRules?: { id: string; text: string }[];
    testRules?: { id: string; text: string }[];
} | null>;

export interface DfsScanOptions {
    config: AiConfig;
    workspace: string;
    objectTree: ObjectTreeNode[];
    /** Callback for progress events. */
    onProgress?: (event: ScanProgressEvent) => void;
    /** Callback to fetch object detail (content, rules). */
    getObjectDetail?: GetObjectDetailFn;
}

export interface DfsScanResult {
    mappings: ObjectMappingResult[];
    totalTokens: { input: number; output: number };
    scannedAt: string;
}

/**
 * Scan the entire object tree using DFS bottom-up traversal.
 * Returns all per-object mapping results.
 */
export async function scanObjectTreeDFS(options: DfsScanOptions): Promise<DfsScanResult> {
    const { config, workspace, objectTree, onProgress, getObjectDetail } = options;

    // 1. Flatten and compute depths
    const flatNodes = flattenTree(objectTree);
    const total = flatNodes.length;

    if (total === 0) {
        return { mappings: [], totalTokens: { input: 0, output: 0 }, scannedAt: new Date().toISOString() };
    }

    // 2. Group by depth level (descending = deepest first)
    const maxDepth = Math.max(...flatNodes.map(n => n.depth));
    const levels: FlatNode[][] = [];
    for (let d = maxDepth; d >= 0; d--) {
        const nodesAtDepth = flatNodes.filter(n => n.depth === d);
        if (nodesAtDepth.length > 0) levels.push(nodesAtDepth);
    }

    // 3. Scan bottom-up
    const allMappings = new Map<string, ObjectMappingResult>();
    let current = 0;
    let totalInput = 0;
    let totalOutput = 0;

    for (const level of levels) {
        const depthLabel = level[0].depth;
        console.log(`[DFS] Scanning depth ${depthLabel} — ${level.length} objects`);

        for (const flat of level) {
            current++;
            const { node, ancestorPath } = flat;

            // Emit progress: scanning
            onProgress?.({
                objectId: node.id,
                objectTitle: node.title,
                status: 'scanning',
                current,
                total,
            });

            try {
                // Gather child mappings for context
                const childMappings: ObjectMappingResult[] = [];
                if (node.children) {
                    for (const child of node.children) {
                        const childMapping = allMappings.get(child.id);
                        if (childMapping) childMappings.push(childMapping);
                    }
                }

                // Fetch object detail if available
                let objectDetail: { content?: string; implRules?: { id: string; text: string }[]; testRules?: { id: string; text: string }[] } | undefined;
                if (getObjectDetail) {
                    const detail = await getObjectDetail(node.id);
                    if (detail) objectDetail = detail;
                }

                const result = await scanSingleObject({
                    config,
                    workspace,
                    objectNode: node,
                    ancestorPath,
                    childMappings,
                    objectDetail,
                });

                allMappings.set(node.id, result);
                totalInput += result.tokenUsage?.inputTokens ?? 0;
                totalOutput += result.tokenUsage?.outputTokens ?? 0;

                // Emit progress: done
                onProgress?.({
                    objectId: node.id,
                    objectTitle: node.title,
                    status: 'done',
                    current,
                    total,
                });

                console.log(`[DFS] ✅ ${node.title} → ${result.status} (${current}/${total})`);
            } catch (err: any) {
                console.error(`[DFS] ❌ ${node.title}: ${err.message}`);

                // Store error result
                allMappings.set(node.id, {
                    objectId: node.id,
                    objectTitle: node.title,
                    scannedAt: new Date().toISOString(),
                    status: 'unknown',
                    summary: `Scan failed: ${err.message}`,
                    implFiles: [],
                    testFiles: [],
                });

                // Emit progress: error
                onProgress?.({
                    objectId: node.id,
                    objectTitle: node.title,
                    status: 'error',
                    current,
                    total,
                    error: err.message,
                });
            }
        }
    }

    return {
        mappings: Array.from(allMappings.values()),
        totalTokens: { input: totalInput, output: totalOutput },
        scannedAt: new Date().toISOString(),
    };
}
