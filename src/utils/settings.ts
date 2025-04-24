import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface ProjectSettings {
    serviceId?: string;
}

export async function loadProjectSettings(): Promise<ProjectSettings | undefined> {
    const configSettings = vscode.workspace.getConfiguration('zerops').get<ProjectSettings>('projectSettings');
    
    if (configSettings?.serviceId) {
        return configSettings;
    }
    
    try {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            const workspaceRoot = workspaceFolders[0].uri.fsPath;
            const zeropsJsonPath = path.join(workspaceRoot, '.vscode', 'zerops.json');
            
            if (fs.existsSync(zeropsJsonPath)) {
                const content = fs.readFileSync(zeropsJsonPath, 'utf8');
                const settings = JSON.parse(content);
                return settings;
            }
        }
    } catch (error) {
        console.error('Error reading .vscode/zerops.json:', error);
    }
    
    return configSettings;
} 