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
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const openAIClient = useRef(getOpenAIClient()).current;

  // Referências para os objetos de áudio para os sons
  const startSound = useRef(new Audio('/sounds/record_start.mp3')).current;
  const stopSound = useRef(new Audio('/sounds/record_stop.mp3')).current;

  const MIN_AUDIO_DURATION_MS = 500;

  // Detecta o melhor MIME type para gravação de áudio
  const getSupportedMimeType = () => {
    const preferredMimeTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4', // Melhor para iOS
      'audio/aac', // Outra boa opção para iOS
      'audio/ogg',
    ];

    for (const type of preferredMimeTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        console.log(`[AudioRecorder] Usando MIME type suportado: ${type}`);
        return type;
      }
    }
    console.warn('[AudioRecorder] Nenhum MIME type preferido suportado, usando fallback padrão: audio/webm');
    return 'audio/webm'; // Fallback padrão se nada mais for suportado
  };

  const startRecording = async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (disabled || isRecording || isProcessing) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      
      const mimeType = getSupportedMimeType();
      
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
      
      audioChunksRef.current = [];
      setRecordingDuration(0);

      // Evento onstart do MediaRecorder para maior confiabilidade
      mediaRecorderRef.current.onstart = () => {
        console.log('[AudioRecorder] Gravação iniciada com sucesso.');
        setIsRecording(true);
        showSuccess("Gravação iniciada...");
        startSound.play().catch(e => console.warn("Erro ao reproduzir som de início:", e)); // Toca o som de início
        
        intervalRef.current = setInterval(() => {
          setRecordingDuration(prev => prev + 100);
        }, 100);
      };

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        setIsRecording(false);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        
        audioStreamRef.current?.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;

        stopSound.play().catch(e => console.warn("Erro ao reproduzir som de fim:", e)); // Toca o som de fim

        // Adicionado: Verifica se algum dado de áudio foi realmente coletado
        if (audioChunksRef.current.length === 0) {
          showError("Nenhum áudio foi gravado. Tente novamente.");
          setIsProcessing(false);
          return;
        }

        if (recordingDuration < MIN_AUDIO_DURATION_MS) {
          showError(`Áudio muito curto. Mínimo de ${MIN_AUDIO_DURATION_MS / 1000} segundos.`);
          setIsProcessing(false);
          return;
        }

        setIsProcessing(true);
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType }); 
        
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
          let userFriendlyErrorMessage = "Ocorreu um erro desconhecido ao transcrever o áudio.";

          if (error.message) {
            const lowerCaseMessage = error.message.toLowerCase();
            if (lowerCaseMessage.includes('invalid file format')) {
              userFriendlyErrorMessage = "Formato de arquivo de áudio inválido. Por favor, tente novamente.";
            } else if (lowerCaseMessage.includes('api key') || lowerCaseMessage.includes('authentication')) {
              userFriendlyErrorMessage = "Erro de autenticação com a API. Verifique sua chave da OpenAI.";
            } else if (lowerCaseMessage.includes('rate limit')) {
              userFriendlyErrorMessage = "Limite de uso da API atingido. Tente novamente mais tarde.";
            } else if (lowerCaseMessage.includes('unknown error')) {
              userFriendlyErrorMessage = "Não foi possível transcrever o áudio. Tente novamente.";
            } else {
              userFriendlyErrorMessage = `Erro na transcrição: ${error.message}`;
            }
          }
          showError(userFriendlyErrorMessage);
        } finally {
          setIsProcessing(false);
        }
      };

      mediaRecorderRef.current.start();
      // setIsRecording(true) e showSuccess movidos para onstart para maior confiabilidade
    } catch (err: any) {
      console.error("Erro ao acessar o microfone:", err);
      showError("Para interagir com o assistente por voz, precisamos da sua permissão para acessar o microfone. Por favor, permita o acesso nas configurações do seu navegador para continuar a usar o recurso de voz. 🎙️");
    }
  };

  const stopRecording = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

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
        className={`h-10 w-10 rounded-full transition-all duration-200 
                    ${isRecording ? 'bg-yellow-600 text-white animate-pulse' : 'bg-yellow-500 text-white hover:bg-yellow-600'}
                    ${disabled || isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        onMouseLeave={stopRecording}
        onTouchStart={startRecording}
        onTouchEnd={stopRecording}
        onTouchCancel={stopRecording}
        disabled={disabled || isProcessing}
        title={isRecording ? "Solte para parar" : "Pressione e segure para gravar"}
        style={{ userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'manipulation' }}
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