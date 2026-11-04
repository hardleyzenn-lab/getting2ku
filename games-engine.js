/**
 * Getting2KU (G2KU) - Games Engine (games-engine.js)
 * Modular asynchronous turn-locked logic for the mini-games.
 */

window.G2KUGames = {
    activeGame: null,
    ticTacToeState: null,
    c4Board: [],
    c4Turn: '🔴',

    launch(gameId, containerId) {
        this.activeGame = gameId;
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = `<h3>${this.getGameTitle(gameId)}</h3>`;

        switch(gameId) {
            case 'tictactoe':
                this.renderTicTacToe(container, this.ticTacToeState);
                break;
            case 'connectfour':
                this.c4Board = Array(6).fill().map(() => Array(7).fill(''));
                this.c4Turn = '🔴';
                this.renderConnectFour(container);
                break;
            case 'memorymatch':
                this.renderMemoryMatch(container);
                break;
            default:
                container.innerHTML += `<p style="color:red;">Invalid game ID.</p>`;
        }
    },

    getGameTitle(id) {
        const titles = {
            'tictactoe': 'Tic-Tac-Toe',
            'connectfour': 'Connect Four',
            'memorymatch': 'Memory Match'
        };
        return titles[id] || 'Mini-Game';
    },

    renderTicTacToe(container, state) {
        if (!state) {
            container.innerHTML += '<p>Join or create a paired room to start a series.</p>';
            return;
        }

        const myRole = state.myRole ||
            (state.players.host.id === window.G2KURoomClient.getPlayerId() ? 'host' : 'guest');
        const round = state.currentRound;
        const section = document.createElement('section');
        section.className = 'ttt-match';

        const seriesHeader = document.createElement('div');
        seriesHeader.className = 'ttt-series-header';
        const roundTitle = document.createElement('p');
        roundTitle.className = 'ttt-round-title';
        roundTitle.textContent = state.status === 'complete' ? 'Series complete' : `Round ${state.roundNumber}`;
        const roundCount = document.createElement('span');
        roundCount.className = 'ttt-round-count';
        roundCount.textContent = 'BEST OF 5';
        seriesHeader.append(roundTitle, roundCount);
        section.appendChild(seriesHeader);

        const scoreRow = document.createElement('div');
        scoreRow.className = 'ttt-players';
        for (const role of ['host', 'guest']) {
            const player = state.players[role];
            const playerCard = document.createElement('div');
            playerCard.className = `ttt-player${role === myRole ? ' is-you' : ''}`;
            const playerInfo = document.createElement('div');
            playerInfo.className = 'ttt-player-info';
            const token = document.createElement('span');
            token.className = 'ttt-player-token';
            token.textContent = player.token;
            const playerName = document.createElement('span');
            playerName.className = 'ttt-player-name';
            playerName.textContent = player.name;
            const playerStats = document.createElement('div');
            playerStats.className = 'ttt-player-stats';
            const points = document.createElement('small');
            points.textContent = `${state.points[role]} points`;
            playerStats.append(playerName, points);
            playerInfo.append(token, playerStats);
            const playerScore = document.createElement('strong');
            playerScore.className = 'ttt-player-score';
            playerScore.textContent = String(state.wins[role]);
            playerScore.setAttribute('aria-label', `${state.wins[role]} round wins`);
            playerCard.append(playerInfo, playerScore);
            scoreRow.appendChild(playerCard);
        }
        section.appendChild(scoreRow);

        const roundProgress = document.createElement('div');
        roundProgress.className = 'ttt-round-progress';
        for (let index = 1; index <= 5; index += 1) {
            const roundMarker = document.createElement('span');
            roundMarker.className = `ttt-round-marker${index < state.roundNumber ? ' is-played' : ''}` +
                `${index === state.roundNumber ? ' is-current' : ''}`;
            roundMarker.setAttribute('aria-label', `Round ${index}`);
            roundProgress.appendChild(roundMarker);
        }
        section.appendChild(roundProgress);

        const board = document.createElement('div');
        board.className = 'ttt-board';
        for (let index = 0; index < round.board.length; index += 1) {
            const role = round.board[index];
            const cell = document.createElement('button');
            cell.type = 'button';
            cell.textContent = role ? state.players[role].token : '';
            cell.setAttribute('aria-label', `Cell ${index + 1}${role ? `, ${state.players[role].name}` : ', empty'}`);
            cell.className = 'ttt-cell';
            cell.disabled = Boolean(role) || state.status !== 'active' ||
                round.status !== 'active' || round.turn !== myRole;
            if (!cell.disabled) {
                cell.style.cursor = 'pointer';
                cell.addEventListener('click', () => window.submitTicTacToeMove(index));
            }
            board.appendChild(cell);
        }
        section.appendChild(board);

        const status = document.createElement('p');
        status.id = 'ttt-status';
        status.className = 'ttt-status';
        if (state.optimisticMove) {
            status.textContent = 'Move sent! Your partner is up.';
            status.classList.add('is-waiting');
        } else if (state.status === 'complete') {
            status.textContent = state.seriesWinner
                ? `🏆 ${state.players[state.seriesWinner].name} takes the series!`
                : 'The series ends in a draw.';
            status.classList.add('is-result');
        } else if (round.status === 'complete') {
            status.textContent = round.winner
                ? `${round.result?.message || 'Round complete.'} ${state.points[round.winner]} points`
                : 'It’s a draw! 2 points each.';
            status.classList.add('is-result');
        } else if (round.turn === myRole) {
            status.textContent = 'Your turn — make a move!';
            status.classList.add('is-your-turn');
        } else {
            status.textContent = `${state.players[round.turn].name} is up next`;
            status.classList.add('is-waiting');
        }
        section.appendChild(status);

        const earnedBadges = ['host', 'guest'].flatMap(role =>
            state.badges[role].map(badge => `${state.players[role].name}: ${badge}`));
        if (earnedBadges.length) {
            const badges = document.createElement('p');
            badges.className = 'ttt-badges';
            badges.textContent = earnedBadges.join('  ·  ');
            section.appendChild(badges);
        }

        if (round.status === 'complete' && state.status === 'active') {
            const nextRound = document.createElement('button');
            nextRound.type = 'button';
            nextRound.className = 'ttt-action-button';
            nextRound.textContent = `Play Round ${state.roundNumber + 1}`;
            nextRound.addEventListener('click', () => window.advanceTicTacToeRound());
            section.appendChild(nextRound);
        }
        if (state.status === 'complete') {
            const newSeries = document.createElement('button');
            newSeries.type = 'button';
            newSeries.className = 'ttt-action-button';
            newSeries.textContent = 'Play Again';
            newSeries.addEventListener('click', () => window.startNewTicTacToeSeries());
            section.appendChild(newSeries);
        }

        container.appendChild(section);
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
    }
};