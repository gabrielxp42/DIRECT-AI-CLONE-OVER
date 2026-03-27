export const parseQuantidadeFromNome = (nomeOriginal: string) => {
    const patterns = [
        /\s*\[(\d+)[xm]\]\s*$/i,          // [2x] ou [3m] no final
        /\s*(\d+)[xm]\s*$/i,              // 2x ou 3m no final (com espaço ou fim)
        /\s*\[(\d+)[xm]\]/i,              // [2x] ou [3m] em qualquer lugar
        /(?<![.\d])(\d+)x(?!\d)/i,        // 2x isolado (não precedido de ponto/dígito, não seguido de dígito)
    ];
    
    for (const regex of patterns) {
        const match = nomeOriginal.match(regex);
        if (match) {
            const quantidade = parseInt(match[1], 10);
            const nomeLimpo = nomeOriginal.replace(match[0], '').trim();
            return { quantidade, nomeLimpo };
        }
    }

    return { quantidade: 1, nomeLimpo: nomeOriginal.trim() };
};

export const criarNomeComQuantidade = (nomeOriginal: string, quantidade: number) => {
    if (!nomeOriginal) return nomeOriginal;
    
    if (quantidade <= 1) {
        let nomeLimpoRemovido = nomeOriginal;
        const patternsToRemove = [
            /\s*\[\d+[xm]\]\s*$/i,
            /\s*\d+[xm]\s*$/i,
            /\s*\[\d+[xm]\]/i,
            /\s*\d+[xm]/i
        ];
        
        for (const pattern of patternsToRemove) {
            nomeLimpoRemovido = nomeLimpoRemovido.replace(pattern, '').trim();
        }
        return nomeLimpoRemovido;
    }

    let nomeLimpo = nomeOriginal;
    const patternsToRemove = [
        /\s*\[\d+[xm]\]\s*$/i,
        /\s*\d+[xm]\s*$/i,
        /\s*\[\d+[xm]\]/i,
        /\s*\d+[xm]/i
    ];
    
    for (const pattern of patternsToRemove) {
        nomeLimpo = nomeLimpo.replace(pattern, '').trim();
    }

    const ultimoPonto = nomeLimpo.lastIndexOf('.');
    if (ultimoPonto === -1) {
        return `${nomeLimpo} [${quantidade}x]`;
    }

    const nome = nomeLimpo.substring(0, ultimoPonto);
    const extensao = nomeLimpo.substring(ultimoPonto);
    return `${nome} [${quantidade}x]${extensao}`;
};

export const estimarDimensoesPorTamanho = (tamanhoBytes: number) => {
    const sizeMB = tamanhoBytes / (1024 * 1024);
    if (sizeMB > 200) return { larguraCm: 118.9, alturaCm: 84.1 };
    if (sizeMB > 100) return { larguraCm: 84.1, alturaCm: 59.4 };
    if (sizeMB > 50) return { larguraCm: 59.4, alturaCm: 42.0 };
    if (sizeMB > 20) return { larguraCm: 42.0, alturaCm: 29.7 };
    if (sizeMB > 5) return { larguraCm: 29.7, alturaCm: 21.0 };
    return { larguraCm: 21.0, alturaCm: 14.8 };
};

export const lerDimensoesTIF = (file: File): Promise<{ larguraCm: number; alturaCm: number }> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const arrayBuffer = e.target?.result as ArrayBuffer;
                if (!arrayBuffer) {
                    resolve(estimarDimensoesPorTamanho(file.size));
                    return;
                }
                const dataView = new DataView(arrayBuffer);
                const isLittleEndian = dataView.getUint16(0, false) === 0x4949; // 'II'
                
                const ifdOffset = dataView.getUint32(4, isLittleEndian);
                if (ifdOffset + 2 > arrayBuffer.byteLength) {
                    resolve(estimarDimensoesPorTamanho(file.size));
                    return;
                }

                const numEntries = dataView.getUint16(ifdOffset, isLittleEndian);
                let width = 0, height = 0;
                let xResolution = 300, yResolution = 300;
                let resolutionUnit = 2; // inches

                for (let i = 0; i < numEntries; i++) {
                    const entryOffset = ifdOffset + 2 + (i * 12);
                    if (entryOffset + 12 > arrayBuffer.byteLength) break;

                    const tag = dataView.getUint16(entryOffset, isLittleEndian);
                    const type = dataView.getUint16(entryOffset + 2, isLittleEndian);
                    const count = dataView.getUint32(entryOffset + 4, isLittleEndian);
                    const valueOffset = dataView.getUint32(entryOffset + 8, isLittleEndian);

                    const readValue = (offset: number, size: number, isSigned = false) => {
                        if (offset + size > arrayBuffer.byteLength) return 0;
                        switch (size) {
                            case 1: return dataView.getUint8(offset);
                            case 2: return dataView.getUint16(offset, isLittleEndian);
                            case 4: return isSigned ? dataView.getInt32(offset, isLittleEndian) : dataView.getUint32(offset, isLittleEndian);
                            default: return 0;
                        }
                    };

                    switch (tag) {
                        case 0x0100: // ImageWidth
                            width = count === 1 ? (type === 3 ? dataView.getUint16(entryOffset + 8, isLittleEndian) : valueOffset) : readValue(valueOffset, type === 3 ? 2 : 4);
                            break;
                        case 0x0101: // ImageLength (Height)
                            height = count === 1 ? (type === 3 ? dataView.getUint16(entryOffset + 8, isLittleEndian) : valueOffset) : readValue(valueOffset, type === 3 ? 2 : 4);
                            break;
                        case 0x011A: // XResolution
                            if (type === 5 && valueOffset + 8 <= arrayBuffer.byteLength) {
                                const numerator = dataView.getUint32(valueOffset, isLittleEndian);
                                const denominator = dataView.getUint32(valueOffset + 4, isLittleEndian);
                                if (denominator !== 0) xResolution = numerator / denominator;
                            }
                            break;
                        case 0x011B: // YResolution
                            if (type === 5 && valueOffset + 8 <= arrayBuffer.byteLength) {
                                const numerator = dataView.getUint32(valueOffset, isLittleEndian);
                                const denominator = dataView.getUint32(valueOffset + 4, isLittleEndian);
                                if (denominator !== 0) yResolution = numerator / denominator;
                            }
                            break;
                        case 0x0128: // ResolutionUnit
                            if (type === 3) resolutionUnit = count === 1 ? dataView.getUint16(entryOffset + 8, isLittleEndian) : readValue(valueOffset, 2);
                            break;
                    }
                }

                if (width > 0 && height > 0) {
                    let larguraCm, alturaCm;
                    if (resolutionUnit === 3) { // cm
                        larguraCm = width / xResolution;
                        alturaCm = height / yResolution;
                    } else { // inches
                        larguraCm = (width / xResolution) * 2.54;
                        alturaCm = (height / yResolution) * 2.54;
                    }
                    larguraCm = Math.round(larguraCm * 100) / 100;
                    alturaCm = Math.round(alturaCm * 100) / 100;
                    
                    if (larguraCm > 0.1 && alturaCm > 0.1) {
                        resolve({ larguraCm, alturaCm });
                        return;
                    }
                }
                resolve(estimarDimensoesPorTamanho(file.size));
            } catch (e) {
                resolve(estimarDimensoesPorTamanho(file.size));
            }
        };
        reader.onerror = () => resolve(estimarDimensoesPorTamanho(file.size));
        reader.readAsArrayBuffer(file.slice(0, 65536)); // Read first 64KB
    });
};
