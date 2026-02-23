// Supabase Configuration
const SUPABASE_URL = 'https://mqkniqvfntchiatzlsla.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xa25pcXZmbnRjaGlhdHpsc2xhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NTYyMDksImV4cCI6MjA4NzQzMjIwOX0.YTNzrrHflQ2ymYNGYYDKAaVUrNwafXw9EN1qNT2guyA';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let games = [];
let isEditing = false;

const DOM = {
    addBtn: document.getElementById('add-score-btn'),
    modal: document.getElementById('score-modal'),
    modalTitle: document.getElementById('modal-title'),
    closeBtn: document.querySelector('.close-btn'),
    form: document.getElementById('add-score-form'),
    entryId: document.getElementById('entry-id'),
    leaderboardBody: document.getElementById('leaderboard-body'),
    gamesList: document.getElementById('games-list'),
    totalGames: document.getElementById('total-games'),
    topPlayer: document.getElementById('top-player'),
    mostPlayed: document.getElementById('most-played'),
    submitBtn: document.querySelector('.btn-submit'),
    searchInput: document.getElementById('search-input')
};

// Initialize App
async function init() {
    await fetchGames();

    // Event Listeners
    DOM.addBtn.addEventListener('click', () => {
        isEditing = false;
        DOM.modalTitle.textContent = 'Record a Game';
        DOM.submitBtn.textContent = 'Save Result';
        DOM.form.reset();
        DOM.entryId.value = '';
        DOM.modal.classList.add('active');
    });

    DOM.closeBtn.addEventListener('click', () => DOM.modal.classList.remove('active'));
    window.addEventListener('click', (e) => {
        if (e.target === DOM.modal) DOM.modal.classList.remove('active');
    });

    DOM.form.addEventListener('submit', handleFormSubmit);
    DOM.searchInput.addEventListener('input', (e) => updateUI(e.target.value));
}

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

    const entryData = {
        game: document.getElementById('game-name').value,
        winner: document.getElementById('player-name').value,
        score: parseInt(document.getElementById('score').value),
        date: document.getElementById('game-date').value
    };

    try {
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
        DOM.modal.classList.remove('active');
        DOM.form.reset();
    } catch (error) {
        console.error('Error saving to Supabase:', error.message);
        alert('Failed to save score. Please check your Supabase table settings.');
    }
}

async function deleteGame(id) {
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
            console.error('Error deleting from Supabase:', error.message);
        }
    }
}

function editGame(id) {
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

    DOM.modal.classList.add('active');
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
            <div class="game-actions">
                <button class="btn-action" onclick="editGame(${g.id})">Edit</button>
                <button class="btn-action btn-delete" onclick="deleteGame(${g.id})">Delete</button>
            </div>
        </div>
    `).join('');
}

function updateStats() {
    DOM.totalGames.textContent = games.length;

    // Top Player
    const standings = {};
    games.forEach(g => {
        standings[g.winner] = (standings[g.winner] || 0) + g.score;
    });
    const sorted = Object.entries(standings).sort((a, b) => b[1] - a[1]);
    DOM.topPlayer.textContent = sorted.length > 0 ? sorted[0][0] : '-';

    // Most Played
    const counts = {};
    games.forEach(g => {
        counts[g.game] = (counts[g.game] || 0) + 1;
    });
    const most = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    DOM.mostPlayed.textContent = most.length > 0 ? most[0][0] : '-';
}

init();
