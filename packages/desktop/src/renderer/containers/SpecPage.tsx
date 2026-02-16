/**
 * Container component — VS Code-like layout.
 * Left: object tree | Detail | Implementations | Tests
 */
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Typography, Button, Space, Divider, message, Modal, Input, Splitter, Tooltip, theme, Switch, Drawer } from 'antd';
import { ExportOutlined, CopyOutlined, ScanOutlined } from '@ant-design/icons';
import { ObjectTable } from '../components/SpecTable';
import { ObjectDetailPanel } from '../components/SpecDetailPanel';
import { MarkdownPreview } from '../components/MarkdownPreview';
import { useObjects } from '../hooks/useSpecs';
import type { ObjectTreeNode, ObjectDetail, ObjectRule, GlobalRule, ScanLogEntry } from '@specbook/shared';

const { Title, Text } = Typography;
const { useToken } = theme;

/** Panel showing scan-based file matches for the selected object. */
const ScanMatchPanel: React.FC<{
    title: string;
    borderColor: string;
    scanLog: ScanLogEntry[];
    selectedObjectId: string | null;
    objects: ObjectTreeNode[];
    type: 'impl' | 'test';
    implRuleIds?: Set<string>;
    testRuleIds?: Set<string>;
    objectIds?: Set<string>;
}> = React.memo(({ title, borderColor, scanLog, selectedObjectId, objects, type }) => {
    // Find selected node
    const findNode = (nodes: ObjectTreeNode[], id: string): ObjectTreeNode | null => {
        for (const n of nodes) {
            if (n.id === id) return n;
            if (n.children) { const f = findNode(n.children, id); if (f) return f; }
        }
        return null;
    };
    const node = selectedObjectId ? findNode(objects, selectedObjectId) : null;

    // Collect relevant IDs for the selected object
    const relevantIds = useMemo(() => {
        if (!node) return new Set<string>();
        const ids = new Set<string>();
        if (type === 'impl') {
            ids.add(node.id.toLowerCase());
            node.implRules?.forEach(r => ids.add(r.id.toLowerCase()));
        } else {
            node.testRules?.forEach(r => ids.add(r.id.toLowerCase()));
        }
        return ids;
    }, [node, type]);

    // Filter scan entries
    const matched = useMemo(() => {
        if (relevantIds.size === 0) return [];
        return scanLog
            .map(entry => {
                const hits = entry.matches.filter(m => relevantIds.has(m.uuid));
                return hits.length > 0 ? { filePath: entry.filePath, matches: hits } : null;
            })
            .filter(Boolean) as { filePath: string; matches: { uuid: string; line: number }[] }[];
    }, [scanLog, relevantIds]);

    const icon = type === 'impl' ? '📄' : '🧪';
    const color = type === 'impl' ? '#52c41a' : '#1677ff';

    return (
        <div style={{ height: '100%', borderLeft: `1px solid ${borderColor}`, overflow: 'auto' }}>
            <div style={{ padding: '8px 12px', borderBottom: `1px solid ${borderColor}` }}>
                <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {title} ({matched.length})
                </Text>
            </div>
            {scanLog.length === 0 ? (
                <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--ant-color-text-quaternary)', fontSize: 12 }}>
                    Run Scan first
                </div>
            ) : !selectedObjectId ? (
                <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--ant-color-text-quaternary)', fontSize: 12 }}>
                    Select an object
                </div>
            ) : matched.length === 0 ? (
                <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--ant-color-text-quaternary)', fontSize: 12 }}>
                    No {title.toLowerCase()} found
                </div>
            ) : (
                matched.map(entry => (
                    <Tooltip key={entry.filePath} title={`${entry.filePath}\n${entry.matches.map(m => `L${m.line}: ${m.uuid}`).join('\n')}`}>
                        <div
                            style={{
                                cursor: 'pointer', fontSize: 12, color,
                                padding: '4px 12px', transition: 'background 0.15s',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--ant-color-fill-secondary)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            onClick={() => {
                                window.api.openInEditor(entry.filePath, entry.matches[0]?.line).catch((err: any) => {
                                    message.error(err?.message || 'Failed to open file');
                                });
                            }}
                        >
                            {icon} {entry.filePath.split('/').pop()}
                            <span style={{ opacity: 0.5, marginLeft: 4 }}>:{entry.matches[0]?.line}</span>
                        </div>
                    </Tooltip>
                ))
            )}
        </div>
    );
});

interface ObjectPageProps {
    workspace: string | null;
}

// @specbook-object 019c4d29-46fb-748d-8dd3-e0cd47a3223e — Features Management Page
export const ObjectPage: React.FC<ObjectPageProps> = ({ workspace }) => {
    const { token } = useToken();
    const {
        objects, loading, loadObjects,
        addObject, deleteObject, moveObject,
    } = useObjects();

    const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);

    // Column visibility toggles
    const [showImpl, setShowImpl] = useState(true);
    const [showTests, setShowTests] = useState(true);

    // Prompt preview drawer
    const [promptDrawerOpen, setPromptDrawerOpen] = useState(false);
    const [promptText, setPromptText] = useState('');
    const [drawerWidth, setDrawerWidth] = useState(() => Math.round(window.innerWidth * 0.5));
    const dragging = useRef(false);

    const onDragStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        dragging.current = true;
        const onMove = (ev: MouseEvent) => {
            if (!dragging.current) return;
            const newWidth = Math.max(300, Math.min(window.innerWidth * 0.9, window.innerWidth - ev.clientX));
            setDrawerWidth(newWidth);
        };
        const onUp = () => {
            dragging.current = false;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }, []);
    // Collect all rule IDs from the object tree for scan categorisation
    const { implRuleIds, testRuleIds, objectIds } = useMemo(() => {
        const implIds = new Set<string>();
        const testIds = new Set<string>();
        const objIds = new Set<string>();
        const walk = (nodes: ObjectTreeNode[]) => {
            for (const n of nodes) {
                objIds.add(n.id.toLowerCase());
                n.implRules?.forEach(r => implIds.add(r.id.toLowerCase()));
                n.testRules?.forEach(r => testIds.add(r.id.toLowerCase()));
                if (n.children) walk(n.children);
            }
        };
        walk(objects);
        return { implRuleIds: implIds, testRuleIds: testIds, objectIds: objIds };
    }, [objects]);

    // Source scan results
    const [foundIds, setFoundIds] = useState<Set<string> | undefined>(undefined);
    const [scanning, setScanning] = useState(false);
    const [scanLog, setScanLog] = useState<ScanLogEntry[]>([]);
    const [scanStats, setScanStats] = useState<{ scannedFiles: number; foundIds: number } | null>(null);
    const [scanDrawerOpen, setScanDrawerOpen] = useState(false);
    const [scanDrawerWidth, setScanDrawerWidth] = useState(() => Math.round(window.innerWidth * 0.4));
    const scanDragging = useRef(false);

    const onScanDragStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        scanDragging.current = true;
        const onMove = (ev: MouseEvent) => {
            if (!scanDragging.current) return;
            const newWidth = Math.max(300, Math.min(window.innerWidth * 0.9, window.innerWidth - ev.clientX));
            setScanDrawerWidth(newWidth);
        };
        const onUp = () => {
            scanDragging.current = false;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }, []);

    const handleScan = async () => {
        setScanning(true);
        try {
            const result = await window.scanApi.scanSource();
            setFoundIds(new Set(result.foundIds));
            setScanLog(result.scanLog);
            setScanStats({ scannedFiles: result.scannedFiles, foundIds: result.foundIds.length });
            setScanDrawerOpen(true);
            message.success(`Scan complete — ${result.foundIds.length} UUIDs found in ${result.scannedFiles} files`);
        } catch (err: any) {
            message.error(err?.message || 'Scan failed');
        } finally {
            setScanning(false);
        }
    };

    // Add-new modal
    const [addMode, setAddMode] = useState<'root' | 'sibling' | 'child' | null>(null);
    const [addParentId, setAddParentId] = useState<string | null>(null);
    const [newTitle, setNewTitle] = useState('');
    const [adding, setAdding] = useState(false);

    useEffect(() => { if (workspace) loadObjects(); }, [workspace, loadObjects]);


    const handleDelete = async (id: string) => {
        try {
            await deleteObject(id);
            if (selectedObjectId === id) setSelectedObjectId(null);
            message.success('Deleted');
        } catch (err: any) { message.error(err?.message || 'Failed to delete'); }
    };

    const handleOpen = (id: string) => setSelectedObjectId(id);
    const handleSaved = () => {
        loadObjects();
    };

    const handleAddRoot = () => { setAddMode('root'); setAddParentId(null); setNewTitle(''); };
    const handleAddSibling = (_afterId: string, parentId: string | null) => { setAddMode('sibling'); setAddParentId(parentId); setNewTitle(''); };
    const handleAddChild = (parentId: string) => { setAddMode('child'); setAddParentId(parentId); setNewTitle(''); };

    const handleAddConfirm = async () => {
        if (!newTitle.trim()) return;
        setAdding(true);
        try {
            const parentId = addMode === 'root' ? null : addParentId;
            await addObject({ title: newTitle.trim(), parentId });
            message.success('Object added');
            setAddMode(null);
        } catch (err: any) {
            message.error(err?.message || 'Failed to add');
        } finally { setAdding(false); }
    };
    const handleAddCancel = () => setAddMode(null);

    const handleBatchDelete = async (ids: string[]) => {
        try {
            for (const id of ids) await deleteObject(id);
            if (selectedObjectId && ids.includes(selectedObjectId)) setSelectedObjectId(null);
            message.success(`Deleted ${ids.length} object(s)`);
        } catch (err: any) { message.error(err?.message || 'Batch delete failed'); }
    };

    const handleBatchMove = async (ids: string[], newParentId: string | null) => {
        try {
            for (const id of ids) await moveObject({ id, newParentId });
            message.success(`Moved ${ids.length} object(s)`);
        } catch (err: any) { message.error(err?.message || 'Batch move failed'); }
    };


    const handleExport = async () => {
        try {
            const saved = await window.api.exportMarkdown();
            if (saved) message.success('Exported successfully');
        } catch (err: any) {
            message.error(err?.message || 'Export failed');
        }
    };

    // ─── Generate Agent Prompt ────────────────────────

    /** Recursively find a tree node by id. */
    const findNode = (nodes: ObjectTreeNode[], id: string): ObjectTreeNode | null => {
        for (const n of nodes) {
            if (n.id === id) return n;
            if (n.children) {
                const found = findNode(n.children, id);
                if (found) return found;
            }
        }
        return null;
    };

    /** Collect node and all descendants into a flat list. */
    const collectNodes = (node: ObjectTreeNode): ObjectTreeNode[] => {
        const result: ObjectTreeNode[] = [node];
        if (node.children) {
            for (const child of node.children) {
                result.push(...collectNodes(child));
            }
        }
        return result;
    };

    const handleGeneratePrompt = async (id: string) => {
        const rootNode = findNode(objects, id);
        if (!rootNode) { message.error('Object not found'); return; }

        const hide = message.loading('Generating prompt...', 0);
        try {
            // 1. Collect all nodes (root + descendants)
            const allNodes = collectNodes(rootNode);

            // 2. Fetch full detail for each object (parallel)
            const details = await Promise.all(
                allNodes.map(n => window.api.getObject(n.id))
            );

            // 3. Load global rules
            let globalRules: GlobalRule[] = [];
            try { globalRules = await window.globalRulesApi.loadRules(); } catch { /* ignore */ }

            // 4. Build prompt sections
            const sections: string[] = [];
            const hasScanned = !!foundIds;

            // Helper: check if an ID was found in source scan
            const isFound = (uid: string) => hasScanned && foundIds!.has(uid.toLowerCase());

            // Header
            sections.push('# Development Specification Prompt');
            sections.push('');
            sections.push('You are working on the following feature based on its specification.');
            sections.push('For each object and rule below, follow the instructions carefully.');
            sections.push('');

            // Global rules
            const implGlobalRules = globalRules.filter(r => r.category === 'impl');
            if (implGlobalRules.length > 0) {
                sections.push('## Global Implementation Rules');
                sections.push('');
                for (const gr of implGlobalRules) {
                    sections.push(`- **${gr.name}** (ID: \`${gr.id}\`): ${gr.text}`);
                }
                sections.push('');
            }

            // Object specifications
            sections.push('## Object Specifications');
            sections.push('');

            const renderNode = (node: ObjectTreeNode, detail: ObjectDetail | null, depth: number) => {
                const indent = '  '.repeat(depth);
                const prefix = depth === 0 ? '###' : '####';
                const objectImplemented = isFound(node.id);
                const statusIcon = hasScanned ? (objectImplemented ? '✅' : '❌') : '';

                sections.push(`${indent}${prefix} ${statusIcon} ${node.title}`);
                sections.push(`${indent}- **Object ID**: \`${node.id}\``);
                if (hasScanned) {
                    sections.push(`${indent}- **Status**: ${objectImplemented ? '已实现 (Implemented)' : '未实现 (Not Implemented)'}`);
                }
                sections.push('');

                // Action instruction based on status
                if (hasScanned && !objectImplemented) {
                    sections.push(`${indent}> **ACTION**: Implement this object feature. After implementation, add a traceability comment \`// @specbook-object ${node.id} — ${node.title}\` at the class/function/module level.`);
                    sections.push('');
                } else if (hasScanned && objectImplemented) {
                    sections.push(`${indent}> **ACTION**: This object is already implemented. Verify that the traceability comment \`// @specbook-object ${node.id} — ${node.title}\` exists at the appropriate class/function/module level. If missing, add it.`);
                    sections.push('');
                }

                if (detail?.content) {
                    sections.push(`${indent}**Description:**`);
                    sections.push('');
                    sections.push(detail.content);
                    sections.push('');
                }

                // Implementation rules
                const implRules: ObjectRule[] = detail?.implRules ?? [];
                if (implRules.length > 0) {
                    sections.push(`${indent}**Implementation Rules:**`);
                    sections.push('');
                    for (const rule of implRules) {
                        const ruleImpl = isFound(rule.id);
                        const ruleIcon = hasScanned ? (ruleImpl ? '✅' : '❌') : '';
                        sections.push(`${indent}- ${ruleIcon} (Rule ID: \`${rule.id}\`) ${rule.text}`);
                        if (hasScanned && !ruleImpl) {
                            sections.push(`${indent}  - ⚠️ **Not yet applied**. Implement this rule and add \`// @specbook-rule ${rule.id} — ${rule.text}\` at the location where it is applied.`);
                        } else if (hasScanned && ruleImpl) {
                            sections.push(`${indent}  - ✓ Applied. Verify \`// @specbook-rule ${rule.id} — ${rule.text}\` is placed at the correct location.`);
                        }
                    }
                    sections.push('');
                }

                // Test rules
                const testRules: ObjectRule[] = detail?.testRules ?? [];
                if (testRules.length > 0) {
                    sections.push(`${indent}**Test Rules:**`);
                    sections.push('');
                    for (const rule of testRules) {
                        const ruleImpl = isFound(rule.id);
                        const ruleIcon = hasScanned ? (ruleImpl ? '✅' : '❌') : '';
                        sections.push(`${indent}- ${ruleIcon} (Rule ID: \`${rule.id}\`) ${rule.text}`);
                        if (hasScanned && !ruleImpl) {
                            sections.push(`${indent}  - ⚠️ **Test not yet implemented**. Write a test for this rule and add \`// @specbook-rule ${rule.id} — ${rule.text}\` in the test file.`);
                        } else if (hasScanned && ruleImpl) {
                            sections.push(`${indent}  - ✓ Test exists. Verify \`// @specbook-rule ${rule.id} — ${rule.text}\` is placed in the correct test file/location.`);
                        }
                    }
                    sections.push('');
                }
            };

            for (let i = 0; i < allNodes.length; i++) {
                const node = allNodes[i];
                const detail = details[i];
                // Calculate depth relative to root
                let depth = 0;
                let pid = node.parentId;
                while (pid && pid !== rootNode.parentId) {
                    depth++;
                    const parent = allNodes.find(n => n.id === pid);
                    pid = parent?.parentId ?? null;
                }
                renderNode(node, detail, depth);
            }

            // Traceability annotation rule
            sections.push('---');
            sections.push('');
            sections.push('## IMPORTANT: Traceability Annotations');
            sections.push('');
            sections.push('When implementing or reviewing the above specification, you **MUST** ensure traceability comments exist:');
            sections.push('');
            sections.push('1. At the class, function, or module level that implements an object, add:');
            sections.push('   ```');
            sections.push('   // @specbook-object <object-id> — <object title/description>');
            sections.push('   ```');
            sections.push('2. At the code location where a specific rule is applied, add:');
            sections.push('   ```');
            sections.push('   // @specbook-rule <rule-id> — <rule description>');
            sections.push('   ```');
            sections.push('3. For test files, use the same annotations so tests can be linked back to the spec.');
            sections.push('');
            sections.push('The description after the `—` dash helps developers quickly understand what each annotation refers to without looking up the spec. **Do not omit them.**');
            sections.push('');

            // Show in drawer
            const promptText = sections.join('\n');
            setPromptText(promptText);
            setPromptDrawerOpen(true);
        } catch (err: any) {
            message.error(err?.message || 'Failed to generate prompt');
        } finally {
            hide();
        }
    };

    const modalTitle = addMode === 'child' ? 'Add Child Object' : addMode === 'sibling' ? 'Add Sibling Object' : 'New Object';

    if (!workspace) return null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
            {/* Top bar */}
            <div style={{ flexShrink: 0, marginBottom: 8 }}>
                <Space style={{ width: '100%', justifyContent: 'space-between' }} align="center">
                    <Title level={4} style={{ margin: 0 }}>Features</Title>
                    <Space size={12}>
                        <Space size={4}>
                            <Text type="secondary" style={{ fontSize: 12 }}>Implementations</Text>
                            <Switch size="small" checked={showImpl} onChange={setShowImpl} />
                        </Space>
                        <Space size={4}>
                            <Text type="secondary" style={{ fontSize: 12 }}>Tests</Text>
                            <Switch size="small" checked={showTests} onChange={setShowTests} />
                        </Space>
                        <Button size="small" icon={<ScanOutlined />} onClick={handleScan} loading={scanning}>Scan</Button>
                        <Button size="small" icon={<ExportOutlined />} onClick={handleExport}>Export</Button>
                    </Space>
                </Space>
                <Divider style={{ margin: '8px 0' }} />
            </div>

            {/* Splitter: tree | detail | impls | tests */}
            <Splitter style={{ flex: 1, minHeight: 0 }}>
                <Splitter.Panel defaultSize={showImpl || showTests ? '30%' : '50%'} min="200px" max="50%">
                    <div style={{ height: '100%', overflow: 'auto', paddingRight: 4 }}>
                        <ObjectTable
                            objects={objects} loading={loading}
                            onDelete={handleDelete} onOpen={handleOpen}
                            onAddSibling={handleAddSibling} onAddChild={handleAddChild} onAddRoot={handleAddRoot}
                            onBatchDelete={handleBatchDelete} onBatchMove={handleBatchMove}
                            onGeneratePrompt={handleGeneratePrompt}
                            foundIds={foundIds}
                        />
                    </div>
                </Splitter.Panel>
                <Splitter.Panel defaultSize={showImpl || showTests ? '30%' : '50%'}>
                    <div style={{
                        height: '100%',
                        borderLeft: `1px solid ${token.colorBorderSecondary}`,
                        overflow: 'auto',
                    }}>
                        <ObjectDetailPanel specId={selectedObjectId} specs={objects} onSaved={handleSaved} />
                    </div>
                </Splitter.Panel>
                {showImpl && (
                    <Splitter.Panel defaultSize="20%">
                        <ScanMatchPanel
                            title="Implementations"
                            borderColor={token.colorBorderSecondary}
                            scanLog={scanLog}
                            selectedObjectId={selectedObjectId}
                            objects={objects}
                            type="impl"
                            implRuleIds={implRuleIds}
                            objectIds={objectIds}
                        />
                    </Splitter.Panel>
                )}
                {showTests && (
                    <Splitter.Panel defaultSize="20%">
                        <ScanMatchPanel
                            title="Tests"
                            borderColor={token.colorBorderSecondary}
                            scanLog={scanLog}
                            selectedObjectId={selectedObjectId}
                            objects={objects}
                            type="test"
                            testRuleIds={testRuleIds}
                        />
                    </Splitter.Panel>
                )}
            </Splitter>

            {/* Add modal */}
            <Modal title={modalTitle} open={!!addMode} onOk={handleAddConfirm} onCancel={handleAddCancel} confirmLoading={adding} okText="Add" destroyOnClose>
                <Input placeholder="Object title..." value={newTitle} onChange={e => setNewTitle(e.target.value)} onPressEnter={handleAddConfirm} autoFocus />
            </Modal>

            {/* Prompt preview drawer */}
            <Drawer
                title="Generated Prompt"
                placement="right"
                width={drawerWidth}
                open={promptDrawerOpen}
                onClose={() => setPromptDrawerOpen(false)}
                extra={
                    <Button
                        icon={<CopyOutlined />}
                        onClick={async () => {
                            await navigator.clipboard.writeText(promptText);
                            message.success('Copied to clipboard');
                        }}
                    >
                        Copy
                    </Button>
                }
                destroyOnClose
            >
                {/* Drag handle on left edge */}
                <div
                    onMouseDown={onDragStart}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: 6,
                        height: '100%',
                        cursor: 'col-resize',
                        zIndex: 10,
                    }}
                />
                <MarkdownPreview content={promptText} />
            </Drawer>

            {/* Scan log drawer */}
            <Drawer
                title="Scan Log"
                placement="right"
                width={scanDrawerWidth}
                open={scanDrawerOpen}
                onClose={() => setScanDrawerOpen(false)}
                destroyOnClose
            >
                {/* Drag handle on left edge */}
                <div
                    onMouseDown={onScanDragStart}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: 6,
                        height: '100%',
                        cursor: 'col-resize',
                        zIndex: 10,
                    }}
                />
                {scanStats && (
                    <div style={{ marginBottom: 16 }}>
                        <Space size={16}>
                            <Text strong>Scanned: {scanStats.scannedFiles} files</Text>
                            <Text strong>UUIDs: {scanStats.foundIds}</Text>
                            <Text strong>Matched files: {scanLog.length}</Text>
                        </Space>
                    </div>
                )}
                {/* Impl / Test columns */}
                <div style={{ display: 'flex', gap: 16 }}>
                    {/* Implementations column */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>Implementations</Text>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {scanLog.map(entry => {
                                const implMatches = entry.matches.filter(m => implRuleIds.has(m.uuid) || objectIds.has(m.uuid));
                                if (implMatches.length === 0) return null;
                                return (
                                    <div key={`impl-${entry.filePath}`} style={{ padding: '6px 10px', background: token.colorBgTextHover, borderRadius: 6 }}>
                                        <Text
                                            strong
                                            style={{ fontSize: 12, display: 'block', marginBottom: 4, wordBreak: 'break-all', cursor: 'pointer', color: token.colorPrimary }}
                                            onClick={() => window.api.openInEditor(entry.filePath, implMatches[0]?.line)}
                                        >
                                            📄 {entry.filePath}
                                        </Text>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                            {implMatches.map((m, i) => (
                                                <Text
                                                    key={i}
                                                    code
                                                    style={{ fontSize: 11, cursor: 'pointer' }}
                                                    onClick={() => window.api.openInEditor(entry.filePath, m.line)}
                                                >
                                                    L{m.line}: {m.uuid.slice(0, 8)}…
                                                </Text>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    {/* Tests column */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>Tests</Text>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {scanLog.map(entry => {
                                const testMatches = entry.matches.filter(m => testRuleIds.has(m.uuid));
                                if (testMatches.length === 0) return null;
                                return (
                                    <div key={`test-${entry.filePath}`} style={{ padding: '6px 10px', background: token.colorBgTextHover, borderRadius: 6 }}>
                                        <Text
                                            strong
                                            style={{ fontSize: 12, display: 'block', marginBottom: 4, wordBreak: 'break-all', cursor: 'pointer', color: token.colorPrimary }}
                                            onClick={() => window.api.openInEditor(entry.filePath, testMatches[0]?.line)}
                                        >
                                            🧪 {entry.filePath}
                                        </Text>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                            {testMatches.map((m, i) => (
                                                <Text
                                                    key={i}
                                                    code
                                                    style={{ fontSize: 11, cursor: 'pointer' }}
                                                    onClick={() => window.api.openInEditor(entry.filePath, m.line)}
                                                >
                                                    L{m.line}: {m.uuid.slice(0, 8)}…
                                                </Text>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </Drawer>
        </div>
    );
};
