export function shouldShowSubscriptionBanner(pathname: string): boolean {
  return pathname !== "/app/billing" && !pathname.startsWith("/app/design/");
}
