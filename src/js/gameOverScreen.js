function drawGameOverScreen() {
    // Draw "Game Over" title (using existing style)
    textSize(100);
    textAlign(CENTER, CENTER);
    textStyle(BOLD);
    fill(0);
    stroke(0);
    strokeWeight(4);
    text("Game Over", width / 2 + 4, height / 2 - 250 + 4); // Shadow/Outline
    fill(255, 0, 0);
    noStroke();
    strokeWeight(0);
    text("Game Over", width / 2, height / 2 - 250); // Red fill
    textStyle(NORMAL); // Reset style

    // Draw retry button (using retryButton coords)
    fill(255);
    rect(retryButton.x, retryButton.y, retryButton.w, retryButton.h, 10);
    fill(0);
    textSize(24);
    textAlign(CENTER, CENTER);
    text("Retry", retryButton.x + retryButton.w / 2, retryButton.y + retryButton.h / 2);

    // --- Stats Display ---
    // Define statsY based on button position FIRST
    let statsY = retryButton.y + retryButton.h + 40;

    // Set text properties for stats
    fill(255);
    textSize(24);
    textAlign(CENTER);

    // Now use statsY
    text(`Total Points: ${gameState.score}`, width / 2, statsY);
    statsY += 30; // Increment statsY for the next line
    text(`Floor: ${gameState.dungeonFloor}, Zone: ${gameState.dungeonZone}`, width / 2, statsY);
    statsY += 30;
    text(`Player Level: ${playerState.level}`, width / 2, statsY);

    // --- Two Columns Below Stats ---
    // columnStartY uses the final value of statsY from above
    let columnStartY = statsY + 40;

    // Position left column further to the left to avoid overlap with high score table
    let leftColumnX = width * 0.2; // Reduced from width/4 (25%) to 20% of screen width

    // --- Left Column: Items Collected ---
    let itemY = columnStartY; // Start Y position for this column's content

    // Draw Totals FIRST
    fill(255); // White for totals
    textSize(20);
    textAlign(CENTER); // Center align totals
    text(`Objects Collected: ${gameState.collectedCount}`, leftColumnX, itemY);
    itemY += 30;
    text(`Objects Destroyed: ${gameState.destroyedCount}`, leftColumnX, itemY);
    itemY += 30;
    text(`Cats rescued: ${gameState.catsRescued} (${gameState.catsRescuedPoints} pts)`, leftColumnX, itemY);
    itemY += 35; // Add extra space before detailed list

    // Draw detailed item list
    fill(220); // Lighter Grey text for item list
    textSize(18);
    textAlign(CENTER); // Keep centered

    const itemsToDisplay = getItemsToDisplay();
    for (let item of itemsToDisplay) {
        if (item.points !== 0) {
            text(`${item.name}: ${item.count} (${item.points} pts)`, leftColumnX, itemY);
            itemY += 25; // Spacing for item list
        }
    }

    // --- Right Column: High Scores Table ---
    // Adjust column widths based on screen width
    // For smaller screens, reduce column widths and padding
    const isSmallScreen = width < 800;

    // Define individual column widths with responsive adjustments
    let dateColWidth = isSmallScreen ? 50 : 75;
    let nameColWidth = isSmallScreen ?
        (NAME_INPUT_MAX_LENGTH * 5) + 15 : // Smaller text on small screens
        (NAME_INPUT_MAX_LENGTH * 8) + 35;  // Original size on larger screens
    let scoreColWidth = isSmallScreen ? 50 : 75;
    let gameLvlColWidth = isSmallScreen ? 65 : 95;
    let playerLvlColWidth = isSmallScreen ? 40 : 65;
    let timeColWidth = isSmallScreen ? 45 : 70; // Approx. width for "XXm YYs"

    let headerPadding = isSmallScreen ? 10 : 15; // Reduced padding on small screens
    let rightSidePadding = isSmallScreen ? 5 : 10; // Reduced padding on small screens

    // Calculate total content width
    let tableContentWidth = dateColWidth + nameColWidth + scoreColWidth + gameLvlColWidth + playerLvlColWidth + timeColWidth + rightSidePadding;
    // Table border width will be content width + padding on both sides of the content
    let tableBorderWidth = tableContentWidth + (headerPadding * 2);

    let tableHeight = 290; // Keep adjusted height
    let borderBoxPadding = 5; // Padding around the table border itself

    // Position Table to ensure it's fully visible and doesn't overlap with left column
    // Move the table to the right side of the screen, but ensure it doesn't go off-screen
    let tableX = width * 0.55;

    // Make sure the table doesn't extend beyond the right edge of the screen
    if (tableX + tableBorderWidth > width - 10) {
        tableX = width - tableBorderWidth - 10; // Keep 10px margin from right edge
    }

    // Keep the Y position calculation as before for the table's top
    let tableTopY = columnStartY - 10; // Renamed tableY to tableTopY for clarity

    let titleOffsetY = 20; // Y offset for the title from tableTopY
    let headerOffsetY = titleOffsetY + 30; // Y offset for headers from tableTopY (increased from title)
    let rowStartOffsetY = headerOffsetY + 25; // Y offset for first row from tableTopY

    let tableTitleY = tableTopY + titleOffsetY;
    let tableHeaderY = tableTopY + headerOffsetY;
    let tableRowStartY = tableTopY + rowStartOffsetY;

    // Draw Table Border using the new tableX and calculated tableBorderWidth
    stroke(255);
    strokeWeight(2);
    noFill();
    rect(tableX, tableTopY, tableBorderWidth, tableHeight); // Use tableTopY
    noStroke();

    // Table Title - Center it within the table's content bounds
    fill(255);
    textSize(isSmallScreen ? 16 : 20); // Smaller text on small screens
    textStyle(BOLD);
    textAlign(CENTER);
    text("High Scores", tableX + tableBorderWidth / 2, tableTitleY); // Use tableTitleY
    textStyle(NORMAL);

    // Table Headers - Position relative to tableX + headerPadding (content start)
    fill(200);
    textSize(isSmallScreen ? 12 : 16); // Smaller text on small screens
    textAlign(LEFT);
    textStyle(BOLD);
    let currentX = tableX + headerPadding; // Start of content drawing
    text("Date", currentX, tableHeaderY);
    currentX += dateColWidth;
    text("Name", currentX, tableHeaderY);
    currentX += nameColWidth;
    text("Score", currentX, tableHeaderY);
    currentX += scoreColWidth;
    text("Floor/Zone", currentX, tableHeaderY);
    currentX += gameLvlColWidth;
    text("Player", currentX, tableHeaderY);
    currentX += playerLvlColWidth;
    text("Time", currentX, tableHeaderY);
    textStyle(NORMAL);


    // Table Rows - Position relative to tableX + headerPadding
    textSize(isSmallScreen ? 10 : 14); // Smaller text on small screens
    fill(220);
    let rowY = tableRowStartY; // Use tableRowStartY
    for (let i = 0; i < highScores.length && i < HIGH_SCORE_COUNT; i++) {
        let entry = highScores[i];
        currentX = tableX + headerPadding; // Reset X for each row

        text(entry.date || '??/??/??', currentX, rowY);
        currentX += dateColWidth;
        text(entry.name || 'Unknown', currentX, rowY);
        currentX += nameColWidth;
        text(entry.score || 0, currentX, rowY);
        currentX += scoreColWidth;
        // Convert game level to floor/zone format if available
        let floorZoneText = '?';
        if (entry.gameLevel) {
            const { floor, zone } = getLevelFloorAndZone(entry.gameLevel);
            floorZoneText = `${floor}/${zone}`;
        } else if (entry.dungeonFloor && entry.dungeonZone) {
            floorZoneText = `${entry.dungeonFloor}/${entry.dungeonZone}`;
        }
        text(floorZoneText, currentX, rowY);
        currentX += gameLvlColWidth;
        text(entry.playerLevel || '?', currentX, rowY);
        currentX += playerLvlColWidth;
        text(formatPlayTime(entry.playTime || 0), currentX, rowY);

        rowY += 21; // Slightly increased row spacing
    }
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
