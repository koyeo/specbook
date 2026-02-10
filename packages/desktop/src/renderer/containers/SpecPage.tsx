/**
 * Container component — orchestrates hooks and passes data to views.
 */
import React, { useEffect, useState } from 'react';
import { Typography, Button, Space, Divider, message, Modal, Input } from 'antd';
import { FolderOpenOutlined } from '@ant-design/icons';
import { SpecTable } from '../components/SpecTable';
import { SpecDetailDrawer } from '../components/SpecDetailDrawer';
import { useSpecs } from '../hooks/useSpecs';

const { Title, Text } = Typography;

export const SpecPage: React.FC = () => {
    const {
        specs, loading, workspace, loadSpecs,
        addSpec, deleteSpec, moveSpec, selectWorkspace,
    } = useSpecs();

    const [drawerSpecId, setDrawerSpecId] = useState<string | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [addMode, setAddMode] = useState<'root' | 'sibling' | 'child' | null>(null);
    const [addParentId, setAddParentId] = useState<string | null>(null);
    const [newTitle, setNewTitle] = useState('');
    const [adding, setAdding] = useState(false);

    useEffect(() => { if (workspace) loadSpecs(); }, [workspace, loadSpecs]);

    const handleDelete = async (id: string) => {
        try { await deleteSpec(id); message.success('Deleted'); }
        catch (err: any) { message.error(err?.message || 'Failed to delete'); }
    };

    const handleOpen = (id: string) => { setDrawerSpecId(id); setDrawerOpen(true); };
    const handleDrawerClose = () => { setDrawerOpen(false); setDrawerSpecId(null); };
    const handleDrawerSaved = () => loadSpecs();

    const handleAddRoot = () => { setAddMode('root'); setAddParentId(null); setNewTitle(''); };
    const handleAddSibling = (_afterId: string, parentId: string | null) => { setAddMode('sibling'); setAddParentId(parentId); setNewTitle(''); };
    const handleAddChild = (parentId: string) => { setAddMode('child'); setAddParentId(parentId); setNewTitle(''); };

    const handleAddConfirm = async () => {
        if (!newTitle.trim()) return;
        setAdding(true);
        try {
            const parentId = addMode === 'root' ? null : addParentId;
            await addSpec({ title: newTitle.trim(), parentId });
            message.success('Spec added');
            setAddMode(null);
        } catch (err: any) {
            message.error(err?.message || 'Failed to add');
        } finally { setAdding(false); }
    };

    const handleAddCancel = () => setAddMode(null);

    const handleBatchDelete = async (ids: string[]) => {
        try {
            for (const id of ids) await deleteSpec(id);
            message.success(`Deleted ${ids.length} spec(s)`);
        } catch (err: any) { message.error(err?.message || 'Batch delete failed'); }
    };

    const handleBatchMove = async (ids: string[], newParentId: string | null) => {
        try {
            for (const id of ids) await moveSpec({ id, newParentId });
            message.success(`Moved ${ids.length} spec(s)`);
        } catch (err: any) { message.error(err?.message || 'Batch move failed'); }
    };

    const handleSelectWorkspace = async () => { await selectWorkspace(); };

    const modalTitle = addMode === 'child' ? 'Add child spec' : addMode === 'sibling' ? 'Add sibling spec' : 'New spec';

    if (!workspace) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
                <Title level={3}>📝 SpecBook</Title>
                <Text type="secondary">Select a workspace folder to get started</Text>
                <Button type="primary" size="large" icon={<FolderOpenOutlined />} onClick={handleSelectWorkspace}>Open Workspace</Button>
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
                specs={specs} loading={loading}
                onDelete={handleDelete} onOpen={handleOpen}
                onAddSibling={handleAddSibling} onAddChild={handleAddChild} onAddRoot={handleAddRoot}
                onBatchDelete={handleBatchDelete} onBatchMove={handleBatchMove}
            />

            <SpecDetailDrawer specId={drawerSpecId} open={drawerOpen} specs={specs} onClose={handleDrawerClose} onSaved={handleDrawerSaved} />

            <Modal title={modalTitle} open={!!addMode} onOk={handleAddConfirm} onCancel={handleAddCancel} confirmLoading={adding} okText="Add" destroyOnClose>
                <Input placeholder="Spec title..." value={newTitle} onChange={e => setNewTitle(e.target.value)} onPressEnter={handleAddConfirm} autoFocus />
            </Modal>
        </div>
    );
};
