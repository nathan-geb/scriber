'use client';

import React, { useRef, useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Play, Pause, Volume2, VolumeX, RotateCcw, RotateCw, Gauge } from 'lucide-react';

interface AudioPlayerProps {
    audioUrl: string;
    onTimeUpdate?: (time: number) => void;
    transcript?: unknown[]; // Not used here, for compatibility
}

export interface AudioPlayerRef {
    seekTo: (time: number) => void;
    play: () => void;
    pause: () => void;
    getCurrentTime: () => number;
}

export const AudioPlayer = forwardRef<AudioPlayerRef, AudioPlayerProps>(
    function AudioPlayer({ audioUrl, onTimeUpdate }, ref) {
        const audioRef = useRef<HTMLAudioElement>(null);
        const [isPlaying, setIsPlaying] = useState(false);
        const [currentTime, setCurrentTime] = useState(0);
        const [duration, setDuration] = useState(0);
        const [isMuted, setIsMuted] = useState(false);
        const [volume, setVolume] = useState(1);
        const [playbackRate, setPlaybackRate] = useState(1);
        const [showSpeedMenu, setShowSpeedMenu] = useState(false);

        // Expose imperative methods
        useImperativeHandle(ref, () => ({
            seekTo: (time: number) => {
                if (audioRef.current) {
                    audioRef.current.currentTime = time;
                    setCurrentTime(time);
                }
            },
            play: () => {
                audioRef.current?.play();
            },
            pause: () => {
                audioRef.current?.pause();
            },
            getCurrentTime: () => {
                return audioRef.current?.currentTime || 0;
            },
        }));

        useEffect(() => {
            const audio = audioRef.current;
            if (!audio) return;

            const handleTimeUpdate = () => {
                setCurrentTime(audio.currentTime);
                onTimeUpdate?.(audio.currentTime);
            };

            const handleLoadedMetadata = () => {
                // Only set duration if it's a valid finite number (WebM may have Infinity initially)
                if (isFinite(audio.duration)) {
                    setDuration(audio.duration);
                }
            };

            // Also listen for durationchange for WebM files where duration may update later
            const handleDurationChange = () => {
                if (isFinite(audio.duration)) {
                    setDuration(audio.duration);
                }
            };

            const handlePlay = () => setIsPlaying(true);
            const handlePause = () => setIsPlaying(false);
            const handleEnded = () => setIsPlaying(false);
            const handleRateChange = () => setPlaybackRate(audio.playbackRate);

            audio.addEventListener('timeupdate', handleTimeUpdate);
            audio.addEventListener('loadedmetadata', handleLoadedMetadata);
            audio.addEventListener('durationchange', handleDurationChange);
            audio.addEventListener('play', handlePlay);
            audio.addEventListener('pause', handlePause);
            audio.addEventListener('ended', handleEnded);
            audio.addEventListener('ratechange', handleRateChange);

            return () => {
                audio.removeEventListener('timeupdate', handleTimeUpdate);
                audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
                audio.removeEventListener('durationchange', handleDurationChange);
                audio.removeEventListener('play', handlePlay);
                audio.removeEventListener('pause', handlePause);
                audio.removeEventListener('ended', handleEnded);
                audio.removeEventListener('ratechange', handleRateChange);
            };
        }, [onTimeUpdate]);

        const togglePlay = () => {
            if (audioRef.current) {
                if (isPlaying) {
                    audioRef.current.pause();
                } else {
                    audioRef.current.play();
                }
            }
        };

        const toggleMute = () => {
            if (audioRef.current) {
                audioRef.current.muted = !isMuted;
                setIsMuted(!isMuted);
            }
        };

        const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const newVolume = parseFloat(e.target.value);
            setVolume(newVolume);
            if (audioRef.current) {
                audioRef.current.volume = newVolume;
                // Also unmute if volume is dragged up
                if (newVolume > 0 && isMuted) {
                    audioRef.current.muted = false;
                    setIsMuted(false);
                }
            }
        };

        const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
            const time = parseFloat(e.target.value);
            if (audioRef.current) {
                audioRef.current.currentTime = time;
                setCurrentTime(time);
            }
        };

        const skip = (seconds: number) => {
            if (audioRef.current) {
                audioRef.current.currentTime = Math.max(0, Math.min(duration, currentTime + seconds));
            }
        };

        const changeSpeed = (rate: number) => {
            if (audioRef.current) {
                audioRef.current.playbackRate = rate;
                setShowSpeedMenu(false);
            }
        };

        const formatTime = (seconds: number) => {
            if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        };

        const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

        return (
            <div className="bg-surface border border-border rounded-xl px-4 py-3 shadow-sm select-none">
                <audio ref={audioRef} src={audioUrl} preload="metadata" />

                {/* Main Control Row */}
                <div className="flex items-center gap-4">

                    {/* Playback Controls */}
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={() => skip(-5)}
                            className="p-2 rounded-full hover:bg-surface-hover transition-colors text-text-muted hover:text-text-main relative group"
                            title="Rewind 5s"
                        >
                            <RotateCcw size={18} />
                            <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[9px] font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">5s</span>
                        </button>

                        <button
                            onClick={togglePlay}
                            className="w-10 h-10 flex items-center justify-center bg-primary hover:bg-primary-hover text-white rounded-full transition-all shadow-md hover:scale-105 active:scale-95"
                            title={isPlaying ? 'Pause' : 'Play'}
                        >
                            {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
                        </button>

                        <button
                            onClick={() => skip(5)}
                            className="p-2 rounded-full hover:bg-surface-hover transition-colors text-text-muted hover:text-text-main relative group"
                            title="Forward 5s"
                        >
                            <RotateCw size={18} />
                            <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[9px] font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">5s</span>
                        </button>
                    </div>

                    {/* Progress Bar & Time */}
                    <div className="flex-1 flex items-center gap-3">
                        <span className="text-xs font-mono font-medium text-text-muted w-10 text-right">{formatTime(currentTime)}</span>

                        <div className="relative flex-1 h-6 flex items-center group">
                            <div className="absolute inset-0 bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 my-auto overflow-hidden">
                                <div
                                    className="h-full bg-primary transition-all duration-100"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <input
                                type="range"
                                min={0}
                                max={duration || 100}
                                value={currentTime}
                                onChange={handleSeek}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                title="Seek"
                            />
                            {/* Hover scrubbing hint could go here */}
                        </div>

                        <span className="text-xs font-mono font-medium text-text-muted w-10">{formatTime(duration)}</span>
                    </div>

                    {/* Extra Controls: Speed & Volume */}
                    <div className="flex items-center gap-1 sm:gap-2 shrink-0 border-l border-border pl-2 sm:pl-4">

                        {/* Speed Control */}
                        <div className="relative">
                            <button
                                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                                className={`
                                    flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors
                                    ${playbackRate !== 1 || showSpeedMenu ? 'bg-primary/10 text-primary' : 'text-text-muted hover:bg-surface-hover hover:text-text-main'}
                                `}
                                title="Playback Speed"
                            >
                                <Gauge size={14} />
                                <span>{playbackRate}x</span>
                            </button>

                            {showSpeedMenu && (
                                <>
                                    <div
                                        className="fixed inset-0 z-30"
                                        onClick={() => setShowSpeedMenu(false)}
                                    />
                                    <div className="absolute bottom-full right-0 mb-2 w-32 bg-surface border border-border rounded-xl shadow-xl z-40 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                                        {[0.5, 0.75, 1, 1.25, 1.5, 2].map(rate => (
                                            <button
                                                key={rate}
                                                onClick={() => changeSpeed(rate)}
                                                className={`
                                                    w-full flex items-center justify-between px-3 py-2 text-sm transition-colors
                                                    ${playbackRate === rate ? 'bg-primary/10 text-primary font-medium' : 'text-text-secondary hover:bg-surface-hover text-left'}
                                                `}
                                            >
                                                <span>{rate}x</span>
                                                {playbackRate === rate && <div className="w-1.5 h-1.5 rounded-full bg-current" />}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Volume Control */}
                        <div className="group hidden md:flex items-center relative gap-2">
                            <button
                                onClick={toggleMute}
                                className={`p-1.5 rounded-full hover:bg-surface-hover transition-colors ${isMuted || volume === 0 ? 'text-red-500' : 'text-text-muted hover:text-text-main'}`}
                                title={isMuted ? 'Unmute' : 'Mute'}
                            >
                                {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                            </button>

                            <div className="w-0 overflow-hidden group-hover:w-20 transition-all duration-300 ease-in-out">
                                <input
                                    type="range"
                                    min={0}
                                    max={1}
                                    step={0.1}
                                    value={isMuted ? 0 : volume}
                                    onChange={handleVolumeChange}
                                    className="w-20 h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
);
