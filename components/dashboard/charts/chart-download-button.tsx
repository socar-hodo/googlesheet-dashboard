'use client';

import { useCallback, useRef, type RefObject } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ChartDownloadButtonProps {
  chartRef: RefObject<HTMLDivElement | null>;
  filename: string;
}

export function ChartDownloadButton({ chartRef, filename }: ChartDownloadButtonProps) {
  const handleDownload = useCallback(async () => {
    const el = chartRef.current;
    if (!el) return;

    // Find the SVG element inside the chart
    const svg = el.querySelector('svg');
    if (!svg) {
      toast.error('차트를 찾을 수 없습니다.');
      return;
    }

    try {
      // Clone SVG and set background
      const clone = svg.cloneNode(true) as SVGElement;
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

      // Get computed background color
      const bgColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--card')
        .trim() || '#ffffff';
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('width', '100%');
      rect.setAttribute('height', '100%');
      rect.setAttribute('fill', bgColor);
      clone.insertBefore(rect, clone.firstChild);

      const svgData = new XMLSerializer().serializeToString(clone);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      // Create canvas to convert SVG to PNG
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width * 2; // 2x for retina
        canvas.height = img.height * 2;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.scale(2, 2);
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          if (!blob) return;
          const pngUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = pngUrl;
          a.download = `${filename}.png`;
          a.click();
          URL.revokeObjectURL(pngUrl);
          toast.success(`${filename}.png 다운로드 완료`);
        }, 'image/png');
        URL.revokeObjectURL(url);
      };
      img.src = url;
    } catch {
      toast.error('차트 다운로드에 실패했습니다.');
    }
  }, [chartRef, filename]);

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      onClick={handleDownload}
      aria-label={`${filename} 차트 이미지 다운로드`}
      className="opacity-0 transition-opacity group-hover/chart:opacity-100"
    >
      <Download className="h-3.5 w-3.5" />
    </Button>
  );
}
