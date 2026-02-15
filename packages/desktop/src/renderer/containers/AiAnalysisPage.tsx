/**
 * AI Analysis page — task-based analysis with task list and log drawer.
 */
import React, { useState, useCallback } from 'react';
import { Button, Table, Typography, message, Tag, Empty, Space, theme } from 'antd';
import { RobotOutlined, ThunderboltOutlined, EyeOutlined, ClockCircleOutlined, CloudUploadOutlined } from '@ant-design/icons';
import { AnalysisLogDrawer } from '../components/AnalysisLogDrawer';
import type { ObjectTreeNode, AnalysisTask, RelatedFile } from '@specbook/shared';

const { Text, Title } = Typography;
const { useToken } = theme;

/** Simple unique ID generator. */
function genId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

interface Props {
    objects: ObjectTreeNode[];
}

/** Render an ObjectTreeNode[] into numbered outline text for display. */
function renderTreeText(nodes: ObjectTreeNode[], prefix = '', depth = 0): string {
    const lines: string[] = [];
    nodes.forEach((node, idx) => {
        const num = prefix ? `${prefix}.${idx + 1}` : `${idx + 1}`;
        const indent = '  '.repeat(depth);
        lines.push(`${indent}${num} ${node.title}  (id: ${node.id})`);
        if (node.children && node.children.length > 0) {
            lines.push(renderTreeText(node.children, num, depth + 1));
        }
    });
    return lines.join('\n');
}

/** Count all nodes in a tree (including nested children). */
function countNodes(nodes: ObjectTreeNode[]): number {
    let count = 0;
    for (const n of nodes) {
        count++;
        if (n.children) count += countNodes(n.children);
    }
    return count;
}

export const AiAnalysisPage: React.FC<Props> = ({ objects }) => {
    const { token } = useToken();
    const [tasks, setTasks] = useState<AnalysisTask[]>([]);
    const [selectedTask, setSelectedTask] = useState<AnalysisTask | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);

    const updateTask = useCallback((id: string, patch: Partial<AnalysisTask>) => {
        setTasks(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
    }, []);

    /** Classify a file as impl or test using AI-provided type with filename fallback. */
    const classifyFile = useCallback((f: RelatedFile): 'impl' | 'test' => {
        if (f.type === 'impl' || f.type === 'test') return f.type;
        const fp = f.filePath.toLowerCase();
        if (/\.(test|spec)\./i.test(fp) || /\/__tests__\//i.test(fp) || /\/test\//i.test(fp)) return 'test';
        return 'impl';
    }, []);

    /** Flatten all nodes in the object tree. */
    const flattenAllNodes = useCallback((nodes: ObjectTreeNode[]): ObjectTreeNode[] => {
        const result: ObjectTreeNode[] = [];
        for (const n of nodes) {
            result.push(n);
            if (n.children) result.push(...flattenAllNodes(n.children));
        }
        return result;
    }, []);

    /** Match an object node by title (case-insensitive, trimmed, includes-fallback). */
    const matchNodeByTitle = useCallback((nodes: ObjectTreeNode[], title: string): ObjectTreeNode | undefined => {
        const t = title.trim().toLowerCase();
        return nodes.find(n => n.title.trim().toLowerCase() === t)
            || nodes.find(n => n.title.trim().toLowerCase().includes(t) || t.includes(n.title.trim().toLowerCase()));
    }, []);

    const handleSaveAllResults = useCallback(async (task: AnalysisTask) => {
        if (!task.mappings || task.mappings.length === 0) return;
        const allNodes = flattenAllNodes(objects);
        let savedCount = 0;
        console.log('[SaveAll] Total mappings:', task.mappings.length, 'Total nodes:', allNodes.length);
        try {
            for (const mapping of task.mappings) {
                const matchNode = matchNodeByTitle(allNodes, mapping.objectTitle);
                const targetId = mapping.objectId || matchNode?.id;
                console.log('[SaveAll] mapping:', mapping.objectTitle, '→ targetId:', targetId, ', files:', mapping.relatedFiles.length);
                if (!targetId || mapping.relatedFiles.length === 0) continue;

                const implList = mapping.relatedFiles.filter(f => classifyFile(f) === 'impl');
                const testList = mapping.relatedFiles.filter(f => classifyFile(f) === 'test');

                console.log('[SaveAll]   impl:', implList.length, 'test:', testList.length);
                if (implList.length > 0) await window.api.saveImpls(targetId, implList);
                if (testList.length > 0) await window.api.saveTests(targetId, testList);
                savedCount++;
            }
            message.success(`Saved results for ${savedCount} object(s)`);
        } catch (err: any) {
            message.error(err?.message || 'Failed to save results');
        }
    }, [objects, flattenAllNodes, classifyFile, matchNodeByTitle]);

    const handleStartAnalysis = useCallback(async () => {
        if (objects.length === 0) {
            message.warning('No objects available. Create some objects in the Objects tab first.');
            return;
        }

        const now = new Date().toISOString();
        const taskId = genId();
        const objectCount = countNodes(objects);
        const contextText = renderTreeText(objects);

        // Fetch current AI config for model info
        let currentModel = 'unknown';
        try {
            const aiConfig = await window.aiApi.getAiConfig();
            currentModel = aiConfig?.model || 'claude-3-sonnet-20240229';
        } catch { /* ignore */ }

        const newTask: AnalysisTask = {
            id: taskId,
            status: 'running',
            objectCount,
            model: currentModel,
            createdAt: now,
            logs: [
                {
                    type: 'context',
                    label: 'Object Tree Context',
                    content: contextText,
                    timestamp: now,
                },
            ],
        };

        setTasks(prev => [newTask, ...prev]);

        try {
            const result = await window.aiApi.analyzeObjects(objects);
            const doneAt = new Date().toISOString();

            const logEntries: typeof newTask.logs = [
                newTask.logs[0],
                {
                    type: 'prompt',
                    label: 'System Prompt',
                    content: result.systemPrompt,
                    timestamp: now,
                },
                {
                    type: 'prompt',
                    label: 'User Prompt',
                    content: result.userPrompt,
                    timestamp: now,
                },
                {
                    type: 'response',
                    label: 'AI Response (raw)',
                    content: result.rawResponse,
                    timestamp: doneAt,
                },
            ];

            // Add directory tree if returned by AI
            if (result.directoryTree) {
                logEntries.push({
                    type: 'context',
                    label: 'Scanned Directory Tree',
                    content: result.directoryTree,
                    timestamp: doneAt,
                });
            }

            updateTask(taskId, {
                status: 'completed',
                completedAt: doneAt,
                tokenUsage: result.tokenUsage,
                mappings: result.mappings,
                logs: logEntries,
            });

            message.success(`Analysis complete — ${result.mappings.length} mappings, ${result.tokenUsage.inputTokens + result.tokenUsage.outputTokens} tokens`);
        } catch (err: any) {
            const errAt = new Date().toISOString();
            updateTask(taskId, {
                status: 'error',
                completedAt: errAt,
                errorMessage: err?.message || 'Unknown error',
                logs: [
                    ...newTask.logs,
                    {
                        type: 'error',
                        label: 'Error',
                        content: err?.message || String(err),
                        timestamp: errAt,
                    },
                ],
            });
            message.error(err?.message || 'AI analysis failed');
        }
    }, [objects, updateTask]);

    const handleViewTask = useCallback((task: AnalysisTask) => {
        setSelectedTask(task);
        setDrawerOpen(true);
    }, []);

    const columns = [
        {
            title: 'Time',
            dataIndex: 'createdAt',
            key: 'time',
            width: 160,
            render: (t: string) => (
                <Text style={{ fontSize: 12 }}>{new Date(t).toLocaleString()}</Text>
            ),
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            width: 100,
            render: (s: string) => {
                const color = s === 'completed' ? 'green' : s === 'error' ? 'red' : 'processing';
                return <Tag color={color}>{s.toUpperCase()}</Tag>;
            },
        },
        {
            title: 'Objects',
            dataIndex: 'objectCount',
            key: 'objects',
            width: 80,
            render: (n: number) => <Text>{n}</Text>,
        },
        {
            title: 'Tokens',
            key: 'tokens',
            width: 100,
            render: (_: any, r: AnalysisTask) => {
                if (!r.tokenUsage) return <Text type="secondary">—</Text>;
                return <Text style={{ fontSize: 12 }}>{r.tokenUsage.inputTokens + r.tokenUsage.outputTokens}</Text>;
            },
        },
        {
            title: 'Model',
            dataIndex: 'model',
            key: 'model',
            width: 180,
            render: (m: string) => <Text type="secondary" style={{ fontSize: 11 }}>{m}</Text>,
        },
        {
            title: 'Duration',
            key: 'duration',
            width: 100,
            render: (_: any, r: AnalysisTask) => {
                if (!r.completedAt) return <Tag icon={<ClockCircleOutlined spin />} color="processing">running</Tag>;
                const ms = new Date(r.completedAt).getTime() - new Date(r.createdAt).getTime();
                return <Text style={{ fontSize: 12 }}>{(ms / 1000).toFixed(1)}s</Text>;
            },
        },
        {
            title: 'Mappings',
            key: 'mappings',
            width: 100,
            render: (_: any, r: AnalysisTask) => {
                if (!r.mappings) return <Text type="secondary">—</Text>;
                const imp = r.mappings.filter(m => m.status === 'implemented').length;
                const par = r.mappings.filter(m => m.status === 'partial').length;
                const nf = r.mappings.filter(m => m.status === 'not_found').length;
                return (
                    <Space size={4}>
                        {imp > 0 && <Tag color="green" style={{ fontSize: 10 }}>{imp}✓</Tag>}
                        {par > 0 && <Tag color="orange" style={{ fontSize: 10 }}>{par}~</Tag>}
                        {nf > 0 && <Tag color="red" style={{ fontSize: 10 }}>{nf}✗</Tag>}
                    </Space>
                );
            },
        },
        {
            title: '',
            key: 'save',
            width: 80,
            render: (_: any, r: AnalysisTask) => {
                if (r.status !== 'completed' || !r.mappings?.length) return null;
                return (
                    <Button
                        type="link"
                        size="small"
                        icon={<CloudUploadOutlined />}
                        onClick={(e) => { e.stopPropagation(); handleSaveAllResults(r); }}
                    >
                        Save All
                    </Button>
                );
            },
        },
    ];

    return (
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
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
                    onClick={handleStartAnalysis}
                    loading={tasks.some(t => t.status === 'running')}
                    size="large"
                >
                    {tasks.some(t => t.status === 'running')
                        ? 'Analyzing...'
                        : `Start Analysis (${countNodes(objects)} objects)`}
                </Button>
            </div>

            {/* Task list */}
            {tasks.length === 0 ? (
                <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="Click 'Start Analysis' to create your first scan task"
                    style={{ padding: 60 }}
                />
            ) : (
                <Table
                    dataSource={tasks}
                    columns={columns}
                    rowKey="id"
                    size="small"
                    pagination={false}
                    onRow={(record) => ({
                        onClick: () => handleViewTask(record),
                        style: { cursor: 'pointer' },
                    })}
                />
            )}

            {/* Log drawer */}
            <AnalysisLogDrawer
                task={selectedTask}
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                objects={objects}
            />
        </div>
    );
};
