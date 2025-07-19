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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
          player1: { lineCorruption: 3, timeFreeze: 2 },
          player2: { lineCorruption: 3, timeFreeze: 2 }
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

    socket.on('problem_ready', (data) => {
      setCurrentProblem(data.problem);
      setCurrentSolution(data.solution);
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

    socket.on('player_disconnected', (data) => {
      // Handle player disconnection
      console.log('Player disconnected:', data.playerName);
    });

    return () => {
      socket.off('game_joined');
      socket.off('player_joined');
      socket.off('game_started');
      socket.off('problem_ready');
      socket.off('debugging_phase');
      socket.off('bug_introduced');
      socket.off('round_complete');
      socket.off('new_round');
      socket.off('game_over');
      socket.off('timer_update');
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
        <WaitingTitle>⏳ Waiting for players...</WaitingTitle>
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
            player={gameState.debugger}
            isCurrentPlayer={gameState.currentPhase === 'debugging' && gameState.debugger.id === playerId}
            timeLeft={gameState.timeLeft}
          />
          
          {/* Power-ups Panel */}
          {gameState.currentPhase === 'bug_introduction' && isMyTurn(gameState.currentPhase) && (
            <div style={{ marginTop: '20px', padding: '15px', border: '2px solid #ff6b6b', borderRadius: '8px', backgroundColor: '#ffe0e0' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#d63031' }}>⚡ Power-ups</h4>
              <button 
                onClick={() => setLineCorruptionActive(!lineCorruptionActive)}
                style={{
                  padding: '8px 12px',
                  backgroundColor: lineCorruptionActive ? '#00b894' : '#fd79a8',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                {lineCorruptionActive ? '✅ Line Corruption Active' : '💥 Activate Line Corruption'}
              </button>
              <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#636e72' }}>
                {lineCorruptionActive ? 'You can edit 2 lines!' : 'Edit 2 lines instead of 1 (3 uses)'}
              </p>
            </div>
          )}
        </RightPanel>
      </GameContent>
    </GameContainer>
  );
};

export default GameRoom;
