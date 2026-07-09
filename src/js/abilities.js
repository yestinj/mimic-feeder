let tongues = [];
let shadowBolts = []; // This array is for the projectiles themselves
let openChestTimer = 0; // For tentacles ability visual

function handleTentaclesAbility() {
    if ((key === 'z' || key === 'Z') && playerState.level >= PLAYER_LEVEL_FOR_TENTACLES && playerState.tentaclesCooldown <= 0) {
        tongues = [];
        let foundTarget = false;
        const humanoidTypes = [OBJ_HUMAN, OBJ_GOBLIN, OBJ_ELF, OBJ_DWARF, OBJ_WRAITH, OBJ_CAT, OBJ_DRAGON];
        let eligibleTargets = [];
        for (let obj of objects) {
            if (humanoidTypes.includes(obj.type)) {
                let playerCenterX = player.x + player.w / 2;
                let playerCenterY = player.y + player.h / 2;
                let distSq = (obj.x - playerCenterX) * (obj.x - playerCenterX) + (obj.y - playerCenterY) * (obj.y - playerCenterY);
                eligibleTargets.push({object: obj, distanceSq: distSq});
            }
        }
        eligibleTargets.sort((a, b) => a.distanceSq - b.distanceSq);
        let targetsToPull = eligibleTargets.slice(0, playerState.tentacleTargetLimit);
        for (let targetEntry of targetsToPull) {
            tongues.push({target: targetEntry.object, progress: 0, isPulling: false});
            foundTarget = true;
        }
        if (foundTarget) {
            playSound('slurp');
            playerState.tentaclesCooldown = TENTACLE_COOLDOWN_FRAMES;
            playerState.usingTentacles = true;
            openChestTimer = 60; // Duration for tentacles open sprite
            gameState.achievementStats.tentaclesUsed += 1;
        }
    }
}

function handleShadowBolt() {
    if (keyCode === 32 && playerState.hasWizardStaff && playerState.shadowBoltCooldown <= 0) {
        let bolt = {
            x: player.x + player.w / 2, y: player.y + player.h / 2,
            w: SHADOW_BOLT_SIZE, h: SHADOW_BOLT_SIZE,
            vy: SHADOW_BOLT_SPEED,
            currentFrame: 0, frameTimer: 0
        };
        shadowBolts.push(bolt);
        gameState.achievementStats.shadowBoltsCast += 1;
        playSound('cast_spell');
        shadowBoltAjarTimer = SHADOW_BOLT_AJAR_DURATION;

        // Set cooldown for shadow bolt
        playerState.shadowBoltCooldown = SHADOW_BOLT_COOLDOWN_FRAMES;
    }
}

function updateShadowBolts() {
    const frameDelta = getFrameDelta();

    for (let i = shadowBolts.length - 1; i >= 0; i--) {
        let bolt = shadowBolts[i];
        bolt.y += bolt.vy * frameDelta;
        bolt.frameTimer += frameDelta;
        if (bolt.frameTimer >= SHADOW_BOLT_FRAME_DURATION) {
            bolt.currentFrame = (bolt.currentFrame + 1) % 4;
            bolt.frameTimer -= SHADOW_BOLT_FRAME_DURATION;
        }
        const displaySize = SHADOW_BOLT_SIZE;
        if (shadowBoltFrames[bolt.currentFrame] && shadowBoltFrames[bolt.currentFrame].width) {
            push();
            translate(bolt.x, bolt.y);
            rotate(-PI / 2);
            image(shadowBoltFrames[bolt.currentFrame], -displaySize / 2, -displaySize / 2, displaySize, displaySize);
            pop();
        } else {
            push();
            translate(bolt.x, bolt.y);
            fill(100, 0, 100);
            ellipse(0, 0, displaySize * 0.8, displaySize * 0.8);
            pop();
        }
        bolt.w = displaySize;
        bolt.h = displaySize;

        for (let j = objects.length - 1; j >= 0; j--) {
            let obj = objects[j];
            // Use hitboxWidth and hitboxHeight for boss collision, regular dimensions for other objects
            let objWidth = obj.type === OBJ_BOSS && obj.hitboxWidth ? obj.hitboxWidth : obj.w;
            let objHeight = obj.type === OBJ_BOSS && obj.hitboxHeight ? obj.hitboxHeight : obj.h;

            // For boss, adjust y position to account for reduced bottom hitbox
            let objY = obj.y;
            if (obj.type === OBJ_BOSS && obj.hitboxHeight) {
                // Move the hitbox up to reduce only the bottom part
                objY = obj.y - (obj.h - obj.hitboxHeight) / 2;
            }

            if (collideRectRect(
                bolt.x - bolt.w / 2, bolt.y - bolt.h / 2, bolt.w, bolt.h,
                obj.x - objWidth / 2, objY - objHeight / 2, objWidth, objHeight
            )) {
                // Skip collision for fireballs - shadow bolts pass through them
                if (obj.type === OBJ_FIREBALL) {
                    continue;
                }

                // Special handling for boss
                if (obj.type === OBJ_BOSS) {
                    if (obj.isDying) {
                        continue;
                    }

                    playSound('shadowbolt_hit');
                    shadowBoltExplosions.push({
                        x: bolt.x, y: bolt.y,
                        lifetime: SHADOW_BOLT_EXPLOSION_LIFETIME_FRAMES,
                        objWidth: 65, objHeight: 65
                    });

                    // Reduce boss lives
                    obj.lives -= 1;

                    // Set boss to hit state and reset hit animation
                    obj.isHit = true;
                    obj.hitCurrentFrame = 0;
                    obj.hitFrameTimer = 0;

                    // Check if boss is defeated
                    if (obj.lives <= 0 && !obj.isDying) {
                        // Award points
                        let points = BOSS_POINTS;
                        gameState.score += points;
                        playerState.experience += points;
                        createPopup(`+${points}`, obj.x, obj.y);

                        // Clear any remaining boss fireballs
                        bossFireballs = [];
                        gameState.achievementStats.bossesDefeated += 1;
                        queueBossDefeatedNotification();

                        // Set boss to die state
                        obj.isDying = true;
                        obj.dieCurrentFrame = 0;
                        obj.dieFrameTimer = 0;
                        obj.dieDuration = 0;

                        // Check for level up after gaining XP
                        checkForPlayerLevelUp();
                    }
                } else if (obj.type !== OBJ_SMALL_BOMB) {
                    playSound('shadowbolt_hit');
                    shadowBoltExplosions.push({
                        x: obj.x, y: obj.y,
                        lifetime: SHADOW_BOLT_EXPLOSION_LIFETIME_FRAMES,
                        objWidth: 65, objHeight: 65
                    });
                    gameState.destroyedCount += 1;
                    objects.splice(j, 1);
                } else {
                    // if its a small bomb
                    // Counting is owned by handleBombCollection (avoid double-count).
                    let points = SHADOW_BOLT_BOMB_POINTS;
                    // Award XP along with score
                    playerState.experience += points;
                    gameState.score += points;
                    obj.destroyedByBolt = true;
                    handleBombCollection(obj);
                    createPopup(`+${points}`, obj.x, obj.y);
                    const bombIndex = objects.indexOf(obj);
                    if (bombIndex !== -1) {
                        objects.splice(bombIndex, 1);
                    }
                    gameState.destroyedCount += 1;
                    // Check for level up after gaining XP
                    checkForPlayerLevelUp();
                }
                shadowBolts.splice(i, 1);
                break;
            }
        }
        if (bolt.y < -bolt.h) {
            shadowBolts.splice(i, 1);
        }
    }
}

function handlePlayerDash() {
    // Only process dash if cooldown is not active
    if (playerState.dashCooldown <= 0) {
        const currentTimeMs = millis();
        const leftDashPressed = keyCode === LEFT_ARROW || keyCode === 65; // LEFT or A
        const rightDashPressed = keyCode === RIGHT_ARROW || keyCode === 68; // RIGHT or D

        // Check for left movement key double tap
        if (leftDashPressed) {
            const timeSinceLastPress = currentTimeMs - playerState.lastLeftKeyPressAtMs;

            if (timeSinceLastPress <= DASH_DOUBLE_TAP_WINDOW_MS && timeSinceLastPress > 0) {
                // Double tap detected - perform dash to the left
                player.x -= DASH_DISTANCE;
                player.x = constrain(player.x, 0, width - player.w); // Keep player within bounds
                playerState.dashCooldown = DASH_COOLDOWN_FRAMES;
                playerState.isDashing = true;

                // Add visual feedback
                triggerScreenShake(3);
                playSound('cast_spell'); // Reuse existing sound for now
                gameState.achievementStats.dashesUsed += 1;
            }

            // Update last press time
            playerState.lastLeftKeyPressAtMs = currentTimeMs;
        }

        // Check for right movement key double tap
        else if (rightDashPressed) {
            const timeSinceLastPress = currentTimeMs - playerState.lastRightKeyPressAtMs;

            if (timeSinceLastPress <= DASH_DOUBLE_TAP_WINDOW_MS && timeSinceLastPress > 0) {
                // Double tap detected - perform dash to the right
                player.x += DASH_DISTANCE;
                player.x = constrain(player.x, 0, width - player.w); // Keep player within bounds
                playerState.dashCooldown = DASH_COOLDOWN_FRAMES;
                playerState.isDashing = true;

                // Add visual feedback
                triggerScreenShake(3);
                playSound('cast_spell'); // Reuse existing sound for now
                gameState.achievementStats.dashesUsed += 1;
            }

            // Update last press time
            playerState.lastRightKeyPressAtMs = currentTimeMs;
        }
    }
}

const MAGNETISM_HUMANOID_TYPES = [OBJ_HUMAN, OBJ_GOBLIN, OBJ_ELF, OBJ_DWARF, OBJ_WRAITH, OBJ_CAT, OBJ_DRAGON];
const MAGNETISM_HAZARD_TYPES = [OBJ_FIREBALL];
const MAGNETISM_EXCLUDED_TYPES = [OBJ_WIZARD_STAFF, OBJ_HEALTH_POTION, OBJ_BOSS];

function isObjectMagnetizable(obj) {
    return !MAGNETISM_HUMANOID_TYPES.includes(obj.type) &&
        !MAGNETISM_HAZARD_TYPES.includes(obj.type) &&
        !MAGNETISM_EXCLUDED_TYPES.includes(obj.type);
}

function handleMagnetismAbility() {
    if ((key === 'x' || key === 'X') && playerState.hasMagnet && playerState.magnetismCooldown <= 0) {
        playerState.magnetismCooldown = MAGNETISM_COOLDOWN_FRAMES;
        playerState.usingMagnetism = true;

        // Magnetism contract:
        // Snapshot eligible on-screen objects at activation and do not add newly spawned objects.
        const snapshotObjects = objects.filter(isObjectMagnetizable);
        playerState.magnetizedObjects = snapshotObjects;

        // Mark snapshot objects immediately so they continue being affected until eaten/removed.
        for (let obj of snapshotObjects) {
            obj.magnetized = true;
            if (!obj.initialFallingSpeed) {
                obj.initialFallingSpeed = abs(obj.vy);
            }
        }

        playSound('magnetism');
    }
}

function updateMagnetism() {
    const deltaSeconds = getDeltaSeconds();

    if (playerState.usingMagnetism) {
        // Cooldown gates re-activation only; existing magnetized snapshot keeps pulling.
        playerState.usingMagnetism = false;
    }

    if (playerState.magnetizedObjects && playerState.magnetizedObjects.length > 0) {
        // Keep only live references to avoid stale snapshot entries.
        playerState.magnetizedObjects = playerState.magnetizedObjects.filter(obj => objects.includes(obj));
    }

    for (let obj of objects) {
        // Skip objects that aren't magnetized
        if (!obj.magnetized) {
            continue;
        }

        // Skip objects that are being pulled by tentacles
        if (obj.beingPulled) {
            continue;
        }

        // If we don't have an initial falling speed stored, use the current falling speed
        if (!obj.initialFallingSpeed) {
            obj.initialFallingSpeed = abs(obj.vy);
        }

        // Calculate direction to player
        let playerCenterX = player.x + player.w / 2;
        let playerCenterY = player.y + player.h / 2;
        let dx = playerCenterX - obj.x;
        let dy = playerCenterY - obj.y;
        let dist = sqrt(dx * dx + dy * dy);

        // Normalize direction
        if (dist > 0) {
            dx /= dist;
            dy /= dist;

            // Move horizontally towards player at exactly 5x the object's initial falling speed
            // Use deltaTime to ensure consistent movement regardless of frame rate
            obj.x += dx * MAGNETISM_ATTRACTION_SPEED_MULTIPLIER * obj.initialFallingSpeed * deltaSeconds;

            // Move vertically towards player (both upwards and downwards)
            // Override the normal vertical movement with magnetism-controlled movement
            obj.y += dy * MAGNETISM_ATTRACTION_SPEED_MULTIPLIER * obj.initialFallingSpeed * deltaSeconds;
            // Since we're manually moving the object vertically, we need to prevent the normal
            // downward movement in updateObjects() by setting vy to 0
            obj.vy = 0;
        }
    }
}

function updateTongues() {
    const frameDelta = getFrameDelta();

    for (let i = tongues.length - 1; i >= 0; i--) {
        let tongue = tongues[i];
        let objIndex = objects.indexOf(tongue.target);
        if (objIndex === -1) {
            tongues.splice(i, 1);
            continue;
        }
        let obj = objects[objIndex];
        if (!tongue.isPulling) {
            tongue.progress += frameDelta / TENTACLE_EXTENSION_DURATION_FRAMES;
            tongue.progress = min(tongue.progress, 1);
            if (tongue.progress >= 1) {
                tongue.isPulling = true;
                obj.beingPulled = true;
                obj.pullProgress = 0;
                obj.pullTarget = {x: player.x + player.w / 2, y: player.y + player.h / 2};
            }
        }
        let psX = player.x + player.w / 2;
        let psY = player.y + player.h / 2;
        let ocX = obj.x;
        let ocY = obj.y;
        let dx = ocX - psX;
        let dy = ocY - psY;
        let dist = sqrt(dx * dx + dy * dy);
        let ang = atan2(dy, dx) - PI / 2;
        let chainLength;
        if (tongue.isPulling) {
            chainLength = dist;
        } else {
            chainLength = dist * tongue.progress;
        }
        if (chainImage && chainImage.width && chainLength > 0) {
            push();
            translate(psX, psY);
            rotate(ang);
            let cw = chainImage.width * 0.25;
            image(chainImage, -cw / 2, 0, cw, chainLength);
            pop();
        }
    }
    if (tongues.length === 0) {
        playerState.usingTentacles = false;
    }
}
