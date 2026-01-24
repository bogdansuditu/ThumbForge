export const AVAILABLE_FONTS = [];

export const MAX_HISTORY = 50;

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
        // Fallback or empty? User wants dynamic, so empty list is correct behavior on failure (or maybe hardcoded fallback)
        // But let's assume valid deployment.
        AVAILABLE_FONTS.push('Arial'); // Minimal fallback just in case
    }
}
