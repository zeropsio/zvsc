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
    type: 'static' | 'nodejs' | 'golang' | 'python' | 'java' | 'unknown';
    description: string;
}

// Supported framework types (used for type safety)
export type SupportedFramework = 
    // JavaScript ecosystem
    'nextjs' | 'astro' | 'react' | 'vue' | 'nodejs' | 'javascript' | 'deno' | 'nestjs' |
    // GoLang ecosystem 
    'golang' | 'gin' | 'echo' | 'fiber' | 
    // Python ecosystem
    'python' | 'django' | 'flask' | 'fastapi' |
    // Java ecosystem
    'java' | 'spring' | 'springboot' | 'quarkus' | 'micronaut';

// Detector result interface
export interface FrameworkDetectionResult {
    detected: boolean;
    certainty: number;
    detectedItems: string[];
}

// Interface for common framework detection functions
export interface DetectedFramework {
    name: string;
    certainty: number;
    type: string;
    detectedItems?: string[];
}

export type FrameworkDetector = (directoryPath: string) => DetectedFramework; 