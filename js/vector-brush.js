import { state } from './state.js';

const BRUSH_PRESETS = {
    ink: {
        mode: 'pencil',
        lineCap: 'round',
        lineJoin: 'round',
        miterLimit: 10,
        dashArray: null,
        opacity: 1
    },
    marker: {
        mode: 'pencil',
        lineCap: 'round',
        lineJoin: 'round',
        miterLimit: 10,
        dashArray: null,
        opacity: 0.82
    },
    technical: {
        mode: 'pencil',
        lineCap: 'butt',
        lineJoin: 'miter',
        miterLimit: 6,
        dashArray: null,
        opacity: 1
    },
    dashed: {
        mode: 'pencil',
        lineCap: 'round',
        lineJoin: 'round',
        miterLimit: 10,
        dashArray: [12, 8],
        opacity: 1
    },
    oil_dense_1: {
        mode: 'pattern',
        texture: 'dense',
        roughness: 0.28,
        baseAlpha: 0.86,
        detailAlpha: 0.2
    },
    oil_dense_2: {
        mode: 'pattern',
        texture: 'dense',
        roughness: 0.42,
        baseAlpha: 0.78,
        detailAlpha: 0.24
    },
    glaze_light_1: {
        mode: 'pattern',
        texture: 'glaze',
        roughness: 0.3,
        baseAlpha: 0.32,
        detailAlpha: 0.12
    },
    glaze_light_2: {
        mode: 'pattern',
        texture: 'glaze',
        roughness: 0.46,
        baseAlpha: 0.26,
        detailAlpha: 0.14
    },
    fine_oil_1: {
        mode: 'pattern',
        texture: 'fine',
        roughness: 0.2,
        baseAlpha: 0.7,
        detailAlpha: 0.18
    },
    fine_oil_2: {
        mode: 'pattern',
        texture: 'fine',
        roughness: 0.33,
        baseAlpha: 0.62,
        detailAlpha: 0.2
    }
};

function getActiveBrushPreset() {
    return BRUSH_PRESETS[state.vectorBrush.preset] || BRUSH_PRESETS.ink;
}

function getPresetByName(name) {
    return BRUSH_PRESETS[name] || null;
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
    if (controls) controls.style.display = visible ? 'flex' : 'none';
}

export function enableVectorBrushMode() {
    if (!state.canvas) return;

    state.canvas.isDrawingMode = true;
    state.canvas.selection = false;
    state.canvas.discardActiveObject();
    state.canvas.defaultCursor = 'crosshair';

    syncVectorBrush();
    state.canvas.requestRenderAll();
}

export function disableVectorBrushMode() {
    if (!state.canvas) return;
    state.canvas.isDrawingMode = false;
}

export function syncVectorBrush() {
    if (!state.canvas) return;

    const preset = getActiveBrushPreset();
    const needsPattern = preset.mode === 'pattern';
    const currentBrush = state.canvas.freeDrawingBrush;

    if (!currentBrush) {
        state.canvas.freeDrawingBrush = needsPattern
            ? new fabric.PatternBrush(state.canvas)
            : new fabric.PencilBrush(state.canvas);
    } else if (needsPattern && !(currentBrush instanceof fabric.PatternBrush)) {
        state.canvas.freeDrawingBrush = new fabric.PatternBrush(state.canvas);
    } else if (!needsPattern && (currentBrush instanceof fabric.PatternBrush || !(currentBrush instanceof fabric.PencilBrush))) {
        state.canvas.freeDrawingBrush = new fabric.PencilBrush(state.canvas);
    }

    const brush = state.canvas.freeDrawingBrush;
    brush.width = Math.max(1, state.vectorBrush.width);
    brush.color = state.defaults.stroke || '#000000';
    brush.decimate = Math.max(0, state.vectorBrush.smoothing);
    brush.strokeLineCap = preset.lineCap || 'round';
    brush.strokeLineJoin = preset.lineJoin || 'round';
    brush.strokeMiterLimit = preset.miterLimit || 10;
    brush.limitedToCanvasSize = true;

    if (brush instanceof fabric.PatternBrush && needsPattern) {
        brush.getPatternSrc = function () {
            return buildPatternSource(preset, brush.color, brush.width);
        };
        brush.source = brush.getPatternSrc();
    }
}

export function handleVectorBrushPathCreated(opt) {
    const path = opt && opt.path;
    if (!path || state.currentTool !== 'brush') return;

    const preset = getActiveBrushPreset();
    const isPattern = preset.mode === 'pattern';
    const brushColor = state.defaults.stroke || '#000000';

    path.set({
        fill: 'transparent',
        stroke: isPattern ? buildStrokePattern(preset, brushColor, Math.max(1, state.vectorBrush.width)) : brushColor,
        strokeWidth: Math.max(1, state.vectorBrush.width),
        strokeLineCap: preset.lineCap || 'round',
        strokeLineJoin: preset.lineJoin || 'round',
        strokeMiterLimit: preset.miterLimit || 10,
        strokeDashArray: isPattern ? null : preset.dashArray,
        opacity: preset.opacity === undefined ? 1 : preset.opacity,
        strokeUniform: true,
        blurAmount: 0,
        objectCaching: true,
        shapeType: 'path',
        brushStyle: state.vectorBrush.preset,
        brushColor
    });

    path.setCoords();
    state.canvas.setActiveObject(path);
    state.canvas.requestRenderAll();
}

export function isTexturedBrushObject(obj) {
    if (!obj || obj.type !== 'path' || !obj.brushStyle) return false;
    const preset = getPresetByName(obj.brushStyle);
    return !!preset && preset.mode === 'pattern';
}

export function getObjectStrokeColor(obj) {
    if (!obj) return '#000000';
    if (obj.brushColor) return obj.brushColor;
    if (typeof obj.stroke === 'string') return obj.stroke;
    return state.defaults.stroke || '#000000';
}

export function setBrushObjectStrokeColor(obj, color) {
    if (!obj) return;
    if (!isTexturedBrushObject(obj)) {
        obj.set('stroke', color);
        return;
    }

    const preset = getPresetByName(obj.brushStyle);
    if (!preset) {
        obj.set('stroke', color);
        return;
    }

    const strokeWidth = Math.max(1, obj.strokeWidth || state.vectorBrush.width || 1);
    obj.set({
        brushColor: color,
        stroke: buildStrokePattern(preset, color, strokeWidth)
    });
}

export function setBrushObjectStrokeWidth(obj, width) {
    if (!obj) return;
    const safeWidth = Math.max(0, width || 0);
    obj.set('strokeWidth', safeWidth);

    if (!isTexturedBrushObject(obj) || safeWidth <= 0) return;

    const preset = getPresetByName(obj.brushStyle);
    if (!preset) return;

    const color = getObjectStrokeColor(obj);
    obj.set({
        stroke: buildStrokePattern(preset, color, Math.max(1, safeWidth))
    });
}

function buildStrokePattern(preset, color, width) {
    return new fabric.Pattern({
        source: buildPatternSource(preset, color, width),
        repeat: 'repeat'
    });
}

function buildPatternSource(preset, color, width) {
    const brushWidth = Math.max(1, width);
    const size = Math.max(28, Math.round(brushWidth * 2.2));
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;

    const ctx = c.getContext('2d');
    const rgb = parseColor(color);
    const roughness = preset.roughness || 0.3;
    const baseAlpha = preset.baseAlpha === undefined ? 0.8 : preset.baseAlpha;
    const detailAlpha = preset.detailAlpha === undefined ? 0.2 : preset.detailAlpha;

    ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${baseAlpha})`;
    ctx.fillRect(0, 0, size, size);

    const shortStrokes = Math.round(size * (preset.texture === 'dense' ? 3.4 : preset.texture === 'glaze' ? 2.1 : 2.8));
    for (let i = 0; i < shortStrokes; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const len = randomRange(size * 0.08, size * 0.34) * (1 + roughness);
        const ang = randomRange(0, Math.PI * 2);
        const x2 = x + Math.cos(ang) * len;
        const y2 = y + Math.sin(ang) * len;
        const a = detailAlpha * (0.35 + Math.random() * 0.9);
        const lw = randomRange(0.6, 1.7);

        ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a.toFixed(3)})`;
        ctx.lineWidth = lw;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }

    const grainCount = Math.round(size * size * (preset.texture === 'glaze' ? 0.015 : 0.03));
    for (let i = 0; i < grainCount; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const a = detailAlpha * Math.random() * 0.6;
        ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a.toFixed(3)})`;
        ctx.fillRect(x, y, 1, 1);
    }

    return c;
}

function randomRange(min, max) {
    return min + Math.random() * (max - min);
}

function parseColor(color) {
    if (!color || typeof color !== 'string') return { r: 0, g: 0, b: 0 };
    const c = color.trim().toLowerCase();

    if (c[0] === '#') {
        if (c.length === 4) {
            return {
                r: parseInt(c[1] + c[1], 16),
                g: parseInt(c[2] + c[2], 16),
                b: parseInt(c[3] + c[3], 16)
            };
        }
        if (c.length === 7) {
            return {
                r: parseInt(c.slice(1, 3), 16),
                g: parseInt(c.slice(3, 5), 16),
                b: parseInt(c.slice(5, 7), 16)
            };
        }
    }

    const m = c.match(/rgba?\(([^)]+)\)/);
    if (m) {
        const parts = m[1].split(',').map(v => parseFloat(v.trim()));
        if (parts.length >= 3) {
            return {
                r: clampColor(parts[0]),
                g: clampColor(parts[1]),
                b: clampColor(parts[2])
            };
        }
    }

    return { r: 0, g: 0, b: 0 };
}

function clampColor(v) {
    return Math.max(0, Math.min(255, Math.round(v)));
}
