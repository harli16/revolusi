function normalizePhone(num){ if(!num) return ''; let s=String(num).replace(/[^0-9+]/g,''); if(s.startsWith('0')) s='62'+s.slice(1); if(s.startsWith('+')) s=s.slice(1); if(!s.startsWith('62')) s='62'+s; return s; }
function isValidIndoNumber(num){ const s=normalizePhone(num); return /^62[0-9]{8,15}$/.test(s); }
module.exports = { normalizePhone, isValidIndoNumber };