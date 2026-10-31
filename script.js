// Supabase Configuration
const SUPABASE_URL = 'https://mqkniqvfntchiatzlsla.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xa25pcXZmbnRjaGlhdHpsc2xhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NTYyMDksImV4cCI6MjA4NzQzMjIwOX0.YTNzrrHflQ2ymYNGYYDKAaVUrNwafXw9EN1qNT2guyA';

let _supabase = null;
try {
    if (typeof supabase !== 'undefined' && SUPABASE_URL && SUPABASE_KEY) {
        _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
} catch (e) {
    console.warn('Supabase initialization failed:', e);
}

let games = [];
let isEditing = false;
let currentUser = null;
let isLoginMode = true;
let isLocalMode = false;

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
    get standingsList() { return document.getElementById('standings-list'); },
    get statusBadge() { return document.getElementById('backend-status-badge'); },
    get gameNameInput() { return document.getElementById('game-name'); },
    get resetGamesBtn() { return document.getElementById('reset-games-btn'); }
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

function isAdmin() {
    return currentUser && currentUser.email && currentUser.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

function updateModeIndicator() {
    if (!appDOM.statusBadge) return;
    if (isLocalMode) {
        appDOM.statusBadge.textContent = '⚡ Local Tournament Mode';
        appDOM.statusBadge.className = 'badge-status';
        appDOM.statusBadge.title = 'Scores are stored locally on this device.';
    } else {
        appDOM.statusBadge.textContent = '🟢 Cloud Live Sync';
        appDOM.statusBadge.className = 'badge-status cloud';
        appDOM.statusBadge.title = 'Connected to Supabase. Scores sync live across all devices.';
    }
}

// Initialize App
async function init() {
    await checkUser();
    await fetchGames();
    updateModeIndicator();

    // Setup Supabase Realtime channel so scores update live for everyone
    if (_supabase && !isLocalMode) {
        try {
            _supabase.channel('public:games')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, () => {
                    fetchGames();
                })
                .subscribe();
        } catch (e) {
            console.warn('Realtime subscription error:', e);
        }
    }

    // Event Listeners
    appDOM.addBtn?.addEventListener('click', () => {
        isEditing = false;
        safeSetText(appDOM.modalTitle, 'Record a Game');
        safeSetText(appDOM.submitBtn, 'Save Result');
        appDOM.form?.reset();
        if (appDOM.entryId) appDOM.entryId.value = '';
        const dateInput = document.getElementById('game-date');
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
        appDOM.scoreModal?.classList.add('active');
    });

    appDOM.authBtn?.addEventListener('click', handleAuthAction);
    appDOM.toggleLogin?.addEventListener('click', () => setAuthMode(true));
    appDOM.toggleSignup?.addEventListener('click', () => setAuthMode(false));
    appDOM.authForm?.addEventListener('submit', handleAuthSubmit);

    appDOM.closeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            appDOM.scoreModal?.classList.remove('active');
            appDOM.authModal?.classList.remove('active');
            appDOM.imageModal?.classList.remove('active');
        });
    });

    window.addEventListener('click', (e) => {
        if (e.target === appDOM.scoreModal) appDOM.scoreModal.classList.remove('active');
        if (e.target === appDOM.authModal) appDOM.authModal.classList.remove('active');
        if (e.target === appDOM.imageModal) appDOM.imageModal.classList.remove('active');
    });

    appDOM.form?.addEventListener('submit', handleFormSubmit);
    appDOM.searchInput?.addEventListener('input', (e) => updateUI(e.target.value));
    appDOM.resetGamesBtn?.addEventListener('click', handleResetAllGames);

    if (appDOM.statusBadge) {
        appDOM.statusBadge.addEventListener('click', () => {
            if (isLocalMode) {
                alert("GameNight is currently in Local Storage Mode.\n\nConnect to Supabase to enable multi-device live sync.");
            } else {
                alert("🟢 Supabase Live Cloud Sync Active!\n\nAll scores submitted by you or your friends update instantly across every device.");
            }
        });
    }
}

// User & Auth Functions
async function checkUser() {
    if (_supabase) {
        try {
            const { data, error } = await _supabase.auth.getUser();
            if (error) {
                if (error.message && (error.message.includes('fetch') || error.message.includes('Network'))) {
                    throw error;
                }
                currentUser = null;
                isLocalMode = false;
            } else {
                currentUser = data?.user || null;
                isLocalMode = false;
            }
        } catch (e) {
            console.warn('Supabase auth offline, falling back to local session:', e.message);
            isLocalMode = true;
        }
    } else {
        isLocalMode = true;
    }

    if (isLocalMode) {
        const localUserJson = localStorage.getItem('gamenight_current_user');
        if (localUserJson) {
            try {
                currentUser = JSON.parse(localUserJson);
            } catch (_) {
                currentUser = null;
            }
        }
    }
    updateAuthUI();
}

function updateAuthUI() {
    if (currentUser) {
        const name = currentUser.user_metadata?.display_name || currentUser.displayName || currentUser.email.split('@')[0];
        safeSetText(appDOM.userDisplayName, `Hi, ${name}`);
        safeSetText(appDOM.authBtn, 'Logout');
        if (appDOM.addBtn) appDOM.addBtn.style.display = 'block';
    } else {
        safeSetText(appDOM.userDisplayName, '');
        safeSetText(appDOM.authBtn, 'Login / Join');
        if (appDOM.addBtn) appDOM.addBtn.style.display = 'none';
    }

    if (appDOM.resetGamesBtn) {
        appDOM.resetGamesBtn.style.display = isAdmin() ? 'inline-block' : 'none';
    }
}

function handleAuthAction() {
    if (currentUser) {
        if (!isLocalMode && _supabase) {
            _supabase.auth.signOut().catch(() => {});
        }
        currentUser = null;
        localStorage.removeItem('gamenight_current_user');
        updateAuthUI();
        updateUI();
    } else {
        appDOM.authModal?.classList.add('active');
    }
}

function setAuthMode(login) {
    isLoginMode = login;
    appDOM.toggleLogin?.classList.toggle('active', login);
    appDOM.toggleSignup?.classList.toggle('active', !login);
    safeSetText(appDOM.authModalTitle, login ? 'Welcome Back' : 'Create Player Account');
    safeSetText(appDOM.authSubmitBtn, login ? 'Login' : 'Sign Up');
    if (appDOM.signupNameGroup) appDOM.signupNameGroup.style.display = login ? 'none' : 'block';
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const displayName = document.getElementById('signup-name')?.value?.trim() || email.split('@')[0];

    // Try Supabase Auth
    if (!isLocalMode && _supabase) {
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

            if (!isLoginMode && !result.data.session) {
                alert('Account created! Please check your email for confirmation if required.');
            } else {
                alert(`Welcome, ${displayName}! You are ready to log scores.`);
            }
            return;
        } catch (error) {
            if (error.message && (error.message.includes('Failed to fetch') || error.message.includes('NetworkError'))) {
                console.warn('Network error, falling back to local mode:', error.message);
                isLocalMode = true;
                updateModeIndicator();
            } else {
                alert(error.message);
                return;
            }
        }
    }

    // Local Tournament Auth Fallback
    try {
        let localUsers = JSON.parse(localStorage.getItem('gamenight_local_users') || '[]');

        if (isLoginMode) {
            const user = localUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
            if (!user) {
                const autoRegister = confirm(`Player account "${email}" not found locally. Would you like to create this account now?`);
                if (autoRegister) {
                    const newUser = { id: 'usr_' + Date.now(), email, password, displayName };
                    localUsers.push(newUser);
                    localStorage.setItem('gamenight_local_users', JSON.stringify(localUsers));
                    currentUser = { id: newUser.id, email: newUser.email, user_metadata: { display_name: newUser.displayName } };
                } else {
                    return;
                }
            } else {
                if (user.password && user.password !== password) {
                    alert('Incorrect password. Please try again.');
                    return;
                }
                currentUser = { id: user.id, email: user.email, user_metadata: { display_name: user.displayName } };
            }
        } else {
            const existing = localUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
            if (existing) {
                alert('An account with this email/name already exists. Switching to Login.');
                setAuthMode(true);
                return;
            }
            const newUser = { id: 'usr_' + Date.now(), email, password, displayName };
            localUsers.push(newUser);
            localStorage.setItem('gamenight_local_users', JSON.stringify(localUsers));
            currentUser = { id: newUser.id, email: newUser.email, user_metadata: { display_name: newUser.displayName } };
        }

        localStorage.setItem('gamenight_current_user', JSON.stringify(currentUser));
        updateAuthUI();
        appDOM.authModal?.classList.remove('active');
        appDOM.authForm?.reset();
        alert(`Welcome, ${currentUser.user_metadata.display_name}!`);
    } catch (err) {
        alert('Authentication error: ' + err.message);
    }
}

// Image Viewer Logic
window.openImageModal = function (url) {
    if (appDOM.imageModalFullSize) appDOM.imageModalFullSize.src = url;
    appDOM.imageModal?.classList.add('active');
};

// Game Functions
async function fetchGames() {
    if (!isLocalMode && _supabase) {
        try {
            const { data, error } = await _supabase
                .from('games')
                .select('*')
                .order('date', { ascending: false });

            if (error) throw error;
            games = data || [];
            updateUI();
            return;
        } catch (error) {
            console.warn('Error fetching from Supabase, checking local:', error.message);
            isLocalMode = true;
            updateModeIndicator();
        }
    }

    // Local Storage Data
    const stored = localStorage.getItem('gamenight_games');
    if (stored) {
        try {
            games = JSON.parse(stored);
        } catch (_) {
            games = [];
        }
    } else {
        games = [];
        localStorage.setItem('gamenight_games', JSON.stringify([]));
    }
    updateUI();
}

async function handleResetAllGames() {
    if (!isAdmin()) {
        alert('Permission Denied: Only the admin (' + ADMIN_EMAIL + ') can clear all scores.');
        return;
    }

    const confirmed = confirm('⚠️ WARNING: Are you sure you want to delete ALL game scores?\n\nThis will reset the entire tournament and cannot be undone.');
    if (!confirmed) return;

    try {
        if (!isLocalMode && _supabase) {
            try {
                const { error } = await _supabase.from('games').delete().neq('id', 0);
                if (error) throw error;
            } catch (e) {
                console.warn('Supabase bulk delete warning:', e.message);
            }
        }

        games = [];
        localStorage.removeItem('gamenight_games');
        localStorage.setItem('gamenight_games', JSON.stringify([]));
        updateUI();
        alert('All tournament scores and games have been cleared!');
    } catch (err) {
        alert('Error clearing scores: ' + err.message);
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();
    if (!currentUser) {
        alert('Please login or join first to submit scores.');
        return;
    }

    if (isEditing && !isAdmin()) {
        alert('Permission Denied: Only the tournament admin (' + ADMIN_EMAIL + ') can edit scores.');
        return;
    }

    safeSetText(appDOM.submitBtn, 'Saving Result...');
    if (appDOM.submitBtn) appDOM.submitBtn.disabled = true;

    try {
        let screenshot_url = '';
        const file = appDOM.proofInput?.files[0];

        if (file) {
            if (!isLocalMode && _supabase) {
                try {
                    const fileExt = file.name.split('.').pop();
                    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
                    const filePath = `proofs/${fileName}`;

                    let { error: uploadError } = await _supabase.storage
                        .from('proofs')
                        .upload(filePath, file);

                    if (!uploadError) {
                        const { data: urlData } = _supabase.storage
                            .from('proofs')
                            .getPublicUrl(filePath);
                        screenshot_url = urlData.publicUrl;
                    }
                } catch (e) {
                    console.warn('Storage upload failed, falling back to local image data:', e);
                }
            }

            if (!screenshot_url) {
                screenshot_url = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (ev) => resolve(ev.target.result);
                    reader.onerror = () => resolve('');
                    reader.readAsDataURL(file);
                });
            }
        }

        const selectedGame = (appDOM.gameNameInput?.value || document.getElementById('game-name')?.value || '').trim() || 'Custom Game';
        const winnerName = currentUser.user_metadata?.display_name || currentUser.displayName || currentUser.email.split('@')[0];

        const entryData = {
            game: selectedGame,
            winner: winnerName,
            score: parseInt(document.getElementById('score').value) || 0,
            date: document.getElementById('game-date').value,
            user_id: currentUser.id,
            screenshot_url: screenshot_url
        };

        if (!isLocalMode && _supabase) {
            try {
                if (isEditing) {
                    const id = parseInt(appDOM.entryId?.value);
                    const { data, error } = await _supabase
                        .from('games')
                        .update(entryData)
                        .eq('id', id)
                        .select();
                    if (error) throw error;
                    const index = games.findIndex(g => g.id === id);
                    if (index !== -1 && data && data[0]) games[index] = data[0];
                } else {
                    const { data, error } = await _supabase
                        .from('games')
                        .insert([entryData])
                        .select();
                    if (error) throw error;
                    if (data && data[0]) games.unshift(data[0]);
                }
            } catch (err) {
                console.error('Supabase save error:', err);
                alert('Database error: ' + err.message);
                return;
            }
        } else {
            entryData.id = isEditing ? parseInt(appDOM.entryId?.value) : Date.now();
            saveGameLocally(entryData);
        }

        updateUI();
        appDOM.scoreModal?.classList.remove('active');
        appDOM.form?.reset();
    } catch (error) {
        console.error('Error saving game:', error.message);
        alert('Error saving game: ' + error.message);
    } finally {
        safeSetText(appDOM.submitBtn, 'Save Result');
        if (appDOM.submitBtn) appDOM.submitBtn.disabled = false;
    }
}

function saveGameLocally(entryData) {
    if (isEditing) {
        const id = parseInt(appDOM.entryId?.value);
        const index = games.findIndex(g => g.id === id);
        if (index !== -1) {
            if (!entryData.screenshot_url && games[index].screenshot_url) {
                entryData.screenshot_url = games[index].screenshot_url;
            }
            games[index] = entryData;
        }
    } else {
        games.unshift(entryData);
    }
    localStorage.setItem('gamenight_games', JSON.stringify(games));
}

async function deleteGame(id) {
    if (!isAdmin()) {
        alert('Permission Denied: Only the tournament admin (' + ADMIN_EMAIL + ') can delete scores.');
        return;
    }
    if (confirm('Are you sure you want to delete this game record?')) {
        try {
            if (!isLocalMode && _supabase) {
                try {
                    const { error } = await _supabase
                        .from('games')
                        .delete()
                        .eq('id', id);
                    if (error) throw error;
                } catch (e) {
                    console.warn('Cloud delete failed:', e);
                }
            }
            games = games.filter(g => g.id !== id);
            localStorage.setItem('gamenight_games', JSON.stringify(games));
            updateUI();
        } catch (error) {
            console.error('Error deleting:', error.message);
        }
    }
}

function editGame(id) {
    if (!isAdmin()) {
        alert('Permission Denied: Only the tournament admin (' + ADMIN_EMAIL + ') can edit scores.');
        return;
    }
    const game = games.find(g => g.id === id);
    if (!game) return;

    isEditing = true;
    safeSetText(appDOM.modalTitle, 'Edit Game Record');
    safeSetText(appDOM.submitBtn, 'Update Result');

    if (appDOM.entryId) appDOM.entryId.value = game.id;
    if (appDOM.gameNameInput) appDOM.gameNameInput.value = game.game;

    document.getElementById('score').value = game.score;
    document.getElementById('game-date').value = game.date;

    appDOM.scoreModal?.classList.add('active');
}

function updateGameSuggestions() {
    const datalist = document.getElementById('game-suggestions');
    if (!datalist) return;
    const uniqueGames = [...new Set(games.map(g => g.game).filter(Boolean))];
    safeSetHTML(datalist, uniqueGames.map(name => `<option value="${name}">`).join(''));
}

function updateUI(searchTerm = '') {
    const lowerSearch = (searchTerm || '').toLowerCase();
    const filteredGames = games.filter(g =>
        (g.game || '').toLowerCase().includes(lowerSearch) ||
        (g.winner || '').toLowerCase().includes(lowerSearch)
    );

    renderLeaderboard(filteredGames);
    renderRecentGames(filteredGames);
    updateStats();
    updateGameSuggestions();
}

function renderLeaderboard(data = games) {
    const standings = {};

    data.forEach(g => {
        if (!standings[g.winner]) {
            standings[g.winner] = { name: g.winner, games: 0, totalScore: 0 };
        }
        standings[g.winner].games++;
        standings[g.winner].totalScore += (parseInt(g.score) || 0);
    });

    const sortedPlayers = Object.values(standings).sort((a, b) => b.totalScore - a.totalScore);

    if (sortedPlayers.length === 0) {
        safeSetHTML(appDOM.leaderboardBody, `
            <tr>
                <td colspan="5" style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted); font-size: 0.95rem;">
                    No games recorded yet. Submit the first score to start the tournament!
                </td>
            </tr>
        `);
        safeSetHTML(appDOM.standingsList, `
            <div style="text-align: center; padding: 2rem 1rem; color: var(--text-muted); background: rgba(255,255,255,0.02); border-radius: 12px; border: 1px dashed var(--glass-border);">
                No games recorded yet.
            </div>
        `);
        return;
    }

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
    if (data.length === 0) {
        safeSetHTML(appDOM.gamesList, `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem 1.5rem; color: var(--text-muted); background: rgba(255, 255, 255, 0.02); border-radius: 16px; border: 1px dashed var(--glass-border);">
                <div style="font-size: 2rem; margin-bottom: 0.5rem;">🎮</div>
                <div style="font-weight: 600; font-size: 1.1rem; color: var(--text-main); margin-bottom: 0.25rem;">Tournament Ready!</div>
                <div>No games have been recorded yet. Click <strong>+ New Score</strong> above to log your first match.</div>
            </div>
        `);
        return;
    }

    safeSetHTML(appDOM.gamesList, data.slice(0, 12).map(g => {
        const canManage = isAdmin();

        return `
        <div class="game-card">
            <div class="game-title">${g.game}</div>
            <div class="game-winner">
                <span>🏆</span>
                <span>${g.winner}</span>
            </div>
            <div class="game-meta">
                <span>+${g.score} pts</span>
                <span>${g.date}</span>
            </div>
            ${g.screenshot_url ? `
            <div class="game-proof" style="margin-top: 10px;">
                <a href="#" onclick="openImageModal('${g.screenshot_url}'); return false;" style="color: var(--accent); font-size: 0.8rem; text-decoration: none; display: flex; align-items: center; gap: 5px;">
                    🖼️ View Proof Screenshot
                </a>
            </div>
            ` : ''}
            ${canManage ? `
            <div class="game-actions" style="margin-top: 12px; display: flex; gap: 8px;">
                <button class="btn-action" onclick="editGame(${g.id})">Edit</button>
                <button class="btn-action btn-delete" onclick="deleteGame(${g.id})">Delete</button>
            </div>
            ` : ''}
        </div>
        `;
    }).join(''));
}

function updateStats() {
    safeSetText(appDOM.totalGames, games.length);

    const standings = {};
    games.forEach(g => {
        standings[g.winner] = (standings[g.winner] || 0) + (parseInt(g.score) || 0);
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
