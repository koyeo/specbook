/**
 * RequirementLocationEditor — side-by-side requirements + locations editor
 * with CSS-based connection lines and drag-to-link interaction.
 */
import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { Input, Button, Typography, theme } from 'antd';
import { PlusOutlined, DeleteOutlined, HolderOutlined } from '@ant-design/icons';
import type { ObjectRequirement, ImplementationLocation } from '@specbook/shared';

const { Text } = Typography;

// ─── Location string ↔ structured data ──────────────

/** Parse `filepath:line:column keywords` into ImplementationLocation fields. */
function parseLocationString(s: string): Partial<ImplementationLocation> {
    const trimmed = s.trim();
    if (!trimmed) return { filePath: '' };
    // Match: filepath[:line[:column]] [keywords...]
    const match = trimmed.match(/^([^\s]+?)(?::(\d+))?(?::(\d+))?((?:\s+).+)?$/);
    if (!match) return { filePath: trimmed };
    return {
        filePath: match[1],
        line: match[2] ? Number(match[2]) : undefined,
        column: match[3] ? Number(match[3]) : undefined,
        keywords: match[4]?.trim() || undefined,
    };
}

/** Format an ImplementationLocation into the display string. */
function formatLocation(loc: ImplementationLocation): string {
    let s = loc.filePath || '';
    if (loc.line != null) s += `:${loc.line}`;
    if (loc.column != null) s += `:${loc.column}`;
    if (loc.keywords) s += ` ${loc.keywords}`;
    return s;
}

// ─── Types ──────────────────────────────────────────

interface HandlePos {
    id: string;
    x: number;
    y: number;
}

interface RequirementLocationEditorProps {
    title: string;
    requirements: ObjectRequirement[];
    locations: ImplementationLocation[];
    onRequirementsChange: (requirements: ObjectRequirement[]) => void;
    onLocationsChange: (locations: ImplementationLocation[]) => void;
    editable: boolean;
}

// ─── Component ──────────────────────────────────────

export const RequirementLocationEditor: React.FC<RequirementLocationEditorProps> = ({
    title, requirements, locations, onRequirementsChange, onLocationsChange, editable,
}) => {
    const { token } = theme.useToken();
    const containerRef = useRef<HTMLDivElement>(null);
    const reqHandleRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const locHandleRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    // Connection line positions (computed from handle DOM positions)
    const [lines, setLines] = useState<{ reqId: string; locId: string; x1: number; y1: number; x2: number; y2: number }[]>([]);

    // Drag state for linking
    const [dragging, setDragging] = useState<{ reqId: string; startX: number; startY: number; curX: number; curY: number } | null>(null);
    const [hoverLocId, setHoverLocId] = useState<string | null>(null);

    // Drag-sort state
    const [sortDrag, setSortDrag] = useState<{ type: 'rule' | 'location'; dragIdx: number; overIdx: number } | null>(null);

    // ─── Position calculation ────────────────────────

    const recalcLines = useCallback(() => {
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const newLines: typeof lines = [];

        for (const rule of requirements) {
            if (!rule.locationId) continue;
            const reqEl = reqHandleRefs.current.get(rule.id);
            const locEl = locHandleRefs.current.get(rule.locationId);
            if (!reqEl || !locEl) continue;

            const rr = reqEl.getBoundingClientRect();
            const lr = locEl.getBoundingClientRect();
            newLines.push({
                reqId: rule.id,
                locId: rule.locationId,
                x1: rr.left + rr.width / 2 - rect.left,
                y1: rr.top + rr.height / 2 - rect.top,
                x2: lr.left + lr.width / 2 - rect.left,
                y2: lr.top + lr.height / 2 - rect.top,
            });
        }
        setLines(newLines);
    }, [requirements]);

    // Recalculate on data change + resize
    useLayoutEffect(() => {
        recalcLines();
    }, [requirements, locations, recalcLines]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const observer = new ResizeObserver(() => recalcLines());
        observer.observe(container);
        return () => observer.disconnect();
    }, [recalcLines]);

    // Also recalculate after paint settles (for initial render)
    useEffect(() => {
        const timer = setTimeout(recalcLines, 50);
        return () => clearTimeout(timer);
    }, [requirements, locations, recalcLines]);

    // ─── Drag-to-link ────────────────────────────────

    const handleReqHandleMouseDown = useCallback((reqId: string, e: React.MouseEvent) => {
        if (!editable) return;
        e.preventDefault();
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const handleEl = reqHandleRefs.current.get(reqId);
        if (!handleEl) return;
        const hr = handleEl.getBoundingClientRect();
        const startX = hr.left + hr.width / 2 - rect.left;
        const startY = hr.top + hr.height / 2 - rect.top;
        setDragging({ reqId, startX, startY, curX: startX, curY: startY });
    }, [editable]);

    useEffect(() => {
        if (!dragging) return;
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();

        const onMouseMove = (e: MouseEvent) => {
            setDragging(prev => prev ? { ...prev, curX: e.clientX - rect.left, curY: e.clientY - rect.top } : null);
        };

        const onMouseUp = () => {
            if (hoverLocId && dragging) {
                // Create binding
                onRequirementsChange(requirements.map(r => r.id === dragging.reqId ? { ...r, locationId: hoverLocId } : r));
            }
            setDragging(null);
            setHoverLocId(null);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [dragging, hoverLocId, requirements, onRequirementsChange]);

    // ─── CRUD ────────────────────────────────────────

    const addRequirement = () => onRequirementsChange([...requirements, { id: crypto.randomUUID(), text: '' }]);
    const updateRequirementText = (id: string, text: string) => onRequirementsChange(requirements.map(r => r.id === id ? { ...r, text } : r));
    const removeRequirement = (id: string) => onRequirementsChange(requirements.filter(r => r.id !== id));
    const unlinkRequirement = (id: string) => onRequirementsChange(requirements.map(r => r.id === id ? { ...r, locationId: undefined } : r));

    const addLocation = () => onLocationsChange([...locations, { id: crypto.randomUUID(), filePath: '' }]);
    const updateLocationFromString = (id: string, raw: string) => {
        onLocationsChange(locations.map(loc => loc.id === id ? { ...loc, ...parseLocationString(raw) } : loc));
    };
    const removeLocation = (id: string) => {
        onLocationsChange(locations.filter(loc => loc.id !== id));
        // Unbind any requirements referencing this location
        onRequirementsChange(requirements.map(r => r.locationId === id ? { ...r, locationId: undefined } : r));
    };

    // ─── Drag-sort helpers ────────────────────────────

    const reorder = <T,>(list: T[], from: number, to: number): T[] => {
        const result = [...list];
        const [moved] = result.splice(from, 1);
        result.splice(to, 0, moved);
        return result;
    };

    const handleSortDragStart = (type: 'rule' | 'location', idx: number) => (e: React.DragEvent) => {
        e.dataTransfer.effectAllowed = 'move';
        // Need to set data for Firefox
        e.dataTransfer.setData('text/plain', '');
        setSortDrag({ type, dragIdx: idx, overIdx: idx });
    };

    const handleSortDragOver = (type: 'rule' | 'location', idx: number) => (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (sortDrag && sortDrag.type === type) {
            setSortDrag(prev => prev ? { ...prev, overIdx: idx } : null);
        }
    };

    const handleSortDrop = (type: 'rule' | 'location') => (e: React.DragEvent) => {
        e.preventDefault();
        if (!sortDrag || sortDrag.type !== type) return;
        const { dragIdx, overIdx } = sortDrag;
        if (dragIdx !== overIdx) {
            if (type === 'rule') {
                onRequirementsChange(reorder(requirements, dragIdx, overIdx));
            } else {
                onLocationsChange(reorder(locations, dragIdx, overIdx));
            }
        }
        setSortDrag(null);
    };

    const handleSortDragEnd = () => {
        setSortDrag(null);
    };

    const sortGripStyle: React.CSSProperties = {
        cursor: 'grab',
        color: token.colorTextQuaternary,
        flexShrink: 0,
        fontSize: 14,
    };

    const rowDropIndicator = (type: 'rule' | 'location', idx: number): React.CSSProperties => {
        if (!sortDrag || sortDrag.type !== type || sortDrag.dragIdx === sortDrag.overIdx) return {};
        if (sortDrag.overIdx === idx) {
            return { borderTop: `2px solid ${token.colorPrimary}` };
        }
        return {};
    };

    // ─── SVG orthogonal path helper ─────────────────

    const CORNER_RADIUS = 6;

    /** Build an SVG path string for an orthogonal (right-angle) route with rounded corners. */
    const orthogonalPath = (x1: number, y1: number, x2: number, y2: number): string => {
        const midX = (x1 + x2) / 2;
        const dy = y2 - y1;
        const absDy = Math.abs(dy);
        const r = Math.min(CORNER_RADIUS, Math.abs(midX - x1), absDy / 2);

        if (r < 1 || absDy < 1) {
            // Fallback to straight line when points are nearly aligned
            return `M ${x1} ${y1} L ${x2} ${y2}`;
        }

        const sy = dy > 0 ? 1 : -1; // vertical direction sign

        return [
            `M ${x1} ${y1}`,
            // Horizontal segment from start toward midX
            `L ${midX - r} ${y1}`,
            // First rounded corner (turn vertical)
            `Q ${midX} ${y1} ${midX} ${y1 + sy * r}`,
            // Vertical segment
            `L ${midX} ${y2 - sy * r}`,
            // Second rounded corner (turn horizontal)
            `Q ${midX} ${y2} ${midX + r} ${y2}`,
            // Horizontal segment to end
            `L ${x2} ${y2}`,
        ].join(' ');
    };

    // ─── Handle style ────────────────────────────────

    const handleStyle = (isHover = false, isLinked = false): React.CSSProperties => ({
        width: 12,
        height: 12,
        borderRadius: '50%',
        border: `2px solid ${isHover ? token.colorPrimary : isLinked ? token.colorPrimary : token.colorBorderSecondary}`,
        background: isHover ? token.colorPrimary : isLinked ? token.colorPrimaryBg : token.colorBgContainer,
        cursor: editable ? 'grab' : 'default',
        flexShrink: 0,
        transition: 'all 0.15s',
        zIndex: 1,
    });

    // ─── Render ──────────────────────────────────────

    const HANDLE_COLOR = token.colorPrimary;
    const DRAG_COLOR = token.colorPrimaryBorderHover;

    return (
        <div
            ref={containerRef}
            style={{
                position: 'relative',
                border: `1px solid ${token.colorBorderSecondary}`,
                borderRadius: token.borderRadius,
                padding: '12px 16px',
                marginBottom: 12,
            }}
        >
            {/* Title */}
            <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 10 }}>{title}</Text>

            {/* Two-column layout */}
            <div style={{ display: 'flex', gap: 24 }}>
                {/* ── Left: Requirements ── */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>Requirements</Text>
                        {editable && <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={addRequirement}>Add</Button>}
                    </div>
                    {requirements.length === 0 ? (
                        <Text type="secondary" style={{ fontSize: 12, fontStyle: 'italic' }}>No requirements defined.</Text>
                    ) : (
                        <div
                            style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
                            onDrop={handleSortDrop('rule')}
                            onDragOver={e => e.preventDefault()}
                        >
                            {requirements.map((r, i) => (
                                <div
                                    key={r.id}
                                    style={{
                                        display: 'flex', gap: 6, alignItems: 'center',
                                        opacity: sortDrag?.type === 'rule' && sortDrag.dragIdx === i ? 0.4 : 1,
                                        ...rowDropIndicator('rule', i),
                                    }}
                                    onDragOver={handleSortDragOver('rule', i)}
                                >
                                    {editable && (
                                        <span
                                            draggable
                                            onDragStart={handleSortDragStart('rule', i)}
                                            onDragEnd={handleSortDragEnd}
                                            style={sortGripStyle}
                                        >
                                            <HolderOutlined />
                                        </span>
                                    )}
                                    <Text type="secondary" style={{ fontSize: 12, flexShrink: 0, width: 18, textAlign: 'right' }}>{i + 1}.</Text>
                                    {editable ? (
                                        <Input
                                            value={r.text}
                                            onChange={e => updateRequirementText(r.id, e.target.value)}
                                            placeholder="Describe a requirement..."
                                            size="small"
                                            style={{ flex: 1 }}
                                        />
                                    ) : (
                                        <Text style={{ flex: 1, fontSize: 13 }}>{r.text || '(empty)'}</Text>
                                    )}
                                    {editable && (
                                        <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeRequirement(r.id)} style={{ flexShrink: 0 }} />
                                    )}
                                    {/* Rule connection handle — after delete */}
                                    <div
                                        ref={el => { if (el) reqHandleRefs.current.set(r.id, el); else reqHandleRefs.current.delete(r.id); }}
                                        style={handleStyle(false, !!r.locationId)}
                                        onMouseDown={e => handleReqHandleMouseDown(r.id, e)}
                                        onDoubleClick={() => editable && r.locationId && unlinkRequirement(r.id)}
                                        title={editable ? (r.locationId ? 'Double-click to unlink, or drag to re-link' : 'Drag to link to a location') : undefined}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Right: Locations ── */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>Locations</Text>
                        {editable && <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={addLocation}>Add</Button>}
                    </div>
                    {locations.length === 0 ? (
                        <Text type="secondary" style={{ fontSize: 12, fontStyle: 'italic' }}>No locations defined.</Text>
                    ) : (
                        <div
                            style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
                            onDrop={handleSortDrop('location')}
                            onDragOver={e => e.preventDefault()}
                        >
                            {locations.map((loc, i) => (
                                <div
                                    key={loc.id}
                                    style={{
                                        display: 'flex', gap: 6, alignItems: 'center',
                                        opacity: sortDrag?.type === 'location' && sortDrag.dragIdx === i ? 0.4 : 1,
                                        ...rowDropIndicator('location', i),
                                    }}
                                    onDragOver={handleSortDragOver('location', i)}
                                >
                                    {/* Location connection handle (left side) */}
                                    <div
                                        ref={el => { if (el) locHandleRefs.current.set(loc.id, el); else locHandleRefs.current.delete(loc.id); }}
                                        style={handleStyle(hoverLocId === loc.id, requirements.some(r => r.locationId === loc.id))}
                                        onMouseEnter={() => dragging && setHoverLocId(loc.id)}
                                        onMouseLeave={() => dragging && setHoverLocId(null)}
                                    />
                                    {editable && (
                                        <span
                                            draggable
                                            onDragStart={handleSortDragStart('location', i)}
                                            onDragEnd={handleSortDragEnd}
                                            style={sortGripStyle}
                                        >
                                            <HolderOutlined />
                                        </span>
                                    )}
                                    <Text type="secondary" style={{ fontSize: 12, flexShrink: 0, width: 18, textAlign: 'right' }}>{i + 1}.</Text>
                                    {editable ? (
                                        <Input
                                            value={formatLocation(loc)}
                                            onChange={e => updateLocationFromString(loc.id, e.target.value)}
                                            placeholder="filepath:line:col keywords"
                                            size="small"
                                            style={{ flex: 1, fontFamily: 'Menlo, Monaco, Consolas, monospace', fontSize: 12 }}
                                        />
                                    ) : (
                                        <Text code style={{ flex: 1, fontSize: 12 }}>{formatLocation(loc) || '(empty)'}</Text>
                                    )}
                                    {editable && (
                                        <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeLocation(loc.id)} style={{ flexShrink: 0 }} />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Connection lines (SVG orthogonal paths) ── */}
            <svg
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible', zIndex: 0 }}
            >
                {lines.map(l => (
                    <path
                        key={`${l.reqId}-${l.locId}`}
                        d={orthogonalPath(l.x1, l.y1, l.x2, l.y2)}
                        fill="none"
                        stroke={HANDLE_COLOR}
                        strokeWidth={2}
                    />
                ))}
                {/* ── Drag-in-progress line ── */}
                {dragging && (
                    <path
                        d={orthogonalPath(dragging.startX, dragging.startY, dragging.curX, dragging.curY)}
                        fill="none"
                        stroke={DRAG_COLOR}
                        strokeWidth={2}
                        strokeDasharray="6 3"
                    />
                )}
            </svg>
        </div>
    );
};
