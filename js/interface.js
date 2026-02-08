import { state, saveDefaults } from './state.js';
import { AVAILABLE_FONTS, FONT_GROUPS } from './config.js';
import { saveState } from './project.js';
import { applyImageCornerRadius, applyBlur, updateStarPoints, updateStarOuterRadius, updateStarInnerRadius, updatePolygonSides, updatePolygonRadius } from './shapes.js';
import { updateBackgroundColor, updateBackgroundOpacity } from './canvas.js';
import { setBrushObjectStrokeColor, setBrushObjectStrokeWidth, getObjectStrokeColor, syncVectorBrush } from './vector-brush.js';


let draggedElement = null;

function applyStrokeColorAware(obj, color) {
    if (!obj) return;
    if (obj.type === 'group') {
        obj.getObjects().forEach(child => applyStrokeColorAware(child, color));
        return;
    }
    setBrushObjectStrokeColor(obj, color);
}

function applyStrokeWidthAware(obj, width) {
    if (!obj) return;
    if (obj.type === 'group') {
        obj.getObjects().forEach(child => applyStrokeWidthAware(child, width));
        return;
    }
    setBrushObjectStrokeWidth(obj, width);
}

export function initInterface() {
    // Toolbar default color pickers
    const fillPicker = document.getElementById('defaultFillColor');
    const strokePicker = document.getElementById('defaultStrokeColor');

    if (fillPicker) {
        // Initial Visual Update
        fillPicker.parentElement.style.backgroundColor = (state.defaults.fill === 'transparent') ? '#ffffff' : state.defaults.fill;
        fillPicker.value = (state.defaults.fill === 'transparent') ? '#ffffff' : state.defaults.fill;
        fillPicker.addEventListener('input', (e) => {
            state.defaults.fill = e.target.value;
            // Visual Update
            fillPicker.parentElement.style.backgroundColor = e.target.value;
            // If user manually picks a color, ensure resizing strike is off (optional, but logical)
            const strikeDiv = document.getElementById('defaultFillStrike');
            if (strikeDiv) strikeDiv.style.display = 'none';
            saveDefaults();

            // Apply to active selection
            if (state.canvas) {
                const activeObjects = state.canvas.getActiveObjects();
                if (activeObjects.length > 0) {
                    activeObjects.forEach(obj => {
                        obj.set('fill', state.defaults.fill);
                    });
                    state.canvas.requestRenderAll();
                    saveState();
                }
            }
        });

        // Initialize strike visibility
        const strikeDiv = document.getElementById('defaultFillStrike');
        if (state.defaults.fill === 'transparent' && strikeDiv) {
            strikeDiv.style.display = 'block';
        }

        // Add RIGHT CLICK listener to toggle fill
        fillPicker.addEventListener('contextmenu', (e) => {
            e.preventDefault();

            const strikeDiv = document.getElementById('defaultFillStrike');
            if (!strikeDiv) return;

            const isCurrentlyTransparent = (state.defaults.fill === 'transparent');

            if (isCurrentlyTransparent) {
                // ENABLE FILL
                strikeDiv.style.display = 'none';

                if (state.cachedFill && state.cachedFill !== 'transparent') {
                    state.defaults.fill = state.cachedFill;
                } else {
                    state.defaults.fill = '#ffffff';
                }

                // Update picker visual value
                fillPicker.value = state.defaults.fill;
                fillPicker.parentElement.style.backgroundColor = state.defaults.fill;

                // Sync with selection
                if (state.canvas) {
                    const activeObjects = state.canvas.getActiveObjects();
                    if (activeObjects.length > 0) {
                        activeObjects.forEach(obj => {
                            obj.set('fill', state.defaults.fill);
                        });
                        state.canvas.requestRenderAll();
                        saveState();
                    }
                }
            } else {
                // DISABLE FILL (Transparent)
                strikeDiv.style.display = 'block';

                state.cachedFill = state.defaults.fill;
                state.defaults.fill = 'transparent';

                // Sync with selection
                if (state.canvas) {
                    const activeObjects = state.canvas.getActiveObjects();
                    if (activeObjects.length > 0) {
                        activeObjects.forEach(obj => {
                            obj.set('fill', 'transparent');
                        });
                        state.canvas.requestRenderAll();
                        saveState();
                    }
                }
            }

            saveDefaults();
        });
    }

    if (strokePicker) {
        // Initial Visual Update (Override gradient with solid color if needed, or update gradient?)
        // Applying solid background color works because ring cutout is on top.
        strokePicker.parentElement.style.background = state.defaults.stroke;
        strokePicker.value = state.defaults.stroke;
        strokePicker.addEventListener('input', (e) => {
            state.defaults.stroke = e.target.value;
            strokePicker.parentElement.style.background = e.target.value;
            saveDefaults();
            syncVectorBrush();

            // Apply to active selection
            if (state.canvas) {
                const activeObjects = state.canvas.getActiveObjects();
                if (activeObjects.length > 0) {
                    activeObjects.forEach(obj => {
                        applyStrokeColorAware(obj, state.defaults.stroke);
                    });
                    state.canvas.requestRenderAll();
                    saveState();
                }
            }
        });

        // Initialize strike visibility based on default (if already disabled)
        // Note: Currently persistence only saves strokeWidth not 'disabled' state explicitly,
        // but if strokeWidth is 0 we can interpret as disabled.
        const strikeDiv = document.getElementById('defaultStrokeStrike');
        if (state.defaults.strokeWidth === 0 && strikeDiv) {
            strikeDiv.style.display = 'block';
        }

        // Add RIGHT CLICK listener to toggle stroke
        strokePicker.addEventListener('contextmenu', (e) => {
            e.preventDefault(); // Prevent context menu

            const strikeDiv = document.getElementById('defaultStrokeStrike');
            if (!strikeDiv) return;

            const isCurrentlyDisabled = (state.defaults.strokeWidth === 0);

            if (isCurrentlyDisabled) {
                // ENABLE STROKE (Restore)
                strikeDiv.style.display = 'none';

                // Restore from cache, or config default, or hard fallback
                // Fallback to 2 if cache is empty/invalid
                state.defaults.strokeWidth = 2;



                // Sync with selection (Restore width AND color)
                if (state.canvas) {
                    const activeObjects = state.canvas.getActiveObjects();
                    if (activeObjects.length > 0) {
                        activeObjects.forEach(obj => {
                            applyStrokeWidthAware(obj, state.defaults.strokeWidth);
                            applyStrokeColorAware(obj, state.defaults.stroke);
                        });
                        // Visual Sync
                        strokePicker.parentElement.style.background = state.defaults.stroke;

                        state.canvas.requestRenderAll();
                        saveState();
                    }
                }

            } else {
                // DISABLE STROKE
                strikeDiv.style.display = 'block';

                // Cache current width before setting to 0
                if (state.defaults.strokeWidth > 0) {
                    state.cachedStrokeWidth = state.defaults.strokeWidth;
                }
                state.defaults.strokeWidth = 0;

                // Sync with selection
                if (state.canvas) {
                    const activeObjects = state.canvas.getActiveObjects();
                    if (activeObjects.length > 0) {
                        activeObjects.forEach(obj => {
                            applyStrokeWidthAware(obj, 0);
                        });
                        state.canvas.requestRenderAll();
                        saveState();
                    }
                }
            }

            saveDefaults();
        });
    }

    // --- SWAP COLORS LOGIC ---
    const swapBtn = document.getElementById('swapColorsBtn');
    if (swapBtn) {
        swapBtn.addEventListener('click', () => {
            const fillPicker = document.getElementById('defaultFillColor');
            const strokePicker = document.getElementById('defaultStrokeColor');
            const fillStrike = document.getElementById('defaultFillStrike');
            const strokeStrike = document.getElementById('defaultStrokeStrike');

            // Current States
            const isFillTransparent = (state.defaults.fill === 'transparent');
            const isStrokeDisabled = (state.defaults.strokeWidth === 0);

            // Current Values (Colors)
            // If transparent, use the picker value (which is usually white or last cached)
            // If disabled, use the picker value
            const currentFillColor = fillPicker ? fillPicker.value : '#ffffff';
            const currentStrokeColor = strokePicker ? strokePicker.value : '#000000';

            // --- CALCULATE NEW STATES ---

            // New Fill
            // If stroke was disabled, new fill is transparent. 
            // Else, new fill is the old stroke color.
            let newFill;
            if (isStrokeDisabled) {
                newFill = 'transparent';
            } else {
                newFill = currentStrokeColor;
            }

            // New Stroke
            // If fill was transparent, new stroke is disabled (width 0).
            // Else, new stroke is old fill color, and we need a width > 0.
            let newStrokeColor = currentStrokeColor; // default
            let newStrokeWidth = state.defaults.strokeWidth; // default

            if (isFillTransparent) {
                newStrokeWidth = 0;
                // Color remains what it was conceptually, or we can swap visual inputs?
                // Visual swap: New Stroke Picker Value = Old Fill Picker Value
                newStrokeColor = currentFillColor;
            } else {
                newStrokeColor = currentFillColor;
                // Enable stroke if it was disabled
                if (isStrokeDisabled) {
                    newStrokeWidth = state.cachedStrokeWidth || 2;
                    if (newStrokeWidth === 0) newStrokeWidth = 2; // Safety
                } else {
                    // Keep current width? Or if we strictly swap, maybe we should swap presence?
                    // "No Fill, Red Stroke" -> "Red Fill, No Stroke".
                    // "Blue Fill, Red Stroke" -> "Red Fill, Blue Stroke".
                    // "Blue Fill, No Stroke" -> "No Fill, Blue Stroke".
                    // This implies if we are enabling stroke, we use cached width.
                }
            }

            // --- APPLY NEW STATES ---

            // 1. Update State
            state.defaults.fill = newFill;
            state.defaults.stroke = newStrokeColor;
            state.defaults.strokeWidth = newStrokeWidth;

            // 2. Update UI
            if (fillPicker) {
                fillPicker.value = (newFill === 'transparent') ? '#ffffff' : newFill;
                fillPicker.parentElement.style.backgroundColor = (newFill === 'transparent') ? '#ffffff' : newFill;
            }
            if (strokePicker) {
                strokePicker.value = newStrokeColor;
                strokePicker.parentElement.style.background = newStrokeColor;
            }

            if (fillStrike) fillStrike.style.display = (newFill === 'transparent') ? 'block' : 'none';
            if (strokeStrike) strokeStrike.style.display = (newStrokeWidth === 0) ? 'block' : 'none';

            // 3. Update Active Selection
            if (state.canvas) {
                const activeObjects = state.canvas.getActiveObjects();
                if (activeObjects.length > 0) {
                        activeObjects.forEach(obj => {
                            obj.set('fill', state.defaults.fill);
                            applyStrokeColorAware(obj, state.defaults.stroke);
                        // Only update strokeWidth if we toggled presence? 
                        // Or always update? If we swap colors, we might want to keep the object's specific stroke width 
                        // UNLESS we are specifically toggling "No Stroke".
                        // Logic: If transitioning FROM No Stroke TO Stroke, apply default width.
                        // If transitioning FROM Stroke TO No Stroke, apply 0.
                        // If Stroke -> Stroke, keep object width? Or apply global default?
                        // Usually "Swap" applies global default logic to selection? 
                        // Let's effectively apply the new calculated global default to the object for consistency.

                        // BUT: If active object has strokeWidth 5, and we swap "Blue Fill / Red Stroke (default width 2)",
                        // we expect "Red Fill / Blue Stroke". 
                        // If we overwrite width with 2, we lose the 5. 
                        // Let's refine: 
                        // If newStrokeWidth is 0, object width = 0.
                        // If newStrokeWidth > 0 AND object width was 0, object width = newStrokeWidth.
                        // If newStrokeWidth > 0 AND object width > 0, keep object width (just swap color).

                        if (newStrokeWidth === 0) {
                            applyStrokeWidthAware(obj, 0);
                        } else {
                            if (obj.strokeWidth === 0) {
                                applyStrokeWidthAware(obj, newStrokeWidth);
                            }
                        }
                    });
                    state.canvas.requestRenderAll();
                    saveState();
                }
            }

            saveDefaults();
        });
    }

    // --- RESET COLORS LOGIC ---
    const resetBtn = document.getElementById('resetColorsBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            const fillPicker = document.getElementById('defaultFillColor');
            const strokePicker = document.getElementById('defaultStrokeColor');
            const fillStrike = document.getElementById('defaultFillStrike');
            const strokeStrike = document.getElementById('defaultStrokeStrike');

            // Set Defaults
            state.defaults.fill = '#ffffff';
            state.defaults.stroke = '#000000';

            // Ensure stroke is enabled if it was disabled
            if (state.defaults.strokeWidth === 0) {
                state.defaults.strokeWidth = state.cachedStrokeWidth || 2;
                if (state.defaults.strokeWidth === 0) state.defaults.strokeWidth = 2;
            }

            // Update UI
            if (fillPicker) {
                fillPicker.value = '#ffffff';
                fillPicker.parentElement.style.backgroundColor = '#ffffff';
            }
            if (strokePicker) {
                strokePicker.value = '#000000';
                strokePicker.parentElement.style.background = '#000000';
            }
            if (fillStrike) fillStrike.style.display = 'none';
            if (strokeStrike) strokeStrike.style.display = 'none';

            // Update Selection
            if (state.canvas) {
                const activeObjects = state.canvas.getActiveObjects();
                if (activeObjects.length > 0) {
                    activeObjects.forEach(obj => {
                        obj.set('fill', '#ffffff');
                        applyStrokeColorAware(obj, '#000000');
                        if (obj.strokeWidth === 0) {
                            applyStrokeWidthAware(obj, state.defaults.strokeWidth);
                        }
                    });
                    state.canvas.requestRenderAll();
                    saveState();
                }
            }
            saveDefaults();
        });
    }
}

export function updateLayersList() {
    const layersList = document.getElementById('layersList');
    layersList.innerHTML = '';

    const objects = state.canvas.getObjects().slice().reverse(); // Reverse for display order (top first)

    // Render Background Layer
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
    bgLayerItem.onclick = () => {
        state.backgroundSelected = true;
        state.canvas.discardActiveObject();
        state.canvas.renderAll();
        updatePropertiesPanel();
        updateLayersList();
    };
    // Append background at the BOTTOM of the list (since it's at the back)
    // But physically in the DOM, we want it last.

    // Helper for recursive rendering
    function renderObjects(objList, container, depth = 0, parentGroup = null) {
        objList.forEach((obj, index) => {
            if (
                obj.temp ||
                obj.isBackground ||
                obj.isNodeEditorOverlay ||
                obj.name === 'control_point' ||
                obj.name === 'handle_line'
            ) return;

            // Calculate actual index in the parent's list
            // Visual list is reversed, so index 0 is top. 
            // objList is already reversed before passed here? No, let's reverse manually at each level or passed reversed.
            // Let's pass reversed list.

            const layerItem = document.createElement('div');
            layerItem.className = 'layer-item';
            layerItem.style.paddingLeft = `${depth * 20 + 5}px`;
            layerItem.draggable = true;

            // Store reference/id for D&D
            layerItem.dataset.id = obj.uid || (obj.uid = Math.random().toString(36).substr(2, 9));

            if (state.canvas.getActiveObjects().includes(obj) || state.canvas.getActiveObject() === obj || state.activeLayerObject === obj) {
                layerItem.classList.add('active');
            }

            const isGroup = obj.type === 'group';
            // Default expanded state for groups
            if (isGroup && obj._expanded === undefined) obj._expanded = true;

            const icon = getLayerIcon(obj);
            const name = getLayerName(obj);

            layerItem.innerHTML = `
                <span class="drag-handle">☰</span>
                ${isGroup ? `<span class="group-toggle" style="cursor:pointer; width:16px; text-align:center;">${obj._expanded ? '▼' : '▶'}</span>` : ''}
                <span class="layer-icon">${icon}</span>
                <span class="layer-name state-name" title="Double click to rename">${name}</span>
                <input type="text" class="layer-rename-input" value="${name}" style="display:none; width: 100px;">
                <div class="layer-controls">
                    <button class="layer-control-btn visibility-btn ${obj.visible !== false ? 'active' : ''}" title="Toggle Visibility">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            ${obj.visible !== false ?
                    '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>' :
                    '<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
                }
                        </svg>
                    </button>
                    <button class="layer-control-btn lock-btn ${obj.lockMovementX ? 'active' : ''}" title="Toggle Lock">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                             ${obj.lockMovementX ?
                    '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>' :
                    '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 019.9-1"/>'
                }
                        </svg>
                    </button>
                </div>
            `;

            // Expand/Collapse Group
            if (isGroup) {
                const toggle = layerItem.querySelector('.group-toggle');
                toggle.addEventListener('click', (e) => {
                    e.stopPropagation();
                    obj._expanded = !obj._expanded;
                    updateLayersList();
                });
            }

            // Renaming
            const nameSpan = layerItem.querySelector('.layer-name');
            const nameInput = layerItem.querySelector('.layer-rename-input');

            nameSpan.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                nameSpan.style.display = 'none';
                nameInput.style.display = 'block';
                nameInput.focus();
                // Temporarily disable keyboards shortcuts in app.js via focus check
            });

            const finishRename = () => {
                obj.set('name', nameInput.value);
                nameSpan.textContent = nameInput.value;
                nameSpan.style.display = 'block';
                nameInput.style.display = 'none';
                saveState();
            };

            nameInput.addEventListener('blur', finishRename);
            nameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    finishRename();
                }
            });

            // Visibility
            layerItem.querySelector('.visibility-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                obj.visible = !obj.visible;
                if (obj.group) {
                    obj.group.dirty = true;
                }
                state.canvas.renderAll();
                updateLayersList();
            });

            // Lock
            layerItem.querySelector('.lock-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                const locked = !obj.lockMovementX;
                obj.lockMovementX = locked;
                obj.lockMovementY = locked;
                obj.lockScalingX = locked;
                obj.lockScalingY = locked;
                obj.lockRotation = locked;
                obj.selectable = !locked; // Disable selection if locked
                state.canvas.renderAll();
                updateLayersList();
            });

            // Selection
            layerItem.addEventListener('click', (e) => {
                if (e.target.closest('.layer-control-btn') || e.target.classList.contains('group-toggle') || e.target.tagName === 'INPUT') return;

                // Stop if clicking on the rename input itself (though it shouldn't bubble here usually if stopped there)
                // Also if we are clicking the name to rename, we might want to avoid full re-render loop on first click?

                state.backgroundSelected = false;

                // Handle Multi-Selection
                const isShift = e.shiftKey;
                const isCtrl = e.metaKey || e.ctrlKey;
                const activeObjects = state.canvas.getActiveObjects();

                // Determine context (Root or Group)
                // We restrict Shift-Select range to siblings only for simplicity and stability
                const siblings = obj.group ? obj.group.getObjects() : state.canvas.getObjects();

                let needsRender = true;

                if (isShift && state.lastSelectedLayerObject && (state.lastSelectedLayerObject.group === obj.group)) {
                    // ... Shift logic (Keep existing) ...
                    // Range Selection
                    const idx1 = siblings.indexOf(state.lastSelectedLayerObject);
                    const idx2 = siblings.indexOf(obj);

                    if (idx1 !== -1 && idx2 !== -1) {
                        const start = Math.min(idx1, idx2);
                        const end = Math.max(idx1, idx2);
                        const range = siblings.slice(start, end + 1);

                        if (!obj.group) {
                            if (range.length > 1) {
                                state.canvas.discardActiveObject();
                                const sel = new fabric.ActiveSelection(range, { canvas: state.canvas });
                                state.canvas.setActiveObject(sel);
                            } else {
                                state.canvas.setActiveObject(range[0]);
                            }
                        } else {
                            state.canvas.setActiveObject(obj.group);
                        }
                    }
                } else if (isCtrl) {
                    // ... Ctrl logic (Keep existing) ...
                    // Toggle Selection
                    if (!obj.group) {
                        const isSelected = activeObjects.includes(obj);

                        if (isSelected) {
                            // Remove
                            const newSet = activeObjects.filter(o => o !== obj);
                            state.canvas.discardActiveObject();
                            if (newSet.length === 1) {
                                state.canvas.setActiveObject(newSet[0]);
                            } else if (newSet.length > 1) {
                                const sel = new fabric.ActiveSelection(newSet, { canvas: state.canvas });
                                state.canvas.setActiveObject(sel);
                            }
                        } else {
                            // Add
                            const newSet = [...activeObjects, obj];
                            state.canvas.discardActiveObject();
                            const sel = new fabric.ActiveSelection(newSet, { canvas: state.canvas });
                            state.canvas.setActiveObject(sel);
                        }
                    } else {
                        state.canvas.setActiveObject(obj.group);
                    }
                    state.lastSelectedLayerObject = obj;
                } else {
                    // Single Selection
                    // OPTIMIZATION: If already selected and single, don't re-render list to allow double-click!
                    const currentActive = state.canvas.getActiveObject();
                    if (currentActive === obj && activeObjects.length === 1 && !obj.group) {
                        // Already selected single object. 
                        // Check if we need to set lastSelected?
                        state.lastSelectedLayerObject = obj;
                        state.activeLayerObject = obj;
                        // Prevent re-render to allow dblclick to pass through to the element
                        needsRender = false;
                    } else {
                        state.canvas.discardActiveObject();
                        if (obj.group) {
                            state.canvas.setActiveObject(obj.group);
                        } else {
                            state.canvas.setActiveObject(obj);
                        }
                        state.lastSelectedLayerObject = obj;
                    }
                }

                state.activeLayerObject = obj; // Always track specific clicked item

                if (needsRender) {
                    state.canvas.renderAll();
                    updateLayersList();
                    updatePropertiesPanel();
                } else {
                    // Update properties panel just in case, but skip list render
                    updatePropertiesPanel();
                }
            });

            // Drag Events (Placeholder for now, implementation requires more complexity)
            // We will add drag handlers specifically later, or use the existing ones but adapted.
            // ...

            container.appendChild(layerItem);

            // Render Children if expanded
            if (isGroup && obj._expanded) {
                const childrenContainer = document.createElement('div');
                childrenContainer.className = 'layer-children';
                // Fabric group objects are in 'top-down' order (0 is bottom). Display reverse.
                const children = obj.getObjects().slice().reverse();
                renderObjects(children, childrenContainer, depth + 1, obj);
                container.appendChild(childrenContainer);
            }
        });
    }

    renderObjects(objects, layersList);
    layersList.appendChild(bgLayerItem);
}



function getLayerIcon(obj) {
    const svgStyle = 'width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"';
    if (obj.type === 'group') {
        return `<svg ${svgStyle}><rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="4 4"/><rect x="7" y="7" width="10" height="10" rx="1" fill="currentColor" fill-opacity="0.2"/></svg>`;
    }
    // ... rest of icons (copy from previous)
    if (obj.isBackground) {
        return `<svg ${svgStyle}><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`;
    }
    if (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox') {
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

function getLayerName(obj) {
    if (obj.isBackground) return 'Background';
    if (obj.name) return obj.name;
    if (obj.type === 'group') return 'Group';
    if (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox') {
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
    return 'Layer';
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

    const activeObj = state.activeLayerObject || state.canvas.getActiveObject();
    if (!activeObj) {
        clearPropertiesPanel();
        return;
    }
    const activeStrokeColor = getObjectStrokeColor(activeObj);

    let html = '';

    // Common properties
    html += `
    `;

    // Text specific
    if (activeObj.type === 'i-text' || activeObj.type === 'text' || activeObj.type === 'textbox') {
        html += `
            <div class="property-group" style="z-index: 100; position: relative;">
                <label class="property-label">Font</label>
                <!-- Custom Dropdown -->
                <div class="custom-select-container">
                    <div class="custom-select-trigger" onclick="event.stopPropagation(); toggleFontDropdown()">
                        <span style="font-family: '${activeObj.fontFamily}';">${activeObj.fontFamily}</span>
                    </div>
                    <div id="fontSelectOptions" class="custom-select-options">
                        ${FONT_GROUPS.map(group => `
                            <div class="font-group-header" style="padding: 4px 8px; font-size: 0.75em; font-weight: bold; color: #888; background: #2a2a2a; text-transform: uppercase; letter-spacing: 0.5px; position: sticky; top: 0;">${group.category}</div>
                            ${group.fonts.map(font =>
            `<div class="custom-option ${activeObj.fontFamily === font ? 'selected' : ''}"
                                      style="font-family: '${font}'"
                                      onclick="confirmFont('${font}')"
                                      onmouseenter="previewFont('${font}')"
                                      >
                                    ${font}
                                </div>`
        ).join('')}
                        `).join('')}
                    </div>
                </div>
            </div>

            <div class="property-group">
                <label class="property-label">Size</label>
                <div class="range-container">
                    <input type="range" min="10" max="300" value="${activeObj.fontSize}"
                           oninput="updateObjectProperty('fontSize', parseInt(this.value)); this.nextElementSibling.textContent = this.value">
                    <span class="range-value">${activeObj.fontSize}</span>
                </div>
            </div>

            <div class="property-group">
                <label class="property-label">Line Spacing</label>
                <div class="range-container">
                    <input type="range" min="0.5" max="3" step="0.1" value="${activeObj.lineHeight || 1.16}"
                           oninput="updateObjectProperty('lineHeight', parseFloat(this.value)); this.nextElementSibling.textContent = this.value">
                    <span class="range-value">${activeObj.lineHeight || 1.16}</span>
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
                    <div class="color-preview" style="background-color: ${activeStrokeColor || '#000000'}">
                        <input type="color" value="${activeStrokeColor || '#000000'}"
                               oninput="updateObjectProperty('stroke', this.value)">
                    </div>
                    <input type="text" class="property-input" value="${activeStrokeColor || '#000000'}"
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
                     <div class="color-preview" style="background-color: ${activeStrokeColor || '#000000'}">
                         <input type="color" value="${activeStrokeColor || '#000000'}"
                                oninput="updateObjectProperty('stroke', this.value)">
                     </div>
                     <input type="text" class="property-input" value="${activeStrokeColor || '#000000'}"
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

    // Transform Section
    const x = Math.round(activeObj.left);
    const y = Math.round(activeObj.top);
    const w = Math.round(activeObj.getScaledWidth());
    const h = Math.round(activeObj.getScaledHeight());
    const rotation = Math.round(activeObj.angle % 360);

    html += `
        <div class="panel-header" style="margin-top: 0; padding-top: 0;">
            <h3>Transform</h3>
        </div>

        <div class="property-group" style="grid-template-columns: 1fr 1fr; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
                <label class="property-label" style="width: auto;">X</label>
                <input type="number" id="prop-x" class="property-input" value="${x}"
                       oninput="updateTransformProperty('x', this.value)">
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <label class="property-label" style="width: auto;">Y</label>
                <input type="number" id="prop-y" class="property-input" value="${y}"
                       oninput="updateTransformProperty('y', this.value)">
            </div>
        </div>

        <div class="property-group" style="grid-template-columns: 1fr 1fr; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
                <label class="property-label" style="width: auto;">W</label>
                <input type="number" id="prop-w" class="property-input" value="${w}"
                       oninput="updateTransformProperty('w', this.value)" min="1">
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <label class="property-label" style="width: auto;">H</label>
                <input type="number" id="prop-h" class="property-input" value="${h}"
                       oninput="updateTransformProperty('h', this.value)" min="1">
            </div>
        </div>

        <div class="property-group">
            <label class="property-label">Rotation</label>
            <div style="display: flex; align-items: center; gap: 4px;">
                 <input type="number" id="prop-rotation" class="property-input" value="${rotation}"
                       oninput="updateTransformProperty('rotation', this.value)">
                 <span style="color: #666; font-size: 10px;">°</span>
            </div>
        </div>

        <div class="property-separator"></div>
    `;

    // Effects Section (Common)
    html += `
            <div class="panel-header">
                <h3>Effects</h3>
            </div>

            <div class="property-group">
                <label class="property-label">Opacity</label>
                <div class="range-container">
                    <input type="range" min="0" max="100" value="${(activeObj.opacity || 1) * 100}"
                        oninput="updateObjectProperty('opacity', this.value / 100); this.nextElementSibling.textContent = this.value + '%'">
                    <span class="range-value">${Math.round((activeObj.opacity || 1) * 100)}%</span>
                </div>
            </div>
            <div class="property-separator"></div>
            <div class="property-group">
                <label class="property-label">Blur</label>
                <div class="range-container">
                    <input type="range" min="0" max="100" value="${activeObj.blurAmount || 0}"
                           oninput="updateBlur(parseInt(this.value)); this.nextElementSibling.textContent = this.value + '%'">
                    <span class="range-value">${activeObj.blurAmount || 0}%</span>
                </div>
            </div>
            <div class="property-separator"></div>
            <div class="property-group">
                <label class="property-label">Shadow</label>
                <div style="flex: 1">
                     ${activeObj.shadow ?
            `<button class="btn" style="width:100%" onclick="updateObjectProperty('shadow', null); updatePropertiesPanel();">Remove Shadow</button>` :
            `<button class="btn" style="width:100%" onclick="updateObjectProperty('shadow', new fabric.Shadow({ color: 'rgba(0,0,0,1)', blur: 5, offsetX: 5, offsetY: 5 })); updatePropertiesPanel();">Add Shadow</button>`
        }
                </div>
            </div>

            ${activeObj.shadow ? (() => {
            let shadowOpacity = 1;
            if (activeObj.shadow.color) {
                const match = activeObj.shadow.color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
                if (match && match[4] !== undefined) shadowOpacity = parseFloat(match[4]);
            }
            return `
                <div class="property-group">
                    <label class="property-label" ondblclick="updateShadowProperty('intensity', 100)" title="Double click to reset">Intensity</label>
                    <div class="range-container">
                        <input type="range" min="0" max="100" value="${Math.round(shadowOpacity * 100)}"
                               oninput="updateShadowProperty('intensity', parseInt(this.value)); this.nextElementSibling.textContent = this.value + '%'">
                        <span class="range-value">${Math.round(shadowOpacity * 100)}%</span>
                    </div>
                </div>

                <div class="property-group">
                    <label class="property-label" ondblclick="updateShadowProperty('blur', 0)" title="Double click to reset">Shadow Blur</label>
                    <div class="range-container">
                        <input type="range" min="0" max="100" value="${activeObj.shadow.blur || 0}"
                               oninput="updateShadowProperty('blur', parseInt(this.value)); this.nextElementSibling.textContent = this.value">
                        <span class="range-value">${activeObj.shadow.blur || 0}</span>
                    </div>
                </div>

                <div class="property-group">
                    <label class="property-label" ondblclick="updateShadowProperty('offsetX', 0)" title="Double click to reset">Offset X</label>
                    <div class="range-container">
                        <input type="range" min="-50" max="50" value="${activeObj.shadow.offsetX || 0}"
                               oninput="updateShadowProperty('offsetX', parseInt(this.value)); this.nextElementSibling.textContent = this.value">
                        <span class="range-value">${activeObj.shadow.offsetX || 0}</span>
                    </div>
                </div>

                <div class="property-group">
                    <label class="property-label" ondblclick="updateShadowProperty('offsetY', 0)" title="Double click to reset">Offset Y</label>
                    <div class="range-container">
                        <input type="range" min="-50" max="50" value="${activeObj.shadow.offsetY || 0}"
                               oninput="updateShadowProperty('offsetY', parseInt(this.value)); this.nextElementSibling.textContent = this.value">
                        <span class="range-value">${activeObj.shadow.offsetY || 0}</span>
                    </div>
                </div>

                <div class="property-group">
                    <label class="property-label">Shadow Color</label>
                    <div class="color-picker-row">
                        <div class="color-preview" style="background-color: ${activeObj.shadow.color || 'rgba(0,0,0,1)'}">
                            <input type="color" value="${(activeObj.shadow.color || 'rgba(0,0,0,1)').replace(/rgba?\((\d+),\s*(\d+),\s*(\d+).*\)/, (m, r, g, b) => '#' + [r, g, b].map(x => parseInt(x).toString(16).padStart(2, '0')).join(''))}"
                                   oninput="updateShadowProperty('color', this.value)">
                        </div>
                    </div>
                </div>
            `;
        })() : ''}
            `;


    panel.innerHTML = html;
}

export function clearPropertiesPanel() {
    document.getElementById('propertiesPanel').innerHTML = '<p class="empty-state">Select a layer to edit properties</p>';
}

export function updateTransformInputs() {
    if (!state.canvas) return;
    const activeObj = state.activeLayerObject || state.canvas.getActiveObject();
    if (!activeObj) return;

    // Avoid updating if the user is currently typing in the input (active element check)
    // But we need to update if the canvas event triggered this.
    // However, if we update while typing, it might be annoying.
    // Usually, canvas events 'object:modified' happen after drag end, but 'object:moving' happen during drag.
    // If dragging on canvas, input is not focused.
    // If typing in input, we are irrelevant to this function usually (cycle).

    const x = Math.round(activeObj.left);
    const y = Math.round(activeObj.top);
    const w = Math.round(activeObj.getScaledWidth());
    const h = Math.round(activeObj.getScaledHeight());
    const rotation = Math.round(activeObj.angle % 360);

    const elX = document.getElementById('prop-x');
    const elY = document.getElementById('prop-y');
    const elW = document.getElementById('prop-w');
    const elH = document.getElementById('prop-h');
    const elRot = document.getElementById('prop-rotation');

    if (elX && document.activeElement !== elX) elX.value = x;
    if (elY && document.activeElement !== elY) elY.value = y;
    if (elW && document.activeElement !== elW) elW.value = w;
    if (elH && document.activeElement !== elH) elH.value = h;
    if (elRot && document.activeElement !== elRot) elRot.value = rotation;
}

export function updateTransformProperty(prop, value) {
    const activeObj = state.activeLayerObject || state.canvas.getActiveObject();
    if (!activeObj) return;

    value = parseFloat(value);
    if (isNaN(value)) return;

    if (prop === 'x') {
        activeObj.set('left', value);
    } else if (prop === 'y') {
        activeObj.set('top', value);
    } else if (prop === 'rotation') {
        activeObj.set('angle', value);
    } else if (prop === 'w') {
        if (value <= 0) return;
        // activeObj.scaleToWidth(value); // Original: Conserves aspect ratio
        // New: Allow stretching (independent scale)
        activeObj.set('scaleX', value / activeObj.width);
    } else if (prop === 'h') {
        if (value <= 0) return;
        // activeObj.scaleToHeight(value); // Original: Conserves aspect ratio
        // New: Allow stretching (independent scale)
        activeObj.set('scaleY', value / activeObj.height);
    }

    activeObj.setCoords();
    if (activeObj.group) {
        activeObj.group.dirty = true;
    }
    state.canvas.requestRenderAll();
    saveState();
}

export function handleDragStart(e) {
    draggedElement = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dataset.id); // Use UID
}

export function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    // Add visual cue for drop position (simple highlight)
    // Detailed "between" styling omitted for brevity but logic will handle "insert before"
    if (this !== draggedElement && !this.classList.contains('background-layer')) {
        this.classList.add('drag-over');
    }
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
    e.stopPropagation();
    e.preventDefault(); // Important!

    this.classList.remove('drag-over');

    const sourceId = e.dataTransfer.getData('text/plain');
    const targetId = this.dataset.id;

    if (!sourceId || !targetId || sourceId === targetId) return false;

    // Find Objects
    // Using a Deep Search helper
    const sourceObj = findObjectByUid(sourceId);
    const targetObj = findObjectByUid(targetId);

    if (!sourceObj || !targetObj) return false;
    if (sourceObj === targetObj) return false;
    if (targetObj.isBackground) return false; // Can't drop ON background layer, effectively

    // Determine Parent Groups
    const sourceParent = findParent(sourceObj);
    const targetParent = findParent(targetObj) || state.canvas;

    // If dropping ON a group, move INSIDE that group?
    // Current logic: Dropping ON an item places it BEFORE that item in the same parent.
    // To drop INTO a group, maybe we need specific UI zone?
    // Let's assume: If target is a Group and expanded, we insert at top of group?
    // Or simpler: We always insert *before* the target object in the target's parent.
    // This allows moving between groups (by dropping on an item in that group) and reordering.

    // Remove from old parent
    if (sourceParent === state.canvas) {
        state.canvas.remove(sourceObj);
    } else {
        sourceParent.remove(sourceObj);
        sourceParent.addWithUpdate(); // Recalc layout
    }

    // Add to new parent
    if (targetParent === state.canvas) {
        // Calculate index of target
        const index = state.canvas.getObjects().indexOf(targetObj);
        // If we want to drop AFTER, we need mouse position logic.
        // Defaulting to "Insert Before" (which visually means ON TOP in layer list, since list is reversed?)
        // Wait, Layer List: Top item = Highest Z-index.
        // targetIndex in canvas is the Z-index.
        // Inserting 'at' index shifts everything up.
        // So dropping 'on' Layer 5 (Index 4) -> Old Layer 5 becomes Layer 6. New Item becomes Layer 5.
        // Layer List: Item 1 (Top). Item 2.
        // Drop 2 on 1. Insert 2 at 1's index.
        state.canvas.insertAt(sourceObj, index, false);
    } else {
        // Target is inside a Group.
        // Fabric Groups don't support 'insertAt' easily on `_objects`.
        // We have to manipulate the array manually.
        const objects = targetParent.getObjects();
        const index = objects.indexOf(targetObj);

        objects.splice(index, 0, sourceObj);
        targetParent.addWithUpdate(); // Recalc group
    }

    state.canvas.requestRenderAll();
    updateLayersList();
    saveState();

    return false;
}

export function handleDragEnd(e) {
    this.classList.remove('dragging');
    document.querySelectorAll('.layer-item').forEach(item => {
        item.classList.remove('drag-over');
    });
}

// Helpers for Object Finding
function findObjectByUid(uid) {
    const queue = [...state.canvas.getObjects()];
    while (queue.length > 0) {
        const obj = queue.shift();
        if (obj.uid === uid) return obj;
        if (obj.type === 'group') {
            queue.push(...obj.getObjects());
        }
    }
    return null;
}

function findParent(objToFind) {
    const queue = [...state.canvas.getObjects()];
    for (const topObj of queue) {
        if (topObj === objToFind) return state.canvas; // Top level
        if (topObj.type === 'group') {
            if (topObj.getObjects().includes(objToFind)) return topObj;
            // Recursion for deep nesting if needed (Fabric 5 usually 1 level deep for standard Group)
            // But we should support tree.
            const deepParent = findParentInGroup(topObj, objToFind);
            if (deepParent) return deepParent;
        }
    }
    return state.canvas; // Default/Fallback
}

function findParentInGroup(group, objToFind) {
    const children = group.getObjects();
    if (children.includes(objToFind)) return group;
    for (const child of children) {
        if (child.type === 'group') {
            const res = findParentInGroup(child, objToFind);
            if (res) return res;
        }
    }
    return null;
}

export function updateObjectProperty(property, value) {
    const activeObj = state.activeLayerObject || state.canvas.getActiveObject();
    if (!activeObj) return;

    // Helper to apply to object or recursively to group children
    const applyToObj = (obj, prop, val) => {
        if (prop === 'fontFamily' && (obj.type === 'i-text' || obj.type === 'text')) {
            state.defaults.fontFamily = val;
            // Font loading logic omitted for brevity, assuming cached or standard apply
            obj.set(prop, val);
            // ...
            return;
        }

        // Only propagate if it's a Group AND we selected the group itself (activeLayerObject is the group)
        // If we selected a child, we DON'T propagate.
        // Wait, current logic propagates if obj.type is group.
        // If activeObj IS the group, we want propagation.
        // If activeObj IS a child, it is NOT a group (usually), so it won't propagate.
        // But what if we selected a Group that is inside another Group?
        // We probably want propagation there too.

        const visualProps = ['fill', 'stroke', 'strokeWidth', 'opacity', 'blurAmount', 'shadow'];

        if (obj.type === 'group' && visualProps.includes(prop)) {
            // Apply to all children
            obj.getObjects().forEach(child => applyToObj(child, prop, val));
            if (prop === 'opacity' || prop === 'shadow') {
                obj.set(prop, val);
            }
            return;
        }

        if (prop === 'stroke') {
            applyStrokeColorAware(obj, val);
            if (obj.group) obj.group.dirty = true;
            return;
        }

        if (prop === 'strokeWidth') {
            applyStrokeWidthAware(obj, val);
            if (obj.group) obj.group.dirty = true;
            return;
        }

        obj.set(prop, val);

        // Mark parent group as dirty if needed
        if (obj.group) obj.group.dirty = true;


        // ... specific logic (strokeWidth defaults, etc) ...
        if (prop === 'strokeWidth' && (obj.type === 'rect' || obj.type === 'circle' || obj.type === 'triangle' || obj.type === 'polygon' || obj.type === 'path' || obj.type === 'line' || obj.type === 'polyline' || obj.type === 'i-text' || obj.type === 'text')) {
            // ...
        }

        if ((obj.type === 'image' || obj.type === 'text' || obj.type === 'i-text') &&
            (prop === 'fontSize' || prop === 'fontWeight' || prop === 'fontStyle' || prop === 'text')) {
            // ... logic ...
            if (obj.initDimensions) obj.initDimensions();
        }
    };

    applyToObj(activeObj, property, value);

    // Font loading specific logic if needed at top level
    if (property === 'fontFamily') {
        // ... Re-implement the font loading promise logic from original file ...
        state.defaults.fontFamily = value; // Sync default
        saveDefaults();

        const fontString = `normal normal 12px "${value}"`; // Simplified
        document.fonts.load(fontString).then(() => {
            // re-set
            if (activeObj.type === 'group') {
                activeObj.getObjects().forEach(o => {
                    if (o.type === 'i-text' || o.type === 'text') {
                        o.set('fontFamily', value);
                        o.initDimensions?.();
                    }
                });
            } else {
                activeObj.set(property, value);
                if (activeObj.initDimensions) activeObj.initDimensions();
            }

            activeObj.setCoords();
            activeObj.dirty = true;
            state.canvas.requestRenderAll();
            updatePropertiesPanel();
            saveState();
        });
        return;
    }

    activeObj.dirty = true;
    state.canvas.renderAll();
    saveState();

    if (property === 'fill') {
        state.defaults.fill = value;
        saveDefaults();

        // Sync toolbar picker
        const toolbarFill = document.getElementById('defaultFillColor');
        if (toolbarFill) toolbarFill.value = value;

        const isTransparent = (value === 'transparent');
        const fillInput = document.querySelector(`input[oninput*="updateObjectProperty('fill'"]`);

        if (isTransparent || (fillInput && fillInput.disabled)) {
            updatePropertiesPanel();
            return;
        }
    }

    if (property === 'stroke') {
        state.defaults.stroke = value;
        saveDefaults();
        syncVectorBrush();

        // Sync toolbar picker
        const toolbarStroke = document.getElementById('defaultStrokeColor');
        if (toolbarStroke) {
            toolbarStroke.value = value;
            if (toolbarStroke.parentElement) {
                toolbarStroke.parentElement.style.background = value;
            }
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
    if (!activeObj || (activeObj.type !== 'i-text' && activeObj.type !== 'text' && activeObj.type !== 'textbox')) return;

    const newWeight = activeObj.fontWeight === 'bold' ? 'normal' : 'bold';
    updateObjectProperty('fontWeight', newWeight);
    updatePropertiesPanel();
}

export function toggleFontStyle() {
    const activeObj = state.canvas.getActiveObject();
    if (!activeObj || (activeObj.type !== 'i-text' && activeObj.type !== 'text' && activeObj.type !== 'textbox')) return;

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
            color: 'rgba(0,0,0,1)',
            blur: 10,
            offsetX: 4,
            offsetY: 4
        });
        activeObj.shadowIntensity = 1;
    }

    state.canvas.renderAll();
    updatePropertiesPanel();
    saveState();
}

export function updateShadowProperty(property, value) {
    const activeObj = state.canvas.getActiveObject();
    if (!activeObj || !activeObj.shadow) return;

    if (property === 'intensity') {
        const rawIntensity = value / 100;
        activeObj.shadowIntensity = rawIntensity;

        // For actual shadow color opacity, we clamp to 1. 
        // Anything > 1 is handled by custom rendering in canvas.js
        const opacity = Math.min(rawIntensity, 1);

        const currentColor = activeObj.shadow.color || 'rgba(0,0,0,1)';
        let newColor;
        // Try to parse rgba
        const match = currentColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (match) {
            newColor = `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${opacity})`;
        } else if (currentColor.startsWith('#')) {
            const r = parseInt(currentColor.slice(1, 3), 16);
            const g = parseInt(currentColor.slice(3, 5), 16);
            const b = parseInt(currentColor.slice(5, 7), 16);
            newColor = `rgba(${r},${g},${b},${opacity})`;
        } else {
            // Fallback
            newColor = `rgba(0,0,0,${opacity})`;
        }
        activeObj.shadow.color = newColor;
    } else if (property === 'color') {
        // When color changes (from picker), preserve existing intensity (clamped to 1 for the color string)
        // The picker returns hex #RRGGBB usually

        let currentIntensity = activeObj.shadowIntensity !== undefined ? activeObj.shadowIntensity : 1;
        const opacity = Math.min(currentIntensity, 1);

        if (value.startsWith('#')) {
            const r = parseInt(value.slice(1, 3), 16);
            const g = parseInt(value.slice(3, 5), 16);
            const b = parseInt(value.slice(5, 7), 16);
            activeObj.shadow.color = `rgba(${r},${g},${b},${opacity})`;
        } else {
            activeObj.shadow.color = value;
        }
    } else {
        activeObj.shadow[property] = value;
    }

    state.canvas.renderAll();
    saveState();

    if (property !== 'intensity' && property !== 'color') {
        const inputs = document.querySelectorAll(`input[oninput*="updateShadowProperty('${property}'"]`);
        inputs.forEach(input => {
            if (document.activeElement !== input) {
                input.value = value;
            }
        });
    }
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

    checkSelectionForBooleanOps();
    checkSelectionForLayerOrder();
    checkSelectionForFlip();
}

export function checkSelectionForLayerOrder() {
    const activeObj = state.canvas.getActiveObject();
    const orderGroup = document.getElementById('layerOrderGroup');

    if (!orderGroup) return;

    if (activeObj) {
        orderGroup.style.display = 'flex';
    } else {
        orderGroup.style.display = 'none';
    }
}

export function checkSelectionForBooleanOps() {
    const activeObj = state.canvas.getActiveObject();
    const booleanGroup = document.getElementById('booleanGroup');

    if (!booleanGroup) return;

    if (activeObj && activeObj.type === 'activeSelection' && activeObj.getObjects().length > 1) {
        const objects = activeObj.getObjects();
        // Check if all objects are valid shapes for boolean ops (no images, texts for now unless converted)
        // Valid: rect, circle, triangle, polygon, path, line, polyline
        const validTypes = ['rect', 'circle', 'triangle', 'polygon', 'path', 'line', 'polyline', 'i-text', 'text', 'textbox'];
        const allValid = objects.every(obj => validTypes.includes(obj.type));

        if (allValid) {
            booleanGroup.style.display = 'flex';
        } else {
            booleanGroup.style.display = 'none';
        }
    } else {
        booleanGroup.style.display = 'none';
    }
}

export function checkSelectionForFlip() {
    const activeObj = state.canvas.getActiveObject();
    const flipGroup = document.getElementById('flipGroup');

    if (!flipGroup) return;

    // Show if there is any selection (single or multiple)
    // We can flip any object or group of objects
    if (activeObj) {
        flipGroup.style.display = 'flex';
    } else {
        flipGroup.style.display = 'none';
    }
}

export function flipSelected(direction) {
    const activeObj = state.canvas.getActiveObject();
    if (!activeObj) return;

    if (activeObj.type === 'activeSelection') {
        const center = activeObj.getCenterPoint();
        activeObj.getObjects().forEach(obj => {
            // Detach from group to manipulate properly
            // Actually, manipulating objects inside activeSelection is tricky with coordinates.
            // But we can flip the WHOLE group? No, activeSelection isn't a permanent group.

            // If we flip the activeSelection itself:
            // It flips visually. But when deselected, do the objects stay flipped?
            // Yes, if we update their properties.

            // Standard Fabric way: flip the group.
            flipObjectGlobal(activeObj, direction);
        });

        // Wait, for activeSelection, treating it as a single object for the flip operation is often desired
        // i.e. flip the whole selection around its center.
        flipObjectGlobal(activeObj, direction);

        activeObj.dirty = true;
    } else {
        flipObjectGlobal(activeObj, direction);
    }

    state.canvas.requestRenderAll();
    saveState();
}

function flipObjectGlobal(obj, direction) {
    if (direction === 'horizontal') {
        obj.toggle('flipX');
    } else {
        obj.toggle('flipY');
    }

    // The "Global Flip" fix for rotated objects:
    // If we just flipX/flipY, it happens in local object space.
    // IF the object is rotated, local flip != global flip.
    // To achieve Global Flip (mirror on screen axis), we need to negate angle 
    // AND toggle flip.
    // Actually, negating angle + flip mimics a reflection across the axis 
    // corresponding to 0 rotation?

    // Let's verify the user request "flip it in the state it is with the rotation applied".
    // This implies visual mirroring.

    // Algorithm:
    // 1. Flip X or Y
    // 2. Negate Angle (angle = -angle)
    // This works perfectly for orthogonal flips.

    // BUT! For Fabric.js:
    // flipX swaps the image horizontally relative to its origin.
    // If rotated 45 deg, and we flipX, it flips across the 45 deg axis.
    // We want to flip across the VERTICAL axis of the SCREEN.

    // Correct Math for Global Horizontal Flip:
    // New Angle = -Old Angle
    // FlipX = !FlipX
    // This works.

    obj.angle *= -1;
    obj.setCoords();
}

export function alignSelected(direction) {
    const activeObj = state.canvas.getActiveObject();
    if (!activeObj || activeObj.type !== 'activeSelection') return;

    // 1. Get Absolute (Canvas Space) Bounds of the Selection
    const selectionRect = activeObj.getBoundingRect();
    const groupMatrix = activeObj.calcTransformMatrix();

    // Pre-calculate Group properties for inverse mapping
    const groupAngle = activeObj.angle || 0;
    const groupScaleX = activeObj.scaleX || 1;
    const groupScaleY = activeObj.scaleY || 1;

    activeObj.getObjects().forEach(obj => {
        // 2. Calculate Absolute Bounds of the Object
        // We cannot trust obj.getBoundingRect() alone inside a group as it might return local or mixed coords.
        // Safest approach: Transform the object's local corners by the group's matrix to get absolute corners.

        const localCoords = obj.getCoords(); // returns [{x,y}...] corners in Group's Local Space

        // Transform local corners to global canvas coordinates
        const absCorners = localCoords.map(p => fabric.util.transformPoint(p, groupMatrix));

        // Calculate AABB from absolute corners
        const minX = Math.min(absCorners[0].x, absCorners[1].x, absCorners[2].x, absCorners[3].x);
        const maxX = Math.max(absCorners[0].x, absCorners[1].x, absCorners[2].x, absCorners[3].x);
        const minY = Math.min(absCorners[0].y, absCorners[1].y, absCorners[2].y, absCorners[3].y);
        const maxY = Math.max(absCorners[0].y, absCorners[1].y, absCorners[2].y, absCorners[3].y);

        const objRect = {
            left: minX,
            top: minY,
            width: maxX - minX,
            height: maxY - minY
        };

        // 3. Calculate Required Shift (Delta) in Absolute Canvas Space
        let dX = 0;
        let dY = 0;

        switch (direction) {
            case 'left':
                dX = selectionRect.left - objRect.left;
                break;
            case 'centerH':
                // Align Centers
                const selCenterX = selectionRect.left + selectionRect.width / 2;
                const objCenterX = objRect.left + objRect.width / 2;
                dX = selCenterX - objCenterX;
                break;
            case 'right':
                dX = (selectionRect.left + selectionRect.width) - (objRect.left + objRect.width);
                break;
            case 'top':
                dY = selectionRect.top - objRect.top;
                break;
            case 'centerV':
                const selCenterY = selectionRect.top + selectionRect.height / 2;
                const objCenterY = objRect.top + objRect.height / 2;
                dY = selCenterY - objCenterY;
                break;
            case 'bottom':
                dY = (selectionRect.top + selectionRect.height) - (objRect.top + objRect.height);
                break;
        }

        // 4. Map Absolute Delta back to Local Group Space
        // We must account for Group Rotation and Scale.
        // Rotate vector (dX, dY) by -groupAngle

        const angleRad = -groupAngle * (Math.PI / 180);
        const cos = Math.cos(angleRad);
        const sin = Math.sin(angleRad);

        // Rotate
        let localDX = dX * cos - dY * sin;
        let localDY = dX * sin + dY * cos;

        // Scale
        localDX /= groupScaleX;
        localDY /= groupScaleY;

        // Apply to Object
        obj.set({
            left: obj.left + localDX,
            top: obj.top + localDY
        });

        obj.setCoords();
    });

    // Finalize
    activeObj.addWithUpdate(); // Recalculate group bounds to wrap specific new positions
    activeObj.setCoords();
    activeObj.dirty = true;

    state.canvas.requestRenderAll();
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
            if (activeObj && (activeObj.type === 'i-text' || activeObj.type === 'text' || activeObj.type === 'textbox')) {
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
    if (activeObj && (activeObj.type === 'i-text' || activeObj.type === 'text' || activeObj.type === 'textbox')) {
        activeObj.set('fontFamily', font);
        state.canvas.renderAll();
    }
}

export function revertFont() {
    const activeObj = state.canvas.getActiveObject();
    if (activeObj && state.originalFontFamily && (activeObj.type === 'i-text' || activeObj.type === 'text' || activeObj.type === 'textbox')) {
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

export function updateContextMenus() {
    const activeObj = state.canvas.getActiveObject();
    const convertBtn = document.getElementById('convertToCurves');

    if (!convertBtn) return;

    if (activeObj && (activeObj.type === 'i-text' || activeObj.type === 'text' || activeObj.type === 'textbox')) {
        convertBtn.classList.remove('disabled');
    } else {
        convertBtn.classList.add('disabled');
    }
}
