import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import styled from 'styled-components';
import HomePage from './components/HomePage';
import GameRoom from './components/GameRoom';
import { SocketProvider } from './context/SocketContext';
import './App.css';

const AppContainer = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
`;

const App: React.FC = () => {
  return (
    <SocketProvider>
      <AppContainer>
        <Router>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/game/:gameId" element={<GameRoom />} />
          </Routes>
        </Router>
      </AppContainer>
    </SocketProvider>
  );
};

export default App;
