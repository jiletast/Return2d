import React, { useEffect, useRef, useState } from 'react';
import { CameraIcon } from './icons/CameraIcon';

interface CameraViewProps {
    onClose: () => void;
}

const CameraView: React.FC<CameraViewProps> = ({ onClose }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [error, setError] = useState<string | null>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    const [position, setPosition] = useState({ x: 50, y: 50 });
    const isDragging = useRef(false);
    const dragStart = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const startCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            } catch (err) {
                console.error("Error accessing camera:", err);
                if (err instanceof Error) {
                    if (err.name === "NotAllowedError") {
                        setError("Permiso de cámara denegado. Por favor, habilítalo en la configuración de tu navegador.");
                    } else {
                        setError(`Error al acceder a la cámara: ${err.message}`);
                    }
                } else {
                     setError("Ocurrió un error desconocido al acceder a la cámara.");
                }
            }
        };

        startCamera();

        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        isDragging.current = true;
        dragStart.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y,
        };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging.current || !panelRef.current) return;
        const parentRect = panelRef.current.parentElement?.getBoundingClientRect();
        if (!parentRect) return;

        let newX = e.clientX - dragStart.current.x;
        let newY = e.clientY - dragStart.current.y;
        
        // Clamp position to be within the parent bounds
        newX = Math.max(0, Math.min(newX, parentRect.width - panelRef.current.offsetWidth));
        newY = Math.max(0, Math.min(newY, parentRect.height - panelRef.current.offsetHeight));

        setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
        isDragging.current = false;
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    };

    return (
        <div
            ref={panelRef}
            className="absolute z-40 bg-gray-900 rounded-lg shadow-2xl border border-gray-700 w-80 flex flex-col"
            style={{ top: position.y, left: position.x }}
        >
            <header 
                className="flex items-center justify-between p-2 border-b border-gray-800 cursor-move"
                onMouseDown={handleMouseDown}
            >
                <div className="flex items-center gap-2 text-sm font-semibold">
                    <CameraIcon />
                    <span>Vista de Cámara</span>
                </div>
                <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
            </header>
            <main className="p-2 bg-black">
                {error ? (
                    <div className="text-center text-red-400 text-sm p-4">{error}</div>
                ) : (
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-auto rounded" />
                )}
            </main>
        </div>
    );
};

export default CameraView;
