import { FrameworkPattern, FrameworkMetadata } from '../../framework-types';
import { fileExists } from '../../fs-utils';

export const golangPattern: FrameworkPattern = {
    requiredFiles: ['go.mod'],
    contentPatterns: [
        {
            file: 'go.mod',
            patterns: ['module ', 'go ']
        }
    ]
};

export const golangMetadata: FrameworkMetadata = {
    name: 'Go',
    type: 'golang',
    description: 'Statically typed compiled language designed at Google'
};

export function detectGolangType(directoryPath: string): { 
    hasGin: boolean,
    hasEcho: boolean,
    hasFiber: boolean,
    hasGorilla: boolean
} {
    try {
        const hasGoMod = fileExists(directoryPath, 'go.mod');
        const hasGoSum = fileExists(directoryPath, 'go.sum');
        
        if (!hasGoMod) {
            return {
                hasGin: false,
                hasEcho: false,
                hasFiber: false,
                hasGorilla: false
            };
        }
        
        const fs = require('fs');
        const path = require('path');
        const goModPath = path.join(directoryPath, 'go.mod');
        const content = fs.readFileSync(goModPath, 'utf8');
        
        return {
            hasGin: content.includes('github.com/gin-gonic/gin'),
            hasEcho: content.includes('github.com/labstack/echo'),
            hasFiber: content.includes('github.com/gofiber/fiber'),
            hasGorilla: content.includes('github.com/gorilla/mux')
        };
    } catch (error) {
        console.error('Error detecting Go framework:', error);
        return {
            hasGin: false,
            hasEcho: false,
            hasFiber: false,
            hasGorilla: false
        };
    }
}

export const golangYml = `zerops:
  - setup: app
    build:
      base: go@1.21
      buildCommands:
        - go mod download
        - go build -o app
      deployFiles:
        - app
      cache:
        - go.sum
    run:
      base: go@1.21
      ports:
        - port: 8080
          httpSupport: true
      start: ./app`;

export const ginYml = golangYml;
export const echoYml = golangYml;
export const fiberYml = golangYml;
export const gorillaYml = golangYml; 