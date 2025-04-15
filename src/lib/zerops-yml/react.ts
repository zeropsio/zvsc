import { FrameworkPattern } from '../framework-types';
import { getDependencies } from '../fs-utils';

export const reactPattern: FrameworkPattern = {
    requiredFiles: ['package.json'],
    contentPatterns: [
        {
            file: 'package.json',
            patterns: ['"react":', '"react": "']
        }
    ],
    dependencies: {
        'react': true,
        'react-dom': true
    },
    requiredDirs: ['src']
};

export const reactMetadata = {
    name: 'React',
    type: 'static',
    description: 'JavaScript library for building user interfaces'
};

export function detectReactBuildTool(directoryPath: string): 'cra' | 'vite' | 'unknown' {
    try {
        const deps = getDependencies(directoryPath);
        
        if (deps['react-scripts']) {
            return 'cra';
        }
        
        if (deps['vite']) {
            return 'vite';
        }
    } catch (error) {
        console.error('Error detecting React build tool:', error);
    }
    
    return 'unknown';
}

export const reactYml = `zerops:
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

export const reactViteYml = reactYml; 