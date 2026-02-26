/**
 * IPC handlers for Home page load/save operations.
 */
import { ipcMain } from 'electron';
import { IPC } from '@specbook/shared';
import * as homeStore from '../infrastructure/homeStore';
import { getLastWorkspace } from '../infrastructure/appConfig';

export function registerHomeHandlers(): void {
    ipcMain.handle(IPC.HOME_LOAD, () => {
        const ws = getLastWorkspace();
        if (!ws) throw new Error('No workspace selected');
        return homeStore.loadHome(ws);
    });

    ipcMain.handle(IPC.HOME_SAVE, (_event, content: string) => {
        const ws = getLastWorkspace();
        if (!ws) throw new Error('No workspace selected');
        homeStore.saveHome(ws, content);
    });
}
