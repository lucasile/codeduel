import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useSocket } from '../context/SocketContext';
import CodeEditor from './CodeEditor';
import GameHeader from './GameHeader';
import PlayerPanel from './PlayerPanel';
import ProblemPanel from './ProblemPanel';

const GameContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #1e1e1e;
  color: white;
`;

const GameContent = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
`;

const LeftPanel = styled.div`
  width: 350px;
  background: #252526;
  border-right: 1px solid #3e3e42;
  display: flex;
  flex-direction: column;
`;

const CenterPanel = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
`;

const RightPanel = styled.div`
  width: 300px;
  background: #252526;
  border-left: 1px solid #3e3e42;
  display: flex;
  flex-direction: column;
`;

const WaitingScreen = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: linear-gradient(135deg, #408c2dff 0%, #164406ff 100%);
`;

const WinnerScreen = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: linear-gradient(135deg, #ffd700 0%, #ff8c00 100%);
  animation: celebration 2s ease-in-out;

  @keyframes celebration {
    0% { transform: scale(0.8); opacity: 0; }
    50% { transform: scale(1.1); }
    100% { transform: scale(1); opacity: 1; }
  }
`;

const WinnerTitle = styled.h1`
  color: white;
  font-size: 4rem;
  margin-bottom: 1rem;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
  animation: pulse 2s infinite;

  @keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
  }
`;

const WinnerSubtitle = styled.h2`
  color: white;
  font-size: 1.5rem;
  margin-bottom: 2rem;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
`;

const FinalScoreDisplay = styled.div`
  background: rgba(255, 255, 255, 0.2);
  padding: 2rem;
  border-radius: 15px;
  color: white;
  font-size: 1.3rem;
  margin-bottom: 3rem;
  text-align: center;
  min-width: 300px;
`;

const PlayAgainButton = styled.button`
  padding: 1rem 3rem;
  background: linear-gradient(135deg, #00b894 0%, #00a085 100%);
  color: white;
  border: none;
  border-radius: 50px;
  cursor: pointer;
  font-size: 1.2rem;
  font-weight: 600;
  box-shadow: 0 4px 15px rgba(0, 184, 148, 0.4);
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 184, 148, 0.6);
    background: linear-gradient(135deg, #00a085 0%, #00b894 100%);
  }

  &:active {
    transform: translateY(0px);
  }
`;

const WaitingTitle = styled.h2`
  color: white;
  font-size: 2rem;
  margin-bottom: 1rem;
`;

const GameIdDisplay = styled.div`
  background: rgba(255, 255, 255, 0.2);
  padding: 1rem 2rem;
  border-radius: 10px;
  color: white;
  font-size: 1.2rem;
  margin-bottom: 2rem;
`;

const LoadingSpinner = styled.div`
  width: 50px;
  height: 50px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top: 3px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

interface Player {
  id: string;
  name: string;
}

interface GameState {
  gameId: string;
  players: Player[];
  currentRound: number;
  maxRounds: number;
  currentPhase: 'waiting' | 'bug_introduction' | 'debugging' | 'validation' | 'finished';
  bugIntroducer: string | null;
  debugger: string | null;
  timeLeft: number;
  scores: { player1: number; player2: number };
  powerUps: {
    player1: { lineCorruption: number; timeFreeze: number };
    player2: { lineCorruption: number; timeFreeze: number };
  };
}

const GameRoom: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { socket, isConnected } = useSocket();
  
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [currentProblem, setCurrentProblem] = useState<any>(null);
  const [currentSolution, setCurrentSolution] = useState<string>('');
  const [buggyCode, setBuggyCode] = useState<string>('');
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [lineCorruptionActive, setLineCorruptionActive] = useState(false);
  const [playerId, setPlayerId] = useState<string>('');
  const [isRoundLoading, setIsRoundLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  // Debug: Track currentSolution changes
  useEffect(() => {
    console.log('🔍 currentSolution state changed:', {
      length: currentSolution.length,
      preview: currentSolution.substring(0, 100) + (currentSolution.length > 100 ? '...' : ''),
      isEmpty: currentSolution === ''
    });
  }, [currentSolution]);

  // Function to fetch random problem for the game
  const fetchRandomProblemForGame = async () => {
    try {
      console.log('🎲 Fetching random problem for game...');
      const response = await fetch('/api/game/problem/random');
      const data = await response.json();
      
      if (data.success) {
        const { problem } = data;
        
        // Fetch solution and test cases
        const [solutionResponse, testCasesResponse] = await Promise.all([
          fetch(`/api/game/problem/${problem.id}/solution?language=python`),
          fetch(`/api/game/problem/${problem.id}/testcases`)
        ]);
        
        const solutionData = await solutionResponse.json();
        const testCasesData = await testCasesResponse.json();
        
        if (solutionData.success && testCasesData.success) {
          handleSubmitProblem(problem, solutionData.solution, testCasesData.testCases);
          console.log('🎲 Successfully loaded random problem:', problem.title);
        }
      }
    } catch (error) {
      console.error('🎲 Failed to fetch random problem:', error);
    }
  };

  useEffect(() => {
    if (!socket || !isConnected || !gameId) {
      console.log('🔌 Socket setup skipped:', { socket: !!socket, isConnected, gameId });
      return;
    }
    
    console.log('🔌 Setting up socket event listeners for gameId:', gameId);
    
    // Request current game state since we might have missed the game_joined event
    // This happens because HomePage consumes the game_joined event with socket.once()
    socket.emit('get_game_state', { gameId });

    // Socket event listeners
    socket.on('game_joined', (data) => {
      console.log('🔌 Frontend received game_joined event:', data);
      setPlayerId(data.playerId);
      // Initialize gameState when joining
      const initialState = {
        gameId: data.gameId,
        players: data.players,
        currentRound: 0,
        maxRounds: 3,
        currentPhase: 'waiting' as const,
        bugIntroducer: null,
        debugger: null,
        timeLeft: 180,
        scores: { player1: 0, player2: 0 },
        powerUps: {
          player1: { lineCorruption: 1, timeFreeze: 1 },
          player2: { lineCorruption: 1, timeFreeze: 1 }
        }
      };
      console.log('🔌 Setting initial gameState:', initialState);
      setGameState(initialState);
    });

    socket.on('player_joined', (data) => {
      setGameState(prev => prev ? { ...prev, players: data.players } : prev);
    });

    socket.on('game_started', (data) => {
      console.log('🎮 Frontend received game_started event:', data);
      setIsGameStarted(true);
      setGameState(prev => {
        console.log('🎮 Previous gameState:', prev);
        const newState = prev ? {
          ...prev,
          currentRound: data.currentRound,
          maxRounds: data.maxRounds,
          currentPhase: data.currentPhase,
          bugIntroducer: data.bugIntroducer,
          debugger: data.debugger,
          timeLeft: data.timeLeft
        } : null;
        console.log('🎮 New gameState:', newState);
        return newState;
      });
      
      // Note: Backend now auto-sends problems, no need to fetch here
    });

    socket.on('problem_loaded', (data) => {
      console.log('🎲 Problem received:', {
        title: data.problem?.title || 'No title',
        hasDescription: !!data.problem?.description,
        descriptionLength: data.problem?.description?.length || 0,
        hasTestCases: !!data.testCases,
        testCasesCount: Array.isArray(data.testCases) ? data.testCases.length : 0
      });
      
      console.log('🔍 Setting currentProblem to:', data.problem);
      setCurrentProblem(data.problem);
      
      // Update game state with test cases if available
      if (data.testCases) {
        setGameState(prev => prev ? {
          ...prev,
          testCases: data.testCases
        } : null);
      }
    });
    
    // NEW: Handle solution sent only to bug introducer
    socket.on('solution_ready', (data) => {
      console.log('✅ Solution received (bug introducer only):', data.solution.substring(0, 50) + '...');
      console.log('🔍 Setting currentSolution state to:', data.solution.length, 'characters');
      console.log('🔍 Full solution data:', data);
      console.log('🔍 Current gameState:', gameState);
      console.log('🔍 Am I the bug introducer?', gameState?.bugIntroducer === playerId);
      setCurrentSolution(data.solution);
    });

    // Handle round loading states
    socket.on('round_loading', (data) => {
      console.log('⏳ Round loading:', data.message);
      setIsRoundLoading(true);
      setLoadingMessage(data.message);
      // Clear previous round data
      setCurrentProblem(null);
      setCurrentSolution('');
      setBuggyCode('');
    });

    socket.on('round_ready', () => {
      console.log('✅ Round ready, clearing loading state');
      setIsRoundLoading(false);
      setLoadingMessage('');
    });

    socket.on('debugging_phase', (data) => {
      setBuggyCode(data.buggyCode);
      setGameState(prev => prev ? {
        ...prev,
        currentPhase: 'debugging',
        timeLeft: data.timeLeft
      } : null);
    });

    socket.on('bug_introduced', (data) => {
      console.log('🐛 Bug introduced - debugger receives buggy code only');
      setBuggyCode(data.buggyCode);
      
      // Clear solution for debugger (they should never see the original solution)
      if (gameState?.currentPhase === 'debugging' && gameState.debugger === playerId) {
        setCurrentSolution(''); // Debugger doesn't get the solution!
        console.log('🚫 Debugger: Solution cleared, only buggy code visible');
      }
      
      setGameState(prev => prev ? {
        ...prev,
        currentPhase: data.phase,
        timeLeft: data.timeLeft
      } : null);
    });

    socket.on('round_complete', (data) => {
      setGameState(prev => prev ? {
        ...prev,
        scores: data.scores,
        currentPhase: 'validation'
      } : null);
    });

    socket.on('new_round', (data) => {
      setGameState(prev => prev ? {
        ...prev,
        currentRound: data.currentRound,
        bugIntroducer: data.bugIntroducer,
        debugger: data.debugger,
        currentPhase: data.phase,
        timeLeft: data.timeLeft
      } : null);
      setBuggyCode('');
      // Clear current solution to prepare for fresh problem
      setCurrentSolution('');
      console.log(`🆕 Starting Round ${data.currentRound} - waiting for fresh problem...`);
    });

    socket.on('game_over', (data) => {
      setGameState(prev => prev ? {
        ...prev,
        currentPhase: 'finished'
      } : null);
    });

    socket.on('timer_update', (data) => {
      setGameState(prev => prev ? {
        ...prev,
        timeLeft: data.timeLeft
      } : null);
    });

    socket.on('powerup_used', (data) => {
      console.log(`⚡ Power-up used: ${data.powerUpType} by ${data.playerId}`);
      setGameState(prev => {
        if (!prev) return null;
        
        // Update power-up counts and timer
        const updatedState = {
          ...prev,
          timeLeft: data.timeLeft,
          powerUps: { ...prev.powerUps }
        };
        
        // Find which player used the power-up and update their count
        const playerIndex = prev.players.findIndex(p => p.id === data.playerId);
        const playerKey = playerIndex === 0 ? 'player1' : 'player2';
        
        if (playerKey && updatedState.powerUps[playerKey]) {
          updatedState.powerUps[playerKey] = {
            ...updatedState.powerUps[playerKey],
            [data.powerUpType]: data.remainingUses
          };
        }
        
        return updatedState;
      });
      
      if (data.powerUpType === 'timeFreeze') {
        console.log('❄️ Time Freeze activated! +15 seconds added to timer');
      }
    });

    socket.on('player_disconnected', (data) => {
      // Handle player disconnection
      console.log('Player disconnected:', data.playerName);
    });

    return () => {
      socket.off('game_joined');
      socket.off('player_joined');
      socket.off('game_started');
      socket.off('problem_ready');
      socket.off('solution_ready');
      socket.off('bug_introduced');
      socket.off('round_complete');
      socket.off('new_round');
      socket.off('game_over');
      socket.off('timer_update');
      socket.off('powerup_used');
      socket.off('player_disconnected');
    };
  }, [socket, isConnected, gameId]);

  const handleSubmitProblem = (problem: any, solution: string, testCases: any[]) => {
    if (!socket || !gameId) return;
    
    socket.emit('submit_problem', {
      gameId,
      problem,
      solution,
      testCases
    });
  };

  const handleIntroduceBug = (buggyCode: string, lineNumber: number, editedLines: number[]) => {
    if (!socket || !gameId) return;
    
    console.log(`🐛 Bug introduced on ${editedLines.length} line(s):`, editedLines);
    
    socket.emit('introduce_bug', {
      gameId,
      buggyCode,
      lineNumber,
      editedLines
    });
    
    // Reset line corruption after use
    if (lineCorruptionActive) {
      setLineCorruptionActive(false);
      console.log('⚡ Line Corruption power-up used!');
    }
  };

  const handleSubmitFix = (fixedCode: string, foundBugLine: number) => {
    if (!socket || !gameId) return;
    
    socket.emit('submit_fix', {
      gameId,
      fixedCode,
      foundBugLine
    });
  };

  const handleUsePowerUp = (powerUpType: 'lineCorruption' | 'timeFreeze') => {
    if (!socket || !gameId) return;
    
    socket.emit('use_powerup', {
      gameId,
      powerUpType
    });
  };

  if (!isConnected) {
    return (
      <WaitingScreen>
        <WaitingTitle>🔌 Connecting to server...</WaitingTitle>
        <LoadingSpinner />
      </WaitingScreen>
    );
  }

  if (!isGameStarted || !gameState) {
    return (
      <WaitingScreen>
        <WaitingTitle>⏳Waiting for players...</WaitingTitle>
        <GameIdDisplay>
          Game ID: <strong>{gameId}</strong>
        </GameIdDisplay>
        <p style={{ color: 'rgba(255, 255, 255, 0.8)', marginBottom: '2rem' }}>
          Share this ID with your opponent to start the duel!
        </p>
        <LoadingSpinner />
      </WaitingScreen>
    );
  }

  const isMyTurn = (phase: string) => {
    if (phase === 'bug_introduction') {
      return gameState.bugIntroducer === playerId;
    } else if (phase === 'debugging') {
      return gameState.debugger === playerId;
    }
    return false;
  };

  return (
    <GameContainer>
      {/* Loading Screen Overlay */}
      {isRoundLoading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          color: 'white'
        }}>
          <div style={{
            textAlign: 'center',
            padding: '2rem'
          }}>
            <div style={{
              width: '60px',
              height: '60px',
              border: '4px solid #333',
              borderTop: '4px solid #00d2ff',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 1rem'
            }}></div>
            <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem' }}>{loadingMessage}</h2>
            <p style={{ margin: 0, opacity: 0.8 }}>Preparing your next coding challenge...</p>
          </div>
        </div>
      )}
      <GameHeader
        gameState={gameState}
        playerId={playerId}
        onUsePowerUp={handleUsePowerUp}
      />
      
      <GameContent>
        <LeftPanel>
          <ProblemPanel
            problem={currentProblem}
            onSubmitProblem={handleSubmitProblem}
            canSubmit={gameState.currentPhase === 'waiting'}
          />
        </LeftPanel>

        <CenterPanel>
          <CodeEditor
            initialCode={currentSolution}
            buggyCode={buggyCode}
            gamePhase={gameState.currentPhase}
            isMyTurn={isMyTurn(gameState.currentPhase)}
            lineCorruptionActive={lineCorruptionActive}
            onIntroduceBug={handleIntroduceBug}
            onSubmitFix={handleSubmitFix}
          />
        </CenterPanel>

        <RightPanel>
          <PlayerPanel
            players={gameState.players}
            scores={gameState.scores}
            powerUps={gameState.powerUps}
            currentPlayerId={playerId}
            bugIntroducer={gameState.bugIntroducer}
            debuggerPlayer={gameState.debugger}
            currentPhase={gameState.currentPhase}
          />
          
          {/* Power-ups Panel */}
          {(gameState.currentPhase === 'bug_introduction' || gameState.currentPhase === 'debugging') && isMyTurn(gameState.currentPhase) && (
            <div style={{ marginTop: '20px', padding: '15px', border: '2px solid #ff6b6b', borderRadius: '8px', backgroundColor: '#ffe0e0' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#d63031' }}>⚡ Power-ups</h4>
              
              {/* Line Corruption - Bug Introducer Only */}
              {gameState.currentPhase === 'bug_introduction' && (() => {
                const playerIndex = gameState.players.findIndex(p => p.id === playerId);
                const playerKey = playerIndex === 0 ? 'player1' : 'player2';
                const lineCorruptionUses = gameState.powerUps[playerKey]?.lineCorruption || 0;
                const canUseLineCorruption = lineCorruptionUses > 0 && !lineCorruptionActive;
                
                return (
                  <div style={{ marginBottom: '10px' }}>
                    <button 
                      onClick={() => {
                        if (canUseLineCorruption) {
                          handleUsePowerUp('lineCorruption');
                          setLineCorruptionActive(true);
                        } else if (lineCorruptionActive) {
                          setLineCorruptionActive(false);
                        }
                      }}
                      disabled={lineCorruptionUses === 0 && !lineCorruptionActive}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: lineCorruptionActive ? '#00b894' : (canUseLineCorruption ? '#fd79a8' : '#95a5a6'),
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: (canUseLineCorruption || lineCorruptionActive) ? 'pointer' : 'not-allowed',
                        fontSize: '14px',
                        width: '100%',
                        opacity: (canUseLineCorruption || lineCorruptionActive) ? 1 : 0.6
                      }}
                    >
                      {lineCorruptionActive ? '✅ Line Corruption Active' : 
                       (canUseLineCorruption ? '💥 Activate Line Corruption' : '💥 Line Corruption Used')}
                    </button>
                    <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#636e72' }}>
                      {lineCorruptionActive ? 'You can edit 2 lines!' : 
                       `Edit 2 lines instead of 1 (${lineCorruptionUses} use${lineCorruptionUses !== 1 ? 's' : ''} left this game)`}
                    </p>
                  </div>
                );
              })()}
              
              {/* Time Freeze - Both Phases */}
              <div>
                {(() => {
                  const playerIndex = gameState.players.findIndex(p => p.id === playerId);
                  const playerKey = playerIndex === 0 ? 'player1' : 'player2';
                  const timeFreezeUses = gameState.powerUps[playerKey]?.timeFreeze || 0;
                  const canUseTimeFreeze = timeFreezeUses > 0;
                  
                  return (
                    <>
                      <button 
                        onClick={() => {
                          if (canUseTimeFreeze) {
                            handleUsePowerUp('timeFreeze');
                            console.log('❄️ Time Freeze button clicked - calling backend');
                          }
                        }}
                        disabled={!canUseTimeFreeze}
                        style={{
                          padding: '8px 12px',
                          backgroundColor: canUseTimeFreeze ? '#74b9ff' : '#95a5a6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: canUseTimeFreeze ? 'pointer' : 'not-allowed',
                          fontSize: '14px',
                          width: '100%',
                          opacity: canUseTimeFreeze ? 1 : 0.6
                        }}
                      >
                        {canUseTimeFreeze ? '❄️ Use Time Freeze' : '❄️ Time Freeze Used'}
                      </button>
                      <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#636e72' }}>
                        Pause timer for 15 seconds ({timeFreezeUses} use{timeFreezeUses !== 1 ? 's' : ''} left this game)
                      </p>
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </RightPanel>
      </GameContent>
    </GameContainer>
  );
};

export default GameRoom;
