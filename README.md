# Code Duel 🪳⚔️

A competitive 1v1 coding game where players take turns introducing bugs and fixing them. Built with Node.js, React, and real-time WebSocket communication.

## 🎮 Game Overview

**Code Duel** is a fast-paced competitive coding game with the following mechanics:

- **First to 3 wins** - Players compete in rounds until someone reaches 3 victories
- **Bug Introduction Phase** - One player introduces bugs into working code (90 seconds)
- **Bug Fixing Phase** - The other player finds and fixes the bugs (90 seconds)
- **Role Switching** - Players alternate between bug introducer and debugger each round
- **Power-ups** - Special abilities that can be used once per game:
  - 🐜 **Ant Colony** (Bug Introducer only) - Edit 2 lines instead of 1
  - 🧪 **Pest Control** (Debugger only) - Add 30 seconds to timer

## 🏗️ Architecture

### Backend (Node.js + Express)
- **Real-time communication** via Socket.io
- **Code execution** via Judge0 API integration
- **Problem generation** via Vellum AI streaming workflows
- **Game session management** with first-to-3 win logic

### Frontend (React + TypeScript)
- **Monaco Editor** for code editing with syntax highlighting
- **Real-time game state** synchronization
- **Dynamic line edit tracking** and visual feedback
- **Power-up system** with role-based restrictions

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ and npm
- Judge0 API access (self-hosted or cloud)
- Vellum AI API key
- LeetCode API access

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd code-duel
   ```

2. **Install dependencies**
   ```bash
   # Backend
   cd backend
   npm install
   
   # Frontend
   cd ../frontend
   npm install
   ```

3. **Environment Setup**
   
   Create `backend/.env` with the following variables:
   ```env
   # Server Configuration
   PORT=3001
   
   # Judge0 API (for code execution)
   JUDGE0_API_URL=your_judge0_api_url
   JUDGE0_API_KEY=your_judge0_api_key_if_needed
   
   # Vellum AI API (for solution generation)
   VELLUM_API_KEY=your_vellum_api_key
   VELLUM_WORKFLOW_DEPLOYMENT_ID=your_workflow_deployment_id
   
   # LeetCode API
   LEETCODE_API_BASE_URL=https://leetcode-api.example.com
   
   # Development Mode
   TEST_MODE=false
   ```

4. **Start the application**
   ```bash
   # Terminal 1: Start backend
   cd backend
   npm start
   
   # Terminal 2: Start frontend
   cd frontend
   npm start
   ```

5. **Access the game**
   - Open http://localhost:3000 in two browser windows
   - Create or join a game with a 4-digit game code
   - Start competing!

## 🧪 Test Mode

For development and testing without external API dependencies:

1. Set `TEST_MODE=true` in `backend/.env`
2. The game will use 5 pre-configured problems instead of fetching from APIs
3. No Vellum or LeetCode API calls will be made

## 🎯 Game Features

### Problem Management
- **LeetCode integration** to get problem information
- **Duplicate Prevention** - No repeated problems within the same game
- **Preloading System** - Background generation for instant round transitions
- **Smart Parameter Parsing** - Automatic detection of function parameter types

### Code Execution
- **Judge0 Integration** - Secure code execution and validation
- **Multiple Test Cases** - Comprehensive solution verification
- **Real-time Results** - Instant feedback on code correctness
- **Error Handling** - Robust handling of runtime errors and edge cases

### Competitive Features
- **Dynamic Line Limits** - Fair editing restrictions based on bug complexity
- **Visual Feedback** - Real-time line edit tracking and validation
- **Power-up Strategy** - Role-based special abilities
- **Win Tracking** - First-to-3 tournament format

## 🔧 Development

### Project Structure
```
code-duel/
├── backend/
│   ├── src/
│   │   ├── data/           # Test problems and static data
│   │   ├── routes/         # Express route handlers
│   │   ├── services/       # External API integrations
│   │   └── socket/         # WebSocket game logic
│   └── server.js           # Main server entry point
├── frontend/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── hooks/          # Custom React hooks
│   │   └── types/          # TypeScript type definitions
│   └── public/             # Static assets
└── README.md
```

### Key Technologies
- **Backend**: Node.js, Express, Socket.io, Axios
- **Frontend**: React, TypeScript, Monaco Editor, Socket.io-client
- **Code Execution**: Judge0 API
- **AI Integration**: Vellum AI streaming workflows
- **Problem Source**: LeetCode API

## 🐛 Troubleshooting

### Common Issues

**Game not starting:**
- Check that both backend (port 3001) and frontend (port 3000) are running
- Verify WebSocket connection in browser developer tools

**Code execution errors:**
- Ensure Judge0 API is accessible and properly configured
- Check Judge0 service logs for detailed error information

**Problem loading issues:**
- Verify Vellum API key and workflow deployment ID
- Check LeetCode API connectivity
- Enable TEST_MODE for offline development

**Power-up not working:**
- Ensure you're using the power-up during the correct phase (Ant Colony for bug introduction, Pest Control for debugging)
- Power-ups can only be used once per game per player

## 🎮 How to Play

1. **Join a Game** - Enter a 4-digit game code or create a new game
2. **Wait for Opponent** - Games start automatically when 2 players join
3. **Bug Introduction** - If you're the bug introducer:
   - Review the provided solution code
   - Edit 1-2 lines to introduce bugs (use Ant Colony power-up for 2 lines)
   - Submit your buggy code
4. **Bug Fixing** - If you're the debugger:
   - Analyze the buggy code
   - Fix the bugs in 1-2 lines (use Pest Control for extra time)
   - Submit your fix
5. **Validation** - Code is automatically tested against multiple test cases
6. **Round Results** - Win the round if your fix passes all tests
7. **Role Switch** - Players alternate roles each round
8. **Victory** - First player to win 3 rounds wins the game!

## 🏆 Strategy Tips

- **As Bug Introducer**: Create subtle bugs that are hard to spot but break functionality
- **As Debugger**: Read code carefully and test edge cases mentally
- **Power-up Timing**: Save power-ups for crucial rounds or when under pressure
- **Time Management**: Use the full 90 seconds wisely - rushing leads to mistakes

---
