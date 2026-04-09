/** Coerce JSON/body values to boolean; avoids Boolean("false") === true. */
function parseBooleanValue(value) {
  if (value === true || value === false) return value;
  if (value === null || value === '') return false;
  if (value === 0 || value === 1) return value === 1;
  if (value === 'true' || value === 'false') return value === 'true';
  return Boolean(value);
}

function optionalBoolean(value, defaultValue = false) {
  if (value === undefined) return defaultValue;
  return parseBooleanValue(value);
}

module.exports = { parseBooleanValue, optionalBoolean };
