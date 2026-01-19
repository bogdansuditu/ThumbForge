export function checkLayerLevelBlurSupport() {
    // Robust browser support test
    const testCanvas = document.createElement('canvas');
    const testCtx = testCanvas.getContext('2d');
    let supportsFilter = false;
    if (typeof testCtx.filter !== 'undefined') {
        testCtx.filter = 'blur(5px)';
        supportsFilter = (testCtx.filter !== 'none' && testCtx.filter !== undefined);
    }

    // Export support flag
    window.supportsCanvasFilter = supportsFilter;
    console.log('Canvas Filter Support:', supportsFilter);

    return supportsFilter;
}
