export async function gzipString(value: string): Promise<Blob> {
  const bytes = new TextEncoder().encode(value);
  const inputStream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });

  const compressed = inputStream.pipeThrough(new CompressionStream("gzip"));
  return new Response(compressed).blob();
}

export async function downloadTextFile(filename: string, value: string) {
  const blob = new Blob([value], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
