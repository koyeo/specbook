/**
 * Container component — VS Code-like layout.
 * Left pane: object tree   |   Right pane: detail editor (inline panel)
 */
import React, { useEffect, useState } from 'react';
import { Typography, Button, Space, Divider, message, Modal, Input, Splitter, theme } from 'antd';
import { ExportOutlined } from '@ant-design/icons';
import { ObjectTable } from '../components/SpecTable';
import { ObjectDetailPanel } from '../components/SpecDetailPanel';
import { useObjects } from '../hooks/useSpecs';

const { Title, Text } = Typography;
const { useToken } = theme;

interface ObjectPageProps {
    workspace: string | null;
}

export const ObjectPage: React.FC<ObjectPageProps> = ({ workspace }) => {
    const { token } = useToken();
    const {
        objects, loading, loadObjects,
        addObject, deleteObject, moveObject,
    } = useObjects();

    const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);

    // Add-new modal
    const [addMode, setAddMode] = useState<'root' | 'sibling' | 'child' | null>(null);
    const [addParentId, setAddParentId] = useState<string | null>(null);
    const [newTitle, setNewTitle] = useState('');
    const [adding, setAdding] = useState(false);

    useEffect(() => { if (workspace) loadObjects(); }, [workspace, loadObjects]);

    const handleDelete = async (id: string) => {
        try {
            await deleteObject(id);
            if (selectedObjectId === id) setSelectedObjectId(null);
            message.success('Deleted');
        } catch (err: any) { message.error(err?.message || 'Failed to delete'); }
    };

    const handleOpen = (id: string) => setSelectedObjectId(id);
    const handleSaved = () => loadObjects();

    const handleAddRoot = () => { setAddMode('root'); setAddParentId(null); setNewTitle(''); };
    const handleAddSibling = (_afterId: string, parentId: string | null) => { setAddMode('sibling'); setAddParentId(parentId); setNewTitle(''); };
    const handleAddChild = (parentId: string) => { setAddMode('child'); setAddParentId(parentId); setNewTitle(''); };

    const handleAddConfirm = async () => {
        if (!newTitle.trim()) return;
        setAdding(true);
        try {
            const parentId = addMode === 'root' ? null : addParentId;
            await addObject({ title: newTitle.trim(), parentId });
            message.success('Object added');
            setAddMode(null);
        } catch (err: any) {
            message.error(err?.message || 'Failed to add');
        } finally { setAdding(false); }
    };
    const handleAddCancel = () => setAddMode(null);

    const handleBatchDelete = async (ids: string[]) => {
        try {
            for (const id of ids) await deleteObject(id);
            if (selectedObjectId && ids.includes(selectedObjectId)) setSelectedObjectId(null);
            message.success(`Deleted ${ids.length} object(s)`);
        } catch (err: any) { message.error(err?.message || 'Batch delete failed'); }
    };

    const handleBatchMove = async (ids: string[], newParentId: string | null) => {
        try {
            for (const id of ids) await moveObject({ id, newParentId });
            message.success(`Moved ${ids.length} object(s)`);
        } catch (err: any) { message.error(err?.message || 'Batch move failed'); }
    };


    const handleExport = async () => {
        try {
            const saved = await window.api.exportMarkdown();
            if (saved) message.success('Exported successfully');
        } catch (err: any) {
            message.error(err?.message || 'Export failed');
        }
    };

    const modalTitle = addMode === 'child' ? 'Add Child Object' : addMode === 'sibling' ? 'Add Sibling Object' : 'New Object';

    if (!workspace) return null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
            {/* Top bar */}
            <div style={{ flexShrink: 0, marginBottom: 8 }}>
                <Space style={{ width: '100%', justifyContent: 'space-between' }} align="center">
                    <Title level={4} style={{ margin: 0 }}>Features</Title>
                    <Space size={8}>
                        <Button size="small" icon={<ExportOutlined />} onClick={handleExport}>Export</Button>
                    </Space>
                </Space>
                <Divider style={{ margin: '8px 0' }} />
            </div>

            {/* Splitter: left tree | right detail */}
            <Splitter style={{ flex: 1, minHeight: 0 }}>
                <Splitter.Panel defaultSize="40%" min="240px" max="70%">
                    <div style={{ height: '100%', overflow: 'auto', paddingRight: 4 }}>
                        <ObjectTable
                            objects={objects} loading={loading}
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
                        <ObjectDetailPanel specId={selectedObjectId} specs={objects} onSaved={handleSaved} />
                    </div>
                </Splitter.Panel>
            </Splitter>

            {/* Add modal */}
            <Modal title={modalTitle} open={!!addMode} onOk={handleAddConfirm} onCancel={handleAddCancel} confirmLoading={adding} okText="Add" destroyOnClose>
                <Input placeholder="Object title..." value={newTitle} onChange={e => setNewTitle(e.target.value)} onPressEnter={handleAddConfirm} autoFocus />
            </Modal>
        </div>
    );
};
