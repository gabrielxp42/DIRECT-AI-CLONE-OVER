"use client";

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, StopCircle, Loader2, XCircle } from 'lucide-react';
import { getOpenAIClient } from '@/integrations/openai/client';
import { showSuccess, showError } from '@/utils/toast';

interface AudioRecorderProps {
  onTranscription: (text: string) => void;
  disabled?: boolean;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({ onTranscription, disabled }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const openAIClient = useRef(getOpenAIClient()).current;

  const startRecording = async () => {
    if (disabled) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        setIsRecording(false);
        setIsProcessing(true);
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        try {
          const transcription = await openAIClient.transcribeAudio(audioBlob);
          if (transcription) {
            onTranscription(transcription);
            showSuccess("Áudio transcrito com sucesso!");
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
    <div className="flex items-center">
      {isProcessing ? (
        <Button variant="ghost" size="icon" disabled className="h-10 w-10">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </Button>
      ) : isRecording ? (
        <Button variant="destructive" size="icon" onClick={stopRecording} className="h-10 w-10 animate-pulse">
          <StopCircle className="h-5 w-5" />
        </Button>
      ) : (
        <Button variant="ghost" size="icon" onClick={startRecording} disabled={disabled} className="h-10 w-10">
          <Mic className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
};