import React, { useState, useRef } from 'react';
import type { GameObject, Scene, GameAsset } from '../types';
import { PlusIcon } from './icons/PlusIcon';
import { TimelineIcon } from './icons/TimelineIcon';
import { EditIcon } from './icons/EditIcon';
import { SoundWaveIcon } from './icons/SoundWaveIcon';
import { MusicNoteIcon } from './icons/MusicNoteIcon';

const CollapseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
    </svg>
);

const ExpandIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
    </svg>
);

const CloneIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z" />
        <path d="M5 3a2 2 0 00-2 2v6a2 2 0 002 2V5h6a2 2 0 00-2-2H5z" />
    </svg>
);

interface ObjectTreeProps {
  objects: GameObject[];
  parentId?: number | null;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onSetParent: (childId: number, parentId: number | null) => void;
  level?: number;
}

const ObjectTree: React.FC<ObjectTreeProps> = ({ objects, parentId = null, selectedId, onSelect, onSetParent, level = 0 }) => {
    const children = objects.filter(obj => (obj.parentId || null) === parentId);

    const handleDragStart = (e: React.DragEvent, obj: GameObject) => {
        e.dataTransfer.setData('application/game-object-id', obj.id.toString());
        e.dataTransfer.effectAllowed = 'move';
        e.stopPropagation();
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent, targetParentId: number | null) => {
        e.preventDefault();
        e.stopPropagation();
        const childId = parseInt(e.dataTransfer.getData('application/game-object-id'), 10);
        if (childId && childId !== targetParentId) {
            onSetParent(childId, targetParentId);
        }
    };

    if (children.length === 0 && level > 0) return null;

    return (
        <ul style={{ paddingLeft: level > 0 ? '1rem' : '0' }}>
            {children.map(obj => (
                <li key={obj.id}>
                    <div
                        onClick={() => onSelect(obj.id)}
                        draggable={true}
                        onDragStart={(e) => handleDragStart(e, obj)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, obj.id)}
                        className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors duration-150 rounded-md my-0.5 ${
                            selectedId === obj.id
                                ? 'bg-indigo-600 text-white'
                                : 'hover:bg-gray-800'
                        }`}
                    >
                        {obj.imageUrl ? (
                            <img src={obj.imageUrl} alt={obj.name} className="w-5 h-5 object-cover rounded-sm border border-gray-600" />
                        ) : (
                            <div 
                                className="w-4 h-4 rounded-sm border border-gray-500 shrink-0 flex items-center justify-center" 
                                style={{ backgroundColor: obj.color === 'transparent' ? '#1f2937' : obj.color }}
                            >
                                {obj.color === 'transparent' && <span className="text-gray-500 text-xs">+</span>}
                            </div>
                        )}
                        <span className="truncate">{obj.name}</span>
                    </div>
                    <ObjectTree 
                        objects={objects} 
                        parentId={obj.id} 
                        selectedId={selectedId}
                        onSelect={onSelect}
                        onSetParent={onSetParent}
                        level={level + 1}
                    />
                </li>
            ))}
        </ul>
    );
};

interface SceneHierarchyProps {
  scenes: Scene[];
  activeSceneId: string | null;
  onSelectScene: (id: string) => void;
  onAddScene: () => void;
  onCloneScene: (id: string) => void;
  objects: GameObject[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onUpdateObject: (id: number, updates: Partial<GameObject>) => void;
  assets: GameAsset[];
  onAddAsset: (asset: GameAsset) => void;
  onUpdateAsset: (asset: GameAsset) => void;
  onOpenAnimationEditor: () => void;
  onOpenSpriteEditor: (assetId: string | null) => void;
  onOpenAudioLab: () => void;
  onOpenSoundtrackEditor: () => void;
  width: number;
  onToggleCollapse: () => void;
}

const AssetBrowserContent: React.FC<{
    assets: GameAsset[], 
    onAddAsset: (asset: GameAsset) => void, 
    onOpenAnimationEditor: () => void,
    onOpenSpriteEditor: (assetId: string | null) => void,
    onOpenAudioLab: () => void,
    onOpenSoundtrackEditor: () => void,
}> = ({ assets, onAddAsset, onOpenAnimationEditor, onOpenSpriteEditor, onOpenAudioLab, onOpenSoundtrackEditor }) => {
  const [activeTab, setActiveTab] = useState<'images' | 'audio' | 'videos'>('images');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const imageAssets = assets.filter(a => a.type === 'image');
  const audioAssets = assets.filter(a => a.type === 'audio');
  const videoAssets = assets.filter(a => a.type === 'video');

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = (e) => {
        const fileType = file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'audio' : file.type.startsWith('video/') ? 'video' : null;
        if (!fileType) return;

        const newAsset: GameAsset = {
          id: `asset_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          name: file.name,
          type: fileType,
          url: e.target?.result as string,
        };
        onAddAsset(newAsset);
      };
      reader.readAsDataURL(file);
    }
    event.target.value = '';
  };
  
  const handleAssetDragStart = (e: React.DragEvent, asset: GameAsset) => {
    e.dataTransfer.setData('application/game-asset', JSON.stringify(asset));
    e.dataTransfer.effectAllowed = 'copy';
  };
  
  const AssetTabButton: React.FC<{ tabName: 'images' | 'audio' | 'videos'; label: string }> = ({ tabName, label }) => (
    <button
      onClick={() => setActiveTab(tabName)}
      className={`px-3 py-1.5 text-xs font-medium transition-colors rounded-md ${
        activeTab === tabName ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col h-full">
        <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,audio/*,video/*" multiple />
        <div className="p-2">
            <div className="flex items-center gap-2 p-1 bg-black/50 rounded-lg">
                <AssetTabButton tabName="images" label="Imágenes" />
                <AssetTabButton tabName="audio" label="Audio" />
                <AssetTabButton tabName="videos" label="Vídeos" />
            </div>
        </div>
        <div className="flex-grow p-2 pt-0 overflow-y-auto">
            {activeTab === 'images' && (
              <div className="grid grid-cols-3 gap-2">
                {imageAssets.map(asset => (
                  <div 
                    key={asset.id} 
                    className="relative flex flex-col items-center p-1 bg-gray-800 rounded-md cursor-grab hover:bg-gray-700 group" 
                    title={asset.name}
                    draggable={true}
                    onDragStart={(e) => handleAssetDragStart(e, asset)}
                  >
                    <button 
                      onClick={() => onOpenSpriteEditor(asset.id)} 
                      className="absolute top-1 right-1 z-10 p-1 bg-black/60 rounded-full text-white opacity-0 group-hover:opacity-100 hover:bg-indigo-600 transition-opacity"
                      title="Editar Sprite"
                    >
                      <EditIcon />
                    </button>
                    <img src={asset.url} alt={asset.name} className="w-16 h-16 object-contain rounded-sm pointer-events-none" />
                    <span className="text-xs mt-1 truncate w-full text-center">{asset.name}</span>
                  </div>
                ))}
              </div>
            )}
            {activeTab === 'audio' && (
               <div className="flex flex-col gap-1 p-1">
                {audioAssets.map(asset => (
                  <div key={asset.id} className="flex items-center gap-2 p-1 text-sm rounded-md hover:bg-gray-800 cursor-pointer" title={asset.name}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-400 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path d="M18 3a1 1 0 00-1.447-.894L8.763 6H5a3 3 0 00-3 3v2a3 3 0 003 3h3.763l7.79 3.894A1 1 0 0018 17V3z" /></svg>
                    <span className="truncate">{asset.name}</span>
                  </div>
                ))}
              </div>
            )}
            {activeTab === 'videos' && (
              <div className="grid grid-cols-2 gap-2">
                {videoAssets.map(asset => (
                  <div 
                    key={asset.id} 
                    className="flex flex-col items-center p-1 bg-gray-800 rounded-md cursor-grab hover:bg-indigo-600" 
                    title={asset.name}
                    draggable={true}
                    onDragStart={(e) => handleAssetDragStart(e, asset)}
                  >
                    <video src={asset.url} muted className="w-full h-16 object-cover rounded-sm pointer-events-none" />
                    <span className="text-xs mt-1 truncate w-full text-center">{asset.name}</span>
                  </div>
                ))}
              </div>
            )}
        </div>
        <div className="p-2 border-t border-gray-800 space-y-2">
            <button className="w-full px-3 py-1.5 text-xs bg-gray-800 hover:bg-indigo-600 rounded-md" onClick={handleImportClick}>Importar Recurso(s)</button>
             <button className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs bg-gray-800 hover:bg-indigo-600 rounded-md" onClick={() => onOpenSpriteEditor(null)}>
                <PlusIcon /> Crear Sprite
            </button>
            <button className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs bg-gray-800 hover:bg-indigo-600 rounded-md" onClick={onOpenAnimationEditor}>
                <TimelineIcon /> Editor de Animación
            </button>
             <button className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs bg-gray-800 hover:bg-indigo-600 rounded-md" onClick={onOpenAudioLab}>
                <SoundWaveIcon /> Editor de Sonido
            </button>
            <button className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs bg-gray-800 hover:bg-indigo-600 rounded-md" onClick={onOpenSoundtrackEditor}>
                <MusicNoteIcon /> Editor de Banda Sonora
            </button>
        </div>
    </div>
  );
};

const getAbsolutePosition = (objectId: number, allObjects: GameObject[]): { x: number; y: number } => {
    const objectsById = new Map(allObjects.map(o => [o.id, o]));
    let currentId: number | null | undefined = objectId;
    let totalX = 0;
    let totalY = 0;
    let safety = 100; // prevent infinite loops in case of bad data
    while(currentId && safety-- > 0) {
        const obj = objectsById.get(currentId);
        if (!obj) break;
        totalX += obj.x;
        totalY += obj.y;
        currentId = obj.parentId;
    }
    return { x: totalX, y: totalY };
};

const SceneHierarchy: React.FC<SceneHierarchyProps> = ({ scenes, activeSceneId, onSelectScene, onAddScene, onCloneScene, objects, selectedId, onSelect, onUpdateObject, assets, onAddAsset, onUpdateAsset, onOpenAnimationEditor, onOpenSpriteEditor, onOpenAudioLab, onOpenSoundtrackEditor, width, onToggleCollapse }) => {
  const [activeTab, setActiveTab] = useState<'objects' | 'assets'>('objects');

  const handleSetParent = (childId: number, newParentId: number | null) => {
    const childObject = objects.find(o => o.id === childId);
    if (!childObject) return;

    // 1. Get child's current absolute position
    const childAbsPos = getAbsolutePosition(childId, objects);

    // 2. Get new parent's absolute position. If un-parenting, it's the scene origin (0,0).
    const newParentAbsPos = newParentId ? getAbsolutePosition(newParentId, objects) : { x: 0, y: 0 };
    
    // 3. Calculate the new local position for the child
    const newLocalX = childAbsPos.x - newParentAbsPos.x;
    const newLocalY = childAbsPos.y - newParentAbsPos.y;

    // 4. Update the object with its new parent and adjusted local coordinates
    onUpdateObject(childId, { parentId: newParentId, x: newLocalX, y: newLocalY });
  };

  if (width < 50 && width > 0) {
    return (
        <aside className="bg-gray-900 border-r border-gray-800 flex-col shrink-0 transition-all duration-300 ease-in-out p-2 hidden md:flex" style={{ width: `${width}px` }}>
             <button onClick={onToggleCollapse} title="Expandir Panel" className="p-2 hover:bg-gray-800 rounded-md">
                <ExpandIcon />
            </button>
        </aside>
    )
  }
  
  const TabButton: React.FC<{tabId: 'objects' | 'assets', label: string}> = ({ tabId, label }) => (
    <button 
        onClick={() => setActiveTab(tabId)}
        className={`flex-1 py-2 text-sm font-semibold transition-colors ${activeTab === tabId ? 'bg-gray-900 text-white' : 'bg-black text-gray-400 hover:bg-gray-800/50'}`}
    >
        {label}
    </button>
  );

  return (
    <aside className="bg-gray-900 border-r border-gray-800 flex flex-col shrink-0 h-full md:h-full md:w-auto" style={{ width: `${width}px` }}>
      <div className="p-2 border-b border-gray-800">
        <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Escena</h2>
             <button onClick={onToggleCollapse} title="Colapsar Panel" className="p-2 -mr-2 hover:bg-gray-800 rounded-md hidden md:block">
                <CollapseIcon />
            </button>
        </div>
         <div className="flex items-center gap-2 mt-2">
            <select
                value={activeSceneId ?? ''}
                onChange={(e) => onSelectScene(e.target.value)}
                className="flex-grow bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
                {scenes.map(scene => (
                    <option key={scene.id} value={scene.id}>{scene.name}</option>
                ))}
            </select>
            <button onClick={onAddScene} title="Añadir Nueva Escena" className="p-2 bg-gray-800 hover:bg-indigo-600 rounded-md">
                <PlusIcon />
            </button>
            <button onClick={() => activeSceneId && onCloneScene(activeSceneId)} title="Clonar Escena Actual" className="p-2 bg-gray-800 hover:bg-indigo-600 rounded-md" disabled={!activeSceneId}>
                <CloneIcon />
            </button>
        </div>
      </div>
      <div className="flex border-b border-gray-800">
        <TabButton tabId="objects" label="Objetos" />
        <TabButton tabId="assets" label="Recursos" />
      </div>
      <div className="flex-grow overflow-y-auto p-2">
        {activeTab === 'objects' ? (
            <ObjectTree 
                objects={objects}
                selectedId={selectedId}
                onSelect={onSelect}
                onSetParent={handleSetParent}
            />
        ) : (
            <AssetBrowserContent assets={assets} onAddAsset={onAddAsset} onOpenAnimationEditor={onOpenAnimationEditor} onOpenSpriteEditor={onOpenSpriteEditor} onOpenAudioLab={onOpenAudioLab} onOpenSoundtrackEditor={onOpenSoundtrackEditor} />
        )}
      </div>
    </aside>
  );
};

export default SceneHierarchy;