function drawObjectInfoScreen() {
    // Draw semi-transparent overlay for the entire screen
    fill(0, 0, 0, 200);
    rect(0, 0, width, height);

    if (!isOverlayViewportSupported()) {
        drawOverlayViewportWarning("Object Info", [
            "Press Left Arrow to return to Help",
            "Press Right Arrow to view About",
            "Press Escape to close"
        ]);
        return;
    }

    const overlayBounds = getResponsiveOverlayBounds(0.76, 0.9, 640, 540, 940, 760);
    const objectDescText = "Consumables are creatures you can eat for points. " +
        "Shinies are valuable objects that give high points. " +
        "Hazards are dangerous objects that can damage you. " +
        "Power-ups grant special abilities.";

    const computeLayoutMetrics = (layoutScale, resolvedOverlayWidth, resolvedOverlayHeight) => {
        const scalePx = (value) => value * layoutScale;
        const topPadding = scalePx(24);
        const sidePadding = scalePx(30);
        const footerReserve = scalePx(108);
        const titleHeight = scalePx(36);
        const sectionHeadingSize = scalePx(16);
        const sectionHeadingBlockHeight = scalePx(24);
        const rowTextSize = scalePx(12);
        const rowHeight = scalePx(30);
        const rowGap = scalePx(3);
        const sectionGap = scalePx(8);
        const blockGap = scalePx(12);
        const contentSafetyGap = scalePx(8);
        const descHeadingSize = scalePx(16);
        const descTextSize = scalePx(14);
        const descLineHeight = scalePx(16);
        const textBlockWidth = resolvedOverlayWidth - (2 * sidePadding);
        const availableHeight = resolvedOverlayHeight - topPadding - footerReserve;

        textStyle(NORMAL);
        textSize(descTextSize);
        const descHeight = measureWrappedTextHeight(objectDescText, textBlockWidth, descLineHeight);

        const requiredHeight =
            titleHeight +
            sectionHeadingBlockHeight + sectionGap + ((rowHeight * 4) + (rowGap * 3)) + blockGap +
            sectionHeadingBlockHeight + sectionGap + rowHeight + blockGap +
            sectionHeadingBlockHeight + sectionGap + rowHeight + blockGap +
            sectionHeadingBlockHeight + sectionGap + rowHeight + blockGap +
            sectionHeadingBlockHeight + sectionGap + descHeight +
            contentSafetyGap;

        return {
            topPadding,
            sidePadding,
            footerReserve,
            titleHeight,
            sectionHeadingSize,
            sectionHeadingBlockHeight,
            rowTextSize,
            rowHeight,
            rowGap,
            sectionGap,
            blockGap,
            contentSafetyGap,
            descHeadingSize,
            descTextSize,
            descLineHeight,
            textBlockWidth,
            availableHeight,
            requiredHeight
        };
    };

    const baseMetrics = computeLayoutMetrics(1, overlayBounds.overlayWidth, height);
    const targetOverlayHeight = constrain(
        baseMetrics.requiredHeight + baseMetrics.topPadding + baseMetrics.footerReserve + 8,
        Math.min(470, height - 24),
        Math.min(730, height - 24)
    );
    const targetOverlayBounds = {
        overlayWidth: overlayBounds.overlayWidth,
        overlayHeight: targetOverlayHeight,
        overlayX: (width - overlayBounds.overlayWidth) / 2,
        overlayY: (height - targetOverlayHeight) / 2
    };

    const layout = computeAdaptiveOverlayLayout(
        targetOverlayBounds,
        computeLayoutMetrics,
        { minScale: 0.82, maxIterations: 6, fitBias: 0.98 }
    );

    if (!layout) {
        drawOverlayViewportWarning("Object Info", [
            "Press Left Arrow to return to Help",
            "Press Right Arrow to view About",
            "Press Escape to close"
        ]);
        return;
    }
    ({ overlayWidth, overlayHeight, overlayX, overlayY } = layout);
    const { metrics, scalePx } = layout;

    // Draw the overlay background
    fill(160, 160, 160); // Darker grey
    noStroke();
    rect(overlayX, overlayY, overlayWidth, overlayHeight, 10);

    // Text Content
    let leftMargin = overlayX + metrics.sidePadding;
    let textBlockWidth = metrics.textBlockWidth; // Max width for most text
    let currentY = overlayY + metrics.topPadding;
    const contentWidth = textBlockWidth;
    const columnGap = scalePx(26);
    const colWidth = (contentWidth - columnGap) / 2;
    const col1X = leftMargin;
    const col2X = leftMargin + colWidth + columnGap;

    // 1. Heading: "Object Info"
    fill(0);
    textSize(scalePx(28));
    textAlign(LEFT, TOP);
    textStyle(BOLD);
    text(`Object Info`, leftMargin, currentY);
    currentY += metrics.titleHeight;

    // Define spacing and image size
    const imageSize = scalePx(24);
    const textGap = scalePx(12);
    const rowTextYOffset = scalePx(6);

    // Special sizes for different objects
    const humanImageSize = scalePx(28);
    const wraithImageSize = scalePx(28);
    const dragonImageSize = scalePx(32);
    const catImageSize = scalePx(18);

    // Function to draw object info with image
    function drawObjectInfo(x, y, columnWidth, objType, objName) {
        let objImage = objectImages[objType];
        let pointsText;

        if (objType !== OBJ_SMALL_BOMB) {
            pointsText = objName + ": " + objectProperties[objType].xp + " points";
        } else {
            pointsText = objName;
        }

        // Determine which image size to use
        let currentImageSize = imageSize;
        if (objType === OBJ_HUMAN) {
            currentImageSize = humanImageSize;
        } else if (objType === OBJ_WRAITH) {
            currentImageSize = wraithImageSize;
        } else if (objType === OBJ_DRAGON) {
            currentImageSize = dragonImageSize;
        } else if (objType === OBJ_CAT) {
            currentImageSize = catImageSize;
        }

        // Draw image first, then text
        if (objImage && objImage.width) {
            image(objImage, x, y + (metrics.rowHeight - currentImageSize) / 2, currentImageSize, currentImageSize);
        }

        const textX = x + currentImageSize + textGap;
        text(pointsText, textX, y + rowTextYOffset, columnWidth - (textX - x), metrics.rowHeight - rowTextYOffset);
    }

    // 2. Consumables Section
    textSize(metrics.sectionHeadingSize);
    textStyle(BOLD);
    fill(0); // Black for heading
    textAlign(LEFT, TOP);
    text("Consumables:", leftMargin, currentY);
    currentY += metrics.sectionHeadingBlockHeight;
    currentY += metrics.sectionGap;

    // Points List with Images for Consumables
    textSize(metrics.rowTextSize);
    textStyle(NORMAL);
    textAlign(LEFT, TOP);

    // Draw humanoid objects in alphabetical order
    drawObjectInfo(col1X, currentY, colWidth, OBJ_CAT, "Cat");
    drawObjectInfo(col2X, currentY, colWidth, OBJ_DRAGON, "Dragon");
    currentY += metrics.rowHeight + metrics.rowGap;

    drawObjectInfo(col1X, currentY, colWidth, OBJ_DWARF, "Dwarf");
    drawObjectInfo(col2X, currentY, colWidth, OBJ_ELF, "Elf");
    currentY += metrics.rowHeight + metrics.rowGap;

    drawObjectInfo(col1X, currentY, colWidth, OBJ_GOBLIN, "Goblin");
    drawObjectInfo(col2X, currentY, colWidth, OBJ_HUMAN, "Human");
    currentY += metrics.rowHeight + metrics.rowGap;

    drawObjectInfo(col1X, currentY, colWidth, OBJ_WRAITH, "Wraith");
    currentY += metrics.rowHeight;
    currentY += metrics.blockGap;

    // 3. Shinies Section
    textSize(metrics.sectionHeadingSize);
    textStyle(BOLD);
    fill(0);
    textAlign(LEFT, TOP);
    text("Shinies:", leftMargin, currentY);
    currentY += metrics.sectionHeadingBlockHeight;
    currentY += metrics.sectionGap;

    // Points List with Images for Shinies
    textSize(metrics.rowTextSize);
    textStyle(NORMAL);
    textAlign(LEFT, TOP);

    // Draw non-humanoid edible objects with points
    drawObjectInfo(col1X, currentY, colWidth, OBJ_CROWN, "Crown");
    drawObjectInfo(col2X, currentY, colWidth, OBJ_DIAMOND, "Diamond");
    currentY += metrics.rowHeight;
    currentY += metrics.blockGap;

    // 4. Hazards Section
    textSize(metrics.sectionHeadingSize);
    textStyle(BOLD);
    fill(0);
    textAlign(LEFT, TOP);
    text("Hazards:", leftMargin, currentY);
    currentY += metrics.sectionHeadingBlockHeight;
    currentY += metrics.sectionGap;

    // Points List with Images for Hazards
    textSize(metrics.rowTextSize);
    textStyle(NORMAL);
    textAlign(LEFT, TOP);

    // Draw hazardous objects
    drawObjectInfo(col1X, currentY, colWidth, OBJ_SMALL_BOMB, "Bomb");

    // Add Fireball
    let fireballText = "Fireball";

    // Use animated fireball
    let fireballFrameIndex = floor((frameCount % (FIREBALL_TOTAL_FRAMES * FIREBALL_FRAME_DURATION)) / FIREBALL_FRAME_DURATION);
    if (fireballFrames && fireballFrames.length > 0 && fireballFrames[fireballFrameIndex]) {
        push();
        translate(col2X + imageSize / 2, currentY + metrics.rowHeight / 2);
        // Rotate 90 degrees clockwise (PI/2 radians) to match game display
        rotate(PI / 2);
        image(fireballFrames[fireballFrameIndex], -imageSize / 2, -imageSize / 2, imageSize, imageSize);
        pop();
    }

    // Display text after image
    text(fireballText, col2X + imageSize + textGap, currentY + rowTextYOffset, colWidth - imageSize - textGap, metrics.rowHeight);

    currentY += metrics.rowHeight;
    currentY += metrics.blockGap;

    // 5. Power-ups Section
    textSize(metrics.sectionHeadingSize);
    textStyle(BOLD);
    fill(0);
    textAlign(LEFT, TOP);
    text("Power-ups:", leftMargin, currentY);
    currentY += metrics.sectionHeadingBlockHeight;
    currentY += metrics.sectionGap;

    // Points List with Images for Power-ups
    textSize(metrics.rowTextSize);
    textStyle(NORMAL);
    textAlign(LEFT, TOP);

    // Wizard Staff
    let staffText = "Wizard Staff - Shadow Bolt";
    if (objectImages[OBJ_WIZARD_STAFF] && objectImages[OBJ_WIZARD_STAFF].width) {
        image(objectImages[OBJ_WIZARD_STAFF], col1X, currentY + (metrics.rowHeight - imageSize) / 2, imageSize, imageSize);
    }
    text(staffText, col1X + imageSize + textGap, currentY + rowTextYOffset, colWidth - imageSize - textGap, metrics.rowHeight);

    // Magnet
    let magnetText = "Magnet - strong pull (snapshot; bombs too)";
    if (magnetFrames[0] && magnetFrames[0].width) {
        image(magnetFrames[0], col2X, currentY + (metrics.rowHeight - imageSize) / 2, imageSize, imageSize);
    } else {
        fill(0, 100, 255);
        noStroke();
        ellipse(col2X + imageSize / 2, currentY + metrics.rowHeight / 2, imageSize * 0.6, imageSize * 0.6);
    }
    fill(0);
    text(magnetText, col2X + imageSize + textGap, currentY + rowTextYOffset, colWidth - imageSize - textGap, metrics.rowHeight);

    currentY += metrics.rowHeight;
    currentY += metrics.blockGap;

    // 6. Object Descriptions
    textSize(metrics.descHeadingSize);
    textStyle(BOLD);
    fill(0);
    textAlign(LEFT, TOP);
    text("Object Descriptions:", leftMargin, currentY);
    currentY += metrics.sectionHeadingBlockHeight;
    currentY += metrics.sectionGap;

    // Object description body
    textSize(metrics.descTextSize);
    textStyle(NORMAL);
    currentY += drawWrappedTextBlock(objectDescText, leftMargin, currentY, textBlockWidth, metrics.descLineHeight);

    // Navigation instructions at bottom
    let bottomPadding = scalePx(10);
    let authorAndVersionTextHeight = scalePx(12 + 5);
    const navBaseY = overlayY + overlayHeight - bottomPadding - authorAndVersionTextHeight;
    const navLineHeight = scalePx(18);

    // Navigation instructions
    textSize(scalePx(14));
    textStyle(ITALIC);
    fill(0);
    textAlign(CENTER, BOTTOM);
    text(
        "Press Left Arrow to return to Help screen",
        overlayX + overlayWidth / 2,
        navBaseY - (2 * navLineHeight)
    );

    text(
        "Press Right Arrow to view About screen",
        overlayX + overlayWidth / 2,
        navBaseY - navLineHeight
    );

    text(
        "Press Escape to close",
        overlayX + overlayWidth / 2,
        navBaseY
    );

    // Game Version (Bottom-Left)
    textSize(scalePx(12));
    textStyle(NORMAL);
    fill(50); // Dark grey
    textAlign(LEFT, BOTTOM);
    text(
        `v${GAME_VERSION}`,
        overlayX + bottomPadding,
        overlayY + overlayHeight - bottomPadding
    );

    // Author Name (Bottom-Right)
    textSize(scalePx(12));
    textStyle(NORMAL);
    fill(50);
    textAlign(RIGHT, BOTTOM);
    text(
        GAME_AUTHOR,
        overlayX + overlayWidth - bottomPadding,
        overlayY + overlayHeight - bottomPadding
    );

    textStyle(NORMAL);
    textAlign(LEFT, BASELINE); // Reset for other potential text drawing
}

function handleObjectInfoScreenKeyPressed() {
    if (gameState.showObjectInfoScreen) {
        if (keyCode === ESCAPE) {
            gameState.showObjectInfoScreen = false;
            gameState.showHelpScreen = false;
            return true;
        }
        if (keyCode === LEFT_ARROW) {
            gameState.showObjectInfoScreen = false;
            gameState.showHelpScreen = true;
            return true;
        }
        if (keyCode === RIGHT_ARROW) {
            gameState.showObjectInfoScreen = false;
            gameState.showAboutScreen = true;
            return true;
        }
        return true;
    }
    return false;
}
