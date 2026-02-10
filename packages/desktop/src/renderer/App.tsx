/**
 * App shell — antd ConfigProvider + layout + theme toggle.
 */
import React, { useState, useEffect } from 'react';
import { ConfigProvider, theme, Layout, Button, Tooltip } from 'antd';
import { SunOutlined, MoonOutlined } from '@ant-design/icons';
import { SpecPage } from './containers/SpecPage';

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
                {/* Theme toggle — top right */}
                <div style={{ position: 'fixed', top: 8, right: 12, zIndex: 100 }}>
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
                <Content style={{ padding: '20px 24px' }}>
                    <SpecPage />
                </Content>
            </Layout>
        </ConfigProvider>
    );
};

export default App;
