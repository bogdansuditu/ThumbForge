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
    isSnappedToStart: false
};