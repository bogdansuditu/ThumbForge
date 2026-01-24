# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ThumbForge** is a lightweight web-based graphic design application for creating thumbnails and memes. Built with pure HTML/CSS/JavaScript with zero build process or dependencies to install.

### Core Philosophy

1. **Zero Build Process**: Open index.html and it just works
2. **Minimal Dependencies**: Only Fabric.js loaded from CDN
3. **Maximum Simplicity**: ~15KB total (HTML + CSS + JS)
4. **Local-First**: Everything runs in the browser, no backend required

### Target Output

Users should be able to create and export a thumbnail immediately with zero setup.

## Technical Stack

- **HTML**: Pure HTML5, no templating
- **CSS**: Plain CSS, no preprocessors
- **JavaScript**: Vanilla ES6+, no framework
- **Canvas Library**: Fabric.js 5.3.0 (from CDN)
- **File Size**: ~15KB total (excluding Fabric.js)
- **Build Process**: None - just open index.html

## How to Run

```bash
# Option 1: Just open the file
open index.html

# Option 2: Use a local server (recommended)
python -m http.server 8000
# Then open http://localhost:8000
```

## File Structure

```
/
├── index.html          # Main HTML structure
├── styles.css          # All styling (dark theme)
├── app.js             # All application logic
├── README.md          # User-facing documentation
└── CLAUDE.md          # This file - developer guidance
```

## Architecture

### Code Organization (app.js)

The entire application is organized into logical sections:

1. **State Variables** (lines 1-10)
   - Canvas instance
   - Current tool selection
   - History/undo state
   - Path drawing state

2. **Canvas Initialization** (initCanvas)
   - Sets up Fabric.js canvas
   - Configures event listeners
   - Initializes history

3. **Tool Functions**
   - `setTool()` - Switch between tools
   - `addText()` - Add text layers
   - `addRectangle()`, `addCircle()`, etc. - Add shapes
   - Path drawing handlers for multi-segment vector paths

4. **Path Drawing System**
   - `handlePathClick()` - Click to add points
   - `handlePathMove()` - Preview path while drawing
   - `finishPath()` - Complete path on double-click or Enter
   - Supports unlimited segments per path

5. **Layer Management**
   - `updateLayersList()` - Refresh layers panel
   - `getLayerIcon()`, `getLayerName()` - Layer display
   - Visibility and lock controls per layer

6. **Properties Panel**
   - `updatePropertiesPanel()` - Context-aware properties
   - Real-time updates with `oninput` events
   - Type-specific properties (text, shapes, paths, images)

7. **History System**
   - `saveState()` - Capture canvas state as JSON
   - `undo()`, `redo()` - Navigate history
   - 50-state limit

8. **Export Functions**
   - `exportCanvas()` - PNG/JPG export
   - Configurable quality and format

### State Management

Simple global variables:
- `canvas` - Fabric.js canvas instance
- `currentTool` - Active tool name
- `history[]` - Array of JSON snapshots
- `historyStep` - Current position in history
- `isDrawingPath` - Path drawing state flag
- `pathPoints[]` - Points for current path being drawn

No React, no Context API - just plain JavaScript variables.

## Implemented Features

### Workspace Layout
- **Top Toolbar**: Undo/Redo, New/Clear, Background color, Canvas size, Export
- **Left Toolbar**: Select, Move, Text, Shapes (with dropdown), Path/Line tool
- **Center**: Canvas with white background and shadow
- **Right Panel**: Layers list and context-aware properties

### Canvas Presets
- YouTube Thumbnail: 1280×720px (default)
- Square: 1080×1080px
- HD: 1920×1080px
- Custom: 800×600px

### Tools

#### Select Tool (V)
- Click to select objects
- Drag to move
- Handles for resize/rotate
- Built-in Fabric.js selection

#### Move Tool (M)
- Same as select but distinct tool state
- For users who prefer separate move mode

#### Text Tool (T)
- Click to add text
- Double-click text to edit inline
- Properties:
  - Font family - extracted from the fonts.json file
  - Font size (number input)
  - Text color (real-time color picker)
  - Stroke width (0-20px slider)
  - Stroke color
  - Shadow (add/remove, blur, offset X/Y, color)
  - Opacity (0-100% slider)

#### Shapes Tool (S)
- Dropdown with: Rectangle, Circle, Triangle, Star, Polygon
- Properties:
  - Fill color (real-time)
  - Stroke width (0-20px)
  - Stroke color (real-time)
  - Corner radius (rectangles only, 0-100px)
  - Shadow support
  - Opacity

#### Path/Line Tool (L)
- Click to add points - unlimited segments!
- Double-click or press Enter to finish path
- Press Escape to cancel
- Shows dashed preview while drawing
- Properties:
  - Stroke width (1-20px)
  - Stroke color (real-time)
  - Opacity

### Layer System
- Layers panel shows all objects (reversed Z-order)
- Each layer has:
  - Icon (based on type)
  - Name (auto-generated or custom)
  - Visibility toggle (eye icon)
  - Lock toggle (lock icon)
- Click layer to select object
- Layers update automatically on changes

### History/Undo System
- Undo: Ctrl/Cmd+Z
- Redo: Ctrl/Cmd+Shift+Z
- Stores last 50 states as JSON snapshots
- Auto-saves state after every change

### Properties Panel (Context-Aware)
Shows different properties based on selected object type:
- **Common**: Opacity slider (all objects)
- **Text**: Font, size, color, stroke, shadow
- **Shapes**: Fill, stroke, corner radius (rects), shadow
- **Paths/Lines**: Stroke width and color
- **Nothing selected**: Empty state message

All color pickers update in **real-time** (oninput, not onchange)

### Export
- PNG export (lossless)
- JPG export (with quality)
- Downloads with timestamp filename
- Full canvas resolution

### Image Support
- Upload images via file picker
- Paste images from clipboard (Ctrl/Cmd+V)
- Auto-scales large images to fit canvas
- Supports all standard image formats

### Keyboard Shortcuts
- `V` - Select tool
- `M` - Move tool
- `T` - Text tool
- `S` - Shapes (shows dropdown)
- `L` - Path/Line tool
- `Ctrl/Cmd + Z` - Undo
- `Ctrl/Cmd + Shift + Z` - Redo
- `Ctrl/Cmd + D` - Duplicate layer
- `Enter/Escape` - Finish path (when drawing)

## Critical Implementation Details

### Real-Time Updates
All property changes use `oninput` events, not `onchange`:
```javascript
oninput="updateObjectProperty('fill', this.value)"
```
This provides instant visual feedback as user adjusts controls.

### Path Drawing Flow
1. User clicks Path tool
2. First click sets starting point
3. Each additional click adds a segment
4. Temporary dashed line shows preview
5. Double-click or Enter finalizes path
6. Creates `fabric.Polyline` object

### Layer Visibility
Layers panel filters out:
- Temporary objects (`obj.temp === true`)
- Objects currently being drawn

### Shadow Implementation
Shadows use Fabric.js `fabric.Shadow` objects:
```javascript
new fabric.Shadow({
    color: 'rgba(0,0,0,0.5)',
    blur: 10,
    offsetX: 4,
    offsetY: 4
})
```

### History Implementation
State captured as JSON using `canvas.toJSON()`:
- Lightweight (serializes only changed properties)
- Reversible (can restore any state)
- Limited to 50 states to avoid memory issues

## Known Limitations

- No bezier curves on paths (straight segments only)
- No custom fonts (browser defaults only)
- No gradients (solid colors only)
- No filters beyond shadow
- No grouping/ungrouping objects
- No alignment tools
- No grid/guides
- No zoom controls
- No layer reordering via drag-drop

## Code Style Guidelines

### Naming Conventions
- Functions: camelCase (`updateLayersList`)
- Variables: camelCase (`currentTool`)
- Constants: UPPER_SNAKE_CASE (`MAX_HISTORY`)
- DOM IDs: camelCase (`canvasSize`)
- CSS classes: kebab-case (`tool-btn`)

### Function Organization
1. State variables at top
2. Initialization functions
3. Tool-specific functions
4. Drawing handlers
5. UI update functions
6. Layer management
7. Properties panel
8. History functions
9. Export/utility functions
10. Event listeners at bottom

### Event Handlers
- Use inline handlers for simple updates: `oninput="updateProperty()"`
- Use `addEventListener` for complex logic
- Always check if object exists before operating on it

### Error Prevention
- Check `if (!activeObj) return;` before operations
- Validate input values (min/max on sliders)
- Don't delete layers with keyboard when editing text
- Use `e.preventDefault()` to avoid unwanted browser actions

## Deployment

No build step required! Just serve the three files:

```bash
# Any static file server works
python -m http.server 8000
# or
npx serve .
# or
php -S localhost:8000
```

Or upload to any static hosting:
- GitHub Pages
- Netlify
- Vercel
- S3 + CloudFront
- Any web server (Apache, NGINX, etc.)

Total deployment size: ~15KB (plus Fabric.js loaded from CDN)
