/**
 * User Stories store — file-based persistence for user story entries.
 * Stores in {workspace}/.specbook/user-stories.json
 */
import * as fs from 'fs';
import * as path from 'path';
import {
    SPEC_DIR,
    USER_STORIES_FILE,
} from '@specbook/shared';
import type {
    UserStory, UserStoryIndex,
} from '@specbook/shared';

function storiesPath(workspace: string): string {
    return path.join(workspace, SPEC_DIR, USER_STORIES_FILE);
}

export function readStories(workspace: string): UserStoryIndex {
    const filePath = storiesPath(workspace);
    if (!fs.existsSync(filePath)) {
        return { version: '1.0', stories: [] };
    }
    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw) as UserStoryIndex;
    } catch {
        return { version: '1.0', stories: [] };
    }
}

function writeStories(workspace: string, index: UserStoryIndex): void {
    const filePath = storiesPath(workspace);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(index, null, 2), 'utf-8');
}

export function loadStories(workspace: string): UserStory[] {
    return readStories(workspace).stories;
}

export function addStory(workspace: string, story: UserStory): void {
    const index = readStories(workspace);
    index.stories.push(story);
    writeStories(workspace, index);
}

export function updateStory(workspace: string, id: string, updates: Partial<UserStory>): UserStory {
    const index = readStories(workspace);
    const story = index.stories.find((s: UserStory) => s.id === id);
    if (!story) throw new Error(`User story not found: ${id}`);

    if (updates.title !== undefined) story.title = updates.title;
    if (updates.content !== undefined) story.content = updates.content;
    if (updates.tags !== undefined) story.tags = updates.tags;
    story.updatedAt = new Date().toISOString();

    writeStories(workspace, index);
    return story;
}

export function deleteStory(workspace: string, id: string): void {
    const index = readStories(workspace);
    index.stories = index.stories.filter((s: UserStory) => s.id !== id);
    writeStories(workspace, index);
}
