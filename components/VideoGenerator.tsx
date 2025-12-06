/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import { Upload, Film, Loader2, Play, Lock } from 'lucide-react';
import { generateVideoWithVeo } from '../services/geminiService';
import { GenerationStatus, ApiError } from '../types';

// Removed conflicting global declaration
// We will access window.aistudio using type casting to avoid collision with existing global declarations.

export const VideoGenerator: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [status, setStatus] = useState<GenerationStatus>(GenerationStatus.IDLE);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    checkKey();
  }, []);

  const checkKey = async () => {
    // Cast window to any to bypass potential type conflicts with global declarations
    const aistudio = (window as any).aistudio;
    if (aistudio) {
      const has = await aistudio.hasSelectedApiKey();
      setHasKey(has);
    }
  };

  const handleSelectKey = async () => {
    const aistudio = (window as any).aistudio;
    if (aistudio) {
      await aistudio.openSelectKey();
      await checkKey(); // Re-check
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target?.result as string);
      reader.readAsDataURL(selected);
      setVideoUri(null);
    }
  };

  const handleGenerate = async () => {
    if (!file || !hasKey) return;

    setStatus(GenerationStatus.LOADING);
    setError(null);
    setVideoUri(null);

    try {
      const uri = await generateVideoWithVeo(file, prompt, aspectRatio);
      setVideoUri(uri);
      setStatus(GenerationStatus.SUCCESS);
    } catch (err: any) {
      // Check for specific key error or general error
      if (err.message && err.message.includes("Requested entity was not found")) {
        setHasKey(false);
        setError({ message: "Invalid API Key", details: "Please select a valid paid API key again." });
      } else {
         setStatus(GenerationStatus.ERROR);
         setError({ message: "Video Generation Failed", details: err.message });
      }
    }
  };

  if (!hasKey) {
    return (
      <div className="w-full max-w-2xl mx-auto mt-20 text-center px-4">
        <div className="bg-zinc-900 border border-white/10 rounded-2xl p-10 shadow-2xl">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-purple-500/20">
             <Lock className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Paid Feature Access</h2>
          <p className="text-zinc-400 mb-8 max-w-md mx-auto">
            Video generation with Veo requires a paid API key from Google AI Studio. 
            Please select your project to continue.
          </p>
          <div className="flex flex-col gap-4 items-center">
            <button 
              onClick={handleSelectKey}
              className="px-8 py-3 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition-colors shadow-lg shadow-white/10"
            >
              Select API Key
            </button>
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-sm text-zinc-500 underline hover:text-zinc-300">
              Read about billing
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-4 mt-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-2">Animate with Veo</h2>
        <p className="text-zinc-400">Bring your images to life with AI-generated video.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Column */}
        <div className="space-y-6">
          <div className={`
             border-2 border-dashed rounded-2xl p-8 text-center transition-all relative overflow-hidden
             ${preview ? 'border-zinc-700 bg-zinc-900/50' : 'border-zinc-700 hover:border-purple-500 hover:bg-zinc-800/50 cursor-pointer'}
           `}>
             {!preview ? (
               <label className="cursor-pointer block">
                 <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                 <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-400">
                   <Film className="w-8 h-8" />
                 </div>
                 <h3 className="text-lg font-medium text-white">Upload Reference Image</h3>
                 <p className="text-sm text-zinc-500 mt-2">JPG, PNG</p>
               </label>
             ) : (
               <div className="relative group">
                 <img src={preview} alt="Reference" className="w-full rounded-lg max-h-[300px] object-cover opacity-80" />
                 <label className="absolute inset-0 flex items-center justify-center cursor-pointer">
                    <div className="bg-black/60 px-4 py-2 rounded-full backdrop-blur text-white text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      Change Image
                    </div>
                    <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                 </label>
               </div>
             )}
           </div>

           <div className="bg-zinc-900 border border-white/10 rounded-xl p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Motion Prompt</label>
                <textarea 
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe the movement (e.g. A neon hologram of a cat driving at top speed)"
                  className="w-full bg-zinc-950 border border-white/10 rounded-lg p-3 text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500 transition-colors h-24 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Aspect Ratio</label>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setAspectRatio('16:9')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${aspectRatio === '16:9' ? 'bg-purple-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                  >
                    Landscape (16:9)
                  </button>
                  <button 
                    onClick={() => setAspectRatio('9:16')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${aspectRatio === '9:16' ? 'bg-purple-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                  >
                    Portrait (9:16)
                  </button>
                </div>
              </div>

              <button 
                onClick={handleGenerate}
                disabled={!file || status === GenerationStatus.LOADING}
                className="w-full bg-white text-black py-3 rounded-lg font-bold hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {status === GenerationStatus.LOADING ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> Generating Video...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 fill-black" /> Generate Video
                  </>
                )}
              </button>
           </div>
            
            {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-200 text-sm">
              <span className="font-bold block mb-1">{error.message}</span>
              {error.details}
            </div>
          )}
        </div>

        {/* Result Column */}
        <div className="bg-zinc-900/30 rounded-2xl border border-white/5 p-6 flex flex-col items-center justify-center relative overflow-hidden min-h-[500px]">
           {status === GenerationStatus.SUCCESS && videoUri ? (
             <div className="w-full h-full flex flex-col items-center animate-in fade-in duration-500">
               <video 
                  controls 
                  className="w-full rounded-lg shadow-2xl bg-black max-h-[500px]"
                  src={videoUri}
               />
               <a 
                 href={videoUri} 
                 download="veo-video.mp4"
                 className="mt-6 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors"
               >
                 Download Video
               </a>
             </div>
           ) : status === GenerationStatus.LOADING ? (
             <div className="text-center max-w-xs">
                <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-6"></div>
                <h3 className="text-white font-medium mb-2">Generating Video</h3>
                <p className="text-zinc-500 text-sm">This can take a minute. Veo is calculating physics and light...</p>
             </div>
           ) : (
             <div className="text-center opacity-30 select-none">
                <Film className="w-24 h-24 mx-auto mb-4 text-zinc-600" />
                <p className="text-zinc-500">Video preview will appear here</p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};