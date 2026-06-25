/*jslint browser */

import {
    autoPlayTurn,
    canPlayCard,
    createGame,
    createTutorialGame,
    getTopCard,
    getVisibleState,
    playCards,
    pickUpPile,
    revealFaceDownCard
} from "./Module.js?v=current-player-highlight";

let state = createGame(Date.now() % 100000);
let stateBeforeGuide = null;
let guideMode = false;

const suits = {
    S: {
        symbol: "♠",
        name: "spades"
    },
    H: {
        symbol: "♥",
        name: "hearts"
    },
    D: {
        symbol: "♦",
        name: "diamonds"
    },
    C: {
        symbol: "♣",
        name: "clubs"
    },
    "?": {
        symbol: "?",
        name: "hidden suit"
    }
};

const rankSortValues = {
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
    "10": 16,
    "?": 99
};

const suitSortValues = {
    C: 0,
    D: 1,
    H: 2,
    S: 3,
    "?": 9
};

// This helper function shortens document.getElementById calls.
const el = (id) => document.getElementById(id);

const elements = {
    tutorial: el("tutorial"),
    tutorialText: el("tutorial-text"),
    tutorialAction: el("tutorial-action"),
    tutorialStepCount: el("tutorial-step-count"),
    tutorialBack: el("tutorial-back"),
    tutorialNext: el("tutorial-next"),
    closeTutorial: el("close-tutorial"),
    clearNotice: el("clear-notice"),
    clearNoticeText: el("clear-notice-text"),
    clearContinue: el("clear-continue"),
    resultNotice: el("result-notice"),
    resultConfetti: el("result-confetti"),
    resultNoticeLabel: el("result-notice-label"),
    resultNoticeTitle: el("result-notice-title"),
    resultNoticeText: el("result-notice-text"),
    resultContinue: el("result-continue"),
    guideButton: el("guide-button"),
    restartButton: el("restart-button"),
    pickupButton: el("pickup-button"),
    turnStatus: el("turn-status"),
    topCard: el("top-card"),
    drawCount: el("draw-count"),
    burnedCount: el("burned-count"),
    pile: el("pile"),
    roundPlays: el("round-plays"),
    message: el("message"),
    gameLog: el("game-log"),
    seats: [
        el("player-0"),
        el("player-1"),
        el("player-2"),
        el("player-3")
    ]
};

let guideStep = 0;
let guideStepComplete = false;
let lastAnimatedMoveNumber = state.moveNumber;
let nextPlaySourceBox = null;
let pileRevealToken = 0;
let selectedCardIds = [];
let lastClearNoticeMoveNumber = 0;
let humanHandScrollLeft = 0;

const flightDuration = 760;
const specialRanks = ["2", "9", "10"];
const pileClearRanks = ["10"];

const guideSteps = [
    {
        target: ".four-player-table",
        title: "The table",
        text: "This is a four-player Palace table. You sit at the bottom. The three AI players sit on the left, top, and right.",
        action: "Click anywhere on the table to confirm you have found your seat.",
        task: "click"
    },
    {
        target: ".seat-bottom .hand-row",
        title: "Your hand",
        text: "Your hand is the first place you play from. Only your hand is visible; other players' hands are shown as card backs.",
        action: "Click your hand area to continue. Do not play a card yet.",
        task: "click"
    },
    {
        target: ".seat-bottom .palace-slots",
        title: "Your palace stacks",
        text: "Each palace stack has a face-down card underneath and a face-up card on top. This matches the real table setup.",
        action: "Click your palace stacks to confirm you can see the face-up cards on top of the backs.",
        task: "click"
    },
    {
        target: ".seat-bottom .palace-slots",
        title: "After your hand is empty",
        text: "Once your hand is empty, you play your face-up palace cards. When those are gone, you choose one face-down card. If it cannot be played, it stays there revealed for later.",
        action: "Click the palace stacks again to remember the order: hand, face-up, then face-down reveal.",
        task: "click"
    },
    {
        target: ".seat-centre",
        title: "The pile",
        text: "Everyone plays cards onto the centre pile. The top card tells you what you need to beat.",
        action: "Click the centre pile to continue.",
        task: "click"
    },
    {
        target: ".seat-centre, .seat-bottom .hand-row",
        title: "Playing a normal card",
        text: "The tutorial pile is 7♣. Your 5♠ is too low, so it is not highlighted. The two queens show the new choice rule: you may select one queen or both queens before pressing Play selected.",
        action: "Select one or both Q cards, or select 2♦, then press Play selected. Do not select the low 5♠.",
        task: "play"
    },
    {
        target: ".seat-centre",
        title: "Special cards",
        text: "Special cards glow. A 10 clears the whole pile. A 9 means the next player must play 9 or lower. A 2 can be added to another rank, such as 8+2, and then the next player can play almost anything.",
        action: "Click the pile after reading the special-card rule.",
        task: "click"
    },
    {
        target: ".status-grid",
        title: "Turn and table status",
        text: "The status bar shows whose turn it is, the top card, the draw pile count, and how many cards have been burned. The game uses one deck only. If the draw pile runs out, nobody draws more cards.",
        action: "Click the status bar after checking whose turn it is.",
        task: "click"
    },
    {
        target: ".seat-left, .seat-top, .seat-right",
        title: "Other players",
        text: "Opponents' hands are hidden, but their face-up palace cards are visible. Those visible cards help you predict what they may play later.",
        action: "Click one of the AI player areas to continue.",
        task: "click"
    },
    {
        target: ".seat-centre",
        title: "Picking up",
        text: "If you cannot play a legal card, pick up the pile. All pile cards go into your hand, which makes it harder to finish.",
        action: "Click the centre area to confirm you know where the Pick up pile button is.",
        task: "click"
    },
    {
        target: ".seat-bottom",
        title: "How to win",
        text: "Your goal is to empty everything: your hand, your face-up palace cards, and finally your face-down palace cards. Each round gives the winner 2 points. A stalemate gives everyone 1 point. First to 10 wins the match.",
        action: "Click your player area once more, then press Finish.",
        task: "click"
    }
];

const clear = function (element) {
    while (element.firstChild) {
        element.firstChild.remove();
    }
};

const cardLabel = function (card) {
    return card.rank === "?"
        ? "Face-down card"
        : `${card.rank}${suits[card.suit].symbol}`;
};

const cardAriaLabel = function (card) {
    return card.rank === "?"
        ? "Face-down palace card"
        : `${card.rank} of ${suits[card.suit].name}`;
};

const isRedCard = function (card) {
    return card.suit === "H" || card.suit === "D";
};

const specialRankClass = function (rank) {
    if (rank === "10") {
        return "is-special-ten";
    }

    return `is-special-${rank}`;
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

const selectedCardsFromCurrentArea = function () {
    const player = state.players[0];
    const area = activeArea(player);
    return selectedCardIds.map(function (cardId) {
        return player[area].find(function (card) {
            return card.id === cardId;
        });
    }).filter(Boolean);
};

const cardsCanBeSelectedTogether = function (cards) {
    const nonTwos = cards.filter(function (card) {
        return card.rank !== "2";
    });

    return cards.length > 0 && (
        nonTwos.length === 0
        || nonTwos.every(function (card) {
            return card.rank === nonTwos[0].rank;
        })
    );
};

const clearGuideHighlights = function () {
    document.querySelectorAll(".guide-highlight").forEach(function (node) {
        node.classList.remove("guide-highlight");
    });
};

const renderTutorial = function () {
    const step = guideSteps[guideStep];
    const title = document.querySelector("#tutorial-title");

    clearGuideHighlights();
    document.querySelectorAll(step.target).forEach(function (node) {
        node.classList.add("guide-highlight");
    });

    title.textContent = step.title;
    elements.tutorialStepCount.textContent = `Step ${guideStep + 1} of ${guideSteps.length}`;
    elements.tutorialText.textContent = step.text;
    elements.tutorialAction.textContent = step.action;
    elements.tutorialAction.classList.toggle("is-complete", guideStepComplete);
    elements.tutorialBack.disabled = guideStep === 0;
    elements.tutorialNext.disabled = !guideStepComplete;
    elements.tutorialNext.textContent = guideStep === guideSteps.length - 1
        ? "Finish"
        : "Next";
};

const openTutorial = function () {
    if (!guideMode) {
        stateBeforeGuide = state;
    }

    selectedCardIds = [];
    humanHandScrollLeft = 0;
    guideMode = true;
    state = createTutorialGame();
    render();
    guideStep = 0;
    guideStepComplete = false;
    document.body.classList.add("guide-mode");
    elements.tutorial.classList.remove("is-hidden");
    renderTutorial();
};

const closeTutorial = function (restoreGame = true) {
    elements.tutorial.classList.add("is-hidden");
    clearGuideHighlights();

    if (guideMode && restoreGame && stateBeforeGuide !== null) {
        state = stateBeforeGuide;
        selectedCardIds = [];
        stateBeforeGuide = null;
        guideMode = false;
        document.body.classList.remove("guide-mode");
        render();
        return;
    }

    if (!restoreGame) {
        selectedCardIds = [];
        stateBeforeGuide = null;
        guideMode = false;
        document.body.classList.remove("guide-mode");
    }
};

const completeGuideStep = function () {
    if (elements.tutorial.classList.contains("is-hidden")) {
        return;
    }

    guideStepComplete = true;
    renderTutorial();
};

const clickedInsideGuideTarget = function (target) {
    const step = guideSteps[guideStep];
    return Array.from(document.querySelectorAll(step.target)).some(function (node) {
        return node.contains(target);
    });
};

const makePlaceholder = function (text) {
    const card = document.createElement("div");
    card.className = "card-placeholder";
    card.textContent = text;
    return card;
};

const makeHandCountBadge = function (count) {
    const badge = document.createElement("div");
    badge.className = "hand-count-badge";
    badge.setAttribute("aria-label", `${count} hidden hand cards`);
    [0, 1, 2].forEach(function (index) {
        const layer = document.createElement("span");
        layer.className = `hand-count-card layer-${index + 1}`;
        badge.append(layer);
    });

    const label = document.createElement("span");
    label.className = "hand-count-label";
    label.textContent = `Hand × ${count}`;
    badge.append(label);

    return badge;
};

const makeCardFace = function (card, options = {}) {
    const element = document.createElement(options.button ? "button" : "div");
    const suit = suits[card.suit];
    const playableCard = options.playCard || card;

    element.className = card.rank === "?"
        ? "playing-card card-back"
        : "playing-card";

    if (options.button) {
        element.type = "button";
    }

    if (options.playCard) {
        element.dataset.cardId = options.playCard.id;
    } else {
        element.dataset.cardId = card.id;
    }

    if (isRedCard(card)) {
        element.classList.add("is-red");
    }

    if (specialRanks.includes(card.rank)) {
        element.classList.add("is-special-card", specialRankClass(card.rank));
        element.title = card.rank === "10"
            ? "Special card: clears the pile"
            : "Special card";
    }

    if (options.playable) {
        element.classList.add("is-playable");
    }

    if (options.selected) {
        element.classList.add("is-selected");
    }

    if (options.small) {
        element.classList.add("is-small");
    }

    if (card.rank === "?") {
        element.textContent = "?";
        element.setAttribute("aria-label", cardAriaLabel(card));
    } else {
        const top = document.createElement("span");
        top.className = "card-corner top";
        top.textContent = card.rank;

        const symbol = document.createElement("span");
        symbol.className = "card-suit";
        symbol.textContent = suit.symbol;

        const bottom = document.createElement("span");
        bottom.className = "card-corner bottom";
        bottom.textContent = card.rank;

        element.append(top, symbol, bottom);
        element.setAttribute("aria-label", cardAriaLabel(card));
    }

    if (options.button) {
        element.disabled = !options.enabled;
        element.addEventListener("click", function () {
            try {
                const player = state.players[0];
                const area = activeArea(player);
                const areaCard = player[area].find(function (candidate) {
                    return candidate.id === playableCard.id;
                });

                if (!areaCard) {
                    return;
                }

                const selectedCards = selectedCardsFromCurrentArea();
                const alreadySelected = selectedCardIds.includes(areaCard.id);

                if (area === "faceDown") {
                    const isKnownFaceDown = (player.knownFaceDownIds || []).includes(areaCard.id);

                    if (!isKnownFaceDown) {
                        state = revealFaceDownCard(state, areaCard.id, 0);
                        selectedCardIds = [areaCard.id];
                        render();
                        return;
                    }

                    selectedCardIds = alreadySelected
                        ? []
                        : [areaCard.id];
                } else if (alreadySelected) {
                    selectedCardIds = selectedCardIds.filter(function (cardId) {
                        return cardId !== areaCard.id;
                    });
                } else if (cardsCanBeSelectedTogether(selectedCards.concat([areaCard]))) {
                    selectedCardIds = selectedCardIds.concat([areaCard.id]);
                } else {
                    selectedCardIds = [areaCard.id];
                }

                render();
            } catch (error) {
                nextPlaySourceBox = null;
                elements.message.textContent = error.message;
            }
        });
    }

    return element;
};

const makeHandRow = function (cards, options) {
    const displayCards = cards.slice().sort(function (left, right) {
        return (rankSortValues[left.rank] - rankSortValues[right.rank])
            || (suitSortValues[left.suit] - suitSortValues[right.suit]);
    });
    const row = document.createElement("div");
    row.className = "hand-row";

    const rowLabel = document.createElement("p");
    rowLabel.className = "seat-row-label";
    rowLabel.textContent = "Hand";
    row.append(rowLabel);

    const cardsWrap = document.createElement("div");
    cardsWrap.className = "hand-cards";

    if (options.scrollable) {
        cardsWrap.classList.add("is-scrollable");
    }

    if (displayCards.length === 0) {
        cardsWrap.append(makePlaceholder("Empty"));
    } else if (options.collapseHidden && displayCards.length > 5) {
        cardsWrap.append(makeHandCountBadge(displayCards.length));
    } else {
        displayCards.forEach(function (card, cardIndex) {
            const hasFlexibleCard = displayCards.some(function (candidate) {
                return candidate.rank === "2";
            });
            const humanPlayable = options.humanTurn && options.active && (
                canPlayCard(card, state) || hasFlexibleCard
            );
            const cardElement = makeCardFace(card, {
                button: options.humanTurn && options.active,
                enabled: humanPlayable && state.winner === null && !state.stalemate && state.matchWinner === null,
                playable: humanPlayable,
                selected: selectedCardIds.includes(card.id),
                small: false
            });
            cardElement.style.setProperty("--card-index", String(cardIndex));
            cardElement.style.setProperty("--card-count", String(displayCards.length));
            cardsWrap.append(cardElement);
        });
    }

    row.append(cardsWrap);

    if (options.scrollable) {
        const slider = document.createElement("input");
        slider.className = "hand-scroll-slider";
        slider.type = "range";
        slider.min = "0";
        slider.max = "0";
        slider.value = "0";
        slider.step = "1";
        slider.setAttribute("aria-label", "Slide to view all cards in your hand");

        const syncSliderLimit = function () {
            const maximum = Math.max(0, cardsWrap.scrollWidth - cardsWrap.clientWidth);
            cardsWrap.scrollLeft = Math.min(humanHandScrollLeft, maximum);
            slider.max = String(maximum);
            slider.value = String(Math.min(cardsWrap.scrollLeft, maximum));
            slider.disabled = maximum === 0;
        };

        slider.addEventListener("input", function () {
            cardsWrap.scrollLeft = Number(slider.value);
            humanHandScrollLeft = cardsWrap.scrollLeft;
        });
        cardsWrap.addEventListener("scroll", function () {
            slider.value = String(cardsWrap.scrollLeft);
            humanHandScrollLeft = cardsWrap.scrollLeft;
        });

        window.requestAnimationFrame(syncSliderLimit);
        row.append(slider);
    }

    return row;
};

const makePlaySelectedButton = function () {
    const selectedCards = selectedCardsFromCurrentArea();
    const player = state.players[0];
    const area = activeArea(player);
    const canPlaySelection = selectedCards.length > 0 && (
        area !== "faceDown"
        || canPlayCard(selectedCards[0], state)
    );
    const button = document.createElement("button");
    button.className = "play-selected-button";
    button.type = "button";
    button.disabled = !canPlaySelection;
    button.textContent = selectedCards.length === 0
        ? "Select cards to play"
        : !canPlaySelection
            ? "Selected card cannot play"
        : `Play selected × ${selectedCards.length}`;

    button.addEventListener("click", function () {
        const selectedCardElements = selectedCardIds.map(function (cardId) {
            return document.querySelector(`[data-card-id="${cardId}"]`);
        }).filter(Boolean);
        const firstSelected = selectedCardElements[0];

        if (firstSelected) {
            const sourceBox = firstSelected.getBoundingClientRect();
            nextPlaySourceBox = {
                left: sourceBox.left,
                top: sourceBox.top,
                width: sourceBox.width,
                height: sourceBox.height
            };
        }

        try {
            state = playCards(state, selectedCardIds);
            selectedCardIds = [];
            render();
            if (guideSteps[guideStep]?.task === "play") {
                completeGuideStep();
            }
            continueAfterMove();
        } catch (error) {
            nextPlaySourceBox = null;
            elements.message.textContent = error.message;
        }
    });

    return button;
};

const makeHandNotes = function () {
    const notes = document.createElement("div");
    notes.className = "hand-notes";
    [
        "Rank order: 2 < 3 < 4 < 5 < 6 < 7 < 8 < 9 < J < Q < K < A < 10.",
        "10 clears the whole pile and lets the player continue.",
        "9 makes the next player play 9 or lower.",
        "2 can be played alone after any card. It can also combine with one rank, such as 8 + 2; the next player only needs to beat 2, so any card works."
    ].forEach(function (text) {
        const item = document.createElement("p");
        item.textContent = text;
        notes.append(item);
    });

    return notes;
};

const makePalaceSlots = function (visiblePlayer, actualPlayer, options) {
    const palace = document.createElement("div");
    palace.className = "palace-slots";
    palace.setAttribute("aria-label", "Palace cards");

    [0, 1, 2].forEach(function (slotIndex) {
        const slot = document.createElement("div");
        slot.className = "palace-slot";
        const downCard = visiblePlayer.faceDown[slotIndex];
        const actualDownCard = actualPlayer.faceDown[slotIndex];
        const upCard = visiblePlayer.faceUp[slotIndex];

        if (downCard) {
            const canClickDown = options.humanTurn && options.activeArea === "faceDown";
            slot.append(makeCardFace(downCard, {
                button: canClickDown,
                enabled: canClickDown && state.winner === null && !state.stalemate,
                playable: canClickDown,
                selected: actualDownCard && selectedCardIds.includes(actualDownCard.id),
                small: true,
                playCard: actualDownCard
            }));
        }

        if (upCard) {
            const faceUpHasFlexibleCard = visiblePlayer.faceUp.some(function (candidate) {
                return candidate.rank === "2";
            });
            const canClickUp = options.humanTurn
                && options.activeArea === "faceUp"
                && (canPlayCard(upCard, state) || faceUpHasFlexibleCard);
            slot.append(makeCardFace(upCard, {
                button: options.humanTurn && options.activeArea === "faceUp",
                enabled: canClickUp && state.winner === null && !state.stalemate,
                playable: canClickUp,
                selected: selectedCardIds.includes(upCard.id),
                small: true
            }));
        }

        if (!downCard && !upCard) {
            slot.append(makePlaceholder("Open"));
        }

        palace.append(slot);
    });

    return palace;
};

const playerSummary = function (player, score) {
    return `${player.hand.length} hand | ${player.faceUp.length} up | ${player.faceDown.length} down | ${score} pts`;
};

const renderSeat = function (visible, playerIndex) {
    const seat = elements.seats[playerIndex];
    const player = visible.players[playerIndex];
    const actualPlayer = state.players[playerIndex];
    const roundActive = state.winner === null && !state.stalemate && state.matchWinner === null;
    const humanTurn = state.currentPlayer === 0 && roundActive;
    const current = visible.currentPlayer === playerIndex;
    const area = activeArea(player);

    clear(seat);
    seat.classList.toggle("is-current", current && roundActive);

    const heading = document.createElement("div");
    heading.className = "area-heading";

    const titleWrap = document.createElement("div");
    const eyebrow = document.createElement("p");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = playerIndex === 0
        ? "Player"
        : "AI player";
    const title = document.createElement("h2");
    title.textContent = player.name;
    titleWrap.append(eyebrow, title);

    const summary = document.createElement("p");
    summary.className = "summary";
    summary.textContent = playerSummary(player, state.scores[playerIndex] || 0);
    heading.append(titleWrap, summary);

    const handRow = makeHandRow(player.hand, {
        humanTurn: playerIndex === 0 && humanTurn,
        active: playerIndex === 0 && area === "hand",
        collapseHidden: playerIndex !== 0,
        scrollable: playerIndex === 0
    });

    seat.append(
        heading,
        makePalaceSlots(player, actualPlayer, {
            humanTurn: playerIndex === 0 && humanTurn,
            activeArea: playerIndex === 0
                ? area
                : ""
        }),
        handRow
    );

    if (playerIndex === 0 && humanTurn) {
        seat.append(makePlaySelectedButton());
    }

    if (playerIndex === 0) {
        seat.append(makeHandNotes());
    }
};

const renderPile = function (topCard) {
    clear(elements.pile);

    if (topCard === null) {
        elements.pile.append(makePlaceholder("Any"));
        return;
    }

    elements.pile.append(makeCardFace(topCard));
};

const renderRoundPlays = function (roundPlays = []) {
    clear(elements.roundPlays);

    const title = document.createElement("p");
    title.className = "round-plays-title";
    title.textContent = "Played this round";
    elements.roundPlays.append(title);

    const track = document.createElement("div");
    track.className = "round-plays-track";
    elements.roundPlays.append(track);

    if (roundPlays.length === 0) {
        const empty = document.createElement("p");
        empty.className = "round-plays-empty";
        empty.textContent = "No cards yet";
        track.append(empty);
        return;
    }

    roundPlays.forEach(function (play) {
        play.cards.forEach(function (card) {
            track.append(makeCardFace(card, {
                small: true
            }));
        });
    });

    let dragging = false;
    let dragStartX = 0;
    let dragStartScroll = 0;

    track.addEventListener("pointerdown", function (event) {
        dragging = true;
        dragStartX = event.clientX;
        dragStartScroll = track.scrollLeft;
        track.classList.add("is-dragging");
        track.setPointerCapture(event.pointerId);
    });

    track.addEventListener("pointermove", function (event) {
        if (!dragging) {
            return;
        }

        track.scrollLeft = dragStartScroll - (event.clientX - dragStartX);
    });

    track.addEventListener("pointerup", function () {
        dragging = false;
        track.classList.remove("is-dragging");
    });

    track.addEventListener("pointercancel", function () {
        dragging = false;
        track.classList.remove("is-dragging");
    });
};

const animateLastPlay = function () {
    const play = state.lastPlay;

    if (!play || play.playerIndex === null || state.moveNumber === lastAnimatedMoveNumber) {
        return;
    }

    lastAnimatedMoveNumber = state.moveNumber;

    const seat = elements.seats[play.playerIndex];
    const pile = elements.pile;

    if (!seat || !pile || play.cards.length === 0) {
        return;
    }

    pileRevealToken += 1;
    const revealToken = pileRevealToken;
    pile.classList.add("is-waiting-for-flight");
    window.setTimeout(function () {
        if (revealToken === pileRevealToken) {
            pile.classList.remove("is-waiting-for-flight");
        }
    }, flightDuration);

    const sourceBox = nextPlaySourceBox || seat.getBoundingClientRect();
    nextPlaySourceBox = null;
    const pileBox = pile.getBoundingClientRect();
    const startX = sourceBox.left + sourceBox.width / 2;
    const startY = sourceBox.top + sourceBox.height / 2;
    const midX = window.innerWidth / 2;
    const midY = window.innerHeight / 2;
    const endX = pileBox.left + pileBox.width / 2;
    const endY = pileBox.top + pileBox.height / 2;

    play.cards.forEach(function (card, index) {
        const flyingCard = makeCardFace(card, {
            small: true
        });
        const offset = (index - (play.cards.length - 1) / 2) * 12;
        const startCardX = startX + offset;
        const startCardY = startY + (index * 3);
        const midCardX = midX + offset;
        const midCardY = midY - (index * 4);
        const endCardX = endX + offset;
        const endCardY = endY + (index * 3);

        flyingCard.classList.add("play-flight-card");
        document.body.append(flyingCard);

        const cardBox = flyingCard.getBoundingClientRect();
        const cardWidth = cardBox.width;
        const cardHeight = cardBox.height;
        const startRotation = -10 + index * 5;
        const endRotation = -5 + index * 4;
        const placeAt = function (x, y, scale, rotation) {
            return `translate(${x - cardWidth / 2}px, ${y - cardHeight / 2}px) scale(${scale}) rotate(${rotation}deg)`;
        };
        const animation = flyingCard.animate([
            {
                opacity: 0.55,
                transform: placeAt(startCardX, startCardY, 1, startRotation)
            },
            {
                offset: 0.42,
                opacity: 1,
                transform: placeAt(midCardX, midCardY, 2.55, 0)
            },
            {
                offset: 0.68,
                opacity: 1,
                transform: placeAt(midCardX, midCardY, 2.25, 0)
            },
            {
                offset: 0.88,
                opacity: 1,
                transform: placeAt(endCardX, endCardY, 0.72, endRotation)
            },
            {
                opacity: 0,
                transform: placeAt(endCardX, endCardY, 0.95, endRotation)
            }
        ], {
            delay: index * 45,
            duration: flightDuration,
            easing: "linear",
            fill: "forwards"
        });

        animation.finished.finally(function () {
            flyingCard.remove();
        });
    });
};

const lastPlayClearedPile = function () {
    return state.lastPlay !== null
        && state.lastPlay.cards.length > 0
        && pileClearRanks.includes(state.lastPlay.cards[0].rank);
};

const showClearNotice = function () {
    const play = state.lastPlay;

    if (!play) {
        return;
    }

    elements.clearNoticeText.textContent = `${play.playerName} played ${play.cards[0].rank}. All cards in the pile were cleared.`;
    elements.clearNotice.classList.remove("is-hidden");
};

const continueAfterMove = function () {
    if (lastPlayClearedPile() && state.moveNumber !== lastClearNoticeMoveNumber) {
        lastClearNoticeMoveNumber = state.moveNumber;
        window.setTimeout(showClearNotice, flightDuration);
        return;
    }

    window.setTimeout(runAITurns, flightDuration);
};

const turnStatusText = function (visible) {
    if (state.matchWinner !== null) {
        return `${visible.players[state.matchWinner].name} wins match`;
    }

    if (state.stalemate) {
        return "Stalemate";
    }

    if (state.winner !== null) {
        return `${visible.players[state.winner].name} wins round`;
    }

    return visible.players[visible.currentPlayer].name;
};

const messageText = function (visible) {
    if (state.matchWinner !== null) {
        return `${visible.players[state.matchWinner].name} reached 10 points.`;
    }

    if (state.stalemate) {
        return "Stalemate. Everyone gains 1 point.";
    }

    if (state.winner !== null) {
        return `${visible.players[state.winner].name} wins this round and gains 2 points.`;
    }

    return `Current playable area: ${visible.phase}.`;
};

const renderResultConfetti = function (active) {
    clear(elements.resultConfetti);

    if (!active) {
        return;
    }

    const colors = ["#f4c95d", "#c22d35", "#245d4e", "#1f3344", "#ffffff"];

    for (let index = 0; index < 54; index += 1) {
        const piece = document.createElement("span");
        piece.className = "confetti-piece";
        piece.style.setProperty("--x", `${8 + Math.random() * 84}vw`);
        piece.style.setProperty("--drift", `${-5 + Math.random() * 10}rem`);
        piece.style.setProperty("--spin", `${180 + Math.random() * 540}deg`);
        piece.style.setProperty("--delay", `${Math.random() * 0.45}s`);
        piece.style.setProperty("--duration", `${1.45 + Math.random() * 0.85}s`);
        piece.style.setProperty("--confetti-color", colors[index % colors.length]);
        piece.style.setProperty("--confetti-width", `${0.34 + Math.random() * 0.28}rem`);
        piece.style.setProperty("--confetti-height", `${0.58 + Math.random() * 0.5}rem`);
        elements.resultConfetti.append(piece);
    }
};

const renderResultNotice = function (visible) {
    const roundFinished = state.winner !== null || state.stalemate || state.matchWinner !== null;
    const humanWon = state.winner === 0 || state.matchWinner === 0;

    elements.resultNotice.classList.toggle("is-hidden", !roundFinished);
    renderResultConfetti(roundFinished && humanWon);

    if (!roundFinished) {
        return;
    }

    if (state.matchWinner !== null) {
        const winnerName = visible.players[state.matchWinner].name;
        elements.resultNoticeLabel.textContent = "Match over";
        elements.resultNoticeTitle.textContent = `${winnerName} wins the match`;
        elements.resultNoticeText.textContent = `${winnerName} reached ${state.scores[state.matchWinner]} points.`;
        elements.resultContinue.textContent = "Restart match";
        return;
    }

    if (state.stalemate) {
        elements.resultNoticeLabel.textContent = "Round over";
        elements.resultNoticeTitle.textContent = "Stalemate";
        elements.resultNoticeText.textContent = "No one could finish the round. Everyone gains 1 point.";
        elements.resultContinue.textContent = "Next round";
        return;
    }

    const winnerName = visible.players[state.winner].name;
    elements.resultNoticeLabel.textContent = "Round over";
    elements.resultNoticeTitle.textContent = `${winnerName} wins the round`;
    elements.resultNoticeText.textContent = `${winnerName} emptied every card and gains 2 points.`;
    elements.resultContinue.textContent = "Next round";
};

function render() {
    const visible = getVisibleState(state);
    const topCard = getTopCard(state);
    const player = state.players[0];
    const area = activeArea(player);
    const availableIds = player[area].map(function (card) {
        return card.id;
    });
    selectedCardIds = selectedCardIds.filter(function (cardId) {
        return availableIds.includes(cardId);
    });

    elements.turnStatus.textContent = turnStatusText(visible);
    elements.topCard.textContent = topCard === null
        ? "Any"
        : cardLabel(topCard);
    elements.drawCount.textContent = String(visible.drawPile.length);
    elements.burnedCount.textContent = String(visible.burned.length);
    elements.message.textContent = messageText(visible);
    elements.restartButton.textContent = (state.winner !== null || state.stalemate) && state.matchWinner === null
        ? "Next round"
        : "Restart";
    renderResultNotice(visible);

    renderPile(topCard);
    renderRoundPlays(visible.roundPlays);
    visible.players.forEach(function (_player, playerIndex) {
        renderSeat(visible, playerIndex);
    });
    animateLastPlay();

    elements.pickupButton.disabled = state.currentPlayer !== 0
        || state.winner !== null
        || state.stalemate
        || state.matchWinner !== null
        || state.pile.length === 0;

    clear(elements.gameLog);
    visible.log.forEach(function (entry) {
        const item = document.createElement("li");
        item.textContent = entry;
        elements.gameLog.append(item);
    });
}

const runAITurns = function () {
    if (state.currentPlayer === 0 || state.winner !== null || state.stalemate || state.matchWinner !== null) {
        return;
    }

    window.setTimeout(function () {
        const moveNumberBeforeAI = state.moveNumber;
        state = autoPlayTurn(state);
        render();

        if (lastPlayClearedPile() && state.moveNumber !== lastClearNoticeMoveNumber) {
            lastClearNoticeMoveNumber = state.moveNumber;
            window.setTimeout(showClearNotice, flightDuration);
            return;
        }

        if (state.currentPlayer !== 0 && state.winner === null && !state.stalemate && state.matchWinner === null) {
            window.setTimeout(runAITurns, state.moveNumber > moveNumberBeforeAI
                ? flightDuration
                : 0);
        }
    }, 600);
};

elements.closeTutorial.addEventListener("click", function () {
    closeTutorial();
});

elements.clearContinue.addEventListener("click", function () {
    elements.clearNotice.classList.add("is-hidden");
    runAITurns();
});

document.addEventListener("click", function (event) {
    const tutorialOpen = !elements.tutorial.classList.contains("is-hidden");
    const step = guideSteps[guideStep];

    if (!tutorialOpen || step.task !== "click" || elements.tutorial.contains(event.target)) {
        return;
    }

    if (clickedInsideGuideTarget(event.target)) {
        event.preventDefault();
        event.stopPropagation();
        completeGuideStep();
    }
}, true);

elements.guideButton.addEventListener("click", function () {
    openTutorial();
});

elements.tutorialBack.addEventListener("click", function () {
    guideStep = Math.max(0, guideStep - 1);
    guideStepComplete = false;
    renderTutorial();
});

elements.tutorialNext.addEventListener("click", function () {
    if (!guideStepComplete) {
        return;
    }

    if (guideStep === guideSteps.length - 1) {
        closeTutorial();
        return;
    }

    guideStep += 1;
    guideStepComplete = false;
    renderTutorial();
});

const restartGame = function () {
    const keepScores = (state.winner !== null || state.stalemate) && state.matchWinner === null;
    state = createGame(Date.now() % 100000, keepScores
        ? state.scores
        : [0, 0, 0, 0]);
    selectedCardIds = [];
    humanHandScrollLeft = 0;
    closeTutorial(false);
    render();
};

elements.restartButton.addEventListener("click", restartGame);

elements.resultContinue.addEventListener("click", restartGame);

elements.pickupButton.addEventListener("click", function () {
    state = pickUpPile(state);
    selectedCardIds = [];
    humanHandScrollLeft = 0;
    render();
    runAITurns();
});

render();
openTutorial();
