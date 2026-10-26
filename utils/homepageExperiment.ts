export function chooseHomepageVariant(
  search: string,
  saved: string | null,
  random: number,
): "a" | "b" {
  const requested = new URLSearchParams(search).get("homepage");
  if (requested === "a" || requested === "b") return requested;
  if (saved === "a" || saved === "b") return saved;
  return random < 0.5 ? "a" : "b";
}
export const homepageCopy = {
  a: {
    heading: "Discover where to focus your leadership development.",
    detail:
      "Explore a realistic scenario, understand your judgement and get five micro skills to practise from your assessment.",
  },
  b: {
    heading: "Turn a leadership challenge into practical progress.",
    detail:
      "Assess how you would approach a realistic scenario, then practise five relevant micro skills with personalised coaching.",
  },
};
