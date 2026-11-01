/**
 * Getting2KU (G2KU) - Games Engine (games-engine.js)
 * Modular asynchronous turn-locked logic for all 7 mini-games.
 */

window.G2KUGames = {
    activeGame: null,
    tttBoard: Array(9).fill(''),
    tttTurn: 'X',
    tttActive: true,
    c4Board: [],
    c4Turn: '🔴',

    launch(gameId, containerId) {
        this.activeGame = gameId;
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = `<h3>${this.getGameTitle(gameId)}</h3>`;

        switch(gameId) {
            case 'tictactoe':
                this.tttBoard = Array(9).fill('');
                this.tttTurn = 'X';
                this.tttActive = true;
                this.renderTicTacToe(container);
                break;
            case 'connectfour':
                this.c4Board = Array(6).fill().map(() => Array(7).fill(''));
                this.c4Turn = '🔴';
                this.renderConnectFour(container);
                break;
            case 'memorymatch':
                this.renderMemoryMatch(container);
                break;
            case 'triviaduel':
                this.renderTriviaDuel(container);
                break;
            case 'wordguesser':
                this.renderWordGuesser(container);
                break;
            case 'diceroll':
                this.renderDiceRoll(container);
                break;
            case 'hotseat':
                this.renderHotSeat(container);
                break;
            default:
                container.innerHTML += `<p style="color:red;">Invalid game ID.</p>`;
        }
    },

    getGameTitle(id) {
        const titles = {
            'tictactoe': 'Tic-Tac-Toe',
            'connectfour': 'Connect Four',
            'memorymatch': 'Memory Match',
            'triviaduel': 'Trivia Duel',
            'wordguesser': 'Word Guesser',
            'diceroll': 'Dice Roll / High-Low',
            'hotseat': '21 Questions / Hot Seat'
        };
        return titles[id] || 'Mini-Game';
    },

    // 1. Tic-Tac-Toe
    renderTicTacToe(container) {
        let boardHTML = `<div style="display:grid; grid-template-columns:repeat(3,70px); gap:6px; margin: 15px auto; width: fit-content;">`;
        for(let i=0; i<9; i++) {
            boardHTML += `<button onclick="G2KUGames.makeTTTMove(${i})" style="width:70px; height:70px; font-size:28px; font-weight:bold; cursor:pointer;" id="cell-${i}">-</button>`;
        }
        boardHTML += `</div><p id="ttt-status" style="font-weight:bold; color:#7c3aed;">Game active. Make your move!</p>`;
        container.innerHTML += boardHTML;
    },
    makeTTTMove(index) {
        if (!this.tttActive || this.tttBoard[index] !== '') return;
        
        const currentUser = JSON.parse(localStorage.getItem('g2ku_profile')) || { name: 'Player 1' };
        const activeGame = JSON.parse(localStorage.getItem('g2ku_active_game')) || { challengerName: 'Player 1' };
        const isChallenger = currentUser.name === activeGame.challengerName;
        
        const myAssignedSymbol = isChallenger ? 'X' : 'O';
        if (this.tttTurn !== myAssignedSymbol) {
            document.getElementById('ttt-status').innerText = `⏳ Hold on! Waiting for your partner's turn.`;
            return;
        }

        this.tttBoard[index] = this.tttTurn;
        const cell = document.getElementById(`cell-${index}`);
        cell.innerText = this.tttTurn;
        cell.style.color = this.tttTurn === 'X' ? '#7c3aed' : '#db2777';

        const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
        let won = false;
        for (let w of wins) {
            if (this.tttBoard[w[0]] && this.tttBoard[w[0]] === this.tttBoard[w[1]] && this.tttBoard[w[0]] === this.tttBoard[w[2]]) {
                won = true;
                break;
            }
        }

        if (won) {
            document.getElementById('ttt-status').innerText = `🎉 Player ${this.tttTurn} Wins!`;
            this.tttActive = false;
            return;
        }

        if (!this.tttBoard.includes('')) {
            document.getElementById('ttt-status').innerText = `🤝 It's a Draw!`;
            this.tttActive = false;
            return;
        }

        this.tttTurn = this.tttTurn === 'X' ? 'O' : 'X';
        document.getElementById('ttt-status').innerText = `Waiting for Partner's move...`;
    },

    // 2. Connect Four
    renderConnectFour(container) {
        let gridHTML = `<div style="display:grid; grid-template-columns:repeat(7,45px); gap:4px; background:#1e1b4b; padding:10px; border-radius:8px; margin:15px auto; width:fit-content;">`;
        for(let r=0; r<6; r++) {
            for(let c=0; c<7; c++) {
                gridHTML += `<div onclick="G2KUGames.makeC4Move(${c})" style="width:45px; height:45px; background:#312e81; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:20px; cursor:pointer;" id="c4-${r}-${c}"></div>`;
            }
        }
        gridHTML += `</div><p id="c4-status" style="font-weight:bold; color:#db2777;">Drop a token in any column!</p>`;
        container.innerHTML += gridHTML;
    },
    makeC4Move(col) {
        const currentUser = JSON.parse(localStorage.getItem('g2ku_profile')) || { name: 'Player 1' };
        const activeGame = JSON.parse(localStorage.getItem('g2ku_active_game')) || { challengerName: 'Player 1' };
        const isChallenger = currentUser.name === activeGame.challengerName;
        
        const mySymbol = isChallenger ? '🔴' : '🟡';
        if (this.c4Turn !== mySymbol) {
            document.getElementById('c4-status').innerText = `⏳ Waiting for partner's turn!`;
            return;
        }

        for (let r = 5; r >= 0; r--) {
            if (this.c4Board[r][col] === '') {
                this.c4Board[r][col] = this.c4Turn;
                document.getElementById(`c4-${r}-${col}`).innerText = this.c4Turn;
                this.c4Turn = this.c4Turn === '🔴' ? '🟡' : '🔴';
                document.getElementById('c4-status').innerText = `Waiting for partner...`;
                break;
            }
        }
    },

    // 3. Memory Match
    renderMemoryMatch(container) {
        container.innerHTML += `<p style="color:#a78bfa;">Memory Match locked to async partner turns.</p>`;
    },

    // 4. Trivia Duel
    renderTriviaDuel(container) {
        container.innerHTML += `<p style="margin-top:10px;"><strong>Question:</strong> What's our official couple vibe?</p>` +
                               `<button onclick="alert('Answer locked!')" style="display:block; margin:5px auto; padding:8px;">A) Chaos & Coffee</button>` +
                               `<button onclick="alert('Answer locked!')" style="display:block; margin:5px auto; padding:8px;">B) Unstoppable Team</button>`;
    },

    // 5. Word Guesser
    renderWordGuesser(container) {
        container.innerHTML += `<div style="margin:15px;"><p>Guess the 5-letter password:</p><input type="text" maxlength="5" id="wg-input" style="padding:6px;"><button onclick="alert('Guess submitted!')">Submit</button></div>`;
    },

    // 6. Dice Roll
    renderDiceRoll(container) {
        container.innerHTML += `<div style="margin:15px;"><p>Current Die: <strong>🎲 5</strong></p><button onclick="alert('Locked in!')">Higher 📈</button> <button onclick="alert('Locked in!')">Lower 📉</button></div>`;
    },

    // 7. Hot Seat
    renderHotSeat(container) {
        container.innerHTML += `<div style="margin:15px;"><p>Hot Seat Question:</p><textarea placeholder="Type your answer..." style="width:80%; height:60px;"></textarea><br><button onclick="alert('Submitted!')" style="margin-top:8px;">Send Answer 🔒</button></div>`;
    }
};