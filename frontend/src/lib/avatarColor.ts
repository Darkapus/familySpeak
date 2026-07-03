const PALETTE = [
  { bg: "bg-rose-400", text: "text-rose-900" },
  { bg: "bg-orange-400", text: "text-orange-900" },
  { bg: "bg-amber-400", text: "text-amber-900" },
  { bg: "bg-lime-500", text: "text-lime-950" },
  { bg: "bg-emerald-400", text: "text-emerald-900" },
  { bg: "bg-cyan-400", text: "text-cyan-950" },
  { bg: "bg-blue-400", text: "text-blue-950" },
  { bg: "bg-violet-400", text: "text-violet-950" },
  { bg: "bg-fuchsia-400", text: "text-fuchsia-950" },
];

export function avatarColorForId(id: string): { bg: string; text: string } {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length]!;
}
