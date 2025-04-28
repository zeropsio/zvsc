export interface FrameworkPattern {
    requiredFiles?: string[];
    requiredDirs?: string[];
    contentPatterns?: {
        file: string;
        patterns: string[];
    }[];
    dependencies?: {
        [key: string]: boolean; // true = required, false = should not exist
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
    'java' | 'spring' | 'springboot' | 'quarkus' | 'micronaut' |
    'php' | 'laravel' | 'symfony' | 'wordpress' |
    'ruby' | 'rails' |
    'dotnet' | 'csharp' | 'aspnet' |
    'rust' | 'rocket' |
    ;

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