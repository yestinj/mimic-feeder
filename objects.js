let objects = [];

// Keep track of recent X positions for spawn separation
const RECENT_SPAWN_X_POSITIONS_MAX = 3;
let recentSpawnXPositions = [];
const MIN_SPAWN_HORIZONTAL_DISTANCE = 50;

function spawnObjects() {
    // Check if a boss exists - if so, don't spawn any objects
    for (let obj of objects) {
        if (obj.type === OBJ_BOSS) {
            return; // Exit without spawning if boss is present
        }
    }

    if (frameCount % Math.round(gameState.objectSpawnRate) === 0) {
        let typeToSpawn = null;
        let spawnChance = random();
        let cumulativeProb = 0;
        const currentState = {game: gameState, player: playerState};

        // First, check for special items with conditions (staff, potion, magnet)
        for (const entry of spawnTable) {
            if (entry.condition && !entry.probability) {
                if (entry.condition(currentState)) {
                    typeToSpawn = entry.type;
                    if (typeToSpawn === OBJ_HEALTH_POTION) { // Updated type check
                        gameState.lastHealthPotionLevel = getCurrentLevel(); // Use getCurrentLevel function
                    }
                    break;
                }
            }
        }

        // If no special item was selected, use probability-based selection
        if (!typeToSpawn) {
            for (const entry of spawnTable) {
                if (entry.probability) {
                    // Skip dragon if not at required floor/zone
                    if (entry.type === OBJ_DRAGON && 
                        (gameState.dungeonFloor < DUNGEON_FLOOR_FOR_DRAGON_SPAWN || 
                         (gameState.dungeonFloor === DUNGEON_FLOOR_FOR_DRAGON_SPAWN && 
                          gameState.dungeonZone < DUNGEON_ZONE_FOR_DRAGON_SPAWN))) {
                        continue;
                    }

                    cumulativeProb += entry.probability;
                    if (spawnChance < cumulativeProb) {
                        if (entry.condition && !entry.condition(currentState)) {
                            continue;
                        }
                        typeToSpawn = entry.type;
                        break;
                    }
                }
            }
        }
        if (!typeToSpawn && spawnTable.length > 0 && spawnTable[spawnTable.length - 1].probability) {
            const lastEntry = spawnTable[spawnTable.length - 1];
            if (!lastEntry.condition || lastEntry.condition(currentState)) {
                typeToSpawn = lastEntry.type;
            }
        }
        if (typeToSpawn) {
            let newObjectX;
            let attempts = 0;
            const MAX_SPAWN_ATTEMPTS = 5;
            let positionFound = false;
            while (attempts < MAX_SPAWN_ATTEMPTS && !positionFound) {
                newObjectX = random(0, width - 40);
                positionFound = true;
                for (let recentX of recentSpawnXPositions) {
                    if (abs(newObjectX - recentX) < MIN_SPAWN_HORIZONTAL_DISTANCE) {
                        positionFound = false;
                        break;
                    }
                }
                attempts++;
            }
            createObject(typeToSpawn, newObjectX);
        }
        // Spawn bombs from level 3 and fireballs from level 10
        if (getCurrentLevel() >= GAME_LEVEL_FOR_BOMBS) {
            if (random() < BOMB_SPAWN_CHANCE) {
                let bombX;
                let attempts = 0;
                const MAX_SPAWN_ATTEMPTS = 5;
                let positionFound = false;
                while (attempts < MAX_SPAWN_ATTEMPTS && !positionFound) {
                    bombX = random(0, width - 40);
                    positionFound = true;
                    for (let recentX of recentSpawnXPositions) {
                        if (abs(bombX - recentX) < MIN_SPAWN_HORIZONTAL_DISTANCE) {
                            positionFound = false;
                            break;
                        }
                    }
                    if (typeToSpawn && objects.length > 0 && abs(bombX - objects[objects.length - 1].x) < MIN_SPAWN_HORIZONTAL_DISTANCE) {
                        positionFound = false;
                    }
                    attempts++;
                }
                // Only spawn fireballs from the specified floor/zone, otherwise spawn bombs
                const canSpawnFireball = gameState.dungeonFloor > DUNGEON_FLOOR_FOR_FIREBALL_SPAWN || 
                                        (gameState.dungeonFloor === DUNGEON_FLOOR_FOR_FIREBALL_SPAWN && 
                                         gameState.dungeonZone >= DUNGEON_ZONE_FOR_FIREBALL_SPAWN);
                if (random() < 0.5 || !canSpawnFireball) {
                    createObject(OBJ_SMALL_BOMB, bombX);
                } else {
                    createObject(OBJ_FIREBALL, bombX);
                }
            }
        }
    }
}

function createObject(type, xPosition) {
    let initialVariation = random(0.75, 1.25);
    let currentDropSpeedScale = gameState.dropSpeedScale;
    let baseVy_pps = BASE_DROP_SPEED_PIXELS_PER_SEC * currentDropSpeedScale;

    // Apply 3x speed multiplier for fireballs
    let speedMultiplier = (type === OBJ_FIREBALL) ? 3 : 1;

    let obj = {
        type: type,
        x: xPosition,
        y: -20,
        w: 20,
        h: 20,
        vy: baseVy_pps * initialVariation * speedMultiplier,
        baseVy: baseVy_pps,
        initialVariation: initialVariation,
        speedMultiplier: speedMultiplier,  // Store the multiplier for level updates
        beingPulled: false,
        pullProgress: 0,
        pullTarget: null,
        currentFrame: 0,
        frameTimer: 0
    };

    // Add dragon-specific properties if this is a dragon
    if (type === OBJ_DRAGON) {
        obj.isFlying = false;
        obj.flightDuration = 0;
        obj.maxFlightDuration = 0; // Will be set to a random value when flying
        obj.flightDirectionX = 0;
        obj.flightDirectionY = 0;
        obj.originalVy = obj.vy;
    }

    // Initialize animation properties for fireball
    if (type === OBJ_FIREBALL) {
        obj.currentFrame = 0;
        obj.frameTimer = 0;
    }

    const staticImg = objectImages[type];
    if (type === OBJ_HEALTH_POTION) {
        if (healthPotionFrames.length > 0 && healthPotionFrames[0] && healthPotionFrames[0].width) {
            let scaleFactor = 2.0;
            obj.w = healthPotionFrames[0].width * scaleFactor;
            obj.h = healthPotionFrames[0].height * scaleFactor;
        } else {
            obj.w = 60;
            obj.h = 60;
        }
    } else if (type === OBJ_FIREBALL) {
        if (fireballFrames.length > 0 && fireballFrames[0] && fireballFrames[0].width) {
            let scaleFactor = 2.5;
            obj.w = fireballFrames[0].width * scaleFactor;
            obj.h = fireballFrames[0].height * scaleFactor;
        } else {
            obj.w = 60;
            obj.h = 60;
        }
    } else if (type === OBJ_MAGNET) {
        if (magnetFrames.length > 0 && magnetFrames[0] && magnetFrames[0].width) {
            let scaleFactor = 1.75;
            obj.w = magnetFrames[0].width * scaleFactor;
            obj.h = magnetFrames[0].height * scaleFactor;
        } else {
            obj.w = 45;
            obj.h = 45;
        }
    } else if (staticImg && staticImg.width && staticImg.height) {
        if (type === OBJ_HUMAN) {
            obj.w = staticImg.width * 1.5;
            obj.h = staticImg.height * 1.5;
        } else if (type === OBJ_CROWN) {
            obj.w = 45;
            obj.h = 45;
        } else if (type === OBJ_DIAMOND) {
            obj.w = 45;
            obj.h = 45;
        } else if (type === OBJ_WIZARD_STAFF) {
            obj.w = staticImg.width * 1.5;
            obj.h = staticImg.height * 1.5;
        } else if (type === OBJ_SMALL_BOMB) {
            obj.w = staticImg.width / 2.5;
            obj.h = staticImg.height / 2.5;
        } else if (type === OBJ_DWARF) {
            obj.w = staticImg.width * 3;
            obj.h = staticImg.height * 3;
        } else if (type === OBJ_ELF) {
            obj.w = staticImg.width * 1.5;
            obj.h = staticImg.height * 1.5;
        } else if (type === OBJ_GOBLIN) {
            obj.w = staticImg.width / 6;
            obj.h = staticImg.height / 6;
        } else if (type === OBJ_CAT) {
            obj.w = staticImg.width * 1.5;
            obj.h = staticImg.height * 1.5;
        } else if (type === OBJ_WRAITH) {
            obj.w = staticImg.width * 1.4;
            obj.h = staticImg.height * 1.4;
        } else if (type === OBJ_DRAGON) {
            obj.w = staticImg.width;
            obj.h = staticImg.height;
        } else {
            obj.w = staticImg.width;
            obj.h = staticImg.height;
        }
    } else {
        if (type === OBJ_CROWN) {
            obj.w = 60; // Doubled from 30
            obj.h = 60; // Doubled from 30
        } else if (type === OBJ_DIAMOND) {
            obj.w = 60; // Doubled from 30
            obj.h = 60; // Doubled from 30
        } else {
            obj.w = 40; // Doubled from 20
            obj.h = 40; // Doubled from 20
        }
    }

    obj.x = constrain(obj.x, obj.w / 2, width - obj.w / 2);
    objects.push(obj);
    recentSpawnXPositions.push(obj.x);
    if (recentSpawnXPositions.length > RECENT_SPAWN_X_POSITIONS_MAX) {
        recentSpawnXPositions.shift();
    }
}

function updateObjects() {
    for (let i = objects.length - 1; i >= 0; i--) {
        let obj = objects[i];
        if (obj.beingPulled && obj.pullTarget) {
            obj.pullProgress += 1.0 / TENTACLE_PULL_DURATION_FRAMES;
            obj.pullProgress = min(obj.pullProgress, 1);
            obj.x = lerp(obj.x, obj.pullTarget.x, obj.pullProgress);
            obj.y = lerp(obj.y, obj.pullTarget.y, obj.pullProgress);
            if (obj.pullProgress >= 1) {
                collectObject(obj, i, true);
                continue;
            }
        } else if (obj.type === OBJ_BOSS) {
            if (obj.isDying) {
                // Handle boss die animation
                obj.dieFrameTimer++;
                if (obj.dieFrameTimer >= BOSS_DIE_FRAME_DURATION) {
                    obj.dieCurrentFrame++;
                    obj.dieFrameTimer = 0;

                    // Check if die animation is complete
                    if (obj.dieCurrentFrame >= BOSS_DIE_TOTAL_FRAMES) {
                        // Keep the last frame displayed
                        obj.dieCurrentFrame = BOSS_DIE_TOTAL_FRAMES - 1;
                    }
                }

                // Increment die duration timer
                obj.dieDuration++;

                // Check if die duration is complete
                if (obj.dieDuration >= BOSS_DIE_DURATION_FRAMES) {
                    // Progress to next floor, zone 1
                    gameState.dungeonFloor += 1;
                    gameState.dungeonZone = 1;

                    // Show notification
                    gameLevelNotification.active = true;
                    gameLevelNotification.text = `Floor ${gameState.dungeonFloor} Zone ${gameState.dungeonZone}`;
                    gameLevelNotification.timer = GAME_LEVEL_NOTIFICATION_DURATION;

                    // Play sound
                    playSound('level_complete');

                    // Update game level
                    const currentLevel = getCurrentLevel();
                    let levelMultiplier = 1 + (currentLevel - 1) * GAME_LEVEL_SCALING_INCREASE;
                    gameState.dropSpeedScale = INITIAL_DROP_SPEED_SCALE * levelMultiplier;
                    gameState.objectSpawnRate = BASE_OBJECT_SPAWN_RATE_FRAMES / levelMultiplier;
                    gameState.objectSpawnRate = max(10, Math.round(gameState.objectSpawnRate));

                    // Remove the boss
                    objects.splice(i, 1);
                    continue;
                }

                // Don't move boss during die animation
                // Don't fire fireballs during die animation
            } else if (obj.isHit) {
                // Handle boss hit animation
                obj.hitFrameTimer++;
                if (obj.hitFrameTimer >= BOSS_HIT_FRAME_DURATION) {
                    obj.hitCurrentFrame++;
                    obj.hitFrameTimer = 0;

                    // Check if hit animation is complete
                    if (obj.hitCurrentFrame >= BOSS_HIT_TOTAL_FRAMES) {
                        obj.isHit = false;
                        obj.hitCurrentFrame = 0;
                        obj.hitFrameTimer = 0;
                    }
                }

                // Don't move boss during hit animation
                // Don't fire fireballs during hit animation
            } else if (obj.isIdle) {
                // Handle boss idle animation
                obj.idleFrameTimer++;
                if (obj.idleFrameTimer >= BOSS_IDLE_FRAME_DURATION) {
                    obj.idleCurrentFrame = (obj.idleCurrentFrame + 1) % BOSS_IDLE_TOTAL_FRAMES;
                    obj.idleFrameTimer = 0;
                }

                // Increment idle duration timer
                obj.idleDuration++;

                // Check if idle duration is complete
                if (obj.idleDuration >= BOSS_IDLE_DURATION_FRAMES) {
                    obj.isIdle = false;
                    obj.idleCurrentFrame = 0;
                    obj.idleFrameTimer = 0;
                    obj.idleDuration = 0;
                }

                // Don't move boss during idle animation
                // Don't fire fireballs during idle animation
            } else {
                // Handle boss movement
                obj.frameTimer++;
                if (obj.frameTimer >= BOSS_FRAME_DURATION) {
                    obj.currentFrame = (obj.currentFrame + 1) % BOSS_TOTAL_FRAMES;
                    obj.frameTimer = 0;
                }

                // Move boss horizontally
                obj.x += obj.speed * obj.directionX;

                // Check if boss hits the edge of the screen
                if (obj.x - obj.w / 2 <= 0) {
                    obj.directionX = 1; // Change direction to right
                    obj.x = obj.w / 2; // Prevent going off-screen
                } else if (obj.x + obj.w / 2 >= width) {
                    obj.directionX = -1; // Change direction to left
                    obj.x = width - obj.w / 2; // Prevent going off-screen
                }

                // Handle boss fireball firing
                if (obj.fireballCooldown > 0) {
                    obj.fireballCooldown--;
                } else {
                    // Fire a fireball
                    // Calculate speed multiplier based on floor number
                    // Floor 2: 1x speed (base speed)
                    // Floor 4: 2x speed
                    // Floor 6: 4x speed
                    // Floor 8: 8x speed, etc.
                    let floorSpeedMultiplier = Math.pow(2, Math.floor((gameState.dungeonFloor - 2) / 2));

                    let fireball = {
                        x: obj.x,
                        y: obj.y + obj.h/2,
                        w: 60,
                        h: 60,
                        speed: BOSS_FIREBALL_SPEED * floorSpeedMultiplier,
                        currentFrame: 0,
                        frameTimer: 0
                    };
                    bossFireballs.push(fireball);

                    // Reset cooldown with randomness
                    // Scale cooldown based on floor number (higher floors = lower cooldown = higher frequency)
                    // Add randomness to make firing pattern less predictable
                    // Random value between 0.2 and 1.5 times the base cooldown
                    // Lower bound reduced from 0.5 to 0.2 to allow for more frequent firing
                    let randomFactor = random(0.15, 1.2);
                    obj.fireballCooldown = Math.round((BOSS_FIREBALL_COOLDOWN_FRAMES * randomFactor) / floorSpeedMultiplier);
                }
            }

            // Draw the boss
            push();
            translate(obj.x, obj.y);

            // Flip the image based on direction (only if not in idle state)
            if (obj.directionX < 0 && !obj.isIdle) {
                scale(-1, 1); // Flip horizontally
            }

            // Use visualWidth for drawing if available, otherwise use regular width
            let drawWidth = obj.visualWidth || obj.w;

            if (obj.isDying && bossDieFrames[obj.dieCurrentFrame] && bossDieFrames[obj.dieCurrentFrame].width) {
                // Draw die animation
                image(bossDieFrames[obj.dieCurrentFrame], -drawWidth / 2, -obj.h / 2, drawWidth, obj.h);

                pop();

                // Display "Boss Defeated!" notification
                fill(255, 0, 0);
                textSize(48);
                textAlign(CENTER, CENTER);
                textStyle(BOLD);
                text("Boss Defeated!", width / 2, height / 2);
                textStyle(NORMAL);
            } else if (obj.isHit && bossHitFrames[obj.hitCurrentFrame] && bossHitFrames[obj.hitCurrentFrame].width) {
                // Draw hit animation
                image(bossHitFrames[obj.hitCurrentFrame], -drawWidth / 2, -obj.h / 2, drawWidth, obj.h);

                // Draw boss health bar
                noStroke();
                fill(100, 100, 100); // Gray background
                rect(-drawWidth / 2, -obj.h / 2 - 15, drawWidth, 10);
                fill(255, 0, 0); // Red health bar
                let healthBarWidth = (obj.lives / obj.initialLives) * drawWidth;
                rect(-drawWidth / 2 + drawWidth - healthBarWidth, -obj.h / 2 - 15, healthBarWidth, 10);

                pop();
            } else if (obj.isIdle && bossIdleFrames[obj.idleCurrentFrame] && bossIdleFrames[obj.idleCurrentFrame].width) {
                // Draw idle animation
                image(bossIdleFrames[obj.idleCurrentFrame], -drawWidth / 2, -obj.h / 2, drawWidth, obj.h);

                // Draw boss health bar
                noStroke();
                fill(100, 100, 100); // Gray background
                rect(-drawWidth / 2, -obj.h / 2 - 15, drawWidth, 10);
                fill(255, 0, 0); // Red health bar
                let healthBarWidth = (obj.lives / obj.initialLives) * drawWidth;
                rect(-drawWidth / 2 + drawWidth - healthBarWidth, -obj.h / 2 - 15, healthBarWidth, 10);

                pop();
            } else if (bossFrames[obj.currentFrame] && bossFrames[obj.currentFrame].width) {
                // Draw normal animation
                image(bossFrames[obj.currentFrame], -drawWidth / 2, -obj.h / 2, drawWidth, obj.h);

                // Draw boss health bar
                noStroke();
                fill(100, 100, 100); // Gray background
                rect(-drawWidth / 2, -obj.h / 2 - 15, drawWidth, 10);
                fill(255, 0, 0); // Red health bar
                let healthBarWidth = (obj.lives / obj.initialLives) * drawWidth;
                rect(-drawWidth / 2 + drawWidth - healthBarWidth, -obj.h / 2 - 15, healthBarWidth, 10);

                pop();
            } else {
                // Fallback if image not loaded
                fill(255, 0, 0);
                ellipse(0, 0, drawWidth, obj.h);

                // Draw boss health bar
                noStroke();
                fill(100, 100, 100); // Gray background
                rect(-drawWidth / 2, -obj.h / 2 - 15, drawWidth, 10);
                fill(255, 0, 0); // Red health bar
                let healthBarWidth = (obj.lives / obj.initialLives) * drawWidth;
                rect(-drawWidth / 2 + drawWidth - healthBarWidth, -obj.h / 2 - 15, healthBarWidth, 10);

                pop();
            }

            // Skip the rest of the loop for boss
            continue;
        } else if (obj.type === OBJ_DRAGON) {
            // Handle dragon's special behavior
            if (obj.isFlying) {
                // Dragon is already flying away
                obj.flightDuration++;

                // Move the dragon in its flight direction
                obj.x += obj.flightDirectionX * (deltaTime / 1000.0);
                obj.y += obj.flightDirectionY * (deltaTime / 1000.0);

                // Check if the dragon is about to hit the side of the canvas
                if (obj.x - obj.w / 2 < 0 || obj.x + obj.w / 2 > width) {
                    // Start falling if it hits the side of the canvas
                    obj.isFlying = false;
                    obj.vy = obj.originalVy;
                    obj.y += obj.vy * (deltaTime / 1000.0);
                    // Don't continue, allow collision detection to happen
                }

                // Check if the dragon is about to hit the top of the canvas
                if (obj.y - obj.h / 2 < 0) {
                    obj.flightDirectionY = 0; // Stop vertical movement
                }

                // Check if the flight duration is over
                if (obj.flightDuration >= obj.maxFlightDuration) {
                    // Reset to normal behavior
                    obj.isFlying = false;
                    obj.vy = obj.originalVy;
                    obj.y += obj.vy * (deltaTime / 1000.0);
                }
            } else {
                // Check if top of player is within 100px of bottom of dragon
                let playerTop = player.y;
                let playerLeft = player.x;
                let playerRight = player.x + player.w;
                let dragonBottom = obj.y + obj.h / 2;
                let dragonLeft = obj.x - obj.w / 2;
                let dragonRight = obj.x + obj.w / 2;

                // Check if player is horizontally close to the dragon
                let isHorizontallyClose = (dragonRight > playerLeft && dragonLeft < playerRight);

                // Only check for player proximity if the dragon is not near the top of the screen
                // and the player is horizontally close to the dragon
                // This prevents dragons from flying away when the player isn't close horizontally
                if (obj.y > 100 && playerTop - dragonBottom <= 100 && isHorizontallyClose) {
                    // Player is too close, make the dragon fly diagonally upwards in a random direction
                    obj.isFlying = true;
                    obj.flightDuration = 0;

                    // Set a random flight duration between 60 and 120 frames (1-2 seconds at 60fps)
                    obj.maxFlightDuration = Math.floor(random(60, 120));

                    // Calculate a random angle for diagonal upward movement
                    let angle = random(DRAGON_FLIGHT_DIRECTION_MIN_ANGLE, DRAGON_FLIGHT_DIRECTION_MAX_ANGLE);
                    angle = angle * (Math.PI / 180); // Convert to radians

                    // Calculate flight direction components based on the angle
                    let speed = 2 * abs(obj.baseVy);
                    obj.flightDirectionX = speed * Math.cos(angle);
                    obj.flightDirectionY = speed * Math.sin(angle); // Negative for upward movement
                    obj.originalVy = obj.vy;

                    // Skip collision detection for this frame to give the dragon a chance to fly away
                    continue;
                } else {
                    // Normal movement
                    obj.y += obj.vy * (deltaTime / 1000.0);
                }
            }
        } else {
            obj.y += obj.vy * (deltaTime / 1000.0);
        }

        if (obj.type === OBJ_HEALTH_POTION) {
            obj.frameTimer++;
            if (obj.frameTimer >= HEALTH_POTION_FRAME_DURATION) {
                obj.currentFrame = (obj.currentFrame + 1) % HEALTH_POTION_TOTAL_FRAMES;
                obj.frameTimer = 0;
            }
        } else if (obj.type === OBJ_FIREBALL) {
            obj.frameTimer++;
            if (obj.frameTimer >= FIREBALL_FRAME_DURATION) {
                obj.currentFrame = (obj.currentFrame + 1) % FIREBALL_TOTAL_FRAMES;
                obj.frameTimer = 0;
            }
        } else if (obj.type === OBJ_MAGNET) {
            obj.frameTimer++;
            if (obj.frameTimer >= MAGNET_FRAME_DURATION) {
                obj.currentFrame = (obj.currentFrame + 1) % MAGNET_TOTAL_FRAMES;
                obj.frameTimer = 0;
            }
        } else if (obj.type === OBJ_CAT && obj.onFloor) {
            // Handle cats on the floor
            obj.floorTimer++;
            // After 3 seconds (180 frames at 60fps), play sound, award points, and start fading
            if (obj.floorTimer >= 180) {
                // Only play sound and award points once when timer reaches exactly 180
                if (obj.floorTimer === 180) {
                    playSound('cat_meow');
                    // Award 100 points and XP
                    let points = 100;
                    gameState.score += points;
                    playerState.experience += points;
                    // Increment cats rescued counter
                    gameState.catsRescued++;
                    gameState.catsRescuedPoints += points;
                    // Show popup for points
                    createPopup(`+${points}`, obj.x, obj.y - 30);

                    // Check for level up after gaining XP
                    checkForPlayerLevelUp();
                }

                obj.fadeAmount += 0.02; // Increase fade amount (0 = visible, 1 = invisible)

                // Remove cat when fully faded out
                if (obj.fadeAmount >= 1) {
                    objects.splice(i, 1);
                    continue;
                }
            }
        }

        // Use hitboxWidth and hitboxHeight for boss collision, regular dimensions for other objects
        let objWidth = obj.type === OBJ_BOSS && obj.hitboxWidth ? obj.hitboxWidth : obj.w;
        let objHeight = obj.type === OBJ_BOSS && obj.hitboxHeight ? obj.hitboxHeight : obj.h;

        // For boss, adjust y position to account for reduced bottom hitbox
        let objY = obj.y;
        if (obj.type === OBJ_BOSS && obj.hitboxHeight) {
            // Move the hitbox up to reduce only the bottom part
            objY = obj.y - (obj.h - obj.hitboxHeight) / 2;
        }

        let generalCollision = collideRectRect(
            player.x, player.y, player.w, player.h,
            obj.x - objWidth / 2, objY - objHeight / 2, objWidth, objHeight
        );

        if (generalCollision) {
            if (obj.type === OBJ_SMALL_BOMB ||
                obj.type === OBJ_FIREBALL ||
                obj.type === OBJ_WIZARD_STAFF ||
                obj.type === OBJ_HEALTH_POTION ||
                obj.type === OBJ_CROWN ||
                obj.type === OBJ_DIAMOND ||
                obj.type === OBJ_MAGNET) {
                collectObject(obj, i, true);
                continue;
            } else {
                let eatingZoneActualHeight = player.h * PLAYER_EATING_ZONE_HEIGHT_FACTOR;
                let playerTop = player.y;
                let playerEatingZoneBottom = player.y + eatingZoneActualHeight;
                let playerLeft = player.x;
                let playerRight = player.x + player.w;
                let objectTop = obj.y - obj.h / 2;
                let objectBottom = obj.y + obj.h / 2;
                let objectLeft = obj.x - obj.w / 2;
                let objectRight = obj.x + obj.w / 2;
                let isFallingTowardsPlayer = obj.vy > 0 || obj.beingPulled;
                let isHorizontallyOverlappingPlayer = (objectRight > playerLeft && objectLeft < playerRight);
                let isVerticallyInEatingRange = objectBottom > playerTop && objectTop < playerEatingZoneBottom;

                if (isFallingTowardsPlayer && isHorizontallyOverlappingPlayer && isVerticallyInEatingRange) {
                    collectObject(obj, i, true);
                } else {
                    handleObjectBump(obj, i);
                }
                continue;
            }
        }

        let groundLevel = height - PLAYER_GROUND_Y_OFFSET;
        let objectBottomEdge = obj.y + obj.h / 2;

        if (objectBottomEdge >= groundLevel) {
            let removed = false;
            const humanoidSplatTypes = [OBJ_HUMAN, OBJ_GOBLIN, OBJ_ELF, OBJ_DWARF, OBJ_WRAITH, OBJ_DRAGON]; // Removed OBJ_CAT as it has special handling

            if (obj.type === OBJ_SMALL_BOMB) {
                gameState.collectedCounts.small_bomb++;
                bombExplosions.push({
                    x: obj.x,
                    y: groundLevel - obj.h / 2,
                    currentFrame: 0,
                    frameTimer: 0,
                    objWidth: obj.w,
                    objHeight: obj.h,
                    type: 'bomb_explosion'
                });
                playSound('explode');
                objects.splice(i, 1);
                removed = true;
            } else if (obj.type === OBJ_FIREBALL) {
                gameState.collectedCounts.fireball++;
                bombExplosions.push({
                    x: obj.x,
                    y: groundLevel - obj.h / 2,
                    currentFrame: 0,
                    frameTimer: 0,
                    objWidth: obj.w,
                    objHeight: obj.h,
                    type: 'fireball_burst' // Add type to distinguish from regular bomb explosions
                });
                playSound('explode');
                objects.splice(i, 1);
                removed = true;
            } else if (obj.type === OBJ_HEALTH_POTION || obj.type === OBJ_WIZARD_STAFF || obj.type === OBJ_CROWN || obj.type === OBJ_DIAMOND || obj.type === OBJ_MAGNET) { // Updated type
                playSound('glass_break');
                objects.splice(i, 1);
                removed = true;
            } else if (obj.type === OBJ_CAT) {
                // Special handling for cats - they sit on the floor
                obj.y = groundLevel - obj.h / 2; // Position cat on the floor
                removed = false; // Don't remove the cat
                if (!obj.onFloor) {
                    obj.onFloor = true; // Mark cat as being on the floor
                    obj.floorTimer = 0; // Initialize timer for cat on floor
                    obj.fadeAmount = 0; // Initialize fade amount (0 = fully visible)
                }
            } else if (humanoidSplatTypes.includes(obj.type)) {
                playerState.lives -= 1;
                playSound('lose_life');
                if (playerState.lives <= 0) {
                    playerState.lives = 0;
                    gameState.shouldTriggerGameOver = true;
                }
                groundSplats.push({
                    x: obj.x,
                    y: groundLevel,
                    currentFrame: 0,
                    frameTimer: 0,
                    objWidth: obj.w,
                    objHeight: obj.h
                });
                playSound('splat');
                objects.splice(i, 1);
                removed = true;
            } else {
                console.warn("Unknown object type hit ground:", obj.type);
                objects.splice(i, 1);
                removed = true;
            }
            if (removed) {
                continue;
            }
        }

        if (obj.type === OBJ_HEALTH_POTION) {
            let frameToDraw = healthPotionFrames[obj.currentFrame];
            if (frameToDraw && frameToDraw.width) {
                push();
                translate(obj.x, obj.y);
                image(frameToDraw, -obj.w / 2, -obj.h / 2, obj.w, obj.h);
                pop();
            } else {
                push();
                translate(obj.x, obj.y);
                fill(255, 0, 255);
                ellipse(0, 0, obj.w, obj.h);
                pop();
            }
        } else if (obj.type === OBJ_FIREBALL) {
            let frameToDraw = fireballFrames[obj.currentFrame];
            if (frameToDraw && frameToDraw.width) {
                push();
                translate(obj.x, obj.y);
                // Rotate 90 degrees clockwise (PI/2 radians)
                rotate(PI / 2);
                image(frameToDraw, -obj.w / 2, -obj.h / 2, obj.w, obj.h);
                pop();
            } else {
                push();
                translate(obj.x, obj.y);
                fill(255, 100, 0);
                ellipse(0, 0, obj.w, obj.h);
                pop();
            }
        } else if (obj.type === OBJ_MAGNET) {
            let frameToDraw = magnetFrames[obj.currentFrame];
            if (frameToDraw && frameToDraw.width) {
                push();
                translate(obj.x, obj.y);
                image(frameToDraw, -obj.w / 2, -obj.h / 2, obj.w, obj.h);
                pop();
            } else {
                push();
                translate(obj.x, obj.y);
                fill(100, 100, 255);
                ellipse(0, 0, obj.w, obj.h);
                pop();
            }
        } else {
            const staticImgToDraw = objectImages[obj.type];
            if (staticImgToDraw && staticImgToDraw.width) {
                push();
                translate(obj.x, obj.y);

                // Apply fade effect for cats on the floor
                if (obj.type === OBJ_CAT && obj.onFloor && obj.fadeAmount > 0) {
                    // Set transparency based on fade amount (255 = fully visible, 0 = invisible)
                    tint(255, 255 * (1 - obj.fadeAmount));
                }

                image(staticImgToDraw, -obj.w / 2, -obj.h / 2, obj.w, obj.h);

                // Reset tint if we applied it
                if (obj.type === OBJ_CAT && obj.onFloor && obj.fadeAmount > 0) {
                    noTint();
                }

                pop();
            } else {
                push();
                translate(obj.x, obj.y);

                // Apply fade effect for cats on the floor
                if (obj.type === OBJ_CAT && obj.onFloor && obj.fadeAmount > 0) {
                    fill(200, 200, 200, 255 * (1 - obj.fadeAmount));
                } else {
                    fill(200);
                }

                ellipse(0, 0, obj.w, obj.h);

                // Apply fade effect to text as well
                if (obj.type === OBJ_CAT && obj.onFloor && obj.fadeAmount > 0) {
                    fill(0, 255 * (1 - obj.fadeAmount));
                } else {
                    fill(0);
                }

                textSize(10);
                textAlign(CENTER, CENTER);
                text(obj.type, 0, 0);
                pop();
            }
        }
    }
}
