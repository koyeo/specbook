/**
 * View component — inline detail panel with Preview / Edit modes.
 * Preview: renders Markdown (with Mermaid diagrams), shows Edit button.
 * Edit: title / parent / content / actions form, Save with confirmation.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Input, Button, Select, message, Spin, Typography, theme, Modal, Space, Tag, Switch, Tooltip, Collapse, Alert } from 'antd';
import { SaveOutlined, EditOutlined, EyeOutlined, ExclamationCircleFilled, PlusOutlined, DeleteOutlined, RobotOutlined, CloudUploadOutlined } from '@ant-design/icons';
import type { ObjectDetail, ObjectTreeNode, UpdateObjectPayload, ObjectAction, ActionType, ObjectMapping, AnalysisResult, RelatedFile, ObjectRule, ImplementationLocation } from '@specbook/shared';
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

// @specbook-object 019c4d29-f2ed-71df-9e61-2f24045670ed — Display object item detail
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
    const [implLocations, setImplLocations] = useState<ImplementationLocation[]>([]);
    const [implRules, setImplRules] = useState<ObjectRule[]>([]);
    const [testLocations, setTestLocations] = useState<ImplementationLocation[]>([]);
    const [testRules, setTestRules] = useState<ObjectRule[]>([]);

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

    const [savingResults, setSavingResults] = useState(false);

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
            setAnalysisResult(null);
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

    // ─── Save AI Results to Impl/Test ─────────────────

    /** Classify a file as impl or test using AI-provided type with filename fallback. */
    const classifyFile = (f: RelatedFile): 'impl' | 'test' => {
        if (f.type === 'impl' || f.type === 'test') return f.type;
        const fp = f.filePath.toLowerCase();
        if (/\.(test|spec)\./i.test(fp) || /\/__tests__\//i.test(fp) || /\/test\//i.test(fp)) return 'test';
        return 'impl';
    };

    /** Flatten all nodes in the object tree. */
    const flattenAllNodes = (nodes: ObjectTreeNode[]): ObjectTreeNode[] => {
        const result: ObjectTreeNode[] = [];
        for (const n of nodes) {
            result.push(n);
            if (n.children) result.push(...flattenAllNodes(n.children));
        }
        return result;
    };

    /** Match an object node by title (case-insensitive, trimmed, includes-fallback). */
    const matchNodeByTitle = (nodes: ObjectTreeNode[], title: string): ObjectTreeNode | undefined => {
        const t = title.trim().toLowerCase();
        return nodes.find(n => n.title.trim().toLowerCase() === t)
            || nodes.find(n => n.title.trim().toLowerCase().includes(t) || t.includes(n.title.trim().toLowerCase()));
    };

    const handleSaveResults = async () => {
        if (!analysisResult || !specId) return;
        setSavingResults(true);
        try {
            const allNodes = flattenAllNodes(specs);
            let savedCount = 0;
            console.log('[SaveResults] Total mappings:', analysisResult.mappings.length, 'Total nodes:', allNodes.length);
            for (const mapping of analysisResult.mappings) {
                // Find the matching object by title (fuzzy)
                const matchNode = matchNodeByTitle(allNodes, mapping.objectTitle);
                const targetId = mapping.objectId || matchNode?.id;
                console.log('[SaveResults] mapping:', mapping.objectTitle, '→ targetId:', targetId, ', files:', mapping.relatedFiles.length);
                if (!targetId || mapping.relatedFiles.length === 0) continue;

                const implList = mapping.relatedFiles.filter(f => classifyFile(f) === 'impl');
                const testList = mapping.relatedFiles.filter(f => classifyFile(f) === 'test');

                console.log('[SaveResults]   impl:', implList.length, 'test:', testList.length);
                if (implList.length > 0) await window.api.saveImpls(targetId, implList, mapping.summary);
                if (testList.length > 0) await window.api.saveTests(targetId, testList);
                savedCount++;
            }
            message.success(`Saved results for ${savedCount} object(s)`);
            onSaved();
        } catch (err: any) {
            message.error(err?.message || 'Failed to save results');
        } finally {
            setSavingResults(false);
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
                        <Space size={8}>
                            <Button
                                size="small"
                                icon={<RobotOutlined />}
                                onClick={handleAnalyze}
                                loading={analyzing}
                            >
                                AI Analyze
                            </Button>
                            {/* @specbook-object 019c623b-4c7c-7659-bc4e-3227f1c56cd8 — Display edit object item button */}
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
                    {/* @specbook-object 019c6238-17e2-722b-9ab3-c3205a54d69e — Display object item parent */}
                    <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                        {detail?.parentId && (
                            <Text type="secondary" style={{ fontSize: 12 }}>
                                Parent: {parentOptions.find(p => p.id === detail.parentId)?.label.trim() || detail.parentId}
                            </Text>
                        )}
                    </div>

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

                    {/* AI Analysis results */}
                    {analysisResult && (
                        <div style={{ marginTop: 20 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <Text strong style={{ fontSize: 13 }}>🤖 AI Analysis</Text>
                                <Space size={8}>
                                    <Text type="secondary" style={{ fontSize: 11 }}>
                                        {analysisResult.tokenUsage.inputTokens} in / {analysisResult.tokenUsage.outputTokens} out tokens
                                    </Text>
                                    <Button
                                        size="small"
                                        type="primary"
                                        icon={<CloudUploadOutlined />}
                                        onClick={handleSaveResults}
                                        loading={savingResults}
                                    >
                                        Save Results
                                    </Button>
                                </Space>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {analysisResult.mappings.map((m) => (
                                    <div key={m.objectId || m.objectTitle} style={{
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
                                                        {classifyFile(f) === 'test' ? '🧪' : '📄'} <Text code style={{ fontSize: 11 }}>{f.filePath}</Text>
                                                        {f.lineRange && <Text type="secondary" style={{ fontSize: 11 }}> L{f.lineRange.start}-{f.lineRange.end}</Text>}
                                                        {f.description && <Text type="secondary" style={{ fontSize: 11 }}> — {f.description}</Text>}
                                                        <Tag style={{ fontSize: 9, marginLeft: 4 }} color={classifyFile(f) === 'test' ? 'blue' : 'green'}>{classifyFile(f)}</Tag>
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
