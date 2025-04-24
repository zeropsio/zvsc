import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { loadProjectSettings } from '../utils/settings';

export class GitHubWorkflowService {
    private static instance: GitHubWorkflowService;
    private workflowContent = `# This workflow automatically deploys your code to Zerops when you push to the main branch
# 
# SETUP INSTRUCTIONS:
# 1. You need to add ZEROPS_TOKEN as a GitHub secret:
#    - Go to your GitHub repository -> Settings -> Secrets and variables -> Actions
#    - Add a new repository secret named ZEROPS_TOKEN with your Zerops access token
#    - You can generate a token at https://app.zerops.io/settings/token-management
#
# 2. The Service ID below is automatically filled from your Zerops configuration
#    - You can find your service ID in the Zerops dashboard at https://app.zerops.io/dashboard/projects
#    - Go to your project -> Click on your service -> You can click on three dots on the right side of
#      the service -> Copy service ID or maybe you can just copy the service ID from the URL
#      (e.g., https://app.zerops.io/service-stack/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx/dashboard)

name: Deploy to Zerops

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Deploy with Zerops
        uses: zeropsio/actions@main
        with:
          access-token: \${{ secrets.ZEROPS_TOKEN }}
          service-id: {serviceId}`;

    private constructor() {}

    public static getInstance(): GitHubWorkflowService {
        if (!GitHubWorkflowService.instance) {
            GitHubWorkflowService.instance = new GitHubWorkflowService();
        }
        return GitHubWorkflowService.instance;
    }

    public getWorkflowContent(serviceId: string): string {
        return this.workflowContent.replace('{serviceId}', serviceId);
    }

    public async addWorkflow(): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('No workspace folder is open. Please open a folder first.');
            return;
        }

        const currentWorkspace = workspaceFolders[0].uri.fsPath;
        const workflowDir = path.join(currentWorkspace, '.github', 'workflows');
        const workflowPath = path.join(workflowDir, 'deploy.yml');

        if (fs.existsSync(workflowPath)) {
            const overwrite = await vscode.window.showWarningMessage(
                'GitHub workflow already exists. Do you want to overwrite it?',
                'Yes', 'No'
            );
            
            if (overwrite !== 'Yes') {
                return;
            }
        }

        const settings = await loadProjectSettings();
        if (!settings?.serviceId) {
            vscode.window.showErrorMessage('No service ID found. Please set a service ID in .vscode/zerops.json or through the Settings menu.');
            return;
        }

        try {
            if (!fs.existsSync(workflowDir)) {
                fs.mkdirSync(workflowDir, { recursive: true });
            }
            
            const content = this.getWorkflowContent(settings.serviceId);
            fs.writeFileSync(workflowPath, content);
            vscode.window.showInformationMessage('GitHub workflow has been created successfully!');
            
            const doc = await vscode.workspace.openTextDocument(workflowPath);
            await vscode.window.showTextDocument(doc);
        } catch (error) {
            console.error('Failed to create GitHub workflow:', error);
            vscode.window.showErrorMessage(`Failed to create GitHub workflow: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    public dispose(): void {
        // Clean up any resources if needed
    }
} 