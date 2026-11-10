import type * as Phaser from 'phaser';
import { FONTS, TEXT_COLOURS } from '../theme';

export type TextRole = 'display' | 'body';

export interface TextOptions {
    readonly role?: TextRole;
    readonly colour?: string;
    readonly bold?: boolean;
    readonly letterSpacing?: number;
    readonly align?: 'left' | 'center' | 'right';
    readonly wrapWidth?: number;
    readonly shadow?: boolean;
}

const FALLBACKS: Record<TextRole, string> = {
    display: 'Georgia, serif',
    body: 'sans-serif',
};

/** Themed text. Fonts are loaded before any scene creates text (see BootScene). */
export function addText(
    scene: Phaser.Scene,
    x: number,
    y: number,
    value: string,
    size: number,
    options: TextOptions = {},
): Phaser.GameObjects.Text {
    const role = options.role ?? 'body';
    const text = scene.add.text(x, y, value, {
        fontFamily: `"${FONTS[role]}", ${FALLBACKS[role]}`,
        fontSize: `${size}px`,
        fontStyle: options.bold ? 'bold' : 'normal',
        color: options.colour ?? TEXT_COLOURS.primary,
        align: options.align ?? 'left',
        letterSpacing: options.letterSpacing ?? 0,
        ...(options.wrapWidth ? { wordWrap: { width: options.wrapWidth } } : {}),
    });
    if (options.shadow !== false) {
        text.setShadow(0, 3, TEXT_COLOURS.shadow, 6, false, true);
    }
    return text;
}
