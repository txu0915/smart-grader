import { jsPDF } from "jspdf";
import { ExamPage, GradingMark } from "../types";

// Helper to wrap text for Canvas
const wrapText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number => {
  // Simple character-based wrapping for better multi-language support (esp. Chinese)
  const characters = text.split("");
  let line = "";
  let currentY = y;

  for (let i = 0; i < characters.length; i++) {
    const testLine = line + characters[i];
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;

    if (testWidth > maxWidth && i > 0) {
      ctx.fillText(line, x, currentY);
      line = characters[i];
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, currentY);
  return currentY + lineHeight;
};

export const generateGradedPDF = async (
  pages: ExamPage[],
  marks: GradingMark[]
): Promise<Blob> => {
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "px",
    hotfixes: ["px_scaling"], // Important for consistent sizing
  });

  // Remove the default initial page so we can add pages with specific dimensions
  pdf.deletePage(1);

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const pageMarks = marks
      .filter((m) => m.pageIndex === i)
      .sort((a, b) => a.y - b.y); // Sort by vertical position for sidebar flow

    // 1. Load Image
    const img = new Image();
    img.src = page.imageUrl;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    const originalWidth = img.naturalWidth;
    const originalHeight = img.naturalHeight;

    // 2. Setup Canvas
    // We create a canvas that is wider than the original image to hold the sidebar
    // Sidebar width = 40% of image width
    const sidebarWidth = Math.floor(originalWidth * 0.45);
    const totalWidth = originalWidth + sidebarWidth;
    const canvas = document.createElement("canvas");
    canvas.width = totalWidth;
    canvas.height = originalHeight;
    const ctx = canvas.getContext("2d");

    if (!ctx) continue;

    // 3. Draw Base Layout
    // Fill Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, totalWidth, originalHeight);

    // Draw Exam Image
    ctx.drawImage(img, 0, 0);

    // Draw Sidebar Background
    ctx.fillStyle = "#f8f9fa"; // Light gray
    ctx.fillRect(originalWidth, 0, sidebarWidth, originalHeight);
    
    // Draw Sidebar Divider
    ctx.beginPath();
    ctx.moveTo(originalWidth, 0);
    ctx.lineTo(originalWidth, originalHeight);
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 2;
    ctx.stroke();

    // 4. Render Marks and Feedback
    const sidebarPadding = 40;
    const sidebarContentWidth = sidebarWidth - (sidebarPadding * 2);
    let currentSidebarY = 60; // Start with some top padding

    // Sidebar Header
    ctx.fillStyle = "#1f2937";
    ctx.font = `bold ${Math.floor(originalWidth * 0.025)}px Arial, sans-serif`;
    ctx.fillText("Grading Report / 评分报告", originalWidth + sidebarPadding, currentSidebarY);
    currentSidebarY += 60;

    const baseFontSize = Math.floor(originalWidth * 0.015);
    const lineHeight = baseFontSize * 1.5;

    pageMarks.forEach((mark, index) => {
      // Coordinates
      const markX = (mark.x / 100) * originalWidth;
      const markY = (mark.y / 100) * originalHeight;
      const sidebarX = originalWidth + sidebarPadding;
      
      // Determine color
      const color = mark.status === 'correct' ? '#22c55e' : '#ef4444';
      
      // --- Draw Marks on Paper ---
      ctx.lineWidth = Math.max(3, originalWidth * 0.005);
      ctx.strokeStyle = color;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const markSize = originalWidth * 0.03;

      if (mark.status === 'correct') {
        ctx.beginPath();
        ctx.moveTo(markX - markSize/2, markY);
        ctx.lineTo(markX - markSize/10, markY + markSize/2);
        ctx.lineTo(markX + markSize/2, markY - markSize);
        ctx.stroke();
      } else {
        const half = markSize * 0.4;
        ctx.beginPath();
        ctx.moveTo(markX - half, markY - half);
        ctx.lineTo(markX + half, markY + half);
        ctx.moveTo(markX + half, markY - half);
        ctx.lineTo(markX - half, markY + half);
        ctx.stroke();
      }

      // --- Draw Connector Line ---
      // Dashed line from mark to sidebar text
      ctx.beginPath();
      ctx.setLineDash([10, 10]);
      ctx.moveTo(markX + markSize, markY);
      // Curve slightly to the text position
      ctx.lineTo(originalWidth, currentSidebarY + baseFontSize);
      ctx.strokeStyle = "#d1d5db"; // light gray
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]); // Reset

      // --- Draw Sidebar Text ---
      
      // 1. Badge (Q1, Q2 etc based on index)
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(sidebarX - 15, currentSidebarY + (baseFontSize/2), 6, 0, Math.PI * 2);
      ctx.fill();

      // 2. Question
      ctx.fillStyle = "#6b7280"; // Gray-500
      ctx.font = `bold ${baseFontSize}px Arial, sans-serif`;
      currentSidebarY = wrapText(ctx, `${mark.question || 'Question'}`, sidebarX, currentSidebarY, sidebarContentWidth, lineHeight);
      
      // 3. Student Answer
      ctx.fillStyle = "#111827"; // Gray-900
      ctx.font = `${baseFontSize}px Arial, sans-serif`;
      currentSidebarY = wrapText(ctx, `Ans: ${mark.studentAnswer || ''}`, sidebarX, currentSidebarY + 5, sidebarContentWidth, lineHeight);

      // 4. Analysis / Correct Answer (if wrong)
      if (mark.status === 'incorrect' && mark.correctAnswer) {
         ctx.fillStyle = "#15803d"; // Green-700
         ctx.font = `italic ${baseFontSize}px Arial, sans-serif`;
         currentSidebarY = wrapText(ctx, `Correct: ${mark.correctAnswer}`, sidebarX, currentSidebarY + 5, sidebarContentWidth, lineHeight);
      }

      if (mark.explanation) {
         ctx.fillStyle = "#4b5563"; // Gray-600
         ctx.font = `${Math.floor(baseFontSize * 0.9)}px Arial, sans-serif`;
         currentSidebarY = wrapText(ctx, `Note: ${mark.explanation}`, sidebarX, currentSidebarY + 5, sidebarContentWidth, lineHeight * 0.9);
      }

      // Add spacing between items
      currentSidebarY += lineHeight * 1.5;
    });

    // 5. Add to PDF
    // Convert the entire canvas to an image
    // Using high quality JPEG to keep file size reasonable
    const pageDataUrl = canvas.toDataURL("image/jpeg", 0.85);
    
    // Add page matching the canvas dimensions
    pdf.addPage([totalWidth, originalHeight], totalWidth > originalHeight ? 'l' : 'p');
    pdf.addImage(pageDataUrl, 'JPEG', 0, 0, totalWidth, originalHeight);
  }

  return pdf.output("blob");
};