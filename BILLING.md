# Pagamentos e concessões de acesso

Os produtos Cakto são reconhecidos pelos IDs em `lib/billing.js`: mensal (1 mês), trimestral (3 meses) e anual (12 meses). Use o mesmo e-mail na conta BITTO e na compra. Produtos adicionais não alteram o plano.

O webhook `/api/webhooks/cakto` exige o segredo configurado no ambiente. Também valida HMAC e data quando enviados pela Cakto. Aprovação e renovação concedem acesso somente para pedidos pagos. Cada pedido concede um único período, mesmo quando a Cakto reenvia eventos. Renovações antecipadas acrescentam meses ao vencimento vigente. Cancelar renovação mantém o período comprado; reembolso e chargeback revogam o pedido correspondente e preservam concessões manuais e outros pedidos válidos.

No backstage, informe e-mail, plano e, opcionalmente, uma data final. Sem data, a validade é de 1, 3 ou 12 meses a partir da concessão. A opção de remover concessão gratuita preserva períodos pagos. Somente o administrador com e-mail verificado pode conceder acesso, pela API autenticada; cada alteração fica em `_adminPlanAudit`.

Compra ou concessão antes do cadastro fica em `_pendingAccess`. O usuário pode criar uma conta normalmente; ao confirmar seu e-mail e entrar novamente, o acesso é vinculado à conta. A concessão não cria contas sem senha.

O servidor verifica vencimento em todas as gerações. O plano gratuito permite 10 flashcards, 3 quizzes e 3 revisões por mês (fuso America/Sao_Paulo). A cota é reservada em transação; falhas de geração devolvem a reserva. As regras do Firestore impedem alteração de plano, pagamento ou cota pelo cliente, mantendo perfil, planner e materiais pessoais editáveis.

## Testes

Requisitos: Node.js 24 e Java 21 ou superior. Execute `npm ci` e `npm test`. A suíte usa somente os emuladores de Auth e Firestore no projeto `demo-bitto-billing`, sem credenciais nem compras reais. Não execute testes com credenciais de produção.

## Publicação

Publique o código na Vercel antes de aplicar `firestore.rules` no Firebase. Preserve as credenciais existentes no ambiente. Configure o webhook BITTO para os três produtos e inclua `purchase_approved`, `subscription_renewed`, `refund`, `chargeback`, `subscription_canceled` e os eventos de estado de assinatura. Não use os arquivos de `.env` no repositório.

Documentação: https://docs.cakto.com.br/conceitos/webhooks e https://firebase.google.com/docs/firestore/security/rules-fields
