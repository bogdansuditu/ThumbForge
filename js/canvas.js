import { state, saveDefaults } from './state.js';
import { AVAILABLE_FONTS } from './config.js';
import { restoreAutoSave, saveState, saveImmediately } from './project.js';
import { updateLayersList, clearPropertiesPanel, updatePropertiesPanel, checkSelectionForAlignment, updateTransformInputs } from './interface.js';
import { handleUniformCorners, handleObjectMoving, handleObjectRotating, handlePathClick, handlePathMove, handlePathUp, finishPath, handleObjectUp } from './canvas-events.js';
import { applyBlur } from './shapes.js';
import { checkLayerLevelBlurSupport } from './utils.js';


export function initCanvas() {
    console.log('Initializing canvas...');
    checkLayerLevelBlurSupport(); // Check for browser support first
    preloadFonts(); // Preload all fonts immediately

    const width = parseInt(document.getElementById('canvasWidth').value) || 1280;
    const height = parseInt(document.getElementById('canvasHeight').value) || 720;

    console.log('Creating Fabric canvas...');
    state.canvas = new fabric.Canvas('canvas', {
        width: width,
        height: height,
        width: width,
        height: height,
        backgroundColor: state.defaults.backgroundColor,
        preserveObjectStacking: true
    });

    console.log('Applying background color...');
    applyBackgroundColor();

    console.log('Setting up layer-level blur...');
    setupLayerLevelBlur();

    // Event listeners
    state.canvas.on('selection:created', () => {
        state.backgroundSelected = false;
        updatePropertiesPanel();
        checkSelectionForAlignment();
    });
    state.canvas.on('selection:updated', () => {
        state.backgroundSelected = false;
        updatePropertiesPanel();
        checkSelectionForAlignment();
    });
    state.canvas.on('selection:cleared', () => {
        state.backgroundSelected = false;
        clearPropertiesPanel();
        checkSelectionForAlignment();
    });
    state.canvas.on('object:modified', () => {
        saveState();
        updateLayersList();
    });

    // Handle uniform corner radius on scaling and update inputs
    state.canvas.on('object:scaling', (e) => {
        handleUniformCorners(e);
        updateTransformInputs();
    });

    // Handle constraints (Shift+Move, Shift+Rotate) and update inputs
    state.canvas.on('object:moving', (e) => {
        handleObjectMoving(e);
        updateTransformInputs();
    });

    state.canvas.on('object:rotating', (e) => {
        handleObjectRotating(e);
        updateTransformInputs();
    });

    // Clean up overlays when object is removed
    state.canvas.on('object:removed', function (e) {
        const obj = e.target;
        if (obj._borderOverlay && state.canvas.contains(obj._borderOverlay)) {
            state.canvas.remove(obj._borderOverlay);
        }
        updateLayersList();
    });

    state.canvas.on('object:added', () => {
        updateLayersList();
        saveState();
    });

    // Path drawing
    state.canvas.on('mouse:down', handlePathClick);
    state.canvas.on('mouse:move', handlePathMove);
    state.canvas.on('mouse:up', (e) => {
        handlePathUp(e);
        handleObjectUp(e);
    });
    state.canvas.on('mouse:dblclick', finishPath);

    // Try to restore from auto-save
    console.log('Restoring auto-save...');
    restoreAutoSave();

    console.log('Saving initial state...');
    saveState();
    updateLayersList();

    console.log('Canvas initialization complete!');
}

function preloadFonts() {
    const loaderDiv = document.createElement('div');
    loaderDiv.style.cssText = 'position: absolute; left: -9999px; top: -9999px; visibility: hidden; pointer-events: none;';

    AVAILABLE_FONTS.forEach(font => {
        const span = document.createElement('span');
        span.textContent = 'Preload';
        span.style.fontFamily = font;
        loaderDiv.appendChild(span);

        const spanBold = document.createElement('span');
        spanBold.textContent = 'Preload Bold';
        spanBold.style.fontFamily = font;
        spanBold.style.fontWeight = 'bold';
        loaderDiv.appendChild(spanBold);

        const spanItalic = document.createElement('span');
        spanItalic.textContent = 'Preload Italic';
        spanItalic.style.fontFamily = font;
        spanItalic.style.fontStyle = 'italic';
        loaderDiv.appendChild(spanItalic);
    });

    document.body.appendChild(loaderDiv);
}

export function updateBackgroundColor(color) {
    state.backgroundColor = color;
    state.defaults.backgroundColor = color;
    saveDefaults();
    applyBackgroundColor();

    if (state.backgroundSelected) {
        const propColor = document.getElementById('prop-bg-color');
        if (propColor && document.activeElement !== propColor) {
            propColor.value = color;
        }

        const propText = document.getElementById('prop-bg-text');
        if (propText && document.activeElement !== propText) {
            propText.value = color;
        }
    }
    saveState();
}

export function updateBackgroundOpacity(opacity) {
    state.backgroundOpacity = opacity;
    applyBackgroundColor();

    if (state.backgroundSelected) {
        const propValue = document.getElementById('prop-bg-opacity-value');
        if (propValue) {
            propValue.textContent = Math.round(opacity * 100) + '%';
        }

        const propSlider = document.getElementById('prop-bg-opacity');
        if (propSlider && document.activeElement !== propSlider) {
            propSlider.value = opacity * 100;
        }
    }
    saveState();
}

export function applyBackgroundColor() {
    if (!state.canvas) return;

    let finalColor = state.backgroundColor;

    if (state.backgroundColor.startsWith('#')) {
        const hex = state.backgroundColor.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        finalColor = `rgba(${r}, ${g}, ${b}, ${state.backgroundOpacity})`;
    } else if (state.backgroundColor.startsWith('rgb')) {
        finalColor = state.backgroundColor.replace(/rgba?\((\d+),\s*(\d+),\s*(\d+).*\)/, `rgba($1, $2, $3, ${state.backgroundOpacity})`);
    }

    state.canvas.setBackgroundColor(finalColor, state.canvas.renderAll.bind(state.canvas));
}

export function changeCanvasSize() {
    const sizeValue = document.getElementById('canvasSize').value;

    if (sizeValue === 'custom') {
        return;
    }

    const [width, height] = sizeValue.split('x').map(v => parseInt(v));

    document.getElementById('canvasWidth').value = width;
    document.getElementById('canvasHeight').value = height;

    updateCanvasDimensions(width, height);
}

export function updateCanvasDimensions(width, height) {
    state.canvas.setDimensions({ width, height });
    state.canvas.renderAll();
    saveState();
}

// Background Layer Management overrides
function setupLayerLevelBlur() {
    try {
        if (typeof fabric === 'undefined' || !fabric.Object) {
            console.warn('Fabric.js not loaded yet, skipping blur setup');
            return;
        }

        const supportsFilter = window.supportsCanvasFilter;
        const originalDrawObject = fabric.Object.prototype.drawObject;

        fabric.Object.prototype.drawObject = function (ctx) {
            if (!this.blurAmount || this.blurAmount <= 0) {
                originalDrawObject.call(this, ctx);
                return;
            }

            if (supportsFilter) {
                const filterVal = `blur(${this.blurAmount}px)`;
                ctx.filter = filterVal;
                try {
                    originalDrawObject.call(this, ctx);
                } finally {
                    ctx.filter = 'none';
                }
                return;
            }

            if (this.type !== 'image') {
                const offset = 10000;
                ctx.save();
                ctx.shadowBlur = this.blurAmount;
                const color = (this.fill && this.fill !== 'transparent') ? this.fill : (this.stroke || '#000000');
                ctx.shadowColor = color;
                ctx.shadowOffsetX = offset;
                ctx.shadowOffsetY = 0;
                ctx.translate(-offset, 0);
                originalDrawObject.call(this, ctx);
                ctx.restore();
                return;
            }

            originalDrawObject.call(this, ctx);
        };

        const originalGetSvgStyles = fabric.Object.prototype.getSvgStyles;
        fabric.Object.prototype.getSvgStyles = function () {
            let style = originalGetSvgStyles.call(this);
            if (this.blurAmount > 0) {
                style += `filter: url(#blur-${this.blurAmount});`;
            }
            return style;
        };
    } catch (error) {
        console.error('Error setting up layer-level blur:', error);
    }
}

// Zoom Controls
export function initZoomControls() {
    const zoomInBtn = document.getElementById('zoomIn');
    const zoomOutBtn = document.getElementById('zoomOut');
    const zoomInput = document.getElementById('zoomValue');
    const canvasArea = document.querySelector('.canvas-area');
    const container = document.querySelector('.canvas-container');

    function applyZoom(newZoom) {
        newZoom = Math.max(0.1, Math.min(newZoom, 5.0));

        state.currentZoom = newZoom;
        document.getElementById('zoomValue').value = Math.round(state.currentZoom * 100) + '%';

        if (container) {
            if (CSS.supports('zoom: 1')) {
                container.style.zoom = state.currentZoom;
            } else {
                container.style.transform = `scale(${state.currentZoom})`;
                container.style.transformOrigin = '0 0';
            }
        }
    }

    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', () => {
            let nextStep = Math.round((state.currentZoom + 0.1) * 10) / 10;
            applyZoom(nextStep);
        });
    }

    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', () => {
            let nextStep = Math.round((state.currentZoom - 0.1) * 10) / 10;
            applyZoom(nextStep);
        });
    }

    if (zoomInput) {
        zoomInput.addEventListener('change', (e) => {
            let val = parseFloat(e.target.value);
            if (isNaN(val)) val = 100;
            applyZoom(val / 100);
        });

        zoomInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.target.blur();
            }
        });
    }

    if (canvasArea) {
        canvasArea.addEventListener('wheel', (e) => {
            if (e.altKey || e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -0.1 : 0.1;
                let nextZoom = Math.round((state.currentZoom + delta) * 10) / 10;
                applyZoom(nextZoom);
            }
        }, { passive: false });
    }
}
