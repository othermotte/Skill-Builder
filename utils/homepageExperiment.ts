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
      "Explore a realistic scenario, receive assessment feedback on your judgement and practise relevant micro skills. Your free account includes one scenario and up to five micro skills.",
  },
  b: {
    heading: "Turn a leadership challenge into practical progress.",
    detail:
      "Assess how you would approach a realistic scenario, then practise the micro skills it reveals with personalised coaching. Start free with one scenario and up to five micro skills.",
  },
};
