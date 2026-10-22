import type { Ingredient, Recipe } from "../../src/lib/types";

type Node = Record<string, unknown>;
export function recipeNode(value: unknown): Node | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = recipeNode(item);
      if (found) return found;
    }
  } else if (value && typeof value === "object") {
    const node = value as Node;
    if ([node["@type"]].flat().includes("Recipe")) return node;
    if (node["@graph"]) return recipeNode(node["@graph"]);
  }
  return null;
}
const text = (value: unknown): string =>
  typeof value === "string"
    ? value
        .replace(/<[^>]*>/g, "")
        .replace(/\s+/g, " ")
        .trim()
    : "";
export function instructions(value: unknown): string[] {
  if (typeof value === "string") return [text(value)].filter(Boolean);
  if (Array.isArray(value)) return value.flatMap(instructions);
  if (value && typeof value === "object") {
    const node = value as Node;
    return node.itemListElement
      ? instructions(node.itemListElement)
      : instructions(node.text);
  }
  return [];
}
export function parseIngredient(raw: string): Ingredient {
  const line = text(raw);
  const match = line.match(
    /^(\d+(?:[.,]\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+|[½¼¾])\s+(?:(kg|g|mg|l|dl|cl|ml|ss|ts|stk\.?|båt(?:er)?|fedd|potte(?:r)?|boks(?:er)?|pakke(?:r)?|pose(?:r)?|pk|klype(?:r)?|skive(?:r)?|bunt(?:er)?)\s+)?(.+)$/i,
  );
  if (!match)
    return {
      name: line,
      amount: null,
      unit: "",
      category: "Andre ingredienser",
    };
  const quantity = match[1].replace(",", ".");
  const fractions: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75 };
  let amount: number;
  if (quantity in fractions) amount = fractions[quantity];
  else if (quantity.includes("/")) {
    const parts = quantity.split(" ");
    const [n, d] = parts.at(-1)!.split("/").map(Number);
    amount = (parts.length > 1 ? Number(parts[0]) : 0) + n / d;
  } else amount = Number(quantity);
  if (!Number.isFinite(amount))
    return {
      name: line,
      amount: null,
      unit: "",
      category: "Andre ingredienser",
    };
  // Preserve names and units; do not guess equivalence between e.g. cloves and grams.
  const unit = (match[2] || "").replace(/\.$/, "").toLowerCase();
  const name = match[3].trim();
  const category = /kjøtt|kylling|skinke|laks|torsk|bacon|spekepølse/i.test(
    name,
  )
    ? "Fisk og kjøtt"
    : /melk|ost|smør|rømme|egg|fløte|yoghurt/i.test(name)
      ? "Meieri og egg"
      : /løk|tomat|sitron|lime|potet|gulrot|spinat|paprika|sopp|brokkoli|squash|basilikum|persille/i.test(
            name,
          )
        ? "Frukt og grønt"
        : "Basisvarer";
  return { name, amount, unit, category };
}
export function toRecipe(
  node: Node,
  url: string,
  curatedGlutenFree: boolean,
): Recipe {
  const title = text(node.name);
  const description = text(node.description);
  const diet = JSON.stringify(node.suitableForDiet ?? "");
  const glutenFree =
    curatedGlutenFree ||
    /glutenfr[iet]/i.test(title) ||
    /GlutenFreeDiet/i.test(diet);
  if (!glutenFree)
    throw new Error("Mangler dokumentasjon på at retten er glutenfri.");
  const ingredients = Array.isArray(node.recipeIngredient)
    ? node.recipeIngredient
        .filter((i): i is string => typeof i === "string")
        .map(parseIngredient)
    : [];
  const steps = instructions(node.recipeInstructions);
  if (!title || !ingredients.length || !steps.length)
    throw new Error(
      "Oppskriften mangler tittel, ingredienser eller fremgangsmåte.",
    );
  const yieldText = text(
    Array.isArray(node.recipeYield) ? node.recipeYield[0] : node.recipeYield,
  );
  const servings =
    typeof node.recipeYield === "number"
      ? node.recipeYield
      : Number(yieldText.match(/\d+/)?.[0]);
  if (!Number.isFinite(servings) || servings <= 0)
    throw new Error(
      "Kunne ikke lese antall porsjoner; vil ikke gjette mengder.",
    );
  const duration = text(node.totalTime || node.cookTime).match(
    /^PT(?:(\d+)H)?(?:(\d+)M)?$/,
  );
  const minutes = duration
    ? Number(duration[1] || 0) * 60 + Number(duration[2] || 0)
    : null;
  const batch = servings === 1 && /\([^)]*(?:får|gir)/i.test(yieldText);
  const category = /kylling/i.test(title)
    ? "Kylling"
    : /laks|torsk|fisk/i.test(title)
      ? "Fisk"
      : /kjøtt|skinke|bacon/i.test(JSON.stringify(ingredients))
        ? "Kjøtt"
        : /pizza|horn|pannekak|vafl/i.test(title)
          ? "Småretter"
          : "Vegetar";
  const emoji = /pizza/i.test(title)
    ? "🍕"
    : /horn/i.test(title)
      ? "🥐"
      : /pannekak|vafl/i.test(title)
        ? "🥞"
        : category === "Fisk"
          ? "🐟"
          : category === "Kylling"
            ? "🍗"
            : "🍲";
  return {
    id: `matprat-${new URL(url).pathname.split("/").filter(Boolean).at(-1)}`,
    title,
    description,
    minutes,
    servings,
    batch,
    yieldNote: batch ? yieldText : undefined,
    emoji,
    color: /pizza|pannekak/.test(title.toLowerCase()) ? "peach" : "green",
    category,
    glutenFree,
    ingredients,
    instructions: steps,
    source: { name: "Matprat", url, scrapedAt: new Date().toISOString() },
  };
}
