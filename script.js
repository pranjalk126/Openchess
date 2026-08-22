const pieces = {
  w:{K:"♔",Q:"♕",R:"♖",B:"♗",N:"♘",P:"♙"},
  b:{K:"♚",Q:"♛",R:"♜",B:"♝",N:"♞",P:"♟"}
};
let game = new Chess();
let selected = null, flipped = false;
const boardEl=document.getElementById("board"), movesEl=document.getElementById("moves");

function render(){
  boardEl.innerHTML="";
  const files = flipped ? ["h","g","f","e","d","c","b","a"] : ["a","b","c","d","e","f","g","h"];
  const ranks = flipped ? [1,2,3,4,5,6,7,8] : [8,7,6,5,4,3,2,1];
  const selectedMoves = selected ? game.moves({square:selected,verbose:true}) : [];
  ranks.forEach((rank,ri)=>files.forEach((file,fi)=>{
    const sq=file+rank, el=document.createElement("div");
    el.className="square "+((ri+fi)%2===0?"light":"dark");
    if(sq===selected) el.classList.add("selected");
    const target=selectedMoves.find(m=>m.to===sq);
    if(target) el.classList.add(game.get(sq)?"capture":"legal");
    const p=game.get(sq);
    if(p){const span=document.createElement("span");span.className="piece "+(p.color==="w"?"white":"black");span.textContent=pieces[p.color][p.type.toUpperCase()];el.appendChild(span)}
    el.onclick=()=>clickSquare(sq);
    boardEl.appendChild(el);
  }));
  document.getElementById("turnBadge").textContent=game.turn()==="w"?"White":"Black";
  document.querySelector(".board-top span").textContent=(game.turn()==="w"?"White":"Black")+" to move";
  document.getElementById("moveCount").textContent="Move "+Math.ceil(game.history().length/2);
  renderMoves();
}
function clickSquare(sq){
  if(game.game_over()) return;
  const p=game.get(sq);
  if(selected){
    const move=game.moves({square:selected,verbose:true}).find(m=>m.to===sq);
    if(move){
      try{game.move({from:selected,to:sq,promotion:"q"});selected=null;render();return}catch(e){}
    }
  }
  if(p && p.color===game.turn()) selected=sq; else selected=null;
  render();
}
function renderMoves(){
  const h=game.history();
  if(!h.length){movesEl.innerHTML='<div class="empty">Make a move to begin.</div>';return}
  movesEl.innerHTML="";
  for(let i=0;i<h.length;i+=2){
    const row=document.createElement("div");row.className="move-row";
    row.innerHTML=`<span>${i/2+1}.</span><span>${h[i]||""}</span><span>${h[i+1]||""}</span>`;
    movesEl.appendChild(row);
  }
}
function newGame(){
  game.reset();selected=null;
  document.getElementById("roomCode").textContent="OPEN-"+Math.floor(1000+Math.random()*9000);
  document.getElementById("roomStatus").textContent="New room created";
  render();
}
document.getElementById("newGameTop").onclick=newGame;
document.getElementById("newGameHero").onclick=newGame;
document.getElementById("resetBtn").onclick=newGame;
document.getElementById("flipBtn").onclick=()=>{flipped=!flipped;render()};
document.getElementById("joinRandom").onclick=()=>{document.getElementById("roomStatus").textContent="Searching for opponent…";setTimeout(()=>document.getElementById("roomStatus").textContent="Opponent found (demo)",900)};
document.getElementById("copyRoom").onclick=async()=>{await navigator.clipboard?.writeText(location.href+"?room="+document.getElementById("roomCode").textContent);document.getElementById("roomStatus").textContent="Room link copied"};
document.getElementById("drawBtn").onclick=()=>alert("Draw offer sent (demo).");
document.getElementById("resignBtn").onclick=()=>{if(confirm("Resign this game?")) alert("You resigned (demo).")};
render();
