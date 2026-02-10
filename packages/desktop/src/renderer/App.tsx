/**
 * App shell — antd ConfigProvider + layout.
 */
import React from 'react';
import { ConfigProvider, theme, Layout } from 'antd';
import { SpecPage } from './containers/SpecPage';

const { Content } = Layout;

const App: React.FC = () => {
    return (
        <ConfigProvider
            theme={{
                algorithm: theme.darkAlgorithm,
                token: {
                    colorPrimary: '#1677ff',
                    borderRadius: 6,
                    fontSize: 13,
                },
            }}
        >
            <Layout style={{ minHeight: '100vh', background: 'transparent' }}>
                <Content style={{ padding: '20px 24px' }}>
                    <SpecPage />
                </Content>
            </Layout>
        </ConfigProvider>
    );
};

export default App;
