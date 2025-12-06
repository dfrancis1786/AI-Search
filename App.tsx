/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { Header } from './components/Header';
import { VectorGenerator } from './components/VectorGenerator';
import { ImageEditor } from './components/ImageEditor';
import { VideoGenerator } from './components/VideoGenerator';
import { SearchAssistant } from './components/SearchAssistant';
import { AppMode } from './types';
import { PenTool, Image as ImageIcon, Video, Search } from 'lucide-react';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>('vector');

  const tabs = [
    { id: 'vector', label: 'Vector Art', icon: PenTool },
    { id: 'image-edit', label: 'Image Editor', icon: ImageIcon },
    { id: 'video', label: 'Animate', icon: Video },
    { id: 'search', label: 'Search', icon: Search },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-indigo-500/30">      
      <Header />
      
      <main className="pb-20">
        {/* Tab Navigation */}
        <div className="sticky top-[73px] z-40 w-full bg-zinc-950/80 backdrop-blur border-b border-white/5">
           <div className="max-w-5xl mx-auto px-4">
              <div className="flex items-center gap-6 overflow-x-auto no-scrollbar py-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = mode === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setMode(tab.id as AppMode)}
                      className={`
                        flex items-center gap-2 py-4 px-2 text-sm font-medium border-b-2 transition-all whitespace-nowrap
                        ${isActive 
                          ? 'border-indigo-500 text-white' 
                          : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:border-zinc-800'}
                      `}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : ''}`} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
           </div>
        </div>

        {/* Content Area */}
        <div className="pt-6">
          {mode === 'vector' && <VectorGenerator />}
          {mode === 'image-edit' && <ImageEditor />}
          {mode === 'video' && <VideoGenerator />}
          {mode === 'search' && <SearchAssistant />}
        </div>
      </main>
    </div>
  );
};

export default App;
