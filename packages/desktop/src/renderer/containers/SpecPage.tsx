/**
 * Container component — orchestrates hooks and passes data to views.
 */
import React, { useEffect, useState } from 'react';
import { Typography, Button, Space, Divider, message, Modal, Input, AutoComplete } from 'antd';
import { FolderOpenOutlined } from '@ant-design/icons';
import { SpecTable } from '../components/SpecTable';
import { SpecDetailDrawer } from '../components/SpecDetailDrawer';
import { useSpecs } from '../hooks/useSpecs';

const { Title, Text } = Typography;

export const SpecPage: React.FC = () => {
    const {
        specs,
        loading,
        workspace,
        loadSpecs,
        addSpec,
        updateSpec,
        deleteSpec,
        selectWorkspace,
    } = useSpecs();

    // Detail drawer state
    const [drawerSpecId, setDrawerSpecId] = useState<string | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);

    // Add-new modal state
    const [addMode, setAddMode] = useState<'root' | 'sibling' | 'child' | null>(null);
    const [addParentId, setAddParentId] = useState<string | null>(null);
    const [newTitle, setNewTitle] = useState('');
    const [newContext, setNewContext] = useState('');
    const [adding, setAdding] = useState(false);

    useEffect(() => {
        if (workspace) loadSpecs();
    }, [workspace, loadSpecs]);

    // ─── Checkbox toggle ─────────────────────────────
    const handleToggleCompleted = async (id: string, completed: boolean) => {
        try {
            await updateSpec({ id, completed });
        } catch (err: any) {
            message.error(err?.message || 'Failed to update');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteSpec(id);
            message.success('Deleted');
        } catch (err: any) {
            message.error(err?.message || 'Failed to delete');
        }
    };

    const handleOpen = (id: string) => {
        setDrawerSpecId(id);
        setDrawerOpen(true);
    };

    const handleDrawerClose = () => {
        setDrawerOpen(false);
        setDrawerSpecId(null);
    };

    const handleDrawerSaved = () => loadSpecs();

    // ─── Add Spec Flows ──────────────────────────────
    const handleAddRoot = () => {
        setAddMode('root');
        setAddParentId(null);
        setNewTitle('');
        setNewContext('');
    };

    const handleAddSibling = (_afterId: string, parentId: string | null) => {
        setAddMode('sibling');
        setAddParentId(parentId);
        setNewTitle('');
        setNewContext('');
    };

    const handleAddChild = (parentId: string) => {
        setAddMode('child');
        setAddParentId(parentId);
        setNewTitle('');
        setNewContext('');
    };

    const handleAddConfirm = async () => {
        if (!newTitle.trim()) return;
        setAdding(true);
        try {
            const parentId = addMode === 'root' ? null : addParentId;
            const context = newContext.trim() || 'Ungrouped';
            await addSpec({ title: newTitle.trim(), context, parentId });
            message.success('Spec added');
            setAddMode(null);
        } catch (err: any) {
            message.error(err?.message || 'Failed to add');
        } finally {
            setAdding(false);
        }
    };

    const handleAddCancel = () => setAddMode(null);
    const handleSelectWorkspace = async () => { await selectWorkspace(); };

    const modalTitle = addMode === 'child' ? 'Add child spec'
        : addMode === 'sibling' ? 'Add sibling spec' : 'New spec';
    const showContext = addMode === 'root';

    // Collect contexts for autocomplete
    const existingContexts: string[] = [];
    const walk = (nodes: typeof specs) => {
        for (const n of nodes) {
            if (!existingContexts.includes(n.context)) existingContexts.push(n.context);
            if (n.children) walk(n.children);
        }
    };
    walk(specs);

    // ─── No workspace ────────────────────────────────
    if (!workspace) {
        return (
            <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', height: '100%', gap: 16,
            }}>
                <Title level={3}>📝 SpecBook</Title>
                <Text type="secondary">Select a workspace folder to get started</Text>
                <Button type="primary" size="large" icon={<FolderOpenOutlined />} onClick={handleSelectWorkspace}>
                    Open Workspace
                </Button>
            </div>
        );
    }

    return (
        <div>
            <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }} align="center">
                <Title level={4} style={{ margin: 0 }}>📝 Specs</Title>
                <Space size={8}>
                    <Text type="secondary" style={{ fontSize: 12 }}>{workspace}</Text>
                    <Button size="small" icon={<FolderOpenOutlined />} onClick={handleSelectWorkspace}>Change</Button>
                </Space>
            </Space>
            <Divider style={{ margin: '12px 0' }} />

            <SpecTable
                specs={specs}
                loading={loading}
                onToggleCompleted={handleToggleCompleted}
                onDelete={handleDelete}
                onOpen={handleOpen}
                onAddSibling={handleAddSibling}
                onAddChild={handleAddChild}
                onAddRoot={handleAddRoot}
            />

            <SpecDetailDrawer
                specId={drawerSpecId}
                open={drawerOpen}
                specs={specs}
                onClose={handleDrawerClose}
                onSaved={handleDrawerSaved}
            />

            <Modal
                title={modalTitle}
                open={!!addMode}
                onOk={handleAddConfirm}
                onCancel={handleAddCancel}
                confirmLoading={adding}
                okText="Add"
                destroyOnClose
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <Input
                        placeholder="Spec title..."
                        value={newTitle}
                        onChange={e => setNewTitle(e.target.value)}
                        onPressEnter={handleAddConfirm}
                        autoFocus
                    />
                    {showContext && (
                        <AutoComplete
                            options={existingContexts.map(c => ({ value: c }))}
                            value={newContext}
                            onChange={setNewContext}
                            placeholder="Context (e.g. User, Auth, Payment...)"
                            style={{ width: '100%' }}
                            filterOption={(input, option) =>
                                (option?.value ?? '').toLowerCase().includes(input.toLowerCase())
                            }
                        />
                    )}
                </div>
            </Modal>
        </div>
    );
};
