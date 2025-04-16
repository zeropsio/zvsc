import { FrameworkPattern, FrameworkMetadata } from '../../framework-types';
import { fileExists, getDependencies } from '../../fs-utils';

export const pythonPattern: FrameworkPattern = {
    requiredFiles: ['requirements.txt'],
    contentPatterns: [
        {
            file: 'requirements.txt',
            patterns: ['']
        }
    ]
};

export const pythonMetadata: FrameworkMetadata = {
    name: 'Python',
    type: 'python',
    description: 'General-purpose programming language'
};

export function detectPythonType(directoryPath: string): { 
    hasDjango: boolean,
    hasFlask: boolean,
    hasFastAPI: boolean,
    hasPyramid: boolean
} {
    try {
        const hasRequirements = fileExists(directoryPath, 'requirements.txt');
        const hasPipfile = fileExists(directoryPath, 'Pipfile');
        const hasPipfileLock = fileExists(directoryPath, 'Pipfile.lock');
        const hasPyproject = fileExists(directoryPath, 'pyproject.toml');
        
        if (!hasRequirements && !hasPipfile && !hasPyproject) {
            return {
                hasDjango: false,
                hasFlask: false,
                hasFastAPI: false,
                hasPyramid: false
            };
        }
        
        let content = '';
        const fs = require('fs');
        const path = require('path');
        
        if (hasRequirements) {
            const reqPath = path.join(directoryPath, 'requirements.txt');
            content += fs.readFileSync(reqPath, 'utf8');
        }
        
        if (hasPipfile) {
            const pipfilePath = path.join(directoryPath, 'Pipfile');
            content += fs.readFileSync(pipfilePath, 'utf8');
        }
        
        if (hasPyproject) {
            const pyprojectPath = path.join(directoryPath, 'pyproject.toml');
            content += fs.readFileSync(pyprojectPath, 'utf8');
        }
        
        return {
            hasDjango: content.includes('django'),
            hasFlask: content.includes('flask'),
            hasFastAPI: content.includes('fastapi'),
            hasPyramid: content.includes('pyramid')
        };
    } catch (error) {
        console.error('Error detecting Python framework:', error);
        return {
            hasDjango: false,
            hasFlask: false,
            hasFastAPI: false,
            hasPyramid: false
        };
    }
}

export const pythonYml = `zerops:
  - setup: app
    build:
      base: python@3.11
      buildCommands:
        - pip install -r requirements.txt
      deployFiles:
        - "**/*.py"
        - requirements.txt
      cache:
        - .pip-cache
    run:
      base: python@3.11
      ports:
        - port: 8000
          httpSupport: true
      start: python main.py`;

export const djangoYml = `zerops:
  - setup: app
    build:
      base: python@3.11
      buildCommands:
        - pip install -r requirements.txt
      deployFiles:
        - "**/*.py"
        - requirements.txt
        - templates
        - static
      cache:
        - .pip-cache
    run:
      base: python@3.11
      ports:
        - port: 8000
          httpSupport: true
      start: python manage.py runserver 0.0.0.0:8000`;

export const flaskYml = pythonYml;
export const fastApiYml = pythonYml;
export const pyramidYml = pythonYml; 