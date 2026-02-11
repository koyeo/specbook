/**
 * App shell — antd ConfigProvider + layout + theme toggle + tabs.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { ConfigProvider, theme, Layout, Button, Tooltip, Tabs, Typography, Space } from 'antd';
import { SunOutlined, MoonOutlined, SettingOutlined, AppstoreOutlined, RobotOutlined, FolderOpenOutlined } from '@ant-design/icons';
import { ObjectPage } from './containers/SpecPage';
import { AiAnalysisPage } from './containers/AiAnalysisPage';
import { AiSettingsModal } from './components/AiSettingsModal';
import type { ObjectTreeNode } from '@specbook/shared';

const { Text, Title } = Typography;

const { Content } = Layout;

type ThemeMode = 'system' | 'light' | 'dark';

function getSystemDark(): boolean {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

const App: React.FC = () => {
    const [mode, setMode] = useState<ThemeMode>(() => {
        return (localStorage.getItem('specbook-theme') as ThemeMode) || 'system';
    });
    const [systemDark, setSystemDark] = useState(getSystemDark);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [workspace, setWorkspace] = useState<string | null>(null);
    const [objects, setObjects] = useState<ObjectTreeNode[]>([]);

    // Load saved workspace on mount
    useEffect(() => {
        window.api.getWorkspace().then(ws => setWorkspace(ws));
    }, []);

    // Load objects whenever workspace changes
    useEffect(() => {
        if (workspace) {
            window.api.loadObjects().then(o => setObjects(o)).catch(() => setObjects([]));
        } else {
            setObjects([]);
        }
    }, [workspace]);

    const refreshObjects = useCallback(() => {
        window.api.loadObjects().then(o => setObjects(o)).catch(() => { });
    }, []);

    const handleSelectWorkspace = useCallback(async () => {
        const ws = await window.api.selectWorkspace();
        if (ws) setWorkspace(ws);
    }, []);

    // Listen for system theme changes
    useEffect(() => {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    // Persist choice
    useEffect(() => {
        localStorage.setItem('specbook-theme', mode);
    }, [mode]);

    const isDark = mode === 'dark' || (mode === 'system' && systemDark);
    const algorithm = isDark ? theme.darkAlgorithm : theme.defaultAlgorithm;

    const cycleTheme = () => {
        setMode(prev => {
            if (prev === 'system') return 'light';
            if (prev === 'light') return 'dark';
            return 'system';
        });
    };

    const themeLabel = mode === 'system' ? 'System' : mode === 'light' ? 'Light' : 'Dark';
    const themeIcon = isDark ? <SunOutlined /> : <MoonOutlined />;

    const tabItems = [
        {
            key: 'objects',
            label: <span><AppstoreOutlined /> Objects</span>,
            children: <ObjectPage workspace={workspace} />,
        },
        {
            key: 'ai',
            label: <span><RobotOutlined /> AI Analysis</span>,
            children: <AiAnalysisPage objects={objects} />,
        },
    ];

    return (
        <ConfigProvider
            theme={{
                algorithm,
                token: {
                    colorPrimary: '#1677ff',
                    borderRadius: 6,
                    fontSize: 13,
                },
            }}
        >
            <Layout style={{ minHeight: '100vh', background: 'transparent' }}>
                {/* Theme toggle + Settings — top right */}
                <div style={{ position: 'fixed', top: 8, right: 12, zIndex: 100, display: 'flex', gap: 4 }}>
                    <Tooltip title="AI Settings">
                        <Button
                            size="small"
                            type="text"
                            icon={<SettingOutlined />}
                            onClick={() => setSettingsOpen(true)}
                            style={{ fontSize: 14, opacity: 0.6 }}
                        />
                    </Tooltip>
                    <Tooltip title={`Theme: ${themeLabel}`}>
                        <Button
                            size="small"
                            type="text"
                            icon={themeIcon}
                            onClick={cycleTheme}
                            style={{ fontSize: 14, opacity: 0.6 }}
                        />
                    </Tooltip>
                </div>
                <AiSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
                <Content style={{ padding: '12px 24px 20px' }}>
                    {!workspace ? (
                        /* No workspace — full-screen prompt */
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 80px)', gap: 16 }}>
                            <Title level={3}>📝 SpecBook</Title>
                            <Text type="secondary">Select a workspace folder to get started</Text>
                            <Button type="primary" size="large" icon={<FolderOpenOutlined />} onClick={handleSelectWorkspace}>Open Workspace</Button>
                        </div>
                    ) : (
                        <>
                            {/* Global workspace bar */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                <Space size={8}>
                                    <FolderOpenOutlined style={{ color: '#1677ff' }} />
                                    <Text style={{ fontSize: 12 }}>{workspace}</Text>
                                </Space>
                                <Button size="small" onClick={handleSelectWorkspace}>Change Workspace</Button>
                            </div>
                            <Tabs
                                defaultActiveKey="objects"
                                items={tabItems}
                                size="small"
                            />
                        </>
                    )}
                </Content>
            </Layout>
        </ConfigProvider>
    );
};

export default App;

