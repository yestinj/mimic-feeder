function drawAboutScreen() {
    // Draw semi-transparent overlay for the entire screen
    fill(0, 0, 0, 200);
    rect(0, 0, width, height);

    // Calculate content height dynamically
    let contentHeight = calculateAboutContentHeight();

    // Overlay Size Calculation
    let overlayWidth = width * 0.6;
    // Add padding to the content height
    let overlayHeight = contentHeight + 50; // Reduced from 60 to 50

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
    let currentY = overlayY + 25; // Reduced from 30 to 25

    // 1. Heading: "About"
    fill(0);
    textSize(28);
    textAlign(LEFT, TOP);
    textStyle(BOLD);
    text(`About`, leftMargin, currentY);
    currentY += 30; // Reduced from 40 to 30

    // 2. Author and Game Status
    textSize(16);
    textStyle(NORMAL);
    textLeading(20); // Reduced from 22 to 20
    // In p5.js 1.9.4, WORD constant might need to be accessed differently
    // Using string literal 'word' as a fallback
    try {
        textWrap(WORD);
    } catch (e) {
        textWrap('word');
    }
    let aboutText = "This game was created by Yestin. It's currently in alpha, and is just a fun side project.";
    text(aboutText, leftMargin, currentY, textBlockWidth);
    currentY += 50; // Reduced from 100 to 50

    // 3. Special Thanks Section
    textSize(18);
    textStyle(BOLD);
    textAlign(CENTER, TOP);
    text("Special Thanks", overlayX + overlayWidth / 2, currentY);
    currentY += 25; // Reduced from 30 to 25

    // 4. List of people
    textSize(16);
    textStyle(NORMAL);
    textAlign(CENTER, TOP);
    text("Rob M (alpha tester)", overlayX + overlayWidth / 2, currentY);
    currentY += 18; // Reduced from 20 to 18
    text("hypn (alpha tester)", overlayX + overlayWidth / 2, currentY);
    currentY += 18; // Reduced from 20 to 18
    text("benefit (alpha tester)", overlayX + overlayWidth / 2, currentY);

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
        overlayY + overlayHeight - bottomPadding - authorAndVersionTextHeight - 36 // Reduced from 40
    );

    text(
        "Press Right Arrow to return to Help screen",
        overlayX + overlayWidth / 2,
        overlayY + overlayHeight - bottomPadding - authorAndVersionTextHeight - 18 // Reduced from 20
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

// Function to calculate the required height for the about screen content
function calculateAboutContentHeight() {
    // Get the width for text wrapping calculations
    let overlayWidth = width * 0.6;
    if (overlayWidth < 550) {
        overlayWidth = 550;
    }
    let textBlockWidth = overlayWidth - (2 * 30); // Max width for text (with 30px margins)

    let totalHeight = 0;

    // 1. Heading: "About" (28px + 30px spacing)
    totalHeight += 28 + 30; // Reduced from 40

    // 2. Author and Game Status
    let aboutText = "This game was created by Yestin. It's currently in alpha, and is just a fun side project.";

    // Calculate about text height
    let aboutTextSize = 16;
    let aboutLineHeight = 20; // Reduced from 22

    // Estimate wrapped lines based on text width and available space
    let avgCharWidth = aboutTextSize * 0.6; // Approximate average character width
    let charsPerLine = Math.floor(textBlockWidth / avgCharWidth);
    let aboutLines = Math.ceil(aboutText.length / charsPerLine);

    // Calculate about text height
    let aboutTextHeight = aboutLines * aboutLineHeight;
    totalHeight += aboutTextHeight + 50; // Reduced from 100 to 50

    // 3. Special Thanks Section (18px + 25px spacing)
    totalHeight += 18 + 25; // Reduced from 30

    // 4. List of people (2 items, 18px each)
    totalHeight += 18 * 2 + 10; // Reduced from 20*2+20

    // 5. Navigation instructions (3 lines, 18px each)
    totalHeight += 18 * 3 + 10; // Reduced from 20*3+20

    // 6. Version and author info
    totalHeight += 15; // Reduced from 20

    totalHeight -= 50

    return totalHeight;
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
