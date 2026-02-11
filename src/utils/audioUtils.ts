/**
 * Utilitários para processamento de áudio para o Gemini Multimodal Live API.
 * Gemini exige áudio em PCM Linear de 16-bit, 16kHz (input) e 24kHz (output).
 */

/**
 * Converte um buffer Float32 (formato padrão do Web Audio API) para Int16 (PCM).
 */
export function float32ToInt16(buffer: Float32Array): Int16Array {
    let l = buffer.length;
    const buf = new Int16Array(l);
    while (l--) {
        let s = Math.max(-1, Math.min(1, buffer[l]));
        buf[l] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return buf;
}

/**
 * Converte um buffer Int16 (PCM) para Float32 para reprodução no Web Audio API.
 */
export function int16ToFloat32(buffer: Int16Array): Float32Array {
    let l = buffer.length;
    const buf = new Float32Array(l);
    while (l--) {
        buf[l] = buffer[l] / (buffer[l] < 0 ? 0x8000 : 0x7FFF);
    }
    return buf;
}

/**
 * Converte um buffer de áudio para Base64.
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Base64 para ArrayBuffer.
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}
