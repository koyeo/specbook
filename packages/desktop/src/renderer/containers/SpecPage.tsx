/**
 * Container component — VS Code-like layout.
 * Left: object tree | Right: detail panel
 *
 * Pure features editing — no scan/mapping concerns.
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Typography, Button, Space, Divider, message, Modal, Input, Splitter, Drawer, theme } from 'antd';
import { ExportOutlined, CopyOutlined } from '@ant-design/icons';
import { ObjectTable } from '../components/SpecTable';
import { ObjectDetailPanel } from '../components/SpecDetailPanel';
import { MarkdownPreview } from '../components/MarkdownPreview';
import { useObjects } from '../hooks/useSpecs';
import type { ObjectTreeNode, ObjectDetail, ObjectRule, GlobalRule } from '@specbook/shared';

const { Title, Text } = Typography;
const { useToken } = theme;

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
    const handleSaved = () => { loadObjects(); };

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

                sections.push(`${indent}${prefix} ${node.title}`);
                sections.push(`${indent}- **Object ID**: \`${node.id}\``);
                sections.push('');

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

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
            {/* Top bar */}
            <div style={{ flexShrink: 0, marginBottom: 8 }}>
                <Space style={{ width: '100%', justifyContent: 'space-between' }} align="center">
                    <Title level={4} style={{ margin: 0 }}>Specifications</Title>
                    <Space size={12}>
                        <Button size="small" icon={<ExportOutlined />} onClick={handleExport}>Export</Button>
                    </Space>
                </Space>
                <Divider style={{ margin: '8px 0' }} />
            </div>

            {/* Splitter: tree | detail */}
            <Splitter style={{ flex: 1, minHeight: 0 }}>
                <Splitter.Panel defaultSize="40%" min="200px" max="60%">
                    <div style={{ height: '100%', overflow: 'auto', paddingRight: 4 }}>
                        <ObjectTable
                            objects={objects} loading={loading}
                            onDelete={handleDelete} onOpen={handleOpen}
                            onAddSibling={handleAddSibling} onAddChild={handleAddChild} onAddRoot={handleAddRoot}
                            onBatchDelete={handleBatchDelete} onBatchMove={handleBatchMove}
                            onGeneratePrompt={handleGeneratePrompt}
                        />
                    </div>
                </Splitter.Panel>
                <Splitter.Panel>
                    <div style={{
                        height: '100%',
                        borderLeft: `1px solid ${token.colorBorderSecondary}`,
                        overflow: 'auto',
                    }}>
                        <ObjectDetailPanel specId={selectedObjectId} specs={objects} onSaved={handleSaved} />
                    </div>
                </Splitter.Panel>
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
                        position: 'absolute', top: 0, left: 0, width: 6,
                        height: '100%', cursor: 'col-resize', zIndex: 10,
                    }}
                />
                <MarkdownPreview content={promptText} />
            </Drawer>
        </div>
    );
};
