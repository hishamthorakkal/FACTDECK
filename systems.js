/* The 11 systems. `id` is also the folder name under content/:
 *   content/<id>/fact-deck.docx        → Fact Deck + Traps tabs
 *   content/<id>/rapid-revision.docx   → Rapid Revision tab
 * Missing files simply show "coming soon". */
window.FACTDECK_SYSTEMS = [
  { id: 'neonatology',               name: 'Neonatology',                                     icon: '👶', color: '#f0627e' },
  { id: 'growth-nutrition-genetics', name: 'Growth / Development / Nutrition / Genetics-IEM', icon: '🌱', color: '#2fbf85' },
  { id: 'cardiology',                name: 'Cardiology',                                      icon: '❤️', color: '#e5484d' },
  { id: 'neurology',                 name: 'Neurology',                                       icon: '🧠', color: '#8a5cf6' },
  { id: 'nephrology',                name: 'Nephrology',                                      icon: '💧', color: '#12a594' },
  { id: 'gi-hepatology',             name: 'GI / Hepatology',                                 icon: '🍽️', color: '#f07f2a' },
  { id: 'hematology-oncology',       name: 'Hematology / Oncology',                           icon: '🩸', color: '#c53030' },
  { id: 'endocrinology',             name: 'Endocrinology',                                   icon: '🦋', color: '#d49b00' },
  { id: 'immunology-id',             name: 'Immunology / Rheumatology / ID / Immunization',   icon: '💉', color: '#2563eb' },
  { id: 'respiratory',               name: 'Respiratory + mapped edge topics',                icon: '🫁', color: '#2b8fe0' },
  { id: 'picu-emergencies',          name: 'PICU / Emergencies',                              icon: '🚑', color: '#1e2a5a' },
];
