import { state } from './state.js';
import { saveState } from './project.js';

let isEditing = false;
let currentControls = [];
let currentLines = []; // visual connection lines
let editingTarget = null;
let contextMenuHandlerAttached = false;

export function enterNodeEditingMode() {
    isEditing = true;
    state.canvas.selection = false;

    state.canvas.off('selection:created', handleSelection);
    state.canvas.off('selection:updated', handleSelection);
    state.canvas.off('selection:cleared', handleCleared);
    state.canvas.off('object:moving', updateControlsOnMove);

    state.canvas.on('selection:created', handleSelection);
    state.canvas.on('selection:updated', handleSelection);
    state.canvas.on('selection:cleared', handleCleared);
    state.canvas.on('object:moving', updateControlsOnMove);
    attachContextMenuBlocker();

    const active = state.canvas.getActiveObject();
    if (active) {
        processObject(active);
    }
}

export function exitNodeEditingMode() {
    isEditing = false;
    cleanupControls();
    detachContextMenuBlocker();

    if (state.canvas) {
        state.canvas.off('selection:created', handleSelection);
        state.canvas.off('selection:updated', handleSelection);
        state.canvas.off('selection:cleared', handleCleared);
        state.canvas.off('object:moving', updateControlsOnMove);
        state.canvas.requestRenderAll();
    }
}

function attachContextMenuBlocker() {
    if (contextMenuHandlerAttached || !state.canvas || !state.canvas.upperCanvasEl) return;
    state.canvas.upperCanvasEl.addEventListener('contextmenu', blockContextMenu);
    contextMenuHandlerAttached = true;
}

function detachContextMenuBlocker() {
    if (!contextMenuHandlerAttached || !state.canvas || !state.canvas.upperCanvasEl) return;
    state.canvas.upperCanvasEl.removeEventListener('contextmenu', blockContextMenu);
    contextMenuHandlerAttached = false;
}

function blockContextMenu(e) {
    if (!isEditing) return;
    e.preventDefault();
}

function handleSelection(e) {
    if (!isEditing) return;
    try {
        const selected = e.selected ? e.selected[0] : state.canvas.getActiveObject();
        processObject(selected);
    } catch (err) {
        console.error("Error in handleSelection:", err);
    }
}

function handleCleared() {
    if (!isEditing) return;
    cleanupControls();
}

function processObject(obj) {
    if (!obj || obj === editingTarget) return;
    if (obj.type === 'group' || obj.type === 'activeSelection') return;
    if (obj.name === 'control_point' || obj.name === 'handle_line') return;

    cleanupControls();

    if (obj.type === 'path') {
        setupForEditing(obj);
        return;
    }

    try {
        const newPath = createPathFromShape(obj);
        if (newPath) {
            replaceObject(obj, newPath);
        }
    } catch (err) {
        console.error("Conversion failed:", err);
    }
}

function createPathFromShape(obj) {
    let pathString = '';
    const w = obj.width;
    const h = obj.height;

    if (obj.type === 'rect') {
        const x = -w / 2;
        const y = -h / 2;
        pathString = `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} z`;
    }
    else if (obj.type === 'triangle') {
        pathString = `M 0 ${-h / 2} L ${w / 2} ${h / 2} L ${-w / 2} ${h / 2} z`;
    }
    else if (obj.type === 'polygon' || obj.type === 'polyline') {
        const points = obj.points;
        if (points && points.length) {
            pathString = 'M ' + points[0].x + ' ' + points[0].y;
            for (let i = 1; i < points.length; i++) {
                pathString += ' L ' + points[i].x + ' ' + points[i].y;
            }
            if (obj.type === 'polygon') pathString += ' z';
        }
    }
    else if (obj.type === 'circle') {
        // Basic Circle approximation with 4 Bezier curves
        // Kappa = 0.5522847498
        const k = 0.5522847498;
        const r = obj.width / 2;
        const x = -r; // center is 0,0 usually for path logic here we assumed centered
        const y = -r;
        // Or cleaner: M 0 -r C k*r -r, r -k*r, r 0 ...
        // Let's stick to M 0 -r ...
        // Top: (0, -r)
        // Right: (r, 0)
        // Bottom: (0, r)
        // Left: (-r, 0)

        pathString =
            `M 0 ${-r} ` +
            `C ${r * k} ${-r} ${r} ${-r * k} ${r} 0 ` +
            `C ${r} ${r * k} ${r * k} ${r} 0 ${r} ` +
            `C ${-r * k} ${r} ${-r} ${r * k} ${-r} 0 ` +
            `C ${-r} ${-r * k} ${-r * k} ${-r} 0 ${-r} z`;
    }
    // If not handled, return null
    if (pathString) {
        return new fabric.Path(pathString);
    }
    return null;
}

function replaceObject(original, newPath) {
    const options = original.toObject();
    delete options.type;
    delete options.path;

    newPath.set(options);
    newPath.set({
        left: original.left,
        top: original.top,
        scaleX: original.scaleX,
        scaleY: original.scaleY,
        angle: original.angle,
        skewX: original.skewX,
        skewY: original.skewY,
        originX: original.originX,
        originY: original.originY
    });

    state.canvas.remove(original);
    state.canvas.add(newPath);
    state.canvas.setActiveObject(newPath);

    setupForEditing(newPath);
    saveState();
}

function setupForEditing(pathObj) {
    editingTarget = pathObj;
    pathObj.hasControls = false;
    pathObj.objectCaching = false;

    createControls(pathObj);
    state.canvas.requestRenderAll();
}

function createControls(pathObj) {
    if (!pathObj.path) return;
    const matrix = pathObj.calcTransformMatrix();
    const offsetX = pathObj.pathOffset.x;
    const offsetY = pathObj.pathOffset.y;

    // Track previous anchor point (in Canvas Coords) for tangent lines
    // Initial M is always first
    let prevAnchor = null;
    let firstAnchor = null;

    pathObj.path.forEach((pointData, index) => {
        const cmd = pointData[0].toUpperCase();

        if (cmd === 'Z') {
            // Close path: connect last anchor to first anchor if needed? 
            // Usually Z doesn't have controls.
            if (firstAnchor) prevAnchor = firstAnchor;
            return;
        }

        // --- M (Move) or L (Line) ---
        // Format: [M, x, y] or [L, x, y]
        if (cmd === 'M' || cmd === 'L') {
            const x = pointData[1];
            const y = pointData[2];

            const p = transformCoord(x, y, matrix, offsetX, offsetY);

            if (!isDuplicateClosingAnchor(pathObj.path, index, cmd)) {
                createAnchor(p.x, p.y, index, 1, pathObj); // 1 = buffer index for x
            }

            prevAnchor = p;
            if (index === 0) firstAnchor = p;
        }

        // --- Q (Quadratic Bezier) ---
        // Format: [Q, x1, y1, x, y]
        else if (cmd === 'Q') {
            const x1 = pointData[1];
            const y1 = pointData[2];
            const x = pointData[3];
            const y = pointData[4];

            const p1 = transformCoord(x1, y1, matrix, offsetX, offsetY); // Handle
            const p = transformCoord(x, y, matrix, offsetX, offsetY);   // Anchor

            createLine(prevAnchor, p1);
            createLine(p1, p);

            createHandle(p1.x, p1.y, index, 1, pathObj);
            if (!isDuplicateClosingAnchor(pathObj.path, index, cmd)) {
                createAnchor(p.x, p.y, index, 3, pathObj);
            }

            prevAnchor = p;
        }

        // --- C (Cubic Bezier) ---
        // Format: [C, x1, y1, x2, y2, x, y]
        else if (cmd === 'C') {
            const x1 = pointData[1];
            const y1 = pointData[2];
            const x2 = pointData[3];
            const y2 = pointData[4];
            const x = pointData[5];
            const y = pointData[6];

            const p1 = transformCoord(x1, y1, matrix, offsetX, offsetY); // Handle 1 (Start)
            const p2 = transformCoord(x2, y2, matrix, offsetX, offsetY); // Handle 2 (End)
            const p = transformCoord(x, y, matrix, offsetX, offsetY);    // Anchor

            createLine(prevAnchor, p1);
            createLine(p2, p);

            createHandle(p1.x, p1.y, index, 1, pathObj);
            createHandle(p2.x, p2.y, index, 3, pathObj);
            if (!isDuplicateClosingAnchor(pathObj.path, index, cmd)) {
                createAnchor(p.x, p.y, index, 5, pathObj);
            }

            prevAnchor = p;
        }
    });

    // Order: Lines back, Handles top
    currentLines.forEach(l => l.sendToBack()); // Behind anchors
    currentControls.forEach(c => c.bringToFront());
}

function transformCoord(x, y, matrix, ox, oy) {
    return fabric.util.transformPoint({
        x: x - ox,
        y: y - oy
    }, matrix);
}

function createAnchor(x, y, index, offsetIndex, parent) {
    // Square anchor
    const c = new fabric.Rect({
        width: 10,
        height: 10,
        fill: '#ffffff',
        stroke: '#333333',
        strokeWidth: 1,
        left: x,
        top: y,
        originX: 'center',
        originY: 'center',
        hasControls: false,
        hasBorders: false,
        name: 'control_point',
        excludeFromExport: true,
        temp: true,
        isNodeEditorOverlay: true,
        data: { type: 'anchor', index: index, offset: offsetIndex, parent: parent }
    });
    c.on('moving', onControlMove);
    c.on('mouseup', onControlMouseUp);
    state.canvas.add(c);
    currentControls.push(c);
}

function createHandle(x, y, index, offsetIndex, parent) {
    // Round handle
    const c = new fabric.Circle({
        radius: 4,
        fill: '#ffffff',
        stroke: '#0066cc', // Blue stroke for handles
        strokeWidth: 1,
        left: x,
        top: y,
        originX: 'center',
        originY: 'center',
        hasControls: false,
        hasBorders: false,
        name: 'control_point',
        excludeFromExport: true,
        temp: true,
        isNodeEditorOverlay: true,
        data: { type: 'handle', index: index, offset: offsetIndex, parent: parent }
    });
    c.on('moving', onControlMove);
    c.on('mouseup', onControlMouseUp);
    state.canvas.add(c);
    currentControls.push(c);
}

function onControlMouseUp(e) {
    if (!isEditing || !e || !e.e || e.e.button !== 2) return;
    e.e.preventDefault();
    e.e.stopPropagation();

    const control = e.target;
    if (!control || !control.data || control.data.type !== 'anchor') return;
    toggleNodeType(control);
}

function createLine(p1, p2) {
    if (!p1 || !p2) return;
    const l = new fabric.Line([p1.x, p1.y, p2.x, p2.y], {
        stroke: '#888888',
        strokeWidth: 1,
        selectable: false,
        evented: false,
        name: 'handle_line',
        excludeFromExport: true,
        temp: true,
        isNodeEditorOverlay: true
    });
    state.canvas.add(l);
    currentLines.push(l);
}

function onControlMove(e) {
    const control = (e && e.transform && e.transform.target) ? e.transform.target : e.target;
    if (!control || !control.data) return;

    const path = control.data.parent;
    if (!path || !path.path) return;
    const idx = control.data.index;     // Command index
    const offset = control.data.offset; // x-coord index in command

    if (!path.path[idx]) return;

    const matrix = path.calcTransformMatrix();
    const inv = fabric.util.invertTransform(matrix);

    const local = fabric.util.transformPoint({ x: control.left, y: control.top }, inv);
    const offsetX = path.pathOffset.x;
    const offsetY = path.pathOffset.y;

    // Update path data specific coordinate
    const pData = path.path[idx];
    pData[offset] = local.x + offsetX;     // x
    pData[offset + 1] = local.y + offsetY; // y
    syncClosingAnchorIfNeeded(path, control.data, pData[offset], pData[offset + 1]);

    // Recompute path internals without translating object during drag,
    // otherwise anchor movement can appear to affect neighboring nodes.
    path._calcDimensions();
    path.setCoords();
    path.dirty = true;

    // Re-render lines (simplest way: re-create them or update? Re-creating is expensive but safe)
    // Optimization: Update all controls positions?
    // Let's call updateControlsAndLines
    updateControlsAndLines(path);

    state.canvas.requestRenderAll();
}

function syncClosingAnchorIfNeeded(pathObj, controlData, x, y) {
    if (!controlData || controlData.type !== 'anchor') return;
    if (!hasDuplicateClosingAnchor(pathObj.path)) return;

    const anchorCmdIndex = controlData.index;
    const anchorCmd = getCommandType(pathObj.path, anchorCmdIndex);

    // If the start anchor (M) moves, mirror it to the duplicated closing endpoint.
    if (anchorCmd === 'M' && anchorCmdIndex === 0) {
        const lastIdx = getLastDrawableSegmentIndex(pathObj.path);
        if (lastIdx === null) return;
        setCommandEndPoint(pathObj.path[lastIdx], x, y);
    }
}

function recalculatePathPosition(path) {
    const oldPathOffset = { x: path.pathOffset.x, y: path.pathOffset.y };
    path._calcDimensions();
    const dX = path.pathOffset.x - oldPathOffset.x;
    const dY = path.pathOffset.y - oldPathOffset.y;

    const tMatrix = [
        path.scaleX * Math.cos(fabric.util.degreesToRadians(path.angle)),
        path.scaleX * Math.sin(fabric.util.degreesToRadians(path.angle)),
        -path.scaleY * Math.sin(fabric.util.degreesToRadians(path.angle)),
        path.scaleY * Math.cos(fabric.util.degreesToRadians(path.angle)),
        0,
        0
    ];

    const worldShift = fabric.util.transformPoint({ x: dX, y: dY }, tMatrix);
    path.set({
        left: path.left + worldShift.x,
        top: path.top + worldShift.y
    });
}

function toggleNodeType(control) {
    const pathObj = control.data.parent;
    if (!pathObj || !pathObj.path || !pathObj.path.length) return;

    const anchorIndex = control.data.index;
    const incomingIndex = getIncomingSegmentIndex(pathObj.path, anchorIndex);
    const outgoingIndex = getOutgoingSegmentIndex(pathObj.path, anchorIndex);

    const incomingCmd = getCommandType(pathObj.path, incomingIndex);
    const outgoingCmd = getCommandType(pathObj.path, outgoingIndex);

    const shouldStraighten = isCurveCommand(incomingCmd) || isCurveCommand(outgoingCmd);

    let changed = false;
    if (shouldStraighten) {
        if (incomingIndex !== null) {
            changed = convertCurveSegmentToLine(pathObj, incomingIndex) || changed;
        }
        if (outgoingIndex !== null && outgoingIndex !== incomingIndex) {
            changed = convertCurveSegmentToLine(pathObj, outgoingIndex) || changed;
        }
    } else {
        if (incomingIndex !== null) {
            changed = convertLineSegmentToCurve(pathObj, incomingIndex) || changed;
        }
        if (outgoingIndex !== null && outgoingIndex !== incomingIndex) {
            changed = convertLineSegmentToCurve(pathObj, outgoingIndex) || changed;
        }
    }

    if (!changed) return;

    // Toggling line/curve should not translate the object.
    // Keep anchors fixed and only refresh geometry + controls.
    pathObj._calcDimensions();
    pathObj.setCoords();
    pathObj.dirty = true;
    rebuildControls(pathObj);
    state.canvas.setActiveObject(pathObj);
    state.canvas.requestRenderAll();
    saveState();
}

function rebuildControls(pathObj) {
    currentControls.forEach(c => state.canvas.remove(c));
    currentLines.forEach(l => state.canvas.remove(l));
    currentControls = [];
    currentLines = [];
    editingTarget = pathObj;
    createControls(pathObj);
}

function convertLineSegmentToCurve(pathObj, segmentIndex) {
    const segment = pathObj.path[segmentIndex];
    if (!segment || segment[0].toUpperCase() !== 'L') return false;

    const prevAnchor = getPreviousAnchorPoint(pathObj.path, segmentIndex);
    if (!prevAnchor) return false;

    const endX = segment[1];
    const endY = segment[2];
    const dx = endX - prevAnchor.x;
    const dy = endY - prevAnchor.y;

    const c1x = prevAnchor.x + dx / 3;
    const c1y = prevAnchor.y + dy / 3;
    const c2x = prevAnchor.x + (2 * dx) / 3;
    const c2y = prevAnchor.y + (2 * dy) / 3;

    pathObj.path[segmentIndex] = ['C', c1x, c1y, c2x, c2y, endX, endY];
    return true;
}

function convertCurveSegmentToLine(pathObj, segmentIndex) {
    const segment = pathObj.path[segmentIndex];
    if (!segment || !segment[0]) return false;

    const cmd = segment[0].toUpperCase();
    if (cmd === 'C') {
        pathObj.path[segmentIndex] = ['L', segment[5], segment[6]];
        return true;
    }
    if (cmd === 'Q') {
        pathObj.path[segmentIndex] = ['L', segment[3], segment[4]];
        return true;
    }
    return false;
}

function getPreviousAnchorPoint(pathData, segmentIndex) {
    for (let i = segmentIndex - 1; i >= 0; i--) {
        const cmdData = pathData[i];
        if (!cmdData || !cmdData[0]) continue;
        const cmd = cmdData[0].toUpperCase();

        if (cmd === 'M' || cmd === 'L') {
            return { x: cmdData[1], y: cmdData[2] };
        }
        if (cmd === 'Q') {
            return { x: cmdData[3], y: cmdData[4] };
        }
        if (cmd === 'C') {
            return { x: cmdData[5], y: cmdData[6] };
        }
    }
    return null;
}

function getIncomingSegmentIndex(pathData, anchorIndex) {
    if (!pathData || anchorIndex === null || anchorIndex === undefined) return null;

    const cmd = getCommandType(pathData, anchorIndex);
    if (cmd && cmd !== 'M' && cmd !== 'Z') {
        return anchorIndex;
    }

    // First anchor (M) in closed path: incoming is last drawable segment.
    if (cmd === 'M' && isClosedPath(pathData)) {
        for (let i = pathData.length - 1; i >= 0; i--) {
            const t = getCommandType(pathData, i);
            if (t && t !== 'M' && t !== 'Z') return i;
        }
    }
    return null;
}

function getOutgoingSegmentIndex(pathData, anchorIndex) {
    if (!pathData || anchorIndex === null || anchorIndex === undefined) return null;

    for (let i = anchorIndex + 1; i < pathData.length; i++) {
        const t = getCommandType(pathData, i);
        if (t && t !== 'Z') return i;
    }

    // Last anchor in closed path: outgoing wraps to first drawable segment after M.
    if (isClosedPath(pathData)) {
        for (let i = 1; i < pathData.length; i++) {
            const t = getCommandType(pathData, i);
            if (t && t !== 'Z') return i;
        }
    }
    return null;
}

function getCommandType(pathData, index) {
    if (index === null || index === undefined || index < 0 || index >= pathData.length) return null;
    const cmdData = pathData[index];
    if (!cmdData || !cmdData[0]) return null;
    return cmdData[0].toUpperCase();
}

function isCurveCommand(cmd) {
    return cmd === 'C' || cmd === 'Q';
}

function isClosedPath(pathData) {
    return pathData.some(cmdData => cmdData && cmdData[0] && cmdData[0].toUpperCase() === 'Z');
}

function getLastDrawableSegmentIndex(pathData) {
    for (let i = pathData.length - 1; i >= 0; i--) {
        const cmd = getCommandType(pathData, i);
        if (cmd && cmd !== 'Z') return i;
    }
    return null;
}

function isDuplicateClosingAnchor(pathData, index, cmd) {
    if (!pathData || !pathData.length) return false;
    if (!isClosedPath(pathData)) return false;
    if (index === 0) return false;
    if (cmd === 'M' || cmd === 'Z') return false;

    const first = pathData[0];
    if (!first || getCommandType(pathData, 0) !== 'M') return false;

    const firstX = first[1];
    const firstY = first[2];
    const end = getCommandEndPoint(pathData[index]);
    if (!end) return false;

    return pointsEqual(firstX, firstY, end.x, end.y);
}

function hasDuplicateClosingAnchor(pathData) {
    const lastIdx = getLastDrawableSegmentIndex(pathData);
    if (lastIdx === null) return false;
    const lastCmd = getCommandType(pathData, lastIdx);
    return isDuplicateClosingAnchor(pathData, lastIdx, lastCmd);
}

function getCommandEndPoint(cmdData) {
    if (!cmdData || !cmdData[0]) return null;
    const cmd = cmdData[0].toUpperCase();

    if (cmd === 'M' || cmd === 'L') return { x: cmdData[1], y: cmdData[2] };
    if (cmd === 'Q') return { x: cmdData[3], y: cmdData[4] };
    if (cmd === 'C') return { x: cmdData[5], y: cmdData[6] };
    return null;
}

function setCommandEndPoint(cmdData, x, y) {
    if (!cmdData || !cmdData[0]) return;
    const cmd = cmdData[0].toUpperCase();

    if (cmd === 'M' || cmd === 'L') {
        cmdData[1] = x;
        cmdData[2] = y;
    } else if (cmd === 'Q') {
        cmdData[3] = x;
        cmdData[4] = y;
    } else if (cmd === 'C') {
        cmdData[5] = x;
        cmdData[6] = y;
    }
}

function pointsEqual(x1, y1, x2, y2) {
    const EPSILON = 0.0001;
    return Math.abs(x1 - x2) < EPSILON && Math.abs(y1 - y2) < EPSILON;
}

function updateControlsOnMove(e) {
    // When parent object moves
    if (e.target !== editingTarget) return;
    updateControlsAndLines(editingTarget);
}

function updateControlsAndLines(pathObj) {
    // This is expensive: we need to update every control and line based on new matrix
    // Easier to just nuke and redraw lines?
    // For controls, we can update positions. 
    // For lines, endpoints change.

    const matrix = pathObj.calcTransformMatrix();
    const offsetX = pathObj.pathOffset.x;
    const offsetY = pathObj.pathOffset.y;

    // We can't easily map lines to points without complex tracking.
    // Simplest approach for "Prototype": Clear lines, update control positions, redraw lines.
    // But we don't want to destroy the dragged control else drag stops.

    // Update Controls Poses
    currentControls.forEach(c => {
        const idx = c.data.index;
        const offset = c.data.offset;
        const pData = pathObj.path[idx];
        const x = pData[offset];
        const y = pData[offset + 1];

        const p = transformCoord(x, y, matrix, offsetX, offsetY);
        c.left = p.x;
        c.top = p.y;
        c.setCoords();
    });

    // Rebuild Lines
    currentLines.forEach(l => state.canvas.remove(l));
    currentLines = [];

    let prevAnchor = null;
    let firstAnchor = null;

    // Re-iterate path to draw lines between updated control positions
    pathObj.path.forEach((pointData, index) => {
        // We need the ACTUAL canvas coords of everyone to draw lines
        // We can get them from the updated controls? Or re-transform
        // Re-transforming is safer

        const cmd = pointData[0].toUpperCase();
        if (cmd === 'Z') {
            if (firstAnchor) prevAnchor = firstAnchor;
            return;
        }

        if (cmd === 'M' || cmd === 'L') {
            const x = pointData[1];
            const y = pointData[2];
            const p = transformCoord(x, y, matrix, offsetX, offsetY);
            prevAnchor = p;
            if (index === 0) firstAnchor = p;
        }
        else if (cmd === 'Q') {
            const x1 = pointData[1];
            const y1 = pointData[2];
            const x = pointData[3];
            const y = pointData[4];
            const p1 = transformCoord(x1, y1, matrix, offsetX, offsetY);
            const p = transformCoord(x, y, matrix, offsetX, offsetY);
            createLine(prevAnchor, p1);
            createLine(p1, p);
            prevAnchor = p;
        }
        else if (cmd === 'C') {
            const x1 = pointData[1];
            const y1 = pointData[2];
            const x2 = pointData[3];
            const y2 = pointData[4];
            const x = pointData[5];
            const y = pointData[6];
            const p1 = transformCoord(x1, y1, matrix, offsetX, offsetY); // Start handle
            const p2 = transformCoord(x2, y2, matrix, offsetX, offsetY); // End handle
            const p = transformCoord(x, y, matrix, offsetX, offsetY);    // Anchor
            createLine(prevAnchor, p1);
            createLine(p2, p);
            prevAnchor = p;
        }
    });

    currentLines.forEach(l => l.sendToBack());
}

function cleanupControls() {
    currentControls.forEach(c => state.canvas.remove(c));
    currentLines.forEach(l => state.canvas.remove(l));
    currentControls = [];
    currentLines = [];

    if (editingTarget) {
        try {
            const props = editingTarget.toObject();
            delete props.path;
            delete props.type;

            const freshPath = new fabric.Path(editingTarget.path, props);
            freshPath.set({
                left: editingTarget.left,
                top: editingTarget.top,
                scaleX: editingTarget.scaleX,
                scaleY: editingTarget.scaleY,
                angle: editingTarget.angle,
                skewX: editingTarget.skewX,
                skewY: editingTarget.skewY,
                originX: editingTarget.originX,
                originY: editingTarget.originY,
                objectCaching: true,
                hasControls: true
            });

            const canvas = state.canvas;
            const idx = canvas.getObjects().indexOf(editingTarget);

            if (idx > -1) {
                canvas.remove(editingTarget);
                canvas.insertAt(freshPath, idx, false);
                editingTarget = null;
                canvas.requestRenderAll();
                saveState();
            }
        } catch (e) {
            console.error("Rehydration failed:", e);
            editingTarget.hasControls = true;
            editingTarget.objectCaching = true;
            editingTarget.setCoords();
            editingTarget = null;
        }
    }
    state.canvas.requestRenderAll();
}
