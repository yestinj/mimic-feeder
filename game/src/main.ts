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
    // For its first 120 frames (and after the page is shown again) Phaser moves game time at most 1/60 s a
    // frame. In CI's software rendering, at a few frames a second, that makes every wait after a page load
    // crawl; with ?test (the playtest) the game keeps up with real time from the start. Players never see it.
    ...(TEST_MODE ? { fps: { panicMax: 0 } } : {}),
    // Listed bottom to top: the HUD draws over the game, the pause menu and new-ability card over both,
    // and the menu screens (How to Play, Achievements, High Scores, Settings, Credits) over whichever screen opened them.
    scene: [BootScene, PreloadScene, TitleScene, GameScene, HudScene, PauseScene, UnlockScene, ResultsScene, CountdownScene, SettingsScene, HighScoresScene, AchievementsScene, HowToPlayScene, CreditsScene, SystemScene],
});
game.events.once(Phaser.Core.Events.READY, () => {
    applySavedMute(game);
    game.input.setDefaultCursor(MENU_CURSOR);
});
installTestHook(game);
