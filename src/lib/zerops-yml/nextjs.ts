import { FrameworkPattern } from '../framework-types';
import { fileExists, fileContains } from '../fs-utils';

export const nextjsPattern: FrameworkPattern = {
    requiredFiles: ['next.config.js', 'package.json'],
    contentPatterns: [
        {
            file: 'package.json',
            patterns: ['"next":', '"next": "']
        }
    ],
    dependencies: {
        'next': true,
        'react': true,
        'react-dom': true
    }
};

export const nextjsMetadata = {
    name: 'Next.js',
    type: 'nodejs',
    description: 'React framework with server-side rendering capabilities'
};

export function isStaticNextjs(directoryPath: string): boolean {
    try {
        if (fileExists(directoryPath, 'next.config.js')) {
            return fileContains(directoryPath, 'next.config.js', 'output: "export"') || 
                   fileContains(directoryPath, 'next.config.js', "output: 'export'");
        }
    } catch (error) {
        console.error('Error checking Next.js static configuration:', error);
    }
    
    return false;
}

export const nextjsYml = `zerops:
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
      start: npm start for dummy reasons only`;

export const nextjsStaticYml = nextjsYml;
