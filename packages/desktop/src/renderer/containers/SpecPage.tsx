/**
 * Container component — VS Code-like layout.
 * Left: object tree | Detail | Implementations | Tests
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Typography, Button, Space, Divider, message, Modal, Input, Splitter, Tooltip, theme, Switch, Drawer } from 'antd';
import { ExportOutlined, CopyOutlined, ScanOutlined } from '@ant-design/icons';
import { ObjectTable } from '../components/SpecTable';
import { ObjectDetailPanel } from '../components/SpecDetailPanel';
import { MarkdownPreview } from '../components/MarkdownPreview';
import { useObjects } from '../hooks/useSpecs';
import type { RelatedFile, ObjectTreeNode, ObjectDetail, ObjectRule, GlobalRule } from '@specbook/shared';

const { Title, Text } = Typography;
const { useToken } = theme;

/** Clickable file item for impl/test panels. */
const FileLink: React.FC<{ file: RelatedFile; color: string }> = ({ file, color }) => {
    const basename = file.filePath.split('/').pop() || file.filePath;
    return (
        <Tooltip title={`${file.filePath}${file.lineRange ? ` L${file.lineRange.start}-${file.lineRange.end}` : ''}${file.description ? `\n${file.description}` : ''}`}>
            <div
                style={{
                    cursor: 'pointer',
                    fontSize: 12,
                    color,
                    padding: '4px 12px',
                    transition: 'background 0.15s',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--ant-color-fill-secondary)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                onClick={() => {
                    window.api.openInEditor(file.filePath, file.lineRange?.start).catch((err: any) => {
                        message.error(err?.message || 'Failed to open file');
                    });
                }}
            >
                📄 {basename}
                {file.lineRange && <span style={{ opacity: 0.5, marginLeft: 4 }}>:{file.lineRange.start}</span>}
                {file.description && (
                    <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>— {file.description}</Text>
                )}
            </div>
        </Tooltip>
    );
};

/** A panel showing a list of files (impl or test), with optional summary. */
const FileListPanel: React.FC<{ title: string; files: RelatedFile[]; color: string; borderColor: string; summary?: string }> = React.memo(({
    title, files, color, borderColor, summary,
}) => {
    const header = (
        <div style={{ padding: '8px 12px', borderBottom: `1px solid ${borderColor}` }}>
            <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {title} ({files.length})
            </Text>
        </div>
    );

    const fileList = files.length === 0 && !summary ? (
        <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--ant-color-text-quaternary)', fontSize: 12 }}>
            No {title.toLowerCase()} linked
        </div>
    ) : (
        files.map((f, i) => <FileLink key={i} file={f} color={color} />)
    );

    if (!summary) {
        return (
            <div style={{ height: '100%', borderLeft: `1px solid ${borderColor}`, overflow: 'auto' }}>
                {header}
                {fileList}
            </div>
        );
    }

    return (
        <div style={{ height: '100%', borderLeft: `1px solid ${borderColor}`, display: 'flex', flexDirection: 'column' }}>
            {header}
            <Splitter layout="vertical" style={{ flex: 1, minHeight: 0 }}>
                <Splitter.Panel defaultSize="50%" style={{ overflow: 'auto' }}>
                    <div style={{ padding: '8px 12px', fontSize: 12 }}>
                        <MarkdownPreview content={summary} />
                    </div>
                </Splitter.Panel>
                <Splitter.Panel style={{ overflow: 'auto', borderTop: `1px solid ${borderColor}` }}>
                    {fileList}
                </Splitter.Panel>
            </Splitter>
        </div>
    );
});

interface ObjectPageProps {
    workspace: string | null;
}

export const ObjectPage: React.FC<ObjectPageProps> = ({ workspace }) => {
    const { token } = useToken();
    const {
        objects, loading, loadObjects,
        addObject, deleteObject, moveObject,
    } = useObjects();

    const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);

    // Impl/test files for the selected object
    const [implFiles, setImplFiles] = useState<RelatedFile[]>([]);
    const [implSummary, setImplSummary] = useState<string | undefined>(undefined);
    const [testFiles, setTestFiles] = useState<RelatedFile[]>([]);

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

    // Source scan results
    const [foundIds, setFoundIds] = useState<Set<string> | undefined>(undefined);
    const [scanning, setScanning] = useState(false);

    const handleScan = async () => {
        setScanning(true);
        try {
            const result = await window.scanApi.scanSource();
            setFoundIds(new Set(result.foundIds));
            message.success(`Scan complete — ${result.foundIds.length} UUIDs found`);
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

    // Load impl/test files when selection changes
    useEffect(() => {
        if (!selectedObjectId) {
            setImplFiles([]);
            setImplSummary(undefined);
            setTestFiles([]);
            return;
        }
        const load = async () => {
            try {
                const [implData, tests] = await Promise.all([
                    window.api.loadImpls(selectedObjectId),
                    window.api.loadTests(selectedObjectId),
                ]);
                setImplFiles(implData.files);
                setImplSummary(implData.summary);
                setTestFiles(tests);
            } catch {
                setImplFiles([]);
                setImplSummary(undefined);
                setTestFiles([]);
            }
        };
        load();
    }, [selectedObjectId]);

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
        // Reload files after save (detail panel may have changed impls/tests)
        if (selectedObjectId) {
            Promise.all([
                window.api.loadImpls(selectedObjectId),
                window.api.loadTests(selectedObjectId),
            ]).then(([implData, tests]) => {
                setImplFiles(implData.files);
                setImplSummary(implData.summary);
                setTestFiles(tests);
            }).catch(() => { });
        }
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
                    sections.push(`${indent}> **ACTION**: Implement this object feature. After implementation, add a traceability comment \`// @specbook-object ${node.id}\` at the class/function/module level.`);
                    sections.push('');
                } else if (hasScanned && objectImplemented) {
                    sections.push(`${indent}> **ACTION**: This object is already implemented. Verify that the traceability comment \`// @specbook-object ${node.id}\` exists at the appropriate class/function/module level. If missing, add it.`);
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
                            sections.push(`${indent}  - ⚠️ **Not yet applied**. Implement this rule and add \`// @specbook-rule ${rule.id}\` at the location where it is applied.`);
                        } else if (hasScanned && ruleImpl) {
                            sections.push(`${indent}  - ✓ Applied. Verify \`// @specbook-rule ${rule.id}\` is placed at the correct location.`);
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
                            sections.push(`${indent}  - ⚠️ **Test not yet implemented**. Write a test for this rule and add \`// @specbook-rule ${rule.id}\` in the test file.`);
                        } else if (hasScanned && ruleImpl) {
                            sections.push(`${indent}  - ✓ Test exists. Verify \`// @specbook-rule ${rule.id}\` is placed in the correct test file/location.`);
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
            sections.push('   // @specbook-object <object-id>');
            sections.push('   ```');
            sections.push('2. At the code location where a specific rule is applied, add:');
            sections.push('   ```');
            sections.push('   // @specbook-rule <rule-id>');
            sections.push('   ```');
            sections.push('3. For test files, use the same annotations so tests can be linked back to the spec.');
            sections.push('');
            sections.push('These annotations enable automated scanning tools to verify that every object and rule has been implemented. **Do not omit them.**');
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
                        <FileListPanel
                            title="Implementations"
                            files={implFiles}
                            color="#52c41a"
                            borderColor={token.colorBorderSecondary}
                            summary={implSummary}
                        />
                    </Splitter.Panel>
                )}
                {showTests && (
                    <Splitter.Panel defaultSize="20%">
                        <FileListPanel
                            title="Tests"
                            files={testFiles}
                            color="#1677ff"
                            borderColor={token.colorBorderSecondary}
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
        </div>
    );
};
