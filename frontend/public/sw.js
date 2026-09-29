self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const requestedUrl = new URL(event.notification.data?.url || '/', self.location.origin);
  const targetUrl = requestedUrl.origin === self.location.origin
    ? requestedUrl.href
    : new URL('/', self.location.origin).href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin !== self.location.origin) continue;
      try {
        if ('navigate' in client) await client.navigate(targetUrl);
        await client.focus();
        return;
      } catch {
        // Continue to another app window if this one can no longer be focused.
      }
    }
    await self.clients.openWindow(targetUrl);
  })());
});
