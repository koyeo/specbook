/**
 * Container component — VS Code-like layout.
 * Left pane: spec tree   |   Right pane: detail editor (inline panel)
 */
import React, { useEffect, useState } from 'react';
import { Typography, Button, Space, Divider, message, Modal, Input, Splitter, theme, Select } from 'antd';
import { FolderOpenOutlined, ExportOutlined } from '@ant-design/icons';
import { SpecTable } from '../components/SpecTable';
import { SpecDetailPanel } from '../components/SpecDetailPanel';
import { useSpecs } from '../hooks/useSpecs';
import type { SpecType } from '@specbook/shared';
import { SPEC_TYPE_LABELS } from '../constants/specTypes';

const { Title, Text } = Typography;
const { useToken } = theme;

export const SpecPage: React.FC = () => {
    const { token } = useToken();
    const {
        specs, loading, workspace, loadSpecs,
        addSpec, deleteSpec, moveSpec, selectWorkspace,
    } = useSpecs();

    const [selectedSpecId, setSelectedSpecId] = useState<string | null>(null);

    // Add-new modal
    const [addMode, setAddMode] = useState<'root' | 'sibling' | 'child' | null>(null);
    const [addParentId, setAddParentId] = useState<string | null>(null);
    const [newTitle, setNewTitle] = useState('');
    const [newType, setNewType] = useState<SpecType>('information_display');
    const [adding, setAdding] = useState(false);

    useEffect(() => { if (workspace) loadSpecs(); }, [workspace, loadSpecs]);

    const handleDelete = async (id: string) => {
        try {
            await deleteSpec(id);
            if (selectedSpecId === id) setSelectedSpecId(null);
            message.success('Deleted');
        } catch (err: any) { message.error(err?.message || 'Failed to delete'); }
    };

    const handleOpen = (id: string) => setSelectedSpecId(id);
    const handleSaved = () => loadSpecs();

    const handleAddRoot = () => { setAddMode('root'); setAddParentId(null); setNewTitle(''); setNewType('action_entry'); };
    const handleAddSibling = (_afterId: string, parentId: string | null) => { setAddMode('sibling'); setAddParentId(parentId); setNewTitle(''); setNewType('action_entry'); };
    const handleAddChild = (parentId: string) => { setAddMode('child'); setAddParentId(parentId); setNewTitle(''); setNewType('action_entry'); };

    const handleAddConfirm = async () => {
        if (!newTitle.trim()) return;
        setAdding(true);
        try {
            const parentId = addMode === 'root' ? null : addParentId;
            await addSpec({ title: newTitle.trim(), type: newType, parentId });
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
            if (selectedSpecId && ids.includes(selectedSpecId)) setSelectedSpecId(null);
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

    const handleExport = async () => {
        try {
            const saved = await window.api.exportMarkdown();
            if (saved) message.success('Exported successfully');
        } catch (err: any) {
            message.error(err?.message || 'Export failed');
        }
    };

    const modalTitle = addMode === 'child' ? 'Add child spec' : addMode === 'sibling' ? 'Add sibling spec' : 'New spec';

    // No workspace
    if (!workspace) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 16 }}>
                <Title level={3}>📝 SpecBook</Title>
                <Text type="secondary">Select a workspace folder to get started</Text>
                <Button type="primary" size="large" icon={<FolderOpenOutlined />} onClick={handleSelectWorkspace}>Open Workspace</Button>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 40px)' }}>
            {/* Top bar */}
            <div style={{ flexShrink: 0, marginBottom: 8 }}>
                <Space style={{ width: '100%', justifyContent: 'space-between' }} align="center">
                    <Title level={4} style={{ margin: 0 }}>📝 Specs</Title>
                    <Space size={8}>
                        <Text type="secondary" style={{ fontSize: 12 }}>{workspace}</Text>
                        <Button size="small" icon={<ExportOutlined />} onClick={handleExport}>Export</Button>
                        <Button size="small" icon={<FolderOpenOutlined />} onClick={handleSelectWorkspace}>Change</Button>
                    </Space>
                </Space>
                <Divider style={{ margin: '8px 0' }} />
            </div>

            {/* Splitter: left tree | right detail */}
            <Splitter style={{ flex: 1, minHeight: 0 }}>
                <Splitter.Panel defaultSize="40%" min="240px" max="70%">
                    <div style={{ height: '100%', overflow: 'auto', paddingRight: 4 }}>
                        <SpecTable
                            specs={specs} loading={loading}
                            onDelete={handleDelete} onOpen={handleOpen}
                            onAddSibling={handleAddSibling} onAddChild={handleAddChild} onAddRoot={handleAddRoot}
                            onBatchDelete={handleBatchDelete} onBatchMove={handleBatchMove}
                        />
                    </div>
                </Splitter.Panel>
                <Splitter.Panel>
                    <div style={{
                        height: '100%',
                        borderLeft: `1px solid ${token.colorBorderSecondary}`,
                        overflow: 'auto',
                    }}>
                        <SpecDetailPanel specId={selectedSpecId} specs={specs} onSaved={handleSaved} />
                    </div>
                </Splitter.Panel>
            </Splitter>

            {/* Add modal */}
            <Modal title={modalTitle} open={!!addMode} onOk={handleAddConfirm} onCancel={handleAddCancel} confirmLoading={adding} okText="Add" destroyOnClose>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <Input placeholder="Spec title..." value={newTitle} onChange={e => setNewTitle(e.target.value)} onPressEnter={handleAddConfirm} autoFocus />
                    <Select
                        value={newType}
                        onChange={(val) => setNewType(val)}
                        style={{ width: '100%' }}
                        options={(
                            Object.entries(SPEC_TYPE_LABELS) as [SpecType, string][]
                        ).map(([value, label]) => ({ value, label }))}
                    />
                </div>
            </Modal>
        </div>
    );
};
