"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { BODY_ZONES, SIZES, STYLES } from "@/lib/config";
import { api, ApiError } from "@/lib/client/api";
import { usePricing } from "@/lib/client/usePricing";
import { downloadBlob, prepareImage, type Prepared } from "@/lib/client/image";
import type { Placement } from "@/lib/schema";
import { AuthForm } from "./AuthForm";
import { Modal } from "./Modal";
import { Paywall } from "./Paywall";
import { PlacementEditor, type EditorHandle, type Ghost, type Tool } from "./PlacementEditor";

const STEPS = ["Foto", "Diseño", "Colocación"] as const;
const ZONE_LABEL: Record<string, string> = { brazo: "Brazo", antebrazo: "Antebrazo", mano: "Mano", pierna: "Pierna", espalda: "Espalda", cuello: "Cuello", otro: "Otra zona" };
const DEFAULT_PLACEMENT: Placement = { x: 0.5, y: 0.5, scale: 0.35, rotation: 0, opacity: 0.9 };

export function Wizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [credits, setCredits] = useState<number | null>(null);
  const { freeCredits } = usePricing();
  const [authOpen, setAuthOpen] = useState(false);
  const [paywall, setPaywall] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [photo, setPhoto] = useState<Prepared | null>(null);
  const [reference, setReference] = useState<Prepared | null>(null);
  // Modo estudio: cupo del estudio y catálogo de flash
  const [studio, setStudio] = useState<{ id: string; name: string; quota: number; used: number } | null>(null);
  const [useStudio, setUseStudio] = useState(true);
  const [flash, setFlash] = useState<{ id: string; name: string }[]>([]);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [flashBitmap, setFlashBitmap] = useState<ImageBitmap | null>(null);
  const [source, setSource] = useState<"describe" | "catalog">("describe");
  const [zone, setZone] = useState<(typeof BODY_ZONES)[number]>("antebrazo");
  const [description, setDescription] = useState("");
  const [style, setStyle] = useState<string>("fine-line");
  const [color, setColor] = useState<"bw" | "color">("bw");
  const [size, setSize] = useState<(typeof SIZES)[number]["id"]>("mediano");
  const [placement, setPlacement] = useState<Placement>(DEFAULT_PLACEMENT);
  const [tool, setTool] = useState<Tool>("move");
  const [brush, setBrush] = useState(0.06);
  const [hasMask, setHasMask] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);
  const editor = useRef<EditorHandle>(null);
  const live = useRef<HTMLParagraphElement>(null);

  const studioOn = Boolean(studio) && useStudio;
  const canContinue = [Boolean(photo), source === "catalog" ? Boolean(flashId) : description.trim().length > 0 || Boolean(reference), true][step]!;

  const pickPhoto = useCallback(async (file: File | undefined | null, kind: "photo" | "reference") => {
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      const p = await prepareImage(file, kind === "photo" ? 2048 : 1024);
      if (kind === "photo") {
        setPhoto(p);
        setHasMask(false);
        setPlacement(DEFAULT_PLACEMENT);
      } else setReference(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo usar esa imagen");
    } finally {
      setBusy(false);
    }
  }, []);

  const ghost: Ghost = useMemo(() => {
    if (source === "catalog" && flashBitmap) return { kind: "image", bitmap: flashBitmap };
    return reference ? { kind: "image", bitmap: reference.bitmap } : { kind: "placeholder" };
  }, [reference, source, flashBitmap]);

  // Tamaño inicial sugerido según el tamaño elegido
  useEffect(() => {
    const scale = size === "pequeno" ? 0.18 : size === "mediano" ? 0.32 : 0.55;
    setPlacement((p) => ({ ...p, scale }));
  }, [size]);

  useEffect(() => {
    live.current?.focus();
  }, [step]);

  // Saldo (si hay sesión) para avisar antes de gastar
  useEffect(() => {
    api<{ user: unknown; credits?: number; studio?: { id: string; name: string; active: boolean; quota: number; used: number } | null }>("/api/me")
      .then(async (m) => {
        setCredits(m.user ? (m.credits ?? 0) : null);
        if (m.studio?.active) {
          setStudio(m.studio);
          const f = await api<{ flash: { id: string; name: string }[] }>("/api/studio/flash").catch(() => ({ flash: [] }));
          setFlash(f.flash);
        }
      })
      .catch(() => {});
  }, []);

  // Al elegir un diseño del catálogo, se carga su imagen para usarla de guía en el editor
  useEffect(() => {
    setFlashBitmap(null);
    if (!flashId) return;
    let alive = true;
    fetch(`/api/studio/flash/${flashId}/image`)
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => (b ? createImageBitmap(b) : null))
      .then((bm) => alive && bm && setFlashBitmap(bm))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [flashId]);

  const submit = useCallback(async () => {
    if (!photo || !editor.current) return;
    setError("");
    setSubmitting(true);
    try {
      const form = new FormData();
      form.set(
        "options",
        JSON.stringify({
          zone,
          description: source === "catalog" ? "" : description.trim(),
          style,
          color,
          size,
          hasReference: source === "catalog" ? false : Boolean(reference),
          flashId: source === "catalog" && studioOn ? (flashId ?? undefined) : undefined,
          placement,
        }),
      );
      form.set("photo", photo.blob, "foto.jpg");
      if (reference && source !== "catalog") form.set("reference", reference.blob, "referencia.jpg");
      if (studioOn && studio) form.set("studio", studio.id);
      const mask = await editor.current.getMask();
      if (mask) form.set("mask", mask, "mascara.png");
      const { id } = await api<{ id: string }>("/api/jobs", { method: "POST", body: form });
      router.push(`/crear/${id}`);
    } catch (e) {
      setSubmitting(false);
      if (e instanceof ApiError && e.status === 401) setAuthOpen(true);
      else if (e instanceof ApiError && e.status === 402 && e.code === "quota") setError(e.message);
      else if (e instanceof ApiError && e.status === 402) setPaywall(true);
      else setError(e instanceof Error ? e.message : "Algo ha fallado. Inténtalo de nuevo");
    }
  }, [photo, zone, description, style, color, size, reference, placement, router, source, flashId, studioOn, studio]);

  const reset = () => {
    setStep(0);
    setPhoto(null);
    setReference(null);
    setDescription("");
    setPlacement(DEFAULT_PLACEMENT);
    setHasMask(false);
    setTool("move");
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="wrap max-w-5xl py-10 sm:py-14">
        <ol className="mb-10 flex items-center gap-2 sm:gap-4" aria-label="Progreso">
          {STEPS.map((s, i) => (
            <li key={s} className="flex flex-1 items-center gap-3" aria-current={i === step ? "step" : undefined}>
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border text-sm font-bold ${i < step ? "border-stencil bg-stencil text-ink" : i === step ? "border-stencil text-stencil" : "border-line text-mute"}`}>
                {i < step ? "✓" : i + 1}
              </span>
              <span className={`text-sm font-semibold ${i === step ? "text-bone" : "text-mute"} max-sm:hidden`}>{s}</span>
              {i < STEPS.length - 1 && <span aria-hidden="true" className="h-px flex-1 bg-line" />}
            </li>
          ))}
        </ol>

        <AnimatePresence mode="wait">
          <motion.section key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }} aria-labelledby="paso-titulo">
            <p ref={live} tabIndex={-1} className="sr-only" aria-live="polite">{`Paso ${step + 1} de 3: ${STEPS[step]}`}</p>

            {step === 0 && (
              <div className="grid gap-8">
                <h1 id="paso-titulo" className="text-[clamp(2rem,4.5vw,3.4rem)]">Sube la foto de tu piel</h1>
                {!photo ? (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDrag(true);
                    }}
                    onDragLeave={() => setDrag(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDrag(false);
                      void pickPhoto(e.dataTransfer.files[0], "photo");
                    }}
                    className={`grid place-items-center gap-5 rounded-[10px] border border-dashed px-6 py-14 text-center transition-colors ${drag ? "border-stencil bg-stencil/10" : "border-line bg-panel"}`}
                  >
                    <svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden="true">
                      <rect x="5" y="9" width="34" height="26" rx="4" stroke="#a58bff" strokeWidth="2" />
                      <circle cx="16" cy="19" r="3.5" stroke="#a58bff" strokeWidth="2" />
                      <path d="M5 31 L16 23 L24 29 L31 22 L39 29" stroke="#a58bff" strokeWidth="2" strokeLinejoin="round" />
                    </svg>
                    <div>
                      <p className="text-xl font-semibold">Arrastra una foto aquí</p>
                      <p className="hint mt-1">JPG, PNG, WEBP o HEIC. Mejor con buena luz y la zona bien enfocada.</p>
                    </div>
                    <div className="flex flex-wrap justify-center gap-3">
                      <label className="btn btn-primary cursor-pointer">
                        Elegir de la galería
                        <input data-testid="photo-input" type="file" accept="image/*,.heic,.heif" className="sr-only" onChange={(e) => void pickPhoto(e.target.files?.[0], "photo")} />
                      </label>
                      <label className="btn btn-ghost cursor-pointer">
                        Hacer una foto
                        <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => void pickPhoto(e.target.files?.[0], "photo")} />
                      </label>
                    </div>
                    {busy && <p role="status" className="hint">Preparando la imagen…</p>}
                  </div>
                ) : (
                  <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
                    <PhotoPreview photo={photo} />
                    <div className="grid gap-4">
                      <p className="notice ok">Foto lista ({photo.width}×{photo.height}). Se queda en tu navegador hasta que generes el resultado.</p>
                      <button className="btn btn-ghost" onClick={() => setPhoto(null)}>Cambiar de foto</button>
                    </div>
                  </div>
                )}
                <fieldset className="grid gap-3">
                  <legend className="label mb-1">¿Dónde va el tatuaje?</legend>
                  <div className="flex flex-wrap gap-2" role="group">
                    {BODY_ZONES.map((z) => (
                      <button key={z} type="button" className="chip" aria-pressed={zone === z} onClick={() => setZone(z)}>{ZONE_LABEL[z]}</button>
                    ))}
                  </div>
                </fieldset>
                <p className="hint max-w-[62ch]">Sin desnudos ni menores. Tus fotos no se publican y se borran a las 24 horas de generar el resultado.</p>
              </div>
            )}

            {step === 1 && (
              <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
                <div className="grid gap-7">
                  <h1 id="paso-titulo" className="text-[clamp(2rem,4.5vw,3.4rem)]">¿Qué tatuaje quieres?</h1>
                  {studio && flash.length > 0 && (
                    <div role="group" aria-label="Origen del diseño" className="flex flex-wrap gap-2">
                      <button type="button" className="chip" aria-pressed={source === "describe"} onClick={() => setSource("describe")}>Describirlo</button>
                      <button type="button" className="chip" aria-pressed={source === "catalog"} onClick={() => setSource("catalog")}>Del catálogo de {studio.name}</button>
                    </div>
                  )}
                  {source === "catalog" && (
                    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Catálogo de diseños">
                      {flash.map((f) => (
                        <li key={f.id}>
                          <button type="button" aria-pressed={flashId === f.id} onClick={() => setFlashId(f.id)} className={`block w-full overflow-hidden rounded-[10px] border text-left ${flashId === f.id ? "border-stencil" : "border-line hover:border-stencil/60"}`}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={`/api/studio/flash/${f.id}/image`} alt="" className="aspect-square w-full bg-white object-contain" />
                            <span className="block p-2 text-sm font-semibold">{f.name}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {source === "describe" && (<>
                  <div className="field">
                    <label htmlFor="desc">Descríbelo</label>
                    <textarea id="desc" className="textarea" maxLength={400} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Un lobo geométrico en línea fina, blanco y negro, minimalista" />
                    <p className="hint">{description.length}/400. Cuéntalo con tus palabras: no hace falta escribir nada técnico.</p>
                  </div>
                  <div className="field">
                    <span className="label">Referencia (opcional)</span>
                    <p className="hint">Sube otro tatuaje, un dibujo o una foto parecida. Puedes combinarla con el texto: «como esta, pero con rosas».</p>
                    {reference ? (
                      <div className="flex items-center gap-4">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={URL.createObjectURL(reference.blob)} alt="Tu referencia" className="h-24 w-24 rounded-md border border-line object-cover" />
                        <button className="btn btn-ghost btn-sm" onClick={() => setReference(null)}>Quitar referencia</button>
                      </div>
                    ) : (
                      <label className="btn btn-ghost w-fit cursor-pointer">
                        Subir referencia
                        <input data-testid="ref-input" type="file" accept="image/*,.heic,.heif" className="sr-only" onChange={(e) => void pickPhoto(e.target.files?.[0], "reference")} />
                      </label>
                    )}
                  </div>
                  </>)}
                </div>
                <div className="grid content-start gap-7">
                  <fieldset className="grid gap-3">
                    <legend className="label mb-1">Estilo</legend>
                    <div className="flex flex-wrap gap-2" role="group">
                      {STYLES.map((s) => (
                        <button key={s.id} type="button" className="chip" aria-pressed={style === s.id} onClick={() => setStyle(s.id)}>{s.label}</button>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset className="grid gap-3">
                    <legend className="label mb-1">Color</legend>
                    <div className="flex gap-2" role="group">
                      <button type="button" className="chip" aria-pressed={color === "bw"} onClick={() => setColor("bw")}>Blanco y negro</button>
                      <button type="button" className="chip" aria-pressed={color === "color"} onClick={() => setColor("color")}>Color</button>
                    </div>
                  </fieldset>
                  <fieldset className="grid gap-3">
                    <legend className="label mb-1">Tamaño aproximado</legend>
                    <div className="flex flex-wrap gap-2" role="group">
                      {SIZES.map((s) => (
                        <button key={s.id} type="button" className="chip" aria-pressed={size === s.id} onClick={() => setSize(s.id)}>{s.label}</button>
                      ))}
                    </div>
                  </fieldset>
                </div>
              </div>
            )}

            {step === 2 && photo && (
              <div className="grid gap-8">
                <div>
                  <h1 id="paso-titulo" className="text-[clamp(2rem,4.5vw,3.4rem)]">Colócalo en tu piel</h1>
                  <p className="measure mt-3 text-bone/75">Mueve el diseño con el dedo o el ratón. Con dos dedos cambias el tamaño y el giro. Si quieres, pinta la zona exacta donde debe ir.</p>
                </div>
                <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,19rem)]">
                  <PlacementEditor ref={editor} photo={photo.bitmap} ghost={ghost} placement={placement} onPlacement={setPlacement} tool={tool} brush={brush} onMaskChange={setHasMask} />
                  <div className="grid gap-6">
                    <div role="radiogroup" aria-label="Herramienta" className="grid grid-cols-3 gap-2">
                      {([
                        ["move", "Mover"],
                        ["paint", "Pintar"],
                        ["erase", "Borrar"],
                      ] as const).map(([id, label]) => (
                        <button key={id} role="radio" aria-checked={tool === id} aria-label={id === "paint" ? "Pintar zona" : undefined} className="chip justify-center rounded-md" onClick={() => setTool(id)}>{label}</button>
                      ))}
                    </div>
                    {tool === "move" ? (
                      <>
                        <Slider label="Tamaño" min={3} max={100} value={Math.round(placement.scale * 100)} unit="%" onChange={(v) => setPlacement({ ...placement, scale: v / 100 })} />
                        <Slider label="Giro" min={-180} max={180} value={Math.round(placement.rotation)} unit="°" onChange={(v) => setPlacement({ ...placement, rotation: v })} />
                        <Slider label="Opacidad" min={20} max={100} value={Math.round(placement.opacity * 100)} unit="%" onChange={(v) => setPlacement({ ...placement, opacity: v / 100 })} />
                        <button className="btn btn-quiet justify-self-start" onClick={() => setPlacement({ ...DEFAULT_PLACEMENT, scale: placement.scale })}>Centrar y enderezar</button>
                      </>
                    ) : (
                      <>
                        <Slider label="Grosor del pincel" min={1} max={20} value={Math.round(brush * 100)} unit="" onChange={(v) => setBrush(v / 100)} />
                        <button className="btn btn-quiet justify-self-start" disabled={!hasMask} onClick={() => editor.current?.clearMask()}>Limpiar la zona pintada</button>
                        <p className="hint">La zona pintada limita dónde se aplica el tatuaje. Si no pintas nada, se usa el recuadro del diseño.</p>
                      </>
                    )}
                    <hr className="rule" />
                    <div className="grid gap-2 text-sm text-bone/75">
                      <p><strong className="text-bone">{ZONE_LABEL[zone]}</strong>, {STYLES.find((s) => s.id === style)?.label.toLowerCase()}, {color === "bw" ? "blanco y negro" : "color"}</p>
                      {description && <p className="line-clamp-3">“{description}”</p>}
                    </div>
                  </div>
                </div>
                <div className="grid max-w-3xl gap-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <button className="btn btn-primary text-[1.05rem]" disabled={submitting} onClick={credits === 0 && !studioOn ? () => setPaywall(true) : submit}>
                      {submitting ? "Enviando…" : "Generar mi tatuaje"}
                    </button>
                    <button className="btn btn-ghost" onClick={async () => editor.current && downloadBlob(await editor.current.snapshot(), "calco-colocacion.png")}>Descargar mi colocación</button>
                    <button className="btn btn-quiet" onClick={reset}>Empezar otra prueba</button>
                  </div>
                  {studio && (
                    <label className="flex items-center gap-3 text-sm">
                      <input type="checkbox" className="h-5 w-5 accent-[#a58bff]" checked={useStudio} onChange={(e) => { setUseStudio(e.target.checked); if (!e.target.checked) { setSource("describe"); setFlashId(null); } }} />
                      Usar el cupo de {studio.name} ({studio.used}/{studio.quota} este mes)
                    </label>
                  )}
                  <p className="hint">
                    {studioOn ? "No gasta tus créditos: cuenta en el cupo del estudio." : credits === null ? `Te pediremos entrar con tu email. Tienes ${freeCredits} pruebas gratis.` : `Usa 1 crédito. Te quedan ${credits}.`} Tus fotos se borran a las 24 horas.
                  </p>
                </div>
              </div>
            )}

            {error && <p role="alert" className="notice error mt-6">{error}</p>}

            {step < 2 && (
              <div className="mt-10 flex items-center justify-between gap-3">
                {step > 0 ? <button className="btn btn-ghost" onClick={() => setStep(step - 1)}>Atrás</button> : <span />}
                <button className="btn btn-primary" disabled={!canContinue || busy} onClick={() => setStep(step + 1)}>
                  {step === 0 ? "Continuar con el diseño" : "Continuar con la colocación"}
                </button>
              </div>
            )}
            {step === 2 && (
              <div className="mt-8">
                <button className="btn btn-quiet" onClick={() => setStep(1)}>Volver al diseño</button>
              </div>
            )}
          </motion.section>
        </AnimatePresence>
      </div>
      <Modal open={authOpen} onClose={() => setAuthOpen(false)} title="Entra para generar tu tatuaje">
        <p className="text-bone/80">Así guardamos tu resultado y evitamos abusos de las pruebas gratuitas. Tu foto y tu colocación se quedan aquí.</p>
        <AuthForm
          compact
          showGoogle={false}
          turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY}
          onSignedIn={() => {
            setAuthOpen(false);
            void submit();
          }}
        />
      </Modal>
      <Paywall open={paywall} onClose={() => setPaywall(false)} />
    </MotionConfig>
  );
}

function PhotoPreview({ photo }: { photo: Prepared }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = photo.width;
    c.height = photo.height;
    c.getContext("2d")!.drawImage(photo.bitmap, 0, 0);
  }, [photo]);
  return <canvas ref={ref} role="img" aria-label="Tu foto" className="max-h-[60dvh] w-full rounded-[10px] border border-line object-contain" />;
}

function Slider({ label, min, max, value, unit, onChange }: { label: string; min: number; max: number; value: number; unit: string; onChange: (v: number) => void }) {
  const id = `s-${label}`;
  return (
    <div className="field">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id}>{label}</label>
        <span className="text-sm tabular-nums text-mute">{value}{unit}</span>
      </div>
      <input id={id} type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-11 w-full accent-[#a58bff]" />
    </div>
  );
}
