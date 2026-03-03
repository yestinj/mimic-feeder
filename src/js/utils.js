let popups = [];

function formatPlayTime(seconds) {
    if (seconds < 60) {
        return `${Math.floor(seconds)}s`;
    } else {
        let m = Math.floor(seconds / 60);
        let s = Math.floor(seconds % 60);
        return `${m}m ${s}s`;
    }
}

function collideRectRect(x1, y1, w1, h1, x2, y2, w2, h2) {
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
}

function isOverlayViewportSupported(minWidth = MIN_OVERLAY_VIEWPORT_WIDTH, minHeight = MIN_OVERLAY_VIEWPORT_HEIGHT) {
    return width >= minWidth && height >= minHeight;
}

function getResponsiveOverlayBounds(
    widthRatio,
    heightRatio,
    minWidth,
    minHeight,
    maxWidth = Infinity,
    maxHeight = Infinity,
    edgePadding = 24
) {
    const availableWidth = Math.max(240, width - edgePadding);
    const availableHeight = Math.max(180, height - edgePadding);
    const widthCap = Math.min(maxWidth, availableWidth);
    const heightCap = Math.min(maxHeight, availableHeight);

    const overlayWidth = Math.max(Math.min(width * widthRatio, widthCap), Math.min(minWidth, widthCap));
    const overlayHeight = Math.max(Math.min(height * heightRatio, heightCap), Math.min(minHeight, heightCap));

    return {
        overlayWidth,
        overlayHeight,
        overlayX: (width - overlayWidth) / 2,
        overlayY: (height - overlayHeight) / 2
    };
}

function drawOverlayViewportWarning(title, navigationLines = [], minWidth = MIN_OVERLAY_VIEWPORT_WIDTH, minHeight = MIN_OVERLAY_VIEWPORT_HEIGHT) {
    const bounds = getResponsiveOverlayBounds(0.8, 0.45, 320, 220, 760, 360);
    const padding = 18;
    const centerX = bounds.overlayX + bounds.overlayWidth / 2;
    let currentY = bounds.overlayY + padding;

    fill(160, 160, 160);
    noStroke();
    rect(bounds.overlayX, bounds.overlayY, bounds.overlayWidth, bounds.overlayHeight, 10);

    fill(0);
    textAlign(LEFT, TOP);
    textStyle(BOLD);
    textSize(24);
    text(title, bounds.overlayX + padding, currentY);
    currentY += 34;

    textStyle(NORMAL);
    textSize(14);
    textLeading(18);
    const statusText = `Resize window for full overlay view.\nMinimum canvas: ${minWidth} x ${minHeight}\nCurrent canvas: ${Math.round(width)} x ${Math.round(height)}`;
    text(statusText, bounds.overlayX + padding, currentY, bounds.overlayWidth - (padding * 2));

    textAlign(CENTER, BOTTOM);
    textStyle(ITALIC);
    textSize(13);
    let navY = bounds.overlayY + bounds.overlayHeight - 16;
    for (let i = navigationLines.length - 1; i >= 0; i--) {
        text(navigationLines[i], centerX, navY);
        navY -= 16;
    }

    textStyle(NORMAL);
    textAlign(LEFT, BASELINE);
}

function computeAdaptiveOverlayLayout(overlayBounds, metricsBuilder, options = {}) {
    const minScale = typeof options.minScale === 'number' ? options.minScale : 0.82;
    const maxIterations = typeof options.maxIterations === 'number' ? options.maxIterations : 6;
    const fitBias = typeof options.fitBias === 'number' ? options.fitBias : 0.98;
    let layoutScale = typeof options.startScale === 'number' ? options.startScale : 1;

    let metrics = metricsBuilder(layoutScale, overlayBounds.overlayWidth, overlayBounds.overlayHeight);
    for (let i = 0; i < maxIterations && metrics.requiredHeight > metrics.availableHeight && layoutScale > minScale; i++) {
        const fitRatio = metrics.availableHeight / Math.max(metrics.requiredHeight, 1);
        layoutScale = Math.max(minScale, layoutScale * fitRatio * fitBias);
        metrics = metricsBuilder(layoutScale, overlayBounds.overlayWidth, overlayBounds.overlayHeight);
    }

    if (metrics.requiredHeight > metrics.availableHeight) {
        return null;
    }

    return {
        ...overlayBounds,
        layoutScale,
        metrics,
        scalePx: (value) => value * layoutScale
    };
}

function wrapTextToLines(textValue, maxWidth) {
    const lines = [];
    const paragraphs = String(textValue ?? '').split('\n');

    for (const paragraph of paragraphs) {
        if (paragraph.length === 0) {
            lines.push('');
            continue;
        }

        const words = paragraph.split(/\s+/).filter(Boolean);
        if (words.length === 0) {
            lines.push('');
            continue;
        }

        let line = words[0];
        for (let i = 1; i < words.length; i++) {
            const candidate = `${line} ${words[i]}`;
            if (textWidth(candidate) <= maxWidth) {
                line = candidate;
            } else {
                lines.push(line);
                line = words[i];
            }
        }
        lines.push(line);
    }

    return lines;
}

function measureWrappedTextHeight(textValue, maxWidth, lineHeight) {
    const lines = wrapTextToLines(textValue, maxWidth);
    return lines.length * lineHeight;
}

function drawWrappedTextBlock(textValue, x, y, maxWidth, lineHeight) {
    const lines = wrapTextToLines(textValue, maxWidth);
    for (let i = 0; i < lines.length; i++) {
        text(lines[i], x, y + (i * lineHeight));
    }
    return lines.length * lineHeight;
}

function updatePopups() {
    const frameDelta = getFrameDelta();

    for (let i = popups.length - 1; i >= 0; i--) {
        let popup = popups[i];
        popup.y += POPUP_SPEED * frameDelta;
        popup.lifetime -= frameDelta;
        popup.alpha = map(popup.lifetime, POPUP_LIFETIME_FRAMES, 0, 255, 0);
        push();
        textFont('Georgia');
        textSize(18);
        textStyle(BOLD);
        textAlign(CENTER, CENTER);
        noStroke();
        fill(20, 10, 6, popup.alpha * 0.9);
        text(popup.text, popup.x + 1.5, popup.y + 1.5);
        fill(255, 230, 130, popup.alpha);
        text(popup.text, popup.x, popup.y);
        pop();
        if (popup.lifetime <= 0) {
            popups.splice(i, 1);
        }
    }
}

function getItemsToDisplay() {
    const items = [
        {
            name: "Crowns",
            count: gameState.collectedCounts.crown,
            points: gameState.collectedCounts.crown * objectProperties[OBJ_CROWN].xp
        },
        {
            name: "Diamonds",
            count: gameState.collectedCounts.diamond,
            points: gameState.collectedCounts.diamond * objectProperties[OBJ_DIAMOND].xp
        },
        {
            name: "Dwarves",
            count: gameState.collectedCounts.dwarf,
            points: gameState.collectedCounts.dwarf * objectProperties[OBJ_DWARF].xp
        },
        {
            name: "Dragons",
            count: gameState.collectedCounts.dragon,
            points: gameState.collectedCounts.dragon * objectProperties[OBJ_DRAGON].xp
        },
        {
            name: "Elves",
            count: gameState.collectedCounts.elf,
            points: gameState.collectedCounts.elf * objectProperties[OBJ_ELF].xp
        },
        {
            name: "Goblins",
            count: gameState.collectedCounts.goblin,
            points: gameState.collectedCounts.goblin * objectProperties[OBJ_GOBLIN].xp
        },
        {
            name: "Humans",
            count: gameState.collectedCounts.human,
            points: gameState.collectedCounts.human * objectProperties[OBJ_HUMAN].xp
        },
        {
            name: "Cats",
            count: gameState.collectedCounts.cat,
            points: gameState.collectedCounts.cat * objectProperties[OBJ_CAT].xp
        },
        {
            name: "Wraiths",
            count: gameState.collectedCounts.wraith,
            points: gameState.collectedCounts.wraith * objectProperties[OBJ_WRAITH].xp
        }
    ];
    return items.sort((a, b) => a.name.localeCompare(b.name));
}

function createPopup(text, x, y) {
    popups.push({
        x: x,
        y: y - 20,
        text: text,
        lifetime: POPUP_LIFETIME_FRAMES,
        alpha: 255
    });
}

function handleScoringAndXP(points) {
    gameState.score += points;
    playerState.experience += points;
    createPopup(`+${points}`, player.x + player.w / 2, player.y);
}

function handleHumanCollection() {
    if (gameState.collectedCounts.human >= gameState.humansForNextMaxLife) {
        playerState.maxLives += 1;
        playerState.lives = min(playerState.lives + 1, playerState.maxLives);
        gameState.humansForNextMaxLife += HUMANS_PER_MAX_LIFE_INCREASE;

        // Queue notification for extra life
        queueExtraLifeNotification();
        playSound('player_level_up'); // Use level up sound for extra life
    }
}

function handleBombCollection(obj) {
    // Increment the appropriate counter based on the object type
    if (obj.type === OBJ_SMALL_BOMB) {
        gameState.collectedCounts.small_bomb++;
    } else if (obj.type === OBJ_FIREBALL) {
        gameState.collectedCounts.fireball++;
    }

    if (!obj.destroyedByBolt) {
        playerState.lives -= 1;
        playSound('lose_life');
        if (playerState.lives <= 0) {
            playerState.lives = 0;
            gameState.shouldTriggerGameOver = true;
            gameState.pendingGameOverCause = obj.type === OBJ_FIREBALL ? 'fireball_hit' : 'bomb_hit';
        }
        // Add screen shake when player loses a life
        triggerScreenShake(8);
    }
    bombExplosions.push({
        x: obj.x, y: obj.y, currentFrame: 0, frameTimer: 0,
        objWidth: obj.w, objHeight: obj.h,
        type: obj.type === OBJ_FIREBALL ? 'fireball_burst' : 'bomb_explosion'
    });
    // Add screen shake for explosion
    triggerScreenShake(5);
    playSound('explode');
}

function handleHealthPotionCollection() {
    if (playerState.lives < playerState.maxLives) {
        playerState.lives = min(playerState.lives + 1, playerState.maxLives);
    }
    gameState.collectedCount++; // Still count as a collected item
}

function handleWizardStaffCollection() {
    playerState.hasWizardStaff = true;
    gameState.collectedCount++;
    queueStaffNotification();
}

function handleMagnetCollection() {
    playerState.hasMagnet = true;
    gameState.collectedCount++;
    queueMagnetNotification();
}

function handleObjectBump(obj, index) {
    playSound('splat');
    groundSplats.push({
        x: obj.x,
        y: obj.y,
        currentFrame: 0,
        frameTimer: 0,
        objWidth: obj.w,
        objHeight: obj.h
    });
    gameState.destroyedCount++;
    if (index >= 0 && index < objects.length) {
        objects.splice(index, 1);
    } else {
        console.warn("handleObjectBump: Invalid index for object removal.");
    }
}

function checkForPlayerLevelUp() {
    while (playerState.experience >= playerState.experienceCap && playerState.experienceCap > 0) {
        let oldLevel = playerState.level;
        playerState.level += 1;
        // Calculate excess XP to carry over
        let excessXP = playerState.experience - playerState.experienceCap;
        playerState.experienceCap = Math.round(playerState.experienceCap * PLAYER_XP_CAP_MULTIPLIER);
        playerState.experience = excessXP;
        playerState.speedPercentage = Math.round(playerState.speedPercentage * PLAYER_SPEED_INCREASE_PER_LEVEL);
        player.speed *= PLAYER_SPEED_INCREASE_PER_LEVEL;
        playerState.sizePercentage = Math.round(playerState.sizePercentage * PLAYER_SIZE_INCREASE_PER_LEVEL);
        player.w *= PLAYER_SIZE_INCREASE_PER_LEVEL;
        player.h *= PLAYER_SIZE_INCREASE_PER_LEVEL;
        player.jumpPower *= PLAYER_JUMP_INCREASE_PER_LEVEL;

        if (playerState.level >= PLAYER_LEVEL_FOR_TENTACLES) {
            let tentacleLine1;
            let tentacleLine2;
            if (oldLevel < PLAYER_LEVEL_FOR_TENTACLES) {
                tentacleLine1 = "Tentacles Unlocked!";
                tentacleLine2 = "Press 'Z' Key to use";
            } else {
                playerState.tentacleTargetLimit += 1;
                tentacleLine1 = "Tentacles +1";
                tentacleLine2 = `Target Limit: ${playerState.tentacleTargetLimit}`;
            }
            queueTentacleNotification(tentacleLine1, tentacleLine2);
        }
        playSound('player_level_up');
    }
}

// Helper functions for dungeon floor and zone conversion
function getCurrentLevel() {
    return (gameState.dungeonFloor - 1) * 5 + gameState.dungeonZone;
}

function getLevelFloorAndZone(level) {
    const floor = Math.floor((level - 1) / 5) + 1;
    const zone = ((level - 1) % 5) + 1;
    return {floor, zone};
}

// Function to clear all objects on screen with appropriate animations
function clearAllObjects() {
    for (let i = objects.length - 1; i >= 0; i--) {
        let obj = objects[i];

        // Create appropriate explosion effect based on object type
        if ([OBJ_HUMAN, OBJ_GOBLIN, OBJ_ELF, OBJ_WRAITH, OBJ_CAT, OBJ_DWARF, OBJ_DRAGON].includes(obj.type)) {
            // Humanoid splat
            groundSplats.push({
                x: obj.x,
                y: obj.y,
                currentFrame: 0,
                frameTimer: 0,
                objWidth: obj.w,
                objHeight: obj.h
            });
            playSound('splat');
        } else if ([OBJ_SMALL_BOMB, OBJ_FIREBALL].includes(obj.type)) {
            // Bomb explosion
            bombExplosions.push({
                x: obj.x,
                y: obj.y,
                currentFrame: 0,
                frameTimer: 0,
                objWidth: obj.w,
                objHeight: obj.h,
                type: obj.type === OBJ_FIREBALL ? 'fireball_burst' : 'bomb_explosion'
            });
            playSound('explode');
        }

        // Remove the object
        objects.splice(i, 1);
    }

    // Clear any boss fireballs
    bossFireballs = [];
}

// Function to create a boss
function createBoss() {
    // Calculate speed multiplier based on floor number
    // Floor 2: 1x speed (base speed)
    // Floor 4: 2x speed
    // Floor 6: 4x speed
    // Floor 8: 8x speed, etc.
    let floorSpeedMultiplier = Math.pow(2, Math.floor((gameState.dungeonFloor - 2) / 2));

    // Calculate additional lives based on floor number
    // Boss spawns at floor 2, 4, 6, etc. (even floors)
    // First spawn (floor 2): +0 lives
    // Second spawn (floor 4): +2 lives
    // Third spawn (floor 6): +4 lives, etc.
    let bossSpawnCount = gameState.dungeonFloor / 2 - 1; // How many times the boss has spawned (0-indexed)
    let additionalLives = bossSpawnCount * 2;

    let initialLives = BOSS_LIVES + additionalLives;

    let boss = {
        type: OBJ_BOSS,
        x: width / 2,
        y: 100, // Position at top of screen, but lower to ensure health bar is visible
        w: 150,
        h: 150,
        visualWidth: 150, // Visual width for drawing
        visualHeight: 150, // Visual height for drawing
        hitboxWidth: 150 * 0.8, // Hitbox width reduced by 20% (10% from each side)
        hitboxHeight: 150 * 0.9, // Hitbox height reduced by 10% at the bottom
        lives: initialLives,
        initialLives: initialLives, // Store initial lives for health bar calculation
        directionX: 1, // 1 for right, -1 for left
        speed: BOSS_SPEED * floorSpeedMultiplier,
        currentFrame: 0,
        frameTimer: 0,
        isHit: false, // Track if boss is in hit state
        hitCurrentFrame: 0, // Current frame of hit animation
        hitFrameTimer: 0, // Timer for hit animation
        fireballCooldown: 0, // Cooldown for firing fireballs
        isIdle: true, // Track if boss is in idle state
        idleCurrentFrame: 0, // Current frame of idle animation
        idleFrameTimer: 0, // Timer for idle animation
        idleDuration: 0, // Timer for idle state duration
        isDying: false, // Track if boss is in dying state
        dieCurrentFrame: 0, // Current frame of die animation
        dieFrameTimer: 0, // Timer for die animation
        dieDuration: 0 // Timer for die state duration
    };

    objects.push(boss);

    // Show boss notification
    queueBossFightNotification();
    playSound('level_complete');
}

function checkForGameLevelUp() {
    if (gameState.objectsEaten >= OBJECTS_PER_GAME_LEVEL) {
        // Increment zone
        gameState.dungeonZone += 1;

        // Check if we should spawn a boss (after zone 4 on even-numbered floors)
        let shouldSpawnBoss = gameState.dungeonZone === 5 && gameState.dungeonFloor % 2 === 0;

        // If zone exceeds 5, increment floor and reset zone to 1
        if (gameState.dungeonZone > 5) {
            gameState.dungeonFloor += 1;
            gameState.dungeonZone = 1;
        }

        gameState.objectsEaten = 0;

        // Calculate level for compatibility with existing code
        const currentLevel = getCurrentLevel();

        let levelMultiplier = 1 + (currentLevel - 1) * GAME_LEVEL_SCALING_INCREASE;
        gameState.dropSpeedScale = INITIAL_DROP_SPEED_SCALE * levelMultiplier;
        gameState.objectSpawnRate = BASE_OBJECT_SPAWN_RATE_FRAMES / levelMultiplier;
        gameState.objectSpawnRate = max(10, Math.round(gameState.objectSpawnRate));

        for (let obj of objects) {
            if (obj.type !== OBJ_BOSS) { // Don't update boss speed
                obj.baseVy = BASE_DROP_SPEED_PX_PER_SECOND * gameState.dropSpeedScale;
                // Apply the stored speed multiplier (for fireballs)
                let speedMultiplier = obj.speedMultiplier || 1;
                obj.vy = obj.baseVy * obj.initialVariation * speedMultiplier;
            }
        }

        // If we should spawn a boss, clear all objects and create the boss
        if (shouldSpawnBoss) {
            clearAllObjects();
            createBoss();
        } else {
            queueGameLevelNotification(`Floor ${gameState.dungeonFloor} Zone ${gameState.dungeonZone}`);
            playSound('level_complete');
        }
    }
}

function collectObject(obj, index, isEaten = false) {
    const props = objectProperties[obj.type];
    if (!props) {
        console.error("Collected unknown object type:", obj.type);
        if (index >= 0 && index < objects.length) {
            objects.splice(index, 1);
        }
        return;
    }

    if (obj.type === OBJ_SMALL_BOMB ||
        obj.type === OBJ_WIZARD_STAFF ||
        obj.type === OBJ_HEALTH_POTION || // Updated type
        obj.type === OBJ_CROWN ||
        obj.type === OBJ_DIAMOND ||
        obj.type === OBJ_MAGNET) {
        isEaten = true;
    }

    if (obj.type === OBJ_SMALL_BOMB || obj.type === OBJ_FIREBALL) {
        handleBombCollection(obj);
        const bombActualIndex = objects.indexOf(obj);
        if (bombActualIndex !== -1) {
            objects.splice(bombActualIndex, 1);
        }
        return;
    }

    if (isEaten) {
        let removeObjectAfterProcessing = true;
        switch (props.effect) {
            case 'gainStaff':
                handleWizardStaffCollection();
                // Add screen shake for staff collection
                triggerScreenShake(3);
                break;
            case 'gainMagnet':
                handleMagnetCollection();
                // Add screen shake for magnet collection
                triggerScreenShake(3);
                break;
            case 'gainLife': // Effect name from objectProperties
                handleHealthPotionCollection(); // Call renamed function
                // Add screen shake for health potion collection
                triggerScreenShake(4);
                break;
            case 'checkMaxLifeIncrease':
                handleHumanCollection();
            // NOTE: No break statement here is intentional.
            // The human collection logic requires fall-through to the default case
            // to properly handle scoring, counting, and game level progression.
            default:
                if (props.xp > 0) {
                    handleScoringAndXP(props.xp);
                }
                if (props.countKey) {
                    gameState.collectedCounts[props.countKey]++;
                }
                // Add screen shake for valuable items
                if (obj.type === OBJ_CROWN || obj.type === OBJ_DIAMOND) {
                    triggerScreenShake(4);
                }
                if (obj.type !== OBJ_WIZARD_STAFF && obj.type !== OBJ_HEALTH_POTION && obj.type !== OBJ_CROWN && obj.type !== OBJ_DIAMOND && obj.type !== OBJ_MAGNET) {
                    gameState.collectedCount++;
                    gameState.objectsEaten++;
                } else if (props.xp > 0 || props.effect) { // Count power-ups if they have xp or an effect
                    gameState.collectedCount++;
                }
                break;
        }

        if (props.sound) {
            playSound(props.sound);
        }

        if (removeObjectAfterProcessing) {
            const eatenObjActualIndex = objects.indexOf(obj);
            if (eatenObjActualIndex !== -1) {
                objects.splice(eatenObjActualIndex, 1);
            }
        }

        if (!gameState.shouldTriggerGameOver) {
            checkForPlayerLevelUp();
            if (obj.type !== OBJ_WIZARD_STAFF && obj.type !== OBJ_HEALTH_POTION && obj.type !== OBJ_CROWN && obj.type !== OBJ_DIAMOND && obj.type !== OBJ_MAGNET) {
                checkForGameLevelUp();
            }
        }
    } else {
        handleObjectBump(obj, index);
    }
}
