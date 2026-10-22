import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldShowSubscriptionBanner } from "./subscription-banner-visibility";

test("the poster editor stays clear of the subscription banner", () => {
  assert.equal(shouldShowSubscriptionBanner("/app/design/draft-1"), false);
  assert.equal(shouldShowSubscriptionBanner("/app/billing"), false);
  assert.equal(shouldShowSubscriptionBanner("/app"), true);
});
