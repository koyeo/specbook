/**
 * GlossaryPage — term list on left, detail/edit on right.
 */
import React, { useEffect, useState, useMemo } from 'react';
import {
    Typography, Button, Space, Input, List, Tag, Empty,
    Modal, Form, Splitter, theme, Popconfirm, message, Tooltip,
} from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, SearchOutlined } from '@ant-design/icons';
import { useGlossary } from '../hooks/useGlossary';
import type { GlossaryTerm } from '@specbook/shared';

const { Title, Text, Paragraph } = Typography;
const { useToken } = theme;
const { TextArea } = Input;

interface GlossaryPageProps {
    workspace: string | null;
}

export const GlossaryPage: React.FC<GlossaryPageProps> = ({ workspace }) => {
    const { token } = useToken();
    const { terms, loading, loadTerms, addTerm, updateTerm, deleteTerm } = useGlossary();
    const [selectedTermId, setSelectedTermId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editingTerm, setEditingTerm] = useState<GlossaryTerm | null>(null);
    const [form] = Form.useForm();

    useEffect(() => {
        if (workspace) loadTerms();
    }, [workspace, loadTerms]);

    const filteredTerms = useMemo(() => {
        if (!search.trim()) return terms;
        const q = search.toLowerCase();
        return terms.filter(t =>
            t.name.toLowerCase().includes(q) ||
            t.aliases.some(a => a.toLowerCase().includes(q)) ||
            t.description.toLowerCase().includes(q) ||
            (t.category && t.category.toLowerCase().includes(q))
        );
    }, [terms, search]);

    const selectedTerm = useMemo(() => {
        return terms.find(t => t.id === selectedTermId) ?? null;
    }, [terms, selectedTermId]);

    const handleAdd = () => {
        setEditingTerm(null);
        form.resetFields();
        setModalOpen(true);
    };

    const handleEdit = (term: GlossaryTerm) => {
        setEditingTerm(term);
        form.setFieldsValue({
            name: term.name,
            aliases: term.aliases.join(', '),
            description: term.description,
            category: term.category || '',
        });
        setModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteTerm(id);
            if (selectedTermId === id) setSelectedTermId(null);
            message.success('Term deleted');
        } catch (err: any) {
            message.error(err?.message || 'Failed to delete');
        }
    };

    const handleModalOk = async () => {
        try {
            const values = await form.validateFields();
            const aliases = values.aliases
                ? values.aliases.split(',').map((s: string) => s.trim()).filter(Boolean)
                : [];

            if (editingTerm) {
                await updateTerm({
                    id: editingTerm.id,
                    name: values.name.trim(),
                    aliases,
                    description: values.description?.trim() ?? '',
                    category: values.category?.trim() || undefined,
                });
                message.success('Term updated');
            } else {
                const newTerm = await addTerm({
                    name: values.name.trim(),
                    aliases,
                    description: values.description?.trim() ?? '',
                    category: values.category?.trim() || undefined,
                });
                setSelectedTermId(newTerm.id);
                message.success('Term added');
            }
            setModalOpen(false);
        } catch (err: any) {
            if (err?.errorFields) return; // form validation
            message.error(err?.message || 'Failed to save');
        }
    };

    if (!workspace) return null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
            {/* Top bar */}
            <div style={{ flexShrink: 0, marginBottom: 8 }}>
                <Space style={{ width: '100%', justifyContent: 'space-between' }} align="center">
                    <Title level={4} style={{ margin: 0 }}>📖 Glossary</Title>
                    <Button size="small" icon={<PlusOutlined />} type="primary" onClick={handleAdd}>Add Term</Button>
                </Space>
            </div>

            <Splitter style={{ flex: 1, minHeight: 0 }}>
                {/* Left: term list */}
                <Splitter.Panel defaultSize="35%" min="200px" max="60%">
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', paddingRight: 4 }}>
                        <Input
                            placeholder="Search terms..."
                            prefix={<SearchOutlined style={{ color: token.colorTextQuaternary }} />}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            allowClear
                            size="small"
                            style={{ marginBottom: 8 }}
                        />
                        <div style={{ flex: 1, overflow: 'auto' }}>
                            {filteredTerms.length === 0 ? (
                                <Empty description="No terms yet" style={{ marginTop: 40 }} />
                            ) : (
                                <List
                                    loading={loading}
                                    dataSource={filteredTerms}
                                    size="small"
                                    renderItem={term => (
                                        <List.Item
                                            key={term.id}
                                            onClick={() => setSelectedTermId(term.id)}
                                            style={{
                                                cursor: 'pointer',
                                                padding: '8px 12px',
                                                borderRadius: 6,
                                                background: selectedTermId === term.id
                                                    ? token.controlItemBgActive
                                                    : 'transparent',
                                                border: 'none',
                                                marginBottom: 2,
                                                transition: 'background 0.15s',
                                            }}
                                        >
                                            <div style={{ width: '100%' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <Text strong style={{ fontSize: 13 }}>{term.name}</Text>
                                                    {term.category && (
                                                        <Tag color="blue" style={{ fontSize: 11, marginRight: 0 }}>
                                                            {term.category}
                                                        </Tag>
                                                    )}
                                                </div>
                                                {term.aliases.length > 0 && (
                                                    <Text type="secondary" style={{ fontSize: 11 }}>
                                                        aka: {term.aliases.join(', ')}
                                                    </Text>
                                                )}
                                            </div>
                                        </List.Item>
                                    )}
                                />
                            )}
                        </div>
                    </div>
                </Splitter.Panel>

                {/* Right: detail */}
                <Splitter.Panel>
                    <div style={{
                        height: '100%',
                        borderLeft: `1px solid ${token.colorBorderSecondary}`,
                        overflow: 'auto',
                        padding: '16px 20px',
                    }}>
                        {selectedTerm ? (
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                                    <div>
                                        <Title level={4} style={{ margin: 0 }}>{selectedTerm.name}</Title>
                                        {selectedTerm.category && (
                                            <Tag color="blue" style={{ marginTop: 4 }}>{selectedTerm.category}</Tag>
                                        )}
                                    </div>
                                    <Space>
                                        <Tooltip title="Edit">
                                            <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(selectedTerm)} />
                                        </Tooltip>
                                        <Popconfirm title="Delete this term?" onConfirm={() => handleDelete(selectedTerm.id)}>
                                            <Button size="small" danger icon={<DeleteOutlined />} />
                                        </Popconfirm>
                                    </Space>
                                </div>

                                {selectedTerm.aliases.length > 0 && (
                                    <div style={{ marginBottom: 12 }}>
                                        <Text type="secondary" style={{ fontSize: 12 }}>Aliases:</Text>
                                        <div style={{ marginTop: 4 }}>
                                            {selectedTerm.aliases.map((alias, i) => (
                                                <Tag key={i} style={{ marginBottom: 4 }}>{alias}</Tag>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div style={{ marginBottom: 12 }}>
                                    <Text type="secondary" style={{ fontSize: 12 }}>Description:</Text>
                                    <Paragraph style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>
                                        {selectedTerm.description || <Text type="secondary" italic>No description</Text>}
                                    </Paragraph>
                                </div>

                                <Text type="secondary" style={{ fontSize: 11 }}>
                                    Created: {new Date(selectedTerm.createdAt).toLocaleString()} · Updated: {new Date(selectedTerm.updatedAt).toLocaleString()}
                                </Text>
                            </div>
                        ) : (
                            <Empty description="Select a term to view details" style={{ marginTop: 60 }} />
                        )}
                    </div>
                </Splitter.Panel>
            </Splitter>

            {/* Add/Edit modal */}
            <Modal
                title={editingTerm ? 'Edit Term' : 'Add Term'}
                open={modalOpen}
                onOk={handleModalOk}
                onCancel={() => setModalOpen(false)}
                okText={editingTerm ? 'Save' : 'Add'}
                destroyOnClose
            >
                <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
                    <Form.Item name="name" label="Term Name" rules={[{ required: true, message: 'Name is required' }]}>
                        <Input placeholder="e.g. Aggregate Root" />
                    </Form.Item>
                    <Form.Item name="aliases" label="Aliases" help="Comma-separated alternate names">
                        <Input placeholder="e.g. Root Entity, AR" />
                    </Form.Item>
                    <Form.Item name="category" label="Category">
                        <Input placeholder="e.g. DDD, Business" />
                    </Form.Item>
                    <Form.Item name="description" label="Description">
                        <TextArea rows={4} placeholder="Describe this term..." />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};
