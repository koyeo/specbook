/**
 * View component — Drawer for editing spec fields.
 * Edits: title, parent, content.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Drawer, Input, Button, Select, message, Spin, Typography } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import type { SpecDetail, SpecTreeNode, UpdateSpecPayload } from '@specbook/shared';

const { TextArea } = Input;
const { Text } = Typography;

interface SpecDetailDrawerProps {
    specId: string | null;
    open: boolean;
    specs: SpecTreeNode[];
    onClose: () => void;
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

export const SpecDetailDrawer: React.FC<SpecDetailDrawerProps> = ({
    specId, open, specs, onClose, onSaved,
}) => {
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
        if (open && specId) {
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
    }, [open, specId]);

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
            onClose();
        } catch (err: any) {
            message.error(err?.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Drawer title="Edit Spec" open={open} onClose={onClose} width={560}
            extra={<Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving} disabled={!hasChanges}>Save</Button>}>
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}><Spin /></div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                        <Text type="secondary" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>Title</Text>
                        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Spec title" />
                    </div>
                    <div>
                        <Text type="secondary" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>Parent</Text>
                        <Select value={parentId} onChange={(val) => setParentId(val || null)}
                            style={{ width: '100%' }} allowClear showSearch placeholder="Root level (no parent)"
                            options={parentOptions.map(p => ({ value: p.id, label: p.label }))}
                            filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())} />
                    </div>
                    <div>
                        <Text type="secondary" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>Details</Text>
                        <TextArea value={content} onChange={e => setContent(e.target.value)}
                            placeholder="Requirements, acceptance criteria, notes..."
                            autoSize={{ minRows: 8 }} style={{ fontSize: 13 }} />
                    </div>
                </div>
            )}
        </Drawer>
    );
};
