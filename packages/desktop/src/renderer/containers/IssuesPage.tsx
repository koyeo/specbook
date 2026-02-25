/**
 * IssuesPage — issue list on left, detail panel on right.
 * Supports status, priority, labels, search, and filter.
 */
import React, { useEffect, useState, useMemo } from 'react';
import {
    Typography, Button, Space, Input, List, Empty,
    Splitter, theme, Popconfirm, message, Tooltip, Tag, Select, Divider,
} from 'antd';
import {
    PlusOutlined, DeleteOutlined, EditOutlined, SearchOutlined,
    CheckOutlined, CloseOutlined,
} from '@ant-design/icons';
import { useIssues } from '../hooks/useIssues';
import type { Issue, IssueStatus, IssuePriority } from '@specbook/shared';

const { Title, Text, Paragraph } = Typography;
const { useToken } = theme;
const { TextArea } = Input;

interface IssuesPageProps {
    workspace: string | null;
}

const STATUS_OPTIONS: { value: IssueStatus; label: string }[] = [
    { value: 'open', label: 'Open' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'closed', label: 'Closed' },
];

const PRIORITY_OPTIONS: { value: IssuePriority; label: string }[] = [
    { value: 'critical', label: 'Critical' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
];

const STATUS_COLORS: Record<IssueStatus, string> = {
    open: 'blue',
    in_progress: 'orange',
    resolved: 'green',
    closed: 'default',
};

const PRIORITY_COLORS: Record<IssuePriority, string> = {
    critical: 'red',
    high: 'volcano',
    medium: 'gold',
    low: 'default',
};

export const IssuesPage: React.FC<IssuesPageProps> = ({ workspace }) => {
    const { token } = useToken();
    const { issues, loading, loadIssues, addIssue, updateIssue, deleteIssue } = useIssues();
    const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<IssueStatus | 'all'>('all');

    // Inline edit state
    const [editing, setEditing] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editStatus, setEditStatus] = useState<IssueStatus>('open');
    const [editPriority, setEditPriority] = useState<IssuePriority>('medium');
    const [editLabels, setEditLabels] = useState<string[]>([]);

    useEffect(() => {
        if (workspace) loadIssues();
    }, [workspace, loadIssues]);

    const filteredIssues = useMemo(() => {
        let result = issues;
        if (filterStatus !== 'all') {
            result = result.filter(i => i.status === filterStatus);
        }
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(i =>
                i.title.toLowerCase().includes(q) ||
                i.description.toLowerCase().includes(q) ||
                i.labels.some(l => l.toLowerCase().includes(q))
            );
        }
        return result;
    }, [issues, search, filterStatus]);

    const selectedIssue = useMemo(() => {
        return issues.find(i => i.id === selectedIssueId) ?? null;
    }, [issues, selectedIssueId]);

    // ─── CRUD ────────────────────────────────────────

    const handleStartAdd = () => {
        setIsAdding(true);
        setEditing(true);
        setSelectedIssueId(null);
        setEditTitle('');
        setEditDescription('');
        setEditStatus('open');
        setEditPriority('medium');
        setEditLabels([]);
    };

    const handleStartEdit = (issue: Issue) => {
        setIsAdding(false);
        setEditing(true);
        setEditTitle(issue.title);
        setEditDescription(issue.description);
        setEditStatus(issue.status);
        setEditPriority(issue.priority);
        setEditLabels([...issue.labels]);
    };

    const handleCancel = () => {
        setEditing(false);
        setIsAdding(false);
    };

    const handleSave = async () => {
        if (!editTitle.trim()) {
            message.warning('Title is required');
            return;
        }
        try {
            if (isAdding) {
                const newIssue = await addIssue({
                    title: editTitle.trim(),
                    description: editDescription.trim(),
                    priority: editPriority,
                    labels: editLabels,
                });
                // Update status if not default 'open'
                if (editStatus !== 'open') {
                    await updateIssue({ id: newIssue.id, status: editStatus });
                }
                setSelectedIssueId(newIssue.id);
                message.success('Issue added');
            } else if (selectedIssue) {
                await updateIssue({
                    id: selectedIssue.id,
                    title: editTitle.trim(),
                    description: editDescription.trim(),
                    status: editStatus,
                    priority: editPriority,
                    labels: editLabels,
                });
                message.success('Issue updated');
            }
            setEditing(false);
            setIsAdding(false);
        } catch (err: any) {
            message.error(err?.message || 'Failed to save');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteIssue(id);
            if (selectedIssueId === id) {
                setSelectedIssueId(null);
                setEditing(false);
            }
            message.success('Issue deleted');
        } catch (err: any) {
            message.error(err?.message || 'Failed to delete');
        }
    };

    if (!workspace) return null;

    const showEditForm = editing && (isAdding || selectedIssue);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Top bar */}
            <div style={{ flexShrink: 0, padding: '12px 16px', borderBottom: `1px solid ${token.colorBorderSecondary}`, marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Title level={4} style={{ margin: 0, lineHeight: 1 }}>Issues</Title>
                    <Button size="small" icon={<PlusOutlined />} type="primary" onClick={handleStartAdd}>Add Issue</Button>
                </div>
            </div>

            <Splitter style={{ flex: 1, minHeight: 0 }}>
                {/* Left: issue list */}
                <Splitter.Panel defaultSize="35%" min="200px" max="50%">
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '0 12px' }}>
                        <Input
                            placeholder="Search issues..."
                            prefix={<SearchOutlined style={{ color: token.colorTextQuaternary }} />}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            allowClear
                            size="small"
                            style={{ marginBottom: 8 }}
                        />
                        <Select
                            size="small"
                            value={filterStatus}
                            onChange={setFilterStatus}
                            style={{ width: '100%', marginBottom: 8 }}
                            options={[
                                { value: 'all', label: 'All Statuses' },
                                ...STATUS_OPTIONS,
                            ]}
                        />
                        <div style={{ flex: 1, overflow: 'auto' }}>
                            {loading ? null : filteredIssues.length === 0 ? (
                                <Empty description="No issues yet" style={{ marginTop: 40 }} />
                            ) : (
                                <List
                                    dataSource={filteredIssues}
                                    size="small"
                                    renderItem={issue => (
                                        <List.Item
                                            key={issue.id}
                                            onClick={() => {
                                                setSelectedIssueId(issue.id);
                                                setEditing(false);
                                                setIsAdding(false);
                                            }}
                                            style={{
                                                cursor: 'pointer',
                                                padding: '8px 12px',
                                                borderRadius: 6,
                                                background: selectedIssueId === issue.id
                                                    ? token.controlItemBgActive
                                                    : 'transparent',
                                                border: 'none',
                                                marginBottom: 2,
                                                transition: 'background 0.15s',
                                            }}
                                        >
                                            <div style={{ width: '100%' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                                    <Text strong style={{ fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {issue.title}
                                                    </Text>
                                                </div>
                                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                                    <Tag color={STATUS_COLORS[issue.status]} style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }}>
                                                        {STATUS_OPTIONS.find(o => o.value === issue.status)?.label}
                                                    </Tag>
                                                    <Tag color={PRIORITY_COLORS[issue.priority]} style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }}>
                                                        {issue.priority}
                                                    </Tag>
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
                        {showEditForm ? (
                            /* ─── Edit / Add mode ─── */
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                    <Text strong style={{ fontSize: 14 }}>{isAdding ? 'New Issue' : 'Edit Issue'}</Text>
                                    <Space>
                                        <Button size="small" icon={<CheckOutlined />} type="primary" onClick={handleSave}>Save</Button>
                                        <Button size="small" icon={<CloseOutlined />} onClick={handleCancel}>Cancel</Button>
                                    </Space>
                                </div>
                                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                                    <div>
                                        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Title</Text>
                                        <Input
                                            value={editTitle}
                                            onChange={e => setEditTitle(e.target.value)}
                                            placeholder="e.g. Login button not responding"
                                        />
                                    </div>
                                    <div style={{ display: 'flex', gap: 12 }}>
                                        <div style={{ flex: 1 }}>
                                            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Status</Text>
                                            <Select
                                                value={editStatus}
                                                onChange={setEditStatus}
                                                options={STATUS_OPTIONS}
                                                style={{ width: '100%' }}
                                                size="small"
                                            />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Priority</Text>
                                            <Select
                                                value={editPriority}
                                                onChange={setEditPriority}
                                                options={PRIORITY_OPTIONS}
                                                style={{ width: '100%' }}
                                                size="small"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Labels</Text>
                                        <Select
                                            mode="tags"
                                            value={editLabels}
                                            onChange={setEditLabels}
                                            style={{ width: '100%' }}
                                            size="small"
                                            placeholder="Type to add labels..."
                                            tokenSeparators={[',']}
                                        />
                                    </div>
                                    <div>
                                        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Description</Text>
                                        <TextArea
                                            value={editDescription}
                                            onChange={e => setEditDescription(e.target.value)}
                                            rows={6}
                                            placeholder="Describe the issue..."
                                        />
                                    </div>
                                </Space>
                            </div>
                        ) : selectedIssue ? (
                            /* ─── View mode ─── */
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                    <Title level={4} style={{ margin: 0 }}>{selectedIssue.title}</Title>
                                    <Space>
                                        <Tooltip title="Edit Issue">
                                            <Button size="small" icon={<EditOutlined />} onClick={() => handleStartEdit(selectedIssue)} />
                                        </Tooltip>
                                        <Popconfirm title="Delete this issue?" onConfirm={() => handleDelete(selectedIssue.id)}>
                                            <Button size="small" danger icon={<DeleteOutlined />} />
                                        </Popconfirm>
                                    </Space>
                                </div>

                                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                                    <Tag color={STATUS_COLORS[selectedIssue.status]}>
                                        {STATUS_OPTIONS.find(o => o.value === selectedIssue.status)?.label}
                                    </Tag>
                                    <Tag color={PRIORITY_COLORS[selectedIssue.priority]}>
                                        {selectedIssue.priority.charAt(0).toUpperCase() + selectedIssue.priority.slice(1)}
                                    </Tag>
                                    {selectedIssue.labels.map(label => (
                                        <Tag key={label}>{label}</Tag>
                                    ))}
                                </div>

                                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 12 }}>
                                    Created: {new Date(selectedIssue.createdAt).toLocaleString()} · Updated: {new Date(selectedIssue.updatedAt).toLocaleString()}
                                </Text>

                                {selectedIssue.description && (
                                    <>
                                        <Divider style={{ margin: '12px 0' }} />
                                        <Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 12 }}>
                                            {selectedIssue.description}
                                        </Paragraph>
                                    </>
                                )}
                            </div>
                        ) : (
                            <Empty description="Select an issue to view details" style={{ marginTop: 60 }} />
                        )}
                    </div>
                </Splitter.Panel>
            </Splitter>
        </div>
    );
};
