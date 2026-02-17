/**
 * PromptPage — Three-column layout:
 *   1. Session list (conversations)
 *   2. Requirements discussion chat
 *   3. Generated Object list (for Features)
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    Typography, Input, Button, Spin, Empty, List, Popconfirm,
    theme, message, Splitter, Card,
} from 'antd';
import {
    SendOutlined, LoadingOutlined, MessageOutlined,
    PlusOutlined, DeleteOutlined, FileTextOutlined,
    ThunderboltOutlined,
} from '@ant-design/icons';
import { MarkdownPreview } from '../components/MarkdownPreview';
import type { ChatSession, ChatSessionSummary } from '@specbook/shared';

const { Text, Title } = Typography;
const { TextArea } = Input;
const { useToken } = theme;

// ─── Extracted Object type ──────────────────────────

interface ExtractedObject {
    title: string;
    content: string;
}

// ─── Sessions column ────────────────────────────────

const SessionsList: React.FC<{
    sessions: ChatSessionSummary[];
    activeId: string | null;
    onSelect: (id: string) => void;
    onCreate: () => void;
    onDelete: (id: string) => void;
}> = ({ sessions, activeId, onSelect, onCreate, onDelete }) => {
    const { token } = useToken();
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{
                padding: '12px 12px 8px', display: 'flex',
                alignItems: 'center', justifyContent: 'space-between',
                borderBottom: `1px solid ${token.colorBorderSecondary}`,
            }}>
                <Text strong style={{ fontSize: 13 }}>Sessions</Text>
                <Button size="small" type="text" icon={<PlusOutlined />} onClick={onCreate} />
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
                {sessions.length === 0 ? (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No sessions" style={{ marginTop: 40 }} />
                ) : (
                    <List
                        dataSource={sessions}
                        split={false}
                        renderItem={item => (
                            <div
                                key={item.id}
                                onClick={() => onSelect(item.id)}
                                style={{
                                    padding: '8px 12px',
                                    cursor: 'pointer',
                                    borderLeft: item.id === activeId
                                        ? `3px solid ${token.colorPrimary}`
                                        : '3px solid transparent',
                                    background: item.id === activeId
                                        ? token.colorBgTextHover
                                        : 'transparent',
                                    display: 'flex', justifyContent: 'space-between',
                                    alignItems: 'center', gap: 4,
                                    transition: 'background 0.15s',
                                }}
                                onMouseEnter={e => {
                                    if (item.id !== activeId) e.currentTarget.style.background = token.colorBgTextHover;
                                }}
                                onMouseLeave={e => {
                                    if (item.id !== activeId) e.currentTarget.style.background = 'transparent';
                                }}
                            >
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{
                                        fontSize: 13, fontWeight: item.id === activeId ? 600 : 400,
                                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                    }}>
                                        {item.title}
                                    </div>
                                    <div style={{ fontSize: 10, color: token.colorTextQuaternary }}>
                                        {item.messageCount} msgs · {new Date(item.updatedAt).toLocaleDateString()}
                                    </div>
                                </div>
                                <Popconfirm
                                    title="Delete this session?"
                                    onConfirm={e => { e?.stopPropagation(); onDelete(item.id); }}
                                    onCancel={e => e?.stopPropagation()}
                                >
                                    <Button
                                        size="small" type="text" danger
                                        icon={<DeleteOutlined />}
                                        onClick={e => e.stopPropagation()}
                                        style={{ opacity: 0.5 }}
                                    />
                                </Popconfirm>
                            </div>
                        )}
                    />
                )}
            </div>
        </div>
    );
};

// ─── Chat column ────────────────────────────────────

const ChatColumn: React.FC<{
    session: ChatSession | null;
    sending: boolean;
    onSend: (text: string) => void;
}> = ({ session, sending, onSend }) => {
    const { token } = useToken();
    const [inputValue, setInputValue] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [session?.messages.length]);

    const handleSend = useCallback(() => {
        const text = inputValue.trim();
        if (!text || sending) return;
        onSend(text);
        setInputValue('');
    }, [inputValue, sending, onSend]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }, [handleSend]);

    if (!session) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Empty
                    image={<MessageOutlined style={{ fontSize: 48, color: token.colorTextQuaternary }} />}
                    description={
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <Text type="secondary">Select or create a session to start</Text>
                            <Text type="secondary" style={{ fontSize: 11 }}>
                                Discuss requirements with AI to refine your product features
                            </Text>
                        </div>
                    }
                />
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header */}
            <div style={{
                padding: '10px 16px', borderBottom: `1px solid ${token.colorBorderSecondary}`,
                display: 'flex', alignItems: 'center', gap: 8,
            }}>
                <MessageOutlined style={{ color: token.colorPrimary }} />
                <Text strong style={{ fontSize: 14 }}>{session.title}</Text>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
                {session.messages.length === 0 && !sending && (
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="Describe your requirements to start the discussion"
                        style={{ marginTop: 60 }}
                    />
                )}

                {session.messages.map((msg, idx) => (
                    <div key={idx} style={{
                        display: 'flex',
                        justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                        marginBottom: 12,
                    }}>
                        <div style={{ maxWidth: '85%' }}>
                            {msg.role === 'user' ? (
                                <div style={{
                                    padding: '8px 14px',
                                    borderRadius: '14px 14px 4px 14px',
                                    background: token.colorPrimary,
                                    color: '#fff',
                                    fontSize: 13,
                                    whiteSpace: 'pre-wrap',
                                }}>
                                    {msg.content}
                                </div>
                            ) : (
                                <div style={{
                                    padding: '10px 14px',
                                    borderRadius: '12px 12px 12px 4px',
                                    background: token.colorBgElevated,
                                    boxShadow: `0 1px 2px ${token.colorBorderSecondary}`,
                                }}>
                                    <MarkdownPreview content={msg.content} />
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {sending && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 10 }}>
                        <div style={{
                            padding: '10px 14px', borderRadius: '12px 12px 12px 4px',
                            background: token.colorBgElevated,
                        }}>
                            <Spin indicator={<LoadingOutlined spin />} size="small" />
                            <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>Thinking...</Text>
                        </div>
                    </div>
                )}

                <div ref={scrollRef} />
            </div>

            {/* Input */}
            <div style={{
                padding: '10px 16px', borderTop: `1px solid ${token.colorBorderSecondary}`,
                display: 'flex', gap: 8, alignItems: 'flex-end',
            }}>
                <TextArea
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Describe your requirements..."
                    autoSize={{ minRows: 1, maxRows: 5 }}
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
    );
};

// ─── Features / Object list column ──────────────────

const FeaturesColumn: React.FC<{
    sessionId: string | null;
    hasMessages: boolean;
}> = ({ sessionId, hasMessages }) => {
    const { token } = useToken();
    const [objects, setObjects] = useState<ExtractedObject[]>([]);
    const [generating, setGenerating] = useState(false);
    const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

    const handleGenerate = useCallback(async () => {
        if (!sessionId || generating) return;
        setGenerating(true);
        try {
            const raw = await window.promptApi.generateFeatures(sessionId);
            // Parse JSON array from the response
            let parsed: ExtractedObject[];
            let cleaned = raw.trim();
            if (cleaned.startsWith('```')) {
                cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
            }
            parsed = JSON.parse(cleaned);
            if (!Array.isArray(parsed)) throw new Error('Expected array');
            setObjects(parsed);
            setExpandedIdx(null);
        } catch (err: any) {
            message.error('Failed to parse features: ' + (err?.message || 'unknown error'));
        } finally {
            setGenerating(false);
        }
    }, [sessionId, generating]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{
                padding: '10px 12px', borderBottom: `1px solid ${token.colorBorderSecondary}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
                <Text strong style={{ fontSize: 13 }}>
                    <FileTextOutlined style={{ marginRight: 6 }} />Objects
                </Text>
                <Button
                    type="primary"
                    size="small"
                    icon={<ThunderboltOutlined />}
                    onClick={handleGenerate}
                    loading={generating}
                    disabled={!sessionId || !hasMessages}
                >
                    Generate
                </Button>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
                {!sessionId && (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Select a session first" style={{ marginTop: 40 }} />
                )}

                {sessionId && objects.length === 0 && !generating && (
                    <Empty
                        image={<ThunderboltOutlined style={{ fontSize: 36, color: token.colorTextQuaternary }} />}
                        description={
                            <Text type="secondary" style={{ fontSize: 12 }}>
                                Click "Generate" to extract Objects from the discussion
                            </Text>
                        }
                        style={{ marginTop: 40 }}
                    />
                )}

                {generating && (
                    <div style={{ textAlign: 'center', marginTop: 60 }}>
                        <Spin indicator={<LoadingOutlined spin />} />
                        <div style={{ marginTop: 8 }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>Extracting Objects...</Text>
                        </div>
                    </div>
                )}

                {objects.length > 0 && !generating && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {objects.map((obj, idx) => (
                            <Card
                                key={idx}
                                size="small"
                                title={
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <FileTextOutlined style={{ color: token.colorPrimary, fontSize: 12 }} />
                                        <span style={{ fontSize: 13 }}>{obj.title}</span>
                                    </div>
                                }
                                hoverable
                                style={{
                                    cursor: 'pointer',
                                    border: expandedIdx === idx
                                        ? `1px solid ${token.colorPrimary}`
                                        : `1px solid ${token.colorBorderSecondary}`,
                                }}
                                onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                            >
                                {expandedIdx === idx ? (
                                    <MarkdownPreview content={obj.content} />
                                ) : (
                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                        Click to expand details
                                    </Text>
                                )}
                            </Card>
                        ))}
                        <div style={{
                            padding: '8px 0', textAlign: 'center',
                        }}>
                            <Text type="secondary" style={{ fontSize: 11 }}>
                                {objects.length} object{objects.length > 1 ? 's' : ''} extracted
                            </Text>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Main three-column layout ───────────────────────

export const PromptPage: React.FC = () => {
    const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
    const [sending, setSending] = useState(false);

    // Load session list
    const refreshSessions = useCallback(async () => {
        try {
            const list = await window.promptApi.listSessions();
            setSessions(list);
        } catch { /* ignore */ }
    }, []);

    useEffect(() => { refreshSessions(); }, [refreshSessions]);

    // Load active session
    const loadSession = useCallback(async (id: string) => {
        setActiveSessionId(id);
        try {
            const s = await window.promptApi.loadSession(id);
            setActiveSession(s);
        } catch {
            setActiveSession(null);
        }
    }, []);

    // Create session
    const handleCreate = useCallback(async () => {
        try {
            const s = await window.promptApi.createSession('Discussion ' + new Date().toLocaleDateString());
            await refreshSessions();
            loadSession(s.id);
        } catch (err: any) {
            message.error(err?.message || 'Failed to create session');
        }
    }, [refreshSessions, loadSession]);

    // Delete session
    const handleDelete = useCallback(async (id: string) => {
        try {
            await window.promptApi.deleteSession(id);
            if (activeSessionId === id) {
                setActiveSessionId(null);
                setActiveSession(null);
            }
            refreshSessions();
        } catch (err: any) {
            message.error(err?.message || 'Failed to delete session');
        }
    }, [activeSessionId, refreshSessions]);

    // Send message
    const handleSend = useCallback(async (text: string) => {
        if (!activeSessionId || sending) return;
        setSending(true);

        // Optimistic: add user message locally
        setActiveSession(prev => prev ? {
            ...prev,
            messages: [...prev.messages, { role: 'user', content: text, timestamp: new Date().toISOString() }],
        } : prev);

        try {
            const response = await window.promptApi.sendPrompt({ sessionId: activeSessionId, text });
            // Add assistant message locally
            setActiveSession(prev => prev ? {
                ...prev,
                messages: [...prev.messages, {
                    role: 'assistant',
                    content: response,
                    timestamp: new Date().toISOString(),
                }],
            } : prev);
            refreshSessions();
        } catch (err: any) {
            message.error(err?.message || 'Failed to process');
            await loadSession(activeSessionId);
        } finally {
            setSending(false);
        }
    }, [activeSessionId, sending, refreshSessions, loadSession]);

    return (
        <div style={{ height: 'calc(100vh - 48px)' }}>
            <Splitter>
                {/* Column 1: Sessions */}
                <Splitter.Panel defaultSize="18%" min="140px" max="30%">
                    <SessionsList
                        sessions={sessions}
                        activeId={activeSessionId}
                        onSelect={loadSession}
                        onCreate={handleCreate}
                        onDelete={handleDelete}
                    />
                </Splitter.Panel>

                {/* Column 2: Discussion Chat */}
                <Splitter.Panel defaultSize="50%" min="300px">
                    <ChatColumn
                        session={activeSession}
                        sending={sending}
                        onSend={handleSend}
                    />
                </Splitter.Panel>

                {/* Column 3: Object List */}
                <Splitter.Panel defaultSize="32%" min="200px">
                    <FeaturesColumn
                        sessionId={activeSessionId}
                        hasMessages={(activeSession?.messages.length ?? 0) > 0}
                    />
                </Splitter.Panel>
            </Splitter>
        </div>
    );
};
