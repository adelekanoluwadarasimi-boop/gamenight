// Supabase Configuration
const SUPABASE_URL = 'https://mqkniqvfntchiatzlsla.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xa25pcXZmbnRjaGlhdHpsc2xhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NTYyMDksImV4cCI6MjA4NzQzMjIwOX0.YTNzrrHflQ2ymYNGYYDKAaVUrNwafXw9EN1qNT2guyA';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let games = [];
let isEditing = false;
let currentUser = null;
let isLoginMode = true;

const appDOM = {
    get addBtn() { return document.getElementById('add-score-btn'); },
    get scoreModal() { return document.getElementById('score-modal'); },
    get modalTitle() { return document.getElementById('modal-title'); },
    get closeBtns() { return document.querySelectorAll('.close-btn'); },
    get form() { return document.getElementById('add-score-form'); },
    get entryId() { return document.getElementById('entry-id'); },
    get leaderboardBody() { return document.getElementById('leaderboard-body'); },
    get gamesList() { return document.getElementById('games-list'); },
    get totalGames() { return document.getElementById('total-games'); },
    get topPlayer() { return document.getElementById('top-player'); },
    get mostPlayed() { return document.getElementById('most-played'); },
    get submitBtn() { return document.querySelector('.btn-submit'); },
    get searchInput() { return document.getElementById('search-input'); },
    get authBtn() { return document.getElementById('auth-btn'); },
    get authModal() { return document.getElementById('auth-modal'); },
    get authForm() { return document.getElementById('auth-form'); },
    get authModalTitle() { return document.getElementById('auth-modal-title'); },
    get authSubmitBtn() { return document.getElementById('auth-submit-btn'); },
    get toggleLogin() { return document.getElementById('toggle-login'); },
    get toggleSignup() { return document.getElementById('toggle-signup'); },
    get signupNameGroup() { return document.getElementById('signup-name-group'); },
    get userDisplayName() { return document.getElementById('user-display-name'); },
    get proofInput() { return document.getElementById('game-proof'); },
    get imageModal() { return document.getElementById('image-viewer-modal'); },
    get imageModalFullSize() { return document.getElementById('proof-image-full'); },
    get standingsList() { return document.getElementById('standings-list'); }
};

// Safety utilities
function safeSetHTML(el, html) {
    if (el) el.innerHTML = html;
    else console.warn('Missing element for innerHTML');
}

function safeSetText(el, text) {
    if (el) el.textContent = text;
    else console.warn('Missing element for textContent');
}

// Admin email
const ADMIN_EMAIL = 'adelekanoluwadarasimi@gmail.com';

// Initialize App
async function init() {
    await checkUser();
    await fetchGames();

    // Event Listeners
    appDOM.addBtn?.addEventListener('click', () => {
        isEditing = false;
        safeSetText(appDOM.modalTitle, 'Record a Game');
        safeSetText(appDOM.submitBtn, 'Save Result');
        appDOM.form.reset();
        appDOM.entryId.value = '';
        appDOM.scoreModal.classList.add('active');
    });

    appDOM.authBtn?.addEventListener('click', handleAuthAction);
    appDOM.toggleLogin?.addEventListener('click', () => setAuthMode(true));
    appDOM.toggleSignup?.addEventListener('click', () => setAuthMode(false));
    appDOM.authForm?.addEventListener('submit', handleAuthSubmit);

    appDOM.closeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            appDOM.scoreModal.classList.remove('active');
            appDOM.authModal.classList.remove('active');
            appDOM.imageModal.classList.remove('active');
        });
    });

    window.addEventListener('click', (e) => {
        if (e.target === appDOM.scoreModal) appDOM.scoreModal.classList.remove('active');
        if (e.target === appDOM.authModal) appDOM.authModal.classList.remove('active');
        if (e.target === appDOM.imageModal) appDOM.imageModal.classList.remove('active');
    });

    appDOM.form?.addEventListener('submit', handleFormSubmit);
    appDOM.searchInput?.addEventListener('input', (e) => updateUI(e.target.value));
}

// User & Auth Functions
async function checkUser() {
    const { data: { user } } = await _supabase.auth.getUser();
    currentUser = user;
    updateAuthUI();
}

function updateAuthUI() {
    if (currentUser) {
        const name = currentUser.user_metadata.display_name || currentUser.email.split('@')[0];
        safeSetText(appDOM.userDisplayName, `Hi, ${name}`);
        safeSetText(appDOM.authBtn, 'Logout');
        if (appDOM.addBtn) appDOM.addBtn.style.display = 'block';
    } else {
        safeSetText(appDOM.userDisplayName, '');
        safeSetText(appDOM.authBtn, 'Login');
        if (appDOM.addBtn) appDOM.addBtn.style.display = 'none';
    }
}

function handleAuthAction() {
    if (currentUser) {
        _supabase.auth.signOut().then(() => {
            currentUser = null;
            updateAuthUI();
            location.reload(); // Refresh to update view
        });
    } else {
        appDOM.authModal?.classList.add('active');
    }
}

function setAuthMode(login) {
    isLoginMode = login;
    appDOM.toggleLogin?.classList.toggle('active', login);
    appDOM.toggleSignup?.classList.toggle('active', !login);
    safeSetText(appDOM.authModalTitle, login ? 'Welcome Back' : 'Create Account');
    safeSetText(appDOM.authSubmitBtn, login ? 'Login' : 'Sign Up');
    if (appDOM.signupNameGroup) appDOM.signupNameGroup.style.display = login ? 'none' : 'block';
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const displayName = document.getElementById('signup-name').value;

    try {
        let result;
        if (isLoginMode) {
            result = await _supabase.auth.signInWithPassword({ email, password });
        } else {
            result = await _supabase.auth.signUp({
                email,
                password,
                options: { data: { display_name: displayName } }
            });
        }

        if (result.error) throw result.error;

        currentUser = result.data.user;
        updateAuthUI();
        appDOM.authModal?.classList.remove('active');
        appDOM.authForm?.reset();

        if (!isLoginMode) alert('Check your email for a confirmation link!');
    } catch (error) {
        alert(error.message);
    }
}

// Image Viewer Logic
window.openImageModal = function (url) {
    if (appDOM.imageModalFullSize) appDOM.imageModalFullSize.src = url;
    appDOM.imageModal?.classList.add('active');
}

// Game Functions
async function fetchGames() {
    try {
        const { data, error } = await _supabase
            .from('games')
            .select('*')
            .order('date', { ascending: false });

        if (error) throw error;
        games = data || [];
        updateUI();
    } catch (error) {
        console.error('Error fetching from Supabase:', error.message);
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();
    if (!currentUser) {
        alert('Please login to submit scores');
        return;
    }

    safeSetText(appDOM.submitBtn, 'Uploading Proof...');
    if (appDOM.submitBtn) appDOM.submitBtn.disabled = true;

    try {
        let screenshot_url = '';
        const file = appDOM.proofInput?.files[0];

        if (file) {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `proofs/${fileName}`;

            let { error: uploadError } = await _supabase.storage
                .from('proofs')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: urlData } = _supabase.storage
                .from('proofs')
                .getPublicUrl(filePath);

            screenshot_url = urlData.publicUrl;
        }

        const winnerName = currentUser.user_metadata.display_name || currentUser.email.split('@')[0];

        const entryData = {
            game: document.getElementById('game-name').value,
            winner: winnerName,
            score: parseInt(document.getElementById('score').value),
            date: document.getElementById('game-date').value,
            user_id: currentUser.id,
            screenshot_url: screenshot_url
        };

        if (isEditing) {
            const id = parseInt(appDOM.entryId?.value);
            const { data, error } = await _supabase
                .from('games')
                .update(entryData)
                .eq('id', id)
                .select();

            if (error) throw error;
            const index = games.findIndex(g => g.id === id);
            if (index !== -1) games[index] = data[0];
        } else {
            const { data, error } = await _supabase
                .from('games')
                .insert([entryData])
                .select();

            if (error) throw error;
            games.unshift(data[0]);
        }

        updateUI();
        appDOM.scoreModal?.classList.remove('active');
        appDOM.form?.reset();
    } catch (error) {
        console.error('Error saving:', error.message);
        alert('Error saving: ' + error.message);
    } finally {
        safeSetText(appDOM.submitBtn, 'Save Result');
        if (appDOM.submitBtn) appDOM.submitBtn.disabled = false;
    }
}

async function deleteGame(id) {
    if (!currentUser) return;
    if (confirm('Are you sure you want to delete this game record?')) {
        try {
            const { error } = await _supabase
                .from('games')
                .delete()
                .eq('id', id);

            if (error) throw error;
            games = games.filter(g => g.id !== id);
            updateUI();
        } catch (error) {
            console.error('Error deleting:', error.message);
        }
    }
}

function editGame(id) {
    if (!currentUser) return;
    const game = games.find(g => g.id === id);
    if (!game) return;

    isEditing = true;
    safeSetText(appDOM.modalTitle, 'Edit Game Record');
    safeSetText(appDOM.submitBtn, 'Update Result');

    if (appDOM.entryId) appDOM.entryId.value = game.id;
    document.getElementById('game-name').value = game.game;
    document.getElementById('score').value = game.score;
    document.getElementById('game-date').value = game.date;

    // Screenshot editing is not supported in this simple version
    appDOM.scoreModal?.classList.add('active');
}

function updateUI(searchTerm = '') {
    const lowerSearch = searchTerm.toLowerCase();
    const filteredGames = games.filter(g =>
        g.game.toLowerCase().includes(lowerSearch) ||
        g.winner.toLowerCase().includes(lowerSearch)
    );

    renderLeaderboard(filteredGames);
    renderRecentGames(filteredGames);
    updateStats();
}

function renderLeaderboard(data = games) {
    const standings = {};

    data.forEach(g => {
        if (!standings[g.winner]) {
            standings[g.winner] = { name: g.winner, games: 0, totalScore: 0 };
        }
        standings[g.winner].games++;
        standings[g.winner].totalScore += g.score;
    });

    const sortedPlayers = Object.values(standings).sort((a, b) => b.totalScore - a.totalScore);

    safeSetHTML(appDOM.leaderboardBody, sortedPlayers.map((player, index) => `
        <tr class="rank-${index + 1}">
            <td><div class="rank-pill">${index + 1}</div></td>
            <td><strong>${player.name}</strong></td>
            <td>${player.games}</td>
            <td>${player.totalScore.toLocaleString()}</td>
            <td>${((player.games / (games.length || 1)) * 100).toFixed(0)}%</td>
        </tr>
    `).join(''));

    // Render mobile cards
    safeSetHTML(appDOM.standingsList, sortedPlayers.map((player, index) => `
        <div class="standings-mobile-card rank-${index + 1}">
            <div class="mobile-rank">${index + 1}</div>
            <div class="mobile-info">
                <span class="mobile-name">${player.name}</span>
                <span class="mobile-stats">${player.games} games • ${((player.games / (games.length || 1)) * 100).toFixed(0)}% win rate</span>
            </div>
            <div class="mobile-score">
                ${player.totalScore.toLocaleString()}
                <div style="font-size: 0.6rem; color: var(--text-muted);">POINTS</div>
            </div>
        </div>
    `).join(''));
}

function renderRecentGames(data = games) {
    safeSetHTML(appDOM.gamesList, data.slice(0, 12).map(g => `
        <div class="game-card">
            <div class="game-title">${g.game}</div>
            <div class="game-winner">
                <span>🏆</span>
                <span>${g.winner}</span>
            </div>
            <div class="game-meta">
                <span>+${g.score} pts</span>
                <span>${new Date(g.date).toLocaleDateString()}</span>
            </div>
            ${g.screenshot_url ? `
            <div class="game-proof" style="margin-top: 10px;">
                <a href="#" onclick="openImageModal('${g.screenshot_url}'); return false;" style="color: var(--accent); font-size: 0.8rem; text-decoration: none; display: flex; align-items: center; gap: 5px;">
                    🖼️ View Proof Screenshot
                </a>
            </div>
            ` : ''}
            ${(currentUser && (g.user_id === currentUser.id || currentUser.email === ADMIN_EMAIL)) ? `
            <div class="game-actions">
                <button class="btn-action" onclick="editGame(${g.id})">Edit</button>
                <button class="btn-action btn-delete" onclick="deleteGame(${g.id})">Delete</button>
            </div>
            ` : ''}
        </div>
    `).join(''));
}

function updateStats() {
    safeSetText(appDOM.totalGames, games.length);

    const standings = {};
    games.forEach(g => {
        standings[g.winner] = (standings[g.winner] || 0) + g.score;
    });
    const sorted = Object.entries(standings).sort((a, b) => b[1] - a[1]);
    safeSetText(appDOM.topPlayer, sorted.length > 0 ? sorted[0][0] : '-');

    const counts = {};
    games.forEach(g => {
        counts[g.game] = (counts[g.game] || 0) + 1;
    });
    const most = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    safeSetText(appDOM.mostPlayed, most.length > 0 ? most[0][0] : '-');
}

init();
