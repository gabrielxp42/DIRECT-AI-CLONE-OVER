# DATABASE_RPCS.md - Documentação de RPCs no Supabase

Este documento contém a lista de funções (Remote Procedure Calls) disponíveis no banco de dados público do projeto, seus parâmetros e descrições.

> [!IMPORTANT]
> **NÃO ALTERAR** os parâmetros das RPCs existentes. O projeto deve ser adaptado para utilizar estas funções conforme definidas.

## Resumo das RPCs

| Função | Parâmetros | Descrição |
| :--- | :--- | :--- |
| `count_active_conversations` | `p_user_id uuid` | Conta conversões ativas para um usuário. |
| `update_conversation_timestamp` | (Nenhum) | Atualiza o timestamp da conversa. |
| `update_v3_updated_at` | (Nenhum) | Trigger para atualizar `updated_at` na v3. |
| `ingest_telemetry_batch` | `events jsonb[]` | Ingestão em lote de eventos de telemetria. |
| `check_license_access` | `check_app_id text` | Verifica se o usuário tem acesso a uma licença de software específica. |
| `get_admin_users_stats` | (Nenhum) | Retorna estatísticas globais de usuários para administração. |
| `set_chat_session_last_message` | (Nenhum) | (Trigger/Internal) Define a última mensagem da sessão de chat. |
| `delete_chat_session` | `sid uuid` | Remove uma sessão de chat pelo ID. |
| `apply_topup_and_referral_bonus_v2` | `p_metadata jsonb, p_payment_id text, p_reais_amount numeric, p_tokens integer, p_user_uid uuid` | Aplica recarga e bônus de indicação (versão 2). |
| `increment_daily_usage` | `p_user_id uuid, p_tokens integer (0), p_jobs integer (0), p_cost numeric (0)` | Incrementa o uso diário de tokens/jobs/custos de um usuário. |
| `get_relevant_memories` | `p_limit int (5), p_min_importance int (0), p_user_id uuid (auth.uid())` | Busca memórias relevantes baseado em importância e limites. |
| `get_telemetry_dashboard` | `period_days integer (7)` | Dados agregados para o dashboard de telemetria. |
| `get_business_dashboard_v3` | `period_days integer (30)` | Dashboard de negócios (Versão 3). |
| `credit_user_tokens` | `p_user_uid uuid, p_amount numeric, p_reason text, p_metadata jsonb ({})` | Adiciona tokens ao saldo de um usuário. |
| `check_and_register_payment` | `p_payment_id text, p_user_uid uuid, p_token_amount integer, p_reais_amount numeric, p_purchase_id text, p_metadata jsonb` | Verifica e registra um novo pagamento. |
| `get_user_detailed_activity` | `target_user_uid uuid` | Retorna atividade detalhada de um usuário específico. |
| `ensure_referral_code` | (Nenhum) | Garante que o usuário possua um código de indicação. |
| `identify_user_attribution` | `p_utm_source, p_utm_campaign, p_utm_medium, p_utm_content, p_utm_term, p_referrer, p_landing_page` | Registra metadados de atribuição de marketing. |
| `activate_user_plan` | `p_user_uid uuid, p_plan_key text, p_payment_id text, p_amount numeric, p_metadata jsonb` | Ativa um plano para o usuário após pagamento. |
| `sync_app_events` | `events jsonb` | Sincroniza eventos vindos da aplicação. |
| `apply_referral_code` | `p_code text` | Aplica um código de indicação ao usuário atual. |
| `update_insumo_quantity_atomic` | `p_insumo_id uuid, p_quantity_change numeric, p_observacao text` | Altera a quantidade de um insumo de forma atômica. |
| `debit_user_tokens` | `p_user_uid uuid, p_amount integer, p_reason text, p_metadata jsonb ({})` | Deduz tokens do saldo de um usuário. |
| `get_user_by_email` | `p_email text` | Busca informações básicas de um usuário pelo e-mail. |
| `get_launcher_downloads_report` | `page_size, page_number, start_date, end_date` | Relatório de downloads do launcher. |
| `is_admin` | `user_id uuid (auth.uid())` | Retorna booleano se o usuário é administrador. |
| `tokens_transfer_atomic_ledger` | `p_user_uid, p_amount, p_transaction_type, p_reason, p_metadata` | Movimentação atômica no livro-razão de tokens. |
| `get_sales_summary` | `start_date, end_date, app_filter` | Sumário de vendas por período e filtro opcional. |
| `admin_create_manual_license` | `target_user_id, target_software_id, target_plan_key, duration_value, duration_unit, admin_notes` | Criação manual de licença por admin. |
| `get_user_activity_timeline` | `target_user_uid, limit_count (50)` | Timeline de atividades de um usuário. |
| `get_sales_report` | `page_size, page_number, filter_type, start_date, end_date, app_filter` | Relatório detalhado de vendas. |
| `handle_new_user` | (Nenhum) | Lógica executada na criação de um novo usuário (trigger). |
| `process_webhook_payment` | `p_user_uid, p_tokens, p_payment_id, p_reais_amount, p_metadata` | Processamento via Webhook de novo pagamento. |
| `purchase_license_with_tokens` | `p_plan_key, p_token_cost, p_idempotency_key, p_metadata` | Compra de licença usando saldo de tokens. |
| `trigger_process_notifications` | (Nenhum) | Dispara o processamento de notificações pendentes. |

---

## Recomendações de Integração

Baseado na análise do código atual, aqui estão as oportunidades de otimização:

1.  **Dashboard (`Index.tsx` / `useDashboardData.ts`):** 
    - Substituir as múltiplas chamadas de `doCount` e `doFetch` em JS pela RPC `get_business_dashboard_v3`. Isso reduzirá drasticamente o tráfego de rede e o tempo de processamento no navegador.
2.  **Relatórios (`Reports.tsx` / `reportUtils.ts`):** 
    - A função `fetchReportData` realiza joins pesados e paginação manual. Utilizar `get_sales_report` ou `get_sales_summary` conforme o período selecionado para obter dados pré-agregados.
3.  **IA Assistant (`aiTools.ts`):** 
    - Garantir que `get_top_clients` e `get_total_meters_by_period` em `aiTools.ts` estejam enviando os parâmetros exatamente como definidos acima.
4.  **Consistência de Perfis:**
    - Foi detectado uso de `profiles` em alguns arquivos e `profiles_v2` em outros. Recomenda-se unificar para `profiles_v2` conforme padrão do novo banco.

---

*Nota: Esta lista foca em funções de negócio. Funções de extensões como `pg_trgm` e `unaccent` foram omitidas deste documento para clareza.*
