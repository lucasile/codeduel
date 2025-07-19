const { v4: uuidv4 } = require('uuid');

// Note: Using built-in fetch (Node.js 18+)
// If using older Node.js version, you may need to polyfill fetch

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

// Import sample data from routes
const sampleProblems = [
  {
    id: 1,
    title: "Two Sum",
    difficulty: "Easy",
    description: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
    examples: [{ input: "nums = [2,7,11,15], target = 9", output: "[0,1]", explanation: "Because nums[0] + nums[1] == 9, we return [0, 1]." }],
    constraints: ["2 <= nums.length <= 10^4", "-10^9 <= nums[i] <= 10^9", "-10^9 <= target <= 10^9", "Only one valid answer exists."]
  },
  {
    id: 2,
    title: "Reverse Integer",
    difficulty: "Medium",
    description: "Given a signed 32-bit integer x, return x with its digits reversed. If reversing x causes the value to go outside the signed 32-bit integer range [-2^31, 2^31 - 1], then return 0.",
    examples: [{ input: "x = 123", output: "321" }, { input: "x = -123", output: "-321" }],
    constraints: ["-2^31 <= x <= 2^31 - 1"]
  },
  {
    id: 3,
    title: "Valid Parentheses",
    difficulty: "Easy",
    description: "Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.",
    examples: [{ input: 's = "()"', output: "true" }, { input: 's = "()[]{}"', output: "true" }, { input: 's = "(]"', output: "false" }],
    constraints: ["1 <= s.length <= 10^4", "s consists of parentheses only '()[]{}'."]
  }
];

const sampleSolutions = {
  1: {
    python: `def twoSum(nums, target):
    num_map = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in num_map:
            return [num_map[complement], i]
        num_map[num] = i
    return []`
  },
  2: {
    python: `def reverse(x):
    sign = -1 if x < 0 else 1
    x = abs(x)
    result = 0
    while x:
        result = result * 10 + x % 10
        x //= 10
    result *= sign
    return result if -2**31 <= result <= 2**31 - 1 else 0`
  },
  3: {
    python: `def isValid(s):
    stack = []
    mapping = {')': '(', '}': '{', ']': '['}
    for char in s:
        if char in mapping:
            if not stack or stack.pop() != mapping[char]:
                return False
        else:
            stack.append(char)
    return not stack`
  }
};

const sampleTestCases = {
  1: [{ input: [[2, 7, 11, 15], 9], expected: [0, 1] }, { input: [[3, 2, 4], 6], expected: [1, 2] }],
  2: [{ input: [123], expected: 321 }, { input: [-123], expected: -321 }, { input: [120], expected: 21 }],
  3: [{ input: ["()"], expected: true }, { input: ["()[]{}"], expected: true }, { input: ["(]"], expected: false }]
};

// Function to fetch and send a random problem to the game (with premium problem retry)
async function fetchAndSendProblem(gameId, io, maxRetries = 5) {
  const game = games.get(gameId);
  if (!game) return;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🎲 Fetching random LeetCode problem for game ${gameId}... (Attempt ${attempt}/${maxRetries})`);
      
      // Step 1: Get random problem ID
      const randomResponse = await fetch('https://leetcode-api-pied.vercel.app/random');
      if (!randomResponse.ok) {
        throw new Error(`LeetCode API random error: ${randomResponse.status}`);
      }
      
      const randomProblem = await randomResponse.json();
      const problemId = randomProblem.frontend_id; // Use frontend_id for LeetCode API
      
      console.log(`🎯 Got random problem - Internal ID: ${randomProblem.id}, LeetCode ID: ${problemId} - "${randomProblem.title}"`);
      
      // Check if it's a premium problem from the random response
      if (randomProblem.isPaidOnly) {
        console.log(`💰 Skipping premium problem: "${randomProblem.title}" - trying another...`);
        continue; // Try again with a different problem
      }
      
      // Step 2: Get full problem details using the frontend_id (LeetCode ID)
      console.log(`🔍 Fetching problem details for LeetCode ID: ${problemId}`);
      const problemResponse = await fetch(`https://leetcode-api-pied.vercel.app/problem/${problemId}`);
      console.log(`🔍 Problem API response status: ${problemResponse.status}`);
      
      if (!problemResponse.ok) {
        console.log(`❌ Problem API failed with status: ${problemResponse.status}`);
        throw new Error(`LeetCode API problem error: ${problemResponse.status}`);
      }
      
      console.log(`🔍 Parsing problem response JSON...`);
      const problemData = await problemResponse.json();
      console.log(`🔍 Problem data keys:`, Object.keys(problemData));
      
      // The API response might have different structure, let's handle both cases
      const leetcodeProblem = problemData.question || problemData;
      
      if (!leetcodeProblem) {
        throw new Error('No problem data found in API response');
      }
      
      // Check if content is null/empty (another indicator of premium problems)
      if (!leetcodeProblem.content || leetcodeProblem.content.trim() === '') {
        console.log(`💰 Problem has no content (likely premium): "${randomProblem.title}" - trying another...`);
        continue; // Try again with a different problem
      }
    
      // Transform LeetCode API response to our format
      const problem = {
        id: leetcodeProblem.questionId || leetcodeProblem.id,
        frontend_id: leetcodeProblem.questionFrontendId || leetcodeProblem.frontend_id,
        title: leetcodeProblem.title,
        title_slug: leetcodeProblem.titleSlug || leetcodeProblem.title_slug,
        difficulty: leetcodeProblem.difficulty,
        description: leetcodeProblem.content || leetcodeProblem.description,
        examples: [], // Will be parsed from content if needed
        constraints: [] // Will be parsed from content if needed
      };
      
      // For now, use placeholder solution as requested
      const solution = "# Sample solution\n# TODO: Integrate with Vellum API for real solutions\ndef solution():\n    pass";
      
      // Generate basic test cases (placeholder for now)
      const testCases = [
        { input: "example input", expectedOutput: "example output" },
        { input: "test case 2", expectedOutput: "expected result 2" }
      ];
      
      console.log(`✅ Fetched LeetCode problem: "${problem.title}" (${problem.difficulty})`);
      
      // Send problem to all players
      io.to(gameId).emit('problem_ready', {
        problem,
        testCases
      });
      
      // Send solution ONLY to the bug introducer
      if (game.currentBugIntroducer) {
        const bugIntroducerSocket = [...io.sockets.sockets.values()]
          .find(socket => socket.id === game.currentBugIntroducer);
        
        if (bugIntroducerSocket) {
          bugIntroducerSocket.emit('solution_ready', {
            solution
          });
          console.log(`✅ Sample solution sent to bug introducer only`);
        }
      }
      
      // Success! Exit the retry loop
      return;
      
    } catch (error) {
      console.error(`❌ Attempt ${attempt} failed:`, error.message);
      
      // If this was the last attempt, fall back to sample data
      if (attempt === maxRetries) {
        console.log(`🔄 All ${maxRetries} attempts failed. Falling back to sample problem data...`);
        break; // Exit retry loop and use fallback
      }
      
      // Otherwise, continue to next attempt
      console.log(`🔄 Retrying... (${attempt}/${maxRetries})`);
    }
  }
  
  // Fallback to sample data if all retries failed
  console.log(`🔄 Falling back to sample problem data...`);
  const randomIndex = Math.floor(Math.random() * sampleProblems.length);
  const problem = sampleProblems[randomIndex];
  const solution = sampleSolutions[problem.id].python;
  const testCases = sampleTestCases[problem.id];
  
  console.log(`🔄 Using fallback problem: "${problem.title}"`);
  
  // Send fallback problem to all players
  io.to(gameId).emit('problem_ready', {
    problem,
    testCases
  });
  
  // Send fallback solution ONLY to the bug introducer
  if (game.currentBugIntroducer) {
    const bugIntroducerSocket = [...io.sockets.sockets.values()]
      .find(socket => socket.id === game.currentBugIntroducer);
    
    if (bugIntroducerSocket) {
      bugIntroducerSocket.emit('solution_ready', {
        solution
      });
      console.log(`✅ Fallback solution sent to bug introducer only`);
    }
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
      player1: { lineCorruption: 1, timeFreeze: 1 },
      player2: { lineCorruption: 1, timeFreeze: 1 }
    };
    this.currentProblem = null;
    this.currentSolution = '';
    this.buggyCode = '';
    this.testCases = [];
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
    console.log(`Time up for game ${this.id} in phase ${this.currentPhase}`);
    
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
    
    // Power-ups persist across rounds (1 use per game per player)
    console.log(`⚡ Round ${this.currentRound} started - power-ups persist from previous rounds`);
    
    // Clear previous problem data for fresh start
    this.currentProblem = null;
    this.currentSolution = '';
    this.buggyCode = '';
    this.testCases = [];
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
          
          // Auto-fetch a fresh problem for the new round
          fetchAndSendProblem(gameId, io);
        }
      } else {
        console.log(`Failed to add player ${playerName} to game ${gameId} - game is full`);
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

      console.log(`Sending current game state to ${playerData.playerName} for game ${gameId}`);
      
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
    socket.on('submit_fix', ({ gameId, fixedCode, foundBugLine }) => {
      const game = games.get(gameId);
      if (!game || game.currentDebugger !== socket.id) return;

      // Stop the timer when fix is submitted
      game.clearTimer();
      console.log(`Timer stopped for game ${gameId} - fix submitted`);

      // In MVP, we'll do basic validation
      // Later this will use Judge0 API for actual code execution
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
          
          // Fetch a fresh problem for the new round
          fetchAndSendProblem(gameId, io);
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
