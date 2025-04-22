import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { frameworkPatterns, frameworkMetadata, frameworkDetectors, getYamlForFramework } from './zerops-yml/index';
import { SupportedFramework, FrameworkPattern, FrameworkMetadata, FrameworkDetectionResult } from './framework-types';


export interface ScanResult {
    framework: SupportedFramework;
    certainty: number;
    detectedItems: string[];
    metadata: FrameworkMetadata;
}

export class Scanner {
    /**
     * Scans a directory to detect which framework is being used
     * @param directoryPath The path to scan
     * @returns The detected framework and certainty
     */
    public static async scanDirectory(directoryPath: string): Promise<ScanResult[]> {
        const results: ScanResult[] = [];
        
        for (const [framework, pattern] of Object.entries(frameworkPatterns)) {
            if (!Scanner.isSupportedFramework(framework)) {
                continue;
            }
            const result = await Scanner.checkFramework(directoryPath, framework as SupportedFramework, pattern as FrameworkPattern);
            if (result.certainty > 0) {
                results.push(result);
            }
        }
        
        results.sort((a, b) => b.certainty - a.certainty);
        
        return results;
    }
    
    /**
     * Checks if a directory matches a specific framework pattern
     */
    private static async checkFramework(
        directoryPath: string, 
        framework: SupportedFramework, 
        pattern: FrameworkPattern
    ): Promise<ScanResult> {
        const detectedItems: string[] = [];
        let certainty = 0;
        
        if (pattern.requiredFiles) {
            let foundFiles = 0;
            for (const file of pattern.requiredFiles) {
                const filePath = path.join(directoryPath, file);
                if (fs.existsSync(filePath)) {
                    detectedItems.push(`Found file: ${file}`);
                    foundFiles++;
                }
            }
            
            if (pattern.requiredFiles.length > 0) {
                certainty += (foundFiles / pattern.requiredFiles.length) * 40;
            }
        }
        
        if (pattern.requiredDirs) {
            let foundDirs = 0;
            for (const dir of pattern.requiredDirs) {
                const dirPath = path.join(directoryPath, dir);
                if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
                    detectedItems.push(`Found directory: ${dir}`);
                    foundDirs++;
                }
            }
            
            if (pattern.requiredDirs.length > 0) {
                certainty += (foundDirs / pattern.requiredDirs.length) * 30;
            }
        }
        
        if (pattern.contentPatterns) {
            let matchedPatterns = 0;
            let totalPatterns = 0;
            
            for (const contentPattern of pattern.contentPatterns) {
                const filePath = path.join(directoryPath, contentPattern.file);
                
                if (fs.existsSync(filePath)) {
                    const content = fs.readFileSync(filePath, 'utf8');
                    for (const patternText of contentPattern.patterns) {
                        totalPatterns++;
                        if (content.includes(patternText)) {
                            detectedItems.push(`Found pattern "${patternText}" in ${contentPattern.file}`);
                            matchedPatterns++;
                        }
                    }
                }
            }
            
            if (totalPatterns > 0) {
                certainty += (matchedPatterns / totalPatterns) * 30;
            }
        }
        
        if (pattern.dependencies) {
            const packageJsonPath = path.join(directoryPath, 'package.json');
            
            if (fs.existsSync(packageJsonPath)) {
                try {
                    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                    const allDeps = {
                        ...(packageJson.dependencies || {}),
                        ...(packageJson.devDependencies || {})
                    };
                    
                    let matchedDeps = 0;
                    let totalDeps = 0;
                    
                    for (const [dep, required] of Object.entries(pattern.dependencies)) {
                        totalDeps++;
                        const exists = dep in allDeps;
                        if ((required && exists) || (!required && !exists)) {
                            detectedItems.push(`Dependency check: ${dep} ${required ? 'found' : 'not found'}`);
                            matchedDeps++;
                        }
                    }
                    
                    if (totalDeps > 0) {
                        certainty += (matchedDeps / totalDeps) * 30;
                    }
                } catch (error) {
                }
            }
        }
        
        if (framework in frameworkDetectors && frameworkDetectors[framework as keyof typeof frameworkDetectors]) {
            try {
                const detector = frameworkDetectors[framework as keyof typeof frameworkDetectors];
                const detectorObj = detector as any;
                if (typeof detectorObj === 'function') {
                    const customDetectionResult = await detectorObj(directoryPath);
                    if (customDetectionResult.detected) {
                        certainty = Math.max(certainty, customDetectionResult.certainty);
                        detectedItems.push(...customDetectionResult.detectedItems);
                    }
                }
            } catch (error) {
            }
        }
        
        return {
            framework,
            certainty: Math.min(certainty, 100),
            detectedItems,
            metadata: frameworkMetadata[framework as keyof typeof frameworkMetadata] as FrameworkMetadata
        };
    }
    
    /**
     * Checks if a framework is in our supported list
     */
    private static isSupportedFramework(framework: string): framework is SupportedFramework {
        return [
            'nextjs', 'astro', 'react', 'vue', 'nodejs', 'javascript', 'deno', 'nestjs',
            'golang', 'gin', 'echo', 'fiber',
            'python', 'django', 'flask', 'fastapi',
            'java', 'spring', 'springboot', 'quarkus', 'micronaut'
        ].includes(framework);
    }
    
    /**
     * Generates a zerops.yml file for the detected framework
     * @param framework The detected framework
     * @param outputPath The path to write the zerops.yml file
     * @param directoryPath The path of the project directory
     * @returns true if successful, false otherwise
     */
    public static generateZeropsYml(framework: SupportedFramework, outputPath: string, directoryPath: string): boolean {
        try {
            const yml = getYamlForFramework(framework, directoryPath);
            
            fs.writeFileSync(outputPath, yml);
            return true;
        } catch (error) {
            console.error('Error generating zerops.yml:', error);
            return false;
        }
    }
    
    /**
     * Gets the metadata for a framework safely
     */
    private static getFrameworkMetadata(framework: string): { name: string; type: string; description: string } {
        const defaultMetadata = {
            name: framework.charAt(0).toUpperCase() + framework.slice(1),
            type: 'unknown',
            description: `${framework} framework`
        };
        
        if (Scanner.isSupportedFramework(framework)) {
            const supportedFramework = framework as SupportedFramework;
            if (supportedFramework in frameworkMetadata) {
                const metadata = frameworkMetadata[supportedFramework as keyof typeof frameworkMetadata];
                if (metadata) {
                    return {
                        name: metadata.name,
                        type: metadata.type,
                        description: metadata.description
                    };
                }
            }
        }
        
        return defaultMetadata;
    }
    
    /**
     * Gets additional information about a framework to display to the user
     */
    private static getFrameworkInfo(framework: string, directoryPath: string): string {
        try {
            if (!Scanner.isSupportedFramework(framework)) {
                return '';
            }
            
            const supportedFramework = framework as SupportedFramework;
            
            switch (supportedFramework) {
                case 'nextjs': {
                    if ('nextjs' in frameworkDetectors && 
                        'isStatic' in frameworkDetectors.nextjs && 
                        typeof frameworkDetectors.nextjs.isStatic === 'function') {
                        const isStatic = frameworkDetectors.nextjs.isStatic(directoryPath);
                        return `Detected as ${isStatic ? 'static' : 'server-rendered'} Next.js application`;
                    }
                    return 'Detected as Next.js application';
                }
                
                case 'astro': {
                    if ('astro' in frameworkDetectors && 
                        'isStatic' in frameworkDetectors.astro && 
                        typeof frameworkDetectors.astro.isStatic === 'function') {
                        const isStatic = frameworkDetectors.astro.isStatic(directoryPath);
                        return `Detected as ${isStatic ? 'static' : 'server-rendered'} Astro application`;
                    }
                    return 'Detected as Astro application';
                }
                
                case 'react': {
                    if ('react' in frameworkDetectors && 
                        'detectBuildTool' in frameworkDetectors.react &&
                        typeof frameworkDetectors.react.detectBuildTool === 'function') {
                        const buildTool = frameworkDetectors.react.detectBuildTool(directoryPath);
                        return `Detected as React application using ${buildTool === 'cra' ? 'Create React App' : buildTool === 'vite' ? 'Vite' : 'unknown build tool'}`;
                    }
                    return 'Detected as React application';
                }
                
                case 'vue': {
                    if ('vue' in frameworkDetectors && 
                        'detectConfiguration' in frameworkDetectors.vue &&
                        typeof frameworkDetectors.vue.detectConfiguration === 'function') {
                        const { version, buildTool } = frameworkDetectors.vue.detectConfiguration(directoryPath);
                        return `Detected as Vue.js ${version} application using ${buildTool === 'cli' ? 'Vue CLI' : buildTool === 'vite' ? 'Vite' : buildTool}`;
                    }
                    return 'Detected as Vue.js application';
                }
                
                case 'nodejs': {
                    if ('nodejs' in frameworkDetectors && 
                        'detectType' in frameworkDetectors.nodejs &&
                        typeof frameworkDetectors.nodejs.detectType === 'function') {
                        const nodeType = frameworkDetectors.nodejs.detectType(directoryPath);
                        let description = 'Detected as Node.js application';
                        if (nodeType.hasExpress) description += ' using Express';
                        else if (nodeType.hasKoa) description += ' using Koa';
                        if (nodeType.hasTypeScript) description += ' with TypeScript';
                        return description;
                    }
                    return 'Detected as Node.js application';
                }
                
                case 'nestjs': {
                    if ('nestjs' in frameworkDetectors && 
                        'detectConfig' in frameworkDetectors.nestjs &&
                        typeof frameworkDetectors.nestjs.detectConfig === 'function') {
                        const nestConfig = frameworkDetectors.nestjs.detectConfig(directoryPath);
                        let description = 'Detected as NestJS application';
                        if (nestConfig.hasGraphQL) description += ' with GraphQL';
                        if (nestConfig.hasMicroservices) description += ' with Microservices';
                        return description;
                    }
                    return 'Detected as NestJS application';
                }
                
                default:
                    return '';
            }
        } catch (error) {
            console.error(`Error getting framework info for ${framework}:`, error);
            return '';
        }
    }
    
    /**
     * Displays a quickpick to select which framework to use for zerops.yml
     * @param results Scan results
     * @param workspacePath Workspace path to save zerops.yml
     */
    public static async promptAndGenerateConfig(
        results: ScanResult[], 
        workspacePath: string
    ): Promise<void> {
        if (results.length === 0) {
            const useDefault = await vscode.window.showInformationMessage(
                'No specific framework detected. Use generic Node.js configuration?',
                'Yes', 'No'
            );
            
            if (useDefault === 'Yes') {
                const outputPath = path.join(workspacePath, 'zerops.yml');
                Scanner.generateZeropsYml('nodejs', outputPath, workspacePath);
                vscode.window.showInformationMessage('Generated zerops.yml with Node.js configuration');
                
                const doc = await vscode.workspace.openTextDocument(outputPath);
                await vscode.window.showTextDocument(doc);
            }
            return;
        }
        
        const items = results.map(result => {
            const frameworkInfo = Scanner.getFrameworkInfo(result.framework, workspacePath);
            
            return {
                label: `${result.metadata.name} (${Math.round(result.certainty)}% match)`,
                description: frameworkInfo || result.detectedItems.slice(0, 2).join(', '),
                detail: result.metadata.description,
                framework: result.framework
            };
        });
        
        items.push({
            label: 'Generic Node.js',
            description: 'Basic Node.js configuration',
            detail: 'Use if no other framework fits',
            framework: 'nodejs' as SupportedFramework
        });
        
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select framework for zerops.yml generation',
            ignoreFocusOut: true
        });
        
        if (selected) {
            const outputPath = path.join(workspacePath, 'zerops.yml');
            
            if (fs.existsSync(outputPath)) {
                const overwrite = await vscode.window.showWarningMessage(
                    'zerops.yml already exists. Do you want to overwrite it?',
                    'Yes', 'No'
                );
                
                if (overwrite !== 'Yes') {
                    return;
                }
            }
            
            if (Scanner.generateZeropsYml(selected.framework as SupportedFramework, outputPath, workspacePath)) {
                vscode.window.showInformationMessage(`Generated zerops.yml for ${selected.label.split(' ')[0]}`);
                
                const doc = await vscode.workspace.openTextDocument(outputPath);
                await vscode.window.showTextDocument(doc);
            } else {
                vscode.window.showErrorMessage('Failed to generate zerops.yml');
            }
        }
    }
    
    /**
     * Main entry point to scan current workspace and generate zerops.yml
     */
    public static async scanAndGenerate(): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('No workspace folder is open. Please open a folder first.');
            return;
        }
        
        const currentWorkspace = workspaceFolders[0].uri.fsPath;
        const { scanProjectForFramework } = require('../init');
        await scanProjectForFramework(currentWorkspace);
    }
}
