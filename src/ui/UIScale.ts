/**
 * Native Lua layouts target a 1920px UI canvas, while the original game's
 * default/minimum window is 1280px wide (BootConfig.lua). Never auto-shrink
 * below that original 1280/1920 presentation scale.
 */
export const MIN_AUTO_UI_SCALE = 1280 / 1920;

export function getStoredOrAutoUIScale(): number {
  const stored = localStorage.getItem('df9_ui_scale');
  if (stored) {
    const value = parseFloat(stored);
    if (value > 0 && value <= 2) return value;
  }

  return Math.max(MIN_AUTO_UI_SCALE, Math.min(1, window.innerWidth / 1920));
}
