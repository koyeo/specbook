/**
 * PlaygroundPage — AI chat interface for Copilot panel.
 * Single-session chat: auto-creates a default session, no session list.
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
    Typography, Button, Input, Empty,
    theme, message, Spin,
} from 'antd';
import {
    SendOutlined, LoadingOutlined,
    MessageOutlined,
} from '@ant-design/icons';
import { useChat } from '../hooks/useChat';
import { MarkdownPreview } from '../components/MarkdownPreview';

const { Text } = Typography;
const { useToken } = theme;
const { TextArea } = Input;

interface PlaygroundPageProps {
    workspace: string | null;
}

export const PlaygroundPage: React.FC<PlaygroundPageProps> = ({ workspace }) => {
    const { token } = useToken();
    const {
        sessions, currentSession, loading, sending,
        listSessions, createSession, sendMessage,
    } = useChat();

    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Load sessions on mount
    useEffect(() => {
        if (workspace) listSessions();
    }, [workspace, listSessions]);

    // Auto-create and load a default session if none exists
    useEffect(() => {
        if (!loading && sessions.length === 0 && !currentSession && workspace) {
            createSession('Copilot').catch(() => { });
        }
    }, [loading, sessions.length, currentSession, workspace, createSession]);

    // Auto-scroll to bottom on new messages
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

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {!currentSession ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Spin size="small" />
                </div>
            ) : (
                <>
                    {/* Messages */}
                    <div style={{
                        flex: 1,
                        overflow: 'auto',
                        padding: '8px 0',
                    }}>
                        {currentSession.messages.length === 0 && (
                            <Empty
                                image={<MessageOutlined style={{ fontSize: 48, color: token.colorTextQuaternary }} />}
                                description={
                                    <Text type="secondary">Describe your requirements, ideas, or features</Text>
                                }
                                style={{ marginTop: 60 }}
                            />
                        )}
                        {currentSession.messages.map((msg, idx) => (
                            <div
                                key={idx}
                                style={{
                                    display: 'flex',
                                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                    marginBottom: 12,
                                }}
                            >
                                <div style={{
                                    maxWidth: '85%',
                                    padding: '10px 14px',
                                    borderRadius: msg.role === 'user'
                                        ? '16px 16px 4px 16px'
                                        : '16px 16px 16px 4px',
                                    background: msg.role === 'user'
                                        ? token.colorPrimary
                                        : token.colorBgElevated,
                                    color: msg.role === 'user'
                                        ? '#fff'
                                        : token.colorText,
                                    boxShadow: `0 1px 2px ${token.colorBorderSecondary}`,
                                }}>
                                    {msg.role === 'assistant' ? (
                                        <MarkdownPreview content={msg.content} />
                                    ) : (
                                        <div style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{msg.content}</div>
                                    )}
                                    <div style={{
                                        fontSize: 10,
                                        opacity: 0.5,
                                        marginTop: 4,
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
                    <div style={{
                        flexShrink: 0,
                        borderTop: `1px solid ${token.colorBorderSecondary}`,
                        paddingTop: 12,
                        display: 'flex',
                        gap: 8,
                        alignItems: 'flex-end',
                    }}>
                        <TextArea
                            value={inputValue}
                            onChange={e => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask anything... (Shift+Enter for new line)"
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
                </>
            )}
        </div>
    );
};
