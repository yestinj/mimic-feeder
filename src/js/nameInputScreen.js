function handleNameInputScreenKeyPressed() {
    // Check game state flags
    if (gameState.gameOver && gameState.enteringName) {
        if (keyCode === ENTER) {
            submitName(); // Finalize name and score
        } else if (keyCode === BACKSPACE) {
            // Modify gameState.currentNameInput
            gameState.currentNameInput = gameState.currentNameInput.slice(0, -1);
        }
        return true; // Indicate key was processed by name input
    }
    return false;
}

function handleNameInputScreenKeyTyped() {
    // Check game state flags
    if (gameState.gameOver && gameState.enteringName) {
        // Allow only alphanumeric characters and limit length using constant
        if (key.match(/^[a-zA-Z0-9 ]*$/) && key.length === 1 && gameState.currentNameInput.length < NAME_INPUT_MAX_LENGTH) {
            gameState.currentNameInput += key;
        }
        return true; // Indicate key was processed by name input
    }
    return false;
}

function handleNameInputScreenMousePressed() {
    // Check game state flags
    if (gameState.gameOver && gameState.enteringName) {
        // Check if click is within submit button bounds
        if (mouseX > submitButton.x && mouseX < submitButton.x + submitButton.w &&
            mouseY > submitButton.y && mouseY < submitButton.y + submitButton.h) {
            submitName(); // Submit via button click
        }
        // Click anywhere else on this screen doesn't do anything else
        return true; // Indicate mouse event was handled (or ignored) by this screen
    }
    return false;
}