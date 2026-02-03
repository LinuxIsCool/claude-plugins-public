import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { loadCredentials, loadSession } from '../src/integrations/telegram/client';

async function main() {
  const creds = loadCredentials();
  const sessionStr = loadSession();
  if (!sessionStr) {
    console.error('No session found');
    return;
  }

  const session = new StringSession(sessionStr);
  const client = new TelegramClient(session, creds.apiId, creds.apiHash, { connectionRetries: 5 });

  await client.connect();

  let userCount = 0;
  console.log('ALL USER DMs:');
  console.log('='.repeat(50));

  for await (const dialog of client.iterDialogs({})) {
    if (dialog.isUser) {
      userCount++;
      const title = dialog.title || 'Unknown';
      const id = dialog.id?.toString() || '?';
      console.log(id.padEnd(15), '|', title);

      if (title.toLowerCase().includes('jessica') || title.toLowerCase().includes('zartler')) {
        console.log('>>> FOUND JESSICA <<<');
      }
    }
  }

  console.log('='.repeat(50));
  console.log('Total user DMs:', userCount);

  await client.disconnect();
}

main().catch(console.error);
