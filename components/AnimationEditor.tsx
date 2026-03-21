import React, { useState, useMemo, useEffect } from 'react';
import { TimelineIcon } from './icons/TimelineIcon';
import type { Animation, GameAsset, AnimationKeyframe } from '../types';

interface AnimationEditorProps {
  onClose: () => void;
  onSave: (animations: Animation[]) => void;
  animations: Animation[];
  assets: GameAsset[];
}

const CloneIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z" />
        <path d="M5 3a2 2 0 00-2 2v6a2 2 0 002 2V5h6a2 2 0 00-2-2H5z" />
    </svg>
);


const AnimationEditor: React.FC<AnimationEditorProps> = ({ onClose, onSave, animations: initialAnimations, assets }) => {
  const [animations, setAnimations] = useState<Animation[]>(initialAnimations);
  const [selectedAnimId, setSelectedAnimId] = useState<string | null>(null);
  const [onionSkin, setOnionSkin] = useState({ enabled: true, pastFrames: 1, futureFrames: 1 });

  const imageAssets = useMemo(() => assets.filter(a => a.type === 'image'), [assets]);
  const selectedAnimation = useMemo(() => animations.find(a => a.id === selectedAnimId), [animations, selectedAnimId]);
  
  const [previewFrame, setPreviewFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  
  useEffect(() => {
    if (!isPlaying || !selectedAnimation || selectedAnimation.frames.length === 0) {
        return;
    }

    const currentFrameData = selectedAnimation.frames[previewFrame];
    if (!currentFrameData) {
        setPreviewFrame(0);
        return;
    }

    const nextFrameIndex = (previewFrame + 1) % selectedAnimation.frames.length;

    const timeoutId = setTimeout(() => {
        setPreviewFrame(nextFrameIndex);
    }, currentFrameData.duration);
    
    return () => clearTimeout(timeoutId);

  }, [isPlaying, selectedAnimation, previewFrame]);
  
  useEffect(() => {
      if (!selectedAnimId && animations.length > 0) {
          setSelectedAnimId(animations[0].id);
      }
      if (selectedAnimation) {
          setPreviewFrame(0);
      }
  }, [animations, selectedAnimId, selectedAnimation]);

  const handleCreateAnimation = () => {
    const newName = `Animación_${animations.length + 1}`;
    const newAnim: Animation = {
      id: `anim_${Date.now()}`,
      name: newName,
      frames: [],
      loop: true,
    };
    setAnimations(prev => [...prev, newAnim]);
    setSelectedAnimId(newAnim.id);
  };
  
  const updateSelectedAnimation = (updates: Partial<Animation>) => {
      if (!selectedAnimId) return;
      setAnimations(prev => prev.map(anim => anim.id === selectedAnimId ? { ...anim, ...updates } : anim));
  };
  
  const addFrame = (assetId: string) => {
      if (!selectedAnimation) return;
      const newFrame: AnimationKeyframe = { 
        assetId, 
        duration: 100,
        x: 0,
        y: 0,
        rotation: 0,
        scaleX: 1,
        scaleY: 1
      };
      updateSelectedAnimation({ frames: [...selectedAnimation.frames, newFrame] });
  };
  
  const updateFrame = (frameIndex: number, updates: Partial<AnimationKeyframe>) => {
      if (!selectedAnimation) return;
      const newFrames = [...selectedAnimation.frames];
      newFrames[frameIndex] = { ...newFrames[frameIndex], ...updates };
      updateSelectedAnimation({ frames: newFrames });
  };
  
  const removeFrame = (frameIndex: number) => {
      if (!selectedAnimation) return;
      const newFrames = selectedAnimation.frames.filter((_, i) => i !== frameIndex);
      updateSelectedAnimation({ frames: newFrames });
  }

  const duplicateFrame = (frameIndex: number) => {
    if (!selectedAnimation) return;
    const frameToClone = { ...selectedAnimation.frames[frameIndex] };
    const newFrames = [...selectedAnimation.frames];
    newFrames.splice(frameIndex + 1, 0, frameToClone);
    updateSelectedAnimation({ frames: newFrames });
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData("frameIndex", index.toString());
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    if (!selectedAnimation) return;
    const dragIndex = parseInt(e.dataTransfer.getData("frameIndex"), 10);
    const newFrames = [...selectedAnimation.frames];
    const [draggedFrame] = newFrames.splice(dragIndex, 1);
    newFrames.splice(dropIndex, 0, draggedFrame);
    updateSelectedAnimation({ frames: newFrames });
  };

  const handleSave = () => {
      onSave(animations);
      onClose();
  };

  const getFrameData = (frameIndex: number) => {
    if (!selectedAnimation || selectedAnimation.frames.length === 0) return null;
    const frameCount = selectedAnimation.frames.length;
    const safeIndex = (frameIndex % frameCount + frameCount) % frameCount;
    return selectedAnimation.frames[safeIndex];
  };

  const getFrameUrl = (frameIndex: number): string => {
    const frame = getFrameData(frameIndex);
    if (!frame) return '';
    return assets.find(a => a.id === frame.assetId)?.url ?? '';
  };

  const getFrameStyle = (frameIndex: number): React.CSSProperties => {
    const frame = getFrameData(frameIndex);
    if (!frame) return {};
    
    return {
      transform: `translate(${frame.x || 0}px, ${frame.y || 0}px) rotate(${frame.rotation || 0}deg) scale(${frame.scaleX ?? 1}, ${frame.scaleY ?? 1})`,
    };
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4" onClick={handleSave}>
      <div className="bg-gray-900 rounded-lg shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col border border-gray-800" onClick={e => e.stopPropagation()}>
        <header className="flex items-center justify-between p-4 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-2">
            <TimelineIcon />
            <h2 className="text-xl font-bold">Editor de Animación</h2>
          </div>
          <button onClick={handleSave} className="text-gray-400 hover:text-white text-2xl font-bold">&times;</button>
        </header>
        
        <main className="flex-grow flex p-4 overflow-hidden gap-4">
            <aside className="w-1/4 bg-black/50 rounded-lg p-2 flex flex-col">
                <h3 className="text-lg font-semibold p-2 border-b border-gray-800">Animaciones</h3>
                <ul className="flex-grow overflow-y-auto py-2">
                    {animations.map(anim => (
                        <li key={anim.id} onClick={() => setSelectedAnimId(anim.id)} className={`p-2 rounded-md cursor-pointer ${selectedAnimId === anim.id ? 'bg-indigo-600' : 'hover:bg-gray-800'}`}>{anim.name}</li>
                    ))}
                </ul>
                <button onClick={handleCreateAnimation} className="w-full text-sm p-2 bg-gray-800 hover:bg-indigo-600 rounded-md mt-2">Nueva Animación</button>
            </aside>

            <div className="w-1/2 flex flex-col gap-4">
                <div className="h-2/3 bg-black/50 rounded-lg flex items-center justify-center relative overflow-hidden" style={{ backgroundSize: '20px 20px', backgroundImage: 'radial-gradient(circle, #374151 1px, rgba(0,0,0,0) 1px)' }}>
                   {/* Onion Skin Layers */}
                   {onionSkin.enabled && Array.from({ length: onionSkin.pastFrames }, (_, i) => i + 1).reverse().map(i => (
                       <img key={`past-${i}`} src={getFrameUrl(previewFrame - i)} style={getFrameStyle(previewFrame - i)} className="absolute max-w-full max-h-full object-contain opacity-20" />
                   ))}
                   {onionSkin.enabled && Array.from({ length: onionSkin.futureFrames }, (_, i) => i + 1).map(i => (
                       <img key={`future-${i}`} src={getFrameUrl(previewFrame + i)} style={getFrameStyle(previewFrame + i)} className="absolute max-w-full max-h-full object-contain opacity-20" />
                   ))}
                   {/* Current Frame */}
                   <img src={getFrameUrl(previewFrame)} style={getFrameStyle(previewFrame)} alt="Preview" className="relative max-w-full max-h-full object-contain" />

                   <div className="absolute bottom-2 left-2 flex gap-2">
                        <button onClick={() => setIsPlaying(!isPlaying)} className="p-2 bg-gray-800 rounded-md hover:bg-indigo-600">{isPlaying ? 'Pausa' : 'Reproducir'}</button>
                    </div>
                </div>
                 <div className="h-1/3 bg-black/50 rounded-lg p-2">
                     <h3 className="text-sm font-semibold mb-2">Recursos de Imagen</h3>
                     <div className="flex gap-2 overflow-x-auto h-full pb-2">
                         {imageAssets.map(asset => (
                             <div key={asset.id} onClick={() => addFrame(asset.id)} className="flex-shrink-0 cursor-pointer p-1 rounded-md hover:bg-indigo-600">
                                 <img src={asset.url} alt={asset.name} title={`Añadir ${asset.name}`} className="w-16 h-16 object-cover rounded-md" />
                             </div>
                         ))}
                     </div>
                 </div>
            </div>

            <aside className="w-1/4 bg-black/50 rounded-lg p-2 overflow-y-auto">
                 <h3 className="text-lg font-semibold p-2 border-b border-gray-800">Propiedades</h3>
                 {selectedAnimation ? <div className="p-2 space-y-4">
                     <div>
                         <label className="text-xs">Nombre</label>
                         <input type="text" value={selectedAnimation.name} onChange={e => updateSelectedAnimation({ name: e.target.value })} className="w-full bg-gray-800 p-1 rounded-md text-sm" />
                     </div>
                     <div>
                         <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selectedAnimation.loop} onChange={e => updateSelectedAnimation({ loop: e.target.checked })} /> Bucle</label>
                     </div>
                     <div className="border-t border-gray-800 pt-2 space-y-2">
                         <h4 className="text-sm font-semibold">Transformación del Frame</h4>
                         {selectedAnimation.frames[previewFrame] ? (
                             <div className="grid grid-cols-2 gap-2 text-xs">
                                 <div>
                                     <label>Pos X</label>
                                     <input type="number" value={selectedAnimation.frames[previewFrame].x || 0} onChange={e => updateFrame(previewFrame, { x: parseInt(e.target.value, 10) || 0 })} className="w-full bg-gray-800 p-1 rounded-md" />
                                 </div>
                                 <div>
                                     <label>Pos Y</label>
                                     <input type="number" value={selectedAnimation.frames[previewFrame].y || 0} onChange={e => updateFrame(previewFrame, { y: parseInt(e.target.value, 10) || 0 })} className="w-full bg-gray-800 p-1 rounded-md" />
                                 </div>
                                 <div>
                                     <label>Rotación</label>
                                     <input type="number" value={selectedAnimation.frames[previewFrame].rotation || 0} onChange={e => updateFrame(previewFrame, { rotation: parseInt(e.target.value, 10) || 0 })} className="w-full bg-gray-800 p-1 rounded-md" />
                                 </div>
                                 <div>
                                     <label>Escala</label>
                                     <div className="flex gap-1">
                                         <input type="number" step="0.1" value={selectedAnimation.frames[previewFrame].scaleX ?? 1} onChange={e => updateFrame(previewFrame, { scaleX: parseFloat(e.target.value) || 1 })} className="w-full bg-gray-800 p-1 rounded-md" placeholder="X" />
                                         <input type="number" step="0.1" value={selectedAnimation.frames[previewFrame].scaleY ?? 1} onChange={e => updateFrame(previewFrame, { scaleY: parseFloat(e.target.value) || 1 })} className="w-full bg-gray-800 p-1 rounded-md" placeholder="Y" />
                                     </div>
                                 </div>
                             </div>
                         ) : <p className="text-xs text-gray-500 italic">Añade frames para editar transformaciones.</p>}
                     </div>
                     <div className="border-t border-gray-800 pt-2 space-y-2">
                         <h4 className="text-sm font-semibold">Onion Skinning</h4>
                         <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onionSkin.enabled} onChange={e => setOnionSkin(s => ({...s, enabled: e.target.checked}))} /> Habilitado</label>
                         <div className="grid grid-cols-2 gap-2 text-sm">
                             <label>Anteriores: <input type="number" min="0" value={onionSkin.pastFrames} onChange={e => setOnionSkin(s => ({...s, pastFrames: parseInt(e.target.value, 10)}))} className="w-12 bg-gray-800 p-1 rounded-md" /></label>
                             <label>Siguientes: <input type="number" min="0" value={onionSkin.futureFrames} onChange={e => setOnionSkin(s => ({...s, futureFrames: parseInt(e.target.value, 10)}))} className="w-12 bg-gray-800 p-1 rounded-md" /></label>
                         </div>
                     </div>
                 </div> : <p className="p-2 text-sm text-gray-500">Selecciona una animación.</p>}
            </aside>
        </main>
        
        <footer className="h-48 p-4 border-t border-gray-800 shrink-0 bg-black/50">
            <h3 className="text-sm font-semibold mb-2">Línea de Tiempo</h3>
            <div className="w-full h-full bg-gray-800 rounded-md overflow-x-auto flex items-center p-2 gap-2 relative" onDragOver={e => e.preventDefault()}>
                {selectedAnimation?.frames.map((frame, index) => {
                    const asset = assets.find(a => a.id === frame.assetId);
                    return (<div 
                        key={`${frame.assetId}-${index}`} 
                        className={`relative flex flex-col items-center gap-1 p-2 rounded-md cursor-grab active:cursor-grabbing ${previewFrame === index ? 'bg-indigo-600' : 'bg-gray-900'}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDrop={(e) => handleDrop(e, index)}
                    >
                        <img src={asset?.url} className="w-16 h-16 object-cover rounded-md pointer-events-none" />
                        <input type="number" value={frame.duration} onChange={e => updateFrame(index, { duration: parseInt(e.target.value, 10) || 0 })} className="w-20 bg-gray-800 text-center rounded text-xs p-0.5" />
                        <span className="text-xs">ms</span>
                        <button onClick={() => removeFrame(index)} title="Eliminar" className="absolute -top-1 -right-1 bg-red-600 rounded-full h-4 w-4 text-xs z-10">&times;</button>
                        <button onClick={() => duplicateFrame(index)} title="Duplicar" className="absolute -top-1 -left-1 bg-blue-600 rounded-full p-0.5 text-xs z-10"><CloneIcon /></button>
                    </div>);
                })}
            </div>
        </footer>
      </div>
    </div>
  );
};

export default AnimationEditor;