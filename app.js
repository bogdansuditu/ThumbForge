// Canvas and state management
const AVAILABLE_FONTS = [
    'Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Impact', 'Comic Sans MS',
    'Roboto', 'Open Sans', 'Lato', 'Poppins', 'Oswald', 'Merriweather',
    'Playfair Display', 'Ubuntu', 'Lobster'
];

function preloadFonts() {
    // Create an invisible container for font preloading
    const loaderDiv = document.createElement('div');
    loaderDiv.style.cssText = 'position: absolute; left: -9999px; top: -9999px; visibility: hidden; pointer-events: none;';

    AVAILABLE_FONTS.forEach(font => {
        // Normal
        const span = document.createElement('span');
        span.textContent = 'Preload';
        span.style.fontFamily = font;
        loaderDiv.appendChild(span);

        // Bold
        const spanBold = document.createElement('span');
        spanBold.textContent = 'Preload Bold';
        spanBold.style.fontFamily = font;
        spanBold.style.fontWeight = 'bold';
        loaderDiv.appendChild(spanBold);

        // Italic
        const spanItalic = document.createElement('span');
        spanItalic.textContent = 'Preload Italic';
        spanItalic.style.fontFamily = font;
        spanItalic.style.fontStyle = 'italic';
        loaderDiv.appendChild(spanItalic);
    });

    document.body.appendChild(loaderDiv);
}

let canvas;
let currentTool = 'select';
let history = [];
let historyStep = -1;
const MAX_HISTORY = 50;
let isDrawingPath = false;
let pathPoints = [];
let tempPathLine = null;
let backgroundColor = '#ffffff'; // Background is now a property, not an object
let backgroundOpacity = 1.0; // Background opacity (0-1)
let backgroundSelected = false; // Track if background is selected for properties panel
let autoSaveTimeout = null;


// Initialize canvas
function initCanvas() {
    console.log('Initializing canvas...');
    preloadFonts(); // Preload all fonts immediately
    const width = parseInt(document.getElementById('canvasWidth').value) || 1280;
    const height = parseInt(document.getElementById('canvasHeight').value) || 720;

    console.log('Creating Fabric canvas...');
    canvas = new fabric.Canvas('canvas', {
        width: width,
        height: height,
        backgroundColor: '#ffffff',
        preserveObjectStacking: true
    });

    console.log('Applying background color...');
    // Apply background color with opacity
    applyBackgroundColor();

    console.log('Setting up layer-level blur...');
    // Initialize layer-level blur
    setupLayerLevelBlur();

    // Event listeners
    canvas.on('selection:created', () => {
        backgroundSelected = false;
        updatePropertiesPanel();
    });
    canvas.on('selection:updated', () => {
        backgroundSelected = false;
        updatePropertiesPanel();
    });
    canvas.on('selection:cleared', () => {
        backgroundSelected = false;
        clearPropertiesPanel();
    });
    canvas.on('object:modified', () => {
        saveState();
        updateLayersList();
    });

    // Handle uniform corner radius on scaling
    canvas.on('object:scaling', handleUniformCorners);

    // Keep image border overlays in sync
    canvas.on('object:moving', syncImageBorderOverlay);
    // Keep image border overlays in sync
    canvas.on('object:moving', syncImageBorderOverlay);
    canvas.on('object:rotating', syncImageBorderOverlay);
    canvas.on('object:scaling', syncImageBorderOverlay);

    // Clean up overlays when object is removed
    canvas.on('object:removed', function (e) {
        const obj = e.target;
        if (obj._borderOverlay && canvas.contains(obj._borderOverlay)) {
            canvas.remove(obj._borderOverlay);
        }

    });
    canvas.on('object:added', () => {
        updateLayersList();
        saveState();
    });
    canvas.on('object:removed', updateLayersList);

    // Path drawing
    canvas.on('mouse:down', handlePathClick);
    canvas.on('mouse:move', handlePathMove);
    canvas.on('mouse:dblclick', finishPath);

    // Try to restore from auto-save
    console.log('Restoring auto-save...');
    restoreAutoSave();

    console.log('Saving initial state...');
    saveState();
    updateLayersList();

    console.log('Canvas initialization complete!');
}

// Auto-save functionality
function autoSave() {
    // Debounce auto-save to avoid excessive writes
    if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
    }

    autoSaveTimeout = setTimeout(() => {
        try {
            const projectData = {
                version: '1.0',
                canvasWidth: canvas.width,
                canvasHeight: canvas.height,
                backgroundColor: backgroundColor,
                backgroundOpacity: backgroundOpacity,
                timestamp: Date.now(),
                objects: canvas.toJSON(['name', 'starSpikes', 'outerRadius', 'innerRadius', 'polygonSides', 'polygonRadius', 'shapeType', 'uniformRadius', 'cornerRadius', 'imgStrokeWidth', 'imgStroke', 'blurAmount'])
            };

            localStorage.setItem('thumbforge-autosave', JSON.stringify(projectData));
            console.log('Auto-saved at', new Date().toLocaleTimeString());
        } catch (error) {
            console.error('Auto-save failed:', error);
        }
    }, 2000); // Save 2 seconds after last change
}

function restoreAutoSave() {
    try {
        const saved = localStorage.getItem('thumbforge-autosave');
        if (!saved) return;

        const projectData = JSON.parse(saved);

        // Update canvas dimensions
        document.getElementById('canvasWidth').value = projectData.canvasWidth;
        document.getElementById('canvasHeight').value = projectData.canvasHeight;
        canvas.setDimensions({
            width: projectData.canvasWidth,
            height: projectData.canvasHeight
        });

        // Clear current canvas
        canvas.clear();

        // Restore background color and opacity if saved
        if (projectData.backgroundColor) {
            backgroundColor = projectData.backgroundColor;
        }
        if (projectData.backgroundOpacity !== undefined) {
            backgroundOpacity = projectData.backgroundOpacity;
        }
        applyBackgroundColor();

        // Load objects
        canvas.loadFromJSON(projectData.objects, () => {
            // Remove any old background objects (from old saves)
            const objects = canvas.getObjects();
            const oldBgObjects = objects.filter(obj => obj.isBackground);
            oldBgObjects.forEach(obj => canvas.remove(obj));

            // Restore image corner radius clipPaths and blur
            objects.forEach(obj => {
                if (obj.type === 'image' && obj.cornerRadius > 0) {
                    applyImageCornerRadius(obj);
                }
                if (obj.blurAmount > 0) {
                    applyBlur(obj, obj.blurAmount);
                }

            });

            canvas.renderAll();
            updateLayersList();
            clearPropertiesPanel();

            console.log('Restored from auto-save');
        });

    } catch (error) {
        console.error('Failed to restore auto-save:', error);
        // If restore fails, just start fresh (background is already set)
    }
}

function clearAutoSave() {
    localStorage.removeItem('thumbforge-autosave');
}

function saveImmediately() {
    // Save immediately without debounce (used on page unload)
    try {
        const projectData = {
            version: '1.0',
            canvasWidth: canvas.width,
            canvasHeight: canvas.height,
            backgroundColor: backgroundColor,
            backgroundOpacity: backgroundOpacity,
            timestamp: Date.now(),
            objects: canvas.toJSON(['isBackground', 'name', 'starSpikes', 'outerRadius', 'innerRadius', 'polygonSides', 'polygonRadius', 'shapeType', 'uniformRadius', 'cornerRadius', 'imgStrokeWidth', 'imgStroke', 'blurAmount', 'blurShadow'])
        };

        localStorage.setItem('thumbforge-autosave', JSON.stringify(projectData));
    } catch (error) {
        console.error('Immediate save failed:', error);
    }
}

// Background Layer Management
// Setup layer-level blur by overriding Fabric.js object rendering
// This applies ctx.filter before each object renders, like template.html does
function setupLayerLevelBlur() {
    try {
        // Check if Fabric.js is loaded
        if (typeof fabric === 'undefined' || !fabric.Object) {
            console.warn('Fabric.js not loaded yet, skipping blur setup');
            return;
        }

        // Test browser support for ctx.filter
        const testCanvas = document.createElement('canvas');
        const testCtx = testCanvas.getContext('2d');
        testCtx.filter = 'blur(5px)';
        if (testCtx.filter !== 'blur(5px)') {
            console.warn('Canvas filters not supported in this browser - blur effects will not work');
            return;
        }

        // Store the original drawObject method
        const originalDrawObject = fabric.Object.prototype.drawObject;

        // Override drawObject to apply ctx.filter
        fabric.Object.prototype.drawObject = function (ctx) {
            const filters = [];

            // 1. Blur
            if (this.blurAmount > 0) {
                filters.push(`blur(${this.blurAmount}px)`);
            }

            // Apply filters
            if (filters.length > 0) {
                ctx.filter = filters.join(' ');
            }

            try {
                // Call original draw method
                originalDrawObject.call(this, ctx);
            } finally {
                // Always reset filter
                if (filters.length > 0) {
                    ctx.filter = 'none';
                }
            }
        };
    } catch (error) {
        console.error('Error setting up layer-level blur:', error);
    }
}

// Background management functions removed - background is now canvas.backgroundColor property

function updateBackgroundColor(color) {
    backgroundColor = color;
    applyBackgroundColor();

    // Update toolbar input if it exists
    // REMOVED as per user request
    /*
    const toolbarInput = document.getElementById('backgroundColor');
    if (toolbarInput && document.activeElement !== toolbarInput) {
        toolbarInput.value = color;
    }
    */

    // Update property panel inputs if they exist and are not focused
    if (backgroundSelected) {
        const propColor = document.getElementById('prop-bg-color');
        if (propColor && document.activeElement !== propColor) {
            propColor.value = color;
        }

        const propText = document.getElementById('prop-bg-text');
        if (propText && document.activeElement !== propText) {
            propText.value = color;
        }
    }

    // Do NOT call updatePropertiesPanel() to avoid re-rendering and losing focus
    saveState();
}

function updateBackgroundOpacity(opacity) {
    backgroundOpacity = opacity;
    applyBackgroundColor();

    // Update property panel text if it exists
    if (backgroundSelected) {
        const propValue = document.getElementById('prop-bg-opacity-value');
        if (propValue) {
            propValue.textContent = Math.round(opacity * 100) + '%';
        }

        // Also ensure slider is in sync if changed from elsewhere (rare but good practice)
        const propSlider = document.getElementById('prop-bg-opacity');
        if (propSlider && document.activeElement !== propSlider) {
            propSlider.value = opacity * 100;
        }
    }

    // Do NOT call updatePropertiesPanel() to avoid re-rendering and losing focus
    saveState();
}

function applyBackgroundColor() {
    if (!canvas) return; // Safety check

    // Convert hex color to rgba with opacity
    let finalColor = backgroundColor;

    // If it's a hex color, convert to rgba
    if (backgroundColor.startsWith('#')) {
        const hex = backgroundColor.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        finalColor = `rgba(${r}, ${g}, ${b}, ${backgroundOpacity})`;
    } else if (backgroundColor.startsWith('rgb')) {
        // If already rgb/rgba, replace alpha
        finalColor = backgroundColor.replace(/rgba?\((\d+),\s*(\d+),\s*(\d+).*\)/, `rgba($1, $2, $3, ${backgroundOpacity})`);
    }

    canvas.setBackgroundColor(finalColor, canvas.renderAll.bind(canvas));
}

// Removed ensureBackgroundAtBottom() and ensureBackgroundLocked() - no longer needed
function ensureBackgroundLocked() {
    // Background is no longer an object, so this function is deprecated
    // Keeping empty function to avoid breaking existing code
    return;
}

// Handle uniform corner radius during scaling
function handleUniformCorners(e) {
    const obj = e.target;

    // Handle rectangles with corner radius
    if (obj.type === 'rect' && obj.uniformRadius !== undefined) {
        obj.set({
            rx: obj.uniformRadius / obj.scaleX,
            ry: obj.uniformRadius / obj.scaleY
        });
    }

    // Handle images with corner radius
    if (obj.type === 'image' && obj.cornerRadius !== undefined && obj.cornerRadius > 0) {
        applyImageCornerRadius(obj);
    }
}

// Sync image border overlay position and properties
function syncImageBorderOverlay(e) {
    const img = e.target;
    if (img.type !== 'image' || !img._borderOverlay) return;

    const border = img._borderOverlay;
    const scaleX = img.scaleX || 1;
    const scaleY = img.scaleY || 1;

    border.set({
        left: img.left,
        top: img.top,
        angle: img.angle || 0,
        width: img.width * scaleX,
        height: img.height * scaleY,
        scaleX: 1,
        scaleY: 1
    });

    border.setCoords();
    canvas.renderAll();
}



// Apply corner radius to images using clipPath
function applyImageCornerRadius(img) {
    // Get stroke properties from custom properties
    const imgStrokeWidth = img.imgStrokeWidth !== undefined ? img.imgStrokeWidth : 0;
    const imgStroke = img.imgStroke || '#000000';

    const scaleX = img.scaleX || 1;
    const scaleY = img.scaleY || 1;
    const avgScale = (scaleX + scaleY) / 2;

    // If no corner radius, apply stroke directly to image
    if (!img.cornerRadius || img.cornerRadius === 0) {
        img.clipPath = null;
        // Remove any border overlay if it exists
        if (img._borderOverlay && canvas.contains(img._borderOverlay)) {
            canvas.remove(img._borderOverlay);
            img._borderOverlay = null;
        }
        img.set({
            strokeWidth: imgStrokeWidth,
            stroke: imgStroke,
            strokeUniform: true,
            dirty: true
        });
        canvas.renderAll();
        return;
    }

    // Has corner radius - use clipPath for clipping (no stroke)
    const radius = img.cornerRadius / avgScale;
    const width = img.width;
    const height = img.height;

    // ClipPath for rounding corners (no stroke)
    // Use standard approach: centered on object means negative top/left offset
    const clipPath = new fabric.Rect({
        left: -width / 2,
        top: -height / 2,
        originX: 'left',
        originY: 'top',
        width: width,
        height: height,
        rx: radius,
        ry: radius,
        fill: '#000000',
        absolutePositioned: false
    });

    img.clipPath = clipPath;
    img.strokeWidth = 0;
    img.objectCaching = false; // Disable caching to ensure clip updates render correctly

    // If there's a stroke, create a border overlay
    if (imgStrokeWidth > 0) {
        const strokeWidth = imgStrokeWidth / avgScale;

        // Remove old border if exists
        if (img._borderOverlay && canvas.contains(img._borderOverlay)) {
            canvas.remove(img._borderOverlay);
        }

        // Create border rect overlay
        const border = new fabric.Rect({
            left: img.left,
            top: img.top,
            width: width * scaleX,
            height: height * scaleY,
            rx: img.cornerRadius,
            ry: img.cornerRadius,
            fill: 'transparent',
            stroke: imgStroke,
            strokeWidth: imgStrokeWidth,
            strokeUniform: true,
            selectable: false,
            evented: false,
            originX: 'center',
            originY: 'center',
            angle: img.angle || 0,
            temp: true // Mark as temporary so it doesn't show in layers list
        });

        canvas.add(border);
        border.moveTo(canvas.getObjects().indexOf(img) + 1); // Place right after image
        img._borderOverlay = border;
    } else {
        // Remove border if stroke width is 0
        if (img._borderOverlay && canvas.contains(img._borderOverlay)) {
            canvas.remove(img._borderOverlay);
            img._borderOverlay = null;
        }
    }

    img.dirty = true;
    canvas.renderAll();


}

// Tool Management
function setTool(tool) {
    currentTool = tool;
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    const toolBtn = document.querySelector(`[data-tool="${tool}"]`);
    if (toolBtn) toolBtn.classList.add('active');

    canvas.selection = (tool === 'select' || tool === 'move');
    canvas.defaultCursor = (tool === 'select' || tool === 'move') ? 'default' : 'crosshair';

    // Handle specific tool actions
    if (tool === 'text') {
        addText();
        setTimeout(() => setTool('select'), 100);
    }
}

// Add Text
function addText() {
    const text = new fabric.IText('Click to edit', {
        left: canvas.width / 2,
        top: canvas.height / 2,
        fontSize: 48,
        fontFamily: 'Arial',
        fill: '#000000',
        strokeWidth: 0,
        stroke: '#000000',
        strokeUniform: true,
        shadow: null,
        originX: 'center',
        originY: 'center',
        blurAmount: 0,
        objectCaching: true
    });

    canvas.add(text);
    canvas.setActiveObject(text);
    text.enterEditing();
    text.selectAll();
    canvas.renderAll();
}

// Shape creation functions
function addRectangle() {
    const rect = new fabric.Rect({
        left: canvas.width / 2 - 100,
        top: canvas.height / 2 - 75,
        width: 200,
        height: 150,
        fill: '#0066ff',
        strokeWidth: 0,
        stroke: '#000000',
        strokeUniform: true,
        rx: 0,
        ry: 0,
        uniformRadius: 0,
        blurAmount: 0,
        objectCaching: true
    });
    canvas.add(rect);
    canvas.setActiveObject(rect);
    canvas.renderAll();
}

function addCircle() {
    const circle = new fabric.Circle({
        left: canvas.width / 2 - 75,
        top: canvas.height / 2 - 75,
        radius: 75,
        fill: '#ff6600',
        strokeWidth: 0,
        stroke: '#000000',
        strokeUniform: true,
        blurAmount: 0,
        objectCaching: true
    });
    canvas.add(circle);
    canvas.setActiveObject(circle);
    canvas.renderAll();
}

function addTriangle() {
    const triangle = new fabric.Triangle({
        left: canvas.width / 2,
        top: canvas.height / 2,
        width: 150,
        height: 150,
        fill: '#00cc66',
        strokeWidth: 0,
        stroke: '#000000',
        strokeUniform: true,
        originX: 'center',
        originY: 'center',
        blurAmount: 0,
        objectCaching: true
    });
    canvas.add(triangle);
    canvas.setActiveObject(triangle);
    canvas.renderAll();
}

function addStar() {
    const spikes = 5;
    const outerRadius = 75;
    const innerRadius = 35;
    const points = generateStarPoints(spikes, outerRadius, innerRadius);

    const star = new fabric.Polygon(points, {
        left: canvas.width / 2,
        top: canvas.height / 2,
        fill: '#ffcc00',
        strokeWidth: 0,
        stroke: '#000000',
        strokeUniform: true,
        originX: 'center',
        originY: 'center',
        starSpikes: spikes,
        outerRadius: outerRadius,
        innerRadius: innerRadius,
        shapeType: 'star',
        blurAmount: 0,
        objectCaching: true
    });
    canvas.add(star);
    canvas.setActiveObject(star);
    canvas.renderAll();
}

function addPolygon() {
    const sides = 6;
    const radius = 75;
    const points = generatePolygonPoints(sides, radius);

    const polygon = new fabric.Polygon(points, {
        left: canvas.width / 2,
        top: canvas.height / 2,
        fill: '#9933ff',
        strokeWidth: 0,
        stroke: '#000000',
        strokeUniform: true,
        originX: 'center',
        originY: 'center',
        polygonSides: sides,
        polygonRadius: radius,
        shapeType: 'polygon',
        blurAmount: 0,
        objectCaching: true
    });
    canvas.add(polygon);
    canvas.setActiveObject(polygon);
    canvas.renderAll();
}

// Helper functions to generate points
function generateStarPoints(spikes, outerRadius, innerRadius) {
    const points = [];
    for (let i = 0; i < spikes * 2; i++) {
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const angle = (i * Math.PI) / spikes - Math.PI / 2;
        points.push({
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius
        });
    }
    return points;
}

function generatePolygonPoints(sides, radius) {
    const points = [];
    for (let i = 0; i < sides; i++) {
        const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
        points.push({
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius
        });
    }
    return points;
}

// Path drawing handlers
function handlePathClick(e) {
    if (currentTool !== 'line') return;
    if (e.target) return; // Clicked on an existing object

    const pointer = canvas.getPointer(e.e);

    if (!isDrawingPath) {
        // Start new path
        isDrawingPath = true;
        pathPoints = [pointer];
        canvas.selection = false;
    } else {
        // Add point to existing path
        pathPoints.push(pointer);
        updateTempPath();
    }
}

function handlePathMove(e) {
    if (currentTool !== 'line' || !isDrawingPath) return;

    const pointer = canvas.getPointer(e.e);

    // Remove temporary line
    if (tempPathLine) {
        canvas.remove(tempPathLine);
        tempPathLine = null;
    }

    // Draw temporary path showing current state + cursor position
    if (pathPoints.length > 0) {
        const points = [...pathPoints, pointer];
        tempPathLine = new fabric.Polyline(points, {
            stroke: '#000000',
            strokeWidth: 3,
            strokeUniform: true,
            fill: '',
            selectable: false,
            evented: false,
            opacity: 0.5,
            strokeDashArray: [5, 5]
        });
        canvas.add(tempPathLine);
        canvas.renderAll();
    }
}

function updateTempPath() {
    if (tempPathLine) {
        canvas.remove(tempPathLine);
        tempPathLine = null;
    }

    if (pathPoints.length > 1) {
        tempPathLine = new fabric.Polyline(pathPoints, {
            stroke: '#000000',
            strokeWidth: 3,
            strokeUniform: true,
            fill: '',
            selectable: false,
            evented: false,
            opacity: 0.5,
            strokeDashArray: [5, 5]
        });
        canvas.add(tempPathLine);
        canvas.renderAll();
    }
}

function finishPath(e) {
    if (currentTool !== 'line' || !isDrawingPath) return;

    // Remove temporary path
    if (tempPathLine) {
        canvas.remove(tempPathLine);
        tempPathLine = null;
    }

    // Create final path if we have at least 2 points
    if (pathPoints.length >= 2) {
        const polyline = new fabric.Polyline(pathPoints, {
            stroke: '#000000',
            strokeWidth: 3,
            strokeUniform: true,
            fill: '',
            selectable: true,
            blurAmount: 0,
            objectCaching: true
        });
        canvas.add(polyline);
        canvas.setActiveObject(polyline);
    }

    // Reset path state
    isDrawingPath = false;
    pathPoints = [];
    canvas.selection = true;
    setTool('select');
    canvas.renderAll();
}

// Image Upload
function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (event) {
        fabric.Image.fromURL(event.target.result, function (img) {
            const scale = Math.min(
                canvas.width / 2 / img.width,
                canvas.height / 2 / img.height
            );

            img.scale(scale);
            img.set({
                left: canvas.width / 2,
                top: canvas.height / 2,
                originX: 'center',
                originY: 'center',
                cornerRadius: 0,
                imgStrokeWidth: 0,
                imgStroke: '#000000',
                strokeWidth: 0,
                strokeUniform: true,
                blurAmount: 0,
                objectCaching: true
            });

            canvas.add(img);
            applyImageCornerRadius(img);
            canvas.setActiveObject(img);
            canvas.renderAll();
        });
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset input
}

// Update Layers List
function updateLayersList() {
    const layersList = document.getElementById('layersList');
    layersList.innerHTML = '';

    const objects = canvas.getObjects().reverse();

    objects.forEach((obj, index) => {
        // Skip temporary objects and old background objects
        if (obj.temp || obj.isBackground) return;

        const actualIndex = canvas.getObjects().length - 1 - index;
        const layerItem = document.createElement('div');
        layerItem.className = 'layer-item';
        layerItem.dataset.index = actualIndex;

        // All layers are draggable (no background object)
        layerItem.draggable = true;

        if (canvas.getActiveObject() === obj) {
            layerItem.classList.add('active');
        }

        const icon = getLayerIcon(obj);
        const name = getLayerName(obj, actualIndex);

        layerItem.innerHTML = `
            <span class="drag-handle">☰</span>
            <span class="layer-icon">${icon}</span>
            <span class="layer-name">${name}</span>
            <div class="layer-controls">
                <button class="layer-control-btn visibility-btn ${obj.visible !== false ? 'active' : ''}" title="Toggle Visibility">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        ${obj.visible !== false ?
                '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>' :
                '<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
            }
                    </svg>
                </button>
                <button class="layer-control-btn lock-btn ${obj.lockMovementX ? 'active' : ''}" title="Toggle Lock">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        ${obj.lockMovementX ?
                '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>' :
                '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 019.9-1"/>'
            }
                    </svg>
                </button>
            </div>
        `;

        // Drag and drop events (all layers are draggable now)
        layerItem.addEventListener('dragstart', handleDragStart);
        layerItem.addEventListener('dragover', handleDragOver);
        layerItem.addEventListener('drop', handleDrop);
        layerItem.addEventListener('dragenter', handleDragEnter);
        layerItem.addEventListener('dragleave', handleDragLeave);
        layerItem.addEventListener('dragend', handleDragEnd);

        const visibilityBtn = layerItem.querySelector('.visibility-btn');
        if (visibilityBtn) {
            visibilityBtn.addEventListener('click', (e) => {
                obj.visible = !obj.visible;
                canvas.renderAll();
                updateLayersList();
                e.stopPropagation();
            });
        }

        const lockBtn = layerItem.querySelector('.lock-btn');
        if (lockBtn) {
            lockBtn.addEventListener('click', (e) => {
                const locked = !obj.lockMovementX;
                obj.lockMovementX = locked;
                obj.lockMovementY = locked;
                obj.lockScalingX = locked;
                obj.lockScalingY = locked;
                obj.lockRotation = locked;
                obj.selectable = !locked;
                canvas.renderAll();
                updateLayersList();
                e.stopPropagation();
            });
        }

        // Select layer
        layerItem.addEventListener('click', (e) => {
            // Don't select if clicking on drag handle
            if (e.target.classList.contains('drag-handle')) return;

            backgroundSelected = false; // Clear background selection when selecting a layer

            // For background layer, temporarily make it selectable
            if (obj.isBackground) {
                obj.selectable = true;
                canvas.setActiveObject(obj);
                obj.selectable = false;
            } else {
                canvas.setActiveObject(obj);
            }

            canvas.renderAll();
            updatePropertiesPanel();
            updateLayersList();
        });

        layersList.appendChild(layerItem);
    });

    // Add background visual layer (always at bottom)
    const bgLayerItem = document.createElement('div');
    bgLayerItem.className = `layer-item background-layer ${backgroundSelected ? 'active' : ''}`;
    bgLayerItem.style.cursor = 'pointer';

    bgLayerItem.innerHTML = `
        <span class="drag-handle" style="visibility: hidden;">☰</span>
        <span class="layer-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
            </svg>
        </span>
        <span class="layer-name">Background</span>
        <div class="layer-controls"></div>
    `;

    bgLayerItem.addEventListener('click', () => {
        backgroundSelected = true;
        canvas.discardActiveObject();
        canvas.renderAll();
        updatePropertiesPanel();
        updateLayersList();
    });

    layersList.appendChild(bgLayerItem);
}

// Drag and Drop handlers for layer reordering
let draggedElement = null;

function handleDragStart(e) {
    draggedElement = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDragEnter(e) {
    if (this !== draggedElement && !this.classList.contains('background-layer')) {
        this.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }

    if (draggedElement !== this && !this.classList.contains('background-layer')) {
        const draggedIndex = parseInt(draggedElement.dataset.index);
        const targetIndex = parseInt(this.dataset.index);

        // Reorder objects in canvas
        const objects = canvas.getObjects();
        const draggedObj = objects[draggedIndex];

        // Remove from current position
        canvas.remove(draggedObj);

        // Insert at new position
        canvas.insertAt(draggedObj, targetIndex, false);

        canvas.renderAll();
        updateLayersList();
        saveState();
    }

    return false;
}

function handleDragEnd(e) {
    this.classList.remove('dragging');

    // Remove drag-over class from all items
    document.querySelectorAll('.layer-item').forEach(item => {
        item.classList.remove('drag-over');
    });
}

function getLayerIcon(obj) {
    const svgStyle = 'width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"';

    if (obj.isBackground) {
        return `<svg ${svgStyle}><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`;
    }
    if (obj.type === 'i-text' || obj.type === 'text') {
        return `<svg ${svgStyle}><path d="M4 7V4h16v3M9 20h6M12 4v16"/></svg>`;
    }
    if (obj.type === 'rect') {
        return `<svg ${svgStyle}><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`;
    }
    if (obj.type === 'circle') {
        return `<svg ${svgStyle}><circle cx="12" cy="12" r="10"/></svg>`;
    }
    if (obj.type === 'triangle') {
        return `<svg ${svgStyle}><path d="M12 2l10 18H2z"/></svg>`;
    }
    if (obj.type === 'polygon') {
        return `<svg ${svgStyle}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
    }
    if (obj.type === 'line' || obj.type === 'polyline') {
        return `<svg ${svgStyle}><polyline points="4 17 10 11 16 17 22 11"/></svg>`;
    }
    if (obj.type === 'image') {
        return `<svg ${svgStyle}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
    }
    return `<svg ${svgStyle}><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>`;
}

function getLayerName(obj, index) {
    if (obj.isBackground) return 'Background';
    if (obj.name) return obj.name;
    if (obj.type === 'i-text' || obj.type === 'text') {
        return obj.text.substring(0, 20) + (obj.text.length > 20 ? '...' : '');
    }
    if (obj.type === 'rect') return 'Rectangle';
    if (obj.type === 'circle') return 'Circle';
    if (obj.type === 'triangle') return 'Triangle';
    if (obj.type === 'polygon') return obj.points.length === 5 ? 'Star' : 'Polygon';
    if (obj.type === 'line') return 'Line';
    if (obj.type === 'polyline') return 'Path';
    if (obj.type === 'image') return 'Image';
    return `Layer ${index + 1}`;
}

// Properties Panel
function updatePropertiesPanel() {
    const panel = document.getElementById('propertiesPanel');
    let html = '';

    // Handle background selection
    if (backgroundSelected) {
        html += `
            <div class="property-group">
                <label class="property-label">Background Color</label>
                <div class="color-input-group">
                    <input type="color" id="prop-bg-color" value="${backgroundColor}"
                           oninput="updateBackgroundColor(this.value)">
                    <input type="text" id="prop-bg-text" class="property-input" value="${backgroundColor}"
                           oninput="updateBackgroundColor(this.value)">
                </div>
            </div>

            <div class="property-group">
                <label class="property-label">Background Opacity</label>
                <input type="range" id="prop-bg-opacity" min="0" max="100" value="${backgroundOpacity * 100}"
                       oninput="updateBackgroundOpacity(this.value / 100)">
                <span id="prop-bg-opacity-value">${Math.round(backgroundOpacity * 100)}%</span>
            </div>
        `;
        panel.innerHTML = html;
        return;
    }

    const activeObj = canvas.getActiveObject();
    if (!activeObj) {
        clearPropertiesPanel();
        return;
    }

    // Background is no longer an object, so no background properties in this panel

    // Common properties
    html += `
        <div class="property-group">
            <label class="property-label">Opacity</label>
            <input type="range" min="0" max="100" value="${(activeObj.opacity || 1) * 100}"
                   oninput="updateObjectProperty('opacity', this.value / 100); this.nextElementSibling.textContent = this.value + '%'">
            <span>${Math.round((activeObj.opacity || 1) * 100)}%</span>
        </div>

        <div class="property-group">
            <label class="property-label">Blur</label>
            <input type="range" min="0" max="100" value="${activeObj.blurAmount || 0}"
                   oninput="updateBlur(parseInt(this.value)); this.nextElementSibling.textContent = this.value + '%'">
            <span>${activeObj.blurAmount || 0}%</span>
        </div>
    `;

    // Text-specific properties
    if (activeObj.type === 'i-text' || activeObj.type === 'text') {
        html += `
            <div class="property-group">
                <label class="property-label">Font Size</label>
                <input type="range" min="10" max="300" value="${activeObj.fontSize}"
                       oninput="updateObjectProperty('fontSize', parseInt(this.value)); this.nextElementSibling.textContent = this.value + 'px'">
                <span>${activeObj.fontSize}px</span>
            </div>

            <div class="property-group">
                <label class="property-label">Font Family</label>
                <select class="property-input" onchange="updateObjectProperty('fontFamily', this.value)">
                    ${AVAILABLE_FONTS.map(font =>
            `<option value="${font}" ${activeObj.fontFamily === font ? 'selected' : ''} style="font-family: '${font}'">${font}</option>`
        ).join('')}
                </select>
            </div>

            <div class="property-group style-controls" style="display: flex; gap: 8px;">
                <button class="btn style-btn ${activeObj.fontWeight === 'bold' ? 'active' : ''}" 
                        onclick="toggleFontWeight()" 
                        style="flex: 1; font-weight: bold;">B</button>
                <button class="btn style-btn ${activeObj.fontStyle === 'italic' ? 'active' : ''}" 
                        onclick="toggleFontStyle()" 
                        style="flex: 1; font-style: italic;">I</button>
            </div>

            <div class="property-group">
                <label class="property-label">Text Color</label>
                <div class="color-input-group">
                    <input type="color" value="${activeObj.fill}"
                           oninput="updateObjectProperty('fill', this.value)">
                    <input type="text" class="property-input" value="${activeObj.fill}"
                           oninput="updateObjectProperty('fill', this.value)">
                </div>
            </div>

            <div class="property-group">
                <label class="property-label">Stroke Width</label>
                <input type="range" min="0" max="20" value="${activeObj.strokeWidth || 0}"
                       oninput="updateObjectProperty('strokeWidth', parseInt(this.value)); this.nextElementSibling.textContent = this.value + 'px'">
                <span>${activeObj.strokeWidth || 0}px</span>
            </div>

            <div class="property-group">
                <label class="property-label">Stroke Color</label>
                <div class="color-input-group">
                    <input type="color" value="${activeObj.stroke || '#000000'}"
                           oninput="updateObjectProperty('stroke', this.value)">
                </div>
            </div>

            <div class="property-group">
                <label class="property-label">Shadow</label>
                <button class="btn" onclick="toggleShadow()" style="width: 100%">
                    ${activeObj.shadow ? 'Remove Shadow' : 'Add Shadow'}
                </button>
            </div>

            ${activeObj.shadow ? `
                <div class="property-group">
                    <label class="property-label">Shadow Blur</label>
                    <input type="range" min="0" max="100" value="${activeObj.shadow.blur || 0}"
                           oninput="updateShadowProperty('blur', parseInt(this.value)); this.nextElementSibling.textContent = this.value + 'px'">
                    <span>${activeObj.shadow.blur || 0}px</span>
                </div>

                <div class="property-group">
                    <label class="property-label">Shadow Offset X</label>
                    <input type="range" min="-50" max="50" value="${activeObj.shadow.offsetX || 0}"
                           oninput="updateShadowProperty('offsetX', parseInt(this.value)); this.nextElementSibling.textContent = this.value + 'px'">
                    <span>${activeObj.shadow.offsetX || 0}px</span>
                </div>

                <div class="property-group">
                    <label class="property-label">Shadow Offset Y</label>
                    <input type="range" min="-50" max="50" value="${activeObj.shadow.offsetY || 0}"
                           oninput="updateShadowProperty('offsetY', parseInt(this.value)); this.nextElementSibling.textContent = this.value + 'px'">
                    <span>${activeObj.shadow.offsetY || 0}px</span>
                </div>

                <div class="property-group">
                    <label class="property-label">Shadow Color</label>
                    <div class="color-input-group">
                        <input type="color" value="${(activeObj.shadow.color || 'rgba(0,0,0,0.5)').replace(/rgba?\((\d+),\s*(\d+),\s*(\d+).*\)/, (m, r, g, b) => '#' + [r, g, b].map(x => parseInt(x).toString(16).padStart(2, '0')).join(''))}"
                               oninput="updateShadowProperty('color', this.value)">
                    </div>
                </div>
            ` : ''}


        `;
    }

    // Shape properties
    if (activeObj.type === 'rect' || activeObj.type === 'circle' || activeObj.type === 'triangle' || activeObj.type === 'polygon') {
        html += `
            <div class="property-group">
                <label class="property-label">Fill Color</label>
                <div class="color-input-group">
                    <input type="color" value="${activeObj.fill}"
                           oninput="updateObjectProperty('fill', this.value)">
                    <input type="text" class="property-input" value="${activeObj.fill}"
                           oninput="updateObjectProperty('fill', this.value)">
                </div>
            </div>

            <div class="property-group">
                <label class="property-label">Stroke Width</label>
                <input type="range" min="0" max="20" value="${activeObj.strokeWidth || 0}"
                       oninput="updateObjectProperty('strokeWidth', parseInt(this.value)); this.nextElementSibling.textContent = this.value + 'px'">
                <span>${activeObj.strokeWidth || 0}px</span>
            </div>

            <div class="property-group">
                <label class="property-label">Stroke Color</label>
                <div class="color-input-group">
                    <input type="color" value="${activeObj.stroke || '#000000'}"
                           oninput="updateObjectProperty('stroke', this.value)">
                </div>
            </div>
        `;

        // Rectangle-specific: corner radius
        if (activeObj.type === 'rect') {
            html += `
                <div class="property-group">
                    <label class="property-label">Corner Radius</label>
                    <input type="range" min="0" max="100" value="${activeObj.rx || 0}"
                           oninput="updateRectCorners(parseInt(this.value)); this.nextElementSibling.textContent = this.value + 'px'">
                    <span>${activeObj.rx || 0}px</span>
                </div>
            `;
        }

        // Star-specific properties
        if (activeObj.shapeType === 'star') {
            html += `
                <div class="property-group">
                    <label class="property-label">Star Points</label>
                    <input type="range" min="3" max="20" value="${activeObj.starSpikes || 5}"
                           oninput="updateStarPoints(parseInt(this.value)); this.nextElementSibling.textContent = this.value">
                    <span>${activeObj.starSpikes || 5}</span>
                </div>

                <div class="property-group">
                    <label class="property-label">Outer Radius</label>
                    <input type="range" min="20" max="200" value="${activeObj.outerRadius || 75}"
                           oninput="updateStarOuterRadius(parseInt(this.value)); this.nextElementSibling.textContent = this.value + 'px'">
                    <span>${activeObj.outerRadius || 75}px</span>
                </div>

                <div class="property-group">
                    <label class="property-label">Inner Radius</label>
                    <input type="range" min="10" max="150" value="${activeObj.innerRadius || 35}"
                           oninput="updateStarInnerRadius(parseInt(this.value)); this.nextElementSibling.textContent = this.value + 'px'">
                    <span>${activeObj.innerRadius || 35}px</span>
                </div>
            `;
        }

        // Polygon-specific properties
        if (activeObj.shapeType === 'polygon') {
            html += `
                <div class="property-group">
                    <label class="property-label">Polygon Sides</label>
                    <input type="range" min="3" max="12" value="${activeObj.polygonSides || 6}"
                           oninput="updatePolygonSides(parseInt(this.value)); this.nextElementSibling.textContent = this.value">
                    <span>${activeObj.polygonSides || 6}</span>
                </div>

                <div class="property-group">
                    <label class="property-label">Polygon Radius</label>
                    <input type="range" min="20" max="200" value="${activeObj.polygonRadius || 75}"
                           oninput="updatePolygonRadius(parseInt(this.value)); this.nextElementSibling.textContent = this.value + 'px'">
                    <span>${activeObj.polygonRadius || 75}px</span>
                </div>
            `;
        }

        html += `
            <div class="property-group">
                <label class="property-label">Shadow</label>
                <button class="btn" onclick="toggleShadow()" style="width: 100%">
                    ${activeObj.shadow ? 'Remove Shadow' : 'Add Shadow'}
                </button>
            </div>

            ${activeObj.shadow ? `
                <div class="property-group">
                    <label class="property-label">Shadow Blur</label>
                    <input type="range" min="0" max="100" value="${activeObj.shadow.blur || 0}"
                           oninput="updateShadowProperty('blur', parseInt(this.value)); this.nextElementSibling.textContent = this.value + 'px'">
                    <span>${activeObj.shadow.blur || 0}px</span>
                </div>

                <div class="property-group">
                    <label class="property-label">Shadow Offset X</label>
                    <input type="range" min="-50" max="50" value="${activeObj.shadow.offsetX || 0}"
                           oninput="updateShadowProperty('offsetX', parseInt(this.value)); this.nextElementSibling.textContent = this.value + 'px'">
                    <span>${activeObj.shadow.offsetX || 0}px</span>
                </div>

                <div class="property-group">
                    <label class="property-label">Shadow Offset Y</label>
                    <input type="range" min="-50" max="50" value="${activeObj.shadow.offsetY || 0}"
                           oninput="updateShadowProperty('offsetY', parseInt(this.value)); this.nextElementSibling.textContent = this.value + 'px'">
                    <span>${activeObj.shadow.offsetY || 0}px</span>
                </div>

                <div class="property-group">
                    <label class="property-label">Shadow Color</label>
                    <div class="color-input-group">
                        <input type="color" value="${(activeObj.shadow.color || 'rgba(0,0,0,0.5)').replace(/rgba?\((\d+),\s*(\d+),\s*(\d+).*\)/, (m, r, g, b) => '#' + [r, g, b].map(x => parseInt(x).toString(16).padStart(2, '0')).join(''))}"
                               oninput="updateShadowProperty('color', this.value)">
                    </div>
                </div>
            ` : ''}


        `;
    }

    // Line and Path properties
    if (activeObj.type === 'line' || activeObj.type === 'polyline') {
        html += `
            <div class="property-group">
                <label class="property-label">Stroke Width</label>
                <input type="range" min="1" max="20" value="${activeObj.strokeWidth || 3}"
                       oninput="updateObjectProperty('strokeWidth', parseInt(this.value)); this.nextElementSibling.textContent = this.value + 'px'">
                <span>${activeObj.strokeWidth || 3}px</span>
            </div>

            <div class="property-group">
                <label class="property-label">Stroke Color</label>
                <div class="color-input-group">
                    <input type="color" value="${activeObj.stroke || '#000000'}"
                           oninput="updateObjectProperty('stroke', this.value)">
                </div>
            </div>

            <div class="property-group">
                <label class="property-label">Shadow</label>
                <button class="btn" onclick="toggleShadow()" style="width: 100%">
                    ${activeObj.shadow ? 'Remove Shadow' : 'Add Shadow'}
                </button>
            </div>

            ${activeObj.shadow ? `
                <div class="property-group">
                    <label class="property-label">Shadow Blur</label>
                    <input type="range" min="0" max="100" value="${activeObj.shadow.blur || 0}"
                           oninput="updateShadowProperty('blur', parseInt(this.value)); this.nextElementSibling.textContent = this.value + 'px'">
                    <span>${activeObj.shadow.blur || 0}px</span>
                </div>

                <div class="property-group">
                    <label class="property-label">Shadow Offset X</label>
                    <input type="range" min="-50" max="50" value="${activeObj.shadow.offsetX || 0}"
                           oninput="updateShadowProperty('offsetX', parseInt(this.value)); this.nextElementSibling.textContent = this.value + 'px'">
                    <span>${activeObj.shadow.offsetX || 0}px</span>
                </div>

                <div class="property-group">
                    <label class="property-label">Shadow Offset Y</label>
                    <input type="range" min="-50" max="50" value="${activeObj.shadow.offsetY || 0}"
                           oninput="updateShadowProperty('offsetY', parseInt(this.value)); this.nextElementSibling.textContent = this.value + 'px'">
                    <span>${activeObj.shadow.offsetY || 0}px</span>
                </div>

                <div class="property-group">
                    <label class="property-label">Shadow Color</label>
                    <div class="color-input-group">
                        <input type="color" value="${(activeObj.shadow.color || 'rgba(0,0,0,0.5)').replace(/rgba?\((\d+),\s*(\d+),\s*(\d+).*\)/, (m, r, g, b) => '#' + [r, g, b].map(x => parseInt(x).toString(16).padStart(2, '0')).join(''))}"
                               oninput="updateShadowProperty('color', this.value)">
                    </div>
                </div>
            ` : ''}


        `;
    }

    // Image properties
    if (activeObj.type === 'image') {
        // For images, stroke is stored in custom properties and applied to clipPath
        const imgStrokeWidth = activeObj.imgStrokeWidth !== undefined ? activeObj.imgStrokeWidth : (activeObj.strokeWidth || 0);
        const imgStroke = activeObj.imgStroke || activeObj.stroke || '#000000';

        html += `
            <div class="property-group">
                <label class="property-label">Corner Radius</label>
                <input type="range" min="0" max="100" value="${activeObj.cornerRadius || 0}"
                       oninput="updateImageCorners(parseInt(this.value)); this.nextElementSibling.textContent = this.value + 'px'">
                <span>${activeObj.cornerRadius || 0}px</span>
            </div>

            <div class="property-group">
                <label class="property-label">Stroke Width</label>
                <input type="range" min="0" max="20" value="${imgStrokeWidth}"
                       oninput="updateImageStroke('strokeWidth', parseInt(this.value)); this.nextElementSibling.textContent = this.value + 'px'">
                <span>${imgStrokeWidth}px</span>
            </div>

            <div class="property-group">
                <label class="property-label">Stroke Color</label>
                <div class="color-input-group">
                    <input type="color" value="${imgStroke}"
                           oninput="updateImageStroke('stroke', this.value)">
                </div>
            </div>

            <div class="property-group">
                <label class="property-label">Shadow</label>
                <button class="btn" onclick="toggleShadow()" style="width: 100%">
                    ${activeObj.shadow ? 'Remove Shadow' : 'Add Shadow'}
                </button>
            </div>

            ${activeObj.shadow ? `
                <div class="property-group">
                    <label class="property-label">Shadow Blur</label>
                    <input type="range" min="0" max="100" value="${activeObj.shadow.blur || 0}"
                           oninput="updateShadowProperty('blur', parseInt(this.value)); this.nextElementSibling.textContent = this.value + 'px'">
                    <span>${activeObj.shadow.blur || 0}px</span>
                </div>

                <div class="property-group">
                    <label class="property-label">Shadow Offset X</label>
                    <input type="range" min="-50" max="50" value="${activeObj.shadow.offsetX || 0}"
                           oninput="updateShadowProperty('offsetX', parseInt(this.value)); this.nextElementSibling.textContent = this.value + 'px'">
                    <span>${activeObj.shadow.offsetX || 0}px</span>
                </div>

                <div class="property-group">
                    <label class="property-label">Shadow Offset Y</label>
                    <input type="range" min="-50" max="50" value="${activeObj.shadow.offsetY || 0}"
                           oninput="updateShadowProperty('offsetY', parseInt(this.value)); this.nextElementSibling.textContent = this.value + 'px'">
                    <span>${activeObj.shadow.offsetY || 0}px</span>
                </div>

                <div class="property-group">
                    <label class="property-label">Shadow Color</label>
                    <div class="color-input-group">
                        <input type="color" value="${(activeObj.shadow.color || 'rgba(0,0,0,0.5)').replace(/rgba?\((\d+),\s*(\d+),\s*(\d+).*\)/, (m, r, g, b) => '#' + [r, g, b].map(x => parseInt(x).toString(16).padStart(2, '0')).join(''))}"
                               oninput="updateShadowProperty('color', this.value)">
                    </div>
                </div>
            ` : ''}


        `;
    }

    panel.innerHTML = html;
}

function clearPropertiesPanel() {
    document.getElementById('propertiesPanel').innerHTML = '<p class="empty-state">Select a layer to edit properties</p>';
}

function updateObjectProperty(property, value) {
    const activeObj = canvas.getActiveObject();
    if (!activeObj) return;

    // Special handling for Font Family to ensure proper loading and measurement
    if (property === 'fontFamily') {
        const fontWeight = activeObj.fontWeight || 'normal';
        const fontStyle = activeObj.fontStyle || 'normal';
        const fontString = `${fontStyle} ${fontWeight} 12px "${value}"`;

        // Try to load the font first to ensure correct measurement
        document.fonts.load(fontString).then(() => {
            activeObj.set(property, value);
            if (activeObj.initDimensions) {
                activeObj.initDimensions();
            }
            activeObj.setCoords();
            activeObj.dirty = true;
            canvas.requestRenderAll();
            saveState();
        }).catch(() => {
            // Fallback if loading check fails
            activeObj.set(property, value);
            if (activeObj.initDimensions) {
                activeObj.initDimensions();
            }
            activeObj.setCoords();
            activeObj.dirty = true;
            canvas.requestRenderAll();
            saveState();
        });
        return; // Async handling took over
    }

    activeObj.set(property, value);

    // If it's a Text object and we changed properties that affect dimensions, recalculate
    if ((activeObj.type === 'image' || activeObj.type === 'text' || activeObj.type === 'i-text') &&
        (property === 'fontSize' || property === 'fontWeight' || property === 'fontStyle' || property === 'text')) {

        // If we changed weight or style, we might need to wait for THAT variant to load too
        if (property === 'fontWeight' || property === 'fontStyle') {
            const fontFamily = activeObj.fontFamily;
            const fontWeight = property === 'fontWeight' ? value : (activeObj.fontWeight || 'normal');
            const fontStyle = property === 'fontStyle' ? value : (activeObj.fontStyle || 'normal');
            const fontString = `${fontStyle} ${fontWeight} 12px "${fontFamily}"`;

            document.fonts.load(fontString).then(() => {
                if (activeObj.initDimensions) activeObj.initDimensions();
                activeObj.setCoords();
                canvas.requestRenderAll();
            });
        } else {
            if (activeObj.initDimensions) activeObj.initDimensions();
            activeObj.setCoords();
        }
    }

    activeObj.dirty = true;
    canvas.renderAll();
    saveState();
}

function toggleFontWeight() {
    const activeObj = canvas.getActiveObject();
    if (!activeObj || (activeObj.type !== 'i-text' && activeObj.type !== 'text')) return;

    const newWeight = activeObj.fontWeight === 'bold' ? 'normal' : 'bold';
    // Use updateObjectProperty to handle the font loading/dimension recalculation logic
    updateObjectProperty('fontWeight', newWeight);
    updatePropertiesPanel();
}

function toggleFontStyle() {
    const activeObj = canvas.getActiveObject();
    if (!activeObj || (activeObj.type !== 'i-text' && activeObj.type !== 'text')) return;

    const newStyle = activeObj.fontStyle === 'italic' ? 'normal' : 'italic';
    // Use updateObjectProperty to handle the font loading/dimension recalculation logic
    updateObjectProperty('fontStyle', newStyle);
    updatePropertiesPanel();
}

function updateRectCorners(radius) {
    const activeObj = canvas.getActiveObject();
    if (!activeObj || activeObj.type !== 'rect') return;

    activeObj.set({
        rx: radius / (activeObj.scaleX || 1),
        ry: radius / (activeObj.scaleY || 1),
        uniformRadius: radius
    });
    canvas.renderAll();
    saveState();
}

function updateImageCorners(radius) {
    const activeObj = canvas.getActiveObject();
    if (!activeObj || activeObj.type !== 'image') return;

    activeObj.set({ cornerRadius: radius });
    applyImageCornerRadius(activeObj);
    canvas.renderAll();
    saveState();
}

function updateImageStroke(property, value) {
    const activeObj = canvas.getActiveObject();
    if (!activeObj || activeObj.type !== 'image') return;

    if (property === 'strokeWidth') {
        activeObj.imgStrokeWidth = value;
    } else if (property === 'stroke') {
        activeObj.imgStroke = value;
    }

    applyImageCornerRadius(activeObj);
    canvas.renderAll();
    saveState();
}

// Update Blur
function updateBlur(value) {
    const activeObj = canvas.getActiveObject();
    if (!activeObj || activeObj.isBackground) return;

    applyBlur(activeObj, value);
    saveState();
}

function applyBlur(obj, blurValue) {
    if (!obj) return;

    // Simply store the blur amount on the object
    // The actual blur is applied via ctx.filter in the overridden _render method
    obj.blurAmount = blurValue;

    // DISABLE object caching when blur is active so ctx.filter applies correctly
    // If we rely on cache, the filter is applied to the cached image which might be clipped
    // or not updated frequently enough.

    // Check if we have a corner radius (which requires caching disabled too)
    const hasCornerRadius = (obj.type === 'image' && obj.cornerRadius && obj.cornerRadius > 0);

    if (blurValue > 0 || hasCornerRadius) {
        obj.objectCaching = false;
    } else {
        // Only re-enable caching if no blur AND no corner radius
        obj.objectCaching = true; // Was originally just (blurValue === 0)
    }

    // Force re-render to apply the new blur
    obj.dirty = true;
    canvas.renderAll();
}



function updateBlur(value) {
    const activeObj = canvas.getActiveObject();
    if (!activeObj || activeObj.isBackground) return;

    applyBlur(activeObj, value);
    saveState();
}

function updatePolygonDimensions(obj, newPoints) {
    // Calculate bounding box of the new points
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    newPoints.forEach(p => {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
    });

    const width = maxX - minX;
    const height = maxY - minY;

    // Offset points to be relative to top-left corner
    const offsetPoints = newPoints.map(p => ({
        x: p.x - minX,
        y: p.y - minY
    }));

    // Update the object with new points and dimensions
    obj.set({
        points: offsetPoints,
        width: width,
        height: height,
        pathOffset: {
            x: width / 2,
            y: height / 2
        }
    });

    // Recalculate coordinates
    obj.setCoords();
}

function updateStarPoints(spikes) {
    const activeObj = canvas.getActiveObject();
    if (!activeObj || activeObj.shapeType !== 'star') return;

    const outerRadius = activeObj.outerRadius || 75;
    const innerRadius = activeObj.innerRadius || 35;
    const points = generateStarPoints(spikes, outerRadius, innerRadius);

    updatePolygonDimensions(activeObj, points);
    activeObj.set({ starSpikes: spikes });

    canvas.renderAll();
    updatePropertiesPanel();
    saveState();
}

function updateStarOuterRadius(radius) {
    const activeObj = canvas.getActiveObject();
    if (!activeObj || activeObj.shapeType !== 'star') return;

    const spikes = activeObj.starSpikes || 5;
    const innerRadius = activeObj.innerRadius || 35;
    const points = generateStarPoints(spikes, radius, innerRadius);

    updatePolygonDimensions(activeObj, points);
    activeObj.set({ outerRadius: radius });

    canvas.renderAll();
    saveState();
}

function updateStarInnerRadius(radius) {
    const activeObj = canvas.getActiveObject();
    if (!activeObj || activeObj.shapeType !== 'star') return;

    const spikes = activeObj.starSpikes || 5;
    const outerRadius = activeObj.outerRadius || 75;
    const points = generateStarPoints(spikes, outerRadius, radius);

    updatePolygonDimensions(activeObj, points);
    activeObj.set({ innerRadius: radius });

    canvas.renderAll();
    saveState();
}

function updatePolygonSides(sides) {
    const activeObj = canvas.getActiveObject();
    if (!activeObj || activeObj.shapeType !== 'polygon') return;

    const radius = activeObj.polygonRadius || 75;
    const points = generatePolygonPoints(sides, radius);

    updatePolygonDimensions(activeObj, points);
    activeObj.set({ polygonSides: sides });

    canvas.renderAll();
    updatePropertiesPanel();
    saveState();
}

function updatePolygonRadius(radius) {
    const activeObj = canvas.getActiveObject();
    if (!activeObj || activeObj.shapeType !== 'polygon') return;

    const sides = activeObj.polygonSides || 6;
    const points = generatePolygonPoints(sides, radius);

    updatePolygonDimensions(activeObj, points);
    activeObj.set({ polygonRadius: radius });


    canvas.renderAll();
    saveState();
}

function toggleShadow() {
    const activeObj = canvas.getActiveObject();
    if (!activeObj) return;

    if (activeObj.shadow) {
        // Remove shadow
        activeObj.shadow = null;
    } else {
        // Add shadow
        activeObj.shadow = new fabric.Shadow({
            color: 'rgba(0,0,0,0.5)',
            blur: 10,
            offsetX: 4,
            offsetY: 4
        });
    }

    canvas.renderAll();
    updatePropertiesPanel();
    saveState();
}

function updateShadowProperty(property, value) {
    const activeObj = canvas.getActiveObject();
    if (!activeObj || !activeObj.shadow) return;

    activeObj.shadow[property] = value;
    canvas.renderAll();
    saveState();
}






// History Management
function saveState() {
    const json = JSON.stringify(canvas.toJSON());

    if (historyStep < history.length - 1) {
        history = history.slice(0, historyStep + 1);
    }

    history.push(json);

    if (history.length > MAX_HISTORY) {
        history.shift();
    } else {
        historyStep++;
    }

    // Trigger auto-save
    autoSave();
}

function undo() {
    if (historyStep > 0) {
        historyStep--;
        loadState(history[historyStep]);
    }
}

function redo() {
    if (historyStep < history.length - 1) {
        historyStep++;
        loadState(history[historyStep]);
    }
}

function loadState(state) {
    canvas.loadFromJSON(state, () => {
        // Remove any old background objects (from old states)
        const objects = canvas.getObjects();
        const oldBgObjects = objects.filter(obj => obj.isBackground);
        oldBgObjects.forEach(obj => canvas.remove(obj));

        // Restore image corner radius clipPaths
        objects.forEach(obj => {
            if (obj.type === 'image' && obj.cornerRadius > 0) {
                applyImageCornerRadius(obj);
            }
        });

        canvas.renderAll();
        updateLayersList();
        clearPropertiesPanel();
    });
}

// Layer Actions
function deleteLayer() {
    const activeObj = canvas.getActiveObject();
    if (activeObj) {
        canvas.remove(activeObj);
        canvas.renderAll();
        saveState();
    }
}

function duplicateLayer() {
    const activeObj = canvas.getActiveObject();
    if (!activeObj) return;

    const customProps = ['name', 'starSpikes', 'outerRadius', 'innerRadius', 'polygonSides', 'polygonRadius', 'shapeType', 'uniformRadius', 'cornerRadius', 'imgStrokeWidth', 'imgStroke', 'blurAmount'];

    activeObj.clone((cloned) => {
        cloned.set({
            left: cloned.left + 20,
            top: cloned.top + 20
        });

        canvas.add(cloned);

        // Restore effects on the cloned object
        if (cloned.type === 'image' && cloned.cornerRadius > 0) {
            applyImageCornerRadius(cloned);
        }

        if (cloned.blurAmount > 0) {
            applyBlur(cloned, cloned.blurAmount);
        }



        canvas.setActiveObject(cloned);
        canvas.renderAll();
    }, customProps);
}

function bringToFront() {
    const activeObj = canvas.getActiveObject();
    if (!activeObj || activeObj.isBackground) return;

    canvas.bringToFront(activeObj);
    canvas.renderAll();
    updateLayersList();
    saveState();
}

function sendToBack() {
    const activeObj = canvas.getActiveObject();
    if (!activeObj || activeObj.isBackground) return;

    // Send to back
    canvas.sendToBack(activeObj);

    canvas.renderAll();
    updateLayersList();
    saveState();
}

// Export Functions
function exportCanvas(format = 'png') {
    const dataURL = canvas.toDataURL({
        format: format,
        quality: 1,
        multiplier: 1
    });

    const link = document.createElement('a');
    link.download = `thumbforge-${Date.now()}.${format}`;
    link.href = dataURL;
    link.click();
}

// Clear Canvas
function clearCanvas() {
    if (confirm('Are you sure you want to clear the canvas?')) {
        // Remove all objects (no background object anymore)
        canvas.clear();
        canvas.setBackgroundColor(backgroundColor);
        canvas.renderAll();
        saveState();
    }
}

// New Project
function newProject() {
    if (confirm('Create a new project? Current work will be cleared.')) {
        const width = parseInt(document.getElementById('canvasWidth').value) || 1280;
        const height = parseInt(document.getElementById('canvasHeight').value) || 720;

        canvas.setDimensions({ width, height });

        // Remove all objects (no background object anymore)
        canvas.clear();
        canvas.setBackgroundColor(backgroundColor);

        // Background is now canvas.backgroundColor - no object to resize

        canvas.renderAll();
        history = [];
        historyStep = -1;

        // Clear auto-save and save new state
        clearAutoSave();
        saveState();
    }
}

// Canvas Size Change
function changeCanvasSize() {
    const sizeValue = document.getElementById('canvasSize').value;

    if (sizeValue === 'custom') {
        // Use custom dimensions from input fields
        return; // Don't update - let the input fields handle it
    }

    const [width, height] = sizeValue.split('x').map(v => parseInt(v));

    // Update input fields
    document.getElementById('canvasWidth').value = width;
    document.getElementById('canvasHeight').value = height;

    // Update canvas and background
    updateCanvasDimensions(width, height);
}

function updateCanvasDimensions(width, height) {
    canvas.setDimensions({ width, height });

    // Background is now canvas.backgroundColor - no object to resize

    canvas.renderAll();
    saveState();
}

// Save and Load Project
function saveProject() {
    const projectData = {
        version: '1.0',
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        backgroundColor: backgroundColor,
        backgroundOpacity: backgroundOpacity,
        objects: canvas.toJSON(['name', 'starSpikes', 'outerRadius', 'innerRadius', 'polygonSides', 'polygonRadius', 'shapeType', 'uniformRadius', 'cornerRadius', 'imgStrokeWidth', 'imgStroke', 'blurAmount'])
    };

    const dataStr = JSON.stringify(projectData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `thumbforge-project-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
}

function loadProject() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const projectData = JSON.parse(event.target.result);

                // Update canvas dimensions
                document.getElementById('canvasWidth').value = projectData.canvasWidth;
                document.getElementById('canvasHeight').value = projectData.canvasHeight;
                document.getElementById('canvasSize').value = 'custom';

                canvas.setDimensions({
                    width: projectData.canvasWidth,
                    height: projectData.canvasHeight
                });

                // Clear current canvas
                canvas.clear();

                // Restore background color and opacity if saved
                if (projectData.backgroundColor) {
                    backgroundColor = projectData.backgroundColor;
                }
                if (projectData.backgroundOpacity !== undefined) {
                    backgroundOpacity = projectData.backgroundOpacity;
                }
                applyBackgroundColor();

                // Load objects
                canvas.loadFromJSON(projectData.objects, () => {
                    // Remove any old background objects (from old saves)
                    const objects = canvas.getObjects();
                    const oldBgObjects = objects.filter(obj => obj.isBackground);
                    oldBgObjects.forEach(obj => canvas.remove(obj));

                    // Restore image corner radius clipPaths
                    objects.forEach(obj => {
                        if (obj.type === 'image' && obj.cornerRadius > 0) {
                            applyImageCornerRadius(obj);
                        }
                        // Blur is now applied automatically via overridden _render method
                    });

                    canvas.renderAll();
                    updateLayersList();
                    clearPropertiesPanel();

                    // Reset history and update auto-save
                    history = [];
                    historyStep = -1;
                    clearAutoSave();
                    saveState();
                });

            } catch (error) {
                alert('Error loading project: ' + error.message);
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

// Keyboard Shortcuts
document.addEventListener('keydown', (e) => {
    // Safety check: Don't trigger if user is typing in an input, textarea, or contentEditable
    const target = e.target;
    if (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable) {
        return;
    }

    const activeObj = canvas.getActiveObject();

    // Don't trigger shortcuts if editing text
    if (activeObj && (activeObj.type === 'i-text' || activeObj.type === 'text') && activeObj.isEditing) {
        return;
    }

    // Backspace / Delete = Delete Layer
    if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        deleteLayer();
    }

    // Enter or Escape = Finish path
    if ((e.key === 'Enter' || e.key === 'Escape') && isDrawingPath) {
        e.preventDefault();
        finishPath();
        return;
    }

    // Ctrl/Cmd + Z = Undo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
    }

    // Ctrl/Cmd + Shift + Z = Redo
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        redo();
    }

    // Ctrl/Cmd + D = Duplicate
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        duplicateLayer();
    }

    // Ctrl/Cmd + ] = Bring to Front
    if ((e.ctrlKey || e.metaKey) && e.key === ']') {
        e.preventDefault();
        bringToFront();
    }

    // Ctrl/Cmd + [ = Send to Back
    if ((e.ctrlKey || e.metaKey) && e.key === '[') {
        e.preventDefault();
        sendToBack();
    }

    // Tool shortcuts (only if not editing text)
    if (!activeObj || !activeObj.isEditing) {
        if (e.key === 'v') setTool('select');
        if (e.key === 'm') setTool('move');
        if (e.key === 't') setTool('text');
        if (e.key === 's') {
            e.preventDefault();
            document.querySelector('[data-tool="shapes"]').click();
        }
        if (e.key === 'l') setTool('line');
    }
});

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    try {
        initCanvas();
    } catch (error) {
        console.error('Error initializing canvas:', error);
        alert('Error initializing canvas. Check console for details.');
    }

    // Tool buttons
    document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
        btn.addEventListener('click', () => {
            setTool(btn.dataset.tool);
        });
    });

    // Shape dropdown
    document.querySelectorAll('[data-shape]').forEach(btn => {
        btn.addEventListener('click', () => {
            const shape = btn.dataset.shape;
            if (shape === 'rectangle') addRectangle();
            else if (shape === 'circle') addCircle();
            else if (shape === 'triangle') addTriangle();
            else if (shape === 'star') addStar();
            else if (shape === 'polygon') addPolygon();
            setTool('select');
        });
    });

    // Image upload
    document.getElementById('imageUpload').addEventListener('change', handleImageUpload);

    // Top toolbar buttons
    document.getElementById('undo').addEventListener('click', undo);
    document.getElementById('redo').addEventListener('click', redo);
    document.getElementById('newProject').addEventListener('click', newProject);
    document.getElementById('clearCanvas').addEventListener('click', clearCanvas);
    document.getElementById('saveProject').addEventListener('click', saveProject);
    document.getElementById('loadProject').addEventListener('click', loadProject);
    document.getElementById('export').addEventListener('click', () => exportCanvas('png'));
    document.getElementById('exportJPG').addEventListener('click', () => exportCanvas('jpeg'));
    document.getElementById('canvasSize').addEventListener('change', changeCanvasSize);

    // Canvas dimension inputs
    document.getElementById('canvasWidth').addEventListener('change', (e) => {
        const width = parseInt(e.target.value) || 1280;
        const height = parseInt(document.getElementById('canvasHeight').value) || 720;
        document.getElementById('canvasSize').value = 'custom';
        updateCanvasDimensions(width, height);
    });

    document.getElementById('canvasHeight').addEventListener('change', (e) => {
        const width = parseInt(document.getElementById('canvasWidth').value) || 1280;
        const height = parseInt(e.target.value) || 720;
        document.getElementById('canvasSize').value = 'custom';
        updateCanvasDimensions(width, height);
    });

    // Layer actions
    document.getElementById('deleteLayer').addEventListener('click', deleteLayer);
    document.getElementById('duplicateLayer').addEventListener('click', duplicateLayer);
    document.getElementById('bringToFront').addEventListener('click', bringToFront);
    document.getElementById('sendToBack').addEventListener('click', sendToBack);

    // Paste image from clipboard
    document.addEventListener('paste', (e) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                const reader = new FileReader();
                reader.onload = (event) => {
                    fabric.Image.fromURL(event.target.result, (img) => {
                        const scale = Math.min(
                            canvas.width / 2 / img.width,
                            canvas.height / 2 / img.height
                        );

                        img.scale(scale);
                        img.set({
                            left: canvas.width / 2,
                            top: canvas.height / 2,
                            originX: 'center',
                            originY: 'center',
                            cornerRadius: 0,
                            imgStrokeWidth: 0,
                            imgStroke: '#000000',
                            strokeWidth: 0,
                            strokeUniform: true,
                            blurAmount: 0,
                            objectCaching: true
                        });

                        canvas.add(img);
                        applyImageCornerRadius(img);
                        canvas.setActiveObject(img);
                        canvas.renderAll();
                    });
                };
                reader.readAsDataURL(blob);
            }
        }
    });

    // Save immediately before page unload (refresh, close, navigate away)
    window.addEventListener('beforeunload', (e) => {
        saveImmediately();
    });
});
