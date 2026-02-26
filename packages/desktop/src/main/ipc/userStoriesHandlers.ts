/**
 * IPC handlers for User Stories CRUD operations.
 */
import { ipcMain } from 'electron';
import {
    IPC, generateId,
} from '@specbook/shared';
import type {
    AddUserStoryPayload, UpdateUserStoryPayload, UserStory,
} from '@specbook/shared';
import * as userStoriesStore from '../infrastructure/userStoriesStore';
import { requireWorkspaceForSender } from '../windowManager';

export function registerUserStoriesHandlers(): void {
    // Load all stories
    ipcMain.handle(IPC.USER_STORIES_LOAD, (event) => {
        try {
            const ws = requireWorkspaceForSender(event.sender.id);
            return userStoriesStore.loadStories(ws);
        } catch {
            return [];
        }
    });

    // Add story
    ipcMain.handle(IPC.USER_STORIES_ADD, (event, payload: AddUserStoryPayload) => {
        const ws = requireWorkspaceForSender(event.sender.id);
        const now = new Date().toISOString();
        const story: UserStory = {
            id: generateId(),
            title: payload.title,
            content: payload.content ?? '',
            tags: payload.tags ?? [],
            createdAt: now,
            updatedAt: now,
        };
        userStoriesStore.addStory(ws, story);
        return story;
    });

    // Update story
    ipcMain.handle(IPC.USER_STORIES_UPDATE, (event, payload: UpdateUserStoryPayload) => {
        const ws = requireWorkspaceForSender(event.sender.id);
        return userStoriesStore.updateStory(ws, payload.id, {
            title: payload.title,
            content: payload.content,
            tags: payload.tags,
        });
    });

    // Delete story
    ipcMain.handle(IPC.USER_STORIES_DELETE, (event, id: string) => {
        const ws = requireWorkspaceForSender(event.sender.id);
        userStoriesStore.deleteStory(ws, id);
    });
}
