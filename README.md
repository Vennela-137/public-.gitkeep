# Trivia Battle

A real-time multiplayer trivia game for 2–8 players. The host creates a room, shares the six-character code, and starts a 10-question match.

## Run locally

Requires Python 3.10+.

```bash
python -m pip install -r requirements.txt
python server.py
```

Open **http://localhost:3000** in your browser. To play with friends on the same Wi-Fi, they can open `http://YOUR_COMPUTER_LAN_IP:3000` on their devices. Make sure your firewall allows port 3000.

## Rules

- 2–8 players, unique nicknames per room.
- 10 randomly selected questions across mixed categories.
- 4 multiple-choice options per question, 15 seconds to answer.
- Correct answer: 500 base points plus up to 500 speed bonus.
- Incorrect or unanswered: 0 points.
- Answers and correct choice are revealed after everyone answers or the timer expires.
- Highest total score wins; ties are broken by number of correct answers.

## Notes

- Game state is held in memory; rooms disappear when all players leave or the server restarts.
- The host role transfers to another connected player if the host disconnects.
- This is the first playable core-loop build; persistent accounts, reconnect recovery, and polished animations are not included yet.
