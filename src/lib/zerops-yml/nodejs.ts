import { FrameworkPattern } from '../framework-types';
import { getDependencies, fileExists } from '../fs-utils';

export const nodejsPattern: FrameworkPattern = {
    requiredFiles: ['package.json'],
    contentPatterns: [
        {
            file: 'package.json',
            patterns: ['"main":', '"scripts":']
        }
    ]
};

export const nodejsMetadata = {
    name: 'Node.js',
    type: 'nodejs',
    description: 'JavaScript runtime for server-side applications'
};

export function detectNodejsType(directoryPath: string): { 
    hasExpress: boolean, 
    hasKoa: boolean,
    hasNestjs: boolean,
    hasTypeScript: boolean 
} {
    try {
        const deps = getDependencies(directoryPath);
        
        return {
            hasExpress: !!deps['express'],
            hasKoa: !!deps['koa'],
            hasNestjs: !!deps['@nestjs/core'] || !!deps['@nestjs/common'],
            hasTypeScript: !!deps['typescript'] || fileExists(directoryPath, 'tsconfig.json')
        };
    } catch (error) {
        console.error('Error detecting Node.js type:', error);
    }
    
    return {
        hasExpress: false,
        hasKoa: false,
        hasNestjs: false,
        hasTypeScript: false
    };
}

export const nodejsYml = `zerops:
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

export const nestjsYml = nodejsYml;

export const expressYml = nodejsYml; 