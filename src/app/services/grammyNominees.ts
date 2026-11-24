export const grammyYear = '2027';
export const grammySource = 'https://www.grammy.com/awards/69th-annual-grammy-awards-2027/';

export const grammyEditions = [{ year: grammyYear, number: 69, source: grammySource }] as const;

export interface GrammyCategory {
  id: string;
  title: string;
  english: string;
  field: string;
  kind: string;
  nominees: [id: string, title: string, artist: string][];
}

export async function loadGrammyCategories(year: string, signal: AbortSignal): Promise<GrammyCategory[]> {
  const response = await fetch(`/grammy/${year}.json`, { signal });
  if (!response.ok) throw new Error('Could not load Grammy nominations');
  return response.json();
}

const artwork: Record<string, string> = {
  'Lost Weekend': 'lost-weekend', Dandelion: 'dandelion', petal: 'petal',
  'you seem pretty sad for a girl so in love': 'olivia-album',
  Berghain: 'berghain', 'LUX (Complete Works)': 'berghain',
  "Choosin' Texas": 'texas',
  'the cure': 'cure',
  'hate that i made you love me': 'hate',
  'I Knew It, I Knew You (from Toy Story 5)': 'toy',
  'Man I Need': 'man', 'The Art of Loving': 'man',
  'Risk It All': 'risk', 'I Just Might': 'risk', 'The Romantic': 'risk',
  'WHERE IS MY HUSBAND!': 'husband', RUNWAY: 'runway', 'Bring Your Love': 'bring',
  'Click Clack Symphony.': 'click', 'THIS MUSIC MAY CONTAIN HOPE.': 'click',
  'The Life of a Showgirl': 'showgirl', 'The Fate of Ophelia': 'ophelia',
  Dracula: 'dracula', 'Sauvignon Blanc': 'sauvignon',
};

export function grammyCover(title: string) {
  return artwork[title] ? `/grammy-2027/${artwork[title]}.webp` : '';
}
