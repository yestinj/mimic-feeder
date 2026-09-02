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
        safeLane: null,
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
            title: 'FIVE INNOCENT LIVES.',
            subtitle: 'The dungeon is watching.',
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
        utterance.rate = 0.72;
        utterance.pitch = 0.5;
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
    ninefoldJudgmentState.safeLane = null;
    ninefoldJudgmentState.damageCooldown = 0;
    ninefoldJudgmentState.impactSoundCooldown = 0;
}

function getNinefoldLaneCount() {
    return width < 700 ? 5 : 6;
}

function getPlayerNinefoldLane() {
    const laneCount = getNinefoldLaneCount();
    const playerCenterX = player.x + player.w / 2;
    return Math.max(0, Math.min(laneCount - 1, Math.floor(playerCenterX / (width / laneCount))));
}

/**
 * Keeps each next opening within two lanes so normal movement can reach it
 * during the telegraph, but never leaves the same lane open twice in a row.
 * @param {number} currentLane
 * @returns {number}
 */
function chooseNextNinefoldSafeLane(currentLane) {
    const laneCount = getNinefoldLaneCount();
    const candidates = [];
    for (let lane = Math.max(0, currentLane - 2); lane <= Math.min(laneCount - 1, currentLane + 2); lane++) {
        if (lane !== currentLane) {
            candidates.push(lane);
        }
    }
    const choiceIndex = typeof random === 'function'
        ? Math.floor(random(candidates.length))
        : Math.floor(Math.random() * candidates.length);
    return candidates[choiceIndex];
}

function startNinefoldAttack() {
    ninefoldJudgmentState.phase = 'attack';
    ninefoldJudgmentState.phaseTimer = 0;
    ninefoldJudgmentState.waveTimer = NINEFOLD_FIRST_TELEGRAPH_FRAMES;
    // The first opening appears over the player's current position, teaching
    // the rule before later waves force movement.
    ninefoldJudgmentState.safeLane = getPlayerNinefoldLane();
}

function spawnNinefoldWave() {
    const laneCount = getNinefoldLaneCount();
    const laneWidth = width / laneCount;
    const fireballSize = Math.min(NINEFOLD_FIREBALL_MAX_SIZE, laneWidth * 0.58);
    const waveNumber = ninefoldJudgmentState.wavesReleased;
    const speed = NINEFOLD_FIREBALL_BASE_SPEED + waveNumber * NINEFOLD_FIREBALL_SPEED_STEP;

    for (let lane = 0; lane < laneCount; lane++) {
        if (lane === ninefoldJudgmentState.safeLane) {
            continue;
        }
        judgmentFireballs.push({
            x: laneWidth * (lane + 0.5),
            y: -fireballSize / 2,
            w: fireballSize,
            h: fireballSize,
            speed,
            currentFrame: waveNumber % Math.max(1, FIREBALL_TOTAL_FRAMES),
            frameTimer: 0
        });
    }

    ninefoldJudgmentState.wavesReleased += 1;
    triggerScreenShake(4);
    // Keep this wave's corridor marked until every fireball has passed.
    // The next route is selected only after the field is clear, preventing
    // a future safe lane from being shown as safe for the current attack.
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

function drawNinefoldTelegraph() {
    if (ninefoldJudgmentState.phase !== 'attack' || ninefoldJudgmentState.safeLane === null) {
        return;
    }

    const laneCount = getNinefoldLaneCount();
    const laneWidth = width / laneCount;
    const groundLevel = height - PLAYER_GROUND_Y_OFFSET;
    const pulse = 0.5 + 0.5 * Math.sin(frameCount * 0.16);

    push();
    noStroke();
    for (let lane = 0; lane < laneCount; lane++) {
        const laneX = lane * laneWidth;
        if (lane === ninefoldJudgmentState.safeLane) {
            fill(126, 210, 210, 18 + pulse * 18);
            rect(laneX + 3, 0, laneWidth - 6, groundLevel);
            stroke(175, 245, 232, 120 + pulse * 80);
            strokeWeight(2);
            line(laneX + 3, 0, laneX + 3, groundLevel);
            line(laneX + laneWidth - 3, 0, laneX + laneWidth - 3, groundLevel);
            noStroke();
        } else {
            fill(190, 24, 36, 24 + pulse * 34);
            rect(laneX + 3, 0, laneWidth - 6, groundLevel);
            fill(255, 94, 35, 125 + pulse * 80);
            ellipse(laneX + laneWidth / 2, 26, 12 + pulse * 8, 12 + pulse * 8);
        }
    }
    pop();
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
    ninefoldJudgmentState.safeLane = null;
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
                ninefoldJudgmentState.safeLane = chooseNextNinefoldSafeLane(
                    ninefoldJudgmentState.safeLane
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
    drawNinefoldTelegraph();
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
        drawShadowedText('TEN LIVES TAKEN.', width / 2, panelY + 24, Math.max(24, 38 * scaleFactor),
            [255, 166, 178], CENTER, TOP, BOLD);
        drawShadowedText('YOU HAVE ANGERED THE DUNGEON.', width / 2, panelY + 77 * scaleFactor,
            Math.max(17, 24 * scaleFactor), [240, 226, 236], CENTER, TOP, NORMAL);
        drawShadowedText('NOW—RUN.', width / 2, panelY + 121 * scaleFactor,
            Math.max(20, 30 * scaleFactor), [255, 215, 126], CENTER, TOP, BOLD);
    } else if (ninefoldJudgmentState.phase === 'attack') {
        const currentWave = judgmentFireballs.length > 0
            ? ninefoldJudgmentState.wavesReleased
            : Math.min(NINEFOLD_WAVE_COUNT, ninefoldJudgmentState.wavesReleased + 1);
        const panelHeight = Math.max(68, 84 * scaleFactor);
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
        drawShadowedText(`NINEFOLD JUDGMENT · ${currentWave} / ${NINEFOLD_WAVE_COUNT}`, width / 2,
            panelY + 12, Math.max(20, 30 * scaleFactor), [255, 175, 190], CENTER, TOP, BOLD);
        drawShadowedText('Follow the open path.', width / 2, panelY + 48 * scaleFactor,
            Math.max(14, 18 * scaleFactor), [229, 226, 214], CENTER, TOP, NORMAL);
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
        drawShadowedText('THE DUNGEON RELENTS.', width / 2, panelY + 17,
            Math.max(21, 32 * scaleFactor), [225, 207, 231], CENTER, TOP, BOLD);
        drawShadowedText('For now.', width / 2, panelY + 58 * scaleFactor,
            Math.max(14, 19 * scaleFactor), [201, 185, 207], CENTER, TOP, NORMAL);
    }
}
