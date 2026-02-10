/**
 * Pure validation functions for spec input.
 * Domain layer.
 */
import { v7 as uuidv7 } from 'uuid';

export interface ValidationResult {
    valid: boolean;
    error?: string;
}

/** Validate that spec description is non-empty. */
export function validateDescription(description: string): ValidationResult {
    const trimmed = description.trim();
    if (trimmed.length === 0) {
        return { valid: false, error: 'Description cannot be empty.' };
    }
    return { valid: true };
}

/** Generate a UUID v7 (time-sortable). */
export function generateId(): string {
    return uuidv7();
}
