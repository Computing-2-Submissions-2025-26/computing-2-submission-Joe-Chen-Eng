# Palace Card Duel
**CID**: [YOUR CID]

Palace Card Duel is a browser-based, turn-based card game for the Computing 2: Applications coursework. The player sits at a four-player table against three simple AI players and tries to empty their hand, face-up palace, and face-down palace first.

## How to Run

Install dependencies:

```properties
npm install
```

Open the game:

```properties
open web-app/index.html
```

Run the unit tests:

```properties
npm test
```

Generate the API documentation:

```properties
npm run docs
```

## Game Rules

1. Four players sit around the table: the human player and three AI players.
1. Each player starts with three hand cards, three face-up palace cards, and three face-down palace cards.
1. Only the human player's hand cards are shown face-up. Other players' hands are shown as card backs.
1. On your turn, play one or more cards of the same rank from your current playable area.
1. A normal card must be equal to or higher than the top card on the pile.
1. A `2` can be played on anything and resets the pile.
1. A `10` clears the pile and gives the same player another turn.
1. Four cards of the same rank on top of the pile also clear the pile.
1. If you cannot play, pick up the pile.
1. When your hand is empty, you play your face-up palace cards.
1. When those are empty, you play face-down cards blindly.
1. The first player with no cards in any palace area wins.

## Coursework Components

### Game Module API

The game API is documented with JSDoc in `web-app/Module.js`. It includes functions for creating games, checking legal moves, playing cards, picking up the pile, running AI turns, reading winners, and rendering a public state snapshot.

### Game Module Implementation

The game state transitions are implemented in `web-app/Module.js`. The functions return new state objects rather than relying on browser UI state, so the game can be simulated in code.

### Unit Tests Specification and Implementation

The unit tests in `web-app/tests/palace-rules.test.js` specify and test the main Palace behaviours:

- normal card legality,
- special cards,
- playing cards to the pile,
- clearing the pile with a `10`,
- picking up the pile,
- failing a blind face-down play,
- detecting the winner,
- identifying playable cards from the current playable area.

### Web Application

The web app is implemented with separated files:

- `web-app/index.html` for structure,
- `web-app/default.css` for styling,
- `web-app/main.js` for browser behaviour,
- `web-app/Module.js` for the game rules.

The interface includes an opening tutorial, keyboard-accessible card buttons, clear status panels, a game log, restart control, and a pick-up action.
The `Guide` button temporarily loads a prepared training deal with a distinct tutorial background, then restores the player's previous game when the guide is closed or finished. The walkthrough covers the table layout, the player's hand, palace stacks, play order, the centre pile, normal plays, special cards, status information, opponents, picking up, and the win condition. Each tutorial step requires the player to complete a small action before the next step unlocks.
