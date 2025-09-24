"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, StopCircle, Loader2 } from 'lucide-react';
import { getOpenAIClient } from '@/integrations/openai/client';
import { showSuccess, showError } from '@/utils/toast';
import { cn } from '@/lib/utils';

interface AudioRecorderProps {
  onAudioRecorded: (transcription: string, audioBlob: Blob) => void;
  disabled?: boolean;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({ onAudioRecorded, disabled }) => {
  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'recording' | 'processing'>('idle');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioPermission, setAudioPermission] = useState<boolean | null>(null);
  const [pressStartTime, setPressStartTime] = useState<number | null>(null);
  const [isLongPress, setIsLongPress] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recordingStartTimeRef = useRef<number | null>(null); // Novo: para registrar o tempo de início real
  const openAIClient = useRef(getOpenAIClient()).current;

  const MIN_AUDIO_DURATION_MS = 500;
  const MAX_AUDIO_DURATION_MS = 60000; // 60 segundos como WhatsApp
  const LONG_PRESS_DURATION = 200; // 200ms para detectar long press

  // Verificar permissão de microfone
  useEffect(() => {
    const checkAudioPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        setAudioPermission(true);
        console.log("[AudioRecorder] Permissão de microfone concedida.");
      } catch (error) {
        console.error("[AudioRecorder] Erro ao verificar permissão de microfone:", error);
        setAudioPermission(false);
      }
    };
    
    checkAudioPermission();
  }, []);

  const startRecording = async () => {
    if (disabled || recordingStatus !== 'idle' || audioPermission === false) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        } 
      });
      
      audioStreamRef.current = stream;
      
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/aac',
        'audio/ogg;codecs=opus'
      ];
      
      const supportedType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || 'audio/webm';
      
      const options = { 
        mimeType: supportedType,
        audioBitsPerSecond: 128000 
      };
      
      mediaRecorderRef.current = new MediaRecorder(stream, options);
      
      audioChunksRef.current = [];
      setRecordingDuration(0);
      setRecordingStatus('recording');
      console.log("[AudioRecorder] Gravação iniciada.");

      intervalRef.current = setInterval(() => {
        setRecordingDuration(prev => {
          const newDuration = prev + 100;
          if (newDuration >= MAX_AUDIO_DURATION_MS) {
            stopRecording(true);
            return prev;
          }
          return newDuration;
        });
      }, 100);

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log(`[AudioRecorder] Dados de áudio disponíveis: ${event.data.size} bytes. Total de chunks: ${audioChunksRef.current.length}`);
        } else {
          console.log("[AudioRecorder] Evento ondataavailable com 0 bytes.");
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        setRecordingStatus('processing');
        console.log("[AudioRecorder] Gravação parada. Processando...");
        
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        
        audioStreamRef.current?.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;

        // Calcular a duração real da gravação
        const actualDuration = recordingStartTimeRef.current ? Date.now() - recordingStartTimeRef.current : 0;
        console.log(`[AudioRecorder] Duração real da gravação: ${actualDuration} ms`);

        if (audioChunksRef.current.length === 0) {
          showError("Nenhum áudio capturado. Tente novamente.");
          setRecordingStatus('idle');
          console.log("[AudioRecorder] Nenhuma chunk de áudio capturada. Resetando.");
          return;
        }
        
        // Usar a duração real para a verificação
        if (actualDuration < MIN_AUDIO_DURATION_MS) { 
          showError("Áudio muito curto. Mantenha pressionado por mais tempo.");
          setRecordingStatus('idle');
          console.log("[AudioRecorder] Duração mínima não atingida. Resetando.");
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, { 
          type: mediaRecorderRef.current?.mimeType || 'audio/webm' 
        });
        
        try {
          const transcription = await openAIClient.transcribeAudio(audioBlob);
          
          if (transcription && transcription.trim()) {
            onAudioRecorded(transcription, audioBlob);
            console.log("[AudioRecorder] Áudio transcrito e enviado.");
          } else {
            showError("Não foi possível transcrever o áudio. Tente falar mais claramente.");
            console.log("[AudioRecorder] Transcrição vazia ou falhou.");
          }
        } catch (error: any) {
          console.error("[AudioRecorder] Erro ao transcrever áudio:", error);
          showError("Erro ao processar áudio. Tente novamente.");
        } finally {
          setRecordingStatus('idle');
          console.log("[AudioRecorder] Processamento finalizado. Status 'idle'.");
        }
      };

      mediaRecorderRef.current.start(100);
      recordingStartTimeRef.current = Date.now(); // Registrar o tempo de início real
      
    } catch (err: any) {
      console.error("[AudioRecorder] Erro ao acessar o microfone:", err);
      showError("Não foi possível acessar o microfone. Verifique as permissões.");
      setRecordingStatus('idle');
    }
  };

  const stopRecording = (autoStop = false) => {
    if (mediaRecorderRef.current && recordingStatus === 'recording') {
      mediaRecorderRef.current.stop();
      console.log(`[AudioRecorder] Chamando stop() no MediaRecorder. AutoStop: ${autoStop}`);
      
      if (autoStop) {
        showSuccess("Tempo máximo atingido. Processando áudio...");
      }
    }
  };

  const handlePressStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (disabled || recordingStatus !== 'idle') return;

    const currentTime = Date.now();
    setPressStartTime(currentTime);
    setIsLongPress(false);

    longPressTimeoutRef.current = setTimeout(() => {
      setIsLongPress(true);
      startRecording();
    }, LONG_PRESS_DURATION);
  };

  const handlePressEnd = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }

    if (recordingStatus === 'recording') {
      stopRecording();
    } else if (pressStartTime && !isLongPress) {
      const pressDuration = Date.now() - pressStartTime;
      if (pressDuration < LONG_PRESS_DURATION) {
        showError("Mantenha pressionado para gravar áudio");
      }
    }

    setPressStartTime(null);
    setIsLongPress(false);
  };

  const handlePressCancel = () => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }

    if (recordingStatus === 'recording') {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
      }
      setRecordingStatus('idle');
      setRecordingDuration(0);
      showError("Gravação cancelada");
      console.log("[AudioRecorder] Gravação cancelada pelo usuário.");
    }

    setPressStartTime(null);
    setIsLongPress(false);
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (audioPermission === false) {
    return (
      <Button 
        variant="destructive" 
        size="icon"
        className="h-10 w-10 rounded-full"
        onClick={() => showError("Permissão de microfone negada. Verifique as configurações do navegador.")}
      >
        <Mic className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <div className="relative">
      {recordingStatus === 'recording' && (
        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-medium animate-pulse">
          {formatTime(recordingDuration)}
        </div>
      )}

      <Button
        variant={recordingStatus === 'recording' ? 'destructive' : 'default'}
        size="icon"
        className={cn(
          "h-10 w-10 rounded-full transition-all duration-200 select-none",
          recordingStatus === 'recording' && "scale-110 animate-pulse",
          recordingStatus === 'processing' && "cursor-not-allowed"
        )}
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressCancel}
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
        onTouchCancel={handlePressCancel}
        onContextMenu={(e) => e.preventDefault()}
        disabled={recordingStatus === 'processing' || disabled}
        style={{ 
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none'
        }}
      >
        {recordingStatus === 'processing' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : recordingStatus === 'recording' ? (
          <StopCircle className="h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </Button>

      {pressStartTime && !isLongPress && recordingStatus === 'idle' && (
        <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-muted text-muted-foreground px-3 py-1 rounded-lg text-xs whitespace-nowrap">
          Mantenha pressionado para gravar
        </div>
      )}
    </div>
  );
};