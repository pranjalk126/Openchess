import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getDatabase,
  ref,
  get,
  set,
  update,
  onValue,
  runTransaction
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";

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

const pieces = {
  w:{K:"♔",Q:"♕",R:"♖",B:"♗",N:"♘",P:"♙"},
  b:{K:"♚",Q:"♛",R:"♜",B:"♝",N:"♞",P:"♟"}
};

let game = new Chess();
let selected = null;
let flipped = false;
let roomCode = new URLSearchParams(location.search).get("room");
let playerId = localStorage.getItem("openchess_player");

if (!playerId) {
  playerId = crypto.randomUUID();
  localStorage.setItem("openchess_player", playerId);
}

let playerColor = null;

const boardEl = document.getElementById("board");
const movesEl = document.getElementById("moves");

function render() {
  boardEl.innerHTML = "";

  const files = flipped
    ? ["h","g","f","e","d","c","b","a"]
    : ["a","b","c","d","e","f","g","h"];

  const ranks = flipped
    ? [1,2,3,4,5,6,7,8]
    : [8,7,6,5,4,3,2,1];

  const selectedMoves = selected
    ? game.moves({square:selected, verbose:true})
    : [];

  ranks.forEach((rank,ri) => {
    files.forEach((file,fi) => {

      const sq = file + rank;
      const el = document.createElement("div");

      el.className =
        "square " + ((ri+fi)%2===0 ? "light" : "dark");

      if (sq === selected) el.classList.add("selected");

      const target = selectedMoves.find(m => m.to === sq);

      if (target)
        el.classList.add(game.get(sq) ? "capture" : "legal");

      const p = game.get(sq);

      if (p) {
        const span = document.createElement("span");
        span.className =
          "piece " + (p.color === "w" ? "white" : "black");

        span.textContent = pieces[p.color][p.type.toUpperCase()];
        el.appendChild(span);
      }

      el.onclick = () => clickSquare(sq);

      boardEl.appendChild(el);
    });
  });

  const turn = game.turn() === "w" ? "White" : "Black";

  document.getElementById("turnBadge").textContent = turn;
  document.querySelector(".board-top span").textContent =
    turn + " to move";

  document.getElementById("moveCount").textContent =
    "Move " + Math.ceil(game.history().length / 2);

  renderMoves();
}

function renderMoves() {
  const h = game.history();

  if (!h.length) {
    movesEl.innerHTML =
      '<div class="empty">Make a move to begin.</div>';
    return;
  }

  movesEl.innerHTML = "";

  for (let i=0; i<h.length; i+=2) {
    const row = document.createElement("div");

    row.className = "move-row";

    row.innerHTML =
      `<span>${i/2+1}.</span>
       <span>${h[i] || ""}</span>
       <span>${h[i+1] || ""}</span>`;

    movesEl.appendChild(row);
  }
}

async function createRoom() {

  const code =
    "OPEN-" + Math.floor(1000 + Math.random() * 9000);

  const roomRef = ref(db, "rooms/" + code);

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

  history.replaceState(
    null,
    "",
    "?room=" + encodeURIComponent(code)
  );

  document.getElementById("roomCode").textContent = code;
  document.getElementById("roomStatus").textContent =
    "Waiting for opponent...";

  listenToRoom();

  render();
}

async function joinRoom(code) {

  const roomRef = ref(db, "rooms/" + code);
  const result = await get(roomRef);

  if (!result.exists()) {
    alert("Room not found.");
    return;
  }

  const room = result.val();

  if (room.whiteId === playerId) {
    playerColor = "w";
  } else if (room.blackId === playerId) {
    playerColor = "b";
  } else if (!room.blackId) {

    await update(roomRef, {
      blackId: playerId,
      status: "playing"
    });

    playerColor = "b";

  } else {
    alert("This room already has two players.");
    return;
  }

  document.getElementById("roomCode").textContent = code;
  document.getElementById("roomStatus").textContent =
    playerColor === "w"
      ? "You are White"
      : "You are Black";

  listenToRoom();
}

function listenToRoom() {

  const roomRef = ref(db, "rooms/" + roomCode);

  onValue(roomRef, snapshot => {

    if (!snapshot.exists()) return;

    const room = snapshot.val();

    if (room.fen) {
      game.load(room.fen);
      selected = null;
    }

    if (room.status === "waiting") {
      document.getElementById("roomStatus").textContent =
        "Waiting for opponent...";
    }

    if (room.status === "playing") {
      document.getElementById("roomStatus").textContent =
        playerColor === "w"
          ? "You are White"
          : "You are Black";
    }

    render();
  });
}

async function sendMove() {

  const roomRef = ref(db, "rooms/" + roomCode);

  await update(roomRef, {
    fen: game.fen(),
    history: game.history(),
    status: "playing"
  });
}

async function clickSquare(sq) {

  if (!roomCode) return;

  if (game.game_over()) return;

  if (playerColor !== game.turn()) return;

  const p = game.get(sq);

  if (selected) {

    const move =
      game.moves({
        square:selected,
        verbose:true
      }).find(m => m.to === sq);

    if (move) {

      try {

        game.move({
          from:selected,
          to:sq,
          promotion:"q"
        });

        selected = null;

        render();

        await sendMove();

        return;

      } catch(e) {
        console.log(e);
      }
    }
  }

  if (p && p.color === game.turn())
    selected = sq;
  else
    selected = null;

  render();
}

async function newGame() {

  game.reset();
  selected = null;

  await createRoom();
}

document.getElementById("newGameTop").onclick = newGame;
document.getElementById("newGameHero").onclick = newGame;
document.getElementById("resetBtn").onclick = newGame;

document.getElementById("flipBtn").onclick = () => {
  flipped = !flipped;
  render();
};

document.getElementById("joinRandom").onclick = () => {

  if (roomCode) {
    joinRoom(roomCode);
  } else {
    alert("Create a game first and share the room link.");
  }
};

document.getElementById("copyRoom").onclick = async () => {

  if (!roomCode) {
    alert("Create a game first.");
    return;
  }

  const link =
    location.origin +
    location.pathname +
    "?room=" +
    encodeURIComponent(roomCode);

  await navigator.clipboard.writeText(link);

  document.getElementById("roomStatus").textContent =
    "Room link copied!";
};

document.getElementById("drawBtn").onclick = () => {
  alert("Draw system coming next.");
};

document.getElementById("resignBtn").onclick = () => {
  alert("Resign system coming next.");
};

if (roomCode) {
  joinRoom(roomCode);
} else {
  document.getElementById("roomStatus").textContent =
    "Create a room to play online";
  render();
}
