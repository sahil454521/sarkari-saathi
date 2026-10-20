import { Composition, staticFile } from "remotion";
import { getAudioDurationInSeconds } from "@remotion/media-utils";
import { Showcase } from "./Showcase.tsx";
import { AUDIO_FILES, FPS, buildTimeline } from "./timeline.ts";
import type { Durations } from "./timeline.ts";

export function Root() {
  return (
    <Composition
      id="Showcase"
      component={Showcase}
      width={1080}
      height={1920}
      fps={FPS}
      durationInFrames={60 * FPS}
      defaultProps={{ durations: {} as Durations }}
      // The timeline is laid out from the real audio lengths, so measure them first.
      calculateMetadata={async () => {
        const entries = await Promise.all(AUDIO_FILES.map(async (f) => [f, await getAudioDurationInSeconds(staticFile(`audio/${f}`))] as const));
        const durations = Object.fromEntries(entries) as Durations;
        return { durationInFrames: buildTimeline(durations).total, props: { durations } };
      }}
    />
  );
}
