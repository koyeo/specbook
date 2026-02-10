/**
 * View component — task-list style spec table with tree structure.
 * Fixed checkbox column for batch selection (visible on hover/selected only).
 * Uses antd theme tokens for dark/light mode compatibility.
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
    Select,
    theme,
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
import type { SpecTreeNode } from '@specbook/shared';

const { Text } = Typography;
const { useToken } = theme;

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

const CONTEXT_COLORS = [
    'blue', 'green', 'orange', 'purple', 'cyan',
    'magenta', 'gold', 'lime', 'geekblue', 'volcano',
];

function getContextColor(ctx: string, all: string[]): string {
    return CONTEXT_COLORS[all.indexOf(ctx) % CONTEXT_COLORS.length];
}

function collectContexts(nodes: SpecTreeNode[]): string[] {
    const s = new Set<string>();
    const w = (l: SpecTreeNode[]) => { for (const n of l) { s.add(n.context); if (n.children) w(n.children); } };
    w(nodes);
    return [...s].sort();
}

function filterTree(nodes: SpecTreeNode[], q: string): SpecTreeNode[] {
    const r: SpecTreeNode[] = [];
    for (const n of nodes) {
        const cm = n.children ? filterTree(n.children, q) : [];
        if (n.title.toLowerCase().includes(q) || n.context.toLowerCase().includes(q) || cm.length > 0)
            r.push({ ...n, children: cm.length > 0 ? cm : n.children });
    }
    return r;
}

function countNodes(nodes: SpecTreeNode[]): number {
    let c = 0;
    for (const n of nodes) { c++; if (n.children) c += countNodes(n.children); }
    return c;
}

function collectParentIds(nodes: SpecTreeNode[]): string[] {
    const ids: string[] = [];
    const w = (l: SpecTreeNode[]) => { for (const n of l) { if (n.children?.length) { ids.push(n.id); w(n.children); } } };
    w(nodes);
    return ids;
}

function collectAllIds(nodes: SpecTreeNode[]): string[] {
    const ids: string[] = [];
    const w = (l: SpecTreeNode[]) => { for (const n of l) { ids.push(n.id); if (n.children) w(n.children); } };
    w(nodes);
    return ids;
}

function flattenTree(nodes: SpecTreeNode[], depth = 0): { id: string; label: string }[] {
    const r: { id: string; label: string }[] = [];
    for (const n of nodes) {
        r.push({ id: n.id, label: '\u00A0\u00A0'.repeat(depth) + n.title });
        if (n.children) r.push(...flattenTree(n.children, depth + 1));
    }
    return r;
}

// ─── Row ─────────────────────────────────────────────

interface RowProps {
    node: SpecTreeNode;
    depth: number;
    allContexts: string[];
    expanded: boolean;
    hasChildren: boolean;
    hoveredRow: string | null;
    selected: boolean;
    anySelected: boolean;
    hoverBg: string;
    selectedBg: string;
    borderColor: string;
    onToggleExpand: (id: string) => void;
    onToggleSelect: (id: string) => void;
    onHover: (id: string | null) => void;
    onOpen: (id: string) => void;
    onAddSibling: (afterId: string, parentId: string | null) => void;
    onAddChild: (parentId: string) => void;
    onDelete: (id: string) => void;
}

const SpecRow: React.FC<RowProps> = ({
    node, depth, allContexts, expanded, hasChildren, hoveredRow, selected, anySelected,
    hoverBg, selectedBg, borderColor,
    onToggleExpand, onToggleSelect, onHover, onOpen, onAddSibling, onAddChild, onDelete,
}) => {
    const isHovered = hoveredRow === node.id;
    const showCheckbox = isHovered || selected || anySelected;

    const menuItems: MenuProps['items'] = [
        { key: 'open', label: '📂 Open detail' },
        { type: 'divider' },
        { key: 'add-sibling', label: '↓ Add sibling below' },
        { key: 'add-child', label: '→ Add child' },
        { type: 'divider' },
        { key: 'delete', label: '🗑 Delete', danger: true },
    ];

    const onMenu: MenuProps['onClick'] = ({ key }) => {
        if (key === 'open') onOpen(node.id);
        else if (key === 'add-sibling') onAddSibling(node.id, node.parentId);
        else if (key === 'add-child') onAddChild(node.id);
        else if (key === 'delete') onDelete(node.id);
    };

    return (
        <Dropdown menu={{ items: menuItems, onClick: onMenu }} trigger={['contextMenu']}>
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    minHeight: 34,
                    background: selected ? selectedBg : isHovered ? hoverBg : 'transparent',
                    transition: 'background 0.12s',
                    cursor: 'default',
                }}
                onMouseEnter={() => onHover(node.id)}
                onMouseLeave={() => onHover(null)}
            >
                {/* Checkbox column — fixed width, only visible on hover/selected/anySelected */}
                <div style={{ width: 36, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {showCheckbox ? (
                        <Checkbox checked={selected} onChange={() => onToggleSelect(node.id)} />
                    ) : null}
                </div>

                {/* Indented content */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', paddingLeft: depth * 20, paddingRight: 8 }}>
                    {/* Expand arrow */}
                    <span
                        style={{
                            width: 16, flexShrink: 0, display: 'inline-flex', alignItems: 'center',
                            justifyContent: 'center', cursor: hasChildren ? 'pointer' : 'default',
                            fontSize: 9, color: 'var(--ant-color-text-quaternary)', userSelect: 'none', marginRight: 4,
                        }}
                        onClick={() => hasChildren && onToggleExpand(node.id)}
                    >
                        {hasChildren ? (expanded ? '▼' : '▶') : ''}
                    </span>

                    {/* Context tag (root only) */}
                    {!node.parentId && (
                        <Tag color={getContextColor(node.context, allContexts)} style={{ marginRight: 8, flexShrink: 0, fontSize: 11 }}>
                            {node.context}
                        </Tag>
                    )}

                    {/* Title */}
                    <Text style={{ flex: 1, cursor: 'pointer' }} onClick={() => onOpen(node.id)}>
                        {node.hasContent && <FileTextOutlined style={{ color: 'var(--ant-color-primary)', marginRight: 6, fontSize: 12 }} />}
                        {node.title}
                    </Text>
                </div>
            </div>
        </Dropdown>
    );
};

// ─── Tree renderer ───────────────────────────────────

interface TreeProps {
    nodes: SpecTreeNode[];
    depth: number;
    expandedKeys: Set<string>;
    selectedIds: Set<string>;
    allContexts: string[];
    hoveredRow: string | null;
    anySelected: boolean;
    hoverBg: string;
    selectedBg: string;
    borderColor: string;
    onToggleExpand: (id: string) => void;
    onToggleSelect: (id: string) => void;
    onHover: (id: string | null) => void;
    onOpen: (id: string) => void;
    onAddSibling: (afterId: string, parentId: string | null) => void;
    onAddChild: (parentId: string) => void;
    onDelete: (id: string) => void;
}

const TreeRenderer: React.FC<TreeProps> = ({ nodes, depth, expandedKeys, selectedIds, ...rest }) => (
    <>
        {nodes.map(node => {
            const hasChildren = !!(node.children?.length);
            const isExpanded = expandedKeys.has(node.id);
            return (
                <React.Fragment key={node.id}>
                    <SpecRow node={node} depth={depth} hasChildren={hasChildren} expanded={isExpanded} selected={selectedIds.has(node.id)} {...rest} />
                    {hasChildren && isExpanded && (
                        <TreeRenderer nodes={node.children!} depth={depth + 1} expandedKeys={expandedKeys} selectedIds={selectedIds} {...rest} />
                    )}
                </React.Fragment>
            );
        })}
    </>
);

// ─── Main ────────────────────────────────────────────

export const SpecTable: React.FC<SpecTableProps> = ({
    specs, loading, onDelete, onOpen, onAddSibling, onAddChild, onAddRoot, onBatchDelete, onBatchMove,
}) => {
    const { token } = useToken();

    // Theme-aware colors
    const hoverBg = token.controlItemBgHover;          // e.g. rgba(255,255,255,0.04) in dark
    const selectedBg = token.controlItemBgActive;       // e.g. rgba(22,119,255,0.15)
    const borderColor = token.colorBorderSecondary;

    const [filterText, setFilterText] = useState('');
    const [hoveredRow, setHoveredRow] = useState<string | null>(null);
    const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const allContexts = useMemo(() => collectContexts(specs), [specs]);
    const displaySpecs = useMemo(() => filterText ? filterTree(specs, filterText.toLowerCase()) : specs, [specs, filterText]);
    const totalCount = useMemo(() => countNodes(specs), [specs]);
    const filteredCount = useMemo(() => countNodes(displaySpecs), [displaySpecs]);
    const allParentIds = useMemo(() => collectParentIds(displaySpecs), [displaySpecs]);
    const allIds = useMemo(() => collectAllIds(displaySpecs), [displaySpecs]);
    const flatList = useMemo(() => flattenTree(specs), [specs]);

    useEffect(() => { setExpandedKeys(new Set(collectParentIds(specs))); }, [specs]);
    useEffect(() => { setSelectedIds(new Set()); }, [specs]);

    const isAllExpanded = allParentIds.length > 0 && expandedKeys.size >= allParentIds.length;
    const anySelected = selectedIds.size > 0;
    const isAllSelected = allIds.length > 0 && selectedIds.size === allIds.length;

    const toggleExpand = (id: string) => {
        setExpandedKeys(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    };
    const toggleSelect = (id: string) => {
        setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    };
    const toggleSelectAll = () => setSelectedIds(isAllSelected ? new Set() : new Set(allIds));
    const expandAll = () => setExpandedKeys(new Set(allParentIds));
    const collapseAll = () => setExpandedKeys(new Set());

    const handleBatchDelete = async () => {
        if (selectedIds.size === 0) return;
        await onBatchDelete([...selectedIds]);
        setSelectedIds(new Set());
    };

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
                        <Button size="small" icon={isAllExpanded ? <ShrinkOutlined /> : <ExpandAltOutlined />} onClick={isAllExpanded ? collapseAll : expandAll} />
                    </Tooltip>
                )}
                <div style={{ flex: 1 }} />
                <Text type="secondary" style={{ fontSize: 11 }}>{filteredCount} / {totalCount}</Text>
            </div>

            {/* Batch bar */}
            {anySelected && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 12px', marginBottom: 4,
                    background: selectedBg, borderRadius: 4, fontSize: 13,
                }}>
                    <Text strong style={{ fontSize: 12 }}>{selectedIds.size} selected</Text>
                    <Button size="small" danger icon={<DeleteOutlined />} onClick={handleBatchDelete}>Delete</Button>
                    <Button size="small" onClick={() => setBatchMoveOpen(!batchMoveOpen)}>Move to...</Button>
                    {batchMoveOpen && (
                        <>
                            <Select
                                size="small" value={batchMoveTarget} onChange={setBatchMoveTarget}
                                style={{ width: 200 }} allowClear showSearch placeholder="Root level"
                                options={flatList.filter(f => !selectedIds.has(f.id)).map(f => ({ value: f.id, label: f.label }))}
                                filterOption={(i, o) => (o?.label ?? '').toLowerCase().includes(i.toLowerCase())}
                            />
                            <Button size="small" type="primary" onClick={handleBatchMoveConfirm}>Confirm</Button>
                        </>
                    )}
                    <Button size="small" type="text" onClick={() => setSelectedIds(new Set())}>Clear</Button>
                </div>
            )}

            {/* Header */}
            <div style={{
                display: 'flex', alignItems: 'center',
                borderBottom: `1px solid ${borderColor}`, padding: '4px 0',
            }}>
                <div style={{ width: 36, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {anySelected && (
                        <Checkbox checked={isAllSelected} indeterminate={anySelected && !isAllSelected} onChange={toggleSelectAll} />
                    )}
                </div>
                <Text type="secondary" style={{ fontSize: 11 }}>Title</Text>
            </div>

            {/* Rows */}
            <div>
                {loading ? (
                    <div style={{ padding: 24, textAlign: 'center' }}><Spin size="small" /></div>
                ) : displaySpecs.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center', color: token.colorTextQuaternary, fontSize: 13 }}>
                        {totalCount === 0 ? 'No specs yet. Click + to add one.' : 'No matching items.'}
                    </div>
                ) : (
                    <TreeRenderer
                        nodes={displaySpecs} depth={0} expandedKeys={expandedKeys} selectedIds={selectedIds}
                        allContexts={allContexts} hoveredRow={hoveredRow} anySelected={anySelected}
                        hoverBg={hoverBg} selectedBg={selectedBg} borderColor={borderColor}
                        onToggleExpand={toggleExpand} onToggleSelect={toggleSelect}
                        onHover={setHoveredRow} onOpen={onOpen} onAddSibling={onAddSibling}
                        onAddChild={onAddChild} onDelete={onDelete}
                    />
                )}

                {/* + New spec */}
                <div
                    style={{
                        display: 'flex', alignItems: 'center', padding: '6px 8px', paddingLeft: 36,
                        cursor: 'pointer', color: token.colorTextQuaternary, fontSize: 13, transition: 'color 0.15s',
                    }}
                    onClick={onAddRoot}
                    onMouseEnter={e => (e.currentTarget.style.color = token.colorPrimary)}
                    onMouseLeave={e => (e.currentTarget.style.color = token.colorTextQuaternary)}
                >
                    <PlusOutlined style={{ marginRight: 6 }} /> New spec
                </div>
            </div>
        </div>
    );
};
