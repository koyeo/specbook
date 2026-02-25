/**
 * GlossaryFloatPanel — draggable floating button + resizable floating panel (no mask).
 */
import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
    Input, List, Tag, Empty, Typography, Segmented, theme, Tooltip, Button, App as AntApp,
} from 'antd';
import {
    BookOutlined, SearchOutlined, SortAscendingOutlined, ClockCircleOutlined,
    CloseOutlined, ArrowLeftOutlined, EyeOutlined, CopyOutlined,
} from '@ant-design/icons';
import { useGlossary } from '../hooks/useGlossary';

const { Title, Text, Paragraph } = Typography;
const { useToken } = theme;

const BTN_SIZE = 40;
const DEFAULT_W = 340;
const DEFAULT_H = 460;
const MIN_W = 260;
const MIN_H = 280;

export const GlossaryFloatPanel: React.FC<{ workspace: string | null }> = ({ workspace }) => {
    const { token } = useToken();
    const { message } = AntApp.useApp();
    const { terms, loading, loadTerms } = useGlossary();
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [sortMode, setSortMode] = useState<'alpha' | 'updated'>('alpha');
    const [selectedId, setSelectedId] = useState<string | null>(null);

    // Button position (right/bottom offsets)
    const [btnPos, setBtnPos] = useState({ right: 24, bottom: 24 });
    const btnDrag = useRef<{ sx: number; sy: number; sr: number; sb: number; moved: boolean } | null>(null);

    // Panel position & size — persisted to localStorage when window size matches
    const STORAGE_KEY = 'specbook-glossary-panel';
    const defaultPos = () => ({ x: window.innerWidth - DEFAULT_W - 24, y: window.innerHeight - DEFAULT_H - 80 });
    const defaultSize = () => ({ w: DEFAULT_W, h: DEFAULT_H });

    const [panelPos, setPanelPos] = useState(defaultPos);
    const [panelSize, setPanelSize] = useState(defaultSize);
    const panelDrag = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);
    const resizeDrag = useRef<{ sx: number; sy: number; sw: number; sh: number } | null>(null);

    const saveLayout = useCallback((pos: { x: number; y: number }, size: { w: number; h: number }) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            pos, size, winW: window.innerWidth, winH: window.innerHeight,
        }));
    }, []);

    const handleOpen = useCallback(() => {
        if (workspace) loadTerms();
        // Try restore saved layout if window size matches
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const saved = JSON.parse(raw);
                if (saved.winW === window.innerWidth && saved.winH === window.innerHeight) {
                    setPanelPos(saved.pos);
                    setPanelSize(saved.size);
                    setOpen(true);
                    return;
                }
            }
        } catch { /* ignore */ }
        // Fallback: default position near button
        const pos = {
            x: window.innerWidth - btnPos.right - DEFAULT_W,
            y: window.innerHeight - btnPos.bottom - DEFAULT_H - BTN_SIZE - 12,
        };
        setPanelPos(pos);
        setPanelSize(defaultSize());
        setOpen(true);
    }, [workspace, btnPos, loadTerms]);

    // ── Button drag ──
    const onBtnMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        btnDrag.current = { sx: e.clientX, sy: e.clientY, sr: btnPos.right, sb: btnPos.bottom, moved: false };
        const onMove = (ev: MouseEvent) => {
            if (!btnDrag.current) return;
            const dx = ev.clientX - btnDrag.current.sx;
            const dy = ev.clientY - btnDrag.current.sy;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) btnDrag.current.moved = true;
            setBtnPos({
                right: Math.max(0, btnDrag.current.sr - dx),
                bottom: Math.max(0, btnDrag.current.sb - dy),
            });
        };
        const onUp = () => {
            if (btnDrag.current && !btnDrag.current.moved) handleOpen();
            btnDrag.current = null;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }, [btnPos, handleOpen]);

    // ── Panel title-bar drag ──
    const onPanelDragStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        panelDrag.current = { sx: e.clientX, sy: e.clientY, px: panelPos.x, py: panelPos.y };
        const onMove = (ev: MouseEvent) => {
            if (!panelDrag.current) return;
            setPanelPos({
                x: panelDrag.current.px + ev.clientX - panelDrag.current.sx,
                y: panelDrag.current.py + ev.clientY - panelDrag.current.sy,
            });
        };
        const onUp = () => {
            panelDrag.current = null;
            // Save layout with latest position
            setPanelPos(p => { setPanelSize(s => { saveLayout(p, s); return s; }); return p; });
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }, [panelPos]);

    // ── Panel resize (bottom-right corner) ──
    const onResizeStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        resizeDrag.current = { sx: e.clientX, sy: e.clientY, sw: panelSize.w, sh: panelSize.h };
        const onMove = (ev: MouseEvent) => {
            if (!resizeDrag.current) return;
            setPanelSize({
                w: Math.max(MIN_W, resizeDrag.current.sw + ev.clientX - resizeDrag.current.sx),
                h: Math.max(MIN_H, resizeDrag.current.sh + ev.clientY - resizeDrag.current.sy),
            });
        };
        const onUp = () => {
            resizeDrag.current = null;
            // Save layout with latest size
            setPanelSize(s => { setPanelPos(p => { saveLayout(p, s); return p; }); return s; });
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }, [panelSize]);

    const sortedTerms = useMemo(() => {
        let result = terms;
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(t =>
                t.name.toLowerCase().includes(q) ||
                t.description.toLowerCase().includes(q) ||
                (t.category && t.category.toLowerCase().includes(q))
            );
        }
        if (sortMode === 'alpha') {
            result = [...result].sort((a, b) => a.name.localeCompare(b.name));
        } else {
            result = [...result].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        }
        return result;
    }, [terms, search, sortMode]);

    const selectedTerm = useMemo(() => terms.find(t => t.id === selectedId) ?? null, [terms, selectedId]);

    const handleCopy = async (name: string) => {
        await navigator.clipboard.writeText(name);
        message.success(`Copied "${name}"`);
    };

    return (
        <>
            <style>{`
                .glossary-item { transition: none !important; }
                .glossary-item .glossary-item-actions { visibility: hidden !important; transition: none !important; }
                .glossary-item:hover .glossary-item-actions { visibility: visible !important; }
                .glossary-item:hover { background: var(--ant-control-item-bg-hover) !important; }
                .glossary-item .ant-btn { transition: none !important; }
            `}</style>
            {/* ── Draggable floating button ── */}
            <Tooltip title="Glossary" placement="left">
                <div
                    onMouseDown={onBtnMouseDown}
                    style={{
                        position: 'fixed',
                        right: btnPos.right,
                        bottom: btnPos.bottom,
                        width: BTN_SIZE,
                        height: BTN_SIZE,
                        borderRadius: '50%',
                        background: token.colorPrimary,
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 18,
                        cursor: 'grab',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                        zIndex: 999,
                        userSelect: 'none',
                    }}
                >
                    <BookOutlined />
                </div>
            </Tooltip>

            {/* ── Floating panel (no mask) ── */}
            {open && (
                <div
                    style={{
                        position: 'fixed',
                        left: panelPos.x,
                        top: panelPos.y,
                        width: panelSize.w,
                        height: panelSize.h,
                        background: token.colorBgElevated,
                        borderRadius: 10,
                        boxShadow: '0 6px 24px rgba(0,0,0,0.18)',
                        border: `1px solid ${token.colorBorderSecondary}`,
                        zIndex: 1000,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                    }}
                >
                    {/* Title bar — draggable */}
                    <div
                        onMouseDown={onPanelDragStart}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            borderBottom: `1px solid ${token.colorBorderSecondary}`,
                            cursor: 'move',
                            userSelect: 'none',
                            flexShrink: 0,
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {selectedTerm && (
                                <Button type="text" size="small" icon={<ArrowLeftOutlined />} onClick={() => setSelectedId(null)} style={{ marginRight: 2 }} />
                            )}
                            <Text strong style={{ fontSize: 13 }}>
                                <BookOutlined style={{ marginRight: 6 }} />
                                {selectedTerm ? selectedTerm.name : 'Glossary'}
                            </Text>
                        </div>
                        <Button
                            type="text"
                            size="small"
                            icon={<CloseOutlined />}
                            onClick={() => { setOpen(false); setSelectedId(null); }}
                        />
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        {selectedTerm ? (
                            <div style={{ padding: '12px 16px', overflow: 'auto', flex: 1 }}>
                                {selectedTerm.category && (
                                    <Tag color="blue" style={{ marginBottom: 8 }}>{selectedTerm.category}</Tag>
                                )}
                                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 12 }}>
                                    Updated: {new Date(selectedTerm.updatedAt).toLocaleString()}
                                </Text>
                                <Paragraph style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                                    {selectedTerm.description || <Text type="secondary" italic>No description</Text>}
                                </Paragraph>
                            </div>
                        ) : (
                            <>
                                <div style={{ padding: '8px 12px 0', display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                                    <Input
                                        placeholder="Search..."
                                        prefix={<SearchOutlined style={{ color: token.colorTextQuaternary }} />}
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        allowClear
                                        size="small"
                                        style={{ flex: 1 }}
                                    />
                                    <Segmented
                                        size="small"
                                        value={sortMode}
                                        onChange={v => setSortMode(v as 'alpha' | 'updated')}
                                        options={[
                                            { value: 'alpha', icon: <SortAscendingOutlined />, title: 'A→Z' },
                                            { value: 'updated', icon: <ClockCircleOutlined />, title: 'Recent' },
                                        ]}
                                    />
                                </div>
                                <div style={{ flex: 1, overflow: 'auto', padding: '6px 8px' }}>
                                    {loading ? null : sortedTerms.length === 0 ? (
                                        <Empty description="No terms" style={{ marginTop: 30 }} />
                                    ) : (
                                        <List
                                            dataSource={sortedTerms}
                                            size="small"
                                            renderItem={term => (
                                                <List.Item
                                                    key={term.id}
                                                    className="glossary-item"
                                                    style={{
                                                        padding: '6px 10px',
                                                        borderRadius: 6,
                                                        border: 'none',
                                                        marginBottom: 1,
                                                    }}
                                                >
                                                    <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                <Text strong style={{ fontSize: 13 }}>{term.name}</Text>
                                                                {term.category && (
                                                                    <Tag color="blue" style={{ fontSize: 10, marginRight: 0 }}>{term.category}</Tag>
                                                                )}
                                                            </div>
                                                            {term.description && (
                                                                <Text type="secondary" style={{ fontSize: 11 }} ellipsis>
                                                                    {term.description.slice(0, 50)}
                                                                </Text>
                                                            )}
                                                        </div>
                                                        <div className="glossary-item-actions" style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                                                            <Button type="text" size="small" title="View detail" icon={<EyeOutlined />} onClick={() => setSelectedId(term.id)} />
                                                            <Button type="text" size="small" title="Copy name" icon={<CopyOutlined />} onClick={() => handleCopy(term.name)} />
                                                        </div>
                                                    </div>
                                                </List.Item>
                                            )}
                                        />
                                    )}
                                </div>
                                <div style={{ padding: '4px 12px', borderTop: `1px solid ${token.colorBorderSecondary}`, textAlign: 'center', flexShrink: 0 }}>
                                    <Text type="secondary" style={{ fontSize: 11 }}>{sortedTerms.length} terms</Text>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Resize handle (bottom-right corner) */}
                    <div
                        onMouseDown={onResizeStart}
                        style={{
                            position: 'absolute',
                            right: 0,
                            bottom: 0,
                            width: 16,
                            height: 16,
                            cursor: 'nwse-resize',
                        }}
                    />
                </div>
            )}
        </>
    );
};
