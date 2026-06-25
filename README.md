# Palace Card Duel
**CID**: [YOUR CID]

Palace Card Duel is my browser version of the card game Palace, made for the Computing 2: Applications coursework. The game puts the user at a four-player table with three computer players, and the aim is to get rid of all cards in the hand, then the face-up palace cards, and finally the face-down cards.

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

1. The game is played by four players: one human player and three computer players.
1. Everyone begins with three cards in hand, three cards face up, and three cards face down.
1. The player can see their own hand, but the other players' hands stay hidden.
1. On a turn, the player chooses cards from the current area they are allowed to use.
1. Most cards have to match or beat the value already on the pile.
1. A `2` is useful because it can be played after any card.
1. A `10` clears the whole pile and lets the same player continue.
1. Four cards of the same rank in a row also clear the pile.
1. If a player cannot make a legal move, they have to take the pile.
1. After the hand is empty, the face-up palace cards are used.
1. After the face-up cards are gone, face-down cards are revealed one at a time.
1. The round is won by the first player who gets rid of all their cards.

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
