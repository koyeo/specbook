/**
 * Electron main process entry point.
 */
import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { registerIpcHandlers } from './ipc/specHandlers';
import { registerAiHandlers } from './ipc/aiHandlers';

function createWindow(): void {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        title: 'SpecBook',
        webPreferences: {
            preload: path.join(__dirname, '../preload/index.js'),
            sandbox: false,
        },
    });

    // electron-vite: dev server or bundled file
    if (process.env['ELECTRON_RENDERER_URL']) {
        win.loadURL(process.env['ELECTRON_RENDERER_URL']);
    } else {
        win.loadFile(path.join(__dirname, '../renderer/index.html'));
    }
}

app.whenReady().then(() => {
    registerIpcHandlers();
    registerAiHandlers();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
