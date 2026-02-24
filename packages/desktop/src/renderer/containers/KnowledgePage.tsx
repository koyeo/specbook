/**
 * KnowledgePage — project knowledge base entries with preset tags.
 * Left: entry list with tag filter | Right: content viewer OR inline editor
 */
import React, { useEffect, useState, useMemo } from 'react';
import {
    Typography, Button, Space, Input, List, Tag, Empty,
    Form, Splitter, theme, Popconfirm, message, Tooltip,
} from 'antd';
import {
    PlusOutlined, DeleteOutlined, EditOutlined,
    SearchOutlined, CloseOutlined, SaveOutlined,
} from '@ant-design/icons';
import { useKnowledge } from '../hooks/useKnowledge';
import { MarkdownPreview } from '../components/MarkdownPreview';
import type { KnowledgeEntry } from '@specbook/shared';

const { Title, Text, Paragraph } = Typography;
const { useToken } = theme;
const { TextArea } = Input;

/** Preset tag suggestions — users can also type custom tags. */
const PRESET_TAGS = [
    'Architecture',
    'Business Logic',
    'Tech Stack',
    'Infrastructure',
    'Conventions',
];

const TAG_COLORS: Record<string, string> = {
    'Architecture': 'blue',
    'Business Logic': 'green',
    'Tech Stack': 'purple',
    'Infrastructure': 'orange',
    'Conventions': 'cyan',
};

interface KnowledgePageProps {
    workspace: string | null;
}

export const KnowledgePage: React.FC<KnowledgePageProps> = ({ workspace }) => {
    const { token } = useToken();
    const { entries, loading, loadEntries, addEntry, updateEntry, deleteEntry } = useKnowledge();
    const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [filterTag, setFilterTag] = useState<string | null>(null);

    // Inline editing state (replaces modal)
    const [editing, setEditing] = useState(false);
    const [editingEntry, setEditingEntry] = useState<KnowledgeEntry | null>(null);
    const [form] = Form.useForm();
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [customTag, setCustomTag] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (workspace) loadEntries();
    }, [workspace, loadEntries]);

    // All distinct tags used across entries
    const allTags = useMemo(() => {
        const tagSet = new Set<string>();
        entries.forEach(e => e.tags.forEach(t => tagSet.add(t)));
        return Array.from(tagSet).sort();
    }, [entries]);

    const filteredEntries = useMemo(() => {
        let result = entries;
        if (filterTag) {
            result = result.filter(e => e.tags.includes(filterTag));
        }
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(e =>
                e.title.toLowerCase().includes(q) ||
                e.content.toLowerCase().includes(q) ||
                e.tags.some(t => t.toLowerCase().includes(q))
            );
        }
        return result;
    }, [entries, search, filterTag]);

    const selectedEntry = useMemo(() => {
        return entries.find(e => e.id === selectedEntryId) ?? null;
    }, [entries, selectedEntryId]);

    const handleAdd = () => {
        setEditingEntry(null);
        form.resetFields();
        setSelectedTags([]);
        setCustomTag('');
        setEditing(true);
    };

    const handleEdit = (entry: KnowledgeEntry) => {
        setEditingEntry(entry);
        form.setFieldsValue({
            title: entry.title,
            content: entry.content,
        });
        setSelectedTags([...entry.tags]);
        setCustomTag('');
        setEditing(true);
    };

    const handleCancelEdit = () => {
        setEditing(false);
        setEditingEntry(null);
        form.resetFields();
        setSelectedTags([]);
        setCustomTag('');
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteEntry(id);
            if (selectedEntryId === id) setSelectedEntryId(null);
            message.success('Entry deleted');
        } catch (err: any) {
            message.error(err?.message || 'Failed to delete');
        }
    };

    const toggleTag = (tag: string) => {
        setSelectedTags(prev =>
            prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
        );
    };

    const addCustomTag = () => {
        const tag = customTag.trim();
        if (tag && !selectedTags.includes(tag)) {
            setSelectedTags(prev => [...prev, tag]);
        }
        setCustomTag('');
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const values = await form.validateFields();
            if (editingEntry) {
                await updateEntry({
                    id: editingEntry.id,
                    title: values.title.trim(),
                    content: values.content?.trim() ?? '',
                    tags: selectedTags,
                });
                message.success('Entry updated');
            } else {
                const newEntry = await addEntry({
                    title: values.title.trim(),
                    content: values.content?.trim() ?? '',
                    tags: selectedTags,
                });
                setSelectedEntryId(newEntry.id);
                message.success('Entry added');
            }
            setEditing(false);
            setEditingEntry(null);
        } catch (err: any) {
            if (err?.errorFields) return;
            message.error(err?.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    if (!workspace) return null;

    /** Render the inline edit form (for both add & edit) */
    const renderEditForm = () => (
        <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            padding: '16px 20px',
            borderLeft: `1px solid ${token.colorBorderSecondary}`,
        }}>
            {/* Header with Save / Cancel */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
                flexShrink: 0,
            }}>
                <Title level={5} style={{ margin: 0 }}>
                    {editingEntry ? 'Edit Entry' : 'New Entry'}
                </Title>
                <Space>
                    <Button
                        size="small"
                        icon={<SaveOutlined />}
                        type="primary"
                        onClick={handleSave}
                        loading={saving}
                    >
                        {editingEntry ? 'Save' : 'Add'}
                    </Button>
                    <Button
                        size="small"
                        icon={<CloseOutlined />}
                        onClick={handleCancelEdit}
                    >
                        Cancel
                    </Button>
                </Space>
            </div>

            {/* Scrollable form body */}
            <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                <Form form={form} layout="vertical">
                    <Form.Item name="title" label="Title" rules={[{ required: true, message: 'Title is required' }]}>
                        <Input placeholder="e.g. Authentication Flow" />
                    </Form.Item>

                    <Form.Item label="Tags">
                        {/* Preset tag chips */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                            {PRESET_TAGS.map(tag => (
                                <Tag
                                    key={tag}
                                    style={{ cursor: 'pointer', userSelect: 'none' }}
                                    color={selectedTags.includes(tag) ? (TAG_COLORS[tag] || 'processing') : undefined}
                                    onClick={() => toggleTag(tag)}
                                >
                                    {selectedTags.includes(tag) ? '✓ ' : ''}{tag}
                                </Tag>
                            ))}
                        </div>
                        {/* Custom tag input */}
                        <Input
                            size="small"
                            placeholder="Add custom tag and press Enter"
                            value={customTag}
                            onChange={e => setCustomTag(e.target.value)}
                            onPressEnter={addCustomTag}
                            style={{ width: 240 }}
                        />
                        {/* Show selected custom tags (non-preset) */}
                        {selectedTags.filter(t => !PRESET_TAGS.includes(t)).length > 0 && (
                            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {selectedTags.filter(t => !PRESET_TAGS.includes(t)).map(tag => (
                                    <Tag
                                        key={tag}
                                        closable
                                        onClose={() => setSelectedTags(prev => prev.filter(t => t !== tag))}
                                        style={{ fontSize: 11 }}
                                    >
                                        {tag}
                                    </Tag>
                                ))}
                            </div>
                        )}
                    </Form.Item>

                    <Form.Item name="content" label="Content (Markdown)">
                        <TextArea
                            rows={16}
                            placeholder="Describe the concept, flow, or architecture..."
                            style={{ fontFamily: 'monospace', resize: 'vertical' }}
                        />
                    </Form.Item>
                </Form>
            </div>
        </div>
    );

    /** Render the detail / preview panel */
    const renderDetailView = () => (
        <div style={{
            height: '100%',
            borderLeft: `1px solid ${token.colorBorderSecondary}`,
            overflow: 'auto',
            padding: '16px 20px',
        }}>
            {selectedEntry ? (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                        <div>
                            <Title level={4} style={{ margin: 0 }}>{selectedEntry.title}</Title>
                            {selectedEntry.tags.length > 0 && (
                                <Space size={4} style={{ marginTop: 4 }} wrap>
                                    {selectedEntry.tags.map((tag: string) => (
                                        <Tag key={tag} color={TAG_COLORS[tag] || 'default'} style={{ fontSize: 11 }}>{tag}</Tag>
                                    ))}
                                </Space>
                            )}
                        </div>
                        <Space>
                            <Tooltip title="Edit">
                                <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(selectedEntry)} />
                            </Tooltip>
                            <Popconfirm title="Delete this entry?" onConfirm={() => handleDelete(selectedEntry.id)}>
                                <Button size="small" danger icon={<DeleteOutlined />} />
                            </Popconfirm>
                        </Space>
                    </div>

                    <div style={{ marginBottom: 12 }}>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                            Created: {new Date(selectedEntry.createdAt).toLocaleString()} · Updated: {new Date(selectedEntry.updatedAt).toLocaleString()}
                        </Text>
                    </div>

                    {selectedEntry.content ? (
                        <MarkdownPreview content={selectedEntry.content} />
                    ) : (
                        <Paragraph type="secondary" italic>No content</Paragraph>
                    )}
                </div>
            ) : (
                <Empty description="Select an entry to view" style={{ marginTop: 60 }} />
            )}
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Top bar */}
            <div style={{ flexShrink: 0, marginBottom: 8 }}>
                <Space style={{ width: '100%', justifyContent: 'space-between' }} align="center">
                    <Title level={4} style={{ margin: 0 }}>🧠 Knowledge</Title>
                    <Button size="small" icon={<PlusOutlined />} type="primary" onClick={handleAdd}>Add Entry</Button>
                </Space>
            </div>

            <Splitter style={{ flex: 1, minHeight: 0 }}>
                {/* Left: entry list */}
                <Splitter.Panel defaultSize="35%" min="200px" max="60%">
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', paddingRight: 4 }}>
                        <Input
                            placeholder="Search entries..."
                            prefix={<SearchOutlined style={{ color: token.colorTextQuaternary }} />}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            allowClear
                            size="small"
                            style={{ marginBottom: 6 }}
                        />

                        {/* Tag filter chips */}
                        <div style={{ marginBottom: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            <Tag
                                style={{ cursor: 'pointer', fontSize: 11 }}
                                color={filterTag === null ? 'processing' : undefined}
                                onClick={() => setFilterTag(null)}
                            >
                                All
                            </Tag>
                            {allTags.map(tag => (
                                <Tag
                                    key={tag}
                                    style={{ cursor: 'pointer', fontSize: 11 }}
                                    color={filterTag === tag ? (TAG_COLORS[tag] || 'processing') : undefined}
                                    onClick={() => setFilterTag(filterTag === tag ? null : tag)}
                                >
                                    {tag}
                                </Tag>
                            ))}
                        </div>

                        <div style={{ flex: 1, overflow: 'auto' }}>
                            {filteredEntries.length === 0 ? (
                                <Empty description="No entries yet" style={{ marginTop: 40 }} />
                            ) : (
                                <List
                                    loading={loading}
                                    dataSource={filteredEntries}
                                    size="small"
                                    renderItem={(entry: KnowledgeEntry) => (
                                        <List.Item
                                            key={entry.id}
                                            onClick={() => {
                                                setSelectedEntryId(entry.id);
                                                // Exit editing when selecting a different entry
                                                if (editing) handleCancelEdit();
                                            }}
                                            style={{
                                                cursor: 'pointer',
                                                padding: '8px 12px',
                                                borderRadius: 6,
                                                background: selectedEntryId === entry.id
                                                    ? token.controlItemBgActive
                                                    : 'transparent',
                                                border: 'none',
                                                marginBottom: 2,
                                                transition: 'background 0.15s',
                                            }}
                                        >
                                            <div style={{ width: '100%' }}>
                                                <Text strong style={{ fontSize: 13 }} ellipsis>{entry.title}</Text>
                                                {entry.tags.length > 0 && (
                                                    <div style={{ marginTop: 2 }}>
                                                        {entry.tags.map((tag: string) => (
                                                            <Tag key={tag} color={TAG_COLORS[tag] || 'default'} style={{ fontSize: 10, marginRight: 4 }}>
                                                                {tag}
                                                            </Tag>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </List.Item>
                                    )}
                                />
                            )}
                        </div>
                    </div>
                </Splitter.Panel>

                {/* Right: detail view OR inline editor */}
                <Splitter.Panel>
                    {editing ? renderEditForm() : renderDetailView()}
                </Splitter.Panel>
            </Splitter>
        </div>
    );
};
