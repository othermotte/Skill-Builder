export type HomepageVariant = 'a' | 'b';
export const EXPERIMENT_ID = 'commercial-landing-v1';
export function chooseHomepageVariant(search: string, saved: string | null, random: number): HomepageVariant {
  const params = new URLSearchParams(search);
  const requested = params.get('variant') || params.get('homepage');
  if (requested === 'a' || requested === 'b') return requested;
  if (saved === 'a' || saved === 'b') return saved;
  return random < 0.5 ? 'a' : 'b';
}
export function previewVariant(search: string): HomepageVariant | null {
  const params = new URLSearchParams(search);
  const value = params.get('variant') || params.get('homepage');
  return value === 'a' || value === 'b' ? value : null;
}
export const homepageCopy = {
  a: {
    eyebrow: 'Leadership development through practice',
    heading: 'Discover the leadership skills you need to strengthen. Then practise them.',
    detail: 'Work through realistic leadership challenges, receive personalised feedback and develop the skills that will help you handle difficult situations more effectively.',
    supporting: ['Leadership Skill Builder connects assessment with action. Rather than simply telling you what good leadership looks like, it helps you examine your own approach and practise specific skills in a safe environment.'],
    freeHeading: 'Start with a real leadership challenge',
    freeCopy: ['Choose a scenario, explore how you would respond and receive feedback that identifies relevant skills for further practice. Your free account includes one permanently selected scenario and access to practice in up to three recommended micro skills, delivered in a focused set.'],
    benefitsHeading: 'A practical approach to developing leadership skills',
    stages: [
      ['Experience a leadership challenge', 'Work through a realistic dilemma that calls for judgement, interpersonal skills and decision-making.'],
      ['Understand your approach', 'Receive personalised feedback on the leadership capabilities demonstrated in your response.'],
      ['Practise what matters', 'Focus on individual micro skills through interactive coaching tailored to your assessment.'],
      ['Build on your experience', 'Revisit feedback and practice history to guide your continuing development.'],
    ],
    paidHeading: 'Develop your skills further',
    paidCopy: 'Unlock every leadership scenario and the full micro-skill library. Explore different challenges, practise across a broader range of capabilities and keep your learning history in one place.',
  },
  b: {
    eyebrow: 'Close the gap between knowing and doing',
    heading: "You don’t become a better leader simply by learning more about leadership.",
    detail: 'You become better through experience, reflection and practice. Leadership Skill Builder gives you a place to work through difficult situations, discover what you could do differently and develop the skills to handle them.',
    supporting: ["Most of us know more about good leadership than we consistently put into practice. That’s hardly surprising. Real situations are complicated, emotions get involved and there’s rarely a perfect answer.", "But you shouldn’t have to wait for the next difficult situation at work to discover what you need to improve."],
    freeHeading: "Find out what you’d do when it matters",
    freeCopy: ['Step into a realistic leadership dilemma. Make the decisions you’d make in real life and explore what your approach reveals about your strengths and development opportunities.', 'Then practise the skills that could help you approach similar situations differently.', 'Start with one scenario and up to three recommended micro skills.'],
    benefitsHeading: 'A better way to become the leader you want to be',
    stages: [
      ['Face the challenge', 'Explore a realistic leadership dilemma without the consequences of getting things wrong at work.'],
      ['See what you might be missing', 'Receive feedback that helps you recognise strengths, blind spots and opportunities to improve.'],
      ['Try a different approach', 'Practise specific skills through interactive coaching, experimenting with different ways of responding.'],
      ['Keep developing', 'Learn from your experience, return to previous practice and build confidence through continued effort.'],
    ],
    paidHeading: 'There’s always another skill worth developing',
    paidCopy: 'Leadership brings new challenges throughout your career. With full access, you can explore the complete scenario collection and micro-skill library, developing your capabilities as your needs change.',
  },
};
