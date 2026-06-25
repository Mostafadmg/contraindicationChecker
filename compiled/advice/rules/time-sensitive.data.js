/**
 * Time-sensitive medication rules (GLP-1).
 * Condition rules (e.g. cholecystectomy) live in time-sensitive-conditions.data.js
 *
 * @module advice/rules/time-sensitive
 */
window.EDM_ADVICE_RULES = window.EDM_ADVICE_RULES || {};

window.EDM_ADVICE_RULES.timeSensitive = [
  {
    id: 'TS-DIABETIC',
    type: 'time-sensitive-med',
    tab: 'time-sensitive',
    tabLabel: 'Time-sensitive conditions',
    title: 'Diabetic Medications',
    icon: '💊',
    action: 'REJECT',
    actionSubLabel: 'if EITHER condition applies',
    rejectConditions: [
      'Prescribed within last 3 months as acute',
      'OR present on repeat medication list',
    ],
    monthsThreshold: 3,
    rationale:
      'Concurrent diabetic medications cause unsafe hypoglycaemia risk with GLP-1s.',
    safeIfLabel: 'Safe to Prescribe: If prescribed ≥3 months ago as acute (not on repeat list)',
    medexpressRuleIds: ['R003', 'R006'],
    groups: [
      {
        id: 'oral-diabetic',
        title: 'ORAL DIABETIC MEDICATIONS:',
        subgroups: [
          {
            title: 'Sulfonylureas:',
            items: [
              { label: 'Diamicron (gliclazide)', keywords: ['gliclazide', 'diamicron'] },
              { label: 'Daonil (glibenclamide)', keywords: ['glibenclamide', 'daonil'] },
              { label: 'Rastin (tolbutamide)', keywords: ['tolbutamide', 'rastin'] },
            ],
          },
          {
            title: 'DPP-4 inhibitors:',
            items: [
              { label: 'Januvia (sitagliptin)', keywords: ['sitagliptin', 'januvia'] },
              { label: 'Galvus (vildagliptin)', keywords: ['vildagliptin', 'galvus'] },
              { label: 'Trajenta (linagliptin)', keywords: ['linagliptin', 'trajent', 'trajenta'] },
            ],
          },
          {
            title: 'SGLT2 inhibitors:',
            items: [
              { label: 'Jardiance (empagliflozin)', keywords: ['empagliflozin', 'jardiance'] },
              { label: 'Forxiga (dapagliflozin)', keywords: ['dapagliflozin', 'forxiga'] },
              { label: 'Invokana (canagliflozin)', keywords: ['canagliflozin', 'invokana'] },
            ],
          },
          {
            title: 'Thiazolidinediones:',
            items: [
              { label: 'Actos (pioglitazone)', keywords: ['pioglitazone', 'actos'] },
            ],
          },
        ],
      },
      {
        id: 'insulin',
        title: 'INSULIN:',
        items: [
          {
            label: 'Any insulin on repeat medication list',
            keywords: [
              'insulin', 'novorapid', 'humalog', 'actrapid', 'humulin', 'insulatard',
              'lantus', 'abasaglar', 'levemir', 'tresiba', 'novomix', 'aspart', 'lispro',
              'isophane', 'glargine', 'detemir', 'degludec', 'kwikpen', 'flexpen',
              'solostar', 'novopen', 'toujeo', 'fiasp', 'lyumjev',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'TS-NTI',
    type: 'time-sensitive-med',
    tab: 'time-sensitive',
    tabLabel: 'Time-sensitive conditions',
    title: 'NTI Medications',
    icon: '⚠️',
    action: 'REJECT',
    actionSubLabel: 'if EITHER condition applies',
    rejectConditions: [
      'Prescribed within last 3 months as acute',
      'OR present on repeat medication list',
    ],
    monthsThreshold: 3,
    rationale:
      'GLP-1s delay gastric emptying, which can affect absorption and blood levels of these medications.',
    safeIfLabel: 'Safe to Prescribe: If prescribed ≥3 months ago as acute (not on repeat list)',
    medexpressRuleIds: ['R006'],
    groups: [
      {
        id: 'nti-list',
        title: 'NTI MEDICATIONS LIST:',
        items: [
          { label: 'Amiodarone', keywords: ['amiodarone'] },
          { label: 'Oral methotrexate', keywords: ['methotrexate'] },
          { label: 'Carbamazepine', keywords: ['carbamazepine', 'tegretol', 'carbagen'] },
          { label: 'Phenobarbital', keywords: ['phenobarbital'] },
          { label: 'Ciclosporin', keywords: ['ciclosporin', 'neoral', 'capimune', 'capsorin', 'deximune', 'vanquoral'] },
          { label: 'Phenytoin', keywords: ['phenytoin', 'dilantin', 'epanutin'] },
          { label: 'Clozapine', keywords: ['clozapine', 'clozaril', 'denzapine', 'zaponex'] },
          { label: 'Somatrogon', keywords: ['somatrogon'] },
          { label: 'Digoxin', keywords: ['digoxin'] },
          { label: 'Tacrolimus', keywords: ['tacrolimus', 'prograf', 'advagraf', 'envarsus', 'adoport', 'dailiport', 'modigraf'] },
          { label: 'Fenfluramine', keywords: ['fenfluramine'] },
          { label: 'Theophylline', keywords: ['theophylline', 'uniphyllin'] },
          { label: 'Lithium', keywords: ['lithium', 'priadel', 'camcolit', 'liskonum', 'li-liquid'] },
          { label: 'Warfarin', keywords: ['warfarin', 'acenocoumarol'] },
          { label: 'Mycophenolate mofetil', keywords: ['mycophenolate', 'cellcept', 'myfenax', 'cetava', 'myfortic'] },
        ],
      },
    ],
  },
  {
    id: 'TS-ORLISTAT',
    type: 'time-sensitive-med',
    tab: 'time-sensitive',
    tabLabel: 'Time-sensitive conditions',
    title: 'Orlistat',
    icon: '🟠',
    action: 'REJECT',
    actionSubLabel: 'if EITHER condition applies',
    rejectConditions: [
      'Prescribed within last 3 months as acute',
      'OR present on repeat medication list',
    ],
    monthsThreshold: 3,
    rationale:
      'Orlistat affects fat absorption and may interfere with GLP-1 efficacy. Must be stopped before starting treatment.',
    safeIfLabel: 'Safe to Prescribe: If prescribed ≥3 months ago as acute (not on repeat list)',
    medexpressRuleIds: ['R006'],
    matchKeywords: ['orlistat', 'xenical', 'alli'],
    groups: [],
  },
];
