/**
 * View component — Drawer for editing spec detail (content).
 */
import React, { useState, useEffect } from 'react';
import { Drawer, Input, Button, Space, message, Spin } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import type { SpecDetail, UpdateSpecPayload } from '@specbook/shared';

const { TextArea } = Input;

interface SpecDetailDrawerProps {
    specId: string | null;
    open: boolean;
    onClose: () => void;
    onSaved: () => void;
}

export const SpecDetailDrawer: React.FC<SpecDetailDrawerProps> = ({
    specId,
    open,
    onClose,
    onSaved,
}) => {
    const [detail, setDetail] = useState<SpecDetail | null>(null);
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Load detail when opened
    useEffect(() => {
        if (open && specId) {
            setLoading(true);
            window.api.getSpec(specId)
                .then((d) => {
                    setDetail(d);
                    setContent(d?.content || '');
                })
                .catch((err) => {
                    message.error('Failed to load spec detail');
                    console.error(err);
                })
                .finally(() => setLoading(false));
        } else {
            setDetail(null);
            setContent('');
        }
    }, [open, specId]);

    const handleSave = async () => {
        if (!specId) return;
        setSaving(true);
        try {
            await window.api.updateSpec({ id: specId, content });
            message.success('Content saved');
            onSaved();
            onClose();
        } catch (err: any) {
            message.error(err?.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    const hasChanges = detail ? content !== (detail.content || '') : false;

    return (
        <Drawer
            title={detail ? detail.title : 'Spec Detail'}
            open={open}
            onClose={onClose}
            width={560}
            extra={
                <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    onClick={handleSave}
                    loading={saving}
                    disabled={!hasChanges}
                >
                    Save
                </Button>
            }
        >
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}>
                    <Spin />
                </div>
            ) : (
                <TextArea
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder="Enter spec details, requirements, acceptance criteria..."
                    autoSize={{ minRows: 12 }}
                    style={{ fontSize: 13 }}
                />
            )}
        </Drawer>
    );
};
