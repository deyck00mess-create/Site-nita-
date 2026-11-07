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
self.APP_VERSION = '1.1.1';

self.APP_CHANGELOG = [
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
