/**
 * Mermaid diagram renderer for code blocks.
 * Initializes mermaid and renders SVG from diagram source.
 */
import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { theme } from 'antd';

const { useToken } = theme;

let mermaidInitialized = false;
let idCounter = 0;

interface MermaidBlockProps {
    code: string;
}

export const MermaidBlock: React.FC<MermaidBlockProps> = ({ code }) => {
    const { token } = useToken();
    const containerRef = useRef<HTMLDivElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [svg, setSvg] = useState<string>('');
    const isDark = token.colorBgContainer !== '#ffffff';

    useEffect(() => {
        const render = async () => {
            if (!mermaidInitialized || mermaid.mermaidAPI) {
                mermaid.initialize({
                    startOnLoad: false,
                    theme: isDark ? 'dark' : 'default',
                    securityLevel: 'loose',
                    fontFamily: token.fontFamily,
                });
                mermaidInitialized = true;
            }

            const id = `mermaid-${Date.now()}-${idCounter++}`;
            try {
                const { svg: rendered } = await mermaid.render(id, code.trim());
                setSvg(rendered);
                setError(null);
            } catch (err: any) {
                setError(err?.message || 'Failed to render diagram');
                setSvg('');
                // Clean up failed render element
                const el = document.getElementById(`d${id}`);
                el?.remove();
            }
        };
        render();
    }, [code, isDark, token.fontFamily]);

    if (error) {
        return (
            <pre style={{
                padding: 12,
                borderRadius: 6,
                background: token.colorErrorBg,
                color: token.colorError,
                fontSize: 12,
                whiteSpace: 'pre-wrap',
                border: `1px solid ${token.colorErrorBorder}`,
            }}>
                Mermaid Error: {error}
            </pre>
        );
    }

    return (
        <div
            ref={containerRef}
            style={{ textAlign: 'center', padding: '8px 0' }}
            dangerouslySetInnerHTML={{ __html: svg }}
        />
    );
};
