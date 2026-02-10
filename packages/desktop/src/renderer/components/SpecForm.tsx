/**
 * View component — Form for adding a new spec.
 */
import React, { useState, useRef, useMemo } from 'react';
import { Input, Button, AutoComplete, Space } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { SpecSummary } from '@specbook/shared';

interface SpecFormProps {
    existingSpecs: SpecSummary[];
    onAdd: (title: string, context: string) => Promise<void>;
}

export const SpecForm: React.FC<SpecFormProps> = ({ existingSpecs, onAdd }) => {
    const [title, setTitle] = useState('');
    const [context, setContext] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const titleRef = useRef<any>(null);

    // Auto-complete options from existing contexts
    const contextOptions = useMemo(() => {
        const contexts = [...new Set(existingSpecs.map(s => s.context).filter(c => c !== 'Ungrouped'))];
        return contexts.sort().map(c => ({ value: c }));
    }, [existingSpecs]);

    const handleSubmit = async () => {
        const trimmed = title.trim();
        if (!trimmed) return;

        setSubmitting(true);
        try {
            await onAdd(trimmed, context.trim() || 'Ungrouped');
            setTitle('');
            // Keep context for batch entry
            titleRef.current?.focus();
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
            <AutoComplete
                placeholder="Context"
                value={context}
                onChange={setContext}
                options={contextOptions}
                style={{ width: 180 }}
                onKeyDown={handleKeyDown}
                filterOption={(inputValue, option) =>
                    option?.value.toLowerCase().includes(inputValue.toLowerCase()) ?? false
                }
            />
            <Input
                ref={titleRef}
                placeholder="Enter spec title..."
                value={title}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{ flex: 1 }}
                allowClear
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
