/**
 * GlobalRulesPage — rule list on left, inline edit/view detail on right.
 */
import React, { useEffect, useState, useMemo } from 'react';
import {
    Typography, Button, Space, Input, List, Empty,
    Splitter, theme, Popconfirm, message, Tooltip,
} from 'antd';
import {
    PlusOutlined, DeleteOutlined, EditOutlined, SearchOutlined,
    CheckOutlined, CloseOutlined,
} from '@ant-design/icons';
import { useGlobalRules } from '../hooks/useGlobalRules';
import type { GlobalRule } from '@specbook/shared';

const { Title, Text, Paragraph } = Typography;
const { useToken } = theme;
const { TextArea } = Input;

interface GlobalRulesPageProps {
    workspace: string | null;
}



export const GlobalRulesPage: React.FC<GlobalRulesPageProps> = ({ workspace }) => {
    const { token } = useToken();
    const { rules, loading, loadRules, addRule, updateRule, deleteRule } = useGlobalRules();
    const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
    const [search, setSearch] = useState('');


    // Inline edit state
    const [editing, setEditing] = useState(false);
    const [editText, setEditText] = useState('');

    const [isAdding, setIsAdding] = useState(false);

    useEffect(() => {
        if (workspace) loadRules();
    }, [workspace, loadRules]);

    const filteredRules = useMemo(() => {
        let result = rules;
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(r =>
                r.text.toLowerCase().includes(q)
            );
        }
        return result;
    }, [rules, search]);

    const selectedRule = useMemo(() => {
        return rules.find(r => r.id === selectedRuleId) ?? null;
    }, [rules, selectedRuleId]);

    const handleStartAdd = () => {
        setIsAdding(true);
        setEditing(true);
        setSelectedRuleId(null);
        setEditText('');

    };

    const handleStartEdit = (rule: GlobalRule) => {
        setIsAdding(false);
        setEditing(true);
        setEditText(rule.text);

    };

    const handleCancel = () => {
        setEditing(false);
        setIsAdding(false);
    };

    const handleSave = async () => {
        if (!editText.trim()) {
            message.warning('Rule text is required');
            return;
        }
        try {
            if (isAdding) {
                const newRule = await addRule({
                    text: editText.trim(),
                });
                setSelectedRuleId(newRule.id);
                message.success('Rule added');
            } else if (selectedRule) {
                await updateRule({
                    id: selectedRule.id,
                    text: editText.trim(),
                });
                message.success('Rule updated');
            }
            setEditing(false);
            setIsAdding(false);
        } catch (err: any) {
            message.error(err?.message || 'Failed to save');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteRule(id);
            if (selectedRuleId === id) {
                setSelectedRuleId(null);
                setEditing(false);
            }
            message.success('Rule deleted');
        } catch (err: any) {
            message.error(err?.message || 'Failed to delete');
        }
    };

    if (!workspace) return null;

    const showEditForm = editing && (isAdding || selectedRule);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Top bar */}
            <div style={{ flexShrink: 0, padding: '12px 16px', borderBottom: `1px solid ${token.colorBorderSecondary}`, marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Title level={4} style={{ margin: 0, lineHeight: 1 }}>Rules</Title>
                    <Button size="small" icon={<PlusOutlined />} type="primary" onClick={handleStartAdd}>Add Rule</Button>
                </div>
            </div>

            <Splitter style={{ flex: 1, minHeight: 0 }}>
                {/* Left: rule list */}
                <Splitter.Panel defaultSize="40%" min="200px" max="60%">
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '0 12px' }}>
                        <Space direction="vertical" size={4} style={{ width: '100%', marginBottom: 8 }}>
                            <Input
                                placeholder="Search rules..."
                                prefix={<SearchOutlined style={{ color: token.colorTextQuaternary }} />}
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                allowClear
                                size="small"
                            />
                        </Space>
                        <div style={{ flex: 1, overflow: 'auto' }}>
                            {loading ? null : filteredRules.length === 0 ? (
                                <Empty description="No rules yet" style={{ marginTop: 40 }} />
                            ) : (
                                <List
                                    dataSource={filteredRules}
                                    size="small"
                                    renderItem={rule => (
                                        <List.Item
                                            key={rule.id}
                                            onClick={() => {
                                                setSelectedRuleId(rule.id);
                                                setEditing(false);
                                                setIsAdding(false);
                                            }}
                                            style={{
                                                cursor: 'pointer',
                                                padding: '8px 12px',
                                                borderRadius: 6,
                                                background: selectedRuleId === rule.id
                                                    ? token.controlItemBgActive
                                                    : 'transparent',
                                                border: 'none',
                                                marginBottom: 2,
                                                transition: 'background 0.15s',
                                            }}
                                        >
                                            <div style={{ width: '100%' }}>
                                                <Text style={{ fontSize: 13 }} ellipsis>{rule.text}</Text>
                                            </div>
                                        </List.Item>
                                    )}
                                />
                            )}
                        </div>
                    </div>
                </Splitter.Panel>

                {/* Right: detail / edit */}
                <Splitter.Panel>
                    <div style={{
                        height: '100%',
                        borderLeft: `1px solid ${token.colorBorderSecondary}`,
                        overflow: 'auto',
                        padding: '16px 20px',
                    }}>
                        {showEditForm ? (
                            /* ─── Edit / Add mode ─── */
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                    <Text strong style={{ fontSize: 14 }}>{isAdding ? 'New Rule' : 'Edit Rule'}</Text>
                                    <Space>
                                        <Button size="small" icon={<CheckOutlined />} type="primary" onClick={handleSave}>Save</Button>
                                        <Button size="small" icon={<CloseOutlined />} onClick={handleCancel}>Cancel</Button>
                                    </Space>
                                </div>
                                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                                    <div>
                                        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Rule Content</Text>
                                        <TextArea
                                            value={editText}
                                            onChange={e => setEditText(e.target.value)}
                                            rows={6}
                                            placeholder="Describe this rule..."
                                        />
                                    </div>
                                </Space>
                            </div>
                        ) : selectedRule ? (
                            /* ─── View mode ─── */
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                                    <div style={{ flex: 1 }} />
                                    <Space>
                                        <Tooltip title="Edit">
                                            <Button size="small" icon={<EditOutlined />} onClick={() => handleStartEdit(selectedRule)} />
                                        </Tooltip>
                                        <Popconfirm title="Delete this rule?" onConfirm={() => handleDelete(selectedRule.id)}>
                                            <Button size="small" danger icon={<DeleteOutlined />} />
                                        </Popconfirm>
                                    </Space>
                                </div>
                                <Paragraph style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>
                                    {selectedRule.text}
                                </Paragraph>
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                    Created: {new Date(selectedRule.createdAt).toLocaleString()} · Updated: {new Date(selectedRule.updatedAt).toLocaleString()}
                                </Text>
                            </div>
                        ) : (
                            <Empty description="Select a rule to view details" style={{ marginTop: 60 }} />
                        )}
                    </div>
                </Splitter.Panel>
            </Splitter>
        </div>
    );
};
