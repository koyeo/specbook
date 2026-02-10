/**
 * Container component — orchestrates hooks and passes data to views.
 */
import React, { useEffect, useState } from 'react';
import { Typography, Button, Space, Divider, message, Modal, Input, AutoComplete } from 'antd';
import { FolderOpenOutlined } from '@ant-design/icons';
import { SpecTable } from '../components/SpecTable';
import { SpecForm } from '../components/SpecForm';
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

    // Add-child modal state
    const [addChildParentId, setAddChildParentId] = useState<string | null>(null);
    const [childTitle, setChildTitle] = useState('');
    const [addingChild, setAddingChild] = useState(false);

    // Load specs when workspace is available
    useEffect(() => {
        if (workspace) {
            loadSpecs();
        }
    }, [workspace, loadSpecs]);

    const handleAdd = async (title: string, context: string) => {
        try {
            await addSpec({ title, context });
            message.success('Spec added');
        } catch (err: any) {
            message.error(err?.message || 'Failed to add spec');
        }
    };

    const handleUpdate = async (payload: { id: string;[key: string]: string | undefined }) => {
        try {
            await updateSpec(payload);
        } catch (err: any) {
            message.error(err?.message || 'Failed to update spec');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteSpec(id);
            message.success('Spec deleted');
        } catch (err: any) {
            message.error(err?.message || 'Failed to delete spec');
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

    const handleDrawerSaved = () => {
        loadSpecs();
    };

    const handleAddChild = (parentId: string) => {
        setAddChildParentId(parentId);
        setChildTitle('');
    };

    const handleAddChildConfirm = async () => {
        if (!addChildParentId || !childTitle.trim()) return;
        setAddingChild(true);
        try {
            await addSpec({ title: childTitle.trim(), context: '', parentId: addChildParentId });
            message.success('Child spec added');
            setAddChildParentId(null);
            setChildTitle('');
        } catch (err: any) {
            message.error(err?.message || 'Failed to add child');
        } finally {
            setAddingChild(false);
        }
    };

    const handleAddChildCancel = () => {
        setAddChildParentId(null);
        setChildTitle('');
    };

    const handleSelectWorkspace = async () => {
        await selectWorkspace();
    };

    // ─── No workspace selected ───────────────────────
    if (!workspace) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                gap: 16,
            }}>
                <Title level={3}>📝 SpecBook</Title>
                <Text type="secondary">Select a workspace folder to get started</Text>
                <Button
                    type="primary"
                    size="large"
                    icon={<FolderOpenOutlined />}
                    onClick={handleSelectWorkspace}
                >
                    Open Workspace
                </Button>
            </div>
        );
    }

    // ─── Workspace loaded ────────────────────────────
    return (
        <div>
            <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }} align="center">
                <Title level={4} style={{ margin: 0 }}>📝 Specs</Title>
                <Space size={8}>
                    <Text type="secondary" style={{ fontSize: 12 }}>{workspace}</Text>
                    <Button size="small" icon={<FolderOpenOutlined />} onClick={handleSelectWorkspace}>
                        Change
                    </Button>
                </Space>
            </Space>
            <Divider style={{ margin: '12px 0' }} />

            <SpecForm existingSpecs={specs} onAdd={handleAdd} />
            <SpecTable
                specs={specs}
                loading={loading}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onOpen={handleOpen}
                onAddChild={handleAddChild}
            />

            <SpecDetailDrawer
                specId={drawerSpecId}
                open={drawerOpen}
                onClose={handleDrawerClose}
                onSaved={handleDrawerSaved}
            />

            {/* Add child modal */}
            <Modal
                title="Add child spec"
                open={!!addChildParentId}
                onOk={handleAddChildConfirm}
                onCancel={handleAddChildCancel}
                confirmLoading={addingChild}
                okText="Add"
                destroyOnClose
            >
                <Input
                    placeholder="Enter child spec title..."
                    value={childTitle}
                    onChange={e => setChildTitle(e.target.value)}
                    onPressEnter={handleAddChildConfirm}
                    autoFocus
                />
            </Modal>
        </div>
    );
};
