import { FrameworkPattern, FrameworkMetadata } from '../../framework-types';
import { getDependencies } from '../../fs-utils';

export const nestjsPattern: FrameworkPattern = {
    requiredFiles: ['package.json'],
    contentPatterns: [
        {
            file: 'package.json',
            patterns: ['"@nestjs/core":', '"@nestjs/common":']
        }
    ],
    dependencies: {
        '@nestjs/core': true,
        '@nestjs/common': true
    }
};

export const nestjsMetadata: FrameworkMetadata = {
    name: 'NestJS',
    type: 'nodejs',
    description: 'Progressive Node.js framework for building server-side applications'
};

export function detectNestjsConfig(directoryPath: string): { 
    hasTypeScript: boolean,
    hasGraphQL: boolean,
    hasMicroservices: boolean
} {
    try {
        const deps = getDependencies(directoryPath);
        
        return {
            hasTypeScript: !!deps['typescript'] || true, // NestJS uses TypeScript by default
            hasGraphQL: !!deps['@nestjs/graphql'] || !!deps['apollo-server-express'],
            hasMicroservices: !!deps['@nestjs/microservices']
        };
    } catch (error) {
        console.error('Error detecting NestJS configuration:', error);
    }
    
    return {
        hasTypeScript: true,
        hasGraphQL: false,
        hasMicroservices: false
    };
}

export const nestjsYml = `zerops:
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
      start: npm run start:prod`; 