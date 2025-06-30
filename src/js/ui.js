// Declare UI element variables HERE, only once globally
let retryButton = {x: 0, y: 0, w: 100, h: 40};
let submitButton = {x: 0, y: 0, w: 100, h: 40};
let gameLevelNotification = {
    active: false, timer: 0, duration: GAME_LEVEL_NOTIFICATION_DURATION, text: ""
};
let staffNotification = {
    active: false, timer: 0, duration: STAFF_NOTIFICATION_DURATION,
    line1: "Wizard Staff Obtained!", line2: "Press Spacebar to use"
};
let tentacleNotification = {
    active: false, timer: 0, duration: TENTACLE_NOTIFICATION_DURATION,
    line1: "Tentacles Unlocked!", line2: "Press '1' Key to use"
};
let magnetNotification = {
    active: false, timer: 0, duration: STAFF_NOTIFICATION_DURATION,
    line1: "Magnet Obtained!", line2: "Press '2' Key to use"
};
let extraLifeNotification = {
    active: false, timer: 0, duration: 180,
    line1: "Extra Life Gained!", line2: "Max Lives Increased"
};

// Declare highScores array HERE
let highScores = [];

function setupUI() {
    retryButton.x = width / 2 - retryButton.w / 2;
    retryButton.y = height / 2 - 150;
    submitButton.x = width / 2 - submitButton.w / 2;
    submitButton.y = height / 2 + 90;
    loadHighScores();
    loadLastUsedName(); // This will now respect if URL already set a name
}

function drawUI() {
    fill(255);
    textSize(24);
    textAlign(LEFT);
    text(`Floor: ${gameState.dungeonFloor}`, 10, 30);
    text(`Zone: ${gameState.dungeonZone}`, 10, 55);
    text(`Score: ${gameState.score}`, 10, 80);
    textSize(14);
    const dropSpeedPercent = Math.round((gameState.dropSpeedScale / INITIAL_DROP_SPEED_SCALE) * 100);
    const spawnRatePercent = Math.round((BASE_OBJECT_SPAWN_RATE_FRAMES / gameState.objectSpawnRate) * 100);
    text(`Drop Speed: ${dropSpeedPercent}%`, 10, 105);
    text(`Spawn Rate: ${spawnRatePercent}%`, 10, 125);

    text('Esc: Help', 10, 155);

    // Top right
    let heartSize = 20;
    let topMargin = 10;
    let rightMargin = 10;
    let heartSpacing = 5;
    let heartStep = heartSize + heartSpacing;
    let startHeartX = width - rightMargin - heartSize;
    let heartY = topMargin;
    for (let i = 0; i < playerState.lives; i++) {
        let currentHeartX = startHeartX - i * heartStep;
        drawHeart(currentHeartX, heartY, heartSize);
    }
    fill(255);
    textSize(24);
    textAlign(RIGHT);
    let statsStartY = heartY + heartSize + 25;
    text(`XP: ${playerState.experience} / ${playerState.experienceCap}`, width - 10, statsStartY);
    let playerLevelY = statsStartY + 25;
    text(`Player Level: ${playerState.level}`, width - 10, playerLevelY);
    textSize(14);
    let speedY = playerLevelY + 25;
    text(`Speed: ${playerState.speedPercentage}%`, width - 10, speedY);
    let sizeY = speedY + 20;
    text(`Size: ${playerState.sizePercentage}%`, width - 10, sizeY);
    let iconY = sizeY + 18;
    let iconHeightTarget = 25;
    let iconRightEdge = width - 10;
    let iconSpacing = 8;
    let currentIconX = iconRightEdge;
    const staffImg = objectImages[OBJ_WIZARD_STAFF];
    let staffIconWidth = 0;
    let staffIconHeight = 0;
    if (playerState.hasWizardStaff) {
        if (staffImg && staffImg.width) {
            let scale = iconHeightTarget / staffImg.height;
            staffIconWidth = staffImg.width * scale;
            staffIconHeight = iconHeightTarget;
            let staffIconX = currentIconX - staffIconWidth;
            image(staffImg, staffIconX, iconY, staffIconWidth, staffIconHeight);
        } else {
            staffIconWidth = 15;
            staffIconHeight = iconHeightTarget;
            let staffIconX = currentIconX - staffIconWidth;
            fill(139, 69, 19);
            noStroke();
            rect(staffIconX + 10, iconY + 5, 5, staffIconHeight * 0.7);
            fill(255, 0, 0);
            ellipse(staffIconX + 12.5, iconY + 5, 7.5, 7.5);
        }
        currentIconX -= (staffIconWidth + iconSpacing);
    }
    if (playerState.level >= PLAYER_LEVEL_FOR_TENTACLES) {
        let chainIconWidth;
        if (chainImage && chainImage.width) {
            let scale = iconHeightTarget / chainImage.height;
            chainIconWidth = chainImage.width * scale;
            let chainIconHeight = iconHeightTarget;
            let chainIconX = currentIconX - chainIconWidth;
            image(chainImage, chainIconX, iconY, chainIconWidth, chainIconHeight);
        } else {
            chainIconWidth = 15;
            let chainIconX = currentIconX - chainIconWidth;
            fill(150);
            noStroke();
            rect(chainIconX, iconY, chainIconWidth, iconHeightTarget, 3);
            fill(50);
            ellipse(chainIconX + chainIconWidth / 2, iconY + iconHeightTarget * 0.3, chainIconWidth * 0.6, chainIconWidth * 0.3);
            ellipse(chainIconX + chainIconWidth / 2, iconY + iconHeightTarget * 0.7, chainIconWidth * 0.6, chainIconWidth * 0.3);
        }
        currentIconX -= (chainIconWidth + iconSpacing);
    }

    if (playerState.hasMagnet) {
        let magnetIconWidth;
        if (magnetFrames[0] && magnetFrames[0].width) {
            let scale = iconHeightTarget / magnetFrames[0].height;
            magnetIconWidth = magnetFrames[0].width * scale;
            let magnetIconHeight = iconHeightTarget;
            let magnetIconX = currentIconX - magnetIconWidth;
            image(magnetFrames[0], magnetIconX, iconY, magnetIconWidth, magnetIconHeight);
        } else {
            magnetIconWidth = 15;
            let magnetIconX = currentIconX - magnetIconWidth;
            fill(0, 100, 255);
            noStroke();
            rect(magnetIconX, iconY, magnetIconWidth, iconHeightTarget, 3);
            fill(200);
            ellipse(magnetIconX + magnetIconWidth / 2, iconY + iconHeightTarget / 2, magnetIconWidth * 0.6, magnetIconWidth * 0.6);
        }
        //currentIconX -= (magnetIconWidth + iconSpacing);
    }
    if (playerState.tentaclesCooldown > 0) {
        let barWidth = 50;
        let barHeight = 10;
        let barX = iconRightEdge - barWidth;
        let barY = iconY + iconHeightTarget + 5;
        let progress = playerState.tentaclesCooldown / TENTACLE_COOLDOWN_FRAMES;
        fill(100);
        noStroke();
        rect(barX, barY, barWidth, barHeight, 2);
        fill(0, 255, 0);
        rect(barX, barY, barWidth * progress, barHeight, 2);
    }

    if (playerState.magnetismCooldown > 0) {
        let barWidth = 50;
        let barHeight = 10;
        let barX = iconRightEdge - barWidth;
        let barY = iconY + iconHeightTarget + 20; // Position below tentacles cooldown
        let progress = playerState.magnetismCooldown / MAGNETISM_COOLDOWN_FRAMES;
        fill(100);
        noStroke();
        rect(barX, barY, barWidth, barHeight, 2);
        fill(0, 100, 255);
        rect(barX, barY, barWidth * progress, barHeight, 2);
    }

}

function drawHeart(x, y, size) {
    push();
    translate(x, y);
    fill(255, 0, 0);
    noStroke();
    let arcCenterX1 = size * 0.25;
    let arcCenterX2 = size * 0.75;
    let arcCenterY = size * 0.25;
    let arcRadius = size * 0.25;
    let triangleTopY = size * 0.25;
    let triangleBottomY = size * 0.9;
    let sideX1 = 0;
    let sideX2 = size;
    arc(arcCenterX1, arcCenterY, arcRadius * 2, arcRadius * 2, PI, TWO_PI);
    arc(arcCenterX2, arcCenterY, arcRadius * 2, arcRadius * 2, PI, TWO_PI);
    beginShape();
    vertex(sideX1, triangleTopY);
    vertex(size / 2, triangleBottomY);
    vertex(sideX2, triangleTopY);
    endShape(CLOSE);
    pop();
}

function drawNameInputScreen() {
    // Draw all static elements
    textSize(32);
    textAlign(CENTER, CENTER);
    fill(255, 0, 0);
    text("Game Over", width / 2, height / 2 - 70);
    fill(255);
    text("Enter Your Name", width / 2, height / 2 - 30);
    let inputWidth = 200;
    let inputHeight = 30;
    let inputX = width / 2 - inputWidth / 2;
    let inputY = height / 2 + 20;
    fill(100);
    stroke(255);
    strokeWeight(2);
    rect(inputX, inputY - inputHeight / 2, inputWidth, inputHeight, 5);
    noStroke();
    fill(255);
    textSize(24);

    // Display the current input text
    textAlign(LEFT, CENTER);
    text(gameState.currentNameInput, inputX + 10, inputY);

    // Calculate cursor position based on text width
    let textWidthValue = gameState.currentNameInput.length > 0 ? 
        textWidth(gameState.currentNameInput) : 0;

    // Draw a static underscore at the end of the input text
    fill(255);
    text("_", inputX + 10 + textWidthValue, inputY);

    // Reset text alignment
    textAlign(CENTER, CENTER);
    textSize(16);
    fill(255);
    text("Type your name and press Enter to submit", width / 2, height / 2 + 60);
    fill(255);
    rect(submitButton.x, submitButton.y, submitButton.w, submitButton.h, 10);
    fill(0);
    textSize(20);
    text("Submit", submitButton.x + submitButton.w / 2, submitButton.y + submitButton.h / 2);
}

// --- High Score and Name Persistence functions ---
function loadHighScores() {
    const storedScores = localStorage.getItem('mimicFeederHighScores');
    if (storedScores) {
        try {
            highScores = JSON.parse(storedScores);
            if (!Array.isArray(highScores)) highScores = [];
        } catch (e) {
            console.error("Error parsing high scores:", e);
            highScores = [];
        }
    } else {
        highScores = [];
    }
    highScores.sort((a, b) => b.score - a.score);
    highScores = highScores.slice(0, HIGH_SCORE_COUNT);
}

function loadLastUsedName() {
    // Always try to load from localStorage
    const storedName = localStorage.getItem('mimicFeederLastUsedName');
    if (storedName) {
        gameState.lastUsedName = storedName;
    }
    // If no stored name, keep the default "Player"
    // gameState.currentNameInput will be set in sketch.js setup after this call.
}

function saveHighScores() {
    highScores.sort((a, b) => b.score - a.score);
    highScores = highScores.slice(0, HIGH_SCORE_COUNT);
    localStorage.setItem('mimicFeederHighScores', JSON.stringify(highScores));
}

function saveLastUsedName(name) {
    gameState.lastUsedName = name; // Update state as well
    localStorage.setItem('mimicFeederLastUsedName', name);
}

function submitName() {
    let nameToSubmit = gameState.currentNameInput.trim();
    if (nameToSubmit === "") {
        nameToSubmit = gameState.lastUsedName;
    } else {
        nameToSubmit = nameToSubmit.substring(0, NAME_INPUT_MAX_LENGTH);
        saveLastUsedName(nameToSubmit); // Save the new name if it's different
    }
    gameState.playerName = nameToSubmit;
    let d = new Date();
    let dateStr = `${String(d.getFullYear()).slice(2)}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    highScores.push({
        name: gameState.playerName,
        score: gameState.score,
        gameLevel: getCurrentLevel(), // For backward compatibility
        dungeonFloor: gameState.dungeonFloor,
        dungeonZone: gameState.dungeonZone,
        playerLevel: playerState.level,
        date: dateStr,
        playTime: gameState.playTime
    });
    saveHighScores();
    gameState.enteringName = false;
}
