/**
 * Infrastructure layer — Feature Mapping persistence (.spec/mapping.json).
 */
import * as fs from 'fs';
import * as path from 'path';
import { SPEC_DIR, MAPPING_FILE } from '@specbook/shared';
import type { FeatureMappingIndex } from '@specbook/shared';

function mappingPath(workspace: string): string {
    return path.join(workspace, SPEC_DIR, MAPPING_FILE);
}

/** Read mapping.json. Returns null if file does not exist. */
export function readMapping(workspace: string): FeatureMappingIndex | null {
    const filePath = mappingPath(workspace);
    if (!fs.existsSync(filePath)) return null;
    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw) as FeatureMappingIndex;
    } catch {
        return null;
    }
}

/** Write mapping.json. */
export function writeMapping(workspace: string, data: FeatureMappingIndex): void {
    const dir = path.join(workspace, SPEC_DIR);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(mappingPath(workspace), JSON.stringify(data, null, 2) + '\n', 'utf-8');
}
