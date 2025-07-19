import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import axios from 'axios';

const PanelContainer = styled.div`
  padding: 1rem;
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
`;

const PanelTitle = styled.h3`
  color: white;
  margin-bottom: 1rem;
  font-size: 1.1rem;
  border-bottom: 1px solid #3e3e42;
  padding-bottom: 0.5rem;
`;

const ProblemCard = styled.div`
  padding: 1rem;
  margin-bottom: 1rem;
`;

const ProblemTitle = styled.h4`
  color: #10b981;
  margin-bottom: 0.5rem;
  font-size: 1rem;
`;

const DifficultyBadge = styled.span<{ difficulty: string }>`
  background: ${props => {
    switch (props.difficulty.toLowerCase()) {
      case 'easy': return '#10b981';
      case 'medium': return '#f59e0b';
      case 'hard': return '#ef4444';
      default: return '#6b7280';
    }
  }};
  color: white;
  padding: 0.2rem 0.5rem;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  display: inline-block;
`;

const ProblemDescription = styled.div`
  color: #d1d5db;
  font-size: 0.9rem;
  line-height: 1.4;
  margin-bottom: 1rem;
  word-wrap: break-word;
  overflow-wrap: break-word;
  white-space: normal;
  max-width: 100%;
  
  /* Style HTML elements within the description */
  p {
    margin: 0.5rem 0;
  }
  
  code {
    background: rgba(0, 0, 0, 0.3);
    padding: 0.2rem 0.4rem;
    border-radius: 3px;
    font-family: 'Courier New', monospace;
    font-size: 0.85em;
  }
  
  strong {
    font-weight: 600;
    color: #f3f4f6;
  }
  
  ul, ol {
    margin: 0.5rem 0;
    padding-left: 1.5rem;
  }
  
  li {
    margin: 0.2rem 0;
  }
`;

const ExampleSection = styled.div`
  margin-bottom: 1rem;
`;

const ExampleTitle = styled.div`
  color: white;
  font-weight: 600;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
`;

const ExampleCode = styled.pre`
  background: rgba(0, 0, 0, 0.3);
  padding: 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  color: #d1d5db;
  overflow-x: auto;
  margin-bottom: 0.5rem;
  word-wrap: break-word;
  overflow-wrap: break-word;
  white-space: pre-wrap;
  max-width: 100%;
  
  /* Ensure long lines wrap instead of overflow */
  word-break: break-all;
`;

const Button = styled.button`
  background: #007acc;
  color: white;
  border: none;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  margin-bottom: 0.5rem;
  width: 100%;

  &:hover {
    background: #005a9e;
  }

  &:disabled {
    background: #6b7280;
    cursor: not-allowed;
  }
`;

const LoadingSpinner = styled.div`
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto;

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const ErrorMessage = styled.div`
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid #ef4444;
  color: #ef4444;
  padding: 1rem;
  border-radius: 6px;
  margin-bottom: 1rem;
  font-size: 0.9rem;
`;

interface Problem {
  id: number;
  title: string;
  difficulty: string;
  description: string;
  examples: Array<{
    input: string;
    output: string;
    explanation?: string;
  }>;
  constraints: string[];
}

interface ProblemPanelProps {
  problem: Problem | null;
  onSubmitProblem: (problem: Problem, solution: string, testCases: any[]) => void;
  canSubmit: boolean;
}

const ProblemPanel: React.FC<ProblemPanelProps> = ({ 
  problem, 
  onSubmitProblem, 
  canSubmit 
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentProblem, setCurrentProblem] = useState<Problem | null>(problem);

  useEffect(() => {
    setCurrentProblem(problem);
  }, [problem]);

  const fetchRandomProblem = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('🎲 Fetching random problem...');
      const response = await axios.get('/api/game/problem/random');
      console.log('🎲 Problem response:', response.data);
      const { problem: newProblem } = response.data;
      
      // Fetch solution and test cases
      const [solutionResponse, testCasesResponse] = await Promise.all([
        axios.get(`/api/game/problem/${newProblem.id}/solution?language=python`),
        axios.get(`/api/game/problem/${newProblem.id}/testcases`)
      ]);

      const solution = solutionResponse.data.solution;
      const testCases = testCasesResponse.data.testCases;

      setCurrentProblem(newProblem);
      onSubmitProblem(newProblem, solution, testCases);
    } catch (err) {
      setError('Failed to fetch problem. Please try again.');
      console.error('Error fetching problem:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!currentProblem) {
    return (
      <PanelContainer>
        <PanelTitle>📝 Problem</PanelTitle>
        
        {error && <ErrorMessage>{error}</ErrorMessage>}
        
        <Button 
          onClick={fetchRandomProblem} 
          disabled={!canSubmit || isLoading}
        >
          {isLoading ? <LoadingSpinner /> : '🎲 Get Random Problem'}
        </Button>
        
        <div style={{ color: '#9ca3af', fontSize: '0.9rem', textAlign: 'center', marginTop: '1rem' }}>
          Click to fetch a coding problem and start the duel!
        </div>
      </PanelContainer>
    );
  }

  return (
    <PanelContainer>
      <PanelTitle>📝 Problem</PanelTitle>
      
      <ProblemCard>
        <ProblemTitle>{currentProblem.title}</ProblemTitle>
        <DifficultyBadge difficulty={currentProblem.difficulty}>
          {currentProblem.difficulty}
        </DifficultyBadge>
        
        <ProblemDescription 
          dangerouslySetInnerHTML={{ __html: currentProblem.description }}
        />

        {currentProblem.examples && currentProblem.examples.length > 0 && (
          <ExampleSection>
            <ExampleTitle>Examples:</ExampleTitle>
            {currentProblem.examples.map((example, index) => (
              <div key={index}>
                <ExampleCode>
                  Input: {example.input}{'\n'}
                  Output: {example.output}
                </ExampleCode>
                {example.explanation && (
                  <div style={{ color: '#9ca3af', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                    {example.explanation}
                  </div>
                )}
              </div>
            ))}
          </ExampleSection>
        )}

        {currentProblem.constraints && currentProblem.constraints.length > 0 && (
          <ExampleSection>
            <ExampleTitle>Constraints:</ExampleTitle>
            {currentProblem.constraints.map((constraint, index) => (
              <div key={index} style={{ color: '#9ca3af', fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                • {constraint}
              </div>
            ))}
          </ExampleSection>
        )}
      </ProblemCard>

      {canSubmit && (
        <Button 
          onClick={fetchRandomProblem} 
          disabled={isLoading}
        >
          {isLoading ? <LoadingSpinner /> : '🔄 Get New Problem'}
        </Button>
      )}
    </PanelContainer>
  );
};

export default ProblemPanel;
