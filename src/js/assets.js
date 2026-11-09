// Player images
let chestClosedImage;
let chestAjarImage;
let chestOpenImage;

// Object images
let objectImages = {}; // Static images
let healthPotionFrames = []; // For animated health potion
let fireballFrames = []; // For animated fireball
let fireballBurstFrames = []; // For fireball burst animation
let magnetFrames = []; // For animated magnet
let bossFrames = []; // For flying demon boss animation
let bossHitFrames = []; // For flying demon boss hit animation
let bossFireballFrames = []; // For boss fireball animation
let bossIdleFrames = []; // For flying demon boss idle animation
let bossDieFrames = []; // For flying demon boss die animation

// Ability and effect images
let shadowBoltFrames = [];
let humanoidSplatFrames = [];
let explosionFrames = [];
let chainImage;
let groundSplatFrames = [];

// Dungeon backgrounds, ordered one per floor through Floor 10.
const DUNGEON_BACKGROUND_PATHS = [
    'assets/backgrounds/upper-dungeon.webp',
    'assets/backgrounds/ageing-lower-halls.webp',
    'assets/backgrounds/lower-undercroft.webp',
    'assets/backgrounds/buried-crypts.webp',
    'assets/backgrounds/ancient-catacombs.webp',
    'assets/backgrounds/root-choked-necropolis.webp',
    'assets/backgrounds/underworld-depths.webp',
    'assets/backgrounds/infernal-ruins.webp',
    'assets/backgrounds/void-threshold.webp',
    'assets/backgrounds/abyss.webp'
];
let dungeonBackgroundImages = [];
let ninefoldJudgmentImage;

// Sound effects
let jumpSound;
let doubleJumpSound;
let collectSound;
let slurpSound;
let glassBreakSound;
let gameOverSound;
let healthPotionSound;
let wizardStaffSound;
let levelCompleteSound;
let playerLevelUpSound;
let explodeSound;
let splatSound;
let loseLifeSound;
let popSound;
let castSpellSound;
let catMeowSound;
let catHurtSound;
let magnetismSound;
let bossDeathSound;
let dungeonWarningSound;
let dungeonJudgmentSound;
let dungeonRelentsSound;

// Background music
let backgroundMusic1;
let backgroundMusic2;
let bossMusic;

/**
 * Late-run assets load in the background after setup() instead of in preload(),
 * so the first screen does not wait for several MB that are only needed later.
 * Consumers already tolerate these being absent until they arrive:
 * - drawDungeonBackground() reuses the closest earlier floor's background
 * - playExclusiveMusic() skips a track until it has loaded
 * - drawNinefoldApparition() draws a simple fallback without the image
 */
let deferredAssetsRequested = false;
/** Deferred assets still loading (successes and failures both settle). */
let deferredAssetsPending = 0;

/**
 * Starts background loading of late-run assets. Call from setup(), before
 * setupSoundMap(), so the sound map captures the deferred SoundFile objects.
 * @function
 */
function loadDeferredAssets() {
    if (deferredAssetsRequested) {
        return;
    }
    deferredAssetsRequested = true;

    const settle = () => {
        deferredAssetsPending = Math.max(0, deferredAssetsPending - 1);
    };

    // Store images only once loaded: an in-flight p5.Image is a 1x1 placeholder
    // that would otherwise be drawn in place of the real background.
    const loadDeferredImage = (path, onLoaded) => {
        deferredAssetsPending += 1;
        try {
            loadImage(path, (img) => {
                onLoaded(img);
                settle();
            }, (error) => {
                console.error(`Failed to load image: ${path}`, error);
                settle();
            });
        } catch (error) {
            console.error(`Error loading image ${path}:`, error);
            settle();
        }
    };

    // SoundFile objects exist immediately; isLoaded() stays false until decoded.
    const loadDeferredSound = (path, volume) => {
        deferredAssetsPending += 1;
        try {
            const sound = loadSound(path, settle, (error) => {
                console.error(`Failed to load sound: ${path}`, error);
                settle();
            });
            if (sound) {
                sound.setVolume(volume);
            }
            return sound;
        } catch (error) {
            console.error(`Error loading sound ${path}:`, error);
            settle();
            return null;
        }
    };

    // Requested roughly in the order a run first needs them.
    loadDeferredImage(DUNGEON_BACKGROUND_PATHS[1], (img) => {
        dungeonBackgroundImages[1] = img;
    });
    bossMusic = loadDeferredSound('assets/music/boss.mp3', 0.4);
    for (let i = 2; i < DUNGEON_BACKGROUND_PATHS.length; i++) {
        loadDeferredImage(DUNGEON_BACKGROUND_PATHS[i], (img) => {
            dungeonBackgroundImages[i] = img;
        });
    }
    backgroundMusic2 = loadDeferredSound('assets/music/background2.mp3', 0.4);
    loadDeferredImage('assets/ninefold_judgment.webp', (img) => {
        ninefoldJudgmentImage = img;
    });
}

function preload() {
    // Helper function to load an image with error handling
    function loadImageWithErrorHandling(path) {
        try {
            return loadImage(path, img => {
            }, (e) => {
                console.error(`Failed to load image: ${path}`, e);
            });
        } catch (error) {
            console.error(`Error loading image ${path}:`, error);
            return null;
        }
    }

    // Helper function to load a sound with error handling and set volume
    function loadSoundWithVolume(path, volume = DEFAULT_SOUND_VOLUME) {
        try {
            const sound = loadSound(path, s => {
            }, (e) => {
                console.error(`Failed to load sound: ${path}`, e);
            });
            if (sound) {
                sound.setVolume(volume);
            }
            return sound;
        } catch (error) {
            console.error(`Error loading sound ${path}:`, error);
            return null;
        }
    }

    // Load player images
    chestClosedImage = loadImageWithErrorHandling('assets/chest_closed.png');
    chestAjarImage = loadImageWithErrorHandling('assets/chest_ajar.png');
    chestOpenImage = loadImageWithErrorHandling('assets/chest_open.png');

    // Load object images (static ones)
    objectImages[OBJ_HUMAN] = loadImageWithErrorHandling('assets/human.png');
    objectImages[OBJ_GOBLIN] = loadImageWithErrorHandling('assets/goblin.png');
    objectImages[OBJ_ELF] = loadImageWithErrorHandling('assets/elf.png');
    objectImages[OBJ_WRAITH] = loadImageWithErrorHandling('assets/wraith.png');
    objectImages[OBJ_CAT] = loadImageWithErrorHandling('assets/cat.png');
    objectImages[OBJ_DWARF] = loadImageWithErrorHandling('assets/dwarf.png');
    objectImages[OBJ_DRAGON] = loadImageWithErrorHandling('assets/dragon.png');
    objectImages[OBJ_SMALL_BOMB] = loadImageWithErrorHandling('assets/small_bomb.png');
    objectImages[OBJ_CROWN] = loadImageWithErrorHandling('assets/crown.png');
    objectImages[OBJ_DIAMOND] = loadImageWithErrorHandling('assets/diamond.png');
    objectImages[OBJ_WIZARD_STAFF] = loadImageWithErrorHandling('assets/staff.png');

    // Only Floor 1's background is needed to start; later floors and the
    // Ninefold Judgment apparition load in the background (loadDeferredAssets).
    dungeonBackgroundImages = DUNGEON_BACKGROUND_PATHS.map(() => null);
    dungeonBackgroundImages[0] = loadImageWithErrorHandling(DUNGEON_BACKGROUND_PATHS[0]);

    // Load ability and effect images
    for (let i = 0; i <= 3; i++) {
        const framePath = `assets/shadow_bolt/frame${String(i).padStart(4, '0')}.png`;
        shadowBoltFrames[i] = loadImageWithErrorHandling(framePath);
    }
    for (let i = 0; i <= 11; i++) {
        const framePath = `assets/humanoid_splat/frame${String(i).padStart(4, '0')}.png`;
        humanoidSplatFrames[i] = loadImageWithErrorHandling(framePath);
    }
    for (let i = 1; i <= 7; i++) {
        const framePath = `assets/bomb_explosion/frame${i}.png`;
        explosionFrames[i - 1] = loadImageWithErrorHandling(framePath);
    }
    chainImage = loadImageWithErrorHandling('assets/chain.png');
    for (let i = 0; i <= 7; i++) {
        const framePath = `assets/humanoid_splat_ground/frame${String(i).padStart(4, '0')}.png`;
        groundSplatFrames[i] = loadImageWithErrorHandling(framePath);
    }

    // Load Health Potion animation frames
    for (let i = 0; i <= 15; i++) { // Frames 0 to 15
        const framePath = `assets/health_potion/frame${String(i).padStart(4, '0')}.png`;
        healthPotionFrames[i] = loadImageWithErrorHandling(framePath);
    }

    // Load Fireball animation frames
    for (let i = 0; i <= 29; i++) { // Frames 0000 to 0029
        const framePath = `assets/fireball/frame${String(i).padStart(4, '0')}.png`;
        fireballFrames[i] = loadImageWithErrorHandling(framePath);
    }

    // Load Fireball Burst animation frames
    for (let i = 0; i <= 15; i++) { // Frames 0000 to 0015
        const framePath = `assets/fireball_burst/frame${String(i).padStart(4, '0')}.png`;
        fireballBurstFrames[i] = loadImageWithErrorHandling(framePath);
    }

    // Load Magnet animation frames
    for (let i = 0; i <= 2; i++) { // Frames 0000 to 0002
        const framePath = `assets/magnet/frame${String(i).padStart(4, '0')}.png`;
        magnetFrames[i] = loadImageWithErrorHandling(framePath);
    }

    // Load Flying Demon Boss animation frames
    for (let i = 0; i <= 7; i++) { // Frames 0000 to 0007
        const framePath = `assets/bosses/flying_demon/fly/frame${String(i).padStart(4, '0')}.png`;
        bossFrames[i] = loadImageWithErrorHandling(framePath);
    }

    // Load Flying Demon Boss hit animation frames
    for (let i = 0; i <= 6; i++) { // Frames 0000 to 0006
        const framePath = `assets/bosses/flying_demon/get_hit/frame${String(i).padStart(4, '0')}.png`;
        bossHitFrames[i] = loadImageWithErrorHandling(framePath);
    }

    // Load Flying Demon Boss fireball animation frames
    for (let i = 0; i <= 29; i++) { // Frames 0000 to 0029
        const framePath = `assets/bosses/flying_demon/fireball/PNG/frame${String(i).padStart(4, '0')}.png`;
        bossFireballFrames[i] = loadImageWithErrorHandling(framePath);
    }

    // Load Flying Demon Boss idle animation frames
    for (let i = 0; i <= 5; i++) { // Frames 0000 to 0005
        const framePath = `assets/bosses/flying_demon/idle/frame${String(i).padStart(4, '0')}.png`;
        bossIdleFrames[i] = loadImageWithErrorHandling(framePath);
    }

    // Load Flying Demon Boss die animation frames
    for (let i = 0; i <= 16; i++) { // Frames 0000 to 0016
        const framePath = `assets/bosses/flying_demon/die/frame${String(i).padStart(4, '0')}.png`;
        bossDieFrames[i] = loadImageWithErrorHandling(framePath);
    }

    // Load sound effects
    jumpSound = loadSoundWithVolume('assets/jump.mp3');
    doubleJumpSound = loadSoundWithVolume('assets/double_jump.mp3');
    collectSound = loadSoundWithVolume('assets/collect.mp3', HIGHER_SOUND_VOLUME);
    slurpSound = loadSoundWithVolume('assets/slurp.mp3', HIGHER_SOUND_VOLUME);
    glassBreakSound = loadSoundWithVolume('assets/glass_break.mp3');
    gameOverSound = loadSoundWithVolume('assets/game_over.mp3');
    healthPotionSound = loadSoundWithVolume('assets/health_potion.mp3');
    wizardStaffSound = loadSoundWithVolume('assets/wizard_staff.mp3');
    levelCompleteSound = loadSoundWithVolume('assets/level_complete.mp3');
    playerLevelUpSound = loadSoundWithVolume('assets/player_level_up.mp3');
    explodeSound = loadSoundWithVolume('assets/explode.mp3', HIGHER_SOUND_VOLUME);
    splatSound = loadSoundWithVolume('assets/splat.mp3');
    loseLifeSound = loadSoundWithVolume('assets/lose_life.mp3');
    popSound = loadSoundWithVolume('assets/shadowbolt_hit.mp3');
    castSpellSound = loadSoundWithVolume('assets/cast_spell.mp3');
    catMeowSound = loadSoundWithVolume('assets/cat_meow.mp3', HIGHER_SOUND_VOLUME);
    catHurtSound = loadSoundWithVolume('assets/cat_hurt.mp3', HIGHER_SOUND_VOLUME);
    magnetismSound = loadSoundWithVolume('assets/magnetism.mp3', HIGHER_SOUND_VOLUME);
    bossDeathSound = loadSoundWithVolume('assets/boss_death.mp3', HIGHER_SOUND_VOLUME);
    dungeonWarningSound = loadSoundWithVolume('assets/dungeon_warning.mp3', DUNGEON_VOICE_VOLUME);
    dungeonJudgmentSound = loadSoundWithVolume('assets/dungeon_judgment.mp3', DUNGEON_VOICE_VOLUME);
    dungeonRelentsSound = loadSoundWithVolume('assets/dungeon_relents.mp3', DUNGEON_VOICE_VOLUME);

    // Floor 1 music only; Floor 3+ and boss music load in the background (loadDeferredAssets).
    backgroundMusic1 = loadSoundWithVolume('assets/music/background1.mp3', 0.4);
}
