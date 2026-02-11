/**
 * Converts an ObjectTreeNode[] into a structured prompt for the AI model.
 */
import type { ObjectTreeNode } from '@specbook/shared';

/**
 * Render a tree of objects into a numbered-outline text block.
 */
function renderTree(nodes: ObjectTreeNode[], prefix: string = '', depth: number = 0): string {
    const lines: string[] = [];
    nodes.forEach((node, idx) => {
        const num = prefix ? `${prefix}.${idx + 1}` : `${idx + 1}`;
        const indent = '  '.repeat(depth);
        const status = node.completed ? '✅' : '⬜';
        const stateTag = node.isState ? ' [STATE]' : '';
        lines.push(`${indent}${num} ${status} ${node.title}${stateTag}  (id: ${node.id})`);
        if (node.children && node.children.length > 0) {
            lines.push(renderTree(node.children, num, depth + 1));
        }
    });
    return lines.join('\n');
}

/**
 * Build the system prompt that instructs the AI on how to analyse objects.
 */
export function buildSystemPrompt(): string {
    return `You are a code analyst. You will receive a Spec Object Tree that describes the intended objects/features of a software project. Your task is to analyse the project's source code and determine the implementation status of each object.

For each object, determine:
1. **status**: one of "implemented", "partial", "not_found", or "unknown"
2. **summary**: a concise description of how the object is implemented (or why it's not found)
3. **relatedFiles**: an array of related source files with their paths, descriptions, and optional line ranges

Respond ONLY with valid JSON matching this schema:
{
  "mappings": [
    {
      "objectId": "<id>",
      "objectTitle": "<title>",
      "status": "implemented" | "partial" | "not_found" | "unknown",
      "summary": "<analysis summary>",
      "relatedFiles": [
        {
          "filePath": "<relative file path>",
          "description": "<how this file relates to the object>",
          "lineRange": { "start": <number>, "end": <number> }  // optional
        }
      ]
    }
  ]
}

Do NOT include any text outside the JSON object.`;
}

/**
 * Build the user prompt containing the Object Tree context.
 */
export function buildUserPrompt(objectTree: ObjectTreeNode[], workspacePath?: string): string {
    const treeText = renderTree(objectTree);
    const wsInfo = workspacePath ? `\nProject workspace: ${workspacePath}` : '';

    return `Please analyse the following Spec Object Tree and determine the implementation status of each object in the project.${wsInfo}

## Object Tree

${treeText}

Respond with the JSON analysis for every object listed above.`;
}
