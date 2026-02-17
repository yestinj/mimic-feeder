/**
 * @fileoverview Achievement system for Mimic Feeder.
 * Contains achievement definitions, tracking, and notification functionality.
 * @author Yestin Johnson
 */

/**
 * Achievement definitions - Each achievement has an id, name, description, and check function
 * @type {Array<Object>}
 */
const ACHIEVEMENT_TIER_EARLY = 'early';
const ACHIEVEMENT_TIER_MID = 'mid';
const ACHIEVEMENT_TIER_LATE = 'late';

const ACHIEVEMENT_TIER_POINTS = {
    [ACHIEVEMENT_TIER_EARLY]: 25,
    [ACHIEVEMENT_TIER_MID]: 50,
    [ACHIEVEMENT_TIER_LATE]: 100
};

function getHazardDetonations(collectedCounts) {
    if (!collectedCounts || typeof collectedCounts !== 'object') {
        return 0;
    }
    const smallBombCount = Number.isFinite(collectedCounts.small_bomb) ? collectedCounts.small_bomb : 0;
    const fireballCount = Number.isFinite(collectedCounts.fireball) ? collectedCounts.fireball : 0;
    return smallBombCount + fireballCount;
}

function getAchievementPoints(achievement) {
    if (Number.isFinite(achievement.points)) {
        return achievement.points;
    }
    return ACHIEVEMENT_TIER_POINTS[achievement.tier] || ACHIEVEMENT_TIER_POINTS[ACHIEVEMENT_TIER_MID];
}

const ACHIEVEMENTS = [
    {
        id: 'first_blood',
        name: 'First Blood',
        description: 'Collect your first human',
        tier: ACHIEVEMENT_TIER_EARLY,
        check: (state) => state.collectedCounts.human >= 1
    },
    {
        id: 'staff_initiate',
        name: 'Staff Initiate',
        description: 'Obtain the wizard staff',
        tier: ACHIEVEMENT_TIER_EARLY,
        check: (state) => state.player.hasWizardStaff
    },
    {
        id: 'magnet_novice',
        name: 'Magnet Novice',
        description: 'Obtain the magnet',
        tier: ACHIEVEMENT_TIER_EARLY,
        check: (state) => state.player.hasMagnet
    },
    {
        id: 'cat_lover',
        name: 'Cat Lover',
        description: 'Rescue 3 cats',
        tier: ACHIEVEMENT_TIER_EARLY,
        check: (state) => state.game.catsRescued >= 3
    },
    {
        id: 'volatile_rookie',
        name: 'Volatile Rookie',
        description: 'Detonate 10 hazards',
        tier: ACHIEVEMENT_TIER_EARLY,
        check: (state) => getHazardDetonations(state.collectedCounts) >= 10
    },
    {
        id: 'treasure_hunter',
        name: 'Treasure Hunter',
        description: 'Collect 3 crowns',
        tier: ACHIEVEMENT_TIER_EARLY,
        check: (state) => state.collectedCounts.crown >= 3
    },
    {
        id: 'dungeon_explorer',
        name: 'Dungeon Explorer',
        description: 'Reach dungeon floor 3',
        tier: ACHIEVEMENT_TIER_EARLY,
        check: (state) => state.game.dungeonFloor >= 3
    },
    {
        id: 'survivor',
        name: 'Survivor',
        description: 'Play for 3 minutes',
        tier: ACHIEVEMENT_TIER_EARLY,
        check: (state) => state.game.playTime >= 180
    },
    {
        id: 'bomb_squad',
        name: 'Bomb Squad',
        description: 'Detonate 25 hazards',
        tier: ACHIEVEMENT_TIER_MID,
        check: (state) => getHazardDetonations(state.collectedCounts) >= 25
    },
    {
        id: 'diamond_collector',
        name: 'Diamond Collector',
        description: 'Collect 5 diamonds',
        tier: ACHIEVEMENT_TIER_MID,
        check: (state) => state.collectedCounts.diamond >= 5
    },
    {
        id: 'dragon_slayer',
        name: 'Dragon Slayer',
        description: 'Collect 10 dragons',
        tier: ACHIEVEMENT_TIER_MID,
        check: (state) => state.collectedCounts.dragon >= 10
    },
    {
        id: 'high_score',
        name: 'Score Chaser',
        description: 'Score 5000 points',
        tier: ACHIEVEMENT_TIER_MID,
        check: (state) => state.game.score >= 5000
    },
    {
        id: 'level_up',
        name: 'Veteran',
        description: 'Reach player level 8',
        tier: ACHIEVEMENT_TIER_MID,
        check: (state) => state.player.level >= 8
    },
    {
        id: 'dungeon_delver',
        name: 'Dungeon Delver',
        description: 'Reach dungeon floor 5',
        tier: ACHIEVEMENT_TIER_MID,
        check: (state) => state.game.dungeonFloor >= 5
    },
    {
        id: 'demolisher',
        name: 'Demolisher',
        description: 'Destroy 75 objects',
        tier: ACHIEVEMENT_TIER_MID,
        check: (state) => state.game.destroyedCount >= 75
    },
    {
        id: 'cat_sanctuary',
        name: 'Cat Sanctuary',
        description: 'Rescue 10 cats',
        tier: ACHIEVEMENT_TIER_MID,
        check: (state) => state.game.catsRescued >= 10
    },
    {
        id: 'boss_hunter',
        name: 'Boss Hunter',
        description: 'Defeat 1 boss',
        tier: ACHIEVEMENT_TIER_MID,
        check: (state) => state.achievementStats.bossesDefeated >= 1
    },
    {
        id: 'spell_slinger',
        name: 'Spell Slinger',
        description: 'Cast 250 shadow bolts',
        tier: ACHIEVEMENT_TIER_MID,
        check: (state) => state.achievementStats.shadowBoltsCast >= 250
    },
    {
        id: 'tentacle_tactician',
        name: 'Tentacle Tactician',
        description: 'Use tentacles 50 times',
        tier: ACHIEVEMENT_TIER_MID,
        check: (state) => state.achievementStats.tentaclesUsed >= 50
    },
    {
        id: 'blink_striker',
        name: 'Blink Striker',
        description: 'Dash 125 times',
        tier: ACHIEVEMENT_TIER_MID,
        check: (state) => state.achievementStats.dashesUsed >= 125
    },
    {
        id: 'abyss_walker',
        name: 'Abyss Walker',
        description: 'Reach dungeon floor 8',
        tier: ACHIEVEMENT_TIER_LATE,
        check: (state) => state.game.dungeonFloor >= 8
    },
    {
        id: 'apex_mimic',
        name: 'Apex Mimic',
        description: 'Reach player level 12',
        tier: ACHIEVEMENT_TIER_LATE,
        check: (state) => state.player.level >= 12
    },
    {
        id: 'dragon_feast',
        name: 'Dragon Feast',
        description: 'Collect 25 dragons',
        tier: ACHIEVEMENT_TIER_LATE,
        check: (state) => state.collectedCounts.dragon >= 25
    },
    {
        id: 'legend_score',
        name: 'Legend Score',
        description: 'Score 20000 points',
        tier: ACHIEVEMENT_TIER_LATE,
        check: (state) => state.game.score >= 20000
    },
    {
        id: 'iron_stomach',
        name: 'Iron Stomach',
        description: 'Collect 300 total objects',
        tier: ACHIEVEMENT_TIER_LATE,
        check: (state) => state.game.collectedCount >= 300
    },
    {
        id: 'cat_kingdom',
        name: 'Cat Kingdom',
        description: 'Rescue 25 cats',
        tier: ACHIEVEMENT_TIER_LATE,
        check: (state) => state.game.catsRescued >= 25
    },
    {
        id: 'long_haul',
        name: 'Long Haul',
        description: 'Play for 30 minutes',
        tier: ACHIEVEMENT_TIER_LATE,
        check: (state) => state.game.playTime >= 1800
    },
    {
        id: 'boss_slayer',
        name: 'Boss Slayer',
        description: 'Defeat 3 bosses',
        tier: ACHIEVEMENT_TIER_LATE,
        check: (state) => state.achievementStats.bossesDefeated >= 3
    },
    {
        id: 'arcane_battery',
        name: 'Arcane Battery',
        description: 'Cast 600 shadow bolts',
        tier: ACHIEVEMENT_TIER_LATE,
        check: (state) => state.achievementStats.shadowBoltsCast >= 600
    },
    {
        id: 'tentacle_overlord',
        name: 'Tentacle Overlord',
        description: 'Use tentacles 150 times',
        tier: ACHIEVEMENT_TIER_LATE,
        check: (state) => state.achievementStats.tentaclesUsed >= 150
    },
    {
        id: 'dash_phantom',
        name: 'Dash Phantom',
        description: 'Dash 300 times',
        tier: ACHIEVEMENT_TIER_LATE,
        check: (state) => state.achievementStats.dashesUsed >= 300
    },
    {
        id: 'hazard_warden',
        name: 'Hazard Warden',
        description: 'Detonate 60 hazards',
        tier: ACHIEVEMENT_TIER_LATE,
        check: (state) => getHazardDetonations(state.collectedCounts) >= 60
    }
];

/**
 * Checks all achievements and unlocks any that have been completed
 * @function
 */
function checkAchievements() {
    // Skip if game is over or not started
    if (gameState.gameOver || !gameState.gameStarted) {
        return;
    }

    // Create a state object with all the data needed for achievement checks
    const state = {
        game: gameState,
        player: playerState,
        collectedCounts: gameState.collectedCounts,
        achievementStats: gameState.achievementStats || {
            shadowBoltsCast: 0,
            tentaclesUsed: 0,
            dashesUsed: 0,
            bossesDefeated: 0
        }
    };

    // Check each achievement
    ACHIEVEMENTS.forEach(achievement => {
        // Only check achievements that haven't been unlocked yet
        if (!gameState.achievements[achievement.id] && achievement.check(state)) {
            // Unlock the achievement
            unlockAchievement(achievement);
        }
    });
}

/**
 * Unlocks an achievement and shows a notification
 * @param {Object} achievement - The achievement to unlock
 * @function
 */
function unlockAchievement(achievement) {
    const rewardPoints = getAchievementPoints(achievement);

    // Mark the achievement as unlocked
    gameState.achievements[achievement.id] = true;

    // Add points based on achievement tier
    gameState.score += rewardPoints;

    // Show notification
    showAchievementNotification(achievement.name, rewardPoints);

    // Play sound
    playSound('player_level_up');

    // Save achievements to localStorage
    saveAchievements();
}

/**
 * Shows an achievement notification
 * @param {string} name - The name of the achievement
 * @param {number} points - Points awarded for this achievement
 * @function
 */
function showAchievementNotification(name, points) {
    queueAchievementNotification(name, points);
}

/**
 * Saves achievements to localStorage
 * @function
 */
function saveAchievements() {
    localStorage.setItem('mimicAchievements', JSON.stringify(gameState.achievements));
}

/**
 * Loads achievements from localStorage
 * @function
 */
function loadAchievements() {
    const savedAchievements = localStorage.getItem('mimicAchievements');
    if (!savedAchievements) {
        gameState.achievements = {};
        return;
    }

    try {
        const parsedAchievements = JSON.parse(savedAchievements);
        if (parsedAchievements && typeof parsedAchievements === 'object' && !Array.isArray(parsedAchievements)) {
            gameState.achievements = parsedAchievements;
        } else {
            gameState.achievements = {};
            localStorage.removeItem('mimicAchievements');
        }
    } catch (error) {
        console.warn('Failed to parse saved achievements. Resetting achievements storage.', error);
        gameState.achievements = {};
        localStorage.removeItem('mimicAchievements');
    }
}


// Current page for achievements pagination
let achievementsCurrentPage = 0;

function getAchievementsLayoutState() {
    const overlayBounds = getResponsiveOverlayBounds(0.86, 0.88, 340, 260, 980, 760);

    const computeLayoutMetrics = (layoutScale, resolvedOverlayWidth, resolvedOverlayHeight) => {
        const scalePx = (value) => value * layoutScale;
        const sidePadding = scalePx(30);
        const topPadding = scalePx(24);
        const footerReserve = scalePx(62);
        const titleSize = scalePx(28);
        const titleHeight = scalePx(40);
        const progressSize = scalePx(16);
        const progressHeight = scalePx(30);
        const achievementHeight = scalePx(60);
        const achievementSpacing = scalePx(10);
        const availableHeight = resolvedOverlayHeight - topPadding - footerReserve - titleHeight - progressHeight;
        const requiredHeight = achievementHeight; // Ensure at least one card can fit.

        return {
            sidePadding,
            topPadding,
            footerReserve,
            titleSize,
            titleHeight,
            progressSize,
            progressHeight,
            achievementHeight,
            achievementSpacing,
            availableHeight,
            requiredHeight
        };
    };

    const layout = computeAdaptiveOverlayLayout(
        overlayBounds,
        computeLayoutMetrics,
        { minScale: 0.86, maxIterations: 6, fitBias: 0.98 }
    );

    if (!layout) {
        return null;
    }

    const achievementsPerPage = Math.max(
        1,
        Math.floor(layout.metrics.availableHeight / (layout.metrics.achievementHeight + layout.metrics.achievementSpacing))
    );
    const totalPages = Math.max(1, Math.ceil(ACHIEVEMENTS.length / achievementsPerPage));

    return {
        ...layout,
        achievementsPerPage,
        totalPages
    };
}

/**
 * Draws the achievements screen
 * @function
 */
function drawAchievementsScreen() {
    // Draw semi-transparent overlay for the entire screen
    fill(0, 0, 0, 200);
    rect(0, 0, width, height);

    const layoutState = getAchievementsLayoutState();
    if (!layoutState) {
        drawOverlayViewportWarning("Achievements", [
            "Press Escape to close"
        ], 340, 260);
        return;
    }
    let { overlayWidth, overlayHeight, overlayX, overlayY } = layoutState;
    const { metrics, scalePx, achievementsPerPage, totalPages } = layoutState;

    // Ensure current page is valid
    achievementsCurrentPage = Math.max(0, Math.min(achievementsCurrentPage, totalPages - 1));

    // Calculate which achievements to show on current page
    const startIndex = achievementsCurrentPage * achievementsPerPage;
    const endIndex = Math.min(startIndex + achievementsPerPage, ACHIEVEMENTS.length);

    // Draw the overlay background
    fill(160, 160, 160); // Grey
    noStroke();
    rect(overlayX, overlayY, overlayWidth, overlayHeight, 10);

    // Text Content
    let leftMargin = overlayX + metrics.sidePadding;
    let currentY = overlayY + metrics.topPadding;

    // Heading: "Achievements"
    fill(0);
    textSize(metrics.titleSize);
    textAlign(LEFT, TOP);
    textStyle(BOLD);
    text(`Achievements`, leftMargin, currentY);
    currentY += metrics.titleHeight;

    // Count unlocked achievements
    const unlockedCount = ACHIEVEMENTS.reduce(
        (count, achievement) => count + (gameState.achievements[achievement.id] ? 1 : 0),
        0
    );

    // Show progress and page indicator
    textSize(metrics.progressSize);
    textStyle(NORMAL);
    text(`Unlocked: ${unlockedCount}/${ACHIEVEMENTS.length}`, leftMargin, currentY);

    // Show page indicator if multiple pages
    if (totalPages > 1) {
        textAlign(RIGHT, TOP);
        text(`Page ${achievementsCurrentPage + 1}/${totalPages}`, overlayX + overlayWidth - metrics.sidePadding, currentY);
        textAlign(LEFT, TOP);
    }

    currentY += metrics.progressHeight;

    // List achievements for current page
    textSize(scalePx(18));
    let achievementY = currentY;
    let achievementWidth = overlayWidth - (metrics.sidePadding * 2);

    for (let i = startIndex; i < endIndex; i++) {
        const achievement = ACHIEVEMENTS[i];
        const isUnlocked = gameState.achievements[achievement.id];

        // Draw achievement background
        if (isUnlocked) {
            fill(50, 150, 50, 100); // Green for unlocked
        } else {
            fill(100, 100, 100, 100); // Grey for locked
        }
        rect(leftMargin, achievementY, achievementWidth, metrics.achievementHeight, scalePx(5));

        // Draw achievement name
        textAlign(LEFT, TOP);
        textStyle(BOLD);
        if (isUnlocked) {
            fill(0, 100, 0); // Dark green for unlocked
        } else {
            fill(50, 50, 50); // Dark grey for locked
        }
        textSize(scalePx(18));
        text(achievement.name, leftMargin + scalePx(10), achievementY + scalePx(10));

        // Draw achievement description
        textStyle(NORMAL);
        textSize(scalePx(14));
        if (isUnlocked) {
            fill(0);
        } else {
            fill(80, 80, 80);
        }
        text(
            achievement.description,
            leftMargin + scalePx(10),
            achievementY + scalePx(35),
            achievementWidth - scalePx(160),
            metrics.achievementHeight - scalePx(40)
        );

        // Draw unlocked status
        textAlign(RIGHT, TOP);
        textSize(scalePx(14));
        if (isUnlocked) {
            fill(0, 150, 0);
            text("UNLOCKED", leftMargin + achievementWidth - scalePx(10), achievementY + scalePx(10));
        } else {
            fill(100, 100, 100);
            text("LOCKED", leftMargin + achievementWidth - scalePx(10), achievementY + scalePx(10));
        }

        const points = getAchievementPoints(achievement);
        const tierShort = achievement.tier === ACHIEVEMENT_TIER_EARLY
            ? "E"
            : (achievement.tier === ACHIEVEMENT_TIER_LATE ? "L" : "M");
        textSize(scalePx(13));
        fill(40, 40, 40);
        text(`${tierShort} +${points}`, leftMargin + achievementWidth - scalePx(10), achievementY + scalePx(32));

        achievementY += metrics.achievementHeight + metrics.achievementSpacing;
    }

    // Navigation Instructions
    textSize(scalePx(14));
    textStyle(ITALIC);
    fill(0);
    textAlign(CENTER, BOTTOM);
    const navBaseY = overlayY + overlayHeight - scalePx(20);

    // Show page navigation instructions if multiple pages
    if (totalPages > 1) {
        let navText = "";
        if (achievementsCurrentPage > 0) {
            navText += "Press Left Arrow for previous page   ";
        }
        if (achievementsCurrentPage < totalPages - 1) {
            navText += "Press Right Arrow for next page   ";
        }
        text(navText, overlayX + overlayWidth / 2, navBaseY - scalePx(20));
    }

    text(
        "Press Escape to close",
        overlayX + overlayWidth / 2,
        navBaseY
    );

    textStyle(NORMAL);
    textAlign(LEFT, BASELINE); // Reset for other potential text drawing
}

/**
 * Handles key presses on the achievements screen
 * @returns {boolean} Whether the key press was handled
 * @function
 */
function handleAchievementsScreenKeyPressed() {
    if (gameState.showAchievementsScreen) {
        if (keyCode === ESCAPE) {
            gameState.showAchievementsScreen = false;
            achievementsCurrentPage = 0; // Reset to first page when closing
            return true;
        }

        const layoutState = getAchievementsLayoutState();
        const totalPages = layoutState ? layoutState.totalPages : 1;

        // Handle page navigation
        if (keyCode === RIGHT_ARROW && achievementsCurrentPage < totalPages - 1) {
            achievementsCurrentPage++;
            return true;
        }
        if (keyCode === LEFT_ARROW && achievementsCurrentPage > 0) {
            achievementsCurrentPage--;
            return true;
        }

        return true;
    }
    return false;
}
