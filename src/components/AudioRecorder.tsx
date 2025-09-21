"use client";

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, StopCircle, Loader2 } from 'lucide-react';
import { getOpenAIClient } from '@/integrations/openai/client';
import { showSuccess, showError } from '@/utils/toast';

interface AudioRecorderProps {
  onAudioRecorded: (transcription: string, audioBlob: Blob) => void;
  disabled?: boolean;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({ onAudioRecorded, disabled }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0); // Novo estado para a duração da gravação
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null); // Para parar as tracks do microfone
  const intervalRef = useRef<NodeJS.Timeout | null>(null); // Referência para o timer do intervalo
  const openAIClient = useRef(getOpenAIClient()).current;

  const MIN_AUDIO_DURATION_MS = 500; // 0.5 segundos, um pouco acima do mínimo de 0.1s da OpenAI para segurança

  const startRecording = async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault(); // Previne o comportamento padrão do navegador (zoom, seleção de texto)
    if (disabled || isRecording || isProcessing) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream; // Armazena o stream para parar as tracks depois
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      setRecordingDuration(0); // Reinicia a duração

      // Inicia o timer para atualizar a duração da gravação
      intervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 100); // Atualiza a cada 100ms
      }, 100);

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        setIsRecording(false);
        // Limpa o timer
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        
        // Para todas as tracks no stream para liberar o microfone
        audioStreamRef.current?.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;

        // Verifica a duração mínima antes de processar
        if (recordingDuration < MIN_AUDIO_DURATION_MS) {
          showError(`Áudio muito curto. Mínimo de ${MIN_AUDIO_DURATION_MS / 1000} segundos.`);
          setIsProcessing(false); // Garante que o estado de processamento seja resetado
          return;
        }

        setIsProcessing(true);
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        try {
          const transcription = await openAIClient.transcribeAudio(audioBlob);
          if (transcription) {
            onAudioRecorded(transcription, audioBlob); // Passa tanto a transcrição quanto o blob
            showSuccess("Áudio transcrito e enviado!");
          } else {
            showError("Não foi possível transcrever o áudio. Tente novamente.");
          }
        } catch (error: any) {
          console.error("Erro ao transcrever áudio:", error);
          showError(`Erro na transcrição: ${error.message || 'Erro desconhecido'}`);
        } finally {
          setIsProcessing(false);
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      showSuccess("Gravação iniciada...");
    } catch (err: any) {
      console.error("Erro ao acessar o microfone:", err);
      showError(`Erro ao acessar o microfone: ${err.message || 'Permissão negada ou microfone não disponível.'}`);
    }
  };

  const stopRecording = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault(); // Previne o comportamento padrão do navegador
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  // Formata a duração para MM:SS
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className={`h-10 w-10 transition-all duration-200 ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'text-muted-foreground hover:bg-accent'}`}
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        onMouseLeave={stopRecording} // Para se o mouse sair enquanto segura
        onTouchStart={startRecording}
        onTouchEnd={stopRecording}
        onTouchCancel={stopRecording}
        disabled={disabled || isProcessing}
        title={isRecording ? "Solte para parar" : "Pressione e segure para gravar"}
        style={{ userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'manipulation' }} // Adicionado para prevenir zoom/seleção
      >
        {isProcessing ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : isRecording ? (
          <StopCircle className="h-5 w-5" />
        ) : (
          <Mic className="h-5 w-5" />
        )}
      </Button>
      {isRecording && (
        <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-xs text-muted-foreground bg-background px-2 py-1 rounded-md shadow-sm">
          {formatTime(recordingDuration)}
        </span>
      )}
    </div>
  );
};