export async function captureProcessStream(stream, fn) {
  const chunks = [];
  const originalWrite = stream.write;
  stream.write = function(chunk, encoding, callback) {
    chunks.push(String(chunk));
    if (typeof encoding === "function") encoding();
    if (typeof callback === "function") callback();
    return true;
  };
  try {
    await fn();
  } finally {
    stream.write = originalWrite;
  }
  return chunks.join("");
}

export function captureProcessStdout(fn) {
  return captureProcessStream(process.stdout, fn);
}

export function captureProcessStderr(fn) {
  return captureProcessStream(process.stderr, fn);
}
