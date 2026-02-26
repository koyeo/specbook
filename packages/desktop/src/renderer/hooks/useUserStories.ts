/**
 * Hook for user stories management.
 */
import { useState, useCallback } from 'react';
import type { UserStory, AddUserStoryPayload, UpdateUserStoryPayload } from '@specbook/shared';

export function useUserStories() {
    const [stories, setStories] = useState<UserStory[]>([]);
    const [loading, setLoading] = useState(true);

    const loadStories = useCallback(async () => {
        setLoading(true);
        try {
            const data = await window.userStoriesApi.loadStories();
            setStories(data);
        } catch {
            setStories([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const addStory = useCallback(async (payload: AddUserStoryPayload) => {
        const story = await window.userStoriesApi.addStory(payload);
        setStories(prev => [...prev, story]);
        return story;
    }, []);

    const updateStory = useCallback(async (payload: UpdateUserStoryPayload) => {
        const updated = await window.userStoriesApi.updateStory(payload);
        setStories(prev => prev.map(s => s.id === updated.id ? updated : s));
        return updated;
    }, []);

    const deleteStory = useCallback(async (id: string) => {
        await window.userStoriesApi.deleteStory(id);
        setStories(prev => prev.filter(s => s.id !== id));
    }, []);

    return { stories, loading, loadStories, addStory, updateStory, deleteStory };
}
