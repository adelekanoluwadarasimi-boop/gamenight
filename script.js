// Supabase Configuration
const SUPABASE_URL = 'https://mqkniqvfntchiatzlsla.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xa25pcXZmbnRjaGlhdHpsc2xhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NTYyMDksImV4cCI6MjA4NzQzMjIwOX0.YTNzrrHflQ2ymYNGYYDKAaVUrNwafXw9EN1qNT2guyA';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let games = [];
let isEditing = false;
let currentUser = null;
let isLoginMode = true;

const DOM = {
    addBtn: document.getElementById('add-score-btn'),
    scoreModal: document.getElementById('score-modal'),
    modalTitle: document.getElementById('modal-title'),
    closeBtns: document.querySelectorAll('.close-btn'),
    form: document.getElementById('add-score-form'),
    entryId: document.getElementById('entry-id'),
    leaderboardBody: document.getElementById('leaderboard-body'),
    gamesList: document.getElementById('games-list'),
    totalGames: document.getElementById('total-games'),
    topPlayer: document.getElementById('top-player'),
    mostPlayed: document.getElementById('most-played'),
    submitBtn: document.querySelector('.btn-submit'),
    searchInput: document.getElementById('search-input'),
    // Auth elements
    authBtn: document.getElementById('auth-btn'),
    authModal: document.getElementById('auth-modal'),
    authForm: document.getElementById('auth-form'),
    authModalTitle: document.getElementById('auth-modal-title'),
    authSubmitBtn: document.getElementById('auth-submit-btn'),
    toggleLogin: document.getElementById('toggle-login'),
    toggleSignup: document.getElementById('toggle-signup'),
    signupNameGroup: document.getElementById('signup-name-group'),
    userDisplayName: document.getElementById('user-display-name'),
    proofInput: document.getElementById('game-proof')
};

// Initialize App
async function init() {
    await checkUser();
    await fetchGames();

    // Event Listeners
    DOM.addBtn.addEventListener('click', () => {
        isEditing = false;
        DOM.modalTitle.textContent = 'Record a Game';
        DOM.submitBtn.textContent = 'Save Result';
        DOM.form.reset();
        DOM.entryId.value = '';
        DOM.scoreModal.classList.add('active');
    });

    DOM.authBtn.addEventListener('click', handleAuthAction);
    DOM.toggleLogin.addEventListener('click', () => setAuthMode(true));
    DOM.toggleSignup.addEventListener('click', () => setAuthMode(false));
    DOM.authForm.addEventListener('submit', handleAuthSubmit);

    DOM.closeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            DOM.scoreModal.classList.remove('active');
            DOM.authModal.classList.remove('active');
        });
    });

    window.addEventListener('click', (e) => {
        if (e.target === DOM.scoreModal) DOM.scoreModal.classList.remove('active');
        if (e.target === DOM.authModal) DOM.authModal.classList.remove('active');
    });

    DOM.form.addEventListener('submit', handleFormSubmit);
    DOM.searchInput.addEventListener('input', (e) => updateUI(e.target.value));
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
        DOM.userDisplayName.textContent = `Hi, ${name}`;
        DOM.authBtn.textContent = 'Logout';
        DOM.addBtn.style.display = 'block';
    } else {
        DOM.userDisplayName.textContent = '';
        DOM.authBtn.textContent = 'Login';
        DOM.addBtn.style.display = 'none';
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
        DOM.authModal.classList.add('active');
    }
}

function setAuthMode(login) {
    isLoginMode = login;
    DOM.toggleLogin.classList.toggle('active', login);
    DOM.toggleSignup.classList.toggle('active', !login);
    DOM.authModalTitle.textContent = login ? 'Welcome Back' : 'Create Account';
    DOM.authSubmitBtn.textContent = login ? 'Login' : 'Sign Up';
    DOM.signupNameGroup.style.display = login ? 'none' : 'block';
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
        DOM.authModal.classList.remove('active');
        DOM.authForm.reset();

        if (!isLoginMode) alert('Check your email for a confirmation link!');
    } catch (error) {
        alert(error.message);
    }
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

    DOM.submitBtn.textContent = 'Uploading Proof...';
    DOM.submitBtn.disabled = true;

    try {
        let screenshot_url = '';
        const file = DOM.proofInput.files[0];

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

        const entryData = {
            game: document.getElementById('game-name').value,
            winner: document.getElementById('player-name').value,
            score: parseInt(document.getElementById('score').value),
            date: document.getElementById('game-date').value,
            user_id: currentUser.id,
            screenshot_url: screenshot_url
        };

        if (isEditing) {
            const id = parseInt(DOM.entryId.value);
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
        DOM.scoreModal.classList.remove('active');
        DOM.form.reset();
    } catch (error) {
        console.error('Error saving:', error.message);
        alert('Error saving. Make sure you have created a "proofs" bucket in Supabase Storage and added a screenshot_url column to your table!');
    } finally {
        DOM.submitBtn.textContent = 'Save Result';
        DOM.submitBtn.disabled = false;
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
    DOM.modalTitle.textContent = 'Edit Game Record';
    DOM.submitBtn.textContent = 'Update Result';

    DOM.entryId.value = game.id;
    document.getElementById('game-name').value = game.game;
    document.getElementById('player-name').value = game.winner;
    document.getElementById('score').value = game.score;
    document.getElementById('game-date').value = game.date;

    // Screenshot editing is not supported in this simple version
    DOM.scoreModal.classList.add('active');
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

    DOM.leaderboardBody.innerHTML = sortedPlayers.map((player, index) => `
        <tr class="rank-${index + 1}">
            <td><div class="rank-pill">${index + 1}</div></td>
            <td><strong>${player.name}</strong></td>
            <td>${player.games}</td>
            <td>${player.totalScore.toLocaleString()}</td>
            <td>${((player.games / (games.length || 1)) * 100).toFixed(0)}%</td>
        </tr>
    `).join('');
}

function renderRecentGames(data = games) {
    DOM.gamesList.innerHTML = data.slice(0, 12).map(g => `
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
                <a href="${g.screenshot_url}" target="_blank" style="color: var(--accent); font-size: 0.8rem; text-decoration: none; display: flex; align-items: center; gap: 5px;">
                    🖼️ View Proof Screenshot
                </a>
            </div>
            ` : ''}
            ${currentUser ? `
            <div class="game-actions">
                <button class="btn-action" onclick="editGame(${g.id})">Edit</button>
                <button class="btn-action btn-delete" onclick="deleteGame(${g.id})">Delete</button>
            </div>
            ` : ''}
        </div>
    `).join('');
}

function updateStats() {
    DOM.totalGames.textContent = games.length;

    const standings = {};
    games.forEach(g => {
        standings[g.winner] = (standings[g.winner] || 0) + g.score;
    });
    const sorted = Object.entries(standings).sort((a, b) => b[1] - a[1]);
    DOM.topPlayer.textContent = sorted.length > 0 ? sorted[0][0] : '-';

    const counts = {};
    games.forEach(g => {
        counts[g.game] = (counts[g.game] || 0) + 1;
    });
    const most = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    DOM.mostPlayed.textContent = most.length > 0 ? most[0][0] : '-';
}

init();
