import { FrameworkPattern, FrameworkMetadata } from '../../framework-types';
import { getDependencies } from '../../fs-utils';

export const vuePattern: FrameworkPattern = {
    requiredFiles: ['package.json'],
    contentPatterns: [
        {
            file: 'package.json',
            patterns: ['"vue":', '"vue": "']
        }
    ],
    dependencies: {
        'vue': true
    }
};

export const vueMetadata: FrameworkMetadata = {
    name: 'Vue.js',
    type: 'static',
    description: 'Progressive JavaScript framework for building UIs'
};

export function detectVueConfiguration(directoryPath: string): { version: 2 | 3, buildTool: 'cli' | 'vite' | 'webpack' | 'unknown' } {
    try {
        const deps = getDependencies(directoryPath);
        const vueVersion = deps['vue'] || '';
        
        const version = vueVersion.startsWith('3') ? 3 : 2;
        
        let buildTool = 'unknown';
        
        if (deps['@vue/cli-service']) {
            buildTool = 'cli';
        } else if (deps['vite']) {
            buildTool = 'vite';
        } else if (deps['webpack']) {
            buildTool = 'webpack';
        }
        
        return { version, buildTool };
    } catch (error) {
        console.error('Error detecting Vue configuration:', error);
        return { version: 3, buildTool: 'unknown' };
    }
}

export const vueCliYml = `zerops:
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

export const vueViteYml = vueCliYml; 