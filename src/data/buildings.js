// Rochdale Village — South Jamaica, Queens, NY
// 20 residential buildings across 5 sections
// rochdalevillage.com

export const ROCHDALE_SECTIONS = [
  {
    section: 'Section I',
    buildings: [
      { label: 'Building 1 — Section I', value: 'Building 1' },
      { label: 'Building 2 — Section I', value: 'Building 2' },
      { label: 'Building 3 — Section I', value: 'Building 3' },
      { label: 'Building 4 — Section I', value: 'Building 4' },
    ],
  },
  {
    section: 'Section II',
    buildings: [
      { label: 'Building 5 — Section II', value: 'Building 5' },
      { label: 'Building 6 — Section II', value: 'Building 6' },
      { label: 'Building 7 — Section II', value: 'Building 7' },
      { label: 'Building 8 — Section II', value: 'Building 8' },
    ],
  },
  {
    section: 'Section III',
    buildings: [
      { label: 'Building 9 — Section III',  value: 'Building 9' },
      { label: 'Building 10 — Section III', value: 'Building 10' },
      { label: 'Building 11 — Section III', value: 'Building 11' },
      { label: 'Building 12 — Section III', value: 'Building 12' },
    ],
  },
  {
    section: 'Section IV',
    buildings: [
      { label: 'Building 13 — Section IV', value: 'Building 13' },
      { label: 'Building 14 — Section IV', value: 'Building 14' },
      { label: 'Building 15 — Section IV', value: 'Building 15' },
      { label: 'Building 16 — Section IV', value: 'Building 16' },
    ],
  },
  {
    section: 'Section V',
    buildings: [
      { label: 'Building 17 — Section V', value: 'Building 17' },
      { label: 'Building 18 — Section V', value: 'Building 18' },
      { label: 'Building 19 — Section V', value: 'Building 19' },
      { label: 'Building 20 — Section V', value: 'Building 20' },
    ],
  },
];

// Flat list for simple iteration
export const ROCHDALE_BUILDINGS = ROCHDALE_SECTIONS.flatMap((s) => s.buildings);
