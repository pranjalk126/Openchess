import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@0.10.3/+esm";

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";

import {
  getDatabase,
  ref,
  get,
  set,
  update,
  onValue
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";


/* =========================
   FIREBASE
========================= */

const firebaseConfig = {
  apiKey: "AIzaSyCig8XFi4uud8pwM_pYI7EqMmSMGRlMPoI",
  authDomain: "openchess-171a5.firebaseapp.com",
  databaseURL: "https://openchess-171a5-default-rtdb.firebaseio.com",
  projectId: "openchess-171a5",
  storageBucket: "openchess-171a5.firebasestorage.app",
  messagingSenderId: "567217558339",
  appId: "1:567217558339:web:8167ec11e9bbdd216915f6"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);


/* =========================
   CHESS PIECES
========================= */

const pieces = {
  w: {
    K: "♔",
    Q: "♕",
    R: "♖",
    B: "♗",
    N: "♘",
    P: "♙"
  },

  b: {
    K: "♚",
    Q: "♛",
    R: "♜",
    B: "♝",
    N: "♞",
    P: "♟"
  }
};


/* =========================
   GAME VARIABLES
========================= */

let game = new Chess();

let selected = null;

let flipped = false;

let roomCode =
  new URLSearchParams(location.search).get("room");

let playerId =
  localStorage.getItem("openchess_player");

if (!playerId) {

  playerId = crypto.randomUUID();

  localStorage.setItem(
    "openchess_player",
    playerId
  );
}

let playerColor = null;

let gameMode = roomCode
  ? "online"
  : "offline";

let computerDifficulty = "easy";

let roomUnsubscribe = null;


/* =========================
   HTML ELEMENTS
========================= */

const boardEl =
  document.getElementById("board");

const movesEl =
  document.getElementById("moves");

const roomStatusEl =
  document.getElementById("roomStatus");

const roomCodeEl =
  document.getElementById("roomCode");

const opponentTypeEl =
  document.getElementById("opponentType");


/* =========================
   RENDER BOARD
========================= */

function render() {

  boardEl.innerHTML = "";

  const files = flipped
    ? ["h","g","f","e","d","c","b","a"]
    : ["a","b","c","d","e","f","g","h"];

  const ranks = flipped
    ? [1,2,3,4,5,6,7,8]
    : [8,7,6,5,4,3,2,1];

  const selectedMoves = selected
    ? game.moves({
        square: selected,
        verbose: true
      })
    : [];


  ranks.forEach((rank, ri) => {

    files.forEach((file, fi) => {

      const sq = file + rank;

      const el =
        document.createElement("div");

      el.className =
        "square " +
        ((ri + fi) % 2 === 0
          ? "light"
          : "dark");


      if (sq === selected) {

        el.classList.add("selected");
      }


      const target =
        selectedMoves.find(
          m => m.to === sq
        );


      if (target) {

        el.classList.add(
          game.get(sq)
            ? "capture"
            : "legal"
        );
      }


      const p = game.get(sq);


      if (p) {

        const span =
          document.createElement("span");

        span.className =
          "piece " +
          (p.color === "w"
            ? "white"
            : "black");

        span.textContent =
          pieces[p.color][
            p.type.toUpperCase()
          ];

        el.appendChild(span);
      }


      el.onclick = () =>
        clickSquare(sq);

      boardEl.appendChild(el);

    });

  });


  const turn =
    game.turn() === "w"
      ? "White"
      : "Black";


  document.getElementById(
    "turnBadge"
  ).textContent = turn;


  document.querySelector(
    ".board-top span"
  ).textContent =
    turn + " to move";


  document.getElementById(
    "moveCount"
  ).textContent =
    "Move " +
    Math.ceil(
      game.history().length / 2
    );


  renderMoves();

}


/* =========================
   MOVE LIST
========================= */

function renderMoves() {

  const history =
    game.history();


  if (!history.length) {

    movesEl.innerHTML =
      '<div class="empty">' +
      "Make a move to begin." +
      "</div>";

    return;
  }


  movesEl.innerHTML = "";


  for (
    let i = 0;
    i < history.length;
    i += 2
  ) {

    const row =
      document.createElement("div");

    row.className =
      "move-row";


    row.innerHTML =
      `<span>${i / 2 + 1}.</span>` +
      `<span>${history[i] || ""}</span>` +
      `<span>${history[i + 1] || ""}</span>`;


    movesEl.appendChild(row);

  }

}


/* =========================
   STOP FIREBASE LISTENER
========================= */

function stopRoomListener() {

  if (roomUnsubscribe) {

    roomUnsubscribe();

    roomUnsubscribe = null;
  }

}


/* =========================
   CREATE ONLINE ROOM
========================= */

async function createRoom() {

  stopRoomListener();

  const code =
    "OPEN-" +
    Math.floor(
      1000 + Math.random() * 9000
    );


  const roomRef =
    ref(db, "rooms/" + code);


  await set(roomRef, {

    fen: game.fen(),

    history: [],

    whiteId: playerId,

    blackId: "",

    status: "waiting",

    createdAt: Date.now()

  });


  roomCode = code;

  playerColor = "w";

  gameMode = "online";


  history.replaceState(
    null,
    "",
    "?room=" +
    encodeURIComponent(code)
  );


  roomCodeEl.textContent =
    code;


  roomStatusEl.textContent =
    "Waiting for opponent...";


  opponentTypeEl.textContent =
    "Waiting for friend";


  listenToRoom();

  render();

}


/* =========================
   JOIN ONLINE ROOM
========================= */

async function joinRoom(code) {

  stopRoomListener();

  const roomRef =
    ref(db, "rooms/" + code);


  const result =
    await get(roomRef);


  if (!result.exists()) {

    alert("Room not found.");

    return;
  }


  const room =
    result.val();


  if (room.whiteId === playerId) {

    playerColor = "w";

  }

  else if (room.blackId === playerId) {

    playerColor = "b";

  }

  else if (!room.blackId) {

    await update(roomRef, {

      blackId: playerId,

      status: "playing"

    });

    playerColor = "b";

  }

  else {

    alert(
      "This room already has two players."
    );

    return;
  }


  roomCode = code;

  gameMode = "online";


  roomCodeEl.textContent =
    code;


  roomStatusEl.textContent =
    playerColor === "w"
      ? "You are White"
      : "You are Black";


  opponentTypeEl.textContent =
    "Online Player";


  listenToRoom();

  render();

}


/* =========================
   LISTEN TO ONLINE ROOM
========================= */

function listenToRoom() {

  if (!roomCode) {
    return;
  }


  stopRoomListener();


  const roomRef =
    ref(db, "rooms/" + roomCode);


  roomUnsubscribe =
    onValue(
      roomRef,
      snapshot => {

        if (!snapshot.exists()) {
          return;
        }


        const room =
          snapshot.val();


        if (room.fen) {

          game.load(room.fen);

          selected = null;
        }


        if (
          room.status === "waiting"
        ) {

          roomStatusEl.textContent =
            "Waiting for opponent...";

          opponentTypeEl.textContent =
            "Waiting for friend";

        }


        if (
          room.status === "playing"
        ) {

          roomStatusEl.textContent =
            playerColor === "w"
              ? "You are White"
              : "You are Black";

          opponentTypeEl.textContent =
            "Online Player";

        }


        render();

      }
    );

}


/* =========================
   SEND ONLINE MOVE
========================= */

async function sendMove() {

  if (
    gameMode !== "online" ||
    !roomCode
  ) {

    return;
  }


  const roomRef =
    ref(db, "rooms/" + roomCode);


  await update(roomRef, {

    fen: game.fen(),

    history: game.history(),

    status: "playing"

  });

}


/* =========================
   MAKE MOVE
========================= */

async function clickSquare(sq) {

  if (game.game_over()) {
    return;
  }


  /* ONLINE */

  if (gameMode === "online") {

    if (!roomCode) {
      return;
    }

    if (
      playerColor !== game.turn()
    ) {

      return;
    }

  }


  /* COMPUTER */

  if (gameMode === "computer") {

    if (game.turn() !== "w") {

      return;
    }

  }


  const p =
    game.get(sq);


  if (selected) {

    const move =
      game.moves({
        square: selected,
        verbose: true
      }).find(
        m => m.to === sq
      );


    if (move) {

      try {

        game.move({

          from: selected,

          to: sq,

          promotion: "q"

        });


        selected = null;


        render();


        /* ONLINE */

        if (
          gameMode === "online"
        ) {

          await sendMove();

        }


        /* COMPUTER */

        if (
          gameMode === "computer" &&
          !game.game_over()
        ) {

          setTimeout(
            computerMove,
            350
          );

        }


        return;

      }

      catch (error) {

        console.error(error);

      }

    }

  }


  if (
    p &&
    p.color === game.turn()
  ) {

    selected = sq;

  }

  else {

    selected = null;

  }


  render();

}


/* =========================
   COMPUTER AI
========================= */

const pieceValues = {

  p: 100,

  n: 320,

  b: 330,

  r: 500,

  q: 900,

  k: 20000

};


function evaluateBoard() {

  let score = 0;


  const board =
    game.board();


  for (
    let r = 0;
    r < 8;
    r++
  ) {

    for (
      let c = 0;
      c < 8;
      c++
    ) {

      const p =
        board[r][c];


      if (!p) {
        continue;
      }


      const value =
        pieceValues[p.type] || 0;


      if (p.color === "b") {

        score += value;

      }

      else {

        score -= value;

      }

    }

  }


  return score;

}


/* =========================
   MINIMAX
========================= */

function minimax(
  position,
  depth,
  maximizing
) {

  if (
    depth === 0 ||
    position.game_over()
  ) {

    return evaluatePosition(
      position
    );

  }


  const moves =
    position.moves();


  if (maximizing) {

    let best =
      -Infinity;


    for (
      const move of moves
    ) {

      position.move(move);


      const score =
        minimax(
          position,
          depth - 1,
          false
        );


      position.undo();


      best =
        Math.max(
          best,
          score
        );

    }


    return best;

  }


  else {

    let best =
      Infinity;


    for (
      const move of moves
    ) {

      position.move(move);


      const score =
        minimax(
          position,
          depth - 1,
          true
        );


      position.undo();


      best =
        Math.min(
          best,
          score
        );

    }


    return best;

  }

}


/* =========================
   POSITION EVALUATION
========================= */

function evaluatePosition(position) {

  let score = 0;


  const board =
    position.board();


  for (
    let r = 0;
    r < 8;
    r++
  ) {

    for (
      let c = 0;
      c < 8;
      c++
    ) {

      const p =
        board[r][c];


      if (!p) {
        continue;
      }


      const value =
        pieceValues[p.type] || 0;


      if (p.color === "b") {

        score += value;

      }

      else {

        score -= value;

      }

    }

  }


  return score;

}


/* =========================
   COMPUTER MOVE
========================= */

function computerMove() {

  if (
    gameMode !== "computer"
  ) {

    return;
  }


  if (game.game_over()) {

    return;
  }


  if (game.turn() !== "b") {

    return;
  }


  const moves =
    game.moves();


  if (!moves.length) {

    return;
  }


  let chosenMove;


  /* EASY */

  if (
    computerDifficulty === "easy"
  ) {

    chosenMove =
      moves[
        Math.floor(
          Math.random() *
          moves.length
        )
      ];

  }


  /* MEDIUM */

  else if (
    computerDifficulty === "medium"
  ) {

    let bestScore =
      -Infinity;


    for (
      const move of moves
    ) {

      game.move(move);


      const score =
        evaluatePosition(game);


      game.undo();


      if (
        score > bestScore
      ) {

        bestScore = score;

        chosenMove = move;

      }

    }

  }


  /* HARD */

  else {

    let bestScore =
      -Infinity;


    for (
      const move of moves
    ) {

      game.move(move);


      const score =
        minimax(
          game,
          2,
          false
        );


      game.undo();


      if (
        score > bestScore
      ) {

        bestScore = score;

        chosenMove = move;

      }

    }

  }


  if (!chosenMove) {

    chosenMove =
      moves[0];

  }


  game.move(
    chosenMove
  );


  selected = null;


  render();

}


/* =========================
   COMPUTER DIFFICULTY
========================= */

function chooseDifficulty() {

  const answer =
    prompt(
      "Choose computer difficulty:\n\n" +
      "1 = Easy\n" +
      "2 = Medium\n" +
      "3 = Hard",
      "1"
    );


  if (answer === "3") {

    computerDifficulty =
      "hard";

  }

  else if (answer === "2") {

    computerDifficulty =
      "medium";

  }

  else {

    computerDifficulty =
      "easy";

  }

}


/* =========================
   OFFLINE MODE
========================= */

function startOffline() {

  stopRoomListener();


  roomCode = null;

  playerColor = null;


  history.replaceState(
    null,
    "",
    location.pathname
  );


  gameMode =
    "offline";


  game.reset();

  selected = null;


  roomCodeEl.textContent =
    "OFFLINE";


  roomStatusEl.textContent =
    "2 Player Offline";


  opponentTypeEl.textContent =
    "Black Player";


  render();

}


/* =========================
   COMPUTER MODE
========================= */

function startComputer() {

  stopRoomListener();


  roomCode = null;

  playerColor = "w";


  history.replaceState(
    null,
    "",
    location.pathname
  );


  gameMode =
    "computer";


  chooseDifficulty();


  game.reset();

  selected = null;


  roomCodeEl.textContent =
    "COMPUTER";


  roomStatusEl.textContent =
    "Vs Computer — " +
    computerDifficulty
      .charAt(0)
      .toUpperCase() +
    computerDifficulty.slice(1);


  opponentTypeEl.textContent =
    "Computer 🤖";


  render();

}


/* =========================
   ONLINE MODE
========================= */

async function startOnline() {

  stopRoomListener();


  gameMode =
    "online";


  if (roomCode) {

    await joinRoom(
      roomCode
    );

  }

  else {

    game.reset();

    selected = null;

    await createRoom();

  }

}


/* =========================
   NEW GAME
========================= */

async function newGame() {

  if (
    gameMode === "offline"
  ) {

    startOffline();

    return;

  }


  if (
    gameMode === "computer"
  ) {

    startComputer();

    return;

  }


  await startOnline();

}


/* =========================
   BUTTONS
========================= */

document.getElementById(
  "newGameTop"
).onclick =
  newGame;


document.getElementById(
  "newGameHero"
).onclick =
  newGame;


document.getElementById(
  "resetBtn"
).onclick =
  newGame;


/* FLIP */

document.getElementById(
  "flipBtn"
).onclick = () => {

  flipped =
    !flipped;

  render();

};


/* ONLINE BUTTON */

document.getElementById(
  "onlineMode"
).onclick =
  startOnline;


/* OFFLINE BUTTON */

document.getElementById(
  "offlineMode"
).onclick =
  startOffline;


/* COMPUTER BUTTON */

document.getElementById(
  "computerMode"
).onclick =
  startComputer;


/* FIND OPPONENT */

document.getElementById(
  "joinRandom"
).onclick = () => {

  if (roomCode) {

    startOnline();

  }

  else {

    alert(
      "Create an online game first."
    );

  }

};


/* COPY ROOM */

document.getElementById(
  "copyRoom"
).onclick =
  async () => {

    if (
      gameMode !== "online" ||
      !roomCode
    ) {

      alert(
        "Start an online game first."
      );

      return;
    }


    const link =
      location.origin +
      location.pathname +
      "?room=" +
      encodeURIComponent(
        roomCode
      );


    try {

      await navigator.clipboard.writeText(
        link
      );


      roomStatusEl.textContent =
        "Room link copied!";


    }

    catch (error) {

      prompt(
        "Copy this room link:",
        link
      );

    }

  };


/* DRAW */

document.getElementById(
  "drawBtn"
).onclick = () => {

  alert(
    "Draw system coming next."
  );

};


/* RESIGN */

document.getElementById(
  "resignBtn"
).onclick = () => {

  alert(
    "Resign system coming next."
  );

};


/* =========================
   START GAME
========================= */

if (roomCode) {

  startOnline();

}

else {

  startOffline();

    }
