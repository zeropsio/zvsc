export interface FrameworkPattern {
    requiredFiles?: string[];
    requiredDirs?: string[];
    contentPatterns?: {
        file: string;
        patterns: string[];
    }[];
    dependencies?: {
        [key: string]: boolean;
    };
    priority?: number;
}

export interface FrameworkMetadata {
    name: string;
    type: 'static' | 'nodejs' | 'golang' | 'python' | 'java' | 'unknown';
    description: string;
}

export type SupportedFramework = 
    'nextjs' | 'astro' | 'react' | 'vue' | 'nodejs' | 'javascript' | 'deno' | 'nestjs' |
    'golang' | 'gin' | 'echo' | 'fiber' | 
    'python' | 'django' | 'flask' | 'fastapi' |
    'java' | 'spring' | 'springboot' | 'quarkus' | 'micronaut';

export interface FrameworkDetectionResult {
    detected: boolean;
    certainty: number;
    detectedItems: string[];
}

export interface DetectedFramework {
    name: string;
    certainty: number;
    type: string;
    detectedItems?: string[];
}

export type FrameworkDetector = (directoryPath: string) => DetectedFramework; 