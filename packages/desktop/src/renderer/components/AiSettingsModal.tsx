/**
 * AI Settings modal — configure API Key, Base URL, Model, and view token usage.
 */
import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, Descriptions, Statistic, Row, Col, message, Divider, Typography } from 'antd';
import type { AiConfig } from '@specbook/shared';
import { useAiConfig } from '../hooks/useAiConfig';

const { Text } = Typography;

interface AiSettingsModalProps {
    open: boolean;
    onClose: () => void;
}

const MODEL_OPTIONS = [
    { label: 'Claude Sonnet 4', value: 'claude-sonnet-4-20250514' },
    { label: 'Claude Opus 4', value: 'claude-opus-4-20250514' },
    { label: 'Claude Haiku 3.5', value: 'claude-3-5-haiku-20241022' },
];

export const AiSettingsModal: React.FC<AiSettingsModalProps> = ({ open, onClose }) => {
    const { config, totalInputTokens, totalOutputTokens, tokenUsage, loading, saveConfig, loadUsage } = useAiConfig();
    const [form] = Form.useForm<AiConfig>();

    // Sync form when modal opens or config loads
    useEffect(() => {
        if (open) {
            form.setFieldsValue(config);
            loadUsage();
        }
    }, [open, config, form, loadUsage]);

    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            await saveConfig(values);
            message.success('AI settings saved');
            onClose();
        } catch {
            // validation failed — antd shows inline errors
        }
    };

    return (
        <Modal
            title="⚙️ AI Settings"
            open={open}
            onOk={handleSave}
            onCancel={onClose}
            confirmLoading={loading}
            okText="Save"
            width={520}
            destroyOnClose
        >
            <Form form={form} layout="vertical" initialValues={config}>
                <Form.Item
                    name="apiKey"
                    label="API Key"
                    rules={[{ required: true, message: 'API Key is required' }]}
                >
                    <Input.Password placeholder="sk-ant-..." autoComplete="off" />
                </Form.Item>

                <Form.Item name="baseUrl" label="Base URL">
                    <Input placeholder="https://api.anthropic.com" />
                </Form.Item>

                <Form.Item name="model" label="Model">
                    <Select
                        options={MODEL_OPTIONS}
                        showSearch
                        allowClear={false}
                        placeholder="Select a model"
                    />
                </Form.Item>
            </Form>

            <Divider />

            <Text strong>Token Usage Summary</Text>
            <Row gutter={16} style={{ marginTop: 12 }}>
                <Col span={8}>
                    <Statistic title="Calls" value={tokenUsage.length} />
                </Col>
                <Col span={8}>
                    <Statistic title="Input Tokens" value={totalInputTokens} />
                </Col>
                <Col span={8}>
                    <Statistic title="Output Tokens" value={totalOutputTokens} />
                </Col>
            </Row>
        </Modal>
    );
};
