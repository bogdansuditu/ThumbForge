import { state } from './state.js';
import { AVAILABLE_FONTS } from './config.js';
import { saveState } from './project.js';
import { applyImageCornerRadius, applyBlur, updateStarPoints, updateStarOuterRadius, updateStarInnerRadius, updatePolygonSides, updatePolygonRadius } from './shapes.js';
import { updateBackgroundColor, updateBackgroundOpacity } from './canvas.js';


let draggedElement = null;

export function updateLayersList() {
    const layersList = document.getElementById('layersList');
    layersList.innerHTML = '';

    const objects = state.canvas.getObjects().reverse();

    objects.forEach((obj, index) => {
        if (obj.temp || obj.isBackground) return;

        const actualIndex = state.canvas.getObjects().length - 1 - index;
        const layerItem = document.createElement('div');
        layerItem.className = 'layer-item';
        layerItem.dataset.index = actualIndex;
        layerItem.draggable = true;

        if (state.canvas.getActiveObject() === obj) {
            layerItem.classList.add('active');
        }

        const icon = getLayerIcon(obj);
        const name = getLayerName(obj, actualIndex);

        layerItem.innerHTML = `
            <span class="drag-handle">☰</span>
            <span class="layer-icon">${icon}</span>
            <span class="layer-name">${name}</span>
            <div class="layer-controls">
                <button class="layer-control-btn visibility-btn ${obj.visible !== false ? 'active' : ''}" title="Toggle Visibility">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        ${obj.visible !== false ?
                '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>' :
                '<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
            }
                    </svg>
                </button>
                <button class="layer-control-btn lock-btn ${obj.lockMovementX ? 'active' : ''}" title="Toggle Lock">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        ${obj.lockMovementX ?
                '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>' :
                '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 019.9-1"/>'
            }
                    </svg>
                </button>
            </div>
        `;

        layerItem.addEventListener('dragstart', handleDragStart);
        layerItem.addEventListener('dragover', handleDragOver);
        layerItem.addEventListener('drop', handleDrop);
        layerItem.addEventListener('dragenter', handleDragEnter);
        layerItem.addEventListener('dragleave', handleDragLeave);
        layerItem.addEventListener('dragend', handleDragEnd);

        const visibilityBtn = layerItem.querySelector('.visibility-btn');
        if (visibilityBtn) {
            visibilityBtn.addEventListener('click', (e) => {
                obj.visible = !obj.visible;
                state.canvas.renderAll();
                updateLayersList();
                e.stopPropagation();
            });
        }

        const lockBtn = layerItem.querySelector('.lock-btn');
        if (lockBtn) {
            lockBtn.addEventListener('click', (e) => {
                const locked = !obj.lockMovementX;
                obj.lockMovementX = locked;
                obj.lockMovementY = locked;
                obj.lockScalingX = locked;
                obj.lockScalingY = locked;
                obj.lockRotation = locked;
                obj.selectable = !locked;
                state.canvas.renderAll();
                updateLayersList();
                e.stopPropagation();
            });
        }

        layerItem.addEventListener('click', (e) => {
            if (e.target.classList.contains('drag-handle')) return;

            state.backgroundSelected = false;

            if (obj.isBackground) {
                obj.selectable = true;
                state.canvas.setActiveObject(obj);
                obj.selectable = false;
            } else {
                state.canvas.setActiveObject(obj);
            }

            state.canvas.renderAll();
            updatePropertiesPanel();
            updateLayersList();
        });

        layersList.appendChild(layerItem);
    });

    const bgLayerItem = document.createElement('div');
    bgLayerItem.className = `layer-item background-layer ${state.backgroundSelected ? 'active' : ''}`;
    bgLayerItem.style.cursor = 'pointer';

    bgLayerItem.innerHTML = `
        <span class="drag-handle" style="visibility: hidden;">☰</span>
        <span class="layer-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
            </svg>
        </span>
        <span class="layer-name">Background</span>
        <div class="layer-controls"></div>
    `;

    bgLayerItem.addEventListener('click', () => {
        state.backgroundSelected = true;
        state.canvas.discardActiveObject();
        state.canvas.renderAll();
        updatePropertiesPanel();
        updateLayersList();
    });

    layersList.appendChild(bgLayerItem);
}

export function handleDragStart(e) {
    draggedElement = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
}

export function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

export function handleDragEnter(e) {
    if (this !== draggedElement && !this.classList.contains('background-layer')) {
        this.classList.add('drag-over');
    }
}

export function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

export function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }

    if (draggedElement !== this && !this.classList.contains('background-layer')) {
        const draggedIndex = parseInt(draggedElement.dataset.index);
        const targetIndex = parseInt(this.dataset.index);

        const objects = state.canvas.getObjects();
        const draggedObj = objects[draggedIndex];

        state.canvas.remove(draggedObj);
        state.canvas.insertAt(draggedObj, targetIndex, false);

        state.canvas.renderAll();
        updateLayersList();
        saveState();
    }

    return false;
}

export function handleDragEnd(e) {
    this.classList.remove('dragging');
    document.querySelectorAll('.layer-item').forEach(item => {
        item.classList.remove('drag-over');
    });
}

function getLayerIcon(obj) {
    const svgStyle = 'width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"';

    if (obj.isBackground) {
        return `<svg ${svgStyle}><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`;
    }
    if (obj.type === 'i-text' || obj.type === 'text') {
        return `<svg ${svgStyle}><path d="M5 4h14M12 4v16"/></svg>`;
    }
    if (obj.type === 'rect') {
        return `<svg ${svgStyle}><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`;
    }
    if (obj.type === 'circle') {
        return `<svg ${svgStyle}><circle cx="12" cy="12" r="9"/></svg>`;
    }
    if (obj.type === 'triangle') {
        return `<svg ${svgStyle}><path d="M12 3l10 18H2z"/></svg>`;
    }
    if (obj.type === 'polygon' || (obj.type === 'path' && obj.shapeType === 'polygon')) {
        return `<svg ${svgStyle}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
    }
    if (obj.type === 'line' || obj.type === 'polyline' || (obj.type === 'path' && obj.shapeType !== 'polygon')) {
        return `<svg ${svgStyle}><line x1="5" y1="19" x2="19" y2="5"/></svg>`;
    }
    if (obj.type === 'image') {
        return `<svg ${svgStyle}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
    }
    return `<svg ${svgStyle}><circle cx="12" cy="12" r="10"/></svg>`;
}

function getLayerName(obj, index) {
    if (obj.isBackground) return 'Background';
    if (obj.name) return obj.name;
    if (obj.type === 'i-text' || obj.type === 'text') {
        return obj.text.substring(0, 20) + (obj.text.length > 20 ? '...' : '');
    }
    if (obj.type === 'rect') return 'Rectangle';
    if (obj.type === 'circle') return 'Circle';
    if (obj.type === 'triangle') return 'Triangle';
    if (obj.type === 'polygon') return obj.points.length === 5 ? 'Star' : 'Polygon';
    if (obj.type === 'line') return 'Line';
    if (obj.type === 'polyline') return 'Polyline';
    if (obj.type === 'path') return obj.shapeType === 'polygon' ? 'Custom Shape' : 'Path';
    if (obj.type === 'image') return 'Image';
    return `Layer ${index + 1}`;
}

export function updatePropertiesPanel() {
    const panel = document.getElementById('propertiesPanel');
    if (!panel) return;

    // Check if background is selected
    if (state.backgroundSelected) {
        let html = `
            <div class="property-group">
                <label class="property-label">Color</label>
                <div class="color-picker-row">
                    <div class="color-preview" style="background-color: ${state.backgroundColor}">
                        <input type="color" id="prop-bg-color" value="${state.backgroundColor}"
                               oninput="updateBackgroundColor(this.value)">
                    </div>
                    <input type="text" id="prop-bg-text" class="property-input" value="${state.backgroundColor}"
                           oninput="updateBackgroundColor(this.value)">
                </div>
            </div>

            <div class="property-group">
                <label class="property-label">Opacity</label>
                <div class="range-container">
                    <input type="range" id="prop-bg-opacity" min="0" max="100" value="${state.backgroundOpacity * 100}"
                           oninput="updateBackgroundOpacity(this.value / 100)">
                    <span id="prop-bg-opacity-value" class="range-value">${Math.round(state.backgroundOpacity * 100)}%</span>
                </div>
            </div>
        `;
        panel.innerHTML = html;
        return;
    }

    const activeObj = state.canvas.getActiveObject();
    if (!activeObj) {
        clearPropertiesPanel();
        return;
    }

    let html = '';

    // Common properties
    html += `
        <div class="property-group">
            <label class="property-label">Opacity</label>
            <div class="range-container">
                <input type="range" min="0" max="100" value="${(activeObj.opacity || 1) * 100}"
                       oninput="updateObjectProperty('opacity', this.value / 100); this.nextElementSibling.textContent = this.value + '%'">
                <span class="range-value">${Math.round((activeObj.opacity || 1) * 100)}%</span>
            </div>
        </div>
    `;

    // Text specific
    if (activeObj.type === 'i-text' || activeObj.type === 'text') {
        html += `
            <div class="property-group">
                <label class="property-label">Size</label>
                <div class="range-container">
                    <input type="range" min="10" max="300" value="${activeObj.fontSize}"
                           oninput="updateObjectProperty('fontSize', parseInt(this.value)); this.nextElementSibling.textContent = this.value">
                    <span class="range-value">${activeObj.fontSize}</span>
                </div>
            </div>

            <div class="property-group" style="z-index: 100; position: relative;">
                <label class="property-label">Font</label>
                <!-- Custom Dropdown -->
                <div class="custom-select-container">
                    <div class="custom-select-trigger" onclick="event.stopPropagation(); toggleFontDropdown()">
                        <span style="font-family: '${activeObj.fontFamily}';">${activeObj.fontFamily}</span>
                    </div>
                    <div id="fontSelectOptions" class="custom-select-options">
                        ${AVAILABLE_FONTS.map(font =>
            `<div class="custom-option ${activeObj.fontFamily === font ? 'selected' : ''}" 
                                  style="font-family: '${font}'"
                                  onclick="confirmFont('${font}')"
                                  onmouseenter="previewFont('${font}')"
                                  >
                                ${font}
                            </div>`
        ).join('')}
                    </div>
                </div>
            </div>

            <div class="property-group full-width">
                 <div class="style-btn-group">
                    <button class="style-btn ${activeObj.fontWeight === 'bold' ? 'active' : ''}" 
                            onclick="toggleFontWeight()" 
                            title="Bold">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z"></path>
                            <path d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z"></path>
                        </svg>
                    </button>
                    <button class="style-btn ${activeObj.fontStyle === 'italic' ? 'active' : ''}" 
                            onclick="toggleFontStyle()" 
                            title="Italic">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="19" y1="4" x2="10" y2="4"></line>
                            <line x1="14" y1="20" x2="5" y2="20"></line>
                            <line x1="15" y1="4" x2="9" y2="20"></line>
                        </svg>
                    </button>
                    <div style="width: 1px; background: #222; margin: 2px 4px;"></div>
                    <button class="style-btn ${activeObj.textAlign === 'left' ? 'active' : ''}" 
                            onclick="updateObjectProperty('textAlign', 'left')" 
                            title="Align Left">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="17" y1="10" x2="3" y2="10"></line>
                            <line x1="21" y1="6" x2="3" y2="6"></line>
                            <line x1="21" y1="14" x2="3" y2="14"></line>
                            <line x1="17" y1="18" x2="3" y2="18"></line>
                        </svg>
                    </button>
                    <button class="style-btn ${activeObj.textAlign === 'center' ? 'active' : ''}" 
                            onclick="updateObjectProperty('textAlign', 'center')" 
                            title="Align Center">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="21" y1="6" x2="3" y2="6"></line>
                            <line x1="17" y1="10" x2="7" y2="10"></line>
                            <line x1="19" y1="14" x2="5" y2="14"></line>
                            <line x1="21" y1="18" x2="3" y2="18"></line>
                        </svg>
                    </button>
                    <button class="style-btn ${activeObj.textAlign === 'right' ? 'active' : ''}" 
                            onclick="updateObjectProperty('textAlign', 'right')" 
                            title="Align Right">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="21" y1="10" x2="7" y2="10"></line>
                            <line x1="21" y1="6" x2="3" y2="6"></line>
                            <line x1="21" y1="14" x2="3" y2="14"></line>
                            <line x1="21" y1="18" x2="7" y2="18"></line>
                        </svg>
                    </button>
                </div>
            </div>

            <div class="property-group">
                <label class="property-label">Fill</label>
                 <div class="color-picker-row">
                    <div class="color-preview" style="background-color: ${activeObj.fill}">
                        <input type="color" value="${activeObj.fill}"
                               oninput="updateObjectProperty('fill', this.value)">
                    </div>
                    <input type="text" class="property-input" value="${activeObj.fill}"
                           oninput="updateObjectProperty('fill', this.value)">
                </div>
            </div>

            <div class="property-group">
                <label class="property-label">Stroke Width</label>
                <div class="range-container">
                    <input type="range" min="0" max="20" value="${activeObj.strokeWidth || 0}"
                       oninput="updateObjectProperty('strokeWidth', parseInt(this.value)); this.nextElementSibling.textContent = this.value + 'px'">
                    <span hidden>${activeObj.strokeWidth || 0}px</span>
                </div>
            </div>

            <div class="property-group">
                <label class="property-label">Stroke Color</label>
                 <div class="color-picker-row">
                    <div class="color-preview" style="background-color: ${activeObj.stroke || '#000000'}">
                        <input type="color" value="${activeObj.stroke || '#000000'}"
                               oninput="updateObjectProperty('stroke', this.value)">
                    </div>
                    <input type="text" class="property-input" value="${activeObj.stroke}"
                           oninput="updateObjectProperty('stroke', this.value)">
                </div>
            </div>
            `;
    }

    // Add rest of the property panel construction logic here (Shape, Image, Lines, Effects), omitting for brevity as it follows the same pattern.
    // I need to make sure I include all of it.

    // Shape properties (Rest of the function)
    if (activeObj.type === 'rect' || activeObj.type === 'circle' || activeObj.type === 'triangle' || activeObj.type === 'polygon' || activeObj.type === 'path') {
        html += `
             <div class="property-group">
                 <div style="display: flex; align-items: center; justify-content: space-between; padding-right: 5px;">
                     <label class="property-label">Fill</label>
                     <input type="checkbox" title="Enable Fill" 
                            ${activeObj.fill !== 'transparent' ? 'checked' : ''} 
                            onchange="updateObjectProperty('fill', this.checked ? '#000000' : 'transparent')">
                 </div>
                  <div class="color-picker-row">
                     <div class="color-preview" style="background-color: ${activeObj.fill === 'transparent' ? 'transparent' : activeObj.fill}; ${activeObj.fill === 'transparent' ? 'background-image: linear-gradient(45deg, #555 25%, transparent 25%), linear-gradient(-45deg, #555 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #555 75%), linear-gradient(-45deg, transparent 75%, #555 75%); background-size: 8px 8px; background-position: 0 0, 0 4px, 4px -4px, -4px 0px;' : ''}">
                         <input type="color" value="${activeObj.fill === 'transparent' ? '#000000' : activeObj.fill}"
                                oninput="updateObjectProperty('fill', this.value)"
                                ${activeObj.fill === 'transparent' ? 'disabled' : ''}>
                     </div>
                     <input type="text" class="property-input" value="${activeObj.fill === 'transparent' ? 'No Fill' : activeObj.fill}"
                            oninput="updateObjectProperty('fill', this.value)"
                            ${activeObj.fill === 'transparent' ? 'disabled' : ''}>
                 </div>
             </div>
 
             <div class="property-group">
                 <label class="property-label">Stroke Width</label>
                 <div class="range-container">
                     <input type="range" min="0" max="20" value="${activeObj.strokeWidth || 0}"
                            oninput="updateObjectProperty('strokeWidth', parseInt(this.value)); this.nextElementSibling.textContent = this.value + 'px'">
                     <span hidden>${activeObj.strokeWidth || 0}px</span>
                 </div>
             </div>
 
             <div class="property-group">
                 <label class="property-label">Stroke Color</label>
                  <div class="color-picker-row">
                     <div class="color-preview" style="background-color: ${activeObj.stroke || '#000000'}">
                         <input type="color" value="${activeObj.stroke || '#000000'}"
                                oninput="updateObjectProperty('stroke', this.value)">
                     </div>
                     <input type="text" class="property-input" value="${activeObj.stroke}"
                            oninput="updateObjectProperty('stroke', this.value)">
                 </div>
             </div>
         `;

        if (activeObj.type === 'rect') {
            html += `
             <div class="property-group">
                 <label class="property-label">Corner</label>
                 <div class="range-container">
                     <input type="range" min="0" max="100" value="${activeObj.rx || 0}"
                         oninput="updateRectCorners(parseInt(this.value)); this.nextElementSibling.textContent = this.value">
                         <span class="range-value">${activeObj.rx || 0}</span>
                 </div>
             </div>
             `;
        }

        if (activeObj.shapeType === 'star') {
            html += `
            <div class="property-group">
                <label class="property-label">Spikes</label>
                <div class="range-container">
                    <input type="range" min="3" max="20" value="${activeObj.starSpikes || 5}"
                           oninput="updateStarPoints(parseInt(this.value)); this.nextElementSibling.textContent = this.value">
                    <span class="range-value">${activeObj.starSpikes || 5}</span>
                </div>
            </div>
             <div class="property-group">
                <label class="property-label">Outer R</label>
                <div class="range-container">
                    <input type="range" min="20" max="200" value="${activeObj.outerRadius || 75}"
                           oninput="updateStarOuterRadius(parseInt(this.value)); this.nextElementSibling.textContent = this.value">
                    <span class="range-value">${activeObj.outerRadius || 75}</span>
                </div>
            </div>
             <div class="property-group">
                <label class="property-label">Inner R</label>
                <div class="range-container">
                    <input type="range" min="10" max="150" value="${activeObj.innerRadius || 35}"
                           oninput="updateStarInnerRadius(parseInt(this.value)); this.nextElementSibling.textContent = this.value">
                    <span class="range-value">${activeObj.innerRadius || 35}</span>
                </div>
            </div>
            `;
        }

        if (activeObj.shapeType === 'polygon') {
            html += `
            <div class="property-group">
                <label class="property-label">Sides</label>
                <div class="range-container">
                    <input type="range" min="3" max="12" value="${activeObj.polygonSides || 6}"
                           oninput="updatePolygonSides(parseInt(this.value)); this.nextElementSibling.textContent = this.value">
                    <span class="range-value">${activeObj.polygonSides || 6}</span>
                </div>
            </div>

            <div class="property-group">
                <label class="property-label">Radius</label>
                <div class="range-container">
                    <input type="range" min="20" max="200" value="${activeObj.polygonRadius || 75}"
                           oninput="updatePolygonRadius(parseInt(this.value)); this.nextElementSibling.textContent = this.value + 'px'">
                    <span class="range-value">${activeObj.polygonRadius || 75}px</span>
                </div>
            </div>
            `;
        }
    }

    if (activeObj.type === 'line' || activeObj.type === 'polyline') {
        html += `
            <div class="property-group">
                <label class="property-label">Stroke Width</label>
                 <div class="range-container">
                     <input type="range" min="1" max="20" value="${activeObj.strokeWidth || 3}"
                       oninput="updateObjectProperty('strokeWidth', parseInt(this.value)); this.nextElementSibling.textContent = this.value + 'px'">
                   <span hidden>${activeObj.strokeWidth || 3}px</span>
                </div>
            </div>

            <div class="property-group">
                <label class="property-label">Stroke Color</label>
                 <div class="color-picker-row">
                    <div class="color-preview" style="background-color: ${activeObj.stroke || '#000000'}">
                        <input type="color" value="${activeObj.stroke || '#000000'}"
                               oninput="updateObjectProperty('stroke', this.value)">
                    </div>
                    <input type="text" class="property-input" value="${activeObj.stroke}"
                           oninput="updateObjectProperty('stroke', this.value)">
                </div>
            </div>
        `;
    }

    if (activeObj.type === 'image') {
        const imgStrokeWidth = activeObj.imgStrokeWidth !== undefined ? activeObj.imgStrokeWidth : (activeObj.strokeWidth || 0);
        html += `
            <div class="property-group">
                <label class="property-label">Corner</label>
                <div class="range-container">
                    <input type="range" min="0" max="100" value="${activeObj.cornerRadius || 0}"
                           oninput="updateImageCorners(parseInt(this.value)); this.nextElementSibling.textContent = this.value">
                    <span class="range-value">${activeObj.cornerRadius || 0}</span>
                </div>
            </div>

            <div class="property-group">
                <label class="property-label">Stroke Width</label>
                 <div class="range-container">
                     <input type="range" min="0" max="20" value="${imgStrokeWidth}"
                       oninput="updateImageStroke('strokeWidth', parseInt(this.value)); this.nextElementSibling.textContent = this.value + 'px'">
                   <span hidden>${imgStrokeWidth}px</span>
                </div>
            </div>

            <div class="property-group">
                <label class="property-label">Stroke Color</label>
                 <div class="color-picker-row">
                    <div class="color-preview" style="background-color: ${activeObj.imgStroke || activeObj.stroke || '#000000'}">
                        <input type="color" value="${activeObj.imgStroke || activeObj.stroke || '#000000'}"
                               oninput="updateImageStroke('stroke', this.value)">
                    </div>
                    <input type="text" class="property-input" value="${activeObj.imgStroke || activeObj.stroke || '#000000'}"
                           oninput="updateImageStroke('stroke', this.value)">
                </div>
            </div>
        `;
    }

    // Effects Section (Common)
    html += `
            <div class="panel-header">
                <h3>Effects</h3>
            </div>

            <div class="property-group">
                <label class="property-label">Blur</label>
                <div class="range-container">
                    <input type="range" min="0" max="100" value="${activeObj.blurAmount || 0}"
                           oninput="updateBlur(parseInt(this.value)); this.nextElementSibling.textContent = this.value + '%'">
                    <span class="range-value">${activeObj.blurAmount || 0}%</span>
                </div>
            </div>

            <div class="property-group">
                <label class="property-label">Shadow</label>
                <div style="flex: 1">
                     ${activeObj.shadow ?
            `<button class="btn" style="width:100%" onclick="updateObjectProperty('shadow', null); updatePropertiesPanel();">Remove Shadow</button>` :
            `<button class="btn" style="width:100%" onclick="updateObjectProperty('shadow', new fabric.Shadow({ color: 'rgba(0,0,0,0.5)', blur: 5, offsetX: 5, offsetY: 5 })); updatePropertiesPanel();">Add Shadow</button>`
        }
                </div>
            </div>

            ${activeObj.shadow ? `
                <div class="property-group">
                    <label class="property-label" ondblclick="updateShadowProperty('blur', 0)" title="Double click to reset">Shadow Blur</label>
                    <div style="display: flex; align-items: center; gap: 4px; width: 100%; min-width: 0;">
                        <input type="range" min="0" max="100" value="${activeObj.shadow.blur || 0}" style="flex: 1; min-width: 0;"
                               oninput="updateShadowProperty('blur', parseInt(this.value)); this.nextElementSibling.value = this.value">
                        <input type="number" class="property-input" style="width: 45px; padding: 2px 4px; text-align: right; flex-shrink: 0;" value="${activeObj.shadow.blur || 0}"
                               oninput="updateShadowProperty('blur', parseInt(this.value)); this.previousElementSibling.value = this.value">
                    </div>
                </div>

                <div class="property-group">
                    <label class="property-label" ondblclick="updateShadowProperty('offsetX', 0)" title="Double click to reset">Offset X</label>
                    <div style="display: flex; align-items: center; gap: 4px; width: 100%; min-width: 0;">
                        <input type="range" min="-50" max="50" value="${activeObj.shadow.offsetX || 0}" style="flex: 1; min-width: 0;"
                               oninput="updateShadowProperty('offsetX', parseInt(this.value)); this.nextElementSibling.value = this.value">
                        <input type="number" class="property-input" style="width: 45px; padding: 2px 4px; text-align: right; flex-shrink: 0;" value="${activeObj.shadow.offsetX || 0}"
                               oninput="updateShadowProperty('offsetX', parseInt(this.value)); this.previousElementSibling.value = this.value">
                    </div>
                </div>

                <div class="property-group">
                    <label class="property-label" ondblclick="updateShadowProperty('offsetY', 0)" title="Double click to reset">Offset Y</label>
                    <div style="display: flex; align-items: center; gap: 4px; width: 100%; min-width: 0;">
                        <input type="range" min="-50" max="50" value="${activeObj.shadow.offsetY || 0}" style="flex: 1; min-width: 0;"
                               oninput="updateShadowProperty('offsetY', parseInt(this.value)); this.nextElementSibling.value = this.value">
                        <input type="number" class="property-input" style="width: 45px; padding: 2px 4px; text-align: right; flex-shrink: 0;" value="${activeObj.shadow.offsetY || 0}"
                               oninput="updateShadowProperty('offsetY', parseInt(this.value)); this.previousElementSibling.value = this.value">
                    </div>
                </div>

                <div class="property-group">
                    <label class="property-label">Shadow Color</label>
                    <div class="color-picker-row">
                        <div class="color-preview" style="background-color: ${activeObj.shadow.color || 'rgba(0,0,0,0.5)'}">
                            <input type="color" value="${(activeObj.shadow.color || 'rgba(0,0,0,0.5)').replace(/rgba?\((\d+),\s*(\d+),\s*(\d+).*\)/, (m, r, g, b) => '#' + [r, g, b].map(x => parseInt(x).toString(16).padStart(2, '0')).join(''))}"
                                   oninput="updateShadowProperty('color', this.value)">
                        </div>
                    </div>
                </div>
            ` : ''}
            `;


    panel.innerHTML = html;
}

export function clearPropertiesPanel() {
    document.getElementById('propertiesPanel').innerHTML = '<p class="empty-state">Select a layer to edit properties</p>';
}

export function updateObjectProperty(property, value) {
    const activeObj = state.canvas.getActiveObject();
    if (!activeObj) return;

    if (property === 'fontFamily') {
        const fontWeight = activeObj.fontWeight || 'normal';
        const fontStyle = activeObj.fontStyle || 'normal';
        const fontString = `${fontStyle} ${fontWeight} 12px "${value}"`;

        document.fonts.load(fontString).then(() => {
            activeObj.set(property, value);
            if (activeObj.initDimensions) activeObj.initDimensions();
            activeObj.setCoords();
            activeObj.dirty = true;
            state.canvas.requestRenderAll();
            saveState();
        }).catch(() => {
            activeObj.set(property, value);
            if (activeObj.initDimensions) activeObj.initDimensions();
            activeObj.setCoords();
            activeObj.dirty = true;
            state.canvas.requestRenderAll();
            saveState();
        });
        return;
    }

    activeObj.set(property, value);

    if ((activeObj.type === 'image' || activeObj.type === 'text' || activeObj.type === 'i-text') &&
        (property === 'fontSize' || property === 'fontWeight' || property === 'fontStyle' || property === 'text')) {

        if (property === 'fontWeight' || property === 'fontStyle') {
            const fontFamily = activeObj.fontFamily;
            const fontWeight = property === 'fontWeight' ? value : (activeObj.fontWeight || 'normal');
            const fontStyle = property === 'fontStyle' ? value : (activeObj.fontStyle || 'normal');
            const fontString = `${fontStyle} ${fontWeight} 12px "${fontFamily}"`;

            document.fonts.load(fontString).then(() => {
                if (activeObj.initDimensions) activeObj.initDimensions();
                activeObj.setCoords();
                state.canvas.requestRenderAll();
            });
        } else {
            if (activeObj.initDimensions) activeObj.initDimensions();
            activeObj.setCoords();
        }
    }

    activeObj.dirty = true;
    state.canvas.renderAll();
    saveState();

    if (property === 'fill') {
        const isTransparent = (value === 'transparent');
        const fillInput = document.querySelector(`input[oninput*="updateObjectProperty('fill'"]`);

        if (isTransparent || (fillInput && fillInput.disabled)) {
            updatePropertiesPanel();
            return;
        }
    }

    if (property === 'fill' || property === 'stroke') {
        const inputs = document.querySelectorAll(`input[oninput*="updateObjectProperty('${property}'"]`);
        inputs.forEach(input => {
            if (document.activeElement !== input) {
                input.value = value;
            }

            if (input.type === 'color' && input.parentElement.classList.contains('color-preview')) {
                input.parentElement.style.backgroundColor = value;
                input.parentElement.style.backgroundImage = 'none';
            }
        });
    }
}

export function toggleFontWeight() {
    const activeObj = state.canvas.getActiveObject();
    if (!activeObj || (activeObj.type !== 'i-text' && activeObj.type !== 'text')) return;

    const newWeight = activeObj.fontWeight === 'bold' ? 'normal' : 'bold';
    updateObjectProperty('fontWeight', newWeight);
    updatePropertiesPanel();
}

export function toggleFontStyle() {
    const activeObj = state.canvas.getActiveObject();
    if (!activeObj || (activeObj.type !== 'i-text' && activeObj.type !== 'text')) return;

    const newStyle = activeObj.fontStyle === 'italic' ? 'normal' : 'italic';
    updateObjectProperty('fontStyle', newStyle);
    updatePropertiesPanel();
}


export function updateRectCorners(radius) {
    const activeObj = state.canvas.getActiveObject();
    if (!activeObj || activeObj.type !== 'rect') return;

    activeObj.set({
        rx: radius / (activeObj.scaleX || 1),
        ry: radius / (activeObj.scaleY || 1),
        uniformRadius: radius
    });
    state.canvas.renderAll();
    saveState();
}

export function updateImageCorners(radius) {
    const activeObj = state.canvas.getActiveObject();
    if (!activeObj || activeObj.type !== 'image') return;

    activeObj.set({ cornerRadius: radius });
    applyImageCornerRadius(activeObj);
    state.canvas.renderAll();
    saveState();
}

export function updateImageStroke(property, value) {
    const activeObj = state.canvas.getActiveObject();
    if (!activeObj || activeObj.type !== 'image') return;

    if (property === 'strokeWidth') {
        activeObj.imgStrokeWidth = value;
    } else if (property === 'stroke') {
        activeObj.imgStroke = value;
    }

    applyImageCornerRadius(activeObj);
    state.canvas.renderAll();
    saveState();
}

export function updateBlur(value) {
    const activeObj = state.canvas.getActiveObject();
    if (!activeObj || activeObj.isBackground) return;

    applyBlur(activeObj, value);
    saveState();
}

export function toggleShadow() {
    const activeObj = state.canvas.getActiveObject();
    if (!activeObj) return;

    if (activeObj.shadow) {
        activeObj.shadow = null;
    } else {
        activeObj.shadow = new fabric.Shadow({
            color: 'rgba(0,0,0,0.5)',
            blur: 10,
            offsetX: 4,
            offsetY: 4
        });
    }

    state.canvas.renderAll();
    updatePropertiesPanel();
    saveState();
}

export function updateShadowProperty(property, value) {
    const activeObj = state.canvas.getActiveObject();
    if (!activeObj || !activeObj.shadow) return;

    activeObj.shadow[property] = value;
    state.canvas.renderAll();
    saveState();

    const inputs = document.querySelectorAll(`input[oninput*="updateShadowProperty('${property}'"]`);
    inputs.forEach(input => {
        if (document.activeElement !== input) {
            input.value = value;
        }
    });
}

// Alignment Functions
export function checkSelectionForAlignment() {
    const activeObj = state.canvas.getActiveObject();
    const alignGroup = document.getElementById('alignGroup');

    if (activeObj && activeObj.type === 'activeSelection' && activeObj.getObjects().length > 1) {
        alignGroup.style.display = 'flex';
    } else {
        alignGroup.style.display = 'none';
    }
}

export function alignSelected(direction) {
    const activeObj = state.canvas.getActiveObject();
    if (!activeObj || activeObj.type !== 'activeSelection') return;

    const objects = activeObj.getObjects();
    const groupWidth = activeObj.width;
    const groupHeight = activeObj.height;

    objects.forEach(obj => {
        const objWidth = obj.width * obj.scaleX;
        const objHeight = obj.height * obj.scaleY;

        let centerOffsetX = 0;
        if (obj.originX === 'left') centerOffsetX = objWidth / 2;
        else if (obj.originX === 'right') centerOffsetX = -objWidth / 2;

        let centerOffsetY = 0;
        if (obj.originY === 'top') centerOffsetY = objHeight / 2;
        else if (obj.originY === 'bottom') centerOffsetY = -objHeight / 2;

        let newCenterX = obj.left + centerOffsetX;
        let newCenterY = obj.top + centerOffsetY;

        switch (direction) {
            case 'left':
                newCenterX = -groupWidth / 2 + objWidth / 2;
                break;
            case 'centerH':
                newCenterX = 0;
                break;
            case 'right':
                newCenterX = groupWidth / 2 - objWidth / 2;
                break;
            case 'top':
                newCenterY = -groupHeight / 2 + objHeight / 2;
                break;
            case 'centerV':
                newCenterY = 0;
                break;
            case 'bottom':
                newCenterY = groupHeight / 2 - objHeight / 2;
                break;
        }

        if (direction === 'left' || direction === 'centerH' || direction === 'right') {
            obj.set('left', newCenterX - centerOffsetX);
        }
        if (direction === 'top' || direction === 'centerV' || direction === 'bottom') {
            obj.set('top', newCenterY - centerOffsetY);
        }

        obj.setCoords();
        obj.dirty = true;
    });

    activeObj.setCoords();
    activeObj.dirty = true;

    state.canvas.renderAll();
    saveState();
}

// Font Dropdown
export function toggleFontDropdown() {
    const options = document.getElementById('fontSelectOptions');
    if (options) {
        const isOpen = options.classList.contains('open');

        document.querySelectorAll('.custom-select-options').forEach(el => el.classList.remove('open'));

        if (!isOpen) {
            options.classList.add('open');

            const activeObj = state.canvas.getActiveObject();
            if (activeObj && (activeObj.type === 'i-text' || activeObj.type === 'text')) {
                state.originalFontFamily = activeObj.fontFamily;
                state.isFontPreviewing = true;

                setTimeout(() => {
                    document.addEventListener('click', closeFontDropdownOutside);
                }, 0);
            }
        }
    }
}

export function closeFontDropdownOutside(e) {
    const options = document.getElementById('fontSelectOptions');
    const container = document.querySelector('.custom-select-container');

    if (options && container && !container.contains(e.target)) {
        options.classList.remove('open');
        document.removeEventListener('click', closeFontDropdownOutside);

        if (state.isFontPreviewing) {
            revertFont();
        }
    }
}

export function previewFont(font) {
    const activeObj = state.canvas.getActiveObject();
    if (activeObj && (activeObj.type === 'i-text' || activeObj.type === 'text')) {
        activeObj.set('fontFamily', font);
        state.canvas.renderAll();
    }
}

export function revertFont() {
    const activeObj = state.canvas.getActiveObject();
    if (activeObj && state.originalFontFamily && (activeObj.type === 'i-text' || activeObj.type === 'text')) {
        activeObj.set('fontFamily', state.originalFontFamily);
        state.canvas.renderAll();
    }
    state.isFontPreviewing = false;
    state.originalFontFamily = null;

    const options = document.getElementById('fontSelectOptions');
    if (options) options.classList.remove('open');
    document.removeEventListener('click', closeFontDropdownOutside);
}

export function confirmFont(font) {
    updateObjectProperty('fontFamily', font);

    state.isFontPreviewing = false;
    state.originalFontFamily = null;

    const options = document.getElementById('fontSelectOptions');
    if (options) {
        options.classList.remove('open');
    }
    document.removeEventListener('click', closeFontDropdownOutside);
}
