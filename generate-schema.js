#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    red: '\x1b[31m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

// Infer JSON schema from a value
function inferSchema(value, visited = new WeakSet()) {
    // Handle null
    if (value === null) {
        return { type: 'null' };
    }

    // Handle arrays
    if (Array.isArray(value)) {
        if (value.length === 0) {
            return {
                type: 'array',
                items: {}
            };
        }

        // Analyze all items to find common schema
        const itemSchemas = value.map(item => inferSchema(item, visited));
        const unifiedSchema = unifySchemas(itemSchemas);

        return {
            type: 'array',
            items: unifiedSchema
        };
    }

    // Handle objects
    if (typeof value === 'object') {
        // Prevent circular references
        if (visited.has(value)) {
            return { type: 'object' };
        }
        visited.add(value);

        const schema = {
            type: 'object',
            properties: {},
            required: []
        };

        // Analyze all properties
        for (const [key, val] of Object.entries(value)) {
            schema.properties[key] = inferSchema(val, visited);
            schema.required.push(key);
        }

        visited.delete(value);
        return schema;
    }

    // Handle primitives
    const type = typeof value;
    if (type === 'string') {
        // Check for common patterns
        const schema = { type: 'string' };

        // Check if it's a URL
        try {
            new URL(value);
            schema.format = 'uri';
        } catch {
            // Check if it's an email
            if (value.includes('@') && value.includes('.')) {
                schema.format = 'email';
            }
            // Check if it's a date (YYYY-MM-DD format)
            else if (value.match(/^\d{4}-\d{2}-\d{2}$/) && !isNaN(Date.parse(value))) {
                schema.format = 'date';
            }
            // Check if it's a date-time (ISO 8601 format)
            else if (value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/) && !isNaN(Date.parse(value))) {
                schema.format = 'date-time';
            }
        }

        return schema;
    }

    if (type === 'number') {
        return {
            type: Number.isInteger(value) ? 'integer' : 'number'
        };
    }

    if (type === 'boolean') {
        return { type: 'boolean' };
    }

    return { type: 'string' }; // Fallback
}

// Unify multiple schemas into one (for arrays with mixed types)
function unifySchemas(schemas) {
    if (schemas.length === 0) return {};

    // Check if all schemas are the same type
    const types = [...new Set(schemas.map(s => s.type))];

    if (types.length === 1) {
        const baseSchema = { ...schemas[0] };
        delete baseSchema.type; // Remove type for 'anyOf' or 'oneOf'

        // If all are objects, merge their properties
        if (types[0] === 'object') {
            const mergedProperties = {};
            const allRequired = new Set();

            schemas.forEach(s => {
                if (s.properties) {
                    Object.assign(mergedProperties, s.properties);
                }
                if (s.required) {
                    s.required.forEach(req => allRequired.add(req));
                }
            });

            return {
                type: 'object',
                properties: mergedProperties,
                required: Array.from(allRequired)
            };
        }

        return baseSchema;
    }

    // Mixed types - use anyOf
    return {
        anyOf: schemas
    };
}

// Generate schema from JSON file
function generateSchema(jsonPath) {
    try {
        const content = fs.readFileSync(jsonPath, 'utf8');
        const data = JSON.parse(content);

        const schema = inferSchema(data);

        return schema;
    } catch (error) {
        if (error.code === 'ENOENT') {
            log(`Error: File "${jsonPath}" not found`, 'red');
            process.exit(1);
        } else if (error instanceof SyntaxError) {
            log(`Error: Invalid JSON in "${jsonPath}"`, 'red');
            log(`  ${error.message}`, 'red');
            process.exit(1);
        } else {
            log(`Error: ${error.message}`, 'red');
            process.exit(1);
        }
    }
}

// Load site-assets.json
function loadSiteAssets() {
    try {
        const data = fs.readFileSync('site-assets.json', 'utf8');
        return JSON.parse(data);
    } catch (error) {
        log('Error loading site-assets.json', 'red');
        log(`  ${error.message}`, 'red');
        process.exit(1);
    }
}

// Save site-assets.json
function saveSiteAssets(assets) {
    try {
        fs.writeFileSync('site-assets.json', JSON.stringify(assets, null, 2));
        log('✓ Updated site-assets.json', 'green');
    } catch (error) {
        log('Error saving site-assets.json', 'red');
        log(`  ${error.message}`, 'red');
        process.exit(1);
    }
}

// Find a sample JSON file in a directory
function findSampleJsonFile(dirPath) {
    try {
        const files = fs.readdirSync(dirPath);
        const jsonFile = files.find(f => path.extname(f).toLowerCase() === '.json');
        return jsonFile ? path.join(dirPath, jsonFile) : null;
    } catch (error) {
        return null;
    }
}

// Main function
function main() {
    const inputPath = process.argv[2];

    if (!inputPath) {
        log('\nUsage: npm run generate-schema <path-to-json-file-or-directory>', 'yellow');
        log('Examples:', 'cyan');
        log('  npm run generate-schema content/property.json', 'cyan');
        log('  npm run generate-schema gallery', 'cyan');
        log('  npm run generate-schema gallery/some-file.json\n', 'cyan');
        process.exit(1);
    }

    // Normalize path separators
    const normalizedInput = inputPath.replace(/\\/g, '/');

    // Check if it's a directory or file
    let targetPath;
    let isDirectory = false;

    if (fs.existsSync(inputPath)) {
        const stats = fs.statSync(inputPath);
        isDirectory = stats.isDirectory();

        if (isDirectory) {
            // Find a sample JSON file in the directory
            targetPath = findSampleJsonFile(inputPath);
            if (!targetPath) {
                log(`Error: No JSON files found in directory "${inputPath}"`, 'red');
                process.exit(1);
            }
            log(`\nUsing sample file: ${targetPath}`, 'cyan');
        } else {
            targetPath = inputPath;
        }
    } else {
        // File doesn't exist, assume it's a JSON file path
        targetPath = inputPath;
        if (path.extname(targetPath).toLowerCase() !== '.json') {
            targetPath = targetPath + '.json';
        }
    }

    log(`\nGenerating schema for: ${targetPath}\n`, 'bright');

    const schema = generateSchema(targetPath);
    const schemaJson = JSON.stringify(schema, null, 2);

    // Load site-assets.json
    const siteAssets = loadSiteAssets();

    // Normalize paths for comparison
    const normalizedTargetPath = targetPath.replace(/\\/g, '/');

    // Check if this is a directory asset or a file within one
    let assetIndex = -1;
    let isComboJson = false;

    if (isDirectory) {
        // Look for directory asset matching the input
        assetIndex = siteAssets.assets.findIndex(asset => {
            const assetPath = asset.path.replace(/\\/g, '/');
            return assetPath === normalizedInput && asset.type === 'directory';
        });
    } else {
        // First, try to find a direct match for the file
        assetIndex = siteAssets.assets.findIndex(asset => {
            const assetPath = asset.path.replace(/\\/g, '/');
            return assetPath === normalizedTargetPath;
        });

        // If not found, check if it's part of a combo directory asset
        if (assetIndex === -1) {
            const dir = path.dirname(normalizedTargetPath);
            assetIndex = siteAssets.assets.findIndex(asset => {
                const assetPath = asset.path.replace(/\\/g, '/');
                return assetPath === dir &&
                    asset.type === 'directory' &&
                    asset.contains?.type === 'combo';
            });
            if (assetIndex !== -1) {
                isComboJson = true;
            }
        }
    }

    if (assetIndex === -1) {
        log(`Warning: Asset not found in site-assets.json`, 'yellow');
        log('The schema will be output to stdout instead.\n', 'yellow');
        console.log(schemaJson);
        return;
    }

    const asset = siteAssets.assets[assetIndex];

    // Handle different asset types
    if (isComboJson || (isDirectory && asset.contains?.type === 'combo')) {
        // Update schema for JSON part in combo asset
        const parts = asset.contains.parts;
        const jsonPartIndex = parts.findIndex(p => p.assetType === 'json');

        if (jsonPartIndex === -1) {
            log('Error: No JSON part found in combo asset', 'red');
            process.exit(1);
        }

        siteAssets.assets[assetIndex].contains.parts[jsonPartIndex].schema = schema;
        saveSiteAssets(siteAssets);

        log(`✓ Schema updated for JSON part of combo asset: ${asset.label}`, 'green');
    } else {
        // Update schema for regular JSON asset
        siteAssets.assets[assetIndex].schema = schema;
        saveSiteAssets(siteAssets);

        log(`✓ Schema updated for asset: ${asset.label}`, 'green');
    }

    log(`\nSchema preview:`, 'cyan');
    log(schemaJson, 'reset');
    log('');
}

// Run
main();
