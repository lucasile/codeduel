import React, { useState, useRef } from 'react';
import Editor from '@monaco-editor/react';
import styled from 'styled-components';

const EditorContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const EditorHeader = styled.div`
  background: #2d2d30;
  padding: 1rem;
  border-bottom: 1px solid #3e3e42;
  display: flex;
  justify-content: between;
  align-items: center;
`;

const PhaseIndicator = styled.div<{ phase: string }>`
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 600;
  background: ${props => {
    switch (props.phase) {
      case 'bug_introduction': return '#f59e0b';
      case 'debugging': return '#ef4444';
      case 'validation': return '#10b981';
      default: return '#6b7280';
    }
  }};
  color: white;
`;

const ActionButton = styled.button`
  padding: 0.5rem 1rem;
  background: #007acc;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-weight: 600;
  margin-left: 1rem;

  &:hover {
    background: #005a9e;
  }

  &:disabled {
    background: #6b7280;
    cursor: not-allowed;
  }
`;

const DangerButton = styled(ActionButton)`
  background: #dc2626;

  &:hover {
    background: #b91c1c;
  }
`;

const EditorWrapper = styled.div`
  flex: 1;
  position: relative;
`;

const TurnIndicator = styled.div<{ isMyTurn: boolean }>`
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 10;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 600;
  background: ${props => props.isMyTurn ? '#10b981' : '#6b7280'};
  color: white;
`;

interface CodeEditorProps {
  initialCode: string;
  buggyCode: string;
  gamePhase: string;
  isMyTurn: boolean;
  onIntroduceBug: (buggyCode: string, lineNumber: number) => void;
  onSubmitFix: (fixedCode: string, foundBugLine: number) => void;
}

const CodeEditor: React.FC<CodeEditorProps> = ({
  initialCode,
  buggyCode,
  gamePhase,
  isMyTurn,
  onIntroduceBug,
  onSubmitFix
}) => {
  const [currentCode, setCurrentCode] = useState(initialCode);
  const [selectedLine, setSelectedLine] = useState<number>(1);
  const editorRef = useRef<any>(null);

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
    
    // Set up cursor position change listener
    editor.onDidChangeCursorPosition((e: any) => {
      setSelectedLine(e.position.lineNumber);
    });
  };

  const handleCodeChange = (value: string | undefined) => {
    if (value !== undefined) {
      setCurrentCode(value);
    }
  };

  const handleIntroduceBug = () => {
    if (!isMyTurn || gamePhase !== 'bug_introduction') return;
    
    // In a real implementation, you might want to validate the bug introduction
    // For MVP, we'll just submit the current code and selected line
    onIntroduceBug(currentCode, selectedLine);
  };

  const handleSubmitFix = () => {
    if (!isMyTurn || gamePhase !== 'debugging') return;
    
    onSubmitFix(currentCode, selectedLine);
  };

  const getPhaseText = () => {
    switch (gamePhase) {
      case 'bug_introduction':
        return isMyTurn ? '🐛 Your turn: Introduce a bug' : '⏳ Opponent is introducing a bug';
      case 'debugging':
        return isMyTurn ? '🔍 Your turn: Find and fix the bug' : '⏳ Opponent is debugging';
      case 'validation':
        return '✅ Validating solution...';
      default:
        return '⏳ Waiting for game to start';
    }
  };

  const getDisplayCode = () => {
    if (gamePhase === 'debugging' && !isMyTurn) {
      return initialCode; // Bug introducer sees original code during debugging
    }
    if (gamePhase === 'debugging' && isMyTurn && buggyCode) {
      return buggyCode; // Debugger sees buggy code
    }
    return currentCode;
  };

  const isEditorReadOnly = () => {
    if (gamePhase === 'waiting' || gamePhase === 'validation') return true;
    if (gamePhase === 'debugging' && !isMyTurn) return true; // Bug introducer can't edit during debugging
    return !isMyTurn;
  };

  return (
    <EditorContainer>
      <EditorHeader>
        <PhaseIndicator phase={gamePhase}>
          {getPhaseText()}
        </PhaseIndicator>
        
        <div>
          {gamePhase === 'bug_introduction' && isMyTurn && (
            <DangerButton onClick={handleIntroduceBug}>
              🐛 Introduce Bug (Line {selectedLine})
            </DangerButton>
          )}
          
          {gamePhase === 'debugging' && isMyTurn && (
            <ActionButton onClick={handleSubmitFix}>
              🔧 Submit Fix (Found on Line {selectedLine})
            </ActionButton>
          )}
        </div>
      </EditorHeader>

      <EditorWrapper>
        <TurnIndicator isMyTurn={isMyTurn}>
          {isMyTurn ? '🎯 Your Turn' : '⏳ Wait'}
        </TurnIndicator>
        
        <Editor
          height="100%"
          defaultLanguage="python"
          theme="vs-dark"
          value={getDisplayCode()}
          onChange={handleCodeChange}
          onMount={handleEditorDidMount}
          options={{
            readOnly: isEditorReadOnly(),
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            wordWrap: 'on',
            lineDecorationsWidth: 10,
            lineNumbersMinChars: 3,
            glyphMargin: false,
            folding: false,
            selectOnLineNumbers: true,
            selectionHighlight: false,
            cursorStyle: 'line',
            renderLineHighlight: 'line',
          }}
        />
      </EditorWrapper>
    </EditorContainer>
  );
};

export default CodeEditor;
