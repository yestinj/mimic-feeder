function drawHelpScreen() {
    // Draw semi-transparent overlay for the entire screen
    fill(0, 0, 0, 200);
    rect(0, 0, width, height);

    // Overlay Size Calculation
    let originalOverlayHeightPercentage = 0.80;
    let reductionFactor = 0.85; // Increased from 0.70 to make overlay larger
    let overlayWidth = width * 0.6;
    let overlayHeight = height * originalOverlayHeightPercentage * reductionFactor;

    if (overlayHeight < 580) { // Increased min height from 480 to 580 to fit all content
        overlayHeight = 580;
    }
    if (overlayWidth < 550) { // Min width
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

    // 1. Heading: "Help / About"
    fill(0);
    textSize(28);
    textAlign(LEFT, TOP);
    textStyle(BOLD);
    text(`Help`, leftMargin, currentY);
    currentY += 40; // Space after heading

    // 2. How to Play
    textSize(16);
    textStyle(BOLD);
    fill(0); // Black for heading
    textAlign(LEFT, TOP);
    text("How to Play:", leftMargin, currentY);
    currentY += 26; // Space after heading

    // Game Controls
    textSize(14);
    textStyle(NORMAL);
    textLeading(18);
    textWrap(WORD);
    let howToPlayText = "Control the dungeon mimic to collect food and shinies, and avoid or destroy bombs.\n" +
        "Letting perfectly good food (creatures) perish or getting hit by a dangerous object will cause damage.\n" +
        "Cats are special...";
    text(howToPlayText, leftMargin, currentY, textBlockWidth);
    currentY += 63; // Space after how to play

    // 3. Game Controls
    textSize(16);
    textStyle(BOLD);
    fill(0); // Black for heading
    textAlign(LEFT, TOP);
    text("Game Controls:", leftMargin, currentY);
    currentY += 26; // Space after heading

    // Controls List
    textSize(12);
    textStyle(NORMAL);
    text("Move:  Left / Right Arrows", leftMargin, currentY);
    currentY += 20;
    text("Jump / Double Jump:  Up Arrow", leftMargin, currentY);
    currentY += 20;
    text("Help Screen: Escape (Esc)", leftMargin, currentY);
    currentY += 30; // Space after controls

    // 5. Abilities
    textSize(16);
    textStyle(BOLD);
    fill(0); // Black for heading
    textAlign(LEFT, TOP);
    text("Special Abilities:", leftMargin, currentY);
    currentY += 26; // Space after heading

    // Abilities Description
    textSize(14);
    textStyle(NORMAL);
    textLeading(18);
    textWrap(WORD);

    let tentaclesText = "Tentacles (1 key): At Player level " + PLAYER_LEVEL_FOR_TENTACLES +
        ", you gain the ability to extend tentacles that can grab multiple objects at once. " +
        "This ability has a cooldown.";
    text(tentaclesText, leftMargin, currentY, textBlockWidth);
    currentY += 55;

    let shadowBoltText = "Shadow Bolt (spacebar): At Floor " + DUNGEON_FLOOR_FOR_STAFF_DROP +
        " Zone " + DUNGEON_ZONE_FOR_STAFF_DROP + ", a wizard staff may appear. Collecting it grants the ability to shoot shadow bolts " +
        "that can destroy objects at a distance.";
    text(shadowBoltText, leftMargin, currentY, textBlockWidth);
    currentY += 55;

    let magnetismText = "Magnetism (2 key): At Floor " + DUNGEON_FLOOR_FOR_MAGNET_DROP +
        " Zone " + DUNGEON_ZONE_FOR_MAGNET_DROP + ", a magnet may appear. Collecting it grants " +
        "the ability to attract non-humanoid objects towards the player. This ability has a cooldown.";
    text(magnetismText, leftMargin, currentY, textBlockWidth);

    // 6. Navigation Instructions
    let bottomPadding = 10;
    let authorAndVersionTextHeight = 12 + 5; // textSize for author/version + small gap

    textSize(14);
    textStyle(ITALIC);
    fill(0);
    textAlign(CENTER, BOTTOM);
    text(
        "Press Right Arrow to view Object Info",
        overlayX + overlayWidth / 2,
        overlayY + overlayHeight - bottomPadding - authorAndVersionTextHeight - 40
    );

    text(
        "Press Left Arrow to view About screen",
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

function handleHelpScreenKeyPressed() {
    if (gameState.showHelpScreen) {
        if (keyCode === ESCAPE) {
            gameState.showHelpScreen = false;
            return true;
        }
        if (keyCode === RIGHT_ARROW) {
            gameState.showHelpScreen = false;
            gameState.showObjectInfoScreen = true;
            return true;
        }
        if (keyCode === LEFT_ARROW) {
            gameState.showHelpScreen = false;
            gameState.showAboutScreen = true;
            return true;
        }
        return true;
    }
    return false;
}
