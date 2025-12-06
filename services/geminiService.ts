/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI } from "@google/genai";

// Initialize the client
// CRITICAL: We use process.env.API_KEY as per strict guidelines.
// For Veo, we will re-instantiate this with the user-selected key if needed, 
// but for the default client we use the injected one.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to convert File to base64
export const fileToPart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Generates an SVG string based on the user's prompt.
 */
export const generateSvgFromPrompt = async (prompt: string, complexity: number = 3): Promise<string> => {
  try {
    const complexityGuides: Record<number, string> = {
      1: "Style: Ultra-minimalist icon. Use very few paths, solid flat colors, no gradients, and abstract shapes. Focus on essence.",
      2: "Style: Simple flat design. Clean lines, limited color palette, minimal details.",
      3: "Style: Standard vector illustration. Balanced detail, some shading, clear forms.",
      4: "Style: Detailed vector art. Use gradients, highlights, shadows, and intricate path work.",
      5: "Style: Hyper-realistic or highly complex vector art. Extensive use of gradients, fine details, texturing, and depth."
    };

    const styleInstruction = complexityGuides[complexity] || complexityGuides[3];

    const systemPrompt = `
      You are a world-class expert in Scalable Vector Graphics (SVG) design and coding. 
      Your task is to generate a high-quality, visually stunning, and detailed SVG based on the user's description of an object or item.
      
      Guidelines:
      1.  **Output Format**: Return ONLY the raw SVG code. Do not wrap it in markdown code blocks (e.g., no \`\`\`xml). Do not add any conversational text before or after.
      2.  **Quality**: ${styleInstruction}
      3.  **Technical**: 
          - Always include a \`viewBox\` attribute.
          - Ensure the SVG is self-contained (no external references).
          - Use semantic IDs or classes if helpful, but inline styles are preferred for portability.
          - Default size should be square (e.g., 512x512) unless the aspect ratio suggests otherwise.
    `;

    const fullPrompt = `Create an SVG representation of the following object/item: "${prompt}"\n\nComplexity Level: ${complexity}/5.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: fullPrompt,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.4,
        topP: 0.95,
        topK: 40,
      },
    });

    const rawText = response.text || '';
    const svgMatch = rawText.match(/<svg[\s\S]*?<\/svg>/i);
    
    if (svgMatch && svgMatch[0]) {
      return svgMatch[0];
    } else {
      return rawText.replace(/```xml/g, '').replace(/```svg/g, '').replace(/```/g, '').trim();
    }

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw new Error(error.message || "Failed to generate SVG.");
  }
};

/**
 * Edits an image using Gemini 2.5 Flash Image.
 */
export const editImageWithGemini = async (imageFile: File, prompt: string): Promise<string> => {
  try {
    const base64Data = await fileToPart(imageFile);
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: imageFile.type
            }
          },
          { text: prompt }
        ]
      }
    });

    // Extract image from response parts
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    
    throw new Error("No image generated in response");

  } catch (error: any) {
    console.error("Gemini Image Edit Error:", error);
    throw new Error(error.message || "Failed to edit image.");
  }
};

/**
 * Generates a video using Veo (veo-3.1-fast-generate-preview).
 * Requires API Key selection handling in the UI.
 */
export const generateVideoWithVeo = async (
  imageFile: File, 
  prompt: string, 
  aspectRatio: '16:9' | '9:16'
): Promise<string> => {
  try {
    // Re-initialize AI client to ensure we have the selected key from the UI flow
    // Although process.env.API_KEY is standard, Veo flows often require explicit key selection checks
    // which inject the key into the environment for this session.
    const veoAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const base64Data = await fileToPart(imageFile);

    let operation = await veoAi.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: prompt || "Animate this image", 
      image: {
        imageBytes: base64Data,
        mimeType: imageFile.type
      },
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: aspectRatio
      }
    });

    // Polling
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5s
      operation = await veoAi.operations.getVideosOperation({ operation: operation });
    }

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!videoUri) throw new Error("No video URI returned.");

    // Append key for fetching
    return `${videoUri}&key=${process.env.API_KEY}`;

  } catch (error: any) {
    console.error("Veo Error:", error);
    throw new Error(error.message || "Failed to generate video.");
  }
};

/**
 * Uses Gemini 2.5 Flash with Google Search grounding.
 */
export const searchWithGemini = async (query: string): Promise<{ text: string, sources: Array<{title: string, uri: string}> }> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: query,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    const text = response.text || "No result found.";
    
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = chunks
      .map((chunk: any) => chunk.web)
      .filter((web: any) => web && web.uri && web.title);

    return { text, sources };

  } catch (error: any) {
    console.error("Search Error:", error);
    throw new Error(error.message || "Search failed.");
  }
};
