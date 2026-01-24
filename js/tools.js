import { state } from './state.js';
import { applyImageCornerRadius } from './shapes.js';
import { saveState } from './project.js';
import { AVAILABLE_FONTS } from './config.js';

export function setTool(tool) {
    state.currentTool = tool;
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    const toolBtn = document.querySelector(`[data-tool="${tool}"]`);
    if (toolBtn) toolBtn.classList.add('active');

    // Show/Hide Close Lines option
    const closeLinesContainer = document.getElementById('closeLinesContainer');
    if (closeLinesContainer) {
        closeLinesContainer.style.display = (tool === 'line') ? 'flex' : 'none';
    }

    if (state.canvas) {
        state.canvas.selection = (tool === 'select' || tool === 'move');
        state.canvas.defaultCursor = (tool === 'select' || tool === 'move') ? 'default' : 'crosshair';
    }

    if (tool === 'text') {
        addText();
        setTimeout(() => setTool('select'), 100);
    }
}

export function addText() {
    // strict no-hardcode policy: use first available font or generic
    const defaultFont = (AVAILABLE_FONTS && AVAILABLE_FONTS.length > 0) ? AVAILABLE_FONTS[0] : 'sans-serif';

    const text = new fabric.IText('Click to edit', {
        left: state.canvas.width / 2,
        top: state.canvas.height / 2,
        fontSize: 48,
        fontFamily: defaultFont,
        fill: '#000000',
        strokeWidth: 0,
        stroke: '#000000',
        strokeUniform: true,
        shadow: null,
        originX: 'center',
        originY: 'center',
        blurAmount: 0,
        objectCaching: true
    });

    state.canvas.add(text);
    state.canvas.setActiveObject(text);
    text.enterEditing();
    text.selectAll();
    state.canvas.renderAll();
}

export function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (event) {
        fabric.Image.fromURL(event.target.result, function (img) {
            const scale = Math.min(
                state.canvas.width / 2 / img.width,
                state.canvas.height / 2 / img.height
            );

            img.scale(scale);
            img.set({
                left: state.canvas.width / 2,
                top: state.canvas.height / 2,
                originX: 'center',
                originY: 'center',
                cornerRadius: 0,
                imgStrokeWidth: 0,
                imgStroke: '#000000',
                strokeWidth: 0,
                strokeUniform: true,
                blurAmount: 0,
                objectCaching: true
            });

            state.canvas.add(img);
            applyImageCornerRadius(img);
            state.canvas.setActiveObject(img);
            state.canvas.renderAll();
        });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
}
