import React from 'react';

const legendItems = [
  {
    level: 'Critical',
    description: 'Prevents users from completing a primary task. Often related to keyboard accessibility, screen reader blockers, or major content visibility issues.',
    style: 'bg-red-100 text-red-800 border-red-300',
  },
  {
    level: 'High',
    description: 'Significantly hinders or complicates a user\'s journey. May not be a complete blocker but causes major frustration (e.g., poor color contrast).',
    style: 'bg-orange-100 text-orange-800 border-orange-300',
  },
  {
    level: 'Medium',
    description: 'A noticeable issue that makes interaction less than ideal, but a workaround is possible (e.g., inconsistent link purpose, unclear status messages).',
    style: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  },
  {
    level: 'Low',
    description: 'A minor issue that does not significantly impact usability. Often related to best practices or cosmetic inconsistencies.',
    style: 'bg-blue-100 text-blue-800 border-blue-300',
  },
];

const SeverityLegend = () => {
  return (
    <div className="mb-8 p-6 bg-gray-50 border border-gray-200 rounded-lg">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Severity Legend</h3>
      <div className="space-y-3">
        {legendItems.map((item) => (
          <div key={item.level} className="flex items-start">
            <span className={`flex-shrink-0 mt-1 px-2 py-0.5 text-xs font-medium rounded-full border ${item.style}`}>
              {item.level}
            </span>
            <p className="ml-3 text-sm text-gray-600">{item.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SeverityLegend;