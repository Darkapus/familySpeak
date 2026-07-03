import { avatarColorForId } from "../lib/avatarColor.js";

const SIZE_CLASSES = {
  sm: "h-8 w-8 text-sm",
  md: "h-11 w-11 text-lg",
  lg: "h-14 w-14 text-2xl",
};

export function Avatar({
  id,
  name,
  size = "md",
}: {
  id: string;
  name: string;
  size?: keyof typeof SIZE_CLASSES;
}) {
  const { bg, text } = avatarColorForId(id);
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-bold ${bg} ${text} ${SIZE_CLASSES[size]}`}
    >
      {initial}
    </div>
  );
}
