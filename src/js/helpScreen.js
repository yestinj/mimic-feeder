function drawHelpScreen() {
    // Draw semi-transparent overlay for the entire screen
    fill(0, 0, 0, 200);
    rect(0, 0, width, height);

    // Calculate content height dynamically
    let contentHeight = calculateHelpContentHeight();

    // Overlay Size Calculation
    let overlayWidth = width * 0.6;
    // Add padding to the content height
    let overlayHeight = contentHeight + 50;

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
    let currentY = overlayY + 25;

    // 1. Heading: "Help"
    fill(0);
    textSize(28);
    textAlign(LEFT, TOP);
    textStyle(BOLD);
    text(`Help`, leftMargin, currentY);
    currentY += 35;

    // 2. How to Play
    textSize(16);
    textStyle(BOLD);
    fill(0); // Black for heading
    textAlign(LEFT, TOP);
    text("How to Play:", leftMargin, currentY);
    currentY += 25;

    // Game Controls
    textSize(14);
    textStyle(NORMAL);
    textLeading(16);
    // In p5.js 1.9.4, WORD constant might need to be accessed differently
    // Using string literal 'word' as a fallback
    try {
        textWrap(WORD);
    } catch (e) {
        textWrap('word');
    }
    let howToPlayText = "Control the dungeon mimic to collect food and shinies, and avoid or destroy bombs.\n" +
        "Letting perfectly good food (creatures) perish or getting hit by a dangerous object will cause damage.\n" +
        "Cats are special...";
    text(howToPlayText, leftMargin, currentY, textBlockWidth);
    currentY += 90;

    // 3. Game Controls
    textSize(16);
    textStyle(BOLD);
    fill(0); // Black for heading
    textAlign(LEFT, TOP);
    text("Game Controls:", leftMargin, currentY);
    currentY += 20;

    // Controls List
    textSize(12);
    textStyle(NORMAL);
    text("Move:  Left / Right Arrows", leftMargin, currentY);
    currentY += 18;
    text("Dash:  Double-tap Left / Right Arrows", leftMargin, currentY);
    currentY += 18;
    text("Jump / Double Jump:  Up Arrow", leftMargin, currentY);
    currentY += 18;
    text("Help Screen: Escape (Esc)", leftMargin, currentY);
    currentY += 18;
    text("Achievements: A key", leftMargin, currentY);
    currentY += 23;

    // 5. Abilities
    textSize(16);
    textStyle(BOLD);
    fill(0); // Black for heading
    textAlign(LEFT, TOP);
    text("Special Abilities:", leftMargin, currentY);
    currentY += 20;

    // Abilities Description
    textSize(14);
    textStyle(NORMAL);
    textLeading(16);
    // In p5.js 1.9.4, WORD constant might need to be accessed differently
    // Using string literal 'word' as a fallback
    try {
        textWrap(WORD);
    } catch (e) {
        textWrap('word');
    }

    let tentaclesText = "Tentacles (1 key): At Player level " + PLAYER_LEVEL_FOR_TENTACLES +
        ", you gain the ability to extend tentacles that can grab multiple objects at once. " +
        "This ability has a cooldown.";
    text(tentaclesText, leftMargin, currentY, textBlockWidth);
    currentY += 40;

    let shadowBoltText = "Shadow Bolt (spacebar): At Floor " + DUNGEON_FLOOR_FOR_STAFF_DROP +
        " Zone " + DUNGEON_ZONE_FOR_STAFF_DROP + ", a wizard staff may appear. Collecting it grants the ability to shoot shadow bolts " +
        "that can destroy objects at a distance.";
    text(shadowBoltText, leftMargin, currentY, textBlockWidth);
    currentY += 50;

    let magnetismText = "Magnetism (2 key): At Floor " + DUNGEON_FLOOR_FOR_MAGNET_DROP +
        " Zone " + DUNGEON_ZONE_FOR_MAGNET_DROP + ", a magnet may appear. Collecting it grants " +
        "the ability to attract non-humanoid objects towards the player. This ability has a cooldown.";
    text(magnetismText, leftMargin, currentY, textBlockWidth);
    currentY += 50;

    let dashText = "Dash: Double-tap the left or right arrow keys to quickly dash in that direction. " +
        "This ability has a cooldown of " + (DASH_COOLDOWN_FRAMES / 60) + " second(s).";
    text(dashText, leftMargin, currentY, textBlockWidth);

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

// Function to calculate the required height for the help screen content
function calculateHelpContentHeight() {
    // Get the width for text wrapping calculations
    let overlayWidth = width * 0.6;
    if (overlayWidth < 550) {
        overlayWidth = 550;
    }
    let textBlockWidth = overlayWidth - (2 * 30); // Max width for text (with 30px margins)

    let totalHeight = 0;

    // 1. Heading: "Help" (28px + 30px spacing)
    totalHeight += 28 + 30;

    // 2. "How to Play" heading (16px + 20px spacing)
    totalHeight += 16 + 20;

    // 3. How to Play text
    let howToPlayText = "Control the dungeon mimic to collect food and shinies, and avoid or destroy bombs.\n" +
        "Letting perfectly good food (creatures) perish or getting hit by a dangerous object will cause damage.\n" +
        "Cats are special...";

    // Calculate how to play text height
    let howToPlayTextSize = 14;
    let howToPlayLineHeight = 16;

    // Count explicit line breaks
    let explicitNewlinesInHowToPlay = (howToPlayText.match(/\n/g) || []).length;

    // Estimate wrapped lines based on text width and available space
    let avgCharWidth = howToPlayTextSize * 0.6; // Approximate average character width
    let charsPerLine = Math.floor(textBlockWidth / avgCharWidth);
    let howToPlayLines = Math.ceil(howToPlayText.length / charsPerLine);

    // Add explicit line breaks
    howToPlayLines += explicitNewlinesInHowToPlay;

    // Calculate how to play text height
    let howToPlayHeight = howToPlayLines * howToPlayLineHeight;
    totalHeight += howToPlayHeight + 5;

    // 4. "Game Controls" heading (16px + 20px spacing)
    totalHeight += 16 + 20;

    // 5. Controls List (5 items, 18px each)
    totalHeight += 18 * 5 + 5;

    // 6. "Special Abilities" heading (16px + 20px spacing)
    totalHeight += 16 + 20;

    // 7. Abilities descriptions (4 abilities)
    // Tentacles description
    let tentaclesText = "Tentacles (1 key): At Player level " + PLAYER_LEVEL_FOR_TENTACLES +
        ", you gain the ability to extend tentacles that can grab multiple objects at once. " +
        "This ability has a cooldown.";

    // Shadow Bolt description
    let shadowBoltText = "Shadow Bolt (spacebar): At Floor " + DUNGEON_FLOOR_FOR_STAFF_DROP +
        " Zone " + DUNGEON_ZONE_FOR_STAFF_DROP + ", a wizard staff may appear. Collecting it grants the ability to shoot shadow bolts " +
        "that can destroy objects at a distance.";

    // Magnetism description
    let magnetismText = "Magnetism (2 key): At Floor " + DUNGEON_FLOOR_FOR_MAGNET_DROP +
        " Zone " + DUNGEON_ZONE_FOR_MAGNET_DROP + ", a magnet may appear. Collecting it grants " +
        "the ability to attract non-humanoid objects towards the player. This ability has a cooldown.";

    // Dash description
    let dashText = "Dash: Double-tap the left or right arrow keys to quickly dash in that direction. " +
        "This ability has a cooldown of " + (DASH_COOLDOWN_FRAMES / 60) + " second(s).";

    // Calculate abilities text height
    let abilitiesTextSize = 14;
    let abilitiesLineHeight = 16;

    // Estimate lines for each ability description
    let tentaclesLines = Math.ceil(tentaclesText.length / charsPerLine) + 1;
    let shadowBoltLines = Math.ceil(shadowBoltText.length / charsPerLine) + 1;
    let magnetismLines = Math.ceil(magnetismText.length / charsPerLine) + 1;
    let dashLines = Math.ceil(dashText.length / charsPerLine) + 1;

    // Calculate abilities height
    let abilitiesHeight = (tentaclesLines + shadowBoltLines + magnetismLines + dashLines) * abilitiesLineHeight;
    totalHeight += abilitiesHeight + 10;

    // 8. Navigation instructions (3 lines, 18px each)
    totalHeight += 18 * 3 + 10;

    // 9. Version and author info
    totalHeight += 15;

    // somehow this is much too big, lets try this
    totalHeight -= 120;

    return totalHeight;
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
