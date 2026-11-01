(() => {
    const body = document.body;

    if (!body) {
        return;
    }

    let header = body.querySelector('.app-menu');
    if (!header) {
        header = document.createElement('header');
        header.className = 'app-menu';
        body.prepend(header);
    }

    header.innerHTML = `
        <a class="app-brand" href="index.html" aria-label="G2KU home">G2KU</a>
        <nav class="menu-links" aria-label="Main navigation">
            <a href="me%26u.html" class="nav-pill red-btn">
                <span class="shape-badge" aria-hidden="true"><svg viewBox="0 0 24 24"><polygon points="12,2 22,22 2,22"/></svg></span>
                <span>Me &amp; U</span>
            </a>
            <a href="rooms.html" class="nav-pill blue-btn">
                <span class="shape-badge" aria-hidden="true"><svg viewBox="0 0 24 24"><polygon points="12,2 22,12 12,22 2,12"/></svg></span>
                <span>Rooms &amp; Cards</span>
            </a>
            <a href="test%20game.html" class="nav-pill yellow-btn">
                <span class="shape-badge" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg></span>
                <span>Mini Games</span>
            </a>
            <a href="#" class="nav-pill green-btn">
                <span class="shape-badge" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/></svg></span>
                <span>Earn</span>
            </a>
            <a href="#" class="nav-pill join-btn">
                <span class="shape-badge" aria-hidden="true"><svg viewBox="0 0 24 24"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg></span>
                <span>Date</span>
            </a>
        </nav>
    `;

    if (!body.querySelector('.site-footer')) {
        const footer = document.createElement('footer');
        footer.className = 'site-footer';
        footer.textContent = '© Getting2KU | Stop guessing. Start connecting.';
        body.append(footer);
    }
})();
