"use client";

import React, { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Volume2 } from 'lucide-react';
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
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const setAudioData = () => {
      setDuration(audio.duration);
      setCurrentTime(audio.currentTime);
      setIsLoaded(true);
    };

    const setAudioTime = () => setCurrentTime(audio.currentTime);
    const togglePlay = () => setIsPlaying(!audio.paused);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('loadedmetadata', setAudioData);
    audio.addEventListener('timeupdate', setAudioTime);
    audio.addEventListener('play', togglePlay);
    audio.addEventListener('pause', togglePlay);
    audio.addEventListener('ended', handleEnded);

    // Limpa os event listeners ao desmontar o componente
    return () => {
      audio.removeEventListener('loadedmetadata', setAudioData);
      audio.removeEventListener('timeupdate', setAudioTime);
      audio.removeEventListener('play', togglePlay);
      audio.removeEventListener('pause', togglePlay);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioUrl]); // Re-executa se a URL do áudio mudar

  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (audio) {
      if (isPlaying) {
        audio.pause();
      } else {
        audio.play().catch(error => {
          console.error("Erro ao reproduzir áudio:", error);
        });
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
    if (isNaN(time)) return "00:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Calcular progresso da reprodução (0-100%)
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="space-y-2 w-full">
      {transcription && (
        <p className={cn(
          "text-sm italic mb-2",
          isUserMessage ? "text-primary-foreground opacity-90" : "text-muted-foreground"
        )}>
          "{transcription}"
        </p>
      )}
      
      <div className={cn(
        "flex flex-col gap-1.5 rounded-lg p-2", // Player em si
        isUserMessage ? "bg-primary/80" : "bg-background border"
      )}>
        <audio ref={audioRef} src={audioUrl} preload="metadata" />
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePlayPause}
            className={cn(
              "h-8 w-8 rounded-full p-0 flex-shrink-0", // Botão Play/Pause arredondado
              isUserMessage 
                ? "text-primary-foreground hover:bg-primary/60" 
                : "text-foreground hover:bg-accent"
            )}
            disabled={!isLoaded}
          >
            {isPlaying ? 
              <Pause className="h-4 w-4" /> : 
              <Play className="h-4 w-4 ml-0.5" />
            }
          </Button>
          
          <div className="flex-1 flex flex-col gap-1">
            <div className="relative w-full h-1.5 bg-gray-300 rounded-full overflow-hidden">
              <div 
                className={cn(
                  "absolute top-0 left-0 h-full transition-all duration-100",
                  isUserMessage ? "bg-primary-foreground/90" : "bg-primary"
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
            
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              className="absolute opacity-0 w-full h-6 cursor-pointer"
              style={{ marginTop: '-10px' }}
              disabled={!isLoaded}
            />
            
            <div className="flex justify-between items-center">
              <span className={cn(
                "text-xs font-mono",
                isUserMessage ? "text-primary-foreground/80" : "text-muted-foreground"
              )}>
                {formatTime(currentTime)}
              </span>
              
              <span className={cn(
                "text-xs font-mono",
                isUserMessage ? "text-primary-foreground/70" : "text-muted-foreground/70"
              )}>
                {formatTime(duration)}
              </span>
            </div>
          </div>
          
          <Volume2 className={cn(
            "h-3 w-3 flex-shrink-0",
            isUserMessage ? "text-primary-foreground/70" : "text-muted-foreground/70"
          )} />
        </div>
      </div>
    </div>
  );
};