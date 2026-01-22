import { state } from './state.js';
import { saveState } from './project.js';
import { updateLayersList } from './interface.js';

export function performBooleanOperation(operation) {
    const activeObjects = state.canvas.getActiveObjects();

    if (activeObjects.length < 2) {
        console.warn('Need at least 2 objects for boolean operation');
        return;
    }

    const validTypes = ['rect', 'circle', 'triangle', 'polygon', 'path', 'line', 'polyline', 'i-text', 'text'];
    const invalidObj = activeObjects.find(obj => !validTypes.includes(obj.type) && obj.type !== 'image');

    if (invalidObj) {
        alert('Boolean operations only work on vector shapes and text.');
        return;
    }

    // Fix: Discard the active group to restore objects to their absolute coordinates
    // This prevents relative-to-group coordinates from messing up the paper.js import
    state.canvas.discardActiveObject();

    // Force update of coordinates for all objects involved
    activeObjects.forEach(obj => obj.setCoords());

    try {
        // Setup Paper.js project
        if (!paper.project) {
            // Use state.canvas dimensions
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = state.canvas.width;
            tempCanvas.height = state.canvas.height;
            paper.setup(tempCanvas);
        } else {
            paper.project.clear();
        }

        const paperItems = [];

        // Convert to Paper items via SVG
        // We use activeObjects here which are now ungrouped but we still have the reference
        activeObjects.forEach(obj => {
            const item = fabricToPaper(obj);
            if (item) {
                paperItems.push(item);
            }
        });

        if (paperItems.length < 2) {
            throw new Error('Could not convert selected objects to valid Paper.js paths.');
        }

        let resultPath = paperItems[0];

        // Unite children if the first item returned a Group (e.g. from Text)
        if (resultPath instanceof paper.Group) {
            let union = resultPath.children[0];
            for (let k = 1; k < resultPath.children.length; k++) {
                union = union.unite(resultPath.children[k]);
            }
            resultPath = union;
        }

        for (let i = 1; i < paperItems.length; i++) {
            let nextPath = paperItems[i];

            // Flatten next operand if group
            if (nextPath instanceof paper.Group) {
                let union = nextPath.children[0];
                for (let k = 1; k < nextPath.children.length; k++) {
                    union = union.unite(nextPath.children[k]);
                }
                nextPath = union;
            }

            // Ensure we are working with path items
            if (resultPath instanceof paper.Shape) resultPath = resultPath.toPath();
            if (nextPath instanceof paper.Shape) nextPath = nextPath.toPath();

            if (operation === 'union') {
                resultPath = resultPath.unite(nextPath);
            } else if (operation === 'intersect') {
                resultPath = resultPath.intersect(nextPath);
            } else if (operation === 'exclude') {
                resultPath = resultPath.subtract(nextPath);
            }
        }

        if (!resultPath || !resultPath.getPathData) {
            throw new Error('Result was null or invalid.');
        }

        const pathData = resultPath.getPathData();
        const sourceObj = activeObjects[activeObjects.length - 1];

        // Fix: Use the bounds from paper.js to set the correct position
        const bounds = resultPath.bounds;

        const newPath = new fabric.Path(pathData, {
            left: bounds.x,
            top: bounds.y,
            fill: sourceObj.fill || '#cccccc',
            stroke: sourceObj.stroke || '#000000',
            strokeWidth: sourceObj.strokeWidth || 0,
            strokeUniform: true,
            scaleX: 1,
            scaleY: 1,
            opacity: sourceObj.opacity || 1,
            objectCaching: true,
            shapeType: 'path'
        });

        // Cleanup
        // Note: objects are already discarded from active selection
        state.canvas.remove(...activeObjects);
        state.canvas.add(newPath);
        state.canvas.setActiveObject(newPath);
        state.canvas.requestRenderAll();

        saveState();
        updateLayersList();

        paper.project.clear();

    } catch (e) {
        console.error('Boolean operation failed:', e);
        alert('Boolean operation failed: ' + e.message);
    }
}

// Helper: Convert Fabric Object to Paper Item via SVG
function fabricToPaper(obj) {
    // 1. Export individual object to SVG
    // This handles all transforms (rotate, scale, skew) correctly via Fabric
    const svg = obj.toSVG();

    // 2. Import into Paper
    let item = paper.project.importSVG(svg);

    // 3. Normalize
    if (item) {
        // If it's a primitive Shape (rect/circle from SVG), convert to Path
        if (item instanceof paper.Shape) {
            item = item.toPath();
        }

        // If it's a Group (e.g. from Text), we return it as is, 
        // the main loop handles flattening groups.
        return item;
    }
    return null;
}
