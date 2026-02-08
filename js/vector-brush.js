import { state } from './state.js';

const BRUSH_PRESETS = {
    ink: {
        lineCap: 'round',
        lineJoin: 'round',
        miterLimit: 10,
        dashArray: null,
        opacity: 1
    },
    marker: {
        lineCap: 'round',
        lineJoin: 'round',
        miterLimit: 10,
        dashArray: null,
        opacity: 0.82
    },
    technical: {
        lineCap: 'butt',
        lineJoin: 'miter',
        miterLimit: 6,
        dashArray: null,
        opacity: 1
    },
    dashed: {
        lineCap: 'round',
        lineJoin: 'round',
        miterLimit: 10,
        dashArray: [12, 8],
        opacity: 1
    }
};

function getActiveBrushPreset() {
    return BRUSH_PRESETS[state.vectorBrush.preset] || BRUSH_PRESETS.ink;
}

export function initVectorBrushControls() {
    const preset = document.getElementById('vectorBrushPreset');
    const width = document.getElementById('vectorBrushWidth');
    const smoothing = document.getElementById('vectorBrushSmoothing');
    const widthValue = document.getElementById('vectorBrushWidthValue');
    const smoothingValue = document.getElementById('vectorBrushSmoothingValue');

    if (preset) {
        preset.value = state.vectorBrush.preset;
        preset.addEventListener('change', (e) => {
            state.vectorBrush.preset = e.target.value;
            syncVectorBrush();
        });
    }

    if (width) {
        width.value = String(state.vectorBrush.width);
        if (widthValue) widthValue.textContent = String(state.vectorBrush.width);
        width.addEventListener('input', (e) => {
            const val = parseInt(e.target.value, 10) || 1;
            state.vectorBrush.width = val;
            if (widthValue) widthValue.textContent = String(val);
            syncVectorBrush();
        });
    }

    if (smoothing) {
        smoothing.value = String(state.vectorBrush.smoothing);
        if (smoothingValue) smoothingValue.textContent = String(state.vectorBrush.smoothing);
        smoothing.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value) || 0;
            state.vectorBrush.smoothing = val;
            if (smoothingValue) smoothingValue.textContent = val.toFixed(1);
            syncVectorBrush();
        });
    }
}

export function setVectorBrushControlsVisibility(visible) {
    const controls = document.getElementById('vectorBrushControls');
    if (controls) {
        controls.style.display = visible ? 'flex' : 'none';
    }
}

export function enableVectorBrushMode() {
    if (!state.canvas) return;

    state.canvas.isDrawingMode = true;
    state.canvas.selection = false;
    state.canvas.discardActiveObject();
    state.canvas.defaultCursor = 'crosshair';

    if (!(state.canvas.freeDrawingBrush instanceof fabric.PencilBrush)) {
        state.canvas.freeDrawingBrush = new fabric.PencilBrush(state.canvas);
    }

    syncVectorBrush();
    state.canvas.requestRenderAll();
}

export function disableVectorBrushMode() {
    if (!state.canvas) return;
    state.canvas.isDrawingMode = false;
}

export function syncVectorBrush() {
    if (!state.canvas || !state.canvas.freeDrawingBrush) return;

    const brush = state.canvas.freeDrawingBrush;
    const preset = getActiveBrushPreset();

    brush.width = Math.max(1, state.vectorBrush.width);
    brush.color = state.defaults.stroke || '#000000';
    brush.decimate = Math.max(0, state.vectorBrush.smoothing);
    brush.strokeLineCap = preset.lineCap;
    brush.strokeLineJoin = preset.lineJoin;
    brush.strokeMiterLimit = preset.miterLimit;
    brush.limitedToCanvasSize = true;
}

export function handleVectorBrushPathCreated(opt) {
    const path = opt && opt.path;
    if (!path || state.currentTool !== 'brush') return;

    const preset = getActiveBrushPreset();

    path.set({
        fill: 'transparent',
        stroke: state.defaults.stroke || path.stroke || '#000000',
        strokeWidth: Math.max(1, state.vectorBrush.width),
        strokeLineCap: preset.lineCap,
        strokeLineJoin: preset.lineJoin,
        strokeMiterLimit: preset.miterLimit,
        strokeDashArray: preset.dashArray,
        opacity: preset.opacity,
        strokeUniform: true,
        blurAmount: 0,
        objectCaching: true,
        shapeType: 'path'
    });

    path.setCoords();
    state.canvas.setActiveObject(path);
    state.canvas.requestRenderAll();
}

