import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { GameAsset } from '../types';
import { GeminiIcon } from './icons/GeminiIcon';
import { MusicNoteIcon } from './icons/MusicNoteIcon';
import { GoogleGenAI, Modality } from '@google/genai';

interface SoundtrackEditorProps {
  onClose: () => void;
  onAddAsset: (asset: GameAsset) => void;
}

interface Track {
    id: number;
    name: string;
    prompt: string;
    audioUrl: string | null;
    audioBuffer: AudioBuffer | null;
    volume: number;
    isMuted: boolean;
    isLoading: boolean;
}

const initialTracks: Track[] = [
    { id: 1, name: 'Batería', prompt: '', audioUrl: null, audioBuffer: null, volume: 0.8, isMuted: false, isLoading: false },
    { id: 2, name: 'Bajo', prompt: '', audioUrl: null, audioBuffer: null, volume: 0.8, isMuted: false, isLoading: false },
    { id: 3, name: 'Melodía', prompt: '', audioUrl: null, audioBuffer: null, volume: 0.7, isMuted: false, isLoading: false },
    { id: 4, name: 'Pads', prompt: '', audioUrl: null, audioBuffer: null, volume: 0.6, isMuted: false, isLoading: false },
];

const decode = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

async function decodePcmToAudioBuffer(
  data: Uint8Array,
  ctx: AudioContext,
): Promise<AudioBuffer> {
  const sampleRate = 24000; // from TTS model
  const numChannels = 1; // mono
  // The PCM data from the TTS model is 16-bit signed integers.
  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.length / 2);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < frameCount; i++) {
    // Convert 16-bit int to float between -1.0 and 1.0
    channelData[i] = dataInt16[i] / 32768.0;
  }
  return buffer;
}


const audioBufferToWav = (buffer: AudioBuffer): Blob => {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const bufferArray = new ArrayBuffer(length);
    const view = new DataView(bufferArray);
    const channels = [];
    let i, sample;
    let offset = 0;
    let pos = 0;

    // write WAVE header
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"

    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(1); // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2); // block-align
    setUint16(16); // 16-bit

    setUint32(0x61746164); // "data" - chunk
    setUint32(length - pos - 4); // chunk length

    for (i = 0; i < buffer.numberOfChannels; i++)
        channels.push(buffer.getChannelData(i));

    while (pos < length) {
        for (i = 0; i < numOfChan; i++) {
            sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; // scale to 16-bit signed int
            view.setInt16(pos, sample, true); // write 16-bit sample
            pos += 2;
        }
        offset++;
    }

    return new Blob([view], { type: 'audio/wav' });

    function setUint16(data: number) {
        view.setUint16(pos, data, true);
        pos += 2;
    }

    function setUint32(data: number) {
        view.setUint32(pos, data, true);
        pos += 4;
    }
};


const SoundtrackEditor: React.FC<SoundtrackEditorProps> = ({ onClose, onAddAsset }) => {
    const [mainPrompt, setMainPrompt] = useState('');
    const [tracks, setTracks] = useState<Track[]>(initialTracks);
    const [isLoading, setIsLoading] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [masterVolume, setMasterVolume] = useState(0.8);

    const audioContextRef = useRef<AudioContext | null>(null);
    const trackNodesRef = useRef<Map<number, { source: AudioBufferSourceNode, gain: GainNode }>>(new Map());
    const masterGainRef = useRef<GainNode | null>(null);

    const updateTrack = (id: number, updates: Partial<Track>) => {
        setTracks(currentTracks => currentTracks.map(t => t.id === id ? { ...t, ...updates } : t));
    };
    
    const handleGenerateIdeas = async () => {
         if (!mainPrompt.trim() || !process.env.API_KEY) return;
         setIsLoading(true);
         try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const result = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Basado en el siguiente tema de canción, genera un prompt corto y creativo (máx 10 palabras) para cada una de las siguientes pistas de audio: Batería, Bajo, Melodía y Pads. Responde solo con un objeto JSON con las claves "drum", "bass", "melody", "pads". Tema: "${mainPrompt}"`
            });
            const jsonText = result.text.match(/\{[^]*\}/)?.[0] ?? '{}';
            const ideas = JSON.parse(jsonText);
            
            const newTracks = [...tracks];
            if (ideas.drum) newTracks[0].prompt = ideas.drum;
            if (ideas.bass) newTracks[1].prompt = ideas.bass;
            if (ideas.melody) newTracks[2].prompt = ideas.melody;
            if (ideas.pads) newTracks[3].prompt = ideas.pads;
            setTracks(newTracks);

         } catch (e) {
            console.error("Error generating track ideas", e);
         } finally {
            setIsLoading(false);
         }
    };
    
    const handleGenerateTrack = useCallback(async (trackId: number) => {
        const track = tracks.find(t => t.id === trackId);
        if (!track || !track.prompt || !process.env.API_KEY) {
            if (!process.env.API_KEY) console.error("API Key not configured.");
            return;
        }

        updateTrack(trackId, { isLoading: true, audioUrl: null, audioBuffer: null });
        
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: [{ parts: [{ text: `Genera un elemento musical corto y en bucle para una banda sonora basado en esta descripción: ${track.prompt}` }] }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
                    },
                },
            });

            const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

            if (base64Audio) {
                if (!audioContextRef.current) {
                    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
                }
                const pcmBytes = decode(base64Audio);
                const audioBuffer = await decodePcmToAudioBuffer(pcmBytes, audioContextRef.current);
                
                updateTrack(trackId, { audioBuffer, isLoading: false });
            } else {
                console.error("La respuesta de la IA no contenía datos de audio para la pista", trackId);
                updateTrack(trackId, { isLoading: false });
            }

        } catch(e) {
            console.error("Error al generar audio para la pista", trackId, e);
            updateTrack(trackId, { isLoading: false });
        }
    }, [tracks]);

    const stopAllTracks = useCallback(() => {
        trackNodesRef.current.forEach(({ source }) => {
            try { source.stop(); } catch(e) {}
        });
        trackNodesRef.current.clear();
    }, []);
    
    const playAllTracks = useCallback(() => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume();
        }

        stopAllTracks();

        if (!masterGainRef.current) {
            masterGainRef.current = audioContextRef.current.createGain();
            masterGainRef.current.connect(audioContextRef.current.destination);
        }
        masterGainRef.current.gain.setValueAtTime(masterVolume, audioContextRef.current.currentTime);
        
        tracks.forEach(track => {
            if (track.audioBuffer) {
                const source = audioContextRef.current!.createBufferSource();
                source.buffer = track.audioBuffer;
                source.loop = true;

                const gain = audioContextRef.current!.createGain();
                gain.gain.setValueAtTime(track.isMuted ? 0 : track.volume, audioContextRef.current!.currentTime);
                
                source.connect(gain).connect(masterGainRef.current!);
                source.start(0);
                trackNodesRef.current.set(track.id, { source, gain });
            }
        });

    }, [tracks, masterVolume, stopAllTracks]);

    useEffect(() => {
        if (isPlaying) {
            playAllTracks();
        } else {
            stopAllTracks();
        }
        return () => stopAllTracks();
    }, [isPlaying, playAllTracks, stopAllTracks]);
    
    const handleVolumeChange = (trackId: number, newVolume: number) => {
        updateTrack(trackId, { volume: newVolume });
        const nodes = trackNodesRef.current.get(trackId);
        if (nodes && audioContextRef.current) {
            nodes.gain.gain.setValueAtTime(newVolume, audioContextRef.current.currentTime);
        }
    };
    
    const handleMasterVolumeChange = (newVolume: number) => {
        setMasterVolume(newVolume);
        if (masterGainRef.current && audioContextRef.current) {
            masterGainRef.current.gain.setValueAtTime(newVolume, audioContextRef.current.currentTime);
        }
    };

    const handleSave = async () => {
        const playableTracks = tracks.filter(t => t.audioBuffer);
        if (playableTracks.length === 0) {
            alert("Genera al menos una pista antes de guardar.");
            return;
        }

        setIsLoading(true);

        try {
            const longestTrack = playableTracks.reduce((max, t) => t.audioBuffer!.duration > max ? t.audioBuffer!.duration : max, 0);
            const sampleRate = audioContextRef.current?.sampleRate || 44100;

            const offlineCtx = new OfflineAudioContext(2, sampleRate * longestTrack, sampleRate);
            const masterGain = offlineCtx.createGain();
            masterGain.gain.value = masterVolume;
            masterGain.connect(offlineCtx.destination);
            
            playableTracks.forEach(track => {
                const source = offlineCtx.createBufferSource();
                source.buffer = track.audioBuffer;
                source.loop = true;

                const gain = offlineCtx.createGain();
                gain.gain.value = track.isMuted ? 0 : track.volume;
                
                source.connect(gain).connect(masterGain);
                source.start(0);
            });

            const renderedBuffer = await offlineCtx.startRendering();
            const wavBlob = audioBufferToWav(renderedBuffer);
            const audioUrl = URL.createObjectURL(wavBlob);
            
            const assetName = `${mainPrompt.slice(0, 20).replace(/\s+/g, '_') || 'banda_sonora'}.wav`;
            const newAsset: GameAsset = {
                id: `asset_soundtrack_${Date.now()}`,
                name: assetName,
                type: 'audio',
                url: audioUrl,
            };
            onAddAsset(newAsset);
            onClose();

        } catch (e) {
            console.error("Error saving soundtrack", e);
            alert("No se pudo guardar la banda sonora.");
        } finally {
            setIsLoading(false);
        }
    };


    return (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-gray-900 rounded-lg shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col border border-gray-800" onClick={e => e.stopPropagation()}>
                <header className="flex items-center justify-between p-4 border-b border-gray-800 shrink-0">
                    <h2 className="text-xl font-bold flex items-center gap-2"><MusicNoteIcon /> Editor de Banda Sonora</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl font-bold">&times;</button>
                </header>
                
                <main className="flex-grow p-4 space-y-4 overflow-y-auto">
                    <div className="bg-black/50 p-3 rounded-lg border border-gray-800 space-y-2">
                         <h3 className="text-md font-semibold text-indigo-300 flex items-center gap-2"><GeminiIcon /> 1. Describe tu canción</h3>
                         <input
                            value={mainPrompt}
                            onChange={(e) => setMainPrompt(e.target.value)}
                            placeholder="Ej: una canción funk animada para un nivel de ciudad"
                            className="w-full p-2 rounded-md bg-gray-800 border border-gray-700 text-sm"
                            disabled={isLoading}
                         />
                         <button onClick={handleGenerateIdeas} disabled={isLoading || !mainPrompt.trim()} className="px-3 py-1.5 bg-indigo-600 rounded-md hover:bg-indigo-700 text-sm disabled:bg-gray-600">Generar Ideas para Pistas</button>
                    </div>

                    <div className="bg-black/50 p-3 rounded-lg border border-gray-800 space-y-3">
                         <h3 className="text-md font-semibold text-indigo-300">2. Genera y Mezcla las Pistas</h3>
                        {tracks.map(track => (
                            <div key={track.id} className="grid grid-cols-[80px_1fr_100px_150px] items-center gap-3 bg-gray-800/50 p-2 rounded-md">
                                <span className="font-bold text-sm">{track.name}</span>
                                <input 
                                    type="text"
                                    value={track.prompt}
                                    onChange={e => updateTrack(track.id, { prompt: e.target.value })}
                                    className="w-full text-xs bg-gray-700 p-1.5 rounded"
                                    placeholder={`Describe el sonido para ${track.name.toLowerCase()}...`}
                                />
                                <button onClick={() => handleGenerateTrack(track.id)} disabled={!track.prompt || track.isLoading} className="text-xs bg-indigo-600 px-2 py-1.5 rounded hover:bg-indigo-700 disabled:bg-gray-600">
                                    {track.isLoading ? '...' : (track.audioBuffer ? 'Re-Generar' : 'Generar')}
                                </button>
                                <div className="flex items-center gap-2">
                                     <input type="range" min="0" max="1" step="0.01" value={track.volume} onChange={e => handleVolumeChange(track.id, parseFloat(e.target.value))} className="w-full" disabled={!track.audioBuffer}/>
                                </div>
                            </div>
                        ))}
                    </div>
                </main>

                 <footer className="p-4 border-t border-gray-800 shrink-0 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsPlaying(p => !p)} className="px-4 py-2 bg-green-600 rounded-md hover:bg-green-700 text-sm font-semibold">{isPlaying ? 'Parar' : 'Reproducir'}</button>
                        <div className="flex items-center gap-2">
                             <span className="text-xs">Volumen Master</span>
                             <input type="range" min="0" max="1" step="0.01" value={masterVolume} onChange={e => handleMasterVolumeChange(parseFloat(e.target.value))} />
                        </div>
                    </div>
                    <button onClick={handleSave} disabled={isLoading || tracks.every(t => !t.audioBuffer)} className="px-6 py-2 bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-gray-700 disabled:cursor-not-allowed font-semibold">
                        {isLoading ? 'Guardando...' : 'Guardar Banda Sonora'}
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default SoundtrackEditor;
