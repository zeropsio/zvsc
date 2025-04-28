import { FrameworkPattern, FrameworkMetadata } from '../../framework-types';
import { fileExists } from '../../fs-utils';

export const phpPattern: FrameworkPattern = {
    requiredFiles: ['composer.json'],
    contentPatterns: [
        {
            file: 'composer.json',
            patterns: ['"require":', '"php":']
        }
    ]
};

export const laravelPattern: FrameworkPattern = {
    requiredFiles: ['artisan', 'composer.json'],
    contentPatterns: [
        {
            file: 'composer.json',
            patterns: ['"laravel/framework":', '"illuminate/']
        }
    ],
    priority: 10
};

export const symfonyPattern: FrameworkPattern = {
    requiredFiles: ['composer.json', 'symfony.lock'],
    contentPatterns: [
        {
            file: 'composer.json',
            patterns: ['"symfony/framework-bundle":', '"symfony/']
        }
    ],
    priority: 10
};

export const wordpressPattern: FrameworkPattern = {
    requiredFiles: ['wp-config.php', 'wp-content'],
    requiredDirs: ['wp-content', 'wp-admin', 'wp-includes'],
    contentPatterns: [
        {
            file: 'wp-config.php',
            patterns: ['WordPress', 'define( \'ABSPATH\'']
        }
    ],
    priority: 10
};

export const phpMetadata: FrameworkMetadata = {
    name: 'PHP',
    type: 'unknown',
    description: 'General PHP Application'
};

export const laravelMetadata: FrameworkMetadata = {
    name: 'Laravel',
    type: 'unknown',
    description: 'PHP Laravel Framework'
};

export const symfonyMetadata: FrameworkMetadata = {
    name: 'Symfony',
    type: 'unknown',
    description: 'PHP Symfony Framework'
};

export const wordpressMetadata: FrameworkMetadata = {
    name: 'WordPress',
    type: 'unknown',
    description: 'WordPress CMS'
};

export function detectPhpType(directoryPath: string) {
    return {
        hasLaravel: fileExists(directoryPath, 'artisan'),
        hasSymfony: fileExists(directoryPath, 'symfony.lock') || fileExists(directoryPath, 'symfony.yaml'),
        hasWordPress: fileExists(directoryPath, 'wp-config.php'),
        hasComposer: fileExists(directoryPath, 'composer.json')
    };
}

export const phpYml = `zerops:
  - setup: app
    build:
      base: php@8.2
      buildCommands:
        - composer install --no-interaction --no-progress
      deployFiles:
        - "**/*"
        - "!vendor"
      cache:
        - vendor
        - composer.lock
    run:
      base: php@8.2-apache
      ports:
        - port: 80
          httpSupport: true
      start: apache2-foreground`;

export const laravelYml = `zerops:
  - setup: app
    build:
      base: php@8.2
      buildCommands:
        - composer install --no-interaction --no-progress
        - php artisan optimize
      deployFiles:
        - "**/*"
        - "!node_modules"
        - "!tests"
      cache:
        - vendor
        - composer.lock
    run:
      base: php@8.2-apache
      ports:
        - port: 80
          httpSupport: true
      prepareCommands:
        - mkdir -p storage/framework/{sessions,views,cache} 
        - chmod -R 775 storage bootstrap/cache
      start: apache2-foreground`;

export const symfonyYml = `zerops:
  - setup: app
    build:
      base: php@8.2
      buildCommands:
        - composer install --no-interaction --no-progress
        - composer dump-autoload --optimize
      deployFiles:
        - "**/*"
        - "!var/cache"
        - "!tests"
      cache:
        - vendor
        - composer.lock
    run:
      base: php@8.2-apache
      ports:
        - port: 80
          httpSupport: true
      prepareCommands:
        - mkdir -p var/cache var/log
        - chmod -R 777 var/cache var/log
      start: apache2-foreground`;

export const wordpressYml = `zerops:
  - setup: app
    build:
      base: php@8.2
      buildCommands:
        - if [ -f "composer.json" ]; then composer install --no-interaction --no-progress; fi
      deployFiles:
        - "**/*"
      cache:
        - vendor
        - composer.lock
    run:
      base: php@8.2-apache
      ports:
        - port: 80
          httpSupport: true
      prepareCommands:
        - chmod -R 755 .
        - chmod -R 777 wp-content
      start: apache2-foreground`; 