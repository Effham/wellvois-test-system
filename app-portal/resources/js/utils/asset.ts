/**
 * JavaScript equivalent of Laravel's asset() helper
 * Generates URL for assets in the public directory
 * 
 * @param path - Path to the asset relative to public directory
 * @returns Full URL to the asset
 */
export function asset(path: string): string {
    // Remove leading slash if present
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    
    // Get the base URL from the current window location
    const baseUrl = window.location.origin;
    
    // Construct the full URL
    return `${baseUrl}/${cleanPath}`;
}

/**
 * Alternative version that uses APP_URL from environment if available
 * Falls back to window.location.origin if not available
 */
export function assetUrl(path: string): string {
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    
    // Try to get APP_URL from meta tag or use current origin
    const appUrl = document.querySelector('meta[name="app-url"]')?.getAttribute('content') || window.location.origin;
    
    return `${appUrl}/${cleanPath}`;
}

/**
 * Helper specifically for images in public/images directory
 * 
 * @param imageName - Name of the image file
 * @returns Full URL to the image
 */
export function imageAsset(imageName: string): string {
    return asset(`${imageName}`);
}

/**
 * Helper specifically for CSS files in public/css directory
 * 
 * @param cssFile - Name of the CSS file
 * @returns Full URL to the CSS file
 */
export function cssAsset(cssFile: string): string {
    return asset(`css/${cssFile}`);
}

/**
 * Helper specifically for JS files in public/js directory
 * 
 * @param jsFile - Name of the JS file
 * @returns Full URL to the JS file
 */
export function jsAsset(jsFile: string): string {
    return asset(`js/${jsFile}`);
}