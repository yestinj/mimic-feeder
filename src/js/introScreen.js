/**
 * @fileoverview Intro screen functionality for Mimic Feeder.
 * Contains functions for rendering and handling the game's intro screen.
 * @author Yestin Johnson
 */

/**
 * Draws the intro screen with game description and controls
 * @function
 */
function drawIntroScreen() {
    // Draw semi-transparent overlay for the entire screen
    fill(0, 0, 0, 200);
    rect(0, 0, width, height);

    // Calculate content height dynamically
    let contentHeight = calculateIntroContentHeight();

    // Overlay Size Calculation
    let overlayWidth = width * 0.50;
    // Add padding to the content height
    let overlayHeight = contentHeight + 60; // 30px padding top and bottom

    if (overlayWidth < 500) { // Min width
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

    // 1. Heading: "Mimic Feeder"
    fill(0);
    textSize(28);
    textAlign(LEFT, TOP);
    textStyle(BOLD);
    text(`Mimic Feeder`, leftMargin, currentY);
    currentY += 40; // Space after heading

    // 2. Description
    textSize(14);
    textStyle(NORMAL);
    let descriptionTextLeading = 18;
    textLeading(descriptionTextLeading);
    // In p5.js 1.9.4, WORD constant might need to be accessed differently
    // Using string literal 'word' as a fallback
    try {
        textWrap(WORD);
    } catch (e) {
        textWrap('word');
    }
    let description = "Dungeon mimics are greedy, hungry creatures. " +
        "They need to eat, anything edible, and love collecting shinies.\n\n" +
        "Control the dungeon mimic to collect food and shinies, and avoid or destroy bombs.\n\n" +
        "Letting perfectly good food (creatures) perish will cause damage.\n\n" +
        "Eat the food, collect the shinies and powerups, and avoid the bombs!";
    text(description, leftMargin, currentY, textBlockWidth);

    // Estimate description height for positioning elements below it
    let explicitNewlinesInDesc = (description.match(/\n\n/g) || []).length * 2;
    let approxLinesInDesc = 8 + explicitNewlinesInDesc; // Base 8 lines + explicit breaks
    currentY += approxLinesInDesc * (16 * 0.8); // Adjusted factor for tighter lines
    //currentY += 15; // Padding after description

    // 3. "Game Controls" Heading
    textSize(16);
    textStyle(BOLD);
    fill(0); // Black for heading
    textAlign(LEFT, TOP);
    text("Game Controls:", leftMargin, currentY);
    currentY += 26; // Space after "Game Controls" heading

    // 4. Controls List
    textSize(12);
    textStyle(NORMAL);
    text("Move:  Left / Right Arrows", leftMargin, currentY);
    currentY += 20;
    text("Jump / Double Jump:  Up Arrow", leftMargin, currentY);

    // 5. Start Instruction & Bottom Corner Texts
    let bottomPadding = 10;
    let authorAndVersionTextHeight = 12 + 5; // textSize for author/version + small gap

    textSize(14);
    textStyle(ITALIC);
    fill(0);
    textAlign(CENTER, BOTTOM);
    text(
        "Press Enter to start",
        overlayX + overlayWidth / 2,
        overlayY + overlayHeight - bottomPadding - authorAndVersionTextHeight // Position above bottom texts
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

/**
 * Calculates the required height for the intro screen content
 * Dynamically determines the height needed based on text content and screen size
 * @function
 * @returns {number} The calculated height in pixels
 */
function calculateIntroContentHeight() {
    // Get the width for text wrapping calculations
    let overlayWidth = width * 0.50;
    if (overlayWidth < 500) {
        overlayWidth = 550;
    }
    let textBlockWidth = overlayWidth - (2 * 30); // Max width for text (with 30px margins)

    let totalHeight = 0;

    // 1. Heading: "Mimic Feeder" (28px + 40px spacing)
    totalHeight += 28 + 40;

    // 2. Description text
    let description = "Dungeon mimics are greedy, hungry creatures. " +
        "They need to eat, anything edible, and love collecting shinies.\n\n" +
        "Control the dungeon mimic to collect food and shinies, and avoid or destroy bombs.\n\n" +
        "Letting perfectly good food (creatures) perish will cause damage.\n\n" +
        "Eat the food, collect the shinies and powerups, and avoid the bombs!";

    // Calculate description height based on text wrapping
    let descTextSize = 14;
    let descLineHeight = 18;

    // Count explicit line breaks
    let explicitNewlinesInDesc = (description.match(/\n\n/g) || []).length * 2;

    // Estimate wrapped lines based on text width and available space
    let textWidth = textBlockWidth;
    let avgCharWidth = descTextSize * 0.6; // Approximate average character width
    let charsPerLine = Math.floor(textWidth / avgCharWidth);
    let textLines = Math.ceil(description.length / charsPerLine);

    // Add explicit line breaks
    textLines += explicitNewlinesInDesc;

    // Calculate description height
    let descriptionHeight = textLines * descLineHeight;
    totalHeight += descriptionHeight;

    // 3. "Game Controls" Heading (16px + 26px spacing)
    totalHeight += 16 + 26;

    // 4. Controls List (2 items, 20px each)
    totalHeight += 20 * 2;

    // 5. Start Instruction & Bottom Corner Texts
    // Add space for "Press Enter to start" and version/author info
    totalHeight += 40;

    totalHeight -= 50;

    return totalHeight;
}

/**
 * Handles keyboard input on the intro screen
 * Processes key presses when the intro screen is active
 * @function
 * @returns {boolean} True if the key press was handled, false otherwise
 */
function handleIntroScreenKeyPressed() {
    if (gameState.showIntroScreen) {
        if (keyCode === ENTER) {
            startAudioIfNeeded();
            gameState.showIntroScreen = false;
            gameState.gameStarted = false; // Ensure startTime is reset in draw()
            return true;
        }
        return true;
    }
    return false;
}
