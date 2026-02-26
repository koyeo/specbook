/**
 * Electron main process entry point.
 */
import { app, BrowserWindow, ipcMain } from 'electron';
import { IPC } from '@specbook/shared';
import { createWindow, setupApplicationMenu, setupDockMenu } from './windowManager';
import { getLastWorkspace } from './infrastructure/appConfig';
import { registerIpcHandlers } from './ipc/specHandlers';
import { registerAiHandlers } from './ipc/aiHandlers';
import { registerGlossaryHandlers } from './ipc/glossaryHandlers';
import { registerChatHandlers } from './ipc/chatHandlers';
import { registerKnowledgeHandlers } from './ipc/knowledgeHandlers';
import { registerGlobalRulesHandlers } from './ipc/globalRulesHandlers';
import { registerGlobalTestsHandlers } from './ipc/globalTestsHandlers';
import { registerScanHandlers } from './ipc/scanHandlers';
import { registerPromptHandlers } from './ipc/promptHandlers';
import { registerIssuesHandlers } from './ipc/issuesHandlers';
import { registerHomeHandlers } from './ipc/homeHandlers';
import { registerUserStoriesHandlers } from './ipc/userStoriesHandlers';

app.whenReady().then(() => {
    // Set up native menu (with New Window commands)
    setupApplicationMenu();
    setupDockMenu();

    // Register all IPC handlers (once, globally)
    registerIpcHandlers();
    registerAiHandlers();
    registerGlossaryHandlers();
    registerChatHandlers();
    registerKnowledgeHandlers();
    registerGlobalRulesHandlers();
    registerGlobalTestsHandlers();
    registerScanHandlers();
    registerPromptHandlers();
    registerIssuesHandlers();
    registerHomeHandlers();
    registerUserStoriesHandlers();

    // Handle "new window" request from renderer
    ipcMain.handle(IPC.NEW_WINDOW, () => {
        createWindow();
    });

    // Create initial window, restoring last workspace if available
    const lastWs = getLastWorkspace();
    createWindow(lastWs ?? undefined);

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
