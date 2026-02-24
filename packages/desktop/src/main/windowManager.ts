/**
 * WindowManager — per-window workspace registry.
 *
 * Each BrowserWindow is mapped to its own workspace path,
 * enabling VS Code-style multi-window support.
 */
import { BrowserWindow, Menu, app, dialog } from 'electron';
import * as path from 'path';
import { IPC } from '@specbook/shared';
import { getLastWorkspace, saveLastWorkspace, addRecentWorkspace, getRecentWorkspaces } from './infrastructure/appConfig';

/** Map from webContents.id → workspace path */
const workspaceMap = new Map<number, string>();

/** Get workspace for a specific webContents sender. */
export function getWorkspaceForSender(webContentsId: number): string | null {
    return workspaceMap.get(webContentsId) ?? null;
}

/** Set workspace for a specific webContents sender. */
export function setWorkspaceForSender(webContentsId: number, workspace: string): void {
    workspaceMap.set(webContentsId, workspace);
    addRecentWorkspace(workspace);

    // Update window title
    const win = BrowserWindow.getAllWindows().find(w => w.webContents.id === webContentsId);
    if (win) {
        const basename = path.basename(workspace);
        win.setTitle(basename);
    }

    // Refresh dock menu with updated recent list
    refreshDockMenu();
}

/** Require workspace for a sender, throwing if not set. */
export function requireWorkspaceForSender(webContentsId: number): string {
    const ws = workspaceMap.get(webContentsId);
    if (!ws) {
        throw new Error('No workspace selected. Please open a folder first.');
    }
    return ws;
}

/** Create a new BrowserWindow, optionally pre-bound to a workspace. */
export function createWindow(workspacePath?: string): BrowserWindow {
    const isDev = !!process.env['ELECTRON_RENDERER_URL'];

    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        title: 'Specbook',
        icon: path.join(__dirname, '../../../shared/images/logo.icns'),
        webPreferences: {
            preload: path.join(__dirname, '../preload/index.js'),
            sandbox: false,
            devTools: isDev,
        },
    });

    // Capture id before window is destroyed
    const webContentsId = win.webContents.id;

    // Bind workspace if provided
    if (workspacePath) {
        workspaceMap.set(webContentsId, workspacePath);
        addRecentWorkspace(workspacePath);
        const basename = path.basename(workspacePath);
        win.setTitle(basename);
    }

    // Clean up on close (win is destroyed at this point, so use captured id)
    win.on('closed', () => {
        workspaceMap.delete(webContentsId);
    });

    // Load renderer
    if (process.env['ELECTRON_RENDERER_URL']) {
        win.loadURL(process.env['ELECTRON_RENDERER_URL']);
    } else {
        win.loadFile(path.join(__dirname, '../renderer/index.html'));
    }

    return win;
}

/** Open a new window with a folder picker dialog. */
export async function openWorkspaceInNewWindow(): Promise<void> {
    const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Select Workspace Folder',
    });
    if (result.canceled || result.filePaths.length === 0) return;
    createWindow(result.filePaths[0]);
}

/** Build and set the native macOS application menu. */
export function setupApplicationMenu(): void {
    const isMac = process.platform === 'darwin';

    const template: Electron.MenuItemConstructorOptions[] = [
        // App menu (macOS only)
        ...(isMac ? [{
            label: app.name,
            submenu: [
                { role: 'about' as const },
                { type: 'separator' as const },
                { role: 'services' as const },
                { type: 'separator' as const },
                { role: 'hide' as const },
                { role: 'hideOthers' as const },
                { role: 'unhide' as const },
                { type: 'separator' as const },
                { role: 'quit' as const },
            ],
        }] : []),

        // File menu
        {
            label: 'File',
            submenu: [
                {
                    label: 'New Window',
                    accelerator: 'CmdOrCtrl+Shift+N',
                    click: () => createWindow(),
                },
                {
                    label: 'Open Workspace in New Window…',
                    accelerator: 'CmdOrCtrl+Shift+O',
                    click: () => openWorkspaceInNewWindow(),
                },
                { type: 'separator' },
                isMac ? { role: 'close' as const } : { role: 'quit' as const },
            ],
        },

        // Edit menu
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' as const },
                { role: 'redo' as const },
                { type: 'separator' as const },
                { role: 'cut' as const },
                { role: 'copy' as const },
                { role: 'paste' as const },
                { role: 'selectAll' as const },
            ],
        },

        // View menu
        {
            label: 'View',
            submenu: [
                { role: 'reload' as const },
                { role: 'forceReload' as const },
                { type: 'separator' as const },
                { role: 'resetZoom' as const },
                { role: 'zoomIn' as const },
                { role: 'zoomOut' as const },
                { type: 'separator' as const },
                { role: 'togglefullscreen' as const },
            ],
        },

        // Window menu
        {
            label: 'Window',
            submenu: [
                { role: 'minimize' as const },
                { role: 'zoom' as const },
                ...(isMac ? [
                    { type: 'separator' as const },
                    { role: 'front' as const },
                ] : [
                    { role: 'close' as const },
                ]),
            ],
        },
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

/** Build and set the macOS dock right-click menu with recent workspaces. */
export function setupDockMenu(): void {
    if (process.platform !== 'darwin') return;
    refreshDockMenu();
}

/** Refresh the dock menu (called when recent workspaces change). */
function refreshDockMenu(): void {
    if (process.platform !== 'darwin' || !app.dock) return;

    const recent = getRecentWorkspaces();

    const dockMenuItems: Electron.MenuItemConstructorOptions[] = [
        {
            label: 'New Window',
            click: () => createWindow(),
        },
    ];

    if (recent.length > 0) {
        dockMenuItems.push({ type: 'separator' });

        for (const ws of recent) {
            const basename = path.basename(ws);
            const dirname = path.dirname(ws);
            dockMenuItems.push({
                label: basename,
                sublabel: dirname,
                click: () => createWindow(ws),
            });
        }
    }

    const dockMenu = Menu.buildFromTemplate(dockMenuItems);
    app.dock.setMenu(dockMenu);
}
