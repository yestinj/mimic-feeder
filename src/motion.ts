// The player's motion settings (Settings, plan §3.7). Both start from the
// system's reduced-motion setting and can be changed in Settings.
import { profile } from './profile';

/** Reduced motion: big movements (shaking hearts, the apparition's bob…) are skipped. */
export function prefersReducedMotion(): boolean {
    return profile().settings.reducedMotion;
}

/** Screen shake, on its own switch. */
export function screenShakeEnabled(): boolean {
    return profile().settings.screenShake;
}
