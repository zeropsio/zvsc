import { FrameworkPattern, FrameworkMetadata } from '../../framework-types';
import { fileExists, fileContains } from '../../fs-utils';

export const astroPattern: FrameworkPattern = {
    requiredFiles: ['astro.config.mjs', 'package.json'],
    contentPatterns: [
        {
            file: 'package.json',
            patterns: ['"astro":', '"astro": "']
        }
    ],
    dependencies: {
        'astro': true
    }
};

export const astroMetadata: FrameworkMetadata = {
    name: 'Astro',
    type: 'nodejs',
    description: 'Modern framework for building fast websites'
};

export function isStaticAstro(directoryPath: string): boolean {
    try {
        if (fileExists(directoryPath, 'astro.config.mjs')) {
            const hasServerAdapter = 
                fileContains(directoryPath, 'astro.config.mjs', '@astrojs/node') || 
                fileContains(directoryPath, 'astro.config.mjs', '@astrojs/vercel') || 
                fileContains(directoryPath, 'astro.config.mjs', '@astrojs/netlify') ||
                fileContains(directoryPath, 'astro.config.mjs', '@astrojs/deno');
                
            return !hasServerAdapter;
        }
    } catch (error) {
        console.error('Error checking Astro static configuration:', error);
    }
    
    return true;
}

export const astroYml = `zerops:
  - setup: app
    build:
      base: nodejs@22
      buildCommands:
        - npm i
        - npm run build
      deployFiles:
        - dist
        - package.json
        - node_modules
      cache:
        - node_modules
        - package-lock.json
    run:
      base: nodejs@22
      ports:
        - port: 3000
          httpSupport: true
      start: npm start`;

export const astroStaticYml = astroYml; 