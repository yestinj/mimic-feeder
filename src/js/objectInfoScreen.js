function drawObjectInfoScreen() {
    // Draw semi-transparent overlay for the entire screen
    fill(0, 0, 0, 200);
    rect(0, 0, width, height);

    // Overlay Size Calculation - same as helpScreen for consistency
    let originalOverlayHeightPercentage = 0.80;
    let reductionFactor = 0.85;
    let overlayWidth = width * 0.6;
    let overlayHeight = height * originalOverlayHeightPercentage * reductionFactor;

    if (overlayHeight < 580) {
        overlayHeight = 580;
    }
    if (overlayWidth < 550) {
        overlayWidth = 550;
    }
    let overlayX = (width - overlayWidth) / 2;
    let overlayY = (height - overlayHeight) / 2;

    // Draw the overlay background
    fill(160, 160, 160); // Darker grey
    noStroke();
    rect(overlayX, overlayY, overlayWidth, overlayHeight, 10);

    // Text Content
    let leftMargin = overlayX + 30;
    let textBlockWidth = overlayWidth - (2 * 30); // Max width for most text
    let currentY = overlayY + 30; // Initial Y padding from top of overlay

    // 1. Heading: "Object Info"
    fill(0);
    textSize(28);
    textAlign(LEFT, TOP);
    textStyle(BOLD);
    text(`Object Info`, leftMargin, currentY);
    currentY += 40; // Space after heading

    // Define spacing and image size
    let imageSize = 24;
    let rowHeight = 30; // Increased from 20 to accommodate images
    let col1X = leftMargin;
    let col2X = leftMargin + 250; // Further increased spacing between columns to prevent overlap
    let textWidth = 30; // Width for spacing after image

    // Special sizes for human and wraith
    let humanImageSize = 30; // Larger size for human
    let wraithImageSize = 30; // Larger size for wraith

    // Function to draw object info with image
    function drawObjectInfo(x, y, objType, objName) {
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
        }

        // Draw image first, then text
        if (objImage && objImage.width) {
            image(objImage, x, y - currentImageSize/2, currentImageSize, currentImageSize);
        }

        text(pointsText, x + currentImageSize + textWidth, y);
    }

    // 2. Consumables Section
    textSize(16);
    textStyle(BOLD);
    fill(0); // Black for heading
    textAlign(LEFT, TOP);
    text("Consumables:", leftMargin, currentY);
    currentY += 40; // Increased space after heading

    // Points List with Images for Consumables
    textSize(12);
    textStyle(NORMAL);

    // Draw humanoid objects in alphabetical order
    drawObjectInfo(col1X, currentY, OBJ_CAT, "Cat");
    drawObjectInfo(col2X, currentY, OBJ_DRAGON, "Dragon");
    currentY += rowHeight;

    drawObjectInfo(col1X, currentY, OBJ_DWARF, "Dwarf");
    drawObjectInfo(col2X, currentY, OBJ_ELF, "Elf");
    currentY += rowHeight;

    drawObjectInfo(col1X, currentY, OBJ_GOBLIN, "Goblin");
    drawObjectInfo(col2X, currentY, OBJ_HUMAN, "Human");
    currentY += rowHeight;

    drawObjectInfo(col1X, currentY, OBJ_WRAITH, "Wraith");
    currentY += rowHeight + 3; // Extra space after consumables section

    // 3. Shinies Section
    textSize(16);
    textStyle(BOLD);
    fill(0);
    textAlign(LEFT, TOP);
    text("Shinies:", leftMargin, currentY);
    currentY += 33; // Increased space after heading

    // Points List with Images for Shinies
    textSize(12);
    textStyle(NORMAL);

    // Draw non-humanoid edible objects with points
    drawObjectInfo(col1X, currentY, OBJ_CROWN, "Crown");
    drawObjectInfo(col2X, currentY, OBJ_DIAMOND, "Diamond");
    currentY += rowHeight + 3; // Extra space after shinies section

    // 4. Hazards Section
    textSize(16);
    textStyle(BOLD);
    fill(0);
    textAlign(LEFT, TOP);
    text("Hazards:", leftMargin, currentY);
    currentY += 32; // Increased space after heading

    // Points List with Images for Hazards
    textSize(12);
    textStyle(NORMAL);

    // Draw hazardous objects
    drawObjectInfo(col1X, currentY, OBJ_SMALL_BOMB, "Bomb");

    // Add Fireball
    let fireballText = "Fireball";

    // Use animated fireball
    let fireballFrameIndex = floor((frameCount % (FIREBALL_TOTAL_FRAMES * FIREBALL_FRAME_DURATION)) / FIREBALL_FRAME_DURATION);
    if (fireballFrames && fireballFrames.length > 0 && fireballFrames[fireballFrameIndex]) {
        push();
        translate(col2X + imageSize/2, currentY);
        // Rotate 90 degrees clockwise (PI/2 radians) to match game display
        rotate(PI / 2);
        image(fireballFrames[fireballFrameIndex], -imageSize/2, -imageSize/2, imageSize, imageSize);
        pop();
    }

    // Display text after image
    text(fireballText, col2X + imageSize + textWidth, currentY);

    currentY += rowHeight + 5; // Extra space after hazards section

    // 4. Power-ups Section
    textSize(16);
    textStyle(BOLD);
    fill(0);
    textAlign(LEFT, TOP);
    text("Power-ups:", leftMargin, currentY);
    currentY += 40; // Increased space after heading

    // Points List with Images for Power-ups
    textSize(12);
    textStyle(NORMAL);

    // Wizard Staff
    let staffText = "Wizard Staff - Shadow Bolt";
    if (objectImages[OBJ_WIZARD_STAFF] && objectImages[OBJ_WIZARD_STAFF].width) {
        image(objectImages[OBJ_WIZARD_STAFF], col1X, currentY - imageSize/2, imageSize, imageSize);
    }
    text(staffText, col1X + imageSize + textWidth, currentY);

    // Magnet
    let magnetText = "Magnet - Magnetism";
    if (magnetFrames[0] && magnetFrames[0].width) {
        image(magnetFrames[0], col2X, currentY - imageSize/2, imageSize, imageSize);
    } else {
        fill(0, 100, 255);
        noStroke();
        ellipse(col2X + imageSize/2, currentY, imageSize * 0.6, imageSize * 0.6);
    }
    text(magnetText, col2X + imageSize + textWidth, currentY);

    currentY += rowHeight + 15; // Extra space after power-ups section

    // 3. Object Descriptions (optional)
    textSize(16);
    textStyle(BOLD);
    fill(0);
    textAlign(LEFT, TOP);
    text("Object Descriptions:", leftMargin, currentY);
    currentY += 26;

    // Object descriptions
    textSize(14);
    textStyle(NORMAL);
    textLeading(18);
    // In p5.js 1.9.4, WORD constant might need to be accessed differently
    // Using string literal 'word' as a fallback
    try {
        textWrap(WORD);
    } catch (e) {
        textWrap('word');
    }

    let objectDescText = "Consumables are creatures you can eat for points. " +
        "Shinies are valuable objects that give high points. " +
        "Hazards are dangerous objects that can damage you. " +
        "Power-ups grant special abilities.";
    text(objectDescText, leftMargin, currentY, textBlockWidth);
    currentY += 80;

    // Navigation instructions at bottom
    let bottomPadding = 10;
    let authorAndVersionTextHeight = 12 + 5;

    // Navigation instructions
    textSize(14);
    textStyle(ITALIC);
    fill(0);
    textAlign(CENTER, BOTTOM);
    text(
        "Press Left Arrow to return to Help screen",
        overlayX + overlayWidth / 2,
        overlayY + overlayHeight - bottomPadding - authorAndVersionTextHeight - 40
    );

    text(
        "Press Right Arrow to view About screen",
        overlayX + overlayWidth / 2,
        overlayY + overlayHeight - bottomPadding - authorAndVersionTextHeight - 20
    );

    text(
        "Press Escape to close",
        overlayX + overlayWidth / 2,
        overlayY + overlayHeight - bottomPadding - authorAndVersionTextHeight
    );

    // Game Version (Bottom-Left)
    textSize(12);
    textStyle(NORMAL);
    fill(50); // Dark grey
    textAlign(LEFT, BOTTOM);
    text(
        `v${GAME_VERSION}`,
        overlayX + bottomPadding,
        overlayY + overlayHeight - bottomPadding
    );

    // Author Name (Bottom-Right)
    textSize(12);
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
