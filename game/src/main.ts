import '@fontsource/grenze-gotisch/latin-700.css';
import '@fontsource/barlow/latin-400.css';
import '@fontsource/barlow/latin-700.css';
import './style.css';
import * as Phaser from 'phaser';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from './config';
import { MENU_CURSOR } from './ui/cursor';
import { AchievementsScene } from './scenes/AchievementsScene';
import { BootScene } from './scenes/BootScene';
import { CountdownScene } from './scenes/CountdownScene';
import { CreditsScene } from './scenes/CreditsScene';
import { GameScene } from './scenes/GameScene';
import { HighScoresScene } from './scenes/HighScoresScene';
import { HowToPlayScene } from './scenes/HowToPlayScene';
import { HudScene } from './scenes/HudScene';
import { PauseScene } from './scenes/PauseScene';
import { PreloadScene } from './scenes/PreloadScene';
import { ResultsScene } from './scenes/ResultsScene';
import { SettingsScene } from './scenes/SettingsScene';
import { SystemScene } from './scenes/SystemScene';
import { TitleScene } from './scenes/TitleScene';
import { UnlockScene } from './scenes/UnlockScene';
import { applySavedMute } from './audio';
import { loadProfile } from './profile';
import { TEST_MODE, installTestHook } from './testHook';
import { COLOURS } from './theme';

// The save first: settings (mute, volumes, motion) apply from the first frame.
loadProfile();

const game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent: 'game',
    width: DESIGN_WIDTH,
    height: DESIGN_HEIGHT,
    backgroundColor: COLOURS.ink,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    // Load images with plain <img> requests. Phaser's default (XHR + blob: URLs)
    // would need blob: in the CSP's img-src.
    loader: { imageLoadType: 'HTMLImageElement' },
    // Phaser moves game time at most 1/60 s a frame for its first 120 frames, and whenever a frame takes
    // longer than 200 ms (below 5 frames a second). CI draws in software at a frame or two a second, so the
    // playtest's game ran about 40 times slower than real time. With ?test (the playtest only; players never
    // load it) game time keeps up: no startup clamp, and frames up to 2 s count in full.
    ...(TEST_MODE ? { fps: { panicMax: 0, min: 0.5 } } : {}),
    // Listed bottom to top: the HUD draws over the game, the pause menu and new-ability card over both,
    // and the menu screens (How to Play, Achievements, High Scores, Settings, Credits) over whichever screen opened them.
    scene: [BootScene, PreloadScene, TitleScene, GameScene, HudScene, PauseScene, UnlockScene, ResultsScene, CountdownScene, SettingsScene, HighScoresScene, AchievementsScene, HowToPlayScene, CreditsScene, SystemScene],
});
game.events.once(Phaser.Core.Events.READY, () => {
    applySavedMute(game);
    game.input.setDefaultCursor(MENU_CURSOR);
});
installTestHook(game);
