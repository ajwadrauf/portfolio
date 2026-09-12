/** Exact edit from the supplied VELUNE brief. End frames are exclusive. */
export const VELUNE_SHOTS = [
  { id: "S01", title: "Curiosity", start: 0, end: 42, note: "Chocolate folds frame the host. The camera holds while the face responds." },
  { id: "S02", title: "Pistachio", start: 42, end: 51, note: "One registered carton turn. The pedestal, pivot and camera stay fixed across all three flavours." },
  { id: "S03", title: "Raspberry", start: 51, end: 60, note: "A hard replacement at the same size and contact point. The package turns as one rigid object." },
  { id: "S04", title: "Caramel", start: 60, end: 69, note: "The third nine-frame carton view completes the family. No dissolve or colour morph." },
  { id: "S05", title: "The question", start: 69, end: 113, note: "Twelve bonbons build a question mark, then merge. The negative space must read before the chocolate fills it." },
  { id: "S06", title: "The centre", start: 113, end: 140, note: "The chocolate half and fork stay registered while two separate observers move behind them." },
  { id: "S07", title: "Discovery studio", start: 140, end: 190, note: "A real camera pullback reveals two chocolatiers in the foreground. Product stacks stay fixed in the set." },
  { id: "S08", title: "Raspberry detail", start: 190, end: 207, note: "A single raspberry turns on the plum stage. It arrives at the cut, without a falling entrance." },
  { id: "S09", title: "Pistachio detail", start: 207, end: 223, note: "An already-open pistachio replaces the berry. Shell and kernel remain one stable assembly." },
  { id: "S10", title: "The serving", start: 223, end: 242, note: "One whole chocolate and one caramel half turn together on a cream dish. The filling stays contained." },
  { id: "S11", title: "The Centre Report", start: 242, end: 314, note: "One printed surface, held for three full seconds. All lettering and product artwork move together." },
  { id: "S12", title: "Wonder within", start: 314, end: 360, note: "Return to the chocolate world. A small response keeps the final composition alive through the last frame." },
] as const;

export const VELUNE_MEDIA = {
  film: "/studio/velune/film/velune-h3.mp4",
  voiceover: "/studio/velune/film/velune-voiceover.wav",
  animatic: "/studio/velune/animatic.mp4",
  poster: "/studio/velune/poster.jpg",
  contactSheet: "/studio/velune/contact-sheet.jpg",
  packaging: "/studio/velune/packaging-concepts.jpg",
  report: "/studio/velune/report-concept.jpg",
} as const;
