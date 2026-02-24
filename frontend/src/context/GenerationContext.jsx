import { createContext, useContext, useState, useCallback } from 'react';

const GenerationContext = createContext(null);

export function GenerationProvider({ children }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [actionLabel, setActionLabel] = useState('');
  const [startTime, setStartTime] = useState(null);

  const startGeneration = useCallback((label) => {
    setActionLabel(label);
    setStartTime(Date.now());
    setIsGenerating(true);
  }, []);

  const stopGeneration = useCallback(() => {
    setIsGenerating(false);
    setActionLabel('');
    setStartTime(null);
  }, []);

  return (
    <GenerationContext.Provider value={{ isGenerating, actionLabel, startTime, startGeneration, stopGeneration }}>
      {children}
    </GenerationContext.Provider>
  );
}

export function useGeneration() {
  const ctx = useContext(GenerationContext);
  if (!ctx) throw new Error('useGeneration must be used within a GenerationProvider');
  return ctx;
}
