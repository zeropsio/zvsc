import {
    nextjsYml, nextjsStaticYml, nextjsPattern, nextjsMetadata, isStaticNextjs,
    astroYml, astroStaticYml, astroPattern, astroMetadata, isStaticAstro,
    reactYml, reactViteYml, reactPattern, reactMetadata, detectReactBuildTool,
    vueCliYml, vueViteYml, vuePattern, vueMetadata, detectVueConfiguration,
    nodejsYml, nestjsYml, expressYml, nodejsPattern, nodejsMetadata, detectNodejsType,
    javascriptYml, javascriptTsYml, denoYml, javascriptPattern, javascriptMetadata, detectJavaScriptType,
    nestjsPattern, nestjsMetadata, detectNestjsConfig
} from './javascript/index';
import { golangYml, ginYml, echoYml, fiberYml, gorillaYml, golangPattern, golangMetadata, detectGolangType } from './golang/index';
import { pythonYml, djangoYml, flaskYml, fastApiYml, pyramidYml, pythonPattern, pythonMetadata, detectPythonType } from './python/index';
import { javaYml, springYml, springBootYml, quarkusYml, micronautYml, javaPattern, javaMetadata, detectJavaType } from './java/index';
import { FrameworkPattern, FrameworkMetadata, SupportedFramework, FrameworkDetectionResult } from '../framework-types';

export { SupportedFramework, FrameworkPattern, FrameworkMetadata, FrameworkDetectionResult };

export const frameworkPatterns: Record<string, FrameworkPattern> = {
    // JavaScript ecosystem
    nextjs: nextjsPattern,
    astro: astroPattern,
    react: reactPattern,
    vue: vuePattern,
    nodejs: nodejsPattern,
    nestjs: nestjsPattern,
    javascript: javascriptPattern,
    // Other languages
    golang: golangPattern,
    python: pythonPattern,
    java: javaPattern
};

export const frameworkMetadata: Record<string, FrameworkMetadata> = {
    // JavaScript ecosystem
    nextjs: nextjsMetadata,
    astro: astroMetadata,
    react: reactMetadata,
    vue: vueMetadata,
    nodejs: nodejsMetadata,
    nestjs: nestjsMetadata,
    javascript: javascriptMetadata,
    // Other languages
    golang: golangMetadata,
    python: pythonMetadata,
    java: javaMetadata
};

export const frameworkDetectors = {
    // JavaScript ecosystem
    nextjs: { isStatic: isStaticNextjs },
    astro: { isStatic: isStaticAstro },
    react: { detectBuildTool: detectReactBuildTool },
    vue: { detectConfiguration: detectVueConfiguration },
    nodejs: { detectType: detectNodejsType },
    nestjs: { detectConfig: detectNestjsConfig },
    javascript: { detectType: detectJavaScriptType },
    // Other languages
    golang: { detectType: detectGolangType },
    python: { detectType: detectPythonType },
    java: { detectType: detectJavaType }
};

export const frameworkYamls = {
    // JavaScript ecosystem
    nextjs: nextjsYml,
    nextjsStatic: nextjsStaticYml,
    astro: astroYml,
    astroStatic: astroStaticYml,
    react: reactYml,
    reactVite: reactViteYml,
    vue: vueCliYml,
    vueVite: vueViteYml,
    nodejs: nodejsYml,
    nestjs: nestjsYml,
    express: expressYml,
    javascript: javascriptYml,
    javascriptTs: javascriptTsYml,
    deno: denoYml,
    // GoLang ecosystem
    golang: golangYml,
    gin: ginYml,
    echo: echoYml,
    fiber: fiberYml,
    gorilla: gorillaYml,
    // Python ecosystem
    python: pythonYml,
    django: djangoYml,
    flask: flaskYml,
    fastapi: fastApiYml,
    pyramid: pyramidYml,
    // Java ecosystem
    java: javaYml,
    spring: springYml,
    springboot: springBootYml,
    quarkus: quarkusYml,
    micronaut: micronautYml
};

export function getYamlForFramework(
    framework: string, 
    directoryPath: string
): string {
    switch (framework) {
        // JavaScript ecosystem
        case 'nextjs': 
            return isStaticNextjs(directoryPath) ? nextjsStaticYml : nextjsYml;
        
        case 'astro':
            return isStaticAstro(directoryPath) ? astroStaticYml : astroYml;
        
        case 'react': {
            const buildTool = detectReactBuildTool(directoryPath);
            return buildTool === 'vite' ? reactViteYml : reactYml;
        }
        
        case 'vue': {
            const { buildTool } = detectVueConfiguration(directoryPath);
            return buildTool === 'vite' ? vueViteYml : vueCliYml;
        }
        
        case 'nodejs': {
            const nodeType = detectNodejsType(directoryPath);
            if (nodeType.hasExpress) return expressYml;
            return nodejsYml;
        }
        
        case 'javascript': {
            const jsType = detectJavaScriptType(directoryPath);
            if (jsType.hasDeno) return denoYml;
            if (jsType.hasTypeScript) return javascriptTsYml;
            return javascriptYml;
        }
        
        // GoLang ecosystem
        case 'golang': {
            const goType = detectGolangType(directoryPath);
            if (goType.hasGin) return ginYml;
            if (goType.hasEcho) return echoYml;
            if (goType.hasFiber) return fiberYml;
            if (goType.hasGorilla) return gorillaYml;
            return golangYml;
        }
        
        // Python ecosystem
        case 'python': {
            const pyType = detectPythonType(directoryPath);
            if (pyType.hasDjango) return djangoYml;
            if (pyType.hasFlask) return flaskYml;
            if (pyType.hasFastAPI) return fastApiYml;
            if (pyType.hasPyramid) return pyramidYml;
            return pythonYml;
        }
        
        // Java ecosystem
        case 'java': {
            const javaType = detectJavaType(directoryPath);
            if (javaType.hasSpringBoot) return springBootYml;
            if (javaType.hasSpring) return springYml;
            if (javaType.hasQuarkus) return quarkusYml;
            if (javaType.hasMicronaut) return micronautYml;
            return javaYml;
        }
        
        case 'nestjs': {
            return nestjsYml;
        }
        
        default:
            return nodejsYml;
    }
}
