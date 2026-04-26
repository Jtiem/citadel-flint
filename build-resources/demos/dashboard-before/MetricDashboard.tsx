/**
 * MetricDashboard — AI Without Guardrails
 *
 * Prompt: "Build a metrics dashboard with KPI stat cards, a revenue bar chart,
 * and a recent orders table. Use the Brutalist Design System: vibrant orange
 * (#FF4A00), zero rounded corners, hard shadows (no blur), heavy borders,
 * Space Grotesk typeface. Use Tailwind CSS."
 *
 * Tokens available: design-tokens.json (62 tokens — colors, spacing, typography,
 * shadows — all brutalist-themed with zero radius and hard offset shadows).
 *
 * This component was generated without Flint governance enforcement.
 */

export default function MetricDashboard() {
  const stats = [{
    label: 'Revenue',
    value: '$48,200',
    change: '+12%',
    positive: true,
    progress: 72
  }, {
    label: 'Users',
    value: '2,420',
    change: '+8%',
    positive: true,
    progress: 58
  }, {
    label: 'Conversion',
    value: '3.6%',
    change: '-2%',
    positive: false,
    progress: 36
  }, {
    label: 'Avg Order',
    value: '$124',
    change: '+5%',
    positive: true,
    progress: 45
  }];
  const monthlyRevenue = [{
    month: 'Jan',
    value: 28
  }, {
    month: 'Feb',
    value: 32
  }, {
    month: 'Mar',
    value: 27
  }, {
    month: 'Apr',
    value: 35
  }, {
    month: 'May',
    value: 40
  }, {
    month: 'Jun',
    value: 38
  }, {
    month: 'Jul',
    value: 43
  }, {
    month: 'Aug',
    value: 45
  }, {
    month: 'Sep',
    value: 41
  }, {
    month: 'Oct',
    value: 48
  }, {
    month: 'Nov',
    value: 46
  }, {
    month: 'Dec',
    value: 52
  }];
  const orders = [{
    id: 'ORD-7291',
    customer: 'Sarah Chen',
    amount: '$312.00',
    status: 'Completed',
    date: 'Apr 5, 2026'
  }, {
    id: 'ORD-7290',
    customer: 'James Wilson',
    amount: '$189.50',
    status: 'Processing',
    date: 'Apr 5, 2026'
  }, {
    id: 'ORD-7289',
    customer: 'Maria Santos',
    amount: '$475.20',
    status: 'Completed',
    date: 'Apr 4, 2026'
  }, {
    id: 'ORD-7288',
    customer: 'Alex Petrov',
    amount: '$92.00',
    status: 'Shipped',
    date: 'Apr 4, 2026'
  }, {
    id: 'ORD-7287',
    customer: 'Priya Sharma',
    amount: '$248.75',
    status: 'Completed',
    date: 'Apr 3, 2026'
  }];
  const maxRevenue = Math.max(...monthlyRevenue.map(d => d.value));
  return <div style={{
    fontFamily: "'Space Grotesk', sans-serif",
    minHeight: '100vh',
    backgroundColor: '#FFFFFF',
    padding: '32px'
  }}>
      <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '32px'
    }}>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center rounded-xl" style={{
          width: '40px',
          height: '40px',
          background: 'linear-gradient(135deg, #F97316, #9333EA)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}>
            <span style={{
            color: '#FFFFFF',
            fontWeight: 700,
            fontSize: '18px'
          }}>M</span>
          </div>
          <h1 style={{
          fontSize: '28px',
          fontWeight: 800,
          color: "var(--color.on-surface, #111827)",
          letterSpacing: '-0.02em',
          textTransform: 'uppercase'
        }}>
            Metrics Dashboard
          </h1>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-4 gap-6 mb-10">
        {stats.map(stat => <div key={stat.label} className="border-4 border-black p-6" style={{
        backgroundColor: '#FFFFFF',
        boxShadow: '6px 6px 0px #000000',
        borderRadius: '0px'
      }}>
            <p style={{
          fontSize: '12px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: '#6B7280',
          marginBottom: '4px'
        }}>
              {stat.label}
            </p>
            <div className="flex items-baseline justify-between mb-4">
              <span style={{
            fontSize: '32px',
            fontWeight: 900,
            color: '#111827'
          }}>{stat.value}</span>
              <span className="px-2 py-1 border-2 text-sm font-bold" style={{
            color: stat.positive ? '#16a34a' : '#dc2626',
            borderColor: stat.positive ? '#16a34a' : '#dc2626',
            backgroundColor: stat.positive ? '#dcfce7' : '#fef2f2',
            borderRadius: '0px'
          }}>
                {stat.change}
              </span>
            </div>
            <div style={{
          width: '100%',
          height: '10px',
          backgroundColor: '#E5E7EB',
          border: '1px solid #000',
          borderRadius: '0px'
        }}>
              <div style={{
            height: '100%',
            width: `${stat.progress}%`,
            backgroundColor: "var(--color.danger, #DC2626)",
            borderRadius: '0px'
          }} />
            </div>
          </div>)}
      </div>

      {/* Revenue Bar Chart */}
      <div className="border-4 border-black p-6 mb-10" style={{
      backgroundColor: '#FFFFFF',
      boxShadow: '6px 6px 0px #000000',
      borderRadius: '0px'
    }}>
        <h2 style={{
        fontSize: '22px',
        fontWeight: 900,
        color: '#111827',
        textTransform: 'uppercase',
        letterSpacing: '-0.01em',
        marginBottom: '24px'
      }}>
          Monthly Revenue
        </h2>
        <div className="flex items-end justify-between gap-2" style={{
        height: '240px'
      }}>
          {monthlyRevenue.map(d => {
          const heightPct = d.value / maxRevenue * 100;
          return <div key={d.month} className="flex flex-col items-center flex-1">
                <span style={{
              fontSize: '11px',
              fontWeight: 700,
              color: '#6B7280',
              marginBottom: '4px'
            }}>
                  ${d.value}k
                </span>
                <div className="w-full border-2 border-black" style={{
              height: `${heightPct}%`,
              backgroundColor: "var(--color.danger, #DC2626)",
              borderRadius: '0px',
              minHeight: '4px'
            }} />
                <span style={{
              fontSize: '11px',
              fontWeight: 700,
              color: '#111827',
              marginTop: '8px',
              textTransform: 'uppercase'
            }}>
                  {d.month}
                </span>
              </div>;
        })}
        </div>
      </div>

      {/* Recent Orders Table */}
      <div className="border-4 border-black" style={{
      backgroundColor: '#FFFFFF',
      boxShadow: '6px 6px 0px #000000',
      borderRadius: '0px'
    }}>
        <div className="p-6 border-b-4 border-black">
          <h2 style={{
          fontSize: '22px',
          fontWeight: 900,
          color: '#111827',
          textTransform: 'uppercase',
          letterSpacing: '-0.01em'
        }}>
            Recent Orders
          </h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b-4 border-black" style={{
            backgroundColor: "var(--color.danger, #DC2626)"
          }}>
              <th className="text-left p-4" style={{
              fontSize: '12px',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: '#FFFFFF'
            }}>Order ID</th>
              <th className="text-left p-4" style={{
              fontSize: '12px',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: '#FFFFFF'
            }}>Customer</th>
              <th className="text-left p-4" style={{
              fontSize: '12px',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: '#FFFFFF'
            }}>Amount</th>
              <th className="text-left p-4" style={{
              fontSize: '12px',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: '#FFFFFF'
            }}>Status</th>
              <th className="text-left p-4" style={{
              fontSize: '12px',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: '#FFFFFF'
            }}>Date</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order, i) => <tr key={order.id} className="border-b-2 border-black" style={{
            backgroundColor: i % 2 === 0 ? '#FFFFFF' : '#F5F5F5'
          }}>
                <td className="p-4" style={{
              fontWeight: 700,
              color: "var(--color.danger, #DC2626)"
            }}>{order.id}</td>
                <td className="p-4" style={{
              fontWeight: 500,
              color: '#111827'
            }}>{order.customer}</td>
                <td className="p-4" style={{
              fontWeight: 700,
              color: '#111827'
            }}>{order.amount}</td>
                <td className="p-4">
                  <span className="px-3 py-1 text-xs font-black uppercase border-2 border-black" style={{
                backgroundColor: order.status === 'Completed' ? '#bbf7d0' : order.status === 'Processing' ? '#fef08a' : '#bfdbfe',
                color: '#111827',
                borderRadius: '0px'
              }}>
                    {order.status}
                  </span>
                </td>
                <td className="p-4" style={{
              fontSize: '14px',
              color: '#6B7280'
            }}>{order.date}</td>
              </tr>)}
          </tbody>
        </table>
      </div>
    </div>;
}