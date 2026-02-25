/**
 * GlobalTestsPage — test list on left, detail with RuleLocationEditor on right.
 * Edit mode includes title, description, AND rules/locations editing.
 */
import React, { useEffect, useState, useMemo } from 'react';
import {
    Typography, Button, Space, Input, List, Empty,
    Splitter, theme, Popconfirm, message, Tooltip, Divider,
} from 'antd';
import {
    PlusOutlined, DeleteOutlined, EditOutlined, SearchOutlined,
    CheckOutlined, CloseOutlined,
} from '@ant-design/icons';
import { useGlobalTests } from '../hooks/useGlobalTests';
import { RuleLocationEditor } from '../components/RuleLocationEditor';
import type { GlobalTest, ObjectRule, ImplementationLocation } from '@specbook/shared';

const { Title, Text, Paragraph } = Typography;
const { useToken } = theme;
const { TextArea } = Input;

interface GlobalTestsPageProps {
    workspace: string | null;
}

export const GlobalTestsPage: React.FC<GlobalTestsPageProps> = ({ workspace }) => {
    const { token } = useToken();
    const { tests, loading, loadTests, addTest, updateTest, deleteTest } = useGlobalTests();
    const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
    const [search, setSearch] = useState('');

    // Test inline edit state
    const [editingTest, setEditingTest] = useState(false);
    const [isAddingTest, setIsAddingTest] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editRules, setEditRules] = useState<ObjectRule[]>([]);
    const [editLocations, setEditLocations] = useState<ImplementationLocation[]>([]);

    useEffect(() => {
        if (workspace) loadTests();
    }, [workspace, loadTests]);

    const filteredTests = useMemo(() => {
        if (!search.trim()) return tests;
        const q = search.toLowerCase();
        return tests.filter(t =>
            t.title.toLowerCase().includes(q) ||
            t.description.toLowerCase().includes(q)
        );
    }, [tests, search]);

    const selectedTest = useMemo(() => {
        return tests.find(t => t.id === selectedTestId) ?? null;
    }, [tests, selectedTestId]);

    // ─── Test CRUD ────────────────────────────────────

    const handleStartAddTest = () => {
        setIsAddingTest(true);
        setEditingTest(true);
        setSelectedTestId(null);
        setEditTitle('');
        setEditDescription('');
        setEditRules([]);
        setEditLocations([]);
    };

    const handleStartEditTest = (test: GlobalTest) => {
        setIsAddingTest(false);
        setEditingTest(true);
        setEditTitle(test.title);
        setEditDescription(test.description);
        setEditRules(test.rules ?? []);
        setEditLocations(test.locations ?? []);
    };

    const handleCancelTest = () => {
        setEditingTest(false);
        setIsAddingTest(false);
    };

    const handleSaveTest = async () => {
        if (!editTitle.trim()) {
            message.warning('Title is required');
            return;
        }
        try {
            if (isAddingTest) {
                const newTest = await addTest({
                    title: editTitle.trim(),
                    description: editDescription.trim(),
                });
                // Save rules/locations immediately after creating
                if (editRules.length > 0 || editLocations.length > 0) {
                    await updateTest({
                        id: newTest.id,
                        rules: editRules,
                        locations: editLocations,
                    });
                }
                setSelectedTestId(newTest.id);
                message.success('Test added');
            } else if (selectedTest) {
                await updateTest({
                    id: selectedTest.id,
                    title: editTitle.trim(),
                    description: editDescription.trim(),
                    rules: editRules,
                    locations: editLocations,
                });
                message.success('Test updated');
            }
            setEditingTest(false);
            setIsAddingTest(false);
        } catch (err: any) {
            message.error(err?.message || 'Failed to save');
        }
    };

    const handleDeleteTest = async (id: string) => {
        try {
            await deleteTest(id);
            if (selectedTestId === id) {
                setSelectedTestId(null);
                setEditingTest(false);
            }
            message.success('Test deleted');
        } catch (err: any) {
            message.error(err?.message || 'Failed to delete');
        }
    };

    // ─── View-mode Rules & Locations change handlers (auto-save) ──────────

    const handleRulesChange = async (rules: ObjectRule[]) => {
        if (!selectedTest) return;
        try {
            await updateTest({ id: selectedTest.id, rules });
        } catch (err: any) {
            message.error(err?.message || 'Failed to save rules');
        }
    };

    const handleLocationsChange = async (locations: ImplementationLocation[]) => {
        if (!selectedTest) return;
        try {
            await updateTest({ id: selectedTest.id, locations });
        } catch (err: any) {
            message.error(err?.message || 'Failed to save locations');
        }
    };

    if (!workspace) return null;

    const showTestEditForm = editingTest && (isAddingTest || selectedTest);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Top bar */}
            <div style={{ flexShrink: 0, padding: '12px 16px', borderBottom: `1px solid ${token.colorBorderSecondary}`, marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Title level={4} style={{ margin: 0, lineHeight: 1 }}>Tests</Title>
                    <Button size="small" icon={<PlusOutlined />} type="primary" onClick={handleStartAddTest}>Add Test</Button>
                </div>
            </div>

            <Splitter style={{ flex: 1, minHeight: 0 }}>
                {/* Left: test list */}
                <Splitter.Panel defaultSize="35%" min="200px" max="50%">
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '0 12px' }}>
                        <Input
                            placeholder="Search tests..."
                            prefix={<SearchOutlined style={{ color: token.colorTextQuaternary }} />}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            allowClear
                            size="small"
                            style={{ marginBottom: 8 }}
                        />
                        <div style={{ flex: 1, overflow: 'auto' }}>
                            {loading ? null : filteredTests.length === 0 ? (
                                <Empty description="No tests yet" style={{ marginTop: 40 }} />
                            ) : (
                                <List
                                    dataSource={filteredTests}
                                    size="small"
                                    renderItem={test => (
                                        <List.Item
                                            key={test.id}
                                            onClick={() => {
                                                setSelectedTestId(test.id);
                                                setEditingTest(false);
                                                setIsAddingTest(false);
                                            }}
                                            style={{
                                                cursor: 'pointer',
                                                padding: '8px 12px',
                                                borderRadius: 6,
                                                background: selectedTestId === test.id
                                                    ? token.controlItemBgActive
                                                    : 'transparent',
                                                border: 'none',
                                                marginBottom: 2,
                                                transition: 'background 0.15s',
                                            }}
                                        >
                                            <div style={{ width: '100%' }}>
                                                <Text strong style={{ fontSize: 13 }}>{test.title}</Text>
                                                <div>
                                                    <Text type="secondary" style={{ fontSize: 11 }}>
                                                        {test.rules?.length ?? 0} rule{(test.rules?.length ?? 0) !== 1 ? 's' : ''}
                                                        {' · '}
                                                        {test.locations?.length ?? 0} location{(test.locations?.length ?? 0) !== 1 ? 's' : ''}
                                                    </Text>
                                                </div>
                                            </div>
                                        </List.Item>
                                    )}
                                />
                            )}
                        </div>
                    </div>
                </Splitter.Panel>

                {/* Right: detail / edit */}
                <Splitter.Panel>
                    <div style={{
                        height: '100%',
                        borderLeft: `1px solid ${token.colorBorderSecondary}`,
                        overflow: 'auto',
                        padding: '16px 20px',
                    }}>
                        {showTestEditForm ? (
                            /* ─── Test edit / add mode with RuleLocationEditor ─── */
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                    <Text strong style={{ fontSize: 14 }}>{isAddingTest ? 'New Test' : 'Edit Test'}</Text>
                                    <Space>
                                        <Button size="small" icon={<CheckOutlined />} type="primary" onClick={handleSaveTest}>Save</Button>
                                        <Button size="small" icon={<CloseOutlined />} onClick={handleCancelTest}>Cancel</Button>
                                    </Space>
                                </div>
                                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                                    <div>
                                        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Title</Text>
                                        <Input
                                            value={editTitle}
                                            onChange={e => setEditTitle(e.target.value)}
                                            placeholder="e.g. User Registration Flow"
                                        />
                                    </div>
                                </Space>

                                <Divider style={{ margin: '16px 0' }} />

                                {/* Rules & Locations editor */}
                                <RuleLocationEditor
                                    title=""
                                    rules={editRules}
                                    locations={editLocations}
                                    onRulesChange={setEditRules}
                                    onLocationsChange={setEditLocations}
                                    editable={true}
                                />

                                <Divider style={{ margin: '16px 0' }} />

                                <div>
                                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Description</Text>
                                    <TextArea
                                        value={editDescription}
                                        onChange={e => setEditDescription(e.target.value)}
                                        rows={3}
                                        placeholder="Describe this test suite..."
                                    />
                                </div>
                            </div>
                        ) : selectedTest ? (
                            /* ─── Test view mode with RuleLocationEditor ─── */
                            <div>
                                {/* Test header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                    <Title level={4} style={{ margin: 0 }}>{selectedTest.title}</Title>
                                    <Space>
                                        <Tooltip title="Edit Test">
                                            <Button size="small" icon={<EditOutlined />} onClick={() => handleStartEditTest(selectedTest)} />
                                        </Tooltip>
                                        <Popconfirm title="Delete this test?" onConfirm={() => handleDeleteTest(selectedTest.id)}>
                                            <Button size="small" danger icon={<DeleteOutlined />} />
                                        </Popconfirm>
                                    </Space>
                                </div>

                                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 12 }}>
                                    Created: {new Date(selectedTest.createdAt).toLocaleString()} · Updated: {new Date(selectedTest.updatedAt).toLocaleString()}
                                </Text>

                                <Divider style={{ margin: '12px 0' }} />

                                {/* Rules & Locations preview — read-only */}
                                <RuleLocationEditor
                                    title=""
                                    rules={selectedTest.rules ?? []}
                                    locations={selectedTest.locations ?? []}
                                    onRulesChange={() => { }}
                                    onLocationsChange={() => { }}
                                    editable={false}
                                />

                                {selectedTest.description && (
                                    <>
                                        <Divider style={{ margin: '12px 0' }} />
                                        <Paragraph type="secondary" style={{ whiteSpace: 'pre-wrap', marginBottom: 12 }}>
                                            {selectedTest.description}
                                        </Paragraph>
                                    </>
                                )}
                            </div>
                        ) : (
                            <Empty description="Select a test to view details" style={{ marginTop: 60 }} />
                        )}
                    </div>
                </Splitter.Panel>
            </Splitter>
        </div>
    );
};
