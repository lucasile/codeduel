// Test problems for rapid local testing (bypass Vellum API)
const testProblems = [
  {
    id: "test-1",
    title: "Two Sum",
    description: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.\n\nYou can return the answer in any order.",
    difficulty: "Easy",
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
    solution: `def solve(nums, target):
    hashmap = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in hashmap:
            return [hashmap[complement], i]
        hashmap[num] = i
    return []`,
    testCases: [
      {
        input: "[2, 7, 11, 15], 9",
        expected: "[0, 1]"
      },
      {
        input: "[3, 2, 4], 6",
        expected: "[1, 2]"
      },
      {
        input: "[3, 3], 6",
        expected: "[0, 1]"
      }
    ]
  },
  {
    id: "test-2",
    title: "Valid Parentheses",
    description: "Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.\n\nAn input string is valid if:\n1. Open brackets must be closed by the same type of brackets.\n2. Open brackets must be closed in the correct order.\n3. Every close bracket has a corresponding open bracket of the same type.",
    difficulty: "Easy",
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
    ],
    solution: `def solve(s):
    stack = []
    mapping = {')': '(', '}': '{', ']': '['}
    
    for char in s:
        if char in mapping:
            if not stack or stack.pop() != mapping[char]:
                return False
        else:
            stack.append(char)
    
    return not stack`,
    testCases: [
      {
        input: "()",
        expected: "true"
      },
      {
        input: "()[]{}",
        expected: "true"
      },
      {
        input: "(]",
        expected: "false"
      },
      {
        input: "([)]",
        expected: "false"
      }
    ]
  },
  {
    id: "test-3",
    title: "Maximum Subarray",
    description: "Given an integer array nums, find the contiguous subarray (containing at least one number) which has the largest sum and return its sum.\n\nA subarray is a contiguous part of an array.",
    difficulty: "Medium",
    examples: [
      {
        input: "nums = [-2,1,-3,4,-1,2,1,-5,4]",
        output: "6",
        explanation: "[4,-1,2,1] has the largest sum = 6."
      },
      {
        input: "nums = [1]",
        output: "1"
      },
      {
        input: "nums = [5,4,-1,7,8]",
        output: "23"
      }
    ],
    constraints: [
      "1 <= nums.length <= 10^5",
      "-10^4 <= nums[i] <= 10^4"
    ],
    solution: `def solve(nums):
    max_sum = nums[0]
    current_sum = nums[0]
    
    for i in range(1, len(nums)):
        current_sum = max(nums[i], current_sum + nums[i])
        max_sum = max(max_sum, current_sum)
    
    return max_sum`,
    testCases: [
      {
        input: "[-2, 1, -3, 4, -1, 2, 1, -5, 4]",
        expected: "6"
      },
      {
        input: "[1]",
        expected: "1"
      },
      {
        input: "[5, 4, -1, 7, 8]",
        expected: "23"
      },
      {
        input: "[-1]",
        expected: "-1"
      }
    ]
  },
  {
    id: "test-4",
    title: "Palindrome Number",
    description: "Given an integer x, return true if x is palindrome integer.\n\nAn integer is a palindrome when it reads the same backward as forward.\n\nFor example, 121 is a palindrome while 123 is not.",
    difficulty: "Easy",
    examples: [
      {
        input: "x = 121",
        output: "true",
        explanation: "121 reads as 121 from left to right and from right to left."
      },
      {
        input: "x = -121",
        output: "false",
        explanation: "From left to right, it reads -121. From right to left, it becomes 121-. Therefore it is not a palindrome."
      },
      {
        input: "x = 10",
        output: "false",
        explanation: "Reads 01 from right to left. Therefore it is not a palindrome."
      }
    ],
    constraints: [
      "-2^31 <= x <= 2^31 - 1"
    ],
    solution: `def solve(x):
    if x < 0 or (x % 10 == 0 and x != 0):
        return False
    
    reversed_half = 0
    while x > reversed_half:
        reversed_half = reversed_half * 10 + x % 10
        x //= 10
    
    return x == reversed_half or x == reversed_half // 10`,
    testCases: [
      {
        input: "121",
        expected: "true"
      },
      {
        input: "-121",
        expected: "false"
      },
      {
        input: "10",
        expected: "false"
      },
      {
        input: "0",
        expected: "true"
      }
    ]
  },
  {
    id: "test-5",
    title: "Reverse Integer",
    description: "Given a signed 32-bit integer x, return x with its digits reversed. If reversing x causes the value to go outside the signed 32-bit integer range [-2^31, 2^31 - 1], then return 0.\n\nAssume the environment does not allow you to store 64-bit integers (signed or unsigned).",
    difficulty: "Medium",
    examples: [
      {
        input: "x = 123",
        output: "321"
      },
      {
        input: "x = -123",
        output: "-321"
      },
      {
        input: "x = 120",
        output: "21"
      }
    ],
    constraints: [
      "-2^31 <= x <= 2^31 - 1"
    ],
    solution: `def solve(x):
    sign = -1 if x < 0 else 1
    x = abs(x)
    
    result = 0
    while x:
        result = result * 10 + x % 10
        x //= 10
    
    result *= sign
    
    # Check for 32-bit integer overflow
    if result < -2**31 or result > 2**31 - 1:
        return 0
    
    return result`,
    testCases: [
      {
        input: "123",
        expected: "321"
      },
      {
        input: "-123",
        expected: "-321"
      },
      {
        input: "120",
        expected: "21"
      },
      {
        input: "0",
        expected: "0"
      }
    ]
  }
];

module.exports = { testProblems };
