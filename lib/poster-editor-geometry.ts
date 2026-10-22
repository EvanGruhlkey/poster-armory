export function fitPosterInStage(stageWidth: number, stageHeight: number, aspect: number, padding: number) {
  const width = Math.max(0, stageWidth - padding * 2);
  const height = Math.max(0, stageHeight - padding * 2);
  const fittedWidth = Math.min(width, height * aspect);
  return { width: fittedWidth, height: fittedWidth / aspect };
}
