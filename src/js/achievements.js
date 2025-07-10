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
        check: (state) => state.collectedCounts.cat >= 5
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
        achievementNotification.timer -= 1;
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
    if (savedAchievements) {
        gameState.achievements = JSON.parse(savedAchievements);
    } else {
        gameState.achievements = {};
    }
}


/**
 * Draws the achievements screen
 * @function
 */
function drawAchievementsScreen() {
    // Draw semi-transparent overlay for the entire screen
    fill(0, 0, 0, 200);
    rect(0, 0, width, height);

    // Overlay Size Calculation
    let overlayWidth = width * 0.7;
    let overlayHeight = height * 0.8;

    if (overlayWidth < 550) { // Min width
        overlayWidth = 550;
    }
    let overlayX = (width - overlayWidth) / 2;
    let overlayY = (height - overlayHeight) / 2;

    // Draw the overlay background
    fill(160, 160, 160); // Grey
    noStroke();
    rect(overlayX, overlayY, overlayWidth, overlayHeight, 10);

    // Text Content
    let leftMargin = overlayX + 30;
    let currentY = overlayY + 25;

    // Heading: "Achievements"
    fill(0);
    textSize(28);
    textAlign(LEFT, TOP);
    textStyle(BOLD);
    text(`Achievements`, leftMargin, currentY);
    currentY += 40;

    // Count unlocked achievements
    let unlockedCount = 0;
    for (const id in gameState.achievements) {
        if (gameState.achievements[id]) {
            unlockedCount++;
        }
    }

    // Show progress
    textSize(16);
    textStyle(NORMAL);
    text(`Unlocked: ${unlockedCount}/${ACHIEVEMENTS.length}`, leftMargin, currentY);
    currentY += 30;

    // List all achievements
    textSize(18);
    let achievementY = currentY;
    let achievementHeight = 60;
    let achievementWidth = overlayWidth - 60;

    for (let i = 0; i < ACHIEVEMENTS.length; i++) {
        const achievement = ACHIEVEMENTS[i];
        const isUnlocked = gameState.achievements[achievement.id];

        // Draw achievement background
        if (isUnlocked) {
            fill(50, 150, 50, 100); // Green for unlocked
        } else {
            fill(100, 100, 100, 100); // Grey for locked
        }
        rect(leftMargin, achievementY, achievementWidth, achievementHeight, 5);

        // Draw achievement name
        textAlign(LEFT, TOP);
        textStyle(BOLD);
        if (isUnlocked) {
            fill(0, 100, 0); // Dark green for unlocked
        } else {
            fill(50, 50, 50); // Dark grey for locked
        }
        text(achievement.name, leftMargin + 10, achievementY + 10);

        // Draw achievement description
        textStyle(NORMAL);
        textSize(14);
        if (isUnlocked) {
            fill(0);
        } else {
            fill(80, 80, 80);
        }
        text(achievement.description, leftMargin + 10, achievementY + 35);

        // Draw unlocked status
        textAlign(RIGHT, TOP);
        textSize(14);
        if (isUnlocked) {
            fill(0, 150, 0);
            text("UNLOCKED", leftMargin + achievementWidth - 10, achievementY + 10);
        } else {
            fill(100, 100, 100);
            text("LOCKED", leftMargin + achievementWidth - 10, achievementY + 10);
        }

        achievementY += achievementHeight + 10;
    }

    // Navigation Instructions
    textSize(14);
    textStyle(ITALIC);
    fill(0);
    textAlign(CENTER, BOTTOM);
    text(
        "Press Escape to close",
        overlayX + overlayWidth / 2,
        overlayY + overlayHeight - 20
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
            return true;
        }
        return true;
    }
    return false;
}
