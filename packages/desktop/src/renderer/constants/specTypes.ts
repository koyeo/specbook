/**
 * Spec type constants for the renderer.
 * Duplicated from @specbook/shared because the shared package outputs CJS
 * which Vite's ESM renderer cannot import named exports from.
 */
import type { SpecType } from '@specbook/shared';

/** Display labels for spec types. */
export const SPEC_TYPE_LABELS: Record<SpecType, string> = {
    information_display: 'Information Display',
    action_entry: 'Action Entry',
    state_change: 'State Change',
};

/** Colors for spec types. */
export const SPEC_TYPE_COLORS: Record<SpecType, string> = {
    information_display: '#1677ff',
    action_entry: '#52c41a',
    state_change: '#fa8c16',
};
