import { MessageStore } from '../src/core/store';
import { SearchIndex } from '../src/search/index';
import { getTelegramClient } from '../src/integrations/telegram/client';
import { Kind } from '../src/types';

const JESSICA_ID = '565777706';

async function main() {
  const store = new MessageStore();
  const search = new SearchIndex();
  const client = getTelegramClient();

  await client.connect();
  const me = await client.getMe();
  const myAccountId = 'tg_' + me.id;

  // Ensure my account exists
  await store.getOrCreateAccount({
    id: myAccountId,
    name: me.name,
    identities: [{ platform: 'telegram', handle: me.phone || me.name }],
  });

  // Get messages from Jessica's DM
  console.log('Fetching messages from Jessica DM...');
  const messages = await client.getMessages(JESSICA_ID, { limit: 500 });
  console.log('Found', messages.length, 'messages');

  const threadId = 'tg_' + JESSICA_ID;

  // Create thread
  await store.getOrCreateThread({
    id: threadId,
    title: 'Jessica+ Zartler 🌱',
    type: 'dm',
    participants: [myAccountId],
    source: { platform: 'telegram', platform_id: JESSICA_ID },
  });

  // Ensure Jessica's account
  const jessicaAccountId = 'tg_jessica_' + JESSICA_ID;
  await store.getOrCreateAccount({
    id: jessicaAccountId,
    name: 'Jessica+ Zartler 🌱',
    identities: [{ platform: 'telegram', handle: JESSICA_ID }],
  });

  let imported = 0;
  for (const msg of messages) {
    if (!msg.text?.trim()) continue;

    const isOutgoing = msg.isOutgoing;
    const accountId = isOutgoing ? myAccountId : jessicaAccountId;
    const authorName = isOutgoing ? me.name : 'Jessica+ Zartler 🌱';

    const input = {
      kind: Kind.Telegram,
      content: msg.text,
      account_id: accountId,
      author: { name: authorName, handle: isOutgoing ? me.id.toString() : JESSICA_ID },
      created_at: msg.date,
      refs: { thread_id: threadId },
      source: { platform: 'telegram', platform_id: String(msg.id) },
      tags: [['direction', isOutgoing ? 'outgoing' : 'incoming']] as [string, string][],
    };

    const message = await store.createMessage(input);
    search.index(message);
    imported++;
  }

  console.log('Imported', imported, 'messages from Jessica DM');
  await client.disconnect();
}

main().catch(console.error);
