#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import inquirer from 'inquirer';

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

// Load site-assets.json
function loadSiteAssets() {
  try {
    const data = fs.readFileSync('site-assets.json', 'utf8');
    return JSON.parse(data);
  } catch (error) {
    log('Error loading site-assets.json', 'red');
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
    process.exit(1);
  }
}

// Detect file type based on extension
function detectFileType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (['.json'].includes(ext)) return 'json';
  if (['.md', '.txt'].includes(ext)) return 'text';
  if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) return 'image';
  return 'unknown';
}

// Get schema suggestions based on file name
function suggestSchema(filePath) {
  // Return a basic schema template
  return {
    type: 'object',
    properties: {
      // Add your properties here
    }
  };
}

// Generate handler file content
function generateHandlerFile(asset) {
  const { type, label } = asset;
  const varName = label.replace(/[^a-zA-Z0-9]/g, '').replace(/^[A-Z]/, c => c.toLowerCase());

  let code = `/**\n * Handler for ${asset.path}\n * ${asset.description}\n */\n`;
  code += `export function handle(data) {\n`;
  code += `  if (!data) return;\n\n`;

  if (type === 'json') {
    code += `  // TODO: Add DOM manipulation to populate ${label} data\n`;
    code += `  // Example:\n`;
    code += `  // const element = document.querySelector('.${varName}');\n`;
    code += `  // if (element && data.title) {\n`;
    code += `  //   element.textContent = data.title;\n`;
    code += `  // }\n`;
  } else if (type === 'text') {
    code += `  // TODO: Add logic to display ${label}\n`;
    code += `  // Example:\n`;
    code += `  // const container = document.querySelector('.${varName}');\n`;
    code += `  // if (container) {\n`;
    code += `  //   container.innerHTML = data; // Or parse markdown first\n`;
    code += `  // }\n`;
  } else if (type === 'image') {
    code += `  // For image assets, data will be null and assetPath contains the image path\n`;
    code += `  // TODO: Set image source\n`;
    code += `  // Example:\n`;
    code += `  // const img = document.querySelector('.${varName}');\n`;
    code += `  // if (img) {\n`;
    code += `  //   img.src = data; // data will be the asset path for images\n`;
    code += `  // }\n`;
  } else if (type === 'directory') {
    if (asset.contains && asset.contains.type === 'combo') {
      code += `  // Directory contains combo assets\n`;
      code += `  // data is an object with base names as keys\n`;
      code += `  // Each combo contains files with different extensions\n`;
      code += `  // Example structure: { 'item1': { '.ext1': ..., '.ext2': ... } }\n\n`;
      code += `  // TODO: Iterate through combo assets and render them\n`;
      code += `  // Object.keys(data).forEach(baseName => {\n`;
      code += `  //   const combo = data[baseName];\n`;
      code += `  //   // Access different parts: combo['.ext1'], combo['.ext2'], etc.\n`;
      code += `  // });\n`;
    } else {
      code += `  // For directory assets, implement custom logic\n`;
      code += `  // TODO: Add your directory handling logic\n`;
    }
  }

  code += `}\n`;

  return code;
}

// Create handler file
function createHandlerFile(handlerPath, content) {
  const dir = path.dirname(handlerPath);

  // Create directory if it doesn't exist
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    log(`✓ Created directory: ${dir}`, 'green');
  }

  fs.writeFileSync(handlerPath, content);
  log(`✓ Created handler: ${handlerPath}`, 'green');
}

// Create empty file with starter content
function createStarterFile(filePath, type) {
  const dir = path.dirname(filePath);

  // Create directory if it doesn't exist
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    log(`✓ Created directory: ${dir}`, 'green');
  }

  let content = '';

  if (type === 'json') {
    content = '{\n  "example": "value"\n}\n';
  } else if (type === 'text') {
    content = '# New Content\n\nAdd your content here.\n';
  }

  fs.writeFileSync(filePath, content);
  log(`✓ Created file: ${filePath}`, 'green');
}

// Main function
async function main() {
  log('\n=== Add New Asset to Site ===\n', 'bright');

  // Get file path from command line or prompt
  let filePath = process.argv[2];
  let fileExists = false;

  if (filePath) {
    fileExists = fs.existsSync(filePath);
    if (!fileExists) {
      log(`File "${filePath}" does not exist.`, 'yellow');
    }
  }

  // Prompt for asset details
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'basePath',
      message: 'Base path (directory, relative to project root):',
      default: () => {
        if (filePath) {
          const dir = path.dirname(filePath);
          return dir === '.' ? 'content' : dir;
        }
        return 'content';
      }
    },
    {
      type: 'input',
      name: 'fileName',
      message: 'File name (without extension for JSON, with extension for others):',
      default: () => {
        if (filePath) {
          return path.basename(filePath);
        }
        return 'new-asset';
      }
    },
    {
      type: 'confirm',
      name: 'createFile',
      message: 'File does not exist. Create it?',
      default: true,
      when: () => filePath && !fileExists || false
    },
    {
      type: 'list',
      name: 'type',
      message: 'Asset type:',
      choices: ['json', 'text', 'image', 'directory'],
      default: (answers) => {
        let targetPath;
        if (filePath) {
          targetPath = filePath;
        } else if (answers.basePath && answers.fileName) {
          targetPath = path.join(answers.basePath, answers.fileName);
        } else {
          targetPath = '';
        }
        return detectFileType(targetPath);
      }
    },
    {
      type: 'list',
      name: 'directoryContains',
      message: 'What does this directory contain?',
      choices: ['combo', 'image', 'json', 'text'],
      default: 'combo',
      when: (answers) => answers.type === 'directory'
    },
    {
      type: 'input',
      name: 'label',
      message: 'Asset label (human-readable name):',
      default: (answers) => {
        let targetPath;
        if (filePath) {
          targetPath = filePath;
        } else {
          const base = answers.basePath || 'content';
          const name = answers.fileName || 'new-asset';
          targetPath = path.join(base, name);
        }
        return path.basename(targetPath, path.extname(targetPath))
          .split(/[-_]/)
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }
    },
    {
      type: 'input',
      name: 'description',
      message: 'Asset description:',
      default: ''
    },
    {
      type: 'number',
      name: 'maxSize',
      message: 'Max file size (bytes):',
      default: (answers) => {
        if (answers.type === 'image') return 2097152; // 2MB
        if (answers.type === 'json') return 5120; // 5KB
        if (answers.type === 'text') return 51200; // 50KB
        return 10485760; // 10MB for directory
      }
    },
    {
      type: 'input',
      name: 'allowedExtensions',
      message: 'Allowed file extensions (comma-separated):',
      default: (answers) => {
        if (answers.type === 'image') return '.jpg,.jpeg,.png,.webp';
        if (answers.type === 'json') return '.json';
        if (answers.type === 'text') return '.md,.txt';
        if (answers.type === 'directory' && answers.directoryContains === 'image') return '.jpg,.jpeg,.png,.webp';
        if (answers.type === 'directory' && answers.directoryContains === 'json') return '.json';
        if (answers.type === 'directory' && answers.directoryContains === 'text') return '.md,.txt';
        return '';
      },
      filter: (input) => input.split(',').map(ext => ext.trim()),
      when: (answers) => answers.type !== 'directory' || answers.directoryContains !== 'combo'
    },
    {
      type: 'input',
      name: 'comboParts',
      message: 'Combo parts (format: assetType:extensions,assetType:extensions e.g. "image:.webp,.jpg;json:.json"):',
      default: 'image:.webp,.jpg,.png;json:.json',
      when: (answers) => answers.type === 'directory' && answers.directoryContains === 'combo',
      filter: (input) => {
        // Parse the combo parts string into structured data
        const parts = [];
        const partStrings = input.split(';');
        partStrings.forEach(partStr => {
          const [assetType, extsStr] = partStr.split(':');
          if (assetType && extsStr) {
            const extensions = extsStr.split(',').map(ext => ext.trim());
            parts.push({
              assetType: assetType.trim(),
              allowedExtensions: extensions
            });
          }
        });
        return parts;
      }
    },
    {
      type: 'number',
      name: 'comboMaxSizeImage',
      message: 'Max size for image parts (bytes):',
      default: 2097152, // 2MB
      when: (answers) => answers.type === 'directory' && answers.directoryContains === 'combo' &&
        answers.comboParts && answers.comboParts.some(p => p.assetType === 'image')
    },
    {
      type: 'number',
      name: 'comboMaxSizeJson',
      message: 'Max size for JSON parts (bytes):',
      default: 5120, // 5KB
      when: (answers) => answers.type === 'directory' && answers.directoryContains === 'combo' &&
        answers.comboParts && answers.comboParts.some(p => p.assetType === 'json')
    },
    {
      type: 'number',
      name: 'comboMaxSizeText',
      message: 'Max size for text parts (bytes):',
      default: 51200, // 50KB
      when: (answers) => answers.type === 'directory' && answers.directoryContains === 'combo' &&
        answers.comboParts && answers.comboParts.some(p => p.assetType === 'text')
    },
    {
      type: 'confirm',
      name: 'addComboJsonSchema',
      message: 'Add JSON schema validation for JSON parts in combo?',
      default: false,
      when: (answers) => answers.type === 'directory' && answers.directoryContains === 'combo' &&
        answers.comboParts && answers.comboParts.some(p => p.assetType === 'json')
    },
    {
      type: 'editor',
      name: 'comboJsonSchema',
      message: 'Edit JSON schema for combo JSON parts (opens in editor):',
      default: () => {
        return JSON.stringify({
          type: 'object',
          properties: {}
        }, null, 2);
      },
      when: (answers) => answers.addComboJsonSchema,
      filter: (input) => {
        try {
          return JSON.parse(input);
        } catch {
          return null;
        }
      }
    },
    {
      type: 'confirm',
      name: 'addSchema',
      message: 'Add JSON schema validation?',
      default: false,
      when: (answers) => answers.type === 'json'
    },
    {
      type: 'editor',
      name: 'schema',
      message: 'Edit JSON schema (opens in editor):',
      default: (answers) => {
        let targetPath;
        if (filePath) {
          targetPath = filePath;
        } else {
          const base = answers.basePath || 'content';
          const name = answers.fileName || 'new-asset';
          targetPath = path.join(base, name);
        }
        const suggested = suggestSchema(targetPath);
        return JSON.stringify(suggested || {
          type: 'object',
          properties: {}
        }, null, 2);
      },
      when: (answers) => answers.addSchema,
      filter: (input) => {
        try {
          return JSON.parse(input);
        } catch {
          return null;
        }
      }
    },
    {
      type: 'confirm',
      name: 'generateHandler',
      message: 'Generate handler file?',
      default: true
    }
  ]);

  // Construct target path from basePath and fileName
  // Always use the prompted values, not the CLI argument (which is just for defaults)
  const base = answers.basePath || 'content';
  const name = answers.fileName || 'new-asset';
  let targetPath = path.join(base, name).replace(/\\/g, '/');

  // Ensure JSON files have .json extension
  if (answers.type === 'json' && path.extname(targetPath).toLowerCase() !== '.json') {
    targetPath = targetPath + '.json';
  }

  // Create file if needed
  if (!fs.existsSync(targetPath)) {
    if (answers.createFile !== false && answers.type !== 'directory') {
      createStarterFile(targetPath, answers.type);
    }
  }

  // Generate handler path
  const handlerFileName = path.basename(targetPath, path.extname(targetPath)) + '.js';
  const handlerPath = `handlers/${handlerFileName}`;

  // Build asset object
  const asset = {
    path: targetPath,
    type: answers.type,
    label: answers.label,
    description: answers.description,
    handler: handlerPath
  };

  // Handle directory assets with contains structure
  if (answers.type === 'directory') {
    if (answers.directoryContains === 'combo') {
      // Build combo structure with parts
      const parts = answers.comboParts.map(part => {
        const partObj = {
          assetType: part.assetType,
          allowedExtensions: part.allowedExtensions
        };

        // Add maxSize based on asset type
        if (part.assetType === 'image' && answers.comboMaxSizeImage) {
          partObj.maxSize = answers.comboMaxSizeImage;
        } else if (part.assetType === 'json' && answers.comboMaxSizeJson) {
          partObj.maxSize = answers.comboMaxSizeJson;
        } else if (part.assetType === 'text' && answers.comboMaxSizeText) {
          partObj.maxSize = answers.comboMaxSizeText;
        }

        // Add schema for JSON parts
        if (part.assetType === 'json' && answers.comboJsonSchema) {
          partObj.schema = answers.comboJsonSchema;
        }

        return partObj;
      });

      asset.contains = {
        type: 'combo',
        parts: parts
      };
    } else {
      // Simple directory with single asset type
      asset.contains = {
        type: answers.directoryContains,
        allowedExtensions: answers.allowedExtensions,
        maxSize: answers.maxSize
      };
    }
  } else {
    // Non-directory assets use flat structure
    asset.maxSize = answers.maxSize;
    asset.allowedExtensions = answers.allowedExtensions;
  }

  if (answers.schema) {
    asset.schema = answers.schema;
  }

  // Add to site-assets.json
  const siteAssets = loadSiteAssets();

  // Check if asset already exists
  const existingIndex = siteAssets.assets.findIndex(a => a.path === targetPath);
  if (existingIndex !== -1) {
    log(`\nAsset with path "${targetPath}" already exists. Updating...`, 'yellow');
    siteAssets.assets[existingIndex] = asset;
  } else {
    siteAssets.assets.push(asset);
  }

  saveSiteAssets(siteAssets);

  // Generate handler file
  if (answers.generateHandler) {
    const handlerContent = generateHandlerFile(asset);
    createHandlerFile(handlerPath, handlerContent);
  }

  log('\n✓ Asset added successfully!', 'green');
  log(`\nNext steps:`, 'cyan');

  let stepNum = 1;
  log(`${stepNum++}. Edit ${targetPath} with your content`);

  if (answers.type === 'json') {
    log(`${stepNum++}. After adding your data, generate a schema with: npm run generate-schema ${targetPath}`);
  }

  if (answers.generateHandler) {
    log(`${stepNum++}. Implement the handler logic in ${handlerPath}`);
  }

  log(`${stepNum++}. Update HTML to include elements for displaying this content`);
  log(`${stepNum++}. The handler will be automatically loaded by script.js\n`);
}

// Run
main().catch(error => {
  log(`\nError: ${error.message}`, 'red');
  process.exit(1);
});
