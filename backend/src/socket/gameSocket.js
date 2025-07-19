const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

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

// Function to fetch problem from the API
async function fetchLeetCodeProblem() {
  try {
    const baseUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    const response = await axios.get(`${baseUrl}/api/game/problem/random`);
    
    if (response.data.success && response.data.problem) {
      const problem = response.data.problem;
      
      // Get the Python solution template
      const solutionResponse = await axios.get(
        `${baseUrl}/api/game/problem/${problem.titleSlug}/solution?language=python3`
      );
      
      return {
        problem,
        solution: solutionResponse.data.solution || '',
        testCaseCount: response.data.testCaseCount || 5
      };
    }
    
    throw new Error('Failed to fetch problem from API');
  } catch (error) {
    console.error('Error fetching LeetCode problem:', error.message);
    // Return a fallback problem if API fails
    return getFallbackProblem();
  }
}

// Fallback problem in case API fails
function getFallbackProblem() {
  return {
    problem: {
      id: 1,
      title: "Two Sum",
      titleSlug: "two-sum",
      difficulty: "Easy",
      description: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target. You may assume that each input would have exactly one solution, and you may not use the same element twice.",
      examples: [
        {
          input: "nums = [2,7,11,15], target = 9",
          output: "[0,1]",
          explanation: "Because nums[0] + nums[1] == 9, we return [0, 1]."
        },
        {
          input: "nums = [3,2,4], target = 6",
          output: "[1,2]"
        }
      ],
      constraints: [
        "2 <= nums.length <= 10^4",
        "-10^9 <= nums[i] <= 10^9",
        "-10^9 <= target <= 10^9",
        "Only one valid answer exists."
      ],
      topicTags: ["Array", "Hash Table"]
    },
    solution: `class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        # Your solution here
        pass`,
    testCaseCount: 5
  };
}

// Function to fetch and send a problem to the game
async function fetchAndSendProblem(gameId, io) {
  const game = games.get(gameId);
  if (!game) return;
  
  try {
    // Fetch problem from LeetCode API
    const { problem, solution, testCaseCount } = await fetchLeetCodeProblem();
    
    // Store in game state
    game.currentProblem = problem;
    game.currentSolution = solution;
    game.testCaseCount = testCaseCount;
    
    console.log(`📚 Sending LeetCode problem "${problem.title}" to game ${gameId}`);
    
    // Send to all players
    io.to(gameId).emit('problem_ready', {
      problem,
      solution,
      testCases: testCaseCount
    });
  } catch (error) {
    console.error(`Failed to fetch problem for game ${gameId}:`, error);
    // Send error to players
    io.to(gameId).emit('error', {
      message: 'Failed to fetch problem. Please try again.'
    });
  }
}

class GameSession {
  constructor(id) {
    this.id = id;
    this.players = [];
    this.currentRound = 0;
    this.maxRounds = 3;
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
    this.testCaseCount = 0;
    this.createdAt = new Date();
    this.io = null; // Will be set when timer starts
  }
  
  startTimer(io) {
    this.io = io;
    this.clearTimer(); // Clear any existing timer
    
    this.timer = setInterval(() => {
      this.timeLeft--;
      
      // Broadcast time update to all players in the game
      io.to(this.id).emit('timer_update', {
        timeLeft: this.timeLeft,
        phase: this.currentPhase
      });
      
      // Handle time up
      if (this.timeLeft <= 0) {
        this.handleTimeUp(io);
      }
    }, 1000);
  }
  
  clearTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
  
  handleTimeUp(io) {
    this.clearTimer();
    console.log(`⏰ Time up for game ${this.id} in phase ${this.currentPhase}`);
    
    if (this.currentPhase === 'debugging') {
      // Debugger failed to find the bug in time
      // Award points to bug introducer
      const introducerIndex = this.players.findIndex(p => p.id === this.currentBugIntroducer);
      const playerKey = introducerIndex === 0 ? 'player1' : 'player2';
      this.scores[playerKey] += 50;
      
      io.to(this.id).emit('round_complete', {
        isCorrect: false,
        timeUp: true,
        scores: this.scores,
        currentRound: this.currentRound,
        maxRounds: this.maxRounds
      });
      
      // Check if game is over or start next round
      this.checkGameEnd(io);
    }
  }
  
  checkGameEnd(io) {
    if (this.currentRound >= this.maxRounds) {
      const winner = this.scores.player1 > this.scores.player2 ? 
        this.players[0] : this.players[1];
      
      io.to(this.id).emit('game_over', {
        winner,
        finalScores: this.scores
      });
      
      games.delete(this.id);
    } else {
      // Start next round
      setTimeout(() => {
        this.startRound();
        io.to(this.id).emit('new_round', {
          currentRound: this.currentRound,
          bugIntroducer: this.currentBugIntroducer,
          debugger: this.currentDebugger,
          phase: this.currentPhase,
          timeLeft: this.timeLeft
        });
        
        // Fetch a fresh problem for the new round
        fetchAndSendProblem(this.id, io);
      }, 3000); // 3 second break between rounds
    }
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
    
    // Clear previous problem data for fresh start
    this.currentProblem = null;
    this.currentSolution = '';
    this.buggyCode = '';
    this.testCaseCount = 0;
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
        console.log(`🎮 Created new game with ID: ${gameId}`);
      }

      if (game.addPlayer(socket.id, playerName)) {
        socket.join(gameId);
        players.set(socket.id, { gameId, playerName });
        
        console.log(`✅ Player ${playerName} (${socket.id}) joined game ${gameId}. Total players: ${game.players.length}`);

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
          console.log(`🎮 Game ${gameId} is full, starting game...`);
          game.startRound();
          io.to(gameId).emit('game_started', {
            currentRound: game.currentRound,
            maxRounds: game.maxRounds,
            currentPhase: game.currentPhase,
            bugIntroducer: game.currentBugIntroducer,
            debugger: game.currentDebugger,
            timeLeft: game.timeLeft
          });
          
          // Auto-fetch a fresh problem from LeetCode
          fetchAndSendProblem(gameId, io);
        }
      } else {
        console.log(`❌ Failed to add player ${playerName} to game ${gameId} - game is full`);
        socket.emit('join_error', { message: 'Game is full' });
      }
    });

    // Handle request for current game state
    socket.on('get_game_state', ({ gameId }) => {
      const game = games.get(gameId);
      if (!game) {
        socket.emit('join_error', { message: 'Game not found' });
        return;
      }

      const playerData = players.get(socket.id);
      if (!playerData) {
        console.log(`Player ${socket.id} not found in players map`);
        return;
      }

      console.log(`📊 Sending current game state to ${playerData.playerName} for game ${gameId}`);
      
      // Send game_joined event to initialize the frontend state
      socket.emit('game_joined', {
        gameId,
        playerId: socket.id,
        playerName: playerData.playerName,
        players: game.players
      });

      // If game is already started, send game_started event
      if (game.isFull() && game.currentRound > 0) {
        socket.emit('game_started', {
          currentRound: game.currentRound,
          maxRounds: game.maxRounds,
          currentPhase: game.currentPhase,
          bugIntroducer: game.currentBugIntroducer,
          debugger: game.currentDebugger,
          timeLeft: game.timeLeft
        });
        
        // Also send the current problem if available
        if (game.currentProblem) {
          socket.emit('problem_ready', {
            problem: game.currentProblem,
            solution: game.currentSolution,
            testCases: game.testCaseCount
          });
        }
      }
    });

    // Handle bug introduction
    socket.on('introduce_bug', (data) => {
      const { gameId, buggyCode, lineNumber, editedLines } = data;
      const game = games.get(gameId);
      
      if (!game || game.currentPhase !== 'bug_introduction') {
        socket.emit('error', { message: 'Cannot introduce bug at this time' });
        return;
      }
      
      // Verify it's the bug introducer's turn
      if (game.currentBugIntroducer !== socket.id) {
        socket.emit('error', { message: 'Not your turn to introduce bugs' });
        return;
      }
      
      // Validate line edit constraints (backend validation)
      if (!editedLines || editedLines.length === 0) {
        socket.emit('error', { message: 'You must edit at least one line to introduce a bug!' });
        return;
      }
      
      if (editedLines.length > 2) {
        socket.emit('error', { message: 'You can only edit up to 2 lines at a time!' });
        return;
      }
      
      // Store the buggy code and start debugging phase
      game.buggyCode = buggyCode;
      game.bugLine = lineNumber;
      game.editedLines = editedLines;
      game.currentPhase = 'debugging';
      game.timeLeft = 180; // 3 minutes for debugging
      game.startTimer(io);
      
      console.log(`🐛 Bug introduced in game ${gameId} on ${editedLines.length} line(s):`, editedLines);
      
      // Notify all players
      io.to(gameId).emit('bug_introduced', {
        buggyCode,
        lineNumber,
        editedLines,
        phase: 'debugging',
        timeLeft: game.timeLeft,
        debugger: game.currentDebugger
      });
    });

    // Handle bug fix submission
    socket.on('submit_fix', async ({ gameId, fixedCode, foundBugLine }) => {
      const game = games.get(gameId);
      if (!game || game.currentDebugger !== socket.id) return;

      // Stop the timer when fix is submitted
      game.clearTimer();
      console.log(`⏹️ Timer stopped for game ${gameId} - fix submitted`);

      try {
        // Validate the fix using the API
        const baseUrl = process.env.BACKEND_URL || 'http://localhost:5000';
        const response = await axios.post(`${baseUrl}/api/game/validate`, {
          code: fixedCode,
          problemId: game.currentProblem.id,
          titleSlug: game.currentProblem.titleSlug,
          language: 'python3'
        });

        const isCorrect = response.data.success && response.data.allPassed;

        if (isCorrect) {
          // Award points to debugger
          const debuggerIndex = game.players.findIndex(p => p.id === socket.id);
          const playerKey = debuggerIndex === 0 ? 'player1' : 'player2';
          game.scores[playerKey] += 100; // Base points for successful debug
          
          // Bonus points for speed
          const timeBonus = Math.floor((180 - (180 - game.timeLeft)) / 10) * 5;
          game.scores[playerKey] += timeBonus;
          
          console.log(`✅ Debugger fixed the bug! Awarded ${100 + timeBonus} points`);
        } else {
          // Award points to bug introducer
          const introducerIndex = game.players.findIndex(p => p.id === game.currentBugIntroducer);
          const playerKey = introducerIndex === 0 ? 'player1' : 'player2';
          game.scores[playerKey] += 50;
          
          console.log(`❌ Debugger failed! Bug introducer gets 50 points`);
        }

        io.to(gameId).emit('round_complete', {
          isCorrect,
          fixedCode,
          foundBugLine,
          scores: game.scores,
          currentRound: game.currentRound,
          maxRounds: game.maxRounds,
          testResults: response.data.results || []
        });

        // Check if game is over
        game.checkGameEnd(io);
      } catch (error) {
        console.error('Error validating fix:', error);
        // Treat as incorrect if validation fails
        const introducerIndex = game.players.findIndex(p => p.id === game.currentBugIntroducer);
        const playerKey = introducerIndex === 0 ? 'player1' : 'player2';
        game.scores[playerKey] += 50;

        io.to(gameId).emit('round_complete', {
          isCorrect: false,
          fixedCode,
          foundBugLine,
          scores: game.scores,
          currentRound: game.currentRound,
          maxRounds: game.maxRounds,
          error: 'Validation failed'
        });

        game.checkGameEnd(io);
      }
    });

    // Handle power-up usage
    socket.on('use_powerup', ({ gameId, powerUpType, targetData }) => {
      const game = games.get(gameId);
      if (!game) return;

      const playerIndex = game.players.findIndex(p => p.id === socket.id);
      const playerKey = playerIndex === 0 ? 'player1' : 'player2';

      if (game.powerUps[playerKey][powerUpType] > 0) {
        game.powerUps[playerKey][powerUpType]--;

        let powerUpEffect = {};

        if (powerUpType === 'timeFreeze') {
          // Pause timer for 15 seconds
          const previousTimeLeft = game.timeLeft;
          game.clearTimer();
          
          setTimeout(() => {
            if (game.currentPhase === 'debugging') {
              game.startTimer(io);
            }
          }, 15000);
          
          powerUpEffect = { timeFrozen: true, duration: 15 };
          console.log(`🧊 Time freeze activated by ${playerKey}`);
        } else if (powerUpType === 'lineCorruption' && targetData) {
          // Corrupt a specific line
          powerUpEffect = { 
            corruptedLine: targetData.lineNumber,
            corruptedText: targetData.corruptedText 
          };
          console.log(`💥 Line corruption activated by ${playerKey} on line ${targetData.lineNumber}`);
        }

        io.to(gameId).emit('powerup_used', {
          playerId: socket.id,
          powerUpType,
          remainingUses: game.powerUps[playerKey][powerUpType],
          timeLeft: game.timeLeft,
          effect: powerUpEffect
        });
      }
    });

    // Handle request for new problem (admin/debug feature)
    socket.on('request_new_problem', async ({ gameId }) => {
      const game = games.get(gameId);
      if (!game) return;

      console.log(`🔄 New problem requested for game ${gameId}`);
      await fetchAndSendProblem(gameId, io);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`🔌 Player disconnected: ${socket.id}`);
      
      const playerData = players.get(socket.id);
      if (playerData) {
        const game = games.get(playerData.gameId);
        if (game) {
          // Clear timer if game was active
          game.clearTimer();
          
          game.removePlayer(socket.id);
          socket.to(playerData.gameId).emit('player_disconnected', {
            playerId: socket.id,
            playerName: playerData.playerName
          });

          // Clean up empty games
          if (game.players.length === 0) {
            games.delete(playerData.gameId);
            console.log(`🗑️ Deleted empty game ${playerData.gameId}`);
          } else {
            // Pause game if player disconnected mid-game
            if (game.currentPhase !== 'waiting') {
              game.currentPhase = 'paused';
              io.to(playerData.gameId).emit('game_paused', {
                reason: 'Player disconnected',
                waitingFor: playerData.playerName
              });
            }
          }
        }
        players.delete(socket.id);
      }
    });

    // Handle reconnection attempt
    socket.on('reconnect_game', ({ gameId, playerName }) => {
      const game = games.get(gameId);
      if (!game) {
        socket.emit('reconnect_failed', { message: 'Game not found' });
        return;
      }

      // Check if player was previously in the game
      const wasInGame = game.players.some(p => p.name === playerName);
      
      if (wasInGame && game.players.length < 2) {
        // Allow reconnection
        game.addPlayer(socket.id, playerName);
        socket.join(gameId);
        players.set(socket.id, { gameId, playerName });

        console.log(`🔄 Player ${playerName} reconnected to game ${gameId}`);

        socket.emit('reconnect_success', {
          gameId,
          playerId: socket.id,
          playerName,
          gameState: {
            players: game.players,
            currentRound: game.currentRound,
            currentPhase: game.currentPhase,
            scores: game.scores,
            timeLeft: game.timeLeft
          }
        });

        // Resume game if it was paused
        if (game.currentPhase === 'paused' && game.isFull()) {
          game.currentPhase = game.previousPhase || 'waiting';
          io.to(gameId).emit('game_resumed');
          
          if (game.currentPhase === 'debugging') {
            game.startTimer(io);
          }
        }
      } else {
        socket.emit('reconnect_failed', { 
          message: wasInGame ? 'Game is full' : 'You were not in this game' 
        });
      }
    });

    // Admin/Debug commands
    socket.on('admin_command', ({ command, gameId, data }) => {
      if (process.env.NODE_ENV !== 'development') return;

      const game = games.get(gameId);
      if (!game) return;

      switch (command) {
        case 'skip_round':
          console.log(`⏭️ Admin: Skipping round in game ${gameId}`);
          game.checkGameEnd(io);
          break;
        case 'add_time':
          game.timeLeft += data.seconds || 60;
          console.log(`⏰ Admin: Added ${data.seconds || 60} seconds to game ${gameId}`);
          io.to(gameId).emit('timer_update', { timeLeft: game.timeLeft });
          break;
        case 'set_scores':
          game.scores = data.scores;
          console.log(`📊 Admin: Updated scores in game ${gameId}`, data.scores);
          io.to(gameId).emit('scores_updated', { scores: game.scores });
          break;
      }
    });
  });

  // Cleanup old games periodically
  setInterval(() => {
    const now = Date.now();
    const MAX_GAME_AGE = 2 * 60 * 60 * 1000; // 2 hours

    for (const [gameId, game] of games.entries()) {
      if (now - game.createdAt.getTime() > MAX_GAME_AGE) {
        console.log(`🧹 Cleaning up old game ${gameId}`);
        game.clearTimer();
        games.delete(gameId);
      }
    }
  }, 30 * 60 * 1000); // Run every 30 minutes
}

module.exports = { initializeSocket };