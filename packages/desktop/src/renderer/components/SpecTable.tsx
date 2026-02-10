/**
 * View component — task-list style spec table with tree structure.
 * Fixed checkbox column for batch selection, right-click context menu, click title to open detail.
 */
import React, { useMemo, useState, useEffect } from 'react';
import {
    Input,
    Tag,
    Button,
    Typography,
    Tooltip,
    Checkbox,
    Dropdown,
    Spin,
    Space,
    Select,
    message,
} from 'antd';
import type { MenuProps } from 'antd';
import {
    SearchOutlined,
    FileTextOutlined,
    ExpandAltOutlined,
    ShrinkOutlined,
    PlusOutlined,
    DeleteOutlined,
} from '@ant-design/icons';
import type { SpecTreeNode, MoveSpecPayload } from '@specbook/shared';

const { Text } = Typography;

interface SpecTableProps {
    specs: SpecTreeNode[];
    loading: boolean;
    onDelete: (id: string) => Promise<void>;
    onOpen: (id: string) => void;
    onAddSibling: (afterId: string, parentId: string | null) => void;
    onAddChild: (parentId: string) => void;
    onAddRoot: () => void;
    onBatchDelete: (ids: string[]) => Promise<void>;
    onBatchMove: (ids: string[], newParentId: string | null) => Promise<void>;
}

// ─── Colors ────────────────────────────────────────
const CONTEXT_COLORS = [
    'blue', 'green', 'orange', 'purple', 'cyan',
    'magenta', 'gold', 'lime', 'geekblue', 'volcano',
];

function getContextColor(context: string, allContexts: string[]): string {
    const idx = allContexts.indexOf(context);
    return CONTEXT_COLORS[idx % CONTEXT_COLORS.length];
}

function collectContexts(nodes: SpecTreeNode[]): string[] {
    const set = new Set<string>();
    const walk = (list: SpecTreeNode[]) => {
        for (const n of list) { set.add(n.context); if (n.children) walk(n.children); }
    };
    walk(nodes);
    return [...set].sort();
}

function filterTree(nodes: SpecTreeNode[], lowerFilter: string): SpecTreeNode[] {
    const result: SpecTreeNode[] = [];
    for (const n of nodes) {
        const childMatch = n.children ? filterTree(n.children, lowerFilter) : [];
        const selfMatch = n.title.toLowerCase().includes(lowerFilter) || n.context.toLowerCase().includes(lowerFilter);
        if (selfMatch || childMatch.length > 0) {
            result.push({ ...n, children: childMatch.length > 0 ? childMatch : n.children });
        }
    }
    return result;
}

function countNodes(nodes: SpecTreeNode[]): number {
    let c = 0;
    for (const n of nodes) { c += 1; if (n.children) c += countNodes(n.children); }
    return c;
}

function collectParentIds(nodes: SpecTreeNode[]): string[] {
    const ids: string[] = [];
    const walk = (list: SpecTreeNode[]) => {
        for (const n of list) {
            if (n.children && n.children.length > 0) { ids.push(n.id); walk(n.children); }
        }
    };
    walk(nodes);
    return ids;
}

function collectAllIds(nodes: SpecTreeNode[]): string[] {
    const ids: string[] = [];
    const walk = (list: SpecTreeNode[]) => {
        for (const n of list) { ids.push(n.id); if (n.children) walk(n.children); }
    };
    walk(nodes);
    return ids;
}

/** Flatten tree for parent selector in batch move. */
function flattenTree(nodes: SpecTreeNode[], depth = 0): { id: string; label: string }[] {
    const result: { id: string; label: string }[] = [];
    for (const n of nodes) {
        result.push({ id: n.id, label: '\u00A0\u00A0'.repeat(depth) + n.title });
        if (n.children) result.push(...flattenTree(n.children, depth + 1));
    }
    return result;
}

// ─── Single Row ──────────────────────────────────────

interface RowProps {
    node: SpecTreeNode;
    depth: number;
    allContexts: string[];
    expanded: boolean;
    hasChildren: boolean;
    hoveredRow: string | null;
    selected: boolean;
    onToggleExpand: (id: string) => void;
    onToggleSelect: (id: string) => void;
    onHover: (id: string | null) => void;
    onOpen: (id: string) => void;
    onAddSibling: (afterId: string, parentId: string | null) => void;
    onAddChild: (parentId: string) => void;
    onDelete: (id: string) => void;
}

const SpecRow: React.FC<RowProps> = ({
    node, depth, allContexts, expanded, hasChildren, hoveredRow, selected,
    onToggleExpand, onToggleSelect, onHover, onOpen, onAddSibling, onAddChild, onDelete,
}) => {
    const isHovered = hoveredRow === node.id;

    const contextMenuItems: MenuProps['items'] = [
        { key: 'open', label: '📂 Open detail' },
        { type: 'divider' },
        { key: 'add-sibling', label: '↓ Add sibling below' },
        { key: 'add-child', label: '→ Add child' },
        { type: 'divider' },
        { key: 'delete', label: '🗑 Delete', danger: true },
    ];

    const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
        switch (key) {
            case 'open': onOpen(node.id); break;
            case 'add-sibling': onAddSibling(node.id, node.parentId); break;
            case 'add-child': onAddChild(node.id); break;
            case 'delete': onDelete(node.id); break;
        }
    };

    return (
        <Dropdown menu={{ items: contextMenuItems, onClick: handleMenuClick }} trigger={['contextMenu']}>
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    minHeight: 34,
                    background: selected ? '#e6f7ff' : isHovered ? '#f5f5f5' : 'transparent',
                    transition: 'background 0.12s',
                    cursor: 'default',
                }}
                onMouseEnter={() => onHover(node.id)}
                onMouseLeave={() => onHover(null)}
            >
                {/* Fixed checkbox column — always aligned */}
                <div style={{ width: 36, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Checkbox
                        checked={selected}
                        onChange={() => onToggleSelect(node.id)}
                    />
                </div>

                {/* Indented content */}
                <div
                    style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        paddingLeft: depth * 20,
                        paddingRight: 8,
                    }}
                >
                    {/* Expand toggle */}
                    <span
                        style={{
                            width: 16,
                            flexShrink: 0,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: hasChildren ? 'pointer' : 'default',
                            fontSize: 9,
                            color: '#bbb',
                            userSelect: 'none',
                            marginRight: 4,
                        }}
                        onClick={() => hasChildren && onToggleExpand(node.id)}
                    >
                        {hasChildren ? (expanded ? '▼' : '▶') : ''}
                    </span>

                    {/* Context tag (root only) */}
                    {!node.parentId && (
                        <Tag
                            color={getContextColor(node.context, allContexts)}
                            style={{ marginRight: 8, flexShrink: 0, fontSize: 11 }}
                        >
                            {node.context}
                        </Tag>
                    )}

                    {/* Title — click to open */}
                    <Text
                        style={{ flex: 1, cursor: 'pointer' }}
                        onClick={() => onOpen(node.id)}
                    >
                        {node.hasContent && (
                            <FileTextOutlined style={{ color: '#1677ff', marginRight: 6, fontSize: 12 }} />
                        )}
                        {node.title}
                    </Text>
                </div>
            </div>
        </Dropdown>
    );
};

// ─── Recursive tree renderer ─────────────────────────

interface TreeRendererProps {
    nodes: SpecTreeNode[];
    depth: number;
    expandedKeys: Set<string>;
    selectedIds: Set<string>;
    allContexts: string[];
    hoveredRow: string | null;
    onToggleExpand: (id: string) => void;
    onToggleSelect: (id: string) => void;
    onHover: (id: string | null) => void;
    onOpen: (id: string) => void;
    onAddSibling: (afterId: string, parentId: string | null) => void;
    onAddChild: (parentId: string) => void;
    onDelete: (id: string) => void;
}

const TreeRenderer: React.FC<TreeRendererProps> = ({ nodes, depth, expandedKeys, selectedIds, ...rest }) => (
    <>
        {nodes.map(node => {
            const hasChildren = !!(node.children && node.children.length > 0);
            const isExpanded = expandedKeys.has(node.id);
            return (
                <React.Fragment key={node.id}>
                    <SpecRow
                        node={node}
                        depth={depth}
                        hasChildren={hasChildren}
                        expanded={isExpanded}
                        selected={selectedIds.has(node.id)}
                        {...rest}
                    />
                    {hasChildren && isExpanded && (
                        <TreeRenderer
                            nodes={node.children!}
                            depth={depth + 1}
                            expandedKeys={expandedKeys}
                            selectedIds={selectedIds}
                            {...rest}
                        />
                    )}
                </React.Fragment>
            );
        })}
    </>
);

// ─── Main Component ─────────────────────────────────

export const SpecTable: React.FC<SpecTableProps> = ({
    specs, loading, onDelete, onOpen, onAddSibling, onAddChild, onAddRoot, onBatchDelete, onBatchMove,
}) => {
    const [filterText, setFilterText] = useState('');
    const [hoveredRow, setHoveredRow] = useState<string | null>(null);
    const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const allContexts = useMemo(() => collectContexts(specs), [specs]);
    const displaySpecs = useMemo(() => {
        if (!filterText) return specs;
        return filterTree(specs, filterText.toLowerCase());
    }, [specs, filterText]);
    const totalCount = useMemo(() => countNodes(specs), [specs]);
    const filteredCount = useMemo(() => countNodes(displaySpecs), [displaySpecs]);
    const allParentIds = useMemo(() => collectParentIds(displaySpecs), [displaySpecs]);
    const allIds = useMemo(() => collectAllIds(displaySpecs), [displaySpecs]);
    const flatList = useMemo(() => flattenTree(specs), [specs]);

    useEffect(() => {
        setExpandedKeys(new Set(collectParentIds(specs)));
    }, [specs]);

    // Clear selection when specs change
    useEffect(() => {
        setSelectedIds(new Set());
    }, [specs]);

    const isAllExpanded = allParentIds.length > 0 && expandedKeys.size >= allParentIds.length;
    const isAllSelected = allIds.length > 0 && selectedIds.size === allIds.length;
    const isSomeSelected = selectedIds.size > 0;

    const toggleExpand = (id: string) => {
        setExpandedKeys(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (isAllSelected) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(allIds));
        }
    };

    const expandAll = () => setExpandedKeys(new Set(allParentIds));
    const collapseAll = () => setExpandedKeys(new Set());

    const handleBatchDelete = async () => {
        if (selectedIds.size === 0) return;
        await onBatchDelete([...selectedIds]);
        setSelectedIds(new Set());
    };

    // Batch move state
    const [batchMoveOpen, setBatchMoveOpen] = useState(false);
    const [batchMoveTarget, setBatchMoveTarget] = useState<string | null>(null);

    const handleBatchMoveConfirm = async () => {
        if (selectedIds.size === 0) return;
        await onBatchMove([...selectedIds], batchMoveTarget);
        setBatchMoveOpen(false);
        setBatchMoveTarget(null);
        setSelectedIds(new Set());
    };

    return (
        <div>
            {/* Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Input
                    placeholder="Filter..."
                    prefix={<SearchOutlined />}
                    allowClear
                    value={filterText}
                    onChange={e => setFilterText(e.target.value)}
                    style={{ width: 200 }}
                    size="small"
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
                <div style={{ flex: 1 }} />
                <Text type="secondary" style={{ fontSize: 11 }}>
                    {filteredCount} / {totalCount}
                </Text>
            </div>

            {/* Batch action bar */}
            {isSomeSelected && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 12px',
                    marginBottom: 4,
                    background: '#e6f7ff',
                    borderRadius: 4,
                    fontSize: 13,
                }}>
                    <Text strong style={{ fontSize: 12 }}>{selectedIds.size} selected</Text>
                    <Button size="small" danger icon={<DeleteOutlined />} onClick={handleBatchDelete}>
                        Delete
                    </Button>
                    <Button size="small" onClick={() => setBatchMoveOpen(!batchMoveOpen)}>
                        Move to...
                    </Button>
                    {batchMoveOpen && (
                        <>
                            <Select
                                size="small"
                                value={batchMoveTarget}
                                onChange={setBatchMoveTarget}
                                style={{ width: 200 }}
                                allowClear
                                showSearch
                                placeholder="Root level"
                                options={flatList
                                    .filter(f => !selectedIds.has(f.id))
                                    .map(f => ({ value: f.id, label: f.label }))
                                }
                                filterOption={(input, option) =>
                                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                }
                            />
                            <Button size="small" type="primary" onClick={handleBatchMoveConfirm}>
                                Confirm
                            </Button>
                        </>
                    )}
                    <Button size="small" type="text" onClick={() => setSelectedIds(new Set())}>
                        Clear
                    </Button>
                </div>
            )}

            {/* Table header row */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                borderBottom: '1px solid #e8e8e8',
                padding: '4px 0',
                color: '#999',
                fontSize: 11,
            }}>
                <div style={{ width: 36, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Checkbox
                        checked={isAllSelected}
                        indeterminate={isSomeSelected && !isAllSelected}
                        onChange={toggleSelectAll}
                    />
                </div>
                <Text type="secondary" style={{ fontSize: 11 }}>Title</Text>
            </div>

            {/* Tree rows */}
            <div>
                {loading ? (
                    <div style={{ padding: 24, textAlign: 'center' }}>
                        <Spin size="small" />
                    </div>
                ) : displaySpecs.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center', color: '#999', fontSize: 13 }}>
                        {totalCount === 0 ? 'No specs yet. Click + to add one.' : 'No matching items.'}
                    </div>
                ) : (
                    <TreeRenderer
                        nodes={displaySpecs}
                        depth={0}
                        expandedKeys={expandedKeys}
                        selectedIds={selectedIds}
                        allContexts={allContexts}
                        hoveredRow={hoveredRow}
                        onToggleExpand={toggleExpand}
                        onToggleSelect={toggleSelect}
                        onHover={setHoveredRow}
                        onOpen={onOpen}
                        onAddSibling={onAddSibling}
                        onAddChild={onAddChild}
                        onDelete={onDelete}
                    />
                )}

                {/* Add row button */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '6px 8px',
                        paddingLeft: 36,
                        cursor: 'pointer',
                        color: '#999',
                        fontSize: 13,
                        transition: 'color 0.15s',
                    }}
                    onClick={onAddRoot}
                    onMouseEnter={e => (e.currentTarget.style.color = '#1677ff')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#999')}
                >
                    <PlusOutlined style={{ marginRight: 6 }} />
                    New spec
                </div>
            </div>
        </div>
    );
};
