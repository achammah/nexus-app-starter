import * as React from "react";
import { RotateCcw } from "lucide-react";
import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import type { PageConfig } from "../api";
import { t } from "../i18n";
import { Button } from "../../ui/primitives/Button";
import { Tip } from "../../ui/primitives/fields";
import { ThinkingDots } from "../../ui/primitives/ThinkingDots";
import WhiteboardCanvas from "../../ui/record-core/fields/whiteboard/WhiteboardCanvas";
import { isScene, type WhiteboardScene } from "../../ui/record-core/fields/whiteboard/scene";
import { resolveWhiteboardConfig } from "../../ui/record-core/fields/whiteboard/config";
import { resolveTemplate } from "../../ui/record-core/fields/whiteboard/templates";
import { usePageDoc, wbDocKey } from "./pageHost";

/* Free-surface whiteboard page — the full-depth excalidraw canvas (every native tool,
   the ops rail, image + template insert) as a standalone nav surface, its scene stored
   under a per-page app-state key (NOT record data), seeded with a rich demo board and
   autosaved. This is a config.pages[] { kind:"whiteboard" } host: it reuses the same
   WhiteboardCanvas the record FIELD uses — a page, not a reduced embed. Loaded as a
   lazy chunk (excalidraw is heavy), so an app with no whiteboard page pays ~0 eager. */

/* ---- the seeded "War Room" board. excalidraw's hand-drawn font renders WIDER than
   convertToExcalidrawElements' text-measure, so hand-authored labels shear their edge
   glyphs (a documented quirk — templates.ts spends three comments on it). Rather than
   fight the estimate, the seed COMPOSES the KNOWN-GOOD built-in template skeletons
   (kanban lanes + a mindmap + a timeline, all tuned to render clean) into one dense
   board — the same skeletons the canvas's Templates menu inserts, so it is guaranteed
   legible. Converted in-browser (the same path WhiteboardCanvas uses for template
   insert), so a fresh page opens on a real project board, not an empty canvas. ---- */
type Skel = Record<string, unknown>;
const shift = (s: Skel, dx: number, dy: number): Skel => ({
  ...s,
  x: (typeof s.x === "number" ? s.x : 0) + dx,
  y: (typeof s.y === "number" ? s.y : 0) + dy,
});
const tpl = (key: "kanban" | "matrix2x2" | "flow" | "timeline" | "mindmap", dx: number, dy: number): Skel[] =>
  (resolveTemplate(key)?.skeletons ?? []).map((s) => shift(s as Skel, dx, dy));

function warRoomSkeletons(): Skel[] {
  return [
    // short text only — excalidraw re-measures free text at mount (a Virgil font-load
    // race), so long strings shear their tail regardless of width; keep titles terse
    { type: "text", x: 0, y: -8, text: "War Room", fontSize: 30, strokeColor: "#1e1e1e" },
    { type: "text", x: 0, y: 36, text: "A live board", fontSize: 14, strokeColor: "#868e96" },
    ...tpl("kanban", 0, 70),        // three lanes with sticky notes (tuned, clean)
    ...tpl("mindmap", 800, 90),     // a linked idea web to its right
    ...tpl("timeline", 0, 600),     // a Q1–Q4 timeline beneath
  ];
}

function seedWarRoom(): WhiteboardScene {
  const elements = convertToExcalidrawElements(warRoomSkeletons() as never) as unknown as WhiteboardScene["elements"];
  return { elements };
}

export default function WhiteboardPage({ page }: { page: PageConfig }) {
  const KEY = wbDocKey(page.key);
  const config = React.useMemo(() => resolveWhiteboardConfig(page.whiteboard), [page.whiteboard]);
  const { phase, initial, reloadNonce, save, saveState, reseed } = usePageDoc<WhiteboardScene>(KEY, isScene, seedWarRoom);

  const bar = (
    <div className="nxPageBar" data-testid="wb-page-bar">
      <span className="nxPageBarTitle">{page.label}</span>
      <span className="nxSpacer" style={{ flex: 1 }} />
      <span className="nxWorkbookSave" data-state={saveState} data-testid="wb-page-save">
        {saveState === "saving" ? <ThinkingDots label={t("page.saving")} /> : null}
        {saveState === "saving" ? t("page.saving") : saveState === "saved" ? t("page.saved") : ""}
      </span>
      <Tip label={t("page.whiteboard.reset")}>
        <Button size="sm" variant="ghost" icon={<RotateCcw size={13} />} aria-label={t("page.whiteboard.reset")} data-testid="wb-page-reset" onClick={reseed} />
      </Tip>
    </div>
  );

  return (
    <div className="pageBleed nxCanvasPage" data-testid={`page-whiteboard-${page.key}`}>
      {bar}
      {phase === "loading" || !initial ? (
        <div className="nxPageLoading nx-rise-in-sm" data-testid="wb-page-loading">
          <ThinkingDots label={t("page.generic.loading")} />
          <span>{t("page.generic.loading")}</span>
        </div>
      ) : (
        <div className="nxCanvasPageBody">
          <WhiteboardCanvas
            value={initial}
            onSave={save}
            config={config}
            boardId={KEY}
            epoch={`${page.key}:${reloadNonce}`}
          />
        </div>
      )}
    </div>
  );
}
