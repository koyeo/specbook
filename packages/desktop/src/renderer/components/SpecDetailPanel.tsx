/**
 * View component — inline detail panel for editing spec fields.
 * Replaces Drawer: sits in the right pane of a Splitter layout.
 * Edits: title, parent, content.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Input, Button, Select, message, Spin, Typography, theme } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import type { SpecDetail, SpecTreeNode, UpdateSpecPayload } from '@specbook/shared';

const { TextArea } = Input;
const { Text, Title } = Typography;
const { useToken } = theme;

interface SpecDetailPanelProps {
    specId: string | null;
    specs: SpecTreeNode[];
    onSaved: () => void;
}

function flattenTree(nodes: SpecTreeNode[], depth = 0): { id: string; label: string }[] {
    const r: { id: string; label: string }[] = [];
    for (const n of nodes) {
        r.push({ id: n.id, label: '\u00A0\u00A0'.repeat(depth) + n.title });
        if (n.children) r.push(...flattenTree(n.children, depth + 1));
    }
    return r;
}

function collectDescendantIds(nodes: SpecTreeNode[], id: string): Set<string> {
    const result = new Set<string>();
    const findAndCollect = (list: SpecTreeNode[]): boolean => {
        for (const n of list) {
            if (n.id === id) {
                const walk = (children: SpecTreeNode[]) => {
                    for (const c of children) { result.add(c.id); if (c.children) walk(c.children); }
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

export const SpecDetailPanel: React.FC<SpecDetailPanelProps> = ({
    specId, specs, onSaved,
}) => {
    const { token } = useToken();
    const [detail, setDetail] = useState<SpecDetail | null>(null);
    const [title, setTitle] = useState('');
    const [parentId, setParentId] = useState<string | null>(null);
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const parentOptions = useMemo(() => {
        if (!specId) return [];
        const descendants = collectDescendantIds(specs, specId);
        return flattenTree(specs).filter(f => f.id !== specId && !descendants.has(f.id));
    }, [specs, specId]);

    useEffect(() => {
        if (specId) {
            setLoading(true);
            window.api.getSpec(specId)
                .then((d) => {
                    setDetail(d);
                    setTitle(d?.title || '');
                    setParentId(d?.parentId || null);
                    setContent(d?.content || '');
                })
                .catch((err) => { message.error('Failed to load spec detail'); console.error(err); })
                .finally(() => setLoading(false));
        } else {
            setDetail(null); setTitle(''); setParentId(null); setContent('');
        }
    }, [specId]);

    const hasChanges = detail ? (
        title !== (detail.title || '') ||
        parentId !== (detail.parentId || null) ||
        content !== (detail.content || '')
    ) : false;

    const handleSave = async () => {
        if (!specId || !detail) return;
        setSaving(true);
        try {
            const payload: UpdateSpecPayload = { id: specId };
            if (title !== detail.title) payload.title = title;
            if (content !== detail.content) payload.content = content;

            if (payload.title || payload.content !== undefined) {
                await window.api.updateSpec(payload);
            }

            if (parentId !== (detail.parentId || null)) {
                await window.api.moveSpec({ id: specId, newParentId: parentId });
            }

            message.success('Saved');
            onSaved();
        } catch (err: any) {
            message.error(err?.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    // Empty state — no spec selected
    if (!specId) {
        return (
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: '100%', color: token.colorTextQuaternary, fontSize: 13,
            }}>
                Select a spec to edit
            </div>
        );
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
                <Spin />
            </div>
        );
    }

    return (
        <div style={{ padding: '16px 20px', height: '100%', overflow: 'auto' }}>
            {/* Header bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <Title level={5} style={{ margin: 0 }}>Edit Spec</Title>
                <Button
                    type="primary"
                    size="small"
                    icon={<SaveOutlined />}
                    onClick={handleSave}
                    loading={saving}
                    disabled={!hasChanges}
                >
                    Save
                </Button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Title */}
                <div>
                    <Text type="secondary" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>Title</Text>
                    <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Spec title" />
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
                <div style={{ flex: 1 }}>
                    <Text type="secondary" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>Details</Text>
                    <TextArea
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        placeholder="Requirements, acceptance criteria, notes..."
                        autoSize={{ minRows: 12 }}
                        style={{ fontSize: 13 }}
                    />
                </div>
            </div>
        </div>
    );
};
