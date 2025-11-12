import React, { useState } from 'react';
import type { GameAsset } from '../types';
import { GeminiIcon } from './icons/GeminiIcon';
import { GoogleGenAI, Modality } from '@google/genai';

interface AudioLabProps {
  onClose: () => void;
  onAddAsset: (asset: GameAsset) => void;
}

const decode = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

const getWavHeader = (dataLength: number, numChannels: number, sampleRate: number, bitsPerSample: number) => {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  // RIFF identifier
  view.setUint8(0, 'R'.charCodeAt(0));
  view.setUint8(1, 'I'.charCodeAt(0));
  view.setUint8(2, 'F'.charCodeAt(0));
  view.setUint8(3, 'F'.charCodeAt(0));
  // file length
  view.setUint32(4, 36 + dataLength, true);
  // WAVE identifier
  view.setUint8(8, 'W'.charCodeAt(0));
  view.setUint8(9, 'A'.charCodeAt(0));
  view.setUint8(10, 'V'.charCodeAt(0));
  view.setUint8(11, 'E'.charCodeAt(0));
  // FMT chunk identifier
  view.setUint8(12, 'f'.charCodeAt(0));
  view.setUint8(13, 'm'.charCodeAt(0));
  view.setUint8(14, 't'.charCodeAt(0));
  view.setUint8(15, ' '.charCodeAt(0));
  // chunk length
  view.setUint32(16, 16, true);
  // audio format (1 for PCM)
  view.setUint16(20, 1, true);
  // number of channels
  view.setUint16(22, numChannels, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate
  view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
  // block align
  view.setUint16(32, numChannels * (bitsPerSample / 8), true);
  // bits per sample
  view.setUint16(34, bitsPerSample, true);
  // data chunk identifier
  view.setUint8(36, 'd'.charCodeAt(0));
  view.setUint8(37, 'a'.charCodeAt(0));
  view.setUint8(38, 't'.charCodeAt(0));
  view.setUint8(39, 'a'.charCodeAt(0));
  // data length
  view.setUint32(40, dataLength, true);

  return new Uint8Array(header);
};

const AudioLab: React.FC<AudioLabProps> = ({ onClose, onAddAsset }) => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim() || !process.env.API_KEY) {
      if (!process.env.API_KEY) {
        setError("API Key no configurada.");
      }
      return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedAudioUrl(null);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Generate a sound of: ${prompt}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Kore' },
              },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      
      if (base64Audio) {
          const pcmBytes = decode(base64Audio);
          const header = getWavHeader(pcmBytes.length, 1, 24000, 16);
          const wavBlob = new Blob([header, pcmBytes], { type: 'audio/wav' });
          const audioUrl = URL.createObjectURL(wavBlob);
          setGeneratedAudioUrl(audioUrl);
      } else {
          setError("La respuesta de la IA no contenía datos de audio.");
      }
    } catch (err) {
        console.error("Error generating audio with Gemini:", err);
        setError(err instanceof Error ? err.message : "Un error desconocido ha ocurrido.");
    } finally {
        setIsLoading(false);
    }
  };
  
  const handleSave = () => {
    if (!generatedAudioUrl) return;
    const assetName = `${prompt.slice(0, 20).replace(/\s+/g, '_') || 'audio'}.wav`;
    const newAsset: GameAsset = {
        id: `asset_audio_${Date.now()}`,
        name: assetName,
        type: 'audio',
        url: generatedAudioUrl,
    };
    onAddAsset(newAsset);
    onClose();
  };


  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-900 rounded-lg shadow-2xl w-full max-w-2xl flex flex-col border border-gray-800" onClick={e => e.stopPropagation()}>
        <header className="flex items-center justify-between p-4 border-b border-gray-800 shrink-0">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <GeminiIcon />
            Laboratorio de Sonido
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl font-bold">&times;</button>
        </header>

        <main className="p-6 space-y-4">
            <p className="text-sm text-gray-400">
                Genera efectos de sonido o diálogos cortos con IA. Describe lo que quieres oír. Por ejemplo: "explosión de ciencia ficción", "portazo", "voz de robot diciendo 'hola'".
            </p>
            <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ej: explosión, pisadas sobre la hierba, voz de robot diciendo 'hola mundo'"
                className="w-full h-24 p-2 rounded-md bg-gray-800 border border-gray-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                disabled={isLoading}
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            
            <div className="h-24 flex items-center justify-center">
            {isLoading ? (
                <div className="text-center">
                    <svg className="animate-spin h-8 w-8 text-indigo-400 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-sm text-gray-400 mt-2">Generando audio...</p>
                </div>
            ) : generatedAudioUrl && (
                <div className="w-full flex flex-col items-center gap-4">
                    <audio src={generatedAudioUrl} controls className="w-full" />
                    <button onClick={handleSave} className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded-md text-sm font-semibold">
                        Guardar en Recursos
                    </button>
                </div>
            )}
            </div>
        </main>

        <footer className="p-4 border-t border-gray-800 flex justify-end">
            <button 
                onClick={handleGenerate}
                disabled={isLoading || !prompt.trim()}
                className="px-6 py-2 bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-gray-700 disabled:cursor-not-allowed flex items-center gap-2 font-semibold"
            >
                Generar
            </button>
        </footer>
      </div>
    </div>
  );
};

export default AudioLab;