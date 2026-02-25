/**
 * GlossaryPage — term list on left, inline detail/edit on right.
 */
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
    Typography, Button, Space, Input, List, Tag, Empty,
    Splitter, theme, Popconfirm, message, Tooltip, Dropdown, Segmented,
} from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, SearchOutlined, CheckOutlined, CloseOutlined, CopyOutlined, SortAscendingOutlined, ClockCircleOutlined } from '@ant-design/icons';
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
    const [sortMode, setSortMode] = useState<'alpha' | 'updated'>('alpha');
    const [editing, setEditing] = useState(false);

    // Draft fields for inline editing
    const [draftName, setDraftName] = useState('');
    const [draftDescription, setDraftDescription] = useState('');
    const [draftCategory, setDraftCategory] = useState('');

    useEffect(() => {
        if (workspace) loadTerms();
    }, [workspace, loadTerms]);

    const filteredTerms = useMemo(() => {
        let result = terms;
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(t =>
                t.name.toLowerCase().includes(q) ||
                t.description.toLowerCase().includes(q) ||
                (t.category && t.category.toLowerCase().includes(q))
            );
        }
        if (sortMode === 'alpha') {
            result = [...result].sort((a, b) => a.name.localeCompare(b.name));
        } else {
            result = [...result].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        }
        return result;
    }, [terms, search, sortMode]);

    const selectedTerm = useMemo(() => {
        return terms.find(t => t.id === selectedTermId) ?? null;
    }, [terms, selectedTermId]);

    const enterEditing = useCallback((term: GlossaryTerm) => {
        setDraftName(term.name);
        setDraftDescription(term.description);
        setDraftCategory(term.category || '');
        setEditing(true);
    }, []);

    const cancelEditing = useCallback(() => {
        setEditing(false);
    }, []);

    const handleAdd = async () => {
        try {
            const newTerm = await addTerm({ name: 'New Term', description: '' });
            setSelectedTermId(newTerm.id);
            enterEditing(newTerm);
        } catch (err: any) {
            message.error(err?.message || 'Failed to add');
        }
    };

    const handleSave = async () => {
        if (!selectedTerm) return;
        const name = draftName.trim();
        if (!name) {
            message.warning('Name is required');
            return;
        }
        try {
            await updateTerm({
                id: selectedTerm.id,
                name,
                description: draftDescription.trim(),
                category: draftCategory.trim() || undefined,
            });
            setEditing(false);
            message.success('Term saved');
        } catch (err: any) {
            message.error(err?.message || 'Failed to save');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteTerm(id);
            if (selectedTermId === id) {
                setSelectedTermId(null);
                setEditing(false);
            }
            message.success('Term deleted');
        } catch (err: any) {
            message.error(err?.message || 'Failed to delete');
        }
    };

    const handleSelectTerm = (id: string) => {
        if (editing) setEditing(false);
        setSelectedTermId(id);
    };

    const handleDuplicate = async (term: GlossaryTerm) => {
        try {
            const newTerm = await addTerm({
                name: `${term.name} (Copy)`,
                description: term.description,
                category: term.category || undefined,
            });
            setSelectedTermId(newTerm.id);
            message.success('Term duplicated');
        } catch (err: any) {
            message.error(err?.message || 'Failed to duplicate');
        }
    };

    if (!workspace) return null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Top bar */}
            <div style={{ flexShrink: 0, padding: '12px 16px', borderBottom: `1px solid ${token.colorBorderSecondary}`, marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Title level={4} style={{ margin: 0, lineHeight: 1 }}>Glossary</Title>
                    <Button size="small" icon={<PlusOutlined />} type="primary" onClick={handleAdd}>Add Term</Button>
                </div>
            </div>

            <Splitter style={{ flex: 1, minHeight: 0 }}>
                {/* Left: term list */}
                <Splitter.Panel defaultSize="35%" min="200px" max="60%">
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '0 12px' }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                            <Input
                                placeholder="Search terms..."
                                prefix={<SearchOutlined style={{ color: token.colorTextQuaternary }} />}
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                allowClear
                                size="small"
                                style={{ flex: 1 }}
                            />
                            <Segmented
                                size="small"
                                value={sortMode}
                                onChange={v => setSortMode(v as 'alpha' | 'updated')}
                                options={[
                                    { value: 'alpha', icon: <SortAscendingOutlined />, title: 'Sort A→Z' },
                                    { value: 'updated', icon: <ClockCircleOutlined />, title: 'Recently updated' },
                                ]}
                            />
                        </div>
                        <div style={{ flex: 1, overflow: 'auto' }}>
                            {loading ? null : filteredTerms.length === 0 ? (
                                <Empty description="No terms yet" style={{ marginTop: 40 }} />
                            ) : (
                                <List
                                    dataSource={filteredTerms}
                                    size="small"
                                    renderItem={term => (
                                        <Dropdown
                                            menu={{
                                                items: [
                                                    { key: 'duplicate', icon: <CopyOutlined />, label: 'Duplicate' },
                                                ],
                                                onClick: ({ key }) => {
                                                    if (key === 'duplicate') handleDuplicate(term);
                                                },
                                            }}
                                            trigger={['contextMenu']}
                                        >
                                            <List.Item
                                                key={term.id}
                                                onClick={() => handleSelectTerm(term.id)}
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
                                                </div>
                                            </List.Item>
                                        </Dropdown>
                                    )}
                                />
                            )}
                        </div>
                    </div>
                </Splitter.Panel>

                {/* Right: detail / inline edit */}
                <Splitter.Panel>
                    <div style={{
                        height: '100%',
                        borderLeft: `1px solid ${token.colorBorderSecondary}`,
                        overflow: 'auto',
                        padding: '16px 20px',
                    }}>
                        {selectedTerm ? (
                            editing ? (
                                /* ── Editing mode ── */
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                        <Text strong style={{ fontSize: 14 }}>Edit Term</Text>
                                        <Space>
                                            <Tooltip title="Save">
                                                <Button size="small" type="primary" icon={<CheckOutlined />} onClick={handleSave} />
                                            </Tooltip>
                                            <Tooltip title="Cancel">
                                                <Button size="small" icon={<CloseOutlined />} onClick={cancelEditing} />
                                            </Tooltip>
                                        </Space>
                                    </div>

                                    <div style={{ marginBottom: 12 }}>
                                        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Term Name *</Text>
                                        <Input
                                            value={draftName}
                                            onChange={e => setDraftName(e.target.value)}
                                            placeholder="e.g. Aggregate Root"
                                        />
                                    </div>

                                    <div style={{ marginBottom: 12 }}>
                                        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Category</Text>
                                        <Input
                                            value={draftCategory}
                                            onChange={e => setDraftCategory(e.target.value)}
                                            placeholder="e.g. DDD, Business"
                                        />
                                    </div>

                                    <div style={{ marginBottom: 12 }}>
                                        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Description</Text>
                                        <TextArea
                                            rows={6}
                                            value={draftDescription}
                                            onChange={e => setDraftDescription(e.target.value)}
                                            placeholder="Describe this term..."
                                        />
                                    </div>
                                </div>
                            ) : (
                                /* ── Read-only mode ── */
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                                        <div>
                                            <Title level={4} style={{ margin: 0 }}>{selectedTerm.name}</Title>
                                            {selectedTerm.category && (
                                                <Tag color="blue" style={{ marginTop: 4 }}>{selectedTerm.category}</Tag>
                                            )}
                                        </div>
                                        <Space>
                                            <Tooltip title="Edit">
                                                <Button size="small" icon={<EditOutlined />} onClick={() => enterEditing(selectedTerm)} />
                                            </Tooltip>
                                            <Popconfirm title="Delete this term?" onConfirm={() => handleDelete(selectedTerm.id)}>
                                                <Button size="small" danger icon={<DeleteOutlined />} />
                                            </Popconfirm>
                                        </Space>
                                    </div>

                                    <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 16 }}>
                                        Created: {new Date(selectedTerm.createdAt).toLocaleString()} · Updated: {new Date(selectedTerm.updatedAt).toLocaleString()}
                                    </Text>

                                    <div style={{ marginBottom: 12 }}>
                                        <Text type="secondary" style={{ fontSize: 12 }}>Description:</Text>
                                        <Paragraph style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>
                                            {selectedTerm.description || <Text type="secondary" italic>No description</Text>}
                                        </Paragraph>
                                    </div>
                                </div>
                            )
                        ) : (
                            <Empty description="Select a term to view details" style={{ marginTop: 60 }} />
                        )}
                    </div>
                </Splitter.Panel>
            </Splitter>
        </div>
    );
};
