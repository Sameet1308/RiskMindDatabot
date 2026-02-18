import html2canvas from 'html2canvas-pro'
import { jsPDF } from 'jspdf'

/**
 * Capture a DOM element and export it as a PDF.
 */
export async function exportElementAsPdf(element: HTMLElement, filename: string) {
    const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
    })

    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF('p', 'mm', 'a4')
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 10
    const usableWidth = pageWidth - margin * 2

    const imgWidth = usableWidth
    const imgHeight = (canvas.height * imgWidth) / canvas.width

    // Header
    pdf.setFontSize(8)
    pdf.setTextColor(120)
    pdf.text('RiskMind - AI Underwriting Co-Pilot', margin, 6)
    pdf.text(new Date().toLocaleString(), pageWidth - margin, 6, { align: 'right' })

    let yOffset = 10

    if (imgHeight <= pageHeight - margin - yOffset) {
        pdf.addImage(imgData, 'PNG', margin, yOffset, imgWidth, imgHeight)
    } else {
        // Multi-page: slice the canvas image
        let remainingHeight = imgHeight
        let sourceY = 0
        const pageUsable = pageHeight - yOffset - margin

        while (remainingHeight > 0) {
            const sliceHeight = Math.min(pageUsable, remainingHeight)
            const sliceRatio = sliceHeight / imgHeight

            const sliceCanvas = document.createElement('canvas')
            sliceCanvas.width = canvas.width
            sliceCanvas.height = Math.round(canvas.height * sliceRatio)
            const ctx = sliceCanvas.getContext('2d')!
            ctx.drawImage(
                canvas,
                0, sourceY, canvas.width, sliceCanvas.height,
                0, 0, sliceCanvas.width, sliceCanvas.height,
            )

            const sliceImg = sliceCanvas.toDataURL('image/png')
            if (sourceY > 0) pdf.addPage()
            pdf.addImage(sliceImg, 'PNG', margin, yOffset, imgWidth, sliceHeight)

            sourceY += sliceCanvas.height
            remainingHeight -= sliceHeight
        }
    }

    pdf.save(filename)
}

/**
 * Export multiple saved items as a single multi-page PDF.
 */
export async function exportAllSavedAsPdf(containerElement: HTMLElement, filename: string = 'riskmind-intelligence-report.pdf') {
    await exportElementAsPdf(containerElement, filename)
}
