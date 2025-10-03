// utils/string.js (bisa bikin file util kecil)
function toTitleCase(str = "") {
  return str
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

module.exports = { toTitleCase };
