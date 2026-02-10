/**
 * View component — antd Table for spec display.
 * Columns: Context (first), Title (second).
 * Supports filter, sort, and group-by.
 */
import React, { useMemo, useState } from 'react';
import {
    Table,
    Input,
    Tag,
    Button,
    Space,
    Switch,
    Popconfirm,
    Typography,
} from 'antd';
import {
    DeleteOutlined,
    SearchOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { SpecSummary, UpdateSpecPayload } from '@specbook/shared';

const { Text } = Typography;

interface SpecTableProps {
    specs: SpecSummary[];
    loading: boolean;
    onUpdate: (payload: UpdateSpecPayload) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
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

export const SpecTable: React.FC<SpecTableProps> = ({
    specs,
    loading,
    onUpdate,
    onDelete,
}) => {
    const [filterText, setFilterText] = useState('');
    const [groupByEnabled, setGroupByEnabled] = useState(false);
    const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
    const [editValue, setEditValue] = useState('');

    // Unique contexts
    const allContexts = useMemo(() =>
        [...new Set(specs.map(s => s.context))].sort(),
        [specs],
    );

    // Filter
    const filteredSpecs = useMemo(() => {
        if (!filterText) return specs;
        const lower = filterText.toLowerCase();
        return specs.filter(s =>
            s.title.toLowerCase().includes(lower) ||
            s.context.toLowerCase().includes(lower),
        );
    }, [specs, filterText]);

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

    // ─── Columns (Context first, then Title) ─────────
    const columns: ColumnsType<SpecSummary> = [
        {
            title: 'Context',
            dataIndex: 'context',
            key: 'context',
            width: 180,
            sorter: (a, b) => a.context.localeCompare(b.context),
            filters: allContexts.map(c => ({ text: c, value: c })),
            onFilter: (value, record) => record.context === value,
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
                return (
                    <Tag
                        color={getContextColor(text, allContexts)}
                        style={{ cursor: 'pointer' }}
                        onDoubleClick={() => startEdit(record.id, 'context', text)}
                    >
                        {text}
                    </Tag>
                );
            },
        },
        {
            title: 'Title',
            dataIndex: 'title',
            key: 'title',
            sorter: (a, b) => a.title.localeCompare(b.title),
            ellipsis: true,
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
                    <Text
                        style={{ cursor: 'pointer' }}
                        onDoubleClick={() => startEdit(record.id, 'title', text)}
                    >
                        {text}
                    </Text>
                );
            },
        },
        {
            title: '',
            key: 'actions',
            width: 60,
            render: (_, record) => (
                <Popconfirm
                    title="Delete this spec?"
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
                    <Space size={4}>
                        <Text type="secondary" style={{ fontSize: 12 }}>Group by:</Text>
                        <Switch
                            size="small"
                            checked={groupByEnabled}
                            onChange={setGroupByEnabled}
                        />
                    </Space>
                </Space>
                <Text type="secondary" style={{ fontSize: 12 }}>
                    {filteredSpecs.length} / {specs.length} items
                </Text>
            </Space>

            {/* Table */}
            <Table
                dataSource={filteredSpecs}
                columns={columns}
                rowKey="id"
                loading={loading}
                size="middle"
                pagination={false}
                locale={{ emptyText: specs.length === 0 ? 'No specs yet. Add one above.' : 'No matching items.' }}
                {...(groupByEnabled && allContexts.length > 0
                    ? {
                        defaultSortOrder: 'ascend' as const,
                        sortDirections: ['ascend' as const, 'descend' as const],
                    }
                    : {}
                )}
            />
        </div>
    );
};
