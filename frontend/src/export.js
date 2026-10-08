// Generic CSV / PDF export for { title, head, rows } sections. PDF code is loaded only when needed.
export const pc = (n, t) => (t ? ` (${Math.round((n / t) * 100)}%)` : '');
export const ratio = (a, b) => (!a || !b ? `${a} : ${b}` : a <= b ? `1 : ${(b / a).toFixed(2)}` : `${(a / b).toFixed(2)} : 1`);
export const GH = ['', 'Male', 'Female', 'Other', 'Total'];
export const gRow = (label, t) => [label, t.male, t.female, t.other, t.total];

export function analyticsSections(a, s) {
  const out = [];
  if (s) out.push({ title: 'Overview', head: ['Metric', 'Value'], rows: [['Employee IDs', s.total], ['Active', s.active], ['Inactive', s.inactive], ['Registered accounts', s.registered], ['Profiles submitted', s.profiles]] });
  const N = a.submitted;
  out.push(
    { title: `Gender (based on ${N} submitted profiles)`, head: ['Men', 'Women', 'Other', 'Women : Men ratio'], rows: [[a.gender.male, a.gender.female, a.gender.other, ratio(a.gender.female, a.gender.male)]] },
    { title: 'Publications by all faculty', head: ['Journals', 'Conferences', 'Journals + Conferences', 'Book chapters', 'Textbooks', 'Total'],
      rows: [[a.pubs?.journals ?? 0, a.pubs?.conferences ?? 0, (a.pubs?.journals ?? 0) + (a.pubs?.conferences ?? 0), a.pubs?.chapters ?? 0, a.pubs?.textbooks ?? 0, a.pubs?.total ?? 0]] },
    { title: 'PhD vs non-PhD', head: GH, rows: [gRow('PhD', a.phd), gRow('Non-PhD', a.nonPhd), ['PhD : Non-PhD ratio', ratio(a.phd.total, a.nonPhd.total), '', '', '']] },
    { title: 'Average age (years)', head: ['All faculty', 'Men', 'Women'], rows: [[a.age.all ?? '-', a.age.male ?? '-', a.age.female ?? '-']] },
    { title: 'Category-wise', head: GH, rows: Object.entries(a.category).map(([k, t]) => gRow(k, t)) },
    { title: 'Local vs non-local', head: GH, rows: [gRow('Local (Andhra Pradesh)', a.local), gRow('Non-local', a.nonLocal), ['Local : Non-local ratio', ratio(a.local.total, a.nonLocal.total), '', '', '']] },
    { title: 'Experience (faculty with at least)', head: ['Experience', 'At KL University', 'Total (KLU + previous + industry)'],
      rows: [2, 3, 5, 10].map((n) => [`${n}+ years`, `${a.exp.kl[n]}${pc(a.exp.kl[n], N)}`, `${a.exp.total[n]}${pc(a.exp.total[n], N)}`]) },
  );
  return out;
}

const save = (blob, name) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
const esc = (v) => {
  let s = String(v ?? '');
  if (/^[=+@]|^-(?!\d)/.test(s)) s = "'" + s; // stop spreadsheet formula injection
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function downloadCSV(file, sections) {
  const lines = sections.flatMap((s) => [esc(s.title), s.head.map(esc).join(','), ...s.rows.map((r) => r.map(esc).join(',')), '']);
  save(new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), file + '.csv');
}

export async function downloadPDF(file, title, sections, photo, landscape = false) {
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF(landscape ? { orientation: 'landscape' } : undefined);
  doc.setFontSize(16); doc.text(title, 14, 18);
  doc.setFontSize(9); doc.text('Generated on ' + new Date().toLocaleString(), 14, 24);
  let y = 32;
  if (photo) {
    try { doc.addImage(photo, photo.startsWith('data:image/png') ? 'PNG' : 'JPEG', 164, 10, 32, 38); y = 54; } catch { /* skip photo */ }
  }
  for (const s of sections) {
    if (y > doc.internal.pageSize.getHeight() - 40) { doc.addPage(); y = 16; }
    doc.setFontSize(12); doc.text(s.title, 14, y);
    autoTable(doc, { startY: y + 3, head: [s.head], body: s.rows.map((r) => r.map((c) => String(c ?? ''))), theme: 'grid', styles: { fontSize: 9 }, headStyles: { fillColor: [31, 79, 216] } });
    y = doc.lastAutoTable.finalY + 10;
  }
  doc.save(file + '.pdf');
}
