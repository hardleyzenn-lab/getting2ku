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
    const entries = result.history.slice(0, limit);
    if (entries.length === 0) {
        container.textContent = 'No saved room history yet. Complete a room card to see it here.';
        if (status) status.textContent = 'History is up to date.';
        return;
    }

    container.replaceChildren();
    for (const entry of entries) {
        const item = document.createElement('article');
        item.className = 'space-item';
        item.style.flexDirection = 'column';
        item.style.alignItems = 'flex-start';
        item.style.gap = '0.5rem';

        const heading = document.createElement('strong');
        heading.textContent = `Room ${entry.room_code} · Card ${entry.round_index + 1}`;
        const prompt = document.createElement('p');
        prompt.textContent = entry.prompt;
        const ownAnswer = document.createElement('p');
        ownAnswer.textContent = `Your answer: ${entry.own_answer}`;
        const partnerAnswer = document.createElement('p');
        partnerAnswer.textContent = `Partner answer: ${entry.partner_answer}`;

        item.append(heading, prompt, ownAnswer, partnerAnswer);
        if (entry.private_vibe_check) {
            const vibe = document.createElement('p');
            vibe.textContent = `Your private vibe check: ${entry.private_vibe_check}`;
            item.appendChild(vibe);
        }
        const date = document.createElement('time');
        date.dateTime = entry.created_at;
        date.textContent = new Date(entry.created_at).toLocaleString();
        item.appendChild(date);
        container.appendChild(item);
    }
    if (status) status.textContent = `Showing ${entries.length} saved card${entries.length === 1 ? '' : 's'}.`;
}
