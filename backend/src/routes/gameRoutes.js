const express = require('express');
const router = express.Router();

// Sample problems for MVP (will be replaced with LeetCode API later)
const sampleProblems = [
  {
    id: 1,
    title: "Two Sum",
    difficulty: "Easy",
    description: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
    examples: [
      {
        input: "nums = [2,7,11,15], target = 9",
        output: "[0,1]",
        explanation: "Because nums[0] + nums[1] == 9, we return [0, 1]."
      }
    ],
    constraints: [
      "2 <= nums.length <= 10^4",
      "-10^9 <= nums[i] <= 10^9",
      "-10^9 <= target <= 10^9",
      "Only one valid answer exists."
    ]
  },
  {
    id: 2,
    title: "Reverse Integer",
    difficulty: "Medium",
    description: "Given a signed 32-bit integer x, return x with its digits reversed. If reversing x causes the value to go outside the signed 32-bit integer range [-2^31, 2^31 - 1], then return 0.",
    examples: [
      {
        input: "x = 123",
        output: "321"
      },
      {
        input: "x = -123",
        output: "-321"
      }
    ],
    constraints: [
      "-2^31 <= x <= 2^31 - 1"
    ]
  },
  {
    id: 3,
    title: "Valid Parentheses",
    difficulty: "Easy",
    description: "Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.",
    examples: [
      {
        input: 's = "()"',
        output: "true"
      },
      {
        input: 's = "()[]{}"',
        output: "true"
      },
      {
        input: 's = "(]"',
        output: "false"
      }
    ],
    constraints: [
      "1 <= s.length <= 10^4",
      "s consists of parentheses only '()[]{}'."
    ]
  }
];

// Sample solutions for MVP
const sampleSolutions = {
  1: {
    python: `def twoSum(nums, target):
    num_map = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in num_map:
            return [num_map[complement], i]
        num_map[num] = i
    return []`,
    javascript: `function twoSum(nums, target) {
    const numMap = new Map();
    for (let i = 0; i < nums.length; i++) {
        const complement = target - nums[i];
        if (numMap.has(complement)) {
            return [numMap.get(complement), i];
        }
        numMap.set(nums[i], i);
    }
    return [];
}`
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
    return result if -2**31 <= result <= 2**31 - 1 else 0`,
    javascript: `function reverse(x) {
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);
    let result = 0;
    while (x > 0) {
        result = result * 10 + x % 10;
        x = Math.floor(x / 10);
    }
    result *= sign;
    return (result >= -Math.pow(2, 31) && result <= Math.pow(2, 31) - 1) ? result : 0;
}`
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
    return not stack`,
    javascript: `function isValid(s) {
    const stack = [];
    const mapping = {')': '(', '}': '{', ']': '['};
    for (let char of s) {
        if (char in mapping) {
            if (stack.length === 0 || stack.pop() !== mapping[char]) {
                return false;
            }
        } else {
            stack.push(char);
        }
    }
    return stack.length === 0;
}`
  }
};

// Sample test cases
const sampleTestCases = {
  1: [
    { input: [[2, 7, 11, 15], 9], expected: [0, 1] },
    { input: [[3, 2, 4], 6], expected: [1, 2] },
    { input: [[3, 3], 6], expected: [0, 1] },
    { input: [[1, 2, 3, 4, 5], 8], expected: [2, 4] },
    { input: [[-1, -2, -3, -4, -5], -8], expected: [2, 4] }
  ],
  2: [
    { input: [123], expected: 321 },
    { input: [-123], expected: -321 },
    { input: [120], expected: 21 },
    { input: [0], expected: 0 },
    { input: [1534236469], expected: 0 }
  ],
  3: [
    { input: ["()"], expected: true },
    { input: ["()[]{}"], expected: true },
    { input: ["(]"], expected: false },
    { input: ["([)]"], expected: false },
    { input: ["{[]}"], expected: true },
    { input: [""], expected: true },
    { input: ["(("], expected: false }
  ]
};

// Get random problem for MVP
router.get('/problem/random', (req, res) => {
  try {
    const randomIndex = Math.floor(Math.random() * sampleProblems.length);
    const problem = sampleProblems[randomIndex];
    
    res.json({
      success: true,
      problem,
      testCaseCount: sampleTestCases[problem.id]?.length || 0
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch problem'
    });
  }
});

// Get solution for a problem (MVP)
router.get('/problem/:id/solution', (req, res) => {
  try {
    const problemId = parseInt(req.params.id);
    const language = req.query.language || 'python';
    
    const solution = sampleSolutions[problemId]?.[language];
    
    if (!solution) {
      return res.status(404).json({
        success: false,
        error: 'Solution not found'
      });
    }

    res.json({
      success: true,
      solution,
      language,
      problemId
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch solution'
    });
  }
});

// Get test cases for a problem (for validation)
router.get('/problem/:id/testcases', (req, res) => {
  try {
    const problemId = parseInt(req.params.id);
    const testCases = sampleTestCases[problemId];
    
    if (!testCases) {
      return res.status(404).json({
        success: false,
        error: 'Test cases not found'
      });
    }

    res.json({
      success: true,
      testCases,
      problemId
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch test cases'
    });
  }
});

// Validate code against test cases (MVP - simplified)
router.post('/validate', (req, res) => {
  try {
    const { code, problemId, language } = req.body;
    
    // In MVP, we'll do basic validation
    // Later this will use Judge0 API for actual code execution
    const testCases = sampleTestCases[problemId];
    
    if (!testCases) {
      return res.status(400).json({
        success: false,
        error: 'Invalid problem ID'
      });
    }

    // Simplified validation - just check if code is not empty and has basic structure
    const isValid = code && code.trim().length > 0 && 
                   (code.includes('def ') || code.includes('function '));

    const results = testCases.map((testCase, index) => ({
      testCase: index + 1,
      passed: isValid, // Simplified - all pass if code looks valid
      input: testCase.input,
      expected: testCase.expected,
      actual: isValid ? testCase.expected : null
    }));

    res.json({
      success: true,
      allPassed: isValid,
      results,
      totalTests: testCases.length,
      passedTests: isValid ? testCases.length : 0
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Validation failed'
    });
  }
});

// Get game statistics (placeholder for future)
router.get('/stats', (req, res) => {
  res.json({
    success: true,
    stats: {
      totalGames: 0,
      activeGames: 0,
      totalPlayers: 0
    }
  });
});

module.exports = router;
