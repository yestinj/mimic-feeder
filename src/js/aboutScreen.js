function drawAboutScreen() {
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

    // 1. Heading: "About"
    fill(0);
    textSize(28);
    textAlign(LEFT, TOP);
    textStyle(BOLD);
    text(`About`, leftMargin, currentY);
    currentY += 40; // Space after heading

    // 2. Author and Game Status
    textSize(16);
    textStyle(NORMAL);
    textLeading(22);
    // In p5.js 1.9.4, WORD constant might need to be accessed differently
    // Using string literal 'word' as a fallback
    try {
        textWrap(WORD);
    } catch (e) {
        textWrap('word');
    }
    let aboutText = "This game was created by Yestin. It's currently in alpha, and is just a fun side project.";
    text(aboutText, leftMargin, currentY, textBlockWidth);
    currentY += 100; // Space after about text

    // 3. Special Thanks Section
    textSize(18);
    textStyle(BOLD);
    textAlign(CENTER, TOP);
    text("Special Thanks", overlayX + overlayWidth / 2, currentY);
    currentY += 30; // Space after special thanks heading

    // 4. List of people
    textSize(16);
    textStyle(NORMAL);
    textAlign(CENTER, TOP);
    text("Rob M (alpha tester)", overlayX + overlayWidth / 2, currentY);
    currentY += 20;
    text("hypn (alpha tester)", overlayX + overlayWidth / 2, currentY);

    // Navigation instructions at bottom
    let bottomPadding = 10;
    let authorAndVersionTextHeight = 12 + 5;

    // Navigation instructions
    textSize(14);
    textStyle(ITALIC);
    fill(0);
    textAlign(CENTER, BOTTOM);
    text(
        "Press Left Arrow to return to Object Info screen",
        overlayX + overlayWidth / 2,
        overlayY + overlayHeight - bottomPadding - authorAndVersionTextHeight - 40
    );

    text(
        "Press Right Arrow to return to Help screen",
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

function handleAboutScreenKeyPressed() {
    if (gameState.showAboutScreen) {
        if (keyCode === ESCAPE) {
            gameState.showAboutScreen = false;
            return true;
        }
        if (keyCode === LEFT_ARROW) {
            gameState.showAboutScreen = false;
            gameState.showObjectInfoScreen = true;
            return true;
        }
        if (keyCode === RIGHT_ARROW) {
            gameState.showAboutScreen = false;
            gameState.showHelpScreen = true;
            return true;
        }
        return true;
    }
    return false;
}
