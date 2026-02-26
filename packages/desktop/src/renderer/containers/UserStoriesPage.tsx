/**
 * UserStoriesPage — user story list on left, content viewer / editor on right.
 * Modeled after KnowledgePage with tag-based filtering and Markdown preview.
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
import { useUserStories } from '../hooks/useUserStories';
import { MarkdownPreview } from '../components/MarkdownPreview';
import type { UserStory } from '@specbook/shared';

const { Title, Text, Paragraph } = Typography;
const { useToken } = theme;
const { TextArea } = Input;

/** Preset tag suggestions for user stories. */
const PRESET_TAGS = [
    'Epic',
    'Feature',
    'Enhancement',
    'Bug Fix',
    'Tech Debt',
];

const TAG_COLORS: Record<string, string> = {
    'Epic': 'magenta',
    'Feature': 'blue',
    'Enhancement': 'green',
    'Bug Fix': 'red',
    'Tech Debt': 'orange',
};

interface UserStoriesPageProps {
    workspace: string | null;
}

export const UserStoriesPage: React.FC<UserStoriesPageProps> = ({ workspace }) => {
    const { token } = useToken();
    const { stories, loading, loadStories, addStory, updateStory, deleteStory } = useUserStories();
    const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [filterTag, setFilterTag] = useState<string | null>(null);

    // Inline editing state
    const [editing, setEditing] = useState(false);
    const [editingStory, setEditingStory] = useState<UserStory | null>(null);
    const [form] = Form.useForm();
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [customTag, setCustomTag] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (workspace) loadStories();
    }, [workspace, loadStories]);

    // All distinct tags used across stories
    const allTags = useMemo(() => {
        const tagSet = new Set<string>();
        stories.forEach(s => s.tags.forEach(t => tagSet.add(t)));
        return Array.from(tagSet).sort();
    }, [stories]);

    const filteredStories = useMemo(() => {
        let result = stories;
        if (filterTag) {
            result = result.filter(s => s.tags.includes(filterTag));
        }
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(s =>
                s.title.toLowerCase().includes(q) ||
                s.content.toLowerCase().includes(q) ||
                s.tags.some(t => t.toLowerCase().includes(q))
            );
        }
        return result;
    }, [stories, search, filterTag]);

    const selectedStory = useMemo(() => {
        return stories.find(s => s.id === selectedStoryId) ?? null;
    }, [stories, selectedStoryId]);

    const handleAdd = () => {
        setEditingStory(null);
        form.resetFields();
        setSelectedTags([]);
        setCustomTag('');
        setEditing(true);
    };

    const handleEdit = (story: UserStory) => {
        setEditingStory(story);
        form.setFieldsValue({
            title: story.title,
            content: story.content,
        });
        setSelectedTags([...story.tags]);
        setCustomTag('');
        setEditing(true);
    };

    const handleCancelEdit = () => {
        setEditing(false);
        setEditingStory(null);
        form.resetFields();
        setSelectedTags([]);
        setCustomTag('');
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteStory(id);
            if (selectedStoryId === id) setSelectedStoryId(null);
            message.success('Story deleted');
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
            if (editingStory) {
                await updateStory({
                    id: editingStory.id,
                    title: values.title.trim(),
                    content: values.content?.trim() ?? '',
                    tags: selectedTags,
                });
                message.success('Story updated');
            } else {
                const newStory = await addStory({
                    title: values.title.trim(),
                    content: values.content?.trim() ?? '',
                    tags: selectedTags,
                });
                setSelectedStoryId(newStory.id);
                message.success('Story added');
            }
            setEditing(false);
            setEditingStory(null);
        } catch (err: any) {
            if (err?.errorFields) return;
            message.error(err?.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    if (!workspace) return null;

    /** Render the inline edit form */
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
                    {editingStory ? 'Edit Story' : 'New Story'}
                </Title>
                <Space>
                    <Button
                        size="small"
                        icon={<SaveOutlined />}
                        type="primary"
                        onClick={handleSave}
                        loading={saving}
                    >
                        {editingStory ? 'Save' : 'Add'}
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
                        <Input placeholder="As a [role], I want to [action] so that [benefit]" />
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
                            placeholder="Describe the user story, acceptance criteria, and any relevant details..."
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
            {selectedStory ? (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                        <div>
                            <Title level={4} style={{ margin: 0 }}>{selectedStory.title}</Title>
                            {selectedStory.tags.length > 0 && (
                                <Space size={4} style={{ marginTop: 4 }} wrap>
                                    {selectedStory.tags.map((tag: string) => (
                                        <Tag key={tag} color={TAG_COLORS[tag] || 'default'} style={{ fontSize: 11 }}>{tag}</Tag>
                                    ))}
                                </Space>
                            )}
                        </div>
                        <Space>
                            <Tooltip title="Edit">
                                <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(selectedStory)} />
                            </Tooltip>
                            <Popconfirm title="Delete this story?" onConfirm={() => handleDelete(selectedStory.id)}>
                                <Button size="small" danger icon={<DeleteOutlined />} />
                            </Popconfirm>
                        </Space>
                    </div>

                    <div style={{ marginBottom: 12 }}>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                            Created: {new Date(selectedStory.createdAt).toLocaleString()} · Updated: {new Date(selectedStory.updatedAt).toLocaleString()}
                        </Text>
                    </div>

                    {selectedStory.content ? (
                        <MarkdownPreview content={selectedStory.content} />
                    ) : (
                        <Paragraph type="secondary" italic>No content</Paragraph>
                    )}
                </div>
            ) : (
                <Empty description="Select a story to view" style={{ marginTop: 60 }} />
            )}
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Top bar */}
            <div style={{ flexShrink: 0, padding: '12px 16px', borderBottom: `1px solid ${token.colorBorderSecondary}`, marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Title level={4} style={{ margin: 0, lineHeight: 1 }}>User Stories</Title>
                    <Button size="small" icon={<PlusOutlined />} type="primary" onClick={handleAdd}>Add Story</Button>
                </div>
            </div>

            <Splitter style={{ flex: 1, minHeight: 0 }}>
                {/* Left: story list */}
                <Splitter.Panel defaultSize="35%" min="200px" max="60%">
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '0 12px' }}>
                        <Input
                            placeholder="Search stories..."
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
                            {loading ? null : filteredStories.length === 0 ? (
                                <Empty description="No stories yet" style={{ marginTop: 40 }} />
                            ) : (
                                <List
                                    dataSource={filteredStories}
                                    size="small"
                                    renderItem={(story: UserStory) => (
                                        <List.Item
                                            key={story.id}
                                            onClick={() => {
                                                setSelectedStoryId(story.id);
                                                if (editing) handleCancelEdit();
                                            }}
                                            style={{
                                                cursor: 'pointer',
                                                padding: '8px 12px',
                                                borderRadius: 6,
                                                background: selectedStoryId === story.id
                                                    ? token.controlItemBgActive
                                                    : 'transparent',
                                                border: 'none',
                                                marginBottom: 2,
                                                transition: 'background 0.15s',
                                            }}
                                        >
                                            <div style={{ width: '100%' }}>
                                                <Text strong style={{ fontSize: 13 }} ellipsis>{story.title}</Text>
                                                {story.tags.length > 0 && (
                                                    <div style={{ marginTop: 2 }}>
                                                        {story.tags.map((tag: string) => (
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
