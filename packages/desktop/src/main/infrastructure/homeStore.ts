/**
 * Infrastructure layer — Home page storage with JSON file.
 * Storage: .specbook/home.json (markdown content)
 */
import * as fs from 'fs';
import * as path from 'path';
import { SPEC_DIR, HOME_FILE } from '@specbook/shared';
import type { HomeData } from '@specbook/shared';

function homePath(workspace: string): string {
    return path.join(workspace, SPEC_DIR, HOME_FILE);
}

function ensureDir(workspace: string): void {
    const dir = path.join(workspace, SPEC_DIR);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

const DEFAULT_HOME: HomeData = {
    version: '1.0',
    content: `# Welcome to Specbook 👋

This is the **Home** page of your project specification workspace.

Use this page to share important information with your team:

- 🏗️ **Project setup** instructions
- 📦 **Dependencies** and prerequisites
- 🔧 **Development environment** configuration
- 📝 **Conventions** and coding standards
- 🚀 **Getting started** guide for new developers

---

*Click the **Edit** button above to customize this page.*
`,
};

export function loadHome(workspace: string): HomeData {
    const fp = homePath(workspace);
    if (!fs.existsSync(fp)) {
        return DEFAULT_HOME;
    }
    try {
        return JSON.parse(fs.readFileSync(fp, 'utf-8'));
    } catch {
        return DEFAULT_HOME;
    }
}

export function saveHome(workspace: string, content: string): void {
    ensureDir(workspace);
    const data: HomeData = { version: '1.0', content };
    fs.writeFileSync(homePath(workspace), JSON.stringify(data, null, 2) + '\n', 'utf-8');
}
