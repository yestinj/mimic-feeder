function drawHelpScreen() {
    // Draw semi-transparent overlay for the entire screen
    fill(0, 0, 0, 200);
    rect(0, 0, width, height);

    if (!isOverlayViewportSupported()) {
        drawOverlayViewportWarning("Help", [
            "Press Right Arrow to view Object Info",
            "Press Left Arrow to view About",
            "Press Escape to close"
        ]);
        return;
    }

    const howToPlayLines = [
        "Control the dungeon mimic to collect food and shinies, and avoid or destroy bombs.",
        "Letting perfectly good food (creatures) perish or getting hit by a dangerous object will cause damage.",
        "Cats are special..."
    ];
    const controls = [
        "Move: Left / Right Arrows or A / D",
        "Dash: Double-tap Left / Right Arrows or A / D",
        "Jump / Double Jump: Up Arrow or W",
        "Help: Esc",
        "Achievements: K",
        "Pause / Resume: P",
        "Mute / Unmute: M"
    ];
    const specialAbilityLines = [
        `Tentacles (Z): unlocks at Player level ${PLAYER_LEVEL_FOR_TENTACLES}.`,
        "Grabs multiple nearby objects at once. Cooldown applies.",
        `Shadow Bolt (Space): staff can appear at Floor ${DUNGEON_FLOOR_FOR_STAFF_DROP} Zone ${DUNGEON_ZONE_FOR_STAFF_DROP}.`,
        "Fires a ranged bolt that destroys objects.",
        `Magnetism (X): magnet can appear at Floor ${DUNGEON_FLOOR_FOR_MAGNET_DROP} Zone ${DUNGEON_ZONE_FOR_MAGNET_DROP}.`,
        "On press, snapshots on-screen loot/hazards (not creatures, fireballs, staff, potion, or boss).",
        "Marked objects keep pulling hard until eaten or destroyed — including bombs.",
        "Use carefully near bombs. Cooldown only gates re-use.",
        `Dash cooldown: ${DASH_COOLDOWN_FRAMES / TARGET_FPS} second(s).`
    ];

    textStyle(NORMAL);
    textSize(14);
    const longestHowToLineWidth = Math.max(...howToPlayLines.map((line) => textWidth(line)));
    const targetOverlayWidth = constrain(
        longestHowToLineWidth + 72,
        Math.min(520, width - 24),
        Math.min(780, width - 24)
    );

    const computeLayoutMetrics = (layoutScale, resolvedOverlayWidth, resolvedOverlayHeight) => {
        const scalePx = (value) => value * layoutScale;
        const headingSize = scalePx(28);
        const sectionHeadingSize = scalePx(16);
        const bodySize = scalePx(13.5);
        const controlSize = scalePx(12);
        const bodyLineHeight = scalePx(16);
        const controlLineHeight = scalePx(16.5);
        const abilityLineHeight = scalePx(15.5);
        const sidePadding = scalePx(30);
        const topPadding = scalePx(22);
        const titleHeight = scalePx(34);
        const sectionHeadingBlockHeight = scalePx(21);
        const sectionGap = scalePx(6);
        const blockGap = scalePx(8);
        const abilityGap = scalePx(2);
        const contentSafetyGap = scalePx(8);
        const footerReserve = scalePx(84);
        const textBlockWidth = resolvedOverlayWidth - (2 * sidePadding);
        const availableHeight = resolvedOverlayHeight - topPadding - footerReserve;

        textStyle(NORMAL);
        textSize(bodySize);
        const howToHeight = howToPlayLines.length * bodyLineHeight;
        const abilityHeight = specialAbilityLines.reduce((total, line, index) => {
            const lineHeight = measureWrappedTextHeight(line, textBlockWidth, abilityLineHeight);
            const spacing = index < specialAbilityLines.length - 1 ? abilityGap : 0;
            return total + lineHeight + spacing;
        }, 0);

        const requiredHeight =
            titleHeight +
            sectionHeadingBlockHeight + sectionGap + howToHeight + blockGap +
            sectionHeadingBlockHeight + sectionGap + (controls.length * controlLineHeight) + blockGap +
            sectionHeadingBlockHeight + sectionGap + abilityHeight +
            contentSafetyGap;

        return {
            headingSize,
            sectionHeadingSize,
            bodySize,
            controlSize,
            bodyLineHeight,
            controlLineHeight,
            abilityLineHeight,
            sidePadding,
            topPadding,
            titleHeight,
            sectionHeadingBlockHeight,
            sectionGap,
            blockGap,
            abilityGap,
            contentSafetyGap,
            footerReserve,
            textBlockWidth,
            availableHeight,
            requiredHeight
        };
    };

    const baseMetrics = computeLayoutMetrics(1, targetOverlayWidth, height);
    const targetOverlayHeight = constrain(
        baseMetrics.requiredHeight + baseMetrics.topPadding + baseMetrics.footerReserve + 8,
        Math.min(430, height - 24),
        Math.min(690, height - 24)
    );
    const overlayBounds = {
        overlayWidth: targetOverlayWidth,
        overlayHeight: targetOverlayHeight,
        overlayX: (width - targetOverlayWidth) / 2,
        overlayY: (height - targetOverlayHeight) / 2
    };

    const layout = computeAdaptiveOverlayLayout(
        overlayBounds,
        computeLayoutMetrics,
        { minScale: 0.82, maxIterations: 6, fitBias: 0.98 }
    );

    if (!layout) {
        drawOverlayViewportWarning("Help", [
            "Press Right Arrow to view Object Info",
            "Press Left Arrow to view About",
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
    let textBlockWidth = metrics.textBlockWidth;
    let currentY = overlayY + metrics.topPadding;

    // 1. Heading: "Help"
    fill(0);
    textSize(metrics.headingSize);
    textAlign(LEFT, TOP);
    textStyle(BOLD);
    text(`Help`, leftMargin, currentY);
    currentY += metrics.titleHeight;

    // 2. How to Play
    textSize(metrics.sectionHeadingSize);
    textStyle(BOLD);
    fill(0); // Black for heading
    textAlign(LEFT, TOP);
    text("How to Play:", leftMargin, currentY);
    currentY += metrics.sectionHeadingBlockHeight;
    currentY += metrics.sectionGap;

    // How To Play body
    textSize(metrics.bodySize);
    textStyle(NORMAL);
    for (const howToLine of howToPlayLines) {
        text(howToLine, leftMargin, currentY);
        currentY += metrics.bodyLineHeight;
    }
    currentY += metrics.blockGap;

    // 3. Game Controls
    textSize(metrics.sectionHeadingSize);
    textStyle(BOLD);
    fill(0); // Black for heading
    textAlign(LEFT, TOP);
    text("Game Controls:", leftMargin, currentY);
    currentY += metrics.sectionHeadingBlockHeight;
    currentY += metrics.sectionGap;

    // Controls List
    textSize(metrics.controlSize);
    textStyle(NORMAL);
    for (const controlLine of controls) {
        text(controlLine, leftMargin, currentY);
        currentY += metrics.controlLineHeight;
    }
    currentY += metrics.blockGap;

    // 5. Abilities
    textSize(metrics.sectionHeadingSize);
    textStyle(BOLD);
    fill(0); // Black for heading
    textAlign(LEFT, TOP);
    text("Special Abilities:", leftMargin, currentY);
    currentY += metrics.sectionHeadingBlockHeight;
    currentY += metrics.sectionGap;

    // Abilities Description
    textSize(metrics.bodySize);
    textStyle(NORMAL);
    for (let i = 0; i < specialAbilityLines.length; i++) {
        currentY += drawWrappedTextBlock(specialAbilityLines[i], leftMargin, currentY, textBlockWidth, metrics.abilityLineHeight);
        if (i < specialAbilityLines.length - 1) {
            currentY += metrics.abilityGap;
        }
    }

    // 6. Navigation Instructions
    let bottomPadding = scalePx(10);
    let authorAndVersionTextHeight = scalePx(12 + 5); // textSize for author/version + small gap
    const navBaseY = overlayY + overlayHeight - bottomPadding - authorAndVersionTextHeight;
    const navLineHeight = scalePx(18);

    textSize(scalePx(14));
    textStyle(ITALIC);
    fill(0);
    textAlign(CENTER, BOTTOM);
    text(
        "Press Right Arrow to view Object Info",
        overlayX + overlayWidth / 2,
        navBaseY - (2 * navLineHeight)
    );

    text(
        "Press Left Arrow to view About screen",
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
