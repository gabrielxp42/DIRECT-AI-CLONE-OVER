
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = "http://localhost:54321"; // Local or production URL
const SUPABASE_SERVICE_ROLE_KEY = "your-service-role-key"; // Set this carefully

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function simulate() {
  console.log("--- SIMULAÇÃO DE RELAY ---");
  
  const testPhone = "5511999999999";
  const userId = "some-user-id"; // Need a valid ID for testing

  // 1. Simular Operador enviando mensagem via proxy
  console.log("1. Operador enviando pergunta: 'Qual o CEP para o frete?'");
  const { data: logSent, error: errSent } = await supabase.from('whatsapp_messages').insert({
    user_id: userId,
    phone: testPhone,
    message: "Qual o CEP para o frete?",
    direction: 'sent',
    status: 'delivered'
  }).select();
  
  if (errSent) console.error("Erro ao logar envio:", errSent);
  else console.log("✓ Mensagem do operador logada com sucesso.");

  // 2. Simular Cliente respondendo (Webhook -> Generator)
  console.log("2. Cliente respondendo: 'Meu CEP é 01001-000'");
  // Aqui simularíamos a chamada ao ai-response-generator diretamente
  // para ver se ele reconhece a mensagem anterior do operador.
  
  const { data: messages } = await supabase.from('whatsapp_messages')
    .select('*')
    .eq('phone', testPhone)
    .order('created_at', { ascending: false })
    .limit(5);

  console.log("Contexto encontrado no Banco:");
  messages?.forEach(m => console.log(`[${m.direction}] ${m.message}`));

  const hasOperatorMsg = messages?.some(m => m.direction === 'sent' && m.message.includes('CEP'));
  if (hasOperatorMsg) {
    console.log("✓ Gabi agora tem CONTEXTO para saber que o cliente está respondendo ao operador!");
  } else {
    console.log("✗ Contexto não encontrado.");
  }
}

// simulate();
