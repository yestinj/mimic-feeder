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
} satisfies Record<string, Sequence>;

export type AnimationName = keyof typeof SEQUENCES;

export const ANIMATIONS: Record<AnimationName, string> = {
    fireball: 'anim-fireball',
    fireballBurst: 'anim-fireball-burst',
    bombExplosion: 'anim-bomb-explosion',
    groundSplat: 'anim-ground-splat',
};

function frameKey(name: AnimationName, i: number): string {
    return `${ANIMATIONS[name]}-${i}`;
}

/** First frame of an animation, for sizing a sprite before it plays. */
export function firstFrame(name: AnimationName): string {
    return frameKey(name, SEQUENCES[name].first);
}

/** Falling objects that animate while they fall. */
export const OBJECT_ANIMATIONS: Partial<Record<ObjectKind, AnimationName>> = {
    fireball: 'fireball',
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
    /** Crowns and diamonds announce themselves with the spell sound. */
    bling: { file: 'cast_spell.mp3', volume: 0.2 },
} as const;

export type SoundName = keyof typeof SOUNDS;

export function soundKey(name: SoundName): string {
    return `sfx-${name}`;
}

export const MUSIC: Record<MusicTrack, { readonly key: string; readonly file: string }> = {
    music1: { key: 'music-1', file: 'music/background1.mp3' },
    music2: { key: 'music-2', file: 'music/background2.mp3' },
};
export const MUSIC_VOLUME = 0.4;

/** Everything Floor 1 needs: loaded behind the loading screen. */
export function loadCoreAssets(load: Phaser.Loader.LoaderPlugin): void {
    load.setPath(ASSET_BASE);
    load.image(backgroundKey(0), `backgrounds/${FLOORS[0]?.background ?? ''}`);
    load.image(TEXTURES.chestClosed, 'chest_closed.png');
    load.image(TEXTURES.chestAjar, 'chest_ajar.png');
    load.image(TEXTURES.chestOpen, 'chest_open.png');
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
 * Later floors' backgrounds and the second music track, loaded in the
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
