const fs = require('fs');
const path = require('path');
const https = require('https');

// Fonts from js/config.js
const AVAILABLE_FONTS = [
    // Standard (System fonts - skipped for download but listed for checking)
    'Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Comic Sans MS', 'Verdana', 'Georgia', 'Trebuchet MS', 'Impact',

    // Google Fonts - Sans Serif / Modern
    'Roboto', 'Open Sans', 'Lato', 'Poppins', 'Oswald', 'Montserrat', 'Raleway', 'Ubuntu', 'Merriweather', 'Playfair Display',

    // Display / Poster / Bold
    'Anton', 'Bebas Neue', 'Archivo Black', 'Black Ops One', 'Faster One',

    // Horror / Rough
    'Creepster', 'Nosifer', 'Eater', 'Butcherman', 'Rubik Glitch', 'Rock Salt',

    // Handwriting / Script / Cursive
    'Pacifico', 'Dancing Script', 'Great Vibes', 'Satisfy', 'Allura', 'Permanent Marker', 'Rubik Marker Hatch', 'Sedgwick Ave Display',

    // Decorative / Historical / Fantasy
    'Lobster', 'Uncial Antiqua', 'Cinzel Decorative', 'IM Fell English', 'Pirata One', 'MedievalSharp'
];

const FONTS_DIR = path.join(process.cwd(), 'fonts');
const CSS_FILE = path.join(FONTS_DIR, 'fonts.css');

// Ensure fonts directory exists
if (!fs.existsSync(FONTS_DIR)) {
    fs.mkdirSync(FONTS_DIR, { recursive: true });
}

// System fonts to skip (GWFH won't have them)
const SYSTEM_FONTS = ['Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Comic Sans MS', 'Verdana', 'Georgia', 'Trebuchet MS', 'Impact'];

let cssContent = '/* Auto-generated local fonts */\n\n';

async function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                file.close();
                fs.unlink(dest, () => { }); // Delete partial file
                reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => { });
            reject(err);
        });
    });
}

function slugify(text) {
    return text.toString().toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}

async function processFont(family) {
    if (SYSTEM_FONTS.includes(family)) {
        console.log(`Skipping system font: ${family}`);
        return;
    }

    const id = slugify(family);
    const apiUrl = `https://gwfh.mranftl.com/api/fonts/${id}`;

    try {
        const response = await new Promise((resolve, reject) => {
            https.get(apiUrl, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(JSON.parse(data)));
                res.on('error', reject);
            });
        });

        console.log(`Processing ${family}...`);

        // We want specific variants: regular(400), 700, italics
        // Filter for variants we care about
        const variantsToDownload = response.variants.filter(v => {
            const w = String(v.fontWeight);
            // Grab regular (400), bold (700), and their italics.
            // Also grab 300 (Light) or 900 (Black) if popular, but let's stick to standard set + basic matching
            return w === '400' || w === '700' || w === '300' || w === '900';
        });

        for (const v of variantsToDownload) {
            const weight = v.fontWeight;
            const style = v.fontStyle; // 'normal' or 'italic'

            // Convert to simple suffix
            let suffix = 'Regular';
            if (weight == 700 && style === 'normal') suffix = 'Bold';
            else if (weight == 700 && style === 'italic') suffix = 'BoldItalic';
            else if (weight == 400 && style === 'italic') suffix = 'Italic';
            else if (weight == 300 && style === 'normal') suffix = 'Light';
            else if (weight == 300 && style === 'italic') suffix = 'LightItalic';
            else if (weight == 900) suffix = style === 'italic' ? 'BlackItalic' : 'Black';
            else if (weight == 400) suffix = 'Regular';
            else suffix = `${weight}${style === 'italic' ? 'Italic' : ''}`;

            const filename = `${family.replace(/\s+/g, '')}-${suffix}.ttf`;
            const destPath = path.join(FONTS_DIR, filename);

            if (!fs.existsSync(destPath)) {
                await downloadFile(v.ttf, destPath);
                console.log(`  Downloaded ${filename}`);
            } else {
                console.log(`  Exists ${filename}`);
            }

            // Append to CSS
            cssContent += `@font-face {
    font-family: '${family}';
    src: url('${filename}') format('truetype');
    font-weight: ${weight};
    font-style: ${style};
}\n`;
        }

    } catch (e) {
        console.error(`Error processing ${family}:`, e.message);
    }
}

async function main() {
    for (const font of AVAILABLE_FONTS) {
        await processFont(font);
    }

    fs.writeFileSync(CSS_FILE, cssContent);
    console.log(`\nAll done! CSS written to ${CSS_FILE}`);
}

main();
