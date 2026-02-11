/**
 * View component — inline detail panel with Preview / Edit modes.
 * Preview: renders Markdown (with Mermaid diagrams), shows Edit button.
 * Edit: title / parent / content form, Save with confirmation, Cancel with discard check.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Input, Button, Select, message, Spin, Typography, theme, Modal, Space, Tag } from 'antd';
import { SaveOutlined, EditOutlined, EyeOutlined, ExclamationCircleFilled } from '@ant-design/icons';
import type { SpecDetail, SpecTreeNode, UpdateSpecPayload, SpecType } from '@specbook/shared';
import { SPEC_TYPE_LABELS, SPEC_TYPE_COLORS } from '../constants/specTypes';
import { MarkdownPreview } from './MarkdownPreview';

const { TextArea } = Input;
const { Text, Title } = Typography;
const { useToken } = theme;

type PanelMode = 'preview' | 'edit';

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
    const [modal, contextHolder] = Modal.useModal();
    const [mode, setMode] = useState<PanelMode>('preview');
    const [detail, setDetail] = useState<SpecDetail | null>(null);
    const [title, setTitle] = useState('');
    const [specType, setSpecType] = useState<SpecType>('action_entry');
    const [parentId, setParentId] = useState<string | null>(null);
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const parentOptions = useMemo(() => {
        if (!specId) return [];
        const descendants = collectDescendantIds(specs, specId);
        return flattenTree(specs).filter(f => f.id !== specId && !descendants.has(f.id));
    }, [specs, specId]);

    // Load spec detail
    useEffect(() => {
        if (specId) {
            setMode('preview');
            setLoading(true);
            window.api.getSpec(specId)
                .then((d) => {
                    setDetail(d);
                    setTitle(d?.title || '');
                    setSpecType(d?.type || 'action_entry');
                    setParentId(d?.parentId || null);
                    setContent(d?.content || '');
                })
                .catch((err) => { message.error('Failed to load spec detail'); console.error(err); })
                .finally(() => setLoading(false));
        } else {
            setDetail(null); setTitle(''); setParentId(null); setContent('');
            setMode('preview');
        }
    }, [specId]);

    const hasChanges = detail ? (
        title !== (detail.title || '') ||
        specType !== (detail.type || 'action_entry') ||
        parentId !== (detail.parentId || null) ||
        content !== (detail.content || '')
    ) : false;

    // ─── Actions ─────────────────────────────────────

    const enterEdit = () => setMode('edit');

    const handleCancel = () => {
        if (hasChanges) {
            modal.confirm({
                title: 'Discard changes?',
                icon: <ExclamationCircleFilled />,
                content: 'You have unsaved changes. Are you sure you want to discard them?',
                okText: 'Discard',
                okType: 'danger',
                cancelText: 'Keep editing',
                onOk() {
                    // Reset to original values
                    setTitle(detail?.title || '');
                    setSpecType(detail?.type || 'action_entry');
                    setParentId(detail?.parentId || null);
                    setContent(detail?.content || '');
                    setMode('preview');
                },
            });
        } else {
            setMode('preview');
        }
    };

    const handleSave = async () => {
        if (!specId || !detail) return;
        setSaving(true);
        try {
            const payload: UpdateSpecPayload = { id: specId };
            if (title !== detail.title) payload.title = title;
            if (specType !== detail.type) payload.type = specType;
            if (content !== detail.content) payload.content = content;

            if (payload.title !== undefined || payload.content !== undefined || payload.type !== undefined) {
                await window.api.updateSpec(payload);
            }

            if (parentId !== (detail.parentId || null)) {
                await window.api.moveSpec({ id: specId, newParentId: parentId });
            }

            message.success('Saved');
            // Refresh detail after save
            const updated = await window.api.getSpec(specId);
            setDetail(updated);
            setTitle(updated?.title || '');
            setSpecType(updated?.type || 'action_entry');
            setParentId(updated?.parentId || null);
            setContent(updated?.content || '');
            setMode('preview');
            onSaved();
        } catch (err: any) {
            message.error(err?.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    // ─── Empty state ─────────────────────────────────

    if (!specId) {
        return (
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: '100%', color: token.colorTextQuaternary, fontSize: 13,
            }}>
                {contextHolder}
                Select a spec to view
            </div>
        );
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
                {contextHolder}
                <Spin />
            </div>
        );
    }

    // ─── Preview mode ────────────────────────────────

    if (mode === 'preview') {
        return (
            <>{contextHolder}
                <div style={{ padding: '16px 20px', height: '100%', overflow: 'auto' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <Title level={4} style={{ margin: 0, flex: 1 }}>
                            {detail?.title || 'Untitled'}
                        </Title>
                        <Button
                            size="small"
                            icon={<EditOutlined />}
                            onClick={enterEdit}
                        >
                            Edit
                        </Button>
                    </div>

                    {/* Meta info */}
                    <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                        {detail && (
                            <Tag color={SPEC_TYPE_COLORS[detail.type]}>{SPEC_TYPE_LABELS[detail.type]}</Tag>
                        )}
                        {detail?.parentId && (
                            <Text type="secondary" style={{ fontSize: 12 }}>
                                Parent: {parentOptions.find(p => p.id === detail.parentId)?.label.trim() || detail.parentId}
                            </Text>
                        )}
                    </div>

                    {/* Markdown body */}
                    <MarkdownPreview content={detail?.content || ''} />
                </div>
            </>
        );
    }

    // ─── Edit mode ───────────────────────────────────

    return (
        <div style={{ padding: '16px 20px', height: '100%', overflow: 'auto' }}>
            {contextHolder}
            {/* Header bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <Title level={5} style={{ margin: 0 }}>Edit Spec</Title>
                <Space size={8}>
                    <Button
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={handleCancel}
                    >
                        Cancel
                    </Button>
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
                </Space>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Title */}
                <div>
                    <Text type="secondary" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>Title</Text>
                    <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Spec title" />
                </div>

                {/* Type */}
                <div>
                    <Text type="secondary" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>Type</Text>
                    <Select
                        value={specType}
                        onChange={(val) => setSpecType(val)}
                        style={{ width: '100%' }}
                        options={(
                            Object.entries(SPEC_TYPE_LABELS) as [SpecType, string][]
                        ).map(([value, label]) => ({ value, label }))}
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
                <div style={{ flex: 1 }}>
                    <Text type="secondary" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>Details (Markdown)</Text>
                    <TextArea
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        placeholder="Requirements, acceptance criteria, notes... (supports Markdown)"
                        autoSize={{ minRows: 12 }}
                        style={{ fontSize: 13, fontFamily: 'Menlo, Monaco, Consolas, monospace' }}
                    />
                </div>
            </div>
        </div>
    );
};
