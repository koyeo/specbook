/**
 * HomePage — displays editable markdown content from home.json.
 * Serves as an onboarding / landing page for new developers.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Typography, Button, Space, Input, theme, App as AntApp } from 'antd';
import { EditOutlined, SaveOutlined, CloseOutlined } from '@ant-design/icons';
import { MarkdownPreview } from '../components/MarkdownPreview';

const { Title } = Typography;
const { TextArea } = Input;
const { useToken } = theme;

interface HomePageProps {
    workspace: string | null;
}

export const HomePage: React.FC<HomePageProps> = ({ workspace }) => {
    const { token } = useToken();
    const { message } = AntApp.useApp();
    const [content, setContent] = useState('');
    const [editContent, setEditContent] = useState('');
    const [editing, setEditing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const loadContent = useCallback(async () => {
        if (!workspace) return;
        setLoading(true);
        try {
            const data = await window.homeApi.loadHome();
            setContent(data.content);
        } catch (err: any) {
            console.error('Failed to load home:', err);
        } finally {
            setLoading(false);
        }
    }, [workspace]);

    useEffect(() => {
        loadContent();
    }, [loadContent]);

    const handleEdit = () => {
        setEditContent(content);
        setEditing(true);
    };

    const handleCancel = () => {
        setEditing(false);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await window.homeApi.saveHome(editContent);
            setContent(editContent);
            setEditing(false);
            message.success('Home page saved');
        } catch (err: any) {
            message.error(err?.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    if (!workspace) return null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Top bar */}
            <div style={{ flexShrink: 0, padding: '12px 16px', borderBottom: `1px solid ${token.colorBorderSecondary}`, marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Title level={4} style={{ margin: 0, lineHeight: 1 }}>Home</Title>
                    {editing ? (
                        <Space size={8}>
                            <Button size="small" icon={<CloseOutlined />} onClick={handleCancel}>Cancel</Button>
                            <Button type="primary" size="small" icon={<SaveOutlined />} onClick={handleSave} loading={saving}>Save</Button>
                        </Space>
                    ) : (
                        <Button size="small" icon={<EditOutlined />} onClick={handleEdit}>Edit</Button>
                    )}
                </div>
            </div>

            {/* Content area */}
            <div style={{ flex: 1, overflow: 'auto', padding: '0 20px 20px' }}>
                {loading ? null : editing ? (
                    <TextArea
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                        placeholder="Write your home page content here… (supports Markdown)"
                        autoSize={{ minRows: 20 }}
                        style={{
                            fontSize: 13,
                            fontFamily: 'Menlo, Monaco, Consolas, monospace',
                        }}
                    />
                ) : (
                    <MarkdownPreview content={content} />
                )}
            </div>
        </div>
    );
};
