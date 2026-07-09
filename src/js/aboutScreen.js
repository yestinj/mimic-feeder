function drawAboutScreen() {
    // Draw semi-transparent overlay for the entire screen
    fill(0, 0, 0, 200);
    rect(0, 0, width, height);

    if (!isOverlayViewportSupported()) {
        drawOverlayViewportWarning("About", [
            "Press Left Arrow to return to Object Info",
            "Press Right Arrow to return to Help",
            "Press Escape to close"
        ]);
        return;
    }

    const overlayBounds = getResponsiveOverlayBounds(0.7, 0.7, 600, 360, 860, 620);
    const aboutText = "This game was created by Yestin and is currently in playable beta. " +
        "It's a portfolio/learning project with variable maintenance cadence. " +
        "Returning players with a saved name skip the intro and start immediately — press Esc for help anytime.";
    const thanksList = [
        "Rob M (alpha tester)",
        "hypn (alpha tester)",
        "benefit (alpha tester)"
    ];

    const computeLayoutMetrics = (layoutScale, resolvedOverlayWidth, resolvedOverlayHeight) => {
        const scalePx = (value) => value * layoutScale;
        const topPadding = scalePx(24);
        const sidePadding = scalePx(30);
        const footerReserve = scalePx(96);
        const titleSize = scalePx(28);
        const titleHeight = scalePx(36);
        const aboutTextSize = scalePx(16);
        const aboutLineHeight = scalePx(20);
        const centerHeadingSize = scalePx(18);
        const centerHeadingHeight = scalePx(24);
        const centerTextSize = scalePx(16);
        const centerLineHeight = scalePx(20);
        const sectionGap = scalePx(10);
        const blockGap = scalePx(12);
        const contentSafetyGap = scalePx(8);
        const textBlockWidth = resolvedOverlayWidth - (2 * sidePadding);
        const availableHeight = resolvedOverlayHeight - topPadding - footerReserve;

        textStyle(NORMAL);
        textSize(aboutTextSize);
        const aboutHeight = measureWrappedTextHeight(aboutText, textBlockWidth, aboutLineHeight);

        const requiredHeight =
            titleHeight +
            aboutHeight + blockGap +
            centerHeadingHeight + sectionGap +
            (thanksList.length * centerLineHeight) +
            contentSafetyGap;

        return {
            topPadding,
            sidePadding,
            footerReserve,
            titleSize,
            titleHeight,
            aboutTextSize,
            aboutLineHeight,
            centerHeadingSize,
            centerHeadingHeight,
            centerTextSize,
            centerLineHeight,
            sectionGap,
            blockGap,
            contentSafetyGap,
            textBlockWidth,
            availableHeight,
            requiredHeight
        };
    };

    const baseMetrics = computeLayoutMetrics(1, overlayBounds.overlayWidth, height);
    const targetOverlayHeight = constrain(
        baseMetrics.requiredHeight + baseMetrics.topPadding + baseMetrics.footerReserve + 8,
        Math.min(320, height - 24),
        Math.min(560, height - 24)
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
        { minScale: 0.84, maxIterations: 6, fitBias: 0.98 }
    );

    if (!layout) {
        drawOverlayViewportWarning("About", [
            "Press Left Arrow to return to Object Info",
            "Press Right Arrow to return to Help",
            "Press Escape to close"
        ]);
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

    // 1. Heading: "About"
    fill(0);
    textSize(metrics.titleSize);
    textAlign(LEFT, TOP);
    textStyle(BOLD);
    text(`About`, leftMargin, currentY);
    currentY += metrics.titleHeight;

    // 2. Author and Game Status
    textSize(metrics.aboutTextSize);
    textStyle(NORMAL);
    currentY += drawWrappedTextBlock(aboutText, leftMargin, currentY, textBlockWidth, metrics.aboutLineHeight);
    currentY += metrics.blockGap;

    // 3. Special Thanks Section
    textSize(metrics.centerHeadingSize);
    textStyle(BOLD);
    textAlign(CENTER, TOP);
    text("Special Thanks", overlayX + overlayWidth / 2, currentY);
    currentY += metrics.centerHeadingHeight;
    currentY += metrics.sectionGap;

    // 4. List of people
    textSize(metrics.centerTextSize);
    textStyle(NORMAL);
    textAlign(CENTER, TOP);
    for (const thanksEntry of thanksList) {
        text(thanksEntry, overlayX + overlayWidth / 2, currentY);
        currentY += metrics.centerLineHeight;
    }

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
        "Press Left Arrow to return to Object Info screen",
        overlayX + overlayWidth / 2,
        navBaseY - (2 * navLineHeight)
    );

    text(
        "Press Right Arrow to return to Help screen",
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
