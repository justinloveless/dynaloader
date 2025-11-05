# dynaloader

Generic asset loader for dynamically loading assets based on `site-assets.json` configuration. Provides dynamic content loading for static sites with CLI tools for asset management.

## Installation

```bash
npm install dynaloader
```

## Usage

### As a Module

Import the asset loader in your JavaScript:

```javascript
import { loadSiteAssets, getContentData } from 'dynaloader';

// Load all assets and execute handlers
await loadSiteAssets('site-assets.json', () => {
  console.log('All assets loaded and handlers executed');
});

// Or get content data after loading
const { siteAssets, contentData } = await loadSiteAssets();
console.log(contentData);
```

### CLI Tools

After installation, you can use the CLI tools:

#### Add Asset

```bash
# Add existing file
npx add-asset path/to/file.json

# Create new file (will prompt for details)
npx add-asset content/new-section.json
```

The tool will:
- Add entry to `site-assets.json` with validation rules
- Create a dedicated handler file in `handlers/` directory
- Create starter content file if it doesn't exist

#### Generate Schema

```bash
# Generate schema from JSON file
npx generate-schema content/property.json

# Generate schema from directory (uses sample JSON file)
npx generate-schema gallery
```

## API Reference

### `loadSiteAssets(assetsPathOrCallback, onComplete)`

Loads site assets configuration, all content files, and executes handlers.

**Parameters:**
- `assetsPathOrCallback` (string|Function): Path to `site-assets.json` file (default: `'site-assets.json'`) or callback function
- `onComplete` (Function): Optional callback function called after all handlers have executed

**Returns:** `Promise<Object>` - Object containing `siteAssets` and `contentData`

**Example:**
```javascript
// With path and callback
await loadSiteAssets('site-assets.json', () => {
  console.log('Done!');
});

// With callback only (uses default path)
await loadSiteAssets(() => {
  console.log('Done!');
});

// Get return value
const { siteAssets, contentData } = await loadSiteAssets();
```

### `loadHandlers(onComplete)`

Load and execute handlers for assets. Usually called automatically by `loadSiteAssets`.

**Parameters:**
- `onComplete` (Function): Optional callback function called after all handlers have executed

### `getContentData()`

Get the loaded content data object.

**Returns:** `Object` - The `contentData` object mapping asset paths to their loaded content

**Example:**
```javascript
await loadSiteAssets();
const contentData = getContentData();
console.log(contentData['content/property.json']);
```

## Handler Structure

Each asset in `site-assets.json` can have a `handler` property pointing to a JavaScript file. The handler file should export a `handle` function:

```javascript
export function handle(data, assetPath) {
  if (!data) return;
  
  // DOM manipulation logic here
  const element = document.querySelector('.my-section');
  if (element) {
    element.textContent = data.title;
  }
}
```

## Site Assets Configuration

Create a `site-assets.json` file to define your assets:

```json
{
  "version": "1.0",
  "description": "Configuration file defining manageable assets",
  "assets": [
    {
      "path": "content/property.json",
      "type": "json",
      "label": "Property Information",
      "description": "Property details",
      "handler": "handlers/property.js",
      "maxSize": 5120,
      "allowedExtensions": [".json"],
      "schema": {
        "type": "object",
        "properties": {
          "title": { "type": "string" }
        }
      }
    }
  ]
}
```

### Asset Types

- **json**: JSON files loaded and parsed
- **text**: Text files (typically Markdown) loaded as strings
- **image**: Image files (path stored, not loaded)
- **directory**: Directory containing multiple assets

### Combo Assets

Combo assets group multiple files with the same base name but different extensions:

```json
{
  "type": "directory",
  "path": "gallery",
  "contains": {
    "type": "combo",
    "parts": [
      { 
        "assetType": "image", 
        "allowedExtensions": [".webp", ".jpg"],
        "maxSize": 2097152
      },
      { 
        "assetType": "json", 
        "allowedExtensions": [".json"],
        "maxSize": 5120
      }
    ]
  },
  "handler": "handlers/gallery.js"
}
```

Handler receives grouped data:
```javascript
export function handle(comboData) {
  Object.keys(comboData).forEach(baseName => {
    const combo = comboData[baseName];
    const imagePath = combo['.webp'] || combo['.jpg'];
    const metadata = combo['.json'];
    // Use imagePath and metadata together
  });
}
```

## License

MIT

