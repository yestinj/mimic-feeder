import * as Phaser from 'phaser';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../config';
import type { Ability } from '../rules/abilities';
import { STRINGS } from '../strings';
import { markReady, setCardView } from '../testHook';
import { COLOURS, MOTION, SPACE, TEXT_COLOURS, TYPE } from '../theme';
import { addAbilityIcon } from '../ui/AbilityBar';
import { Button } from '../ui/Button';
import { Keycap } from '../ui/Keycap';
import { onKeyDown } from '../ui/keys';
import { addPanel, UI } from '../ui/kit';
import { addText } from '../ui/text';
import type { GameScene } from './GameScene';

/** Phaser key names for the keys that close each ability's card. */
const CLOSE_KEYS: Partial<Record<Ability, string>> = {
    shadowBolt: 'SPACE',
    tentacles: 'Z',
    magnetism: 'X',
};
/** Keys pressed in the first moment are ignored, so a card isn't closed by accident mid-play. */
const IGNORE_KEYS_MS = 500;
const WIDTH = 900;
const HEIGHT = 540;

export interface UnlockData {
    readonly abilities: readonly Ability[];
}

/**
 * Introduces a new ability the first time it unlocks, over the frozen,
 * blurred playfield: what it is and which key uses it. Only that key (or
 * Enter, or clicking Continue) closes the card, and not in its first half
 * second, so arrow keys held for moving can't dismiss it unread.
 */
export class UnlockScene extends Phaser.Scene {
    private queue: Ability[] = [];
    private card: Phaser.GameObjects.Container | null = null;
    private stopListening: (() => void) | null = null;
    private openedAt = 0;
    private showing: Ability | null = null;

    constructor() {
        super('unlock');
    }

    create(data: UnlockData): void {
        this.queue = [...data.abilities];
        this.card = null;
        this.showing = null;
        this.add.rectangle(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, COLOURS.ink, 0.45).setOrigin(0);
        setCardView(() => (this.showing ? { ability: this.showing, ready: this.accepting() } : null));
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => setCardView(null));
        this.showNext();
        markReady('unlock');
    }

    private accepting(): boolean {
        return performance.now() - this.openedAt >= IGNORE_KEYS_MS;
    }

    private showNext(): void {
        this.card?.destroy();
        this.stopListening?.();
        const ability = this.queue.shift();
        if (!ability) {
            this.showing = null;
            (this.scene.get('game') as GameScene).resumePlay();
            this.scene.stop();
            return;
        }
        this.showing = ability;
        this.openedAt = performance.now();
        this.card = this.buildCard(ability);
        const close = (): void => {
            if (this.accepting()) {
                this.showNext();
            }
        };
        this.stopListening = onKeyDown(this, [CLOSE_KEYS[ability] ?? 'ENTER', 'ENTER'], close);
    }

    private buildCard(ability: Ability): Phaser.GameObjects.Container {
        const info = STRINGS.abilities[ability];
        const top = -HEIGHT / 2;
        const parts: Phaser.GameObjects.GameObject[] = [addPanel(this, 0, 0, WIDTH, HEIGHT)];

        parts.push(addText(this, 0, top + 56, STRINGS.unlockCard.title.toUpperCase(), TYPE.small, { colour: TEXT_COLOURS.muted, letterSpacing: 6, bold: true }).setOrigin(0.5));
        const iconY = top + 160;
        const glow = this.add.image(0, iconY, UI.glow).setTint(COLOURS.goldBright).setDisplaySize(260, 260).setAlpha(0.55);
        this.tweens.add({ targets: glow, alpha: 0.25, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
        parts.push(glow);
        parts.push(this.add.image(0, iconY, UI.abilitySlot).setDisplaySize(136, 136));
        parts.push(addAbilityIcon(this, 0, iconY - 4, ability, 88));
        parts.push(addText(this, 0, top + 284, info.name, TYPE.title, { role: 'display', bold: true, colour: TEXT_COLOURS.gold }).setOrigin(0.5));

        // "Press [Key] to …", centred as one line.
        const rowY = top + 362;
        const press = addText(this, 0, rowY, STRINGS.notices.press, TYPE.body).setOrigin(0, 0.5);
        const keycap = new Keycap(this, 0, rowY, info.key, 56);
        const use = addText(this, 0, rowY, info.use, TYPE.body).setOrigin(0, 0.5);
        const rowWidth = press.width + SPACE.s + keycap.width + SPACE.s + use.width;
        press.x = -rowWidth / 2;
        keycap.x = press.x + press.width + SPACE.s + keycap.width / 2;
        use.x = keycap.x + keycap.width / 2 + SPACE.s;
        parts.push(press, keycap, use);

        const button = new Button(this, 0, top + 452, STRINGS.unlockCard.continue, {
            width: 320,
            onSelect: () => {
                if (this.showing === ability) {
                    this.showNext();
                }
            },
        });
        button.setFocused(true);
        parts.push(button);
        parts.push(addText(this, 0, top + 506, STRINGS.unlockCard.orPress(info.key), TYPE.small, { colour: TEXT_COLOURS.muted }).setOrigin(0.5));

        const card = this.add.container(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2, parts).setScale(0.92).setAlpha(0);
        this.tweens.add({ targets: card, scale: 1, alpha: 1, duration: MOTION.normal, ease: 'Back.Out' });
        return card;
    }
}
