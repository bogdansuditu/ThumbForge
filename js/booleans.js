import { state } from './state.js';
import { saveState } from './project.js';
import { updateLayersList } from './interface.js';

// Boolean Operations Implementation
// Updated to support Text and Custom Paths with absolute positioning

export async function performBooleanOperation(operation) {
    const activeObjects = state.canvas.getActiveObjects();

    if (activeObjects.length < 2) {
        console.warn('Need at least 2 objects for boolean operation');
        return;
    }

    const validTypes = ['rect', 'circle', 'triangle', 'polygon', 'path', 'line', 'polyline', 'i-text', 'text'];
    const invalidObj = activeObjects.find(obj => !validTypes.includes(obj.type) && obj.type !== 'ignore-image');

    // Capture references
    const objectsToProcess = [...activeObjects];

    // Discard active group to restore objects to their absolute coordinates
    state.canvas.discardActiveObject();

    // Force update of coordinates for all objects involved
    objectsToProcess.forEach(obj => obj.setCoords());

    try {
        if (!paper.project) {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = state.canvas.width;
            tempCanvas.height = state.canvas.height;
            paper.setup(tempCanvas);
        } else {
            paper.project.clear();
        }

        const paperItems = [];

        for (const obj of objectsToProcess) {
            let item;
            if (obj.type === 'i-text' || obj.type === 'text') {
                try {
                    item = await convertTextToPaperPath(obj);
                } catch (textErr) {
                    console.error("Text conversion failed", textErr);
                    throw new Error(`Text conversion failed: ${textErr.message || textErr}`);
                }
            } else {
                item = fabricToPaper(obj);
            }

            if (item) {
                paperItems.push(item);
            }
        }

        if (paperItems.length < 2) {
            throw new Error('Could not convert selected objects to valid Paper.js paths.');
        }

        let resultPath = paperItems[0];

        // Flatten logic
        if (resultPath instanceof paper.Group) {
            let union = resultPath.children[0];
            for (let k = 1; k < resultPath.children.length; k++) {
                if (resultPath.children[k])
                    union = union.unite(resultPath.children[k]);
            }
            resultPath = union;
        }

        for (let i = 1; i < paperItems.length; i++) {
            let nextPath = paperItems[i];

            if (nextPath instanceof paper.Group) {
                let union = nextPath.children[0];
                for (let k = 1; k < nextPath.children.length; k++) {
                    if (nextPath.children[k])
                        union = union.unite(nextPath.children[k]);
                }
                nextPath = union;
            }

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
        const sourceObj = objectsToProcess[objectsToProcess.length - 1];

        // Auto-positioning by Fabric from absolute path data
        const newPath = new fabric.Path(pathData, {
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
        state.canvas.remove(...objectsToProcess);
        state.canvas.add(newPath);
        state.canvas.setActiveObject(newPath);
        state.canvas.requestRenderAll();

        saveState();
        updateLayersList();

        paper.project.clear();

    } catch (e) {
        console.error('Boolean operation failed:', e);

        // GRACEFUL RECOVERY
        if (objectsToProcess.length > 0) {
            const sel = new fabric.ActiveSelection(objectsToProcess, {
                canvas: state.canvas
            });
            state.canvas.setActiveObject(sel);
            state.canvas.requestRenderAll();
        }

        alert('Boolean operation failed: ' + e.message);
    }
}

// Helper: Convert Fabric Object to Paper Item
function fabricToPaper(obj) {
    // Special handling for Paths (custom shapes, closed lines)
    if (obj.type === 'path' && obj.path) {
        // Reconstruct d string
        const d = obj.path.map(cmd => cmd.join(' ')).join(' ');

        // Create item from raw path
        const item = paper.project.importSVG(`<path d="${d}"/>`);

        if (item) {
            // Fix: Fabric paths are rendered by translating by -pathOffset first
            const offset = obj.pathOffset || { x: 0, y: 0 };
            item.translate(new paper.Point(-offset.x, -offset.y));

            // Apply the object's transform matrix (Local -> Canvas)
            const m = obj.calcTransformMatrix();
            const matrix = new paper.Matrix(m[0], m[2], m[1], m[3], m[4], m[5]);
            item.matrix = matrix;

            return item;
        }
    }

    // Default for other shapes (Rect, Circle, Polygon, etc.)
    const svg = obj.toSVG();
    let item = paper.project.importSVG(svg);
    if (item) {
        item.applyMatrix = true;
    }
    if (item) {
        if (item instanceof paper.Shape) {
            item = item.toPath();
        }
        return item;
    }
    return null;
}

async function convertTextToPaperPath(textObj) {
    if (!window.opentype) {
        throw new Error('Opentype.js not loaded. Cannot convert text.');
    }

    const fontFamily = textObj.fontFamily;
    const text = textObj.text;
    const fontSize = textObj.fontSize;

    // Enhanced URL construction
    const googleFontUrl = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/ /g, '+')}&display=swap`;

    console.log(`[BooleanOps] Fetching font CSS: ${googleFontUrl}`);

    try {
        const cssResponse = await fetch(googleFontUrl);
        if (!cssResponse.ok) throw new Error(`Failed to fetch CSS for ${fontFamily} (Status ${cssResponse.status})`);

        const cssText = await cssResponse.text();

        const urlMatch = cssText.match(/src:\s*url\(['"]?(.*?)['"]?\)/);
        if (!urlMatch) {
            console.error("[BooleanOps] CSS Content:", cssText);
            throw new Error(`Could not find font URL for ${fontFamily} in CSS`);
        }
        const fontUrl = urlMatch[1];
        console.log(`[BooleanOps] Found font URL: ${fontUrl}`);

        return new Promise((resolve, reject) => {
            opentype.load(fontUrl, function (err, font) {
                if (err) {
                    reject('Could not load font: ' + err);
                } else {
                    const path = font.getPath(text, 0, 0, fontSize);
                    const svgPathData = path.toPathData();
                    let paperItem = paper.project.importSVG(`<path d="${svgPathData}"/>`);

                    // Align geometric center (0,0) so it matches Fabric's local origin
                    const bounds = paperItem.bounds;
                    paperItem.position = new paper.Point(0, 0);

                    const m = textObj.calcTransformMatrix();
                    const matrix = new paper.Matrix(m[0], m[2], m[1], m[3], m[4], m[5]);

                    paperItem.matrix = matrix;

                    resolve(paperItem);
                }
            });
        });
    } catch (e) {
        console.error("Font loading error details:", e);
        throw new Error(`Failed to load font ${fontFamily}. Check console for details.`);
    }
}
