// utils/placeholder.js
function applyPlaceholders(template, recipient) {
  if (!template) return "";

  const fullname = recipient.name || "";
  const parts = fullname.split(" ");
  const first_name = parts[0] || "";
  const middle_name = parts.length > 2 ? parts.slice(1, -1).join(" ") : "";
  const last_name = parts.length > 1 ? parts[parts.length - 1] : "";

  return template
    .replace(/{{fullname}}/gi, fullname)
    .replace(/{{first_name}}/gi, first_name)
    .replace(/{{middle_name}}/gi, middle_name)
    .replace(/{{last_name}}/gi, last_name)
    .replace(/{{birthdate}}/gi, recipient.birthdate || "")
    .replace(/{{school}}/gi, recipient.school || "")
    .replace(/{{beasiswa}}/gi, recipient.beasiswa || "")
    .replace(/{{kelas}}/gi, recipient.kelas || "")
    .replace(/{{lulus}}/gi, recipient.lulus || "")
    .replace(/{{prestasi}}/gi, recipient.prestasi || "")
    .replace(/{{orangtua}}/gi, recipient.orangtua || "");
}

module.exports = { applyPlaceholders };
