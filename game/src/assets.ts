// The game's art, animations, sounds and music: Phaser keys and the files they
// load from /assets/ (shared with the p5 game, nothing is duplicated).
import type * as Phaser from 'phaser';
import { ASSET_BASE } from './config';
import { FLOORS, floorIndex } from './rules/floors';
import type { ObjectKind } from './rules/objects';
import type { MusicTrack } from './rules/progression';

export const TEXTURES = {
    chestClosed: 'chest-closed',
    chestAjar: 'chest-ajar',
    chestOpen: 'chest-open',
    chain: 'chain',
    /** The Ninefold Judgment's apparition (loaded in the background). */
    apparition: 'judgment-apparition',
} as const;

/** Background texture for a floor index (0 = Floor 1). */
export function backgroundKey(index: number): string {
    return `bg-floor-${index + 1}`;
}

/** A floor's background, or the closest earlier floor's while it's still loading. */
export function floorBackground(textures: Phaser.Textures.TextureManager, floor: number): string {
    for (let index = floorIndex(floor); index > 0; index--) {
        if (textures.exists(backgroundKey(index))) {
            return backgroundKey(index);
        }
    }
    return backgroundKey(0);
}

/** Still images for the falling objects. Animated ones are in OBJECT_ANIMATIONS. */
const OBJECT_IMAGES: Partial<Record<ObjectKind, string>> = {
    goblin: 'goblin.png',
    dwarf: 'dwarf.png',
    wraith: 'wraith.png',
    human: 'human.png',
    elf: 'elf.png',
    crown: 'crown.png',
    diamond: 'diamond.png',
    bomb: 'small_bomb.png',
    staff: 'staff.png',
    cat: 'cat.png',
    dragon: 'dragon.png',
};


/** Frame-by-frame animations. Frame rates match the p5 game (frames held for N of its 60 fps frames). */
interface Sequence {
    /** Frame file for frame number i. */
    readonly file: (i: number) => string;
    readonly first: number;
    readonly count: number;
    readonly frameRate: number;
    readonly repeat: number;
}

const pad = (i: number): string => String(i).padStart(4, '0');

const SEQUENCES = {
    fireball: { file: (i) => `fireball/frame${pad(i)}.png`, first: 0, count: 30, frameRate: 15, repeat: -1 },
    fireballBurst: { file: (i) => `fireball_burst/frame${pad(i)}.png`, first: 0, count: 16, frameRate: 12, repeat: 0 },
    bombExplosion: { file: (i) => `bomb_explosion/frame${i}.png`, first: 1, count: 7, frameRate: 12, repeat: 0 },
    groundSplat: { file: (i) => `humanoid_splat_ground/frame${pad(i)}.png`, first: 0, count: 8, frameRate: 10, repeat: 0 },
    potion: { file: (i) => `health_potion/frame${pad(i)}.png`, first: 0, count: 16, frameRate: 15, repeat: -1 },
    magnet: { file: (i) => `magnet/frame${pad(i)}.png`, first: 0, count: 3, frameRate: 7.5, repeat: -1 },
    shadowBolt: { file: (i) => `shadow_bolt/frame${pad(i)}.png`, first: 0, count: 4, frameRate: 12, repeat: -1 },
    /** A Shadow Bolt hit: 12 frames over half a second. */
    boltHit: { file: (i) => `humanoid_splat/frame${pad(i)}.png`, first: 0, count: 12, frameRate: 24, repeat: 0 },
    bossFly: { file: (i) => `bosses/flying_demon/fly/frame${pad(i)}.png`, first: 0, count: 8, frameRate: 12, repeat: -1 },
    bossIdle: { file: (i) => `bosses/flying_demon/idle/frame${pad(i)}.png`, first: 0, count: 6, frameRate: 12, repeat: -1 },
    bossHit: { file: (i) => `bosses/flying_demon/get_hit/frame${pad(i)}.png`, first: 0, count: 7, frameRate: 12, repeat: 0 },
    bossDie: { file: (i) => `bosses/flying_demon/die/frame${pad(i)}.png`, first: 0, count: 17, frameRate: 60 / 7, repeat: 0 },
    bossFireball: { file: (i) => `bosses/flying_demon/fireball/PNG/frame${pad(i)}.png`, first: 0, count: 30, frameRate: 20, repeat: -1 },
} satisfies Record<string, Sequence>;

export type AnimationName = keyof typeof SEQUENCES;

export const ANIMATIONS: Record<AnimationName, string> = {
    fireball: 'anim-fireball',
    fireballBurst: 'anim-fireball-burst',
    bombExplosion: 'anim-bomb-explosion',
    groundSplat: 'anim-ground-splat',
    potion: 'anim-potion',
    magnet: 'anim-magnet',
    shadowBolt: 'anim-shadow-bolt',
    boltHit: 'anim-bolt-hit',
    bossFly: 'anim-boss-fly',
    bossIdle: 'anim-boss-idle',
    bossHit: 'anim-boss-hit',
    bossDie: 'anim-boss-die',
    bossFireball: 'anim-boss-fireball',
};

function frameKey(name: AnimationName, i: number): string {
    return `${ANIMATIONS[name]}-${i}`;
}

/** First frame of an animation, for sizing a sprite before it plays. */
export function firstFrame(name: AnimationName): string {
    return frameKey(name, SEQUENCES[name].first);
}

/** The `index`th frame of an animation (from 0), as a still image. */
export function animationFrame(name: AnimationName, index: number): string {
    return frameKey(name, SEQUENCES[name].first + index);
}

/** Falling objects that animate while they fall. */
export const OBJECT_ANIMATIONS: Partial<Record<ObjectKind, AnimationName>> = {
    fireball: 'fireball',
    potion: 'potion',
    magnet: 'magnet',
};

/** The texture a falling object starts with. */
export function objectTexture(kind: ObjectKind): string {
    const animation = OBJECT_ANIMATIONS[kind];
    return animation ? firstFrame(animation) : `object-${kind}`;
}

/** Sound effects and their volumes (inventory §9: most at 0.2, the important ones at 0.5). */
export const SOUNDS = {
    jump: { file: 'jump.mp3', volume: 0.2 },
    doubleJump: { file: 'double_jump.mp3', volume: 0.2 },
    collect: { file: 'collect.mp3', volume: 0.5 },
    glassBreak: { file: 'glass_break.mp3', volume: 0.2 },
    gameOver: { file: 'game_over.mp3', volume: 0.2 },
    levelComplete: { file: 'level_complete.mp3', volume: 0.2 },
    playerLevelUp: { file: 'player_level_up.mp3', volume: 0.2 },
    explode: { file: 'explode.mp3', volume: 0.5 },
    splat: { file: 'splat.mp3', volume: 0.2 },
    loseLife: { file: 'lose_life.mp3', volume: 0.2 },
    /** Shadow Bolt; crowns and diamonds announce themselves with it too. */
    castSpell: { file: 'cast_spell.mp3', volume: 0.2 },
    boltHit: { file: 'shadowbolt_hit.mp3', volume: 0.2 },
    slurp: { file: 'slurp.mp3', volume: 0.5 },
    magnetism: { file: 'magnetism.mp3', volume: 0.5 },
    wizardStaff: { file: 'wizard_staff.mp3', volume: 0.2 },
    healthPotion: { file: 'health_potion.mp3', volume: 0.2 },
    catMeow: { file: 'cat_meow.mp3', volume: 0.5 },
    catHurt: { file: 'cat_hurt.mp3', volume: 0.5 },
    bossDeath: { file: 'boss_death.mp3', volume: 0.5 },
    /** The dungeon's voice in the Ninefold Judgment. */
    dungeonWarning: { file: 'dungeon_warning.mp3', volume: 0.85 },
    dungeonJudgment: { file: 'dungeon_judgment.mp3', volume: 0.85 },
    dungeonRelents: { file: 'dungeon_relents.mp3', volume: 0.85 },
    // New in M4b, from Kenney's CC0 packs (kenney.nl) unless noted: each trimmed, peak-normalised
    // to -1 dB and converted to mono MP3 with ffmpeg. Source pack and file after each.
    /** Menu focus moving (UI Audio: rollover2). */
    uiMove: { file: 'ui_move.mp3', volume: 0.25 },
    /** A button or menu item chosen (Interface Sounds: select_001). */
    uiSelect: { file: 'ui_select.mp3', volume: 0.4 },
    /** Back, Esc, closing a screen (UI Audio: switch26). */
    uiBack: { file: 'ui_back.mp3', volume: 0.35 },
    /** A tab changing (UI Audio: switch13). */
    uiTab: { file: 'ui_tab.mp3', volume: 0.35 },
    /** A Settings toggle flipped (Interface Sounds: toggle_001). */
    uiToggle: { file: 'ui_toggle.mp3', volume: 0.35 },
    /** A Settings slider stepping (Interface Sounds: tick_004). */
    uiTick: { file: 'ui_tick.mp3', volume: 0.3 },
    /** Each count in the results' tally (Interface Sounds: tick_001). */
    tallyTick: { file: 'tally_tick.mp3', volume: 0.25 },
    /** The results' score landing (Casino Audio: chips-stack-2). */
    tallyScore: { file: 'tally_score.mp3', volume: 0.45 },
    /** "New best!" mid-run (Interface Sounds: confirmation_001). */
    newBest: { file: 'new_best.mp3', volume: 0.45 },
    /**
     * The dash: made for the game (original), not from a pack. White noise
     * through a resonant band-pass whose centre falls from about 3.4 kHz to
     * 500 Hz over 0.26 s, with a little noise an octave up for air, under a
     * quick swell and longer fade: something swooping past.
     */
    dashWhoosh: { file: 'dash_whoosh.mp3', volume: 0.35 },
    /** The mimic's lid creaking open on the title screen (RPG Audio: creak1). */
    titleCreak: { file: 'title_creak.mp3', volume: 0.3 },
    /** A boss arriving (Sci-Fi Sounds: lowFrequency_explosion_001). */
    bossRumble: { file: 'boss_rumble.mp3', volume: 0.6 },
} as const;

export type SoundName = keyof typeof SOUNDS;

export function soundKey(name: SoundName): string {
    return `sfx-${name}`;
}

/** The floor tracks, and the boss fight's. */
export type Track = MusicTrack | 'boss';

export const MUSIC: Record<Track, { readonly key: string; readonly file: string }> = {
    music1: { key: 'music-1', file: 'music/background1.mp3' },
    music2: { key: 'music-2', file: 'music/background2.mp3' },
    boss: { key: 'music-boss', file: 'music/boss.mp3' },
};
export const MUSIC_VOLUME = 0.4;

/** Everything Floor 1 needs: loaded behind the loading screen. */
export function loadCoreAssets(load: Phaser.Loader.LoaderPlugin): void {
    load.setPath(ASSET_BASE);
    load.image(backgroundKey(0), `backgrounds/${FLOORS[0]?.background ?? ''}`);
    load.image(TEXTURES.chestClosed, 'chest_closed.png');
    load.image(TEXTURES.chestAjar, 'chest_ajar.png');
    load.image(TEXTURES.chestOpen, 'chest_open.png');
    load.image(TEXTURES.chain, 'chain.png');
    for (const [kind, file] of Object.entries(OBJECT_IMAGES)) {
        load.image(`object-${kind}`, file);
    }
    for (const [name, sequence] of Object.entries(SEQUENCES) as [AnimationName, Sequence][]) {
        for (let i = sequence.first; i < sequence.first + sequence.count; i++) {
            load.image(frameKey(name, i), sequence.file(i));
        }
    }
    for (const [name, sound] of Object.entries(SOUNDS)) {
        load.audio(soundKey(name as SoundName), sound.file);
    }
    load.audio(MUSIC.music1.key, MUSIC.music1.file);
}

/**
 * Later floors' backgrounds, the second music track and the boss music, loaded in the
 * background once the game is running (inventory §5). Until a floor's
 * background arrives, the closest earlier floor's is shown.
 */
export function loadDeferredAssets(load: Phaser.Loader.LoaderPlugin): void {
    load.setPath(ASSET_BASE);
    FLOORS.forEach((floor, index) => {
        if (index > 0) {
            load.image(backgroundKey(index), `backgrounds/${floor.background}`);
        }
    });
    load.audio(MUSIC.music2.key, MUSIC.music2.file);
    load.audio(MUSIC.boss.key, MUSIC.boss.file);
    load.image(TEXTURES.apparition, 'ninefold_judgment.webp');
}

export function createAnimations(anims: Phaser.Animations.AnimationManager): void {
    for (const [name, sequence] of Object.entries(SEQUENCES) as [AnimationName, Sequence][]) {
        if (anims.exists(ANIMATIONS[name])) {
            continue;
        }
        const frames = [];
        for (let i = sequence.first; i < sequence.first + sequence.count; i++) {
            frames.push({ key: frameKey(name, i) });
        }
        anims.create({ key: ANIMATIONS[name], frames, frameRate: sequence.frameRate, repeat: sequence.repeat });
    }
}
