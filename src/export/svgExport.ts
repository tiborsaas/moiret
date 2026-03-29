export function exportSvg(
    svgElement: SVGSVGElement,
    filename: string = "moire-pattern.svg",
) {
    const serializer = new XMLSerializer();
    let svgString = serializer.serializeToString(svgElement);

    // Ensure proper XML declaration and namespace
    if (!svgString.startsWith("<?xml")) {
        svgString = '<?xml version="1.0" encoding="UTF-8"?>\n' + svgString;
    }
    if (!svgString.includes('xmlns="http://www.w3.org/2000/svg"')) {
        svgString = svgString.replace(
            "<svg",
            '<svg xmlns="http://www.w3.org/2000/svg"',
        );
    }

    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    downloadBlob(blob, filename);
}

export function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
