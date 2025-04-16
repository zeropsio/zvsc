import { FrameworkPattern, FrameworkMetadata } from '../../framework-types';
import { fileExists, getDependencies } from '../../fs-utils';
import { nextjsPattern, nextjsMetadata, nextjsYml, nextjsStaticYml, isStaticNextjs } from './nextjs';
import { astroPattern, astroMetadata, astroYml, astroStaticYml, isStaticAstro } from './astro';
import { reactPattern, reactMetadata, reactYml, reactViteYml, detectReactBuildTool } from './react';
import { vuePattern, vueMetadata, vueCliYml, vueViteYml, detectVueConfiguration } from './vue';
import { nodejsPattern, nodejsMetadata, nodejsYml, expressYml, detectNodejsType } from './nodejs';
import { nestjsPattern, nestjsMetadata, nestjsYml, detectNestjsConfig } from './nestjs';

export const javascriptPattern: FrameworkPattern = {
    requiredFiles: ['package.json'],
    contentPatterns: [
        {
            file: 'package.json',
            patterns: ['"main":', '"scripts":']
        }
    ]
};

export const javascriptMetadata: FrameworkMetadata = {
    name: 'JavaScript',
    type: 'nodejs',
    description: 'High-level, interpreted programming language'
};

export function detectJavaScriptType(directoryPath: string): { 
    hasExpress: boolean, 
    hasKoa: boolean,
    hasTypeScript: boolean,
    hasEsModules: boolean,
    hasDeno: boolean
} {
    try {
        const deps = getDependencies(directoryPath);
        const fs = require('fs');
        const path = require('path');
        const packageJsonPath = path.join(directoryPath, 'package.json');
        
        let hasEsModules = false;
        if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            hasEsModules = packageJson.type === 'module';
        }
        
        return {
            hasExpress: !!deps['express'],
            hasKoa: !!deps['koa'],
            hasTypeScript: !!deps['typescript'] || fileExists(directoryPath, 'tsconfig.json'),
            hasEsModules,
            hasDeno: fileExists(directoryPath, 'deno.json') || fileExists(directoryPath, 'deno.jsonc')
        };
    } catch (error) {
        console.error('Error detecting JavaScript type:', error);
    }
    
    return {
        hasExpress: false,
        hasKoa: false,
        hasTypeScript: false,
        hasEsModules: false,
        hasDeno: false
    };
}

export const javascriptYml = `zerops:
  - setup: app
    build:
      base: nodejs@18
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
      base: nodejs@18
      ports:
        - port: 3000
          httpSupport: true
      start: npm start`;

export const javascriptTsYml = javascriptYml;
export const denoYml = `zerops:
  - setup: app
    build:
      base: deno@1.37
      buildCommands:
        - deno cache main.ts
      deployFiles:
        - "**/*.ts"
        - "**/*.js"
        - deno.json
      cache:
        - .deno-cache
    run:
      base: deno@1.37
      ports:
        - port: 8000
          httpSupport: true
      start: deno run --allow-net main.ts`;

// Export framework patterns
export {
    nextjsPattern, astroPattern, reactPattern, vuePattern, nodejsPattern, nestjsPattern,
    nextjsMetadata, astroMetadata, reactMetadata, vueMetadata, nodejsMetadata, nestjsMetadata,
    nextjsYml, nextjsStaticYml, astroYml, astroStaticYml, reactYml, reactViteYml,
    vueCliYml, vueViteYml, nodejsYml, nestjsYml, expressYml,
    isStaticNextjs, isStaticAstro, detectReactBuildTool, detectVueConfiguration, detectNodejsType, detectNestjsConfig
}; 