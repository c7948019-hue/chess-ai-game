import React, { useMemo, useState, useEffect } from 'react';
import { Chess } from 'chess.js';
import { motion } from 'framer-motion';

const PIECES = {
  wp: '♙', wn: '♘', wb: '♗', wr: '♖', wq: '♕', wk: '♔',
  bp: '♟', bn: '♞', bb: '♝', br: '♜', bq: '♛', bk: '♚',
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1];
const PIECE_VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

function squareColor(fileIndex, rankIndex) {
  return (fileIndex + rankIndex) % 2 === 0 ? '#f0d9b5' : '#b58863';
}

function cloneGame(game) {
  return new Chess(game.fen());
}

function getPieceKey(piece) {
  if (!piece) return null;
  return `${piece.color}${piece.type}`;
}

function getAllSquares() {
  const arr = [];
  for (let r = 0; r < RANKS.length; r += 1) {
    for (let f = 0; f < FILES.length; f += 1) {
      arr.push(`${FILES[f]}${RANKS[r]}`);
    }
  }
  return arr;
}

function evaluateBoard(game) {
  if (game.isCheckmate()) {
    return game.turn() === 'w' ? -999999 : 999999;
  }
  if (
    game.isDraw() ||
    game.isStalemate() ||
    game.isThreefoldRepetition() ||
    game.isInsufficientMaterial()
  ) {
    return 0;
  }

  let score = 0;
  const squares = getAllSquares();

  for (const square of squares) {
    const piece = game.get(square);
    if (!piece) continue;
    const value = PIECE_VALUES[piece.type] || 0;
    score += piece.color === 'w' ? value : -value;
  }

  const mobility = game.moves().length;
  score += game.turn() === 'w' ? mobility * 2 : -mobility * 2;

  return score;
}

function minimax(game, depth, alpha, beta, maximizingPlayer) {
  if (depth === 0 || game.isGameOver()) {
    return { score: evaluateBoard(game), move: null };
  }

  const moves = game.moves({ verbose: true });

  if (maximizingPlayer) {
    let bestScore = -Infinity;
    let bestMove = null;

    for (const move of moves) {
      const next = cloneGame(game);
      next.move(move);
      const result = minimax(next, depth - 1, alpha, beta, false);

      if (result.score > bestScore) {
        bestScore = result.score;
        bestMove = move;
      }

      alpha = Math.max(alpha, result.score);
      if (beta <= alpha) break;
    }

    return { score: bestScore, move: bestMove };
  }

  let bestScore = Infinity;
  let bestMove = null;

  for (const move of moves) {
    const next = cloneGame(game);
    next.move(move);
    const result = minimax(next, depth - 1, alpha, beta, true);

    if (result.score < bestScore) {
      bestScore = result.score;
      bestMove = move;
    }

    beta = Math.min(beta, result.score);
    if (beta <= alpha) break;
  }

  return { score: bestScore, move: bestMove };
}

function pickAIMove(game, difficulty) {
  const legalMoves = game.moves({ verbose: true });
  if (!legalMoves.length) return null;

  if (difficulty === 'low') {
  const scoredMoves = legalMoves.map((move) => {
    const next = cloneGame(game);
    next.move(move);

    let score;

    // 直接看兩層，但加入一些雜訊，讓它不像中階那麼穩
    const result = minimax(next, 1, -Infinity, Infinity, true);
    score = result.score;

    // 避免太笨：吃子、將軍、升變給一點獎勵
    if (move.captured) score -= 90;
    if (move.san.includes('+')) score -= 70;
    if (move.promotion) score -= 120;

    // 加入少量隨機，保留低階感
    score += Math.random() * 120;

    return { move, score };
  });

  scoredMoves.sort((a, b) => a.score - b.score);

  // 80% 直接走最佳，20% 從前兩名挑一個
  if (Math.random() < 0.8) {
    return scoredMoves[0].move;
  }

  const candidatePool = scoredMoves.slice(0, Math.min(2, scoredMoves.length));
  return candidatePool[Math.floor(Math.random() * candidatePool.length)].move;
}

  if (difficulty === 'medium') {
    return minimax(game, 2, -Infinity, Infinity, false).move;
  }

  return minimax(game, 3, -Infinity, Infinity, false).move;
}

function getHintMove(game) {
  if (game.turn() !== 'w' || game.isGameOver()) return null;
  return minimax(game, 2, -Infinity, Infinity, true).move;
}

function getDrawReason(game) {
  if (game.isStalemate()) return '和棋：Stalemate';
  if (game.isInsufficientMaterial()) return '和棋：子力不足';
  if (game.isThreefoldRepetition()) return '和棋：三次重複局面';
  if (game.isDraw()) return '和棋';
  return null;
}

function statusText(game) {
  if (game.isCheckmate()) {
    return game.turn() === 'w' ? '白方被將死，黑方獲勝。' : '黑方被將死，白方獲勝。';
  }

  const drawReason = getDrawReason(game);
  if (drawReason) return drawReason;

  if (game.inCheck()) {
    return game.turn() === 'w' ? '警示：白方正在被將軍！' : '警示：黑方正在被將軍！';
  }

  return game.turn() === 'w' ? '輪到你（白方）' : '輪到 AI（黑方）';
}

function moveToText(move) {
  if (!move) return '目前沒有提示';
  return `${move.from} → ${move.to}${move.promotion ? `=${move.promotion}` : ''}`;
}

function createMoveLogEntry(move, side, gameAfterMove) {
  const actor = side === 'w' ? '玩家' : 'AI';
  let suffix = '';

  if (gameAfterMove.isCheckmate()) {
    suffix = '（Checkmate）';
  } else if (gameAfterMove.inCheck()) {
    suffix = '（Check）';
  } else if (gameAfterMove.isStalemate()) {
    suffix = '（Stalemate）';
  } else if (gameAfterMove.isDraw()) {
    suffix = '（Draw）';
  }

  return {
    id: `${Date.now()}-${Math.random()}`,
    side,
    actor,
    san: move.san,
    from: move.from,
    to: move.to,
    text: `${actor}：${move.san}（${move.from} → ${move.to}）${suffix}`,
  };
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#0f172a',
    padding: '16px',
    fontFamily:
      'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    color: '#e5e7eb',
  },
  layout: {
    maxWidth: '1220px',
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: '620px 1fr',
    gap: '16px',
    alignItems: 'start',
  },
  card: {
    background: '#111827',
    border: '1px solid #374151',
    borderRadius: '18px',
    boxShadow: '0 4px 18px rgba(0,0,0,0.25)',
  },
  cardHeader: {
    padding: '16px 16px 0 16px',
  },
  cardBody: {
  padding: '12px 24px 24px 24px',
},
  title: {
    fontSize: '24px',
    fontWeight: 700,
    margin: 0,
    color: '#f9fafb',
  },
  subTitle: {
    fontSize: '20px',
    fontWeight: 700,
    margin: 0,
    color: '#f9fafb',
  },
  board: {
  display: 'grid',
  gridTemplateColumns: 'repeat(8, 50px)',
  width: '400px',
  border: '1px solid #4b5563',
  borderRadius: '14px',
  overflow: 'hidden',
  marginLeft: '8px',
},
  square: {
  width: '50px',
  height: '50px',
  position: 'relative',
  border: 'none',
  cursor: 'pointer',
  fontSize: '34px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
},
  squareLabel: {
    position: 'absolute',
    left: '4px',
    top: '4px',
    fontSize: '9px',
    color: '#d1d5db',
  },
  dot: {
    position: 'absolute',
    width: '16px',
    height: '16px',
    borderRadius: '999px',
    background: 'rgba(96, 165, 250, 0.72)',
  },
  buttonRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    alignItems: 'center',
  },
  button: {
    border: '1px solid #4b5563',
    background: '#1f2937',
    color: '#f3f4f6',
    borderRadius: '10px',
    padding: '9px 12px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  primaryButton: {
    border: '1px solid #111827',
    background: '#2563eb',
    color: '#ffffff',
    borderRadius: '10px',
    padding: '9px 12px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  panel: {
    border: '1px solid #374151',
    borderRadius: '14px',
    padding: '14px',
    background: '#0b1220',
    color: '#f3f4f6',
  },
  panelTitle: {
    fontSize: '14px',
    fontWeight: 700,
    marginBottom: '8px',
    color: '#f9fafb',
  },
  badgeRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  badge: {
    display: 'inline-block',
    padding: '6px 10px',
    borderRadius: '999px',
    border: '1px solid #4b5563',
    fontSize: '13px',
    background: '#1f2937',
    color: '#f3f4f6',
  },
  select: {
    border: '1px solid #4b5563',
    borderRadius: '10px',
    padding: '9px 12px',
    fontSize: '14px',
    background: '#1f2937',
    color: '#f9fafb',
  },
  rightCol: {
    display: 'grid',
    gap: '16px',
  },
  logBox: {
    maxHeight: '360px',
    overflowY: 'auto',
    display: 'grid',
    gap: '8px',
    border: '1px solid #374151',
    borderRadius: '14px',
    padding: '10px',
    background: '#0b1220',
  },
  logItem: {
    border: '1px solid #374151',
    borderRadius: '10px',
    padding: '10px',
    fontSize: '14px',
    color: '#f3f4f6',
  },
startOverlay: {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
},

startCard: {
  width: '100%',
  maxWidth: '520px',
  background: '#111827',
  border: '1px solid #374151',
  borderRadius: '20px',
  boxShadow: '0 8px 30px rgba(0,0,0,0.32)',
  padding: '32px',
  textAlign: 'center',
},

startTitle: {
  fontSize: '36px',
  fontWeight: 800,
  marginBottom: '12px',
  color: '#f9fafb',
},

startText: {
  fontSize: '16px',
  color: '#d1d5db',
  marginBottom: '24px',
  lineHeight: 1.7,
},
};
export default function App() {
  const [gameStarted, setGameStarted] = useState(false);
const [startDifficulty, setStartDifficulty] = useState('medium');

const [game, setGame] = useState(() => new Chess());
const [selected, setSelected] = useState(null);
const [legalTargets, setLegalTargets] = useState([]);
const [difficulty, setDifficulty] = useState('medium');
const [hintMove, setHintMove] = useState(null);
const [lastMoveSquares, setLastMoveSquares] = useState(null);
const [aiThinking, setAiThinking] = useState(false);
const [message, setMessage] = useState('歡迎開始，玩家執白先走。');
const [moveLog, setMoveLog] = useState([]);
const [historyStack, setHistoryStack] = useState([]);

  const status = useMemo(() => statusText(game), [game]);

  function resetGame() {
  setGame(new Chess());
  setSelected(null);
  setLegalTargets([]);
  setHintMove(null);
  setLastMoveSquares(null);
  setMoveLog([]);
  setHistoryStack([]);
  setMessage('已重新開始新對局。');
}

function startGame() {
  setDifficulty(startDifficulty);
  setGame(new Chess());
  setSelected(null);
  setLegalTargets([]);
  setHintMove(null);
  setLastMoveSquares(null);
  setMoveLog([]);
  setHistoryStack([]);
  setMessage('歡迎開始，玩家執白先走。');
  setGameStarted(true);
}

  function snapshotState(currentGame, currentMoveLog, currentMessage, currentHintMove) {
    return {
      fen: currentGame.fen(),
      moveLog: currentMoveLog,
      message: currentMessage,
      hintMove: currentHintMove,
    };
  }

  function pushHistory(currentGame, currentMoveLog, currentMessage, currentHintMove) {
    setHistoryStack((prev) => [
      ...prev,
      snapshotState(currentGame, currentMoveLog, currentMessage, currentHintMove),
    ]);
  }

  function undoMove() {
    if (historyStack.length === 0) {
      setMessage('目前沒有可以悔棋的步數。');
      return;
    }

    const previous = historyStack[historyStack.length - 1];
    setHistoryStack((prev) => prev.slice(0, -1));
    setGame(new Chess(previous.fen));
    setMoveLog(previous.moveLog);
    setMessage('已悔棋，回到上一個玩家回合。');
    setHintMove(previous.hintMove || null);
    setSelected(null);
    setLegalTargets([]);
  }

  function runAIFromPosition(baseGame, currentMoveLog) {
  if (baseGame.turn() !== 'b' || baseGame.isGameOver()) {
    setGame(baseGame);
    setMoveLog(currentMoveLog);
    return;
  }

  setGame(baseGame);
  setMoveLog(currentMoveLog);
  setAiThinking(true);
  setMessage('AI 思考中...');

  setTimeout(() => {
    const aiMove = pickAIMove(baseGame, difficulty);

    if (!aiMove) {
      setAiThinking(false);
      setGame(baseGame);
      setMoveLog(currentMoveLog);
      return;
    }

    const afterAI = cloneGame(baseGame);
    const appliedAiMove = afterAI.move({
      from: aiMove.from,
      to: aiMove.to,
      promotion: aiMove.promotion || 'q',
    });

    const aiLogEntry = createMoveLogEntry(appliedAiMove, 'b', afterAI);
    const updatedLog = [...currentMoveLog, aiLogEntry];

    setGame(afterAI);
    setMoveLog(updatedLog);
    setLastMoveSquares({ from: appliedAiMove.from, to: appliedAiMove.to });
    setAiThinking(false);

    if (afterAI.isCheckmate()) {
      setMessage(`AI 下出 ${appliedAiMove.san}，將死！`);
    } else if (afterAI.inCheck()) {
      setMessage(`AI 下出 ${appliedAiMove.san}，你被將軍了！`);
    } else {
      const drawReason = getDrawReason(afterAI);
      if (drawReason) {
        setMessage(`AI 下出 ${appliedAiMove.san}，${drawReason}。`);
      } else {
        setMessage(`AI 下出 ${appliedAiMove.san}`);
      }
    }
  }, 900);
}

  function handleSquareClick(square) {
    if (game.isGameOver() || game.turn() !== 'w' || aiThinking) return;

    const piece = game.get(square);

    if (selected && legalTargets.includes(square)) {
      pushHistory(game, moveLog, message, hintMove);

      const next = cloneGame(game);
      const move = next.move({ from: selected, to: square, promotion: 'q' });

      if (move) {
  const playerLogEntry = createMoveLogEntry(move, 'w', next);
  const updatedLog = [...moveLog, playerLogEntry];

  setSelected(null);
  setLegalTargets([]);
  setHintMove(null);
  setLastMoveSquares({ from: move.from, to: move.to });

        if (next.isCheckmate()) {
          setGame(next);
          setMoveLog(updatedLog);
          setMessage(`你下出 ${move.san}，將死！`);
          return;
        }

        if (next.inCheck()) {
          setMessage(`你下出 ${move.san}，AI 被將軍。`);
        } else if (next.isDraw()) {
          setMessage(`你下出 ${move.san}，本局和棋。`);
        } else {
          setMessage(`你下出 ${move.san}`);
        }

        runAIFromPosition(next, updatedLog);
        return;
      }
    }

    if (piece && piece.color === 'w') {
      const moves = game.moves({ square, verbose: true }).map((move) => move.to);
      setSelected(square);
      setLegalTargets(moves);
      setMessage(`已選取 ${square}，顯示可移動範圍。`);
      return;
    }

    setSelected(null);
    setLegalTargets([]);
  }

  function handleHint() {
    const move = getHintMove(game);
    setHintMove(move);

    if (move) {
      setMessage(`提示：可以考慮 ${move.from} → ${move.to}`);
    } else {
      setMessage('目前沒有可提示的著法。');
    }
  }

  function playHintMove() {
    if (!hintMove || game.turn() !== 'w' || game.isGameOver()) return;

    pushHistory(game, moveLog, message, hintMove);

    const next = cloneGame(game);
    const move = next.move({ from: hintMove.from, to: hintMove.to, promotion: 'q' });
    if (!move) return;

    const playerLogEntry = createMoveLogEntry(move, 'w', next);
    const updatedLog = [...moveLog, playerLogEntry];

    setHintMove(null);
    setSelected(null);
    setLegalTargets([]);

    if (next.isCheckmate()) {
      setGame(next);
      setMoveLog(updatedLog);
      setMessage(`你採用了提示步 ${move.san}，將死！`);
      return;
    }

    if (next.inCheck()) {
  setMessage(`你採用了提示步 ${move.san}，AI 被將軍。`);
} else {
  const drawReason = getDrawReason(next);
  if (drawReason) {
    setMessage(`你採用了提示步 ${move.san}，${drawReason}。`);
  } else {
    setMessage(`你採用了提示步 ${move.san}`);
  }
}

    runAIFromPosition(next, updatedLog);
  }

if (!gameStarted) {
  return (
    <div style={styles.page}>
      <div style={styles.startOverlay}>
        <div style={styles.startCard}>
          <div style={styles.startTitle}>西洋棋對戰 AI</div>
          <div style={styles.startText}>
            先選擇難度，再按下「進入遊戲」開始對局。
          </div>

          <div style={{ marginBottom: '20px' }}>
            <div style={{ ...styles.panelTitle, marginBottom: '10px' }}>選擇難度</div>
            <select
              value={startDifficulty}
              onChange={(e) => setStartDifficulty(e.target.value)}
              style={{ ...styles.select, width: '220px' }}
            >
              <option value="low">低階（接近一年棋齡）</option>
              <option value="medium">中階</option>
              <option value="high">高階</option>
            </select>
          </div>

          <button style={styles.primaryButton} onClick={startGame}>
            進入遊戲
          </button>
        </div>
      </div>
    </div>
  );
}
  return (

    <div style={styles.page}>
      <div
 	 style={{
    		...styles.layout,
   	 gridTemplateColumns: '448px minmax(420px, 1fr)',
  	}}
	>
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h1 style={styles.title}>西洋棋對戰 AI</h1>
          </div>
          <div style={styles.cardBody}>
            <div style={styles.board}>
              {RANKS.map((rank, rankIndex) =>
                FILES.map((file, fileIndex) => {
                  const square = `${file}${rank}`;
                  const piece = game.get(square);
                  const pieceKey = getPieceKey(piece);
                  const isSelected = selected === square;
const isLegal = legalTargets.includes(square);
const isHintFrom = hintMove?.from === square;
const isHintTo = hintMove?.to === square;
const isLastFrom = lastMoveSquares?.from === square;
const isLastTo = lastMoveSquares?.to === square;
                  const isCheckSquare =
                    piece &&
                    piece.type === 'k' &&
                    game.inCheck() &&
                    piece.color === game.turn();

                  return (
                    <button
                      key={square}
                      onClick={() => handleSquareClick(square)}
                      style={{
                        ...styles.square,
                        background: squareColor(fileIndex, rankIndex),
                        outline: isSelected
                          ? '4px solid #60a5fa'
                          : isCheckSquare
                          ? '4px solid #ef4444'
                          : 'none',
                        outlineOffset: '-4px',
                      }}
                    >
                      <span style={styles.squareLabel}>{square}</span>
{isLastFrom && (
  <span
    style={{
      position: 'absolute',
      inset: '3px',
      borderRadius: '10px',
      border: '3px solid rgba(251, 191, 36, 0.9)',
      zIndex: 1,
    }}
  />
)}

{isLastTo && (
  <span
    style={{
      position: 'absolute',
      inset: '3px',
      borderRadius: '10px',
      background: 'rgba(251, 191, 36, 0.28)',
      border: '3px solid rgba(245, 158, 11, 0.95)',
      zIndex: 1,
    }}
  />
)}

                      {isLegal && <span style={styles.dot} />}

                      {isHintFrom && (
                        <span
                          style={{
                            position: 'absolute',
                            inset: '4px',
                            borderRadius: '12px',
                            border: '4px solid #fbbf24',
                          }}
                        />
                      )}

                      {isHintTo && (
                        <span
                          style={{
                            position: 'absolute',
                            inset: '8px',
                            borderRadius: '999px',
                            border: '4px solid #f59e0b',
                          }}
                        />
                      )}

                      <motion.span
  key={`${square}-${pieceKey || 'empty'}`}
  initial={{ scale: 0.8, opacity: 0.5 }}
  animate={{ scale: 1, opacity: 1 }}
  transition={{ duration: 0.15 }}
  style={{
  position: 'relative',
  zIndex: 2,
  color: piece?.color === 'w' ? '#ffffff' : '#111111',
  fontWeight: piece?.color === 'w' ? 900 : 700,
  WebkitTextStroke: piece?.color === 'w' ? '1.2px #ffffff' : '0px transparent',
  textShadow:
    piece?.color === 'w'
      ? '0 0 1px #ffffff, 0 0 2px #ffffff, 0 1px 2px rgba(0,0,0,0.6)'
      : '0 1px 1px rgba(255,255,255,0.12)',
}}
>
  {pieceKey ? PIECES[pieceKey] : ''}
</motion.span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div style={styles.rightCol}>
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h2 style={styles.subTitle}>控制面板</h2>
            </div>
            <div style={styles.cardBody}>
              <div style={{ display: 'grid', gap: '16px' }}>
                <div>
                  <div style={{ ...styles.panelTitle, marginBottom: '10px' }}>AI 難度</div>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    style={styles.select}
                  >
                    <option value="low">低階（接近一年棋齡）</option>
                    <option value="medium">中階</option>
                    <option value="high">高階</option>
                  </select>
                </div>

                <div style={styles.buttonRow}>
                  <button style={styles.primaryButton} onClick={resetGame}>
                    重新開始
                  </button>
                  <button style={styles.button} onClick={handleHint}>
                    提示一步
                  </button>
                  <button style={styles.button} onClick={undoMove}>
                    悔棋
                  </button>
                </div>

                <div style={styles.badgeRow}>
                  <span style={styles.badge}>玩家：白方</span>
                  <span style={styles.badge}>AI：黑方</span>
                  <span style={styles.badge}>目前難度：{difficulty}</span>
                </div>

                <div style={styles.panel}>
                  <div style={styles.panelTitle}>狀態</div>
                  <div>{status}</div>
                </div>

                <div style={styles.panel}>
                  <div style={styles.panelTitle}>系統訊息</div>
                  <div>{message}</div>
                </div>

                <div style={styles.panel}>
                  <div style={styles.panelTitle}>提示功能</div>
                  <div>建議著法：{moveToText(hintMove)}</div>
                  <div style={{ marginTop: '12px' }}>
                    <button
                      style={{
                        ...styles.button,
                        opacity: hintMove ? 1 : 0.5,
                        cursor: hintMove ? 'pointer' : 'not-allowed',
                      }}
                      onClick={playHintMove}
                      disabled={!hintMove}
                    >
                      採用提示步
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h2 style={styles.subTitle}>對戰 Log</h2>
            </div>
            <div style={styles.cardBody}>
              <div style={styles.logBox}>
                {moveLog.length === 0 ? (
                  <div style={{ fontSize: '14px', color: '#71717a' }}>尚未開始走子。</div>
                ) : (
                  moveLog.map((entry, index) => (
                    <div
                      key={entry.id}
                      style={{
                        ...styles.logItem,
                        background: entry.side === 'w' ? '#eff6ff' : '#fafafa',
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>
                        #{index + 1} {entry.actor}
                      </div>
                      <div style={{ marginTop: '6px', color: '#374151' }}>{entry.text}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
