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
  const [isMobile, setIsMobile] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const openAIClient = useRef(getOpenAIClient()).current;

  const MIN_AUDIO_DURATION_MS = 500;
  const MAX_AUDIO_DURATION_MS = 30000; // 30 segundos

  // Detectar se é dispositivo móvel
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor;
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
      setIsMobile(isMobileDevice);
    };
    
    checkMobile();
    
    // Verificar permissão de microfone
    const checkAudioPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        setAudioPermission(true);
      } catch (error) {
        console.error("Erro ao verificar permissão de microfone:", error);
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
          autoGainControl: true
        } 
      });
      
      audioStreamRef.current = stream;
      
      // Escolher o melhor formato de áudio suportado
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/aac',
        'audio/ogg;codecs=opus'
      ];
      
      const supportedType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || 'audio/webm';
      
      // Configurar o MediaRecorder com alta qualidade
      const options = { 
        mimeType: supportedType,
        audioBitsPerSecond: 128000 
      };
      
      mediaRecorderRef.current = new MediaRecorder(stream, options);
      
      audioChunksRef.current = [];
      setRecordingDuration(0);
      setRecordingStatus('recording');

      // Iniciar timer para mostrar duração da gravação
      intervalRef.current = setInterval(() => {
        setRecordingDuration(prev => {
          const newDuration = prev + 1;
          if (newDuration * 100 >= MAX_AUDIO_DURATION_MS) {
            stopRecording(true);
            return prev;
          }
          return newDuration;
        });
      }, 100);

      // Coletar dados de áudio
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Configurar o que acontece quando a gravação para
      mediaRecorderRef.current.onstop = async () => {
        setRecordingStatus('processing');
        
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        
        // Liberar recursos de áudio
        audioStreamRef.current?.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;

        // Verificar se o áudio é longo o suficiente
        if (recordingDuration * 100 < MIN_AUDIO_DURATION_MS) {
          showError(`Áudio muito curto. Fale por pelo menos ${MIN_AUDIO_DURATION_MS / 1000} segundos.`);
          setRecordingStatus('idle');
          return;
        }

        // Criar blob de áudio com os chunks coletados
        const audioBlob = new Blob(audioChunksRef.current, { 
          type: mediaRecorderRef.current?.mimeType || 'audio/webm' 
        });
        
        try {
          // Mostrar feedback visual
          showSuccess("Transcrevendo áudio...");
          
          // Transcrever o áudio
          const transcription = await openAIClient.transcribeAudio(audioBlob);
          
          if (transcription) {
            // Enviar áudio e transcrição para o componente pai
            onAudioRecorded(transcription, audioBlob);
            showSuccess("Áudio enviado com sucesso!");
          } else {
            showError("Não foi possível transcrever o áudio. Tente falar mais claramente.");
          }
        } catch (error: any) {
          console.error("Erro ao transcrever áudio:", error);
          showError("Erro ao processar áudio. Verifique sua conexão e tente novamente.");
        } finally {
          setRecordingStatus('idle');
        }
      };

      // Iniciar gravação com dados a cada 1 segundo
      mediaRecorderRef.current.start(1000);
      showSuccess("Gravando... Fale agora!");
      
    } catch (err: any) {
      console.error("Erro ao acessar o microfone:", err);
      showError("Não foi possível acessar o microfone. Verifique as permissões do navegador.");
      setRecordingStatus('idle');
    }
  };

  const stopRecording = (autoStop = false) => {
    if (mediaRecorderRef.current && recordingStatus === 'recording') {
      mediaRecorderRef.current.stop();
      
      if (!autoStop) {
        if (recordingDuration * 100 < MIN_AUDIO_DURATION_MS) {
          showError(`Áudio muito curto. Fale por pelo menos ${MIN_AUDIO_DURATION_MS / 1000} segundos.`);
        } else {
          showSuccess("Processando áudio...");
        }
      } else {
        showSuccess("Tempo máximo atingido. Processando áudio...");
      }
    }
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 10);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Calcular progresso da gravação (0-100%)
  const recordingProgress = (recordingDuration * 100) / MAX_AUDIO_DURATION_MS * 100;

  // Renderizar botão de acordo com o estado e tipo de dispositivo
  if (audioPermission === false) {
    return (
      <Button 
        variant="destructive" 
        className="w-full"
        onClick={() => showError("Permissão de microfone negada. Verifique as configurações do seu navegador.")}
      >
        <Mic className="mr-2 h-4 w-4" />
        Microfone Bloqueado
      </Button>
    );
  }

  if (isMobile) {
    // Interface otimizada para dispositivos móveis
    return (
      <div className="w-full">
        {recordingStatus === 'recording' && (
          <div className="mb-2 w-full bg-muted rounded-full h-2.5 overflow-hidden">
            <div 
              className="bg-primary h-full transition-all duration-100 ease-in-out"
              style={{ width: `${recordingProgress}%` }}
            />
          </div>
        )}
        
        <Button
          variant={recordingStatus === 'recording' ? 'destructive' : 'default'}
          className={cn(
            "w-full h-12 text-base font-medium transition-all duration-300",
            recordingStatus === 'recording' && "animate-pulse"
          )}
          onClick={recordingStatus === 'recording' ? () => stopRecording() : startRecording}
          disabled={recordingStatus === 'processing' || disabled}
        >
          {recordingStatus === 'processing' ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Processando...
            </>
          ) : recordingStatus === 'recording' ? (
            <>
              <StopCircle className="mr-2 h-5 w-5" />
              Parar ({formatTime(recordingDuration)})
            </>
          ) : (
            <>
              <Mic className="mr-2 h-5 w-5" />
              Gravar Mensagem
            </>
          )}
        </Button>
      </div>
    );
  }

  // Interface para desktop
  return (
    <div className="w-full">
      <div className="relative">
        {recordingStatus === 'recording' && (
          <div className="absolute -top-6 left-0 right-0 flex justify-center">
            <div className="bg-background border rounded-full px-3 py-1 text-xs shadow-md">
              {formatTime(recordingDuration)} / 00:30
            </div>
          </div>
        )}
        
        <Button
          variant={recordingStatus === 'recording' ? 'destructive' : 'default'}
          className={cn(
            "w-full transition-all duration-300",
            recordingStatus === 'recording' && "animate-pulse"
          )}
          onMouseDown={recordingStatus === 'idle' ? startRecording : undefined}
          onMouseUp={recordingStatus === 'recording' ? () => stopRecording() : undefined}
          onTouchStart={recordingStatus === 'idle' ? startRecording : undefined}
          onTouchEnd={recordingStatus === 'recording' ? () => stopRecording() : undefined}
          onClick={isMobile ? (recordingStatus === 'recording' ? () => stopRecording() : startRecording) : undefined}
          disabled={recordingStatus === 'processing' || disabled}
        >
          {recordingStatus === 'processing' ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processando...
            </>
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
          <div className="mt-2 w-full bg-muted rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-primary h-full transition-all duration-100 ease-in-out"
              style={{ width: `${recordingProgress}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
};