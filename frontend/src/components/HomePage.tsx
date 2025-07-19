import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useSocket } from '../context/SocketContext';

const HomeContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 2rem;
`;

const Title = styled.h1`
  font-size: 4rem;
  font-weight: bold;
  color: white;
  text-align: center;
  margin-bottom: 1rem;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
`;

const Subtitle = styled.p`
  font-size: 1.2rem;
  color: rgba(255, 255, 255, 0.9);
  text-align: center;
  margin-bottom: 3rem;
  max-width: 600px;
`;

const GameCard = styled.div`
  background: rgba(255, 255, 255, 0.95);
  border-radius: 20px;
  padding: 2rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  max-width: 400px;
  width: 100%;
`;

const Input = styled.input`
  width: 100%;
  padding: 1rem;
  border: 2px solid #e1e5e9;
  border-radius: 10px;
  font-size: 1rem;
  margin-bottom: 1rem;
  transition: border-color 0.3s;

  &:focus {
    outline: none;
    border-color: #216309ff;
  }
`;

const Button = styled.button`
  width: 100%;
  padding: 1rem;
  background: linear-gradient(135deg, #1D976C 0%, #93F9B9 100%);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  margin-bottom: 1rem;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`;

const SecondaryButton = styled(Button)`
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
`;

const ConnectionStatus = styled.div<{ connected: boolean }>`
  position: fixed;
  top: 1rem;
  right: 1rem;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  background: ${props => props.connected ? '#10b981' : '#ef4444'};
  color: white;
  font-size: 0.9rem;
  font-weight: 500;
`;

const HomePage: React.FC = () => {
  const [playerName, setPlayerName] = useState('');
  const [gameId, setGameId] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const { socket, isConnected } = useSocket();
  const navigate = useNavigate();

  const handleCreateGame = () => {
    if (!playerName.trim() || !socket || !isConnected) return;

    setIsJoining(true);
    
    socket.emit('join_game', { playerName: playerName.trim() });
    
    socket.once('game_joined', (data) => {
      navigate(`/game/${data.gameId}`);
    });

    socket.once('join_error', (error) => {
      alert(`Failed to create game: ${error.message}`);
      setIsJoining(false);
    });
  };

  const handleJoinGame = () => {
    if (!playerName.trim() || !gameId.trim() || !socket || !isConnected) return;

    setIsJoining(true);
    
    socket.emit('join_game', { 
      playerName: playerName.trim(), 
      gameId: gameId.trim() 
    });
    
    socket.once('game_joined', (data) => {
      navigate(`/game/${data.gameId}`);
    });

    socket.once('join_error', (error) => {
      alert(`Failed to join game: ${error.message}`);
      setIsJoining(false);
    });
  };

  return (
    <HomeContainer>
      <ConnectionStatus connected={isConnected}>
        {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
      </ConnectionStatus>
      
      <Title>Bug Battle</Title>
      <Subtitle>
        Challenge your friends in the ultimate 1v1 coding battle! 
        Introduce bugs, hunt them down, and prove your debugging skills.
      </Subtitle>

      <GameCard>
        <Input
          type="text"
          placeholder="Enter your name"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          maxLength={20}
        />
        
        <Button
          onClick={handleCreateGame}
          disabled={!playerName.trim() || !isConnected || isJoining}
        >
          {isJoining ? 'Creating Game...' : 'Create New Game'}
        </Button>

        <div style={{ textAlign: 'center', margin: '1rem 0', color: '#666' }}>
          OR
        </div>

        <Input
          type="text"
          placeholder="Enter Game ID"
          value={gameId}
          onChange={(e) => setGameId(e.target.value)}
        />
        
        <SecondaryButton
          onClick={handleJoinGame}
          disabled={!playerName.trim() || !gameId.trim() || !isConnected || isJoining}
        >
          {isJoining ? 'Joining Game...' : 'Join Game'}
        </SecondaryButton>
      </GameCard>
    </HomeContainer>
  );
};

export default HomePage;
