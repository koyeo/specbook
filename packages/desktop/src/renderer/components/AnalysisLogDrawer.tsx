/**
 * AnalysisLogDrawer — shows full analysis task logs in a timeline layout.
 * Sections: Object Context → System Prompt → User Prompt → AI Response → Results
 * Supports drag-to-resize via a custom handle on the left edge.
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Drawer, Typography, Tag, Space, Card, Collapse, theme } from 'antd';
import {
    FileTextOutlined, RobotOutlined, MessageOutlined,
    ThunderboltOutlined, CheckCircleOutlined, CloseCircleOutlined,
    ClockCircleOutlined,
} from '@ant-design/icons';
import type { AnalysisTask, ObjectMapping } from '@specbook/shared';

const { Text } = Typography;
const { useToken } = theme;

const STATUS_COLOR: Record<string, string> = {
    implemented: 'green',
    partial: 'orange',
    not_found: 'red',
    unknown: 'default',
};

const ICON_MAP: Record<string, React.ReactNode> = {
    context: <FileTextOutlined />,
    prompt: <MessageOutlined />,
    response: <RobotOutlined />,
    result: <CheckCircleOutlined />,
    error: <CloseCircleOutlined />,
};

const MIN_WIDTH = 400;
const MAX_WIDTH_RATIO = 0.85;
const DEFAULT_WIDTH = 680;

interface Props {
    task: AnalysisTask | null;
    open: boolean;
    onClose: () => void;
}

export const AnalysisLogDrawer: React.FC<Props> = ({ task, open, onClose }) => {
    const { token } = useToken();
    const [width, setWidth] = useState(DEFAULT_WIDTH);
    const dragging = useRef(false);
    const startX = useRef(0);
    const startWidth = useRef(DEFAULT_WIDTH);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        dragging.current = true;
        startX.current = e.clientX;
        startWidth.current = width;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, [width]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!dragging.current) return;
            const maxWidth = window.innerWidth * MAX_WIDTH_RATIO;
            const delta = startX.current - e.clientX;
            const newWidth = Math.max(MIN_WIDTH, Math.min(maxWidth, startWidth.current + delta));
            setWidth(newWidth);
        };
        const handleMouseUp = () => {
            dragging.current = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    if (!task) return null;

    const statusIcon = task.status === 'completed'
        ? <CheckCircleOutlined style={{ color: token.colorSuccess }} />
        : task.status === 'error'
            ? <CloseCircleOutlined style={{ color: token.colorError }} />
            : <ClockCircleOutlined style={{ color: token.colorWarning }} />;

    const duration = task.completedAt
        ? `${((new Date(task.completedAt).getTime() - new Date(task.createdAt).getTime()) / 1000).toFixed(1)}s`
        : 'running...';

    const collapseItems = task.logs.map((log, idx) => ({
        key: String(idx),
        label: (
            <Space size={8}>
                {ICON_MAP[log.type] || <FileTextOutlined />}
                <Text strong style={{ fontSize: 13 }}>{log.label}</Text>
                <Text type="secondary" style={{ fontSize: 11 }}>
                    {new Date(log.timestamp).toLocaleTimeString()}
                </Text>
            </Space>
        ),
        children: (
            <pre style={{
                margin: 0,
                padding: 12,
                fontSize: 11,
                lineHeight: 1.5,
                background: token.colorFillQuaternary,
                borderRadius: token.borderRadius,
                overflow: 'auto',
                maxHeight: 400,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
            }}>
                {log.content}
            </pre>
        ),
    }));

    // Add results section if completed
    if (task.status === 'completed' && task.mappings && task.mappings.length > 0) {
        collapseItems.push({
            key: 'results',
            label: (
                <Space size={8}>
                    <ThunderboltOutlined />
                    <Text strong style={{ fontSize: 13 }}>Analysis Results ({task.mappings.length} mappings)</Text>
                </Space>
            ),
            children: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {task.mappings.map((m: ObjectMapping) => (
                        <Card key={m.objectId} size="small" style={{
                            borderLeft: `3px solid ${m.status === 'implemented' ? token.colorSuccess : m.status === 'partial' ? token.colorWarning : token.colorError}`,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                <Tag color={STATUS_COLOR[m.status] || 'default'} style={{ fontSize: 10 }}>
                                    {m.status.toUpperCase()}
                                </Tag>
                                <Text strong style={{ fontSize: 12 }}>{m.objectTitle}</Text>
                            </div>
                            <Text style={{ fontSize: 11, display: 'block' }}>{m.summary}</Text>
                            {m.relatedFiles.length > 0 && (
                                <div style={{ marginTop: 4, fontSize: 11 }}>
                                    {m.relatedFiles.map((f, i) => (
                                        <div key={i}>
                                            📄 <Text code style={{ fontSize: 10 }}>{f.filePath}</Text>
                                            {f.description && <Text type="secondary" style={{ fontSize: 10 }}> — {f.description}</Text>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>
                    ))}
                </div>
            ),
        });
    }

    return (
        <Drawer
            title={
                <Space size={8}>
                    {statusIcon}
                    <span>Analysis Task</span>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        {new Date(task.createdAt).toLocaleString()}
                    </Text>
                </Space>
            }
            open={open}
            onClose={onClose}
            width={width}
            destroyOnClose
            styles={{ body: { position: 'relative' } }}
        >
            {/* Drag handle on the left edge */}
            <div
                onMouseDown={handleMouseDown}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: 6,
                    height: '100%',
                    cursor: 'col-resize',
                    zIndex: 10,
                    background: 'transparent',
                    transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = token.colorPrimaryBg)}
                onMouseLeave={(e) => { if (!dragging.current) e.currentTarget.style.background = 'transparent'; }}
            />

            {/* Summary bar */}
            <Card size="small" style={{ marginBottom: 16 }}>
                <Space size={20} wrap>
                    <Text>
                        <strong>{task.objectCount}</strong> objects
                    </Text>
                    <Text type="secondary">⏱ {duration}</Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                        Model: {task.model}
                    </Text>
                    {task.tokenUsage && (
                        <>
                            <Text type="secondary">
                                📥 {task.tokenUsage.inputTokens} in
                            </Text>
                            <Text type="secondary">
                                📤 {task.tokenUsage.outputTokens} out
                            </Text>
                        </>
                    )}
                </Space>
            </Card>

            {/* Error message */}
            {task.errorMessage && (
                <Card size="small" style={{ marginBottom: 16, borderColor: token.colorError }}>
                    <Text type="danger">{task.errorMessage}</Text>
                </Card>
            )}

            {/* Log entries */}
            <Collapse
                items={collapseItems}
                defaultActiveKey={task.status === 'completed' ? ['results'] : []}
                size="small"
            />
        </Drawer>
    );
};
