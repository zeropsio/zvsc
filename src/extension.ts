import * as vscode from 'vscode';
import { CliService } from './services/cliService';
import { StatusBarService } from './services/statusBarService';
import { CommandManager } from './services/commandManager';

export async function activate(context: vscode.ExtensionContext) {
    console.log('Activating Zerops extension...');
    
    try {
        const isCliInstalled = await CliService.checkCliInstalled();
        if (!isCliInstalled) {
            throw new Error('zcli is not installed. Please install zcli to use this extension.');
        }
        
        await CliService.checkLoginStatus();
        
        if (!CliService.getLoginStatus()) {
            try {
                const isLoggedIn = await CliService.autoLogin(context);
                if (isLoggedIn) {
                    console.log('Auto-login successful');
                }
            } catch (error) {
                console.error('Auto-login failed:', error);
            }
        } else {
            console.log('User is already logged in');
        }

        CliService.listProjects(false).catch(error => {
            console.error('Failed to fetch projects on startup:', error);
        });
        
        const statusBarService = StatusBarService.getInstance();
        statusBarService.registerHandlers();
        statusBarService.updateVisibility();
        statusBarService.showAll();
        statusBarService.registerToSubscriptions(context);
        
        const commandManager = CommandManager.getInstance();
        await commandManager.registerCommands(context);
        
        console.log('Zerops extension activated successfully');
    } catch (error) {
        console.error('Failed to activate Zerops extension:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
        vscode.window.showErrorMessage(`Failed to initialize Zerops extension: ${errorMessage}`);
    }
}

export function deactivate() {
    console.log('Deactivating Zerops extension...');
    
}