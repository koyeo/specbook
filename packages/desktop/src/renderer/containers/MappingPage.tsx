/**
 * Mapping page — AI agentic DFS scan, feature-to-code coverage table, changelog.
 * Real-time per-object progress, individual rescan support.
 */
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Typography, Button, Space, Table, Tag, message, theme, Drawer, Empty, Tooltip, Dropdown, Progress } from 'antd';
import { ScanOutlined, FileTextOutlined, ReloadOutlined, LoadingOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { MarkdownPreview } from '../components/MarkdownPreview';
import type { FeatureMappingIndex, FeatureMappingEntry, MappingChangeEntry, ScanProgressEvent } from '@specbook/shared';

const { Title, Text } = Typography;
const { useToken } = theme;

interface MappingPageProps {
    workspace: string | null;
}

const changeTypeConfig = {
    added: { color: '#52c41a', icon: '🟢', label: '新增实现' },
    changed: { color: '#faad14', icon: '🟡', label: '变更' },
    removed: { color: '#ff4d4f', icon: '🔴', label: '已移除' },
    unchanged: { color: '#8c8c8c', icon: '⚪', label: '未变更' },
};

export const MappingPage: React.FC<MappingPageProps> = ({ workspace }) => {
    const { token } = useToken();
    const [mapping, setMapping] = useState<FeatureMappingIndex | null>(null);
    const [scanning, setScanning] = useState(false);

    // Per-object scan progress
    const [progressMap, setProgressMap] = useState<Map<string, ScanProgressEvent>>(new Map());
    const [scanProgress, setScanProgress] = useState<{ current: number; total: number } | null>(null);

    // Detail drawer
    const [detailEntry, setDetailEntry] = useState<FeatureMappingEntry | null>(null);
    const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
    const [drawerWidth, setDrawerWidth] = useState(() => Math.round(window.innerWidth * 0.45));
    const dragging = useRef(false);

    const onDragStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        dragging.current = true;
        const onMove = (ev: MouseEvent) => {
            if (!dragging.current) return;
            const newWidth = Math.max(300, Math.min(window.innerWidth * 0.9, window.innerWidth - ev.clientX));
            setDrawerWidth(newWidth);
        };
        const onUp = () => {
            dragging.current = false;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }, []);

    // Listen to scan progress events
    useEffect(() => {
        const unsub = window.mappingApi.onScanProgress((event: ScanProgressEvent) => {
            setProgressMap(prev => {
                const next = new Map(prev);
                next.set(event.objectId, event);
                return next;
            });
            setScanProgress({ current: event.current, total: event.total });
        });
        return unsub;
    }, []);

    // Load mapping on mount
    useEffect(() => {
        if (workspace) {
            window.mappingApi.loadMapping().then(m => {
                if (m) setMapping(m);
            }).catch(() => { /* ignore */ });
        }
    }, [workspace]);

    const handleScan = async () => {
        setScanning(true);
        setProgressMap(new Map());
        setScanProgress(null);
        try {
            const result = await window.mappingApi.scanMapping();
            setMapping(result);
            const changes = result.changelog.filter(c => c.changeType !== 'unchanged');
            message.success(`Scan complete — ${result.entries.length} objects mapped, ${changes.length} changes`);
        } catch (err: any) {
            message.error(err?.message || 'Scan failed');
        } finally {
            setScanning(false);
            setScanProgress(null);
        }
    };

    const handleRescanObject = async (objectId: string) => {
        try {
            setProgressMap(prev => {
                const next = new Map(prev);
                next.set(objectId, { objectId, objectTitle: '', status: 'scanning', current: 0, total: 1 });
                return next;
            });
            const result = await window.mappingApi.scanSingleObject(objectId);
            message.success(`Re-scanned "${result.objectTitle}" — ${result.status}`);
            // Reload full mapping
            const freshMapping = await window.mappingApi.loadMapping();
            if (freshMapping) setMapping(freshMapping);
            setProgressMap(prev => {
                const next = new Map(prev);
                next.delete(objectId);
                return next;
            });
        } catch (err: any) {
            message.error(`Rescan failed: ${err?.message}`);
        }
    };

    // ─── Changelog stats ────────────────────────────
    const changelogByType = useMemo(() => {
        if (!mapping) return { added: [], changed: [], removed: [], unchanged: [] };
        const result: Record<string, MappingChangeEntry[]> = { added: [], changed: [], removed: [], unchanged: [] };
        for (const c of mapping.changelog) {
            result[c.changeType]?.push(c);
        }
        return result;
    }, [mapping]);

    // ─── Scan status icon per row ───────────────────
    const getScanStatusIcon = (objectId: string) => {
        const progress = progressMap.get(objectId);
        if (!progress) return null;
        if (progress.status === 'scanning') return <LoadingOutlined spin style={{ color: token.colorPrimary, marginRight: 6 }} />;
        if (progress.status === 'done') return <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 6 }} />;
        if (progress.status === 'error') return <CloseCircleOutlined style={{ color: '#ff4d4f', marginRight: 6 }} />;
        return null;
    };

    // ─── Table columns ──────────────────────────────
    const columns = [
        {
            title: 'Object',
            dataIndex: 'objectTitle',
            key: 'title',
            ellipsis: true,
            render: (title: string, record: FeatureMappingEntry) => (
                <span style={{ display: 'flex', alignItems: 'center' }}>
                    {getScanStatusIcon(record.objectId)}
                    <Text
                        strong
                        style={{ cursor: 'pointer', fontSize: 13 }}
                        onClick={() => { setDetailEntry(record); setDetailDrawerOpen(true); }}
                    >
                        {title}
                    </Text>
                </span>
            ),
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            width: 120,
            render: (status: string) => (
                <Tag color={
                    status === 'implemented' ? 'green' :
                        status === 'partial' ? 'orange' :
                            status === 'not_found' ? 'red' : 'default'
                }>
                    {status}
                </Tag>
            ),
        },
        {
            title: 'Impl Files',
            key: 'impl',
            width: 100,
            render: (_: any, r: FeatureMappingEntry) => (
                <Text style={{ fontSize: 12 }}>
                    {r.implFiles.length > 0 ? `📄 ${r.implFiles.length}` : <Text type="secondary">—</Text>}
                </Text>
            ),
        },
        {
            title: 'Test Files',
            key: 'test',
            width: 100,
            render: (_: any, r: FeatureMappingEntry) => (
                <Text style={{ fontSize: 12 }}>
                    {r.testFiles.length > 0 ? `🧪 ${r.testFiles.length}` : <Text type="secondary">—</Text>}
                </Text>
            ),
        },
        {
            title: 'Change',
            key: 'change',
            width: 120,
            render: (_: any, r: FeatureMappingEntry) => {
                const change = mapping?.changelog.find(c => c.objectId === r.objectId);
                if (!change || change.changeType === 'unchanged') return <Text type="secondary">—</Text>;
                const cfg = changeTypeConfig[change.changeType];
                return (
                    <Tooltip title={change.changeSummary}>
                        <Tag color={cfg.color} style={{ fontSize: 10, cursor: 'help' }}>
                            {cfg.icon} {cfg.label}
                        </Tag>
                    </Tooltip>
                );
            },
        },
        {
            title: '',
            key: 'actions',
            width: 40,
            render: (_: any, r: FeatureMappingEntry) => (
                <Tooltip title="Re-scan this object">
                    <ReloadOutlined
                        style={{ color: token.colorTextSecondary, cursor: 'pointer', fontSize: 13 }}
                        onClick={(e) => { e.stopPropagation(); handleRescanObject(r.objectId); }}
                    />
                </Tooltip>
            ),
        },
    ];

    if (!workspace) return null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header */}
            <div style={{ flexShrink: 0, padding: '12px 16px', marginBottom: 16, borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <Title level={4} style={{ margin: 0 }}>
                            Feature Mapping
                        </Title>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            AI agentic scan — DFS bottom-up analysis of feature implementations
                        </Text>
                    </div>
                    <Button
                        type="primary"
                        icon={<ScanOutlined />}
                        onClick={handleScan}
                        loading={scanning}
                        size="large"
                    >
                        {scanning ? 'Scanning...' : 'Scan All'}
                    </Button>
                </div>

                {/* Scan progress bar */}
                {scanning && scanProgress && (
                    <div style={{ marginTop: 12 }}>
                        <Progress
                            percent={Math.round((scanProgress.current / scanProgress.total) * 100)}
                            size="small"
                            format={() => `${scanProgress.current}/${scanProgress.total}`}
                            strokeColor={token.colorPrimary}
                        />
                        {(() => {
                            const currentScan = Array.from(progressMap.values()).find(p => p.status === 'scanning');
                            return currentScan ? (
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                    <LoadingOutlined spin style={{ marginRight: 4 }} />
                                    Scanning: {currentScan.objectTitle}
                                </Text>
                            ) : null;
                        })()}
                    </div>
                )}

                {/* Stats bar */}
                {mapping && !scanning && (
                    <div style={{ marginTop: 12, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <Tag>{mapping.entries.length} objects</Tag>
                        <Tag color="green">{mapping.entries.filter(e => e.status === 'implemented').length} implemented</Tag>
                        <Tag color="orange">{mapping.entries.filter(e => e.status === 'partial').length} partial</Tag>
                        <Tag color="red">{mapping.entries.filter(e => e.status === 'not_found').length} not found</Tag>
                        {mapping.tokenUsage && (
                            <Tag>{mapping.tokenUsage.inputTokens + mapping.tokenUsage.outputTokens} tokens</Tag>
                        )}
                        <Text type="secondary" style={{ fontSize: 11 }}>
                            Last scan: {new Date(mapping.scannedAt).toLocaleString()}
                        </Text>
                    </div>
                )}

                {/* Changelog summary */}
                {mapping && mapping.changelog.some(c => c.changeType !== 'unchanged') && (
                    <div style={{ marginTop: 8, padding: '8px 12px', background: token.colorBgTextHover, borderRadius: 6 }}>
                        <Text strong style={{ fontSize: 12, marginRight: 12 }}>Changes since last scan:</Text>
                        {(['added', 'changed', 'removed'] as const).map(type => {
                            const count = changelogByType[type].length;
                            if (count === 0) return null;
                            const cfg = changeTypeConfig[type];
                            return (
                                <Tag key={type} color={cfg.color} style={{ fontSize: 11, marginRight: 4 }}>
                                    {cfg.icon} {count} {cfg.label}
                                </Tag>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Mapping table */}
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                {!mapping ? (
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="Click 'Scan All' to analyze feature implementations"
                        style={{ padding: 60 }}
                    />
                ) : (
                    <Table
                        dataSource={mapping.entries}
                        columns={columns}
                        rowKey="objectId"
                        size="small"
                        pagination={false}
                        onRow={(record) => ({
                            onClick: () => { setDetailEntry(record); setDetailDrawerOpen(true); },
                            style: { cursor: 'pointer' },
                        })}
                    />
                )}
            </div>

            {/* Detail drawer */}
            <Drawer
                title={detailEntry?.objectTitle ?? 'Mapping Detail'}
                placement="right"
                width={drawerWidth}
                open={detailDrawerOpen}
                onClose={() => setDetailDrawerOpen(false)}
                destroyOnHidden
                extra={
                    detailEntry && (
                        <Button
                            icon={<ReloadOutlined />}
                            size="small"
                            onClick={() => handleRescanObject(detailEntry.objectId)}
                        >
                            Re-scan
                        </Button>
                    )
                }
            >
                {/* Drag handle */}
                <div
                    onMouseDown={onDragStart}
                    style={{
                        position: 'absolute', top: 0, left: 0, width: 6,
                        height: '100%', cursor: 'col-resize', zIndex: 10,
                    }}
                />
                {detailEntry && (
                    <div>
                        {/* Status */}
                        <div style={{ marginBottom: 16 }}>
                            <Text type="secondary">Status: </Text>
                            <Tag color={
                                detailEntry.status === 'implemented' ? 'green' :
                                    detailEntry.status === 'partial' ? 'orange' :
                                        detailEntry.status === 'not_found' ? 'red' : 'default'
                            }>
                                {detailEntry.status}
                            </Tag>
                        </div>

                        {/* Impl files */}
                        {detailEntry.implFiles.length > 0 && (
                            <div style={{ marginBottom: 16 }}>
                                <Text strong style={{ display: 'block', marginBottom: 8 }}>Implementation Files</Text>
                                {detailEntry.implFiles.map(f => (
                                    <div
                                        key={f.filePath}
                                        style={{
                                            padding: '4px 8px', marginBottom: 4,
                                            background: token.colorBgTextHover, borderRadius: 4,
                                            cursor: 'pointer', fontSize: 12,
                                        }}
                                        onClick={() => window.api.openInEditor(f.filePath, f.lineRange?.start)}
                                    >
                                        <Text strong style={{ color: '#52c41a', fontSize: 12 }}>📄 {f.filePath}</Text>
                                        {f.lineRange && (
                                            <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>
                                                L{f.lineRange.start}–{f.lineRange.end}
                                            </Text>
                                        )}
                                        {f.description && (
                                            <div><Text type="secondary" style={{ fontSize: 11 }}>{f.description}</Text></div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Test files */}
                        {detailEntry.testFiles.length > 0 && (
                            <div style={{ marginBottom: 16 }}>
                                <Text strong style={{ display: 'block', marginBottom: 8 }}>Test Files</Text>
                                {detailEntry.testFiles.map(f => (
                                    <div
                                        key={f.filePath}
                                        style={{
                                            padding: '4px 8px', marginBottom: 4,
                                            background: token.colorBgTextHover, borderRadius: 4,
                                            cursor: 'pointer', fontSize: 12,
                                        }}
                                        onClick={() => window.api.openInEditor(f.filePath, f.lineRange?.start)}
                                    >
                                        <Text strong style={{ color: '#1677ff', fontSize: 12 }}>🧪 {f.filePath}</Text>
                                        {f.lineRange && (
                                            <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>
                                                L{f.lineRange.start}–{f.lineRange.end}
                                            </Text>
                                        )}
                                        {f.description && (
                                            <div><Text type="secondary" style={{ fontSize: 11 }}>{f.description}</Text></div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* AI Summary */}
                        {detailEntry.summary && (
                            <div>
                                <Text strong style={{ display: 'block', marginBottom: 8 }}>AI Analysis</Text>
                                <MarkdownPreview content={detailEntry.summary} />
                            </div>
                        )}
                    </div>
                )}
            </Drawer>
        </div>
    );
};
