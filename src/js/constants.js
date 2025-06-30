// --- Game Configuration ---
const GAME_VERSION = "0.1.0-alpha";
const GAME_AUTHOR = "Yestin";
const INITIAL_LIVES = 3;
const MAX_LIVES_START = 3;
const HUMANS_PER_MAX_LIFE_INCREASE = 50;
const OBJECTS_PER_GAME_LEVEL = 10;
const HEALTH_POTION_LEVEL_INTERVAL = 5;

// --- Player Stats (Frame/Implicit DeltaTime Based) ---
const PLAYER_INITIAL_SPEED = 6;
const PLAYER_GRAVITY = 0.5;
const PLAYER_JUMP_POWER = -12;
const PLAYER_INITIAL_SCALE = 0.40;
const PLAYER_MAX_JUMPS = 2;
const PLAYER_INITIAL_LEVEL = 1;
const PLAYER_XP_CAP_INITIAL = 100;
const PLAYER_XP_CAP_MULTIPLIER = 2;
const PLAYER_SPEED_INCREASE_PER_LEVEL = 1.05;
const PLAYER_SIZE_INCREASE_PER_LEVEL = 1.05;
const PLAYER_JUMP_INCREASE_PER_LEVEL = 1.03;
const PLAYER_LEVEL_FOR_TENTACLES = 5;
const PLAYER_EATING_ZONE_HEIGHT_FACTOR = 0.3;

// --- Object Stats ---
const BASE_OBJECT_SPAWN_RATE_FRAMES = 165;
const BASE_DROP_SPEED_PIXELS_PER_SEC = 60;
const INITIAL_DROP_SPEED_SCALE = 2.0;
const GAME_LEVEL_SCALING_INCREASE = 0.05;
const GAME_LEVEL_FOR_BOMBS = 3;
const BOMB_SPAWN_CHANCE = 0.15;

// --- Special Item Drop Conditions ---
const DUNGEON_FLOOR_FOR_STAFF_DROP = 2;
const DUNGEON_ZONE_FOR_STAFF_DROP = 1;
const DUNGEON_FLOOR_FOR_MAGNET_DROP = 3;
const DUNGEON_ZONE_FOR_MAGNET_DROP = 1;
const DUNGEON_FLOOR_FOR_DRAGON_SPAWN = 3;
const DUNGEON_ZONE_FOR_DRAGON_SPAWN = 1;
const DUNGEON_FLOOR_FOR_FIREBALL_SPAWN = 4;
const DUNGEON_ZONE_FOR_FIREBALL_SPAWN = 1;

// --- Dragon Behavior ---
const DRAGON_FLIGHT_DURATION_FRAMES = 60; // 1 second at 60fps
const DRAGON_FLIGHT_SPEED_MULTIPLIER = 3;
const DRAGON_FLIGHT_DIRECTION_MIN_ANGLE = -160; // Degrees
const DRAGON_FLIGHT_DIRECTION_MAX_ANGLE = -20; // Degrees

// --- Abilities (Frame/Implicit DeltaTime Based) ---
const SHADOW_BOLT_SPEED = -7;
const SHADOW_BOLT_COOLDOWN_FRAMES = 15; // 0.5 seconds at 60fps
const TENTACLE_COOLDOWN_FRAMES = 180; // 2 seconds at 60fps
const INITIAL_TENTACLE_TARGET_LIMIT = 2;
const SHADOW_BOLT_SIZE = 50;
const SHADOW_BOLT_FRAME_DURATION = 5;
const SHADOW_BOLT_BOMB_POINTS = 10;
const MAGNETISM_COOLDOWN_FRAMES = 600;
const MAGNETISM_ATTRACTION_SPEED_MULTIPLIER = 2.0;
const MAGNETISM_DURATION_FRAMES = 600; // 3 seconds at 60fps

// --- Object Pulling / Effects (Frame Based) ---
const TENTACLE_PULL_DURATION_FRAMES = 60;
const TENTACLE_EXTENSION_DURATION_FRAMES = 30;
const SHADOW_BOLT_EXPLOSION_LIFETIME_FRAMES = 30;
const POPUP_LIFETIME_FRAMES = 60;
const EXPLOSION_FRAME_DURATION = 5;
const POPUP_SPEED = -1;
const GROUND_SPLAT_FRAME_DURATION = 6;
const GROUND_SPLAT_TOTAL_FRAMES = 8;
const HEALTH_POTION_FRAME_DURATION = 4;
const HEALTH_POTION_TOTAL_FRAMES = 16;
const FIREBALL_FRAME_DURATION = 4;
const FIREBALL_TOTAL_FRAMES = 30;
const MAGNET_FRAME_DURATION = 8;
const MAGNET_TOTAL_FRAMES = 3;

// --- UI / Visuals ---
const GROUND_Y_OFFSET = 10;
const VISUAL_GROUND_HEIGHT_MULTIPLIER = 1.4;
const VISUAL_GROUND_HEIGHT = GROUND_Y_OFFSET * VISUAL_GROUND_HEIGHT_MULTIPLIER;
const PLAYER_GROUND_Y_OFFSET = VISUAL_GROUND_HEIGHT;
const PLAYER_NEARBY_DISTANCE = 15;
const GAME_LEVEL_NOTIFICATION_DURATION = 120;
const STAFF_NOTIFICATION_DURATION = 180;
const TENTACLE_NOTIFICATION_DURATION = 180;
const HIGH_SCORE_COUNT = 10;
const NAME_INPUT_MAX_LENGTH = 10;
const MIN_SHADOW_BOLT_EXPLOSION_SIZE = SHADOW_BOLT_SIZE * 1.5;

// --- Sound Volumes ---
const DEFAULT_SOUND_VOLUME = 0.2;
const HIGHER_SOUND_VOLUME = 0.5;

// --- Object Types (used as keys) ---
const OBJ_HUMAN = 'human';
const OBJ_GOBLIN = 'goblin';
const OBJ_ELF = 'elf';
const OBJ_WRAITH = 'wraith';
const OBJ_CAT = 'cat';
const OBJ_DWARF = 'dwarf';
const OBJ_DRAGON = 'dragon';
const OBJ_SMALL_BOMB = 'small_bomb';
const OBJ_CROWN = 'crown';
const OBJ_DIAMOND = 'diamond';
const OBJ_HEALTH_POTION = 'health_potion';
const OBJ_WIZARD_STAFF = 'wizardStaff';
const OBJ_FIREBALL = 'fireball';
const OBJ_MAGNET = 'magnet';
const OBJ_BOSS = 'boss';

// --- Boss Constants ---
const BOSS_LIVES = 10;
const BOSS_POINTS = 250;
const BOSS_SPEED = 3;
const BOSS_FRAME_DURATION = 5;
const BOSS_TOTAL_FRAMES = 8;
const BOSS_HIT_FRAME_DURATION = 5;
const BOSS_HIT_TOTAL_FRAMES = 7;
const BOSS_FIREBALL_COOLDOWN_FRAMES = 180; // 3 seconds at 60fps
const BOSS_FIREBALL_SPEED = 10; // Pixels per frame
const BOSS_FIREBALL_FRAME_DURATION = 3;
const BOSS_FIREBALL_TOTAL_FRAMES = 30;
const BOSS_IDLE_FRAME_DURATION = 5;
const BOSS_IDLE_TOTAL_FRAMES = 6;
const BOSS_IDLE_DURATION_FRAMES = 60; // 1 second at 60fps
const BOSS_DIE_FRAME_DURATION = 7;
const BOSS_DIE_TOTAL_FRAMES = 17; // Frames 0000 to 0016
const BOSS_DIE_DURATION_FRAMES = 120; // 2 seconds at 60fps

// --- Object Properties ---
const objectProperties = {
    [OBJ_HUMAN]: {xp: 10, sound: 'collect', effect: 'checkMaxLifeIncrease', image: 'humanImage', countKey: 'human'},
    [OBJ_GOBLIN]: {xp: 1, sound: 'collect', effect: null, image: 'goblinImage', countKey: 'goblin'},
    [OBJ_ELF]: {xp: 20, sound: 'collect', effect: null, image: 'elfImage', countKey: 'elf'},
    [OBJ_WRAITH]: {xp: 7, sound: 'collect', effect: null, image: 'wraithImage', countKey: 'wraith'},
    [OBJ_CAT]: {xp: 0, sound: 'cat_meow', effect: null, image: 'catImage', countKey: 'cat'},
    [OBJ_DWARF]: {xp: 3, sound: 'collect', effect: null, image: 'dwarfImage', countKey: 'dwarf'},
    [OBJ_DRAGON]: {xp: 25, sound: 'collect', effect: null, image: 'dragonImage', countKey: 'dragon'},
    [OBJ_CROWN]: {xp: 50, sound: 'collect', effect: null, image: 'crownImage', countKey: 'crown'},
    [OBJ_DIAMOND]: {xp: 100, sound: 'collect', effect: null, image: 'diamondImage', countKey: 'diamond'},
    [OBJ_SMALL_BOMB]: {xp: 0, sound: 'explode', effect: 'bombCollect', image: 'smallBombImage', countKey: 'small_bomb'},
    [OBJ_FIREBALL]: {xp: 0, sound: 'explode', effect: 'bombCollect', image: null, countKey: 'fireball'},
    [OBJ_HEALTH_POTION]: {xp: 0, sound: 'healthPotion', effect: 'gainLife', image: null, countKey: null},
    [OBJ_WIZARD_STAFF]: {xp: 0, sound: 'wizardStaff', effect: 'gainStaff', image: 'staffImage', countKey: null},
    [OBJ_MAGNET]: {xp: 0, sound: 'magnetism', effect: 'gainMagnet', image: null, countKey: 'magnet'},
    [OBJ_BOSS]: {xp: BOSS_POINTS, sound: 'explode', effect: null, image: null, countKey: 'boss'},
};

// --- Object Spawn Configuration ---
const spawnTable = [
    {
        type: OBJ_WIZARD_STAFF,
        condition: (state) =>
            !state.player.hasWizardStaff &&
            state.game.dungeonFloor === DUNGEON_FLOOR_FOR_STAFF_DROP && 
            state.game.dungeonZone === DUNGEON_ZONE_FOR_STAFF_DROP &&
            !objects.some(obj => obj.type === OBJ_WIZARD_STAFF)
    },
    {
        type: OBJ_HEALTH_POTION,
        condition: (state) =>
            getCurrentLevel() >= state.game.lastHealthPotionLevel + HEALTH_POTION_LEVEL_INTERVAL && // Was lastExtraLifeLevel
            !objects.some(obj => obj.type === OBJ_HEALTH_POTION)
    },
    {
        type: OBJ_MAGNET,
        condition: (state) =>
            !state.player.hasMagnet &&
            !objects.some(obj => obj.type === OBJ_MAGNET) &&
            state.game.dungeonFloor === DUNGEON_FLOOR_FOR_MAGNET_DROP && 
            state.game.dungeonZone === DUNGEON_ZONE_FOR_MAGNET_DROP
    },
    {type: OBJ_DRAGON, probability: 0.05, condition: (state) => state.game.dungeonFloor >= DUNGEON_FLOOR_FOR_DRAGON_SPAWN && state.game.dungeonZone >= DUNGEON_ZONE_FOR_DRAGON_SPAWN},
    {type: OBJ_CROWN, probability: 0.03 * 1.111},
    {type: OBJ_DIAMOND, probability: 0.02 * 1.111},
    {type: OBJ_CAT, probability: 0.05 * 1.111}, // Moved cat earlier in the table
    {type: OBJ_ELF, probability: 0.10 * 1.111},
    {type: OBJ_DWARF, probability: 0.20 * 1.111},
    {type: OBJ_HUMAN, probability: 0.20 * 1.111},
    {type: OBJ_GOBLIN, probability: 0.25 * 1.111},
    {type: OBJ_WRAITH, probability: 0.10 * 1.111},
];

// --- Sound Mapping ---
let soundMap = {};

function setupSoundMap() {
    soundMap = {
        'jump': jumpSound,
        'double_jump': doubleJumpSound,
        'collect': collectSound,
        'slurp': slurpSound,
        'glass_break': glassBreakSound,
        'game_over': gameOverSound,
        'healthPotion': healthPotionSound,
        'wizardStaff': wizardStaffSound,
        'level_complete': levelCompleteSound,
        'player_level_up': playerLevelUpSound,
        'explode': explodeSound,
        'splat': splatSound,
        'lose_life': loseLifeSound,
        'shadowbolt_hit': popSound,
        'cast_spell': castSpellSound,
        'cat_meow': catMeowSound,
        'magnetism': magnetismSound,
        'background_music1': backgroundMusic1,
        'background_music2': backgroundMusic2
    };
}

function playSound(soundName) {
    if (!soundName) {
        return;
    }
    const sound = soundMap[soundName];
    if (sound && typeof sound.isLoaded === 'function' && sound.isLoaded()) {
        sound.play();
    } else {
        if (soundMap.hasOwnProperty(soundName)) {
            console.warn(`Sound "${soundName}" is in soundMap but not loaded or playable.`);
        } else {
            console.warn(`Sound name "${soundName}" not found in soundMap.`);
        }
    }
}
