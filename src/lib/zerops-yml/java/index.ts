import * as fs from 'fs';
import * as path from 'path';
import { FrameworkMetadata, FrameworkPattern } from '../../framework-types';

// Basic Java pattern
export const javaPattern: FrameworkPattern = {
    requiredFiles: ['pom.xml'],
    contentPatterns: [
        {
            file: 'pom.xml',
            patterns: ['<project', '<artifactId>']
        }
    ]
};

export const javaMetadata: FrameworkMetadata = {
    name: 'Java',
    type: 'java',
    description: 'Java application'
};

// Detect Java framework type
export function detectJavaType(directoryPath: string) {
    const hasSpringBoot = checkForSpringBoot(directoryPath);
    const hasSpring = hasSpringBoot || checkForSpring(directoryPath);
    const hasQuarkus = checkForQuarkus(directoryPath);
    const hasMicronaut = checkForMicronaut(directoryPath);
    
    return {
        hasSpring,
        hasSpringBoot,
        hasQuarkus,
        hasMicronaut
    };
}

function checkForSpringBoot(directoryPath: string): boolean {
    // Check for Spring Boot dependencies in pom.xml or build.gradle
    const pomPath = path.join(directoryPath, 'pom.xml');
    if (fs.existsSync(pomPath)) {
        const content = fs.readFileSync(pomPath, 'utf8');
        if (content.includes('spring-boot-starter') || 
            content.includes('org.springframework.boot')) {
            return true;
        }
    }
    
    const gradlePaths = [
        path.join(directoryPath, 'build.gradle'),
        path.join(directoryPath, 'build.gradle.kts')
    ];
    
    for (const gradlePath of gradlePaths) {
        if (fs.existsSync(gradlePath)) {
            const content = fs.readFileSync(gradlePath, 'utf8');
            if (content.includes('org.springframework.boot') || 
                content.includes('spring-boot-starter')) {
                return true;
            }
        }
    }
    
    // Look for Spring Boot application class
    const javaFiles = findFiles(directoryPath, '.java');
    for (const file of javaFiles) {
        const content = fs.readFileSync(file, 'utf8');
        if (content.includes('@SpringBootApplication') || 
            content.includes('SpringApplication.run')) {
            return true;
        }
    }
    
    return false;
}

function checkForSpring(directoryPath: string): boolean {
    // Check for Spring Core dependencies in pom.xml or build.gradle
    const pomPath = path.join(directoryPath, 'pom.xml');
    if (fs.existsSync(pomPath)) {
        const content = fs.readFileSync(pomPath, 'utf8');
        if (content.includes('org.springframework') && !content.includes('spring-boot')) {
            return true;
        }
    }
    
    const gradlePaths = [
        path.join(directoryPath, 'build.gradle'),
        path.join(directoryPath, 'build.gradle.kts')
    ];
    
    for (const gradlePath of gradlePaths) {
        if (fs.existsSync(gradlePath)) {
            const content = fs.readFileSync(gradlePath, 'utf8');
            if (content.includes('org.springframework') && !content.includes('spring-boot')) {
                return true;
            }
        }
    }
    
    // Look for Spring annotations in Java files
    const javaFiles = findFiles(directoryPath, '.java');
    for (const file of javaFiles) {
        const content = fs.readFileSync(file, 'utf8');
        if (content.includes('@Controller') || 
            content.includes('@Service') || 
            content.includes('@Repository') || 
            content.includes('@Component') ||
            content.includes('ApplicationContext') ||
            content.includes('import org.springframework')) {
            return true;
        }
    }
    
    return false;
}

function checkForQuarkus(directoryPath: string): boolean {
    // Check for Quarkus dependencies in pom.xml or build.gradle
    const pomPath = path.join(directoryPath, 'pom.xml');
    if (fs.existsSync(pomPath)) {
        const content = fs.readFileSync(pomPath, 'utf8');
        if (content.includes('io.quarkus') || content.includes('quarkus-maven-plugin')) {
            return true;
        }
    }
    
    const gradlePaths = [
        path.join(directoryPath, 'build.gradle'),
        path.join(directoryPath, 'build.gradle.kts')
    ];
    
    for (const gradlePath of gradlePaths) {
        if (fs.existsSync(gradlePath)) {
            const content = fs.readFileSync(gradlePath, 'utf8');
            if (content.includes('io.quarkus') || content.includes('quarkus-gradle-plugin')) {
                return true;
            }
        }
    }
    
    // Check for application.properties with Quarkus config
    const propertiesPath = path.join(directoryPath, 'src', 'main', 'resources', 'application.properties');
    if (fs.existsSync(propertiesPath)) {
        const content = fs.readFileSync(propertiesPath, 'utf8');
        if (content.includes('quarkus.')) {
            return true;
        }
    }
    
    return false;
}

function checkForMicronaut(directoryPath: string): boolean {
    // Check for Micronaut dependencies in pom.xml or build.gradle
    const pomPath = path.join(directoryPath, 'pom.xml');
    if (fs.existsSync(pomPath)) {
        const content = fs.readFileSync(pomPath, 'utf8');
        if (content.includes('io.micronaut') || content.includes('micronaut-maven-plugin')) {
            return true;
        }
    }
    
    const gradlePaths = [
        path.join(directoryPath, 'build.gradle'),
        path.join(directoryPath, 'build.gradle.kts')
    ];
    
    for (const gradlePath of gradlePaths) {
        if (fs.existsSync(gradlePath)) {
            const content = fs.readFileSync(gradlePath, 'utf8');
            if (content.includes('io.micronaut') || content.includes('micronaut-gradle-plugin')) {
                return true;
            }
        }
    }
    
    // Look for Micronaut annotations in Java files
    const javaFiles = findFiles(directoryPath, '.java');
    for (const file of javaFiles) {
        const content = fs.readFileSync(file, 'utf8');
        if (content.includes('import io.micronaut') || 
            content.includes('@Controller') && (content.includes('import io.micronaut') || !content.includes('import org.springframework'))) {
            return true;
        }
    }
    
    return false;
}

// Helper function to find files with a specific extension
function findFiles(dir: string, extension: string): string[] {
    if (!fs.existsSync(dir)) {
        return [];
    }
    
    let results: string[] = [];
    const list = fs.readdirSync(dir);
    
    for (const file of list) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
            results = results.concat(findFiles(filePath, extension));
        } else if (file.endsWith(extension)) {
            results.push(filePath);
        }
    }
    
    return results;
}

// Java template
export const javaYml = `services:
  # Base Java application
  app:
    type: java
    buildFromGit: 
      buildpack: TRUE
    hostname: app
    ports:
      - port: 8080
        httpSupport: true
    resources:
      cpu: 1000m
      memory: 1024Mi
`;

// Spring template
export const springYml = `services:
  # Spring application
  app:
    type: java
    buildFromGit: 
      buildpack: TRUE
    hostname: app
    ports:
      - port: 8080
        httpSupport: true
    resources:
      cpu: 1500m
      memory: 1536Mi
`;

// Spring Boot template
export const springBootYml = `services:
  # Spring Boot application
  app:
    type: java
    buildFromGit: 
      buildpack: TRUE
    hostname: app
    ports:
      - port: 8080
        httpSupport: true
    resources:
      cpu: 1500m
      memory: 1536Mi
    env:
      SPRING_PROFILES_ACTIVE: production
`;

// Quarkus template
export const quarkusYml = `services:
  # Quarkus application
  app:
    type: java
    buildFromGit: 
      buildpack: TRUE
    hostname: app
    ports:
      - port: 8080
        httpSupport: true
    resources:
      cpu: 1200m
      memory: 1024Mi
    env:
      QUARKUS_PROFILE: prod
`;

// Micronaut template
export const micronautYml = `services:
  # Micronaut application
  app:
    type: java
    buildFromGit: 
      buildpack: TRUE
    hostname: app
    ports:
      - port: 8080
        httpSupport: true
    resources:
      cpu: 1200m
      memory: 1024Mi
    env:
      MICRONAUT_ENVIRONMENTS: prod
`; 