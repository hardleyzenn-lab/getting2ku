async function renderSavedRoomHistory(containerId, limit = 200) {
    const container = document.getElementById(containerId);
    const status = document.getElementById('historyStatus');
    const response = await fetch('/api/auth/history', { credentials: 'same-origin' });
    if (response.status === 401) {
        const message = document.createElement('p');
        message.textContent = 'Sign in to view saved room history. ';
        const signIn = document.createElement('a');
        signIn.href = 'signin.html';
        signIn.textContent = 'Sign in';
        message.appendChild(signIn);
        container.replaceChildren(message);
        if (status) status.textContent = 'Sign-in required.';
        return;
    }
    if (!response.ok) {
        throw new Error(`Could not load saved history (HTTP ${response.status}).`);
    }

    const result = await response.json();
    if (!Array.isArray(result.history)) {
        throw new Error('The saved history response was invalid.');
    }

    const entries = result.history.slice(0, limit);
    const partnerGroups = new Map();
    for (const entry of entries) {
        const partnerId = entry.partner_id || 'PartnerIDunknown';
        if (!partnerGroups.has(partnerId)) partnerGroups.set(partnerId, new Map());
        const sessions = partnerGroups.get(partnerId);
        let session = sessions.get(entry.room_code);
        if (!session) {
            session = {
                roomCode: entry.room_code,
                roomName: entry.room_name || `Room #${entry.room_code}`,
                createdAt: entry.session_created_at || entry.created_at,
                playerName: entry.player_name || 'Player 1',
                partnerName: entry.partner_name || 'PartnerIDunknown',
                completed: Boolean(entry.session_completed),
                answers: [],
                latestAnswerAt: entry.answered_at || entry.created_at
            };
            sessions.set(entry.room_code, session);
        }
        session.completed ||= Boolean(entry.session_completed);
        session.answers.push(entry);
        if (new Date(entry.answered_at || entry.created_at) > new Date(session.latestAnswerAt)) {
            session.latestAnswerAt = entry.answered_at || entry.created_at;
        }
    }

    if (entries.length === 0) {
        container.textContent = 'No saved room history yet. Complete a room card to see it here.';
        if (status) status.textContent = 'History is up to date.';
        return;
    }

    container.replaceChildren();
    for (const [partnerId, sessions] of partnerGroups) {
        const group = document.createElement('section');
        group.className = 'partner-history-window';
        const heading = document.createElement('h2');
        heading.className = 'partner-history-heading';
        heading.textContent = `Partner ID: ${partnerId}`;

        const scroll = document.createElement('div');
        scroll.className = 'history-table-scroll';
        const table = document.createElement('table');
        table.className = 'history-session-table';
        const thead = document.createElement('thead');
        const headingRow = document.createElement('tr');
        for (const label of [
            'Session ID',
            'Room Name / Code',
            'Created Timestamp',
            'Cards Played',
            'Completion Status'
        ]) {
            const th = document.createElement('th');
            th.scope = 'col';
            th.textContent = label;
            headingRow.appendChild(th);
        }
        thead.appendChild(headingRow);
        const tbody = document.createElement('tbody');

        const orderedSessions = [...sessions.values()]
            .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
        for (const session of orderedSessions) {
            session.answers.sort((left, right) => left.round_index - right.round_index);
            const row = document.createElement('tr');
            row.className = 'history-session-row';

            const idCell = document.createElement('td');
            const sessionId = document.createElement('strong');
            sessionId.className = 'history-session-id';
            sessionId.textContent = session.roomCode;
            const detailsButton = document.createElement('button');
            detailsButton.type = 'button';
            detailsButton.className = 'history-details-toggle';
            detailsButton.textContent = 'View details';
            detailsButton.setAttribute('aria-expanded', 'false');
            idCell.append(sessionId, detailsButton);

            const nameCell = document.createElement('td');
            nameCell.appendChild(createRoomNameEditor(session));
            const createdCell = document.createElement('td');
            createdCell.appendChild(createTimeElement(session.createdAt));
            const cardsCell = document.createElement('td');
            cardsCell.textContent = String(session.answers.length);
            const statusCell = document.createElement('td');
            const badge = document.createElement('span');
            badge.className = session.completed
                ? 'history-status-badge is-complete'
                : 'history-status-badge';
            badge.textContent = session.completed ? 'Complete' : 'In progress';
            statusCell.appendChild(badge);
            row.append(idCell, nameCell, createdCell, cardsCell, statusCell);

            const detailsRow = document.createElement('tr');
            detailsRow.className = 'history-details-row';
            detailsRow.hidden = true;
            const detailsCell = document.createElement('td');
            detailsCell.colSpan = 5;
            detailsCell.appendChild(createSessionHistoryCard(session));
            detailsRow.appendChild(detailsCell);
            detailsButton.addEventListener('click', () => {
                const isOpen = !detailsRow.hidden;
                detailsRow.hidden = isOpen;
                detailsButton.setAttribute('aria-expanded', String(!isOpen));
                detailsButton.textContent = isOpen ? 'View details' : 'Hide details';
            });

            tbody.append(row, detailsRow);
        }

        table.append(thead, tbody);
        scroll.appendChild(table);
        group.append(heading, scroll);
        container.appendChild(group);
    }

    const sessionCount = [...partnerGroups.values()]
        .reduce((count, sessions) => count + sessions.size, 0);
    if (status) {
        status.textContent = `Showing ${sessionCount} session${sessionCount === 1 ? '' : 's'} across ${partnerGroups.size} partner group${partnerGroups.size === 1 ? '' : 's'}.`;
    }
}

function createRoomNameEditor(session) {
    const editor = document.createElement('div');
    editor.className = 'history-room-name-editor';
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 100;
    input.value = session.roomName;
    input.dataset.roomCode = session.roomCode;
    input.setAttribute('aria-label', `Your private room name for session ${session.roomCode}`);
    const saveButton = document.createElement('button');
    saveButton.type = 'button';
    saveButton.className = 'history-save-btn';
    saveButton.textContent = 'Save';
    const message = document.createElement('span');
    message.className = 'history-name-status';
    saveButton.addEventListener('click', async () => {
        saveButton.disabled = true;
        message.textContent = 'Saving…';
        try {
            const result = await saveSessionRoomName(session, input.value);
            session.roomName = result.roomName;
            document.querySelectorAll('[data-room-code]').forEach(field => {
                if (field.dataset.roomCode === session.roomCode) field.value = result.roomName;
            });
            document.querySelectorAll('[data-room-title]').forEach(title => {
                if (title.dataset.roomTitle === session.roomCode) title.textContent = result.roomName;
            });
            message.textContent = 'Saved';
        } catch (error) {
            message.textContent = error.message;
        } finally {
            saveButton.disabled = false;
        }
    });
    editor.append(input, saveButton, message);
    return editor;
}

function createSessionHistoryCard(session) {
    const card = document.createElement('article');
    card.className = 'session-history-card';

    const header = document.createElement('header');
    header.className = 'session-history-card-header';
    const sessionId = document.createElement('strong');
    sessionId.className = 'history-session-id';
    sessionId.textContent = session.roomCode;
    const roomName = document.createElement('div');
    roomName.className = 'session-history-room-name';
    const roomTitle = document.createElement('h3');
    roomTitle.dataset.roomTitle = session.roomCode;
    roomTitle.textContent = session.roomName;
    const nameEditor = createRoomNameEditor(session);
    roomName.append(roomTitle, nameEditor);
    const created = document.createElement('div');
    created.className = 'session-created-at';
    created.append('Created ', createTimeElement(session.createdAt));
    header.append(sessionId, roomName, created);

    const answers = document.createElement('div');
    answers.className = 'session-history-answers';
    for (const entry of session.answers) {
        const answerCard = document.createElement('article');
        answerCard.className = 'session-answer-card';
        const questionHeading = document.createElement('h4');
        questionHeading.textContent = `Card ${entry.round_index + 1}`;
        const category = document.createElement('span');
        category.className = 'history-category-badge';
        category.textContent = getHistoryCategory(entry);
        const prompt = document.createElement('p');
        prompt.className = 'session-question-text';
        prompt.textContent = entry.prompt || getHistoryPrompt(entry) || 'Question text unavailable.';
        const answerGrid = document.createElement('div');
        answerGrid.className = 'session-answer-grid';
        answerGrid.append(
            createAnswerPanel('Your answer', entry.own_answer, 'answer-blue'),
            createAnswerPanel('Partner answer', entry.partner_answer, 'answer-purple')
        );
        const answerTimestamp = document.createElement('p');
        answerTimestamp.className = 'session-answer-timestamp';
        answerTimestamp.append('Answered ', createTimeElement(entry.answered_at || entry.created_at));
        answerCard.append(questionHeading, category, prompt, answerGrid, answerTimestamp);
        answers.appendChild(answerCard);
    }

    const footer = document.createElement('footer');
    footer.className = 'session-history-card-footer';
    const participants = document.createElement('p');
    participants.textContent = `Participants: ${session.playerName} & ${session.partnerName}`;
    const summary = document.createElement('p');
    summary.textContent = `${session.answers.length} card${session.answers.length === 1 ? '' : 's'} · ${session.completed ? 'Complete' : 'In progress'}`;
    const latestAnswer = document.createElement('p');
    latestAnswer.append('Last answer ', createTimeElement(session.latestAnswerAt));
    footer.append(participants, summary, latestAnswer);

    card.append(header, answers, footer);
    return card;
}

function getHistoryCategory(entry) {
    if (entry.category && !/^cat\d+$/i.test(entry.category)) return entry.category;
    const categoryMatch = /^cat(\d+)_q\d+$/i.exec(entry.question_id || '');
    const category = categoryMatch && typeof cardDeck !== 'undefined'
        ? cardDeck[`cat${categoryMatch[1]}`]
        : undefined;
    return category?.name || 'Uncategorized';
}

function getHistoryPrompt(entry) {
    const categoryMatch = /^cat(\d+)_q\d+$/i.exec(entry.question_id || '');
    const category = categoryMatch && typeof cardDeck !== 'undefined'
        ? cardDeck[`cat${categoryMatch[1]}`]
        : undefined;
    return category?.questions?.find(question => question.id === entry.question_id)?.question || '';
}

function createAnswerPanel(label, answer, colorClass) {
    const panel = document.createElement('div');
    panel.className = `session-answer-panel ${colorClass}`;
    const heading = document.createElement('strong');
    heading.textContent = label;
    const text = document.createElement('p');
    text.textContent = answer;
    panel.append(heading, text);
    return panel;
}

function createTimeElement(value) {
    const time = document.createElement('time');
    if (!value) {
        time.textContent = 'Unavailable';
        return time;
    }
    time.dateTime = value;
    time.textContent = new Date(value).toLocaleString();
    return time;
}

async function saveSessionRoomName(session, roomName) {
    const response = await fetch(
        `/api/auth/rooms/${encodeURIComponent(session.roomCode)}/name`,
        {
            method: 'PATCH',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomName })
        }
    );
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
        if (response.status === 404) {
            throw new Error('Room-name saving is not available on the running server. Restart Getting2KU and reload this page.');
        }
        throw new Error(`Could not save room name (HTTP ${response.status}).`);
    }

    const result = await response.json();
    if (!response.ok) {
        throw new Error(result.error || `Could not save room name (HTTP ${response.status}).`);
    }
    return result;
}
