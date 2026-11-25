// One Sarvam chat call to prove the key and SDK work.
// Run: npm run sarvam:hello   (reads the key from .env.local via --env-file; never printed)
import { SarvamAIClient } from 'sarvamai';

const client = new SarvamAIClient({ apiSubscriptionKey: process.env.SARVAM_API_KEY });

const response = await client.chat.completions({
  model: 'sarvam-105b',
  messages: [{ role: 'user', content: 'In one short sentence, wish the guests at a Diwali party in Tamil.' }],
});

console.log(response.choices[0].message.content);
