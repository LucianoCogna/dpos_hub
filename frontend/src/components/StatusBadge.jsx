const STATUS_STYLES = {
  Backlog:        { backgroundColor: '#e5e7eb', color: '#374151' },
  Funil:          { backgroundColor: '#dbeafe', color: '#1d4ed8' },
  Refinamento:    { backgroundColor: '#ede9fe', color: '#6d28d9' },
  'Em Andamento': { backgroundColor: '#fef3c7', color: '#b45309' },
  Pronto:         { backgroundColor: '#dbeafe', color: '#1e40af' },
  Homologação:    { backgroundColor: '#ffedd5', color: '#c2410c' },
  Bloqueado:      { backgroundColor: '#fee2e2', color: '#b91c1c' },
  Concluído:      { backgroundColor: '#dcfce7', color: '#15803d' },
  Aceito:         { backgroundColor: '#dcfce7', color: '#15803d' },
  Cancelado:      { backgroundColor: '#f3f4f6', color: '#9ca3af' },
};

export default function StatusBadge({ status, size = 'sm' }) {
  const style = STATUS_STYLES[status] ?? { backgroundColor: '#f3f4f6', color: '#6b7280' };
  const cls = size === 'lg'
    ? 'px-3 py-1 text-sm'
    : 'px-2 py-0.5 text-xs';
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium whitespace-nowrap ${cls}`}
      style={style}
    >
      {status ?? '—'}
    </span>
  );
}
