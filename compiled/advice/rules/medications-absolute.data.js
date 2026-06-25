/**
 * Absolute contraindication — Medications (GLP-1).
 * Reject if found on repeat medication list.
 *
 * @module advice/rules/medications-absolute
 */
window.EDM_ADVICE_RULES = window.EDM_ADVICE_RULES || {};

window.EDM_ADVICE_RULES.medicationsAbsolute = {
  id: 'ABS-MEDICATIONS',
  type: 'medications-absolute',
  tab: 'absolute',
  tabLabel: 'Absolute contraindications',
  title: 'Medications',
  icon: '💊',
  action: 'REJECT',
  actionLabel: 'REJECT IF ON REPEAT MEDICATION LIST',
  rationale:
    'These medications have significant interactions or indicate conditions incompatible with GLP-1 treatment.',
  /** MedExpress keyword rule IDs that flag medication findings. */
  medexpressRuleIds: ['R003', 'R006'],
  groups: [
    {
      id: 'insulin',
      title: 'INSULIN',
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
    {
      id: 'sulfonylureas',
      title: 'ORAL DIABETIC — Sulfonylureas',
      items: [
        { label: 'Diamicron (gliclazide)', keywords: ['gliclazide', 'diamicron'] },
        { label: 'Daonil (glibenclamide)', keywords: ['glibenclamide', 'daonil'] },
        { label: 'Rastin (tolbutamide)', keywords: ['tolbutamide', 'rastin'] },
      ],
    },
    {
      id: 'dpp4',
      title: 'ORAL DIABETIC — DPP-4 inhibitors',
      items: [
        { label: 'Januvia (sitagliptin)', keywords: ['sitagliptin', 'januvia'] },
        { label: 'Galvus (vildagliptin)', keywords: ['vildagliptin', 'galvus'] },
        { label: 'Trajenta (linagliptin)', keywords: ['linagliptin', 'trajent', 'trajenta'] },
      ],
    },
    {
      id: 'sglt2',
      title: 'ORAL DIABETIC — SGLT2 inhibitors',
      items: [
        { label: 'Jardiance (empagliflozin)', keywords: ['empagliflozin', 'jardiance'] },
        { label: 'Forxiga (dapagliflozin)', keywords: ['dapagliflozin', 'forxiga'] },
        { label: 'Invokana (canagliflozin)', keywords: ['canagliflozin', 'invokana'] },
      ],
    },
    {
      id: 'tzd',
      title: 'ORAL DIABETIC — Thiazolidinediones',
      items: [
        { label: 'Actos (pioglitazone)', keywords: ['pioglitazone', 'actos'] },
      ],
    },
    {
      id: 'narrow-index',
      title: 'NARROW THERAPEUTIC INDEX',
      items: [
        { label: 'Amiodarone', keywords: ['amiodarone'] },
        { label: 'Carbamazepine', keywords: ['carbamazepine', 'tegretol', 'carbagen'] },
        { label: 'Ciclosporin', keywords: ['ciclosporin', 'neoral', 'capimune', 'capsorin', 'deximune', 'vanquoral'] },
        { label: 'Clozapine', keywords: ['clozapine', 'clozaril', 'denzapine', 'zaponex'] },
        { label: 'Digoxin', keywords: ['digoxin'] },
        { label: 'Fenfluramine', keywords: ['fenfluramine'] },
        { label: 'Lithium', keywords: ['lithium', 'priadel', 'camcolit', 'liskonum', 'li-liquid'] },
        { label: 'Mycophenolate mofetil', keywords: ['mycophenolate', 'cellcept', 'myfenax', 'cetava', 'myfortic'] },
        { label: 'Oral methotrexate', keywords: ['methotrexate'] },
        { label: 'Phenobarbital', keywords: ['phenobarbital'] },
        { label: 'Phenytoin', keywords: ['phenytoin', 'dilantin', 'epanutin'] },
        { label: 'Somatrogon', keywords: ['somatrogon'] },
        { label: 'Tacrolimus', keywords: ['tacrolimus', 'prograf', 'advagraf', 'envarsus', 'adoport', 'dailiport', 'modigraf'] },
        { label: 'Theophylline', keywords: ['theophylline', 'uniphyllin'] },
        { label: 'Warfarin', keywords: ['warfarin', 'acenocoumarol'] },
      ],
    },
  ],
};
