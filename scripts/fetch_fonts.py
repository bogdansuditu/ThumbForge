import os
import json
import urllib.request
import urllib.error

# Fonts to download from Google Fonts
AVAILABLE_FONTS = [
    # Google Fonts - Sans Serif / Modern
    'Roboto', 'Inter', 'Open Sans', 'Lato', 'Poppins', 'Oswald', 'Montserrat', 'Raleway', 'Ubuntu', 'Space Grotesk', 'Orbitron', 'Electrolize',
    # Serif / Old School
    'Merriweather', 'Playfair Display', 'Marcellus', 'Italiana', 'Bodoni Moda', 'Noto Serif', 'Libre Baskerville', 'Josefin Slab','Quintessential',
    # Display / Poster / Bold
    'Anton', 'Bebas Neue', 'Archivo Black', 'Black Ops One', 'Faster One', 'Amatic SC',
    # Horror / Rough
    'Creepster', 'Nosifer', 'Eater', 'Butcherman', 'Rubik Glitch', 'Rock Salt',
    # Handwriting / Script / Cursive
    'Pacifico', 'Dancing Script', 'Great Vibes', 'Satisfy', 'Allura', 'Permanent Marker', 'Rubik Marker Hatch', 'Sedgwick Ave Display',
    # Decorative / Historical / Fantasy
    'Lobster', 'Uncial Antiqua', 'Cinzel Decorative', 'IM Fell English', 'Pirata One', 'MedievalSharp', 'Special Elite', 'Rubik Scribble'
]

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
        req = urllib.request.Request(
            url, 
            data=None, 
            headers={
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36'
            }
        )
        with urllib.request.urlopen(req) as response, open(dest, 'wb') as out_file:
            data = response.read()
            out_file.write(data)
        return True
    except Exception as e:
        print(f"Failed to download {url}: {e}")
        return False

def process_font(family):
    font_id = slugify(family)
    api_url = f"https://gwfh.mranftl.com/api/fonts/{font_id}?subsets=latin,latin-ext"

    try:
        print(f"Processing {family}...")
        req = urllib.request.Request(
            api_url, 
            data=None, 
            headers={
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36'
            }
        )
        with urllib.request.urlopen(req) as response:
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

            # FORCE DOWNLOAD (overwrite existing)
            if download_file(v['ttf'], dest_path):
                print(f"  Downloaded {filename}")
            else:
                print(f"  Failed to download {filename}")

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

    # Create lookup for original names (slug -> Original Name)
    slug_map = {}
    for font in AVAILABLE_FONTS:
        slug_map[slugify(font)] = font

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
                
            # Use original name if found in map, otherwise fallback to slug (but title-cased if possible?)
            # Actually, `slugify` removes spaces. So 'open-sans' key should match 'Open Sans' value.
            # But the filename part `family_slug` is derived from `slugify(family)`.
            # Wait, process_font uses: font_id = slugify(family) and safe_family = family.replace(' ', '')
            # The filenames are saved as: f"{safe_family}-{suffix}.ttf"
            # So 'Open Sans' -> 'opensans' (slug) BUT filename uses 'OpenSans' (safe_family).
            
            # Let's adjust logic.
            # Filenames created by this script are OpenSans-Regular.ttf.
            # `name_part` will be OpenSans-Regular.
            # `family_slug` (from split) will be OpenSans.
            # We need to map 'OpenSans' (from filename) or 'opensans' (lowercased) back to 'Open Sans'.
             
            # Let's populate map with both variants to be safe
            
            # Key: safe_family (OpenSans) -> Value: Original (Open Sans)
            current_safe_family = family_slug
            
            # Find matching original font
            family_name = current_safe_family # Default fallback
            
            # Try to match against AVAILABLE_FONTS
            for original in AVAILABLE_FONTS:
                if original.replace(' ', '') == current_safe_family:
                    family_name = original
                    break
            
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
