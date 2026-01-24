// Global State
export const state = {
    canvas: null,
    currentTool: 'select',
    history: [],
    historyStep: -1,
    isDrawingPath: false,
    pathPoints: [],
    tempPathLine: null,
    backgroundColor: '#ffffff',
    backgroundOpacity: 1.0,
    backgroundSelected: false,
    autoSaveTimeout: null,
    originalFontFamily: null,
    isFontPreviewing: false,
    currentZoom: 1.0,
    isFontPreviewing: false,
    currentZoom: 1.0,
    closeLines: false,
    pathNodes: [],
    isDraggingNode: false,
    dragStartPoint: null,
    isSnappedToStart: false,
    defaults: {
        fill: '#ffffff',
        stroke: '#000000',
        strokeWidth: 1,
        backgroundColor: '#808080',
        fontFamily: 'Lato'
    }
};

// Load defaults from local storage if available
const savedDefaults = localStorage.getItem('thumbforge_defaults');
if (savedDefaults) {
    try {
        const parsed = JSON.parse(savedDefaults);
        state.defaults = { ...state.defaults, ...parsed };
        state.backgroundColor = state.defaults.backgroundColor; // Ensure initial background matches default
    } catch (e) {
        console.error('Failed to parse saved defaults', e);
    }
} else {
    // First run defaults
    state.backgroundColor = state.defaults.backgroundColor;
}

export function saveDefaults() {
    localStorage.setItem('thumbforge_defaults', JSON.stringify(state.defaults));
}