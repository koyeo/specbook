/**
 * GlobalTestsPage — test list on left, inline edit/view detail with cases on right.
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
import type { GlobalTest, GlobalTestCase } from '@specbook/shared';

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

    // Case inline edit state
    const [editingCaseId, setEditingCaseId] = useState<string | null>(null);
    const [isAddingCase, setIsAddingCase] = useState(false);
    const [editCaseText, setEditCaseText] = useState('');

    useEffect(() => {
        if (workspace) loadTests();
    }, [workspace, loadTests]);

    const filteredTests = useMemo(() => {
        if (!search.trim()) return tests;
        const q = search.toLowerCase();
        return tests.filter(t =>
            t.title.toLowerCase().includes(q) ||
            t.description.toLowerCase().includes(q) ||
            t.cases.some(c => c.text.toLowerCase().includes(q))
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
        // Reset case editing
        setEditingCaseId(null);
        setIsAddingCase(false);
    };

    const handleStartEditTest = (test: GlobalTest) => {
        setIsAddingTest(false);
        setEditingTest(true);
        setEditTitle(test.title);
        setEditDescription(test.description);
        // Reset case editing
        setEditingCaseId(null);
        setIsAddingCase(false);
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
                setSelectedTestId(newTest.id);
                message.success('Test added');
            } else if (selectedTest) {
                await updateTest({
                    id: selectedTest.id,
                    title: editTitle.trim(),
                    description: editDescription.trim(),
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

    // ─── Case CRUD ────────────────────────────────────

    const handleStartAddCase = () => {
        setIsAddingCase(true);
        setEditingCaseId(null);
        setEditCaseText('');
    };

    const handleStartEditCase = (testCase: GlobalTestCase) => {
        setEditingCaseId(testCase.id);
        setIsAddingCase(false);
        setEditCaseText(testCase.text);
    };

    const handleCancelCase = () => {
        setEditingCaseId(null);
        setIsAddingCase(false);
        setEditCaseText('');
    };

    const handleSaveCase = async () => {
        if (!selectedTest || !editCaseText.trim()) {
            message.warning('Case text is required');
            return;
        }
        try {
            const now = new Date().toISOString();
            let updatedCases: GlobalTestCase[];

            if (isAddingCase) {
                const newCase: GlobalTestCase = {
                    id: crypto.randomUUID(),
                    text: editCaseText.trim(),
                    createdAt: now,
                    updatedAt: now,
                };
                updatedCases = [...selectedTest.cases, newCase];
            } else if (editingCaseId) {
                updatedCases = selectedTest.cases.map(c =>
                    c.id === editingCaseId
                        ? { ...c, text: editCaseText.trim(), updatedAt: now }
                        : c
                );
            } else {
                return;
            }

            await updateTest({ id: selectedTest.id, cases: updatedCases });
            setEditingCaseId(null);
            setIsAddingCase(false);
            setEditCaseText('');
            message.success(isAddingCase ? 'Case added' : 'Case updated');
        } catch (err: any) {
            message.error(err?.message || 'Failed to save case');
        }
    };

    const handleDeleteCase = async (caseId: string) => {
        if (!selectedTest) return;
        try {
            const updatedCases = selectedTest.cases.filter(c => c.id !== caseId);
            await updateTest({ id: selectedTest.id, cases: updatedCases });
            if (editingCaseId === caseId) {
                setEditingCaseId(null);
                setEditCaseText('');
            }
            message.success('Case deleted');
        } catch (err: any) {
            message.error(err?.message || 'Failed to delete case');
        }
    };

    if (!workspace) return null;

    const showTestEditForm = editingTest && (isAddingTest || selectedTest);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
            {/* Top bar */}
            <div style={{ flexShrink: 0, marginBottom: 8 }}>
                <Space style={{ width: '100%', justifyContent: 'space-between' }} align="center">
                    <Title level={4} style={{ margin: 0 }}>🧪 Global Tests</Title>
                    <Button size="small" icon={<PlusOutlined />} type="primary" onClick={handleStartAddTest}>Add Test</Button>
                </Space>
            </div>

            <Splitter style={{ flex: 1, minHeight: 0 }}>
                {/* Left: test list */}
                <Splitter.Panel defaultSize="35%" min="200px" max="50%">
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', paddingRight: 4 }}>
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
                            {filteredTests.length === 0 ? (
                                <Empty description="No tests yet" style={{ marginTop: 40 }} />
                            ) : (
                                <List
                                    loading={loading}
                                    dataSource={filteredTests}
                                    size="small"
                                    renderItem={test => (
                                        <List.Item
                                            key={test.id}
                                            onClick={() => {
                                                setSelectedTestId(test.id);
                                                setEditingTest(false);
                                                setIsAddingTest(false);
                                                setEditingCaseId(null);
                                                setIsAddingCase(false);
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
                                                        {test.cases.length} case{test.cases.length !== 1 ? 's' : ''}
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
                            /* ─── Test edit / add mode ─── */
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
                                    <div>
                                        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Description</Text>
                                        <TextArea
                                            value={editDescription}
                                            onChange={e => setEditDescription(e.target.value)}
                                            rows={3}
                                            placeholder="Describe this test suite..."
                                        />
                                    </div>
                                </Space>
                            </div>
                        ) : selectedTest ? (
                            /* ─── Test view mode with cases ─── */
                            <div>
                                {/* Test header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                    <Title level={4} style={{ margin: 0 }}>{selectedTest.title}</Title>
                                    <Space>
                                        <Tooltip title="Edit Test">
                                            <Button size="small" icon={<EditOutlined />} onClick={() => handleStartEditTest(selectedTest)} />
                                        </Tooltip>
                                        <Popconfirm title="Delete this test and all its cases?" onConfirm={() => handleDeleteTest(selectedTest.id)}>
                                            <Button size="small" danger icon={<DeleteOutlined />} />
                                        </Popconfirm>
                                    </Space>
                                </div>

                                {selectedTest.description && (
                                    <Paragraph type="secondary" style={{ whiteSpace: 'pre-wrap', marginBottom: 12 }}>
                                        {selectedTest.description}
                                    </Paragraph>
                                )}

                                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 12 }}>
                                    Created: {new Date(selectedTest.createdAt).toLocaleString()} · Updated: {new Date(selectedTest.updatedAt).toLocaleString()}
                                </Text>

                                <Divider style={{ margin: '12px 0' }} />

                                {/* Cases section */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <Text strong style={{ fontSize: 13 }}>
                                        Test Cases ({selectedTest.cases.length})
                                    </Text>
                                    <Button size="small" icon={<PlusOutlined />} onClick={handleStartAddCase}>Add Case</Button>
                                </div>

                                {/* Add case inline form */}
                                {isAddingCase && (
                                    <div style={{
                                        padding: '10px 12px',
                                        borderRadius: 6,
                                        background: token.colorFillQuaternary,
                                        marginBottom: 8,
                                    }}>
                                        <TextArea
                                            value={editCaseText}
                                            onChange={e => setEditCaseText(e.target.value)}
                                            rows={3}
                                            placeholder="Describe what this test case verifies..."
                                            style={{ marginBottom: 8 }}
                                        />
                                        <Space>
                                            <Button size="small" type="primary" icon={<CheckOutlined />} onClick={handleSaveCase}>Save</Button>
                                            <Button size="small" icon={<CloseOutlined />} onClick={handleCancelCase}>Cancel</Button>
                                        </Space>
                                    </div>
                                )}

                                {selectedTest.cases.length === 0 && !isAddingCase ? (
                                    <Empty description="No cases yet" style={{ marginTop: 24 }} />
                                ) : (
                                    <List
                                        dataSource={selectedTest.cases}
                                        size="small"
                                        renderItem={(testCase, index) => (
                                            <List.Item
                                                key={testCase.id}
                                                style={{
                                                    padding: '8px 12px',
                                                    borderRadius: 6,
                                                    marginBottom: 4,
                                                    background: token.colorFillQuaternary,
                                                    border: 'none',
                                                    display: 'block',
                                                }}
                                            >
                                                {editingCaseId === testCase.id ? (
                                                    /* Case edit mode */
                                                    <div>
                                                        <TextArea
                                                            value={editCaseText}
                                                            onChange={e => setEditCaseText(e.target.value)}
                                                            rows={3}
                                                            style={{ marginBottom: 8 }}
                                                        />
                                                        <Space>
                                                            <Button size="small" type="primary" icon={<CheckOutlined />} onClick={handleSaveCase}>Save</Button>
                                                            <Button size="small" icon={<CloseOutlined />} onClick={handleCancelCase}>Cancel</Button>
                                                        </Space>
                                                    </div>
                                                ) : (
                                                    /* Case view mode */
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flex: 1 }}>
                                                            <Text type="secondary" style={{ fontSize: 12, flexShrink: 0 }}>
                                                                #{index + 1}
                                                            </Text>
                                                            <Text style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>
                                                                {testCase.text}
                                                            </Text>
                                                        </div>
                                                        <Space size={0} style={{ flexShrink: 0, marginLeft: 8 }}>
                                                            <Tooltip title="Edit">
                                                                <Button
                                                                    type="text"
                                                                    size="small"
                                                                    icon={<EditOutlined />}
                                                                    onClick={() => handleStartEditCase(testCase)}
                                                                />
                                                            </Tooltip>
                                                            <Popconfirm title="Delete this case?" onConfirm={() => handleDeleteCase(testCase.id)}>
                                                                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                                                            </Popconfirm>
                                                        </Space>
                                                    </div>
                                                )}
                                            </List.Item>
                                        )}
                                    />
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
