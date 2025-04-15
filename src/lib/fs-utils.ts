import * as fs from 'fs';
import * as path from 'path';

export function fileExists(directoryPath: string, fileName: string): boolean {
    const filePath = path.join(directoryPath, fileName);
    return fs.existsSync(filePath);
}

export function readFile(directoryPath: string, fileName: string): string {
    const filePath = path.join(directoryPath, fileName);
    if (!fs.existsSync(filePath)) {
        return '';
    }
    return fs.readFileSync(filePath, 'utf-8');
}

export function readJsonFile<T>(directoryPath: string, fileName: string): T | null {
    try {
        const content = readFile(directoryPath, fileName);
        if (!content) return null;
        return JSON.parse(content) as T;
    } catch (error) {
        console.error(`Error reading JSON file ${fileName}:`, error);
        return null;
    }
}

export function getPackageJson(directoryPath: string): any {
    return readJsonFile(directoryPath, 'package.json');
}

export function getDependencies(directoryPath: string): Record<string, string> {
    const packageJson = getPackageJson(directoryPath);
    if (!packageJson) return {};
    
    return {
        ...(packageJson.dependencies || {}),
        ...(packageJson.devDependencies || {})
    };
}

export function hasDependency(directoryPath: string, depName: string): boolean {
    const deps = getDependencies(directoryPath);
    return !!deps[depName];
}

export function fileContains(directoryPath: string, fileName: string, searchText: string): boolean {
    const content = readFile(directoryPath, fileName);
    return content.includes(searchText);
} 