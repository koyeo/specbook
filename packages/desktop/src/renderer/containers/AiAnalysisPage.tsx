/**
 * AI Analysis page — select objects and run AI mapping analysis.
 */
import React, { useState } from 'react';
import { Button, Card, Typography, message, Spin, Tag, Empty, Space, theme } from 'antd';
import { RobotOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useObjects } from '../hooks/useSpecs';
import type { ObjectTreeNode, AnalysisResult, ObjectMapping } from '@specbook/shared';

const { Text, Title } = Typography;
const { useToken } = theme;

const STATUS_COLOR: Record<string, string> = {
    implemented: 'green',
    partial: 'orange',
    not_found: 'red',
    unknown: 'default',
};

export const AiAnalysisPage: React.FC = () => {
    const { token } = useToken();
    const { objects } = useObjects();
    const [analyzing, setAnalyzing] = useState(false);
    const [result, setResult] = useState<AnalysisResult | null>(null);

    const handleAnalyzeAll = async () => {
        if (objects.length === 0) {
            message.warning('No objects available. Create some objects first.');
            return;
        }
        setAnalyzing(true);
        setResult(null);
        try {
            const res = await window.aiApi.analyzeObjects(objects);
            setResult(res);
            message.success(`Analysis complete — ${res.mappings.length} mappings, ${res.tokenUsage.inputTokens + res.tokenUsage.outputTokens} tokens used`);
        } catch (err: any) {
            message.error(err?.message || 'AI analysis failed');
        } finally {
            setAnalyzing(false);
        }
    };

    return (
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <Title level={4} style={{ margin: 0 }}>
                        <RobotOutlined style={{ marginRight: 8 }} />
                        AI Object Mapping
                    </Title>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        Analyze your object tree to find related code implementations
                    </Text>
                </div>
                <Button
                    type="primary"
                    icon={<ThunderboltOutlined />}
                    onClick={handleAnalyzeAll}
                    loading={analyzing}
                    size="large"
                >
                    {analyzing ? 'Analyzing...' : `Analyze All (${objects.length} objects)`}
                </Button>
            </div>

            {/* Loading */}
            {analyzing && (
                <div style={{ textAlign: 'center', padding: 60 }}>
                    <Spin size="large" />
                    <div style={{ marginTop: 16 }}>
                        <Text type="secondary">Sending object tree to AI for analysis...</Text>
                    </div>
                </div>
            )}

            {/* Empty state */}
            {!analyzing && !result && (
                <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="Click 'Analyze All' to start AI mapping analysis"
                    style={{ padding: 80 }}
                />
            )}

            {/* Results */}
            {!analyzing && result && (
                <div>
                    {/* Summary bar */}
                    <Card size="small" style={{ marginBottom: 16 }}>
                        <Space size={24}>
                            <Text><strong>{result.mappings.length}</strong> objects analyzed</Text>
                            <Text type="secondary">
                                🎯 {result.mappings.filter(m => m.status === 'implemented').length} implemented
                            </Text>
                            <Text type="secondary">
                                ⚠️ {result.mappings.filter(m => m.status === 'partial').length} partial
                            </Text>
                            <Text type="secondary">
                                ❌ {result.mappings.filter(m => m.status === 'not_found').length} not found
                            </Text>
                            <Text type="secondary" style={{ fontSize: 11 }}>
                                Tokens: {result.tokenUsage.inputTokens} in / {result.tokenUsage.outputTokens} out
                            </Text>
                        </Space>
                    </Card>

                    {/* Mapping cards */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {result.mappings.map((m: ObjectMapping) => (
                            <Card
                                key={m.objectId}
                                size="small"
                                style={{
                                    borderLeft: `3px solid ${m.status === 'implemented' ? token.colorSuccess : m.status === 'partial' ? token.colorWarning : token.colorError}`,
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                    <Tag color={STATUS_COLOR[m.status] || 'default'}>
                                        {m.status.toUpperCase()}
                                    </Tag>
                                    <Text strong>{m.objectTitle}</Text>
                                    <Text type="secondary" style={{ fontSize: 11 }}>#{m.objectId.slice(0, 8)}</Text>
                                </div>

                                <Text style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>
                                    {m.summary}
                                </Text>

                                {m.relatedFiles.length > 0 && (
                                    <div style={{
                                        background: token.colorFillQuaternary,
                                        borderRadius: token.borderRadius,
                                        padding: '8px 12px',
                                        fontSize: 12,
                                    }}>
                                        {m.relatedFiles.map((f, i) => (
                                            <div key={i} style={{ marginBottom: i < m.relatedFiles.length - 1 ? 4 : 0 }}>
                                                📄 <Text code style={{ fontSize: 11 }}>{f.filePath}</Text>
                                                {f.lineRange && (
                                                    <Text type="secondary" style={{ fontSize: 11 }}> L{f.lineRange.start}–{f.lineRange.end}</Text>
                                                )}
                                                {f.description && (
                                                    <Text type="secondary" style={{ fontSize: 11 }}> — {f.description}</Text>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </Card>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
