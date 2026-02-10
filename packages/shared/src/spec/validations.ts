/**
 * Pure validation functions for spec input.
 * Domain layer — zero external dependencies.
 */

export interface ValidationResult {
    valid: boolean;
    error?: string;
}

/** Validate that spec content is non-empty and meaningful. */
export function validateSpecContent(content: string): ValidationResult {
    const trimmed = content.trim();

    if (trimmed.length === 0) {
        return { valid: false, error: 'Spec content cannot be empty.' };
    }

    if (trimmed.length < 3) {
        return { valid: false, error: 'Spec content is too short (minimum 3 characters).' };
    }

    return { valid: true };
}

/**
 * Generate a filename for a spec based on current timestamp.
 * Format: spec-YYYYMMDD-HHmmss
 */
export function generateSpecFilename(now: Date = new Date()): string {
    const pad = (n: number) => String(n).padStart(2, '0');

    const y = now.getFullYear();
    const m = pad(now.getMonth() + 1);
    const d = pad(now.getDate());
    const hh = pad(now.getHours());
    const mm = pad(now.getMinutes());
    const ss = pad(now.getSeconds());

    return `spec-${y}${m}${d}-${hh}${mm}${ss}`;
}
