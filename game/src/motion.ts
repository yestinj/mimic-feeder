// The player's motion preference. Screen shake, shaking hearts and other big
// movements are skipped when the system asks for reduced motion.

export function prefersReducedMotion(): boolean {
    return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
