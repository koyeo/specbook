/**
 * PlaygroundPage — Copilot chat panel.
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
    Typography, Button, Input, Empty,
    theme, message, Spin, Tag,
} from 'antd';
import {
    SendOutlined, LoadingOutlined,
    MessageOutlined,
} from '@ant-design/icons';
import { useChat } from '../hooks/useChat';
import { MarkdownPreview } from '../components/MarkdownPreview';
import type { ObjectTreeNode } from '@specbook/shared';

const { Text } = Typography;
const { useToken } = theme;
const { TextArea } = Input;

interface PlaygroundPageProps {
    workspace: string | null;
    objects: ObjectTreeNode[];
}

export const PlaygroundPage: React.FC<PlaygroundPageProps> = ({ workspace, objects }) => {
    const { token } = useToken();

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

    if (!workspace) return null;

    // ─── Render ─────────────────────────────────────

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
        </div>
    );
};
