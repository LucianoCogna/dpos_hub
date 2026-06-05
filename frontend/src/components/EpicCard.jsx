import StatusBadge from './StatusBadge';

export default function EpicCard({ epic }) {
  const { key, summary, status, link, progress, total, done, stories } = epic;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Epic header */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-gray-400">{key}</span>
            <StatusBadge status={status} />
          </div>
          <h3 className="font-semibold text-gray-800 text-sm leading-snug">{summary}</h3>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="text-xs text-gray-500">{done}/{total} concluídas</p>
          <p className="text-lg font-bold text-primary-600">{progress}%</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-100">
        <div
          className="h-full bg-primary-500 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Stories table */}
      <div className="divide-y divide-gray-50">
        {stories.map((story) => (
          <div key={story.key} className="px-5 py-3 flex items-center gap-3 text-sm hover:bg-gray-50 transition-colors">
            <span className="font-mono text-xs text-gray-400 w-24 flex-shrink-0">{story.key}</span>
            <div className="flex-1 min-w-0">
              <a
                href={story.link}
                target="_blank"
                rel="noreferrer"
                className="text-gray-700 hover:text-primary-600 truncate block font-medium"
                title={story.summary}
              >
                {story.summary}
              </a>
              <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                {story.assignee && <span>{story.assignee}</span>}
                {story.sprint && <span className="text-gray-400">· {story.sprint}</span>}
              </div>
            </div>
            <div className="flex-shrink-0">
              <StatusBadge status={story.status} />
            </div>
          </div>
        ))}

        {stories.length === 0 && (
          <p className="px-5 py-4 text-sm text-gray-400 italic">Nenhuma história encontrada.</p>
        )}
      </div>

      {link && (
        <div className="px-5 py-2 border-t border-gray-100 bg-gray-50">
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-primary-500 hover:text-primary-700"
          >
            Ver épico no Jira ↗
          </a>
        </div>
      )}
    </div>
  );
}
