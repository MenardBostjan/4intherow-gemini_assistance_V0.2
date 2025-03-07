# Gemini Chat & 4-in-a-Row Game

This project combines a simple "4-in-a-Row" game with a chat interface, designed to potentially interact with the Gemini AI model.

## Features

*   **4-in-a-Row Game:** A classic grid-based game where two players (or a player vs. AI) take turns dropping pieces into columns, aiming to get four of their pieces in a row (horizontally, vertically, or diagonally).
*   **Gemini Chat:** A chat window that allows users to send messages, potentially to the Gemini AI model for conversation or game-related assistance.
*   **New Game Button:** Restarts the 4-in-a-row game.
*   **Dark Mode:** The website uses a Dark mode as default.
* **Clean Structure:** The HTML shows a separation between the 4-in-a-row game and the chat windows.

## Files

*   `index_4row.html`: The main HTML file, defining the structure of the game board and the chat window.
*   `style_4row.css`:  (Assumed) Styles the appearance of the game and chat.
*   `script_4row.js`: (Assumed) Contains the JavaScript logic for the game and the chat interactions.

## How It Works (Based on Structure)

1.  **Game Board:** The `#game-board` div is a placeholder where the 4-in-a-Row grid will be dynamically created using JavaScript.
2.  **Chat Window:** The `#chat-window` div contains the chat interface, including:
    *   `#chat-header`: Displays the title "Gemini Chat".
    *   `#chat-display`:  Shows the chat message history.
    *   `#chat-input-area`: Contains the message input and send button.
    * `#new-game-button`: Restarts the game.
    * `#chat-form`: Form for sending messages.
    * `#message-input`: Text area for writing messages.
    * `#send-button`: Button to send the message.
3.  **Scripting:** The `script_4row.js` file likely handles:
    *   Creating the game board.
    *   Managing game turns and logic.
    *   Handling user input in the chat.
    *   Potentially communicating with the Gemini AI (implementation not provided).

## Potential Enhancements

* Implement the Gemini AI interaction.
* Add players turn management.
* Add a Game over condition.
* Add a way to see who is the winner.
* Add game's rules display.

## Getting Started

1.  Ensure you have all the files (`index_4row.html`, `style_4row.css`, `script_4row.js`) in the same directory.
2.  Open `index_4row.html` in your web browser.

## Note
This readme is generated based on the `index_4row.html` file provided. A complete readme should have a full `script_4row.js` and `style_4row.css` files description.
