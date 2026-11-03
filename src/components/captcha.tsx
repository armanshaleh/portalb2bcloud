import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode(): string {
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

/**
 * Self-hosted CAPTCHA: distorted code rendered on canvas with noise,
 * so the portal has no third-party widget dependency.
 */
export function Captcha({ onValidityChange }: { onValidityChange: (ok: boolean) => void }) {
  const [code, setCode] = useState(generateCode);
  const [input, setInput] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const styles = getComputedStyle(document.documentElement);
    const card = styles.getPropertyValue("--card").trim() || "#10151d";
    const accent = styles.getPropertyValue("--primary").trim() || "#5fd8dd";

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = card;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // noise lines
    for (let i = 0; i < 5; i += 1) {
      ctx.strokeStyle = `rgba(120, 170, 190, ${0.15 + Math.random() * 0.2})`;
      ctx.beginPath();
      ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.stroke();
    }

    const chars = code.split("");
    const slot = canvas.width / (chars.length + 1);
    chars.forEach((ch, i) => {
      ctx.save();
      ctx.translate(slot * (i + 1), canvas.height / 2);
      ctx.rotate((Math.random() - 0.5) * 0.5);
      ctx.font = `700 ${26 + Math.random() * 6}px Manrope, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = i % 2 === 0 ? accent : "rgba(220, 235, 245, 0.9)";
      ctx.fillText(ch, 0, 0);
      ctx.restore();
    });

    // noise dots
    for (let i = 0; i < 40; i += 1) {
      ctx.fillStyle = `rgba(160, 200, 215, ${0.1 + Math.random() * 0.25})`;
      ctx.fillRect(
        Math.random() * canvas.width,
        Math.random() * canvas.height,
        2,
        2,
      );
    }
  }, [code]);

  useEffect(() => {
    draw();
  }, [draw]);

  function refresh() {
    setCode(generateCode());
    setInput("");
    onValidityChange(false);
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="captcha-input">Security check</Label>
      <div className="flex items-center gap-2">
        <canvas
          ref={canvasRef}
          width={168}
          height={52}
          className="h-[52px] w-[168px] rounded-md border border-border"
          aria-label="CAPTCHA challenge"
        />
        <button
          type="button"
          onClick={refresh}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          aria-label="New CAPTCHA"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
        <Input
          id="captcha-input"
          value={input}
          onChange={(e) => {
            const v = e.target.value;
            setInput(v);
            onValidityChange(v.trim().toUpperCase() === code);
          }}
          placeholder="Enter the code"
          maxLength={6}
          autoComplete="off"
          className="flex-1"
        />
      </div>
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <ShieldCheck className="h-3 w-3" />
        Type the 6 characters shown on the left (case insensitive).
      </p>
    </div>
  );
}
