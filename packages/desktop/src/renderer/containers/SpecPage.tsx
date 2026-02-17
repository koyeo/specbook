/**
 * Container component — VS Code-like layout.
 * Left: object tree | Detail | Implementations | Tests
 *
 * Uses mapping.json (AI semantic scan) for feature-to-code coverage.
 */
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Typography, Button, Space, Divider, message, Modal, Input, Splitter, Tooltip, theme, Switch, Drawer, Tag } from 'antd';
import { ExportOutlined, CopyOutlined, ScanOutlined } from '@ant-design/icons';
import { ObjectTable } from '../components/SpecTable';
import { ObjectDetailPanel } from '../components/SpecDetailPanel';
import { MarkdownPreview } from '../components/MarkdownPreview';
import { useObjects } from '../hooks/useSpecs';
import type { ObjectTreeNode, ObjectDetail, ObjectRule, GlobalRule, FeatureMappingIndex, FeatureMappingEntry, MappingChangeEntry, RelatedFile } from '@specbook/shared';

const { Title, Text } = Typography;
const { useToken } = theme;

/** Panel showing mapping-based file matches for the selected object. */
const MappingPanel: React.FC<{
    title: string;
    borderColor: string;
    mapping: FeatureMappingIndex | null;
    selectedObjectId: string | null;
    type: 'impl' | 'test';
}> = React.memo(({ title, borderColor, mapping, selectedObjectId, type }) => {
    const entry = useMemo(() => {
        if (!mapping || !selectedObjectId) return null;
        return mapping.entries.find(e => e.objectId === selectedObjectId) ?? null;
    }, [mapping, selectedObjectId]);

    const files: RelatedFile[] = useMemo(() => {
        if (!entry) return [];
        return type === 'impl' ? entry.implFiles : entry.testFiles;
    }, [entry, type]);

    const icon = type === 'impl' ? '📄' : '🧪';
    const color = type === 'impl' ? '#52c41a' : '#1677ff';

    return (
        <div style={{ height: '100%', borderLeft: `1px solid ${borderColor}`, overflow: 'auto' }}>
            <div style={{ padding: '8px 12px', borderBottom: `1px solid ${borderColor}` }}>
                <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {title} ({files.length})
                </Text>
            </div>
            {!mapping ? (
                <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--ant-color-text-quaternary)', fontSize: 12 }}>
                    Run Scan first
                </div>
            ) : !selectedObjectId ? (
                <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--ant-color-text-quaternary)', fontSize: 12 }}>
                    Select an object
                </div>
            ) : files.length === 0 ? (
                <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--ant-color-text-quaternary)', fontSize: 12 }}>
                    No {title.toLowerCase()} found
                </div>
            ) : (
                files.map(f => (
                    <Tooltip key={f.filePath} title={`${f.filePath}\n${f.description ?? ''}`}>
                        <div
                            style={{
                                cursor: 'pointer', fontSize: 12, color,
                                padding: '4px 12px', transition: 'background 0.15s',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--ant-color-fill-secondary)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            onClick={() => {
                                window.api.openInEditor(f.filePath, f.lineRange?.start).catch((err: any) => {
                                    message.error(err?.message || 'Failed to open file');
                                });
                            }}
                        >
                            {icon} {f.filePath.split('/').pop()}
                            {f.lineRange && (
                                <span style={{ opacity: 0.5, marginLeft: 4 }}>:{f.lineRange.start}</span>
                            )}
                        </div>
                    </Tooltip>
                ))
            )}
            {/* Show summary if entry exists */}
            {entry && entry.summary && (
                <div style={{ padding: '8px 12px', borderTop: `1px solid ${borderColor}` }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>Status: </Text>
                    <Tag color={
                        entry.status === 'implemented' ? 'green' :
                            entry.status === 'partial' ? 'orange' :
                                entry.status === 'not_found' ? 'red' : 'default'
                    }>
                        {entry.status}
                    </Tag>
                </div>
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

    // ─── Mapping state ──────────────────────────────────
    const [mapping, setMapping] = useState<FeatureMappingIndex | null>(null);
    const [scanning, setScanning] = useState(false);

    // Changelog drawer
    const [changelogDrawerOpen, setChangelogDrawerOpen] = useState(false);
    const [changelogDrawerWidth, setChangelogDrawerWidth] = useState(() => Math.round(window.innerWidth * 0.4));
    const changelogDragging = useRef(false);

    const onChangelogDragStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        changelogDragging.current = true;
        const onMove = (ev: MouseEvent) => {
            if (!changelogDragging.current) return;
            const newWidth = Math.max(300, Math.min(window.innerWidth * 0.9, window.innerWidth - ev.clientX));
            setChangelogDrawerWidth(newWidth);
        };
        const onUp = () => {
            changelogDragging.current = false;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }, []);

    // Load mapping on mount
    useEffect(() => {
        if (workspace) {
            window.mappingApi.loadMapping().then(m => {
                if (m) setMapping(m);
            }).catch(() => { /* ignore */ });
        }
    }, [workspace]);

    // Build foundIds from mapping for ObjectTable (coverage badges)
    const foundIds = useMemo(() => {
        if (!mapping) return undefined;
        const ids = new Set<string>();
        for (const entry of mapping.entries) {
            if (entry.status === 'implemented' || entry.status === 'partial') {
                ids.add(entry.objectId.toLowerCase());
            }
        }
        return ids;
    }, [mapping]);

    const handleScan = async () => {
        setScanning(true);
        try {
            const result = await window.mappingApi.scanMapping();
            setMapping(result);
            setChangelogDrawerOpen(true);
            const changes = result.changelog.filter(c => c.changeType !== 'unchanged');
            message.success(`Scan complete — ${result.entries.length} objects mapped, ${changes.length} changes`);
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

    /** Look up mapping entry for a given object id. */
    const findMappingEntry = (objectId: string): FeatureMappingEntry | undefined => {
        return mapping?.entries.find(e => e.objectId === objectId);
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
            const hasMapping = !!mapping;

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
                const mappingEntry = findMappingEntry(node.id);
                const isImplemented = mappingEntry?.status === 'implemented' || mappingEntry?.status === 'partial';
                const statusIcon = hasMapping ? (isImplemented ? '✅' : '❌') : '';

                sections.push(`${indent}${prefix} ${statusIcon} ${node.title}`);
                sections.push(`${indent}- **Object ID**: \`${node.id}\``);
                if (hasMapping && mappingEntry) {
                    sections.push(`${indent}- **Status**: ${mappingEntry.status}`);
                    if (mappingEntry.implFiles.length > 0) {
                        sections.push(`${indent}- **Implementation files**: ${mappingEntry.implFiles.map(f => f.filePath).join(', ')}`);
                    }
                }
                sections.push('');

                // Action instruction based on status
                if (hasMapping && !isImplemented) {
                    sections.push(`${indent}> **ACTION**: Implement this object feature.`);
                    sections.push('');
                } else if (hasMapping && isImplemented) {
                    sections.push(`${indent}> **ACTION**: This object is already implemented. Review and improve if needed.`);
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
                        sections.push(`${indent}- (Rule ID: \`${rule.id}\`) ${rule.text}`);
                    }
                    sections.push('');
                }

                // Test rules
                const testRules: ObjectRule[] = detail?.testRules ?? [];
                if (testRules.length > 0) {
                    sections.push(`${indent}**Test Rules:**`);
                    sections.push('');
                    for (const rule of testRules) {
                        sections.push(`${indent}- (Rule ID: \`${rule.id}\`) ${rule.text}`);
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

    // ─── Changelog helpers ───────────────────────────
    const changelogByType = useMemo(() => {
        if (!mapping) return { added: [], changed: [], removed: [], unchanged: [] };
        const result: Record<string, MappingChangeEntry[]> = { added: [], changed: [], removed: [], unchanged: [] };
        for (const c of mapping.changelog) {
            result[c.changeType]?.push(c);
        }
        return result;
    }, [mapping]);

    const changeTypeConfig = {
        added: { color: '#52c41a', icon: '🟢', label: '新增实现' },
        changed: { color: '#faad14', icon: '🟡', label: '变更' },
        removed: { color: '#ff4d4f', icon: '🔴', label: '已移除' },
        unchanged: { color: '#8c8c8c', icon: '⚪', label: '未变更' },
    };

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
                        <MappingPanel
                            title="Implementations"
                            borderColor={token.colorBorderSecondary}
                            mapping={mapping}
                            selectedObjectId={selectedObjectId}
                            type="impl"
                        />
                    </Splitter.Panel>
                )}
                {showTests && (
                    <Splitter.Panel defaultSize="20%">
                        <MappingPanel
                            title="Tests"
                            borderColor={token.colorBorderSecondary}
                            mapping={mapping}
                            selectedObjectId={selectedObjectId}
                            type="test"
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

            {/* Changelog drawer */}
            <Drawer
                title="Scan Changelog"
                placement="right"
                width={changelogDrawerWidth}
                open={changelogDrawerOpen}
                onClose={() => setChangelogDrawerOpen(false)}
                destroyOnClose
            >
                {/* Drag handle on left edge */}
                <div
                    onMouseDown={onChangelogDragStart}
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
                {mapping && (
                    <div style={{ marginBottom: 16 }}>
                        <Space size={16}>
                            <Text strong>Objects: {mapping.entries.length}</Text>
                            <Text strong>Scanned: {mapping.scannedAt ? new Date(mapping.scannedAt).toLocaleString() : '—'}</Text>
                        </Space>
                    </div>
                )}
                {/* Changelog entries grouped by type */}
                {(['added', 'changed', 'removed', 'unchanged'] as const).map(type => {
                    const entries = changelogByType[type];
                    if (entries.length === 0) return null;
                    const config = changeTypeConfig[type];
                    return (
                        <div key={type} style={{ marginBottom: 16 }}>
                            <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>
                                {config.icon} {config.label} ({entries.length})
                            </Text>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {entries.map(entry => (
                                    <div key={entry.objectId} style={{ padding: '6px 10px', background: token.colorBgTextHover, borderRadius: 6, borderLeft: `3px solid ${config.color}` }}>
                                        <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 2 }}>
                                            {entry.objectTitle}
                                        </Text>
                                        {entry.changeSummary && (
                                            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
                                                {entry.changeSummary}
                                            </Text>
                                        )}
                                        {entry.currentStatus && (
                                            <Tag color={
                                                entry.currentStatus === 'implemented' ? 'green' :
                                                    entry.currentStatus === 'partial' ? 'orange' :
                                                        entry.currentStatus === 'not_found' ? 'red' : 'default'
                                            } style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>
                                                {entry.currentStatus}
                                            </Tag>
                                        )}
                                        {entry.addedFiles.length > 0 && (
                                            <div style={{ marginTop: 4 }}>
                                                <Text type="secondary" style={{ fontSize: 10 }}>+ </Text>
                                                {entry.addedFiles.map(f => (
                                                    <Text
                                                        key={f.filePath}
                                                        code
                                                        style={{ fontSize: 10, cursor: 'pointer', marginRight: 4 }}
                                                        onClick={() => window.api.openInEditor(f.filePath, f.lineRange?.start)}
                                                    >
                                                        {f.filePath.split('/').pop()}
                                                    </Text>
                                                ))}
                                            </div>
                                        )}
                                        {entry.removedFiles.length > 0 && (
                                            <div style={{ marginTop: 2 }}>
                                                <Text type="secondary" style={{ fontSize: 10 }}>- </Text>
                                                {entry.removedFiles.map(f => (
                                                    <Text key={f.filePath} code style={{ fontSize: 10, textDecoration: 'line-through', marginRight: 4 }}>
                                                        {f.filePath.split('/').pop()}
                                                    </Text>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </Drawer>
        </div>
    );
};
