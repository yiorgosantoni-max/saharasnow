const ISO_CODES = "AF AX AL DZ AS AD AO AI AQ AG AR AM AW AU AT AZ BS BH BD BB BY BE BZ BJ BM BT BO BQ BA BW BV BR IO BN BG BF BI CV KH CM CA KY CF TD CL CN CX CC CO KM CG CD CK CR CI HR CU CW CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FK FO FJ FI FR GF PF TF GA GM GE DE GH GI GR GL GD GP GU GT GG GN GW GY HT HM VA HN HK HU IS IN ID IR IQ IE IM IL IT JM JP JE JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MA MZ MM NA NR NP NL NC NZ NI NE NG NU NF MK MP NO OM PK PW PS PA PG PY PE PH PN PL PT PR QA RE RO RU RW BL SH KN LC MF PM VC WS SM ST SA SN RS SC SL SG SX SK SI SB SO ZA GS SS ES LK SD SR SJ SE CH SY TW TJ TZ TH TL TG TK TO TT TN TR TM TC TV UG UA AE GB US UM UY UZ VU VE VN VG VI WF EH YE ZM ZW XK".split(" ");

const aliases: Record<string,string> = {
  "south korea":"KR","north korea":"KP","russia":"RU","laos":"LA","vietnam":"VN","venezuela":"VE","bolivia":"BO","moldova":"MD","tanzania":"TZ","brunei":"BN","cape verde":"CV","czech republic":"CZ","czechia":"CZ","ivory coast":"CI","cote divoire":"CI","democratic republic of the congo":"CD","congo kinshasa":"CD","republic of the congo":"CG","congo brazzaville":"CG","palestine":"PS","vatican":"VA","vatican city":"VA","kosovo":"XK","swaziland":"SZ","syria":"SY","iran":"IR","taiwan":"TW","macau":"MO","macao":"MO","united kingdom":"GB","uk":"GB","great britain":"GB","united states":"US","usa":"US","united states of america":"US"
};

function normalize(value: unknown) {
  return String(value ?? "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

let regionNames: Intl.DisplayNames | null = null;
function displayNames() {
  if (regionNames) return regionNames;
  try { regionNames = new Intl.DisplayNames(["en"], { type: "region" }); } catch { return null; }
  return regionNames;
}

export function countryCode(value: unknown): string {
  const raw = String(value ?? "").trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(raw)) return raw;
  const wanted = normalize(value);
  if (!wanted) return "";
  if (aliases[wanted]) return aliases[wanted];
  const names = displayNames();
  if (!names) return "";
  for (const code of ISO_CODES) {
    if (normalize(names.of(code)) === wanted) return code;
  }
  return "";
}

/**
 * URL for a real flag image instead of relying on OS/browser emoji support.
 * FlagCDN only supports fixed widths, so map arbitrary requested widths to a
 * valid asset size. This keeps flags working consistently in Edge, Safari,
 * Chrome and Firefox, including the seller profile which requests 48px.
 */
export function countryFlagUrl(value: unknown, width = 40): string {
  const code = countryCode(value).toLowerCase();
  if (!/^[a-z]{2}$/.test(code)) return "";
  const supportedWidths = [20, 40, 80, 160, 320, 640];
  const requested = Math.max(20, Math.round(Number(width) || 40));
  const assetWidth = supportedWidths.find(size => size >= requested) ?? 640;
  return `https://flagcdn.com/w${assetWidth}/${code}.png`;
}

/** Legacy text fallback for places that still render a country as text. */
export function countryFlag(value: unknown, fallback = "📍"): string {
  const code = countryCode(value);
  return /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map((char) => 127397 + char.charCodeAt(0))) : fallback;
}

export function resolveCountryCode(country: unknown, code: unknown): string {
  return countryCode(code) || countryCode(country);
}

/** Every ISO country as {code, name}, sorted alphabetically by English name. */
export function allCountries(): { code: string; name: string }[] {
  const names = displayNames();
  if (!names) return [];
  return ISO_CODES.map(code => ({ code, name: names.of(code) || code }))
    .filter(entry => entry.name && entry.name !== entry.code)
    .sort((a, b) => a.name.localeCompare(b.name));
}
