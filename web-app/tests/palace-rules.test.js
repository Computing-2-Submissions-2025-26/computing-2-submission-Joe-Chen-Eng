import assert from "node:assert/strict";
import {
    autoPlayTurn,
    canPlayCard,
    createGame,
    getPlayableCards,
    getWinner,
    playCards,
    pickUpPile,
    revealFaceDownCard
} from "../Module.js";

const card = function (rank, suit = "S") {
    return {
        id: rank + suit,
        rank,
        suit
    };
};

const stateWith = function (overrides = {}) {
    return {
        players: [
            {
                name: "You",
                hand: [],
                faceUp: [],
                faceDown: []
            },
            {
                name: "Computer",
                hand: [card("4", "H")],
                faceUp: [],
                faceDown: []
            }
        ],
        currentPlayer: 0,
        drawPile: [],
        pile: [],
        roundPlays: [],
        burned: [],
        log: [],
        winner: null,
        phase: "hand",
        ...overrides
    };
};

describe("Palace card legality", function () {
    it("allows any card on an empty pile", function () {
        assert.equal(canPlayCard(card("3"), stateWith()), true);
    });

    it("prevents a lower ordinary card being played on a higher ordinary card", function () {
        const state = stateWith({
            pile: [card("K")]
        });

        assert.equal(canPlayCard(card("8"), state), false);
    });

    it("allows 2 and 10 on any pile, while 9 follows normal play timing", function () {
        const state = stateWith({
            pile: [card("A")]
        });

        assert.equal(canPlayCard(card("2"), state), true);
        assert.equal(canPlayCard(card("9"), state), false);
        assert.equal(canPlayCard(card("10"), state), true);
    });

    it("makes a 9 require the next player to play 9 or lower", function () {
        const state = stateWith({
            pile: [card("9")]
        });

        assert.equal(canPlayCard(card("8"), state), true);
        assert.equal(canPlayCard(card("9", "H"), state), true);
        assert.equal(canPlayCard(card("J"), state), false);
    });
});

describe("Palace turn transitions", function () {
    it("plays a legal card from the active player's hand onto the pile", function () {
        const state = stateWith({
            players: [
                {
                    name: "You",
                    hand: [card("8")],
                    faceUp: [],
                    faceDown: []
                },
                {
                    name: "Computer",
                    hand: [card("4", "H")],
                    faceUp: [],
                    faceDown: []
                }
            ],
            pile: [card("6", "H")]
        });
        const next = playCards(state, ["8S"]);

        assert.deepEqual(next.players[0].hand, []);
        assert.equal(next.pile.at(-1).id, "8S");
        assert.equal(next.currentPlayer, 1);
    });

    it("keeps the turn with the player who picked up the pile", function () {
        const state = stateWith({
            players: [
                {
                    name: "You",
                    hand: [card("3")],
                    faceUp: [],
                    faceDown: []
                },
                {
                    name: "Computer",
                    hand: [card("4", "H")],
                    faceUp: [],
                    faceDown: []
                }
            ],
            pile: [card("A", "H")]
        });
        const next = pickUpPile(state);

        assert.equal(next.currentPlayer, 0);
        assert.equal(next.phase, "hand");
    });

    it("records cards played into the current unresolved round", function () {
        const state = stateWith({
            players: [
                {
                    name: "You",
                    hand: [card("8")],
                    faceUp: [],
                    faceDown: []
                },
                {
                    name: "Computer",
                    hand: [card("4", "H")],
                    faceUp: [],
                    faceDown: []
                }
            ],
            pile: [card("6", "H")]
        });
        const next = playCards(state, ["8S"]);

        assert.equal(next.roundPlays.length, 1);
        assert.equal(next.roundPlays[0].playerName, "You");
        assert.deepEqual(next.roundPlays[0].cards.map(function (playedCard) {
            return playedCard.id;
        }), ["8S"]);
    });

    it("allows playing only some cards of a matching rank", function () {
        const state = stateWith({
            players: [
                {
                    name: "You",
                    hand: [card("8"), card("8", "H"), card("K")],
                    faceUp: [],
                    faceDown: []
                },
                {
                    name: "Computer",
                    hand: [card("4", "H")],
                    faceUp: [],
                    faceDown: []
                }
            ],
            pile: [card("6", "H")]
        });
        const next = playCards(state, ["8S"]);

        assert.deepEqual(next.players[0].hand.map(function (remainingCard) {
            return remainingCard.id;
        }), ["8H", "KS"]);
        assert.equal(next.pile.at(-1).id, "8S");
    });

    it("does not refill the player immediately after they play", function () {
        const state = stateWith({
            players: [
                {
                    name: "You",
                    hand: [card("8"), card("K")],
                    faceUp: [],
                    faceDown: []
                },
                {
                    name: "Computer",
                    hand: [card("4", "H"), card("5", "H"), card("6", "H")],
                    faceUp: [],
                    faceDown: []
                }
            ],
            drawPile: [card("A", "D")],
            pile: [card("6", "H")]
        });
        const next = playCards(state, ["8S"]);

        assert.deepEqual(next.players[0].hand.map(function (remainingCard) {
            return remainingCard.id;
        }), ["KS"]);
        assert.deepEqual(next.drawPile.map(function (drawCard) {
            return drawCard.id;
        }), ["AD"]);
    });

    it("refills the next player to three at the start of their turn", function () {
        const state = stateWith({
            players: [
                {
                    name: "You",
                    hand: [card("8"), card("K"), card("A")],
                    faceUp: [],
                    faceDown: []
                },
                {
                    name: "Computer",
                    hand: [card("4", "H")],
                    faceUp: [],
                    faceDown: []
                }
            ],
            drawPile: [card("5", "D"), card("6", "D"), card("7", "D")],
            pile: [card("6", "H")]
        });
        const next = playCards(state, ["8S"]);

        assert.deepEqual(next.players[1].hand.map(function (computerCard) {
            return computerCard.id;
        }), ["4H", "5D", "6D"]);
        assert.deepEqual(next.drawPile.map(function (drawCard) {
            return drawCard.id;
        }), ["7D"]);
    });

    it("clears the pile and keeps the turn when a 10 is played", function () {
        const state = stateWith({
            players: [
                {
                    name: "You",
                    hand: [card("10")],
                    faceUp: [card("5")],
                    faceDown: []
                },
                {
                    name: "Computer",
                    hand: [card("4", "H")],
                    faceUp: [],
                    faceDown: []
                }
            ],
            pile: [card("A", "H")]
        });
        const next = playCards(state, ["10S"]);

        assert.deepEqual(next.pile, []);
        assert.equal(next.burned.length, 2);
        assert.equal(next.currentPlayer, 0);
    });

    it("does not draw back to three after a 10 clears the pile", function () {
        const state = stateWith({
            players: [
                {
                    name: "You",
                    hand: [card("10")],
                    faceUp: [card("5")],
                    faceDown: []
                },
                {
                    name: "Computer",
                    hand: [card("4", "H")],
                    faceUp: [],
                    faceDown: []
                }
            ],
            drawPile: [card("6", "D"), card("7", "D"), card("8", "D")],
            pile: [card("A", "H")]
        });
        const next = playCards(state, ["10S"]);

        assert.deepEqual(next.players[0].hand, []);
        assert.deepEqual(next.drawPile.map(function (drawCard) {
            return drawCard.id;
        }), ["6D", "7D", "8D"]);
        assert.equal(next.phase, "faceUp");
        assert.equal(next.currentPlayer, 0);
    });

    it("allows 2 to combine with another rank and become the next challenge", function () {
        const state = stateWith({
            players: [
                {
                    name: "You",
                    hand: [card("8"), card("2", "H")],
                    faceUp: [],
                    faceDown: []
                },
                {
                    name: "Computer",
                    hand: [card("4", "H")],
                    faceUp: [],
                    faceDown: []
                }
            ],
            pile: [card("A", "H")]
        });
        const next = playCards(state, ["8S", "2H"]);

        assert.deepEqual(next.pile.map(function (pileCard) {
            return pileCard.id;
        }), ["AH", "8S", "2H"]);
        assert.equal(next.currentPlayer, 1);
    });

    it("moves the pile into the active player's hand when they pick up", function () {
        const state = stateWith({
            players: [
                {
                    name: "You",
                    hand: [card("3")],
                    faceUp: [],
                    faceDown: []
                },
                {
                    name: "Computer",
                    hand: [card("4", "H")],
                    faceUp: [],
                    faceDown: []
                }
            ],
            pile: [card("A", "H")],
            roundPlays: [
                {
                    playerIndex: 1,
                    playerName: "Computer",
                    cards: [card("A", "H")]
                }
            ]
        });
        const next = pickUpPile(state);

        assert.equal(next.players[0].hand.length, 2);
        assert.deepEqual(next.pile, []);
        assert.deepEqual(next.roundPlays, []);
        assert.equal(next.currentPlayer, 0);
    });

    it("keeps and reveals an illegal face-down card for later", function () {
        const state = stateWith({
            players: [
                {
                    name: "You",
                    hand: [],
                    faceUp: [],
                    faceDown: [card("3")],
                    knownFaceDownIds: []
                },
                {
                    name: "Computer",
                    hand: [card("4", "H")],
                    faceUp: [],
                    faceDown: []
                }
            ],
            pile: [card("A", "H")]
        });
        const next = playCards(state, ["3S"]);

        assert.equal(next.players[0].faceDown.length, 1);
        assert.deepEqual(next.players[0].knownFaceDownIds, ["3S"]);
        assert.deepEqual(next.pile, []);
        assert.deepEqual(next.players[0].hand.map(function (handCard) {
            return handCard.id;
        }), ["AH"]);
        assert.equal(next.currentPlayer, 0);
    });

    it("reveals a face-down card without playing it or picking up the pile", function () {
        const state = stateWith({
            players: [
                {
                    name: "You",
                    hand: [],
                    faceUp: [],
                    faceDown: [card("K")],
                    knownFaceDownIds: []
                },
                {
                    name: "Computer",
                    hand: [card("4", "H")],
                    faceUp: [],
                    faceDown: []
                }
            ],
            pile: [card("8", "H")]
        });
        const next = revealFaceDownCard(state, "KS", 0);

        assert.deepEqual(next.players[0].knownFaceDownIds, ["KS"]);
        assert.deepEqual(next.players[0].faceDown.map(function (downCard) {
            return downCard.id;
        }), ["KS"]);
        assert.deepEqual(next.pile.map(function (pileCard) {
            return pileCard.id;
        }), ["8H"]);
        assert.equal(next.currentPlayer, 0);
    });

    it("returns a winner once a player has emptied all palace areas", function () {
        const state = stateWith({
            players: [
                {
                    name: "You",
                    hand: [card("3")],
                    faceUp: [],
                    faceDown: []
                },
                {
                    name: "Computer",
                    hand: [card("4", "H")],
                    faceUp: [],
                    faceDown: []
                }
            ]
        });
        const next = playCards(state, ["3S"]);

        assert.equal(getWinner(next).name, "You");
    });

    it("awards round points when a player wins", function () {
        const state = stateWith({
            scores: [4, 5],
            players: [
                {
                    name: "You",
                    hand: [card("3")],
                    faceUp: [],
                    faceDown: []
                },
                {
                    name: "Computer",
                    hand: [card("4", "H")],
                    faceUp: [],
                    faceDown: []
                }
            ]
        });
        const next = playCards(state, ["3S"]);

        assert.deepEqual(next.scores, [6, 5]);
        assert.equal(next.matchWinner, null);
    });

    it("makes AI reveal an unknown face-down card before it knows whether it can play", function () {
        const state = stateWith({
            players: [
                {
                    name: "You",
                    hand: [],
                    faceUp: [],
                    faceDown: []
                },
                {
                    name: "Computer",
                    hand: [],
                    faceUp: [],
                    faceDown: [card("3", "H")],
                    knownFaceDownIds: []
                }
            ],
            currentPlayer: 1,
            pile: [card("A")]
        });
        const next = autoPlayTurn(state);

        assert.deepEqual(next.players[1].knownFaceDownIds, ["3H"]);
        assert.equal(next.players[1].faceDown.length, 1);
        assert.deepEqual(next.pile, []);
        assert.deepEqual(next.players[1].hand.map(function (handCard) {
            return handCard.id;
        }), ["AS"]);
        assert.equal(next.currentPlayer, 1);
    });

    it("finds a match winner once a score reaches 10", function () {
        const state = createGame(2026, [9, 2, 2, 2]);
        const next = playCards({
            ...state,
            players: [
                {
                    name: "You",
                    hand: [card("3")],
                    faceUp: [],
                    faceDown: [],
                    knownFaceDownIds: []
                },
                state.players[1],
                state.players[2],
                state.players[3]
            ],
            pile: []
        }, ["3S"]);

        assert.equal(next.scores[0], 11);
        assert.equal(next.matchWinner, 0);
    });

    it("awards everyone one point when the round is stuck", function () {
        const state = stateWith({
            scores: [2, 3],
            players: [
                {
                    name: "You",
                    hand: [card("8")],
                    faceUp: [card("3")],
                    faceDown: []
                },
                {
                    name: "Computer",
                    hand: [card("3", "H")],
                    faceUp: [],
                    faceDown: []
                }
            ],
            drawPile: [],
            pile: [card("6", "H")]
        });
        const next = playCards(state, ["8S"]);

        assert.equal(next.stalemate, true);
        assert.deepEqual(next.scores, [3, 4]);
    });
});

describe("Palace playable cards", function () {
    it("only offers legal visible cards from the current playable area", function () {
        const state = stateWith({
            players: [
                {
                    name: "You",
                    hand: [card("3"), card("K")],
                    faceUp: [card("A")],
                    faceDown: []
                },
                {
                    name: "Computer",
                    hand: [card("4", "H")],
                    faceUp: [],
                    faceDown: []
                }
            ],
            pile: [card("Q", "H")]
        });
        const playableIds = getPlayableCards(state, 0).map(function (candidate) {
            return candidate.id;
        });

        assert.deepEqual(playableIds, ["KS"]);
    });
});
