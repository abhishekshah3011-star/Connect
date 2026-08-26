/* ==================================================================
   Weighted priority scoring
   ------------------------------------------------------------------
   Six dimensions, each scored 1–5 by the requestor. Four of them push
   the score up; effort and delivery risk push it down, because a big,
   risky piece of work is worth less for the same benefit.

   Every dimension is normalised to 0–1, multiplied by its weight, and
   summed — so the result is always 0–100 and the weights are the only
   thing you need to change to re-balance it.
   ================================================================== */

export const DIMENSIONS = [
  { key: "urgency", label: "Urgency", weight: 20, invert: false,
    help: "How soon this has to land before the cost of waiting bites.",
    scale: ["Can wait a year", "Nice within a year", "Needed this quarter", "Needed this month", "Blocking work right now"] },

  { key: "strategic", label: "Strategic value", weight: 20, invert: false,
    help: "How closely it serves a stated company objective.",
    scale: ["Peripheral", "Minor support", "Supports a goal", "Advances a key goal", "Central to strategy"] },

  { key: "compliance", label: "Compliance / regulatory", weight: 15, invert: false,
    help: "Whether an external obligation forces this.",
    scale: ["No obligation", "Good practice", "Internal policy", "Audit finding to close", "Legal or regulatory mandate"] },

  { key: "customer", label: "Customer impact", weight: 20, invert: false,
    help: "How many customers feel it, and how much.",
    scale: ["Internal only", "Few customers, minor", "Noticeable to many", "Significant for most", "Affects every customer materially"] },

  { key: "effort", label: "Effort required", weight: 15, invert: true,
    help: "Bigger builds score lower — the same benefit for less work ranks higher.",
    scale: ["Under a week", "1–2 weeks", "3–6 weeks", "2–3 months", "More than 3 months"] },

  { key: "risk", label: "Delivery risk", weight: 10, invert: true,
    help: "Technical, dependency and adoption risk. Riskier work scores lower.",
    scale: ["Very low", "Low", "Moderate", "High", "Very high"] },
];

export const BANDS = [
  { min: 75, label: "Critical", taskPriority: "critical" },
  { min: 55, label: "High", taskPriority: "high" },
  { min: 35, label: "Medium", taskPriority: "medium" },
  { min: 0, label: "Low", taskPriority: "low" },
];

export const DEFAULT_SCORES = Object.fromEntries(DIMENSIONS.map(d => [d.key, 3]));

const clamp = n => Math.min(5, Math.max(1, Number(n) || 3));

/* 0–100, rounded. Invert flips a 1–5 answer so that "more" counts as "less". */
export function priorityScore(scores = {}) {
  const total = DIMENSIONS.reduce((sum, d) => {
    const v = clamp(scores[d.key]);
    const norm = d.invert ? (5 - v) / 4 : (v - 1) / 4;
    return sum + norm * d.weight;
  }, 0);
  return Math.round(total);
}

export const priorityBand = score => BANDS.find(b => score >= b.min) || BANDS[BANDS.length - 1];

/* what each dimension contributed, for the breakdown shown to reviewers */
export function scoreBreakdown(scores = {}) {
  return DIMENSIONS.map(d => {
    const v = clamp(scores[d.key]);
    const norm = d.invert ? (5 - v) / 4 : (v - 1) / 4;
    return { ...d, value: v, points: Math.round(norm * d.weight * 10) / 10, answer: d.scale[v - 1] };
  });
}
