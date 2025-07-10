/**
 * @fileoverview Game constants and configuration values for Mimic Feeder.
 * This file contains all the constant values used throughout the game,
 * organized by category.
 * @author Yestin Johnson
 */

/**
 * Game Configuration - Basic game settings and parameters
 */
/** @const {string} GAME_VERSION - Game version number */
const GAME_VERSION = "0.1.0-alpha";
/** @const {string} GAME_AUTHOR - Game author name */
const GAME_AUTHOR = "Yestin";
/** @const {number} INITIAL_LIVES - Starting number of player lives */
const INITIAL_LIVES = 3;
/** @const {number} MAX_LIVES_START - Maximum number of lives at game start */
const MAX_LIVES_START = 3;
/** @const {number} HUMANS_PER_MAX_LIFE_INCREASE - Number of humans needed to increase max life count */
const HUMANS_PER_MAX_LIFE_INCREASE = 50;
/** @const {number} OBJECTS_PER_GAME_LEVEL - Number of objects per game level */
const OBJECTS_PER_GAME_LEVEL = 10;
/** @const {number} HEALTH_POTION_LEVEL_INTERVAL - Level interval for health potion spawns */
const HEALTH_POTION_LEVEL_INTERVAL = 5;

/**
 * Player Stats - Constants related to player movement, abilities, and progression
 * These values are frame/implicit deltaTime based
 */
/** @const {number} PLAYER_INITIAL_SPEED - Initial movement speed of the player */
const PLAYER_INITIAL_SPEED = 6;
/** @const {number} PLAYER_GRAVITY - Gravity force applied to player */
const PLAYER_GRAVITY = 0.5;
/** @const {number} PLAYER_JUMP_POWER - Initial jump force (negative for upward movement) */
const PLAYER_JUMP_POWER = -12;
/** @const {number} PLAYER_INITIAL_SCALE - Initial scale/size of the player sprite */
const PLAYER_INITIAL_SCALE = 0.40;
/** @const {number} PLAYER_MAX_JUMPS - Maximum number of jumps before landing */
const PLAYER_MAX_JUMPS = 2;
/** @const {number} PLAYER_INITIAL_LEVEL - Starting player level */
const PLAYER_INITIAL_LEVEL = 1;
/** @const {number} PLAYER_XP_CAP_INITIAL - Initial experience points needed to level up */
const PLAYER_XP_CAP_INITIAL = 100;
/** @const {number} PLAYER_XP_CAP_MULTIPLIER - Multiplier for experience cap when leveling up */
const PLAYER_XP_CAP_MULTIPLIER = 2;
/** @const {number} PLAYER_SPEED_INCREASE_PER_LEVEL - Speed increase factor per level */
const PLAYER_SPEED_INCREASE_PER_LEVEL = 1.05;
/** @const {number} PLAYER_SIZE_INCREASE_PER_LEVEL - Size increase factor per level */
const PLAYER_SIZE_INCREASE_PER_LEVEL = 1.05;
/** @const {number} PLAYER_JUMP_INCREASE_PER_LEVEL - Jump power increase factor per level */
const PLAYER_JUMP_INCREASE_PER_LEVEL = 1.03;
/** @const {number} PLAYER_LEVEL_FOR_TENTACLES - Level at which player unlocks tentacle ability */
const PLAYER_LEVEL_FOR_TENTACLES = 5;
/** @const {number} PLAYER_EATING_ZONE_HEIGHT_FACTOR - Factor determining the height of player's eating zone */
const PLAYER_EATING_ZONE_HEIGHT_FACTOR = 0.3;

/**
 * Object Stats - Constants related to game objects and their behavior
 */
/** @const {number} BASE_OBJECT_SPAWN_RATE_FRAMES - Base rate at which objects spawn (in frames) */
const BASE_OBJECT_SPAWN_RATE_FRAMES = 165;
/** @const {number} BASE_DROP_SPEED_PIXELS_PER_SEC - Base speed at which objects fall (pixels per second) */
const BASE_DROP_SPEED_PIXELS_PER_SEC = 60;
/** @const {number} INITIAL_DROP_SPEED_SCALE - Initial scaling factor for drop speed */
const INITIAL_DROP_SPEED_SCALE = 2.0;
/** @const {number} GAME_LEVEL_SCALING_INCREASE - How much game difficulty increases per level */
const GAME_LEVEL_SCALING_INCREASE = 0.05;
/** @const {number} GAME_LEVEL_FOR_BOMBS - Game level at which bombs start appearing */
const GAME_LEVEL_FOR_BOMBS = 3;
/** @const {number} BOMB_SPAWN_CHANCE - Probability of a bomb spawning (0-1) */
const BOMB_SPAWN_CHANCE = 0.15;

/**
 * Special Item Drop Conditions - When and where special items appear
 */
/** @const {number} DUNGEON_FLOOR_FOR_STAFF_DROP - Dungeon floor level when wizard staff can drop */
const DUNGEON_FLOOR_FOR_STAFF_DROP = 2;
/** @const {number} DUNGEON_ZONE_FOR_STAFF_DROP - Dungeon zone when wizard staff can drop */
const DUNGEON_ZONE_FOR_STAFF_DROP = 1;
/** @const {number} DUNGEON_FLOOR_FOR_MAGNET_DROP - Dungeon floor level when magnet can drop */
const DUNGEON_FLOOR_FOR_MAGNET_DROP = 3;
/** @const {number} DUNGEON_ZONE_FOR_MAGNET_DROP - Dungeon zone when magnet can drop */
const DUNGEON_ZONE_FOR_MAGNET_DROP = 1;
/** @const {number} DUNGEON_FLOOR_FOR_DRAGON_SPAWN - Dungeon floor level when dragons can spawn */
const DUNGEON_FLOOR_FOR_DRAGON_SPAWN = 3;
/** @const {number} DUNGEON_ZONE_FOR_DRAGON_SPAWN - Dungeon zone when dragons can spawn */
const DUNGEON_ZONE_FOR_DRAGON_SPAWN = 1;
/** @const {number} DUNGEON_FLOOR_FOR_FIREBALL_SPAWN - Dungeon floor level when fireballs can spawn */
const DUNGEON_FLOOR_FOR_FIREBALL_SPAWN = 4;
/** @const {number} DUNGEON_ZONE_FOR_FIREBALL_SPAWN - Dungeon zone when fireballs can spawn */
const DUNGEON_ZONE_FOR_FIREBALL_SPAWN = 1;

/**
 * Dragon Behavior - Constants controlling dragon movement and actions
 */
/** @const {number} DRAGON_FLIGHT_DURATION_FRAMES - How long dragons fly in a direction (60 frames = 1 second at 60fps) */
const DRAGON_FLIGHT_DURATION_FRAMES = 60;
/** @const {number} DRAGON_FLIGHT_SPEED_MULTIPLIER - How much faster dragons move compared to other objects */
const DRAGON_FLIGHT_SPEED_MULTIPLIER = 3;
/** @const {number} DRAGON_FLIGHT_DIRECTION_MIN_ANGLE - Minimum angle for dragon flight direction (in degrees) */
const DRAGON_FLIGHT_DIRECTION_MIN_ANGLE = -160;
/** @const {number} DRAGON_FLIGHT_DIRECTION_MAX_ANGLE - Maximum angle for dragon flight direction (in degrees) */
const DRAGON_FLIGHT_DIRECTION_MAX_ANGLE = -20;

/**
 * Abilities - Constants related to player special abilities
 * These values are frame/implicit deltaTime based
 */
/** @const {number} SHADOW_BOLT_SPEED - Speed of shadow bolt projectiles (negative for upward movement) */
const SHADOW_BOLT_SPEED = -7;
/** @const {number} SHADOW_BOLT_COOLDOWN_FRAMES - Cooldown between shadow bolt casts (15 frames = 0.5 seconds at 60fps) */
const SHADOW_BOLT_COOLDOWN_FRAMES = 15;
/** @const {number} TENTACLE_COOLDOWN_FRAMES - Cooldown between tentacle ability uses (180 frames = 2 seconds at 60fps) */
const TENTACLE_COOLDOWN_FRAMES = 180;
/** @const {number} INITIAL_TENTACLE_TARGET_LIMIT - Initial number of objects tentacles can target at once */
const INITIAL_TENTACLE_TARGET_LIMIT = 2;
/** @const {number} SHADOW_BOLT_SIZE - Size of shadow bolt projectiles in pixels */
const SHADOW_BOLT_SIZE = 50;
/** @const {number} SHADOW_BOLT_FRAME_DURATION - Duration of each shadow bolt animation frame */
const SHADOW_BOLT_FRAME_DURATION = 5;
/** @const {number} SHADOW_BOLT_BOMB_POINTS - Points awarded for destroying a bomb with shadow bolt */
const SHADOW_BOLT_BOMB_POINTS = 10;
/** @const {number} MAGNETISM_COOLDOWN_FRAMES - Cooldown between magnetism ability uses (600 frames = 10 seconds at 60fps) */
const MAGNETISM_COOLDOWN_FRAMES = 600;
/** @const {number} MAGNETISM_ATTRACTION_SPEED_MULTIPLIER - How much faster objects move when magnetized */
const MAGNETISM_ATTRACTION_SPEED_MULTIPLIER = 2.0;
/** @const {number} MAGNETISM_DURATION_FRAMES - How long magnetism effect lasts (600 frames = 10 seconds at 60fps) */
const MAGNETISM_DURATION_FRAMES = 600;
/** @const {number} DASH_DISTANCE - Distance in pixels that the player dashes */
const DASH_DISTANCE = 100;
/** @const {number} DASH_COOLDOWN_FRAMES - Cooldown between dash ability uses (60 frames = 1 second at 60fps) */
const DASH_COOLDOWN_FRAMES = 60;
/** @const {number} DASH_DOUBLE_TAP_WINDOW_FRAMES - Time window in frames for detecting double tap (15 frames = 0.25 seconds at 60fps) */
const DASH_DOUBLE_TAP_WINDOW_FRAMES = 15;

/**
 * Object Pulling / Effects - Constants for visual effects and animations
 * These values are frame based
 */
/** @const {number} TENTACLE_PULL_DURATION_FRAMES - Duration of tentacle pull animation in frames */
const TENTACLE_PULL_DURATION_FRAMES = 60;
/** @const {number} TENTACLE_EXTENSION_DURATION_FRAMES - Duration of tentacle extension animation in frames */
const TENTACLE_EXTENSION_DURATION_FRAMES = 30;
/** @const {number} SHADOW_BOLT_EXPLOSION_LIFETIME_FRAMES - How long shadow bolt explosion effects last */
const SHADOW_BOLT_EXPLOSION_LIFETIME_FRAMES = 30;
/** @const {number} POPUP_LIFETIME_FRAMES - How long popup text (like points) stays on screen */
const POPUP_LIFETIME_FRAMES = 60;
/** @const {number} EXPLOSION_FRAME_DURATION - Duration of each explosion animation frame */
const EXPLOSION_FRAME_DURATION = 5;
/** @const {number} POPUP_SPEED - Vertical speed of popup text (negative for upward) */
const POPUP_SPEED = -1;
/** @const {number} GROUND_SPLAT_FRAME_DURATION - Duration of each ground splat animation frame */
const GROUND_SPLAT_FRAME_DURATION = 6;
/** @const {number} GROUND_SPLAT_TOTAL_FRAMES - Total number of frames in ground splat animation */
const GROUND_SPLAT_TOTAL_FRAMES = 8;
/** @const {number} HEALTH_POTION_FRAME_DURATION - Duration of each health potion animation frame */
const HEALTH_POTION_FRAME_DURATION = 4;
/** @const {number} HEALTH_POTION_TOTAL_FRAMES - Total number of frames in health potion animation */
const HEALTH_POTION_TOTAL_FRAMES = 16;
/** @const {number} FIREBALL_FRAME_DURATION - Duration of each fireball animation frame */
const FIREBALL_FRAME_DURATION = 4;
/** @const {number} FIREBALL_TOTAL_FRAMES - Total number of frames in fireball animation */
const FIREBALL_TOTAL_FRAMES = 30;
/** @const {number} MAGNET_FRAME_DURATION - Duration of each magnet animation frame */
const MAGNET_FRAME_DURATION = 8;
/** @const {number} MAGNET_TOTAL_FRAMES - Total number of frames in magnet animation */
const MAGNET_TOTAL_FRAMES = 3;

/**
 * UI / Visuals - Constants for user interface and visual elements
 */
/** @const {number} GROUND_Y_OFFSET - Base offset for ground position from bottom of screen */
const GROUND_Y_OFFSET = 10;
/** @const {number} VISUAL_GROUND_HEIGHT_MULTIPLIER - Multiplier for visual ground height */
const VISUAL_GROUND_HEIGHT_MULTIPLIER = 1.4;
/** @const {number} VISUAL_GROUND_HEIGHT - Calculated height of the visual ground element */
const VISUAL_GROUND_HEIGHT = GROUND_Y_OFFSET * VISUAL_GROUND_HEIGHT_MULTIPLIER;
/** @const {number} PLAYER_GROUND_Y_OFFSET - Offset for player position relative to ground */
const PLAYER_GROUND_Y_OFFSET = VISUAL_GROUND_HEIGHT;
/** @const {number} PLAYER_NEARBY_DISTANCE - Distance threshold for considering objects "nearby" to player */
const PLAYER_NEARBY_DISTANCE = 15;
/** @const {number} GAME_LEVEL_NOTIFICATION_DURATION - How long level up notifications display (in frames) */
const GAME_LEVEL_NOTIFICATION_DURATION = 120;
/** @const {number} STAFF_NOTIFICATION_DURATION - How long staff acquisition notifications display (in frames) */
const STAFF_NOTIFICATION_DURATION = 180;
/** @const {number} TENTACLE_NOTIFICATION_DURATION - How long tentacle ability notifications display (in frames) */
const TENTACLE_NOTIFICATION_DURATION = 180;
/** @const {number} HIGH_SCORE_COUNT - Number of high scores to track and display */
const HIGH_SCORE_COUNT = 5;
/** @const {number} NAME_INPUT_MAX_LENGTH - Maximum length of player name input */
const NAME_INPUT_MAX_LENGTH = 10;
/** @const {number} MIN_SHADOW_BOLT_EXPLOSION_SIZE - Minimum size for shadow bolt explosion effects */
const MIN_SHADOW_BOLT_EXPLOSION_SIZE = SHADOW_BOLT_SIZE * 1.5;

/**
 * Sound Volumes - Constants for audio volume levels
 */
/** @const {number} DEFAULT_SOUND_VOLUME - Default volume for most game sounds (0-1) */
const DEFAULT_SOUND_VOLUME = 0.2;
/** @const {number} HIGHER_SOUND_VOLUME - Higher volume for important game sounds (0-1) */
const HIGHER_SOUND_VOLUME = 0.5;

/**
 * Object Types - String constants used as keys for game objects
 */
/** @const {string} OBJ_HUMAN - Human object type identifier */
const OBJ_HUMAN = 'human';
/** @const {string} OBJ_GOBLIN - Goblin object type identifier */
const OBJ_GOBLIN = 'goblin';
/** @const {string} OBJ_ELF - Elf object type identifier */
const OBJ_ELF = 'elf';
/** @const {string} OBJ_WRAITH - Wraith object type identifier */
const OBJ_WRAITH = 'wraith';
/** @const {string} OBJ_CAT - Cat object type identifier */
const OBJ_CAT = 'cat';
/** @const {string} OBJ_DWARF - Dwarf object type identifier */
const OBJ_DWARF = 'dwarf';
/** @const {string} OBJ_DRAGON - Dragon object type identifier */
const OBJ_DRAGON = 'dragon';
/** @const {string} OBJ_SMALL_BOMB - Small bomb object type identifier */
const OBJ_SMALL_BOMB = 'small_bomb';
/** @const {string} OBJ_CROWN - Crown object type identifier */
const OBJ_CROWN = 'crown';
/** @const {string} OBJ_DIAMOND - Diamond object type identifier */
const OBJ_DIAMOND = 'diamond';
/** @const {string} OBJ_HEALTH_POTION - Health potion object type identifier */
const OBJ_HEALTH_POTION = 'health_potion';
/** @const {string} OBJ_WIZARD_STAFF - Wizard staff object type identifier */
const OBJ_WIZARD_STAFF = 'wizardStaff';
/** @const {string} OBJ_FIREBALL - Fireball object type identifier */
const OBJ_FIREBALL = 'fireball';
/** @const {string} OBJ_MAGNET - Magnet object type identifier */
const OBJ_MAGNET = 'magnet';
/** @const {string} OBJ_BOSS - Boss object type identifier */
const OBJ_BOSS = 'boss';

/**
 * Boss Constants - Settings for boss enemy behavior and animations
 */
/** @const {number} BOSS_LIVES - Number of hits required to defeat the boss */
const BOSS_LIVES = 10;
/** @const {number} BOSS_POINTS - Points awarded for defeating the boss */
const BOSS_POINTS = 250;
/** @const {number} BOSS_SPEED - Movement speed of the boss */
const BOSS_SPEED = 3;
/** @const {number} BOSS_FRAME_DURATION - Duration of each boss animation frame */
const BOSS_FRAME_DURATION = 5;
/** @const {number} BOSS_TOTAL_FRAMES - Total number of frames in boss animation */
const BOSS_TOTAL_FRAMES = 8;
/** @const {number} BOSS_HIT_FRAME_DURATION - Duration of each boss hit animation frame */
const BOSS_HIT_FRAME_DURATION = 5;
/** @const {number} BOSS_HIT_TOTAL_FRAMES - Total number of frames in boss hit animation */
const BOSS_HIT_TOTAL_FRAMES = 7;
/** @const {number} BOSS_FIREBALL_COOLDOWN_FRAMES - Cooldown between boss fireball attacks (180 frames = 3 seconds at 60fps) */
const BOSS_FIREBALL_COOLDOWN_FRAMES = 180;
/** @const {number} BOSS_FIREBALL_SPEED - Speed of boss fireballs in pixels per frame */
const BOSS_FIREBALL_SPEED = 10;
/** @const {number} BOSS_FIREBALL_FRAME_DURATION - Duration of each boss fireball animation frame */
const BOSS_FIREBALL_FRAME_DURATION = 3;
/** @const {number} BOSS_FIREBALL_TOTAL_FRAMES - Total number of frames in boss fireball animation */
const BOSS_FIREBALL_TOTAL_FRAMES = 30;
/** @const {number} BOSS_IDLE_FRAME_DURATION - Duration of each boss idle animation frame */
const BOSS_IDLE_FRAME_DURATION = 5;
/** @const {number} BOSS_IDLE_TOTAL_FRAMES - Total number of frames in boss idle animation */
const BOSS_IDLE_TOTAL_FRAMES = 6;
/** @const {number} BOSS_IDLE_DURATION_FRAMES - Duration of boss idle state (60 frames = 1 second at 60fps) */
const BOSS_IDLE_DURATION_FRAMES = 60;
/** @const {number} BOSS_DIE_FRAME_DURATION - Duration of each boss death animation frame */
const BOSS_DIE_FRAME_DURATION = 7;
/** @const {number} BOSS_DIE_TOTAL_FRAMES - Total number of frames in boss death animation (frames 0000 to 0016) */
const BOSS_DIE_TOTAL_FRAMES = 17;
/** @const {number} BOSS_DIE_DURATION_FRAMES - Duration of boss death sequence (120 frames = 2 seconds at 60fps) */
const BOSS_DIE_DURATION_FRAMES = 120;

/**
 * Object Properties - Configuration for all game object types
 * @type {Object.<string, {xp: number, sound: string, effect: ?string, image: ?string, countKey: ?string}>}
 * @property {number} xp - Experience points awarded for collecting this object
 * @property {string} sound - Sound effect to play when collecting this object
 * @property {?string} effect - Special effect to trigger when collecting this object
 * @property {?string} image - Image asset key for this object
 * @property {?string} countKey - Key used for tracking collection count
 */
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

/**
 * Object Spawn Configuration - Controls what objects spawn and when
 * @type {Array<{type: string, probability: (number|undefined), condition: (function|undefined)}>}
 */
const spawnTable = [
    /**
     * Wizard Staff - Special item that grants shadow bolt ability
     * Only spawns once per game when player reaches the right dungeon floor/zone
     */
    {
        type: OBJ_WIZARD_STAFF,
        condition: (state) =>
            !state.player.hasWizardStaff &&
            state.game.dungeonFloor === DUNGEON_FLOOR_FOR_STAFF_DROP &&
            state.game.dungeonZone === DUNGEON_ZONE_FOR_STAFF_DROP &&
            !objects.some(obj => obj.type === OBJ_WIZARD_STAFF)
    },
    /**
     * Health Potion - Grants an extra life
     * Spawns periodically as player progresses through levels
     */
    {
        type: OBJ_HEALTH_POTION,
        condition: (state) =>
            getCurrentLevel() >= state.game.lastHealthPotionLevel + HEALTH_POTION_LEVEL_INTERVAL && // Was lastExtraLifeLevel
            !objects.some(obj => obj.type === OBJ_HEALTH_POTION)
    },
    /**
     * Magnet - Special item that grants magnetism ability
     * Only spawns once per game when player reaches the right dungeon floor/zone
     */
    {
        type: OBJ_MAGNET,
        condition: (state) =>
            !state.player.hasMagnet &&
            !objects.some(obj => obj.type === OBJ_MAGNET) &&
            state.game.dungeonFloor === DUNGEON_FLOOR_FOR_MAGNET_DROP &&
            state.game.dungeonZone === DUNGEON_ZONE_FOR_MAGNET_DROP
    },
    /** Dragon - Rare high-value enemy that only appears in later floors */
    {type: OBJ_DRAGON, probability: 0.05, condition: (state) => state.game.dungeonFloor >= DUNGEON_FLOOR_FOR_DRAGON_SPAWN && state.game.dungeonZone >= DUNGEON_ZONE_FOR_DRAGON_SPAWN},
    /** Crown - Rare high-value collectible */
    {type: OBJ_CROWN, probability: 0.03 * 1.111},
    /** Diamond - Very rare highest-value collectible */
    {type: OBJ_DIAMOND, probability: 0.02 * 1.111},
    /** Cat - Special neutral object that makes a meow sound */
    {type: OBJ_CAT, probability: 0.05 * 1.111}, // Moved cat earlier in the table
    /** Elf - High-value enemy */
    {type: OBJ_ELF, probability: 0.10 * 1.111},
    /** Dwarf - Medium-value enemy */
    {type: OBJ_DWARF, probability: 0.20 * 1.111},
    /** Human - Medium-value enemy that can increase max lives */
    {type: OBJ_HUMAN, probability: 0.20 * 1.111},
    /** Goblin - Common low-value enemy */
    {type: OBJ_GOBLIN, probability: 0.25 * 1.111},
    /** Wraith - Medium-value enemy */
    {type: OBJ_WRAITH, probability: 0.10 * 1.111},
];

/**
 * Sound Mapping - System for managing and playing game sounds
 */

/**
 * Map of sound names to sound objects
 * @type {Object.<string, Object>}
 */
let soundMap = {};

/**
 * Sets up the sound mapping with all game sound effects
 * @function
 */
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

/**
 * Plays a sound by name if it exists and is loaded
 * @function
 * @param {string} soundName - The name of the sound to play
 */
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
