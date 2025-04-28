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
    private static CONFIDENCE_THRESHOLD = 70;
    private static DEEP_SCAN_LIMIT = 10;
    
    /**
     * Scans a directory to detect which framework is being used
     * @param directoryPath The path to scan
     * @returns The detected framework and certainty
     */
    public static async scanDirectory(directoryPath: string): Promise<ScanResult[]> {
        const results: ScanResult[] = [];
        
        try {
            // First try to detect based on explicit framework markers
            for (const [framework, pattern] of Object.entries(frameworkPatterns)) {
                if (!Scanner.isSupportedFramework(framework)) {
                    continue;
                }
                const result = await Scanner.checkFramework(directoryPath, framework as SupportedFramework, pattern as FrameworkPattern);
                if (result.certainty > 0) {
                    results.push(result);
                }
            }
            
            // Add deep recursive scanning for large projects with nested structures
            await Scanner.deepScan(directoryPath, results);
            
            results.sort((a, b) => b.certainty - a.certainty);
            
            return results;
        } catch (error) {
            console.error("Error scanning directory:", error);
            return results;
        }
    }
    
    /**
     * Performs a deep scan for projects with nested structures
     * @param directoryPath The root directory to scan
     * @param results The current results array to append to
     */
    private static async deepScan(directoryPath: string, results: ScanResult[], depth = 0): Promise<void> {
        if (depth >= Scanner.DEEP_SCAN_LIMIT) return;
        
        try {
            const items = fs.readdirSync(directoryPath);
            
            // Skip node_modules, .git and other common non-source dirs
            const skipDirs = ['node_modules', '.git', 'dist', 'build', '.vscode', '.idea'];
            
            for (const item of items) {
                const itemPath = path.join(directoryPath, item);
                
                if (fs.statSync(itemPath).isDirectory() && !skipDirs.includes(item)) {
                    // Check if this subdirectory contains its own project
                    const packageJsonPath = path.join(itemPath, 'package.json');
                    const goModPath = path.join(itemPath, 'go.mod');
                    const pyRequirementsPath = path.join(itemPath, 'requirements.txt');
                    const pomXmlPath = path.join(itemPath, 'pom.xml');
                    
                    const isSubProject = fs.existsSync(packageJsonPath) || 
                                         fs.existsSync(goModPath) || 
                                         fs.existsSync(pyRequirementsPath) ||
                                         fs.existsSync(pomXmlPath);
                    
                    if (isSubProject) {
                        // We found a sub-project, scan it
                        for (const [framework, pattern] of Object.entries(frameworkPatterns)) {
                            if (!Scanner.isSupportedFramework(framework)) {
                                continue;
                            }
                            const result = await Scanner.checkFramework(itemPath, framework as SupportedFramework, pattern as FrameworkPattern);
                            
                            if (result.certainty > 0) {
                                // Add subdirectory path to the framework name to distinguish it
                                result.detectedItems.push(`Found in subdirectory: ${item}`);
                                results.push(result);
                            }
                        }
                    }
                    
                    // Continue recursion
                    await Scanner.deepScan(itemPath, results, depth + 1);
                }
            }
        } catch (error) {
            console.error(`Error in deep scan at ${directoryPath}:`, error);
        }
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
        
        // Check required files
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
        
        // Check required directories
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
        
        // Check content patterns (strings inside files)
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
        
        // Check dependencies in package.json
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
                    console.error(`Error parsing package.json at ${packageJsonPath}:`, error);
                }
            }
        }
        
        // Apply custom detector function if available
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
                console.error(`Error in custom detector for ${framework}:`, error);
            }
        }
        
        // Apply priority boost if defined
        if (pattern.priority) {
            certainty += pattern.priority;
        }
        
        return {
            framework,
            certainty: Math.min(certainty, 100), // Cap at 100%
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
            'java', 'spring', 'springboot', 'quarkus', 'micronaut',
            // Newly added frameworks
            'php', 'laravel', 'symfony', 'wordpress',
            'ruby', 'rails',
            'dotnet', 'csharp', 'aspnet',
            'rust', 'actix', 'rocket',
            'kotlin', 'ktor'
        ].includes(framework);
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
                
                // Add more specific framework info cases
                
                default:
                    return '';
            }
        } catch (error) {
            console.error(`Error getting framework info for ${framework}:`, error);
            return '';
        }
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
            
            // Create the .vscode folder if it doesn't exist
            const vscodeDir = path.dirname(outputPath);
            if (!fs.existsSync(vscodeDir) && vscodeDir.includes('.vscode')) {
                fs.mkdirSync(vscodeDir, { recursive: true });
            }
            
            fs.writeFileSync(outputPath, yml);
            
            // Open the file in the editor
            vscode.workspace.openTextDocument(outputPath).then(doc => {
                vscode.window.showTextDocument(doc);
            });
            
            return true;
        } catch (error) {
            console.error('Error generating zerops.yml:', error);
            return false;
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
        
        const topResult = results[0];
        const hasHighConfidence = topResult.certainty >= Scanner.CONFIDENCE_THRESHOLD;
        
        // If the top result has high confidence, ask if user wants to use it
        // Otherwise, show all options sorted by confidence
        if (hasHighConfidence) {
            const useTopResult = await vscode.window.showInformationMessage(
                `Detected ${topResult.metadata.name} with ${Math.round(topResult.certainty)}% confidence. Use this configuration?`,
                'Yes', 'Show All Options', 'Cancel'
            );
            
            if (useTopResult === 'Yes') {
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
                
                if (Scanner.generateZeropsYml(topResult.framework, outputPath, workspacePath)) {
                    vscode.window.showInformationMessage(`Generated zerops.yml for ${topResult.metadata.name}`);
                } else {
                    vscode.window.showErrorMessage('Failed to generate zerops.yml');
                }
                return;
            } else if (useTopResult === 'Cancel') {
                return;
            }
            // If "Show All Options", continue to show all options below
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
        
        // Always add generic options
        items.push({
            label: 'Generic Node.js',
            description: 'Basic Node.js configuration',
            detail: 'Use if no other framework fits',
            framework: 'nodejs' as SupportedFramework
        });
        
        // Add option for custom configuration
        items.push({
            label: 'Custom Configuration',
            description: 'Create a custom configuration',
            detail: 'Start with a template and customize',
            framework: 'custom configuration' as any as SupportedFramework
        });
        
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select framework for zerops.yml generation',
            ignoreFocusOut: true
        });
        
        if (!selected) {
            return;
        }
        
        if (selected.framework === 'custom configuration' as any as SupportedFramework) {
            // TODO: Implement custom configuration flow
            vscode.window.showInformationMessage('Custom configuration option will be implemented in a future update.');
            return;
        }
        
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
        
        try {
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Scanning project...",
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: "Analyzing project structure..." });
                
                const results = await Scanner.scanDirectory(currentWorkspace);
                
                progress.report({ increment: 50, message: "Detecting frameworks..." });
                
                if (results.length === 0) {
                    vscode.window.showInformationMessage('No supported frameworks detected in the project.');
                    return;
                }
                
                progress.report({ increment: 90, message: "Framework detected, creating configuration..." });
                
                await Scanner.promptAndGenerateConfig(results, currentWorkspace);
                
                progress.report({ increment: 100, message: "Complete" });
            });
        } catch (error) {
            console.error('Error scanning project for framework:', error);
            vscode.window.showErrorMessage('Failed to scan project for framework');
        }
    }
}
