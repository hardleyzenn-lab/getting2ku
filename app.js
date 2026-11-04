let registrationEmail = '';
let recoveryEmail = '';
let activeTicTacToeRoom = '';
let activeTicTacToeMatch = '';
let ticTacToeMovePending = false;
let ticTacToeStartPending = false;

async function postAuthRequest(path, data) {
    if (window.location.protocol === 'file:') {
        throw new Error('Open Getting2KU through the server URL, not as a local file, to use accounts.');
    }

    let response;
    try {
        response = await fetch(path, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    } catch (error) {
        console.error('Unable to reach the account server:', error);
        throw new Error('Could not reach the account server. Check your connection and try again.');
    }

    const result = await response.json().catch(error => {
        console.error('The account server returned an unreadable response:', error);
        throw new Error('The account server returned an invalid response.');
    });
    if (!response.ok) throw new Error(result.error || 'The account request failed.');
    return result;
}

function setAuthStatus(id, message, isError = false) {
    const status = document.getElementById(id);
    if (!status) return;
    status.textContent = message;
    status.classList.toggle('is-error', isError);
}

function savePublicProfile(user) {
    localStorage.setItem('g2ku_profile', JSON.stringify({
        id: user.id,
        name: user.name,
        email: user.email,
        tier: user.tier
    }));
    localStorage.removeItem('g2ku_user');
}

async function handleSignUpSubmit(event) {
    event.preventDefault();

    setAuthStatus('signUpStatus', '');
    try {
        const result = await postAuthRequest('/api/auth/register/request', {
            name: document.getElementById('regName').value.trim(),
            email: document.getElementById('regEmail').value.trim(),
            dob: document.getElementById('regDob').value,
            password: document.getElementById('regPassword').value,
            securityQuestion: document.getElementById('regSecQuestion').value,
            securityAnswer: document.getElementById('regSecAnswer').value.trim()
        });
        registrationEmail = document.getElementById('regEmail').value.trim().toLowerCase();
        event.currentTarget.hidden = true;
        document.getElementById('registerVerificationForm').hidden = false;
        setAuthStatus('registerVerificationStatus', result.message);
    } catch (error) {
        setAuthStatus('signUpStatus', error.message, true);
    }
}

async function handleRegisterVerificationSubmit(event) {
    event.preventDefault();
    setAuthStatus('registerVerificationStatus', '');
    try {
        const result = await postAuthRequest('/api/auth/register/complete', {
            email: registrationEmail,
            code: document.getElementById('registerCode').value.trim()
        });
        savePublicProfile(result.user);
        window.location.href = 'newuser.html';
    } catch (error) {
        setAuthStatus('registerVerificationStatus', error.message, true);
    }
}

// Toggle sub-views within Auth Card
function switchAuthSubView(viewName) {
    document.getElementById('signInSection').style.display = viewName === 'signIn' ? 'block' : 'none';
    document.getElementById('forgotPinSection').style.display = viewName === 'forgotPin' ? 'block' : 'none';
    document.getElementById('lostEmailSection').style.display = viewName === 'lostEmail' ? 'block' : 'none';
    if (viewName === 'forgotPin') {
        document.getElementById('recoveryDetailsForm').hidden = false;
        document.getElementById('resetPasswordForm').hidden = true;
    }
}

async function handleDemoLogin(accountId) {
    setAuthStatus('demoAccountStatus', '');
    try {
        const result = await postAuthRequest('/api/auth/demo-login', { accountId });
        savePublicProfile(result.user);
        window.location.href = 'me%26u.html';
    } catch (error) {
        setAuthStatus('demoAccountStatus', error.message, true);
    }
}

async function loadDemoAccounts() {
    const section = document.getElementById('demoAccountsSection');
    const buttons = document.getElementById('demoAccountButtons');
    if (!section || !buttons || window.location.protocol === 'file:') return;

    try {
        const response = await fetch('/api/auth/demo-accounts', { credentials: 'same-origin' });
        if (response.status === 404) return;
        if (!response.ok) throw new Error('Could not load development demo accounts.');
        const result = await response.json();
        for (const account of result.accounts) {
            if (!['free', 'unlocked'].includes(account.id)) continue;
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'action-button';
            button.textContent = account.id === 'free'
                ? 'Use Free Tier Demo'
                : 'Use Unlocked Tier Demo';
            button.addEventListener('click', () => handleDemoLogin(account.id));
            buttons.appendChild(button);
        }
        section.hidden = buttons.childElementCount === 0;
    } catch (error) {
        console.error('Unable to load development demo accounts:', error);
    }
}

document.addEventListener('DOMContentLoaded', loadDemoAccounts);

async function handleSignInSubmit(event) {
    event.preventDefault();
    setAuthStatus('signInStatus', '');
    try {
        const result = await postAuthRequest('/api/auth/login', {
            email: document.getElementById('signInEmail').value.trim(),
            password: document.getElementById('signInPassword').value
        });
        savePublicProfile(result.user);
        const authView = document.getElementById('authView');
        const roomView = document.getElementById('roomView');
        if (authView && roomView) {
            authView.classList.remove('active');
            roomView.classList.add('active');
        } else {
            window.location.href = 'me%26u.html';
        }
    } catch (error) {
        setAuthStatus('signInStatus', error.message, true);
    }
}

async function handleRecoveryRequestSubmit(event) {
    event.preventDefault();
    setAuthStatus('recoveryStatus', '');
    try {
        const result = await postAuthRequest('/api/auth/recovery/request', {
            email: document.getElementById('recEmail').value.trim(),
            dob: document.getElementById('recDob').value,
            securityQuestion: document.getElementById('recSecQuestion').value,
            securityAnswer: document.getElementById('recSecAnswer').value.trim()
        });
        recoveryEmail = document.getElementById('recEmail').value.trim().toLowerCase();
        document.getElementById('recoveryDetailsForm').hidden = true;
        document.getElementById('resetPasswordForm').hidden = false;
        setAuthStatus('resetPasswordStatus', result.message);
    } catch (error) {
        setAuthStatus('recoveryStatus', error.message, true);
    }
}

async function handlePasswordResetSubmit(event) {
    event.preventDefault();
    setAuthStatus('resetPasswordStatus', '');
    try {
        const result = await postAuthRequest('/api/auth/recovery/complete', {
            email: recoveryEmail,
            code: document.getElementById('resetCode').value.trim(),
            password: document.getElementById('newPassword').value
        });
        document.getElementById('signInEmail').value = recoveryEmail;
        document.getElementById('signInPassword').value = '';
        switchAuthSubView('signIn');
        setAuthStatus('signInStatus', result.message);
    } catch (error) {
        setAuthStatus('resetPasswordStatus', error.message, true);
    }
}

function goToAuth(mode) {
    document.getElementById('onboardingView').classList.remove('active');
    document.getElementById('authView').classList.add('active');
    
    if (mode === 'signup') {
        document.getElementById('signUpForm').style.display = 'block';
        document.getElementById('signInSection').style.display = 'none';
    } else {
        document.getElementById('signUpForm').style.display = 'none';
        document.getElementById('signInSection').style.display = 'block';
    }
}

// --- GAME ARENA & CHALLENGE CONTROLLERS ---

// Triggered when user clicks "Challenge Partner" on any game card
function initiateChallenge(gameId) {
    const currentUser = JSON.parse(localStorage.getItem('g2ku_profile')) || { name: 'Player 1', email: 'user@example.com' };
    const partnerEmail = localStorage.getItem('g2ku_partner_email') || 'partner@example.com';

    // Save active challenge state
    const challengeData = {
        gameId: gameId,
        challengerName: currentUser.name,
        status: 'WAITING_FOR_PARTNER',
        timestamp: new Date().toISOString()
    };
    localStorage.setItem('g2ku_active_game', JSON.stringify(challengeData));

    console.log(`Challenge saved for ${partnerEmail} regarding game: ${gameId}`);

    // Open the game board modal immediately for the challenger
    openGameModal(gameId);
}


// Open modal and invoke the game engine
function openGameModal(gameId) {
    const modal = document.getElementById('gamePlayModal');
    const container = document.getElementById('active-game-container');
    const sessionControls = document.getElementById('ttt-session-controls');

    if (modal) {
        modal.style.display = 'flex';
    }
    if (sessionControls) sessionControls.hidden = gameId !== 'tictactoe';

    if (container) {
        container.innerHTML = '';
        if (window.G2KUGames) {
            G2KUGames.launch(gameId, 'active-game-container');
        } else {
            container.innerHTML = `<h3>${getGameTitle(gameId)}</h3><p style="color:red;">Engine loading error.</p>`;
        }
    }
}

// Close the game modal
function closeGameModal() {
    const modal = document.getElementById('gamePlayModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function setTicTacToePageStatus(message) {
    const status = document.getElementById('ttt-page-status');
    if (status) status.textContent = message;
}

function showTicTacToeError(message) {
    setTicTacToePageStatus(message);
    const gameStatus = document.getElementById('ttt-status');
    if (gameStatus) gameStatus.textContent = message;
}

function showTicTacToeState(state, myRole, openModal = true) {
    if (!state || state.roomCode !== activeTicTacToeRoom ||
        (activeTicTacToeMatch && state.id !== activeTicTacToeMatch)) return;
    const previousState = G2KUGames.ticTacToeState;
    const resolvedRole = myRole || previousState?.myRole || state.myRole;
    activeTicTacToeMatch = state.id;
    ticTacToeMovePending = false;
    G2KUGames.ticTacToeState = { ...state, myRole: resolvedRole };
    const invitePanel = document.getElementById('ttt-invite-panel');
    const inviteCode = document.getElementById('ttt-invite-code');
    if (invitePanel && inviteCode) {
        inviteCode.textContent = state.roomCode;
        invitePanel.hidden = false;
    }
    const sessionControls = document.getElementById('ttt-session-controls');
    if (sessionControls) {
        sessionControls.hidden = false;
        document.getElementById('ttt-modal-room-code').textContent = state.roomCode;
        document.getElementById('ttt-modal-session-id').textContent = state.id;
        const sessionInput = document.getElementById('ttt-session-id-input');
        if (sessionInput) sessionInput.value = state.id;
        document.getElementById('ttt-return-room-link').href =
            `rooms.html?room=${encodeURIComponent(state.roomCode)}`;
    }
    localStorage.setItem('g2ku_ttt_room_code', state.roomCode);
    localStorage.setItem('g2ku_ttt_match_id', state.id);
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    url.searchParams.delete('match');
    history.replaceState(null, '', url);
    const modal = document.getElementById('gamePlayModal');
    const shouldOpenModal = openModal || (modal && modal.style.display !== 'none');
    if (shouldOpenModal) {
        openGameModal('tictactoe');
    }
    setTicTacToePageStatus(shouldOpenModal
        ? ''
        : 'Your saved game is ready. Select Join Room or Resume Game when you want to continue.');
    loadTicTacToeHistory().catch(error => {
        console.error('Unable to load saved Tic-Tac-Toe series:', error);
        const status = document.getElementById('ttt-history-status');
        if (status) status.textContent = `Unable to load saved series: ${error.message}`;
    });

    const roundJustResolved = previousState?.id === state.id &&
        previousState.currentRound.status === 'active' &&
        state.currentRound.status === 'complete';
    if (roundJustResolved && shouldOpenModal) animateTicTacToeOutcome(state, resolvedRole);
}

function handleTicTacToeRoomMessage(message) {
    if (message.type === 'tictactoe_state') {
        showTicTacToeState(message.state, message.myRole, false);
        return;
    }
    if (message.type === 'room_state' && message.state.roomCode === activeTicTacToeRoom) {
        if (message.state.status === 'paired') {
            setTicTacToePageStatus('Your room is paired. Select Join Room or a saved series when you’re ready.');
        } else if (message.state.status === 'waiting') {
            setTicTacToePageStatus(`Room ${message.state.roomCode} is ready. Share the invite code and your partner can join.`);
        }
    }
}

function renderTicTacToeHistory(matches) {
    const list = document.getElementById('ttt-history-list');
    const status = document.getElementById('ttt-history-status');
    if (!list || !status) return;
    list.replaceChildren();
    if (!matches.length) {
        status.textContent = `No saved series yet for room ${activeTicTacToeRoom}.`;
        return;
    }

    status.textContent = `Saved series for room ${activeTicTacToeRoom}. Select one to resume.`;
    for (const match of matches) {
        const item = document.createElement('li');
        item.className = 'ttt-history-item';
        const details = document.createElement('div');
        const summary = document.createElement('p');
        summary.textContent =
            `${match.players.host.name} ${match.wins.host} – ${match.wins.guest} ${match.players.guest.name}`;
        const meta = document.createElement('small');
        const result = match.seriesWinner
            ? `${match.players[match.seriesWinner].name} won`
            : match.status === 'complete'
                ? 'Series ended in a draw'
                : `Round ${match.roundNumber} in progress`;
        const date = new Date(match.updatedAt).toLocaleDateString();
        meta.textContent = `${result} · ${date} · ${match.points.host}–${match.points.guest} points`;
        details.append(summary, meta);

        const resume = document.createElement('button');
        resume.type = 'button';
        resume.className = 'ttt-history-resume';
        resume.textContent = match.id === activeTicTacToeMatch ? 'Open current' : 'Resume series';
        resume.addEventListener('click', () =>
            joinTicTacToeRoom(activeTicTacToeRoom, match.id));
        item.append(details, resume);
        list.appendChild(item);
    }
}

async function loadTicTacToeHistory() {
    if (!activeTicTacToeRoom || !activeTicTacToeMatch) return;
    const result = await G2KURoomClient.request('list_tictactoe_history');
    if (result.roomCode === activeTicTacToeRoom) {
        renderTicTacToeHistory(result.matches);
    }
}

function animateTicTacToeOutcome(state, myRole) {
    if (!myRole) return;
    const winner = state.currentRound.winner;
    const outcome = winner === null ? 'draw' : winner === myRole ? 'win' : 'loss';
    const modal = document.querySelector('.ttt-modal-content');
    const container = document.getElementById('active-game-container');
    if (!modal || !container) return;

    document.querySelector('.ttt-result-burst')?.remove();
    const burst = document.createElement('div');
    burst.className = `ttt-result-burst is-${outcome}`;
    burst.setAttribute('role', 'status');
    burst.setAttribute('aria-live', 'assertive');
    const resultMessage = document.createElement('p');
    resultMessage.className = 'ttt-result-message';
    const seriesDecided = state.status === 'complete' && state.seriesWinner;
    resultMessage.textContent = outcome === 'win'
        ? seriesDecided ? 'Division Series champion!' : 'Round win!'
        : outcome === 'loss'
            ? seriesDecided ? 'Division Series lost' : 'Round lost'
            : 'It’s a draw!';
    burst.appendChild(resultMessage);

    if (outcome === 'win') {
        const colors = ['#e21b3c', '#1368ce', '#d89e00', '#26890c', '#864cbf'];
        for (let index = 0; index < 36; index += 1) {
            const piece = document.createElement('span');
            piece.className = 'ttt-confetti';
            piece.style.setProperty('--confetti-left', `${Math.random() * 100}%`);
            piece.style.setProperty('--confetti-color', colors[index % colors.length]);
            piece.style.setProperty('--confetti-delay', `${Math.random() * 0.45}s`);
            burst.appendChild(piece);
        }
    } else if (outcome === 'loss') {
        modal.classList.remove('ttt-buzzer');
        void modal.offsetWidth;
        modal.classList.add('ttt-buzzer');
        window.setTimeout(() => modal.classList.remove('ttt-buzzer'), 550);
    }

    container.appendChild(burst);
    window.setTimeout(() => burst.remove(), 2400);
}

function rememberTicTacToeRoom(roomCode) {
    const recentCodes = JSON.parse(localStorage.getItem('g2ku_active_spaces') || '[]');
    const updatedCodes = [roomCode, ...recentCodes.filter(code => code !== roomCode)].slice(0, 20);
    localStorage.setItem('g2ku_active_spaces', JSON.stringify(updatedCodes));
}

async function connectTicTacToeRoom() {
    await G2KURoomClient.connect(handleTicTacToeRoomMessage, status => {
        if (status === 'disconnected') {
            setTicTacToePageStatus('Disconnected from the room service. Refresh to reconnect.');
        } else if (status === 'connected') {
            setTicTacToePageStatus('');
        }
    });
}

function showTicTacToeRoom(state) {
    activeTicTacToeRoom = state.roomCode;
    rememberTicTacToeRoom(state.roomCode);
    localStorage.setItem('g2ku_ttt_room_code', state.roomCode);
    const codeInput = document.getElementById('ttt-room-code');
    if (codeInput) codeInput.value = state.roomCode;
    const inviteCode = document.getElementById('ttt-invite-code');
    const invitePanel = document.getElementById('ttt-invite-panel');
    if (inviteCode && invitePanel) {
        inviteCode.textContent = state.roomCode;
        invitePanel.hidden = false;
    }
}

async function syncTicTacToeRoom(roomState, requestedMatchId = '') {
    showTicTacToeRoom(roomState);
    if (roomState.status !== 'paired' || activeTicTacToeMatch || ticTacToeStartPending) {
        return;
    }

    ticTacToeStartPending = true;
    try {
        const result = await G2KURoomClient.request('load_tictactoe',
            requestedMatchId ? { matchId: requestedMatchId } : {});
        if (result.state) {
            showTicTacToeState(result.state, result.myRole);
            return;
        }
        if (requestedMatchId) throw new Error('That Tic-Tac-Toe series could not be found.');
        const started = await G2KURoomClient.request('start_tictactoe');
        showTicTacToeState(started.state, started.myRole);
    } finally {
        ticTacToeStartPending = false;
    }
}

async function createTicTacToeRoom() {
    setTicTacToePageStatus('Creating a room…');
    try {
        await connectTicTacToeRoom();
        const result = await G2KURoomClient.request('create_room', {
            playerId: G2KURoomClient.getPlayerId()
        });
        activeTicTacToeMatch = '';
        localStorage.removeItem('g2ku_ttt_match_id');
        showTicTacToeRoom(result.state);
        setTicTacToePageStatus('Room created. Share the invite link or code with your partner.');
        const url = new URL(window.location.href);
        url.searchParams.delete('room');
        url.searchParams.delete('match');
        history.replaceState(null, '', url);
    } catch (error) {
        showTicTacToeError(error.message);
    }
}

async function joinTicTacToeRoom(roomCode = '', matchId = '') {
    const codeInput = document.getElementById('ttt-room-code');
    const query = new URLSearchParams(window.location.search);
    const code = (roomCode || query.get('room') || codeInput?.value || '').trim().toUpperCase();
    if (!/^[A-HJ-NP-Z2-9]{8}$/.test(code)) {
        showTicTacToeError('Enter a valid 8-character room code.');
        return;
    }
    activeTicTacToeRoom = code;
    activeTicTacToeMatch = '';
    setTicTacToePageStatus(`Joining room ${code}…`);
    try {
        await connectTicTacToeRoom();
        let result;
        try {
            result = await G2KURoomClient.request('join_room', {
                roomCode: code,
                playerId: G2KURoomClient.getPlayerId()
            });
        } catch (error) {
            if (!error.message.startsWith('This device created the room.') &&
                !error.message.startsWith('Join from a different account') &&
                !error.message.startsWith('This room already has two players.')) throw error;
            result = await G2KURoomClient.request('resume_room', {
                roomCode: code,
                playerId: G2KURoomClient.getPlayerId()
            });
        }
        activeTicTacToeMatch = '';
        showTicTacToeRoom(result.state);
        if (result.state.status === 'paired') {
            await syncTicTacToeRoom(result.state, matchId || query.get('match') || '');
        } else {
            setTicTacToePageStatus(`Room ${code} is ready. Share the invite link or code with your partner.`);
        }
        const url = new URL(window.location.href);
        url.searchParams.delete('room');
        url.searchParams.delete('match');
        history.replaceState(null, '', url);
    } catch (error) {
        showTicTacToeError(error.message);
    }
}

function resumeTicTacToeSeries() {
    const roomCode = document.getElementById('ttt-room-code').value.trim().toUpperCase();
    const matchId = document.getElementById('ttt-session-id-input').value.trim();
    if (!/^[A-HJ-NP-Z2-9]{8}$/.test(roomCode)) {
        showTicTacToeError('Enter the 8-character room code for this series.');
        return;
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(matchId)) {
        showTicTacToeError('Enter a valid saved series ID.');
        return;
    }
    void joinTicTacToeRoom(roomCode, matchId);
}

function getTicTacToeInviteUrl() {
    const url = new URL(window.location.href);
    url.searchParams.set('room', activeTicTacToeRoom);
    url.searchParams.delete('match');
    return url;
}

async function copyTicTacToeInvite() {
    if (!activeTicTacToeRoom) return;
    try {
        await navigator.clipboard.writeText(getTicTacToeInviteUrl().href);
        setTicTacToePageStatus('Invite link copied. Send it to your partner.');
    } catch (error) {
        console.error('Unable to copy the Tic-Tac-Toe invite link:', error);
        setTicTacToePageStatus(`Copy failed. Share this room code instead: ${activeTicTacToeRoom}`);
    }
}

async function copyTicTacToeRoomCode() {
    if (!activeTicTacToeRoom) return;
    try {
        await navigator.clipboard.writeText(activeTicTacToeRoom);
        setTicTacToePageStatus('Room code copied.');
    } catch (error) {
        console.error('Unable to copy the Tic-Tac-Toe room code:', error);
        setTicTacToePageStatus(`Copy failed. Your room code is ${activeTicTacToeRoom}.`);
    }
}

async function copyTicTacToeSessionId() {
    if (!activeTicTacToeMatch) return;
    try {
        await navigator.clipboard.writeText(activeTicTacToeMatch);
        setTicTacToePageStatus('Series ID copied.');
    } catch (error) {
        console.error('Unable to copy the Tic-Tac-Toe series ID:', error);
        setTicTacToePageStatus(`Copy failed. Your series ID is ${activeTicTacToeMatch}.`);
    }
}

async function shareTicTacToeInvite() {
    if (!activeTicTacToeRoom) return;
    try {
        if (navigator.share) {
            await navigator.share({
                title: 'Join my Getting2KU Tic-Tac-Toe series',
                text: `Join my Getting2KU room with code ${activeTicTacToeRoom} to play Tic-Tac-Toe.`,
                url: getTicTacToeInviteUrl().href
            });
        } else {
            await copyTicTacToeInvite();
        }
    } catch (error) {
        if (error.name === 'AbortError') return;
        console.error('Unable to share the Tic-Tac-Toe invite:', error);
        setTicTacToePageStatus(`Could not share the invite. Send your partner room code ${activeTicTacToeRoom}.`);
    }
}

async function submitTicTacToeMove(cellIndex) {
    const state = G2KUGames.ticTacToeState;
    if (!state || ticTacToeMovePending) return;
    const myRole = state.myRole ||
        (state.players.host.id === G2KURoomClient.getPlayerId() ? 'host' : 'guest');
    if (state.currentRound.turn !== myRole || state.currentRound.board[cellIndex] !== null) return;

    ticTacToeMovePending = true;
    const optimisticState = JSON.parse(JSON.stringify(state));
    const opponent = myRole === 'host' ? 'guest' : 'host';
    optimisticState.currentRound.board[cellIndex] = myRole;
    optimisticState.currentRound.turn = opponent;
    optimisticState.optimisticMove = true;
    G2KUGames.ticTacToeState = optimisticState;
    openGameModal('tictactoe');
    try {
        const result = await G2KURoomClient.request('tictactoe_move', {
            matchId: activeTicTacToeMatch,
            cellIndex
        });
        showTicTacToeState(result.state, result.myRole);
    } catch (error) {
        ticTacToeMovePending = false;
        try {
            const result = await G2KURoomClient.request('load_tictactoe', {
                matchId: activeTicTacToeMatch
            });
            if (result.state) showTicTacToeState(result.state, result.myRole);
        } catch (refreshError) {
            console.error('Unable to refresh Tic-Tac-Toe after a rejected move:', refreshError);
        }
        showTicTacToeError(error.message);
    }
}

async function advanceTicTacToeRound() {
    if (!activeTicTacToeMatch) return;
    try {
        const result = await G2KURoomClient.request('advance_tictactoe_round', {
            matchId: activeTicTacToeMatch
        });
        showTicTacToeState(result.state, result.myRole);
    } catch (error) {
        showTicTacToeError(error.message);
    }
}

async function startNewTicTacToeSeries() {
    activeTicTacToeMatch = '';
    try {
        const result = await G2KURoomClient.request('start_tictactoe');
        showTicTacToeState(result.state, result.myRole);
        const url = new URL(window.location.href);
        url.searchParams.delete('match');
        history.replaceState(null, '', url);
    } catch (error) {
        showTicTacToeError(error.message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const queryRoomCode = params.get('room');
    const roomCode = localStorage.getItem('g2ku_ttt_room_code') || '';
    const matchId = params.get('match') ||
        localStorage.getItem('g2ku_ttt_match_id') || '';
    const codeInput = document.getElementById('ttt-room-code');
    const sessionInput = document.getElementById('ttt-session-id-input');
    if (codeInput && (queryRoomCode || roomCode)) {
        codeInput.value = (queryRoomCode || roomCode).toUpperCase();
    }
    if (sessionInput && matchId) sessionInput.value = matchId;
    if (queryRoomCode) {
        void joinTicTacToeRoom(queryRoomCode, params.get('match') || '');
    } else if (roomCode) {
        setTicTacToePageStatus('Saved room details are ready. Select Join Room or Resume Game when you want to continue.');
    }
});

// Accept a pending challenge from the banner
function acceptPendingGame() {
    const pendingGame = JSON.parse(localStorage.getItem('g2ku_pending_challenge'));
    if (pendingGame) {
        openGameModal(pendingGame.gameId);
        const banner = document.getElementById('pendingChallengeBanner');
        if (banner) banner.style.display = 'none';
    }
}

// Helper title map
function getGameTitle(id) {
    const titles = {
        'tictactoe': 'Tic-Tac-Toe',
        'connectfour': 'Connect Four',
        'memorymatch': 'Memory Match'
    };
    return titles[id] || 'Mini-Game';
}
// Function to display the active question on screen
function renderG2KUQuestion(questionData) {
    if (!questionData) return;

    // Set tracker text
    document.getElementById('trackerWeek').innerText = `Progression: Week ${questionData.week || 1}`;
    document.getElementById('trackerQuestionNum').innerText = `Question ${questionData.number || 1} of 5`;

    // Set main question card text
    document.getElementById('currentQuestionText').innerText = questionData.prompt;

    // Check if multiple choice or open text
    if (questionData.type === 'multiple' || questionData.options) {
        document.getElementById('responseGrid').style.display = 'grid';
        document.getElementById('textResponseArea').style.display = 'none';

        // Fill option buttons
        document.getElementById('opt0').innerText = questionData.options[0] || '';
        document.getElementById('opt1').innerText = questionData.options[1] || '';
        document.getElementById('opt2').innerText = questionData.options[2] || '';
        document.getElementById('opt3').innerText = questionData.options[3] || '';
    } else {
        // Open text input fallback
        document.getElementById('responseGrid').style.display = 'none';
        document.getElementById('textResponseArea').style.display = 'block';
    }
}

// Button actions
function submitAnswer(optionIndex) {
    console.log("Selected option:", optionIndex);
    // Logic to save answer and pull next question from your question file
}

function submitTextAnswer() {
    const textVal = document.getElementById('customTextAnswer').value;
    if (!textVal.trim()) {
        alert("Please type an answer first!");
        return;
    }
    console.log("Submitted text answer:", textVal);
}