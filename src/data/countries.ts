import { uiText } from "../text/index";
/**
 * Countries an account can be set to: the old app's list, with its labels and dial codes (the
 * number to use if the account needs SMS verification again), sorted by name. Flags are
 * flag-icons' 4:3 SVGs, only these countries' files.
 */
const LIST: readonly { readonly code: string; readonly label: string; readonly dialCode: string }[] = [
  { code: "US", label: uiText("countries.unitedStates"), dialCode: "+1" },
  { code: "CA", label: uiText("countries.canada"), dialCode: "+1" },
  { code: "MX", label: uiText("countries.mexico"), dialCode: "+52" },
  { code: "AR", label: uiText("countries.argentina"), dialCode: "+54" },
  { code: "BR", label: uiText("countries.brazil"), dialCode: "+55" },
  { code: "CL", label: uiText("countries.chile"), dialCode: "+56" },
  { code: "CO", label: uiText("countries.colombia"), dialCode: "+57" },
  { code: "PE", label: uiText("countries.peru"), dialCode: "+51" },
  { code: "GB", label: uiText("countries.unitedKingdom"), dialCode: "+44" },
  { code: "IE", label: uiText("countries.ireland"), dialCode: "+353" },
  { code: "FR", label: uiText("countries.france"), dialCode: "+33" },
  { code: "DE", label: uiText("countries.germany"), dialCode: "+49" },
  { code: "ES", label: uiText("countries.spain"), dialCode: "+34" },
  { code: "IT", label: uiText("countries.italy"), dialCode: "+39" },
  { code: "NL", label: uiText("countries.netherlands"), dialCode: "+31" },
  { code: "BE", label: uiText("countries.belgium"), dialCode: "+32" },
  { code: "LU", label: uiText("countries.luxembourg"), dialCode: "+352" },
  { code: "CH", label: uiText("countries.switzerland"), dialCode: "+41" },
  { code: "AT", label: uiText("countries.austria"), dialCode: "+43" },
  { code: "DK", label: uiText("countries.denmark"), dialCode: "+45" },
  { code: "SE", label: uiText("countries.sweden"), dialCode: "+46" },
  { code: "NO", label: uiText("countries.norway"), dialCode: "+47" },
  { code: "FI", label: uiText("countries.finland"), dialCode: "+358" },
  { code: "PL", label: uiText("countries.poland"), dialCode: "+48" },
  { code: "CZ", label: uiText("countries.czechRepublic"), dialCode: "+420" },
  { code: "SK", label: uiText("countries.slovakia"), dialCode: "+421" },
  { code: "HU", label: uiText("countries.hungary"), dialCode: "+36" },
  { code: "RO", label: uiText("countries.romania"), dialCode: "+40" },
  { code: "BG", label: uiText("countries.bulgaria"), dialCode: "+359" },
  { code: "HR", label: uiText("countries.croatia"), dialCode: "+385" },
  { code: "SI", label: uiText("countries.slovenia"), dialCode: "+386" },
  { code: "RS", label: uiText("countries.serbia"), dialCode: "+381" },
  { code: "GR", label: uiText("countries.greece"), dialCode: "+30" },
  { code: "PT", label: uiText("countries.portugal"), dialCode: "+351" },
  { code: "TR", label: uiText("countries.turkey"), dialCode: "+90" },
  { code: "UA", label: uiText("countries.ukraine"), dialCode: "+380" },
  { code: "AU", label: uiText("countries.australia"), dialCode: "+61" },
  { code: "NZ", label: uiText("countries.newZealand"), dialCode: "+64" },
  { code: "JP", label: uiText("countries.japan"), dialCode: "+81" },
  { code: "KR", label: uiText("countries.southKorea"), dialCode: "+82" },
  { code: "TW", label: uiText("countries.taiwan"), dialCode: "+886" },
  { code: "HK", label: uiText("countries.hongKong"), dialCode: "+852" },
  { code: "MO", label: uiText("countries.macau"), dialCode: "+853" },
  { code: "SG", label: uiText("countries.singapore"), dialCode: "+65" },
  { code: "TH", label: uiText("countries.thailand"), dialCode: "+66" },
  { code: "PH", label: uiText("countries.philippines"), dialCode: "+63" },
  { code: "MY", label: uiText("countries.malaysia"), dialCode: "+60" },
  { code: "ID", label: uiText("countries.indonesia"), dialCode: "+62" },
  { code: "VN", label: uiText("countries.vietnam"), dialCode: "+84" },
  { code: "IN", label: uiText("countries.india"), dialCode: "+91" },
  { code: "AE", label: uiText("countries.unitedArabEmirates"), dialCode: "+971" },
  { code: "SA", label: uiText("countries.saudiArabia"), dialCode: "+966" },
  { code: "QA", label: uiText("countries.qatar"), dialCode: "+974" },
  { code: "KW", label: uiText("countries.kuwait"), dialCode: "+965" },
  { code: "BH", label: uiText("countries.bahrain"), dialCode: "+973" },
  { code: "OM", label: uiText("countries.oman"), dialCode: "+968" },
  { code: "IL", label: uiText("countries.israel"), dialCode: "+972" },
  { code: "ZA", label: uiText("countries.southAfrica"), dialCode: "+27" },
  { code: "EG", label: uiText("countries.egypt"), dialCode: "+20" },
  { code: "MA", label: uiText("countries.morocco"), dialCode: "+212" },
];

const FLAG_FILES = import.meta.glob<string>(
  "/node_modules/flag-icons/flags/4x3/{us,ca,mx,ar,br,cl,co,pe,gb,ie,fr,de,es,it,nl,be,lu,ch,at,dk,se,no,fi,pl,cz,sk,hu,ro,bg,hr,si,rs,gr,pt,tr,ua,au,nz,jp,kr,tw,hk,mo,sg,th,ph,my,id,vn,in,ae,sa,qa,kw,bh,om,il,za,eg,ma}.svg",
  { eager: true, query: "?url", import: "default" },
);

export const COUNTRIES = [...LIST].sort((a, b) => a.label.localeCompare(b.label));

/** The flag image for a country code, or null. */
export function flagOf(code: string): string | null {
  return code ? (FLAG_FILES[`/node_modules/flag-icons/flags/4x3/${code.toLowerCase()}.svg`] ?? null) : null;
}

export function countryName(code: string): string {
  return LIST.find((country) => country.code === code)?.label ?? code;
}
