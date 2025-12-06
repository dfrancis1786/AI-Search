/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useCallback } from 'react';
import { Send, Loader2, Wand2, Layers } from 'lucide-react';
import { GenerationStatus } from '../types';

interface InputSectionProps {
  onGenerate: (prompt: string, complexity: number) => void;
  status: GenerationStatus;
}

export const InputSection: React.FC<InputSectionProps> = ({ onGenerate, status }) => {
  const [input, setInput] = useState('');
  const [complexity, setComplexity] = useState(3);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && status !== GenerationStatus.LOADING) {
      onGenerate(input.trim(), complexity);
    }
  }, [input, complexity, status, onGenerate]);

  const isLoading = status === GenerationStatus.LOADING;

  return (
    <div className="w-full max-w-2xl mx-auto mt-12 px-4">
      <div className="text-center mb-8">
        <h2 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-200 to-zinc-400 mb-3">
          What do you want to create?
        </h2>
        <p className="text-zinc-400 text-lg">
          Describe an object, icon, or scene, and we'll render it as vector art.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="relative group mb-8">
        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl opacity-20 group-hover:opacity-40 transition duration-500 blur-lg"></div>
        <div className="relative bg-zinc-900 rounded-xl border border-white/10 shadow-2xl overflow-hidden">
          <div className="flex items-center p-2">
            <div className="pl-4 text-zinc-500">
              <Wand2 className="w-5 h-5" />
            </div>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. A futuristic cyberpunk helmet with neon lights..."
              className="flex-1 bg-transparent border-none outline-none text-white placeholder-zinc-500 px-4 py-3 text-lg"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className={`
                flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all duration-200
                ${!input.trim() || isLoading 
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                  : 'bg-white text-zinc-950 hover:bg-zinc-200 active:scale-95 shadow-lg shadow-white/10'}
              `}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="hidden sm:inline">Crafting...</span>
                </>
              ) : (
                <>
                  <span className="hidden sm:inline">Generate</span>
                  <Send className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
          
          {/* Complexity Slider */}
          <div className="px-6 py-3 bg-zinc-950/30 border-t border-white/5 flex items-center gap-4">
            <div className="flex items-center gap-2 text-zinc-400 min-w-[100px]">
              <Layers className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Complexity</span>
            </div>
            <div className="flex-1 flex items-center gap-3">
              <span className="text-xs text-zinc-600 font-medium">Minimal</span>
              <input 
                type="range" 
                min="1" 
                max="5" 
                step="1" 
                value={complexity}
                onChange={(e) => setComplexity(parseInt(e.target.value))}
                className="flex-1 h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400 transition-all"
                disabled={isLoading}
                title={`Level ${complexity}`}
              />
              <span className="text-xs text-zinc-600 font-medium">Detailed</span>
            </div>
            <div className="w-6 text-right text-xs text-indigo-400 font-bold font-mono">
              {complexity}
            </div>
          </div>
        </div>
      </form>
      
      {/* Quick suggestions */}
      <div className="flex flex-wrap justify-center gap-2">
        {['Retro Camera', 'Space Rocket', 'Origami Bird', 'Isometric House'].map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => setInput(suggestion)}
            className="px-3 py-1.5 text-xs font-medium text-zinc-400 bg-zinc-800/50 border border-white/5 rounded-full hover:bg-zinc-800 hover:text-white hover:border-white/20 transition-all"
            disabled={isLoading}
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
};
