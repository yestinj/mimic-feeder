// Declare UI element variables HERE, only once globally
let retryButton = {x: 0, y: 0, w: 100, h: 40};
let submitButton = {x: 0, y: 0, w: 100, h: 40};
let centerNotificationQueue = [];
let activeCenterNotification = null;
let centerNotificationTransitionTimer = 0;
const MAX_CENTER_NOTIFICATION_QUEUE_SIZE = 30;
const CENTER_NOTIFICATION_TRANSITION_FRAMES = 8;
const UI_THEME = {
    fontPrimary: 'Georgia',
    shadow: [12, 7, 5, 180],
    panelBackground: [20, 12, 9, 150],
    panelBorder: [176, 132, 79, 215],
    panelGlow: [255, 220, 150, 36],
    textPrimary: [246, 234, 208],
    textMuted: [204, 188, 159],
    textAccent: [255, 219, 126]
};

function formatHudNumber(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
        return '0';
    }
    return Math.round(numericValue).toLocaleString();
}

function drawHudPanel(x, y, w, h, radius = 12, backgroundColor = UI_THEME.panelBackground, borderColor = UI_THEME.panelBorder) {
    noStroke();
    fill(UI_THEME.panelGlow[0], UI_THEME.panelGlow[1], UI_THEME.panelGlow[2], UI_THEME.panelGlow[3]);
    rect(x - 1, y - 1, w + 2, h + 2, radius + 2);
    stroke(borderColor[0], borderColor[1], borderColor[2], borderColor[3]);
    strokeWeight(1.25);
    fill(backgroundColor[0], backgroundColor[1], backgroundColor[2], backgroundColor[3]);
    rect(x, y, w, h, radius);
}

function drawShadowedText(content, x, y, size, color, alignX = LEFT, alignY = TOP, style = NORMAL) {
    const colorAlpha = Array.isArray(color) && color.length >= 4 ? color[3] : 255;
    const shadowAlpha = Math.min(UI_THEME.shadow[3], colorAlpha);
    textFont(UI_THEME.fontPrimary);
    textSize(size);
    textAlign(alignX, alignY);
    textStyle(style);
    noStroke();
    fill(UI_THEME.shadow[0], UI_THEME.shadow[1], UI_THEME.shadow[2], shadowAlpha);
    text(content, x + 1.5, y + 1.5);
    fill(color[0], color[1], color[2], colorAlpha);
    text(content, x, y);
}

function enqueueCenterNotification(notification) {
    if (!notification || typeof notification.title !== 'string' || notification.title.trim().length === 0) {
        return;
    }

    const duration = Number.isFinite(notification.duration) && notification.duration > 0
        ? notification.duration
        : 180;
    const entry = {
        style: notification.style || 'panel',
        title: notification.title,
        subtitle: notification.subtitle || '',
        footer: notification.footer || '',
        duration: duration,
        timer: duration,
        titleColor: notification.titleColor || [255, 215, 0],
        subtitleColor: notification.subtitleColor || [230, 230, 230],
        footerColor: notification.footerColor || [0, 255, 0],
        backgroundColor: notification.backgroundColor || [0, 0, 0, 150],
        titleSize: Number.isFinite(notification.titleSize) ? notification.titleSize : 28,
        titleStyle: notification.titleStyle || BOLD,
        subtitleSize: Number.isFinite(notification.subtitleSize) ? notification.subtitleSize : 18,
        footerSize: Number.isFinite(notification.footerSize) ? notification.footerSize : 18,
        subtitleItalic: !!notification.subtitleItalic
    };

    if (centerNotificationQueue.length >= MAX_CENTER_NOTIFICATION_QUEUE_SIZE) {
        centerNotificationQueue.shift();
    }
    centerNotificationQueue.push(entry);

    if (!activeCenterNotification && centerNotificationTransitionTimer <= 0) {
        activeCenterNotification = centerNotificationQueue.shift();
    }
}

function clearCenterNotifications() {
    centerNotificationQueue = [];
    activeCenterNotification = null;
    centerNotificationTransitionTimer = 0;
}

function hasPendingCenterNotificationTitle(title) {
    const normalizedTitle = String(title || '').trim();
    if (!normalizedTitle) {
        return false;
    }
    if (activeCenterNotification && activeCenterNotification.title === normalizedTitle) {
        return true;
    }
    return centerNotificationQueue.some((entry) => entry && entry.title === normalizedTitle);
}

function measureCenterNotificationTextBlock(textValue, blockSize, blockStyle, maxWidth) {
    const normalizedText = String(textValue || '').trim();
    if (!normalizedText) {
        return null;
    }

    textFont(UI_THEME.fontPrimary);
    textSize(blockSize);
    textStyle(blockStyle);
    const lines = wrapTextToLines(normalizedText, maxWidth);
    const lineHeight = Math.max(16, Math.round(blockSize * 1.2));

    let maxLineWidth = 0;
    for (const line of lines) {
        maxLineWidth = Math.max(maxLineWidth, textWidth(line));
    }

    return {
        lines,
        size: blockSize,
        style: blockStyle,
        lineHeight,
        width: maxLineWidth,
        height: lines.length * lineHeight
    };
}

function drawCenterPanelNotification(notification) {
    push();
    const centerX = width / 2;
    const centerY = height / 2;
    const horizontalPadding = 20;
    const verticalPadding = 14;
    const blockGap = 8;
    const maxPanelWidth = Math.min(width * 0.86, 720);
    const minPanelWidth = Math.min(maxPanelWidth, 240);
    const maxTextWidth = Math.max(120, maxPanelWidth - (horizontalPadding * 2));

    const blocks = [];
    const titleBlock = measureCenterNotificationTextBlock(notification.title, notification.titleSize, BOLD, maxTextWidth);
    if (titleBlock) {
        titleBlock.color = notification.titleColor;
        blocks.push(titleBlock);
    }

    const subtitleStyle = notification.subtitleItalic ? ITALIC : NORMAL;
    const subtitleBlock = measureCenterNotificationTextBlock(notification.subtitle, notification.subtitleSize, subtitleStyle, maxTextWidth);
    if (subtitleBlock) {
        subtitleBlock.color = notification.subtitleColor;
        blocks.push(subtitleBlock);
    }

    const footerBlock = measureCenterNotificationTextBlock(notification.footer, notification.footerSize, NORMAL, maxTextWidth);
    if (footerBlock) {
        footerBlock.color = notification.footerColor;
        blocks.push(footerBlock);
    }

    if (blocks.length === 0) {
        pop();
        return;
    }

    const widestBlockWidth = blocks.reduce((maxWidth, block) => Math.max(maxWidth, block.width), 0);
    const panelWidth = constrain(widestBlockWidth + (horizontalPadding * 2), minPanelWidth, maxPanelWidth);
    const panelHeight = Math.max(
        80,
        (verticalPadding * 2) +
        blocks.reduce((sum, block) => sum + block.height, 0) +
        (blockGap * (blocks.length - 1))
    );
    const panelX = centerX - (panelWidth / 2);
    const panelY = centerY - (panelHeight / 2);

    const rawBackgroundColor = notification.backgroundColor || UI_THEME.panelBackground;
    const panelBackgroundColor = [
        rawBackgroundColor[0],
        rawBackgroundColor[1],
        rawBackgroundColor[2],
        rawBackgroundColor.length >= 4 ? rawBackgroundColor[3] : UI_THEME.panelBackground[3]
    ];
    drawHudPanel(panelX, panelY, panelWidth, panelHeight, 12, panelBackgroundColor, UI_THEME.panelBorder);

    let textY = panelY + verticalPadding;
    for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];

        for (let lineIndex = 0; lineIndex < block.lines.length; lineIndex++) {
            drawShadowedText(
                block.lines[lineIndex],
                centerX,
                textY + (lineIndex * block.lineHeight),
                block.size,
                block.color,
                CENTER,
                TOP,
                block.style
            );
        }

        textY += block.height;
        if (i < blocks.length - 1) {
            textY += blockGap;
        }
    }

    pop();
}

function drawCenterBannerNotification(notification) {
    push();
    let titleSize = notification.titleSize;
    const titleColor = notification.titleColor;
    const titleStyle = notification.titleStyle || BOLD;
    const maxTextWidth = width * 0.86;
    const safeTitle = String(notification.title || '');

    textFont(UI_THEME.fontPrimary);
    textStyle(titleStyle);
    textSize(titleSize);
    while (titleSize > 26 && textWidth(safeTitle) > maxTextWidth) {
        titleSize -= 2;
        textSize(titleSize);
    }

    const panelWidth = constrain(textWidth(safeTitle) + 48, 260, width * 0.9);
    const panelHeight = Math.max(78, titleSize * 1.9);
    const panelX = (width - panelWidth) / 2;
    const panelY = (height - panelHeight) / 2;

    drawHudPanel(
        panelX,
        panelY,
        panelWidth,
        panelHeight,
        12,
        [14, 8, 6, 170],
        [titleColor[0], titleColor[1], titleColor[2], 230]
    );

    drawShadowedText(
        safeTitle,
        width / 2,
        height / 2,
        titleSize,
        titleColor,
        CENTER,
        CENTER,
        titleStyle
    );
    pop();
}

function updateAndDrawCenterNotifications() {
    if (!activeCenterNotification && centerNotificationTransitionTimer > 0) {
        centerNotificationTransitionTimer = max(0, centerNotificationTransitionTimer - getFrameDelta());
        return;
    }

    if (!activeCenterNotification && centerNotificationQueue.length > 0) {
        activeCenterNotification = centerNotificationQueue.shift();
    }
    if (!activeCenterNotification) {
        return;
    }

    if (activeCenterNotification.style === 'banner') {
        drawCenterBannerNotification(activeCenterNotification);
    } else {
        drawCenterPanelNotification(activeCenterNotification);
    }

    activeCenterNotification.timer -= getFrameDelta();
    if (activeCenterNotification.timer <= 0) {
        activeCenterNotification = null;
        centerNotificationTransitionTimer = CENTER_NOTIFICATION_TRANSITION_FRAMES;
    }
}

function queueGameLevelNotification(text) {
    if (hasPendingCenterNotificationTitle(text)) {
        return;
    }
    enqueueCenterNotification({
        style: 'banner',
        title: text,
        duration: GAME_LEVEL_NOTIFICATION_DURATION,
        titleColor: [255, 221, 130],
        titleSize: 36,
        titleStyle: NORMAL
    });
}

function queueBossFightNotification() {
    enqueueCenterNotification({
        style: 'banner',
        title: "BOSS FIGHT!",
        duration: GAME_LEVEL_NOTIFICATION_DURATION,
        titleColor: [255, 221, 130],
        titleSize: 44,
        titleStyle: BOLD
    });
}

function queueBossDefeatedNotification() {
    enqueueCenterNotification({
        style: 'banner',
        title: "Boss Defeated!",
        duration: GAME_LEVEL_NOTIFICATION_DURATION,
        titleColor: [255, 120, 120],
        titleSize: 44
    });
}

function queueStaffNotification(line1 = "Wizard Staff acquired", line2 = "Press Space to cast Shadow Bolt") {
    enqueueCenterNotification({
        style: 'panel',
        title: line1,
        subtitle: line2,
        duration: STAFF_NOTIFICATION_DURATION,
        titleColor: [255, 215, 0],
        subtitleColor: [230, 230, 230],
        subtitleItalic: true
    });
}

function queueTentacleNotification(line1, line2) {
    enqueueCenterNotification({
        style: 'panel',
        title: line1,
        subtitle: line2,
        duration: TENTACLE_NOTIFICATION_DURATION,
        titleColor: [138, 43, 226],
        subtitleColor: [230, 230, 230],
        subtitleItalic: true
    });
}

function queueMagnetNotification(line1 = "Magnet acquired", line2 = "Press X — pulls marked loot/hazards (incl. bombs)") {
    enqueueCenterNotification({
        style: 'panel',
        title: line1,
        subtitle: line2,
        duration: STAFF_NOTIFICATION_DURATION,
        titleColor: [0, 100, 255],
        subtitleColor: [230, 230, 230],
        subtitleItalic: true
    });
}

function queueExtraLifeNotification(line1 = "Extra Life Gained!", line2 = "Max Lives Increased") {
    enqueueCenterNotification({
        style: 'panel',
        title: line1,
        subtitle: line2,
        duration: 180,
        titleColor: [255, 0, 0],
        subtitleColor: [230, 230, 230],
        subtitleItalic: true
    });
}

function queueAchievementNotification(name, points) {
    enqueueCenterNotification({
        style: 'panel',
        title: "Achievement Unlocked!",
        subtitle: name,
        footer: `+${points} points`,
        duration: 180,
        titleColor: [255, 215, 0],
        subtitleColor: [255, 255, 255],
        footerColor: [0, 255, 0],
        subtitleItalic: false,
        titleSize: 28,
        subtitleSize: 22,
        footerSize: 18
    });
}

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

/**
 * Draws the pause screen overlay
 * @function
 */
function drawPauseScreen() {
    // Draw semi-transparent overlay
    fill(0, 0, 0, 150);
    rect(0, 0, width, height);

    // Heading
    fill(255);
    textSize(48);
    textAlign(CENTER, CENTER);
    textStyle(BOLD);
    text("PAUSED", width / 2, height / 2 - 10);

    // Instructions
    textSize(20);
    textStyle(NORMAL);
    text("Press 'P' to Resume", width / 2, height / 2 + 30);

    // Reset text parameters for other draws
    textAlign(LEFT, BASELINE);
}

/**
 * Draws onboarding overlays like eating zone highlight and keyboard reminders
 * @function
 */
function drawOnboardingOverlays() {
    // Safety: ensure player exists
    if (typeof player === 'undefined' || !player) {
        return;
    }
    // 1. Eating Zone and Ground highlight
    if (gameState.playTime < 10 || gameState.collectedCount < 5) {
        let alphaTime = map(gameState.playTime, 0, 10, 180, 0, true);
        let alphaEaten = map(gameState.collectedCount, 0, 5, 180, 0, true);
        let alpha = min(alphaTime, alphaEaten);

        if (alpha > 0) {
            push();
            let groundY = height - PLAYER_GROUND_Y_OFFSET;
            stroke(255, 220, 150, alpha);
            strokeWeight(1.25);
            line(0, groundY, width, groundY);

            noStroke();
            fill(255, 190, 90, alpha * 0.35);
            let eatingZoneHeight = player.h * PLAYER_EATING_ZONE_HEIGHT_FACTOR;
            rect(player.x, player.y, player.w, eatingZoneHeight, 4);

            drawShadowedText("FEEDING MAW", player.x + player.w / 2, player.y - 6, 10, [255, 230, 170, alpha], CENTER, BOTTOM, BOLD);
            drawShadowedText("STONE FLOOR", 6, groundY - 4, 10, [255, 230, 170, alpha], LEFT, BOTTOM, BOLD);
            pop();
        }
    }

    // 2. Keyboard reminder
    if (gameState.playTime < 20) {
        let alpha = map(gameState.playTime, 15, 20, 150, 0, true);
        if (gameState.playTime < 15) alpha = 150;

        if (alpha > 0) {
            push();
            let controlLines = [
                "Controls",
                "<- -> : Move",
                "^ : Jump"
            ];

            if (playerState.hasWizardStaff) {
                controlLines.push("Space : Shadow Bolt");
            }
            if (playerState.level >= PLAYER_LEVEL_FOR_TENTACLES) {
                controlLines.push("Z : Tentacles");
            }
            if (playerState.hasMagnet) {
                controlLines.push("X : Magnet");
            }

            textFont(UI_THEME.fontPrimary);
            textSize(12);
            textStyle(NORMAL);
            let longestLineWidth = 0;
            for (const line of controlLines) {
                longestLineWidth = Math.max(longestLineWidth, textWidth(line));
            }

            const panelPadding = 10;
            const lineHeight = 15;
            const panelWidth = longestLineWidth + (panelPadding * 2);
            const panelHeight = (controlLines.length * lineHeight) + (panelPadding * 2);
            const panelX = 10;
            const panelY = Math.max(10, height - panelHeight - 10 - VISUAL_GROUND_HEIGHT - 8);

            drawHudPanel(
                panelX,
                panelY,
                panelWidth,
                panelHeight,
                8,
                [15, 10, 8, Math.round(alpha * 0.95)],
                [UI_THEME.panelBorder[0], UI_THEME.panelBorder[1], UI_THEME.panelBorder[2], Math.round(alpha + 50)]
            );

            for (let i = 0; i < controlLines.length; i++) {
                const line = controlLines[i];
                const lineColor = i === 0
                    ? [UI_THEME.textAccent[0], UI_THEME.textAccent[1], UI_THEME.textAccent[2], alpha]
                    : [UI_THEME.textPrimary[0], UI_THEME.textPrimary[1], UI_THEME.textPrimary[2], alpha];
                const lineStyle = i === 0 ? BOLD : NORMAL;
                drawShadowedText(line, panelX + panelPadding, panelY + panelPadding + (i * lineHeight), 12, lineColor, LEFT, TOP, lineStyle);
            }
            pop();
        }
    }
}

function drawUI() {
    push();
    const dropSpeedPercent = Math.round((gameState.dropSpeedScale / INITIAL_DROP_SPEED_SCALE) * 100);
    const spawnRatePercent = Math.round((BASE_OBJECT_SPAWN_RATE_FRAMES / gameState.objectSpawnRate) * 100);

    const measureHudLine = (textValue, size, style = NORMAL) => {
        textFont(UI_THEME.fontPrimary);
        textSize(size);
        textStyle(style);
        return textWidth(textValue);
    };

    const leftLines = [
        { text: "Dungeon Status", size: 18, style: BOLD, color: UI_THEME.textAccent, step: 24 },
        { text: `Floor ${gameState.dungeonFloor} | Zone ${gameState.dungeonZone}`, size: 16, style: BOLD, color: UI_THEME.textPrimary, step: 23 },
        { text: `Score ${formatHudNumber(gameState.score)}`, size: 22, style: BOLD, color: UI_THEME.textPrimary, step: 31 },
        { text: `Drop Speed ${dropSpeedPercent}%`, size: 14, style: NORMAL, color: UI_THEME.textMuted, step: 20 },
        { text: `Spawn Rate ${spawnRatePercent}%`, size: 14, style: NORMAL, color: UI_THEME.textMuted, step: 21 },
        { text: "Esc : Help", size: 12, style: BOLD, color: UI_THEME.textAccent, step: 14 }
    ];
    const leftPanelX = 8;
    const leftPanelY = 8;
    const leftPadding = 11;
    const leftTopPadding = 10;
    const leftBottomPadding = 10;
    let leftMaxTextWidth = 0;
    for (const line of leftLines) {
        leftMaxTextWidth = Math.max(leftMaxTextWidth, measureHudLine(line.text, line.size, line.style));
    }
    let leftPanelW = constrain(leftMaxTextWidth + (leftPadding * 2) + 12, 150, width * 0.42);
    const leftContentHeight = leftLines.reduce((sum, line) => sum + line.step, 0);
    const leftPanelH = leftTopPadding + leftContentHeight + leftBottomPadding;

    const hasStaff = !!playerState.hasWizardStaff;
    const hasTentacles = playerState.level >= PLAYER_LEVEL_FOR_TENTACLES;
    const hasMagnet = !!playerState.hasMagnet;
    const iconCount = (hasStaff ? 1 : 0) + (hasTentacles ? 1 : 0) + (hasMagnet ? 1 : 0);
    const showTentacleCooldown = hasTentacles && playerState.tentaclesCooldown > 0;
    const showMagnetCooldown = hasMagnet && playerState.magnetismCooldown > 0;
    const cooldownRows = (showTentacleCooldown ? 1 : 0) + (showMagnetCooldown ? 1 : 0);
    const iconHeightTarget = 23;
    const iconSpacing = 8;
    const heartSize = 18;
    const heartSpacing = 5;
    const heartStep = heartSize + heartSpacing;
    const rightPadding = 11;

    const rightTitleText = "Mimic Growth";
    const rightXpText = `XP ${formatHudNumber(playerState.experience)} / ${formatHudNumber(playerState.experienceCap)}`;
    const rightLevelText = `Level ${playerState.level}`;
    const rightSpeedText = `Speed ${playerState.speedPercentage}%`;
    const rightSizeText = `Size ${playerState.sizePercentage}%`;
    const rightTextWidth = Math.max(
        measureHudLine(rightTitleText, 18, BOLD),
        measureHudLine(rightXpText, 17, BOLD),
        measureHudLine(rightLevelText, 16, BOLD),
        measureHudLine(rightSpeedText, 14, NORMAL),
        measureHudLine(rightSizeText, 14, NORMAL)
    );
    const desiredHeartCols = Math.max(3, Math.min(playerState.lives, 12));
    const desiredHeartSpan = heartSize + ((desiredHeartCols - 1) * heartStep);
    const iconSpan = iconCount > 0 ? (iconCount * iconHeightTarget) + ((iconCount - 1) * iconSpacing) : 0;
    const cooldownSpan = cooldownRows > 0 ? 82 : 0;
    let rightPanelW = constrain(
        Math.max(rightTextWidth, desiredHeartSpan, iconSpan, cooldownSpan) + (rightPadding * 2) + 12,
        160,
        width * 0.46
    );

    const minPanelWidth = 140;
    const combinedWidth = leftPanelW + rightPanelW + 24;
    if (combinedWidth > width) {
        let overflow = combinedWidth - width;
        const leftReducible = Math.max(0, leftPanelW - minPanelWidth);
        const rightReducible = Math.max(0, rightPanelW - minPanelWidth);
        const totalReducible = leftReducible + rightReducible;
        if (totalReducible > 0) {
            const leftReduction = Math.min(leftReducible, overflow * (leftReducible / totalReducible));
            leftPanelW -= leftReduction;
            overflow -= leftReduction;
            const rightReduction = Math.min(rightReducible, overflow);
            rightPanelW -= rightReduction;
        }
    }

    const rightPanelX = width - rightPanelW - 8;
    const rightPanelY = 8;
    const heartsPerRow = max(1, Math.floor((rightPanelW - (rightPadding * 2) + heartSpacing) / heartStep));
    const heartRowsUsed = playerState.lives > 0 ? Math.ceil(playerState.lives / heartsPerRow) : 1;
    const iconBlockHeight = iconCount > 0 ? iconHeightTarget : 0;
    const statsBlockHeight = 20 + 18 + 16 + 14;
    const statsToIconsGap = iconCount > 0 ? 12 : 0;
    const cooldownBlockHeight = cooldownRows > 0 ? (4 + (cooldownRows * 9) + ((cooldownRows - 1) * 5)) : 0;
    const rightPanelH = 8 + 22 + (heartRowsUsed * heartStep) + 3 + statsBlockHeight + statsToIconsGap + iconBlockHeight + cooldownBlockHeight + 8;

    drawHudPanel(leftPanelX, leftPanelY, leftPanelW, leftPanelH);
    let leftY = leftPanelY + leftTopPadding;
    for (const line of leftLines) {
        drawShadowedText(line.text, leftPanelX + leftPadding, leftY, line.size, line.color, LEFT, TOP, line.style);
        leftY += line.step;
    }

    drawHudPanel(rightPanelX, rightPanelY, rightPanelW, rightPanelH);
    const rightTextX = rightPanelX + rightPanelW - rightPadding;
    drawShadowedText(rightTitleText, rightTextX, rightPanelY + 8, 18, UI_THEME.textAccent, RIGHT, TOP, BOLD);

    const heartY = rightPanelY + 8 + 22;
    for (let i = 0; i < playerState.lives; i++) {
        const row = Math.floor(i / heartsPerRow);
        const col = i % heartsPerRow;
        const currentHeartX = rightPanelX + rightPanelW - rightPadding - heartSize - (col * heartStep);
        const currentHeartY = heartY + (row * heartStep);
        drawHeart(currentHeartX, currentHeartY, heartSize);
    }

    const statsStartY = heartY + (heartRowsUsed * heartStep) + 3;
    drawShadowedText(rightXpText, rightTextX, statsStartY, 17, UI_THEME.textPrimary, RIGHT, TOP, BOLD);
    const playerLevelY = statsStartY + 20;
    drawShadowedText(rightLevelText, rightTextX, playerLevelY, 16, UI_THEME.textPrimary, RIGHT, TOP, BOLD);
    const speedY = playerLevelY + 18;
    drawShadowedText(rightSpeedText, rightTextX, speedY, 14, UI_THEME.textMuted, RIGHT, TOP, NORMAL);
    const sizeY = speedY + 16;
    drawShadowedText(rightSizeText, rightTextX, sizeY, 14, UI_THEME.textMuted, RIGHT, TOP, NORMAL);

    const iconY = sizeY + (iconCount > 0 ? 12 : 0);
    const iconRightEdge = rightPanelX + rightPanelW - rightPadding;
    let currentIconX = iconRightEdge;
    const staffImg = objectImages[OBJ_WIZARD_STAFF];
    if (hasStaff) {
        let staffIconWidth = 0;
        let staffIconHeight = 0;
        if (staffImg && staffImg.width) {
            const scale = iconHeightTarget / staffImg.height;
            staffIconWidth = staffImg.width * scale;
            staffIconHeight = iconHeightTarget;
            const staffIconX = currentIconX - staffIconWidth;
            image(staffImg, staffIconX, iconY, staffIconWidth, staffIconHeight);
        } else {
            staffIconWidth = 15;
            staffIconHeight = iconHeightTarget;
            const staffIconX = currentIconX - staffIconWidth;
            fill(139, 69, 19);
            noStroke();
            rect(staffIconX + 10, iconY + 5, 5, staffIconHeight * 0.7);
            fill(255, 0, 0);
            ellipse(staffIconX + 12.5, iconY + 5, 7.5, 7.5);
        }
        currentIconX -= (staffIconWidth + iconSpacing);
    }
    if (hasTentacles) {
        let chainIconWidth;
        if (chainImage && chainImage.width) {
            const scale = iconHeightTarget / chainImage.height;
            chainIconWidth = chainImage.width * scale;
            const chainIconHeight = iconHeightTarget;
            const chainIconX = currentIconX - chainIconWidth;
            image(chainImage, chainIconX, iconY, chainIconWidth, chainIconHeight);
        } else {
            chainIconWidth = 15;
            const chainIconX = currentIconX - chainIconWidth;
            fill(150);
            noStroke();
            rect(chainIconX, iconY, chainIconWidth, iconHeightTarget, 3);
            fill(50);
            ellipse(chainIconX + chainIconWidth / 2, iconY + iconHeightTarget * 0.3, chainIconWidth * 0.6, chainIconWidth * 0.3);
            ellipse(chainIconX + chainIconWidth / 2, iconY + iconHeightTarget * 0.7, chainIconWidth * 0.6, chainIconWidth * 0.3);
        }
        currentIconX -= (chainIconWidth + iconSpacing);
    }
    if (hasMagnet) {
        let magnetIconWidth;
        if (magnetFrames[0] && magnetFrames[0].width) {
            const scale = iconHeightTarget / magnetFrames[0].height;
            magnetIconWidth = magnetFrames[0].width * scale;
            const magnetIconHeight = iconHeightTarget;
            const magnetIconX = currentIconX - magnetIconWidth;
            image(magnetFrames[0], magnetIconX, iconY, magnetIconWidth, magnetIconHeight);
        } else {
            magnetIconWidth = 15;
            const magnetIconX = currentIconX - magnetIconWidth;
            fill(0, 100, 255);
            noStroke();
            rect(magnetIconX, iconY, magnetIconWidth, iconHeightTarget, 3);
            fill(200);
            ellipse(magnetIconX + magnetIconWidth / 2, iconY + iconHeightTarget / 2, magnetIconWidth * 0.6, magnetIconWidth * 0.6);
        }
    }

    let cooldownY = iconY + iconBlockHeight + (cooldownRows > 0 ? 4 : 0);
    if (showTentacleCooldown) {
        const barWidth = 66;
        const barHeight = 9;
        const barX = iconRightEdge - barWidth;
        const progress = playerState.tentaclesCooldown / TENTACLE_COOLDOWN_FRAMES;
        noStroke();
        fill(65, 56, 45, 220);
        rect(barX, cooldownY, barWidth, barHeight, 3);
        fill(110, 240, 150);
        rect(barX, cooldownY, barWidth * progress, barHeight, 3);
        drawShadowedText("Z", barX - 4, cooldownY + (barHeight / 2), 11, UI_THEME.textAccent, RIGHT, CENTER, BOLD);
        cooldownY += barHeight + 5;
    }
    if (showMagnetCooldown) {
        const barWidth = 66;
        const barHeight = 9;
        const barX = iconRightEdge - barWidth;
        const progress = playerState.magnetismCooldown / MAGNETISM_COOLDOWN_FRAMES;
        noStroke();
        fill(65, 56, 45, 220);
        rect(barX, cooldownY, barWidth, barHeight, 3);
        fill(90, 165, 255);
        rect(barX, cooldownY, barWidth * progress, barHeight, 3);
        drawShadowedText("X", barX - 4, cooldownY + (barHeight / 2), 11, UI_THEME.textAccent, RIGHT, CENTER, BOLD);
    }

    pop();
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
    let storedScores = null;
    try {
        storedScores = localStorage.getItem('mimicFeederHighScores');
    } catch (error) {
        console.warn('Failed to read high scores from localStorage.', error);
        highScores = [];
        return;
    }

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
    try {
        const storedName = localStorage.getItem('mimicFeederLastUsedName');
        if (storedName) {
            gameState.lastUsedName = storedName;
        }
    } catch (error) {
        console.warn('Failed to read last used name from localStorage.', error);
        // Keep default gameState.lastUsedName ("Player" after initializeStates).
    }
    // gameState.currentNameInput will be set in sketch.js setup after this call.
}

function saveHighScores() {
    highScores.sort((a, b) => b.score - a.score);
    highScores = highScores.slice(0, HIGH_SCORE_COUNT);
    try {
        localStorage.setItem('mimicFeederHighScores', JSON.stringify(highScores));
    } catch (error) {
        // Still keep the in-memory list for this session (game-over screen).
        console.warn('Failed to save high scores to localStorage.', error);
    }
}

function saveLastUsedName(name) {
    gameState.lastUsedName = name; // Update state even if storage is unavailable
    try {
        localStorage.setItem('mimicFeederLastUsedName', name);
    } catch (error) {
        console.warn('Failed to save last used name to localStorage.', error);
    }
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
