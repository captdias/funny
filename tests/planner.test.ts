import { test } from "node:test";
import assert from "node:assert/strict";
import { formatAmount, readStoredPlan, shoppingList } from "../src/lib/planner";
import type { Recipe } from "../src/lib/types";
import recipesData from "../src/data/recipes.json";
import {
  instructions,
  parseIngredient,
  recipeNode,
  toRecipe,
} from "../scripts/lib/matprat";
const recipes = recipesData as Recipe[];

test("sums ingredients across days, scales servings, and keeps incompatible units apart", () => {
  const recipe: Recipe = {
    ...recipes[0],
    id: "test",
    servings: 4,
    ingredients: [
      { name: "Poteter", amount: 400, unit: "g", category: "Grønt" },
      { name: "poteter", amount: 2, unit: "stk", category: "Grønt" },
      { name: "salt etter smak", amount: null, unit: "", category: "Basis" },
    ],
  };
  const list = shoppingList({ Mandag: "test", Tirsdag: "test" }, [recipe], 2);
  assert.equal(list.find((i) => i.unit === "g")?.amount, 400);
  assert.equal(list.find((i) => i.unit === "stk")?.amount, 2);
  assert.equal(list.find((i) => i.amount === null)?.name, "salt etter smak");
  assert.equal(list.length, 3);
});
test("empty and stale plans do not produce ingredients", () => {
  assert.deepEqual(shoppingList({}, recipes, 2), []);
  assert.deepEqual(shoppingList({ Mandag: "removed" }, recipes, 2), []);
});
test("stored data is validated without trusting arbitrary JSON", () => {
  assert.equal(readStoredPlan("{", recipes), null);
  assert.equal(readStoredPlan("null", recipes), null);
  assert.deepEqual(
    readStoredPlan(
      JSON.stringify({
        plan: {
          Mandag: recipes[0].id,
          Tirsdag: "missing",
          Funday: recipes[0].id,
        },
        servings: -5,
        checked: ["one", 4],
      }),
      recipes,
    ),
    { plan: { Mandag: recipes[0].id }, servings: 2, checked: ["one"] },
  );
});
test("formats Norwegian decimal quantities", () => {
  assert.equal(formatAmount(1.5, "dl"), "1,5 dl");
  assert.equal(formatAmount(null, ""), "");
});
test("parses real Matprat quantities, units, fractions and unquantified ingredients", () => {
  assert.deepEqual(parseIngredient(" 0,5 dl olivenolje"), {
    name: "olivenolje",
    amount: 0.5,
    unit: "dl",
    category: "Basisvarer",
  });
  assert.equal(parseIngredient("1/2 ts salt").amount, 0.5);
  assert.equal(parseIngredient("1 1/2 dl melk").amount, 1.5);
  assert.equal(parseIngredient("½ ts salt").amount, 0.5);
  assert.equal(parseIngredient("3 båter hvitløk").unit, "båter");
  assert.equal(parseIngredient("salt etter smak").amount, null);
});
test("handles nested schema graphs and instruction sections", () => {
  assert.equal(
    recipeNode({
      "@graph": [{ "@type": "WebPage" }, { "@type": ["Recipe"], name: "Test" }],
    })?.name,
    "Test",
  );
  assert.deepEqual(
    instructions([
      {
        "@type": "HowToSection",
        itemListElement: [{ text: "Stek." }, { text: "Server." }],
      },
    ]),
    ["Stek.", "Server."],
  );
});
test("rejects recipes without gluten-free evidence or usable content", () => {
  const node = {
    name: "Pasta",
    recipeIngredient: ["2 stk. egg"],
    recipeYield: "4 PORSJONER",
    recipeInstructions: [{ text: "Stek." }],
    totalTime: "PT1H20M",
  };
  assert.throws(
    () =>
      toRecipe(node, "https://www.matprat.no/oppskrifter/kos/pasta/", false),
    /glutenfri/,
  );
  const recipe = toRecipe(
    { ...node, name: "Glutenfri pasta" },
    "https://www.matprat.no/oppskrifter/kos/pasta/",
    false,
  );
  assert.equal(recipe.minutes, 80);
  assert.equal(recipe.servings, 4);
  assert.equal(recipe.source.name, "Matprat");
  assert.throws(
    () =>
      toRecipe(
        { ...node, recipeInstructions: [] },
        "https://www.matprat.no/oppskrifter/kos/pasta/",
        true,
      ),
    /mangler/,
  );
});
test("every bundled recipe has ingredients, instructions, and valid quantities", () => {
  assert.ok(recipes.length > 0);
  assert.equal(new Set(recipes.map((r) => r.id)).size, recipes.length);
  for (const recipe of recipes) {
    assert.ok(recipe.title && recipe.glutenFree && recipe.servings > 0);
    assert.ok(recipe.ingredients.length && recipe.instructions.length);
    assert.ok(
      recipe.ingredients.every(
        (i) =>
          i.amount === null || (Number.isFinite(i.amount) && i.amount >= 0),
      ),
    );
    if (recipe.source.name === "Matprat")
      assert.equal(new URL(recipe.source.url!).hostname, "www.matprat.no");
  }
});

test("batch recipes keep one batch per planned day instead of treating a dough as one person", () => {
  const recipe: Recipe = {
    ...recipes[0],
    id: "batch",
    servings: 1,
    batch: true,
    ingredients: [{ name: "mel", amount: 500, unit: "g", category: "Basis" }],
  };
  assert.equal(shoppingList({ Mandag: "batch" }, [recipe], 4)[0].amount, 500);
  assert.equal(
    shoppingList({ Mandag: "batch", Tirsdag: "batch" }, [recipe], 2)[0].amount,
    1000,
  );
  const parsed = toRecipe(
    {
      name: "Glutenfrie horn",
      recipeYield: "1 PORSJONER (1 porsjon gir 16 horn)",
      recipeIngredient: ["1 pk tørrgjær"],
      recipeInstructions: [{ text: "Bak." }],
    },
    "https://www.matprat.no/oppskrifter/familien/glutenfrie-horn/",
    false,
  );
  assert.equal(parsed.batch, true);
  assert.equal(parsed.ingredients[0].name, "tørrgjær");
  assert.equal(parsed.ingredients[0].unit, "pk");
});
