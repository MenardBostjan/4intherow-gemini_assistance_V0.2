'use strict';

document.addEventListener('DOMContentLoaded', function() {
    // **IMPORTANT SECURITY WARNING:**
    // ** DO NOT EMBED YOUR ACTUAL API KEY DIRECTLY IN CLIENT-SIDE JAVASCRIPT! **
    // ** THIS IS INSECURE AND EXPOSES YOUR API KEY. **
    // ** FOR PRODUCTION, YOU MUST HANDLE API REQUESTS THROUGH A SECURE BACKEND SERVER. **
    // ** The code below is for DEVELOPMENT/TESTING PURPOSES ONLY and is INSECURE. **
    // ** In a production environment, your frontend should send requests to your backend, **
    // ** and your backend server should securely store and use the API key to communicate **
    // ** with the Gemini API.  Your backend would then relay the response back to the frontend.**
    // ** Example (Conceptual Backend Proxy): Frontend -> Your Backend API Endpoint -> Gemini API (using secure API Key) -> Your Backend -> Frontend **

    // For DEVELOPMENT/TESTING ONLY - Replace with your API key for local testing, but REMOVE for production!
    const apiKey = 'AIzaSyCb1zegvzf0iSjF6BkWrIA3KJQTfzhq3FQ'; // **REPLACE WITH YOUR ACTUAL API KEY for local testing - REMOVE FOR PRODUCTION**
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const geminiRequestTimeoutMs = 5000;
    const retryDelayMs = 1000;
    const maxRetries = 10;
    const maxInvalidMoveStreak = 10;
    const winConditionLength = 4;

    // ** Gemini API Inference Parameters - Game Moves **
    const GEMINI_MOVE_GENERATION_CONFIG = {
        temperature: 0.0,      // Deterministic for game moves
        topP: 0.1,               // Focused token sampling
        topK: 1                // Select only the most likely token
        // maxOutputTokens: 128, // No need to limit for move responses ideally
        // stopSequences: ["\n\n", "---"] // Not needed for move responses
    };

    // ** Gemini API Inference Parameters - Chat Messages **
    const GEMINI_CHAT_GENERATION_CONFIG = {
        temperature: 0.1,      // Slightly higher for chat variety
        topP: 0.1,               // Broader token sampling for chat
        topK: 1              // Top-k for chat response
        //maxOutputTokens: 256,    // Limit chat response length
        //stopSequences: ["\n\n", "---"]
    };


    const chatDisplay = document.getElementById('chat-display');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const gameBoardElement = document.getElementById('game-board');
    const newGameButton = document.getElementById('new-game-button');

    let gameBoard = [];
    const boardSize = 10;
    let currentPlayer = 'user';
    let gameActive = false;
    let lastGeminiPrompt = "";
    let invalidMoveStreak = 0;
    let userInteractionEnabled = true;
    let lastInvalidGeminiMove = null; // Store last invalid move


    function initializeGameBoard() {
        gameBoard = Array.from({ length: boardSize }, () => Array(boardSize).fill(null));
        currentPlayer = 'user';
        gameActive = true;
        renderGameBoard();
        displayMessage("New game started. You are 'O', Gemini is 'X'. Your turn.", 'gemini');
        enableGameInteraction();
        invalidMoveStreak = 0;
        lastInvalidGeminiMove = null; // Reset invalid move memory
    }

    function renderGameBoard() {
        gameBoardElement.innerHTML = '';
        gameBoardElement.style.gridTemplateColumns = `repeat(${boardSize}, 1fr)`;

        for (let row = 0; row < boardSize; row++) {
            for (let col = 0; col < boardSize; col++) {
                const cell = document.createElement('div');
                cell.classList.add('game-cell');
                cell.dataset.row = row;
                cell.dataset.col = col;

                if (gameBoard[row][col] === 'O') {
                    cell.textContent = 'O';
                    cell.classList.add('user-piece');
                } else if (gameBoard[row][col] === 'X') {
                    cell.textContent = 'X';
                    cell.classList.add('gemini-piece');
                }

                cell.addEventListener('click', handleCellClick);
                gameBoardElement.appendChild(cell);
                cell.setAttribute('aria-label', `Row ${row + 1}, Column ${col + 1}`); // Accessibility label
            }
        }
    }

    function handleCellClick(event) {
        console.log("handleCellClick() - FUNCTION TRIGGERED!");

        if (!userInteractionEnabled) {
            console.log("handleCellClick() - User interaction DISABLED - Ignoring click.");
            return;
        }

        if (!gameActive || currentPlayer !== 'user') return;


        const cell = event.target;
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);

        if (gameBoard[row][col] === null) {
            gameBoard[row][col] = 'O';
            renderGameBoard();

            if (checkWinCondition('O')) {
                endGame('user');
                return;
            }

            if (isBoardFull()) {
                endGame('draw');
                return;
            }

            currentPlayer = 'gemini';
            disableGameInteraction();
            geminiTurn();
        }
    }

    function scheduleGeminiRetry(retryCount, retryType) {
        const nextRetryCount = retryCount + 1;

        console.log(`scheduleGeminiRetry() - START - Type: ${retryType}, Attempt: ${nextRetryCount}, Delay: ${retryDelayMs}ms, invalidMoveStreak: ${invalidMoveStreak}`);

        if (retryType === 'invalidMove') {
            displayMessage(`Asking Gemini for a different move... (Retry ${nextRetryCount}/${maxRetries})`, 'gemini');
        } else if (retryType === 'formatError') {
            displayMessage(`Retrying Gemini request... (Format Retry ${nextRetryCount}/${maxRetries})`, 'gemini');
        } else if (retryType === 'timeoutError') {
            displayMessage(`Asking Gemini again... (Timeout Retry ${nextRetryCount}/${maxRetries})`, 'gemini');
        }

        console.log("scheduleGeminiRetry() - Calling setTimeout NOW - for retryCount:", nextRetryCount);
        function geminiRetryTimeoutCallback() {
            console.log(`scheduleGeminiRetry() - Timeout CALLBACK EXECUTING - Calling geminiTurn() with retryCount: ${nextRetryCount}`);
            geminiTurn(nextRetryCount);
        }
        setTimeout(geminiRetryTimeoutCallback, retryDelayMs);
        console.log("scheduleGeminiRetry() - setTimeout SET - for retryCount:", nextRetryCount);
    }


    function geminiTurn(retryCount = 0) {
        if (!gameActive || currentPlayer !== 'gemini') {
            console.log("geminiTurn() EARLY EXIT: game not active or not Gemini's turn.");
            return;
        }

        userInteractionEnabled = false;

        displayMessage("Gemini is thinking...", 'gemini');

        // Construct the detailed board situation prompt - LINE-BY-LINE description
        let boardSituation = "";
        for (let col = 0; col < boardSize; col++) {
            for (let row = 0; row < boardSize; row++) {
                let status = "empty";
                if (gameBoard[row][col] === 'O') {
                    status = "O";
                } else if (gameBoard[row][col] === 'X') {
                    status = "X";
                }
                boardSituation += `col${col}, row${row}: ${status}\n`; // Corrected to col0, row0 indexing
            }
        }

        // ** ADDED LOGGING HERE - VERY IMPORTANT **
        console.log("--- Board Situation being sent to Gemini ---");
        console.log(boardSituation);
        console.log("--- End Board Situation ---");


        let geminiPrompt = `
**Game:** 4-in-a-Row (No Gravity) on a 10x10 Grid

**
!!! VERY IMPORTANT !!!
Players:**
- **AI = You (Gemini - Plays with "X")**
- **Human User (Plays with "O")**
**

If you see 2 pieces "O" of the user together, in any directon, put your piece "X" so that it
will block 3 pieces of "O" beeing built next to another in any directon (horizontally, vertically, or diagonally).


**COORDINATE SYSTEM is (column, row) - ALWAYS respond in this format!**
Example: ("2","3") is column 2, row 3 (ZERO-BASED INDEXING!). Top-left is ("0","0").

Respond EXACTLY in this format for EVERY move:
I choose ("column","row") because: "Your detailed reasoning here..."
**If you are blocking a User "OPEN 3-THREAT", you MUST explicitly say so and identify the
LOCATION of the threat you are blocking using (column, row) coordinates.
For example: "I am blocking a vertical User Open 3-Threat in column

**IMPORTANT:  DOUBLE-CHECK your response is in (column, row) format and uses ZERO-BASED INDEXING.
Column and row numbers start at 0.  Example:  I choose ("2","3") because: ...**

**When you describe board locations in your reasoning text, please also use ZERO-BASED indexing (starting from 0). For example, refer to the top-left cell as column 0, row 0.**


**Current Board State (Precise Cell-by-Cell Description - in format: "col[ColumnNumber], row[RowNumber]: [CellStatus]")** :
\`\`\`
${boardSituation.trim()}
\`\`\`
`;

        if (retryCount > 0) {
            geminiPrompt += "\n Previous move was invalid, try again. Choose an empty cell.";
        }
        if (lastInvalidGeminiMove) {
            geminiPrompt += `\n**IMPORTANT: Your last move was invalid: (${lastInvalidGeminiMove.col},${lastInvalidGeminiMove.row}). Do NOT repeat this move. Choose a DIFFERENT EMPTY CELL.**`;
        }


        lastGeminiPrompt = geminiPrompt;

        const requestData = {
            contents: [{
                parts: [{"text": geminiPrompt}]
            }],
            // **Inference Parameters for Gemini API - Using Constant Config**
            generationConfig: GEMINI_MOVE_GENERATION_CONFIG
        };

        console.log("---------------------");
        console.log("geminiTurn() START - Retry Count:", retryCount, "invalidMoveStreak:", invalidMoveStreak);
        console.log("Gemini Prompt being sent:", geminiPrompt);
        console.log("Gemini Generation Config:", requestData.generationConfig); // Log generation config

        console.log("FETCHING Gemini API with TIMEOUT...");
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => {
            console.log("FETCH TIMEOUT REACHED! Aborting fetch.");
            abortController.abort();
        }, geminiRequestTimeoutMs);

        fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData),
            signal: abortController.signal
        })
        .then(response => {
            clearTimeout(timeoutId);
            console.log("FETCH Promise RESOLVED.");
            if (!response.ok) {
                const errorMsg = `HTTP error! status: ${response.status}, text: ${response.statusText}`;
                console.error("FETCH ERROR:", errorMsg);
                throw new Error(errorMsg);
            }
            return response.json();
        })
        .then(geminiResponseJson => {
            clearTimeout(timeoutId);
            console.log("Gemini API Response RECEIVED (JSON):", geminiResponseJson);

            let moveMatch;
            let explanation = "Gemini move.";
            let row, col;


            let geminiResponseText = "";
            if (geminiResponseJson && geminiResponseJson.candidates && geminiResponseJson.candidates[0] && geminiResponseJson.candidates[0].content && geminiResponseJson.candidates[0].content.parts && geminiResponseJson.candidates[0].content.parts[0]) {
                geminiResponseText = geminiResponseJson.candidates[0].content.parts[0].text;
            } else {
                console.error("Error: Could not extract text from Gemini response JSON. Check response structure.");
                displayMessage("Error processing Gemini response.", 'gemini');
                return;
            }
            console.log("Gemini API Response RECEIVED (Raw Text Extracted):", geminiResponseText);

            // Refined regex to capture "column" and "row" labels (optional, for clarity)
            moveMatch = geminiResponseText.match(/I choose \("?(\d+)"?,"?(\d+)"?\) because:\s*(.*)/s);


            if (moveMatch) {
                // Explicitly parse column and row (in (column, row) order)
                const parsedCol = parseInt(moveMatch[1]); // First captured group is column
                const parsedRow = parseInt(moveMatch[2]); // Second captured group is row

                col = parsedCol;
                row = parsedRow;
                explanation = moveMatch[3].trim();


                console.log("Gemini Move - Parsed Col:", col, ", Parsed Row:", row); // Log in (column, row) order
                console.log("Checking move validity - Row:", row, "Col:", col, "Board Cell Content:", gameBoard[row][col]);

                if (row >= 0 && row < boardSize && col >= 0 && col < boardSize && gameBoard[row][col] === null) {
                    console.log("Applying Gemini move - Row:", row, "Col:", col, "Board BEFORE move:", gameBoard);
                    gameBoard[row][col] = 'X';
                    renderGameBoard();
                    displayMessage(`Gemini played at column ${col}, row ${row}.`, 'gemini'); // Display in (column, row) ZERO-based to user
                    displayMessage(`Reasoning: ${explanation}`, 'gemini');
                    invalidMoveStreak = 0;
                    lastInvalidGeminiMove = null; // Reset invalid move memory after valid move

                    if (checkWinCondition('X')) {
                        endGame('gemini');
                        return;
                    }

                    if (isBoardFull()) {
                        endGame('draw');
                        return;
                    }

                    currentPlayer = 'user';
                    enableGameInteraction();
                    console.log("geminiTurn() EXIT - Valid move processed.");
                    return;
                } else {
                    console.error("Gemini returned an INVALID move (parsed):", { col, row }); // Log invalid move in (col, row)
                    console.log("Invalid Move Details - Row:", row, ", Col:", col);
                    console.log("Board State at Invalid Move:", gameBoard);
                    displayMessage("Gemini returned an invalid move.", 'gemini');
                    invalidMoveStreak++;
                    lastInvalidGeminiMove = { col: col, row: row }; // Store invalid move

                    if (retryCount < maxRetries && invalidMoveStreak <= maxInvalidMoveStreak) {
                        console.log("geminiTurn() - Calling scheduleGeminiRetry for invalidMove - retryCount:", retryCount, "invalidMoveStreak:", invalidMoveStreak);
                        scheduleGeminiRetry(retryCount, 'invalidMove');
                        console.log("geminiTurn() EXIT - scheduleGeminiRetry called (invalid move).");
                        return;
                    } else {
                        console.error("Max retries or invalid move streak reached. Gemini forfeits turn.");
                        displayMessage("Gemini is having trouble making valid moves. Gemini forfeits turn.", 'gemini');
                        currentPlayer = 'user';
                        enableGameInteraction();
                        console.log("geminiTurn() EXIT - Gemini forfeits turn (max retries/streak).");
                        return;
                    }
                }


            } else {
                clearTimeout(timeoutId);
                console.error("Gemini response format NOT RECOGNIZED:", geminiResponseJson);
                displayMessage("Gemini's response format was not understood.", 'gemini');
                displayMessage("Raw Gemini Response (for debugging - check console): " + JSON.stringify(geminiResponseJson), 'gemini');

                if (retryCount < maxRetries) {
                    console.log("geminiTurn() - Calling scheduleGeminiRetry for formatError - retryCount:", retryCount);
                    scheduleGeminiRetry(retryCount, 'formatError');
                    console.log("geminiTurn() EXIT - scheduleGeminiRetry called (format error).");
                    return;
                } else {
                    console.error("Max retries reached. Ending game due to Gemini error.");
                    displayMessage("Max retries reached. Gemini is having trouble. Game Over.", 'gemini');
                    endGame('gemini_error');
                    console.log("geminiTurn() EXIT - Game Over (max retries - format error).");
                    return;
                }
            }


        })
        .catch(error => {
            clearTimeout(timeoutId);
            const errorMsg = `Fetch error (Gemini Move): ${error}`;
            console.error("FETCH CATCHED ERROR:", errorMsg);
             if (error.name === 'AbortError') {
                displayMessage("Gemini API request timed out. Retrying...", 'gemini');
                 if (retryCount < maxRetries) {
                    scheduleGeminiRetry(retryCount, 'timeoutError');
                    console.log("geminiTurn() EXIT - scheduleGeminiRetry called (timeout error).");
                    return;
                } else {
                    console.error("Max retries reached after timeout errors. Gemini forfeits turn.");
                    displayMessage("Gemini is taking too long to respond. Game Over.", 'gemini');
                    endGame('gemini_timeout_error');
                    console.log("geminiTurn() EXIT - Game Over (timeout error).");
                    return;
                }
            } else {
                displayMessage("Error communicating with Gemini API (Fetch Error).", 'gemini');
                endGame('gemini_error');
                console.log("geminiTurn() EXIT - Game Over (generic fetch error).");
                return;
            }
        })
        .finally(() => {
            console.log("geminiTurn() FINALLY block - Turn End.");
            console.log("---------------------");
        });

        console.log("geminiTurn() EXIT - After fetch initiation.");
        return;
    }


    function checkWinCondition(player) {
        const directions = [
            { dx: 1, dy: 0 },
            { dx: 0, dy: 1 },
            { dx: 1, dy: 1 },
            { dx: 1, dy: -1 }
        ];

        for (let row = 0; row < boardSize; row++) {
            for (let col = 0; col < boardSize; col++) {
                if (gameBoard[row][col] === player) {
                    for (const dir of directions) {
                        let count = 1;
                        for (let i = 1; i < winConditionLength; i++) {
                            const checkRow = row + i * dir.dy;
                            const checkCol = col + i * dir.dx;

                            if (checkRow >= 0 && checkRow < boardSize && checkCol >= 0 && checkCol < boardSize && gameBoard[checkRow][checkCol] === player) {
                                count++;
                            } else {
                                break;
                            }
                        }
                        if (count >= winConditionLength) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }


    function isBoardFull() {
        for (let row = 0; row < boardSize; row++) {
            for (let col = 0; col < boardSize; col++) {
                if (gameBoard[row][col] === null) {
                    return false;
                }
            }
        }
        return true;
    }


    function endGame(winner) {
        gameActive = false;
        disableGameInteraction();

        let message = '';
        if (winner === 'user') {
            message = "Congratulations! You won!";
        } else if (winner === 'gemini') {
            message = "Gemini wins! Better luck next time.";
        } else if (winner === 'draw') {
            message = "It's a draw! The board is full.";
        } else if (winner === 'gemini_error') {
            message = "Game ended due to an error from Gemini.";
        } else if (winner === 'gemini_timeout_error') {
            message = "Game ended because Gemini took too long to respond.";
        }
        displayMessage(message, 'system');
    }


    function displayMessage(message, sender) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');
        messageElement.classList.add(`${sender}-message`);
            messageElement.textContent = message;
        chatDisplay.appendChild(messageElement);
        chatDisplay.scrollTop = chatDisplay.scrollHeight;
    }

    function enableGameInteraction() {
        console.log("enableGameInteraction() CALLED!");
        userInteractionEnabled = true;
        gameBoardElement.classList.remove('disabled');
    }

    function disableGameInteraction() {
        userInteractionEnabled = false;
        gameBoardElement.classList.add('disabled');
    }


    // Event listeners
    newGameButton.addEventListener('click', initializeGameBoard);

    sendButton.addEventListener('click', function() {
        const messageText = messageInput.value;
        sendMessageToGemini(messageText);
        messageInput.value = '';
    });

    messageInput.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            const messageText = messageInput.value;
            sendMessageToGemini(messageText);
            messageInput.value = '';
        }
    });

    function sendMessageToGemini(messageText) {
        if (!messageText.trim()) return;
        displayMessage(messageText, 'user');

        const requestData = {
            contents: [{
                parts: [{"text": messageText}]
            }],
            // **Inference Parameters for Gemini API - Using Constant Config for Chat**
            generationConfig: GEMINI_CHAT_GENERATION_CONFIG
        };

        fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log("Gemini API Response (Chat):", data);
            let geminiResponseText = "Error getting response.";
            if (data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
                geminiResponseText = data.candidates[0].content.parts[0].text;
            }
            displayMessage(geminiResponseText, 'gemini');
        })
        .catch(error => {
            console.error("Fetch error (Chat):", error);
            displayMessage("Error communicating with Gemini API.", 'gemini');
        });
    }


    // Initial setup - start game automatically on load
    initializeGameBoard();

});