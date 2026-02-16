/**
 * PlaygroundPage — Copilot panel with Chat + AI Scan tabs.
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
    Typography, Button, Input, Empty, Segmented,
    theme, message, Spin, Tag, Space,
} from 'antd';
import {
    SendOutlined, LoadingOutlined,
    MessageOutlined, ThunderboltOutlined, EyeOutlined,
    ClockCircleOutlined, CloudUploadOutlined,
} from '@ant-design/icons';
import { useChat } from '../hooks/useChat';
import { MarkdownPreview } from '../components/MarkdownPreview';
import { AnalysisLogDrawer } from '../components/AnalysisLogDrawer';
import type { ObjectTreeNode, AnalysisTask, RelatedFile } from '@specbook/shared';

const { Text } = Typography;
const { useToken } = theme;
const { TextArea } = Input;

/** Simple unique ID generator. */
function genId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Render an ObjectTreeNode[] into numbered outline text for display. */
function renderTreeText(nodes: ObjectTreeNode[], prefix = '', depth = 0): string {
    const lines: string[] = [];
    nodes.forEach((node, idx) => {
        const num = prefix ? `${prefix}.${idx + 1}` : `${idx + 1}`;
        const indent = '  '.repeat(depth);
        lines.push(`${indent}${num} ${node.title}  (id: ${node.id})`);
        if (node.children && node.children.length > 0) {
            lines.push(renderTreeText(node.children, num, depth + 1));
        }
    });
    return lines.join('\n');
}

/** Count all nodes in a tree (including nested children). */
function countNodes(nodes: ObjectTreeNode[]): number {
    let count = 0;
    for (const n of nodes) {
        count++;
        if (n.children) count += countNodes(n.children);
    }
    return count;
}

interface PlaygroundPageProps {
    workspace: string | null;
    objects: ObjectTreeNode[];
}

type CopilotTab = 'chat' | 'scan';

export const PlaygroundPage: React.FC<PlaygroundPageProps> = ({ workspace, objects }) => {
    const { token } = useToken();
    const [activeTab, setActiveTab] = useState<CopilotTab>('chat');

    // ─── Chat state ─────────────────────────────────
    const {
        sessions, currentSession, loading, sending,
        listSessions, createSession, sendMessage,
    } = useChat();

    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (workspace) listSessions();
    }, [workspace, listSessions]);

    useEffect(() => {
        if (!loading && sessions.length === 0 && !currentSession && workspace) {
            createSession('Copilot').catch(() => { });
        }
    }, [loading, sessions.length, currentSession, workspace, createSession]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [currentSession?.messages]);

    const handleSend = useCallback(async () => {
        const content = inputValue.trim();
        if (!content || sending) return;
        setInputValue('');
        try {
            await sendMessage(content);
        } catch (err: any) {
            message.error(err?.message || 'Failed to send message');
        }
    }, [inputValue, sending, sendMessage]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }, [handleSend]);

    // ─── Scan state ─────────────────────────────────
    const [tasks, setTasks] = useState<AnalysisTask[]>([]);
    const [selectedTask, setSelectedTask] = useState<AnalysisTask | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);

    const updateTask = useCallback((id: string, patch: Partial<AnalysisTask>) => {
        setTasks(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
    }, []);

    /** Classify a file as impl or test using AI-provided type with filename fallback. */
    const classifyFile = useCallback((f: RelatedFile): 'impl' | 'test' => {
        if (f.type === 'impl' || f.type === 'test') return f.type;
        const fp = f.filePath.toLowerCase();
        if (/\.(test|spec)\./i.test(fp) || /\/__tests__\//i.test(fp) || /\/test\//i.test(fp)) return 'test';
        return 'impl';
    }, []);

    /** Flatten all nodes in the object tree. */
    const flattenAllNodes = useCallback((nodes: ObjectTreeNode[]): ObjectTreeNode[] => {
        const result: ObjectTreeNode[] = [];
        for (const n of nodes) {
            result.push(n);
            if (n.children) result.push(...flattenAllNodes(n.children));
        }
        return result;
    }, []);

    /** Match an object node by title (case-insensitive, trimmed, includes-fallback). */
    const matchNodeByTitle = useCallback((nodes: ObjectTreeNode[], title: string): ObjectTreeNode | undefined => {
        const t = title.trim().toLowerCase();
        return nodes.find(n => n.title.trim().toLowerCase() === t)
            || nodes.find(n => n.title.trim().toLowerCase().includes(t) || t.includes(n.title.trim().toLowerCase()));
    }, []);

    const handleSaveAllResults = useCallback(async (task: AnalysisTask) => {
        if (!task.mappings || task.mappings.length === 0) return;
        const allNodes = flattenAllNodes(objects);
        let savedCount = 0;
        console.log('[CopilotSave] Total mappings:', task.mappings.length, 'Total nodes:', allNodes.length);
        try {
            for (const mapping of task.mappings) {
                const matchNode = matchNodeByTitle(allNodes, mapping.objectTitle);
                const targetId = mapping.objectId || matchNode?.id;
                console.log('[CopilotSave] mapping:', mapping.objectTitle, '→ targetId:', targetId, ', files:', mapping.relatedFiles.length);
                if (!targetId || mapping.relatedFiles.length === 0) continue;

                const implList = mapping.relatedFiles.filter(f => classifyFile(f) === 'impl');
                const testList = mapping.relatedFiles.filter(f => classifyFile(f) === 'test');

                console.log('[CopilotSave]   impl:', implList.length, 'test:', testList.length);
                if (implList.length > 0) await window.api.saveImpls(targetId, implList, mapping.summary);
                if (testList.length > 0) await window.api.saveTests(targetId, testList);
                savedCount++;
            }
            message.success(`Saved results for ${savedCount} object(s)`);
        } catch (err: any) {
            message.error(err?.message || 'Failed to save results');
        }
    }, [objects, flattenAllNodes, classifyFile, matchNodeByTitle]);

    const handleStartAnalysis = useCallback(async () => {
        if (objects.length === 0) {
            message.warning('No objects available. Create some features first.');
            return;
        }

        const now = new Date().toISOString();
        const taskId = genId();
        const objectCount = countNodes(objects);
        const contextText = renderTreeText(objects);

        let currentModel = 'unknown';
        try {
            const aiConfig = await window.aiApi.getAiConfig();
            currentModel = aiConfig?.model || 'claude-3-sonnet-20240229';
        } catch { /* ignore */ }

        const newTask: AnalysisTask = {
            id: taskId,
            status: 'running',
            objectCount,
            model: currentModel,
            createdAt: now,
            logs: [{
                type: 'context',
                label: 'Object Tree Context',
                content: contextText,
                timestamp: now,
            }],
        };

        setTasks(prev => [newTask, ...prev]);

        try {
            const result = await window.aiApi.analyzeObjects(objects);
            const doneAt = new Date().toISOString();

            const logEntries: typeof newTask.logs = [
                newTask.logs[0],
                { type: 'prompt', label: 'System Prompt', content: result.systemPrompt, timestamp: now },
                { type: 'prompt', label: 'User Prompt', content: result.userPrompt, timestamp: now },
                { type: 'response', label: 'AI Response (raw)', content: result.rawResponse, timestamp: doneAt },
            ];

            if (result.directoryTree) {
                logEntries.push({
                    type: 'context',
                    label: 'Scanned Directory Tree',
                    content: result.directoryTree,
                    timestamp: doneAt,
                });
            }

            updateTask(taskId, {
                status: 'completed',
                completedAt: doneAt,
                tokenUsage: result.tokenUsage,
                mappings: result.mappings,
                logs: logEntries,
            });

            message.success(`Analysis complete — ${result.mappings.length} mappings`);
        } catch (err: any) {
            const errAt = new Date().toISOString();
            updateTask(taskId, {
                status: 'error',
                completedAt: errAt,
                errorMessage: err?.message || 'Unknown error',
                logs: [
                    ...newTask.logs,
                    { type: 'error', label: 'Error', content: err?.message || String(err), timestamp: errAt },
                ],
            });
            message.error(err?.message || 'AI analysis failed');
        }
    }, [objects, updateTask]);

    const handleViewTask = useCallback((task: AnalysisTask) => {
        setSelectedTask(task);
        setDrawerOpen(true);
    }, []);

    if (!workspace) return null;

    const isRunning = tasks.some(t => t.status === 'running');

    // ─── Render ─────────────────────────────────────

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Tab switcher */}
            <div style={{ flexShrink: 0, paddingBottom: 8 }}>
                <Segmented
                    value={activeTab}
                    onChange={v => setActiveTab(v as CopilotTab)}
                    options={[
                        { label: '💬 Chat', value: 'chat' },
                        { label: '⚡ Scan', value: 'scan' },
                    ]}
                    block
                    size="small"
                />
            </div>

            {/* Chat tab */}
            {activeTab === 'chat' && (
                <>
                    {!currentSession ? (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Spin size="small" />
                        </div>
                    ) : (
                        <>
                            <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
                                {currentSession.messages.length === 0 && (
                                    <Empty
                                        image={<MessageOutlined style={{ fontSize: 48, color: token.colorTextQuaternary }} />}
                                        description={<Text type="secondary">Describe your requirements, ideas, or features</Text>}
                                        style={{ marginTop: 60 }}
                                    />
                                )}
                                {currentSession.messages.map((msg, idx) => (
                                    <div key={idx} style={{
                                        display: 'flex',
                                        justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                        marginBottom: 12,
                                    }}>
                                        <div style={{
                                            maxWidth: '85%',
                                            padding: '10px 14px',
                                            borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                                            background: msg.role === 'user' ? token.colorPrimary : token.colorBgElevated,
                                            color: msg.role === 'user' ? '#fff' : token.colorText,
                                            boxShadow: `0 1px 2px ${token.colorBorderSecondary}`,
                                        }}>
                                            {msg.role === 'assistant' ? (
                                                <MarkdownPreview content={msg.content} />
                                            ) : (
                                                <div style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{msg.content}</div>
                                            )}
                                            <div style={{
                                                fontSize: 10, opacity: 0.5, marginTop: 4,
                                                textAlign: msg.role === 'user' ? 'right' : 'left',
                                            }}>
                                                {new Date(msg.timestamp).toLocaleTimeString()}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {sending && (
                                    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
                                        <div style={{
                                            padding: '12px 16px',
                                            borderRadius: '16px 16px 16px 4px',
                                            background: token.colorBgElevated,
                                        }}>
                                            <Spin indicator={<LoadingOutlined spin />} size="small" />
                                            <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>Thinking...</Text>
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input area */}
                            <div style={{ flexShrink: 0, borderTop: `1px solid ${token.colorBorderSecondary}`, paddingTop: 12, position: 'relative' }}>
                                {/* Command suggestion popup */}
                                {inputValue.startsWith('/') && !sending && (
                                    <div style={{
                                        position: 'absolute', bottom: '100%', left: 0, right: 0,
                                        background: token.colorBgElevated,
                                        border: `1px solid ${token.colorBorderSecondary}`,
                                        borderRadius: 8, marginBottom: 4, padding: '4px 0',
                                        boxShadow: token.boxShadowSecondary,
                                        zIndex: 10,
                                    }}>
                                        {[
                                            { cmd: '/scan', desc: '扫描项目文件，生成功能结构文档' },
                                            { cmd: '/insight', desc: '深度分析项目设计理念、核心抽象与架构' },
                                        ]
                                            .filter(c => c.cmd.startsWith(inputValue.trim().toLowerCase()) || inputValue.trim() === '/')
                                            .map(c => (
                                                <div
                                                    key={c.cmd}
                                                    style={{
                                                        padding: '8px 12px', cursor: 'pointer', fontSize: 13,
                                                        display: 'flex', alignItems: 'center', gap: 8,
                                                        transition: 'background 0.15s',
                                                    }}
                                                    onMouseEnter={e => (e.currentTarget.style.background = token.colorFillSecondary)}
                                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                                    onClick={() => { setInputValue(c.cmd); }}
                                                >
                                                    <Tag color="blue" style={{ margin: 0 }}>{c.cmd}</Tag>
                                                    <Text type="secondary" style={{ fontSize: 12 }}>{c.desc}</Text>
                                                </div>
                                            ))}
                                    </div>
                                )}
                                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                                    <TextArea
                                        value={inputValue}
                                        onChange={e => setInputValue(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Ask anything... Type / for commands"
                                        autoSize={{ minRows: 1, maxRows: 6 }}
                                        disabled={sending}
                                        style={{ flex: 1 }}
                                    />
                                    <Button
                                        type="primary"
                                        icon={<SendOutlined />}
                                        onClick={handleSend}
                                        loading={sending}
                                        disabled={!inputValue.trim()}
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </>
            )}

            {/* Scan tab */}
            {activeTab === 'scan' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {/* Scan header */}
                    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8 }}>
                        <Button
                            type="primary"
                            size="small"
                            icon={<ThunderboltOutlined />}
                            onClick={handleStartAnalysis}
                            loading={isRunning}
                        >
                            {isRunning ? 'Scanning...' : `Scan (${countNodes(objects)})`}
                        </Button>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                            Find code implementations for features
                        </Text>
                    </div>

                    {/* Task list */}
                    <div style={{ flex: 1, overflow: 'auto' }}>
                        {tasks.length === 0 ? (
                            <Empty
                                image={Empty.PRESENTED_IMAGE_SIMPLE}
                                description="Click Scan to analyze your project"
                                style={{ marginTop: 40 }}
                            />
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {tasks.map(task => {
                                    const statusColor = task.status === 'completed' ? 'green'
                                        : task.status === 'error' ? 'red' : 'processing';
                                    const duration = task.completedAt
                                        ? `${((new Date(task.completedAt).getTime() - new Date(task.createdAt).getTime()) / 1000).toFixed(1)}s`
                                        : null;
                                    const tokens = task.tokenUsage
                                        ? task.tokenUsage.inputTokens + task.tokenUsage.outputTokens
                                        : null;

                                    return (
                                        <div
                                            key={task.id}
                                            onClick={() => handleViewTask(task)}
                                            style={{
                                                padding: '8px 10px',
                                                borderRadius: 6,
                                                background: token.colorBgElevated,
                                                cursor: 'pointer',
                                                border: `1px solid ${token.colorBorderSecondary}`,
                                                transition: 'border-color 0.15s',
                                            }}
                                            onMouseEnter={e => (e.currentTarget.style.borderColor = token.colorPrimary)}
                                            onMouseLeave={e => (e.currentTarget.style.borderColor = token.colorBorderSecondary)}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                                <Tag color={statusColor} style={{ margin: 0, fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>
                                                    {task.status === 'running' ? (
                                                        <><ClockCircleOutlined spin /> running</>
                                                    ) : task.status.toUpperCase()}
                                                </Tag>
                                                <Text style={{ fontSize: 11, flex: 1 }}>
                                                    {new Date(task.createdAt).toLocaleTimeString()}
                                                </Text>
                                                <Button type="link" size="small" icon={<EyeOutlined />} style={{ padding: 0, height: 'auto', fontSize: 11 }}>
                                                    Logs
                                                </Button>
                                                {task.status === 'completed' && task.mappings?.length && (
                                                    <Button
                                                        type="link"
                                                        size="small"
                                                        icon={<CloudUploadOutlined />}
                                                        style={{ padding: 0, height: 'auto', fontSize: 11 }}
                                                        onClick={(e) => { e.stopPropagation(); handleSaveAllResults(task); }}
                                                    >
                                                        Save
                                                    </Button>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
                                                <Text type="secondary">{task.objectCount} objects</Text>
                                                {duration && <Text type="secondary">{duration}</Text>}
                                                {tokens !== null && <Text type="secondary">{tokens} tokens</Text>}
                                            </div>
                                            {task.mappings && (
                                                <div style={{ marginTop: 4 }}>
                                                    <Space size={4}>
                                                        {(() => {
                                                            const imp = task.mappings.filter(m => m.status === 'implemented').length;
                                                            const par = task.mappings.filter(m => m.status === 'partial').length;
                                                            const nf = task.mappings.filter(m => m.status === 'not_found').length;
                                                            return (
                                                                <>
                                                                    {imp > 0 && <Tag color="green" style={{ fontSize: 10, margin: 0 }}>{imp}✓</Tag>}
                                                                    {par > 0 && <Tag color="orange" style={{ fontSize: 10, margin: 0 }}>{par}~</Tag>}
                                                                    {nf > 0 && <Tag color="red" style={{ fontSize: 10, margin: 0 }}>{nf}✗</Tag>}
                                                                </>
                                                            );
                                                        })()}
                                                    </Space>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Log drawer */}
                    <AnalysisLogDrawer
                        task={selectedTask}
                        open={drawerOpen}
                        onClose={() => setDrawerOpen(false)}
                        objects={objects}
                    />
                </div>
            )}
        </div>
    );
};
