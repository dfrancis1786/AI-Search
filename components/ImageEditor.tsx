/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { Upload, Wand2, Loader2, Image as ImageIcon, ArrowRight } from 'lucide-react';
import { editImageWithGemini } from '../services/geminiService';
import { GenerationStatus, ApiError } from '../types';

export const ImageEditor: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState<GenerationStatus>(GenerationStatus.IDLE);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target?.result as string);
      reader.readAsDataURL(selected);
      setResultImage(null);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !prompt) return;

    setStatus(GenerationStatus.LOADING);
    setError(null);
    setResultImage(null);

    try {
      const result = await editImageWithGemini(file, prompt);
      setResultImage(result);
      setStatus(GenerationStatus.SUCCESS);
    } catch (err: any) {
      setStatus(GenerationStatus.ERROR);
      setError({
        message: "Editing Failed",
        details: err.message
      });
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 mt-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-2">AI Image Editor</h2>
        <p className="text-zinc-400">Upload a photo and describe how to change it.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Column */}
        <div className="space-y-6">
          <div className={`
            border-2 border-dashed rounded-2xl p-8 text-center transition-all
            ${preview ? 'border-zinc-700 bg-zinc-900/50' : 'border-zinc-700 hover:border-indigo-500 hover:bg-zinc-800/50 cursor-pointer'}
          `}>
            {!preview ? (
              <label className="cursor-pointer block">
                <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-400">
                  <Upload className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-medium text-white">Upload an Image</h3>
                <p className="text-sm text-zinc-500 mt-2">PNG, JPG up to 5MB</p>
              </label>
            ) : (
              <div className="relative group">
                <img src={preview} alt="Original" className="w-full rounded-lg max-h-[400px] object-contain" />
                <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer rounded-lg">
                  <span className="text-white font-medium flex items-center gap-2">
                    <Upload className="w-4 h-4" /> Change Image
                  </span>
                  <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                </label>
              </div>
            )}
          </div>

          <form onSubmit={handleEdit} className="relative">
             <div className="relative flex items-center bg-zinc-900 rounded-xl border border-white/10 p-2 focus-within:ring-2 ring-indigo-500/50 transition-all">
               <Wand2 className="w-5 h-5 text-zinc-500 ml-3" />
               <input 
                 type="text" 
                 value={prompt}
                 onChange={(e) => setPrompt(e.target.value)}
                 placeholder="e.g. Add a retro filter, remove background..."
                 className="flex-1 bg-transparent border-none outline-none text-white px-4 py-3 placeholder-zinc-500"
                 disabled={status === GenerationStatus.LOADING}
               />
               <button 
                 type="submit"
                 disabled={!file || !prompt || status === GenerationStatus.LOADING}
                 className="bg-white text-black px-6 py-2 rounded-lg font-medium hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
               >
                 {status === GenerationStatus.LOADING ? <Loader2 className="w-5 h-5 animate-spin" /> : "Edit"}
               </button>
             </div>
          </form>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-200 text-sm">
              <span className="font-bold block mb-1">{error.message}</span>
              {error.details}
            </div>
          )}
        </div>

        {/* Result Column */}
        <div className="bg-zinc-900/30 rounded-2xl border border-white/5 p-6 min-h-[400px] flex flex-col items-center justify-center relative overflow-hidden">
          {status === GenerationStatus.SUCCESS && resultImage ? (
            <div className="w-full h-full flex flex-col items-center animate-in fade-in duration-500">
               <img src={resultImage} alt="Edited" className="w-full h-auto max-h-[500px] object-contain rounded-lg shadow-2xl" />
               <a 
                 href={resultImage} 
                 download="edited-image.png"
                 className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
               >
                 Download Image
               </a>
            </div>
          ) : status === GenerationStatus.LOADING ? (
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-zinc-400">Magic in progress...</p>
            </div>
          ) : (
            <div className="text-center opacity-30 select-none">
              <ImageIcon className="w-24 h-24 mx-auto mb-4 text-zinc-600" />
              <p className="text-zinc-500">Edited image will appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
