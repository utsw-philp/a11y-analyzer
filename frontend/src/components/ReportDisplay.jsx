import React, { useRef, forwardRef, useImperativeHandle, useState } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import SeverityLegend from './SeverityLegend';

const SeverityBadge = ({ severity, isOriginal = false }) => {
  const severityStyles = {
    Critical: 'bg-red-100 text-red-800 border-red-300',
    High: 'bg-orange-100 text-orange-800 border-orange-300',
    Medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    Low: 'bg-blue-100 text-blue-800 border-blue-300',
  };

  const style = severityStyles[severity] || 'bg-gray-100 text-gray-800 border-gray-300';
  const opacity = isOriginal ? 'opacity-50' : '';

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${style} ${opacity}`}>
      {severity}
    </span>
  );
};

const CorrectionIndicator = ({ aiCorrected, confidence }) => {
  if (!aiCorrected) return null;

  const confidenceColors = {
    high: 'bg-green-100 text-green-800 border-green-300',
    medium: 'bg-blue-100 text-blue-800 border-blue-300',
    low: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    fallback: 'bg-gray-100 text-gray-800 border-gray-300'
  };

  return (
    <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full border ${confidenceColors[confidence] || confidenceColors.medium}`}>
      🤖 AI Corrected
    </span>
  );
};

const FindingRow = ({ item, index, onToggleExpanded, isExpanded }) => {
  const showCorrection = item.ai_corrected || item.correction_reason;

  return (
    <>
      <tr
        key={index}
        className={`${isExpanded ? 'bg-blue-50' : ''} hover:bg-gray-50 ${showCorrection ? 'cursor-pointer' : ''}`}
        onClick={() => showCorrection && onToggleExpanded(index)}
      >
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center flex-wrap gap-2">
            {/* Show original severity if it was corrected */}
            {item.ai_corrected && item.original_severity && (
              <>
                <div className="flex items-center">
                  <SeverityBadge severity={item.original_severity} isOriginal={true} />
                  <span className="mx-2 text-gray-400">→</span>
                </div>
              </>
            )}
            <SeverityBadge severity={item.severity} />
            <CorrectionIndicator aiCorrected={item.ai_corrected} confidence={item.confidence} />
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
          {item.criterion}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {item.level}
        </td>
        <td className="px-6 py-4 text-sm text-gray-500">
          <div className="flex items-center justify-between">
            <p className="line-clamp-2">{item.remarks}</p>
            {showCorrection && (
              <button className="ml-2 text-blue-600 hover:text-blue-800 text-xs">
                {isExpanded ? '▼' : '▶'} {item.ai_corrected ? 'Correction Details' : 'Analysis Info'}
              </button>
            )}
          </div>
        </td>
      </tr>

      {/* Expanded Details Row */}
      {isExpanded && showCorrection && (
        <tr className="bg-blue-50 border-t border-blue-200">
          <td colSpan="4" className="px-6 py-4">
            <div className="space-y-3">

              {/* AI Correction Status */}
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  {item.ai_corrected ? (
                    <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-green-600 text-sm">✓</span>
                    </div>
                  ) : (
                    <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
                      <span className="text-gray-600 text-sm">-</span>
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-gray-800">
                    {item.ai_corrected ? 'Severity Corrected by AI' : 'Analysis Status'}
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">
                    {item.correction_reason}
                  </p>
                  {item.ai_corrected && (
                    <div className="mt-2 text-xs text-gray-500">
                      Original severity: <span className="font-medium">{item.original_severity}</span> →
                      AI corrected to: <span className="font-medium text-blue-600">{item.severity}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Confidence Level */}
              {item.confidence && item.confidence !== 'fallback' && (
                <div className="bg-white p-3 rounded border-l-4 border-blue-400">
                  <h5 className="text-xs font-medium text-gray-700 uppercase tracking-wide">
                    AI Confidence Level
                  </h5>
                  <div className="mt-1 flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs rounded ${
                      item.confidence === 'high' ? 'bg-green-100 text-green-800' :
                      item.confidence === 'medium' ? 'bg-blue-100 text-blue-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {item.confidence.toUpperCase()}
                    </span>
                    <span className="text-sm text-gray-600">
                      {item.confidence === 'high' ? 'High confidence in severity assessment' :
                       item.confidence === 'medium' ? 'Medium confidence - may need review' :
                       'Low confidence - manual review recommended'}
                    </span>
                  </div>
                </div>
              )}

            </div>
          </td>
        </tr>
      )}
    </>
  );
};

const ReportDisplay = forwardRef(({ result, reportName, reviewerName }, ref) => {
  const reportContentRef = useRef(null);
  const [expandedRows, setExpandedRows] = useState(new Set());

  const handleToggleExpanded = (index) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedRows(newExpanded);
  };

  const handleExportPDF = () => {
    const input = reportContentRef.current;
    if (!input) return;

    html2canvas(input, { scale: 2, logging: false, useCORS: true }).then((canvas) => {
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      pdf.setProperties({
        title: `AI-Enhanced Severity Analysis for ${reportName}`,
        author: reviewerName,
        creationDate: new Date()
      });

      const margin = 10;
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const usableWidth = pdfWidth - (margin * 2);
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const ratio = canvasWidth / canvasHeight;
      const imgWidth = usableWidth;
      const imgHeight = imgWidth / ratio;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeight);
      heightLeft -= (pdfHeight - (margin * 2));

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position - margin, imgWidth, imgHeight);
        heightLeft -= (pdfHeight - (margin * 2));
      }

      pdf.save(`A11y-Severity-Report-${result.filename}.pdf`);
    });
  };

  const handleExportHTML = () => {
    const content = reportContentRef.current;
    if (!content) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>AI Severity-Corrected Accessibility Report for ${reportName}</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-gray-100 p-8 font-sans">
        <div class="container mx-auto bg-white p-8 rounded-lg shadow-lg">
          ${content.innerHTML}
        </div>
      </body>
      </html>`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `A11y-Severity-Report-${result.filename}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  useImperativeHandle(ref, () => ({
    exportAsPDF() { handleExportPDF(); },
    exportAsHTML() { handleExportHTML(); }
  }));

  if (!result) return null;

  const analysis = result.analysis_results || {};
  const summary = analysis.summary || {};
  const findings = analysis.detailed_findings || [];
  const aiSummary = analysis.ai_analysis_summary || {};

  // Count corrections
  const correctionCount = findings.filter(f => f.ai_corrected).length;
  const totalAnalyzed = findings.length;

  return (
    <div className="mt-8 pt-6 border-t border-gray-200">
      <div ref={reportContentRef}>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{reportName}</h1>
          {aiSummary.gemini_configured && (
            <div className="text-sm bg-gradient-to-r from-blue-50 to-purple-50 px-4 py-2 rounded-lg border border-blue-200">
              <div className="flex items-center space-x-2">
                <span className="text-blue-600">🤖</span>
                <span className="font-medium">
                  {correctionCount} of {totalAnalyzed} severities corrected by AI
                </span>
              </div>
            </div>
          )}
          {!aiSummary.gemini_configured && totalAnalyzed > 0 && (
            <div className="text-sm bg-yellow-50 px-4 py-2 rounded-lg border border-yellow-200">
              <span className="text-yellow-700">⚠️ Using keyword-based severity analysis</span>
            </div>
          )}
        </div>

        <h2 className="font-mono bg-gray-100 p-2 rounded mb-6 text-sm">Original File: {result.filename}</h2>

        {/* Metadata Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-100 p-4 rounded-lg">
            <h3 className="font-bold text-gray-700">VPAT Version</h3>
            <p className="text-lg">{analysis.vpat_version || 'N/A'}</p>
          </div>
          <div className="bg-gray-100 p-4 rounded-lg">
            <h3 className="font-bold text-gray-700">Product Version</h3>
            <p className="text-lg">{analysis.product_version || 'N/A'}</p>
          </div>
          <div className="bg-gray-100 p-4 rounded-lg">
            <h3 className="font-bold text-gray-700">Report Age</h3>
            <p className="text-lg">{analysis.report_age || 'N/A'}</p>
          </div>
        </div>

        {/* Summary Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-green-100 text-green-800 p-4 rounded-lg text-center">
            <p className="text-2xl font-bold">{summary.supports || 0}</p>
            <p>Supports</p>
          </div>
          <div className="bg-yellow-100 text-yellow-800 p-4 rounded-lg text-center">
            <p className="text-2xl font-bold">{summary.partially_supports || 0}</p>
            <p>Partially Supports</p>
          </div>
          <div className="bg-red-100 text-red-800 p-4 rounded-lg text-center">
            <p className="text-2xl font-bold">{summary.does_not_support || 0}</p>
            <p>Does Not Support</p>
          </div>
          <div className="bg-gray-100 text-gray-800 p-4 rounded-lg text-center">
            <p className="text-2xl font-bold">{summary.not_applicable || 0}</p>
            <p>Not Applicable</p>
          </div>
        </div>

        {/* Findings Table */}
        {findings.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Detailed Findings with Severity Analysis</h2>
              <div className="text-sm text-gray-600">
                Click rows with corrections/analysis to expand
              </div>
            </div>
            <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <th scope="col" className="px-6 py-3">Severity</th>
                    <th scope="col" className="px-6 py-3">Criterion</th>
                    <th scope="col" className="px-6 py-3">Conformance</th>
                    <th scope="col" className="px-6 py-3">Remarks & Analysis</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {findings.map((item, index) => (
                    <FindingRow
                      key={index}
                      item={item}
                      index={index}
                      onToggleExpanded={handleToggleExpanded}
                      isExpanded={expandedRows.has(index)}
                    />
                  ))}
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