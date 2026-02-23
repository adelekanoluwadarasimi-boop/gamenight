from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import json
import os

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

DATA_FILE = 'games.json'

def load_games():
    if not os.path.exists(DATA_FILE):
        return []
    try:
        with open(DATA_FILE, 'r') as f:
            return json.load(f)
    except:
        return []

def save_games(games):
    with open(DATA_FILE, 'w') as f:
        json.dump(games, f, indent=2)

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/api/games', methods=['GET'])
def get_games():
    games = load_games()
    return jsonify(games)

@app.route('/api/games', methods=['POST'])
def add_game():
    new_game = request.json
    games = load_games()
    # Simple validation or ID generation could go here if needed
    games.insert(0, new_game) # Add to top
    save_games(games)
    return jsonify(new_game), 201

@app.route('/api/games/<int:game_id>', methods=['DELETE'])
def delete_game(game_id):
    games = load_games()
    games = [g for g in games if g.get('id') != game_id]
    save_games(games)
    return jsonify({'success': True})

@app.route('/api/games/<int:game_id>', methods=['PUT'])
def update_game(game_id):
    updated_data = request.json
    games = load_games()
    for index, game in enumerate(games):
        if game.get('id') == game_id:
            # Update fields
            games[index] = {**game, **updated_data}
            save_games(games)
            return jsonify(games[index])
    return jsonify({'error': 'Game not found'}), 404

if __name__ == '__main__':
    print("Server running on http://0.0.0.0:5000")
    print("Accessible locally at http://127.0.0.1:5000")
    app.run(debug=True, host='0.0.0.0', port=5000)

