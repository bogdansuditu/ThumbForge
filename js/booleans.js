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
    const validTypes = ['rect', 'circle', 'triangle', 'polygon', 'path', 'line', 'polyline', 'i-text', 'text', 'textbox'];
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
            if (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox') {
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
        // Auto-positioning by Fabric from absolute path data
        const newPath = new fabric.Path(pathData, {
            fill: state.defaults.fill,
            stroke: state.defaults.stroke,
            strokeWidth: state.defaults.strokeWidth,
            strokeUniform: true,
            scaleX: 1,
            scaleY: 1,
            opacity: 1, // Reset opacity or use default? Usually 1 for new clean shapes
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

export async function convertSelectedTextToPath() {
    const activeObj = state.canvas.getActiveObject();

    if (!activeObj || (activeObj.type !== 'i-text' && activeObj.type !== 'text' && activeObj.type !== 'textbox')) {
        return;
    }

    try {
        if (!paper.project) {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = state.canvas.width;
            tempCanvas.height = state.canvas.height;
            paper.setup(tempCanvas);
        } else {
            paper.project.clear();
        }

        const item = await convertTextToPaperPath(activeObj);

        if (!item) throw new Error("Failed to generate path from text");

        const pathData = item.getPathData();

        const newPath = new fabric.Path(pathData, {
            fill: activeObj.fill,
            stroke: activeObj.stroke,
            strokeWidth: activeObj.strokeWidth,
            strokeUniform: true,
            opacity: activeObj.opacity,
            scaleX: 1,
            scaleY: 1,
            objectCaching: true,
            shapeType: 'path',
            // Preserve shadow if any
            shadow: activeObj.shadow
        });

        // Remove text and add path
        const index = state.canvas.getObjects().indexOf(activeObj);
        state.canvas.remove(activeObj);
        state.canvas.insertAt(newPath, index);
        state.canvas.setActiveObject(newPath);

        state.canvas.requestRenderAll();
        saveState();
        updateLayersList();

        // Cleanup Paper
        paper.project.clear();

    } catch (e) {
        console.error("Convert to curves failed:", e);
        alert("Convert to curves failed: " + e.message);
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
        // Fallback Helper
        const loadFont = (pathToCheck, isFallback = false) => {
            opentype.load(pathToCheck, function (err, font) {
                if (err) {
                    console.warn(`[BooleanOps] Failed to load ${pathToCheck}`, err);

                    if (!isFallback) {
                        // TRY FALLBACK TO REGULAR
                        const fallbackPath = `fonts/${safeFamily}-Regular.ttf`;
                        console.log(`[BooleanOps] Attempting fallback to: ${fallbackPath}`);
                        loadFont(fallbackPath, true);
                    } else {
                        // Fallback also failed
                        reject(`Could not load local font file: ${filename} (or fallback). Please ensure it is present in the fonts directory.`);
                    }
                } else {
                    if (isFallback) {
                        console.log(`[BooleanOps] Successfully loaded fallback font: ${pathToCheck}`);
                    }

                    // Multi-line Handling
                    // Prioritize _textLines (Fabric internal) -> textLines -> split
                    // Note: Fabric 4/5 uses _textLines for wrapped lines
                    const lines = textObj._textLines || textObj.textLines || textObj.text.split('\n');
                    const lineHeight = textObj.lineHeight || 1.16;
                    const totalWidth = textObj.width;
                    const totalHeight = textObj.height;
                    const align = textObj.textAlign || 'left';

                    console.log(`[BooleanOps-Debug] Font: ${fontFamily}, Size: ${fontSize}, LH: ${lineHeight}, Ascender: ${font.ascender}, Units: ${font.unitsPerEm}`);
                    console.log(`[BooleanOps-Debug] Lines: ${lines.length}, Total H: ${totalHeight}`);

                    // Use CompoundPath instead of Group to support getPathData()
                    const scaleFactor = 1;

                    const compound = new paper.CompoundPath({
                        fillColor: 'black'
                    });

                    // Heuristic Ascent (approximate baseline from top)
                    // Fabric defaults: baseline is roughly fontSize * 0.9 depending on font.
                    // Accurate way: use font.ascender / font.unitsPerEm * fontSize.
                    const ascender = (font.ascender / font.unitsPerEm) * fontSize;
                    // const descender = (font.descender / font.unitsPerEm) * fontSize;

                    // Fabric's vertical text positioning is complex. 
                    // Simplification: Standard line height stepping.
                    // First line baseline ~ ascender.

                    for (let i = 0; i < lines.length; i++) {
                        let lineStr = lines[i];

                        if (typeof lineStr !== 'string') {
                            if (lineStr && typeof lineStr === 'object' && lineStr.text) {
                                lineStr = lineStr.text;
                            } else if (Array.isArray(lineStr)) {
                                lineStr = lineStr.join('');
                            } else {
                                lineStr = String(lineStr || '');
                            }
                        }

                        if (!lineStr.trim()) continue; // Skip empty lines

                        // Calculate Y
                        // Line 0 is at top. Baseline is roughly down by ascender.
                        // Actually, let's use simple spacing: i * (fontSize * lineHeight)
                        // + adjustment to sit correctly.
                        const y = (i * fontSize * lineHeight) + ascender;

                        // Calculate X (Alignment)
                        const lineWidth = font.getAdvanceWidth(lineStr, fontSize);
                        let x = 0;
                        if (align === 'center') {
                            x = (totalWidth - lineWidth) / 2;
                        } else if (align === 'right') {
                            x = totalWidth - lineWidth;
                        }
                        // Left is 0.

                        const path = font.getPath(lineStr, x, y, fontSize);
                        const svgPathData = path.toPathData();
                        const paperItem = paper.project.importSVG(`<path d="${svgPathData}"/>`);

                        // importSVG might return Group or Path/CompoundPath
                        if (paperItem) {
                            if (paperItem.children) {
                                // If it's a group, take its children (paths)
                                const items = [...paperItem.children];
                                items.forEach(child => compound.addChild(child));
                            } else {
                                compound.addChild(paperItem);
                            }
                            // Cleanup the container if it was a group or detached
                            paperItem.remove();
                        }
                    }

                    // FAUX STYLES (applied to the whole group)
                    if (isFallback && isItalic) {
                        compound.shear(new paper.Point(-0.25, 0));
                    }

                    // Faux Bold
                    if (isFallback && (weightVal >= 700 || fontWeight === 'bold')) {
                        const boldStrokeWidth = fontSize * 0.05;
                        const applyFauxBoldToItem = (itm) => {
                            // CompoundPath or Path
                            if (typeof itm.expand === 'function') {
                                itm.strokeColor = 'black';
                                itm.strokeWidth = boldStrokeWidth;
                                itm.strokeJoin = 'round';
                                itm.strokeCap = 'round';
                                const exp = itm.expand({ stroke: true, fill: true, insert: false });
                                return exp;
                            }
                            return itm;
                        };

                        // Expand the entire compound path
                        const expanded = applyFauxBoldToItem(compound);
                        // If expanded returns a Group (it might), we might be in trouble again with getPathData
                        // But Paper's expand usually returns a Path or CompoundPath if simple.
                        // If it returns a Group, we'd need to flatten it. 
                        // For now assuming CompoundPath behavior holds.
                    }

                    // TRANSFORM & PLACEMENT

                    // The Group constructed above is in "Local Box Coordinates" (Top-Left is 0,0).
                    // We need to move it so its geometrical center matches Fabric's object center (0,0 in local transform).
                    // No, Fabric's transform matrix assumes (0,0) is center of object.
                    // Our constructed box is 0..width, 0..height.
                    // So we translate by (-width/2, -height/2).

                    compound.translate(new paper.Point(-totalWidth / 2, -totalHeight / 2));

                    compound.applyMatrix = true;

                    const m = textObj.calcTransformMatrix();
                    const matrix = new paper.Matrix(m[0], m[1], m[2], m[3], m[4], m[5]);

                    compound.matrix = matrix;

                    resolve(compound);
                }
            });
        };

        // Start Load
        loadFont(fontPath, false);
    });
}
