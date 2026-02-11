/**
 * View component — inline detail panel with Preview / Edit modes.
 * Preview: renders Markdown (with Mermaid diagrams), shows Edit button.
 * Edit: title / parent / content / actions form, Save with confirmation.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Input, Button, Select, message, Spin, Typography, theme, Modal, Space, Tag, Switch, Tooltip, Collapse, Alert } from 'antd';
import { SaveOutlined, EditOutlined, EyeOutlined, ExclamationCircleFilled, PlusOutlined, DeleteOutlined, RobotOutlined } from '@ant-design/icons';
import type { ObjectDetail, ObjectTreeNode, UpdateObjectPayload, ObjectAction, ActionType, ObjectMapping, AnalysisResult } from '@specbook/shared';

/** Action types — local copy to avoid CJS/ESM mismatch with @specbook/shared */
const ACTION_TYPES: readonly ActionType[] = [
    'Click', 'Double Click', 'Mouse Enter', 'Mouse Leave',
    'Mouse Down', 'Mouse Up', 'Right Click', 'Press and Drag',
];
import { MarkdownPreview } from './MarkdownPreview';

const { TextArea } = Input;
const { Text, Title } = Typography;
const { useToken } = theme;
const ACTION_ENTRY_COLOR = '#1677ff';

type PanelMode = 'preview' | 'edit';

interface ObjectDetailPanelProps {
    specId: string | null;
    specs: ObjectTreeNode[];
    onSaved: () => void;
}

function flattenTree(nodes: ObjectTreeNode[], depth = 0): { id: string; label: string }[] {
    const r: { id: string; label: string }[] = [];
    for (const n of nodes) {
        r.push({ id: n.id, label: '\u00A0\u00A0'.repeat(depth) + n.title });
        if (n.children) r.push(...flattenTree(n.children, depth + 1));
    }
    return r;
}

function collectDescendantIds(nodes: ObjectTreeNode[], id: string): Set<string> {
    const result = new Set<string>();
    const findAndCollect = (list: ObjectTreeNode[]): boolean => {
        for (const n of list) {
            if (n.id === id) {
                const walk = (children: ObjectTreeNode[]) => {
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

const actionTypeOptions = ACTION_TYPES.map(t => ({ value: t, label: t }));

export const ObjectDetailPanel: React.FC<ObjectDetailPanelProps> = ({
    specId, specs, onSaved,
}) => {
    const { token } = useToken();
    const [modal, contextHolder] = Modal.useModal();
    const [mode, setMode] = useState<PanelMode>('preview');
    const [detail, setDetail] = useState<ObjectDetail | null>(null);
    const [title, setTitle] = useState('');
    const [parentId, setParentId] = useState<string | null>(null);
    const [content, setContent] = useState('');
    const [actions, setActions] = useState<ObjectAction[]>([]);
    const [savedActions, setSavedActions] = useState<ObjectAction[]>([]);
    const [isState, setIsState] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

    const parentOptions = useMemo(() => {
        if (!specId) return [];
        const descendants = collectDescendantIds(specs, specId);
        return flattenTree(specs).filter(f => f.id !== specId && !descendants.has(f.id));
    }, [specs, specId]);

    // Load spec detail + actions
    useEffect(() => {
        if (specId) {
            setMode('preview');
            setLoading(true);
            Promise.all([
                window.api.getObject(specId),
                window.api.loadActions(specId),
            ])
                .then(([d, acts]) => {
                    setDetail(d);
                    setTitle(d?.title || '');
                    setParentId(d?.parentId || null);
                    setContent(d?.content || '');
                    setActions(acts);
                    setSavedActions(acts);
                    setIsState(d?.isState ?? false);
                })
                .catch((err) => { message.error('Failed to load spec detail'); console.error(err); })
                .finally(() => setLoading(false));
        } else {
            setDetail(null); setTitle(''); setParentId(null); setContent('');
            setActions([]); setSavedActions([]); setIsState(false);
            setMode('preview');
        }
    }, [specId]);

    const actionsChanged = JSON.stringify(actions) !== JSON.stringify(savedActions);

    const hasChanges = detail ? (
        title !== (detail.title || '') ||
        parentId !== (detail.parentId || null) ||
        content !== (detail.content || '') ||
        isState !== (detail.isState ?? false) ||
        actionsChanged
    ) : false;

    // ─── Actions ─────────────────────────────────────

    const addAction = () => {
        setActions(prev => [...prev, { action: 'Click' as ActionType, stateChange: '' }]);
    };

    const updateAction = (index: number, field: keyof ObjectAction, value: string) => {
        setActions(prev => {
            const copy = [...prev];
            copy[index] = { ...copy[index], [field]: value };
            return copy;
        });
    };

    const removeAction = (index: number) => {
        setActions(prev => prev.filter((_, i) => i !== index));
    };

    const enterEdit = () => setMode('edit');

    // ─── AI Analyze ──────────────────────────────────

    const findSubtree = (nodes: ObjectTreeNode[], id: string): ObjectTreeNode | null => {
        for (const n of nodes) {
            if (n.id === id) return n;
            if (n.children) {
                const found = findSubtree(n.children, id);
                if (found) return found;
            }
        }
        return null;
    };

    const handleAnalyze = async () => {
        if (!specId) return;
        setAnalyzing(true);
        setAnalysisResult(null);
        try {
            const subtree = findSubtree(specs, specId);
            const tree = subtree ? [subtree] : [];
            const result = await window.aiApi.analyzeObjects(tree);
            setAnalysisResult(result);
            message.success(`Analysis complete (${result.tokenUsage.inputTokens + result.tokenUsage.outputTokens} tokens)`);
        } catch (err: any) {
            message.error(err?.message || 'AI analysis failed');
        } finally {
            setAnalyzing(false);
        }
    };

    const statusColor: Record<string, string> = {
        implemented: 'green',
        partial: 'orange',
        not_found: 'red',
        unknown: 'default',
    };

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
                    setTitle(detail?.title || '');
                    setParentId(detail?.parentId || null);
                    setContent(detail?.content || '');
                    setActions(savedActions);
                    setIsState(detail?.isState ?? false);
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
            const payload: UpdateObjectPayload = { id: specId };
            if (title !== detail.title) payload.title = title;
            if (content !== detail.content) payload.content = content;
            if (isState !== (detail.isState ?? false)) payload.isState = isState;

            if (payload.title !== undefined || payload.content !== undefined || payload.isState !== undefined) {
                await window.api.updateObject(payload);
            }

            if (parentId !== (detail.parentId || null)) {
                await window.api.moveObject({ id: specId, newParentId: parentId });
            }

            if (actionsChanged) {
                await window.api.saveActions(specId, actions);
                setSavedActions(actions);
            }

            message.success('Saved');
            const updated = await window.api.getObject(specId);
            setDetail(updated);
            setTitle(updated?.title || '');
            setParentId(updated?.parentId || null);
            setContent(updated?.content || '');
            setIsState(updated?.isState ?? false);
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
                Select an object to view
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
                        <Space size={8}>
                            <Button
                                size="small"
                                icon={<RobotOutlined />}
                                onClick={handleAnalyze}
                                loading={analyzing}
                            >
                                AI Analyze
                            </Button>
                            <Button
                                size="small"
                                icon={<EditOutlined />}
                                onClick={enterEdit}
                            >
                                Edit
                            </Button>
                        </Space>
                    </div>

                    {/* Meta info */}
                    <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                        {detail?.parentId && (
                            <Text type="secondary" style={{ fontSize: 12 }}>
                                Parent: {parentOptions.find(p => p.id === detail.parentId)?.label.trim() || detail.parentId}
                            </Text>
                        )}
                        {savedActions.length > 0 && (
                            <Tooltip title="Action Entry">
                                <span style={{
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    width: 18, height: 18, borderRadius: 3, fontSize: 11, fontWeight: 600,
                                    backgroundColor: 'rgba(22, 119, 255, 0.12)', color: '#0958d9', cursor: 'default',
                                }}>A</span>
                            </Tooltip>
                        )}
                        {detail?.isState && (
                            <Tooltip title="State Object">
                                <span style={{
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    width: 18, height: 18, borderRadius: 3, fontSize: 11, fontWeight: 600,
                                    backgroundColor: 'rgba(250, 140, 22, 0.12)', color: '#d48806', cursor: 'default',
                                }}>S</span>
                            </Tooltip>
                        )}
                    </div>

                    {/* Actions preview */}
                    {savedActions.length > 0 && (
                        <div style={{ marginBottom: 20 }}>
                            <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>Actions</Text>
                            <div style={{
                                border: `1px solid ${token.colorBorderSecondary}`,
                                borderRadius: token.borderRadius,
                                overflow: 'hidden',
                            }}>
                                <div style={{
                                    display: 'grid', gridTemplateColumns: '160px 1fr',
                                    padding: '6px 12px',
                                    background: token.colorFillQuaternary,
                                    fontWeight: 500, fontSize: 12, color: token.colorTextSecondary,
                                }}>
                                    <span>Action</span>
                                    <span>State Change</span>
                                </div>
                                {savedActions.map((a, i) => (
                                    <div key={i} style={{
                                        display: 'grid', gridTemplateColumns: '160px 1fr',
                                        padding: '6px 12px', fontSize: 13,
                                        borderTop: `1px solid ${token.colorBorderSecondary}`,
                                    }}>
                                        <span>{a.action}</span>
                                        <span style={{ color: a.stateChange ? undefined : token.colorTextQuaternary }}>
                                            {a.stateChange || '—'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Markdown body */}
                    <MarkdownPreview content={detail?.content || ''} />

                    {/* AI Analysis results */}
                    {analysisResult && (
                        <div style={{ marginTop: 20 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <Text strong style={{ fontSize: 13 }}>🤖 AI Analysis</Text>
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                    {analysisResult.tokenUsage.inputTokens} in / {analysisResult.tokenUsage.outputTokens} out tokens
                                </Text>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {analysisResult.mappings.map((m) => (
                                    <div key={m.objectId} style={{
                                        border: `1px solid ${token.colorBorderSecondary}`,
                                        borderRadius: token.borderRadius,
                                        padding: '10px 14px',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                            <Tag color={statusColor[m.status] || 'default'}>{m.status.toUpperCase()}</Tag>
                                            <Text strong style={{ fontSize: 13 }}>{m.objectTitle}</Text>
                                        </div>
                                        <Text style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>{m.summary}</Text>
                                        {m.relatedFiles.length > 0 && (
                                            <div style={{ fontSize: 12, color: token.colorTextSecondary }}>
                                                {m.relatedFiles.map((f, i) => (
                                                    <div key={i} style={{ marginLeft: 8, marginBottom: 2 }}>
                                                        📄 <Text code style={{ fontSize: 11 }}>{f.filePath}</Text>
                                                        {f.lineRange && <Text type="secondary" style={{ fontSize: 11 }}> L{f.lineRange.start}-{f.lineRange.end}</Text>}
                                                        {f.description && <Text type="secondary" style={{ fontSize: 11 }}> — {f.description}</Text>}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
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
                <Title level={5} style={{ margin: 0 }}>Edit Object</Title>
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
                    <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Object title" />
                </div>

                {/* Stateful toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Switch size="small" checked={isState} onChange={setIsState} />
                    <Text style={{ fontSize: 13 }}>State Object</Text>
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

                {/* Actions editor */}
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>Actions</Text>
                        <Button
                            size="small"
                            type="dashed"
                            icon={<PlusOutlined />}
                            onClick={addAction}
                        >
                            Add Action
                        </Button>
                    </div>

                    {actions.length === 0 ? (
                        <Text type="secondary" style={{ fontSize: 12, fontStyle: 'italic' }}>
                            No actions defined. Click "Add Action" to describe interactions.
                        </Text>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {actions.map((a, i) => (
                                <div key={i} style={{
                                    display: 'flex', gap: 8, alignItems: 'center',
                                    padding: '8px 10px',
                                    borderRadius: token.borderRadius,
                                    border: `1px solid ${token.colorBorderSecondary}`,
                                    background: token.colorFillQuaternary,
                                }}>
                                    <Select
                                        value={a.action}
                                        onChange={(val) => updateAction(i, 'action', val)}
                                        style={{ width: 160, flexShrink: 0 }}
                                        options={actionTypeOptions}
                                        size="small"
                                    />
                                    <Input
                                        value={a.stateChange}
                                        onChange={(e) => updateAction(i, 'stateChange', e.target.value)}
                                        placeholder="State change description..."
                                        size="small"
                                        style={{ flex: 1 }}
                                    />
                                    <Button
                                        type="text"
                                        danger
                                        size="small"
                                        icon={<DeleteOutlined />}
                                        onClick={() => removeAction(i)}
                                        style={{ flexShrink: 0 }}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Content */}
                <div style={{ flex: 1 }}>
                    <Text type="secondary" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>Details (Markdown)</Text>
                    <TextArea
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        placeholder="Requirements, acceptance criteria, notes... (supports Markdown)"
                        autoSize={{ minRows: 8 }}
                        style={{ fontSize: 13, fontFamily: 'Menlo, Monaco, Consolas, monospace' }}
                    />
                </div>
            </div>
        </div >
    );
};
