import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && key ? createClient(url, key) : null;
export const hasBackend = Boolean(supabase);

const CARD_COLUMNS = 'id, message, sender_name, anonymous, food_asset, created_at';

function check({ data, error }, what) {
  if (error) throw new Error(`Could not ${what}: ${error.message}`);
  return data;
}

export async function createTable(hostName, arrangement, listed = false) {
  const rows = check(await supabase.rpc('create_table', { p_host_name: hostName, p_arrangement: arrangement, p_listed: Boolean(listed) }), 'create your table');
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row?.id || !row?.edit_token) throw new Error('Could not create your table: no id returned');
  return row;
}

export async function updateTable(id, token, hostName, arrangement, listed = false) {
  const ok = check(await supabase.rpc('update_table', { p_id: id, p_token: token, p_host_name: hostName, p_arrangement: arrangement, p_listed: Boolean(listed) }), 'save your table');
  if (!ok) throw new Error('Could not save your table: this browser is not its owner');
}

export async function loadTable(id) {
  return check(await supabase.from('shared_tables').select('id, host_name, arrangement, listed').eq('id', id).maybeSingle(), 'load this table');
}

export async function loadCards(tableId) {
  return check(await supabase.from('thank_you_cards').select(CARD_COLUMNS).eq('table_id', tableId).order('created_at'), 'load thank-you cards') || [];
}

export async function addCard(tableId, card) {
  return check(await supabase.from('thank_you_cards').insert({
    table_id: tableId,
    message: card.message,
    sender_name: card.anonymous ? null : (card.name || null),
    anonymous: Boolean(card.anonymous),
    food_asset: card.food || null
  }).select(CARD_COLUMNS).single(), 'send your card');
}

export async function deleteCard(tableId, token, cardId) {
  const ok = check(await supabase.rpc('delete_card', { p_table_id: tableId, p_token: token, p_card_id: cardId }), 'remove that card');
  if (!ok) throw new Error('Could not remove that card');
}

export async function fetchLeaderboard(limit = 25) {
  return check(await supabase.rpc('leaderboard', { p_limit: limit }), 'load the leaderboard') || [];
}
