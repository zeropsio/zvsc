import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { CliService } from './cliService';

export class YamlGeneratorService {
    private static readonly RUNTIME_TYPES = [
        { label: 'Node.js', value: 'nodejs' },
        { label: 'Python', value: 'python' },
        { label: 'Go', value: 'go' },
        { label: 'PHP with Nginx', value: 'php-nginx' },
        { label: 'PHP with Apache', value: 'php-apache' },
        { label: 'Ruby', value: 'ruby' },
        { label: 'Rust', value: 'rust' },
        { label: 'Java', value: 'java' },
        { label: 'Deno', value: 'deno' },
        { label: 'Bun', value: 'bun' },
        { label: '.NET', value: 'dotnet' },
        { label: 'Static files', value: 'static' },
        { label: 'Runtime container', value: 'runtime' },
        { label: 'Docker', value: 'docker' },
        { label: 'Nginx', value: 'nginx' },
    ];

    private static getVersionsForType(schema: any, type: string): string[] {
        try {
            const baseValues = schema.properties.zerops.items.properties.run.properties.base.enum;
            if (!baseValues) {
                return ["latest"];
            }

            return baseValues
                .filter((value: string) => value.startsWith(`${type}@`) || value === type)
                .map((value: string) => value.startsWith(`${type}@`) ? value.split('@')[1] : 'latest');
        } catch (error) {
            console.error("Error getting versions from schema:", error);
            return ["latest"];
        }
    }

    static async createFromScratch(): Promise<void> {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                throw new Error('No workspace folder is open. Please open a folder first.');
            }
            
            const schema = await CliService.fetchYamlSchema();
            
            const createOption = await vscode.window.showQuickPick(
                [
                    { label: "Create new zerops.yml", value: "create" },
                    { label: "Add new setup to existing zerops.yml", value: "add" }
                ], 
                { placeHolder: "Select an option" }
            );
            
            if (!createOption) {
                return;
            }
            
            const currentWorkspace = workspaceFolders[0].uri.fsPath;
            const zeropsYmlPath = path.join(currentWorkspace, 'zerops.yml');
            
            if (createOption.value === "create" && fs.existsSync(zeropsYmlPath)) {
                const overwrite = await vscode.window.showWarningMessage(
                    'zerops.yml already exists. Do you want to overwrite it?',
                    'Yes', 'No'
                );
                
                if (overwrite !== 'Yes') {
                    return;
                }
            }
            
            const serviceName = await vscode.window.showInputBox({
                placeHolder: "Enter service name (hostname)",
                prompt: "This will be used as the hostname for your service",
                validateInput: (value) => {
                    if (!value) {
                        return "Service name is required";
                    }
                    if (!/^[a-z0-9-]+$/.test(value)) {
                        return "Service name can only contain lowercase letters, numbers, and hyphens";
                    }
                    return null;
                }
            });
            
            if (!serviceName) {
                return;
            }
            
            const runtimeType = await vscode.window.showQuickPick(
                this.RUNTIME_TYPES,
                { placeHolder: "Select runtime type" }
            );
            
            if (!runtimeType) {
                return;
            }
            
            const versions = this.getVersionsForType(schema, runtimeType.value);
            
            const versionOptions = versions.map(v => ({ label: v, value: v }));
            const version = await vscode.window.showQuickPick(
                versionOptions,
                { placeHolder: "Select version" }
            );
            
            if (!version) {
                return;
            }
            
            const baseValue = version.value === "latest" ? 
                `${runtimeType.value}@latest` : 
                `${runtimeType.value}@${version.value}`;
            
            let yamlContent = '';
            
            if (createOption.value === "create") {
                yamlContent = `zerops:
  - setup: ${serviceName}
    build:
      base: ${runtimeType.value === 'static' ? 'alpine@latest' : baseValue}
      prepareCommands:
        - echo "Add your build preparation commands here"
      buildCommands:
        - echo "Add your build commands here"
      deployFiles:
        - .
    run:
      base: ${baseValue}
      ports:
        - port: 8080
          httpSupport: true`;
            } else {
                if (!fs.existsSync(zeropsYmlPath)) {
                    yamlContent = `zerops:
  - setup: ${serviceName}
    build:
      base: ${runtimeType.value === 'static' ? 'alpine@latest' : baseValue}
      prepareCommands:
        - echo "Add your build preparation commands here"
      buildCommands:
        - echo "Add your build commands here"
      deployFiles:
        - .
    run:
      base: ${baseValue}
      ports:
        - port: 8080
          httpSupport: true`;
                } else {
                    const existingContent = fs.readFileSync(zeropsYmlPath, 'utf8');
                    
                    const newServiceYaml = `
  - setup: ${serviceName}
    build:
      base: ${runtimeType.value === 'static' ? 'alpine@latest' : baseValue}
      prepareCommands:
        - echo "Add your build preparation commands here"
      buildCommands:
        - echo "Add your build commands here"
      deployFiles:
        - .
    run:
      base: ${baseValue}
      ports:
        - port: 8080
          httpSupport: true`;
                    
                    if (existingContent.trim().length > 0) {
                        if (existingContent.endsWith('\n')) {
                            yamlContent = existingContent + newServiceYaml;
                        } else {
                            yamlContent = existingContent + '\n' + newServiceYaml;
                        }
                    } else {
                        yamlContent = `zerops:${newServiceYaml}`;
                    }
                }
            }
            
            fs.writeFileSync(zeropsYmlPath, yamlContent);
            
            const doc = await vscode.workspace.openTextDocument(zeropsYmlPath);
            await vscode.window.showTextDocument(doc);
            
            vscode.window.showInformationMessage(`zerops.yml has been ${createOption.value === "create" ? "created" : "updated"} successfully!`);
            
        } catch (error) {
            console.error('Error creating YAML from scratch:', error);
            vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
} 