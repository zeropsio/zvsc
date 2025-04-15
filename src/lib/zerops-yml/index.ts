import { nextjsYml, nextjsStaticYml, nextjsPattern, nextjsMetadata, isStaticNextjs } from './nextjs';
import { astroYml, astroStaticYml, astroPattern, astroMetadata, isStaticAstro } from './astro';
import { reactYml, reactViteYml, reactPattern, reactMetadata, detectReactBuildTool } from './react';
import { vueCliYml, vueViteYml, vuePattern, vueMetadata, detectVueConfiguration } from './vue';
import { nodejsYml, nestjsYml, expressYml, nodejsPattern, nodejsMetadata, detectNodejsType } from './nodejs';

export const frameworkPatterns = {
    nextjs: nextjsPattern,
    astro: astroPattern,
    react: reactPattern,
    vue: vuePattern,
    nodejs: nodejsPattern
};

export const frameworkMetadata = {
    nextjs: nextjsMetadata,
    astro: astroMetadata,
    react: reactMetadata,
    vue: vueMetadata,
    nodejs: nodejsMetadata
};

export const frameworkDetectors = {
    nextjs: { isStatic: isStaticNextjs },
    astro: { isStatic: isStaticAstro },
    react: { detectBuildTool: detectReactBuildTool },
    vue: { detectConfiguration: detectVueConfiguration },
    nodejs: { detectType: detectNodejsType }
};

export const frameworkYamls = {
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
    express: expressYml
};

export function getYamlForFramework(
    framework: string, 
    directoryPath: string
): string {
    switch (framework) {
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
            if (nodeType.hasNestjs) return nestjsYml;
            if (nodeType.hasExpress) return expressYml;
            return nodejsYml;
        }
        
        default:
            return nodejsYml;
    }
}
