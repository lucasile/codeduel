import React from 'react';
import styled from 'styled-components';

const HeaderContainer = styled.div`
        <PowerUpButton
          available={playerPowerUps.lineCorruption > 0}
          onClick={() => onUsePowerUp('lineCorruption')}
          disabled={playerPowerUps.lineCorruption === 0}
        >
          🐜 Ant Colony
          <PowerUpCount>{playerPowerUps.lineCorruption}</PowerUpCount>
        </PowerUpButton>ound: #2d2d30;
  border-bottom: 1px solid #3e3e42;
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const GameInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 2rem;
`;

const RoundInfo = styled.div`
  color: white;
  font-size: 1.1rem;
  font-weight: 600;
`;

const Timer = styled.div<{ timeLeft: number }>`
  background: ${props => props.timeLeft <= 30 ? '#dc2626' : props.timeLeft <= 60 ? '#f59e0b' : '#10b981'};
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 1.1rem;
  font-weight: 700;
  min-width: 80px;
  text-align: center;
`;

const PowerUpContainer = styled.div`
  display: flex;
  gap: 1rem;
  align-items: center;
`;

const PowerUpButton = styled.button<{ available: boolean }>`
  background: ${props => props.available ? '#7c3aed' : '#6b7280'};
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: ${props => props.available ? 'pointer' : 'not-allowed'};
  transition: background-color 0.2s;
  
  &:hover {
    background: ${props => props.available ? '#6d28d9' : '#6b7280'};
  }
`;

const PowerUpCount = styled.span`
  background: rgba(255, 255, 255, 0.2);
  padding: 0.2rem 0.5rem;
  border-radius: 10px;
  margin-left: 0.5rem;
  font-size: 0.8rem;
`;

interface GameState {
  currentRound: number;
  maxRounds: number;
  timeLeft: number;
  powerUps: {
    player1: { lineCorruption: number; timeFreeze: number };
    player2: { lineCorruption: number; timeFreeze: number };
  };
  players: Array<{ id: string; name: string }>;
}

interface GameHeaderProps {
  gameState: GameState;
  playerId: string;
  onUsePowerUp: (powerUpType: 'lineCorruption' | 'timeFreeze') => void;
  currentPhase: string;
  currentBugIntroducer: string | null;
  currentDebugger: string | null;
}

const GameHeader: React.FC<GameHeaderProps> = ({ 
  gameState, 
  playerId, 
  onUsePowerUp, 
  currentPhase, 
  currentBugIntroducer, 
  currentDebugger 
}) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getPlayerPowerUps = () => {
    const playerIndex = gameState.players.findIndex(p => p.id === playerId);
    return playerIndex === 0 ? gameState.powerUps.player1 : gameState.powerUps.player2;
  };

  const playerPowerUps = getPlayerPowerUps();

  // Role-based power-up availability
  const isCurrentBugIntroducer = playerId === currentBugIntroducer;
  const isCurrentDebugger = playerId === currentDebugger;
  
  // Ant Colony can only be used by bug introducer
  const canUseAntColony = playerPowerUps.lineCorruption > 0 && isCurrentBugIntroducer;
  
  // Pest Control can only be used by debugger  
  const canUsePestControl = playerPowerUps.timeFreeze > 0 && isCurrentDebugger;

  return (
    <HeaderContainer>
      <GameInfo>
        <RoundInfo>
          Round {gameState.currentRound} / {gameState.maxRounds}
        </RoundInfo>
        <Timer timeLeft={gameState.timeLeft}>
          ⏰ {formatTime(gameState.timeLeft)}
        </Timer>
      </GameInfo>

      <PowerUpContainer>
        <PowerUpButton
          available={canUseAntColony}
          onClick={() => onUsePowerUp('lineCorruption')}
          disabled={!canUseAntColony}
        >
          🐜 Ant Colony
          <PowerUpCount>{playerPowerUps.lineCorruption}</PowerUpCount>
        </PowerUpButton>
        
        <PowerUpButton
          available={canUsePestControl}
          onClick={() => onUsePowerUp('timeFreeze')}
          disabled={!canUsePestControl}
        >
          🧪 Pest Control
          <PowerUpCount>{playerPowerUps.timeFreeze}</PowerUpCount>
        </PowerUpButton>
      </PowerUpContainer>
    </HeaderContainer>
  );
};

export default GameHeader;
