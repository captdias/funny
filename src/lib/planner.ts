import { DAYS, type Plan, type Recipe } from "./types";

export const STORAGE_KEY = "middag-ukeplan-v1";
export type ShoppingItem = {
  key: string;
  name: string;
  amount: number | null;
  unit: string;
  category: string;
};
export function recipeScale(recipe: Recipe, servings: number): number {
  return recipe.batch ? 1 : servings / recipe.servings;
}
export function shoppingList(
  plan: Plan,
  recipes: Recipe[],
  servings: number,
): ShoppingItem[] {
  const items = new Map<string, ShoppingItem>();
  for (const day of DAYS) {
    const recipe = recipes.find((r) => r.id === plan[day]);
    if (!recipe) continue;
    for (const ingredient of recipe.ingredients) {
      const key = `${ingredient.name.trim().toLocaleLowerCase("nb")}|${ingredient.unit.trim().toLocaleLowerCase("nb")}`;
      const amount =
        ingredient.amount === null
          ? null
          : ingredient.amount * recipeScale(recipe, servings);
      const existing = items.get(key);
      if (existing && amount !== null && existing.amount !== null)
        existing.amount += amount;
      else if (!existing) items.set(key, { ...ingredient, amount, key });
    }
  }
  return [...items.values()].sort(
    (a, b) =>
      a.category.localeCompare(b.category, "nb") ||
      a.name.localeCompare(b.name, "nb"),
  );
}
export function formatAmount(amount: number | null, unit: string): string {
  return [
    amount === null
      ? ""
      : new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 2 }).format(
          amount,
        ),
    unit,
  ]
    .filter(Boolean)
    .join(" ");
}
export function readStoredPlan(raw: string | null, recipes: Recipe[]) {
  if (!raw) return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;
    const value = data as Record<string, unknown>;
    const plan: Plan = {};
    if (value.plan && typeof value.plan === "object") {
      for (const day of DAYS) {
        const id = (value.plan as Record<string, unknown>)[day];
        if (typeof id === "string" && recipes.some((r) => r.id === id))
          plan[day] = id;
      }
    }
    const servings =
      typeof value.servings === "number" &&
      Number.isInteger(value.servings) &&
      value.servings >= 1 &&
      value.servings <= 12
        ? value.servings
        : 2;
    const checked = Array.isArray(value.checked)
      ? value.checked.filter((x): x is string => typeof x === "string")
      : [];
    return { plan, servings, checked };
  } catch {
    return null;
  }
}
