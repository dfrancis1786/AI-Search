/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useRef, useState } from 'react';
import { Download, CheckCircle2, Code, ZoomIn, ZoomOut, Move, RotateCcw, Grid } from 'lucide-react';
import { GeneratedSvg } from '../types';

interface SvgPreviewProps {
  data: GeneratedSvg | null;
}

export const SvgPreview: React.FC<SvgPreviewProps> = ({ data }) => {
  const [copied, setCopied] = React.useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Transform state
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  
  // Background state
  const [bgColor, setBgColor] = useState<string>('grid');

  // Reset copied state, transform, and background when data changes
  useEffect(() => {
    setCopied(false);
    resetTransform();
    // Optional: Reset background on new generation or keep user preference? 
    // Keeping user preference is usually better UX, so we won't reset bgColor here.
  }, [data]);

  const resetTransform = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  if (!data) return null;

  const handleDownload = () => {
    const blob = new Blob([data.content], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vectorcraft-${data.id}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(data.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Zoom controls
  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.25, 4));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));

  // Pan controls
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Background styles
  const containerStyle = bgColor === 'grid' 
    ? { backgroundImage: "url('https://www.transparenttextures.com/patterns/cubes.png')" } 
    : { backgroundColor: bgColor };
  
  const containerClass = bgColor === 'grid' ? 'bg-zinc-950/50' : '';

  return (
    <div className="w-full max-w-4xl mx-auto mt-8 px-4 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="bg-zinc-900/80 backdrop-blur border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-zinc-900/50 gap-4 flex-wrap sm:flex-nowrap">
          <h3 className="text-sm font-medium text-zinc-300 truncate max-w-[150px] sm:max-w-xs shrink-0">
            Result: <span className="text-zinc-500">"{data.prompt}"</span>
          </h3>
          
          <div className="flex items-center gap-4 shrink-0 ml-auto">
             {/* Background Controls */}
             <div className="flex items-center gap-1.5 bg-zinc-950/50 p-1 rounded-lg border border-white/5">
                <button 
                  onClick={() => setBgColor('grid')}
                  className={`p-1.5 rounded-md transition-colors ${bgColor === 'grid' ? 'bg-white/20 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
                  title="Grid Background"
                >
                  <Grid className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={() => setBgColor('#ffffff')}
                  className={`w-5 h-5 rounded-md bg-white border-2 transition-all ${bgColor === '#ffffff' ? 'border-indigo-500 scale-110' : 'border-transparent hover:scale-105'}`}
                  title="White Background"
                />
                <button 
                  onClick={() => setBgColor('#000000')}
                  className={`w-5 h-5 rounded-md bg-black border-2 transition-all ${bgColor === '#000000' ? 'border-indigo-500 scale-110' : 'border-zinc-700 hover:scale-105'}`}
                  title="Black Background"
                />
                <div className="relative w-5 h-5 rounded-md overflow-hidden border border-white/10 group cursor-pointer">
                   <div className="absolute inset-0 bg-gradient-to-br from-red-500 via-green-500 to-blue-500" />
                   <input 
                     type="color" 
                     onChange={(e) => setBgColor(e.target.value)}
                     className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                     title="Custom Color"
                   />
                </div>
             </div>
             
             <div className="w-px h-6 bg-white/10 hidden sm:block"></div>

            <div className="flex gap-2">
              <button
                onClick={handleCopyCode}
                className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors group relative"
                title="Copy SVG Code"
              >
                {copied ? <CheckCircle2 className="w-5 h-5 text-green-400" /> : <Code className="w-5 h-5" />}
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-zinc-900 bg-white rounded-lg hover:bg-zinc-200 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Download</span>
              </button>
            </div>
          </div>
        </div>

        {/* Viewport Controls */}
        <div className="absolute left-1/2 -translate-x-1/2 mt-4 z-10 flex items-center gap-1 bg-zinc-800/80 backdrop-blur border border-white/10 rounded-full p-1 shadow-lg">
          <button onClick={handleZoomOut} className="p-1.5 hover:bg-white/10 rounded-full text-zinc-300"><ZoomOut className="w-4 h-4" /></button>
          <span className="text-xs w-12 text-center text-zinc-400">{Math.round(scale * 100)}%</span>
          <button onClick={handleZoomIn} className="p-1.5 hover:bg-white/10 rounded-full text-zinc-300"><ZoomIn className="w-4 h-4" /></button>
          <div className="w-px h-4 bg-white/10 mx-1"></div>
          <button onClick={resetTransform} className="p-1.5 hover:bg-white/10 rounded-full text-zinc-300" title="Reset View"><RotateCcw className="w-4 h-4" /></button>
        </div>

        {/* Canvas Area */}
        <div 
          className={`relative overflow-hidden min-h-[400px] cursor-move transition-colors duration-300 ${containerClass}`}
          style={containerStyle}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div 
            style={{ 
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transition: isDragging ? 'none' : 'transform 0.2s ease-out'
            }}
            className="w-full h-full min-h-[400px] flex items-center justify-center p-8 origin-center"
          >
             {/* 
               Using dangerouslySetInnerHTML is intentional here as the content is generated by the LLM for the purpose of display.
             */}
            <div 
              ref={containerRef}
              className="w-full max-w-[512px] h-auto filter drop-shadow-2xl pointer-events-none select-none"
              dangerouslySetInnerHTML={{ __html: data.content }} 
            />
          </div>
        </div>
        
        {/* Metadata Footer */}
        <div className="px-4 py-2 bg-zinc-950 border-t border-white/5 flex justify-between text-xs text-zinc-600">
          <span>Generated by Gemini 3 Pro</span>
          <span className="flex items-center gap-1"><Move className="w-3 h-3" /> Drag to pan</span>
        </div>
      </div>
    </div>
  );
};
