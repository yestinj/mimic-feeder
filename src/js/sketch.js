/**
 * @fileoverview Main game file for Mimic Feeder.
 * Contains the core game loop, event handlers, and game state management.
 * @author Yestin Johnson
 */

/**
 * Game State Management - Core variables and initialization
 */

/**
 * Main game state object containing all game-related state
 * @type {Object}
 */
let gameState = {};

/**
 * Player state object containing all player-related state
 * @type {Object}
 */
let playerState = {};

/**
 * Initializes game and player state objects with default values
 * @function
 */
function initializeStates() {
    gameState = {
        score: 0,                                      // Current game score
        dungeonFloor: 1,                               // Current dungeon floor (level)
        dungeonZone: 1,                                // Current zone within the floor
        objectsEaten: 0,                               // Count of objects eaten by player
        gameOver: false,                               // Whether the game is over
        enteringName: false,                           // Whether player is entering name for high score
        playerName: "",                                // Player's name
        lastUsedName: "Player",                        // Last used player name (from localStorage)
        currentNameInput: "",                          // Current input in name field
        startTime: 0,                                  // Game start time (in seconds)
        playTime: 0,                                   // Total play time (in seconds)
        gameStarted: false,                            // Whether game has started
        showIntroScreen: false,                        // Whether to show intro screen
        showHelpScreen: false,                         // Whether to show help screen
        showObjectInfoScreen: false,                   // Whether to show object info screen
        showAboutScreen: false,                        // Whether to show about screen
        shouldTriggerGameOver: false,                  // Flag to trigger game over on next frame
        objectSpawnRate: BASE_OBJECT_SPAWN_RATE_FRAMES,// Rate at which objects spawn
        dropSpeedScale: INITIAL_DROP_SPEED_SCALE,      // Speed at which objects fall
        lastHealthPotionLevel: 0,                      // Last level a health potion appeared
        humansForNextMaxLife: HUMANS_PER_MAX_LIFE_INCREASE, // Humans needed for next max life increase
        collectedCounts: {                             // Counts of each object type collected
            human: 0, goblin: 0, elf: 0, wraith: 0, cat: 0,
            dwarf: 0, dragon: 0, small_bomb: 0, crown: 0, diamond: 0, magnet: 0
        },
        catsRescued: 0,                               // Number of cats rescued
        catsRescuedPoints: 0,                         // Points from rescuing cats
        collectedCount: 0,                            // Total objects collected
        destroyedCount: 0,                            // Total objects destroyed
    };

    playerState = {
        lives: INITIAL_LIVES,                         // Current player lives
        maxLives: MAX_LIVES_START,                    // Maximum lives player can have
        level: PLAYER_INITIAL_LEVEL,                  // Current player level
        experience: 0,                                // Current experience points
        experienceCap: PLAYER_XP_CAP_INITIAL,         // Experience needed for next level
        speedPercentage: 100,                         // Player speed percentage (increases with level)
        sizePercentage: 100,                          // Player size percentage (increases with level)
        hasWizardStaff: false,                        // Whether player has wizard staff
        hasMagnet: false,                             // Whether player has magnet
        tentaclesCooldown: 0,                         // Cooldown timer for tentacles ability
        usingTentacles: false,                        // Whether tentacles are currently active
        tentacleTargetLimit: INITIAL_TENTACLE_TARGET_LIMIT, // Max objects tentacles can target
        magnetismCooldown: 0,                         // Cooldown timer for magnetism ability
        usingMagnetism: false,                        // Whether magnetism is currently active
        magnetizedObjects: [],                        // Objects currently affected by magnetism
        shadowBoltCooldown: 0                         // Cooldown timer for shadow bolt ability
    };
}

/**
 * Global references - Game-wide variables and arrays
 */
/**
 * Array of bomb explosion effects
 * @type {Array}
 */
let bombExplosions = [];
/**
 * Array of shadow bolt explosion effects
 * @type {Array}
 */
let shadowBoltExplosions = [];
/**
 * Array of ground splat effects
 * @type {Array}
 */
let groundSplats = [];
/**
 * Array of boss fireball projectiles
 * @type {Array}
 */
let bossFireballs = [];
/**
 * Whether audio has been started
 * @type {boolean}
 */
let audioStarted = false;
/**
 * Game canvas aspect ratio
 * @const {number}
 */
const ASPECT_RATIO = 1024 / 768;
// UI elements declared globally in ui.js

/**
 * Timer for shadow bolt mouth animation
 * @type {number}
 */
let shadowBoltAjarTimer = 0;
/**
 * Duration of shadow bolt mouth animation
 * @const {number}
 */
const SHADOW_BOLT_AJAR_DURATION = 15;
/**
 * Timer for jump eat mouth animation
 * @type {number}
 */
let jumpEatOpenTimer = 0;
/**
 * Duration of jump eat mouth animation
 * @const {number}
 */
const JUMP_EAT_OPEN_DURATION = 45;

/**
 * Flag to track initial page load vs restart
 * @type {boolean}
 */
let isInitialPageLoad = true;

/**
 * p5.js setup function - Called once at the beginning
 * Sets up the canvas, initializes game state, and prepares the game
 * @function
 */
function setup() {
    // Calculate canvas dimensions based on aspect ratio and window size
    let canvasWidth, canvasHeight;
    if (windowWidth / windowHeight >= ASPECT_RATIO) {
        canvasHeight = windowHeight;
        canvasWidth = canvasHeight * ASPECT_RATIO;
    } else {
        canvasWidth = windowWidth;
        canvasHeight = canvasWidth / ASPECT_RATIO;
    }

    // Create and configure the canvas
    let canvas = createCanvas(canvasWidth, canvasHeight);
    canvas.parent('gameContainer');
    canvas.elt.setAttribute('role', 'application');
    canvas.elt.setAttribute('aria-label', 'Interactive game canvas');

    // Initialize game state and components
    initializeStates();
    setupPlayer();
    setupSoundMap();
    setupUI(); // This calls loadLastUsedName()

    // Set current name input based on whether user has entered a name before
    if (gameState.lastUsedName !== "Player") {
        // If user has entered a name before, use that name
        gameState.currentNameInput = gameState.lastUsedName;
    } else {
        // If it's the default placeholder name, don't prepopulate
        gameState.currentNameInput = "";
    }

    // Decide whether to show intro screen
    if (isInitialPageLoad) {
        // Only show intro screen if this is the first time the game is loaded
        if (gameState.lastUsedName === "Player") {
            gameState.showIntroScreen = true;
        } else {
            gameState.showIntroScreen = false;
            gameState.startTime = millis() / 1000;
            gameState.gameStarted = true;
            startAudioIfNeeded();
        }
        isInitialPageLoad = false; // Mark that initial load has passed
    } else {
        // This path is taken after a restartGame() call
        gameState.showIntroScreen = false;
        gameState.startTime = millis() / 1000;
        gameState.gameStarted = true;
        startAudioIfNeeded();
    }
}

/**
 * p5.js windowResized function - Called when the browser window is resized
 * Adjusts canvas and UI elements to fit the new window size
 * @function
 */
function windowResized() {
    // Recalculate canvas dimensions based on aspect ratio and new window size
    let canvasWidth, canvasHeight;
    if (windowWidth / windowHeight >= ASPECT_RATIO) {
        canvasHeight = windowHeight;
        canvasWidth = canvasHeight * ASPECT_RATIO;
    } else {
        canvasWidth = windowWidth;
        canvasHeight = canvasWidth / ASPECT_RATIO;
    }
    resizeCanvas(canvasWidth, canvasHeight);

    // Reposition UI buttons
    if (typeof retryButton !== 'undefined') {
        retryButton.x = width / 2 - retryButton.w / 2;
        retryButton.y = height / 2 - 150;
    }
    if (typeof submitButton !== 'undefined') {
        submitButton.x = width / 2 - submitButton.w / 2;
        submitButton.y = height / 2 + 90;
    }
}

/**
 * p5.js draw function - Called continuously to render and update the game
 * This is the main game loop that handles rendering and game logic
 * @function
 */
function draw() {
    // Update background music based on level
    if (gameState.gameStarted && !gameState.gameOver && !gameState.showIntroScreen) {
        updateBackgroundMusic();
    }

    // Draw the appropriate background based on dungeon floor
    if (gameState.dungeonFloor < 3) {
        if (bgImage1) {
            image(bgImage1, 0, 0, width, height);
        } else {
            background(20, 0, 0);
        }
    } else {
        if (bgImage2) {
            image(bgImage2, 0, 0, width, height);
        } else {
            background(0, 0, 20);
        }
    }

    if (gameState.showIntroScreen) {
        drawIntroScreen();
        return;
    }
    if (gameState.gameOver) {
        if (gameState.enteringName) {
            drawNameInputScreen();
        } else {
            drawGameOverScreen();
        }
        return;
    }
    if (gameState.showHelpScreen) {
        drawHelpScreen();
        return;
    }
    if (gameState.showObjectInfoScreen) {
        drawObjectInfoScreen();
        return;
    }
    if (gameState.showAboutScreen) {
        drawAboutScreen();
        return;
    }

    if (!gameState.gameStarted) {
        gameState.startTime = millis() / 1000;
        gameState.gameStarted = true;
    }

    updatePlayer();
    spawnObjects();
    updateObjects();
    updateShadowBolts();
    updateTongues();
    updateMagnetism();
    updateBossFireballs();
    updateBombExplosions();
    updateShadowBoltExplosions();
    updatePopups();
    updateGroundSplats();

    if (gameLevelNotification.active) {
        gameLevelNotification.timer -= 1;
        if (gameLevelNotification.timer <= 0) {
            gameLevelNotification.active = false;
        }
    }
    if (staffNotification.active) {
        staffNotification.timer -= 1;
        if (staffNotification.timer <= 0) {
            staffNotification.active = false;
        }
    }
    if (tentacleNotification.active) {
        tentacleNotification.timer -= 1;
        if (tentacleNotification.timer <= 0) {
            tentacleNotification.active = false;
        }
    }
    if (magnetNotification.active) {
        magnetNotification.timer -= 1;
        if (magnetNotification.timer <= 0) {
            magnetNotification.active = false;
        }
    }
    if (extraLifeNotification.active) {
        extraLifeNotification.timer -= 1;
        if (extraLifeNotification.timer <= 0) {
            extraLifeNotification.active = false;
        }
    }

    if (playerState.tentaclesCooldown > 0) {
        playerState.tentaclesCooldown -= 1;
    }
    if (playerState.magnetismCooldown > 0) {
        playerState.magnetismCooldown -= 1;
    }
    if (playerState.shadowBoltCooldown > 0) {
        playerState.shadowBoltCooldown -= 1;
    }
    if (openChestTimer > 0) {
        openChestTimer -= 1;
    }
    if (shadowBoltAjarTimer > 0) {
        shadowBoltAjarTimer -= 1;
    }
    if (jumpEatOpenTimer > 0) {
        jumpEatOpenTimer -= 1;
    }


    if (gameState.shouldTriggerGameOver) {
        gameState.shouldTriggerGameOver = false;
        triggerGameOver();
    }

    fill(80, 80, 80);
    rect(0, height - VISUAL_GROUND_HEIGHT, width, VISUAL_GROUND_HEIGHT);
    drawPlayer();

    if (gameLevelNotification.active) {
        fill(255, 255, 0);
        textSize(48);
        textAlign(CENTER, CENTER);
        textStyle(BOLD);
        text(gameLevelNotification.text, width / 2, height / 2);
        textStyle(NORMAL);
    }
    if (staffNotification.active) {
        fill(0, 0, 0, 150);
        noStroke();
        rect(width / 2 - 170, height / 2 - 40, 340, 80, 10);
        fill(255, 215, 0);
        textSize(28);
        textAlign(CENTER, CENTER);
        textStyle(BOLD);
        text(staffNotification.line1, width / 2, height / 2 - 10);
        textSize(18);
        textStyle(ITALIC);
        fill(230);
        text(staffNotification.line2, width / 2, height / 2 + 20);
        textStyle(NORMAL);
    }
    if (tentacleNotification.active) {
        fill(0, 0, 0, 150);
        noStroke();
        rect(width / 2 - 170, height / 2 - 40, 340, 80, 10);
        fill(138, 43, 226);
        textSize(28);
        textAlign(CENTER, CENTER);
        textStyle(BOLD);
        text(tentacleNotification.line1, width / 2, height / 2 - 10);
        textSize(18);
        textStyle(ITALIC);
        fill(230);
        text(tentacleNotification.line2, width / 2, height / 2 + 20);
        textStyle(NORMAL);
    }

    if (magnetNotification.active) {
        fill(0, 0, 0, 150);
        noStroke();
        rect(width / 2 - 170, height / 2 - 40, 340, 80, 10);
        fill(0, 100, 255);
        textSize(28);
        textAlign(CENTER, CENTER);
        textStyle(BOLD);
        text(magnetNotification.line1, width / 2, height / 2 - 10);
        textSize(18);
        textStyle(ITALIC);
        fill(230);
        text(magnetNotification.line2, width / 2, height / 2 + 20);
        textStyle(NORMAL);
    }

    if (extraLifeNotification.active) {
        fill(0, 0, 0, 150);
        noStroke();
        rect(width / 2 - 170, height / 2 - 40, 340, 80, 10);
        fill(255, 0, 0); // Red color for extra life
        textSize(28);
        textAlign(CENTER, CENTER);
        textStyle(BOLD);
        text(extraLifeNotification.line1, width / 2, height / 2 - 10);
        textSize(18);
        textStyle(ITALIC);
        fill(230);
        text(extraLifeNotification.line2, width / 2, height / 2 + 20);
        textStyle(NORMAL);
    }

    drawUI();
}

/**
 * Triggers the game over state
 * Sets up the game over screen and plays appropriate sounds
 * @function
 */
function triggerGameOver() {
    gameState.gameOver = true;
    gameState.enteringName = true;
    gameState.playTime = (millis() / 1000) - gameState.startTime;
    playSound('game_over');
    stopAllSounds(true, false); // Stop all sounds including background music
}

/**
 * Starts the audio context if needed
 * Ensures audio can play when user interacts with the game
 * @function
 */
function startAudioIfNeeded() {
    if (getAudioContext() && getAudioContext().state === 'suspended' && !audioStarted) {
        userStartAudio();
        audioStarted = true;
        updateBackgroundMusic(); // Start background music when audio is started
    } else if (!getAudioContext() && !audioStarted) {
        userStartAudio();
        audioStarted = true;
        updateBackgroundMusic(); // Start background music when audio is started
    }
}

/**
 * Updates and renders bomb explosion animations
 * Manages explosion animation frames and removes completed explosions
 * @function
 */
function updateBombExplosions() {
    for (let i = bombExplosions.length - 1; i >= 0; i--) {
        let explosion = bombExplosions[i];
        explosion.frameTimer++;
        if (explosion.frameTimer >= EXPLOSION_FRAME_DURATION) {
            explosion.currentFrame++;
            explosion.frameTimer = 0;
        }

        // Determine which frames to use based on explosion type
        let framesArray = explosionFrames;
        let maxFrames = explosionFrames.length;

        if (explosion.type === 'fireball_burst') {
            framesArray = fireballBurstFrames;
            maxFrames = fireballBurstFrames.length;
        }

        if (explosion.currentFrame < maxFrames && framesArray[explosion.currentFrame]) {
            let frameImage = framesArray[explosion.currentFrame];
            let explosionWidth = 50;
            let explosionHeight = 50;
            if (explosion.objWidth && explosion.objHeight && frameImage.width && frameImage.height) {
                let targetWidth = explosion.objWidth;
                let targetHeight = explosion.objHeight;
                let targetSize = Math.min(targetWidth, targetHeight) * 2;
                let explosionAspectRatio = frameImage.width / frameImage.height;
                if (explosionAspectRatio >= 1) {
                    explosionWidth = targetSize;
                    explosionHeight = targetSize / explosionAspectRatio;
                } else {
                    explosionHeight = targetSize;
                    explosionWidth = targetSize * explosionAspectRatio;
                }
            }
            image(frameImage, explosion.x - explosionWidth / 2, explosion.y - explosionHeight / 2, explosionWidth, explosionHeight);
        } else if (explosion.currentFrame >= maxFrames) {
            bombExplosions.splice(i, 1);
        }
    }
}

function updateShadowBoltExplosions() {
    for (let i = shadowBoltExplosions.length - 1; i >= 0; i--) {
        let effect = shadowBoltExplosions[i];
        effect.lifetime -= 1;
        if (effect.lifetime <= 0) {
            shadowBoltExplosions.splice(i, 1);
            continue;
        }
        let frameIndex = Math.floor(map(effect.lifetime, SHADOW_BOLT_EXPLOSION_LIFETIME_FRAMES, 1, 0, humanoidSplatFrames.length - 1));
        frameIndex = constrain(frameIndex, 0, humanoidSplatFrames.length - 1);

        if (humanoidSplatFrames[frameIndex] && humanoidSplatFrames[frameIndex].width) {
            let frameImage = humanoidSplatFrames[frameIndex];
            let effectDrawWidth;
            let effectDrawHeight;
            let targetSizeBasedOnObject = 0;
            if (effect.objWidth && effect.objHeight) {
                targetSizeBasedOnObject = Math.min(effect.objWidth, effect.objHeight) * 2;
            }
            let finalTargetSize = Math.max(targetSizeBasedOnObject, MIN_SHADOW_BOLT_EXPLOSION_SIZE);
            let effectAspectRatio = frameImage.width / frameImage.height;
            if (effectAspectRatio >= 1) {
                effectDrawWidth = finalTargetSize;
                effectDrawHeight = finalTargetSize / effectAspectRatio;
            } else {
                effectDrawHeight = finalTargetSize;
                effectDrawWidth = finalTargetSize * effectAspectRatio;
            }
            image(frameImage, effect.x - effectDrawWidth / 2, effect.y - effectDrawHeight / 2, effectDrawWidth, effectDrawHeight);
        }
    }
}


function updateGroundSplats() {
    for (let i = groundSplats.length - 1; i >= 0; i--) {
        let splat = groundSplats[i];
        splat.frameTimer += 1;
        if (splat.frameTimer >= GROUND_SPLAT_FRAME_DURATION) {
            splat.currentFrame += 1;
            splat.frameTimer = 0;
        }
        if (splat.currentFrame >= GROUND_SPLAT_TOTAL_FRAMES) {
            groundSplats.splice(i, 1);
            continue;
        }
        let frameImage = groundSplatFrames[splat.currentFrame];
        if (frameImage && frameImage.width) {
            let splatScale = 1.5;
            let splatBaseWidth = splat.objWidth * splatScale;
            let splatBaseHeight = splat.objHeight * splatScale;
            let splatAspectRatio = frameImage.width / frameImage.height;
            let splatDrawWidth = splatBaseWidth;
            let splatDrawHeight = splatBaseHeight;
            if (splatAspectRatio >= 1) {
                splatDrawHeight = splatDrawWidth / splatAspectRatio;
            } else {
                splatDrawWidth = splatDrawHeight * splatAspectRatio;
            }
            image(frameImage, splat.x - splatDrawWidth / 2, splat.y - splatDrawHeight / 2, splatDrawWidth, splatDrawHeight);
        }
    }
}

function updateBossFireballs() {
    for (let i = bossFireballs.length - 1; i >= 0; i--) {
        let fireball = bossFireballs[i];

        // Update position
        fireball.y += fireball.speed;

        // Update animation
        fireball.frameTimer++;
        if (fireball.frameTimer >= BOSS_FIREBALL_FRAME_DURATION) {
            fireball.currentFrame = (fireball.currentFrame + 1) % BOSS_FIREBALL_TOTAL_FRAMES;
            fireball.frameTimer = 0;
        }

        // Draw fireball
        if (bossFireballFrames[fireball.currentFrame] && bossFireballFrames[fireball.currentFrame].width) {
            push();
            translate(fireball.x, fireball.y);
            // Rotate 90 degrees clockwise (PI/2 radians)
            rotate(PI/2);
            image(bossFireballFrames[fireball.currentFrame], -fireball.w/2, -fireball.h/2, fireball.w, fireball.h);
            pop();
        } else {
            // Fallback if image not loaded
            push();
            translate(fireball.x, fireball.y);
            fill(255, 100, 0);
            ellipse(0, 0, fireball.w, fireball.h);
            pop();
        }

        // Check for collision with player
        if (collideRectRect(
            fireball.x - fireball.w/2, fireball.y - fireball.h/2, fireball.w, fireball.h,
            player.x, player.y, player.w, player.h
        )) {
            // Player hit by fireball
            playerState.lives -= 1;
            playSound('lose_life');
            if (playerState.lives <= 0) {
                playerState.lives = 0;
                gameState.shouldTriggerGameOver = true;
            }

            // Create explosion
            bombExplosions.push({
                x: fireball.x,
                y: fireball.y,
                currentFrame: 0,
                frameTimer: 0,
                objWidth: fireball.w,
                objHeight: fireball.h,
                type: 'fireball_burst'
            });
            playSound('explode');

            // Remove fireball
            bossFireballs.splice(i, 1);
            continue;
        }

        // Check if fireball hit ground
        let groundLevel = height - PLAYER_GROUND_Y_OFFSET;
        if (fireball.y + fireball.h/2 >= groundLevel) {
            // Create explosion
            bombExplosions.push({
                x: fireball.x,
                y: groundLevel - fireball.h/2,
                currentFrame: 0,
                frameTimer: 0,
                objWidth: fireball.w,
                objHeight: fireball.h,
                type: 'fireball_burst'
            });
            playSound('explode');

            // Remove fireball
            bossFireballs.splice(i, 1);
            continue;
        }
    }
}

/**
 * p5.js keyPressed function - Called when a key is pressed
 * Handles keyboard input for game controls and navigation
 * @function
 */
function keyPressed() {
    // Handle key presses for different game screens
    if (gameState.showIntroScreen && handleIntroScreenKeyPressed()) {
        return;
    }
    if (gameState.gameOver && gameState.enteringName && handleNameInputScreenKeyPressed()) {
        return;
    }
    if (gameState.gameOver && !gameState.enteringName && keyCode === ENTER) {
        startAudioIfNeeded();
        restartGame();
        return;
    }
    if (gameState.showHelpScreen && handleHelpScreenKeyPressed()) {
        return;
    }
    if (gameState.showObjectInfoScreen && handleObjectInfoScreenKeyPressed()) {
        return;
    }
    if (gameState.showAboutScreen && handleAboutScreenKeyPressed()) {
        return;
    }

    // Show help screen when Escape is pressed during gameplay
    if (!gameState.showIntroScreen && !gameState.gameOver && !gameState.showHelpScreen && keyCode === ESCAPE) {
        gameState.showHelpScreen = true;
        return;
    }

    // Skip gameplay controls if not in active game state
    if (gameState.showIntroScreen || gameState.gameOver || gameState.showHelpScreen) {
        return;
    }

    // Handle gameplay controls
    startAudioIfNeeded();
    handlePlayerJump();
    handleTentaclesAbility();
    handleShadowBolt();
    handleMagnetismAbility();
}

/**
 * p5.js keyTyped function - Called when a key that produces a character is pressed
 * Used primarily for text input in name entry screen
 * @function
 */
function keyTyped() {
    if (gameState.showIntroScreen) {
        return;
    }
    if (gameState.gameOver && gameState.enteringName) {
        handleNameInputScreenKeyTyped();
    }
}

/**
 * p5.js mousePressed function - Called when a mouse button is pressed
 * Handles mouse input for buttons and UI interactions
 * @function
 */
function mousePressed() {
    // Handle mouse presses for different game screens
    if (gameState.showIntroScreen && handleIntroScreenMousePressed()) {
        return;
    }
    if (gameState.gameOver && gameState.enteringName && handleNameInputScreenMousePressed()) {
        return;
    }
    if (gameState.gameOver && !gameState.enteringName && handleGameOverScreenMousePressed()) {
        return;
    }

    // Ensure audio is started when interacting with the game
    if (!gameState.gameOver && !gameState.showIntroScreen) {
        startAudioIfNeeded();
    }
}

/**
 * Stops all game sounds with options to allow specific sounds to continue
 * @function
 * @param {boolean} [allowGameOverSound=false] - Whether to allow game over sound to continue playing
 * @param {boolean} [keepBackgroundMusic=false] - Whether to keep background music playing
 */
function stopAllSounds(allowGameOverSound = false, keepBackgroundMusic = false) {
    for (const soundName in soundMap) {
        if (soundMap.hasOwnProperty(soundName)) {
            const sound = soundMap[soundName];
            if (sound && typeof sound.stop === 'function' && typeof sound.isLoaded === 'function' && sound.isLoaded()) {
                if ((sound === gameOverSound && allowGameOverSound) ||
                    (keepBackgroundMusic && (sound === backgroundMusic1 || sound === backgroundMusic2))) {
                    // Skip these sounds based on parameters
                } else {
                    sound.stop();
                }
            }
        }
    }
}

/**
 * Manages background music based on current dungeon floor
 * Switches between two background tracks depending on floor number
 * @function
 */
function updateBackgroundMusic() {
    // Determine which background music should be playing based on floor
    // Floors 1-2, 5-6, etc. use backgroundMusic1
    // Floors 3-4, 7-8, etc. use backgroundMusic2
    let shouldPlayMusic1 = gameState.dungeonFloor % 4 < 2;

    // Check if the correct music is already playing
    if (shouldPlayMusic1) {
        if (backgroundMusic1 && !backgroundMusic1.isPlaying() && backgroundMusic1.isLoaded()) {
            // Stop the other music if it's playing
            if (backgroundMusic2 && backgroundMusic2.isPlaying()) {
                backgroundMusic2.stop();
            }
            // Start playing backgroundMusic1 and loop it
            backgroundMusic1.loop();
        }
    } else {
        if (backgroundMusic2 && !backgroundMusic2.isPlaying() && backgroundMusic2.isLoaded()) {
            // Stop the other music if it's playing
            if (backgroundMusic1 && backgroundMusic1.isPlaying()) {
                backgroundMusic1.stop();
            }
            // Start playing backgroundMusic2 and loop it
            backgroundMusic2.loop();
        }
    }
}

/**
 * Restarts the game, resetting all game state to initial values
 * Clears all objects and resets player state
 * @function
 */
function restartGame() {
    // Stop all sounds and reset game state
    stopAllSounds(false, false); // Stop all sounds including background music
    initializeStates(); // This resets gameState.lastUsedName to "Player"

    // Load name from localStorage and set up name input
    loadLastUsedName();
    if (gameState.lastUsedName !== "Player") {
        // If user has entered a name before, use that name
        gameState.currentNameInput = gameState.lastUsedName;
    } else {
        // If it's the default placeholder name, don't prepopulate
        gameState.currentNameInput = "";
    }

    // Reset player and clear all game objects
    resetPlayer();
    objects = [];
    popups = [];
    tongues = [];
    shadowBolts = [];
    bombExplosions = [];
    shadowBoltExplosions = [];
    groundSplats = [];
    bossFireballs = [];

    // Reset timers
    openChestTimer = 0;
    shadowBoltAjarTimer = 0;
    jumpEatOpenTimer = 0;

    // Reset notifications
    gameLevelNotification.active = false;
    gameLevelNotification.timer = 0;
    gameLevelNotification.text = "";
    staffNotification.active = false;
    staffNotification.timer = 0;
    tentacleNotification.active = false;
    tentacleNotification.timer = 0;
    magnetNotification.active = false;
    magnetNotification.timer = 0;

    // Reset audio and game state
    audioStarted = false;
    gameState.gameStarted = true;
    gameState.showIntroScreen = false; // DO NOT show intro on restart
    gameState.showObjectInfoScreen = false; // Reset Object Info screen flag
    gameState.showAboutScreen = false; // Reset About screen flag
    gameState.startTime = millis() / 1000;
    startAudioIfNeeded();
}
