/**
 * App shell — antd ConfigProvider + sidebar layout + CSS variable theme.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { ConfigProvider, theme, Layout, Menu, Button, Tooltip, Typography, Space, Dropdown, Splitter } from 'antd';
import {
    SunOutlined, MoonOutlined, SettingOutlined,
    AppstoreOutlined, BookOutlined,
    FolderOpenOutlined, BulbOutlined, DesktopOutlined,
    RobotOutlined,
} from '@ant-design/icons';
import { ObjectPage } from './containers/SpecPage';
import { AiAnalysisPage } from './containers/AiAnalysisPage';
import { GlossaryPage } from './containers/GlossaryPage';
import { PlaygroundPage } from './containers/PlaygroundPage';
import { KnowledgePage } from './containers/KnowledgePage';
import { AiSettingsModal } from './components/AiSettingsModal';
import type { ObjectTreeNode } from '@specbook/shared';

const { Text, Title } = Typography;
const { Sider, Content } = Layout;

type ThemeMode = 'system' | 'light' | 'dark';
type PageKey = 'objects' | 'ai' | 'glossary' | 'knowledge';

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
    const [currentPage, setCurrentPage] = useState<PageKey>('objects');
    const [siderCollapsed, setSiderCollapsed] = useState(false);
    const [copilotOpen, setCopilotOpen] = useState<boolean>(() => {
        return localStorage.getItem('specbook-copilot') !== 'false';
    });

    // Persist copilot state
    useEffect(() => {
        localStorage.setItem('specbook-copilot', String(copilotOpen));
    }, [copilotOpen]);

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

    // Sync data-theme attribute on <html> for CSS variables
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    }, [isDark]);

    const themeMenuItems = [
        { key: 'system', icon: <DesktopOutlined />, label: 'System' },
        { key: 'light', icon: <SunOutlined />, label: 'Light' },
        { key: 'dark', icon: <MoonOutlined />, label: 'Dark' },
    ];

    const currentThemeIcon = mode === 'system'
        ? <DesktopOutlined />
        : mode === 'light' ? <SunOutlined /> : <MoonOutlined />;

    const menuItems = [
        { key: 'objects', icon: <AppstoreOutlined />, label: 'Features' },
        { key: 'knowledge', icon: <BulbOutlined />, label: 'Knowledge' },
        { key: 'glossary', icon: <BookOutlined />, label: 'Glossary' },
    ];

    const renderPage = () => {
        switch (currentPage) {
            case 'objects':
                return <ObjectPage workspace={workspace} />;
            case 'ai':
                return <AiAnalysisPage objects={objects} />;
            case 'glossary':
                return <GlossaryPage workspace={workspace} />;
            case 'knowledge':
                return <KnowledgePage workspace={workspace} />;
            default:
                return <ObjectPage workspace={workspace} />;
        }
    };

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
            <Layout style={{ minHeight: '100vh', background: 'var(--sb-bg)' }}>
                <AiSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

                {!workspace ? (
                    /* No workspace — full-screen prompt */
                    <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        justifyContent: 'center', height: '100vh', gap: 16,
                    }}>
                        <div style={{ display: 'flex', gap: 4, position: 'absolute', top: 12, right: 16 }}>
                            <Dropdown
                                menu={{
                                    items: themeMenuItems,
                                    selectedKeys: [mode],
                                    onClick: ({ key }) => setMode(key as ThemeMode),
                                }}
                                trigger={['click']}
                            >
                                <Button size="small" type="text" icon={currentThemeIcon} />
                            </Dropdown>
                        </div>
                        <Title level={3}>📝 Specbook</Title>
                        <Text type="secondary">Select a workspace folder to get started</Text>
                        <Button type="primary" size="large" icon={<FolderOpenOutlined />} onClick={handleSelectWorkspace}>
                            Open Workspace
                        </Button>
                    </div>
                ) : (
                    <Layout style={{ background: 'var(--sb-bg)' }}>
                        {/* Left Sidebar */}
                        <Sider
                            collapsible
                            collapsed={siderCollapsed}
                            onCollapse={setSiderCollapsed}
                            width={180}
                            collapsedWidth={56}
                            theme={isDark ? 'dark' : 'light'}
                            style={{
                                height: '100vh',
                                position: 'fixed',
                                left: 0,
                                top: 0,
                                bottom: 0,
                                borderRight: '1px solid var(--sb-border)',
                                background: 'var(--sb-sider-bg)',
                            }}
                            trigger={null}
                        >
                            {/* Logo area */}
                            <div
                                style={{
                                    height: 48,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: siderCollapsed ? 'center' : 'flex-start',
                                    padding: siderCollapsed ? '0' : '0 16px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                }}
                                onClick={() => setSiderCollapsed(!siderCollapsed)}
                            >
                                <span style={{ fontSize: 18 }}>📝</span>
                                {!siderCollapsed && (
                                    <Text strong style={{ marginLeft: 8, fontSize: 14 }}>Specbook</Text>
                                )}
                            </div>

                            <Menu
                                mode="inline"
                                selectedKeys={[currentPage]}
                                onClick={({ key }) => setCurrentPage(key as PageKey)}
                                items={menuItems}
                                style={{ border: 'none', background: 'transparent' }}
                            />
                        </Sider>

                        {/* Main content */}
                        <Content style={{
                            marginLeft: siderCollapsed ? 56 : 180,
                            transition: 'margin-left 0.2s',
                            display: 'flex',
                            flexDirection: 'column',
                        }}>
                            {/* Unified header bar (workspace + actions) */}
                            <div className="app-header-bar">
                                <div className="workspace-info">
                                    <FolderOpenOutlined style={{ color: '#1677ff', flexShrink: 0 }} />
                                    <Text style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {workspace}
                                    </Text>
                                </div>
                                <div className="header-actions">
                                    <Button size="small" onClick={handleSelectWorkspace}>
                                        Change
                                    </Button>
                                    <Tooltip title="AI Settings">
                                        <Button size="small" type="text" icon={<SettingOutlined />} onClick={() => setSettingsOpen(true)} />
                                    </Tooltip>
                                    <Dropdown
                                        menu={{
                                            items: themeMenuItems,
                                            selectedKeys: [mode],
                                            onClick: ({ key }) => setMode(key as ThemeMode),
                                        }}
                                        trigger={['click']}
                                    >
                                        <Button size="small" type="text" icon={currentThemeIcon} />
                                    </Dropdown>
                                    <Tooltip title={copilotOpen ? 'Hide Copilot' : 'Show Copilot'}>
                                        <Button
                                            size="small"
                                            type={copilotOpen ? 'primary' : 'text'}
                                            icon={<RobotOutlined />}
                                            onClick={() => setCopilotOpen(!copilotOpen)}
                                        />
                                    </Tooltip>
                                </div>
                            </div>

                            {/* Page content + Copilot panel */}
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                {copilotOpen ? (
                                    <Splitter>
                                        <Splitter.Panel defaultSize="60%" min="30%">
                                            <div style={{ height: '100%', padding: '0 24px 20px', overflow: 'auto' }}>
                                                {renderPage()}
                                            </div>
                                        </Splitter.Panel>
                                        <Splitter.Panel defaultSize="40%" min="280px">
                                            <div style={{
                                                height: '100%',
                                                borderLeft: '1px solid var(--sb-border)',
                                                padding: '0 16px 16px',
                                                overflow: 'hidden',
                                                display: 'flex',
                                                flexDirection: 'column',
                                            }}>
                                                <div style={{
                                                    flexShrink: 0,
                                                    padding: '8px 0',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                }}>
                                                    <Text strong style={{ fontSize: 14 }}>🤖 Copilot</Text>
                                                </div>
                                                <div style={{ flex: 1, overflow: 'hidden' }}>
                                                    <PlaygroundPage workspace={workspace} />
                                                </div>
                                            </div>
                                        </Splitter.Panel>
                                    </Splitter>
                                ) : (
                                    <div style={{ height: '100%', padding: '0 24px 20px', overflow: 'auto' }}>
                                        {renderPage()}
                                    </div>
                                )}
                            </div>
                        </Content>
                    </Layout>
                )}
            </Layout>
        </ConfigProvider>
    );
};

export default App;
