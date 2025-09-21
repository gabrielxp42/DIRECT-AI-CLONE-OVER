"use client";

import React, { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AudioMessageDisplayProps {
  audioUrl: string;
  transcription: string;
  isUserMessage: boolean; // Para ajustar o estilo com base no remetente
}

export const AudioMessageDisplay: React.FC<AudioMessageDisplayProps> = ({ audioUrl, transcription, isUserMessage }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const setAudioData = () => {
      setDuration(audio.duration);
      setCurrentTime(audio.currentTime);
    };

    const setAudioTime = () => setCurrentTime(audio.currentTime);
    const togglePlay = () => setIsPlaying(!audio.paused);

    audio.addEventListener('loadedmetadata', setAudioData);
    audio.addEventListener('timeupdate', setAudioTime);
    audio.addEventListener('play', togglePlay);
    audio.addEventListener('pause', togglePlay);
    audio.addEventListener('ended', () => setIsPlaying(false));

    // Limpa os event listeners ao desmontar o componente
    return () => {
      audio.removeEventListener('loadedmetadata', setAudioData);
      audio.removeEventListener('timeupdate', setAudioTime);
      audio.removeEventListener('play', togglePlay);
      audio.removeEventListener('pause', togglePlay);
      audio.removeEventListener('ended', () => setIsPlaying(false));
    };
  }, [audioUrl]); // Re-executa se a URL do áudio mudar

  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (audio) {
      if (isPlaying) {
        audio.pause();
      } else {
        audio.play();
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = parseFloat(e.target.value);
      setCurrentTime(audio.currentTime);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-2 w-full">
      {transcription && (
        <p className={cn(
          "text-sm italic",
          isUserMessage ? "text-primary-foreground opacity-80" : "text-muted-foreground"
        )}>
          "{transcription}"
        </p>
      )}
      <div className={cn(
        "flex items-center gap-2 p-1 rounded-full", // Player em si é arredondado
        isUserMessage ? "bg-primary/80" : "bg-background border"
      )}>
        <audio ref={audioRef} src={audioUrl} preload="metadata" />
        <Button
          variant="ghost"
          size="icon"
          onClick={handlePlayPause}
          className={cn(
            "h-8 w-8 rounded-full", // Botão Play/Pause também é arredondado
            isUserMessage ? "text-primary-foreground hover:bg-primary/60" : "text-foreground hover:bg-accent"
          )}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <input
          type="range"
          min="0"
          max={duration || 0} // Garante que max não seja NaN
          value={currentTime}
          onChange={handleSeek}
          className="flex-1 h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
          style={{
            background: `linear-gradient(to right, ${isUserMessage ? 'var(--primary-foreground)' : 'var(--primary)'} ${((currentTime / duration) * 100) || 0}%, ${isUserMessage ? 'rgba(255,255,255,0.3)' : 'var(--muted-foreground)'} ${((currentTime / duration) * 100) || 0}%)`
          }}
        />
        <span className={cn(
          "text-xs font-mono",
          isUserMessage ? "text-primary-foreground opacity-80" : "text-muted-foreground"
        )}>
          {formatTime(currentTime)}
        </span>
      </div>
    </div>
  );
};