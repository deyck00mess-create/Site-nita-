// Estrutura da ficha de anamnese (massoterapia + estética)
// type: yn (sim/não + detalhe opcional), text, textarea, select, multi, scale
export const ANAMNESE = [
  {
    titulo: 'Queixa e objetivos',
    campos: [
      { id: 'queixa', label: 'Queixa principal / motivo da procura', type: 'textarea' },
      { id: 'objetivos', label: 'Objetivos do tratamento', type: 'multi', options: ['Relaxamento', 'Alívio de dor', 'Redução de medidas', 'Drenagem / retenção de líquido', 'Celulite', 'Flacidez', 'Estética facial', 'Pós-operatório', 'Estresse / ansiedade', 'Melhora do sono'] },
      { id: 'regioes_dor', label: 'Regiões com dor ou tensão', type: 'multi', options: ['Cabeça', 'Cervical / pescoço', 'Ombros', 'Costas (alta)', 'Lombar', 'Quadril', 'Braços / mãos', 'Pernas', 'Joelhos', 'Pés'] },
      { id: 'intensidade_dor', label: 'Intensidade da dor (0 a 10)', type: 'scale', min: 0, max: 10 },
      { id: 'pressao', label: 'Pressão preferida na massagem', type: 'select', options: ['Leve', 'Média', 'Forte'] }
    ]
  },
  {
    titulo: 'Histórico de saúde',
    alerta: true,
    campos: [
      { id: 'hipertensao', label: 'Hipertensão (pressão alta)', type: 'yn' },
      { id: 'hipotensao', label: 'Hipotensão (pressão baixa)', type: 'yn' },
      { id: 'diabetes', label: 'Diabetes', type: 'yn' },
      { id: 'cardiaco', label: 'Problema cardíaco', type: 'yn', detalhe: true },
      { id: 'marcapasso', label: 'Marcapasso ou implante metálico', type: 'yn' },
      { id: 'trombose', label: 'Trombose / varizes / problema circulatório', type: 'yn', detalhe: true },
      { id: 'cancer', label: 'Câncer (atual ou histórico)', type: 'yn', detalhe: true },
      { id: 'epilepsia', label: 'Epilepsia / convulsões', type: 'yn' },
      { id: 'renal', label: 'Problema renal', type: 'yn' },
      { id: 'tireoide', label: 'Problema de tireoide', type: 'yn' },
      { id: 'hernia', label: 'Hérnia de disco / problema de coluna', type: 'yn', detalhe: true },
      { id: 'fibromialgia', label: 'Fibromialgia', type: 'yn' },
      { id: 'osteoporose', label: 'Osteoporose', type: 'yn' },
      { id: 'labirintite', label: 'Labirintite / tontura', type: 'yn' },
      { id: 'pele_doenca', label: 'Doença de pele (psoríase, dermatite…)', type: 'yn', detalhe: true },
      { id: 'lesao', label: 'Lesão, fratura ou inflamação recente', type: 'yn', detalhe: true },
      { id: 'cirurgia', label: 'Cirurgia recente (últimos 12 meses)', type: 'yn', detalhe: true },
      { id: 'gestante', label: 'Gestante', type: 'yn', detalhe: true, placeholder: 'Quantas semanas?' },
      { id: 'amamentando', label: 'Amamentando', type: 'yn' }
    ]
  },
  {
    titulo: 'Medicamentos e alergias',
    alerta: true,
    campos: [
      { id: 'alergias', label: 'Alergias (cosméticos, óleos, medicamentos, alimentos)', type: 'yn', detalhe: true },
      { id: 'medicamentos', label: 'Usa medicamentos contínuos?', type: 'yn', detalhe: true, placeholder: 'Quais?' },
      { id: 'anticoagulante', label: 'Usa anticoagulante', type: 'yn' },
      { id: 'acidos', label: 'Usa ácidos / isotretinoína (Roacutan)', type: 'yn', detalhe: true },
      { id: 'anticoncepcional', label: 'Usa anticoncepcional / hormônios', type: 'yn' }
    ]
  },
  {
    titulo: 'Hábitos de vida',
    campos: [
      { id: 'fumante', label: 'Fumante', type: 'yn' },
      { id: 'alcool', label: 'Consome bebida alcoólica', type: 'select', options: ['Não', 'Socialmente', 'Frequentemente'] },
      { id: 'atividade_fisica', label: 'Atividade física', type: 'select', options: ['Sedentária', '1–2x por semana', '3x ou mais por semana'] },
      { id: 'agua', label: 'Água por dia', type: 'select', options: ['Menos de 1 litro', '1 a 2 litros', 'Mais de 2 litros'] },
      { id: 'sono', label: 'Qualidade do sono', type: 'select', options: ['Boa', 'Regular', 'Ruim'] },
      { id: 'intestino', label: 'Funcionamento intestinal', type: 'select', options: ['Regular', 'Preso', 'Solto'] },
      { id: 'alimentacao', label: 'Alimentação', type: 'select', options: ['Equilibrada', 'Regular', 'Desregrada'] },
      { id: 'estresse', label: 'Nível de estresse', type: 'select', options: ['Baixo', 'Médio', 'Alto'] },
      { id: 'ciclo', label: 'Ciclo menstrual', type: 'select', options: ['Regular', 'Irregular', 'Menopausa', 'Não se aplica'] }
    ]
  },
  {
    titulo: 'Avaliação estética',
    campos: [
      { id: 'tipo_pele', label: 'Tipo de pele', type: 'select', options: ['Normal', 'Seca', 'Oleosa', 'Mista', 'Sensível'] },
      { id: 'fototipo', label: 'Fototipo (Fitzpatrick)', type: 'select', options: ['I', 'II', 'III', 'IV', 'V', 'VI'] },
      { id: 'protetor', label: 'Usa protetor solar diariamente', type: 'yn' },
      { id: 'exposicao_sol', label: 'Exposição solar frequente', type: 'yn' },
      { id: 'tratamentos_anteriores', label: 'Tratamentos estéticos anteriores', type: 'textarea' },
      { id: 'skincare', label: 'Rotina de cuidados em casa', type: 'textarea' },
      { id: 'medidas', label: 'Medidas / peso / observações corporais', type: 'textarea', placeholder: 'Ex.: Peso 68 kg · Cintura 78 cm · Abdômen 90 cm · Quadril 102 cm' }
    ]
  },
  {
    titulo: 'Observações do profissional',
    campos: [
      { id: 'obs', label: 'Observações / contraindicações identificadas', type: 'textarea' }
    ]
  }
];

export const TERMO = 'Declaro que as informações acima são verdadeiras e que não omiti nenhuma condição de saúde. Fui informada(o) sobre os procedimentos, seus benefícios e possíveis reações, e me comprometo a comunicar qualquer alteração no meu estado de saúde. Autorizo a realização dos procedimentos.';

// Lista de alertas ("sim" em itens de saúde) para destacar na ficha da cliente
export function alertasAnamnese(dados = {}) {
  const out = [];
  for (const s of ANAMNESE) {
    if (!s.alerta) continue;
    for (const c of s.campos) {
      if (c.type === 'yn' && dados[c.id] === 'sim') {
        const det = dados[c.id + '_det'];
        out.push(det ? `${c.label}: ${det}` : c.label);
      }
    }
  }
  return out;
}
