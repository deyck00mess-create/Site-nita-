/*
 * VERSÃO DO APP
 * ------------------------------------------------------------------
 * A cada atualização enviada ao GitHub:
 *   1. Aumente APP_VERSION (ex.: 1.1.0 → 1.1.1 para correções,
 *      1.1.0 → 1.2.0 para novas funções).
 *   2. Adicione um item NO TOPO de APP_CHANGELOG contando o que mudou.
 *
 * Só isso: o celular detecta a versão nova, avisa "Nova versão disponível"
 * e mostra as novidades depois de atualizar.
 * (Este arquivo também é lido pelo sw.js — não mude o formato.)
 */
self.APP_VERSION = '1.5.0';

self.APP_CHANGELOG = [
  {
    versao: '1.5.0',
    data: '2026-11-07',
    itens: [
      'Reforço de segurança: proteção contra códigos maliciosos em todo o app',
      'Assinaturas da anamnese validadas no app e no banco de dados',
      'Planilha exportada protegida contra fórmulas maliciosas',
      'App não pode ser aberto “escondido” dentro de outro site',
      'Senha mínima de 8 caracteres para novas contas'
    ]
  },
  {
    versao: '1.4.3',
    data: '2026-11-07',
    itens: ['Atualizações aparecem na hora: o app sempre confere se há arquivos novos ao abrir']
  },
  {
    versao: '1.4.2',
    data: '2026-11-07',
    itens: [
      'Lista de clientes: filtros com contadores, separação por letra e aviso de aniversário próximo',
      'Busca de clientes ignora acentos (ex.: "angela" encontra "Ângela")',
      'Ficha da cliente: ações rápidas com ícones e abas que cabem na tela',
      'Correção: ficha de anamnese nova aparece na hora, sem precisar sair da tela'
    ]
  },
  {
    versao: '1.4.1',
    data: '2026-11-07',
    itens: [
      'Financeiro mais prático: Resumo, Lançamentos e Comissões em uma única chave',
      'Cartões com os totais do mês (Recebido, Pago, A receber, A pagar) que também filtram a lista',
      'Aviso em destaque quando há lançamentos vencidos'
    ]
  },
  {
    versao: '1.4.0',
    data: '2026-11-07',
    itens: [
      'Recibo de pagamento em PDF, com valor por extenso, para enviar pelo WhatsApp',
      'Ficha de anamnese em PDF: baixar, imprimir ou enviar',
      'Backup dos dados: planilha Excel e cópia completa (Mais → Backup dos dados)',
      'Lembrete semanal de backup na tela inicial da administradora'
    ]
  },
  {
    versao: '1.3.2',
    data: '2026-11-07',
    itens: [
      'Listas grandes (mais de 1000 clientes ou lançamentos) carregam completas',
      'Pacotes: sessões canceladas não contam como usadas; pacotes vencidos não aparecem no agendamento',
      'Aviso claro quando não há serviços cadastrados',
      'Ícone do app disponível também sem internet'
    ]
  },
  {
    versao: '1.3.1',
    data: '2026-11-07',
    itens: [
      'Aviso na tela inicial da administradora quando alguém pede acesso',
      'Liberar ou recusar o pedido direto da tela inicial'
    ]
  },
  {
    versao: '1.3.0',
    data: '2026-11-07',
    itens: [
      'Níveis de acesso: Administradora (tudo) e Equipe (dia a dia)',
      'Equipe não vê financeiro, lucro, despesas nem totais',
      'Equipe registra recebimentos, mas não altera preços, descontos ou valores',
      'Configurações, serviços, preços e pacotes só para a administradora',
      'Só a administradora exclui clientes, agendamentos e lançamentos',
      'Transferir a administração em Mais → Equipe e acessos'
    ]
  },
  {
    versao: '1.2.0',
    data: '2026-11-07',
    itens: [
      'Barra de navegação (Início, Agenda, Clientes…) agora fica no topo',
      'Editar seu nome em Mais → toque no seu perfil',
      'Administradora pode corrigir o nome de quem é da equipe',
      'Lançamento de receita com campo de cliente (aparece no histórico dela)',
      'Ao concluir, o app detecta recebimento já lançado e não duplica o valor',
      'Atendimento só fica “concluído” depois que o pagamento é gravado'
    ]
  },
  {
    versao: '1.1.1',
    data: '2026-11-07',
    itens: ['Mensagem em português quando os cadastros estão desligados no Supabase']
  },
  {
    versao: '1.1.0',
    data: '2026-11-07',
    itens: [
      'Número da versão visível em Mais e no menu lateral',
      'Aviso automático quando há uma nova versão para instalar',
      'Tela de novidades depois de cada atualização',
      'Conexão com o banco de dados já configurada'
    ]
  },
  {
    versao: '1.0.0',
    data: '2026-11-06',
    itens: [
      'Agenda com avisos pelo WhatsApp',
      'Clientes, ficha de anamnese com assinatura e evolução',
      'Pacotes de sessões',
      'Financeiro completo com comissões',
      'Tema rosa & branco e tema escuro',
      'Instalação no celular'
    ]
  }
];
