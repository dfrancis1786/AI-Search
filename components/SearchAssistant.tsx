/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { Search, Globe, ArrowRight, Loader2 } from 'lucide-react';
import { searchWithGemini } from '../services/geminiService';
import { GenerationStatus, SearchResult, ApiError } from '../types';

export const SearchAssistant: React.FC = () => {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<GenerationStatus>(GenerationStatus.IDLE);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setStatus(GenerationStatus.LOADING);
    setError(null);
    setResult(null);

    try {
      const data = await searchWithGemini(query);
      setResult(data);
      setStatus(GenerationStatus.SUCCESS);
    } catch (err: any) {
      setStatus(GenerationStatus.ERROR);
      setError({ message: "Search Failed", details: err.message });
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 mt-12">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-2">Ask Gemini</h2>
        <p className="text-zinc-400">Grounded with Google Search data.</p>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto mb-12">
         <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
           <Search className="h-5 w-5 text-zinc-500" />
         </div>
         <input
           type="text"
           value={query}
           onChange={(e) => setQuery(e.target.value)}
           placeholder="Ask anything..."
           className="block w-full pl-11 pr-32 py-4 bg-zinc-900 border border-white/10 rounded-full text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-xl"
           disabled={status === GenerationStatus.LOADING}
         />
         <div className="absolute inset-y-1.5 right-1.5">
           <button
             type="submit"
             disabled={!query.trim() || status === GenerationStatus.LOADING}
             className="h-full px-6 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
           >
             {status === GenerationStatus.LOADING ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
           </button>
         </div>
      </form>

      {/* Results */}
      {status === GenerationStatus.ERROR && error && (
        <div className="max-w-2xl mx-auto p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-200 text-center">
          {error.message}: {error.details}
        </div>
      )}

      {status === GenerationStatus.SUCCESS && result && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
           {/* Answer */}
           <div className="bg-zinc-900/80 border border-white/10 rounded-2xl p-8 mb-6 shadow-2xl backdrop-blur-sm">
             <div className="prose prose-invert prose-lg max-w-none">
               <p className="whitespace-pre-wrap leading-relaxed text-zinc-200">
                 {result.text}
               </p>
             </div>
           </div>

           {/* Sources */}
           {result.sources.length > 0 && (
             <div className="max-w-4xl mx-auto">
               <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-4 px-2">Sources</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                 {result.sources.map((source, idx) => (
                   <a 
                     key={idx} 
                     href={source.uri} 
                     target="_blank" 
                     rel="noopener noreferrer"
                     className="flex items-start gap-3 p-4 bg-zinc-900 border border-white/5 rounded-xl hover:bg-zinc-800 hover:border-white/10 transition-all group"
                   >
                     <div className="mt-1 min-w-[20px]">
                       <Globe className="w-5 h-5 text-blue-400" />
                     </div>
                     <div className="flex-1 overflow-hidden">
                       <h4 className="font-medium text-white truncate group-hover:text-blue-300 transition-colors">{source.title}</h4>
                       <p className="text-xs text-zinc-500 truncate mt-0.5">{source.uri}</p>
                     </div>
                     <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 opacity-0 group-hover:opacity-100 transition-all transform -translate-x-2 group-hover:translate-x-0" />
                   </a>
                 ))}
               </div>
             </div>
           )}
        </div>
      )}
    </div>
  );
};
