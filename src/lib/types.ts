export type Ingredient = {
  name: string;
  amount: number | null;
  unit: string;
  category: string;
};
export type Recipe = {
  id: string;
  title: string;
  description: string;
  minutes: number | null;
  servings: number;
  batch?: boolean;
  yieldNote?: string;
  emoji: string;
  color: string;
  category: string;
  glutenFree: boolean;
  ingredients: Ingredient[];
  instructions: string[];
  source: { name: string; url: string | null; scrapedAt?: string };
};
export const DAYS = [
  "Mandag",
  "Tirsdag",
  "Onsdag",
  "Torsdag",
  "Fredag",
  "Lørdag",
  "Søndag",
] as const;
export type Day = (typeof DAYS)[number];
export type Plan = Partial<Record<Day, string>>;
