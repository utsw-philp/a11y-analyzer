import React, { useRef, forwardRef, useImperativeHandle } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import SeverityLegend from './SeverityLegend';

const SeverityBadge = ({ severity }) => {
  const severityStyles = { Critical: 'bg-red-100 text-red-800 border-red-300', High: 'bg-orange-100 text-orange-800 border-orange-300', Medium: 'bg-yellow-100 text-yellow-800 border-yellow-300', Low: 'bg-blue-100 text-blue-800 border-blue-300', };
  return (<span className={`px-2 py-1 text-xs font-medium rounded-full border ${severityStyles[severity] || 'bg-gray-100 text-gray-800'}`}>{severity}</span>);
};

const ReportDisplay = forwardRef(({ result, reportName, reviewerName }, ref) => {
  const reportContentRef = useRef(null);

  const handleExportPDF = () => {
    const input = reportContentRef.current; if (!input) return;
    html2canvas(input, { scale: 2, logging: false, useCORS: true }).then((canvas) => {
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      pdf.setProperties({ title: `Automated analysis for ${reportName}`, author: reviewerName, creationDate: new Date('2025-09-03T17:21:45-05:00') });
      const margin = 10; const pdfWidth = pdf.internal.pageSize.getWidth(); const pdfHeight = pdf.internal.pageSize.getHeight();
      const usableWidth = pdfWidth - (margin * 2); const canvasWidth = canvas.width; const canvasHeight = canvas.height;
      const ratio = canvasWidth / canvasHeight; const imgWidth = usableWidth; const imgHeight = imgWidth / ratio;
      let heightLeft = imgHeight; let position = 0;
      pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeight); heightLeft -= (pdfHeight - (margin * 2));
      while (heightLeft > 0) {
        position = heightLeft - imgHeight; pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position - margin, imgWidth, imgHeight);
        heightLeft -= (pdfHeight - (margin * 2));
      }
      pdf.save(`A11y-Report-${result.filename}.pdf`);
    });
  };

  const handleExportHTML = () => {
    const content = reportContentRef.current; if (!content) return;
    const htmlContent = `
      <!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Accessibility Analysis Report for ${reportName}</title><script src="https://cdn.tailwindcss.com"></script><style>.print-hidden { display: none; }</style></head>
      <body class="bg-gray-100 p-8 font-sans"><div class="container mx-auto bg-white p-8 rounded-lg shadow-lg">${content.innerHTML}</div></body></html>`;
    const blob = new Blob([htmlContent], { type: 'text/html' }); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `A11y-Report-${result.filename}.html`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  useImperativeHandle(ref, () => ({ exportAsPDF() { handleExportPDF(); }, exportAsHTML() { handleExportHTML(); } }));

  if (!result) return null;
  const analysis = result.analysis_results || {}; const summary = analysis.summary || {}; const findings = analysis.detailed_findings || [];

  return (
    <div className="mt-8 pt-6 border-t border-gray-200">
      <div ref={reportContentRef}>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">{reportName}</h1>
        <h2 className="font-mono bg-gray-100 p-2 rounded mb-6 text-sm">Original File: {result.filename}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-100 p-4 rounded-lg"><h3 className="font-bold text-gray-700">VPAT Version</h3><p className="text-lg">{analysis.vpat_version || 'N/A'}</p></div>
          <div className="bg-gray-100 p-4 rounded-lg"><h3 className="font-bold text-gray-700">Product Version</h3><p className="text-lg">{analysis.product_version || 'N/A'}</p></div>
          <div className="bg-gray-100 p-4 rounded-lg"><h3 className="font-bold text-gray-700">Report Age</h3><p className="text-lg">{analysis.report_age || 'N/A'}</p></div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-200 text-gray-800 p-4 rounded-lg text-center"><p className="text-2xl font-bold">{summary.supports || 0}</p><p>Supports</p></div>
          <div className="bg-gray-200 text-gray-800 p-4 rounded-lg text-center"><p className="text-2xl font-bold">{summary.partially_supports || 0}</p><p>Partially Supports</p></div>
          <div className="bg-gray-200 text-gray-800 p-4 rounded-lg text-center"><p className="text-2xl font-bold">{summary.does_not_support || 0}</p><p>Does Not Support</p></div>
          <div className="bg-gray-200 text-gray-800 p-4 rounded-lg text-center"><p className="text-2xl font-bold">{summary.not_applicable || 0}</p><p>Not Applicable</p></div>
        </div>
        {findings.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Detailed Findings</h2>
            <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50"><tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider"><th scope="col" className="px-6 py-3">Severity</th><th scope="col" className="px-6 py-3">Criterion</th><th scope="col" className="px-6 py-3">Conformance</th><th scope="col" className="px-6 py-3">Remarks</th></tr></thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {findings.map((item, index) => (<tr key={index}><td className="px-6 py-4 whitespace-nowrap"><SeverityBadge severity={item.severity} /></td><td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.criterion}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.level}</td><td className="px-6 py-4 text-sm text-gray-500"><p className="line-clamp-3 hover:line-clamp-none transition-all">{item.remarks}</p></td></tr>))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <SeverityLegend />
      </div>
    </div>
  );
});

export default ReportDisplay;