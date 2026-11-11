import * as Phaser from 'phaser';
import { ANIMATIONS, OBJECT_ANIMATIONS, TEXTURES, firstFrame, objectTexture } from '../assets';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../config';
import { profile, updateProfile } from '../profile';
import { ABILITIES, type Ability } from '../rules/abilities';
import {
    GUIDE_ENTRIES,
    discoveredCount,
    isDiscovered,
    isKnownAbility,
    markDiscoveriesSeen,
    unseenDiscoveries,
    type GuideCategory,
    type GuideEntry,
    type GuideKey,
} from '../rules/guide';
import { STRINGS } from '../strings';
import { markReady, setHowToPlayView } from '../testHook';
import { COLOURS, MOTION, SPACE, TEXT_COLOURS, TYPE } from '../theme';
import { addAbilityIcon } from '../ui/AbilityBar';
import { Button } from '../ui/Button';
import { Keycap } from '../ui/Keycap';
import { Menu } from '../ui/Menu';
import { addNewTag } from '../ui/NewTag';
import { Tabs } from '../ui/Tabs';
import { UI, addPanel } from '../ui/kit';
import { onKeyDown } from '../ui/keys';
import { closeScreen, startScreen, type ScreenData } from '../ui/screens';
import { addText } from '../ui/text';

type Tab = 'basics' | 'controls' | 'bestiary' | 'abilities';
/** On the Controls tab, the menu keys start at this row of the right-hand panel. */
const MENU_ROWS_FROM = 5;
const TABS: readonly Tab[] = ['basics', 'controls', 'bestiary', 'abilities'];

const TAB_Y = 172;
const TAB_WIDTH = 400;
const CONTENT_TOP = 250;
const CARD_RADIUS = 14;
/** What hides something not met yet: a dark silhouette, on a card that sinks back. */
const SILHOUETTE = 0x5c4f44;

const CATEGORY_COLOURS: Record<GuideCategory, string> = {
    creature: TEXT_COLOURS.primary,
    treasure: TEXT_COLOURS.gold,
    hazard: TEXT_COLOURS.danger,
    powerUp: '#9be8b0',
    boss: '#ffb37a',
};

/** Sprites with a lot of empty space round them, drawn larger to fill their plate like the rest. */
const SPRITE_ZOOM: Partial<Record<GuideKey, number>> = { boss: 1.9, fireball: 1.6 };
/** The Staff and Magnet sprites are square tiles, which don't sit on a round plate: their kit icons stand in. */
const KIT_PICTURES: Partial<Record<GuideKey, string>> = { staff: UI.iconStaff, magnet: UI.iconMagnetism };

/** A key, or a word between keys ("or"). */
type KeyToken = { readonly key: string } | { readonly word: string };

/**
 * How to Play (plan §3.4): Basics, Controls, Creatures & Items, and
 * Abilities. Creatures and items not met yet show as silhouettes with "???",
 * and abilities not unlocked yet as "???" with a vague hint. Anything met
 * since Creatures & Items was last looked at is marked "New" there (its tab
 * has a dot); opened during a run with something new, it opens on that tab.
 * Opens from the title and pause menus, and with H straight over the run.
 */
export class HowToPlayScene extends Phaser.Scene {
    private screen!: ScreenData;
    private leaving = false;
    private page: Phaser.GameObjects.GameObject[] = [];
    /** Met since Creatures & Items was last looked at: marked "New" for this visit. */
    private unseen = new Set<GuideKey>();

    constructor() {
        super('howToPlay');
    }

    create(data: ScreenData): void {
        this.screen = data;
        this.leaving = false;
        this.page = [];
        startScreen(this, data);
        const save = profile();
        this.unseen = new Set(unseenDiscoveries(save));

        addText(this, DESIGN_WIDTH / 2, 80, STRINGS.howToPlay.title, TYPE.title, { role: 'display', bold: true, colour: TEXT_COLOURS.gold }).setOrigin(0.5);
        const icons: Record<Tab, (scene: Phaser.Scene, x: number, y: number) => Phaser.GameObjects.Image | Keycap> = {
            basics: (scene, x, y) => fit(scene.add.image(x, y, TEXTURES.chestOpen), 40),
            controls: (scene, x, y) => new Keycap(scene, x, y, 'W', 36),
            bestiary: (scene, x, y) => fit(scene.add.image(x, y, objectTexture('goblin')), 40),
            abilities: (scene, x, y) => fit(scene.add.image(x, y, UI.iconTentacles), 40),
        };
        const labels: Record<Tab, string> = {
            ...STRINGS.howToPlay.tabs,
            bestiary: STRINGS.howToPlay.bestiaryTab(discoveredCount(save.discoveries), GUIDE_ENTRIES.length),
        };
        const tabs = new Tabs(this, TAB_Y, TAB_WIDTH, TABS.map((tab) => ({
            label: labels[tab],
            icon: icons[tab],
            dot: tab === 'bestiary' && this.unseen.size > 0,
        })), (index) => this.showTab(TABS[index] ?? 'basics'));
        // During a run, something just met is the likeliest reason to look.
        const duringRun = data.from === 'game' || data.from === 'pause';
        tabs.show(duringRun && this.unseen.size > 0 ? TABS.indexOf('bestiary') : 0);

        const back = new Button(this, DESIGN_WIDTH / 2, 990, STRINGS.howToPlay.back, { width: 360, onSelect: () => this.close() });
        new Menu(this, [back]);
        addText(this, DESIGN_WIDTH / 2, DESIGN_HEIGHT - 28, STRINGS.howToPlay.hint, TYPE.tiny, { colour: TEXT_COLOURS.muted }).setOrigin(0.5);
        // H too, since it opens it.
        onKeyDown(this, ['ESC', 'BACKSPACE', 'H'], () => this.close());
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => setHowToPlayView(null));

        this.cameras.main.fadeIn(MOTION.fast, 0, 0, 0);
        markReady('howToPlay');
    }

    private showTab(tab: Tab): void {
        this.page.forEach((part) => part.destroy());
        this.page = [];
        const save = profile();
        switch (tab) {
            case 'basics':
                this.showBasics();
                break;
            case 'controls':
                this.showControls(save.introduced);
                break;
            case 'bestiary':
                this.showBestiary(save.discoveries);
                // Seen now (the tags stay for this visit).
                if (unseenDiscoveries(save).length > 0) {
                    updateProfile(markDiscoveriesSeen);
                }
                break;
            case 'abilities':
                this.showAbilities(save.introduced);
                break;
        }
        setHowToPlayView({
            tab,
            fresh: [...this.unseen],
            hidden: GUIDE_ENTRIES.filter(({ key }) => !isDiscovered(key, save.discoveries)).map(({ key }) => key),
            lockedAbilities: ABILITIES.filter((ability) => !isKnownAbility(ability, save.introduced)),
        });
    }

    /** Six tips: the goal, hearts, treasure, hazards, growing, going deeper. */
    private showBasics(): void {
        const icons = [TEXTURES.chestOpen, UI.heartEmpty, objectTexture('crown'), objectTexture('bomb'), UI.iconLevel, UI.iconFloor];
        const width = 580;
        const height = 280;
        const gapX = 30;
        const gapY = 24;
        const left = DESIGN_WIDTH / 2 - (3 * width + 2 * gapX) / 2;
        STRINGS.howToPlay.basics.forEach((tip, i) => {
            const x = left + (i % 3) * (width + gapX) + width / 2;
            const y = CONTENT_TOP + 20 + Math.floor(i / 3) * (height + gapY) + height / 2;
            const cardLeft = -width / 2;
            const top = -height / 2;
            const plate = this.addPlate(cardLeft + 30 + 48, top + 30 + 48, 96, icons[i] ?? TEXTURES.chestOpen, false);
            const title = addText(this, cardLeft + 30 + 96 + 24, top + 30 + 48, tip.title, TYPE.heading, { role: 'display', bold: true, colour: TEXT_COLOURS.gold })
                .setOrigin(0, 0.5);
            const text = addText(this, cardLeft + 30, top + 146, tip.text, TYPE.body, { colour: TEXT_COLOURS.primary, wrapWidth: width - 60 });
            this.page.push(this.add.container(x, y, [addPanel(this, 0, 0, width, height), plate, title, text]));
        });
    }

    /** The keys: moving and abilities on the left, menus and the rest on the right. Abilities not unlocked yet show as "???". */
    private showControls(introduced: readonly Ability[]): void {
        const text = STRINGS.howToPlay.controls;
        const or = { word: text.or };
        const ability = (name: Ability, keys: KeyToken[]): [string, KeyToken[] | null] => (isKnownAbility(name, introduced) ? [STRINGS.abilities[name].name, keys] : [text.locked, null]);
        const moving: [string, KeyToken[] | null][] = [
            [text.move, [{ key: '←' }, { key: '→' }, or, { key: 'A' }, { key: 'D' }]],
            [text.jump, [{ key: '↑' }, or, { key: 'W' }]],
            [text.dash, [{ word: text.dashKeys }, { key: '←' }, or, { key: '→' }]],
            ability('shadowBolt', [{ key: 'Space' }]),
            ability('tentacles', [{ key: 'Z' }]),
            ability('magnetism', [{ key: 'X' }]),
        ];
        const menus: [string, KeyToken[] | null][] = [
            [text.pause, [{ key: 'P' }, or, { key: 'Esc' }]],
            [text.howToPlay, [{ key: 'H' }]],
            [text.achievements, [{ key: 'K' }]],
            [text.mute, [{ key: 'M' }]],
            [text.fullscreen, [{ key: 'F' }]],
            // The rest are under an "In menus" heading.
            [text.menuMove, [{ key: '↑' }, { key: '↓' }]],
            [text.menuSelect, [{ key: 'Enter' }]],
            [text.menuBack, [{ key: 'Esc' }]],
        ];
        const width = 870;
        const height = 660;
        const centreY = CONTENT_TOP + height / 2;
        [[text.moving, moving], [text.menus, menus]].forEach(([heading, rows], column) => {
            const x = DESIGN_WIDTH / 2 + (column === 0 ? -1 : 1) * (width / 2 + 15);
            const parts: Phaser.GameObjects.GameObject[] = [addPanel(this, 0, 0, width, height)];
            parts.push(addText(this, 0, -height / 2 + 50, heading as string, TYPE.heading, { role: 'display', bold: true, colour: TEXT_COLOURS.gold }).setOrigin(0.5));
            (rows as [string, KeyToken[] | null][]).forEach(([label, keys], i) => {
                // In the right-hand panel, the menu keys sit under their own heading.
                const inMenus = column === 1 && i >= MENU_ROWS_FROM;
                const rowY = -height / 2 + 128 + i * 62 + (inMenus ? 56 : 0);
                if (column === 1 && i === MENU_ROWS_FROM) {
                    parts.push(this.add.rectangle(0, rowY - 62, width - 2 * SPACE.xl, 2, COLOURS.goldDim, 0.5));
                    parts.push(addText(this, -width / 2 + SPACE.xl, rowY - 36, text.inMenus, TYPE.small, { bold: true, colour: TEXT_COLOURS.muted }).setOrigin(0, 0.5));
                }
                const locked = keys === null;
                parts.push(addText(this, -width / 2 + SPACE.xl, rowY, label, TYPE.body, { colour: locked ? TEXT_COLOURS.dim : TEXT_COLOURS.primary }).setOrigin(0, 0.5));
                if (keys) {
                    parts.push(...this.addKeys(width / 2 - SPACE.xl, rowY, keys, 'right'));
                } else {
                    parts.push(addText(this, width / 2 - SPACE.xl, rowY, text.locked, TYPE.body, { bold: true, colour: TEXT_COLOURS.dim }).setOrigin(1, 0.5));
                }
            });
            this.page.push(this.add.container(x, centreY, parts));
        });
    }

    /** Keycaps and words in a row at `x`: ending there (`right`) or centred on it. */
    private addKeys(x: number, y: number, tokens: readonly KeyToken[], align: 'right' | 'centre'): Phaser.GameObjects.GameObject[] {
        const parts = tokens.map((token) => ('key' in token
            ? new Keycap(this, 0, y, token.key, 48)
            : addText(this, 0, y, token.word, TYPE.small, { colour: TEXT_COLOURS.muted }).setOrigin(0.5)));
        const gap = 10;
        const total = parts.reduce((sum, part) => sum + part.width, 0) + gap * (parts.length - 1);
        let left = align === 'right' ? x - total : x - total / 2;
        for (const part of parts) {
            part.setX(left + part.width / 2);
            left += part.width + gap;
        }
        return parts;
    }

    /** Every creature, treasure, hazard, power-up and the boss; those not met yet are silhouettes with "???". */
    private showBestiary(discoveries: readonly string[]): void {
        const width = 580;
        const height = 120;
        const gapX = 30;
        const gapY = 10;
        const left = DESIGN_WIDTH / 2 - (3 * width + 2 * gapX) / 2;
        GUIDE_ENTRIES.forEach((entry, i) => {
            const x = left + (i % 3) * (width + gapX) + width / 2;
            const y = CONTENT_TOP + Math.floor(i / 3) * (height + gapY) + height / 2;
            this.page.push(this.addEntryCard(x, y, width, height, entry, isDiscovered(entry.key, discoveries)));
        });
    }

    private addEntryCard(x: number, y: number, width: number, height: number, entry: GuideEntry, met: boolean): Phaser.GameObjects.Container {
        const text = STRINGS.howToPlay;
        const info = text.entries[entry.key];
        const left = -width / 2;
        const right = width / 2;
        const textX = left + 20 + 92 + 20;
        const parts: Phaser.GameObjects.GameObject[] = [addPanel(this, 0, 0, width, height)];
        if (!met) {
            parts.push(this.add.graphics().fillStyle(COLOURS.ink, 0.45).fillRoundedRect(left, -height / 2, width, height, CARD_RADIUS));
        }
        parts.push(this.addPlate(left + 20 + 46, 0, 92, entry.key, !met));
        const nameY = -height / 2 + 32;
        const name = addText(this, textX, nameY, met ? (info?.name ?? entry.key) : text.unknownName, TYPE.body, { bold: true }).setOrigin(0, 0.5);
        parts.push(name);
        if (met) {
            if (entry.points !== null) {
                parts.push(addText(this, name.x + name.width + 14, nameY, text.points(entry.points), TYPE.small, { bold: true, colour: TEXT_COLOURS.gold }).setOrigin(0, 0.5));
            }
            parts.push(addText(this, right - 20, nameY, text.categories[entry.category], TYPE.tiny, { bold: true, colour: CATEGORY_COLOURS[entry.category] }).setOrigin(1, 0.5));
        } else {
            name.setColor(TEXT_COLOURS.dim);
        }
        parts.push(addText(this, textX, nameY + 22, met ? (info?.text ?? '') : text.unknownText, TYPE.small, {
            colour: met ? TEXT_COLOURS.muted : TEXT_COLOURS.dim,
            wrapWidth: right - 20 - textX,
        }));
        if (this.unseen.has(entry.key)) {
            parts.push(addNewTag(this, left + 20 + 46, height / 2 - 24));
        }
        return this.add.container(x, y, parts);
    }

    /** The four abilities: what each does once unlocked; before that, "???" and a vague hint. */
    private showAbilities(introduced: readonly Ability[]): void {
        const width = 420;
        const height = 520;
        const gap = 26;
        const left = DESIGN_WIDTH / 2 - (ABILITIES.length * width + (ABILITIES.length - 1) * gap) / 2;
        ABILITIES.forEach((ability, i) => {
            const x = left + i * (width + gap) + width / 2;
            const y = CONTENT_TOP + 40 + height / 2;
            const known = isKnownAbility(ability, introduced);
            const info = STRINGS.abilities[ability];
            const top = -height / 2;
            const parts: Phaser.GameObjects.GameObject[] = [addPanel(this, 0, 0, width, height)];
            if (!known) {
                parts.push(this.add.graphics().fillStyle(COLOURS.ink, 0.45).fillRoundedRect(-width / 2, top, width, height, CARD_RADIUS));
            }
            const iconY = top + 110;
            parts.push(this.add.image(0, iconY, UI.abilitySlot).setDisplaySize(136, 136).setAlpha(known ? 1 : 0.6));
            if (known) {
                parts.push(addAbilityIcon(this, 0, iconY - 4, ability, 88));
            } else {
                parts.push(addText(this, 0, iconY - 2, '?', 72, { role: 'display', bold: true, colour: TEXT_COLOURS.dim }).setOrigin(0.5));
            }
            parts.push(addText(this, 0, top + 236, known ? info.name : STRINGS.howToPlay.lockedName, TYPE.heading, {
                role: 'display',
                bold: true,
                colour: known ? TEXT_COLOURS.gold : TEXT_COLOURS.dim,
            }).setOrigin(0.5));
            if (known) {
                const keys: KeyToken[] = ability === 'dash'
                    ? [{ word: STRINGS.howToPlay.controls.dashKeys }, { key: '←' }, { word: STRINGS.howToPlay.controls.or }, { key: '→' }]
                    : [{ key: info.key }];
                parts.push(...this.addKeys(0, top + 310, keys, 'centre'));
            }
            const about = STRINGS.howToPlay.abilities[ability];
            parts.push(addText(this, 0, top + 370, known ? about.text : about.hint, TYPE.body, {
                colour: known ? TEXT_COLOURS.primary : TEXT_COLOURS.muted,
                align: 'center',
                wrapWidth: width - 70,
            }).setOrigin(0.5, 0));
            this.page.push(this.add.container(x, y, parts));
        });
    }

    /** A round dark plate with a picture on it: a sprite (animated, if it moves in play) or a kit image; a silhouette if `hidden`. */
    private addPlate(x: number, y: number, size: number, picture: GuideKey | string, hidden: boolean): Phaser.GameObjects.Container {
        const plate = this.add.graphics()
            .fillStyle(COLOURS.ink, 0.75)
            .fillCircle(0, 0, size / 2)
            .lineStyle(3, hidden ? COLOURS.iron : COLOURS.goldDim, 1)
            .strokeCircle(0, 0, size / 2);
        const sprite = this.spriteFor(picture);
        const zoom = SPRITE_ZOOM[picture as GuideKey] ?? 1;
        fit(sprite, size * 0.68 * zoom);
        if (hidden) {
            sprite.setTint(SILHOUETTE).setTintMode(Phaser.TintModes.FILL);
        }
        return this.add.container(x, y, [plate, sprite]);
    }

    private spriteFor(picture: GuideKey | string): Phaser.GameObjects.Sprite {
        const kit = KIT_PICTURES[picture as GuideKey];
        if (kit) {
            return this.add.sprite(0, 0, kit);
        }
        if (picture === 'boss') {
            return this.add.sprite(0, 0, firstFrame('bossIdle')).play(ANIMATIONS.bossIdle);
        }
        const kind = GUIDE_ENTRIES.find(({ key }) => key === picture)?.key;
        if (!kind || kind === 'boss') {
            return this.add.sprite(0, 0, picture);
        }
        const sprite = this.add.sprite(0, 0, objectTexture(kind));
        const animation = OBJECT_ANIMATIONS[kind];
        if (animation) {
            sprite.play(ANIMATIONS[animation]);
        }
        if (kind === 'fireball') {
            // The fireball frames point sideways; turned to fall nose first, as in play.
            sprite.setAngle(90);
        }
        return sprite;
    }

    private close(): void {
        if (this.leaving) {
            return;
        }
        this.leaving = true;
        closeScreen(this, this.screen);
    }
}

/** Scales an image or sprite to fit a `box`-sized square. */
function fit<T extends Phaser.GameObjects.Image>(image: T, box: number): T {
    image.setScale(Math.min(box / image.width, box / image.height));
    return image;
}
