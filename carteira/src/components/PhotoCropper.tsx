import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ZoomIn } from "lucide-react";

interface PhotoCropperProps {
  file: File;
  onCancel: () => void;
  /** Recebe a foto final 3×4 (600×800, JPEG) */
  onConfirm: (blob: Blob) => void;
  busy?: boolean;
}

const OUT_W = 600;
const OUT_H = 800;

/**
 * Recorte 3×4: arrasta para posicionar e usa o controle para aproximar.
 * Tudo no próprio aparelho; só a foto recortada é enviada.
 */
export function PhotoCropper({ file, onCancel, onConfirm, busy }: PhotoCropperProps) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => setImg(image);
    image.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Escala mínima para a foto cobrir o quadro 3×4
  const cover = img ? Math.max(OUT_W / img.naturalWidth, OUT_H / img.naturalHeight) : 1;
  const scale = cover * zoom;

  const clamp = (x: number, y: number) => {
    if (!img) return { x, y };
    const maxX = Math.max(0, (img.naturalWidth * scale - OUT_W) / 2);
    const maxY = Math.max(0, (img.naturalHeight * scale - OUT_H) / 2);
    return { x: Math.min(maxX, Math.max(-maxX, x)), y: Math.min(maxY, Math.max(-maxY, y)) };
  };

  useEffect(() => setOffset((o) => clamp(o.x, o.y)), [zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  // Conversão de pixels da tela para pixels do quadro de saída
  const ratio = () => OUT_W / (frame.current?.clientWidth || OUT_W);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const r = ratio();
    setOffset(clamp(drag.current.ox + (e.clientX - drag.current.x) * r, drag.current.oy + (e.clientY - drag.current.y) * r));
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  const confirm = () => {
    if (!img) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUT_W;
    canvas.height = OUT_H;
    const ctx = canvas.getContext("2d")!;
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    ctx.drawImage(img, (OUT_W - w) / 2 + offset.x, (OUT_H - h) / 2 + offset.y, w, h);
    canvas.toBlob((blob) => blob && onConfirm(blob), "image/jpeg", 0.88);
  };

  const r = frame.current ? frame.current.clientWidth / OUT_W : 0.4;

  return (
    <div className="space-y-4">
      <div
        ref={frame}
        className="relative mx-auto aspect-[3/4] w-full max-w-[260px] touch-none select-none overflow-hidden rounded-lg border-2 border-gold bg-neutral-900"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {img && (
          <img
            src={img.src}
            alt="Pré-visualização da foto"
            draggable={false}
            className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
            style={{
              width: img.naturalWidth * scale * r,
              height: img.naturalHeight * scale * r,
              transform: `translate(calc(-50% + ${offset.x * r}px), calc(-50% + ${offset.y * r}px))`,
            }}
          />
        )}
      </div>
      <p className="text-center text-xs text-muted-foreground">Arraste para centralizar o rosto.</p>
      <div className="mx-auto flex max-w-[260px] items-center gap-3">
        <ZoomIn className="h-4 w-4 shrink-0 text-muted-foreground" />
        <Slider value={[zoom]} min={1} max={3} step={0.01} onValueChange={([v]) => setZoom(v)} aria-label="Aproximar" />
      </div>
      <div className="flex justify-center gap-2">
        <Button variant="outline" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button onClick={confirm} disabled={!img || busy}>
          {busy ? "Enviando..." : "Usar esta foto"}
        </Button>
      </div>
    </div>
  );
}
