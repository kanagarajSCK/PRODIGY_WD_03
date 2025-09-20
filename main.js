// --- Game state ---
    const boardEl = document.getElementById('board');
    const modeSelect = document.getElementById('mode');
    const startSelect = document.getElementById('startPlayer');
    const newBtn = document.getElementById('newGame');
    const resetScoresBtn = document.getElementById('resetScores');
    const turnText = document.getElementById('turnText');
    const scoreXEl = document.getElementById('scoreX');
    const scoreOEl = document.getElementById('scoreO');
    const scoreDEl = document.getElementById('scoreD');
    const historyEl = document.getElementById('history');
    const roundCountEl = document.getElementById('roundCount');

    let board = Array(9).fill(null); // null | 'X' | 'O'
    let current = 'X';
    let running = false;
    let scores = { X:0, O:0, D:0 };
    let round = 1;
    let history = []; // latest first

    // Winning combos (indexes)
    const wins = [
      [0,1,2],[3,4,5],[6,7,8],
      [0,3,6],[1,4,7],[2,5,8],
      [0,4,8],[2,4,6]
    ];

    // Initialize board DOM
    function makeBoard(){
      boardEl.innerHTML = '';
      for(let i=0;i<9;i++){
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.setAttribute('role','gridcell');
        cell.tabIndex = 0;
        cell.dataset.idx = i;
        cell.addEventListener('click', onCellClick);
        cell.addEventListener('keydown', (e) => {
          if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCellClick.call(cell,e); }
        });
        boardEl.appendChild(cell);
      }
    }

    // Render board
    function render(){
      for(let i=0;i<9;i++){
        const el = boardEl.children[i];
        el.textContent = board[i] || '';
        el.classList.toggle('disabled', !!board[i] || !running);
      }
      turnText.textContent = running ? `Turn: ${current}` : 'Paused / Ready';
      scoreXEl.textContent = scores.X;
      scoreOEl.textContent = scores.O;
      scoreDEl.textContent = scores.D;
      roundCountEl.textContent = round;
      renderHistory();
    }

    function startNewGame(starting = null){
      board = Array(9).fill(null);
      current = starting || startSelect.value || 'X';
      running = true;
      // remove highlights
      Array.from(boardEl.children).forEach(c => c.classList.remove('highlight'));
      render();
      // if mode is AI and AI starts
      if(isAIMode() && current === 'O') {
        // let small delay for UX
        setTimeout(aiMove, 350);
      }
    }

    function isAIMode(){ return modeSelect.value !== 'pvp'; }

    // Click handler
    function onCellClick(e){
      if(!running) return;
      const idx = +this.dataset.idx;
      if(board[idx]) return; // occupied
      // Place
      board[idx] = current;
      // Check result
      const result = evaluate(board);
      if(result.win){
        // highlight
        result.combo.forEach(i => boardEl.children[i].classList.add('highlight'));
        running = false;
        scores[current] += 1;
        pushHistory(`${current} wins`);
      } else if(result.draw){
        running = false;
        scores.D += 1;
        pushHistory('Draw');
      } else {
        // switch player
        current = current === 'X' ? 'O' : 'X';
        // If AI turn, make AI move after short delay
        if(isAIMode() && running && current === 'O'){
          setTimeout(aiMove, 350);
        }
      }
      render();
    }

    // Evaluate board -> { win:bool, combo:[], draw:bool }
    function evaluate(b){
      for(const combo of wins){
        const [a,b1,c] = combo;
        if(board[a] && board[a] === board[b1] && board[a] === board[c]){
          return { win:true, combo };
        }
      }
      if(b.every(Boolean)) return { win:false, draw:true };
      return { win:false, draw:false };
    }

    // AI Move: two implementations:
    // - Easy: pick a random empty cell
    // - Hard: minimax for near-perfect play
    function aiMove(){
      if(!running) return;
      const mode = modeSelect.value;
      let idx;
      if(mode === 'pvc') {
        idx = aiRandom();
      } else {
        idx = aiMinimaxMove();
      }
      if(idx === undefined) return;
      board[idx] = current;
      const result = evaluate(board);
      if(result.win){
        result.combo.forEach(i => boardEl.children[i].classList.add('highlight'));
        running = false;
        scores[current] += 1;
        pushHistory(`${current} wins`);
      } else if(result.draw){
        running = false;
        scores.D += 1;
        pushHistory('Draw');
      } else {
        current = current === 'X' ? 'O' : 'X';
      }
      render();
    }

    function aiRandom(){
      const empties = board.flatMap((v,i)=> v?[]:[i]);
      if(!empties.length) return undefined;
      return empties[Math.floor(Math.random()*empties.length)];
    }

    // Minimax (returns best index for 'O' assuming 'X' is opponent)
    function aiMinimaxMove(){
      // We will run minimax from current board where current is 'O' for AI
      const player = current; // should be 'O'
      const opponent = player === 'X' ? 'O' : 'X';

      // If board empty, choose center for speed
      if(board.every(v => v===null)) return 4;

      function minimax(b, turn){
        const evalRes = evaluate(b);
        if(evalRes.win){
          // whoever last moved wins -> assign scores
          // find who is winning: check the winner from combo value
          const winner = b[evalRes.combo[0]];
          return { score: winner === player ? 10 : -10 };
        }
        if(evalRes.draw) return { score: 0 };

        const moves = [];
        for(let i=0;i<9;i++){
          if(!b[i]){
            const copy = b.slice();
            copy[i] = turn;
            const res = minimax(copy, turn === 'X' ? 'O' : 'X');
            moves.push({ idx:i, score: res.score });
          }
        }

        // choose best depending on who's turn
        if(turn === player){
          // maximize
          let best = moves[0];
          for(const m of moves) if(m.score > best.score) best = m;
          return best;
        } else {
          // minimize
          let best = moves[0];
          for(const m of moves) if(m.score < best.score) best = m;
          return best;
        }
      }

      const best = minimax(board.slice(), player);
      return best.idx;
    }

    // Save history (latest first), keep up to 10
    function pushHistory(text){
      history.unshift({ text, time: (new Date()).toLocaleTimeString() });
      if(history.length>10) history.pop();
    }

    function renderHistory(){
      historyEl.innerHTML = '';
      if(history.length===0){
        historyEl.innerHTML = '<div class="small" style="padding:8px;color:var(--muted)">No games yet</div>';
        return;
      }
      history.forEach(h=>{
        const d = document.createElement('div');
        d.className = 'item';
        d.innerHTML = `<div style="font-weight:700">${h.text}</div><div class="small">${h.time}</div>`;
        historyEl.appendChild(d);
      });
    }

    // Reset scores + history
    function resetScores(){
      scores = { X:0, O:0, D:0 };
      history = [];
      round = 1;
      render();
    }

    // New round (keep scores)
    function newRound(){
      round += 1;
      startNewGame(startSelect.value);
    }

    // Evaluate & push to history if game ended on newGame click
    function handleNewClicked(){
      // If current game ended already (running false), start new round
      if(!running){
        newRound();
        return;
      }
      // If game running and not finished, still start new game and record as aborted?
      pushHistory('New game started');
      newRound();
    }

    // Hook up UI events
    newBtn.addEventListener('click', handleNewClicked);
    resetScoresBtn.addEventListener('click', () => {
      if(confirm('Reset scores and history?')) resetScores();
    });

    modeSelect.addEventListener('change', () => {
      // Start new game when mode changes
      startNewGame(startSelect.value);
    });

    startSelect.addEventListener('change', () => {
      startNewGame(startSelect.value);
    });

    // Keyboard shortcut: N = new, R = reset scores, M = toggle mode
    window.addEventListener('keydown', (e) => {
      if(['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) return;
      if(e.key.toLowerCase() === 'n'){ handleNewClicked(); }
      if(e.key.toLowerCase() === 'r'){ if(confirm('Reset scores and history?')) resetScores(); }
      if(e.key.toLowerCase() === 'm'){ // toggle modes quickly
        if(modeSelect.value === 'pvp') modeSelect.value = 'pvc';
        else if(modeSelect.value === 'pvc') modeSelect.value = 'pvc-hard';
        else modeSelect.value = 'pvp';
        startNewGame(startSelect.value);
      }
    });

    // On game end, push result to history and allow new round
    // But evaluate already pushes results when a win/draw occurs inside click/aiMove

    // Initialize
    makeBoard();
    startNewGame(startSelect.value);
    render();

    // expose for console debugging (optional)
    window._ttt = { board, scores, startNewGame, resetScores };