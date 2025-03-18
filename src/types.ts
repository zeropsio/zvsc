/**
 * Recipe definition for project templates
 */
export interface Recipe {
    /**
     * Name of the recipe
     */
    name: string;
    
    /**
     * GitHub repository URL of the recipe
     */
    url: string;
}

/**
 * Recipe option for QuickPick
 */
export interface RecipeOption {
    label: string;
    action: string;
    description: string;
    url: string;
    name: string;
}

/**
 * Clone option for QuickPick
 */
export interface CloneOption {
    label: string;
    action: string;
    description: string;
} 