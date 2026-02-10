/**
 * Workspace persistence — stores last opened workspace in ~/.specbook/config.json.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.specbook');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

interface AppConfig {
    lastWorkspace?: string;
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
