/**
 * @fileoverview Achievement system for Mimic Feeder.
 * Contains achievement definitions, tracking, and notification functionality.
 * @author Yestin Johnson
 */

/**
 * Achievement definitions - Each achievement has an id, name, description, and check function
 * @type {Array<Object>}
 */
const ACHIEVEMENTS = [
    {
        id: 'first_blood',
        name: 'First Blood',
        description: 'Collect your first human',
        check: (state) => state.collectedCounts.human >= 1
    },
    {
        id: 'bomb_squad',
        name: 'Bomb Squad',
        description: 'Destroy 10 bombs',
        check: (state) => state.collectedCounts.small_bomb >= 10
    },
    {
        id: 'cat_lover',
        name: 'Cat Lover',
        description: 'Rescue 5 cats',
        check: (state) => state.game.catsRescued >= 5
    },
    {
        id: 'treasure_hunter',
        name: 'Treasure Hunter',
        description: 'Collect 3 crowns',
        check: (state) => state.collectedCounts.crown >= 3
    },
    {
        id: 'diamond_collector',
        name: 'Diamond Collector',
        description: 'Collect 3 diamonds',
        check: (state) => state.collectedCounts.diamond >= 3
    },
    {
        id: 'dragon_slayer',
        name: 'Dragon Slayer',
        description: 'Collect 5 dragons',
        check: (state) => state.collectedCounts.dragon >= 5
    },
    {
        id: 'level_up',
        name: 'Level Up',
        description: 'Reach player level 5',
        check: (state) => state.player.level >= 5
    },
    {
        id: 'dungeon_explorer',
        name: 'Dungeon Explorer',
        description: 'Reach dungeon floor 3',
        check: (state) => state.game.dungeonFloor >= 3
    },
    {
        id: 'high_score',
        name: 'High Score',
        description: 'Score 1000 points',
        check: (state) => state.game.score >= 1000
    },
    {
        id: 'survivor',
        name: 'Survivor',
        description: 'Play for 3 minutes',
        check: (state) => state.game.playTime >= 180
    }
];

/**
 * Achievement notification object
 * @type {Object}
 */
let achievementNotification = {
    active: false,
    name: '',
    timer: 0,
    duration: 180 // 3 seconds at 60fps
};

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
        collectedCounts: gameState.collectedCounts
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
    // Mark the achievement as unlocked
    gameState.achievements[achievement.id] = true;

    // Add 100 points to the score
    gameState.score += 100;

    // Show notification
    showAchievementNotification(achievement.name);

    // Play sound
    playSound('player_level_up');

    // Save achievements to localStorage
    saveAchievements();
}

/**
 * Shows an achievement notification
 * @param {string} name - The name of the achievement
 * @function
 */
function showAchievementNotification(name) {
    achievementNotification.active = true;
    achievementNotification.name = name;
    achievementNotification.timer = achievementNotification.duration;
}

/**
 * Updates and draws the achievement notification
 * @function
 */
function updateAchievementNotification() {
    if (achievementNotification.active) {
        achievementNotification.timer -= getFrameDelta();
        if (achievementNotification.timer <= 0) {
            achievementNotification.active = false;
            return;
        }

        // Draw notification background
        fill(0, 0, 0, 150);
        noStroke();
        rect(width / 2 - 170, height / 2 - 80, 340, 80, 10);

        // Draw notification text
        fill(255, 215, 0); // Gold color
        textSize(28);
        textAlign(CENTER, CENTER);
        textStyle(BOLD);
        text("Achievement Unlocked!", width / 2, height / 2 - 50);

        textSize(22);
        fill(255);
        text(achievementNotification.name, width / 2, height / 2 - 20);

        textSize(18);
        fill(0, 255, 0); // Green color
        text("+100 points", width / 2, height / 2 + 10);

        textStyle(NORMAL);
    }
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
    let unlockedCount = 0;
    for (const id in gameState.achievements) {
        if (gameState.achievements[id]) {
            unlockedCount++;
        }
    }

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
            achievementWidth - scalePx(110),
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
