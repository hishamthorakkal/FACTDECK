/* Systems + a few starter facts per system.
 * Each system's real deck is uploaded later as a .docx from inside that system.
 * Starter facts: verify every value against your own source. */
window.FACTDECK_SYSTEMS = [
  { id: 'neonatology',  name: 'Neonatology',                                  icon: '👶', color: '#f0627e' },
  { id: 'growth',       name: 'Growth / Development / Nutrition / Genetics-IEM', icon: '🌱', color: '#2fbf85' },
  { id: 'cardiology',   name: 'Cardiology',                                   icon: '❤️', color: '#e5484d' },
  { id: 'neurology',    name: 'Neurology',                                    icon: '🧠', color: '#8a5cf6' },
  { id: 'nephrology',   name: 'Nephrology',                                   icon: '💧', color: '#12a594' },
  { id: 'gi',           name: 'GI / Hepatology',                              icon: '🍽️', color: '#f07f2a' },
  { id: 'hemonc',       name: 'Hematology / Oncology',                        icon: '🩸', color: '#c53030' },
  { id: 'endocrine',    name: 'Endocrinology',                                icon: '🦋', color: '#d49b00' },
  { id: 'immuno',       name: 'Immunology / Rheumatology / ID / Immunization', icon: '💉', color: '#2563eb' },
  { id: 'respiratory',  name: 'Respiratory + mapped edge topics',             icon: '🫁', color: '#2b8fe0' },
  { id: 'picu',         name: 'PICU / Emergencies',                           icon: '🚑', color: '#1e2a5a' },
];

// sections → { heading, lines[] }; `system` says where each section belongs. `status` only seeds a demo state.
window.FACTDECK_SEED = {
  sections: [
    {
      system: 'neonatology', title: 'Must-Know Numbers',
      cards: [
        { heading: '1) GIR', status: 'green', lines: [
          '• GIR = glucose (mg/mL) × rate (mL/h) ÷ weight (kg) ÷ 60',
          '• Memory cue: concentration → hourly glucose → per kg → per minute',
          '↩ Day 10 > Neonatal hypoglycemia'] },
        { heading: '2) EXCHANGE TRANSFUSION', status: 'red', lines: [
          '• Double-volume exchange = 2 × estimated blood volume',
          '• Term neonate blood volume often approximated as 85 mL/kg (≈ 160–170 mL/kg total)',
          '• Trap: do not stop at the single blood-volume value.',
          '↩ Day 6 > Jaundice'] },
        { heading: 'When is phototherapy escalated?', lines: [
          '• Escalation of care when TSB is within 2 mg/dL of the exchange-transfusion threshold (AAP 2022)',
          '• Exchange transfusion if TSB ≥ exchange threshold despite intensive phototherapy, or signs of acute bilirubin encephalopathy',
          '• Decisive clue: thresholds are hour-specific and shift lower with neurotoxicity risk factors',
          '↩ Day 6 > Jaundice'] },
        { heading: 'NRP epinephrine IV dose?', status: 'red', lines: [
          '• IV/UVC: 0.02 mg/kg (range 0.01–0.03 mg/kg) of 0.1 mg/mL',
          '• ET: 0.1 mg/kg (range 0.05–0.1 mg/kg), only while IV access is obtained',
          '• Trigger: HR < 60/min despite 30 s of effective PPV + chest compressions',
          '• Trap: do not use the 1 mg/mL strength',
          '↩ Day 4 > Neonatal resuscitation'] },
      ],
    },
    {
      system: 'cardiology', title: 'Emergencies',
      cards: [
        { heading: 'TOF spell immediate sequence?', lines: [
          '• 1. Calm the child; knee-chest position',
          '• 2. Oxygen',
          '• 3. Morphine 0.1–0.2 mg/kg (SC/IM/IV)',
          '• 4. IV fluid bolus; correct acidosis with sodium bicarbonate',
          '• 5. Refractory: phenylephrine (↑ SVR) ± IV propranolol/esmolol',
          '• Trap: avoid inotropes (worsen infundibular spasm)',
          '↩ Day 8 > Cyanotic CHD'] },
      ],
    },
    {
      system: 'neurology', title: 'Neuro Emergencies',
      cards: [
        { heading: 'Status epilepticus second-line options?', lines: [
          '• Levetiracetam 40–60 mg/kg IV (max 4.5 g)',
          '• Fosphenytoin 20 mg PE/kg IV (max 1.5 g PE)',
          '• Valproate 40 mg/kg IV (max 3 g); avoid if mitochondrial / liver disease suspected',
          '• Phenobarbital 20 mg/kg IV',
          '• Decisive clue: second-line starts after 2 benzodiazepine doses (~20 min)',
          '↩ Day 11 > Neuro emergencies'] },
      ],
    },
    {
      system: 'nephrology', title: 'Nephrotic Syndrome',
      cards: [
        { heading: 'Nephrotic syndrome steroid-sensitive definition?', lines: [
          '• Complete remission within 4 weeks of daily prednisolone (60 mg/m²/day)',
          '• Remission: urine protein nil/trace (or UPCR < 0.2 g/g) on 3 consecutive days',
          '• Close distractor: steroid resistance = no remission after 4 weeks (ISPN allows a 2-week confirmation period)',
          '↩ Day 14 > Nephrology'] },
      ],
    },
    {
      system: 'endocrine', title: 'DKA',
      cards: [
        { heading: 'DKA cerebral edema warning signs?', status: 'red', lines: [
          '• Headache, recurrent vomiting, age-inappropriate incontinence',
          '• Falling GCS / irritability / lethargy',
          '• Cushing pattern: bradycardia + rising BP; irregular breathing',
          '• Treat at once: mannitol 0.5–1 g/kg or hypertonic 3% saline 2.5–5 mL/kg; head up; reduce fluid rate',
          '• Trap: do not wait for CT before treating',
          '↩ Day 12 > Endocrine emergencies'] },
        { heading: 'ABG COMPENSATION', lines: [
          '• Winter formula: expected PaCO₂ = 1.5 × HCO₃ + 8 ± 2',
          '• Use for metabolic acidosis.',
          '• Trap: do not use it for primary respiratory disorders.',
          '↩ Day 5 > ABG'] },
      ],
    },
    {
      system: 'immuno', title: 'Vasculitis',
      cards: [
        { heading: 'Kawasaki IVIG timing?', status: 'green', lines: [
          '• Give IVIG 2 g/kg single infusion within 10 days of fever onset — ideally by day 7',
          '• After day 10: still give if fever persists or inflammatory markers stay raised',
          '• Plus aspirin',
          '↩ Day 9 > Vasculitis'] },
      ],
    },
    {
      system: 'respiratory', title: 'Ventilation',
      cards: [
        { heading: 'FORMULA CARD', status: 'red', lines: [
          '• Oxygenation Index',
          '• OI = FiO₂ × MAP × 100 ÷ PaO₂',
          '• Trap: use arterial PaO₂, not SpO₂.',
          '↩ Day 5 > Ventilation > Must-Know Numbers'] },
        { heading: 'CLOSE DISTRACTOR', lines: [
          '• PaO₂ vs SpO₂',
          '• Tempting: pulse-ox value',
          '• Decisive clue: OI requires arterial PaO₂.',
          '↩ Day 5 > Q-series / Explanation'] },
      ],
    },
    {
      system: 'picu', title: 'Approach',
      cards: [
        { heading: 'MICRO-ALGORITHM', lines: [
          '• 1. Recognize the danger sign', '• 2. Stabilize first', '• 3. Identify the key discriminator / threshold',
          '• 4. Choose the next best step', '• 5. Escalate only when the trigger is met'] },
        { heading: 'A vs B — DECISIVE CLUE', lines: [
          '• Phototherapy vs exchange transfusion → threshold + severity/risk context',
          '• OI vs SpO₂ → arterial PaO₂ is the deciding data point',
          '• Initial test vs definitive test → ask what the stem wants now, not eventually'] },
      ],
    },
  ],
};
