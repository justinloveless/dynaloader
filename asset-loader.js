/**
 * Generic asset loader for dynamically loading assets based on site-assets.json
 * This module is reusable across different sites
 */

let siteAssets = null;
let contentData = {};

/**
 * Load site assets configuration, all content files, and handlers
 * @param {string|Function} assetsPathOrCallback - Path to site-assets.json file (default: 'site-assets.json') or callback function
 * @param {Function} [onComplete] - Optional callback function called after all handlers have executed
 * @returns {Promise<Object>} Object containing siteAssets and contentData
 */
export async function loadSiteAssets(assetsPathOrCallback = 'site-assets.json', onComplete) {
    // Handle case where only callback is provided
    let assetsPath = 'site-assets.json';
    let callback = onComplete;

    if (typeof assetsPathOrCallback === 'function') {
        callback = assetsPathOrCallback;
    } else if (assetsPathOrCallback) {
        assetsPath = assetsPathOrCallback;
    }

    try {
        const response = await fetch(assetsPath);
        siteAssets = await response.json();
        await loadContentFiles();
        await loadHandlers(callback);
        return { siteAssets, contentData };
    } catch (error) {
        console.error('Error loading site assets:', error);
        throw error;
    }
}

/**
 * Load all content files defined in assets
 */
async function loadContentFiles() {
    if (!siteAssets || !siteAssets.assets) return;

    // Load all content files defined in assets
    for (const asset of siteAssets.assets) {
        // Handle directory assets
        if (asset.type === 'directory') {
            if (asset.contains && asset.contains.type === 'combo') {
                // Load combo assets from directory
                contentData[asset.path] = await loadComboAssets(asset);
            } else if (asset.contains) {
                // Simple directory with single asset type
                contentData[asset.path] = await loadSimpleDirectoryAssets(asset);
            } else {
                // Legacy directory handling (just store path)
                contentData[asset.path] = asset.path;
            }
            continue;
        }

        // For images, just store the path
        if (asset.type === 'image') {
            contentData[asset.path] = asset.path;
            continue;
        }

        try {
            const response = await fetch(asset.path);
            if (!response.ok) continue;

            if (asset.type === 'json' || asset.path.endsWith('.json')) {
                contentData[asset.path] = await response.json();
            } else if (asset.type === 'text' && asset.path.endsWith('.md')) {
                const text = await response.text();
                contentData[asset.path] = text;
            }
        } catch (error) {
            console.warn(`Failed to load ${asset.path}:`, error);
        }
    }
}

/**
 * Load combo assets from a directory (e.g., image + json metadata pairs)
 */
async function loadComboAssets(asset) {
    const comboData = {};
    const dirPath = asset.path;

    // Get all allowed extensions from parts
    const extensionMap = {}; // Maps extension to asset type
    asset.contains.parts.forEach(part => {
        part.allowedExtensions.forEach(ext => {
            extensionMap[ext] = part.assetType;
        });
    });

    let files = [];

    // Priority 1: Check for manifest.json in the directory
    try {
        const manifestResponse = await fetch(`${dirPath}/manifest.json`);
        if (manifestResponse.ok) {
            const manifest = await manifestResponse.json();
            if (manifest.files && Array.isArray(manifest.files)) {
                files = manifest.files.filter(filename => {
                    const ext = filename.substring(filename.lastIndexOf('.'));
                    return extensionMap[ext];
                });
                console.log(`Loaded ${files.length} files from ${dirPath}/manifest.json`);
            }
        }
    } catch (error) {
        // Manifest not found, continue to fallbacks
    }

    // Priority 2: Check if files are explicitly listed in the asset configuration
    if (files.length === 0 && asset.files && Array.isArray(asset.files)) {
        // Use the explicit file list from configuration
        files = asset.files.filter(filename => {
            const ext = filename.substring(filename.lastIndexOf('.'));
            return extensionMap[ext];
        });
        console.log(`Loaded ${files.length} files from site-assets.json configuration`);
    }

    // Priority 3: Fall back to trying to fetch directory listing
    if (files.length === 0) {
        // Since we can't list directory contents in a browser, we need to scan for known files
        // This only works if the server has directory listing enabled
        try {
            const response = await fetch(dirPath);
            if (response.ok) {
                // Parse HTML directory listing (if available)
                const html = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const links = doc.querySelectorAll('a');

                links.forEach(link => {
                    const href = link.getAttribute('href');
                    if (href && !href.startsWith('..') && !href.endsWith('/')) {
                        // Extract just the filename from the href (remove any path components)
                        const filename = href.split('/').pop();
                        // Check if file has an allowed extension
                        const ext = filename.substring(filename.lastIndexOf('.'));
                        if (extensionMap[ext]) {
                            files.push(filename);
                        }
                    }
                });
                if (files.length > 0) {
                    console.log(`Loaded ${files.length} files from directory listing: ${dirPath}`);
                }
            }
        } catch (error) {
            // Directory listing failed
        }
    }

    // If no files found by any method, warn the user
    if (files.length === 0) {
        console.warn(`Could not load files from directory: ${dirPath}`);
        console.warn(`Solutions:`);
        console.warn(`  1. Create ${dirPath}/manifest.json with a "files" array (recommended for CMS)`);
        console.warn(`  2. Add a "files" array to this asset in site-assets.json`);
        console.warn(`  3. Enable directory listing on your web server`);
        return comboData;
    }

    // Group files by base name
    const fileGroups = {};
    files.forEach(filename => {
        const ext = filename.substring(filename.lastIndexOf('.'));
        const baseName = filename.substring(0, filename.lastIndexOf('.'));

        if (!fileGroups[baseName]) {
            fileGroups[baseName] = {};
        }
        fileGroups[baseName][ext] = filename;
    });

    // Load each file according to its asset type
    for (const [baseName, fileMap] of Object.entries(fileGroups)) {
        comboData[baseName] = {};

        for (const [ext, filename] of Object.entries(fileMap)) {
            const assetType = extensionMap[ext];
            const filePath = `${dirPath}/${filename}`;

            try {
                if (assetType === 'image') {
                    // Store path for images
                    comboData[baseName][ext] = filePath;
                } else if (assetType === 'json') {
                    // Load and parse JSON
                    const response = await fetch(filePath);
                    if (response.ok) {
                        comboData[baseName][ext] = await response.json();
                    }
                } else if (assetType === 'text') {
                    // Load text content
                    const response = await fetch(filePath);
                    if (response.ok) {
                        comboData[baseName][ext] = await response.text();
                    }
                }
            } catch (error) {
                console.warn(`Failed to load ${filePath}:`, error);
            }
        }
    }

    return comboData;
}

/**
 * Load simple directory assets (single asset type per directory)
 */
async function loadSimpleDirectoryAssets(asset) {
    const files = [];
    const dirPath = asset.path;

    // Similar directory listing logic for simple assets
    try {
        const response = await fetch(dirPath);
        if (!response.ok) return files;

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const links = doc.querySelectorAll('a');

        links.forEach(link => {
            const href = link.getAttribute('href');
            if (href && !href.startsWith('..') && !href.endsWith('/')) {
                // Extract just the filename from the href
                const filename = href.split('/').pop();
                const ext = filename.substring(filename.lastIndexOf('.'));
                if (asset.contains.allowedExtensions.includes(ext)) {
                    files.push(`${dirPath}/${filename}`);
                }
            }
        });
    } catch (error) {
        console.warn(`Failed to load directory ${dirPath}:`, error);
    }

    return files;
}

/**
 * Load and execute handlers for assets
 * @param {Function} onComplete - Callback function called after all handlers have executed
 */
export async function loadHandlers(onComplete) {
    if (!siteAssets || !siteAssets.assets) {
        if (onComplete) onComplete();
        return;
    }

    // Load and execute each handler
    for (const asset of siteAssets.assets) {
        if (!asset.handler) continue;

        try {
            // Dynamically import the handler module
            const handlerModule = await import(`./${asset.handler}`);

            if (typeof handlerModule.handle === 'function') {
                // Call handler with the loaded content
                const data = contentData[asset.path];
                handlerModule.handle(data, asset.path);
            } else {
                console.warn(`Handler ${asset.handler} does not export a handle function`);
            }
        } catch (error) {
            console.error(`Failed to load handler ${asset.handler}:`, error);
        }
    }

    // Call completion callback if provided
    if (onComplete) {
        onComplete();
    }
}

/**
 * Get the loaded content data
 * @returns {Object} The contentData object
 */
export function getContentData() {
    return contentData;
}

