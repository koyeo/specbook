/**
 * View component — task-list style spec table with tree structure.
 * Checkbox at row start, right-click context menu, click title to open detail.
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
} from 'antd';
import type { MenuProps } from 'antd';
import {
    SearchOutlined,
    FileTextOutlined,
    ExpandAltOutlined,
    ShrinkOutlined,
    PlusOutlined,
} from '@ant-design/icons';
import type { SpecTreeNode } from '@specbook/shared';

const { Text } = Typography;

interface SpecTableProps {
    specs: SpecTreeNode[];
    loading: boolean;
    onToggleCompleted: (id: string, completed: boolean) => void;
    onDelete: (id: string) => Promise<void>;
    onOpen: (id: string) => void;
    onAddSibling: (afterId: string, parentId: string | null) => void;
    onAddChild: (parentId: string) => void;
    onAddRoot: () => void;
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

function filterTree(nodes: SpecTreeNode[], lowerFilter: string): SpecTreeNode[] {
    const result: SpecTreeNode[] = [];
    for (const n of nodes) {
        const childMatch = n.children ? filterTree(n.children, lowerFilter) : [];
        const selfMatch =
            n.title.toLowerCase().includes(lowerFilter) ||
            n.context.toLowerCase().includes(lowerFilter);
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

// ─── Single Row ──────────────────────────────────────

interface RowProps {
    node: SpecTreeNode;
    depth: number;
    allContexts: string[];
    expanded: boolean;
    hasChildren: boolean;
    hoveredRow: string | null;
    onToggleExpand: (id: string) => void;
    onToggleCheck: (id: string, checked: boolean) => void;
    onHover: (id: string | null) => void;
    onOpen: (id: string) => void;
    onAddSibling: (afterId: string, parentId: string | null) => void;
    onAddChild: (parentId: string) => void;
    onDelete: (id: string) => void;
}

const SpecRow: React.FC<RowProps> = ({
    node,
    depth,
    allContexts,
    expanded,
    hasChildren,
    hoveredRow,
    onToggleExpand,
    onToggleCheck,
    onHover,
    onOpen,
    onAddSibling,
    onAddChild,
    onDelete,
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
        <Dropdown
            menu={{ items: contextMenuItems, onClick: handleMenuClick }}
            trigger={['contextMenu']}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '5px 8px',
                    paddingLeft: 8 + depth * 24,
                    background: isHovered ? '#fafafa' : 'transparent',
                    transition: 'background 0.15s',
                    cursor: 'default',
                    minHeight: 34,
                }}
                onMouseEnter={() => onHover(node.id)}
                onMouseLeave={() => onHover(null)}
            >
                {/* Expand toggle */}
                <span
                    style={{
                        width: 18,
                        flexShrink: 0,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: hasChildren ? 'pointer' : 'default',
                        fontSize: 9,
                        color: '#bbb',
                        userSelect: 'none',
                    }}
                    onClick={() => hasChildren && onToggleExpand(node.id)}
                >
                    {hasChildren ? (expanded ? '▼' : '▶') : ''}
                </span>

                {/* Checkbox */}
                <Checkbox
                    checked={node.completed}
                    onChange={(e) => onToggleCheck(node.id, e.target.checked)}
                    style={{ marginRight: 8 }}
                />

                {/* Context tag (root level only) */}
                {!node.parentId && (
                    <Tag
                        color={getContextColor(node.context, allContexts)}
                        style={{ marginRight: 8, flexShrink: 0, fontSize: 11 }}
                    >
                        {node.context}
                    </Tag>
                )}

                {/* Title — click to open detail */}
                <Text
                    style={{
                        flex: 1,
                        textDecoration: node.completed ? 'line-through' : 'none',
                        color: node.completed ? '#999' : undefined,
                        cursor: 'pointer',
                    }}
                    onClick={() => onOpen(node.id)}
                >
                    {node.hasContent && (
                        <FileTextOutlined style={{ color: '#1677ff', marginRight: 6, fontSize: 12 }} />
                    )}
                    {node.title}
                </Text>
            </div>
        </Dropdown>
    );
};

// ─── Recursive tree renderer ─────────────────────────

interface TreeRendererProps {
    nodes: SpecTreeNode[];
    depth: number;
    expandedKeys: Set<string>;
    allContexts: string[];
    hoveredRow: string | null;
    onToggleExpand: (id: string) => void;
    onToggleCheck: (id: string, checked: boolean) => void;
    onHover: (id: string | null) => void;
    onOpen: (id: string) => void;
    onAddSibling: (afterId: string, parentId: string | null) => void;
    onAddChild: (parentId: string) => void;
    onDelete: (id: string) => void;
}

const TreeRenderer: React.FC<TreeRendererProps> = ({
    nodes,
    depth,
    expandedKeys,
    ...rest
}) => {
    return (
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
                            {...rest}
                        />
                        {hasChildren && isExpanded && (
                            <TreeRenderer
                                nodes={node.children!}
                                depth={depth + 1}
                                expandedKeys={expandedKeys}
                                {...rest}
                            />
                        )}
                    </React.Fragment>
                );
            })}
        </>
    );
};

// ─── Main Component ─────────────────────────────────

export const SpecTable: React.FC<SpecTableProps> = ({
    specs,
    loading,
    onToggleCompleted,
    onDelete,
    onOpen,
    onAddSibling,
    onAddChild,
    onAddRoot,
}) => {
    const [filterText, setFilterText] = useState('');
    const [hoveredRow, setHoveredRow] = useState<string | null>(null);
    const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

    const allContexts = useMemo(() => collectContexts(specs), [specs]);
    const displaySpecs = useMemo(() => {
        if (!filterText) return specs;
        return filterTree(specs, filterText.toLowerCase());
    }, [specs, filterText]);
    const totalCount = useMemo(() => countNodes(specs), [specs]);
    const filteredCount = useMemo(() => countNodes(displaySpecs), [displaySpecs]);
    const allParentIds = useMemo(() => collectParentIds(displaySpecs), [displaySpecs]);

    useEffect(() => {
        setExpandedKeys(new Set(collectParentIds(specs)));
    }, [specs]);

    const isAllExpanded = allParentIds.length > 0 && expandedKeys.size >= allParentIds.length;

    const toggleExpand = (id: string) => {
        setExpandedKeys(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const expandAll = () => setExpandedKeys(new Set(allParentIds));
    const collapseAll = () => setExpandedKeys(new Set());

    return (
        <div>
            {/* Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
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

            {/* Tree rows — no border */}
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
                        allContexts={allContexts}
                        hoveredRow={hoveredRow}
                        onToggleExpand={toggleExpand}
                        onToggleCheck={onToggleCompleted}
                        onHover={setHoveredRow}
                        onOpen={onOpen}
                        onAddSibling={onAddSibling}
                        onAddChild={onAddChild}
                        onDelete={onDelete}
                    />
                )}

                {/* Add row button at bottom */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '6px 8px',
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
