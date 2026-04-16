import { toast } from 'sonner';

export async function downloadIDCardAsPNG(elementId: string, employeeId: string): Promise<void> {
  try {
    const element = document.getElementById(elementId);
    if (!element) throw new Error('ID card element not found');

    const html2canvas = (await import('html2canvas')).default;
    const canvas = await html2canvas(element, {
      scale: 2, // scale 2x for high resolution
      useCORS: true,
      backgroundColor: null,
      logging: false,
    });

    const link = document.createElement('a');
    link.download = `${employeeId}-id-card.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast.success('Image downloaded securely.');
  } catch (err: any) {
    console.error('PNG download failed:', err);
    toast.error('Failed to download ID card image');
    throw err;
  }
}

export async function downloadIDCardAsPDF(elementId: string, employeeId: string): Promise<void> {
  try {
    const element = document.getElementById(elementId);
    if (!element) throw new Error('ID card element not found');

    const html2canvas = (await import('html2canvas')).default;
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff', // Ensures the PDF doesn't have transparency problems
      logging: false,
    });

    const { jsPDF } = await import('jspdf');
    // Custom landscape size for standard ID card ratio 85.6mm × 53.98mm
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [85.6, 53.98],
    });

    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', 0, 0, 85.6, 53.98);
    pdf.save(`${employeeId}-id-card.pdf`);
    
    toast.success('PDF downloaded securely.');
  } catch (err: any) {
    console.error('PDF download failed:', err);
    toast.error('Failed to download ID card PDF');
    throw err;
  }
}
