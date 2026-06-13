// Input sanitization utilities — strip control chars, trim, enforce limits

export function sanitizeText(str, maxLength = 500) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // strip control chars
    .trim()
    .slice(0, maxLength);
}

export function sanitizePrice(val) {
  const n = parseFloat(String(val).replace(/[^0-9.]/g, ''));
  if (isNaN(n) || n < 0) return 0;
  return Math.min(n, 999999.99); // cap at $999,999
}

export function sanitizeEmail(str) {
  if (typeof str !== 'string') return '';
  return str.trim().toLowerCase().slice(0, 254);
}

export function validateListingPayload({ title, price, description, category }) {
  const errors = [];
  if (!title || title.trim().length < 2) errors.push('Title must be at least 2 characters.');
  if (title && title.length > 80) errors.push('Title must be under 80 characters.');
  const p = parseFloat(price);
  if (isNaN(p) || p < 0) errors.push('Price must be a positive number.');
  if (p > 999999) errors.push('Price cannot exceed $999,999.');
  if (!description || description.trim().length < 5) errors.push('Description must be at least 5 characters.');
  if (description && description.length > 500) errors.push('Description must be under 500 characters.');
  if (!category) errors.push('Please select a category.');
  return errors;
}

export function validateProfilePayload({ display_name, bio, status }) {
  const errors = [];
  if (display_name !== undefined) {
    if (!display_name || display_name.trim().length < 2) errors.push('Name must be at least 2 characters.');
    if (display_name.length > 50) errors.push('Name must be under 50 characters.');
  }
  if (bio !== undefined && bio.length > 200) errors.push('Bio must be under 200 characters.');
  if (status !== undefined && status.length > 80) errors.push('Headline must be under 80 characters.');
  return errors;
}
