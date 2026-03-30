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
  const body = {
    planId: opts.plan.id,
    planKey: opts.plan.plan_key,
    amount: Number(opts.plan.amount),
    billingType: opts.billingType,
    customer: opts.customer,
    creditCard: opts.creditCard,
    metadata: opts.metadata || {}
  }
  const res = await fetch(`${opts.supabaseUrl}/functions/v1/asaas-checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.supabaseAnonKey}`
    },
    body: JSON.stringify(body)
  })
  const json = await res.json()
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'checkout_error')
  }
  return json
}
