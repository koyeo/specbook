/**
 * Container component — VS Code-like layout.
 * Left: object tree | Detail | Implementations | Tests
 */
import React, { useEffect, useState } from 'react';
import { Typography, Button, Space, Divider, message, Modal, Input, Splitter, Tooltip, theme } from 'antd';
import { ExportOutlined } from '@ant-design/icons';
import { ObjectTable } from '../components/SpecTable';
import { ObjectDetailPanel } from '../components/SpecDetailPanel';
import { MarkdownPreview } from '../components/MarkdownPreview';
import { useObjects } from '../hooks/useSpecs';
import type { RelatedFile } from '@specbook/shared';

const { Title, Text } = Typography;
const { useToken } = theme;

/** Clickable file item for impl/test panels. */
const FileLink: React.FC<{ file: RelatedFile; color: string }> = ({ file, color }) => {
    const basename = file.filePath.split('/').pop() || file.filePath;
    return (
        <Tooltip title={`${file.filePath}${file.lineRange ? ` L${file.lineRange.start}-${file.lineRange.end}` : ''}${file.description ? `\n${file.description}` : ''}`}>
            <div
                style={{
                    cursor: 'pointer',
                    fontSize: 12,
                    color,
                    padding: '4px 12px',
                    transition: 'background 0.15s',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--ant-color-fill-secondary)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                onClick={() => {
                    window.api.openInEditor(file.filePath, file.lineRange?.start).catch((err: any) => {
                        message.error(err?.message || 'Failed to open file');
                    });
                }}
            >
                📄 {basename}
                {file.lineRange && <span style={{ opacity: 0.5, marginLeft: 4 }}>:{file.lineRange.start}</span>}
                {file.description && (
                    <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>— {file.description}</Text>
                )}
            </div>
        </Tooltip>
    );
};

/** A panel showing a list of files (impl or test), with optional summary. */
const FileListPanel: React.FC<{ title: string; files: RelatedFile[]; color: string; borderColor: string; summary?: string }> = React.memo(({
    title, files, color, borderColor, summary,
}) => {
    const header = (
        <div style={{ padding: '8px 12px', borderBottom: `1px solid ${borderColor}` }}>
            <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {title} ({files.length})
            </Text>
        </div>
    );

    const fileList = files.length === 0 && !summary ? (
        <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--ant-color-text-quaternary)', fontSize: 12 }}>
            No {title.toLowerCase()} linked
        </div>
    ) : (
        files.map((f, i) => <FileLink key={i} file={f} color={color} />)
    );

    if (!summary) {
        return (
            <div style={{ height: '100%', borderLeft: `1px solid ${borderColor}`, overflow: 'auto' }}>
                {header}
                {fileList}
            </div>
        );
    }

    return (
        <div style={{ height: '100%', borderLeft: `1px solid ${borderColor}`, display: 'flex', flexDirection: 'column' }}>
            {header}
            <Splitter layout="vertical" style={{ flex: 1, minHeight: 0 }}>
                <Splitter.Panel defaultSize="50%" style={{ overflow: 'auto' }}>
                    <div style={{ padding: '8px 12px', fontSize: 12 }}>
                        <MarkdownPreview content={summary} />
                    </div>
                </Splitter.Panel>
                <Splitter.Panel style={{ overflow: 'auto', borderTop: `1px solid ${borderColor}` }}>
                    {fileList}
                </Splitter.Panel>
            </Splitter>
        </div>
    );
});

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

    // Impl/test files for the selected object
    const [implFiles, setImplFiles] = useState<RelatedFile[]>([]);
    const [implSummary, setImplSummary] = useState<string | undefined>(undefined);
    const [testFiles, setTestFiles] = useState<RelatedFile[]>([]);

    // Add-new modal
    const [addMode, setAddMode] = useState<'root' | 'sibling' | 'child' | null>(null);
    const [addParentId, setAddParentId] = useState<string | null>(null);
    const [newTitle, setNewTitle] = useState('');
    const [adding, setAdding] = useState(false);

    useEffect(() => { if (workspace) loadObjects(); }, [workspace, loadObjects]);

    // Load impl/test files when selection changes
    useEffect(() => {
        if (!selectedObjectId) {
            setImplFiles([]);
            setImplSummary(undefined);
            setTestFiles([]);
            return;
        }
        const load = async () => {
            try {
                const [implData, tests] = await Promise.all([
                    window.api.loadImpls(selectedObjectId),
                    window.api.loadTests(selectedObjectId),
                ]);
                setImplFiles(implData.files);
                setImplSummary(implData.summary);
                setTestFiles(tests);
            } catch {
                setImplFiles([]);
                setImplSummary(undefined);
                setTestFiles([]);
            }
        };
        load();
    }, [selectedObjectId]);

    const handleDelete = async (id: string) => {
        try {
            await deleteObject(id);
            if (selectedObjectId === id) setSelectedObjectId(null);
            message.success('Deleted');
        } catch (err: any) { message.error(err?.message || 'Failed to delete'); }
    };

    const handleOpen = (id: string) => setSelectedObjectId(id);
    const handleSaved = () => {
        loadObjects();
        // Reload files after save (detail panel may have changed impls/tests)
        if (selectedObjectId) {
            Promise.all([
                window.api.loadImpls(selectedObjectId),
                window.api.loadTests(selectedObjectId),
            ]).then(([implData, tests]) => {
                setImplFiles(implData.files);
                setImplSummary(implData.summary);
                setTestFiles(tests);
            }).catch(() => { });
        }
    };

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

            {/* Splitter: tree | detail | impls | tests */}
            <Splitter style={{ flex: 1, minHeight: 0 }}>
                <Splitter.Panel defaultSize="30%" min="200px" max="50%">
                    <div style={{ height: '100%', overflow: 'auto', paddingRight: 4 }}>
                        <ObjectTable
                            objects={objects} loading={loading}
                            onDelete={handleDelete} onOpen={handleOpen}
                            onAddSibling={handleAddSibling} onAddChild={handleAddChild} onAddRoot={handleAddRoot}
                            onBatchDelete={handleBatchDelete} onBatchMove={handleBatchMove}
                        />
                    </div>
                </Splitter.Panel>
                <Splitter.Panel defaultSize="30%">
                    <div style={{
                        height: '100%',
                        borderLeft: `1px solid ${token.colorBorderSecondary}`,
                        overflow: 'auto',
                    }}>
                        <ObjectDetailPanel specId={selectedObjectId} specs={objects} onSaved={handleSaved} />
                    </div>
                </Splitter.Panel>
                <Splitter.Panel defaultSize="20%">
                    <FileListPanel
                        title="Implementations"
                        files={implFiles}
                        color="#52c41a"
                        borderColor={token.colorBorderSecondary}
                        summary={implSummary}
                    />
                </Splitter.Panel>
                <Splitter.Panel defaultSize="20%">
                    <FileListPanel
                        title="Tests"
                        files={testFiles}
                        color="#1677ff"
                        borderColor={token.colorBorderSecondary}
                    />
                </Splitter.Panel>
            </Splitter>

            {/* Add modal */}
            <Modal title={modalTitle} open={!!addMode} onOk={handleAddConfirm} onCancel={handleAddCancel} confirmLoading={adding} okText="Add" destroyOnClose>
                <Input placeholder="Object title..." value={newTitle} onChange={e => setNewTitle(e.target.value)} onPressEnter={handleAddConfirm} autoFocus />
            </Modal>
        </div>
    );
};
