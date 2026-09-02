/**
 * @fileoverview The Ninefold Judgment encounter.
 * Deliberately destroying cats with Shadow Bolt warns the player at five kills,
 * then summons a one-time, nine-wave survival event at ten kills.
 */

const CAT_KILL_WARNING_LINE = 'Five innocent lives. The dungeon is watching.';
const CAT_KILL_JUDGMENT_LINE = 'Ten lives taken. You have angered the dungeon. Now—run.';

let judgmentFireballs = [];
let ninefoldJudgmentState = createNinefoldJudgmentState();

function createNinefoldJudgmentState() {
    return {
        phase: 'idle',
        phaseTimer: 0,
        waveTimer: 0,
        wavesReleased: 0,
        corridorCenter: null,
        damageCooldown: 0,
        impactSoundCooldown: 0,
        suspendedObjects: []
    };
}

/**
 * Returns true for the pending, summoning, attack, and ending phases.
 * @returns {boolean}
 */
function isNinefoldJudgmentActive() {
    return ninefoldJudgmentState.phase !== 'idle';
}

/**
 * Clears encounter-only state. Normal run initialization separately clears objects.
 * @function
 */
function resetNinefoldJudgment() {
    stopDungeonVoice();
    judgmentFireballs = [];
    ninefoldJudgmentState = createNinefoldJudgmentState();
}

/**
 * Counts only cats actually destroyed by a Shadow Bolt.
 * Collection, tentacles, ground exits, and other object removal paths do not call this.
 * @function
 */
function recordShadowBoltCatKill() {
    gameState.shadowBoltCatsDestroyed += 1;

    if (!gameState.catKillWarningIssued &&
        gameState.shadowBoltCatsDestroyed >= CAT_KILL_WARNING_THRESHOLD) {
        gameState.catKillWarningIssued = true;
        enqueueCenterNotification({
            style: 'panel',
            title: 'FIVE INNOCENT LIVES',
            subtitle: 'The dungeon is watching',
            duration: 240,
            titleColor: [255, 164, 164],
            subtitleColor: [235, 220, 230],
            backgroundColor: [28, 5, 17, 205],
            titleSize: 34,
            subtitleSize: 22
        });
        speakDungeonLine(CAT_KILL_WARNING_LINE);
    }

    if (!gameState.ninefoldJudgmentTriggered &&
        gameState.shadowBoltCatsDestroyed >= CAT_KILL_JUDGMENT_THRESHOLD) {
        gameState.ninefoldJudgmentTriggered = true;
        // Defer world suspension until the next draw frame so the current
        // Shadow Bolt collision loop can finish safely.
        ninefoldJudgmentState.phase = 'pending';
    }
}

/**
 * Uses a local browser voice when available. The warning text is always rendered,
 * so speech support is enhancement rather than a gameplay dependency.
 * @param {string} line
 */
function speakDungeonLine(line) {
    if (gameState.isMuted || typeof window === 'undefined' ||
        !window.speechSynthesis || typeof SpeechSynthesisUtterance !== 'function') {
        return;
    }

    try {
        const utterance = new SpeechSynthesisUtterance(line);
        utterance.rate = 0.55;
        utterance.pitch = 0.1;
        utterance.volume = 1;

        const voices = window.speechSynthesis.getVoices();
        const preferredNames = [
            /daniel/i,
            /alex/i,
            /google uk english male/i,
            /microsoft (david|mark|george)/i,
            /english.*male/i
        ];
        for (const pattern of preferredNames) {
            const preferredVoice = voices.find((voice) =>
                pattern.test(voice.name) && /^en([_-]|$)/i.test(voice.lang)
            );
            if (preferredVoice) {
                utterance.voice = preferredVoice;
                break;
            }
        }

        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    } catch (error) {
        console.warn('Dungeon voice unavailable:', error);
    }
}

function stopDungeonVoice() {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
        return;
    }
    try {
        window.speechSynthesis.cancel();
    } catch (error) {
        // Speech is optional; text remains visible if cancellation is unsupported.
    }
}

function beginNinefoldJudgment() {
    if (ninefoldJudgmentState.phase !== 'pending') {
        return;
    }

    // Suspend rather than destroy existing drops so a rare item cannot be lost
    // merely because the encounter began while it was on screen.
    ninefoldJudgmentState.suspendedObjects = objects;
    for (const obj of ninefoldJudgmentState.suspendedObjects) {
        obj.beingPulled = false;
        obj.magnetized = false;
    }
    objects = [];

    bossFireballs.length = 0;
    shadowBolts.length = 0;
    tongues.length = 0;
    bombExplosions.length = 0;
    shadowBoltExplosions.length = 0;
    groundSplats.length = 0;
    popups.length = 0;
    judgmentFireballs.length = 0;
    playerState.magnetizedObjects = [];
    playerState.usingMagnetism = false;
    playerState.usingTentacles = false;

    clearCenterNotifications();
    stopMusicTracks();
    triggerScreenShake(10);
    speakDungeonLine(CAT_KILL_JUDGMENT_LINE);

    ninefoldJudgmentState.phase = 'summoning';
    ninefoldJudgmentState.phaseTimer = 0;
    ninefoldJudgmentState.wavesReleased = 0;
    ninefoldJudgmentState.corridorCenter = null;
    ninefoldJudgmentState.damageCooldown = 0;
    ninefoldJudgmentState.impactSoundCooldown = 0;
}

function getNinefoldCorridorWidth() {
    return Math.min(width - 12, player.w + 14);
}

function clampNinefoldCorridorCenter(centerX) {
    const halfCorridor = getNinefoldCorridorWidth() / 2;
    return Math.max(halfCorridor + 6, Math.min(width - halfCorridor - 6, centerX));
}

function randomNinefoldValue(minimum, maximum) {
    if (typeof random === 'function') {
        return random(minimum, maximum);
    }
    return minimum + Math.random() * (maximum - minimum);
}

/**
 * Moves the unseen opening far enough to demand a reaction, but keeps it within
 * the distance the mimic can cover while the meteor wall crosses the screen.
 * @param {?number} currentCenter
 * @returns {number}
 */
function chooseNextNinefoldCorridorCenter(currentCenter) {
    const direction = randomNinefoldValue(0, 1) < 0.5 ? -1 : 1;
    const corridorWidth = getNinefoldCorridorWidth();

    if (!Number.isFinite(currentCenter)) {
        const playerCenter = player.x + player.w / 2;
        const minimumShift = corridorWidth * 0.65;
        const maximumShift = Math.max(minimumShift, width * 0.18);
        return clampNinefoldCorridorCenter(
            playerCenter + direction * randomNinefoldValue(minimumShift, maximumShift)
        );
    }

    const minimumShift = Math.max(corridorWidth * 0.85, width * 0.11);
    const maximumShift = Math.max(minimumShift, Math.min(width * 0.21, player.speed * 35));
    let candidate = clampNinefoldCorridorCenter(
        currentCenter + direction * randomNinefoldValue(minimumShift, maximumShift)
    );

    // If clamping against an edge swallowed most of the intended movement,
    // send the opening in the other direction instead.
    if (Math.abs(candidate - currentCenter) < minimumShift * 0.55) {
        candidate = clampNinefoldCorridorCenter(
            currentCenter - direction * randomNinefoldValue(minimumShift, maximumShift)
        );
    }
    return candidate;
}

function startNinefoldAttack() {
    ninefoldJudgmentState.phase = 'attack';
    ninefoldJudgmentState.phaseTimer = 0;
    ninefoldJudgmentState.waveTimer = NINEFOLD_FIRST_WAVE_DELAY_FRAMES;
    ninefoldJudgmentState.corridorCenter = chooseNextNinefoldCorridorCenter(null);
}

function spawnNinefoldWave() {
    const fireballSize = Math.min(NINEFOLD_FIREBALL_MAX_SIZE, Math.max(50, width / 16));
    const fireballSpacing = fireballSize * 0.82;
    const corridorWidth = getNinefoldCorridorWidth();
    const corridorCenter = ninefoldJudgmentState.corridorCenter;
    const waveNumber = ninefoldJudgmentState.wavesReleased;
    const speed = NINEFOLD_FIREBALL_BASE_SPEED + waveNumber * NINEFOLD_FIREBALL_SPEED_STEP;
    const primaryVerticalSpread = Math.min(height * 0.2, 150);
    const trailingVerticalMinimum = Math.min(height * 0.12, 90);
    const trailingVerticalMaximum = Math.min(height * 0.34, 240);
    let meteorColumnIndex = 0;
    const spawnFireball = (x, trailing = false) => {
        const verticalBand = (meteorColumnIndex % 5) / 4;
        const trailingRange = trailingVerticalMaximum - trailingVerticalMinimum;
        const verticalOffset = trailing
            ? trailingVerticalMinimum + verticalBand * trailingRange * 0.75 +
                randomNinefoldValue(0, trailingRange * 0.25)
            : verticalBand * primaryVerticalSpread * 0.7 +
                randomNinefoldValue(0, primaryVerticalSpread * 0.3);
        judgmentFireballs.push({
            x,
            y: fireballSize / 2 - verticalOffset,
            w: fireballSize,
            h: fireballSize,
            speed,
            currentFrame: waveNumber % Math.max(1, FIREBALL_TOTAL_FRAMES),
            frameTimer: 0,
            spawnDelay: trailing
                ? randomNinefoldValue(4, 16)
                : randomNinefoldValue(0, 8)
        });
    };
    const spawnMeteorColumn = (x, sideDirection) => {
        spawnFireball(x);
        if ((meteorColumnIndex + waveNumber) % 2 === 0) {
            // Every other column receives a later meteor, nudged away from the
            // opening so the narrow survivable route is never accidentally reduced.
            const trailingX = x + sideDirection * randomNinefoldValue(
                fireballSpacing * 0.08,
                fireballSpacing * 0.2
            );
            spawnFireball(trailingX, true);
        }
        meteorColumnIndex += 1;
    };

    // Place the inner two meteors exactly against the corridor boundaries,
    // then overlap the rest slightly to form a dense wall with no side gaps.
    const leftStart = corridorCenter - corridorWidth / 2 - fireballSize / 2;
    const rightStart = corridorCenter + corridorWidth / 2 + fireballSize / 2;
    for (let x = leftStart; x + fireballSize / 2 >= 0; x -= fireballSpacing) {
        spawnMeteorColumn(x, -1);
    }
    for (let x = rightStart; x - fireballSize / 2 <= width; x += fireballSpacing) {
        spawnMeteorColumn(x, 1);
    }

    ninefoldJudgmentState.wavesReleased += 1;
    triggerScreenShake(4);
    // Keep the next opening undecided until this wall has completely passed,
    // so separate waves never combine into an impossible overlapping pattern.
    ninefoldJudgmentState.waveTimer = 0;
}

function createNinefoldImpact(fireball, impactY) {
    bombExplosions.push({
        x: fireball.x,
        y: impactY,
        currentFrame: 0,
        frameTimer: 0,
        objWidth: fireball.w,
        objHeight: fireball.h,
        type: 'fireball_burst'
    });

    if (ninefoldJudgmentState.impactSoundCooldown <= 0) {
        playSound('explode');
        ninefoldJudgmentState.impactSoundCooldown = 8;
    }
    triggerScreenShake(3);
}

function damagePlayerDuringNinefoldJudgment() {
    if (ninefoldJudgmentState.damageCooldown > 0) {
        return false;
    }

    playerState.lives = Math.max(0, playerState.lives - 1);
    ninefoldJudgmentState.damageCooldown = NINEFOLD_DAMAGE_COOLDOWN_FRAMES;
    playSound('lose_life');
    triggerScreenShake(9);

    if (playerState.lives <= 0) {
        gameState.shouldTriggerGameOver = true;
    }
    return true;
}

function updateNinefoldFireballs(frameDelta) {
    const groundLevel = height - PLAYER_GROUND_Y_OFFSET;

    for (let i = judgmentFireballs.length - 1; i >= 0; i--) {
        const fireball = judgmentFireballs[i];
        if (fireball.spawnDelay > 0) {
            fireball.spawnDelay = Math.max(0, fireball.spawnDelay - frameDelta);
            continue;
        }
        fireball.y += fireball.speed * frameDelta;
        fireball.frameTimer += frameDelta;
        if (fireball.frameTimer >= FIREBALL_FRAME_DURATION) {
            fireball.currentFrame = (fireball.currentFrame + 1) % FIREBALL_TOTAL_FRAMES;
            fireball.frameTimer -= FIREBALL_FRAME_DURATION;
        }

        if (collideRectRect(
            fireball.x - fireball.w / 2,
            fireball.y - fireball.h / 2,
            fireball.w,
            fireball.h,
            player.x,
            player.y,
            player.w,
            player.h
        )) {
            damagePlayerDuringNinefoldJudgment();
            createNinefoldImpact(fireball, fireball.y);
            judgmentFireballs.splice(i, 1);
            continue;
        }

        if (fireball.y + fireball.h / 2 >= groundLevel) {
            createNinefoldImpact(fireball, groundLevel - fireball.h / 2);
            judgmentFireballs.splice(i, 1);
        }
    }
}

function drawNinefoldFireballs() {
    for (const fireball of judgmentFireballs) {
        if (fireball.spawnDelay > 0) {
            continue;
        }
        const frameImage = fireballFrames[fireball.currentFrame];
        if (frameImage && frameImage.width) {
            push();
            translate(fireball.x, fireball.y);
            rotate(PI / 2);
            image(frameImage, -fireball.w / 2, -fireball.h / 2, fireball.w, fireball.h);
            pop();
        } else {
            noStroke();
            fill(255, 80, 20, 230);
            ellipse(fireball.x, fireball.y, fireball.w, fireball.h);
        }
    }
}

function drawNinefoldApparition() {
    const state = ninefoldJudgmentState;
    let apparitionAlpha = 105;
    if (state.phase === 'summoning') {
        const summonProgress = Math.min(1, state.phaseTimer / NINEFOLD_SUMMON_DURATION_FRAMES);
        apparitionAlpha = 235 * Math.min(1, summonProgress * 1.8);
    } else if (state.phase === 'ending') {
        apparitionAlpha = 150 * (1 - Math.min(1, state.phaseTimer / NINEFOLD_END_DURATION_FRAMES));
    }

    push();
    noStroke();
    const overlayAlpha = state.phase === 'summoning' ? 105 : 52;
    fill(18, 0, 22, overlayAlpha);
    rect(0, 0, width, height);

    if (ninefoldJudgmentImage && ninefoldJudgmentImage.width) {
        const maxWidth = width * 0.84;
        const maxHeight = height * 0.74;
        const drawScale = Math.min(
            maxWidth / ninefoldJudgmentImage.width,
            maxHeight / ninefoldJudgmentImage.height
        );
        const drawWidth = ninefoldJudgmentImage.width * drawScale;
        const drawHeight = ninefoldJudgmentImage.height * drawScale;
        const bob = prefersReducedMotion() ? 0 : Math.sin(frameCount * 0.035) * 5;
        tint(255, apparitionAlpha);
        image(ninefoldJudgmentImage, (width - drawWidth) / 2, height * 0.045 + bob, drawWidth, drawHeight);
        noTint();
    } else {
        fill(218, 150, 255, apparitionAlpha);
        ellipse(width * 0.44, height * 0.25, 22, 10);
        ellipse(width * 0.56, height * 0.25, 22, 10);
    }
    pop();
}

function beginNinefoldEnding() {
    ninefoldJudgmentState.phase = 'ending';
    ninefoldJudgmentState.phaseTimer = 0;
    ninefoldJudgmentState.corridorCenter = null;
}

/**
 * Restores the exact ordinary objects that were frozen when the event began.
 * @function
 */
function completeNinefoldJudgment() {
    const suspendedObjects = ninefoldJudgmentState.suspendedObjects;
    judgmentFireballs.length = 0;
    ninefoldJudgmentState = createNinefoldJudgmentState();
    objects = suspendedObjects;

    if (!gameState.gameOver && !shouldSilenceGameAudio()) {
        updateBackgroundMusic();
    }
}

/**
 * Updates the encounter and renders elements that belong behind the player/UI.
 * @function
 */
function updateAndDrawNinefoldJudgment() {
    if (ninefoldJudgmentState.phase === 'pending') {
        beginNinefoldJudgment();
    }

    const frameDelta = getFrameDelta();
    ninefoldJudgmentState.damageCooldown = Math.max(
        0,
        ninefoldJudgmentState.damageCooldown - frameDelta
    );
    ninefoldJudgmentState.impactSoundCooldown = Math.max(
        0,
        ninefoldJudgmentState.impactSoundCooldown - frameDelta
    );

    if (ninefoldJudgmentState.phase === 'summoning') {
        ninefoldJudgmentState.phaseTimer += frameDelta;
        if (ninefoldJudgmentState.phaseTimer >= NINEFOLD_SUMMON_DURATION_FRAMES) {
            startNinefoldAttack();
        }
    } else if (ninefoldJudgmentState.phase === 'attack') {
        if (judgmentFireballs.length === 0 &&
            ninefoldJudgmentState.wavesReleased < NINEFOLD_WAVE_COUNT &&
            ninefoldJudgmentState.waveTimer > 0) {
            ninefoldJudgmentState.waveTimer -= frameDelta;
            if (ninefoldJudgmentState.waveTimer <= 0) {
                spawnNinefoldWave();
            }
        }

        updateNinefoldFireballs(frameDelta);
        if (judgmentFireballs.length === 0 && ninefoldJudgmentState.waveTimer <= 0) {
            if (ninefoldJudgmentState.wavesReleased >= NINEFOLD_WAVE_COUNT) {
                beginNinefoldEnding();
            } else {
                ninefoldJudgmentState.corridorCenter = chooseNextNinefoldCorridorCenter(
                    ninefoldJudgmentState.corridorCenter
                );
                ninefoldJudgmentState.waveTimer = NINEFOLD_WAVE_INTERVAL_FRAMES;
            }
        }
    } else if (ninefoldJudgmentState.phase === 'ending') {
        ninefoldJudgmentState.phaseTimer += frameDelta;
        if (ninefoldJudgmentState.phaseTimer >= NINEFOLD_END_DURATION_FRAMES) {
            completeNinefoldJudgment();
            return;
        }
    }

    drawNinefoldApparition();
    drawNinefoldFireballs();
}

/**
 * Draws encounter text above the player and effects.
 * @function
 */
function drawNinefoldJudgmentForeground() {
    if (!isNinefoldJudgmentActive()) {
        return;
    }

    const scaleFactor = Math.min(width / 1024, height / 768);
    const panelWidth = Math.min(width * 0.82, 700);
    const panelX = (width - panelWidth) / 2;

    if (ninefoldJudgmentState.phase === 'summoning') {
        const panelHeight = Math.max(145, 180 * scaleFactor);
        const panelY = height * 0.63;
        drawHudPanel(
            panelX,
            panelY,
            panelWidth,
            panelHeight,
            14,
            [28, 5, 17, 218],
            [222, 82, 122, 235]
        );
        drawShadowedText('TEN LIVES TAKEN', width / 2, panelY + 24, Math.max(24, 38 * scaleFactor),
            [255, 166, 178], CENTER, TOP, BOLD);
        drawShadowedText('YOU HAVE ANGERED THE DUNGEON', width / 2, panelY + 77 * scaleFactor,
            Math.max(17, 24 * scaleFactor), [240, 226, 236], CENTER, TOP, NORMAL);
        drawShadowedText('NOW—RUN', width / 2, panelY + 121 * scaleFactor,
            Math.max(20, 30 * scaleFactor), [255, 215, 126], CENTER, TOP, BOLD);
    } else if (ninefoldJudgmentState.phase === 'attack') {
        const currentWave = judgmentFireballs.length > 0
            ? ninefoldJudgmentState.wavesReleased
            : Math.min(NINEFOLD_WAVE_COUNT, ninefoldJudgmentState.wavesReleased + 1);
        const panelHeight = Math.max(54, 66 * scaleFactor);
        const panelY = Math.max(18, 26 * scaleFactor);
        drawHudPanel(
            panelX,
            panelY,
            panelWidth,
            panelHeight,
            12,
            [24, 5, 17, 190],
            [218, 100, 139, 220]
        );
        drawShadowedText(`NINEFOLD JUDGMENT — ${currentWave} / ${NINEFOLD_WAVE_COUNT}`, width / 2,
            panelY + 14, Math.max(20, 30 * scaleFactor), [255, 175, 190], CENTER, TOP, BOLD);
    } else if (ninefoldJudgmentState.phase === 'ending') {
        const panelHeight = Math.max(76, 98 * scaleFactor);
        const panelY = height * 0.68;
        drawHudPanel(
            panelX,
            panelY,
            panelWidth,
            panelHeight,
            12,
            [18, 8, 20, 190],
            [168, 126, 181, 210]
        );
        drawShadowedText('THE DUNGEON RELENTS', width / 2, panelY + 17,
            Math.max(21, 32 * scaleFactor), [225, 207, 231], CENTER, TOP, BOLD);
        drawShadowedText('For now', width / 2, panelY + 58 * scaleFactor,
            Math.max(14, 19 * scaleFactor), [201, 185, 207], CENTER, TOP, NORMAL);
    }
}
