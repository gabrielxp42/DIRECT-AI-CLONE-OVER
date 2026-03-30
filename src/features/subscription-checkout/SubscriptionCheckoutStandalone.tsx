import React, { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CreditCard, QrCode, Loader2, CheckCircle2, ShieldCheck, Zap, ArrowRight, ArrowLeft } from 'lucide-react'
import { createCheckout, BillingType, PlanOption, CustomerData, CreditCardData } from './checkoutService'

type Props = {
  supabaseUrl: string
  supabaseAnonKey: string
  plans: PlanOption[]
  defaultPlanId?: string
  defaultBilling?: BillingType
  userId?: string
  initialCustomerData?: Partial<CustomerData>
}

const SubscriptionCheckoutStandalone: React.FC<Props> = ({ supabaseUrl, supabaseAnonKey, plans, defaultPlanId, defaultBilling = 'PIX', userId, initialCustomerData }) => {
  const [step, setStep] = useState<number>(1)
  const [selectedPlanId, setSelectedPlanId] = useState<string>(defaultPlanId || (plans[0]?.id || ''))
  const [billingType, setBillingType] = useState<BillingType>(defaultBilling)
  const [customer, setCustomer] = useState<CustomerData>({ 
    name: initialCustomerData?.name || '', 
    email: initialCustomerData?.email || '', 
    cpfCnpj: initialCustomerData?.cpfCnpj || '', 
    mobilePhone: initialCustomerData?.mobilePhone || '' 
  })
  const [card, setCard] = useState<CreditCardData>({ holderName: '', number: '', expiryDate: '', ccv: '' })
  const [loading, setLoading] = useState(false)
  const [pixData, setPixData] = useState<{ encodedImage: string; payload: string; expirationDate: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  // Atualiza plano default caso a prop plans demore a carregar
  useEffect(() => {
      if (!selectedPlanId && plans.length > 0) {
          setSelectedPlanId(plans[0].id)
      }
  }, [plans, selectedPlanId])

  const plan = useMemo(() => plans.find(p => p.id === selectedPlanId) || plans[0], [plans, selectedPlanId])

  useEffect(() => {
    setPixData(null)
    setError(null)
  }, [selectedPlanId, billingType])

  const handleCheckout = async () => {
    if (!plan) return
    setLoading(true)
    setError(null)
    try {
      const result = await createCheckout({
        supabaseUrl,
        supabaseAnonKey,
        plan,
        billingType,
        customer,
        creditCard: billingType === 'CREDIT_CARD' ? card : undefined,
        metadata: { userId }
      })
      if (billingType === 'PIX' && (result.pixQrCode || result.pix)) {
        setPixData(result.pixQrCode || result.pix)
      } else if (billingType === 'CREDIT_CARD' && result.success) {
        window.location.href = '/dashboard?success=true'
      }
    } catch (e: any) {
      setError(e?.message || 'Erro ao processar pagamento. Verifique os dados.')
    } finally {
      setLoading(false)
    }
  }

  const isCustomerDataValid = customer.name && customer.email && customer.cpfCnpj && customer.mobilePhone;
  const isPaymentDataValid = billingType === 'PIX' || (card.holderName && card.number && card.expiryDate && card.ccv);

  return (
    <div className="max-w-4xl mx-auto relative z-10 px-4">
      
      {/* Progresso do Wizard */}
      <div className="flex items-center justify-between mb-8 max-w-2xl mx-auto relative">
        <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-white/10 -z-10 -translate-y-1/2" />
        <div className="absolute top-1/2 left-0 h-[2px] bg-[#FFF200] -z-10 -translate-y-1/2 transition-all duration-500" style={{ width: `${((step - 1) / 2) * 100}%` }} />
        
        {[
          { num: 1, label: 'Plano' },
          { num: 2, label: 'Identificação' },
          { num: 3, label: 'Pagamento' }
        ].map((s) => (
          <div key={s.num} className="flex flex-col items-center gap-2">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black transition-all duration-300 ${
              step >= s.num ? 'bg-[#FFF200] text-black shadow-[0_0_15px_rgba(255,242,0,0.4)]' : 'bg-black border-2 border-white/20 text-gray-500'
            }`}>
              {step > s.num ? <CheckCircle2 className="w-6 h-6" /> : s.num}
            </div>
            <span className={`text-xs font-bold uppercase tracking-wider ${step >= s.num ? 'text-white' : 'text-gray-500'}`}>{s.label}</span>
          </div>
        ))}
      </div>

      <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-6 md:p-10 shadow-2xl overflow-hidden relative">
        <AnimatePresence mode="wait">
          
          {/* PASSO 1: Escolha do Plano */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-2xl md:text-3xl font-black uppercase italic tracking-tight mb-2">Escolha seu plano</h2>
                <p className="text-gray-400">Selecione a melhor opção para a sua empresa.</p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                {plans.map(p => (
                  <div 
                    key={p.id}
                    onClick={() => setSelectedPlanId(p.id)}
                    className={`relative p-6 rounded-2xl cursor-pointer border-2 transition-all duration-300 ${
                      selectedPlanId === p.id 
                        ? 'bg-[#FFF200]/10 border-[#FFF200] shadow-[0_0_20px_rgba(255,242,0,0.15)]' 
                        : 'bg-black/40 border-white/10 hover:border-white/30 hover:bg-white/10'
                    }`}
                  >
                    {selectedPlanId === p.id && (
                      <div className="absolute top-4 right-4">
                        <CheckCircle2 className="w-6 h-6 text-[#FFF200]" />
                      </div>
                    )}
                    <h3 className={`font-bold text-lg mb-2 ${selectedPlanId === p.id ? 'text-[#FFF200]' : 'text-white'}`}>{p.name}</h3>
                    <div className="text-3xl font-black mb-2">R$ {Number(p.amount).toFixed(2).replace('.', ',')}</div>
                    {p.name.toLowerCase().includes('anual') && (
                        <div className="inline-block px-3 py-1 bg-green-500/20 text-green-400 text-xs font-bold rounded-full uppercase tracking-wider">
                            Mais Vantajoso
                        </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-4">
                <button 
                  onClick={() => setStep(2)}
                  disabled={!selectedPlanId}
                  className="px-8 py-4 bg-white hover:bg-gray-200 text-black font-black text-lg uppercase italic tracking-wider rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  Continuar <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          )}

          {/* PASSO 2: Dados do Cliente */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-2xl md:text-3xl font-black uppercase italic tracking-tight mb-2">Seus Dados Seguros</h2>
                <p className="text-gray-400">Precisamos dessas informações para gerar seu acesso e nota fiscal.</p>
              </div>

              <div className="grid md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-400 ml-1">NOME COMPLETO</label>
                  <input value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} className="w-full bg-black/50 border border-white/10 focus:border-[#FFF200]/50 focus:ring-1 focus:ring-[#FFF200]/50 rounded-xl px-4 py-3.5 outline-none transition-all text-lg" placeholder="Como no documento" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-400 ml-1">E-MAIL</label>
                  <input value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} type="email" className="w-full bg-black/50 border border-white/10 focus:border-[#FFF200]/50 focus:ring-1 focus:ring-[#FFF200]/50 rounded-xl px-4 py-3.5 outline-none transition-all text-lg" placeholder="seu@email.com" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-400 ml-1">CPF OU CNPJ</label>
                  <input value={customer.cpfCnpj} onChange={(e) => setCustomer({ ...customer, cpfCnpj: e.target.value })} className="w-full bg-black/50 border border-white/10 focus:border-[#FFF200]/50 focus:ring-1 focus:ring-[#FFF200]/50 rounded-xl px-4 py-3.5 outline-none transition-all text-lg" placeholder="000.000.000-00" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-400 ml-1">WHATSAPP</label>
                  <input value={customer.mobilePhone} onChange={(e) => setCustomer({ ...customer, mobilePhone: e.target.value })} className="w-full bg-black/50 border border-white/10 focus:border-[#FFF200]/50 focus:ring-1 focus:ring-[#FFF200]/50 rounded-xl px-4 py-3.5 outline-none transition-all text-lg" placeholder="(11) 99999-9999" />
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <button 
                  onClick={() => setStep(1)}
                  className="px-6 py-4 bg-white/5 hover:bg-white/10 text-white font-bold text-lg rounded-xl transition-all flex items-center gap-2 border border-white/10"
                >
                  <ArrowLeft className="w-5 h-5" /> Voltar
                </button>
                <button 
                  onClick={() => setStep(3)}
                  disabled={!isCustomerDataValid}
                  className="px-8 py-4 bg-white hover:bg-gray-200 text-black font-black text-lg uppercase italic tracking-wider rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  Continuar <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          )}

          {/* PASSO 3: Pagamento */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="flex flex-col md:flex-row gap-8 items-start">
                
                {/* Formas de Pagamento */}
                <div className="flex-1 w-full space-y-6">
                  <div>
                    <h2 className="text-2xl md:text-3xl font-black uppercase italic tracking-tight mb-2">Pagamento</h2>
                    <p className="text-gray-400">Escolha a forma de pagamento segura via Asaas.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setBillingType('PIX')}
                      className={`flex flex-col items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all ${billingType === 'PIX' ? 'border-[#00B4D8] bg-[#00B4D8]/10' : 'border-white/10 hover:border-white/20 bg-black/40'}`}
                    >
                      <QrCode className={`w-8 h-8 ${billingType === 'PIX' ? 'text-[#00B4D8]' : 'text-gray-400'}`} />
                      <span className={`font-bold ${billingType === 'PIX' ? 'text-[#00B4D8]' : 'text-gray-400'}`}>PIX Instantâneo</span>
                    </button>
                    <button
                      onClick={() => setBillingType('CREDIT_CARD')}
                      className={`flex flex-col items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all ${billingType === 'CREDIT_CARD' ? 'border-white bg-white/10' : 'border-white/10 hover:border-white/20 bg-black/40'}`}
                    >
                      <CreditCard className={`w-8 h-8 ${billingType === 'CREDIT_CARD' ? 'text-white' : 'text-gray-400'}`} />
                      <span className={`font-bold ${billingType === 'CREDIT_CARD' ? 'text-white' : 'text-gray-400'}`}>Cartão de Crédito</span>
                    </button>
                  </div>

                  <AnimatePresence mode="wait">
                    {billingType === 'CREDIT_CARD' && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }} 
                        animate={{ opacity: 1, height: 'auto' }} 
                        exit={{ opacity: 0, height: 0 }}
                        className="grid md:grid-cols-2 gap-5 overflow-hidden pt-2"
                      >
                        <div className="space-y-2 md:col-span-2">
                          <label className="text-xs font-semibold text-gray-400 ml-1">NOME IMPRESSO NO CARTÃO</label>
                          <input value={card.holderName} onChange={(e) => setCard({ ...card, holderName: e.target.value })} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-white transition-all text-lg" placeholder="JOAO S SILVA" />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <label className="text-xs font-semibold text-gray-400 ml-1">NÚMERO DO CARTÃO</label>
                          <input value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value })} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-white transition-all text-lg" placeholder="0000 0000 0000 0000" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-gray-400 ml-1">VALIDADE</label>
                          <input value={card.expiryDate} onChange={(e) => setCard({ ...card, expiryDate: e.target.value })} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-white transition-all text-lg" placeholder="MM/AAAA" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-gray-400 ml-1">CVV</label>
                          <input value={card.ccv} onChange={(e) => setCard({ ...card, ccv: e.target.value })} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-white transition-all text-lg" placeholder="123" type="password" maxLength={4} />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl text-sm flex items-start gap-3">
                      <ShieldCheck className="w-5 h-5 flex-shrink-0" />
                      <p>{error}</p>
                    </div>
                  )}

                </div>

                {/* Card de Resumo (Lateral no Desktop, Embaixo no Mobile) */}
                <div className="w-full md:w-[350px] flex-shrink-0 bg-black/40 border border-white/10 rounded-3xl p-6">
                  <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-[#FFF200]" />
                    Resumo do Pedido
                  </h3>
                  
                  <div className="flex justify-between items-center mb-4 pb-4 border-b border-white/10">
                    <div className="text-gray-300 font-medium">{plan?.name}</div>
                    <div className="font-bold">R$ {Number(plan?.amount || 0).toFixed(2).replace('.', ',')}</div>
                  </div>

                  <div className="flex justify-between items-center text-xl mb-8">
                    <div className="font-black">Total</div>
                    <div className="font-black text-[#FFF200]">R$ {Number(plan?.amount || 0).toFixed(2).replace('.', ',')}</div>
                  </div>

                  {!pixData ? (
                    <button 
                      onClick={handleCheckout} 
                      disabled={loading || !isPaymentDataValid} 
                      className="w-full py-4 bg-[#FFF200] hover:bg-[#ffe600] text-black font-black text-lg uppercase italic tracking-wider rounded-xl transition-all shadow-[0_10px_30px_rgba(255,242,0,0.3)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <><Loader2 className="w-6 h-6 animate-spin" /> Processando...</>
                      ) : (
                        `Pagar R$ ${Number(plan?.amount || 0).toFixed(2).replace('.', ',')}`
                      )}
                    </button>
                  ) : (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center p-4 bg-white rounded-2xl">
                      <div className="text-black font-bold mb-3 text-center text-sm">Escaneie o QR Code no app do seu banco</div>
                      <img src={`data:image/png;base64,${pixData.encodedImage}`} alt="PIX" className="w-48 h-48 mb-3 rounded-xl border shadow-sm" />
                      <div className="w-full flex items-center gap-2 bg-gray-100 p-2 rounded-lg border">
                        <input readOnly value={pixData.payload} className="w-full bg-transparent text-xs text-black outline-none" />
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(pixData.payload);
                            alert("Código PIX copiado!");
                          }}
                          className="text-xs font-bold text-[#00B4D8] uppercase"
                        >
                          Copiar
                        </button>
                      </div>
                    </motion.div>
                  )}

                  <div className="flex items-center justify-center gap-2 mt-6 text-xs text-gray-500 font-medium">
                    <ShieldCheck className="w-4 h-4" />
                    Pagamento 100% seguro via Asaas
                  </div>
                </div>

              </div>

              <div className="flex pt-4">
                <button 
                  onClick={() => {
                    setStep(2)
                    setPixData(null) // Reseta o PIX se a pessoa voltar
                  }}
                  className="px-6 py-4 bg-white/5 hover:bg-white/10 text-white font-bold text-lg rounded-xl transition-all flex items-center gap-2 border border-white/10"
                >
                  <ArrowLeft className="w-5 h-5" /> Voltar para Identificação
                </button>
              </div>

            </motion.div>
          )}

        </AnimatePresence>
      </div>

    </div>
  )
}

export default SubscriptionCheckoutStandalone
