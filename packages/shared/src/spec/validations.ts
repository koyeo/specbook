/**
 * Pure validation functions for spec input.
 * Domain layer.
 */
import { v7 as uuidv7 } from 'uuid';

export interface ValidationResult {
    valid: boolean;
    error?: string;
}

/** Validate that spec title is non-empty. */
export function validateTitle(title: string): ValidationResult {
    const trimmed = title.trim();
    if (trimmed.length === 0) {
        return { valid: false, error: 'Title cannot be empty.' };
    }
    return { valid: true };
}

/** Generate a UUID v7 (time-sortable). */
export function generateId(): string {
    return uuidv7();
}
