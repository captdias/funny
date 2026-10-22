import Planner from "@/components/planner";
import recipes from "@/data/recipes.json";
import type { Recipe } from "@/lib/types";
export default function Home() {
  return <Planner recipes={recipes as Recipe[]} />;
}
