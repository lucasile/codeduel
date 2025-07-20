const axios = require('axios');

// Judge0 API configuration
const JUDGE0_API_URL = process.env.JUDGE0_API_URL || 'https://judge0-ce.p.rapidapi.com';
const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY || '';

// Language IDs for Judge0 (Python 3)
const LANGUAGE_IDS = {
  python: 71, // Python 3.8.1
  javascript: 63, // Node.js 12.14.0
  java: 62, // Java OpenJDK 13.0.1
  cpp: 54, // C++ (GCC 9.2.0)
};

/**
 * Submit code for execution on Judge0
 * @param {string} code - The code to execute
 * @param {string} language - Programming language ('python', 'javascript', etc.)
 * @param {string} stdin - Input for the program
 * @param {string} expectedOutput - Expected output for comparison
 * @returns {Promise<Object>} Submission result
 */
async function submitCode(code, language = 'python', stdin = '', expectedOutput = '') {
  try {
    const languageId = LANGUAGE_IDS[language];
    if (!languageId) {
      throw new Error(`Unsupported language: ${language}`);
    }

    const submissionData = {
      source_code: Buffer.from(code).toString('base64'),
      language_id: languageId,
      stdin: Buffer.from(stdin).toString('base64'),
      expected_output: Buffer.from(expectedOutput).toString('base64')
    };

    const headers = {
      'Content-Type': 'application/json',
    };

    // Add RapidAPI headers if API key is provided
    if (JUDGE0_API_KEY) {
      headers['X-RapidAPI-Key'] = JUDGE0_API_KEY;
      headers['X-RapidAPI-Host'] = 'judge0-ce.p.rapidapi.com';
    }

    console.log('🔧 Submitting code to Judge0...');
    const response = await axios.post(`${JUDGE0_API_URL}/submissions?base64_encoded=true&wait=true`, submissionData, {
      headers,
      timeout: 15000 // 15 second timeout
    });

    return response.data;
  } catch (error) {
    console.error('❌ Judge0 submission error:', error.message);
    throw error;
  }
}

/**
 * Convert modern Python type hints to be compatible with Python < 3.9
 * @param {string} code - Python code with modern type hints
 * @returns {string} Python code with compatible type hints
 */
function convertTypeHintsForCompatibility(code) {
  // Convert list[type] to List[type] and add typing import
  let convertedCode = code;
  
  // Check if we need typing imports
  const needsTyping = /\b(list|dict|set|tuple)\[/.test(code);
  
  if (needsTyping) {
    // Add typing import at the top
    convertedCode = 'from typing import List, Dict, Set, Tuple, Optional\n' + convertedCode;
    
    // Convert modern type hints to typing module equivalents
    convertedCode = convertedCode
      .replace(/\blist\[([^\]]+)\]/g, 'List[$1]')
      .replace(/\bdict\[([^\]]+)\]/g, 'Dict[$1]')
      .replace(/\bset\[([^\]]+)\]/g, 'Set[$1]')
      .replace(/\btuple\[([^\]]+)\]/g, 'Tuple[$1]');
  }
  
  // Remove any remaining problematic type hints that can't be converted
  // This is a fallback for edge cases
  convertedCode = convertedCode.replace(/: [a-zA-Z_][a-zA-Z0-9_]*\[[^\]]+\]/g, '');
  
  return convertedCode;
}

/**
 * Create executable Python code from solution with normal function parameters and test case
 * @param {string} solutionCode - Python solution code with normal function signature
 * @param {Object} testCase - Test case with input and expected output
 * @returns {string} Executable Python code
 */
function createExecutablePythonCode(solutionCode, testCase) {
  try {
    console.log('🔍 Solution code preview:', solutionCode.substring(0, 200) + '...');
    
    // Show the function signature
    const functionSignatureMatch = solutionCode.match(/def\s+\w+\([^)]*\).*?:/);
    if (functionSignatureMatch) {
      console.log('🔍 Function signature:', functionSignatureMatch[0]);
    }
    
    // Parse the test case input
    let testInput;
    if (typeof testCase.input === 'string') {
      try {
        testInput = JSON.parse(testCase.input);
      } catch (e) {
        testInput = testCase.input;
      }
    } else {
      testInput = testCase.input;
    }
    
    console.log(`🔧 Parsed test input:`, testInput);
    console.log(`🔧 Expected: ${testCase.expected}`);
    
    // Determine if we should pass array as single parameter or unpack it
    // Check function signature to see how many parameters it expects
    const functionParams = solutionCode.match(/def\s+\w+\(([^)]*)\)/);
    const paramCount = functionParams && functionParams[1].trim() ? 
      functionParams[1].split(',').length : 0;
    
    console.log(`🔧 Function expects ${paramCount} parameter(s)`);
    
    let functionCall;
    
    // Handle different input formats based on parameter count
    if (paramCount === 1) {
      // Single parameter function
      if (Array.isArray(testInput)) {
        // Get the parameter name to help determine expected type
        const paramName = functionParams && functionParams[1].trim() ? 
          functionParams[1].trim().split(',')[0].trim() : '';
        
        console.log(`🔧 Function parameter name: "${paramName}"`);
        
        // Smart array handling based on parameter name and context
        const arrayIndicators = ['prices', 'nums', 'arr', 'array', 'list', 'values', 'elements'];
        const singleIndicators = ['x', 'n', 'num', 'val', 'value', 'target', 'k'];
        
        const isArrayParam = arrayIndicators.some(indicator => 
          paramName.toLowerCase().includes(indicator));
        const isSingleParam = singleIndicators.some(indicator => 
          paramName.toLowerCase() === indicator);
        
        console.log(`🔧 Parameter analysis: isArrayParam=${isArrayParam}, isSingleParam=${isSingleParam}`);
        
        if (testInput.length === 1 && isSingleParam && !isArrayParam) {
          // Extract single element for clearly single-value parameters
          const singleParam = testInput[0];
          const paramString = typeof singleParam === 'string' ? `"${singleParam}"` : JSON.stringify(singleParam);
          functionCall = `solve(${paramString})`;
          console.log(`🔧 Generated function call (single element extracted): ${functionCall}`);
        } else {
          // Preserve array for array-based parameters or when unsure
          functionCall = `solve(${JSON.stringify(testInput)})`;
          console.log(`🔧 Generated function call (array preserved): ${functionCall}`);
        }
      } else {
        const paramString = typeof testInput === 'string' ? `"${testInput}"` : JSON.stringify(testInput);
        functionCall = `solve(${paramString})`;
        console.log(`🔧 Generated function call (single param): ${functionCall}`);
      }
    } else {
      // Multiple parameter function - need to parse parameters from input
      let parameters = [];
      
      if (Array.isArray(testInput)) {
        // Input is already an array - use as separate parameters
        parameters = testInput;
      } else if (typeof testInput === 'string') {
        // Input is a string that might contain comma-separated parameters
        // Try to parse it intelligently
        try {
          // First, try to split by comma and parse each part
          const parts = [];
          let currentPart = '';
          let bracketDepth = 0;
          let inQuotes = false;
          
          for (let i = 0; i < testInput.length; i++) {
            const char = testInput[i];
            
            if (char === '"' || char === "'") {
              inQuotes = !inQuotes;
            }
            
            if (!inQuotes) {
              if (char === '[' || char === '{') {
                bracketDepth++;
              } else if (char === ']' || char === '}') {
                bracketDepth--;
              }
            }
            
            if (char === ',' && bracketDepth === 0 && !inQuotes) {
              parts.push(currentPart.trim());
              currentPart = '';
            } else {
              currentPart += char;
            }
          }
          
          if (currentPart.trim()) {
            parts.push(currentPart.trim());
          }
          
          console.log(`🔧 Parsed ${parts.length} parts from input:`, parts);
          
          // Parse each part
          parameters = parts.map(part => {
            try {
              // Try to parse as JSON first
              return JSON.parse(part);
            } catch (e) {
              // If JSON parsing fails, try to evaluate as a literal
              try {
                return eval(part);
              } catch (e2) {
                // If all else fails, return as string
                return part;
              }
            }
          });
          
        } catch (e) {
          console.log(`⚠️ Failed to parse multi-parameter input: ${e.message}`);
          // Fallback: treat as single parameter
          parameters = [testInput];
        }
      } else {
        // Input is some other type - use as single parameter
        parameters = [testInput];
      }
      
      console.log(`🔧 Final parameters for function call:`, parameters);
      
      // Generate parameter strings for function call
      const paramStrings = parameters.map(param => {
        if (typeof param === 'string') {
          return `"${param}"`;
        } else if (Array.isArray(param)) {
          return JSON.stringify(param);
        } else {
          return JSON.stringify(param);
        }
      });
      
      functionCall = `solve(${paramStrings.join(', ')})`;
      console.log(`🔧 Generated function call (multi-param): ${functionCall}`);
    }
    
    // Create executable code using original solution (no cleaning needed)
    const executableCode = `${solutionCode}

# Test case execution
result = ${functionCall}
print(result)`;
    
    console.log(`🔧 Executable code preview: ${executableCode.substring(0, 400)}...`);
    
    return executableCode;
    
  } catch (error) {
    console.error('❌ Error creating executable code:', error.message);
    console.error('❌ Test case:', testCase);
    // Fallback
    return `# Error creating test\nprint("Test execution failed")`;
  }
}

/**
 * Run test cases against submitted code
 * @param {string} code - The code to test (Python class format)
 * @param {Array} testCases - Array of test cases with input/expected format
 * @param {string} language - Programming language
 * @returns {Promise<Object>} Test results
 */
async function runTestCases(code, testCases, language = 'python') {
  try {
    console.log(`🧪 Running ${testCases.length} test cases...`);
    
    const results = [];
    let passedCount = 0;
    
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      console.log(`🔍 Running test case ${i + 1}/${testCases.length}:`, {
        input: testCase.input,
        expected: testCase.expected
      });
      
      try {
        // Create executable code for this test case
        const executableCode = createExecutablePythonCode(code, testCase);
        console.log('🔧 Executable code:', executableCode.substring(0, 200) + '...');
        
        const result = await submitCode(
          executableCode,
          language,
          '', // No stdin needed, we embed the test in the code
          '' // We'll compare output manually
        );
        
        // Get the actual output
        const rawActualOutput = result.stdout ? Buffer.from(result.stdout, 'base64').toString() : '';
        const actualOutput = rawActualOutput.trim();
        const expectedOutput = String(testCase.expected).trim();
        
        console.log(`🔍 Output comparison for test case ${i + 1}:`);
        console.log(`  Raw actual: "${rawActualOutput}"`);
        console.log(`  Actual (trimmed): "${actualOutput}"`);
        console.log(`  Expected: "${expectedOutput}"`);
        console.log(`  Judge0 status: ${result.status?.id} (${result.status?.description})`);
        
        // Try multiple comparison strategies
        let passed = false;
        let comparisonMethod = 'none';
        
        // Strategy 1: Direct string comparison
        if (actualOutput === expectedOutput && result.status?.id === 3) {
          passed = true;
          comparisonMethod = 'direct_string';
        }
        
        // Strategy 2: Try parsing both as JSON and compare
        if (!passed && (result.status?.id === 3 || result.status?.id === 4)) {
          try {
            const actualParsed = JSON.parse(actualOutput);
            const expectedParsed = JSON.parse(expectedOutput);
            if (JSON.stringify(actualParsed) === JSON.stringify(expectedParsed)) {
              passed = true;
              comparisonMethod = 'json_parse';
            }
          } catch (e) {
            // Not valid JSON, continue to next strategy
          }
        }
        
        // Strategy 3: Try converting between different boolean formats
        if (!passed && (result.status?.id === 3 || result.status?.id === 4)) {
          try {
            console.log(`  🔍 Strategy 3: Boolean conversion attempt`);
            
            // Normalize both actual and expected to compare boolean values
            let normalizedActual = actualOutput.toLowerCase();
            let normalizedExpected = expectedOutput.toLowerCase();
            
            // Convert Python booleans to lowercase
            if (actualOutput === 'True') {
              normalizedActual = 'true';
            } else if (actualOutput === 'False') {
              normalizedActual = 'false';
            }
            
            // Convert expected booleans to lowercase if needed
            if (expectedOutput === 'True') {
              normalizedExpected = 'true';
            } else if (expectedOutput === 'False') {
              normalizedExpected = 'false';
            }
            
            console.log(`    originalActual: "${actualOutput}"`);
            console.log(`    normalizedActual: "${normalizedActual}"`);
            console.log(`    originalExpected: "${expectedOutput}"`);
            console.log(`    normalizedExpected: "${normalizedExpected}"`);
            console.log(`    Match: ${normalizedActual === normalizedExpected}`);
            
            if (normalizedActual === normalizedExpected) {
              passed = true;
              comparisonMethod = 'boolean_normalization';
            }
            
            // Additional check: try interpreting as actual boolean values
            if (!passed) {
              const actualBool = (actualOutput === 'True' || actualOutput === 'true' || actualOutput === '1');
              const expectedBool = (expectedOutput === 'True' || expectedOutput === 'true' || expectedOutput === '1');
              
              console.log(`    actualBool: ${actualBool}`);
              console.log(`    expectedBool: ${expectedBool}`);
              console.log(`    Boolean match: ${actualBool === expectedBool}`);
              
              if (actualBool === expectedBool) {
                passed = true;
                comparisonMethod = 'boolean_value_comparison';
              }
            }
            
          } catch (e) {
            console.log(`  ⚠️ Boolean conversion failed: ${e.message}`);
          }
        }
        
        // Strategy 4: Try converting Python list format to comma-separated format
        if (!passed && (result.status?.id === 3 || result.status?.id === 4)) {
          try {
            console.log(`  🔍 Strategy 4: List conversion attempt`);
            console.log(`    actualOutput starts with '[': ${actualOutput.startsWith('[')}`);
            console.log(`    actualOutput ends with ']': ${actualOutput.endsWith(']')}`);
            console.log(`    Judge0 status ID: ${result.status?.id}`);
            
            // Check if actual output is a Python list and expected is comma-separated
            if (actualOutput.startsWith('[') && actualOutput.endsWith(']')) {
              // Parse the Python list and convert to comma-separated format
              const listContent = actualOutput.slice(1, -1); // Remove [ ]
              const commaSeparated = listContent.replace(/\s+/g, ''); // Remove spaces
              
              console.log(`    listContent: "${listContent}"`);
              console.log(`    commaSeparated: "${commaSeparated}"`);
              console.log(`    expectedOutput: "${expectedOutput}"`);
              console.log(`    Match: ${commaSeparated === expectedOutput}`);
              
              if (commaSeparated === expectedOutput) {
                passed = true;
                comparisonMethod = 'list_to_comma_separated';
              }
            } else {
              console.log(`    ⚠️ Not a Python list format`);
            }
          } catch (e) {
            console.log(`  ⚠️ List conversion failed: ${e.message}`);
          }
        } else if (!passed) {
          console.log(`  🔍 Strategy 4 skipped: passed=${passed}, status=${result.status?.id}`);
        }
        
        // Strategy 5: Try evaluating as Python literals and compare
        if (!passed && (result.status?.id === 3 || result.status?.id === 4)) {
          try {
            // For simple cases like [0, 1] vs "[0, 1]"
            const normalizedActual = actualOutput.replace(/'/g, '"');
            const normalizedExpected = expectedOutput.replace(/'/g, '"');
            
            if (normalizedActual === normalizedExpected) {
              passed = true;
              comparisonMethod = 'normalized_quotes';
            } else {
              // Try parsing both as arrays/objects
              const actualEval = eval(normalizedActual);
              const expectedEval = typeof testCase.expected === 'string' ? eval(testCase.expected) : testCase.expected;
              
              if (JSON.stringify(actualEval) === JSON.stringify(expectedEval)) {
                passed = true;
                comparisonMethod = 'eval_comparison';
              }
            }
          } catch (e) {
            console.log(`  ⚠️ Eval comparison failed: ${e.message}`);
          }
        }
        
        console.log(`  🎯 Result: ${passed ? '✅ PASSED' : '❌ FAILED'} (method: ${comparisonMethod})`);
        
        if (passed) passedCount++;
        
        results.push({
          testCase: i + 1,
          passed,
          input: testCase.input,
          expected: expectedOutput,
          actual: actualOutput,
          error: result.stderr ? Buffer.from(result.stderr, 'base64').toString() : null,
          status: passed ? 'Accepted' : (result.status?.description || 'Unknown'),
          executionTime: result.time || 0,
          memory: result.memory || 0,
          description: testCase.description || `Test case ${i + 1}`
        });
        
      } catch (testError) {
        console.error(`❌ Test case ${i + 1} execution error:`, testError.message);
        results.push({
          testCase: i + 1,
          passed: false,
          input: testCase.input,
          expected: testCase.expected,
          actual: '',
          error: testError.message,
          status: 'Execution Error',
          executionTime: 0,
          memory: 0,
          description: testCase.description || `Test case ${i + 1}`
        });
      }
    }
    
    const success = passedCount === testCases.length;
    console.log(`✅ Test results: ${passedCount}/${testCases.length} passed`);
    
    return {
      success,
      passedCount,
      totalCount: testCases.length,
      results,
      summary: `${passedCount}/${testCases.length} test cases passed`
    };
    
  } catch (error) {
    console.error('❌ Test execution error:', error.message);
    throw error;
  }
}

/**
 * Check if Judge0 service is available and get system info
 * @returns {Promise<Object>} Service status and info
 */
async function checkJudge0Health() {
  try {
    console.log(`🔍 Checking Judge0 health at: ${JUDGE0_API_URL}`);
    
    // Test basic connectivity
    const systemInfoResponse = await axios.get(`${JUDGE0_API_URL}/system_info`, {
      timeout: 5000
    });
    
    console.log('✅ Judge0 system info:', systemInfoResponse.data);
    
    // Test languages endpoint
    const languagesResponse = await axios.get(`${JUDGE0_API_URL}/languages`, {
      timeout: 5000
    });
    
    console.log(`🔍 Available languages: ${languagesResponse.data.length}`);
    
    // Test configuration endpoint
    const configResponse = await axios.get(`${JUDGE0_API_URL}/config_info`, {
      timeout: 5000
    });
    
    console.log('⚙️ Judge0 config:', configResponse.data);
    
    return {
      available: true,
      systemInfo: systemInfoResponse.data,
      languageCount: languagesResponse.data.length,
      config: configResponse.data
    };
    
  } catch (error) {
    console.error('❌ Judge0 health check failed:', error.message);
    console.error('❌ Error details:', {
      code: error.code,
      response: error.response?.status,
      data: error.response?.data
    });
    
    return {
      available: false,
      error: error.message,
      code: error.code,
      status: error.response?.status
    };
  }
}

/**
 * Test Judge0 with a simple submission
 * @returns {Promise<Object>} Test result
 */
async function testJudge0SimpleSubmission() {
  try {
    console.log('🧪 Testing Judge0 with simple Python code...');
    
    const testCode = 'print("Hello, Judge0!")';
    const result = await submitCode(testCode, 'python', '', '');
    
    console.log('✅ Simple test result:', {
      status: result.status?.description,
      stdout: result.stdout ? Buffer.from(result.stdout, 'base64').toString() : 'No output',
      stderr: result.stderr ? Buffer.from(result.stderr, 'base64').toString() : 'No errors',
      time: result.time,
      memory: result.memory
    });
    
    return result;
    
  } catch (error) {
    console.error('❌ Simple Judge0 test failed:', error.message);
    throw error;
  }
}

/**
 * Legacy function for backward compatibility
 * @returns {Promise<boolean>} Service availability
 */
async function isJudge0Available() {
  const health = await checkJudge0Health();
  return health.available;
}

/**
 * Validate if Judge0 service is available
 * @returns {Promise<boolean>} Service availability
 */
async function validateService() {
  try {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (JUDGE0_API_KEY) {
      headers['X-RapidAPI-Key'] = JUDGE0_API_KEY;
      headers['X-RapidAPI-Host'] = 'judge0-ce.p.rapidapi.com';
    }

    const response = await axios.get(`${JUDGE0_API_URL}/languages`, {
      headers,
      timeout: 10000
    });
    
    console.log('✅ Judge0 service is available');
    return true;
  } catch (error) {
    console.error('❌ Judge0 service validation failed:', error.message);
    return false;
  }
}

module.exports = {
  submitCode,
  runTestCases,
  isJudge0Available,
  validateService,
  checkJudge0Health,
  testJudge0SimpleSubmission,
  LANGUAGE_IDS
};
