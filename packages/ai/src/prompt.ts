/**
 * Converts an ObjectTreeNode[] into a structured prompt for the AI model.
 */
import type { ObjectTreeNode } from '@specbook/shared';

/**
 * Render a tree of objects into a numbered-outline text block (no IDs).
 */
function renderTree(nodes: ObjectTreeNode[], prefix: string = '', depth: number = 0): string {
  const lines: string[] = [];
  nodes.forEach((node, idx) => {
    const num = prefix ? `${prefix}.${idx + 1}` : `${idx + 1}`;
    const indent = '  '.repeat(depth);
    const status = node.completed ? '✅' : '⬜';
    const stateTag = node.isState ? ' [STATE]' : '';
    lines.push(`${indent}${num} ${status} ${node.title}${stateTag}`);
    if (node.children && node.children.length > 0) {
      lines.push(renderTree(node.children, num, depth + 1));
    }
  });
  return lines.join('\n');
}

/**
 * Build the system prompt that instructs the AI on how to analyse objects.
 *
 * Key instructions:
 * - Search by object NAME (semantic matching), not by ID
 * - Return a scanned directory tree showing all analysed files
 * - Match objects to code modules based on naming, purpose, and functionality
 */
export function buildSystemPrompt(): string {
  return `You are a code analyst. You will receive a Spec Object Tree describing the intended features/components of a software project, along with the project workspace path.

## Your Task

For each object in the tree, search the project source code by **semantic meaning and purpose** — look for files, classes, functions, modules, or components that correspond to the object's role in the project. Do NOT rely on any IDs.

**IMPORTANT**: The object names in the tree are descriptive labels that reflect the project's structure and features — they are NOT necessarily the same names used in the source code. For example, an object named "User Login" might correspond to code files like \`auth.ts\`, \`SignInForm.tsx\`, or \`useSession.ts\`. You must use your understanding of software patterns and the project context to find the correct matches.

## Analysis Rules

1. **Semantic matching**: Match objects to code by purpose, not by name. Use your understanding of the object's role, its parent-child context, and common software patterns to find related code.
2. **Scan broadly**: Look through the entire project directory tree to find related code.
3. **Hierarchical context**: Parent–child relationships in the object tree imply containment. A child object is a sub-feature of its parent.

## Response Format

Respond ONLY with valid JSON matching this schema:

{
  "directoryTree": "<string: ASCII tree of all scanned files/directories, e.g.:\\n├── src/\\n│   ├── components/\\n│   │   ├── Auth.tsx\\n│   │   └── Dashboard.tsx\\n│   ├── hooks/\\n│   │   └── useAuth.ts\\n│   └── index.ts\\n├── package.json\\n└── tsconfig.json>",
  "mappings": [
    {
      "objectTitle": "<name of the object>",
      "status": "implemented" | "partial" | "not_found" | "unknown",
      "summary": "<concise analysis: what code implements this, or why not found>",
      "relatedFiles": [
        {
          "filePath": "<relative file path>",
          "description": "<how this file relates to the object>",
          "lineRange": { "start": <number>, "end": <number> }
        }
      ]
    }
  ]
}

## Important

- The \`directoryTree\` field must show the project file structure you scanned, formatted as an ASCII tree.
- Each mapping uses \`objectTitle\` (the human-readable name), NOT an ID.
- Do NOT include any text outside the JSON object.`;
}

/**
 * Build the user prompt containing the Object Tree context.
 */
export function buildUserPrompt(objectTree: ObjectTreeNode[], workspacePath?: string, projectTree?: string): string {
  const treeText = renderTree(objectTree);
  const wsInfo = workspacePath ? `\nProject workspace: ${workspacePath}` : '';

  let prompt = `Analyse the following Spec Object Tree and determine the implementation status of each object by searching the project's source code.${wsInfo}

## Object Tree

${treeText}`;

  if (projectTree) {
    prompt += `

## Project File Tree (Real)

The following is the ACTUAL file structure of the project. Use this to find related source files for each object:

\`\`\`
${projectTree}
\`\`\``;
  }

  prompt += `

For every object listed above, find the related code by semantic meaning, then respond with the JSON analysis.`;

  return prompt;
}
