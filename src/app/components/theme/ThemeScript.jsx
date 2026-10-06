import { isValidThemePreference, THEME_STORAGE_KEY } from "@/lib/theme";

/**
 * Sets the theme on <html> before the browser paints, which is the only way
 * to avoid a flash of the wrong palette: React hydration happens after first
 * paint, so a theme applied in an effect is always one frame too late.
 *
 * Order of truth:
 *   1. the server value, when there's a signed-in profile to read it from
 *   2. the localStorage mirror, for signed-out visits and a cold session
 *   3. "system"
 *
 * `preference` only ever comes from the validated enum, so interpolating it
 * is safe — and it goes through JSON.stringify regardless.
 */
export default function ThemeScript({ preference }) {
  const serverPreference = isValidThemePreference(preference) ? preference : "";

  const key = JSON.stringify(THEME_STORAGE_KEY);

  // Writing the server value into the mirror here, before React runs, is what
  // lets ThemeProvider treat the mirror as the fresher of the two sources
  // without a sync effect.
  const script = `(function(){try{
var s=${JSON.stringify(serverPreference)};
var p=s;
if(p){try{localStorage.setItem(${key},p)}catch(e){}}
else{try{p=localStorage.getItem(${key})||""}catch(e){p=""}}
if(p!=="light"&&p!=="dark"&&p!=="system"){p="system"}
var d=p==="dark"||(p==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);
var r=document.documentElement;
r.classList.toggle("dark",d);
r.style.colorScheme=d?"dark":"light";
}catch(e){}})();`;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
