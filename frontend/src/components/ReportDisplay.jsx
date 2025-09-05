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
  const opacity = isOriginal ? 'opacity-50 line-through' : '';

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${style} ${opacity}`}>
      {severity}
    </span>
  );
};

const AIProviderBadge = ({ provider, corrected = false }) => {
  const providerInfo = {
    'gemini': { name: 'Gemini', icon: '🤖', color: 'bg-blue-100 text-blue-800 border-blue-300' },
    'openai': { name: 'GPT-4', icon: '🔥', color: 'bg-green-100 text-green-800 border-green-300' },
    'claude': { name: 'Claude', icon: '🧠', color: 'bg-purple-100 text-purple-800 border-purple-300' },
    'none': { name: 'Keyword', icon: '🔤', color: 'bg-gray-100 text-gray-800 border-gray-300' }
  };

  const info = providerInfo[provider] || providerInfo['none'];

  if (!corrected && provider === 'none') return null;

  return (
    <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full border ${info.color}`}>
      {info.icon} {corrected ? `${info.name} Corrected` : info.name}
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
      ✨ Corrected ({confidence})
    </span>
  );
};

const FindingRow = ({ item, index, onToggleExpanded, isExpanded }) => {
  const showDetails = item.ai_corrected || item.correction_reason || item.provider_used !== 'none';

  return (
    <>
      <tr
        key={index}
        className={`${isExpanded ? 'bg-blue-50' : ''} hover:bg-gray-50 ${showDetails ? 'cursor-pointer' : ''}`}
        onClick={() => showDetails && onToggleExpanded(index)}
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
            <AIProviderBadge provider={item.provider_used} corrected={item.ai_corrected} />
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
            {showDetails && (
              <button className="ml-2 text-blue-600 hover:text-blue-800 text-xs">
                {isExpanded ? '▼' : '▶'} Details
              </button>
            )}
          </div>
        </td>
      </tr>

      {/* Expanded Details Row */}
      {isExpanded && showDetails && (
        <tr className="bg-blue-50 border-t border-blue-200">
          <td colSpan="4" className="px-6 py-4">
            <div className="space-y-4">

              {/* AI Analysis Status */}
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
                  <h4 className="text-sm font-medium text-gray-800 flex items-center">
                    {item.ai_corrected ? 'Severity Corrected by AI' : 'Analysis Status'}
                    {item.provider_used && item.provider_used !== 'none' && (
                      <AIProviderBadge provider={item.provider_used} />
                    )}
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">
                    {item.correction_reason}
                  </p>
                  {item.ai_corrected && (
                    <div className="mt-2 p-3 bg-white rounded border-l-4 border-blue-400">
                      <div className="text-xs text-gray-500 mb-1">Severity Change:</div>
                      <div className="flex items-center space-x-2">
                        <SeverityBadge severity={item.original_severity} isOriginal={false} />
                        <span className="text-gray-400">→</span>
                        <SeverityBadge severity={item.severity} />
                        <span className="text-sm text-gray-600">
                          (AI confidence: <strong>{item.confidence}</strong>)
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Provider Information */}
              {item.provider_used && item.provider_used !== 'none' && (
                <div className="bg-white p-3 rounded border-l-4 border-purple-400">
                  <h5 className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-1">
                    AI Provider Used
                  </h5>
                  <div className="flex items-center space-x-2">
                    <AIProviderBadge provider={item.provider_used} />
                    <span className="text-sm text-gray-600">
                      {item.provider_used === 'gemini' && 'Google Gemini 1.5 Flash'}
                      {item.provider_used === 'openai' && 'OpenAI GPT-4'}
                      {item.provider_used === 'claude' && 'Anthropic Claude 3 Sonnet'}
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
        title: `Multi-AI Enhanced Accessibility Analysis for ${reportName}`,
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

      pdf.save(`A11y-MultiAI-Report-${result.filename}.pdf`);
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
        <title>Multi-AI Enhanced Accessibility Report for ${reportName}</title>
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
    a.download = `A11y-MultiAI-Report-${result.filename}.html`;
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

  // Count corrections and providers used
  const correctionCount = findings.filter(f => f.ai_corrected).length;
  const totalAnalyzed = findings.length;
  const providersUsed = aiSummary.providers_used || [];
  const providersConfigured = aiSummary.providers_configured || [];

  const getProviderDisplayInfo = (provider) => {
    const info = {
      'gemini': { name: 'Google Gemini', icon: '🤖', color: 'bg-blue-100 text-blue-800' },
      'openai': { name: 'OpenAI GPT-4', icon: '🔥', color: 'bg-green-100 text-green-800' },
      'claude': { name: 'Anthropic Claude', icon: '🧠', color: 'bg-purple-100 text-purple-800' }
    };
    return info[provider] || { name: provider, icon: '🤖', color: 'bg-gray-100 text-gray-800' };
  };

  return (
    <div className="mt-8 pt-6 border-t border-gray-200">
      <div ref={reportContentRef}>
        <div className="flex items-start justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{reportName}</h1>

          {/* AI Analysis Summary */}
          <div className="text-right">
            {providersUsed.length > 0 ? (
              <div className="text-sm bg-gradient-to-r from-blue-50 to-purple-50 px-4 py-2 rounded-lg border border-blue-200 mb-2">
                <div className="flex items-center justify-end space-x-2 mb-1">
                  {providersUsed.map(provider => {
                    const info = getProviderDisplayInfo(provider);
                    return (
                      <span key={provider} className={`px-2 py-1 text-xs font-medium rounded-full ${info.color}`}>
                        {info.icon} {info.name}
                      </span>
                    );
                  })}
                </div>
                <div className="font-medium text-right">
                  {correctionCount} of {totalAnalyzed} severities corrected by AI
                </div>
              </div>
            ) : (
              <div className="text-sm bg-yellow-50 px-4 py-2 rounded-lg border border-yellow-200">
                <span className="text-yellow-700">⚠️ Using keyword-based analysis</span>
              </div>
            )}

            {/* Show configured but unused providers */}
            {providersConfigured.length > providersUsed.length && (
              <div className="text-xs text-gray-500 mt-1">
                Available: {providersConfigured.map(p => getProviderDisplayInfo(p).name).join(', ')}
              </div>
            )}
          </div>
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
              <h2 className="text-xl font-semibold">Detailed Findings with AI Analysis</h2>
              <div className="text-sm text-gray-600">
                Click rows to expand AI analysis details
              </div>
            </div>
            <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <th scope="col" className="px-6 py-3">Severity & AI Analysis</th>
                    <th scope="col" className="px-6 py-3">Criterion</th>
                    <th scope="col" className="px-6 py-3">Conformance</th>
                    <th scope="col" className="px-6 py-3">Remarks</th>
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