import { Hono } from "hono";
import { providersStore } from "../store.js";

const router = new Hono();

// GET /api/providers/:id/auths - List all auths for a provider
router.get("/", (c) => {
  const providerId = c.req.param("id");
  const provider = providersStore.get(providerId);

  if (!provider) {
    return c.json(
      { success: false, error: "Provider not found", code: "NOT_FOUND" },
      404,
    );
  }

  const items = provider.auths ?? [];

  return c.json({
    success: true,
    data: items,
    total: items.length,
    page: 1,
    page_size: items.length,
  });
});

// GET /api/providers/:id/auths/:key - Get a single auth key for a provider
router.get("/:key", (c) => {
  const providerId = c.req.param("id");
  const key = c.req.param("key");

  const provider = providersStore.get(providerId);
  if (!provider) {
    return c.json(
      { success: false, error: "Provider not found", code: "NOT_FOUND" },
      404,
    );
  }

  const item = (provider.auths ?? []).find((a) => a.key === key);
  if (!item) {
    return c.json(
      { success: false, error: "Auth key not found", code: "NOT_FOUND" },
      404,
    );
  }

  // Mask the key in response
  const masked = {
    ...item,
    key:
      item.key.substring(0, 6) +
      "..." +
      item.key.substring(item.key.length - 4),
  };
  return c.json({ success: true, data: masked });
});

export default router;
