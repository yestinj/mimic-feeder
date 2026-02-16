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

    if (!isOverlayViewportSupported(760, 560)) {
        drawOverlayViewportWarning("Mimic Feeder", [
            "Press any key or click to start",
            "Resize for the full intro + controls view"
        ], 760, 560);
        return;
    }

    const overlayBounds = getResponsiveOverlayBounds(0.62, 0.74, 460, 360, 760, 700);
    const description = "Dungeon mimic-feeding chaos. Eat creatures, nab shinies, dodge bombs, and unlock powers.\n\n" +
        "Control the mimic to collect food and shinies. Avoid or destroy bombs.\n\n" +
        "Don't let perfectly good food perish - it hurts!\n\n" +
        "Eat, collect, and survive!";
    const controls = [
        "Move: Left / Right Arrows or A / D",
        "Dash: Double-tap Left / Right Arrows or A / D",
        "Jump / Double Jump: Up Arrow or W",
        "Help: Esc    Achievements: K",
        "Pause / Resume: P    Mute / Unmute: M",
        "Ability Keys (unlock later): Space, Z, X"
    ];

    const computeLayoutMetrics = (layoutScale, resolvedOverlayWidth, resolvedOverlayHeight) => {
        const scalePx = (value) => value * layoutScale;
        const topPadding = scalePx(30);
        const sidePadding = scalePx(30);
        const footerReserve = scalePx(70);
        const titleSize = scalePx(28);
        const titleHeight = scalePx(40);
        const descriptionSize = scalePx(14);
        const descriptionLineHeight = scalePx(18);
        const controlsHeadingSize = scalePx(16);
        const controlsHeadingHeight = scalePx(26);
        const controlsTextSize = scalePx(12);
        const controlsLineHeight = scalePx(18);
        const sectionGap = scalePx(12);
        const blockGap = scalePx(14);
        const contentSafetyGap = scalePx(8);
        const textBlockWidth = resolvedOverlayWidth - (2 * sidePadding);
        const availableHeight = resolvedOverlayHeight - topPadding - footerReserve;

        textStyle(NORMAL);
        textSize(descriptionSize);
        const descriptionHeight = measureWrappedTextHeight(description, textBlockWidth, descriptionLineHeight);

        const requiredHeight =
            titleHeight +
            descriptionHeight + blockGap +
            controlsHeadingHeight + sectionGap +
            (controls.length * controlsLineHeight) +
            contentSafetyGap;

        return {
            topPadding,
            sidePadding,
            footerReserve,
            titleSize,
            titleHeight,
            descriptionSize,
            descriptionLineHeight,
            controlsHeadingSize,
            controlsHeadingHeight,
            controlsTextSize,
            controlsLineHeight,
            sectionGap,
            blockGap,
            contentSafetyGap,
            textBlockWidth,
            availableHeight,
            requiredHeight
        };
    };

    const layout = computeAdaptiveOverlayLayout(
        overlayBounds,
        computeLayoutMetrics,
        { minScale: 0.86, maxIterations: 6, fitBias: 0.98 }
    );

    if (!layout) {
        drawOverlayViewportWarning("Mimic Feeder", [
            "Press any key or click to start",
            "Resize for the full intro + controls view"
        ], 760, 560);
        return;
    }
    let { overlayWidth, overlayHeight, overlayX, overlayY } = layout;
    const { metrics, scalePx } = layout;

    // Draw the overlay background
    fill(160, 160, 160); // Darker grey
    noStroke();
    rect(overlayX, overlayY, overlayWidth, overlayHeight, 10);

    // Text Content
    let leftMargin = overlayX + metrics.sidePadding;
    let textBlockWidth = metrics.textBlockWidth;
    let currentY = overlayY + metrics.topPadding;

    // 1. Heading: "Mimic Feeder"
    fill(0);
    textSize(metrics.titleSize);
    textAlign(LEFT, TOP);
    textStyle(BOLD);
    text(`Mimic Feeder`, leftMargin, currentY);
    currentY += metrics.titleHeight;

    // 2. Description
    textSize(metrics.descriptionSize);
    textStyle(NORMAL);
    currentY += drawWrappedTextBlock(description, leftMargin, currentY, textBlockWidth, metrics.descriptionLineHeight);
    currentY += metrics.blockGap;

    // 3. "Game Controls" Heading
    textSize(metrics.controlsHeadingSize);
    textStyle(BOLD);
    fill(0); // Black for heading
    textAlign(LEFT, TOP);
    text("Game Controls:", leftMargin, currentY);
    currentY += metrics.controlsHeadingHeight;
    currentY += metrics.sectionGap;

    // 4. Controls List
    textSize(metrics.controlsTextSize);
    textStyle(NORMAL);
    for (const controlLine of controls) {
        text(controlLine, leftMargin, currentY);
        currentY += metrics.controlsLineHeight;
    }

    // 5. Start Instruction & Bottom Corner Texts
    let bottomPadding = scalePx(10);
    let authorAndVersionTextHeight = scalePx(12 + 5); // textSize for author/version + small gap

    textSize(scalePx(14));
    textStyle(ITALIC);
    fill(0);
    textAlign(CENTER, BOTTOM);
    text(
        "Click or press any key to start (activates audio)",
        overlayX + overlayWidth / 2,
        overlayY + overlayHeight - bottomPadding - authorAndVersionTextHeight // Position above bottom texts
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

/**
 * Handles keyboard input on the intro screen
 * Processes key presses when the intro screen is active
 * @function
 * @returns {boolean} True if the key press was handled, false otherwise
 */
function handleIntroScreenKeyPressed() {
    if (gameState.showIntroScreen) {
        startAudioIfNeeded();
        gameState.showIntroScreen = false;
        gameState.gameStarted = false; // Ensure startTime is reset in draw()
        return true;
    }
    return false;
}

/**
 * Handles mouse input on the intro screen
 * Processes mouse clicks when the intro screen is active
 * @function
 * @returns {boolean} True if the mouse click was handled, false otherwise
 */
function handleIntroScreenMousePressed() {
    if (gameState.showIntroScreen) {
        startAudioIfNeeded();
        gameState.showIntroScreen = false;
        gameState.gameStarted = false; // Ensure startTime is reset in draw()
        return true;
    }
    return false;
}
