let registrationEmail = '';
let recoveryEmail = '';

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
            button.textContent = `${account.name} (${account.tier})`;
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

    if (modal) {
        modal.style.display = 'flex';
    }

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
        'memorymatch': 'Memory Match',
        'triviaduel': 'Trivia Duel',
        'wordguesser': 'Word Guesser',
        'diceroll': 'Dice Roll',
        'hotseat': 'Hot Seat'
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