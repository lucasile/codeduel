const { v4: uuidv4 } = require('uuid');

// Generate 4-digit alphanumeric game code
function generateGameCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// In-memory game state (will move to database later)
const games = new Map();
const players = new Map();

class GameSession {
  constructor(id) {
    this.id = id;
    this.players = [];
    this.currentRound = 0;
    this.maxRounds = 7;
    this.currentPhase = 'waiting'; // waiting, bug_introduction, debugging, validation, finished
    this.currentBugIntroducer = null;
    this.currentDebugger = null;
    this.timeLeft = 180; // 3 minutes in seconds
    this.timer = null;
    this.scores = { player1: 0, player2: 0 };
    this.powerUps = {
      player1: { lineCorruption: 3, timeFreeze: 2 },
      player2: { lineCorruption: 3, timeFreeze: 2 }
    };
    this.currentProblem = null;
    this.currentSolution = '';
    this.buggyCode = '';
    this.testCases = [];
    this.createdAt = new Date();
  }

  addPlayer(playerId, playerName) {
    if (this.players.length < 2) {
      this.players.push({ id: playerId, name: playerName });
      return true;
    }
    return false;
  }

  removePlayer(playerId) {
    this.players = this.players.filter(p => p.id !== playerId);
  }

  isFull() {
    return this.players.length === 2;
  }

  startRound() {
    this.currentRound++;
    this.currentPhase = 'bug_introduction';
    this.timeLeft = 180;
    
    // Alternate who introduces bugs
    const introducerIndex = (this.currentRound - 1) % 2;
    this.currentBugIntroducer = this.players[introducerIndex].id;
    this.currentDebugger = this.players[1 - introducerIndex].id;
  }

  switchPhase(newPhase) {
    this.currentPhase = newPhase;
    if (newPhase === 'debugging') {
      this.timeLeft = 180; // Reset timer for debugging phase
    }
  }
}

function initializeSocket(io) {
  io.on('connection', (socket) => {
    console.log(`🔌 Player connected: ${socket.id}`);

    // Player joins a game
    socket.on('join_game', ({ playerName, gameId }) => {
      let game;
      
      if (gameId && games.has(gameId)) {
        // Join existing game
        game = games.get(gameId);
        console.log(`Player ${playerName} trying to join existing game ${gameId}`);
      } else {
        // Create new game with 4-digit code
        let newGameId;
        do {
          newGameId = generateGameCode();
        } while (games.has(newGameId)); // Ensure unique code
        
        gameId = newGameId;
        game = new GameSession(gameId);
        games.set(gameId, game);
        console.log(`Created new game with ID: ${gameId}`);
      }

      if (game.addPlayer(socket.id, playerName)) {
        socket.join(gameId);
        players.set(socket.id, { gameId, playerName });
        
        console.log(`Player ${playerName} (${socket.id}) successfully joined game ${gameId}. Total players: ${game.players.length}`);

        socket.emit('game_joined', {
          gameId,
          playerId: socket.id,
          playerName,
          players: game.players
        });

        // Notify other players
        socket.to(gameId).emit('player_joined', {
          playerId: socket.id,
          playerName,
          players: game.players
        });

        // Start game if we have 2 players
        if (game.isFull()) {
          console.log(`Game ${gameId} is full, starting game...`);
          game.startRound();
          io.to(gameId).emit('game_started', {
            currentRound: game.currentRound,
            maxRounds: game.maxRounds,
            currentPhase: game.currentPhase,
            bugIntroducer: game.currentBugIntroducer,
            debugger: game.currentDebugger,
            timeLeft: game.timeLeft
          });
        }
      } else {
        console.log(`Failed to add player ${playerName} to game ${gameId} - game is full`);
        socket.emit('join_error', { message: 'Game is full' });
      }
    });

    // Handle manual problem submission (MVP)
    socket.on('submit_problem', ({ gameId, problem, solution, testCases }) => {
      const game = games.get(gameId);
      if (!game) return;

      game.currentProblem = problem;
      game.currentSolution = solution;
      game.testCases = testCases;

      io.to(gameId).emit('problem_ready', {
        problem,
        solution,
        testCases: testCases.length // Don't send actual test cases to prevent cheating
      });
    });

    // Handle bug introduction
    socket.on('introduce_bug', ({ gameId, buggyCode, lineNumber }) => {
      const game = games.get(gameId);
      if (!game || game.currentBugIntroducer !== socket.id) return;

      game.buggyCode = buggyCode;
      game.switchPhase('debugging');

      // Send buggy code to debugger only
      socket.to(gameId).emit('debugging_phase', {
        buggyCode,
        timeLeft: game.timeLeft,
        debugger: game.currentDebugger
      });

      socket.emit('bug_introduced', {
        phase: 'debugging',
        timeLeft: game.timeLeft
      });
    });

    // Handle bug fix submission
    socket.on('submit_fix', ({ gameId, fixedCode, foundBugLine }) => {
      const game = games.get(gameId);
      if (!game || game.currentDebugger !== socket.id) return;

      // In MVP, we'll do basic validation
      // Later this will run against test cases via Judge0
      const isCorrect = fixedCode.length > 0; // Simplified validation

      if (isCorrect) {
        // Award points to debugger
        const debuggerIndex = game.players.findIndex(p => p.id === socket.id);
        const playerKey = debuggerIndex === 0 ? 'player1' : 'player2';
        game.scores[playerKey] += 100; // Base points for successful debug
      } else {
        // Award points to bug introducer
        const introducerIndex = game.players.findIndex(p => p.id === game.currentBugIntroducer);
        const playerKey = introducerIndex === 0 ? 'player1' : 'player2';
        game.scores[playerKey] += 50;
      }

      io.to(gameId).emit('round_complete', {
        isCorrect,
        fixedCode,
        foundBugLine,
        scores: game.scores,
        currentRound: game.currentRound,
        maxRounds: game.maxRounds
      });

      // Check if game is over
      if (game.currentRound >= game.maxRounds) {
        const winner = game.scores.player1 > game.scores.player2 ? 
          game.players[0] : game.players[1];
        
        io.to(gameId).emit('game_over', {
          winner,
          finalScores: game.scores
        });
        
        games.delete(gameId);
      } else {
        // Start next round
        setTimeout(() => {
          game.startRound();
          io.to(gameId).emit('new_round', {
            currentRound: game.currentRound,
            bugIntroducer: game.currentBugIntroducer,
            debugger: game.currentDebugger,
            phase: game.currentPhase,
            timeLeft: game.timeLeft
          });
        }, 3000); // 3 second break between rounds
      }
    });

    // Handle power-up usage
    socket.on('use_powerup', ({ gameId, powerUpType }) => {
      const game = games.get(gameId);
      if (!game) return;

      const playerIndex = game.players.findIndex(p => p.id === socket.id);
      const playerKey = playerIndex === 0 ? 'player1' : 'player2';

      if (game.powerUps[playerKey][powerUpType] > 0) {
        game.powerUps[playerKey][powerUpType]--;

        if (powerUpType === 'timeFreeze') {
          // Pause timer for 15 seconds
          game.timeLeft += 15;
        }

        io.to(gameId).emit('powerup_used', {
          playerId: socket.id,
          powerUpType,
          remainingUses: game.powerUps[playerKey][powerUpType],
          timeLeft: game.timeLeft
        });
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`🔌 Player disconnected: ${socket.id}`);
      
      const playerData = players.get(socket.id);
      if (playerData) {
        const game = games.get(playerData.gameId);
        if (game) {
          game.removePlayer(socket.id);
          socket.to(playerData.gameId).emit('player_disconnected', {
            playerId: socket.id,
            playerName: playerData.playerName
          });

          // Clean up empty games
          if (game.players.length === 0) {
            games.delete(playerData.gameId);
          }
        }
        players.delete(socket.id);
      }
    });
  });
}

module.exports = { initializeSocket };
