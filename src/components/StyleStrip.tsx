import { STYLES } from "@/lib/config";
import { designSvg } from "@/lib/providers/mock";

const SAMPLES: Record<string, string> = {
  "fine-line": "luna",
  realista: "rosa",
  "old-school": "ancla",
  neotradicional: "serpiente",
  blackwork: "sol",
  acuarela: "ola",
  japones: "dragon",
  geometrico: "lobo",
  lettering: "carpe",
  minimalista: "montana",
};
const PAD = "max(1rem, calc((100vw - 76rem) / 2))";
const SKIN = ["#d6a081", "#c98f6b", "#b9805c", "#dcae92", "#c28965", "#d19b7a"];

/** Tira horizontal de estilos: cada panel es un trozo de piel con un diseño de ejemplo multiplicado encima. */
export function StyleStrip() {
  return (
    <ul className="flex snap-x gap-4 overflow-x-auto pb-6 [scrollbar-width:thin]" style={{ paddingInline: PAD, scrollPaddingInline: PAD }} aria-label="Estilos disponibles">
      {STYLES.map((s, i) => {
        const svg = designSvg(SAMPLES[s.id] ?? s.id, s.id, s.id === "acuarela" || s.id === "neotradicional" ? "color" : "bw");
        const uri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
        return (
          <li key={s.id} className="w-[15.5rem] shrink-0 snap-start sm:w-[17rem]">
            <div className="relative aspect-[3/4] overflow-hidden rounded-[10px] border border-line" style={{ background: `linear-gradient(160deg, ${SKIN[i % SKIN.length]}, #8f5d41)` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={uri} alt="" className="absolute inset-[12%] h-[76%] w-[76%] opacity-90" style={{ mixBlendMode: "multiply" }} />
            </div>
            <p className="mt-3 font-semibold">{s.label}</p>
          </li>
        );
      })}
    </ul>
  );
}
