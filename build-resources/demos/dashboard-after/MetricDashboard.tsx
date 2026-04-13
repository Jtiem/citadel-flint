/**
 * demo-after.tsx — "AI With Flint"
 *
 * Same dashboard, same prompt — but Flint injected the brutalist design
 * system into the AI's context. Notice the difference:
 * - Design token colors (bg-brand-vibrant, text-text-primary, etc.)
 * - Zero rounded corners (rounded-none) — brutalist mandate
 * - Hard shadows with no blur (shadow-sm)
 * - Strong borders instead of soft gradients
 * - Vibrant orange accent (#FF4A00) instead of generic blue
 * - Accessible: proper heading hierarchy, table headers, ARIA labels
 */

export default function MetricDashboard() {
  const stats = [
    { label: 'Revenue', value: '$48,200', change: '+12%', positive: true },
    { label: 'Users', value: '2,420', change: '+8%', positive: true },
    { label: 'Conversion', value: '3.6%', change: '-2%', positive: false },
    { label: 'Avg Order', value: '$124', change: '+5%', positive: true },
  ]

  const orders = [
    { id: 'ORD-7291', customer: 'Sarah Chen', amount: '$234.00', status: 'Completed' },
    { id: 'ORD-7290', customer: 'James Wilson', amount: '$89.50', status: 'Pending' },
    { id: 'ORD-7289', customer: 'Maria Santos', amount: '$412.00', status: 'Completed' },
    { id: 'ORD-7288', customer: 'Alex Petrov', amount: '$67.25', status: 'Cancelled' },
    { id: 'ORD-7287', customer: 'Priya Sharma', amount: '$156.00', status: 'Completed' },
  ]

  return (
    <div className="min-h-screen bg-bg-primary p-8 font-body">
      {/* Header */}
      <header className="mb-8 flex items-center justify-between border-b-4 border-border-heavy pb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-none bg-brand-vibrant shadow-sm">
            <span className="text-lg font-bold text-text-inverted">M</span>
          </div>
          <h1 className="text-2xl font-bold text-text-primary font-heading">Metric</h1>
        </div>
        <nav aria-label="Main navigation">
          <ul className="flex gap-6 text-sm font-medium text-text-secondary">
            <li><a href="#dashboard" className="border-b-2 border-brand-vibrant pb-1 text-text-accent">Dashboard</a></li>
            <li><a href="#analytics" className="hover:text-text-primary">Analytics</a></li>
            <li><a href="#reports" className="hover:text-text-primary">Reports</a></li>
            <li><a href="#settings" className="hover:text-text-primary">Settings</a></li>
          </ul>
        </nav>
      </header>

      {/* Stat Cards */}
      <div className="mb-8 grid grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-none border-2 border-border-heavy bg-bg-primary p-6 shadow-md"
          >
            <p className="text-sm font-medium uppercase tracking-wider text-text-secondary">{stat.label}</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-text-primary font-heading">{stat.value}</span>
              <span className={`text-sm font-bold ${stat.positive ? 'text-feedback-success' : 'text-feedback-error'}`}>
                {stat.change}
              </span>
            </div>
            <div className="mt-4 h-2 rounded-none bg-gray-200 border border-border-thin">
              <div className="h-full rounded-none bg-brand-vibrant w-2/3" />
            </div>
          </div>
        ))}
      </div>

      {/* Chart Area */}
      <div className="mb-8 rounded-none border-2 border-border-heavy bg-bg-primary p-6 shadow-md">
        <h2 className="mb-4 text-lg font-bold uppercase tracking-wider text-text-primary font-heading">
          Revenue Over Time
        </h2>
        <div className="flex h-64 items-end gap-1" role="img" aria-label="Bar chart showing monthly revenue from January to December">
          {[40, 55, 45, 62, 78, 65, 82, 70, 88, 75, 92, 85].map((h, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-none bg-brand-vibrant border border-border-heavy transition-colors hover:bg-brand-vibrant-hover"
                style={{ height: `${h}%` }}
              />
              <span className="text-xs font-medium uppercase text-text-secondary">
                {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <div className="rounded-none border-2 border-border-heavy bg-bg-primary p-6 shadow-md">
        <h2 className="mb-4 text-lg font-bold uppercase tracking-wider text-text-primary font-heading">
          Recent Orders
        </h2>
        <table className="w-full" role="table">
          <thead>
            <tr className="border-b-2 border-border-heavy text-left text-sm uppercase tracking-wider text-text-secondary">
              <th className="pb-3 font-bold" scope="col">Order ID</th>
              <th className="pb-3 font-bold" scope="col">Customer</th>
              <th className="pb-3 font-bold" scope="col">Amount</th>
              <th className="pb-3 font-bold" scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-b border-border-thin">
                <td className="py-3 text-sm font-bold font-mono text-text-primary">{order.id}</td>
                <td className="py-3 text-sm text-text-primary">{order.customer}</td>
                <td className="py-3 text-sm font-bold text-text-primary">{order.amount}</td>
                <td className="py-3">
                  <span className={`inline-flex items-center rounded-none border-2 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
                    order.status === 'Completed'
                      ? 'border-feedback-success bg-feedback-success/10 text-feedback-success'
                      : order.status === 'Pending'
                      ? 'border-feedback-warning bg-feedback-warning/10 text-feedback-warning'
                      : 'border-feedback-error bg-feedback-error/10 text-feedback-error'
                  }`}>
                    {order.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
