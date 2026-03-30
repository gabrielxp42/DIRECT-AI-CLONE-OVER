import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { CreditCard, QrCode, Loader2 } from 'lucide-react'
import { createCheckout, BillingType, PlanOption, CustomerData, CreditCardData } from './checkoutService'

type Props = {
  supabaseUrl: string
  supabaseAnonKey: string
  plans: PlanOption[]
  defaultPlanId?: string
  defaultBilling?: BillingType
}

const SubscriptionCheckoutStandalone: React.FC<Props> = ({ supabaseUrl, supabaseAnonKey, plans, defaultPlanId, defaultBilling = 'PIX' }) => {
  const [selectedPlanId, setSelectedPlanId] = useState<string>(defaultPlanId || (plans[0]?.id || ''))
  const [billingType, setBillingType] = useState<BillingType>(defaultBilling)
  const [customer, setCustomer] = useState<CustomerData>({ name: '', email: '', cpfCnpj: '', mobilePhone: '' })
  const [card, setCard] = useState<CreditCardData>({ holderName: '', number: '', expiryDate: '', ccv: '' })
  const [loading, setLoading] = useState(false)
  const [pixData, setPixData] = useState<{ encodedImage: string; payload: string; expirationDate: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
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
        creditCard: billingType === 'CREDIT_CARD' ? card : undefined
      })
      if (billingType === 'PIX' && result.pixQrCode) {
        setPixData(result.pixQrCode)
      }
    } catch (e: any) {
      setError(e?.message || 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto bg-[#0A0A0A] text-white border border-white/10 rounded-xl p-6">
      <div className="mb-4">
        <div className="text-sm text-gray-400">Plano</div>
        <select value={selectedPlanId} onChange={(e) => setSelectedPlanId(e.target.value)} className="mt-1 w-full bg-black border border-white/10 rounded-lg px-3 py-2">
          {plans.map(p => (
            <option key={p.id} value={p.id}>{p.name} • R$ {Number(p.amount).toFixed(2)}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <button
          onClick={() => setBillingType('PIX')}
          className={`flex items-center gap-2 px-4 py-3 rounded-lg border ${billingType === 'PIX' ? 'border-cyan-400 bg-cyan-500/10' : 'border-white/10'}`}
        >
          <QrCode className="text-cyan-400" />
          PIX
        </button>
        <button
          onClick={() => setBillingType('CREDIT_CARD')}
          className={`flex items-center gap-2 px-4 py-3 rounded-lg border ${billingType === 'CREDIT_CARD' ? 'border-yellow-400 bg-yellow-500/10' : 'border-white/10'}`}
        >
          <CreditCard className="text-yellow-400" />
          Cartão
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <input value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} placeholder="Nome completo" className="bg-black border border-white/10 rounded-lg px-3 py-2" />
        <input value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} placeholder="Email" className="bg-black border border-white/10 rounded-lg px-3 py-2" />
        <input value={customer.cpfCnpj} onChange={(e) => setCustomer({ ...customer, cpfCnpj: e.target.value })} placeholder="CPF/CNPJ" className="bg-black border border-white/10 rounded-lg px-3 py-2" />
        <input value={customer.mobilePhone} onChange={(e) => setCustomer({ ...customer, mobilePhone: e.target.value })} placeholder="Celular" className="bg-black border border-white/10 rounded-lg px-3 py-2" />
      </div>

      {billingType === 'CREDIT_CARD' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid md:grid-cols-2 gap-4 mb-6">
          <input value={card.holderName} onChange={(e) => setCard({ ...card, holderName: e.target.value })} placeholder="Nome no cartão" className="bg-black border border-white/10 rounded-lg px-3 py-2" />
          <input value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value })} placeholder="Número" className="bg-black border border-white/10 rounded-lg px-3 py-2" />
          <input value={card.expiryDate} onChange={(e) => setCard({ ...card, expiryDate: e.target.value })} placeholder="MM/YYYY" className="bg-black border border-white/10 rounded-lg px-3 py-2" />
          <input value={card.ccv} onChange={(e) => setCard({ ...card, ccv: e.target.value })} placeholder="CVV" className="bg-black border border-white/10 rounded-lg px-3 py-2" />
        </motion.div>
      )}

      {error && <div className="text-red-400 text-sm mb-3">{error}</div>}

      <button onClick={handleCheckout} disabled={loading} className="w-full px-4 py-3 bg-white text-black font-bold rounded-lg disabled:opacity-50">
        {loading ? <span className="inline-flex items-center gap-2"><Loader2 className="animate-spin" size={16} /> Processando</span> : `Assinar • R$ ${Number(plan?.amount || 0).toFixed(2)}`}
      </button>

      {pixData && (
        <div className="mt-6 p-4 border border-cyan-400/30 rounded-xl bg-cyan-500/5">
          <div className="text-sm text-gray-300 mb-3">Escaneie o QR Code para pagar</div>
          <img src={`data:image/png;base64,${pixData.encodedImage}`} alt="PIX" className="w-56 h-56 rounded-lg" />
          <div className="text-xs text-gray-400 mt-2">Expira: {new Date(pixData.expirationDate).toLocaleString('pt-BR')}</div>
        </div>
      )}
    </div>
  )
}

export default SubscriptionCheckoutStandalone
