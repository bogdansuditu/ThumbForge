export const AVAILABLE_FONTS = [];

export const FONT_GROUPS = [
    {
        category: 'Sans Serif / Modern',
        fonts: ['Roboto', 'Inter', 'Open Sans', 'Lato', 'Poppins', 'Oswald', 'Montserrat', 'Raleway', 'Ubuntu']
    },
    {
        category: 'Serif / Old School',
        fonts: ['Merriweather', 'Playfair Display', 'Marcellus', 'Italiana', 'Bodoni Moda', 'Noto Serif', 'Libre Baskerville', 'Josefin Slab']
    },
    {
        category: 'Display / Poster / Bold',
        fonts: ['Anton', 'Bebas Neue', 'Archivo Black', 'Black Ops One', 'Faster One']
    },
    {
        category: 'Horror / Rough',
        fonts: ['Creepster', 'Nosifer', 'Eater', 'Butcherman', 'Rubik Glitch', 'Rock Salt']
    },
    {
        category: 'Handwriting / Script / Cursive',
        fonts: ['Pacifico', 'Dancing Script', 'Great Vibes', 'Satisfy', 'Allura', 'Permanent Marker', 'Rubik Marker Hatch', 'Sedgwick Ave Display']
    },
    {
        category: 'Decorative / Historical / Fantasy',
        fonts: ['Lobster', 'Uncial Antiqua', 'Cinzel Decorative', 'IM Fell English', 'Pirata One', 'MedievalSharp']
    }
];

export const MAX_HISTORY = 50;


export const CUSTOM_PROPS = [
    'id', 'uid', 'name', 'isBackground',
    'starSpikes', 'outerRadius', 'innerRadius',
    'polygonSides', 'polygonRadius', 'shapeType',
    'uniformRadius', 'cornerRadius',
    'imgStrokeWidth', 'imgStroke',
    'blurAmount', 'blurShadow',
    'lockMovementX', 'lockMovementY', 'lockScalingX', 'lockScalingY', 'lockRotation',
    'visible', 'selectable', 'evented'
];

export async function loadAvailableFonts() {
    try {
        const response = await fetch('fonts/fonts.json');
        if (!response.ok) throw new Error(`Failed to load fonts manifest: ${response.status}`);
        const fonts = await response.json();

        // Clear and populate array strictly (keeping reference)
        AVAILABLE_FONTS.length = 0;
        AVAILABLE_FONTS.push(...fonts);

        console.log(`[Config] Loaded ${AVAILABLE_FONTS.length} fonts dynamically.`);
    } catch (e) {
        console.error("[Config] Error loading dynamic fonts:", e);
        // Fail silently or maybe alert user? For now just log usage.
        // User explicitly requested NO hardcoded fonts.
    }
}
