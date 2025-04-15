// Define the framework detection pattern interface
export interface FrameworkPattern {
    // Files that must exist for this framework
    requiredFiles?: string[];
    // Directories that must exist for this framework
    requiredDirs?: string[];
    // Files to check for specific content patterns
    contentPatterns?: {
        file: string;
        patterns: string[];
    }[];
    // Package.json dependency checks
    dependencies?: {
        [key: string]: boolean; // true = required, false = should not exist
    };
    // Priority for framework detection (higher = more specific)
    priority?: number;
}

// Metadata about a framework for display and configuration
export interface FrameworkMetadata {
    name: string;
    type: 'static' | 'nodejs' | 'unknown';
    priority: number;
    description: string;
}

// Supported framework types (used for type safety)
export type SupportedFramework = 'nextjs' | 'astro' | 'react' | 'vue' | 'nodejs'; 