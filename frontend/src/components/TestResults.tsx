import React from 'react';
import styled from 'styled-components';

const ResultsContainer = styled.div`
  background: rgba(0, 0, 0, 0.8);
  border: 1px solid #3e3e42;
  border-radius: 8px;
  padding: 1rem;
  margin: 1rem 0;
  color: white;
`;

const ResultsHeader = styled.div<{ success: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  color: ${props => props.success ? '#10b981' : '#ef4444'};
  font-weight: 600;
  font-size: 1.1rem;
`;

const Summary = styled.div`
  margin-bottom: 1rem;
  color: #d1d5db;
`;

const TestCaseList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const TestCase = styled.div<{ passed: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem;
  background: ${props => props.passed ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'};
  border: 1px solid ${props => props.passed ? '#10b981' : '#ef4444'};
  border-radius: 4px;
`;

const TestCaseInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const TestCaseStatus = styled.span<{ passed: boolean }>`
  color: ${props => props.passed ? '#10b981' : '#ef4444'};
  font-weight: 600;
`;

const ErrorDetails = styled.div`
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid #ef4444;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  color: #fca5a5;
`;

interface TestResult {
  testCase: number;
  passed: boolean;
  status: string;
  error?: string;
}

interface TestResultsData {
  summary: string;
  passedCount: number;
  totalCount: number;
  details?: TestResult[];
  error?: string;
}

interface TestResultsProps {
  results: TestResultsData;
  isVisible: boolean;
  onClose: () => void;
}

const TestResults: React.FC<TestResultsProps> = ({ results, isVisible, onClose }) => {
  if (!isVisible) return null;

  const success = results.passedCount === results.totalCount;

  return (
    <ResultsContainer>
      <ResultsHeader success={success}>
        {success ? '✅' : '❌'}
        Test Results
        <button 
          onClick={onClose}
          style={{
            marginLeft: 'auto',
            background: 'transparent',
            border: 'none',
            color: '#9ca3af',
            cursor: 'pointer',
            fontSize: '1.2rem'
          }}
        >
          ×
        </button>
      </ResultsHeader>

      <Summary>
        {results.summary}
      </Summary>

      {results.error && (
        <ErrorDetails>
          <strong>Error:</strong> {results.error}
        </ErrorDetails>
      )}

      {results.details && results.details.length > 0 && (
        <TestCaseList>
          {results.details.map((testCase, index) => (
            <TestCase key={index} passed={testCase.passed}>
              <TestCaseInfo>
                <span>Test Case {testCase.testCase}:</span>
                <TestCaseStatus passed={testCase.passed}>
                  {testCase.passed ? 'PASSED' : 'FAILED'}
                </TestCaseStatus>
                <span style={{ color: '#9ca3af', fontSize: '0.9rem' }}>
                  ({testCase.status})
                </span>
              </TestCaseInfo>
              
              {testCase.error && (
                <ErrorDetails>
                  {testCase.error}
                </ErrorDetails>
              )}
            </TestCase>
          ))}
        </TestCaseList>
      )}
    </ResultsContainer>
  );
};

export default TestResults;
