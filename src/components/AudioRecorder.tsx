"use client";

import React, { useState, useRef, useEffect } from 'react';
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
  const [isLongPressDetected, setIsLongPressDetected] = useState(false); // True if long press initiated recording
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const openAIClient = useRef(getOpenAIClient()).current;

  const startSound = useRef(new Audio('/sounds/record_start.mp3')).current;
  const stopSound = useRef(new Audio('/sounds/record_stop.mp3')).current;

  const MIN_AUDIO_DURATION_MS = 500; // 0.5 segundos
  const LONG_PRESS_DELAY = 300; // Tempo em ms para considerar um 'long press'

  // Cleanup function for timeouts, intervals, and media recorder
  useEffect(() => {
    return () => {
      if (longPressTimeoutRef.current) clearTimeout(longPressTimeoutRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const getSupportedMimeType = () => {
    // Priorize formatos conhecidos por funcionar bem com iOS e OpenAI Whisper
    const preferredMimeTypes = [
      'audio/mp4', // Geralmente bom para iOS
      'audio/aac', // Outra boa opção para iOS
      'audio/webm;codecs=opus', // Alta qualidade, bom para Chrome/Firefox
      'audio/webm',
      'audio/ogg',
    ];

    for (const type of preferredMimeTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        console.log(`[AudioRecorder] Usando MIME type suportado: ${type}`);
        return type;
      }
    }
    console.warn('[AudioRecorder] Nenhum MIME type preferido suportado, usando fallback padrão: audio/webm');
    return 'audio/webm'; // Fallback padrão
  };

  const startRecordingProcess = async () => {
    if (disabled || isProcessing || isRecording) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      
      const mimeType = getSupportedMimeType();
      
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
      
      audioChunksRef.current = [];
      setRecordingDuration(0);

      mediaRecorderRef.current.onstart = () => {
        console.log('[AudioRecorder] Gravação iniciada com sucesso.');
        setIsRecording(true);
        showSuccess("Gravação iniciada...");
        startSound.play().catch(e => console.warn("Erro ao reproduzir som de início:", e));
        
        intervalRef.current = setInterval(() => {
          setRecordingDuration(prev => prev + 100);
        }, 100);
      };

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        setIsRecording(false);
        setIsLongPressDetected(false); // Reset long press state

        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        
        audioStreamRef.current?.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;

        stopSound.play().catch(e => console.warn("Erro ao reproduzir som de fim:", e));

        if (audioChunksRef.current.length === 0 || recordingDuration < MIN_AUDIO_DURATION_MS) {
          let errorMessage = "Nenhum áudio foi gravado ou o áudio foi muito curto.";
          if (audioChunksRef.current.length === 0) {
            errorMessage = "Nenhum dado de áudio foi coletado. Tente novamente.";
          } else if (recordingDuration < MIN_AUDIO_DURATION_MS) {
            errorMessage = `Áudio muito curto. Mínimo de ${MIN_AUDIO_DURATION_MS / 1000} segundos.`;
          }
          showError(errorMessage);
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
    } catch (err: any) {
      console.error("Erro ao acessar o microfone:", err);
      showError("Para interagir com o assistente por voz, precisamos da sua permissão para acessar o microfone. Por favor, permita o acesso nas configurações do seu navegador para continuar a usar o recurso de voz. 🎙️");
    }
  };

  const stopRecordingProcess = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    // Previne o comportamento padrão do navegador, como o menu de contexto em toque longo
    e.preventDefault(); 
    if (disabled || isProcessing) return;

    // Se já estiver gravando (por um toque anterior), um novo down/tap deve parar.
    // Mas para o "pressionar e segurar", queremos que ele comece a gravar.
    // A lógica de "pressionar e segurar" tem prioridade.
    if (isRecording && !isLongPressDetected) {
      // Se já está gravando por TAP, este DOWN é o início de um novo TAP para parar.
      // Não fazemos nada aqui, a parada será no UP.
      return;
    }

    // Inicia o timer para detectar um "pressionar e segurar"
    longPressTimeoutRef.current = setTimeout(() => {
      setIsLongPressDetected(true); // Marca que um toque longo foi detectado
      startRecordingProcess(); // Inicia a gravação
    }, LONG_PRESS_DELAY);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    if (disabled || isProcessing) return;

    // Limpa o timer de "pressionar e segurar"
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }

    if (isLongPressDetected) {
      // Se a gravação foi iniciada por "pressionar e segurar", para ao soltar
      stopRecordingProcess();
    } else {
      // Se não foi um "pressionar e segurar" (foi um toque rápido)
      if (isRecording) {
        // Se já estava gravando (por um toque anterior), para a gravação
        stopRecordingProcess();
      } else {
        // Se não estava gravando, inicia a gravação (toque para iniciar)
        startRecordingProcess();
      }
    }
    // Reseta o estado de detecção de toque longo
    setIsLongPressDetected(false);
  };

  const handlePointerLeave = (e: React.PointerEvent) => {
    // Se o ponteiro sair enquanto um "pressionar e segurar" estava ativo e gravando, para a gravação
    if (isLongPressDetected && isRecording) {
      stopRecordingProcess();
    }
    // Limpa o timer de "pressionar e segurar" se ainda estiver ativo
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
    setIsLongPressDetected(false);
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
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        disabled={disabled || isProcessing}
        title={isRecording ? "Toque para parar / Solte para parar" : "Toque para gravar / Pressione e segure para gravar"}
        // touch-action: manipulation é importante para evitar o zoom padrão do iOS em toques duplos
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