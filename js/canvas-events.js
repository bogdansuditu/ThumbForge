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

export function handlePathClick(e) {
    if (state.currentTool !== 'line') return;
    if (e.target) return;

    const pointer = state.canvas.getPointer(e.e);

    if (!state.isDrawingPath) {
        state.isDrawingPath = true;
        state.pathPoints = [pointer];
        state.canvas.selection = false;
    } else {
        state.pathPoints.push(pointer);
        updateTempPath();
    }
}

export function handlePathMove(e) {
    if (state.currentTool !== 'line' || !state.isDrawingPath) return;

    const pointer = state.canvas.getPointer(e.e);

    if (state.tempPathLine) {
        state.canvas.remove(state.tempPathLine);
        state.tempPathLine = null;
    }

    if (state.pathPoints.length > 0) {
        const points = [...state.pathPoints, pointer];
        state.tempPathLine = new fabric.Polyline(points, {
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
}

export function updateTempPath() {
    if (state.tempPathLine) {
        state.canvas.remove(state.tempPathLine);
        state.tempPathLine = null;
    }

    if (state.pathPoints.length > 1) {
        state.tempPathLine = new fabric.Polyline(state.pathPoints, {
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
}

export function finishPath(e) {
    if (state.currentTool !== 'line' || !state.isDrawingPath) return;

    if (state.tempPathLine) {
        state.canvas.remove(state.tempPathLine);
        state.tempPathLine = null;
    }

    if (state.pathPoints.length >= 2) {
        const polyline = new fabric.Polyline(state.pathPoints, {
            stroke: '#000000',
            strokeWidth: 3,
            strokeUniform: true,
            fill: '',
            selectable: true,
            blurAmount: 0,
            objectCaching: true
        });
        state.canvas.add(polyline);
        state.canvas.setActiveObject(polyline);
    }

    state.isDrawingPath = false;
    state.pathPoints = [];
    state.canvas.selection = true;
    setTool('select');
    state.canvas.renderAll();
}
