/**
 * View component — inline detail panel with Preview / Edit modes.
 * Preview: renders Markdown (with Mermaid diagrams), shows Edit button.
 * Edit: title / parent / content / actions form, Save with confirmation.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Input, Button, Select, message, Spin, Typography, theme, Modal, Space, Tag, Switch, Tooltip, Collapse, Alert, Popconfirm } from 'antd';
import { SaveOutlined, EditOutlined, EyeOutlined, ExclamationCircleFilled, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ObjectDetail, ObjectTreeNode, UpdateObjectPayload, ObjectAction, ActionType, ObjectRule, ImplementationLocation } from '@specbook/shared';
import { RuleLocationEditor } from './RuleLocationEditor';

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
    onDelete?: (id: string) => void;
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

/** Build the parent path segments for a node (excludes the node itself) */
function getAncestorSegments(nodes: ObjectTreeNode[], targetId: string): string[] {
    const find = (list: ObjectTreeNode[], trail: string[]): string[] | null => {
        for (const n of list) {
            const current = [...trail, n.title];
            if (n.id === targetId) return trail;
            if (n.children) {
                const result = find(n.children, current);
                if (result) return result;
            }
        }
        return null;
    };
    return find(nodes, []) || [];
}

// @specbook-object 019c4d29-f2ed-71df-9e61-2f24045670ed — Display object item detail
export const ObjectDetailPanel: React.FC<ObjectDetailPanelProps> = ({
    specId, specs, onSaved, onDelete,
}) => {
    const { token } = useToken();
    const [modal, contextHolder] = Modal.useModal();
    const [mode, setMode] = useState<PanelMode>('preview');
    const [detail, setDetail] = useState<ObjectDetail | null>(null);
    const [title, setTitle] = useState('');
    const [parentId, setParentId] = useState<string | null>(null);
    const [content, setContent] = useState('');
    const [implLocations, setImplLocations] = useState<ImplementationLocation[]>([]);
    const [implRules, setImplRules] = useState<ObjectRule[]>([]);
    const [testLocations, setTestLocations] = useState<ImplementationLocation[]>([]);
    const [testRules, setTestRules] = useState<ObjectRule[]>([]);

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const parentOptions = useMemo(() => {
        if (!specId) return [];
        const descendants = collectDescendantIds(specs, specId);
        return flattenTree(specs).filter(f => f.id !== specId && !descendants.has(f.id));
    }, [specs, specId]);

    // Load spec detail + actions + impls + tests
    useEffect(() => {
        if (specId) {
            setMode('preview');
            setLoading(true);

            window.api.getObject(specId)
                .then((d) => {
                    setDetail(d);
                    setTitle(d?.title || '');
                    setParentId(d?.parentId || null);
                    setContent(d?.content || '');
                    setImplLocations(d?.implLocations || []);
                    setImplRules(d?.implRules || []);
                    setTestLocations(d?.testLocations || []);
                    setTestRules(d?.testRules || []);
                })
                .catch((err) => { message.error('Failed to load spec detail'); console.error(err); })
                .finally(() => setLoading(false));
        } else {
            setDetail(null); setTitle(''); setParentId(null); setContent(''); setImplLocations([]); setImplRules([]); setTestLocations([]); setTestRules([]);
            setMode('preview');
        }
    }, [specId]);

    const implLocationsChanged = JSON.stringify(implLocations) !== JSON.stringify(detail?.implLocations || []);
    const implRulesChanged = JSON.stringify(implRules) !== JSON.stringify(detail?.implRules || []);
    const testLocationsChanged = JSON.stringify(testLocations) !== JSON.stringify(detail?.testLocations || []);
    const testRulesChanged = JSON.stringify(testRules) !== JSON.stringify(detail?.testRules || []);

    const hasChanges = detail ? (
        title !== (detail.title || '') ||
        parentId !== (detail.parentId || null) ||
        content !== (detail.content || '') ||
        implLocationsChanged ||
        implRulesChanged ||
        testLocationsChanged ||
        testRulesChanged
    ) : false;





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
                    setTitle(detail?.title || '');
                    setParentId(detail?.parentId || null);
                    setContent(detail?.content || '');
                    setImplLocations(detail?.implLocations || []);
                    setImplRules(detail?.implRules || []);
                    setTestLocations(detail?.testLocations || []);
                    setTestRules(detail?.testRules || []);
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
            if (implLocationsChanged) payload.implLocations = implLocations;
            if (implRulesChanged) payload.implRules = implRules;
            if (testLocationsChanged) payload.testLocations = testLocations;
            if (testRulesChanged) payload.testRules = testRules;

            if (payload.title !== undefined || payload.content !== undefined || payload.implLocations !== undefined || payload.implRules !== undefined || payload.testLocations !== undefined || payload.testRules !== undefined) {
                await window.api.updateObject(payload);
            }

            if (parentId !== (detail.parentId || null)) {
                await window.api.moveObject({ id: specId, newParentId: parentId });
            }

            message.success('Saved');
            const updated = await window.api.getObject(specId);
            setDetail(updated);
            setTitle(updated?.title || '');
            setParentId(updated?.parentId || null);
            setContent(updated?.content || '');
            setImplLocations(updated?.implLocations || []);
            setImplRules(updated?.implRules || []);
            setTestLocations(updated?.testLocations || []);
            setTestRules(updated?.testRules || []);
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

    // @specbook-object 019c623a-203d-77ea-8fa3-d37da43714ce — Preview State
    if (mode === 'preview') {
        return (
            <>{contextHolder}
                <div style={{ padding: '16px 20px', height: '100%', overflow: 'auto' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        {/* @specbook-object 019c6231-5a20-7625-9823-3752131ab382 — Display object item title */}
                        <Title level={4} style={{ margin: 0, flex: 1 }}>
                            {detail?.title || 'Untitled'}
                        </Title>
                        <Space>
                            {/* @specbook-object 019c623b-4c7c-7659-bc4e-3227f1c56cd8 — Display edit object item button */}
                            <Tooltip title="Edit">
                                <Button
                                    size="small"
                                    icon={<EditOutlined />}
                                    onClick={enterEdit}
                                />
                            </Tooltip>
                            {onDelete && (
                                <Popconfirm title="Delete this object?" onConfirm={() => onDelete(specId!)}>
                                    <Button size="small" danger icon={<DeleteOutlined />} />
                                </Popconfirm>
                            )}
                        </Space>
                    </div>

                    {/* Meta info */}
                    {/* @specbook-object 019c6238-17e2-722b-9ab3-c3205a54d69e — Display object item parent */}
                    {detail?.parentId && (() => {
                        const segments = getAncestorSegments(specs, specId!);
                        return segments.length > 0 ? (
                            <div style={{ marginBottom: 12 }}>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                    Path:{' '}
                                    {segments.map((seg, i) => (
                                        <React.Fragment key={i}>
                                            {i > 0 && <Text strong style={{ fontSize: 12, margin: '0 6px' }}>/</Text>}
                                            {seg}
                                        </React.Fragment>
                                    ))}
                                </Text>
                            </div>
                        ) : null;
                    })()}

                    {/* Implementation Rules & Locations */}
                    {((detail?.implRules?.length ?? 0) > 0 || (detail?.implLocations?.length ?? 0) > 0) && (
                        <RuleLocationEditor
                            title="Implementation"
                            rules={detail?.implRules || []}
                            locations={detail?.implLocations || []}
                            onRulesChange={() => { }}
                            onLocationsChange={() => { }}
                            editable={false}
                        />
                    )}

                    {/* Test Rules & Locations */}
                    {((detail?.testRules?.length ?? 0) > 0 || (detail?.testLocations?.length ?? 0) > 0) && (
                        <RuleLocationEditor
                            title="Test"
                            rules={detail?.testRules || []}
                            locations={detail?.testLocations || []}
                            onRulesChange={() => { }}
                            onLocationsChange={() => { }}
                            editable={false}
                        />
                    )}

                    {/* Markdown body */}
                    {/* @specbook-object 019c6238-969c-71cb-8e18-b7dbfdcec571 — Display object item content */}
                    <MarkdownPreview content={detail?.content || ''} />


                </div>
            </>
        );
    }

    // ─── Edit mode ───────────────────────────────────

    // @specbook-object 019c623d-5879-77bf-8438-741c6d69c330 — Editing State
    return (
        <div style={{ padding: '16px 20px', height: '100%', overflow: 'auto' }}>
            {contextHolder}
            {/* Header bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <Title level={5} style={{ margin: 0 }}>Edit Object</Title>
                <Space size={8}>
                    {/* @specbook-object 019c625f-881a-72d7-9acd-cd236290faf1 — Display cancel handle */}
                    <Button
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={handleCancel}
                    >
                        Cancel
                    </Button>
                    {/* @specbook-object 019c625f-4fb1-76cf-aa9d-02e82c62ead0 — Display save handle */}
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
                {/* @specbook-object 019c623d-9d64-701d-9348-f95d1fb67cf5 — Display object item title input */}
                <div>
                    <Text type="secondary" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>Title</Text>
                    <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Object title" />
                </div>

                {/* Parent */}
                {/* @specbook-object 019c623d-f5b4-71ff-9c98-3450e93c7f2e — Display object item parent select */}
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

                {/* Implementation Rules & Locations */}
                <RuleLocationEditor
                    title="Implementation"
                    rules={implRules}
                    locations={implLocations}
                    onRulesChange={setImplRules}
                    onLocationsChange={setImplLocations}
                    editable={true}
                />

                {/* Test Rules & Locations */}
                <RuleLocationEditor
                    title="Test"
                    rules={testRules}
                    locations={testLocations}
                    onRulesChange={setTestRules}
                    onLocationsChange={setTestLocations}
                    editable={true}
                />

                {/* Content */}
                {/* @specbook-object 019c623e-9d2e-7326-b23d-fac01937001c — Display object item content textarea */}
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
