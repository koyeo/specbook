/**
 * PlaygroundPage — AI chat interface for requirements discovery.
 * Left: session list  |  Right: message thread + input
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
    Typography, Button, Space, Input, List, Empty,
    Modal, theme, message, Spin, Tooltip, Popconfirm,
} from 'antd';
import {
    PlusOutlined, DeleteOutlined, SendOutlined, LoadingOutlined,
    MessageOutlined,
} from '@ant-design/icons';
import { useChat } from '../hooks/useChat';
import { MarkdownPreview } from '../components/MarkdownPreview';

const { Title, Text } = Typography;
const { useToken } = theme;
const { TextArea } = Input;

interface PlaygroundPageProps {
    workspace: string | null;
}

export const PlaygroundPage: React.FC<PlaygroundPageProps> = ({ workspace }) => {
    const { token } = useToken();
    const {
        sessions, currentSession, loading, sending,
        listSessions, loadSession, createSession, deleteSession, sendMessage,
    } = useChat();

    const [newSessionTitle, setNewSessionTitle] = useState('');
    const [newSessionModalOpen, setNewSessionModalOpen] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (workspace) listSessions();
    }, [workspace, listSessions]);

    // auto-scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [currentSession?.messages]);

    const handleCreateSession = async () => {
        try {
            await createSession(newSessionTitle.trim() || 'New Chat');
            setNewSessionModalOpen(false);
            setNewSessionTitle('');
        } catch (err: any) {
            message.error(err?.message || 'Failed to create session');
        }
    };

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
        <div style={{ display: 'flex', height: 'calc(100vh - 120px)' }}>
            {/* Left: session list */}
            <div style={{
                width: 240,
                flexShrink: 0,
                borderRight: `1px solid ${token.colorBorderSecondary}`,
                display: 'flex',
                flexDirection: 'column',
                paddingRight: 8,
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Title level={5} style={{ margin: 0 }}>💬 Chats</Title>
                    <Tooltip title="New Chat">
                        <Button
                            size="small"
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => setNewSessionModalOpen(true)}
                        />
                    </Tooltip>
                </div>

                <div style={{ flex: 1, overflow: 'auto' }}>
                    {sessions.length === 0 ? (
                        <Empty description="No chats yet" style={{ marginTop: 40 }} />
                    ) : (
                        <List
                            loading={loading}
                            dataSource={sessions}
                            size="small"
                            renderItem={session => (
                                <List.Item
                                    key={session.id}
                                    onClick={() => loadSession(session.id)}
                                    style={{
                                        cursor: 'pointer',
                                        padding: '8px 10px',
                                        borderRadius: 6,
                                        background: currentSession?.id === session.id
                                            ? token.controlItemBgActive
                                            : 'transparent',
                                        border: 'none',
                                        marginBottom: 2,
                                        transition: 'background 0.15s',
                                    }}
                                    actions={[
                                        <Popconfirm
                                            key="delete"
                                            title="Delete this chat?"
                                            onConfirm={(e) => {
                                                e?.stopPropagation();
                                                deleteSession(session.id);
                                            }}
                                        >
                                            <Button
                                                size="small"
                                                type="text"
                                                danger
                                                icon={<DeleteOutlined />}
                                                onClick={e => e.stopPropagation()}
                                                style={{ opacity: 0.5 }}
                                            />
                                        </Popconfirm>,
                                    ]}
                                >
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        <Text ellipsis style={{ fontSize: 13, display: 'block' }}>
                                            {session.title}
                                        </Text>
                                        <Text type="secondary" style={{ fontSize: 11 }}>
                                            {session.messageCount} messages
                                        </Text>
                                    </div>
                                </List.Item>
                            )}
                        />
                    )}
                </div>
            </div>

            {/* Right: chat area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingLeft: 12 }}>
                {!currentSession ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Empty
                            image={<MessageOutlined style={{ fontSize: 48, color: token.colorTextQuaternary }} />}
                            description={
                                <Space direction="vertical" size={4}>
                                    <Text type="secondary">Select a chat or create a new one</Text>
                                    <Button
                                        type="primary"
                                        icon={<PlusOutlined />}
                                        onClick={() => setNewSessionModalOpen(true)}
                                    >
                                        New Chat
                                    </Button>
                                </Space>
                            }
                        />
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div style={{
                            flexShrink: 0,
                            padding: '8px 0',
                            borderBottom: `1px solid ${token.colorBorderSecondary}`,
                            marginBottom: 8,
                        }}>
                            <Title level={5} style={{ margin: 0 }}>{currentSession.title}</Title>
                        </div>

                        {/* Messages */}
                        <div style={{
                            flex: 1,
                            overflow: 'auto',
                            padding: '8px 0',
                        }}>
                            {currentSession.messages.length === 0 && (
                                <Empty
                                    description="Start the conversation — describe your requirements, ideas, or features"
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
                                        maxWidth: '80%',
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
                                placeholder="Describe your requirements, ideas, or features... (Shift+Enter for new line)"
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

            {/* New session modal */}
            <Modal
                title="New Chat Session"
                open={newSessionModalOpen}
                onOk={handleCreateSession}
                onCancel={() => { setNewSessionModalOpen(false); setNewSessionTitle(''); }}
                okText="Create"
                destroyOnClose
            >
                <Input
                    placeholder="Chat title (optional)..."
                    value={newSessionTitle}
                    onChange={e => setNewSessionTitle(e.target.value)}
                    onPressEnter={handleCreateSession}
                    autoFocus
                    style={{ marginTop: 8 }}
                />
            </Modal>
        </div>
    );
};
