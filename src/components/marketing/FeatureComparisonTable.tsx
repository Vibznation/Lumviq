import React from 'react'
import { FEATURE_CATALOG, FEATURE_CATEGORIES, PLANS, planHasFeature } from '../../lib/plans'

/**
 * Full feature-by-plan comparison matrix, grouped by category. Plan names
 * stay visible via a sticky header row while scrolling a long table.
 */
export default function FeatureComparisonTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead className="sticky top-0 bg-white dark:bg-midnight-950 z-10">
          <tr>
            <th scope="col" className="text-left py-3 px-3 font-semibold text-midnight-800 dark:text-white">
              Feature
            </th>
            {PLANS.map((p) => (
              <th key={p.id} scope="col" className="py-3 px-3 font-semibold text-midnight-800 dark:text-white text-center">
                {p.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {FEATURE_CATEGORIES.map((cat) => {
            const catFeatures = FEATURE_CATALOG.filter((f) => f.category === cat.key)
            if (catFeatures.length === 0) return null
            return (
              <React.Fragment key={cat.key}>
                <tr>
                  <td colSpan={PLANS.length + 1} className="pt-6 pb-2 px-3 font-semibold text-teal-700 dark:text-teal-400">
                    {cat.label}
                  </td>
                </tr>
                {catFeatures.map((f) => (
                  <tr key={f.key} className="border-t border-gray-100 dark:border-midnight-800">
                    <th scope="row" className="text-left font-normal py-2 px-3 text-gray-700 dark:text-gray-300">
                      {f.label}
                    </th>
                    {PLANS.map((p) => (
                      <td key={p.id} className="py-2 px-3 text-center">
                        {planHasFeature(p.id, f.key) ? (
                          <span aria-label="Included" className="text-teal-600">&#10003;</span>
                        ) : (
                          <span aria-label="Not included" className="text-gray-300 dark:text-midnight-700">&mdash;</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
