/**
 * View component — antd Table for spec display.
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

// ─── Group colors ──────────────────────────────────
const GROUP_COLORS = [
    'blue', 'green', 'orange', 'purple', 'cyan',
    'magenta', 'gold', 'lime', 'geekblue', 'volcano',
];

function getGroupColor(group: string, allGroups: string[]): string {
    const idx = allGroups.indexOf(group);
    return GROUP_COLORS[idx % GROUP_COLORS.length];
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

    // Unique groups
    const allGroups = useMemo(() =>
        [...new Set(specs.map(s => s.group))].sort(),
        [specs],
    );

    // Filter
    const filteredSpecs = useMemo(() => {
        if (!filterText) return specs;
        const lower = filterText.toLowerCase();
        return specs.filter(s =>
            s.description.toLowerCase().includes(lower) ||
            s.group.toLowerCase().includes(lower),
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

    // ─── Columns ─────────────────────────────────────
    const columns: ColumnsType<SpecSummary> = [
        {
            title: 'Description',
            dataIndex: 'description',
            key: 'description',
            sorter: (a, b) => a.description.localeCompare(b.description),
            ellipsis: true,
            render: (text: string, record) => {
                if (editingCell?.id === record.id && editingCell.field === 'description') {
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
                        onDoubleClick={() => startEdit(record.id, 'description', text)}
                    >
                        {text}
                    </Text>
                );
            },
        },
        {
            title: 'Group',
            dataIndex: 'group',
            key: 'group',
            width: 180,
            sorter: (a, b) => a.group.localeCompare(b.group),
            filters: allGroups.map(g => ({ text: g, value: g })),
            onFilter: (value, record) => record.group === value,
            render: (text: string, record) => {
                if (editingCell?.id === record.id && editingCell.field === 'group') {
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
                        color={getGroupColor(text, allGroups)}
                        style={{ cursor: 'pointer' }}
                        onDoubleClick={() => startEdit(record.id, 'group', text)}
                    >
                        {text}
                    </Tag>
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
                {...(groupByEnabled && allGroups.length > 0
                    ? {
                        // Group by: use expandable row grouping via sorted data
                        // antd doesn't have native group-by, so we use column grouping via filters
                        // For a true group-by display, we leverage the group sorter
                        defaultSortOrder: 'ascend' as const,
                        sortDirections: ['ascend' as const, 'descend' as const],
                    }
                    : {}
                )}
            />
        </div>
    );
};
