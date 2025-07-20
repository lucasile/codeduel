// Load environment variables
require('dotenv').config();

const { v4: uuidv4 } = require('uuid');
const { VellumClient } = require('vellum-ai');

// Environment variables
const LEETCODE_API_BASE_URL = process.env.LEETCODE_API_BASE_URL || 'https://leetcode-api-pied.vercel.app';

// Cache for Vellum-generated solutions to avoid regenerating
const solutionCache = new Map();

// Pre-loaded problems queue for instant round transitions
const preloadedProblems = new Map(); // gameId -> [problem1, problem2, ...]

// Note: Using built-in fetch (Node.js 18+)
// If using older Node.js version, you may need to polyfill fetch

// Initialize Vellum client
const vellumClient = new VellumClient({ 
  apiKey: process.env.VELLUM_API_KEY 
});

// Function to generate solution and tests using Vellum AI with streaming
async function generateSolutionAndTests(problemHtml, problemId = null, onSolutionReady = null, onTestsReady = null) {
  try {
    // Check cache first if we have a problem ID
    const cacheKey = problemId || problemHtml.substring(0, 100);
    if (solutionCache.has(cacheKey)) {
      console.log('⚡ Using cached solution for problem:', problemId || 'unknown');
      const cached = solutionCache.get(cacheKey);
      // Call callbacks immediately for cached results
      if (onSolutionReady) onSolutionReady(cached.solution);
      if (onTestsReady) onTestsReady(cached.tests);
      return cached;
    }
    
    console.log('🤖 Generating solution with Vellum AI (streaming)...');
    
    const response = await vellumClient.executeWorkflowStream({
      workflowDeploymentId: process.env.VELLUM_WORKFLOW_DEPLOYMENT_ID,
      inputs: [{
        name: "leetcode_problem_html",
        type: "STRING",
        value: problemHtml
      }]
    });
    
    let solution = '';
    let tests = [];
    let solutionReceived = false;
    let testsReceived = false;
    
    // Process streaming response
    console.log('🔍 Starting to process Vellum stream...');
    let streamItemCount = 0;
    
    for await (const item of response) {
      streamItemCount++;
      console.log(`🔍 Vellum stream item ${streamItemCount}:`, JSON.stringify(item, null, 2));
      
      // Check for individual output (streaming items)
      if (item.data && item.data.output && item.data.output.state === 'FULFILLED') {
        const output = item.data.output;
        console.log('🔍 Processing individual output:', output.name, 'with value length:', output.value?.length || 0);
        
        if (output.name === 'solution' && output.value && !solutionReceived) {
          solution = output.value;
          solutionReceived = true;
          console.log('✅ Solution received via stream, length:', solution.length);
          if (onSolutionReady) {
            console.log('📤 Calling onSolutionReady callback...');
            onSolutionReady(solution);
          } else {
            console.log('⚠️ No onSolutionReady callback provided!');
          }
        }
        
        if (output.name === 'tests' && output.value && !testsReceived) {
          tests = output.value;
          testsReceived = true;
          console.log('✅ Tests received via stream, count:', Array.isArray(tests) ? tests.length : 'not array');
          if (onTestsReady) {
            console.log('📤 Calling onTestsReady callback...');
            onTestsReady(tests);
          } else {
            console.log('⚠️ No onTestsReady callback provided!');
          }
        }
      }
      
      // Also check for final outputs array (final completion item)
      else if (item.data && item.data.outputs && item.data.state === 'FULFILLED') {
        console.log('🔍 Found final outputs array:', item.data.outputs.length, 'outputs');
        for (const output of item.data.outputs) {
          console.log('🔍 Processing final output:', output.name, 'with value length:', output.value?.length || 0);
          
          if (output.name === 'solution' && output.value && !solutionReceived) {
            solution = output.value;
            solutionReceived = true;
            console.log('✅ Solution received via final outputs, length:', solution.length);
            if (onSolutionReady) {
              console.log('📤 Calling onSolutionReady callback...');
              onSolutionReady(solution);
            }
          }
          
          if (output.name === 'tests' && output.value && !testsReceived) {
            tests = output.value;
            testsReceived = true;
            console.log('✅ Tests received via final outputs, count:', Array.isArray(tests) ? tests.length : 'not array');
            if (onTestsReady) {
              console.log('📤 Calling onTestsReady callback...');
              onTestsReady(tests);
            }
          }
        }
      }
      
      else {
        console.log('🔍 Stream item has no relevant outputs (state:', item.data?.state || 'unknown', ')');
      }
    }
    
    console.log(`🏁 Finished processing Vellum stream. Total items: ${streamItemCount}`);
    console.log(`🏁 Final state - Solution received: ${solutionReceived}, Tests received: ${testsReceived}`);
    
    // Ensure we have both solution and tests
    if (!solution) {
      console.warn('⚠️ Warning: No solution received from Vellum stream!');
    }
    if (!tests || tests.length === 0) {
      console.warn('⚠️ Warning: No tests received from Vellum stream!');
    }
    
    console.log('✅ Vellum AI generated solution and tests successfully');
    
    // Cache the result for future use
    const result = { solution, tests };
    solutionCache.set(cacheKey, result);
    console.log('💾 Cached solution for future use');
    
    return result;
    
  } catch (error) {
    console.error('❌ Failed to generate solution with Vellum AI:', error);
    
    // Fallback to placeholder solution and tests
    const fallbackSolution = "# Sample solution\n# TODO: Integrate with Vellum API for real solutions\ndef solution():\n    pass";
    const fallbackTests = [
      { input: "example input", expectedOutput: "example output" },
      { input: "test case 2", expectedOutput: "expected result 2" }
    ];
    
    console.log('🔄 Using fallback solution due to Vellum AI error');
    return { solution: fallbackSolution, tests: fallbackTests };
  }
}

// Continuous pre-loading: Queue up next round immediately after current stream completes
async function triggerContinuousPreloading(gameId, io) {
  const game = games.get(gameId);
  if (!game) return;
  
  // Check current queue size
  const queue = preloadedProblems.get(gameId) || [];
  const totalRounds = game.totalRounds || 3; // Default to 3 rounds
  const currentRound = game.currentRound || 1;
  
  // Calculate max problems we should have (never exceed total rounds)
  const remainingRounds = totalRounds - currentRound;
  const maxProblemsNeeded = Math.min(remainingRounds, 2); // Keep 2 ahead, but never exceed remaining rounds
  
  if (queue.length >= maxProblemsNeeded || remainingRounds <= 0) {
    console.log(`⚡ Queue has ${queue.length} problems, remaining rounds: ${remainingRounds}, skipping pre-load`);
    return;
  }
  
  const problemsToAdd = maxProblemsNeeded - queue.length;
  console.log(`🔄 Continuous pre-loading: Adding ${problemsToAdd} problems to queue (current: ${queue.length}, remaining rounds: ${remainingRounds})`);
  
  // Pre-load problems in background (non-blocking)
  preloadProblemsForGame(gameId, problemsToAdd).catch(error => {
    console.error('❌ Error in continuous pre-loading:', error);
  });
}

// Pre-load problems for future rounds to eliminate wait time
async function preloadProblemsForGame(gameId, roundsToPreload = 2) {
  const game = games.get(gameId);
  if (!game) return;
  
  console.log(`🔄 Pre-loading ${roundsToPreload} problems for game ${gameId}...`);
  
  if (!preloadedProblems.has(gameId)) {
    preloadedProblems.set(gameId, []);
  }
  
  const queue = preloadedProblems.get(gameId);
  
  // Pre-load problems in background
  for (let i = 0; i < roundsToPreload; i++) {
    try {
      // Fetch random problem with error handling
      const randomResponse = await fetch(`${LEETCODE_API_BASE_URL}/random`);
      
      // Check if response is OK and contains JSON
      if (!randomResponse.ok) {
        console.log('⚠️ LeetCode API returned error status:', randomResponse.status);
        continue;
      }
      
      const randomText = await randomResponse.text();
      if (randomText.startsWith('<!DOCTYPE') || randomText.startsWith('<html')) {
        console.log('⚠️ LeetCode API returned HTML instead of JSON, skipping preload');
        continue;
      }
      
      const randomData = JSON.parse(randomText);
      
      if (!randomData || !randomData.frontend_id) {
        console.log('⚠️ Invalid random problem data, skipping preload');
        continue;
      }
      
      // Get full problem details with error handling
      const problemResponse = await fetch(`${LEETCODE_API_BASE_URL}/problem/${randomData.frontend_id}`);
      
      if (!problemResponse.ok) {
        console.log('⚠️ Problem API returned error status:', problemResponse.status);
        continue;
      }
      
      const problemText = await problemResponse.text();
      if (problemText.startsWith('<!DOCTYPE') || problemText.startsWith('<html')) {
        console.log('⚠️ Problem API returned HTML instead of JSON, skipping preload');
        continue;
      }
      
      const leetcodeProblem = JSON.parse(problemText);
      
      if (!leetcodeProblem || !leetcodeProblem.content || leetcodeProblem.isPaidOnly) {
        console.log('⚠️ Premium or invalid problem, skipping preload');
        continue;
      }
      
      const problem = {
        id: leetcodeProblem.id,
        title: leetcodeProblem.title,
        difficulty: leetcodeProblem.difficulty,
        description: leetcodeProblem.content,
        examples: leetcodeProblem.examples || [],
        constraints: []
      };
      
      // Pre-generate solution and tests (this will cache them)
      console.log(`🤖 Pre-generating solution for: ${problem.title}`);
      await generateSolutionAndTests(leetcodeProblem.content, leetcodeProblem.frontend_id);
      
      queue.push({
        problem,
        leetcodeProblem,
        preloaded: true
      });
      
      console.log(`✅ Pre-loaded problem: ${problem.title}`);
      
    } catch (error) {
      console.error('❌ Error pre-loading problem:', error);
    }
  }
  
  console.log(`🎯 Pre-loaded ${queue.length} problems for game ${gameId}`);
  
  // If we couldn't pre-load any problems, log a warning but continue
  if (queue.length === 0) {
    console.log('⚠️ Warning: Could not pre-load any problems. Game will use live fetching.');
  }
}

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

async function fetchAndSendProblem(gameId, io, maxRetries = 5) {
  const game = games.get(gameId);
  if (!game) return;
  
  // Send loading state to frontend
  io.to(gameId).emit('round_loading', { message: 'Loading next problem...' });
  
  // Check if we have pre-loaded problems first
  const queue = preloadedProblems.get(gameId);
  if (queue && queue.length > 0) {
    console.log(`⚡ Using pre-loaded problem for game ${gameId}`);
    const preloadedData = queue.shift(); // Remove from queue
    
    // Use pre-loaded problem and solution (already cached)
    const problem = preloadedData.problem;
    const leetcodeProblem = preloadedData.leetcodeProblem;
    
    // Send problem immediately
    game.currentProblem = problem;
    io.to(gameId).emit('problem_loaded', { problem });
    console.log(`⚡ Pre-loaded problem sent: "${problem.title}"`);
    
    // Get cached solution and tests (will be instant from cache)
    const { solution, tests: testCases } = await generateSolutionAndTests(
      leetcodeProblem.content, 
      leetcodeProblem.frontend_id,
      // Callbacks for streaming (will be instant from cache)
      (solutionReady) => {
        console.log('⚡ Cached solution ready, sending to bug introducer and clearing loading...');
        console.log('🔍 Game state:', {
          currentBugIntroducer: game.currentBugIntroducer,
          players: game.players?.map(p => ({ id: p.id, name: p.name, role: p.role, socketId: p.socketId })),
          gamePhase: game.phase
        });
        
        const bugIntroducer = game.players.find(p => p.role === 'bug_introducer');
        console.log('🔍 Found bug introducer:', bugIntroducer);
        
        if (bugIntroducer) {
          console.log('📤 Emitting solution_ready to:', bugIntroducer.socketId);
          io.to(bugIntroducer.socketId).emit('solution_ready', { solution: solutionReady });
        } else {
          console.log('❌ Bug introducer not found! Trying currentBugIntroducer...');
          if (game.currentBugIntroducer) {
            console.log('📤 Emitting solution_ready to currentBugIntroducer:', game.currentBugIntroducer);
            io.to(game.currentBugIntroducer).emit('solution_ready', { solution: solutionReady });
          }
        }
        // Clear loading overlay as soon as solution is ready
        io.to(gameId).emit('round_ready');
      },
      (testsReady) => {
        game.currentTestCases = testsReady;
      }
    );
    
    // Store solution in game state
    game.currentSolution = solution;
    
    console.log(`✅ Instantly loaded pre-cached problem: "${problem.title}"`);
    return;
  }
  
  // Fallback to live fetching if no pre-loaded problems
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🎲 Fetching random LeetCode problem for game ${gameId}... (Attempt ${attempt}/${maxRetries})`);
      
      // Step 1: Get random problem ID
      const randomResponse = await fetch(`${LEETCODE_API_BASE_URL}/random`);
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
      const problemResponse = await fetch(`${LEETCODE_API_BASE_URL}/problem/${problemId}`);
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
      
      // Send problem immediately (before generating solution)
      game.currentProblem = problem;
      io.to(gameId).emit('problem_loaded', { problem });
      console.log(`✅ Problem sent: "${problem.title}" (${problem.difficulty})`);
      
      // Generate solution and test cases using Vellum AI with streaming
      const { solution, tests: testCases } = await generateSolutionAndTests(
        leetcodeProblem.content, 
        leetcodeProblem.frontend_id,
        // Callback for when solution is ready
        (solutionReady) => {
          console.log('⚡ Solution ready, sending to bug introducer and clearing loading...');
          console.log('🔍 Game state:', {
            currentBugIntroducer: game.currentBugIntroducer,
            players: game.players?.map(p => ({ id: p.id, name: p.name, role: p.role, socketId: p.socketId })),
            gamePhase: game.phase
          });
          
          // Send solution immediately to bug introducer
          const bugIntroducer = game.players.find(p => p.role === 'bug_introducer');
          console.log('🔍 Found bug introducer:', bugIntroducer);
          
          if (bugIntroducer) {
            console.log('📤 Emitting solution_ready to:', bugIntroducer.socketId);
            io.to(bugIntroducer.socketId).emit('solution_ready', { solution: solutionReady });
          } else {
            console.log('❌ Bug introducer not found! Trying currentBugIntroducer...');
            if (game.currentBugIntroducer) {
              console.log('📤 Emitting solution_ready to currentBugIntroducer:', game.currentBugIntroducer);
              io.to(game.currentBugIntroducer).emit('solution_ready', { solution: solutionReady });
            }
          }
          // Clear loading overlay as soon as solution is ready
          io.to(gameId).emit('round_ready');
        },
        // Callback for when tests are ready  
        (testsReady) => {
          console.log('⚡ Tests ready, storing for game...');
          // Store tests immediately when ready (background process)
          game.currentTestCases = testsReady;
        }
      );
      
      console.log(`✅ Streaming generation completed for: "${problem.title}" (${problem.difficulty})`);
      
      // 🚀 IMMEDIATE CONTINUOUS PRE-LOADING: Queue up next round as soon as streaming completes
      console.log('🔄 Streaming completed, immediately triggering continuous pre-loading for next round...');
      triggerContinuousPreloading(gameId, io);
      
      // Store solution in game state (problem already stored above)
      game.currentSolution = solution;
      
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
  io.to(gameId).emit('problem_loaded', {
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
    this.maxRounds = 4; // Best of 4 rounds
    this.currentPhase = 'waiting'; // waiting, bug_introduction, debugging, validation, finished
    this.currentBugIntroducer = null;
    this.currentDebugger = null;
    this.timeLeft = 180; // 3 minutes in seconds
    this.timer = null;
    this.roundWins = { player1: 0, player2: 0 }; // Track round wins instead of points
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
      // Award round win to bug introducer
      const introducerIndex = this.players.findIndex(p => p.id === this.currentBugIntroducer);
      const playerKey = introducerIndex === 0 ? 'player1' : 'player2';
      this.roundWins[playerKey] += 1;
      
      io.to(this.id).emit('round_complete', {
        isCorrect: false,
        timeUp: true,
        roundWins: this.roundWins,
        currentRound: this.currentRound,
        maxRounds: this.maxRounds,
        roundWinner: this.players[introducerIndex].name + ' (Bug Introducer)'
      });
      
      // Check if game is over or start next round
      this.checkGameEnd(io);
    }
  }
  
  checkGameEnd(io) {
    // Check if someone has won majority of rounds (best of 4, so need 3 wins to guarantee win)
    const player1Wins = this.roundWins.player1;
    const player2Wins = this.roundWins.player2;
    
    // Early win condition: first to 3 rounds wins
    if (player1Wins >= 3 || player2Wins >= 3 || this.currentRound >= this.maxRounds) {
      let winner;
      if (player1Wins > player2Wins) {
        winner = this.players[0];
      } else if (player2Wins > player1Wins) {
        winner = this.players[1];
      } else {
        // This should rarely happen with best of 4, but handle tie
        winner = null; // tie
      }
      
      io.to(this.id).emit('game_over', {
        winner,
        finalRoundWins: this.roundWins,
        totalRounds: this.currentRound
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
          
          // Start pre-loading problems for future rounds
          preloadProblemsForGame(gameId, 2);
          
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

      io.to(gameId).emit('problem_loaded', {
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

      let roundWinner;
      if (isCorrect) {
        // Award round win to debugger
        const debuggerIndex = game.players.findIndex(p => p.id === socket.id);
        const playerKey = debuggerIndex === 0 ? 'player1' : 'player2';
        game.roundWins[playerKey] += 1;
        roundWinner = game.players[debuggerIndex].name + ' (Debugger)';
      } else {
        // Award round win to bug introducer
        const introducerIndex = game.players.findIndex(p => p.id === game.currentBugIntroducer);
        const playerKey = introducerIndex === 0 ? 'player1' : 'player2';
        game.roundWins[playerKey] += 1;
        roundWinner = game.players[introducerIndex].name + ' (Bug Introducer)';
      }

      io.to(gameId).emit('round_complete', {
        isCorrect,
        fixedCode,
        foundBugLine,
        roundWins: game.roundWins,
        currentRound: game.currentRound,
        maxRounds: game.maxRounds,
        roundWinner: roundWinner
      });

      // Check if game is over or start next round
      game.checkGameEnd(io);
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
