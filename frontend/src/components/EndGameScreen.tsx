import React from 'react';
import styled from 'styled-components';

interface Player {
  name: string;
  points: number;
}

interface EndGameScreenProps {
  players: Player[];
  onPlayAgain: () => void;
}

// Using the same theme as the title screen
const EndGameContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 2rem;
  background: linear-gradient(135deg, #1D976C 0%, #93F9B9 100%);
`;

const Title = styled.h1`
  font-family: 'Chewy', cursive;
  font-size: 5rem;
  font-weight: bold;
  color: white;
  text-align: center;
  margin-bottom: 1rem;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
`;

const WinnerCard = styled.div`
  background: rgba(255, 255, 255, 0.9);
  border-radius: 20px;
  padding: 2rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  max-width: 500px;
  width: 100%;
  text-align: center;
  margin-bottom: 2rem;
`;

const PlayerList = styled.div`
  margin: 2rem 0;
`;

const PlayerItem = styled.div<{ isWinner: boolean }>`
  font-size: 1.5rem;
  margin: 1rem 0;
  padding: 1rem;
  border-radius: 10px;
  background: ${props => props.isWinner ? 'linear-gradient(135deg, #ffd700 0%, #ff8c00 100%)' : '#f8f9fa'};
  color: ${props => props.isWinner ? 'white' : '#333'};
  font-weight: ${props => props.isWinner ? 'bold' : 'normal'};
  text-shadow: ${props => props.isWinner ? '1px 1px 2px rgba(0, 0, 0, 0.5)' : 'none'};
`;

const WinnerText = styled.h3`
  font-size: 1.8rem;
  color: #1D976C;
  margin: 1.5rem 0;
  font-weight: bold;
`;

const PlayAgainButton = styled.button`
  width: 100%;
  padding: 1rem;
  background: linear-gradient(135deg, #1D976C 0%, #93F9B9 100%);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 1.2rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
  }

  &:active {
    transform: translateY(0px);
  }
`;

const EndGameScreen: React.FC<EndGameScreenProps> = ({ players, onPlayAgain }) => {
  if (!players || players.length === 0) return null;

  const maxRounds = Math.max(...players.map(p => p.points));
  const winners = players.filter(p => p.points === maxRounds);
  const isTie = winners.length > 1;

  return (
    <EndGameContainer>
      <Title>Game Over!</Title>
      
      <WinnerCard>
        <WinnerText>
          {isTie
            ? `It's a tie! ${winners.map(w => w.name).join(' & ')} tied with ${maxRounds} round${maxRounds !== 1 ? 's' : ''} each!`
            : `🎉 ${winners[0].name} wins with ${maxRounds} round${maxRounds !== 1 ? 's' : ''}! 🎉`}
        </WinnerText>
        
        <PlayerList>
          {players.map((player, idx) => (
            <PlayerItem 
              key={idx} 
              isWinner={player.points === maxRounds}
            >
              {player.name}: {player.points} round{player.points !== 1 ? 's' : ''} won
            </PlayerItem>
          ))}
        </PlayerList>
        
        <PlayAgainButton onClick={onPlayAgain}>
          Play Again
        </PlayAgainButton>
      </WinnerCard>
    </EndGameContainer>
  );
};

export default EndGameScreen;
