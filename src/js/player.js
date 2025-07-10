let player;

function setupPlayer() {
    if (!chestClosedImage || !chestClosedImage.width || !chestClosedImage.height) {
        console.error("chestClosedImage not loaded!");
        chestClosedImage = {width: 100, height: 80};
    }
    let naturalWidth = chestClosedImage.width;
    let naturalHeight = chestClosedImage.height;
    let playerWidth = naturalWidth * PLAYER_INITIAL_SCALE;
    let playerHeight = naturalHeight * PLAYER_INITIAL_SCALE;

    player = {
        x: width / 2,
        y: height - PLAYER_GROUND_Y_OFFSET - playerHeight,
        w: playerWidth,
        h: playerHeight,
        speed: PLAYER_INITIAL_SPEED,
        vy: 0,
        jumpPower: PLAYER_JUMP_POWER,
        jumps: 0,
        maxJumps: PLAYER_MAX_JUMPS
    };
    player.speed *= (playerState.speedPercentage / 100.0);
}

function updatePlayer() {
    // Only apply normal movement if not dashing
    if (!playerState.isDashing) {
        if (keyIsDown(LEFT_ARROW) || keyIsDown(65)) { // 65 is keyCode for 'A'
            player.x -= player.speed;
        }
        if (keyIsDown(RIGHT_ARROW) || keyIsDown(68)) { // 68 is keyCode for 'D'
            player.x += player.speed;
        }
    } else {
        // Reset isDashing after one frame
        playerState.isDashing = false;
    }

    // Update dash cooldown
    if (playerState.dashCooldown > 0) {
        playerState.dashCooldown--;
    }

    player.x = constrain(player.x, 0, width - player.w);

    player.vy += PLAYER_GRAVITY;
    player.y += player.vy;

    let groundY = height - PLAYER_GROUND_Y_OFFSET - player.h;
    if (player.y > groundY) {
        player.y = groundY;
        player.vy = 0;
        player.jumps = 0;
    }
}

function handlePlayerJump() {
    if ((keyCode === UP_ARROW || keyCode === 87) && player.jumps < player.maxJumps) { // 87 is keyCode for 'W'
        player.vy = player.jumpPower;
        player.jumps += 1;
        if (player.jumps === 1) {
            playSound('jump');
        } else if (player.jumps === 2) {
            playSound('double_jump');
        }
    }
}

function resetPlayer() {
    if (chestClosedImage && chestClosedImage.width) {
        player.w = chestClosedImage.width * PLAYER_INITIAL_SCALE * (playerState.sizePercentage / 100.0);
        player.h = chestClosedImage.height * PLAYER_INITIAL_SCALE * (playerState.sizePercentage / 100.0);
    }
    player.x = width / 2;
    player.y = height - PLAYER_GROUND_Y_OFFSET - player.h;
    player.vy = 0;
    player.jumps = 0;
    player.speed = PLAYER_INITIAL_SPEED * (playerState.speedPercentage / 100.0);
    let jumpMultiplier = Math.pow(PLAYER_JUMP_INCREASE_PER_LEVEL, playerState.level - 1);
    player.jumpPower = PLAYER_JUMP_POWER * jumpMultiplier;
}


function isPlayerCloseToObject() {
    let padding = PLAYER_NEARBY_DISTANCE;
    for (let obj of objects) {
        if (obj.type === OBJ_SMALL_BOMB || obj.type === OBJ_FIREBALL) {
            continue; // Skip bombs and fireballs for this "open mouth" proximity check
        }

        if (collideRectRect(
            player.x - padding, player.y - padding, player.w + padding * 2, player.h + padding * 2,
            obj.x - obj.w / 2, obj.y - obj.h / 2, obj.w, obj.h
        )) {
            return true; // Found a close non-bomb/non-fireball object
        }
    }
    return false; // No non-bomb/non-fireball objects are close
}

function drawPlayer() {
    let currentImage = chestClosedImage;
    let isMoving = keyIsDown(LEFT_ARROW) || keyIsDown(RIGHT_ARROW) || keyIsDown(65) || keyIsDown(68); // Check for A (65) and D (68) keys too
    let isJumping = player.y < (height - PLAYER_GROUND_Y_OFFSET - player.h);
    let isNearObject = isPlayerCloseToObject(); // This now excludes bombs

    if (playerState.usingTentacles || openChestTimer > 0) {
        currentImage = chestOpenImage;
    } else if (jumpEatOpenTimer > 0) {
        currentImage = chestOpenImage;
    } else if (shadowBoltAjarTimer > 0) {
        currentImage = chestAjarImage;
    } else if (isNearObject) { // isNearObject is true only for non-bombs
        currentImage = chestOpenImage;
        if (isJumping && !playerState.usingTentacles && openChestTimer <= 0 && shadowBoltAjarTimer <= 0) {
            jumpEatOpenTimer = JUMP_EAT_OPEN_DURATION;
        }
    } else if (isJumping) {
        currentImage = chestAjarImage;
    } else if (isMoving) {
        currentImage = chestAjarImage;
    }

    if (currentImage && currentImage.width) {
        image(currentImage, player.x, player.y, player.w, player.h);
    } else if (chestClosedImage && chestClosedImage.width) {
        image(chestClosedImage, player.x, player.y, player.w, player.h);
    } else {
        fill(150, 75, 0);
        rect(player.x, player.y, player.w, player.h);
    }
}
