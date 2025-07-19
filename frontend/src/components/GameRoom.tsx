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
  const [playerId, setPlayerId] = useState<string>('');

  useEffect(() => {
    if (!socket || !isConnected || !gameId) return;

    // Socket event listeners
    socket.on('game_joined', (data) => {
      setPlayerId(data.playerId);
      setGameState(prev => prev ? { ...prev, players: data.players } : null);
    });

    socket.on('player_joined', (data) => {
      setGameState(prev => prev ? { ...prev, players: data.players } : null);
    });

    socket.on('game_started', (data) => {
      setIsGameStarted(true);
      setGameState(prev => prev ? {
        ...prev,
        currentRound: data.currentRound,
        maxRounds: data.maxRounds,
        currentPhase: data.currentPhase,
        bugIntroducer: data.bugIntroducer,
        debugger: data.debugger,
        timeLeft: data.timeLeft
      } : null);
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
    });

    socket.on('game_over', (data) => {
      setGameState(prev => prev ? {
        ...prev,
        currentPhase: 'finished'
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

  const handleIntroduceBug = (buggyCode: string, lineNumber: number) => {
    if (!socket || !gameId) return;
    
    socket.emit('introduce_bug', {
      gameId,
      buggyCode,
      lineNumber
    });
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
        </RightPanel>
      </GameContent>
    </GameContainer>
  );
};

export default GameRoom;
