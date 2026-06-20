"use client";

import { useState } from "react";

function fallbackUrls(appId: number): string[] {
  return [
    `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`,
    `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/capsule_616x353.jpg`,
    `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/library_600x900.jpg`,
  ];
}

export default function GameImage({
  appId,
  name,
  className,
}: {
  appId: number;
  name: string;
  className?: string;
}) {
  const urls = fallbackUrls(appId);
  const [index, setIndex] = useState(0);

  if (index >= urls.length) {
    return (
      <div
        className={`${className ?? ""} bg-zinc-800 flex items-center justify-center text-zinc-500 text-xs text-center p-1`}
      >
        {name}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={urls[index]}
      alt={name}
      className={className}
      onError={() => setIndex((i) => i + 1)}
    />
  );
}
