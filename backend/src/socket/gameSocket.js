// Load environment variables
require('dotenv').config();

const { v4: uuidv4 } = require('uuid');
const { VellumClient } = require('vellum-ai');
const { testProblems } = require('../data/testProblems');

// Environment variables
const LEETCODE_API_BASE_URL = process.env.LEETCODE_API_BASE_URL || 'https://leetcode-api-pied.vercel.app';
const TEST_MODE = process.env.TEST_MODE === 'true';

console.log(`🧪 Test Mode: ${TEST_MODE ? 'ENABLED' : 'DISABLED'} - ${TEST_MODE ? 'Using preloaded problems' : 'Using LeetCode + Vellum API'}`);

// Cache for Vellum-generated solutions to avoid regenerating
const solutionCache = new Map();

// Pre-loaded problems queue for instant round transitions
const preloadedProblems = new Map(); // gameId -> array of {problem, solution, tests}

// Track active preloading operations to prevent infinite loops
const activePreloading = new Set();

// Test mode problem counter for cycling through test problems
const testProblemCounters = new Map(); // gameId -> currentIndex

// Test mode: Get next preloaded problem instead of fetching from APIs
function getTestModeProblem(gameId) {
  if (!testProblemCounters.has(gameId)) {
    testProblemCounters.set(gameId, 0);
  }
  
  const currentIndex = testProblemCounters.get(gameId);
  const problem = testProblems[currentIndex % testProblems.length];
  
  // Increment counter for next round
  testProblemCounters.set(gameId, currentIndex + 1);
  
  console.log(`🧪 Test Mode: Using preloaded problem ${currentIndex + 1}/${testProblems.length} - "${problem.title}"`);
  
  // Format problem to match LeetCode API structure
  const formattedProblem = {
    id: problem.id,
    frontend_id: problem.id,
    title: problem.title,
    description: problem.description,
    difficulty: problem.difficulty,
    examples: problem.examples,
    constraints: problem.constraints
  };
  
  return {
    problem: formattedProblem,
    solution: problem.solution,
    testCases: problem.testCases
  };
}

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
    
    // Process streaming response with timeout protection
    console.log('🔍 Starting to process Vellum stream...');
    let streamItemCount = 0;
    const maxStreamItems = 200; // Prevent infinite streaming
    const streamStartTime = Date.now();
    const maxStreamTime = 60000; // 60 seconds max
    
    for await (const item of response) {
      streamItemCount++;
      const streamDuration = Date.now() - streamStartTime;
      
      // Safety checks to prevent infinite streaming
      if (streamItemCount > maxStreamItems) {
        console.log(`⚠️ Stream exceeded ${maxStreamItems} items, breaking to prevent infinite loop`);
        break;
      }
      
      if (streamDuration > maxStreamTime) {
        console.log(`⚠️ Stream exceeded ${maxStreamTime/1000}s, breaking to prevent timeout`);
        break;
      }
      
      // Log every 10th item to reduce spam, or important items
      if (streamItemCount % 10 === 0 || item.data?.state === 'FULFILLED' || item.data?.output?.state === 'FULFILLED') {
        console.log(`🔍 Vellum stream item ${streamItemCount} (${Math.round(streamDuration/1000)}s):`, JSON.stringify(item, null, 2));
      } else {
        console.log(`🔍 Stream item ${streamItemCount}: ${item.data?.state || 'unknown'} - ${item.data?.output?.name || 'no output'} (${item.data?.output?.state || 'no state'})`);
      }
      
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
  
  // Prevent infinite loops - check if already preloading for this game
  if (activePreloading.has(gameId)) {
    console.log(`⚡ Already preloading for game ${gameId}, skipping to prevent infinite loop`);
    return;
  }
  
  // Check current queue size
  const queue = preloadedProblems.get(gameId) || [];
  
  console.log(`🔍 Continuous preloading check for game ${gameId}:`);
  console.log(`   - Current queue length: ${queue.length}`);
  console.log(`   - Queue contents: ${queue.map(p => p.problem?.title || 'unknown').join(', ')}`);
  
  // Check if game could potentially continue (first-to-3 win condition)
  const player1Wins = game.roundWins?.player1 || 0;
  const player2Wins = game.roundWins?.player2 || 0;
  const maxWins = Math.max(player1Wins, player2Wins);
  
  console.log(`   - Current wins: P1=${player1Wins}, P2=${player2Wins}, max=${maxWins}`);
  
  // Game ends when someone reaches 3 wins, so stop preloading if we're close to ending
  if (maxWins >= 3) {
    console.log(`⚡ Game ending soon (max wins: ${maxWins}), skipping pre-load`);
    return;
  }
  
  // Only preload 1 problem at a time, and only if we don't already have one queued
  if (queue.length >= 1) {
    console.log(`⚡ Queue has ${queue.length} problems, skipping pre-load (first-to-3 format)`);
    console.log(`   - Existing problems: ${queue.map(p => p.problem?.title || 'unknown').join(', ')}`);
    return;
  }
  
  console.log(`✅ Queue is empty (${queue.length}), proceeding with preloading...`);
  
  const problemsToAdd = 1; // Always add just 1 problem at a time
  console.log(`🔄 Sequential pre-loading: Adding ${problemsToAdd} problem to queue (current wins: ${player1Wins}-${player2Wins}, max: ${maxWins})`);
  
  
  // Mark this game as actively preloading
  activePreloading.add(gameId);
  
  try {
    // Pre-load problems in background (non-blocking)
    if (TEST_MODE) {
      // Test mode: Pre-load test problems instantly
      preloadTestProblems(gameId, problemsToAdd);
    } else {
      // Production mode: Pre-load from LeetCode + Vellum
      await preloadProblemsForGame(gameId, problemsToAdd);
    }
  } catch (error) {
    console.error('❌ Error in continuous pre-loading:', error);
  } finally {
    // Always clear the active preloading flag
    activePreloading.delete(gameId);
    console.log(`✅ Cleared preloading flag for game ${gameId}`);
  }
}

// Test mode: Pre-load test problems instantly (no API calls)
function preloadTestProblems(gameId, problemsToAdd) {
  if (!preloadedProblems.has(gameId)) {
    preloadedProblems.set(gameId, []);
  }
  
  const queue = preloadedProblems.get(gameId);
  
  for (let i = 0; i < problemsToAdd; i++) {
    const testData = getTestModeProblem(gameId);
    queue.push(testData);
    console.log(`🧪 Test Mode: Pre-loaded "${testData.problem.title}" to queue`);
  }
  
  console.log(`✅ Test Mode: Pre-loaded ${problemsToAdd} problems instantly`);
}

// Curated list of free LeetCode problems (guaranteed to be available)
const CURATED_PROBLEMS = [
  1,   // Two Sum
  2,   // Add Two Numbers
  3,   // Longest Substring Without Repeating Characters
  7,   // Reverse Integer
  9,   // Palindrome Number
  13,  // Roman to Integer
  14,  // Longest Common Prefix
  26,  // Remove Duplicates from Sorted Array
  27,  // Remove Element
  28,  // Find the Index of the First Occurrence in a String
  121, // Best Time to Buy and Sell Stock
  136, // Single Number
  148, // Sort List
  198  // House Robber
];

// Track used problems per game to avoid duplicates
const usedProblemsPerGame = new Map();

// Pre-load problems for future rounds to eliminate wait time
async function preloadProblemsForGame(gameId, roundsToPreload = 2) {
  const game = games.get(gameId);
  if (!game) return;
  
  // Skip pre-loading in test mode - we use static test problems
  if (TEST_MODE) {
    console.log(`🧪 Test Mode: Skipping pre-loading for game ${gameId} - using static test problems`);
    return;
  }
  
  console.log(`🔄 Pre-loading ${roundsToPreload} problems for game ${gameId}...`);
  
  if (!preloadedProblems.has(gameId)) {
    preloadedProblems.set(gameId, []);
  }
  
  if (!usedProblemsPerGame.has(gameId)) {
    usedProblemsPerGame.set(gameId, new Set());
  }
  
  const queue = preloadedProblems.get(gameId);
  const usedProblems = usedProblemsPerGame.get(gameId);
  
  // Get available problems (not used in this game yet)
  const availableProblems = CURATED_PROBLEMS.filter(id => !usedProblems.has(id));
  
  if (availableProblems.length === 0) {
    console.log('⚠️ Warning: All curated problems have been used in this game. Resetting used problems list.');
    usedProblems.clear();
    availableProblems.push(...CURATED_PROBLEMS);
  }
  
  // Pre-load problems in background with retry logic
  let successfulPreloads = 0;
  let attempts = 0;
  const maxAttempts = Math.min(roundsToPreload * 3, availableProblems.length); // Limit attempts
  
  while (successfulPreloads < roundsToPreload && attempts < maxAttempts && availableProblems.length > 0) {
    attempts++;
    try {
      console.log(`🔄 Preload attempt ${attempts} (${successfulPreloads}/${roundsToPreload} successful)`);
      
      // Pick random problem from curated list
      const randomIndex = Math.floor(Math.random() * availableProblems.length);
      const problemId = availableProblems[randomIndex];
      availableProblems.splice(randomIndex, 1); // Remove from available list
      
      console.log(`🎲 Selected curated problem ID: ${problemId}`);
      
      // Comment out the old random API call
      // const randomResponse = await fetch(`${LEETCODE_API_BASE_URL}/random`);
      // const randomData = JSON.parse(await randomResponse.text());
      
      // Use the selected problem ID directly
      
      // Get full problem details with error handling
      const problemResponse = await fetch(`${LEETCODE_API_BASE_URL}/problem/${problemId}`);
      
      if (!problemResponse.ok) {
        console.log('⚠️ Problem API returned error status:', problemResponse.status, '- retrying...');
        continue;
      }
      
      const problemText = await problemResponse.text();
      if (problemText.startsWith('<!DOCTYPE') || problemText.startsWith('<html')) {
        console.log('⚠️ Problem API returned HTML instead of JSON - retrying...');
        continue;
      }
      
      const leetcodeProblem = JSON.parse(problemText);
      
      if (!leetcodeProblem || !leetcodeProblem.content) {
        console.log(`⚠️ Invalid problem data for ID ${problemId}: ${leetcodeProblem?.title || 'unknown'} - retrying...`);
        continue;
      }
      
      // Mark this problem as used in this game
      usedProblems.add(problemId);
      console.log(`📝 Marked problem ${problemId} as used for game ${gameId}`);
      console.log(`📊 Used problems in this game: [${Array.from(usedProblems).join(', ')}]`);
      
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
      
      successfulPreloads++;
      console.log(`✅ Pre-loaded problem ${successfulPreloads}/${roundsToPreload}: ${problem.title}`);
      
    } catch (error) {
      console.error('❌ Error pre-loading problem (attempt ${attempts}):', error);
    }
  }
  
  console.log(`🎯 Pre-loading completed: ${successfulPreloads}/${roundsToPreload} problems loaded after ${attempts} attempts`);
  
  // If we couldn't pre-load any problems, log a warning but continue
  if (successfulPreloads === 0) {
    console.log('⚠️ Warning: Could not pre-load any problems after ${maxAttempts} attempts. Game will use live fetching.');
  } else if (successfulPreloads < roundsToPreload) {
    console.log(`⚠️ Warning: Only pre-loaded ${successfulPreloads}/${roundsToPreload} problems after ${maxAttempts} attempts.`);
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
  
  // Test mode: Use preloaded test problems instead of API calls
  if (TEST_MODE) {
    console.log(`🧪 Test Mode: Fetching preloaded test problem for game ${gameId}`);
    
    // Check if we have pre-loaded problems first
    const queue = preloadedProblems.get(gameId);
    if (queue && queue.length > 0) {
      console.log(`⚡ Using pre-loaded test problem for game ${gameId}`);
      const preloadedData = queue.shift(); // Remove from queue
      
      // Send test problem data immediately
      const { problem, solution, testCases } = preloadedData;
      
      // Store in game state
      game.currentProblem = problem;
      game.currentSolution = solution;
      game.currentTestCases = testCases;
      
      // Send to frontend immediately (no streaming delay in test mode)
      io.to(gameId).emit('problem_loaded', {
        problem: problem,
        testCases: testCases
      });
      
      // Send solution to bug introducer immediately
      const bugIntroducer = game.players.find(p => p.role === 'bug_introducer');
      if (bugIntroducer) {
        io.to(bugIntroducer.socketId).emit('solution_ready', { solution: solution });
      } else if (game.currentBugIntroducer) {
        io.to(game.currentBugIntroducer).emit('solution_ready', { solution: solution });
      }
      
      // Clear loading overlay immediately
      io.to(gameId).emit('round_ready');
      
      // Trigger continuous pre-loading for next round
      triggerContinuousPreloading(gameId, io);
      
      console.log(`✅ Test Mode: Sent problem "${problem.title}" instantly`);
      return;
    } else {
      // No pre-loaded problems, generate one instantly
      const testData = getTestModeProblem(gameId);
      const { problem, solution, testCases } = testData;
      
      // Store in game state
      game.currentProblem = problem;
      game.currentSolution = solution;
      game.currentTestCases = testCases;
      
      // Send to frontend immediately
      io.to(gameId).emit('problem_loaded', {
        problem: problem,
        testCases: testCases
      });
      
      // Send solution to bug introducer immediately
      const bugIntroducer = game.players.find(p => p.role === 'bug_introducer');
      if (bugIntroducer) {
        io.to(bugIntroducer.socketId).emit('solution_ready', { solution: solution });
      } else if (game.currentBugIntroducer) {
        io.to(game.currentBugIntroducer).emit('solution_ready', { solution: solution });
      }
      
      // Clear loading overlay immediately
      io.to(gameId).emit('round_ready');
      
      console.log(`✅ Test Mode: Generated and sent problem "${problem.title}" instantly`);
      return;
    }
  }
  
  // Production mode: Check if we have pre-loaded problems first
  if (!TEST_MODE) {
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
        
        // Send solution immediately to bug introducer using currentBugIntroducer ID
        if (game.currentBugIntroducer) {
          console.log('📤 Emitting solution_ready to bug introducer:', game.currentBugIntroducer);
          io.to(game.currentBugIntroducer).emit('solution_ready', { solution: solutionReady });
        } else {
          console.log('❌ No currentBugIntroducer found in game state!');
        }
        // Clear loading overlay as soon as solution is ready
        io.to(gameId).emit('round_ready');
      },
      (testsReady) => {
        console.log(`✅ Test cases received for game ${gameId}, count: ${Array.isArray(testsReady) ? testsReady.length : 'not array'}`);
        game.currentTestCases = testsReady;
        console.log(`💾 Set game.currentTestCases for game ${gameId}`);
        
        // 🚀 TRIGGER PRELOADING: Queue up next round now that current round tests are ready
        console.log('🔄 Cached tests received, triggering continuous pre-loading for next round...');
        triggerContinuousPreloading(gameId, io);
      }
    );
    
    // Store solution in game state
    game.currentSolution = solution;
    
    console.log(`✅ Instantly loaded pre-cached problem: "${problem.title}"`);
    return;
    }
  }
  
  // Fallback to live fetching if no pre-loaded problems
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🎲 Selecting curated LeetCode problem for game ${gameId}... (Attempt ${attempt}/${maxRetries})`);
      
      // Initialize used problems tracking for this game if not exists
      if (!usedProblemsPerGame.has(gameId)) {
        usedProblemsPerGame.set(gameId, new Set());
      }
      
      const usedProblems = usedProblemsPerGame.get(gameId);
      
      // Get available problems (not used in this game yet)
      const availableProblems = CURATED_PROBLEMS.filter(id => !usedProblems.has(id));
      
      if (availableProblems.length === 0) {
        console.log('⚠️ Warning: All curated problems have been used in this game. Resetting used problems list.');
        usedProblems.clear();
        availableProblems.push(...CURATED_PROBLEMS);
      }
      
      // Step 1: Select random problem from curated list
      const randomIndex = Math.floor(Math.random() * availableProblems.length);
      const problemId = availableProblems[randomIndex];
      
      console.log(`🎯 Selected curated problem ID: ${problemId}`);
      
      // Mark this problem as used in this game
      usedProblems.add(problemId);
      console.log(`📝 Marked problem ${problemId} as used for game ${gameId}`);
      console.log(`📊 Used problems in this game: [${Array.from(usedProblems).join(', ')}]`);
      
      // Comment out the old random API calls
      // const randomResponse = await fetch(`${LEETCODE_API_BASE_URL}/random`);
      // const randomProblem = await randomResponse.json();
      // const problemId = randomProblem.frontend_id;
      
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
          
          // Send solution immediately to bug introducer using currentBugIntroducer ID
          if (game.currentBugIntroducer) {
            console.log('📤 Emitting solution_ready to bug introducer:', game.currentBugIntroducer);
            io.to(game.currentBugIntroducer).emit('solution_ready', { solution: solutionReady });
          } else {
            console.log('❌ No currentBugIntroducer found in game state!');
          }
          // Clear loading overlay as soon as solution is ready
          io.to(gameId).emit('round_ready');
        },
        // Callback for when tests are ready  
        (testsReady) => {
          console.log('⚡ Tests ready, storing for game...');
          // Store tests immediately when ready (background process)
          game.currentTestCases = testsReady;
          
          // 🚀 TRIGGER PRELOADING: Queue up next round now that current round tests are ready
          console.log('🔄 Tests received, triggering continuous pre-loading for next round...');
          triggerContinuousPreloading(gameId, io);
        }
      );
      
      console.log(`✅ Streaming generation completed for: "${problem.title}" (${problem.difficulty})`);
      
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
    this.timeLeft = 90; // 1 minute 30 seconds
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
    this.lineCorruptionUsedThisRound = false; // Track if Line Corruption was used in current round
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
      
      // Clean up used problems tracking for this game
      usedProblemsPerGame.delete(this.id);
      console.log(`🧽 Cleaned up used problems tracking for game ${this.id}`);
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
    this.timeLeft = 90;
    
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
    this.lineCorruptionUsedThisRound = false; // Reset Line Corruption tracking for new round
  }

  switchPhase(newPhase) {
    this.currentPhase = newPhase;
    if (newPhase === 'debugging') {
      this.timeLeft = 90; // Reset timer for debugging phase
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
          
          // Start initial preloading for future rounds
          console.log(`🚀 Starting initial preloading for game ${gameId}`);
          setTimeout(() => {
            triggerContinuousPreloading(gameId, io);
          }, 1000); // Small delay to let the first problem fetch start
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
      game.editedLinesCount = editedLines.length; // Track number of lines edited for debugger limit
      game.currentPhase = 'debugging';
      game.timeLeft = 90; // 1 minute 30 seconds for debugging
      game.startTimer(io);
      
      console.log(`🐛 Bug introduced in game ${gameId} on ${editedLines.length} line(s):`, editedLines);
      
      // Notify all players
      io.to(gameId).emit('bug_introduced', {
        buggyCode,
        lineNumber,
        editedLines,
        editedLinesCount: game.lineCorruptionUsedThisRound ? 2 : 1, // Dynamic limit based on Line Corruption usage
        phase: 'debugging',
        timeLeft: game.timeLeft,
        debugger: game.currentDebugger
      });
    });

    // Handle bug fix submission
    socket.on('submit_fix', async ({ gameId, fixedCode, foundBugLine, debuggerEditedLines }) => {
      const game = games.get(gameId);
      if (!game || game.currentDebugger !== socket.id) return;
      
      // Validate debugger line edit limit (dynamic based on Line Corruption usage)
      const allowedLineEdits = game.lineCorruptionUsedThisRound ? 2 : 1;
      if (debuggerEditedLines && debuggerEditedLines.length > allowedLineEdits) {
        socket.emit('error', { 
          message: `You can only edit up to ${allowedLineEdits} line${allowedLineEdits > 1 ? 's' : ''} to fix this bug! You edited ${debuggerEditedLines.length} lines.` 
        });
        return;
      }

      // Stop the timer when fix is submitted
      game.clearTimer();
      console.log(`Timer stopped for game ${gameId} - fix submitted`);

      // Set game phase to validation and notify clients
      game.currentPhase = 'validation';
      io.to(gameId).emit('validation_started', {
        message: 'Running test cases against your fix...',
        phase: 'validation'
      });

      try {
        // Wait for test cases to be available
        console.log(`🔍 Checking test cases for game ${gameId}:`);
        console.log(`🔍 - game.currentTestCases exists: ${!!game.currentTestCases}`);
        console.log(`🔍 - game.currentTestCases length: ${game.currentTestCases ? game.currentTestCases.length : 'N/A'}`);
        console.log(`🔍 - game.currentRound: ${game.currentRound}`);
        console.log(`🔍 - game.currentPhase: ${game.currentPhase}`);
        
        if (!game.currentTestCases || game.currentTestCases.length === 0) {
          console.log('⏳ Waiting for test cases to be generated...');
          io.to(gameId).emit('validation_loading', {
            message: 'Waiting for test cases to be ready...'
          });
          
          // Wait up to 30 seconds for test cases
          const maxWaitTime = 30000; // 30 seconds
          const checkInterval = 1000; // 1 second
          let waitTime = 0;
          
          while ((!game.currentTestCases || game.currentTestCases.length === 0) && waitTime < maxWaitTime) {
            console.log(`⏳ Still waiting for test cases... (${waitTime/1000}s/${maxWaitTime/1000}s)`);
            await new Promise(resolve => setTimeout(resolve, checkInterval));
            waitTime += checkInterval;
            console.log(`🔍 After wait - currentTestCases: ${game.currentTestCases ? game.currentTestCases.length : 'still null'}`);
          }
          
          if (!game.currentTestCases || game.currentTestCases.length === 0) {
            throw new Error('Test cases not available after waiting');
          }
        }

        console.log(`🧪 Running Judge0 validation with ${game.currentTestCases.length} test cases`);
        io.to(gameId).emit('validation_loading', {
          message: `Running ${game.currentTestCases.length} test cases...`
        });

        // Use Judge0 to validate the fix
        const judge0Service = require('../services/judge0Service');
        const testResults = await judge0Service.runTestCases(
          fixedCode,
          game.currentTestCases,
          'python' // Default to Python for now
        );

        const isCorrect = testResults.success;
        console.log(`✅ Judge0 validation complete: ${testResults.summary}`);

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
          roundWinner: roundWinner,
          testResults: {
            summary: testResults.summary,
            passedCount: testResults.passedCount,
            totalCount: testResults.totalCount,
            details: testResults.results.map(r => ({
              testCase: r.testCase,
              passed: r.passed,
              status: r.status,
              error: r.error
            }))
          }
        });

        // Add 5-second delay before starting next round to let players review test results
        console.log('⏱️ Waiting 5 seconds before next round...');
        setTimeout(() => {
          // Check if game is over or start next round
          game.checkGameEnd(io);
        }, 5000);

      } catch (error) {
        console.error('❌ Judge0 validation error:', error.message);
        
        // Fallback to simple validation if Judge0 fails
        console.log('🔄 Falling back to simple validation...');
        const isCorrect = fixedCode.length > 0 && fixedCode !== game.buggyCode;

        let roundWinner;
        if (isCorrect) {
          const debuggerIndex = game.players.findIndex(p => p.id === socket.id);
          const playerKey = debuggerIndex === 0 ? 'player1' : 'player2';
          game.roundWins[playerKey] += 1;
          roundWinner = game.players[debuggerIndex].name + ' (Debugger)';
        } else {
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
          roundWinner: roundWinner,
          testResults: {
            summary: 'Validation failed - using fallback',
            passedCount: isCorrect ? 1 : 0,
            totalCount: 1,
            error: error.message
          }
        });

        // Add 5-second delay before starting next round to let players review results
        console.log('⏱️ Waiting 5 seconds before next round (fallback)...');
        setTimeout(() => {
          game.checkGameEnd(io);
        }, 5000);
      }
    });

    // Handle power-up usage
    socket.on('use_powerup', ({ gameId, powerUpType }) => {
      const game = games.get(gameId);
      if (!game) return;

      const playerIndex = game.players.findIndex(p => p.id === socket.id);
      const playerKey = playerIndex === 0 ? 'player1' : 'player2';

      // Check role-based restrictions
      const isCurrentBugIntroducer = socket.id === game.currentBugIntroducer;
      const isCurrentDebugger = socket.id === game.currentDebugger;

      // Ant Colony (lineCorruption) can only be used by the bug introducer
      if (powerUpType === 'lineCorruption' && !isCurrentBugIntroducer) {
        socket.emit('error', { message: 'Ant Colony can only be used by the bug introducer!' });
        return;
      }

      // Pest Control (timeFreeze) can only be used by the debugger
      if (powerUpType === 'timeFreeze' && !isCurrentDebugger) {
        socket.emit('error', { message: 'Pest Control can only be used by the debugger!' });
        return;
      }

      if (game.powerUps[playerKey][powerUpType] > 0) {
        game.powerUps[playerKey][powerUpType]--;

        if (powerUpType === 'timeFreeze') {
          // Increase timer by 30 seconds
          game.timeLeft += 30;
        } else if (powerUpType === 'lineCorruption') {
          // Track that Line Corruption was used this round
          game.lineCorruptionUsedThisRound = true;
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
            
            // Clean up used problems tracking for this game
            usedProblemsPerGame.delete(playerData.gameId);
            console.log(`🧽 Cleaned up used problems tracking for game ${playerData.gameId}`);
          }
        }
        players.delete(socket.id);
      }
    });
  });
}

module.exports = { initializeSocket };
