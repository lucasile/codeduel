import React from 'react';
import styled from 'styled-components';

const PanelContainer = styled.div`
  padding: 1rem;
  height: 100%;
  overflow-y: auto;
`;

const PanelTitle = styled.h3`
  color: white;
  margin-bottom: 1rem;
  font-size: 1.1rem;
  border-bottom: 1px solid #3e3e42;
  padding-bottom: 0.5rem;
`;

const PlayerCard = styled.div<{ isActive: boolean; role?: string }>`
  background: ${props => {
    if (props.role === 'introducer') return 'rgba(245, 158, 11, 0.2)';
    if (props.role === 'debugger') return 'rgba(239, 68, 68, 0.2)';
    return props.isActive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(107, 114, 128, 0.2)';
  }};
  border: 1px solid ${props => {
    if (props.role === 'introducer') return '#f59e0b';
    if (props.role === 'debugger') return '#ef4444';
    return props.isActive ? '#10b981' : '#6b7280';
  }};
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
`;

const PlayerName = styled.div`
  color: white;
  font-weight: 600;
  font-size: 1rem;
  margin-bottom: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const PlayerScore = styled.div`
  color: #10b981;
  font-size: 1.5rem;
  font-weight: 700;
`;

const RoleIndicator = styled.div<{ role: string }>`
  background: ${props => {
    switch (props.role) {
      case 'introducer': return '#f59e0b';
      case 'debugger': return '#ef4444';
      default: return '#6b7280';
    }
  }};
  color: white;
  padding: 0.2rem 0.5rem;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 600;
`;

const PowerUpStatus = styled.div`
  margin-top: 0.5rem;
  font-size: 0.9rem;
  color: #d1d5db;
`;

const PowerUpItem = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.2rem;
`;

const ScoreSection = styled.div`
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #3e3e42;
`;

const ScoreTitle = styled.h4`
  color: white;
  margin-bottom: 0.5rem;
  font-size: 1rem;
`;

const GamePhaseInfo = styled.div`
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid #10b981;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
`;

const PhaseTitle = styled.div`
  color: #10b981;
  font-weight: 600;
  margin-bottom: 0.5rem;
`;

const PhaseDescription = styled.div`
  color: #d1d5db;
  font-size: 0.9rem;
`;

interface Player {
  id: string;
  name: string;
}

interface PlayerPanelProps {
  players: Player[];
  roundWins: { player1: number; player2: number };
  powerUps: {
    player1: { lineCorruption: number; timeFreeze: number };
    player2: { lineCorruption: number; timeFreeze: number };
  };
  currentPlayerId: string;
  bugIntroducer: string | null;
  debuggerPlayer: string | null;
  currentPhase: string;
}

const PlayerPanel: React.FC<PlayerPanelProps> = ({
  players,
  roundWins,
  powerUps,
  currentPlayerId,
  bugIntroducer,
  debuggerPlayer,
  currentPhase
}) => {
  const getPlayerRole = (playerId: string) => {
    if (bugIntroducer === playerId) return 'introducer';
    if (debuggerPlayer === playerId) return 'debugger';
    return null;
  };

  const getRoleText = (role: string | null) => {
    switch (role) {
      case 'introducer': return '🐛 Bug Introducer';
      case 'debugger': return '🔍 Debugger';
      default: return '';
    }
  };

  const getPhaseDescription = () => {
    switch (currentPhase) {
      case 'bug_introduction':
        return 'The bug introducer is adding a subtle bug to the working solution. The debugger waits...';
      case 'debugging':
        return 'The debugger must find and fix the introduced bug. Time is ticking!';
      case 'validation':
        return 'Running test cases to validate the fix...';
      case 'finished':
        return 'Game over! Check the final scores.';
      default:
        return 'Waiting for the game to begin...';
    }
  };

  const getPlayerPowerUps = (playerIndex: number) => {
    return playerIndex === 0 ? powerUps.player1 : powerUps.player2;
  };

  return (
    <PanelContainer>
      <PanelTitle>🎮 Players</PanelTitle>
      
      <GamePhaseInfo>
        <PhaseTitle>Current Phase</PhaseTitle>
        <PhaseDescription>{getPhaseDescription()}</PhaseDescription>
      </GamePhaseInfo>

      {players.map((player, index) => {
        const role = getPlayerRole(player.id);
        const playerPowerUps = getPlayerPowerUps(index);
        const playerRoundWins = index === 0 ? roundWins.player1 : roundWins.player2;
        
        return (
          <PlayerCard
            key={player.id}
            isActive={player.id === currentPlayerId}
            role={role || undefined}
          >
            <PlayerName>
              {player.id === currentPlayerId && '👤 '}
              {player.name}
              {role && <RoleIndicator role={role}>{getRoleText(role)}</RoleIndicator>}
            </PlayerName>
            
            <PlayerScore>{playerRoundWins} rounds won</PlayerScore>
            
            <PowerUpStatus>
              <PowerUpItem>
                <span>🐜 Ant Colony:</span>
                <span>{playerPowerUps.lineCorruption}</span>
              </PowerUpItem>
              <PowerUpItem>
                <span>🧪 Pest Control:</span>
                <span>{playerPowerUps.timeFreeze}</span>
              </PowerUpItem>
            </PowerUpStatus>
          </PlayerCard>
        );
      })}

      <ScoreSection>
        <ScoreTitle>Rules</ScoreTitle>
        <div style={{ color: '#d1d5db', fontSize: '0.9rem' }}>
          <div>• First to win 3 rounds wins the game</div>
          <div>• Debugger wins round by fixing the bug</div>
          <div>• Bug Introducer wins if time runs out</div>
        </div>
      </ScoreSection>
    </PanelContainer>
  );
};

export default PlayerPanel;
