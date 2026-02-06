'use client';

import React, { useRef, useEffect } from 'react';

interface WaveformVisualizerProps {
    stream: MediaStream | null;
    isRecording: boolean;
    className?: string;
    barColor?: string;
}

export function WaveformVisualizer({
    stream,
    isRecording,
    className = "",
    barColor = "rgb(59, 130, 246)" // Default blue-500
}: WaveformVisualizerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number | undefined>(undefined);
    const analyserRef = useRef<AnalyserNode | undefined>(undefined);
    const audioContextRef = useRef<AudioContext | undefined>(undefined);
    const sourceRef = useRef<MediaStreamAudioSourceNode | undefined>(undefined);

    useEffect(() => {
        if (!stream || !isRecording) {
            // Cleanup if stream stops or recording pauses
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
            return;
        }

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Initialize Audio Context
        if (!audioContextRef.current) {
            // @ts-expect-error - Handle webkit prefix
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }

        const audioCtx = audioContextRef.current!;

        // Resume context if suspended (browser autoplay policy)
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256; // Controls resolution of bars (256 = 128 data points)
        analyserRef.current = analyser;

        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        sourceRef.current = source;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            if (!canvas) return;

            // Handle high DPI displays
            const dpr = window.devicePixelRatio || 1;
            const width = canvas.clientWidth * dpr;
            const height = canvas.clientHeight * dpr;

            if (canvas.width !== width || canvas.height !== height) {
                canvas.width = width;
                canvas.height = height;
            }

            animationRef.current = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Settings for bars
            // We want to skip some high frequencies that usually have no voice data
            const relevantDataLength = Math.floor(bufferLength * 0.7);
            const barWidth = (canvas.width / relevantDataLength) * 2; // Making bars wider
            let barHeight;
            let x = 0;

            // Draw centered bars
            const centerY = canvas.height / 2;

            for (let i = 0; i < relevantDataLength; i++) {
                // Normalize value (0-255)
                const val = dataArray[i];

                // Scale height: max height should fit in canvas with some padding
                // Exaggerate low values slightly for visual effect
                const percent = val / 255;
                const heightScale = Math.pow(percent, 0.8); // Non-linear scale

                barHeight = heightScale * (canvas.height * 0.8);

                // Ensure min height for visibility
                if (barHeight < 4) barHeight = 4;

                ctx.fillStyle = barColor;

                // Draw rounded rect (simulated by simple rect for performance)
                // Centered vertically
                const y = centerY - (barHeight / 2);

                roundRect(ctx, x, y, barWidth - 2, barHeight, (barWidth - 2) / 2);

                x += barWidth;
            }
        };

        draw();

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
            if (sourceRef.current) {
                sourceRef.current.disconnect();
            }
            // We don't close AudioContext here generally as it can be reused, 
            // but for this component lifecycle it might be fine.
            // keeping it open is safer for frequent re-renders.
        };
    }, [stream, isRecording, barColor]);

    return (
        <div className={className}>
            <canvas
                ref={canvasRef}
                className="w-full h-full"
            />
        </div>
    );
}

// Helper to draw rounded rect
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
}
