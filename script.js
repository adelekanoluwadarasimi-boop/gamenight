// Data Management
const demoData = [
    { id: 1, game: 'Catan', winner: 'Alex', score: 10, date: '2026-01-10' },
    { id: 2, game: 'Poker', winner: 'Jordan', score: 500, date: '2026-01-12' },
    { id: 3, game: 'Monopoly', winner: 'Alex', score: 1500, date: '2026-01-14' },
    { id: 4, game: 'Codenames', winner: 'Sam', score: 1, date: '2026-01-15' }
];

let games = JSON.parse(localStorage.getItem('gameNight_games')) || demoData;
if (!localStorage.getItem('gameNight_games')) {
    localStorage.setItem('gameNight_games', JSON.stringify(demoData));
}

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
function init() {
    updateUI();

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

function handleFormSubmit(e) {
    e.preventDefault();

    const entryData = {
        game: document.getElementById('game-name').value,
        winner: document.getElementById('player-name').value,
        score: parseInt(document.getElementById('score').value),
        date: document.getElementById('game-date').value
    };

    if (isEditing) {
        const id = parseInt(DOM.entryId.value);
        const index = games.findIndex(g => g.id === id);
        if (index !== -1) {
            games[index] = { ...games[index], ...entryData };
        }
    } else {
        const newGame = {
            id: Date.now(),
            ...entryData
        };
        games.unshift(newGame);
    }

    localStorage.setItem('gameNight_games', JSON.stringify(games));

    updateUI();
    DOM.modal.classList.remove('active');
    DOM.form.reset();
}

function deleteGame(id) {
    if (confirm('Are you sure you want to delete this game record?')) {
        games = games.filter(g => g.id !== id);
        localStorage.setItem('gameNight_games', JSON.stringify(games));
        updateUI();
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
