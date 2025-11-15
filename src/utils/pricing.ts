/**
 * Calcula o preço unitário e total com base na quantidade de metros lineares (ML)
 * e na tabela de preços progressiva da DIRECT DTF.
 *
 * @param meters A quantidade de metros lineares.
 * @param customMeterValue O valor do metro personalizado do cliente (se existir).
 * @returns Um objeto contendo o preço total, preço unitário e uma explicação.
 */
export const calculatePriceByMeters = (meters: number, customMeterValue?: number | null) => {
  const basePrice = customMeterValue || 45.00; // Preço base padrão se não houver valor customizado
  
  let unitPrice = basePrice;
  let explanation = `Preço base: R$${basePrice.toFixed(2)}/ML`;

  // Se houver um valor customizado, ele é o preço unitário final
  if (customMeterValue && customMeterValue > 0) {
    unitPrice = customMeterValue;
    explanation = `Preço customizado do cliente: R$${unitPrice.toFixed(2)}/ML`;
  } else {
    // Lógica de precificação progressiva (apenas se não houver preço customizado)
    if (meters <= 1) {
      unitPrice = 70.00; 
      explanation = `1 metro: R$70,00/ML`;
    } else if (meters <= 3) {
      unitPrice = 70.00; 
      explanation = `2-3 metros: R$70,00/ML`;
    } else if (meters <= 6) {
      unitPrice = 65.00;
      explanation = `4-6 metros: R$65,00/ML`;
    } else if (meters <= 10) {
      unitPrice = 60.00;
      explanation = `7-10 metros: R$60,00/ML`;
    } else if (meters <= 20) {
      unitPrice = 55.00;
      explanation = `11-20 metros: R$55,00/ML`;
    } else if (meters <= 30) {
      unitPrice = 52.00;
      explanation = `21-30 metros: R$52,00/ML`;
    } else {
      unitPrice = 49.90;
      explanation = `30+ metros: R$49,90/ML`;
    }
  }
  
  const totalPrice = unitPrice * meters;
  
  return {
    totalPrice: parseFloat(totalPrice.toFixed(2)),
    unitPrice: parseFloat(unitPrice.toFixed(2)),
    explanation
  };
};