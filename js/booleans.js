import { state } from './state.js';
import { saveState } from './project.js';
import { updateLayersList } from './interface.js';

// Boolean Operations Implementation
// Support for Text (LOCAL FONTS ONLY) and Custom Paths.

export async function performBooleanOperation(operation) {
    const activeObjects = state.canvas.getActiveObjects();

    if (activeObjects.length < 2) {
        console.warn('Need at least 2 objects for boolean operation');
        return;
    }

    // Allow text in valid types
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
    if (obj.type === 'path' && obj.path) {
        const d = obj.path.map(cmd => cmd.join(' ')).join(' ');
        const item = paper.project.importSVG(`<path d="${d}"/>`);
        if (item) {
            const offset = obj.pathOffset || { x: 0, y: 0 };
            item.translate(new paper.Point(-offset.x, -offset.y));
            const m = obj.calcTransformMatrix();
            // Correct order: a, b, c, d, tx, ty
            const matrix = new paper.Matrix(m[0], m[1], m[2], m[3], m[4], m[5]);
            item.matrix = matrix;
            return item;
        }
    }

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

// Helper: Load Local Font File
async function convertTextToPaperPath(textObj) {
    if (!window.opentype) {
        throw new Error('Opentype.js not loaded. Cannot convert text.');
    }

    const fontFamily = textObj.fontFamily;
    const text = textObj.text;
    const fontSize = textObj.fontSize;

    // Determine Weight/Style for Filename Construction
    const fontWeight = textObj.fontWeight || 'normal';
    const fontStyle = textObj.fontStyle || 'normal';

    let weightVal = 400;
    if (fontWeight === 'bold' || fontWeight === 700 || fontWeight === '700') weightVal = 700;
    else if (fontWeight === 'normal' || fontWeight === 400 || fontWeight === '400') weightVal = 400;
    else weightVal = parseInt(fontWeight);

    const isItalic = (fontStyle === 'italic');

    // MAPPING LOGIC (Must match Python Script)
    // Suffix Logic:
    // 700 + normal -> Bold
    // 700 + italic -> BoldItalic
    // 400 + italic -> Italic
    // 300 + normal -> Light
    // 300 + italic -> LightItalic
    // 900 -> Black/BlackItalic
    // 400 + normal -> Regular

    let suffix = 'Regular';

    if (weightVal === 700) {
        suffix = isItalic ? 'BoldItalic' : 'Bold';
    } else if (weightVal === 400) {
        suffix = isItalic ? 'Italic' : 'Regular';
    } else if (weightVal === 300) {
        suffix = isItalic ? 'LightItalic' : 'Light';
    } else if (weightVal === 900) {
        suffix = isItalic ? 'BlackItalic' : 'Black';
    } else {
        // Fallback or exact match if other weights exist
        suffix = `${weightVal}${isItalic ? 'Italic' : ''}`;
    }

    // Filename: Remove spaces from family
    const safeFamily = fontFamily.replace(/\s+/g, '');
    const filename = `${safeFamily}-${suffix}.ttf`;
    const fontPath = `fonts/${filename}`;

    console.log(`[BooleanOps] Loading local font: ${fontPath}`);

    return new Promise((resolve, reject) => {
        opentype.load(fontPath, function (err, font) {
            if (err) {
                console.error(`[BooleanOps] Failed to load ${fontPath}`, err);
                reject(`Could not load local font file: ${filename}. Please ensure it is present in the fonts directory.`);
            } else {
                const path = font.getPath(text, 0, 0, fontSize);
                const svgPathData = path.toPathData();
                let paperItem = paper.project.importSVG(`<path d="${svgPathData}"/>`);

                const bounds = paperItem.bounds;
                // Center the item at (0,0)
                paperItem.position = new paper.Point(0, 0);

                // CRITICAL FIX: Bake the centering translation into the path geometry
                // BEFORE applying the Fabric matrix.
                // If we don't do this, setting item.matrix later overwrites the translation,
                // and the rotation happens around the wrong point (likely top-left of standard coord system).
                paperItem.applyMatrix = true;

                const m = textObj.calcTransformMatrix();
                // Correct order: a, b, c, d, tx, ty
                // Previously m[2] and m[1] were swapped, causing inverted rotation
                const matrix = new paper.Matrix(m[0], m[1], m[2], m[3], m[4], m[5]);

                paperItem.matrix = matrix;

                resolve(paperItem);
            }
        });
    });
}
