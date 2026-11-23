// The game's cursors (plan §3.1): a themed arrow in menus, a brighter one
// over anything clickable, and none at all during play.
import type * as Phaser from 'phaser';
import arrowUrl from './kit/cursor-arrow.svg?url';
import pointUrl from './kit/cursor-point.svg?url';

/**
 * CSS cursors, falling back to the system ones if the image can't load. The
 * URL is quoted: Vite inlines small SVGs as data URLs with quotes in them,
 * which an unquoted url() can't hold, and an invalid cursor is ignored
 * (leaving whatever was set before, such as play's "none").
 */
export const MENU_CURSOR = `url("${arrowUrl}") 3 2, default`;
export const POINTER_CURSOR = `url("${pointUrl}") 3 2, pointer`;

/** The cursor everywhere nothing interactive is under it: the arrow, or none during play. */
export function showCursor(scene: Phaser.Scene, visible: boolean): void {
    scene.input.setDefaultCursor(visible ? MENU_CURSOR : 'none');
}
