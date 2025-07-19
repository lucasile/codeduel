import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import styled from 'styled-components';
import HomePage from './components/HomePage';
import GameRoom from './components/GameRoom';
import { SocketProvider } from './context/SocketContext';
import './App.css';

const AppContainer = styled.div`
  min-height: 100vh;
  background: linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.7)), url('https://media.discordapp.net/attachments/1394846776623894689/1396243292907241612/maxresdefault.jpg?ex=687d6065&is=687c0ee5&hm=9d6b456b2c218e673ddf25944830539b7cb6f6f0ee224cd3913cc12a6e87cd78&=&format=webp&width=2048&height=1152');
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
