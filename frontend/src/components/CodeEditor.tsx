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
  lineCorruptionActive: boolean;
  onIntroduceBug: (buggyCode: string, lineNumber: number, editedLines: number[]) => void;
  onSubmitFix: (fixedCode: string, foundBugLine: number) => void;
}

const CodeEditor: React.FC<CodeEditorProps> = ({
  initialCode,
  buggyCode,
  gamePhase,
  isMyTurn,
  lineCorruptionActive,
  onIntroduceBug,
  onSubmitFix
}) => {
  const [currentCode, setCurrentCode] = useState(initialCode);
  const [selectedLine, setSelectedLine] = useState<number>(1);
  const [editedLines, setEditedLines] = useState<Set<number>>(new Set());
  const [originalCode, setOriginalCode] = useState(initialCode);
  const editorRef = useRef<any>(null);
  
  // Update currentCode when initialCode changes (new problem loaded)
  React.useEffect(() => {
    if (initialCode && initialCode !== currentCode) {
      setCurrentCode(initialCode);
      setOriginalCode(initialCode);
      setEditedLines(new Set()); // Reset edited lines for new problem
      console.log('🔄 Updated editor with new solution:', initialCode.substring(0, 50) + '...');
    }
  }, [initialCode]);
  
  // Reset edited lines when starting a new bug introduction phase
  React.useEffect(() => {
    if (gamePhase === 'bug_introduction' && isMyTurn) {
      setEditedLines(new Set()); // Reset edited lines for new round
      setOriginalCode(currentCode); // Update original code reference
      console.log('🔄 Reset edited lines for new bug introduction round');
    }
  }, [gamePhase, isMyTurn]); // Remove currentCode from dependencies to prevent reset on every edit

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
      
      // Track which lines have been edited (only during bug introduction phase)
      if (gamePhase === 'bug_introduction' && isMyTurn && originalCode) {
        // Use setTimeout to debounce the line comparison to prevent race conditions
        setTimeout(() => {
          const originalLines = originalCode.split('\n');
          const currentLines = value.split('\n');
          const newEditedLines = new Set<number>();
          
          // Compare each line to find differences
          const maxLines = Math.max(originalLines.length, currentLines.length);
          for (let i = 0; i < maxLines; i++) {
            const originalLine = (originalLines[i] || '').trim();
            const currentLine = (currentLines[i] || '').trim();
            // Only count as edited if there's a meaningful difference (not just whitespace)
            if (originalLine !== currentLine && (originalLine.length > 0 || currentLine.length > 0)) {
              newEditedLines.add(i + 1); // Line numbers are 1-indexed
            }
          }
          
          // Only update if the set actually changed to prevent unnecessary re-renders
          setEditedLines(prevEditedLines => {
            const prevArray = Array.from(prevEditedLines).sort();
            const newArray = Array.from(newEditedLines).sort();
            const hasChanged = prevArray.length !== newArray.length || 
                             prevArray.some((line, index) => line !== newArray[index]);
            
            if (hasChanged) {
              console.log('📝 Edited lines updated:', newArray);
              return newEditedLines;
            }
            return prevEditedLines;
          });
        }, 50); // 50ms debounce to handle rapid changes
      }
    }
  };

  const handleIntroduceBug = () => {
    if (!isMyTurn || gamePhase !== 'bug_introduction') return;
    
    // Validate line edit constraints
    const maxAllowedLines = lineCorruptionActive ? 2 : 1;
    const editedLinesArray = Array.from(editedLines);
    
    if (editedLinesArray.length === 0) {
      alert('⚠️ You must edit at least one line to introduce a bug!');
      return;
    }
    
    if (editedLinesArray.length > maxAllowedLines) {
      const powerUpText = lineCorruptionActive ? '' : ' Use the Line Corruption power-up to edit 2 lines.';
      alert(`⚠️ You can only edit ${maxAllowedLines} line(s) at a time.${powerUpText}`);
      return;
    }
    
    // Check if any edited line is actually empty (just whitespace)
    const currentLines = currentCode.split('\n');
    for (const lineNum of editedLinesArray) {
      const line = currentLines[lineNum - 1];
      if (!line || line.trim().length === 0) {
        alert('⚠️ Edited lines cannot be empty or just whitespace!');
        return;
      }
    }
    
    console.log(`🐛 Introducing bug on ${editedLinesArray.length} line(s):`, editedLinesArray);
    onIntroduceBug(currentCode, selectedLine, editedLinesArray);
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

  const getEditorCode = () => {
    if (gamePhase === 'debugging' && buggyCode) {
      return buggyCode; // Show buggy code during debugging (debugger never sees solution)
    }
    if (gamePhase === 'bug_introduction' && isMyTurn && currentCode) {
      return currentCode; // Show solution to bug introducer only
    }
    if (gamePhase === 'bug_introduction' && !isMyTurn) {
      return '// Waiting for bug introducer to load the problem solution...'; // Debugger waits
    }
    return currentCode || '// Loading...'; // Fallback
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
              🐛 Introduce Bug ({editedLines.size}/{lineCorruptionActive ? 2 : 1} lines edited)
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
          height="400px"
          defaultLanguage="python"
          theme="vs-dark"
          value={getEditorCode()}
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
