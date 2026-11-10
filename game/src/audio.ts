// Sound effects and music through Phaser's sound manager. Browsers keep audio
// locked until the first key press or click; Phaser unlocks it on that
// gesture, and nothing here plays before then (inventory §9).
import * as Phaser from 'phaser';
import { MUSIC, MUSIC_VOLUME, SOUNDS, soundKey, type SoundName, type Track } from './assets';
import { onProfileChange, profile, updateProfile } from './profile';

// Mute and volumes live in the save's settings. (Phaser's own `mute` getter
// reads the master gain node, which only updates while audio is rendering,
// so the game reads the setting instead.)

export function isMuted(): boolean {
    return profile().settings.muted;
}

/** Sets mute for the whole game (M anywhere, or Settings) and saves it. */
export function setMuted(game: Phaser.Game, muted: boolean): void {
    updateProfile((save) => ({ ...save, settings: { ...save.settings, muted } }));
    game.sound.mute = muted;
}

/** Toggles mute and returns the new state. */
export function toggleMute(game: Phaser.Game): boolean {
    setMuted(game, !isMuted());
    return isMuted();
}

/** Applies the saved mute at boot. */
export function applySavedMute(game: Phaser.Game): void {
    game.sound.mute = isMuted();
}

function effectsVolume(): number {
    return profile().settings.effectsVolume;
}

function musicVolume(): number {
    return MUSIC_VOLUME * profile().settings.musicVolume;
}

/** Plays a sound effect; returns it, or null if audio is still locked. */
export function playSound(scene: Phaser.Scene, name: SoundName): Phaser.Sound.BaseSound | null {
    if (scene.sound.locked) {
        return null;
    }
    const sound = scene.sound.add(soundKey(name), { volume: SOUNDS[name].volume * effectsVolume() });
    sound.once(Phaser.Sound.Events.COMPLETE, () => sound.destroy());
    sound.once(Phaser.Sound.Events.STOP, () => sound.destroy());
    sound.play();
    return sound;
}

/**
 * Loops one music track at a time. If audio is still locked it starts on
 * unlock; if the wanted track hasn't loaded yet the current one keeps playing.
 */
export class MusicPlayer {
    private sound: Phaser.Sound.BaseSound | null = null;
    private playing: Track | null = null;
    private wanted: Track | null = null;

    private readonly onUnlock = (): void => {
        if (this.wanted) {
            this.play(this.wanted);
        }
    };

    constructor(private readonly scene: Phaser.Scene) {
        scene.sound.on(Phaser.Sound.Events.UNLOCKED, this.onUnlock);
        // The music volume can change in Settings while a track plays.
        const stopListening = onProfileChange(() => this.applyVolume());
        scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            scene.sound.off(Phaser.Sound.Events.UNLOCKED, this.onUnlock);
            stopListening();
            this.stop();
        });
    }

    private applyVolume(): void {
        if (this.sound && 'setVolume' in this.sound) {
            (this.sound as Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound).setVolume(musicVolume());
        }
    }

    play(track: Track): void {
        this.wanted = track;
        const manager = this.scene.sound;
        if (manager.locked) {
            return;
        }
        if (this.playing === track && this.sound?.isPlaying) {
            return;
        }
        const { key } = MUSIC[track];
        if (!this.scene.cache.audio.exists(key)) {
            return;
        }
        this.stopSound();
        this.sound = manager.add(key, { loop: true, volume: musicVolume() });
        this.sound.play();
        this.playing = track;
    }

    stop(): void {
        this.wanted = null;
        this.stopSound();
    }

    private stopSound(): void {
        this.sound?.stop();
        this.sound?.destroy();
        this.sound = null;
        this.playing = null;
    }
}
