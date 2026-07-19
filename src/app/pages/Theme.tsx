import * as React from "react";
import { Copy, Paintbrush } from "lucide-react";
import { api } from "../api";
import { useToast } from "../App";
import { applySkin, type Skin } from "../../ui/skins/skin";
import { skinPresets } from "../../ui/skins/presets";
import { Button } from "../../ui/primitives/Button";
import { Input, Micro } from "../../ui/primitives/fields";

/* Theme editor — the settings surface DOGFOODS the app's own data spine: the
   edited skin applies live and persists as app_state["theme:skin"] (loaded at
   boot, after the config skin). Export copies the JSON for starter.config.json. */

export function ThemePage() {
  const toast = useToast();
  const [skin, setSkin] = React.useState<Skin>({ name: "custom", brand: { primary: "#4f46e5" } });

  React.useEffect(() => {
    api.state().then((s) => {
      const saved = s["theme:skin"] as Skin | undefined;
      if (saved) setSkin(saved);
    }).catch(() => {});
  }, []);

  const update = (patch: Partial<Skin> & { brand?: Skin["brand"]; chrome?: Skin["chrome"] }) => {
    const next = { ...skin, ...patch, name: "custom" };
    setSkin(next);
    applySkin(next);
    api.setState("theme:skin", next).catch(() => {});
  };

  const radiusScale =
    typeof skin.radius === "number" ? skin.radius : skin.radius ? skin.radius.m / 9 : 1;

  return (
    <div style={{ display: "grid", gap: 14, maxWidth: 640 }}>
      <div className="nxCard" style={{ padding: 18, display: "grid", gap: 14 }}>
        <Micro>Live theme editor — changes apply instantly and persist</Micro>

        <label style={{ display: "grid", gap: 4 }}>
          <Micro>Start from a preset</Micro>
          <div style={{ display: "flex", gap: 8 }}>
            {Object.entries(skinPresets).map(([key, preset]) => (
              <Button key={key} size="sm" data-testid={`theme-preset-${key}`}
                onClick={() => { setSkin(preset); applySkin(preset); api.setState("theme:skin", preset).catch(() => {}); }}>
                <Paintbrush size={12} /> {key}
              </Button>
            ))}
          </div>
        </label>

        <label style={{ display: "grid", gap: 4, maxWidth: 320 }}>
          <Micro>Brand color</Micro>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="color"
              value={skin.brand?.primary ?? "#4f46e5"}
              data-testid="theme-brand"
              onChange={(e) => update({ brand: { ...skin.brand, primary: e.target.value } })}
              style={{ width: 44, height: 32, border: "1px solid var(--nx-border)", borderRadius: "var(--nx-radius-s)", background: "none", padding: 2 }}
            />
            <Input
              value={skin.brand?.primary ?? ""}
              data-testid="theme-brand-hex"
              onChange={(e) => /^#[0-9a-fA-F]{6}$/.test(e.target.value) && update({ brand: { ...skin.brand, primary: e.target.value } })}
            />
          </div>
        </label>

        <label style={{ display: "grid", gap: 4, maxWidth: 320 }}>
          <Micro>Corner personality — {radiusScale === 0 ? "squared" : radiusScale.toFixed(2)}</Micro>
          <input
            type="range" min="0" max="1.5" step="0.25" value={radiusScale}
            data-testid="theme-radius"
            onChange={(e) => update({ radius: Number(e.target.value) })}
          />
        </label>

        <label style={{ display: "grid", gap: 4, maxWidth: 200 }}>
          <Micro>Shell (chrome)</Micro>
          <select
            className="nxCellEdit"
            value={skin.chrome?.style ?? "light"}
            data-testid="theme-chrome"
            onChange={(e) => update({ chrome: e.target.value === "light" ? undefined : { ...skin.chrome, style: e.target.value as "dark" | "brand" } })}
          >
            <option value="light">light</option>
            <option value="dark">dark</option>
            <option value="brand">brand</option>
          </select>
        </label>

        <label style={{ display: "grid", gap: 4, maxWidth: 200 }}>
          <Micro>Micro labels</Micro>
          <select
            className="nxCellEdit"
            value={skin.labels ?? "uppercase"}
            data-testid="theme-labels"
            onChange={(e) => update({ labels: e.target.value as "uppercase" | "normal" })}
          >
            <option value="uppercase">UPPERCASE</option>
            <option value="normal">Sentence case</option>
          </select>
        </label>

        <div style={{ display: "flex", gap: 8 }}>
          <Button
            icon={<Copy size={13} />} data-testid="theme-export"
            onClick={() => {
              const json = JSON.stringify(skin, null, 2);
              navigator.clipboard?.writeText(json).catch(() => {});
              toast("Skin JSON copied — paste into starter.config.json theme.skin");
            }}
          >
            Export JSON
          </Button>
          <Button
            variant="ghost" data-testid="theme-reset"
            onClick={() => {
              api.setState("theme:skin", null).then(() => {
                toast("Reset to the config skin — reload to apply");
              }).catch(() => {});
            }}
          >
            Reset to config
          </Button>
        </div>
      </div>
    </div>
  );
}
