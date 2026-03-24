import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { GameAsset } from '../types';
import { useLanguage } from '../LanguageContext';

interface SpriteEditorProps {
  assetToEdit: GameAsset | null;
  onSave: (asset: GameAsset) => void;
  onClose: () => void;
}

const PALETTE = ['#000000', '#1D2B53', '#7E2553', '#008751', '#AB5236', '#5F574F', '#C2C3C7', '#FFF1E8', '#FF004D', '#FFA300', '#FFEC27', '#00E436', '#29ADFF', '#83769C', '#FF77A8', '#FFCCAA', '#222034', '#45283c', '#663931', '#df7126', '#d9a066', '#efd57d', '#9cd27d', '#6daa2c', '#41a6f6', '#73eff7', '#346524', '#265c42', '#1b2632', '#00000000'];
const CHECKERBOARD_COLOR_1 = '#4A5568'; // gray-600
const CHECKERBOARD_COLOR_2 = '#2D3748'; // gray-700

type Tool = 'pencil' | 'eraser' | 'picker' | 'bucket';

export const SpriteEditor: React.FC<SpriteEditorProps> = ({ assetToEdit, onSave, onClose }) => {
  const { t } = useLanguage();
  const [size, setSize] = useState(32);
  const [customSize, setCustomSize] = useState("32");
  const [pixelData, setPixelData] = useState<string[][]>([]);
  const [primaryColor, setPrimaryColor] = useState('#FFFFFF');
  const [secondaryColor, setSecondaryColor] = useState('#000000');
  const [activeTool, setActiveTool] = useState<Tool>('pencil');
  const [isDrawing, setIsDrawing] = useState(false);
  const [name, setName] = useState(assetToEdit?.name || 'nuevo_sprite.png');
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const gridCanvasRef = useRef<HTMLCanvasElement>(null);

  const PIXEL_SCALE = 16;

  const resetCanvas = useCallback((newSize: number) => {
    const newData = Array(newSize).fill(null).map(() => Array(newSize).fill('transparent'));
    setPixelData(newData);
  }, []);

  useEffect(() => {
    if (assetToEdit) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const ctx = tempCanvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const newSize = Math.max(img.width, img.height);
        setSize(newSize);
        setCustomSize(String(newSize));
        const newData = Array(newSize).fill(null).map((_, y) => 
            Array(newSize).fill(null).map((__, x) => {
                if(x < img.width && y < img.height) {
                    const pixel = ctx.getImageData(x, y, 1, 1).data;
                    return pixel[3] < 255 ? 'transparent' : `rgba(${pixel[0]},${pixel[1]},${pixel[2]},${pixel[3] / 255})`;
                }
                return 'transparent';
            })
        );
        setPixelData(newData);
      };
      img.src = assetToEdit.url;
    } else {
      resetCanvas(size);
    }
  }, [assetToEdit, resetCanvas, size]);
  
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Checkerboard background
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? CHECKERBOARD_COLOR_1 : CHECKERBOARD_COLOR_2;
        ctx.fillRect(x * PIXEL_SCALE, y * PIXEL_SCALE, PIXEL_SCALE, PIXEL_SCALE);
      }
    }

    pixelData.forEach((row, y) => {
      row.forEach((color, x) => {
        if (color !== 'transparent' && color !== '#00000000') {
          ctx.fillStyle = color;
          ctx.fillRect(x * PIXEL_SCALE, y * PIXEL_SCALE, PIXEL_SCALE, PIXEL_SCALE);
        }
      });
    });
  }, [pixelData, size]);
  
  const drawPreview = useCallback(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const scale = Math.min(canvas.width / size, canvas.height / size);
    
    // Checkerboard
     for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? CHECKERBOARD_COLOR_1 : CHECKERBOARD_COLOR_2;
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
    
    pixelData.forEach((row, y) => {
      row.forEach((color, x) => {
        if (color !== 'transparent' && color !== '#00000000') {
          ctx.fillStyle = color;
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      });
    });
  }, [pixelData, size]);

  useEffect(() => {
    const canvas = gridCanvasRef.current;
    if (!canvas || PIXEL_SCALE < 4) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;

    for (let i = 0; i <= size; i++) {
        ctx.beginPath();
        ctx.moveTo(i * PIXEL_SCALE, 0);
        ctx.lineTo(i * PIXEL_SCALE, size * PIXEL_SCALE);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * PIXEL_SCALE);
        ctx.lineTo(size * PIXEL_SCALE, i * PIXEL_SCALE);
        ctx.stroke();
    }
  }, [size]);


  useEffect(() => {
    draw();
    drawPreview();
  }, [draw, drawPreview]);
  
  const floodFill = (data: string[][], x: number, y: number, newColor: string): string[][] => {
    const targetColor = data[y][x];
    if (targetColor === newColor) return data;
    
    const newData = data.map(row => [...row]);
    const queue: [number, number][] = [[x,y]];
    
    while(queue.length > 0) {
        const [curX, curY] = queue.shift()!;
        if (curX < 0 || curX >= size || curY < 0 || curY >= size || newData[curY][curX] !== targetColor) {
            continue;
        }
        newData[curY][curX] = newColor;
        queue.push([curX+1, curY], [curX-1, curY], [curX, curY+1], [curX, curY-1]);
    }
    return newData;
  };

  const handleCanvasInteraction = (e: { clientX: number, clientY: number, button?: number }, forceDraw = false) => {
    if (!isDrawing && !forceDraw) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / PIXEL_SCALE);
    const y = Math.floor((e.clientY - rect.top) / PIXEL_SCALE);

    if (x < 0 || x >= size || y < 0 || y >= size) return;
    
    setPixelData(prevData => {
        const targetColor = prevData[y]?.[x];
        if (targetColor === undefined) return prevData;

        let newColor = '';
        let shouldUpdate = false;
        const useColor = e.button === 2 ? secondaryColor : primaryColor;
        
        if (activeTool === 'pencil') {
            newColor = useColor;
            if (targetColor !== newColor) shouldUpdate = true;
        } else if (activeTool === 'eraser') {
            newColor = 'transparent';
            if (targetColor !== newColor) shouldUpdate = true;
        } else if (activeTool === 'picker' && forceDraw) {
            const picked = prevData[y][x];
            if (e.button === 2) {
              setSecondaryColor(picked === 'transparent' ? '#000000' : picked);
            } else {
              setPrimaryColor(picked === 'transparent' ? '#FFFFFF' : picked);
            }
            return prevData;
        } else if (activeTool === 'bucket' && forceDraw) {
            return floodFill(prevData, x, y, useColor);
        }

        if (shouldUpdate) {
            const newData = [...prevData];
            newData[y] = [...prevData[y]];
            newData[y][x] = newColor;
            return newData;
        }
        
        return prevData;
    });
  };


  const handleSave = () => {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = size;
    tempCanvas.height = size;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return;

    pixelData.forEach((row, y) => {
      row.forEach((color, x) => {
        if (color !== 'transparent' && color !== '#00000000') {
          ctx.fillStyle = color;
          ctx.fillRect(x, y, 1, 1);
        }
      });
    });

    const dataUrl = tempCanvas.toDataURL('image/png');
    
    const savedAsset: GameAsset = {
        id: assetToEdit?.id || `asset_sprite_${Date.now()}`,
        name: name,
        type: 'image',
        url: dataUrl
    };
    onSave(savedAsset);
  };
  
  const handleApplyCustomSize = () => {
    const newSize = parseInt(customSize, 10);
    if (isNaN(newSize) || newSize <= 0 || newSize > 128) {
        alert(t('spriteEditor.invalidSize'));
        return;
    }
    if (newSize !== size) {
        handleSizeChange(newSize);
    }
  };

  const handleSizeChange = (newSize: number) => {
    const confirmChange = window.confirm(t('spriteEditor.confirmSizeChange'));
    if (confirmChange) {
        setSize(newSize);
        setCustomSize(String(newSize));
        resetCanvas(newSize);
    }
  };


  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-900 rounded-lg shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col border border-gray-800" onClick={e => e.stopPropagation()}>
        <header className="flex items-center justify-between p-2 border-b border-gray-800 shrink-0">
          <input type="text" value={name} onChange={e => setName(e.target.value)} className="bg-gray-800 border border-gray-700 px-2 py-1 rounded text-sm"/>
          <div className="flex items-center gap-2">
            <label className="text-sm">{t('spriteEditor.size')}:</label>
            {[16,32,64].map(s => <button key={s} onClick={() => handleSizeChange(s)} className={`px-2 py-1 text-xs rounded ${size === s ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'}`}>{s}x{s}</button>)}
             <input type="number" value={customSize} onChange={e => setCustomSize(e.target.value)} className="bg-gray-800 border border-gray-700 px-2 py-1 rounded text-sm w-16" onKeyDown={e => e.key ==='Enter' && handleApplyCustomSize()}/>
            <button onClick={handleApplyCustomSize} className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600">{t('common.set')}</button>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleSave} className="px-4 py-1.5 bg-green-600 hover:bg-green-700 rounded-md text-sm">{t('common.saveAndClose')}</button>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-xl font-bold">&times;</button>
          </div>
        </header>

        <main className="flex-grow flex p-4 overflow-hidden gap-4">
          <aside className="w-16 flex flex-col items-center gap-2 bg-black/50 p-2 rounded-lg">
            {(['pencil', 'eraser', 'picker', 'bucket'] as Tool[]).map(tool => (
                <button key={tool} onClick={() => setActiveTool(tool)} className={`p-2 rounded-md ${activeTool === tool ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'}`} title={t(`spriteEditor.tool.${tool}`)}>
                  <span className="text-xs">{tool.charAt(0).toUpperCase()}</span>
                </button>
            ))}
          </aside>

          <div className="flex-grow flex items-center justify-center bg-black/50 rounded-lg relative overflow-hidden">
            <div style={{width: size * PIXEL_SCALE, height: size * PIXEL_SCALE, position: 'relative'}}>
                <canvas ref={canvasRef} width={size * PIXEL_SCALE} height={size * PIXEL_SCALE} className="absolute top-0 left-0" />
                <canvas ref={gridCanvasRef} width={size * PIXEL_SCALE} height={size * PIXEL_SCALE} className="absolute top-0 left-0 pointer-events-none" />
                <div
                    className="absolute top-0 left-0 cursor-crosshair"
                    style={{width: size * PIXEL_SCALE, height: size * PIXEL_SCALE, touchAction: 'none'}}
                    onMouseDown={(e) => {
                        e.preventDefault();
                        setIsDrawing(true);
                        handleCanvasInteraction(e, true);
                    }}
                    onMouseMove={(e) => {
                       if (isDrawing) handleCanvasInteraction(e, false);
                    }}
                    onMouseUp={() => setIsDrawing(false)}
                    onMouseLeave={() => setIsDrawing(false)}
                    onContextMenu={(e) => e.preventDefault()}
                    onTouchStart={(e) => {
                        e.preventDefault();
                        setIsDrawing(true);
                        if (e.touches[0]) {
                            handleCanvasInteraction(e.touches[0], true);
                        }
                    }}
                    onTouchMove={(e) => {
                        e.preventDefault();
                        if (isDrawing && e.touches[0]) {
                            handleCanvasInteraction(e.touches[0], false);
                        }
                    }}
                    onTouchEnd={(e) => {
                        e.preventDefault();
                        setIsDrawing(false);
                    }}
                />
            </div>
          </div>
          
          <aside className="w-48 flex flex-col gap-4">
            <div className="bg-black/50 rounded-lg p-2 flex-grow">
              <h3 className="text-sm font-semibold mb-2">{t('spriteEditor.preview')}</h3>
              <canvas ref={previewCanvasRef} width="160" height="160" className="w-full h-auto" style={{imageRendering: 'pixelated'}} />
            </div>
            <div className="bg-black/50 rounded-lg p-2 shrink-0">
                <h3 className="text-sm font-semibold mb-2">{t('spriteEditor.colors')}</h3>
                <div className="flex items-center gap-2 mb-2">
                    <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="w-10 h-10 p-0 border-none bg-transparent rounded-md cursor-pointer" title={t('spriteEditor.primaryColor')}/>
                    <input type="color" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} className="w-10 h-10 p-0 border-none bg-transparent rounded-md cursor-pointer" title={t('spriteEditor.secondaryColor')}/>
                    <div className="flex-grow space-y-1">
                       <input type="text" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="w-full text-xs bg-gray-700 border border-gray-600 rounded px-1" />
                       <input type="text" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} className="w-full text-xs bg-gray-700 border border-gray-600 rounded px-1" />
                    </div>
                </div>
                <div className="grid grid-cols-5 gap-1">
                    {PALETTE.map(color => (
                        <button key={color} onClick={() => setPrimaryColor(color)} onContextMenu={(e) => {e.preventDefault(); setSecondaryColor(color)}} style={{backgroundColor: color}} className="w-full h-6 rounded-sm border border-gray-600"/>
                    ))}
                </div>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
};