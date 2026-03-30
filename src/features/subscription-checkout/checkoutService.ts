export type BillingType = 'PIX' | 'CREDIT_CARD'
export type PlanOption = { id: string; plan_key: string; name: string; amount: number }
export type CustomerData = { name: string; email: string; cpfCnpj: string; mobilePhone: string }
export type CreditCardData = { holderName: string; number: string; expiryDate: string; ccv: string; postalCode?: string; addressNumber?: string; addressComplement?: string }

export async function createCheckout(opts: {
  supabaseUrl: string
  supabaseAnonKey: string
  plan: PlanOption
  billingType: BillingType
  customer: CustomerData
  creditCard?: CreditCardData
  metadata?: any
}) {
  const userId = opts.metadata?.userId || 'GUEST'
  
  const body = {
    planId: opts.plan.id,
    userId: userId,
    customerData: {
      name: opts.customer.name,
      email: opts.customer.email,
      cpfCnpj: opts.customer.cpfCnpj,
      mobilePhone: opts.customer.mobilePhone
    },
    billingType: opts.billingType,
    remoteIp: "127.0.0.1", // Idealmente isso viria do browser, mas o backend que processa de fato
    creditCard: opts.billingType === 'CREDIT_CARD' && opts.creditCard ? {
      holderName: opts.creditCard.holderName,
      number: opts.creditCard.number.replace(/\s/g, ''),
      expiryMonth: opts.creditCard.expiryDate.split('/')[0],
      expiryYear: opts.creditCard.expiryDate.split('/')[1]?.length === 2 ? `20${opts.creditCard.expiryDate.split('/')[1]}` : opts.creditCard.expiryDate.split('/')[1],
      ccv: opts.creditCard.ccv
    } : undefined,
    creditCardHolderInfo: opts.billingType === 'CREDIT_CARD' && opts.customer ? {
      name: opts.customer.name,
      email: opts.customer.email,
      cpfCnpj: opts.customer.cpfCnpj,
      postalCode: '01001000', // Mock para aprovação simplificada
      addressNumber: '123',
      phone: opts.customer.mobilePhone,
      mobilePhone: opts.customer.mobilePhone
    } : undefined
  }
  
  const res = await fetch(`${opts.supabaseUrl}/functions/v1/asaas-checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.supabaseAnonKey}` // O asaas-checkout valida o JWT no Edge Function
    },
    body: JSON.stringify(body)
  })
  
  const json = await res.json().catch(() => ({ error: 'Erro de formatação na resposta do servidor.' }))
  if (!res.ok || json.error) {
    throw new Error(json.error || 'Erro ao comunicar com provedor de pagamentos.')
  }
  return json
}
