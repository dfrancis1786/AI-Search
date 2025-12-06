/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export enum GenerationStatus {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export interface GeneratedSvg {
  id: string;
  content: string;
  prompt: string;
  timestamp: number;
}

export interface GeneratedImage {
  id: string;
  dataUrl: string; // base64 data url
  prompt: string;
}

export interface GeneratedVideo {
  id: string;
  videoUri: string;
  prompt?: string;
}

export interface SearchResult {
  text: string;
  sources: Array<{
    title: string;
    uri: string;
  }>;
}

export interface ApiError {
  message: string;
  details?: string;
}

export type AppMode = 'vector' | 'image-edit' | 'video' | 'search';
