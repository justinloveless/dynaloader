#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Default site-assets.json content
const defaultSiteAssets = {
    version: '1.0',
    description: 'Configuration file defining manageable assets',
    assets: []
};

// Main function
function main() {
    log('\n=== Initialize dynaloader ===\n', 'bright');

    const cwd = process.cwd();

    // Copy asset-loader.js
    const sourceLoaderPath = path.join(__dirname, 'asset-loader.js');
    const targetLoaderPath = path.join(cwd, 'asset-loader.js');

    if (fs.existsSync(targetLoaderPath)) {
        log(`asset-loader.js already exists in current directory`, 'yellow');
        log(`Skipping copy...`, 'yellow');
    } else {
        try {
            fs.copyFileSync(sourceLoaderPath, targetLoaderPath);
            log(`✓ Copied asset-loader.js to current directory`, 'green');
        } catch (error) {
            log(`Error copying asset-loader.js: ${error.message}`, 'red');
            process.exit(1);
        }
    }

    // Create site-assets.json if it doesn't exist
    const siteAssetsPath = path.join(cwd, 'site-assets.json');
    if (fs.existsSync(siteAssetsPath)) {
        log(`site-assets.json already exists`, 'yellow');
        log(`Skipping creation...`, 'yellow');
    } else {
        try {
            fs.writeFileSync(
                siteAssetsPath,
                JSON.stringify(defaultSiteAssets, null, 2) + '\n'
            );
            log(`✓ Created site-assets.json`, 'green');
        } catch (error) {
            log(`Error creating site-assets.json: ${error.message}`, 'red');
            process.exit(1);
        }
    }

    log('\n✓ Initialization complete!', 'green');
    log('\nNext steps:', 'cyan');
    log('1. Add assets using: npx add-asset');
    log('2. Import and use dynaloader in your JavaScript:\n');
    log('   import { loadSiteAssets } from "./asset-loader.js";');
    log('   await loadSiteAssets();\n');
}

// Run
main();

