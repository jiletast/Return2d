import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { GameObject, GameAsset, Scene } from '../types';
import { PlusIcon } from './icons/PlusIcon';
import { DesktopIcon } from './icons/DesktopIcon';

interface SceneEditorProps {
  scene: Scene | undefined;
  objects: GameObject[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onUpdateObject: (id: number, updates: Partial<GameObject>) => void;
  onAddObject: (initialProps?: Partial<GameObject>) => void;
  onOpenEventEditor: () => void;
  gameWidth: number;
  gameHeight: number;
}

type GameObjectWithAbsPos = GameObject & { absPos: { x: number; y: number }};

const SceneEditor: React.FC<SceneEditorProps> = ({ scene, objects, selectedId, onSelect, onUpdateObject, onAddObject, onOpenEventEditor, gameWidth, gameHeight }) => {
  const sceneRef = useRef<HTMLDivElement>(null);
  const [draggingState, setDraggingState] = useState<{ 
    type: 'move' | 'rotate';
    id: number;
    // For move
    offsetX?: number; 
    offsetY?: number;
    parentAbsolutePos?: {x: number, y: number};
    // For rotate
    center?: { x: number, y: number };
    startAngle?: number;
  } | null>(null);
  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const isSpacePressed = useRef(false);
  const [isAssetDragOver, setIsAssetDragOver] = useState(false);
  const [dragOverObjectId, setDragOverObjectId] = useState<number | null>(null);
  const pinchStateRef = useRef<{ dist: number; mid: { x: number; y: number } } | null>(null);
  const lastTouchPoint = useRef<{x: number, y: number} | null>(null);

  const [localObjects, setLocalObjects] = useState(objects);

  const localObjectsWithAbsPos = useMemo((): GameObjectWithAbsPos[] => {
    const objectsById = new Map<number, GameObject>(localObjects.map(o => [o.id, o]));
    const posCache = new Map<number, { x: number; y: number }>();

    const getPos = (objId: number): { x: number; y: number } => {
        if (posCache.has(objId)) return posCache.get(objId)!;

        const obj = objectsById.get(objId);
        if (!obj) return { x: 0, y: 0 };

        if (obj.isUI || !obj.parentId) {
            const pos = { x: obj.x, y: obj.y };
            posCache.set(objId, pos);
            return pos;
        }

        const parentPos = getPos(obj.parentId);
        const pos = { x: parentPos.x + obj.x, y: parentPos.y + obj.y };
        posCache.set(objId, pos);
        return pos;
    };

    return localObjects.map(obj => ({
        ...obj,
        absPos: getPos(obj.id),
    }));
  }, [localObjects]);

  useEffect(() => {
    if (!draggingState) {
      setLocalObjects(objects);
    }
  }, [objects, draggingState]);
  
  const getSceneCoords = useCallback((e: { clientX: number; clientY: number }): { x: number; y: number } => {
    const sceneRect = sceneRef.current?.getBoundingClientRect();
    if (!sceneRect) return { x: 0, y: 0 };
    const mouseX = e.clientX - sceneRect.left;
    const mouseY = e.clientY - sceneRect.top;
    const worldX = (mouseX / zoom) - viewOffset.x;
    const worldY = (mouseY / zoom) - viewOffset.y;
    return { x: worldX, y: worldY };
  }, [zoom, viewOffset]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        isSpacePressed.current = true;
        sceneRef.current?.classList.add('cursor-grab');
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressed.current = false;
        sceneRef.current?.classList.remove('cursor-grab', 'cursor-grabbing');
        setIsPanning(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleObjectMouseDown = (e: React.MouseEvent<HTMLDivElement>, obj: GameObjectWithAbsPos) => {
    e.stopPropagation();
    onSelect(obj.id);
    if (isSpacePressed.current) return;
    
    const parent = obj.parentId ? localObjectsWithAbsPos.find(o => o.id === obj.parentId) : null;
    const parentAbsolutePos = parent ? parent.absPos : { x: 0, y: 0 };

    const { x: mouseWorldX, y: mouseWorldY } = getSceneCoords(e);
    setDraggingState({ type: 'move', id: obj.id, offsetX: mouseWorldX - obj.absPos.x, offsetY: mouseWorldY - obj.absPos.y, parentAbsolutePos });
  };
  
  const handleRotationStart = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!selectedId) return;
    const object = localObjectsWithAbsPos.find(o => o.id === selectedId);
    if (!object) return;

    const sceneRect = sceneRef.current!.getBoundingClientRect();
    const centerX = sceneRect.left + (viewOffset.x + object.absPos.x + object.width / 2) * zoom;
    const centerY = sceneRect.top + (viewOffset.y + object.absPos.y + object.height / 2) * zoom;

    const startAngleRad = Math.atan2(e.clientY - centerY, e.clientX - centerX);
    const initialObjectRotationRad = (object.rotation || 0) * (Math.PI / 180);

    setDraggingState({
        type: 'rotate',
        id: selectedId,
        center: { x: centerX, y: centerY },
        startAngle: startAngleRad - initialObjectRotationRad,
    });
  };


  const handleObjectTouchStart = (e: React.TouchEvent<HTMLDivElement>, obj: GameObjectWithAbsPos) => {
    e.stopPropagation();
    onSelect(obj.id);
    if (e.touches.length !== 1) return;
    
    const parent = obj.parentId ? localObjectsWithAbsPos.find(o => o.id === obj.parentId) : null;
    const parentAbsolutePos = parent ? parent.absPos : { x: 0, y: 0 };

    const { x: touchWorldX, y: touchWorldY } = getSceneCoords(e.touches[0]);
    setDraggingState({ type: 'move', id: obj.id, offsetX: touchWorldX - obj.absPos.x, offsetY: touchWorldY - obj.absPos.y, parentAbsolutePos });
  };

  const handleSceneMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== sceneRef.current) return;

    if (e.button === 1 || e.button === 2 || (e.button === 0 && isSpacePressed.current)) {
      e.preventDefault();
      setIsPanning(true);
      sceneRef.current?.classList.add('cursor-grabbing');
    } else if (e.button === 0) {
      onSelect(null);
    }
  };

  const handleSceneTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.target !== sceneRef.current) return;
    
    if (e.touches.length === 2) {
      e.preventDefault();
      setIsPanning(false);
      lastTouchPoint.current = null;
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      pinchStateRef.current = {
        dist: Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY),
        mid: { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 },
      };
    } else if (e.touches.length === 1) {
        e.preventDefault();
        onSelect(null);
        lastTouchPoint.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  useEffect(() => {
    const handleMove = (coords: { clientX: number; clientY: number }) => {
      if (!draggingState) return;

      if (draggingState.type === 'move') {
        const objectBeingDragged = localObjects.find(o => o.id === draggingState.id);
        if (!objectBeingDragged) return;

        const { x: worldX, y: worldY } = getSceneCoords(coords);
        let newAbsoluteX = worldX - draggingState.offsetX!;
        let newAbsoluteY = worldY - draggingState.offsetY!;
        
        if (objectBeingDragged.isUI) {
          newAbsoluteX = Math.max(0, Math.min(newAbsoluteX, gameWidth - objectBeingDragged.width));
          newAbsoluteY = Math.max(0, Math.min(newAbsoluteY, gameHeight - objectBeingDragged.height));
        }

        const newX = newAbsoluteX - draggingState.parentAbsolutePos!.x;
        const newY = newAbsoluteY - draggingState.parentAbsolutePos!.y;
        
        setLocalObjects(currentObjects =>
          currentObjects.map(obj =>
            obj.id === draggingState.id ? { ...obj, x: newX, y: newY } : obj
          )
        );
      } else if (draggingState.type === 'rotate') {
          const { center, startAngle } = draggingState;
          const currentAngleRad = Math.atan2(coords.clientY - center!.y, coords.clientX - center!.x);
          const newRotationRad = currentAngleRad - startAngle!;
          const newRotationDeg = newRotationRad * (180 / Math.PI);
           setLocalObjects(currentObjects =>
            currentObjects.map(obj =>
                obj.id === draggingState.id ? { ...obj, rotation: newRotationDeg } : obj
            )
        );
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isPanning) {
        setViewOffset(prev => ({
          x: prev.x + e.movementX / zoom,
          y: prev.y + e.movementY / zoom,
        }));
        return;
      }
      handleMove(e);
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        if (draggingState) {
          e.preventDefault();
          handleMove(e.touches[0]);
        } else if (lastTouchPoint.current) {
            e.preventDefault();
            const touch = e.touches[0];
            const dx = touch.clientX - lastTouchPoint.current.x;
            const dy = touch.clientY - lastTouchPoint.current.y;
            setViewOffset(prev => ({
                x: prev.x + dx / zoom,
                y: prev.y + dy / zoom
            }));
            lastTouchPoint.current = { x: touch.clientX, y: touch.clientY };
        }
      } else if (e.touches.length === 2 && pinchStateRef.current) {
        e.preventDefault();
        const sceneRect = sceneRef.current?.getBoundingClientRect();
        if (!sceneRect) return;

        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const prevMid = pinchStateRef.current.mid;
        const prevDist = pinchStateRef.current.dist;
        const newMid = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
        const newDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        const newZoom = Math.min(Math.max(0.1, zoom * (newDist / prevDist)), 3);
        const worldX = ((prevMid.x - sceneRect.left) / zoom) - viewOffset.x;
        const worldY = ((prevMid.y - sceneRect.top) / zoom) - viewOffset.y;
        const newViewOffsetX = ((newMid.x - sceneRect.left) / newZoom) - worldX;
        const newViewOffsetY = ((newMid.y - sceneRect.top) / newZoom) - worldY;

        setZoom(newZoom);
        setViewOffset({ x: newViewOffsetX, y: newViewOffsetY });
        pinchStateRef.current = { dist: newDist, mid: newMid };
      }
    };

    const handleUp = () => {
      if (draggingState) {
        const finalObject = localObjects.find(o => o.id === draggingState.id);
        if (finalObject) {
            if (draggingState.type === 'move') {
                 onUpdateObject(draggingState.id, { x: finalObject.x, y: finalObject.y });
            } else if (draggingState.type === 'rotate') {
                onUpdateObject(draggingState.id, { rotation: finalObject.rotation });
            }
        }
      }
      setIsPanning(false);
      setDraggingState(null);
      pinchStateRef.current = null;
      lastTouchPoint.current = null;
      sceneRef.current?.classList.remove('cursor-grabbing');
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleUp);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [draggingState, isPanning, zoom, getSceneCoords, onUpdateObject, localObjects, viewOffset, gameWidth, gameHeight]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('application/game-asset')) {
        e.dataTransfer.dropEffect = 'copy';
        setIsAssetDragOver(true);
    } else {
        e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleDragLeave = () => {
      setIsAssetDragOver(false);
      setDragOverObjectId(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsAssetDragOver(false);
    setDragOverObjectId(null);
    const objectIdString = e.dataTransfer.getData('application/game-object-id');
    const assetString = e.dataTransfer.getData('application/game-asset');
    
    const { x: dropX, y: dropY } = getSceneCoords(e);

    if (objectIdString) {
      const id = parseInt(objectIdString, 10);
      const object = localObjectsWithAbsPos.find(o => o.id === id);
      if (!object) return;
      
      const parent = object.parentId ? localObjectsWithAbsPos.find(o => o.id === object.parentId) : null;
      const parentAbsPos = parent ? parent.absPos : { x: 0, y: 0 };
      
      onUpdateObject(id, { x: dropX - (object.width / 2) - parentAbsPos.x, y: dropY - (object.height / 2) - parentAbsPos.y });
    } else if (assetString) {
      try {
        const asset: GameAsset = JSON.parse(assetString);
        if (asset.type === 'image') {
          const defaultWidth = 50;
          const defaultHeight = 50;
          onAddObject({
            x: dropX - (defaultWidth / 2),
            y: dropY - (defaultHeight / 2),
            width: defaultWidth,
            height: defaultHeight,
            imageUrl: asset.url,
            color: 'transparent',
            name: asset.name.split('.').slice(0, -1).join('.') || 'ImageObject',
          });
        } else if (asset.type === 'video') {
            const defaultWidth = 160;
            const defaultHeight = 90;
            onAddObject({
                x: dropX - (defaultWidth / 2),
                y: dropY - (defaultHeight / 2),
                width: defaultWidth,
                height: defaultHeight,
                videoUrl: asset.url,
                videoLoop: true,
                videoAutoplay: true,
                color: 'transparent',
                name: asset.name.split('.').slice(0, -1).join('.') || 'VideoObject',
            });
        }
      } catch (error) {
        console.error("Failed to parse dropped asset data:", error);
      }
    }
  };
  
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const sceneRect = sceneRef.current?.getBoundingClientRect();
    if (!sceneRect) return;

    const zoomSpeed = 0.1;
    const newZoom = Math.min(Math.max(0.1, zoom - e.deltaY * zoomSpeed * 0.01), 3);
    
    const mouseX = e.clientX - sceneRect.left;
    const mouseY = e.clientY - sceneRect.top;

    const worldXBefore = (mouseX / zoom) - viewOffset.x;
    const worldYBefore = (mouseY / zoom) - viewOffset.y;
    
    const newViewOffsetX = (mouseX / newZoom) - worldXBefore;
    const newViewOffsetY = (mouseY / newZoom) - worldYBefore;
    
    setZoom(newZoom);
    setViewOffset({ x: newViewOffsetX, y: newViewOffsetY });
  };
  
  const selectedObjectData = localObjectsWithAbsPos.find(o => o.id === selectedId);
  
  const handleObjectDragOver = (e: React.DragEvent, objId: number) => {
    e.preventDefault();
    e.stopPropagation();
     if (e.dataTransfer.types.includes('application/game-asset')) {
        e.dataTransfer.dropEffect = 'copy';
        setDragOverObjectId(objId);
    }
  };

  const handleObjectDrop = (e: React.DragEvent, objId: number) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOverObjectId(null);
      const assetString = e.dataTransfer.getData('application/game-asset');
      if (!assetString) return;

      try {
        const asset: GameAsset = JSON.parse(assetString);
        if (asset.type === 'image') {
          onUpdateObject(objId, { imageUrl: asset.url, color: 'transparent', videoUrl: undefined });
        } else if (asset.type === 'video') {
          onUpdateObject(objId, { videoUrl: asset.url, color: 'transparent', imageUrl: undefined, videoLoop: true, videoAutoplay: true });
        }
      } catch (error) {
        console.error("Failed to parse dropped asset data onto object:", error);
      }
  };


  const renderObject = (obj: GameObjectWithAbsPos) => {
    const isDraggingThis = draggingState?.id === obj.id;
    const isNode = obj.color === 'transparent' && !obj.imageUrl;
    const isDropTarget = dragOverObjectId === obj.id;
    const { absPos } = obj;

    const scaleX = (obj.scaleX ?? 1) * (obj.direction === 'left' ? -1 : 1);
    const scaleY = obj.scaleY ?? 1;

    const style: React.CSSProperties = {
      left: absPos.x,
      top: absPos.y,
      width: obj.width,
      height: obj.height,
      zIndex: isDraggingThis ? 1000 : obj.zIndex,
      backgroundColor: obj.imageUrl || isNode ? 'transparent' : obj.color,
      backgroundImage: obj.imageUrl ? `url(${obj.imageUrl})` : 'none',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      transformOrigin: 'center',
      transform: `rotate(${obj.rotation || 0}deg) scale(${scaleX}, ${scaleY}) ${isDraggingThis && draggingState?.type === 'move' ? 'scale(1.05)' : ''}`,
      opacity: isDraggingThis ? 0.85 : 1,
      pointerEvents: 'auto',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      border: isNode ? `1px dashed ${selectedId === obj.id ? '#6366F1' : 'rgba(255, 255, 255, 0.5)'}` : (isDropTarget ? '2px solid #6366F1' : 'none')
    };

    return (
      <div
        key={obj.id}
        onMouseDown={(e) => handleObjectMouseDown(e, obj)}
        onTouchStart={(e) => handleObjectTouchStart(e, obj)}
        onClick={(e) => { e.stopPropagation(); onSelect(obj.id); }}
        onDragOver={(e) => handleObjectDragOver(e, obj.id)}
        onDrop={(e) => handleObjectDrop(e, obj.id)}
        onDragLeave={() => setDragOverObjectId(null)}
        className={`absolute cursor-grab transition-all duration-75 ${isDraggingThis ? 'cursor-grabbing' : ''}`}
        style={style}
      >
        {isNode && ( <div className="absolute w-full h-full"> <div className="absolute top-1/2 left-0 w-full h-[1px] bg-white/50 -translate-y-1/2"></div> <div className="absolute left-1/2 top-0 h-full w-[1px] bg-white/50 -translate-x-1/2"></div> </div> )}
        {obj.isUI && obj.text && <span className="p-1 select-none overflow-hidden font-bold text-white" style={{ transform: scaleX < 0 ? 'scaleX(-1)' : 'none' }}> {obj.text} </span>}
        {!obj.isUI && selectedId === obj.id && <div className="absolute -top-5"><span className="text-xs text-white p-1 bg-black bg-opacity-50 select-none rounded-sm" style={{transform: `scale(${1/zoom})`, transformOrigin: 'bottom center'}}>{obj.name}</span></div>}
         {selectedId === obj.id && obj.useCustomCollision && obj.collision && (
            <div 
                className="absolute pointer-events-none bg-blue-500 bg-opacity-30 border-2 border-blue-400"
                style={{
                    left: obj.collision.offsetX,
                    top: obj.collision.offsetY,
                    width: obj.collision.width,
                    height: obj.collision.height
                }}
            />
        )}
      </div>
    );
  };
  
  const handleAddGameObjectClick = () => {
    onAddObject();
  };
  
  const handleAddUIObjectClick = () => {
    onAddObject({
        isUI: true,
        name: `UI_Element_${objects.length + 1}`,
        x: 10,
        y: 10,
        width: 100,
        height: 40,
        color: '#4f46e5',
        text: 'Botón',
        zIndex: 1000,
    });
  };


  return (
    <div className="flex-grow flex flex-col bg-gray-950 relative">
      <div className="flex items-center gap-2 p-2 bg-gray-900 border-b border-gray-800 shrink-0 flex-wrap">
        <button onClick={handleAddGameObjectClick} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-3 py-1.5 rounded-md text-sm transition-colors">
          <PlusIcon />
          Añadir Objeto
        </button>
        <button onClick={handleAddUIObjectClick} className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold px-3 py-1.5 rounded-md text-sm transition-colors">
            <DesktopIcon />
            Añadir Objeto UI
        </button>
        <button onClick={onOpenEventEditor} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold px-3 py-1.5 rounded-md text-sm transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg>
          Editor de Eventos
        </button>
      </div>

      <div
        ref={sceneRef}
        className={`flex-grow w-full h-full relative overflow-hidden touch-none transition-colors duration-200 ${isAssetDragOver ? 'bg-indigo-500/10' : ''}`}
        style={{ backgroundColor: scene?.backgroundColor || '#111827' }}
        onMouseDown={handleSceneMouseDown}
        onTouchStart={handleSceneTouchStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div 
          className="absolute top-0 left-0"
          style={{ 
            transform: `scale(${zoom}) translate(${viewOffset.x}px, ${viewOffset.y}px)`,
            transformOrigin: 'top left',
          }}
        >
            <div 
              className="absolute border-2 border-dashed border-white/50 pointer-events-none"
              style={{
                left: 0,
                top: 0,
                width: gameWidth,
                height: gameHeight,
                boxShadow: `0 0 0 9999px rgba(0,0,0,0.6)`,
                backgroundSize: `20px 20px`, 
                backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, rgba(0,0,0,0) 1px)'
              }}
            >
                {localObjectsWithAbsPos.filter(o => o.isUI).sort((a,b) => a.zIndex - b.zIndex).map(renderObject)}
            </div>
             {scene?.cameraBounds?.enabled && (
                  <div className="absolute border-2 border-dashed border-cyan-400 pointer-events-none" style={{
                      left: scene.cameraBounds.x,
                      top: scene.cameraBounds.y,
                      width: scene.cameraBounds.width,
                      height: scene.cameraBounds.height,
                  }}/>
              )}
            {localObjectsWithAbsPos.filter(o => !o.isUI).sort((a,b) => a.zIndex - b.zIndex).map(renderObject)}
            {selectedObjectData && (
                <div 
                    className="absolute pointer-events-none"
                    style={{
                        left: selectedObjectData.absPos.x,
                        top: selectedObjectData.absPos.y,
                        width: selectedObjectData.width,
                        height: selectedObjectData.height,
                        transform: `rotate(${selectedObjectData.rotation || 0}deg)`,
                        transformOrigin: 'center',
                    }}
                >
                    <div 
                        className="absolute w-full h-full border-2 border-indigo-500"
                        style={{
                           transform: `scale(${selectedObjectData.scaleX ?? 1}, ${selectedObjectData.scaleY ?? 1})`,
                           transformOrigin: 'center'
                        }}
                    />
                     <div
                        className="absolute bg-indigo-500 rounded-full cursor-alias pointer-events-auto hover:ring-4 ring-indigo-400/50"
                        title="Rotar Objeto"
                        style={{
                            width: `${16 / zoom}px`,
                            height: `${16 / zoom}px`,
                            top: `calc(0% - ${8 / zoom}px)`,
                            left: `calc(100% + ${8 / zoom}px)`,
                            transform: `translateY(${selectedObjectData.height / 2}px)`,
                        }}
                        onMouseDown={handleRotationStart}
                    />
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default SceneEditor;