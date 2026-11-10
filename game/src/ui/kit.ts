// The generated UI kit: SVG art in ./kit/, loaded as ordinary images.
// (Phaser's own SVG loader creates blob: URLs, which the site's CSP blocks;
// plain images work, and the SVGs carry their own pixel size.)
import type * as Phaser from 'phaser';
import buttonDisabledUrl from './kit/button-disabled.svg?url';
import buttonFocusUrl from './kit/button-focus.svg?url';
import buttonNormalUrl from './kit/button-normal.svg?url';
import buttonPressedUrl from './kit/button-pressed.svg?url';
import keycapUrl from './kit/keycap.svg?url';
import panelUrl from './kit/panel.svg?url';

export const UI = {
    panel: 'ui-panel',
    buttonNormal: 'ui-button-normal',
    buttonFocus: 'ui-button-focus',
    buttonPressed: 'ui-button-pressed',
    buttonDisabled: 'ui-button-disabled',
    keycap: 'ui-keycap',
} as const;

/** Fixed (non-stretching) border sizes of each nine- or three-slice texture. */
export const SLICE = {
    panel: 32,
    button: 28,
    keycap: 18,
} as const;

export function preloadUiKit(scene: Phaser.Scene): void {
    scene.load.image(UI.panel, panelUrl);
    scene.load.image(UI.buttonNormal, buttonNormalUrl);
    scene.load.image(UI.buttonFocus, buttonFocusUrl);
    scene.load.image(UI.buttonPressed, buttonPressedUrl);
    scene.load.image(UI.buttonDisabled, buttonDisabledUrl);
    scene.load.image(UI.keycap, keycapUrl);
}

/** A panel of any size, centred on (x, y). */
export function addPanel(scene: Phaser.Scene, x: number, y: number, width: number, height: number): Phaser.GameObjects.NineSlice {
    return scene.add.nineslice(x, y, UI.panel, undefined, width, height, SLICE.panel, SLICE.panel, SLICE.panel, SLICE.panel);
}
