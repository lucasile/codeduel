import React from 'react';
import './EndGameScreen.css';

interface Player {
  name: string;
  points: number;
}

interface EndGameScreenProps {
  players: Player[];
  onPlayAgain: () => void;
}

const EndGameScreen: React.FC<EndGameScreenProps> = ({ players, onPlayAgain }) => {
  if (!players || players.length === 0) return null;

  const maxPoints = Math.max(...players.map(p => p.points));
  const winners = players.filter(p => p.points === maxPoints);
  const isTie = winners.length > 1;

  return (
    <div className="end-game-screen">
      <h2>Game Over!</h2>
      <ul className="scores-list">
        {players.map((player, idx) => (
          <li key={idx} className={player.points === maxPoints ? 'winner' : ''}>
            {player.name}: {player.points} points
          </li>
        ))}
      </ul>
      <h3 className="winner-text">
        {isTie
          ? `It's a tie between: ${winners.map(w => w.name).join(', ')}`
          : `Winner: ${winners[0].name}!`}
      </h3>
      <button className="play-again-btn" onClick={onPlayAgain}>
        Play Again
      </button>
    </div>
  );
};

export default EndGameScreen;
