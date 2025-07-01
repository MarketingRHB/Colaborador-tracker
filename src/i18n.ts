import * as fs from 'fs';
import * as path from 'path';

export function parseIni(content: string): Record<string, string> {
    const lines = content.split(/\r?\n/);
    const result: Record<string, string> = {};
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#') || trimmed.startsWith('[')) {
            continue;
        }
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex !== -1) {
            const key = trimmed.slice(0, eqIndex).trim();
            const value = trimmed.slice(eqIndex + 1).trim();
            result[key] = value;
        }
    }
    return result;
}

export async function loadIni(filePath: string): Promise<Record<string, string>> {
    try {
        const data = await fs.promises.readFile(filePath, 'utf8');
        return parseIni(data);
    } catch (e) {
        console.error('Failed to read translation file', filePath, e);
        return {};
    }
}

export function getPluginDir(app: any, manifest: { id: string }): string {
    const basePath = (app.vault.adapter as any).basePath;
    return path.join(basePath, '.obsidian', 'plugins', manifest.id);
}
