/**
 * Markdown preview component with GFM and Mermaid support.
 * Uses react-markdown with remark-gfm plugin.
 * Mermaid code blocks are rendered as diagrams via MermaidBlock.
 */
import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { theme } from 'antd';
import { MermaidBlock } from './MermaidBlock';

const { useToken } = theme;

interface MarkdownPreviewProps {
    content: string;
}

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ content }) => {
    const { token } = useToken();

    if (!content.trim()) {
        return (
            <div style={{ color: token.colorTextQuaternary, fontSize: 13, fontStyle: 'italic' }}>
                No content yet.
            </div>
        );
    }

    return (
        <div className="markdown-preview" style={{ fontSize: 13, lineHeight: 1.7, color: token.colorText }}>
            <Markdown
                remarkPlugins={[remarkGfm]}
                components={{
                    // Override pre to avoid double-wrapping fenced code blocks
                    pre({ children }) {
                        return <>{children}</>;
                    },
                    code({ className, children, node, ...props }) {
                        const match = /language-(\w+)/.exec(className || '');
                        const lang = match?.[1];
                        const codeStr = String(children).replace(/\n$/, '');

                        // Mermaid code blocks → render as diagram
                        if (lang === 'mermaid') {
                            return <MermaidBlock code={codeStr} />;
                        }

                        // Fenced code block (has className like "language-js")
                        if (className) {
                            return (
                                <pre style={{
                                    background: token.colorFillQuaternary,
                                    padding: 12,
                                    borderRadius: 6,
                                    overflow: 'auto',
                                    fontSize: 12,
                                    lineHeight: 1.5,
                                    border: `1px solid ${token.colorBorderSecondary}`,
                                }}>
                                    <code
                                        style={{ fontFamily: 'Menlo, Monaco, Consolas, monospace' }}
                                        {...props}
                                    >
                                        {children}
                                    </code>
                                </pre>
                            );
                        }

                        // Inline code
                        return (
                            <code
                                style={{
                                    background: token.colorFillTertiary,
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                    fontSize: '0.9em',
                                    fontFamily: 'Menlo, Monaco, Consolas, monospace',
                                }}
                                {...props}
                            >
                                {children}
                            </code>
                        );
                    },
                    table({ children, node, ...props }) {
                        return (
                            <div style={{ overflowX: 'auto', marginBottom: 16 }}>
                                <table
                                    style={{
                                        borderCollapse: 'collapse',
                                        width: '100%',
                                        fontSize: 13,
                                    }}
                                    {...props}
                                >
                                    {children}
                                </table>
                            </div>
                        );
                    },
                    th({ children, node, ...props }) {
                        return (
                            <th
                                style={{
                                    border: `1px solid ${token.colorBorderSecondary}`,
                                    padding: '8px 12px',
                                    background: token.colorFillQuaternary,
                                    textAlign: 'left',
                                    fontWeight: 600,
                                }}
                                {...props}
                            >
                                {children}
                            </th>
                        );
                    },
                    td({ children, node, ...props }) {
                        return (
                            <td
                                style={{
                                    border: `1px solid ${token.colorBorderSecondary}`,
                                    padding: '8px 12px',
                                }}
                                {...props}
                            >
                                {children}
                            </td>
                        );
                    },
                    blockquote({ children, node, ...props }) {
                        return (
                            <blockquote
                                style={{
                                    borderLeft: `3px solid ${token.colorPrimary}`,
                                    margin: '12px 0',
                                    padding: '4px 16px',
                                    color: token.colorTextSecondary,
                                    background: token.colorFillQuaternary,
                                    borderRadius: '0 6px 6px 0',
                                }}
                                {...props}
                            >
                                {children}
                            </blockquote>
                        );
                    },
                    a({ children, href, node, ...props }) {
                        return (
                            <a
                                href={href}
                                style={{ color: token.colorPrimary }}
                                target="_blank"
                                rel="noopener noreferrer"
                                {...props}
                            >
                                {children}
                            </a>
                        );
                    },
                    hr() {
                        return (
                            <hr style={{
                                border: 'none',
                                borderTop: `1px solid ${token.colorBorderSecondary}`,
                                margin: '16px 0',
                            }} />
                        );
                    },
                    img({ src, alt, node, ...props }) {
                        return (
                            <img
                                src={src}
                                alt={alt}
                                style={{ maxWidth: '100%', borderRadius: 6 }}
                                {...props}
                            />
                        );
                    },
                }}
            >
                {content}
            </Markdown>
        </div>
    );
};

