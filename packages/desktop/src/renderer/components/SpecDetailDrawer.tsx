/**
 * View component — Drawer for editing all spec fields.
 * Edits: title, context, parent, content.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Drawer, Input, Button, Select, message, Spin, Space, Typography } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import type { SpecDetail, SpecTreeNode, UpdateSpecPayload, MoveSpecPayload } from '@specbook/shared';

const { TextArea } = Input;
const { Text } = Typography;

interface SpecDetailDrawerProps {
    specId: string | null;
    open: boolean;
    specs: SpecTreeNode[];
    onClose: () => void;
    onSaved: () => void;
}

/** Flatten tree to list with labels showing hierarchy. */
function flattenTree(nodes: SpecTreeNode[], depth = 0): { id: string; label: string }[] {
    const result: { id: string; label: string }[] = [];
    for (const n of nodes) {
        result.push({ id: n.id, label: '  '.repeat(depth) + n.title });
        if (n.children) result.push(...flattenTree(n.children, depth + 1));
    }
    return result;
}

/** Collect all descendant IDs of a node. */
function collectDescendantIds(nodes: SpecTreeNode[], id: string): Set<string> {
    const result = new Set<string>();
    const findAndCollect = (list: SpecTreeNode[]): boolean => {
        for (const n of list) {
            if (n.id === id) {
                const walk = (children: SpecTreeNode[]) => {
                    for (const c of children) {
                        result.add(c.id);
                        if (c.children) walk(c.children);
                    }
                };
                if (n.children) walk(n.children);
                return true;
            }
            if (n.children && findAndCollect(n.children)) return true;
        }
        return false;
    };
    findAndCollect(nodes);
    return result;
}

/** Collect unique contexts from tree. */
function collectContexts(nodes: SpecTreeNode[]): string[] {
    const set = new Set<string>();
    const walk = (list: SpecTreeNode[]) => {
        for (const n of list) {
            if (n.context) set.add(n.context);
            if (n.children) walk(n.children);
        }
    };
    walk(nodes);
    return [...set].sort();
}

export const SpecDetailDrawer: React.FC<SpecDetailDrawerProps> = ({
    specId,
    open,
    specs,
    onClose,
    onSaved,
}) => {
    const [detail, setDetail] = useState<SpecDetail | null>(null);
    const [title, setTitle] = useState('');
    const [context, setContext] = useState('');
    const [parentId, setParentId] = useState<string | null>(null);
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Existing contexts for autocomplete
    const existingContexts = useMemo(() => collectContexts(specs), [specs]);

    // Parent options: all specs except self and descendants
    const parentOptions = useMemo(() => {
        if (!specId) return [];
        const descendants = collectDescendantIds(specs, specId);
        const flat = flattenTree(specs);
        return flat.filter(f => f.id !== specId && !descendants.has(f.id));
    }, [specs, specId]);

    // Load detail when opened
    useEffect(() => {
        if (open && specId) {
            setLoading(true);
            window.api.getSpec(specId)
                .then((d) => {
                    setDetail(d);
                    setTitle(d?.title || '');
                    setContext(d?.context || '');
                    setParentId(d?.parentId || null);
                    setContent(d?.content || '');
                })
                .catch((err) => {
                    message.error('Failed to load spec detail');
                    console.error(err);
                })
                .finally(() => setLoading(false));
        } else {
            setDetail(null);
            setTitle('');
            setContext('');
            setParentId(null);
            setContent('');
        }
    }, [open, specId]);

    const hasChanges = detail ? (
        title !== (detail.title || '') ||
        context !== (detail.context || '') ||
        parentId !== (detail.parentId || null) ||
        content !== (detail.content || '')
    ) : false;

    const handleSave = async () => {
        if (!specId || !detail) return;
        setSaving(true);
        try {
            // Update title/context/content via updateSpec
            const payload: UpdateSpecPayload = { id: specId };
            if (title !== detail.title) payload.title = title;
            if (context !== detail.context) payload.context = context;
            if (content !== detail.content) payload.content = content;

            const hasFieldChanges = payload.title || payload.context || payload.content !== undefined;
            if (hasFieldChanges) {
                await window.api.updateSpec(payload);
            }

            // Move parent if changed
            if (parentId !== (detail.parentId || null)) {
                await window.api.moveSpec({ id: specId, newParentId: parentId });
            }

            message.success('Saved');
            onSaved();
            onClose();
        } catch (err: any) {
            message.error(err?.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Drawer
            title="Edit Spec"
            open={open}
            onClose={onClose}
            width={560}
            extra={
                <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    onClick={handleSave}
                    loading={saving}
                    disabled={!hasChanges}
                >
                    Save
                </Button>
            }
        >
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}>
                    <Spin />
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Title */}
                    <div>
                        <Text type="secondary" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>Title</Text>
                        <Input
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="Spec title"
                        />
                    </div>

                    {/* Context */}
                    <div>
                        <Text type="secondary" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>Context</Text>
                        <Select
                            value={context}
                            onChange={setContext}
                            style={{ width: '100%' }}
                            showSearch
                            allowClear={false}
                            options={existingContexts.map(c => ({ value: c, label: c }))}
                            placeholder="Select or type context..."
                            dropdownRender={(menu) => (
                                <>
                                    {menu}
                                    <div style={{ padding: '4px 8px', fontSize: 11, color: '#999' }}>
                                        Type to add a new context
                                    </div>
                                </>
                            )}
                            filterOption={(input, option) =>
                                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                            }
                            // Allow custom value by making it a tags-like input
                            mode={undefined}
                            onSearch={() => { }}
                        />
                    </div>

                    {/* Parent */}
                    <div>
                        <Text type="secondary" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>Parent</Text>
                        <Select
                            value={parentId}
                            onChange={(val) => setParentId(val || null)}
                            style={{ width: '100%' }}
                            allowClear
                            showSearch
                            placeholder="Root level (no parent)"
                            options={parentOptions.map(p => ({ value: p.id, label: p.label }))}
                            filterOption={(input, option) =>
                                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                            }
                        />
                    </div>

                    {/* Content */}
                    <div>
                        <Text type="secondary" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>Details</Text>
                        <TextArea
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            placeholder="Requirements, acceptance criteria, notes..."
                            autoSize={{ minRows: 8 }}
                            style={{ fontSize: 13 }}
                        />
                    </div>
                </div>
            )}
        </Drawer>
    );
};
