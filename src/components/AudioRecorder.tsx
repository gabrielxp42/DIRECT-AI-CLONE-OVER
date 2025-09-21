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
  const [isPressing, setIsPressing] = useState(false); // New state to track if button is currently pressed
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const openAIClient = useRef(getOpenAIClient()).current;

  // Inicializa os objetos Audio e tenta pré-carregar
  const startSound = useRef(new Audio('/sounds/record_start.mp3')).current;
  const stopSound = useRef(new Audio('/sounds/record_stop.mp3')).current;

  useEffect(() => {
    // Tenta carregar os sons assim que o componente é montado
    startSound.load();
    stopSound.load();
  }, [startSound, stopSound]);

  const MIN_AUDIO_DURATION_MS = 500; // 0.5 segundos
  const LONG_PRESS_DELAY = 300; // Tempo em ms para considerar um 'long press'
  const DURATION_UPDATE_INTERVAL_MS = 250; // Intervalo de atualização da duração para otimização

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
    if (disabled || isProcessing || isRecording) {
      console.log('[AudioRecorder] startRecordingProcess abortado: disabled, processing ou already recording.');
      return;
    }

    console.log('[AudioRecorder] Solicitando acesso ao microfone...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      console.log('[AudioRecorder] Acesso ao microfone concedido. Stream obtido.');
      
      const mimeType = getSupportedMimeType();
      
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
      
      audioChunksRef.current = [];
      setRecordingDuration(0);

      mediaRecorderRef.current.onstart = () => {
        console.log('[AudioRecorder] MediaRecorder.onstart disparado. Gravação iniciada.');
        setIsRecording(true);
        showSuccess("Gravação iniciada...");
        startSound.play().catch(e => console.warn("Erro ao reproduzir som de início:", e));
        
        intervalRef.current = setInterval(() => {
          setRecordingDuration(prev => prev + DURATION_UPDATE_INTERVAL_MS);
        }, DURATION_UPDATE_INTERVAL_MS);
      };

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log(`[AudioRecorder] ondataavailable: ${event.data.size} bytes recebidos.`);
        } else {
          console.warn('[AudioRecorder] ondataavailable: Evento com dados de tamanho zero.');
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        console.log('[AudioRecorder] MediaRecorder.onstop disparado. Parando gravação.');
        setIsRecording(false);
        setIsLongPressDetected(false); // Reset long press state

        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        
        audioStreamRef.current?.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;

        stopSound.play().catch(e => console.warn("Erro ao reproduzir som de fim:", e));

        console.log(`[AudioRecorder] Duração final: ${recordingDuration}ms. Total de chunks: ${audioChunksRef.current.length}`);

        if (audioChunksRef.current.length === 0 || recordingDuration < MIN_AUDIO_DURATION_MS) {
          let errorMessage = "Nenhum áudio foi gravado ou o áudio foi muito curto.";
          if (audioChunksRef.current.length === 0) {
            errorMessage = "Nenhum dado de áudio foi coletado. Tente novamente.";
            console.error('[AudioRecorder] Erro: Nenhum chunk de áudio coletado.');
          } else if (recordingDuration < MIN_AUDIO_DURATION_MS) {
            errorMessage = `Áudio muito curto. Mínimo de ${MIN_AUDIO_DURATION_MS / 1000} segundos.`;
            console.warn(`[AudioRecorder] Aviso: Áudio muito curto (${recordingDuration}ms).`);
          }
          showError(errorMessage);
          setIsProcessing(false);
          return;
        }

        setIsProcessing(true);
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType }); 
        console.log(`[AudioRecorder] Blob de áudio criado: tipo=${audioBlob.type}, tamanho=${audioBlob.size} bytes.`);
        
        try {
          const transcription = await openAIClient.transcribeAudio(audioBlob);
          if (transcription) {
            onAudioRecorded(transcription, audioBlob);
            showSuccess("Áudio transcrito e enviado!");
            console.log('[AudioRecorder] Transcrição bem-sucedida.');
          } else {
            showError("Não foi possível transcrever o áudio. Tente novamente.");
            console.error('[AudioRecorder] Erro: Transcrição vazia.');
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
          console.log('[AudioRecorder] Processamento finalizado.');
        }
      };

      mediaRecorderRef.current.start();
    } catch (err: any) {
      console.error("Erro ao acessar o microfone:", err);
      showError("Para interagir com o assistente por voz, precisamos da sua permissão para acessar o microfone. Por favor, permita o acesso nas configurações do seu navegador para continuar a usar o recurso de voz. 🎙️");
      setIsProcessing(false); // Ensure processing state is reset on error
      setIsRecording(false);
      setIsLongPressDetected(false);
      if (longPressTimeoutRef.current) clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const stopRecordingProcess = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      console.log('[AudioRecorder] Chamando MediaRecorder.stop().');
      mediaRecorderRef.current.stop();
    } else {
      console.log('[AudioRecorder] stopRecordingProcess: MediaRecorder não está ativo.');
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault(); // Previne o comportamento padrão do navegador, como o menu de contexto em toque longo
    if (disabled || isProcessing) return;

    setIsPressing(true);
    console.log('[AudioRecorder] PointerDown: Iniciando timer de long press.');
    longPressTimeoutRef.current = setTimeout(() => {
      setIsLongPressDetected(true); // Marca que um toque longo foi detectado
      console.log('[AudioRecorder] Long press detectado. Iniciando gravação.');
      if (!isRecording) { // Só inicia se não estiver gravando (evita iniciar duas vezes se já estava gravando por tap)
        startRecordingProcess();
      }
    }, LONG_PRESS_DELAY);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    if (disabled || isProcessing) return;

    setIsPressing(false);
    console.log('[AudioRecorder] PointerUp: Limpando timer de long press.');
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }

    if (isLongPressDetected) {
      // Se a gravação foi iniciada por "pressionar e segurar", para ao soltar
      console.log('[AudioRecorder] PointerUp: Long press detectado, parando gravação.');
      stopRecordingProcess();
    } else {
      // Se não foi um "pressionar e segurar" (foi um toque rápido)
      if (isRecording) {
        // Se já estava gravando (por um toque anterior), para a gravação
        console.log('[AudioRecorder] PointerUp: Toque rápido, gravação ativa, parando.');
        stopRecordingProcess();
      } else {
        // Se não estava gravando, inicia a gravação (toque para iniciar)
        console.log('[AudioRecorder] PointerUp: Toque rápido, gravação inativa, iniciando.');
        startRecordingProcess();
      }
    }
    setIsLongPressDetected(false); // Reseta o estado de detecção de toque longo
  };

  const handlePointerLeave = (e: React.PointerEvent) => {
    if (isPressing) { // Only if a press was active
      console.log('[AudioRecorder] PointerLeave: Limpando timer de long press.');
      if (longPressTimeoutRef.current) {
        clearTimeout(longPressTimeoutRef.current);
        longPressTimeoutRef.current = null;
      }
      // Crucial: Não parar a gravação aqui se for um long press.
      // A gravação por long press só para no PointerUp.
      // Apenas reseta o estado de detecção de long press e isPressing.
      setIsLongPressDetected(false);
      setIsPressing(false);
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
                    ${isProcessing ? 'bg-yellow-600 text-white animate-spin' : ''}
                    ${isRecording ? 'bg-yellow-600 text-white animate-pulse' : ''}
                    ${!isRecording && isPressing ? 'bg-yellow-500 text-white animate-pulse-subtle' : ''}
                    ${!isRecording && !isPressing && !isProcessing ? 'bg-yellow-500 text-white hover:bg-yellow-600' : ''}
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