import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && key ? createClient(url, key) : null;

export async function saveTable(tableId, payload) {
  if (!supabase) return;
  const { error } = await supabase.from('shared_tables').upsert({
    id: tableId,
    arrangement: payload,
    updated_at: new Date().toISOString()
  });
  if (error) console.warn('Could not save table:', error.message);
}

export async function addThankYouCard(tableId, card) {
  if (!supabase) return;
  const { error } = await supabase.from('thank_you_cards').insert({
    table_id: tableId,
    message: card.message,
    sender_name: card.name || null,
    anonymous: Boolean(card.anonymous),
    food_asset: card.food || null
  });
  if (error) console.warn('Could not save thank-you card:', error.message);
}

export async function getCardCount(tableId) {
  if (!supabase) return 0;
  const { count, error } = await supabase.from('thank_you_cards').select('id', { count: 'exact', head: true }).eq('table_id', tableId);
  if (error) {
    console.warn('Could not load thank-you card count:', error.message);
    return 0;
  }
  return count || 0;
}
