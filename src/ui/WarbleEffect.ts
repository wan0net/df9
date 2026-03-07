/**
 * WarbleEffect.ts — Screen distortion effect matching Lua UIEffectMask system.
 *
 * Original: GuiManager.createEffectMaskBox(x,y,w,h,nTime,nIntensity) renders white
 * rectangles into a UIEffectMask render layer. The UIScreen.material shader reads
 * this mask to apply UV distortion (warping) to the UI layer, which is then
 * additively blended onto the scene. The mask fades over nTime seconds.
 *
 * Web approximation: CSS animation combining horizontal scale oscillation,
 * brightness flash, and a brief amber-tinted scanline overlay that fades out.
 * This creates the "holographic display flicker" feel of the original.
 *
 * Call sites matching Lua:
 * - NewSideBar: setExpanded, showSubmenu (sidebar region)
 * - StartMenu/Credits/Settings/Save/Load: panel open (fullscreen or panel region)
 * - NewBase: galaxy map transitions (fullscreen)
 * - JobRoster/SquadEdit/Research: panel open (fullscreen-width)
 */

let styleInjected = false;

function injectStyles() {
  if (styleInjected) return;
  const style = document.createElement('style');
  style.id = 'df9-warble-styles';
  style.textContent = `
    @keyframes df9-warble {
      0%   { transform: scaleX(1.0); filter: brightness(1.25); }
      20%  { transform: scaleX(1.008); filter: brightness(1.12); }
      40%  { transform: scaleX(0.996); filter: brightness(1.06); }
      60%  { transform: scaleX(1.003); filter: brightness(1.03); }
      80%  { transform: scaleX(0.999); filter: brightness(1.01); }
      100% { transform: scaleX(1.0); filter: brightness(1.0); }
    }
    @keyframes df9-warble-flash {
      0%   { opacity: 0.18; }
      30%  { opacity: 0.08; }
      60%  { opacity: 0.03; }
      100% { opacity: 0; }
    }
  `;
  document.head.appendChild(style);
  styleInjected = true;
}

/**
 * Play a warble effect on a specific element (sidebar, panel).
 * Matches Lua playWarbleEffect(false) — localized region warble.
 */
export function playWarble(element: HTMLElement, duration = 0.3, _intensity = 0.3) {
  injectStyles();
  // Remove any existing animation first
  element.style.animation = 'none';
  // Force reflow to restart animation
  void element.offsetHeight;
  element.style.animation = `df9-warble ${duration}s ease-out`;
  element.addEventListener('animationend', function handler() {
    element.style.animation = '';
    element.removeEventListener('animationend', handler);
  });
}

/**
 * Play a fullscreen warble overlay on a container.
 * Matches Lua playWarbleEffect(true) — full viewport distortion.
 * Creates a temporary overlay with amber scanline flash that fades out.
 */
export function playWarbleFullscreen(container: HTMLElement, duration = 0.3, _intensity = 0.3) {
  injectStyles();
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:absolute;top:0;left:0;width:100%;height:100%;
    pointer-events:none;z-index:9999;
    background:repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(223,162,0,0.04) 2px,
      rgba(223,162,0,0.04) 4px
    );
    animation:df9-warble-flash ${duration}s ease-out forwards;
  `;
  container.appendChild(overlay);
  overlay.addEventListener('animationend', () => overlay.remove());
}
