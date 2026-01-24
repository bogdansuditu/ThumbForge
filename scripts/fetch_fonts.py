import os
import json
import urllib.request
import urllib.error

# Fonts from js/config.js
AVAILABLE_FONTS = [
    # Standard (System fonts - skipped for download but listed for checking)
    'Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Comic Sans MS', 'Verdana', 'Georgia', 'Trebuchet MS', 'Impact',

    # Google Fonts - Sans Serif / Modern
    'Roboto', 'Open Sans', 'Lato', 'Poppins', 'Oswald', 'Montserrat', 'Raleway', 'Ubuntu', 'Merriweather', 'Playfair Display',

    # Display / Poster / Bold
    'Anton', 'Bebas Neue', 'Archivo Black', 'Black Ops One', 'Faster One',

    # Horror / Rough
    'Creepster', 'Nosifer', 'Eater', 'Butcherman', 'Rubik Glitch', 'Rock Salt',

    # Handwriting / Script / Cursive
    'Pacifico', 'Dancing Script', 'Great Vibes', 'Satisfy', 'Allura', 'Permanent Marker', 'Rubik Marker Hatch', 'Sedgwick Ave Display',

    # Decorative / Historical / Fantasy
    'Lobster', 'Uncial Antiqua', 'Cinzel Decorative', 'IM Fell English', 'Pirata One', 'MedievalSharp'
]

SYSTEM_FONTS = ['Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Comic Sans MS', 'Verdana', 'Georgia', 'Trebuchet MS', 'Impact']

FONTS_DIR = os.path.join(os.getcwd(), 'fonts')
CSS_FILE = os.path.join(FONTS_DIR, 'fonts.css')

if not os.path.exists(FONTS_DIR):
    os.makedirs(FONTS_DIR)

css_content = "/* Auto-generated local fonts */\n\n"

def slugify(text):
    text = text.lower().replace(' ', '-')
    return text

def download_file(url, dest):
    try:
        with urllib.request.urlopen(url) as response, open(dest, 'wb') as out_file:
            data = response.read()
            out_file.write(data)
        return True
    except Exception as e:
        print(f"Failed to download {url}: {e}")
        return False

def process_font(family):
    if family in SYSTEM_FONTS:
        print(f"Skipping system font: {family}")
        return

    font_id = slugify(family)
    api_url = f"https://gwfh.mranftl.com/api/fonts/{font_id}"

    try:
        print(f"Processing {family}...")
        with urllib.request.urlopen(api_url) as response:
            data = json.loads(response.read().decode())

        # Filter variants
        variants = data.get('variants', [])
        
        # We want: 400, 700, 300, 900
        # And italics
        target_weights = [400, 700, 300, 900]
        
        for v in variants:
            weight = int(v['fontWeight'])
            style = v['fontStyle'] # 'normal' or 'italic'
            
            if weight not in target_weights:
                continue

            # Determine suffix for filename
            suffix = 'Regular'
            if weight == 700 and style == 'normal': suffix = 'Bold'
            elif weight == 700 and style == 'italic': suffix = 'BoldItalic'
            elif weight == 400 and style == 'italic': suffix = 'Italic'
            elif weight == 300 and style == 'normal': suffix = 'Light'
            elif weight == 300 and style == 'italic': suffix = 'LightItalic'
            elif weight == 900: suffix = 'BlackItalic' if style == 'italic' else 'Black'
            elif weight == 400: suffix = 'Regular'
            else: suffix = f"{weight}{'Italic' if style == 'italic' else ''}"

            # Simple filename
            safe_family = family.replace(' ', '')
            filename = f"{safe_family}-{suffix}.ttf"
            dest_path = os.path.join(FONTS_DIR, filename)

            if not os.path.exists(dest_path):
                if download_file(v['ttf'], dest_path):
                    print(f"  Downloaded {filename}")
            else:
                print(f"  Exists {filename}")

            # Append to CSS
            global css_content
            css_content += f"@font-face {{\n    font-family: '{family}';\n    src: url('{filename}') format('truetype');\n    font-weight: {weight};\n    font-style: {style};\n}}\n"

    except urllib.error.HTTPError as e:
        print(f"HTTP Error for {family}: {e.code}")
    except Exception as e:
        print(f"Error processing {family}: {e}")

def generate_manifests():
    print("\nScanning fonts directory for manifests...")
    families = set()
    css_output = "/* Auto-generated local fonts */\n\n"
    
    # Sort files to ensure stable order
    try:
        files = sorted(os.listdir(FONTS_DIR))
    except FileNotFoundError:
        files = []

    for filename in files:
        if not filename.endswith(".ttf"):
            continue
            
        # Parse filename: Family-Suffix.ttf
        # e.g. Lato-Bold.ttf -> Family: Lato, Suffix: Bold
        try:
            name_part = filename[:-4] # remove .ttf
            if '-' in name_part:
                family_slug, suffix = name_part.split('-', 1)
            else:
                family_slug = name_part
                suffix = "Regular"
                
            # Naive family name restoration (CamelCase mostly or PascalCase)
            # We use the slug as the family name in CSS to match booleans.js logic
            family_name = family_slug
            
            # Determine weights/style from suffix
            weight = 400
            style = 'normal'
            
            s_lower = suffix.lower()
            if 'bold' in s_lower: weight = 700
            if 'light' in s_lower: weight = 300
            if 'black' in s_lower: weight = 900
            if 'italic' in s_lower: style = 'italic'
            
            # Add to set for JSON
            families.add(family_name)
            
            # CSS
            css_output += f"@font-face {{\n    font-family: '{family_name}';\n    src: url('{filename}') format('truetype');\n    font-weight: {weight};\n    font-style: {style};\n}}\n"
            
        except Exception as e:
            print(f"Skipping malformed filename {filename}: {e}")

    # Write CSS
    with open(CSS_FILE, 'w') as f:
        f.write(css_output)
    print(f"Generated {CSS_FILE}")

    # Write JSON
    json_path = os.path.join(FONTS_DIR, 'fonts.json')
    # Convert to list and sort
    sorted_families = sorted(list(families))
    with open(json_path, 'w') as f:
        json.dump(sorted_families, f, indent=2)
    print(f"Generated {json_path} with {len(sorted_families)} families")

def main():
    # 1. Download missing fonts
    for font in AVAILABLE_FONTS:
        process_font(font)
    
    # 2. Generate manifests from ALL files (downloaded + manual)
    generate_manifests()
    
    print("\nAll done!")

if __name__ == "__main__":
    main()
