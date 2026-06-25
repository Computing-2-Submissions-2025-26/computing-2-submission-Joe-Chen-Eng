/**
 * Palace is a turn-based card game for four players. Players try to be the
 * first to empty their hand, face-up palace cards, and face-down palace cards.
 * The module is written as pure functions so a complete game can be simulated
 * from the browser console or from unit tests.
 *
 * @module Palace
 */

const ranks = ["3", "4", "5", "6", "7", "8", "9", "J", "Q", "K", "A", "2", "10"];
const suits = ["S", "H", "D", "C"];

const rankValues = {
    "3": 3,
    "4": 4,
    "5": 5,
    "6": 6,
    "7": 7,
    "8": 8,
    "9": 9,
    "J": 11,
    "Q": 12,
    "K": 13,
    "A": 14,
    "2": 2,
    "10": 16
};

const pileClearRanks = ["10"];
const flexibleRank = "2";
const lowCeilingRank = "9";

/**
 * @typedef {Object} Card
 * @property {string} id Unique card identifier, e.g. "AS".
 * @property {string} rank Card rank. Special ranks are "2" and "10".
 * @property {string} suit Card suit: "S", "H", "D", or "C".
 */

/**
 * @typedef {Object} Player
 * @property {string} name Player display name.
 * @property {Card[]} hand Cards currently available to choose.
 * @property {Card[]} faceUp Palace cards that are visible once the hand is empty.
 * @property {Card[]} faceDown Palace cards that are played blind at the end.
 * @property {string[]} knownFaceDownIds Face-down card ids this player has revealed but not played.
 */

/**
 * @typedef {Object} PlayedSet
 * @property {number|null} playerIndex Player who made the play, or null for setup cards.
 * @property {string} playerName Name shown in the current-round summary.
 * @property {Card[]} cards Cards played together.
 */

/**
 * @typedef {Object} GameState
 * @property {Player[]} players The human player is index 0 and the other players are computer-controlled.
 * @property {number} currentPlayer Index of the player whose turn it is.
 * @property {Card[]} drawPile Face-down deck used to refill hands up to three cards.
 * @property {Card[]} pile Cards in the current discard pile.
 * @property {PlayedSet[]} roundPlays Cards played into the current unresolved pile.
 * @property {PlayedSet|null} lastPlay Most recent card play, used for UI animation.
 * @property {number} moveNumber Number of card-play moves made in this game.
 * @property {number[]} scores Match scores for all players.
 * @property {number|null} matchWinner Index of the match winner, or null if the match is still active.
 * @property {boolean} stalemate True when the round ended without a winner.
 * @property {Card[]} burned Cards removed from play by a 10 or four of a kind.
 * @property {string[]} log Most recent game events.
 * @property {number|null} winner Index of the winning player, or null if the game is not over.
 * @property {string} phase Short description of the active player's current playable area.
 */

const cloneCard = function (card) {
    return {
        id: card.id,
        rank: card.rank,
        suit: card.suit
    };
};

const cloneCards = function (cards) {
    return cards.map(cloneCard);
};

const clonePlayedSet = function (play) {
    return play === null || play === undefined
        ? null
        : {
            playerIndex: play.playerIndex,
            playerName: play.playerName,
            cards: cloneCards(play.cards)
        };
};

const cloneRoundPlays = function (roundPlays = []) {
    return roundPlays.map(function (play) {
        return {
            playerIndex: play.playerIndex,
            playerName: play.playerName,
            cards: cloneCards(play.cards)
        };
    });
};

const clonePlayer = function (player) {
    return {
        name: player.name,
        hand: cloneCards(player.hand),
        faceUp: cloneCards(player.faceUp),
        faceDown: cloneCards(player.faceDown),
        knownFaceDownIds: (player.knownFaceDownIds || []).slice()
    };
};

const cloneState = function (state) {
    return {
        players: state.players.map(clonePlayer),
        currentPlayer: state.currentPlayer,
        drawPile: cloneCards(state.drawPile),
        pile: cloneCards(state.pile),
        roundPlays: cloneRoundPlays(state.roundPlays),
        lastPlay: clonePlayedSet(state.lastPlay),
        moveNumber: state.moveNumber || 0,
        scores: (state.scores || [0, 0, 0, 0]).slice(),
        matchWinner: state.matchWinner ?? null,
        stalemate: Boolean(state.stalemate),
        burned: cloneCards(state.burned),
        log: state.log.slice(),
        winner: state.winner,
        phase: state.phase
    };
};

const log = function (state, message) {
    return {
        ...state,
        log: [message].concat(state.log).slice(0, 8)
    };
};

const nextSeed = function (seed) {
    return (seed * 1664525 + 1013904223) % 4294967296;
};

const randomBetween = function (seed, maximum) {
    const next = nextSeed(seed);
    return {
        seed: next,
        value: Math.floor((next / 4294967296) * maximum)
    };
};

const makeDeck = function () {
    return suits.flatMap(function (suit) {
        return ranks.map(function (rank) {
            return {
                id: rank + suit,
                rank,
                suit
            };
        });
    });
};

const shuffle = function (cards, seed) {
    const shuffled = cloneCards(cards);
    let activeSeed = seed;

    for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const random = randomBetween(activeSeed, index + 1);
        activeSeed = random.seed;
        const temp = shuffled[index];
        shuffled[index] = shuffled[random.value];
        shuffled[random.value] = temp;
    }

    return shuffled;
};

const drawToThreeAtTurnStart = function (player, drawPile) {
    const nextPlayer = clonePlayer(player);
    const nextDrawPile = cloneCards(drawPile);

    if (nextPlayer.hand.length === 0 || nextPlayer.hand.length >= 3) {
        return {
            player: nextPlayer,
            drawPile: nextDrawPile
        };
    }

    while (nextPlayer.hand.length < 3 && nextDrawPile.length > 0) {
        nextPlayer.hand = nextPlayer.hand.concat([nextDrawPile[0]]);
        nextDrawPile.shift();
    }

    return {
        player: nextPlayer,
        drawPile: nextDrawPile
    };
};

const topActiveCard = function (pile) {
    return pile.length === 0
        ? null
        : pile[pile.length - 1];
};

const canPlayCardOnPile = function (card, pile) {
    const topCard = topActiveCard(pile);

    if (pileClearRanks.includes(card.rank) || card.rank === flexibleRank || topCard === null) {
        return true;
    }

    if (topCard.rank === flexibleRank) {
        return true;
    }

    if (topCard.rank === lowCeilingRank) {
        return rankValues[card.rank] <= rankValues[lowCeilingRank];
    }

    return rankValues[card.rank] >= rankValues[topCard.rank];
};

const activeArea = function (player) {
    if (player.hand.length > 0) {
        return "hand";
    }

    if (player.faceUp.length > 0) {
        return "faceUp";
    }

    return "faceDown";
};

const removeCardsById = function (cards, cardIds) {
    return cards.filter(function (card) {
        return !cardIds.includes(card.id);
    });
};

const cardsFromIds = function (cards, cardIds) {
    return cardIds.map(function (cardId) {
        return cards.find(function (card) {
            return card.id === cardId;
        });
    }).filter(Boolean);
};

const allSameRank = function (cards) {
    return cards.length > 0 && cards.every(function (card) {
        return card.rank === cards[0].rank;
    });
};

const isValidPlayGroup = function (cards) {
    if (cards.length === 0) {
        return false;
    }

    if (allSameRank(cards)) {
        return true;
    }

    const nonFlexibleCards = cards.filter(function (card) {
        return card.rank !== flexibleRank;
    });

    return nonFlexibleCards.length > 0 && allSameRank(nonFlexibleCards);
};

const orderPlayedCards = function (cards) {
    return cards.filter(function (card) {
        return card.rank !== flexibleRank;
    }).concat(cards.filter(function (card) {
        return card.rank === flexibleRank;
    }));
};

const completesFourOfAKind = function (pile) {
    if (pile.length < 4) {
        return false;
    }

    const topRank = pile[pile.length - 1].rank;
    return pile.slice(-4).every(function (card) {
        return card.rank === topRank;
    });
};

const hasNoCards = function (player) {
    return player.hand.length === 0
        && player.faceUp.length === 0
        && player.faceDown.length === 0;
};

const hasUnknownFaceDown = function (player) {
    return player.faceDown.some(function (card) {
        return !(player.knownFaceDownIds || []).includes(card.id);
    });
};

const hasPotentialMove = function (player, pile) {
    const area = activeArea(player);

    if (area === "faceDown") {
        if (hasUnknownFaceDown(player)) {
            return true;
        }

        return player.faceDown.some(function (card) {
            return canPlayCardOnPile(card, pile);
        });
    }

    return player[area].some(function (card) {
        return canPlayCardOnPile(card, pile) || player[area].some(function (candidate) {
            return candidate.rank === flexibleRank;
        });
    });
};

const isStalemate = function (state) {
    return state.drawPile.length === 0
        && state.pile.length > 0
        && state.players.every(function (player) {
            return !hasPotentialMove(player, state.pile);
        });
};

const matchWinnerFromScores = function (scores) {
    const winnerIndex = scores.findIndex(function (score) {
        return score >= 10;
    });

    return winnerIndex === -1
        ? null
        : winnerIndex;
};

const awardRoundScores = function (scores, winnerIndex, stalemate) {
    return scores.map(function (score, index) {
        if (stalemate) {
            return score + 1;
        }

        return score + (index === winnerIndex ? 2 : 0);
    });
};

const withUpdatedPhase = function (state) {
    return {
        ...state,
        phase: state.winner === null && !state.stalemate
            ? activeArea(state.players[state.currentPlayer])
            : "finished"
    };
};

const finishTurn = function (state, playerIndex, keepsTurn, refillNextPlayer = true) {
    const nextPlayerIndex = keepsTurn
        ? playerIndex
        : (playerIndex + 1) % state.players.length;
    const refilled = refillNextPlayer
        ? drawToThreeAtTurnStart(state.players[nextPlayerIndex], state.drawPile)
        : {
            player: clonePlayer(state.players[nextPlayerIndex]),
            drawPile: state.drawPile.slice()
        };
    const players = state.players.map(function (player, index) {
        return index === nextPlayerIndex
            ? refilled.player
            : clonePlayer(player);
    });
    const winnerIndex = players.findIndex(hasNoCards);
    const roundState = {
        ...state,
        players,
        drawPile: refilled.drawPile,
        currentPlayer: nextPlayerIndex,
        winner: winnerIndex === -1
            ? null
            : winnerIndex,
        stalemate: false
    };
    const stalemate = winnerIndex === -1 && isStalemate(roundState);
    const roundEnded = winnerIndex !== -1 || stalemate;
    const scores = roundEnded
        ? awardRoundScores(state.scores || [0, 0, 0, 0], winnerIndex, stalemate)
        : (state.scores || [0, 0, 0, 0]);

    return withUpdatedPhase({
        ...roundState,
        scores,
        stalemate,
        matchWinner: matchWinnerFromScores(scores)
    });
};

/**
 * Create a new four-player Palace game.
 *
 * @param {number} [seed=2026] Seed used for deterministic shuffling.
 * @returns {GameState} Initial game state.
 */
export const createGame = function (seed = 2026, scores = [0, 0, 0, 0]) {
    const deck = shuffle(makeDeck(), seed);
    const names = ["You", "Left AI", "Top AI", "Right AI"];
    const players = names.map(function (name, index) {
        const offset = index * 9;

        return {
            name,
            hand: deck.slice(offset, offset + 3),
            faceUp: deck.slice(offset + 3, offset + 6),
            faceDown: deck.slice(offset + 6, offset + 9),
            knownFaceDownIds: []
        };
    });

    return withUpdatedPhase({
        players,
        currentPlayer: 0,
        drawPile: deck.slice(36),
        pile: [],
        roundPlays: [],
        lastPlay: null,
        moveNumber: 0,
        scores: scores.slice(),
        matchWinner: matchWinnerFromScores(scores),
        stalemate: false,
        burned: [],
        log: ["Welcome to four-player Palace. Start from your hand, then your palace."],
        winner: null,
        phase: "hand"
    });
};

/**
 * Create a fixed training game designed for the interactive tutorial. The
 * layout deliberately shows a playable pile, useful palace cards, and visible
 * opponent palace cards so each tutorial step has a clear example.
 *
 * @returns {GameState} Prepared tutorial game state.
 */
export const createTutorialGame = function () {
    const deck = makeDeck();
    const findCard = function (id) {
        return cloneCard(deck.find(function (card) {
            return card.id === id;
        }));
    };
    const cards = function (ids) {
        return ids.map(findCard);
    };
    const usedIds = [
        "5S", "QH", "QD", "2D", "2H", "10S", "8D", "3C", "4C", "5C",
        "AH", "6S", "7D", "6H", "JC", "AS", "3D", "4D", "5D",
        "QS", "8C", "KH", "2C", "10D", "QC", "3H", "4H", "5H",
        "JH", "6C", "AD", "8H", "KC", "9D", "3S", "4S", "KS",
        "7C"
    ];

    return withUpdatedPhase({
        players: [
            {
                name: "You",
                hand: cards(["5S", "QH", "QD", "2D"]),
                faceUp: cards(["2H", "10S", "8D"]),
                faceDown: cards(["3C", "4C", "5C"]),
                knownFaceDownIds: []
            },
            {
                name: "Left AI",
                hand: cards(["AH", "6S", "7D"]),
                faceUp: cards(["6H", "JC", "AS"]),
                faceDown: cards(["3D", "4D", "5D"]),
                knownFaceDownIds: []
            },
            {
                name: "Top AI",
                hand: cards(["QS", "8C", "KH"]),
                faceUp: cards(["2C", "10D", "QC"]),
                faceDown: cards(["3H", "4H", "5H"]),
                knownFaceDownIds: []
            },
            {
                name: "Right AI",
                hand: cards(["JH", "6C", "AD"]),
                faceUp: cards(["8H", "KC", "9D"]),
                faceDown: cards(["3S", "4S", "KS"]),
                knownFaceDownIds: []
            }
        ],
        currentPlayer: 0,
        drawPile: deck.filter(function (card) {
            return !usedIds.includes(card.id);
        }),
        pile: cards(["7C"]),
        roundPlays: [
            {
                playerIndex: null,
                playerName: "Table",
                cards: cards(["7C"])
            }
        ],
        lastPlay: null,
        moveNumber: 0,
        scores: [0, 0, 0, 0],
        matchWinner: null,
        stalemate: false,
        burned: [],
        log: ["Tutorial deal loaded. Try playing a highlighted card from your hand."],
        winner: null,
        phase: "hand"
    });
};

/**
 * Find the player whose turn it currently is.
 *
 * @param {GameState} state Current game state.
 * @returns {Player} Active player.
 */
export const getCurrentPlayer = function (state) {
    return clonePlayer(state.players[state.currentPlayer]);
};

/**
 * Find the card that the next played card must answer.
 *
 * @param {GameState} state Current game state.
 * @returns {Card|null} Top active card, or null when any card may be played.
 */
export const getTopCard = function (state) {
    const topCard = topActiveCard(state.pile);
    return topCard === null
        ? null
        : cloneCard(topCard);
};

/**
 * Test whether one card is legal on the current pile.
 *
 * @param {Card} card Card being tested.
 * @param {GameState} state Current game state.
 * @returns {boolean} True when the card can legally be played.
 */
export const canPlayCard = function (card, state) {
    return canPlayCardOnPile(card, state.pile);
};

/**
 * Return all legal cards for a player from their current playable area.
 *
 * @param {GameState} state Current game state.
 * @param {number} [playerIndex=state.currentPlayer] Player to inspect.
 * @returns {Card[]} Legal cards from hand, face-up palace, or face-down palace.
 */
export const getPlayableCards = function (state, playerIndex = state.currentPlayer) {
    const player = state.players[playerIndex];
    const area = activeArea(player);

    if (area === "faceDown") {
        return cloneCards(player.faceDown.filter(function (card) {
            return (player.knownFaceDownIds || []).includes(card.id)
                ? canPlayCard(card, state)
                : true;
        }));
    }

    return player[area].filter(function (card) {
        return canPlayCard(card, state);
    }).map(cloneCard);
};

/**
 * Reveal one face-down palace card without playing it yet. This lets the
 * player inspect the card before choosing whether to play it or pick up.
 *
 * @param {GameState} state Current game state.
 * @param {string} cardId Face-down card id to reveal.
 * @param {number} [playerIndex=state.currentPlayer] Player revealing the card.
 * @returns {GameState} New game state with the card remembered.
 */
export const revealFaceDownCard = function (state, cardId, playerIndex = state.currentPlayer) {
    const next = cloneState(state);
    const player = next.players[playerIndex];
    const card = player.faceDown.find(function (candidate) {
        return candidate.id === cardId;
    });

    if (!card) {
        return next;
    }

    player.knownFaceDownIds = Array.from(new Set((player.knownFaceDownIds || []).concat([card.id])));
    return withUpdatedPhase(next);
};

/**
 * Play one or more cards of the same rank from the active player's current
 * area. When a face-down card is illegal, the player must take the pile.
 *
 * @param {GameState} state Current game state.
 * @param {string[]} cardIds Card ids to play.
 * @returns {GameState} New game state after the move.
 */
export const playCards = function (state, cardIds) {
    if (state.winner !== null) {
        return cloneState(state);
    }

    const next = cloneState(state);
    const playerIndex = next.currentPlayer;
    const player = next.players[playerIndex];
    const area = activeArea(player);
    const selected = orderPlayedCards(cardsFromIds(player[area], cardIds));

    if (selected.length !== cardIds.length || !isValidPlayGroup(selected)) {
        throw new Error("Select one rank, or combine 2s with one other rank.");
    }

    if (area === "faceDown" && selected.length !== 1) {
        throw new Error("Choose one face-down card at a time.");
    }

    const nonFlexibleCard = selected.find(function (card) {
        return card.rank !== flexibleRank;
    });
    const leadCard = nonFlexibleCard || selected[0];
    const legalPlay = selected.some(function (card) {
        return card.rank === flexibleRank;
    }) || canPlayCard(leadCard, next);

    if (area !== "faceDown" && !legalPlay) {
        throw new Error("That card cannot be played on the current pile.");
    }

    const attemptedPile = next.pile.concat(selected);
    const playEntry = {
        playerIndex,
        playerName: player.name,
        cards: cloneCards(selected)
    };
    const illegalBlindCard = area === "faceDown" && !legalPlay;

    if (illegalBlindCard) {
        player.knownFaceDownIds = Array.from(new Set((player.knownFaceDownIds || []).concat(selected.map(function (card) {
            return card.id;
        }))));
        player.hand = player.hand.concat(next.pile);
        return withUpdatedPhase(log(finishTurn({
            ...next,
            players: next.players,
            pile: [],
            roundPlays: [],
            lastPlay: null
        }, playerIndex, true, false), `${player.name} revealed ${selected[0].rank}, kept it for later, and picked up the pile.`));
    }

    player[area] = removeCardsById(player[area], cardIds);
    player.knownFaceDownIds = (player.knownFaceDownIds || []).filter(function (cardId) {
        return !cardIds.includes(cardId);
    });

    const shouldBurn = selected.some(function (card) {
        return pileClearRanks.includes(card.rank);
    }) || completesFourOfAKind(attemptedPile);
    const afterPlay = {
        ...next,
        pile: shouldBurn
            ? []
            : attemptedPile,
        roundPlays: shouldBurn
            ? []
            : next.roundPlays.concat([playEntry]),
        lastPlay: playEntry,
        moveNumber: next.moveNumber + 1,
        burned: shouldBurn
            ? next.burned.concat(attemptedPile)
            : next.burned
    };
    const keepsTurn = shouldBurn;
    const message = shouldBurn
        ? `${player.name} played ${selected.length} ${selected[0].rank} and cleared the pile.`
        : `${player.name} played ${selected.length} ${selected[0].rank}.`;

    return log(finishTurn(afterPlay, playerIndex, keepsTurn, !keepsTurn), message);
};

/**
 * Make the active player pick up the whole pile because they cannot or do not
 * want to play.
 *
 * @param {GameState} state Current game state.
 * @returns {GameState} New game state after picking up.
 */
export const pickUpPile = function (state) {
    if (state.pile.length === 0 || state.winner !== null) {
        return cloneState(state);
    }

    const next = cloneState(state);
    const player = next.players[next.currentPlayer];
    player.hand = player.hand.concat(next.pile);
    next.pile = [];
    next.roundPlays = [];
    next.lastPlay = null;

    return log(finishTurn(next, next.currentPlayer, true, false), `${player.name} picked up the pile.`);
};

/**
 * Run a simple computer move. An AI player plays its lowest legal rank, or
 * picks up when no visible card is playable.
 *
 * @param {GameState} state Current game state.
 * @returns {GameState} New game state after the AI move.
 */
export const autoPlayTurn = function (state) {
    if (state.winner !== null || state.currentPlayer === 0) {
        return cloneState(state);
    }

    const aiIndex = state.currentPlayer;
    const player = state.players[aiIndex];
    const area = activeArea(player);

    if (area === "faceDown") {
        const unknownCard = player.faceDown.find(function (card) {
            return !(player.knownFaceDownIds || []).includes(card.id);
        });

        if (unknownCard) {
            return playCards(state, [unknownCard.id]);
        }
    }

    const legalCards = getPlayableCards(state, aiIndex);

    if (legalCards.length === 0) {
        return pickUpPile(state);
    }

    const chosen = legalCards.reduce(function (best, card) {
        return rankValues[card.rank] < rankValues[best.rank]
            ? card
            : best;
    }, legalCards[0]);
    return playCards(state, [chosen.id]);
};

/**
 * Check whether the game is over.
 *
 * @param {GameState} state Current game state.
 * @returns {boolean} True when a player has no cards left.
 */
export const isGameOver = function (state) {
    return state.winner !== null;
};

/**
 * Return the winning player when the game is over.
 *
 * @param {GameState} state Current game state.
 * @returns {Player|null} Winning player, or null while the game continues.
 */
export const getWinner = function (state) {
    return state.winner === null
        ? null
        : clonePlayer(state.players[state.winner]);
};

/**
 * Create a browser-safe state snapshot. The human player's hand is visible,
 * while AI hands and all face-down palace cards stay hidden.
 *
 * @param {GameState} state Current game state.
 * @returns {Object} Public state for rendering.
 */
export const getVisibleState = function (state) {
    return {
        ...cloneState(state),
        players: state.players.map(function (player, playerIndex) {
            return {
                ...clonePlayer(player),
                hand: player.hand.map(function (card, cardIndex) {
                    return playerIndex === 0
                        ? cloneCard(card)
                        : {
                            id: `hidden-hand-${playerIndex}-${cardIndex}`,
                            rank: "?",
                            suit: "?"
                        };
                }),
                faceDown: player.faceDown.map(function (card, cardIndex) {
                    if (playerIndex === 0 && (player.knownFaceDownIds || []).includes(card.id)) {
                        return cloneCard(card);
                    }

                    return {
                        id: `hidden-${playerIndex}-${cardIndex}`,
                        rank: "?",
                        suit: "?"
                    };
                })
            };
        })
    };
};

/**
 * Explain the Palace rules used by this implementation.
 *
 * @returns {string[]} Tutorial steps suitable for display in the web app.
 */
export const getTutorialSteps = function () {
    return [
        "This is a four-player table. Your cards are at the bottom, and the three AI players are around the table.",
        "Only your hand is visible. Other players' hands and all face-down palace cards are shown as card backs.",
        "At the start of your turn, a hand of one or two cards refills to three. An empty hand does not refill.",
        "A card must be equal to or higher than the top card on the pile.",
        "A 10 clears the pile. A 9 makes the next player play 9 or lower. A 2 is the smallest card, can join another rank, and leaves a challenge that any card can beat.",
        "Four cards of the same rank on top also clear the pile.",
        "When your hand is empty, use your face-up palace cards. Then choose one face-down card; if it cannot play, it stays revealed for later.",
        "If you cannot play, pick up the pile. Round winners gain 2 points, stalemates give everyone 1 point, and first to 10 wins the match."
    ];
};
