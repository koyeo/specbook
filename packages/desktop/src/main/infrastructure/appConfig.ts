/**
 * Workspace persistence — stores last opened workspace in ~/.specbook/config.json.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { AiConfig, TokenUsage } from '@specbook/shared';

const CONFIG_DIR = path.join(os.homedir(), '.specbook');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const TOKEN_USAGE_FILE = path.join(CONFIG_DIR, 'token-usage.json');

interface AppConfig {
    lastWorkspace?: string;
    aiConfig?: AiConfig;
}

function ensureConfigDir(): void {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
}

function readConfig(): AppConfig {
    if (!fs.existsSync(CONFIG_FILE)) return {};
    try {
        return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    } catch {
        return {};
    }
}

function writeConfig(config: AppConfig): void {
    ensureConfigDir();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

export function getLastWorkspace(): string | null {
    const config = readConfig();
    if (config.lastWorkspace && fs.existsSync(config.lastWorkspace)) {
        return config.lastWorkspace;
    }
    return null;
}

export function saveLastWorkspace(workspace: string): void {
    const config = readConfig();
    config.lastWorkspace = workspace;
    writeConfig(config);
}

// ─── AI Config ──────────────────────────────────────

export function getAiConfig(): AiConfig | null {
    const config = readConfig();
    return config.aiConfig ?? null;
}

export function saveAiConfig(aiConfig: AiConfig): void {
    const config = readConfig();
    config.aiConfig = aiConfig;
    writeConfig(config);
}

// ─── Token Usage ────────────────────────────────────

export function appendTokenUsage(usage: TokenUsage): void {
    ensureConfigDir();
    const records = readTokenUsage();
    records.push(usage);
    fs.writeFileSync(TOKEN_USAGE_FILE, JSON.stringify(records, null, 2) + '\n', 'utf-8');
}

export function readTokenUsage(): TokenUsage[] {
    if (!fs.existsSync(TOKEN_USAGE_FILE)) return [];
    try {
        return JSON.parse(fs.readFileSync(TOKEN_USAGE_FILE, 'utf-8'));
    } catch {
        return [];
    }
}
