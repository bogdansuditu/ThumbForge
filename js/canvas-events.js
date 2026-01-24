import { state } from './state.js';
import { setTool } from './tools.js';
import { applyImageCornerRadius } from './shapes.js';

export function handleObjectMoving(e) {
    if (!e.e.shiftKey) return;
    const obj = e.target;

    if (e.transform && e.transform.action !== 'drag') return;
    if (!e.transform || !e.transform.original) return;

    const orig = e.transform.original;

    const dx = Math.abs(obj.left - orig.left);
    const dy = Math.abs(obj.top - orig.top);

    if (dx > dy) {
        obj.set('top', orig.top);
    } else {
        obj.set('left', orig.left);
    }
}

export function handleObjectRotating(e) {
    if (!e.e.shiftKey) return;
    const obj = e.target;
    const snap = 15;

    const currentAngle = obj.angle;
    const snappedAngle = Math.round(currentAngle / snap) * snap;

    obj.rotate(snappedAngle);
}

export function handleUniformCorners(e) {
    const obj = e.target;

    if (obj.type === 'rect' && obj.uniformRadius !== undefined) {
        obj.set({
            rx: obj.uniformRadius / obj.scaleX,
            ry: obj.uniformRadius / obj.scaleY
        });
    }

    if (obj.type === 'image' && obj.cornerRadius !== undefined && obj.cornerRadius > 0) {
        applyImageCornerRadius(obj);
    }
}

// Helper to get pointer relative to canvas
function getPointer(e) {
    return state.canvas.getPointer(e.e);
}

export function handlePathClick(e) {
    if (state.currentTool !== 'line') return;
    if (e.target) return;

    const pointer = getPointer(e);

    // Check if we should snap to start
    if (state.isSnappedToStart) {
        finishPath();
        return;
    }

    if (!state.isDrawingPath) {
        state.isDrawingPath = true;
        // Start new path with first node
        state.pathNodes = [{
            x: pointer.x,
            y: pointer.y,
            cp1: { x: pointer.x, y: pointer.y }, // Incoming handle
            cp2: { x: pointer.x, y: pointer.y }  // Outgoing handle
        }];
        state.canvas.selection = false;
    } else {
        // Add subsequent node
        state.pathNodes.push({
            x: pointer.x,
            y: pointer.y,
            cp1: { x: pointer.x, y: pointer.y },
            cp2: { x: pointer.x, y: pointer.y }
        });
    }

    state.isDraggingNode = true;
    state.dragStartPoint = { x: pointer.x, y: pointer.y };
    updateTempPath();
}

export function handlePathMove(e) {
    if (state.currentTool !== 'line' || !state.isDrawingPath) return;

    const pointer = getPointer(e);

    // Check for magnetic snap to start
    state.isSnappedToStart = false;
    if (state.pathNodes.length > 2) {
        const startNode = state.pathNodes[0];
        const dist = Math.sqrt(Math.pow(pointer.x - startNode.x, 2) + Math.pow(pointer.y - startNode.y, 2));
        if (dist < 20) {
            pointer.x = startNode.x;
            pointer.y = startNode.y;
            state.isSnappedToStart = true;
            // Visual feedback: we could change cursor or temp line color here
        }
    }

    if (state.isDraggingNode) {
        // Dragging to create handles
        const lastNode = state.pathNodes[state.pathNodes.length - 1];
        const dx = pointer.x - state.dragStartPoint.x;
        const dy = pointer.y - state.dragStartPoint.y;

        // Current point acts as the anchor.
        // cp2 (outgoing) follows the mouse (or opposite, depending on convention).
        // Standard convention: Drag direction = Handle 2 direction (outgoing from node)
        // Wait, standard Illustrator: Click & Drag OUT from point.
        // The point you Clicked is the Node. The mouse position is the handle tip.
        // So pointer is handle tip for Outgoing (cp2).
        lastNode.cp2.x = state.dragStartPoint.x + dx;
        lastNode.cp2.y = state.dragStartPoint.y + dy;

        // Mirror for Incoming (cp1) to keep smooth
        lastNode.cp1.x = state.dragStartPoint.x - dx;
        lastNode.cp1.y = state.dragStartPoint.y - dy;

        updateTempPath();
    } else {
        // Rubberband line to cursor
        // We can visualize this by adding a temp point at cursor
        // For simple visualization, let's just update the path with a temp floating node
        // BUT, constant re-rendering of Path is expensive.
        // Let's optimize: Draw a simple line from last node to cursor
        // For now, to keep it simple and robust, let's just rely on the click.
        // OR: Reuse updateTempPath with a temporary added node?
        // Let's SKIP rubberbanding for Bezier for this iteration to ensure stability first.
        // Focus on the Handles.
    }
}

export function handlePathUp(e) {
    if (state.currentTool !== 'line') return;
    state.isDraggingNode = false;
    state.dragStartPoint = null;
}

export function updateTempPath() {
    if (state.tempPathLine) {
        state.canvas.remove(state.tempPathLine);
        state.tempPathLine = null;
    }

    if (state.pathNodes.length < 1) return;

    const pathData = generatePathData(state.pathNodes, false);

    state.tempPathLine = new fabric.Path(pathData, {
        stroke: '#000000',
        strokeWidth: 3,
        strokeUniform: true,
        fill: '',
        selectable: false,
        evented: false,
        opacity: 0.5,
        strokeDashArray: [5, 5]
    });
    state.canvas.add(state.tempPathLine);
    state.canvas.renderAll();
}


function generatePathData(nodes, closed) {
    if (nodes.length === 0) return '';

    // M x0 y0
    let d = `M ${nodes[0].x} ${nodes[0].y}`;

    for (let i = 1; i < nodes.length; i++) {
        const curr = nodes[i];
        const prev = nodes[i - 1];

        // Bezier Command: C cp1x cp1y, cp2x cp2y, x y
        // Note: SVG 'C' takes (Control Point from Previous, Control Point to Current, Current Point)
        // So: C prev.cp2.x prev.cp2.y, curr.cp1.x curr.cp1.y, curr.x curr.y
        d += ` C ${prev.cp2.x} ${prev.cp2.y}, ${curr.cp1.x} ${curr.cp1.y}, ${curr.x} ${curr.y}`;
    }

    if (closed) {
        // Close back to start
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        d += ` C ${last.cp2.x} ${last.cp2.y}, ${first.cp1.x} ${first.cp1.y}, ${first.x} ${first.y}`;
        d += ' Z';
    }

    return d;
}

export function finishPath(e) {
    if (state.currentTool !== 'line' || !state.isDrawingPath) return;

    if (state.tempPathLine) {
        state.canvas.remove(state.tempPathLine);
        state.tempPathLine = null;
    }

    // Min 2 nodes
    if (state.pathNodes.length >= 2) {
        // Close if checkbox is checked OR if snapped to start
        const closed = state.closeLines || state.isSnappedToStart;
        const pathData = generatePathData(state.pathNodes, closed);

        const pathObj = new fabric.Path(pathData, {
            stroke: state.defaults.stroke,
            strokeWidth: state.defaults.strokeWidth,
            strokeUniform: true,
            fill: closed ? state.defaults.fill : 'transparent',
            selectable: true,
            blurAmount: 0,
            objectCaching: true,
            // If closed, we can call it a polygon-like shape for properties, 
            // but fundamentally it is a Path.
            shapeType: closed ? 'polygon' : 'path'
        });

        state.canvas.add(pathObj);
        state.canvas.setActiveObject(pathObj);
    }

    state.isDrawingPath = false;
    state.pathNodes = [];
    state.isSnappedToStart = false;
    state.canvas.selection = true;
    setTool('select');
    state.canvas.renderAll();
}
