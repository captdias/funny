import { test, expect } from "@playwright/test";

test("choose dinner, scale the list, check items and restore after reload", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Hva blir det til middag?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Velg middag for mandag" }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("textbox", { name: "Søk i oppskrifter" })
    .fill("Ovnsbakt laks");
  await dialog.getByRole("button", { name: "Velg rett" }).click();
  const shopping = page.locator("#handleliste");
  await expect(shopping.getByText("laksefilet", { exact: true })).toBeVisible();
  await expect(
    shopping.locator("label").filter({ hasText: "laksefilet" }),
  ).toContainText("300 g");
  await page.getByRole("button", { name: "Flere personer" }).click();
  await expect(
    shopping.locator("label").filter({ hasText: "laksefilet" }),
  ).toContainText("450 g");
  await shopping.locator("label").filter({ hasText: "laksefilet" }).click();
  await page.reload();
  await expect(page.locator(".day-card").first()).toContainText(
    "Ovnsbakt laks med sitron",
  );
  await expect(
    shopping
      .locator("label")
      .filter({ hasText: "laksefilet" })
      .getByRole("checkbox"),
  ).toBeChecked();
  await expect(shopping.locator(".stepper")).toContainText("3");
  await page.getByRole("button", { name: "Tøm planen" }).click();
  await page
    .getByRole("button", { name: "Tøm ukeplanen", exact: true })
    .click();
  await expect(
    shopping.getByText("En god middag begynner med en plan"),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText("0 av 7 middager planlagt")).toBeVisible();
});

test("fills empty days, filters recipes and supports keyboard dismissal", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Fyll ledige dager" }).click();
  await expect(page.getByText("7 av 7 middager planlagt")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Fyll ledige dager" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: /Oppskrifter/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Vegetar", exact: true }).click();
  await expect(dialog.locator(".picker-card")).not.toHaveCount(0);
  await dialog
    .getByRole("textbox", { name: "Søk i oppskrifter" })
    .fill("finnes-ikke");
  await expect(dialog.getByText("Ingen treff denne gangen")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});

test("mobile layout stays within viewport and can add a Matprat recipe", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Velg middag for søndag" }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("textbox", { name: "Søk i oppskrifter" })
    .fill("Glutenfrie pizzasnurrer");
  await dialog
    .getByRole("button", { name: /Se oppskrift: Glutenfrie pizzasnurrer/ })
    .click();
  await expect(
    dialog.getByRole("link", { name: /Originaloppskrift hos Matprat/ }),
  ).toHaveAttribute("href", /www.matprat.no/);
  await dialog.getByRole("button", { name: "Velg til søndag" }).click();
  await expect(page.getByText("1 av 7 middager planlagt")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("invalid persisted data and blocked storage do not crash planning", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("middag-ukeplan-v1", "{broken");
  });
  await page.goto("/");
  await expect(page.getByText("0 av 7 middager planlagt")).toBeVisible();
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("blocked", "SecurityError");
    };
  });
  await page.getByRole("button", { name: "Flere personer" }).click();
  await expect(
    page.getByText(/Nettleseren tillater ikke lagring/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Fyll ledige dager" }).click();
  await expect(page.getByText("7 av 7 middager planlagt")).toBeVisible();
});
