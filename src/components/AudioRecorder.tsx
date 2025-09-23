"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, StopCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { getOpenAIClient } from '@/integrations/openai/client';
import { showSuccess, showError } from '@/utils/toast';
import { cn } from '@/lib/utils';

interface AudioRecorderProps {
  onAudioRecorded: (transcription: string, audioBlob: Blob) => void;
  disabled?: boolean;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({ onAudioRecorded, disabled }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'recording' | 'processing'>('idle');
  const [audioPermission, setAudioPermission] = useState<boolean | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const openAIClient = useRef(getOpenAIClient()).current;

  const MIN_AUDIO_DURATION_MS = 500;
  const MAX_AUDIO_DURATION_MS = 30000; // 30 segundos

  useEffect(() => {
    const checkAudioPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        setAudioPermission(true);
      } catch {
        setAudioPermission(false);
      }
    };
    checkAudioPermission();
  }, []);

  const startRecording = async () => {
    if (disabled || isRecording || isProcessing || audioPermission === false) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      
      const mimeType = ['audio/webm', 'audio/mp4', 'audio/aac'].find(MediaRecorder.isTypeSupported) || 'audio/webm';
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
      
      audioChunksRef.current = [];
      setRecordingDuration(0);
      setRecordingStatus('recording');

      intervalRef.current = setInterval(() => {
        setRecordingDuration(prev => {
          if (prev >= MAX_AUDIO_DURATION_MS / 100) {
            stopRecording(true);
            return prev;
          }
          return prev + 1;
        });
      }, 100);

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        setRecordingStatus('processing');
        
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        
        audioStreamRef.current?.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;

        if (recordingDuration * 100 < MIN_AUDIO_DURATION_MS) {
          showError(`Áudio muito curto. Mínimo de ${MIN_AUDIO_DURATION_MS / 1000} segundos.`);
          setRecordingStatus('idle');
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorderRef.current?.mimeType });
        
        try {
          const transcription = await openAIClient.transcribeAudio(audioBlob);
          if (transcription) {
            onAudioRecorded(transcription, audioBlob);
            showSuccess("Áudio transcrito e enviado!");
          } else {
            showError("Não foi possível transcrever o áudio. Tente novamente.");
          }
        } catch (error: any) {
          console.error("Erro ao transcrever áudio:", error);
          showError("Erro ao processar áudio. Tente novamente.");
        } finally {
          setRecordingStatus('idle');
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      showSuccess("Gravação iniciada...");
    } catch (err: any) {
      console.error("Erro ao acessar o microfone:", err);
      showError("Não foi possível acessar o microfone. Verifique as permissões.");
      setRecordingStatus('idle');
    }
  };

  const stopRecording = (autoStop = false) => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (!autoStop) {
        showSuccess(recordingDuration * 100 < MIN_AUDIO_DURATION_MS 
          ? "Áudio muito curto" 
          : "Gravação finalizada"
        );
      }
    }
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 10);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const renderButton = () => {
    if (audioPermission === false) {
      return (
        <Button 
          variant="destructive" 
          className="w-full"
          onClick={() => showError("Permissão de microfone negada. Verifique suas configurações.")}
        >
          Microfone Bloqueado
        </Button>
      );
    }

    return (
      <div className="relative w-full">
        <Button
          variant={recordingStatus === 'recording' ? 'destructive' : 'default'}
          className={cn(
            "w-full transition-all duration-300 group",
            recordingStatus === 'recording' && "animate-pulse"
          )}
          onTouchStart={startRecording}
          onTouchEnd={stopRecording}
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          disabled={recordingStatus === 'processing'}
        >
          {recordingStatus === 'processing' ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : recordingStatus === 'recording' ? (
            <>
              <StopCircle className="mr-2 h-4 w-4" />
              {formatTime(recordingDuration)}
            </>
          ) : (
            <>
              <Mic className="mr-2 h-4 w-4" />
              Gravar Áudio
            </>
          )}
        </Button>
        {recordingStatus === 'recording' && (
          <div className="absolute inset-x-0 bottom-full mb-2 flex justify-center">
            <div className="bg-background border rounded-full px-3 py-1 text-xs shadow-md">
              {formatTime(recordingDuration)} / 00:30
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full">
      {renderButton()}
    </div>
  );
};