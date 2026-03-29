import { downloadBlob } from "./svgExport";

export function exportPng(
    svgElement: SVGSVGElement,
    filename: string = "moire-pattern.png",
    scale: number = 2,
) {
    const serializer = new XMLSerializer();
    let svgString = serializer.serializeToString(svgElement);

    if (!svgString.includes('xmlns="http://www.w3.org/2000/svg"')) {
        svgString = svgString.replace(
            "<svg",
            '<svg xmlns="http://www.w3.org/2000/svg"',
        );
    }

    const width = svgElement.width.baseVal.value * scale;
    const height = svgElement.height.baseVal.value * scale;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    const svgBlob = new Blob([svgString], {
        type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);

        canvas.toBlob((blob) => {
            if (blob) {
                downloadBlob(blob, filename);
            }
        }, "image/png");
    };

    img.src = url;
}
