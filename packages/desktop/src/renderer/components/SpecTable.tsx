/**
 * View component — antd Table with tree structure for spec display.
 * Supports expand/collapse, per-row "+" to add child, and inline editing.
 */
import React, { useMemo, useState, useEffect } from 'react';
import {
    Table,
    Input,
    Tag,
    Button,
    Space,
    Popconfirm,
    Typography,
    Tooltip,
} from 'antd';
import {
    DeleteOutlined,
    SearchOutlined,
    FileTextOutlined,
    PlusOutlined,
    EditOutlined,
    ExpandAltOutlined,
    ShrinkOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { SpecTreeNode, UpdateSpecPayload } from '@specbook/shared';

const { Text } = Typography;

interface SpecTableProps {
    specs: SpecTreeNode[];
    loading: boolean;
    onUpdate: (payload: UpdateSpecPayload) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    onOpen: (id: string) => void;
    onAddChild: (parentId: string) => void;
}

// ─── Context colors ────────────────────────────────
const CONTEXT_COLORS = [
    'blue', 'green', 'orange', 'purple', 'cyan',
    'magenta', 'gold', 'lime', 'geekblue', 'volcano',
];

function getContextColor(context: string, allContexts: string[]): string {
    const idx = allContexts.indexOf(context);
    return CONTEXT_COLORS[idx % CONTEXT_COLORS.length];
}

/** Collect all unique contexts from tree nodes recursively. */
function collectContexts(nodes: SpecTreeNode[]): string[] {
    const set = new Set<string>();
    const walk = (list: SpecTreeNode[]) => {
        for (const n of list) {
            set.add(n.context);
            if (n.children) walk(n.children);
        }
    };
    walk(nodes);
    return [...set].sort();
}

/** Filter tree nodes recursively — keep the node if it or any descendant matches. */
function filterTree(nodes: SpecTreeNode[], lowerFilter: string): SpecTreeNode[] {
    const result: SpecTreeNode[] = [];
    for (const n of nodes) {
        const childMatch = n.children ? filterTree(n.children, lowerFilter) : [];
        const selfMatch =
            n.title.toLowerCase().includes(lowerFilter) ||
            n.context.toLowerCase().includes(lowerFilter);

        if (selfMatch || childMatch.length > 0) {
            result.push({
                ...n,
                children: childMatch.length > 0 ? childMatch : n.children,
            });
        }
    }
    return result;
}

/** Count total nodes in a tree recursively. */
function countNodes(nodes: SpecTreeNode[]): number {
    let c = 0;
    for (const n of nodes) {
        c += 1;
        if (n.children) c += countNodes(n.children);
    }
    return c;
}

/** Collect all IDs that have children (expandable rows). */
function collectParentIds(nodes: SpecTreeNode[]): string[] {
    const ids: string[] = [];
    const walk = (list: SpecTreeNode[]) => {
        for (const n of list) {
            if (n.children && n.children.length > 0) {
                ids.push(n.id);
                walk(n.children);
            }
        }
    };
    walk(nodes);
    return ids;
}

export const SpecTable: React.FC<SpecTableProps> = ({
    specs,
    loading,
    onUpdate,
    onDelete,
    onOpen,
    onAddChild,
}) => {
    const [filterText, setFilterText] = useState('');
    const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
    const [editValue, setEditValue] = useState('');
    const [hoveredRow, setHoveredRow] = useState<string | null>(null);
    const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

    // Unique contexts (from tree)
    const allContexts = useMemo(() => collectContexts(specs), [specs]);

    // Filter tree
    const displaySpecs = useMemo(() => {
        if (!filterText) return specs;
        return filterTree(specs, filterText.toLowerCase());
    }, [specs, filterText]);

    const totalCount = useMemo(() => countNodes(specs), [specs]);
    const filteredCount = useMemo(() => countNodes(displaySpecs), [displaySpecs]);

    // All expandable row IDs
    const allParentIds = useMemo(() => collectParentIds(displaySpecs), [displaySpecs]);

    // Default expand all on first load
    useEffect(() => {
        setExpandedKeys(collectParentIds(specs));
    }, [specs]);

    const expandAll = () => setExpandedKeys(allParentIds);
    const collapseAll = () => setExpandedKeys([]);
    const isAllExpanded = allParentIds.length > 0 && expandedKeys.length >= allParentIds.length;

    // ─── Inline editing ──────────────────────────────
    const startEdit = (id: string, field: string, currentValue: string) => {
        setEditingCell({ id, field });
        setEditValue(currentValue);
    };

    const commitEdit = async () => {
        if (!editingCell || !editValue.trim()) {
            setEditingCell(null);
            return;
        }
        await onUpdate({
            id: editingCell.id,
            [editingCell.field]: editValue.trim(),
        });
        setEditingCell(null);
    };

    const cancelEdit = () => {
        setEditingCell(null);
    };

    // ─── Columns ─────────────────────────────────────
    const columns: ColumnsType<SpecTreeNode> = [
        {
            title: 'Context',
            dataIndex: 'context',
            key: 'context',
            width: 160,
            render: (text: string, record) => {
                if (editingCell?.id === record.id && editingCell.field === 'context') {
                    return (
                        <Input
                            size="small"
                            value={editValue}
                            autoFocus
                            onChange={e => setEditValue(e.target.value)}
                            onPressEnter={commitEdit}
                            onBlur={commitEdit}
                            onKeyDown={e => e.key === 'Escape' && cancelEdit()}
                        />
                    );
                }
                // Only show context tag on root-level specs
                if (!record.parentId) {
                    return (
                        <Tag
                            color={getContextColor(text, allContexts)}
                            style={{ cursor: 'pointer' }}
                            onDoubleClick={() => startEdit(record.id, 'context', text)}
                        >
                            {text}
                        </Tag>
                    );
                }
                return null;
            },
        },
        {
            title: 'Title',
            dataIndex: 'title',
            key: 'title',
            render: (text: string, record) => {
                if (editingCell?.id === record.id && editingCell.field === 'title') {
                    return (
                        <Input
                            size="small"
                            value={editValue}
                            autoFocus
                            onChange={e => setEditValue(e.target.value)}
                            onPressEnter={commitEdit}
                            onBlur={commitEdit}
                            onKeyDown={e => e.key === 'Escape' && cancelEdit()}
                        />
                    );
                }
                return (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <Text
                            style={{ cursor: 'pointer', flex: 1 }}
                            onDoubleClick={() => startEdit(record.id, 'title', text)}
                        >
                            {record.hasContent && (
                                <FileTextOutlined style={{ color: '#1677ff', marginRight: 6, fontSize: 12 }} />
                            )}
                            {text}
                        </Text>
                        {hoveredRow === record.id && (
                            <Button
                                type="link"
                                size="small"
                                style={{ padding: '0 4px', fontSize: 12, flexShrink: 0 }}
                                onClick={() => onOpen(record.id)}
                            >
                                Open
                            </Button>
                        )}
                    </div>
                );
            },
        },
        {
            title: '',
            key: 'actions',
            width: 110,
            render: (_, record) => (
                <Space size={0}>
                    <Tooltip title="Edit">
                        <Button
                            type="text"
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => startEdit(record.id, 'title', record.title)}
                        />
                    </Tooltip>
                    <Tooltip title="Add child">
                        <Button
                            type="text"
                            size="small"
                            icon={<PlusOutlined />}
                            onClick={() => onAddChild(record.id)}
                        />
                    </Tooltip>
                    <Popconfirm
                        title="Delete this spec and all children?"
                        onConfirm={() => onDelete(record.id)}
                        okText="Delete"
                        cancelText="Cancel"
                    >
                        <Button
                            type="text"
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                        />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div>
            {/* Toolbar */}
            <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }} align="center">
                <Space>
                    <Input
                        placeholder="Filter specs..."
                        prefix={<SearchOutlined />}
                        allowClear
                        value={filterText}
                        onChange={e => setFilterText(e.target.value)}
                        style={{ width: 240 }}
                    />
                    {allParentIds.length > 0 && (
                        <Tooltip title={isAllExpanded ? 'Collapse all' : 'Expand all'}>
                            <Button
                                size="small"
                                icon={isAllExpanded ? <ShrinkOutlined /> : <ExpandAltOutlined />}
                                onClick={isAllExpanded ? collapseAll : expandAll}
                            />
                        </Tooltip>
                    )}
                </Space>
                <Text type="secondary" style={{ fontSize: 12 }}>
                    {filteredCount} / {totalCount} items
                </Text>
            </Space>

            {/* Tree Table */}
            <Table
                dataSource={displaySpecs}
                columns={columns}
                rowKey="id"
                loading={loading}
                size="middle"
                pagination={false}
                expandable={{
                    expandedRowKeys: expandedKeys,
                    onExpandedRowsChange: (keys) => setExpandedKeys(keys as string[]),
                    indentSize: 24,
                }}
                locale={{ emptyText: totalCount === 0 ? 'No specs yet. Add one above.' : 'No matching items.' }}
                onRow={(record) => ({
                    onMouseEnter: () => setHoveredRow(record.id),
                    onMouseLeave: () => setHoveredRow(null),
                })}
            />
        </div>
    );
};
