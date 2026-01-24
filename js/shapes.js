import { state } from './state.js';
import { updatePropertiesPanel } from './interface.js';
import { saveState } from './project.js';

export function addRectangle() {
    const rect = new fabric.Rect({
        left: state.canvas.width / 2 - 100,
        top: state.canvas.height / 2 - 75,
        width: 200,
        height: 150,
        fill: state.defaults.fill,
        strokeWidth: state.defaults.strokeWidth,
        stroke: state.defaults.stroke,
        strokeUniform: true,
        rx: 0,
        ry: 0,
        uniformRadius: 0,
        blurAmount: 0,
        objectCaching: true
    });
    state.canvas.add(rect);
    state.canvas.setActiveObject(rect);
    state.canvas.renderAll();
}

export function addCircle() {
    const circle = new fabric.Circle({
        left: state.canvas.width / 2 - 75,
        top: state.canvas.height / 2 - 75,
        radius: 75,
        fill: state.defaults.fill,
        strokeWidth: state.defaults.strokeWidth,
        stroke: state.defaults.stroke,
        strokeUniform: true,
        blurAmount: 0,
        objectCaching: true
    });
    state.canvas.add(circle);
    state.canvas.setActiveObject(circle);
    state.canvas.renderAll();
}

export function addTriangle() {
    const triangle = new fabric.Triangle({
        left: state.canvas.width / 2,
        top: state.canvas.height / 2,
        width: 150,
        height: 150,
        fill: state.defaults.fill,
        strokeWidth: state.defaults.strokeWidth,
        stroke: state.defaults.stroke,
        strokeUniform: true,
        originX: 'center',
        originY: 'center',
        blurAmount: 0,
        objectCaching: true
    });
    state.canvas.add(triangle);
    state.canvas.setActiveObject(triangle);
    state.canvas.renderAll();
}

export function addStar() {
    const spikes = 5;
    const outerRadius = 75;
    const innerRadius = 35;
    const points = generateStarPoints(spikes, outerRadius, innerRadius);

    const star = new fabric.Polygon(points, {
        left: state.canvas.width / 2,
        top: state.canvas.height / 2,
        fill: state.defaults.fill,
        strokeWidth: state.defaults.strokeWidth,
        stroke: state.defaults.stroke,
        strokeUniform: true,
        originX: 'center',
        originY: 'center',
        starSpikes: spikes,
        outerRadius: outerRadius,
        innerRadius: innerRadius,
        shapeType: 'star',
        blurAmount: 0,
        objectCaching: true
    });
    state.canvas.add(star);
    state.canvas.setActiveObject(star);
    state.canvas.renderAll();
}

export function addPolygon() {
    const sides = 6;
    const radius = 75;
    const points = generatePolygonPoints(sides, radius);

    const polygon = new fabric.Polygon(points, {
        left: state.canvas.width / 2,
        top: state.canvas.height / 2,
        fill: state.defaults.fill,
        strokeWidth: state.defaults.strokeWidth,
        stroke: state.defaults.stroke,
        strokeUniform: true,
        originX: 'center',
        originY: 'center',
        polygonSides: sides,
        polygonRadius: radius,
        shapeType: 'polygon',
        blurAmount: 0,
        objectCaching: true
    });
    state.canvas.add(polygon);
    state.canvas.setActiveObject(polygon);
    state.canvas.renderAll();
}

export function generateStarPoints(spikes, outerRadius, innerRadius) {
    const points = [];
    for (let i = 0; i < spikes * 2; i++) {
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const angle = (i * Math.PI) / spikes - Math.PI / 2;
        points.push({
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius
        });
    }
    return points;
}

export function generatePolygonPoints(sides, radius) {
    const points = [];
    for (let i = 0; i < sides; i++) {
        const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
        points.push({
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius
        });
    }
    return points;
}

export function applyImageCornerRadius(img) {
    if (!img) return;

    if (img._borderOverlay) {
        if (state.canvas.contains(img._borderOverlay)) {
            state.canvas.remove(img._borderOverlay);
        }
        img._borderOverlay = null;
    }

    if (!img.cornerRadius || img.cornerRadius === 0) {
        img.clipPath = null;
        img.stroke = img.imgStroke || img.stroke || '#000000';
        const sWidth = (img.imgStrokeWidth !== undefined) ? img.imgStrokeWidth : (img.strokeWidth || 0);
        img.strokeWidth = sWidth;
        img.strokeUniform = true;

        if (img._originalRender) {
            img._render = img._originalRender;
            delete img._originalRender;
        }

        img.dirty = true;
        state.canvas.renderAll();
        return;
    }

    const scaleX = img.scaleX || 1;
    const scaleY = img.scaleY || 1;
    const avgScale = (scaleX + scaleY) / 2;
    const rawRadius = img.cornerRadius / avgScale;

    const limit = Math.min(img.width, img.height) / 2;
    const effectiveRadius = Math.min(rawRadius, limit);

    img.clipPath = new fabric.Rect({
        left: -img.width / 2,
        top: -img.height / 2,
        width: img.width,
        height: img.height,
        rx: effectiveRadius,
        ry: effectiveRadius
    });

    img.strokeWidth = 0;

    if (!img._originalRender) {
        img._originalRender = img._render;
    }

    img._render = function (ctx) {
        if (this._originalRender) {
            this._originalRender.call(this, ctx);
        }

        const iStrokeWidth = (this.imgStrokeWidth !== undefined) ? this.imgStrokeWidth : 0;

        if (iStrokeWidth > 0) {
            const iScaleX = this.scaleX || 1;
            const iScaleY = this.scaleY || 1;
            const iAvgScale = (iScaleX + iScaleY) / 2;
            const iColor = this.imgStroke || this.stroke || '#000000';

            const iRawRadius = (this.cornerRadius || 0) / iAvgScale;
            const iLimit = Math.min(this.width, this.height) / 2;
            const rx = Math.min(iRawRadius, iLimit);

            ctx.save();
            ctx.lineWidth = iStrokeWidth / iAvgScale;
            ctx.strokeStyle = iColor;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            ctx.beginPath();
            const w = this.width;
            const h = this.height;
            const x = -w / 2;
            const y = -h / 2;

            ctx.beginPath();
            ctx.moveTo(x + rx, y);
            ctx.lineTo(x + w - rx, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + rx);
            ctx.lineTo(x + w, y + h - rx);
            ctx.quadraticCurveTo(x + w, y + h, x + w - rx, y + h);
            ctx.lineTo(x + rx, y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - rx);
            ctx.lineTo(x, y + rx);
            ctx.quadraticCurveTo(x, y, x + rx, y);
            ctx.closePath();

            ctx.stroke();
            ctx.restore();
        }
    };

    img.dirty = true;
    state.canvas.renderAll();
}

export function applyBlur(obj, blurValue) {
    if (!obj) return;

    const nativeSupport = window.supportsCanvasFilter;

    if (nativeSupport === false && obj.type === 'image') {
        obj.filters = obj.filters || [];
        const blurIndex = obj.filters.findIndex(f => f instanceof fabric.Image.filters.Blur);

        if (blurValue > 0) {
            const fabricBlurVal = blurValue / 100;
            const fabricBlur = new fabric.Image.filters.Blur({
                blur: fabricBlurVal
            });

            if (blurIndex > -1) {
                obj.filters[blurIndex] = fabricBlur;
            } else {
                obj.filters.push(fabricBlur);
            }
        } else {
            if (blurIndex > -1) {
                obj.filters.splice(blurIndex, 1);
            }
        }

        obj.applyFilters();
        obj.dirty = true;
        state.canvas.renderAll();
        return;
    }

    obj.blurAmount = blurValue;

    const hasCornerRadius = (obj.type === 'image' && obj.cornerRadius && obj.cornerRadius > 0);

    if (blurValue > 0 || hasCornerRadius) {
        obj.objectCaching = false;
    } else {
        obj.objectCaching = true;
    }

    obj.dirty = true;
    state.canvas.renderAll();
}

export function updatePolygonDimensions(obj, newPoints) {
    // Calculate bounding box of the new points
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    newPoints.forEach(p => {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
    });

    const width = maxX - minX;
    const height = maxY - minY;

    // Offset points to be relative to top-left corner
    const offsetPoints = newPoints.map(p => ({
        x: p.x - minX,
        y: p.y - minY
    }));

    // Update the object with new points and dimensions
    obj.set({
        points: offsetPoints,
        width: width,
        height: height,
        pathOffset: {
            x: width / 2,
            y: height / 2
        }
    });

    // Recalculate coordinates
    obj.setCoords();
}

export function updateStarPoints(spikes) {
    const activeObj = state.canvas.getActiveObject();
    if (!activeObj || activeObj.shapeType !== 'star') return;

    const outerRadius = activeObj.outerRadius || 75;
    const innerRadius = activeObj.innerRadius || 35;
    const points = generateStarPoints(spikes, outerRadius, innerRadius);

    updatePolygonDimensions(activeObj, points);
    activeObj.set({ starSpikes: spikes });

    state.canvas.renderAll();
    updatePropertiesPanel();
    saveState();
}

export function updateStarOuterRadius(radius) {
    const activeObj = state.canvas.getActiveObject();
    if (!activeObj || activeObj.shapeType !== 'star') return;

    const spikes = activeObj.starSpikes || 5;
    const innerRadius = activeObj.innerRadius || 35;
    const points = generateStarPoints(spikes, radius, innerRadius);

    updatePolygonDimensions(activeObj, points);
    activeObj.set({ outerRadius: radius });

    state.canvas.renderAll();
    saveState();
}

export function updateStarInnerRadius(radius) {
    const activeObj = state.canvas.getActiveObject();
    if (!activeObj || activeObj.shapeType !== 'star') return;

    const spikes = activeObj.starSpikes || 5;
    const outerRadius = activeObj.outerRadius || 75;
    const points = generateStarPoints(spikes, outerRadius, radius);

    updatePolygonDimensions(activeObj, points);
    activeObj.set({ innerRadius: radius });

    state.canvas.renderAll();
    saveState();
}

export function updatePolygonSides(sides) {
    const activeObj = state.canvas.getActiveObject();
    if (!activeObj || activeObj.shapeType !== 'polygon') return;

    const radius = activeObj.polygonRadius || 75;
    const points = generatePolygonPoints(sides, radius);

    updatePolygonDimensions(activeObj, points);
    activeObj.set({ polygonSides: sides });

    state.canvas.renderAll();
    updatePropertiesPanel();
    saveState();
}

export function updatePolygonRadius(radius) {
    const activeObj = state.canvas.getActiveObject();
    if (!activeObj || activeObj.shapeType !== 'polygon') return;

    const sides = activeObj.polygonSides || 6;
    const points = generatePolygonPoints(sides, radius);

    updatePolygonDimensions(activeObj, points);
    activeObj.set({ polygonRadius: radius });


    state.canvas.renderAll();
    saveState();
}
