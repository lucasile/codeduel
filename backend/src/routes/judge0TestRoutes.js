const express = require('express');
const { checkJudge0Health, testJudge0SimpleSubmission } = require('../services/judge0Service');

const router = express.Router();

/**
 * Test Judge0 health and configuration
 * GET /api/judge0/health
 */
router.get('/health', async (req, res) => {
  try {
    console.log('🔍 Judge0 health check requested...');
    const healthResult = await checkJudge0Health();
    
    res.json({
      success: healthResult.available,
      timestamp: new Date().toISOString(),
      judge0Url: process.env.JUDGE0_API_URL || 'https://judge0-ce.p.rapidapi.com',
      ...healthResult
    });
    
  } catch (error) {
    console.error('❌ Judge0 health check route error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Test Judge0 with a simple submission
 * POST /api/judge0/test
 */
router.post('/test', async (req, res) => {
  try {
    console.log('🧪 Judge0 simple test requested...');
    const testResult = await testJudge0SimpleSubmission();
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      testResult: {
        status: testResult.status?.description,
        statusId: testResult.status?.id,
        stdout: testResult.stdout ? Buffer.from(testResult.stdout, 'base64').toString() : null,
        stderr: testResult.stderr ? Buffer.from(testResult.stderr, 'base64').toString() : null,
        time: testResult.time,
        memory: testResult.memory,
        token: testResult.token
      }
    });
    
  } catch (error) {
    console.error('❌ Judge0 test route error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Test Judge0 with custom code
 * POST /api/judge0/custom
 */
router.post('/custom', async (req, res) => {
  try {
    const { code, language = 'python', stdin = '' } = req.body;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Code is required'
      });
    }
    
    console.log('🔧 Judge0 custom test requested...');
    console.log('Code:', code.substring(0, 100) + '...');
    
    const { submitCode } = require('../services/judge0Service');
    const result = await submitCode(code, language, stdin);
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      result: {
        status: result.status?.description,
        statusId: result.status?.id,
        stdout: result.stdout ? Buffer.from(result.stdout, 'base64').toString() : null,
        stderr: result.stderr ? Buffer.from(result.stderr, 'base64').toString() : null,
        time: result.time,
        memory: result.memory,
        token: result.token
      }
    });
    
  } catch (error) {
    console.error('❌ Judge0 custom test error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
