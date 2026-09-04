function fitTextToWidth(textValue, maxWidth) {
    const normalizedText = String(textValue ?? '');
    if (maxWidth <= 0 || normalizedText.length === 0) {
        return '';
    }
    if (textWidth(normalizedText) <= maxWidth) {
        return normalizedText;
    }

    const ellipsis = '...';
    if (textWidth(ellipsis) > maxWidth) {
        return '';
    }

    let low = 0;
    let high = normalizedText.length;
    while (low < high) {
        const mid = Math.floor((low + high + 1) / 2);
        const candidate = `${normalizedText.slice(0, mid)}${ellipsis}`;
        if (textWidth(candidate) <= maxWidth) {
            low = mid;
        } else {
            high = mid - 1;
        }
    }
    return `${normalizedText.slice(0, low)}${ellipsis}`;
}

function buildGameOverLayoutMetrics(layoutScale, preferStacked, totalItemRows, visibleItemRows, scoreRowCount) {
    const scalePx = (value) => value * layoutScale;
    const viewportPadding = constrain(Math.min(width, height) * 0.02, 8, 24);
    const panelX = viewportPadding;
    const panelY = viewportPadding;
    const panelWidth = width - (viewportPadding * 2);
    const panelHeight = height - (viewportPadding * 2);
    const centerX = panelX + (panelWidth / 2);
    const outerPadding = scalePx(18);
    const innerWidth = panelWidth - (outerPadding * 2);
    const sectionGap = scalePx(14);
    const headerGap = scalePx(12);
    const cardsGap = scalePx(14);

    const titleSize = scalePx(76);
    const titleHeight = scalePx(84);
    const titleShadowOffset = Math.max(1, Math.round(scalePx(4)));

    const retryButtonWidth = scalePx(140);
    const retryButtonHeight = scalePx(46);
    const retryButtonCorner = scalePx(10);
    const retryButtonTextSize = scalePx(22);

    const statsTextSize = scalePx(21);
    const statsLineHeight = scalePx(28);
    const statsBlockHeight = statsLineHeight * 3;

    const headerHeight = titleHeight + headerGap + retryButtonHeight + headerGap + statsBlockHeight;
    const cardsTopY = panelY + outerPadding + headerHeight + sectionGap;

    const cardPadding = scalePx(12);
    const cardCorner = scalePx(10);
    const cardTitleSize = scalePx(20);
    const cardTitleHeight = scalePx(24);
    const cardTitleGap = scalePx(8);

    const totalsTextSize = scalePx(16);
    const totalsLineHeight = scalePx(21);
    const itemTextSize = scalePx(14);
    const itemLineHeight = scalePx(19);
    const hiddenItemRows = Math.max(0, totalItemRows - visibleItemRows);
    const itemDetailRows = visibleItemRows + (hiddenItemRows > 0 ? 1 : 0);
    const itemsCardHeight =
        (cardPadding * 2) +
        cardTitleHeight + cardTitleGap +
        (totalsLineHeight * 3) + scalePx(8) +
        (itemLineHeight * itemDetailRows);

    const tableTitleSize = scalePx(20);
    const tableHeaderSize = scalePx(12);
    const tableHeaderHeight = scalePx(17);
    const tableRowSize = scalePx(12);
    const tableRowHeight = scalePx(19);
    const tableInnerTopGap = scalePx(8);
    const tableHeaderGap = scalePx(6);
    const tableBottomGap = scalePx(8);
    const resolvedScoreRowCount = Math.max(1, scoreRowCount);
    const tableCardHeight =
        (cardPadding * 2) +
        cardTitleHeight + cardTitleGap +
        tableInnerTopGap +
        tableHeaderHeight + tableHeaderGap +
        (tableRowHeight * resolvedScoreRowCount) +
        tableBottomGap;

    let stacked = preferStacked || innerWidth < scalePx(860);
    let itemsCardWidth;
    let tableCardWidth;
    let itemsCardX;
    let tableCardX;
    let itemsCardY = cardsTopY;
    let tableCardY = cardsTopY;
    let cardsSectionHeight;

    if (!stacked) {
        const minLeftCardWidth = scalePx(280);
        const minRightCardWidth = scalePx(420);
        const proposedRightWidth = Math.max(minRightCardWidth, innerWidth * 0.56);
        const proposedLeftWidth = innerWidth - cardsGap - proposedRightWidth;
        if (proposedLeftWidth < minLeftCardWidth) {
            stacked = true;
        } else {
            itemsCardWidth = proposedLeftWidth;
            tableCardWidth = proposedRightWidth;
            itemsCardX = panelX + outerPadding;
            tableCardX = itemsCardX + itemsCardWidth + cardsGap;
            cardsSectionHeight = Math.max(itemsCardHeight, tableCardHeight);
        }
    }

    if (stacked) {
        itemsCardWidth = innerWidth;
        tableCardWidth = innerWidth;
        itemsCardX = panelX + outerPadding;
        tableCardX = itemsCardX;
        tableCardY = itemsCardY + itemsCardHeight + cardsGap;
        cardsSectionHeight = itemsCardHeight + cardsGap + tableCardHeight;
    }

    const requiredHeight = (outerPadding * 2) + headerHeight + sectionGap + cardsSectionHeight;
    const retryButtonX = centerX - (retryButtonWidth / 2);
    const retryButtonY = panelY + outerPadding + titleHeight + headerGap;
    const statsStartY = retryButtonY + retryButtonHeight + headerGap;

    const tableContentX = tableCardX + cardPadding;
    const tableContentY = tableCardY + cardPadding + cardTitleHeight + cardTitleGap + tableInnerTopGap;
    const tableContentWidth = Math.max(1, tableCardWidth - (cardPadding * 2));
    const tableCellPadding = scalePx(4);
    const tableColumnWeights = [0.14, 0.24, 0.14, 0.2, 0.12, 0.16];
    let runningX = tableContentX;
    const tableColumns = tableColumnWeights.map((weight) => {
        const colWidth = tableContentWidth * weight;
        const column = {x: runningX, w: colWidth};
        runningX += colWidth;
        return column;
    });

    return {
        layoutScale,
        scalePx,
        panelX,
        panelY,
        panelWidth,
        panelHeight,
        centerX,
        outerPadding,
        sectionGap,
        titleSize,
        titleHeight,
        titleShadowOffset,
        retryButtonX,
        retryButtonY,
        retryButtonWidth,
        retryButtonHeight,
        retryButtonCorner,
        retryButtonTextSize,
        statsTextSize,
        statsLineHeight,
        statsStartY,
        cardPadding,
        cardCorner,
        cardTitleSize,
        cardTitleHeight,
        cardTitleGap,
        totalsTextSize,
        totalsLineHeight,
        itemTextSize,
        itemLineHeight,
        hiddenItemRows,
        visibleItemRows,
        itemsCardX,
        itemsCardY,
        itemsCardWidth,
        itemsCardHeight,
        tableTitleSize,
        tableHeaderSize,
        tableHeaderHeight,
        tableRowSize,
        tableRowHeight,
        tableCardX,
        tableCardY,
        tableCardWidth,
        tableCardHeight,
        tableContentX,
        tableContentY,
        tableContentWidth,
        tableCellPadding,
        tableColumns,
        requiredHeight
    };
}

function computeGameOverLayout(totalItemRows, scoreRowCount) {
    const minScale = 0.62;
    const maxIterations = 8;
    const modeOrder = width >= 1000 ? [false, true] : [true];
    let fallbackLayout = null;

    for (const preferStacked of modeOrder) {
        let visibleItemRows = totalItemRows;
        while (visibleItemRows >= 0) {
            let layoutScale = 1;
            let layout = buildGameOverLayoutMetrics(layoutScale, preferStacked, totalItemRows, visibleItemRows, scoreRowCount);

            for (let i = 0; i < maxIterations && layout.requiredHeight > layout.panelHeight && layoutScale > minScale; i++) {
                const fitRatio = layout.panelHeight / Math.max(layout.requiredHeight, 1);
                layoutScale = Math.max(minScale, layoutScale * fitRatio * 0.98);
                layout = buildGameOverLayoutMetrics(layoutScale, preferStacked, totalItemRows, visibleItemRows, scoreRowCount);
            }

            if (!fallbackLayout || layout.requiredHeight < fallbackLayout.requiredHeight) {
                fallbackLayout = layout;
            }
            if (layout.requiredHeight <= layout.panelHeight) {
                return layout;
            }

            visibleItemRows--;
        }
    }

    return fallbackLayout || buildGameOverLayoutMetrics(minScale, true, totalItemRows, 0, scoreRowCount);
}

function drawGameOverItemsCard(layout, itemsToDisplay) {
    stroke(255, 150);
    strokeWeight(1.5);
    fill(0, 0, 0, 120);
    rect(layout.itemsCardX, layout.itemsCardY, layout.itemsCardWidth, layout.itemsCardHeight, layout.cardCorner);
    noStroke();

    let textX = layout.itemsCardX + layout.cardPadding;
    let textY = layout.itemsCardY + layout.cardPadding;
    const textMaxWidth = layout.itemsCardWidth - (layout.cardPadding * 2);

    fill(255);
    textSize(layout.cardTitleSize);
    textStyle(BOLD);
    textAlign(LEFT, TOP);
    text("Run Breakdown", textX, textY);
    textY += layout.cardTitleHeight + layout.cardTitleGap;

    const totals = [
        `Objects Collected: ${gameState.collectedCount}`,
        `Objects Destroyed: ${gameState.destroyedCount}`,
        `Cats Rescued: ${gameState.catsRescued} (${gameState.catsRescuedPoints} pts)`
    ];

    textSize(layout.totalsTextSize);
    textStyle(NORMAL);
    fill(255);
    for (const totalLine of totals) {
        text(fitTextToWidth(totalLine, textMaxWidth), textX, textY);
        textY += layout.totalsLineHeight;
    }
    textY += layout.scalePx(8);

    textSize(layout.itemTextSize);
    fill(220);
    const shownItems = itemsToDisplay.slice(0, layout.visibleItemRows);
    for (const item of shownItems) {
        const itemLine = `${item.name}: ${item.count} (${item.points} pts)`;
        text(fitTextToWidth(itemLine, textMaxWidth), textX, textY);
        textY += layout.itemLineHeight;
    }

    if (layout.hiddenItemRows > 0) {
        fill(190);
        textStyle(ITALIC);
        text(
            fitTextToWidth(`+${layout.hiddenItemRows} more...`, textMaxWidth),
            textX,
            textY
        );
        textStyle(NORMAL);
    }
}

function drawGameOverHighScoresCard(layout, scoreEntries) {
    stroke(255, 150);
    strokeWeight(1.5);
    fill(0, 0, 0, 120);
    rect(layout.tableCardX, layout.tableCardY, layout.tableCardWidth, layout.tableCardHeight, layout.cardCorner);
    noStroke();

    fill(255);
    textSize(layout.tableTitleSize);
    textStyle(BOLD);
    textAlign(CENTER, TOP);
    text(
        "High Scores",
        layout.tableCardX + (layout.tableCardWidth / 2),
        layout.tableCardY + layout.cardPadding
    );

    const compactHeaders = layout.tableContentWidth < layout.scalePx(470);
    const headers = compactHeaders
        ? ["Date", "Name", "Score", "F/Z", "P", "Time"]
        : ["Date", "Name", "Score", "Floor/Zone", "Player", "Time"];
    const headerY = layout.tableContentY;

    fill(200);
    textSize(layout.tableHeaderSize);
    textStyle(BOLD);
    textAlign(LEFT, TOP);
    for (let i = 0; i < layout.tableColumns.length; i++) {
        const col = layout.tableColumns[i];
        const maxCellWidth = col.w - (layout.tableCellPadding * 2);
        const clippedHeader = fitTextToWidth(headers[i], maxCellWidth);
        text(clippedHeader, col.x + layout.tableCellPadding, headerY);
    }

    let rowY = headerY + layout.tableHeaderHeight + layout.scalePx(6);
    const rows = scoreEntries.length > 0
        ? scoreEntries
        : [{
            date: '--',
            name: 'No entries yet',
            score: '--',
            floorZone: '--',
            player: '--',
            time: '--'
        }];

    fill(220);
    textSize(layout.tableRowSize);
    textStyle(NORMAL);

    for (const entry of rows) {
        let floorZoneText = '--';
        if (entry.floorZone) {
            floorZoneText = entry.floorZone;
        } else if (entry.gameLevel) {
            const {floor, zone} = getLevelFloorAndZone(entry.gameLevel);
            floorZoneText = `${floor}/${zone}`;
        } else if (entry.dungeonFloor && entry.dungeonZone) {
            floorZoneText = `${entry.dungeonFloor}/${entry.dungeonZone}`;
        }

        const parsedScore = Number(entry.score);
        const parsedPlayerLevel = Number(entry.playerLevel);
        const rowValues = [
            entry.date || '??/??/??',
            entry.name || 'Unknown',
            String(Number.isFinite(parsedScore) ? parsedScore : (entry.score || 0)),
            floorZoneText,
            String(Number.isFinite(parsedPlayerLevel) ? parsedPlayerLevel : (entry.player || '?')),
            entry.time || formatPlayTime(Number.isFinite(entry.playTime) ? entry.playTime : 0)
        ];

        for (let i = 0; i < layout.tableColumns.length; i++) {
            const col = layout.tableColumns[i];
            const maxCellWidth = col.w - (layout.tableCellPadding * 2);
            const clippedValue = fitTextToWidth(rowValues[i], maxCellWidth);
            text(clippedValue, col.x + layout.tableCellPadding, rowY);
        }

        rowY += layout.tableRowHeight;
    }
}

function drawGameOverScreen() {
    fill(0, 0, 0, 190);
    rect(0, 0, width, height);

    const itemsToDisplay = getItemsToDisplay().filter((item) => item.points !== 0);
    const scoreEntries = highScores.slice(0, HIGH_SCORE_COUNT);
    const layout = computeGameOverLayout(itemsToDisplay.length, scoreEntries.length);

    fill(30, 30, 30, 185);
    noStroke();
    rect(layout.panelX, layout.panelY, layout.panelWidth, layout.panelHeight, 12);

    retryButton.x = layout.retryButtonX;
    retryButton.y = layout.retryButtonY;
    retryButton.w = layout.retryButtonWidth;
    retryButton.h = layout.retryButtonHeight;

    textAlign(CENTER, CENTER);
    textStyle(BOLD);
    textSize(layout.titleSize);
    fill(0);
    text(
        "Game Over",
        layout.centerX + layout.titleShadowOffset,
        layout.panelY + layout.outerPadding + (layout.titleHeight / 2) + layout.titleShadowOffset
    );
    fill(255, 0, 0);
    text(
        "Game Over",
        layout.centerX,
        layout.panelY + layout.outerPadding + (layout.titleHeight / 2)
    );

    fill(255);
    rect(retryButton.x, retryButton.y, retryButton.w, retryButton.h, layout.retryButtonCorner);
    fill(0);
    textSize(layout.retryButtonTextSize);
    text("Retry", retryButton.x + (retryButton.w / 2), retryButton.y + (retryButton.h / 2));

    const statsLines = [
        `Total Points: ${gameState.score}`,
        `Floor: ${gameState.dungeonFloor}, Zone: ${gameState.dungeonZone}`,
        `Player Level: ${playerState.level}`
    ];
    fill(255);
    textStyle(NORMAL);
    textSize(layout.statsTextSize);
    textAlign(CENTER, TOP);
    for (let i = 0; i < statsLines.length; i++) {
        text(statsLines[i], layout.centerX, layout.statsStartY + (i * layout.statsLineHeight));
    }

    drawGameOverItemsCard(layout, itemsToDisplay);
    drawGameOverHighScoresCard(layout, scoreEntries);

    textStyle(NORMAL);
    textAlign(LEFT, BASELINE);
}

function handleGameOverScreenMousePressed() {
    // Check game state flags
    if (gameState.gameOver && !gameState.enteringName) {
        // Check if click is within retry button bounds
        if (mouseX > retryButton.x && mouseX < retryButton.x + retryButton.w &&
            mouseY > retryButton.y && mouseY < retryButton.y + retryButton.h) {
            startAudioIfNeeded(); // Attempt to start audio on retry click
            restartGame();
        }
        return true; // Indicate mouse event was handled by this screen
    }
    return false;
}
