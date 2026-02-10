/**
 * View component — Form for adding a new spec.
 */
import React, { useState, useRef, useMemo } from 'react';
import { Input, Button, AutoComplete, Space } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { SpecSummary } from '@specbook/shared';

interface SpecFormProps {
    existingSpecs: SpecSummary[];
    onAdd: (description: string, group: string) => Promise<void>;
}

export const SpecForm: React.FC<SpecFormProps> = ({ existingSpecs, onAdd }) => {
    const [description, setDescription] = useState('');
    const [group, setGroup] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const descRef = useRef<any>(null);

    // Auto-complete options from existing groups
    const groupOptions = useMemo(() => {
        const groups = [...new Set(existingSpecs.map(s => s.group).filter(g => g !== 'Ungrouped'))];
        return groups.sort().map(g => ({ value: g }));
    }, [existingSpecs]);

    const handleSubmit = async () => {
        const trimmed = description.trim();
        if (!trimmed) return;

        setSubmitting(true);
        try {
            await onAdd(trimmed, group.trim() || 'Ungrouped');
            setDescription('');
            // Keep group for batch entry
            descRef.current?.focus();
        } catch (err) {
            console.error('Failed to add spec:', err);
        } finally {
            setSubmitting(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <Space.Compact style={{ width: '100%', marginBottom: 20 }}>
            <Input
                ref={descRef}
                placeholder="Enter spec description..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{ flex: 1 }}
                allowClear
            />
            <AutoComplete
                placeholder="Group"
                value={group}
                onChange={setGroup}
                options={groupOptions}
                style={{ width: 180 }}
                onKeyDown={handleKeyDown}
                filterOption={(inputValue, option) =>
                    option?.value.toLowerCase().includes(inputValue.toLowerCase()) ?? false
                }
            />
            <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleSubmit}
                loading={submitting}
            >
                Add
            </Button>
        </Space.Compact>
    );
};
