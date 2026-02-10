/**
 * Container component — orchestrates hooks and passes data to views.
 */
import React, { useEffect } from 'react';
import { Typography, Button, Space, Divider, message } from 'antd';
import { FolderOpenOutlined } from '@ant-design/icons';
import { SpecTable } from '../components/SpecTable';
import { SpecForm } from '../components/SpecForm';
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

    // Load specs when workspace is available
    useEffect(() => {
        if (workspace) {
            loadSpecs();
        }
    }, [workspace, loadSpecs]);

    const handleAdd = async (description: string, group: string) => {
        try {
            await addSpec({ description, group });
            message.success('Spec added');
        } catch (err: any) {
            message.error(err?.message || 'Failed to add spec');
        }
    };

    const handleUpdate = async (payload: { id: string;[key: string]: string | undefined }) => {
        try {
            await updateSpec(payload);
            message.success('Spec updated');
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
            />
        </div>
    );
};
