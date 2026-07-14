import type { LeaderboardEntry } from "@quiz/shared";

export default function Leaderboard({ entries }: { entries: LeaderboardEntry[] }) {
  return (
    <ol className="flex flex-col gap-2">
      {entries.map((entry, index) => (
        <li
          key={entry.userId}
          className="flex items-center justify-between rounded border border-black/10 px-4 py-2"
        >
          <span>
            <span className="mr-2 text-black/50">#{index + 1}</span>
            {entry.name}
          </span>
          <span className="font-semibold">{entry.score}</span>
        </li>
      ))}
    </ol>
  );
}
