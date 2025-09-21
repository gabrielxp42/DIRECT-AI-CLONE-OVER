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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null); // Para parar as tracks do microfone
  const openAIClient = useRef(getOpenAIClient()).current;

  const startRecording = async () => {
    if (disabled || isRecording || isProcessing) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream; // Armazena o stream para parar as tracks depois
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        setIsRecording(false);
        setIsProcessing(true);
        // Para todas as tracks no stream
        audioStreamRef.current?.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;

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

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  return (
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
    >
      {isProcessing ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : isRecording ? (
        <StopCircle className="h-5 w-5" />
      ) : (
        <Mic className="h-5 w-5" />
      )}
    </Button>
  );
};