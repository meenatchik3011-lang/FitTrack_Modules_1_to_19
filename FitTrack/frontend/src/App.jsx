
import React, { useEffect, useState } from 'react';
import {
  Routes,
  Route,
  Navigate,
  Link,
  useNavigate
} from 'react-router-dom';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend
} from 'recharts';

import api from './api';
import {
  Nutrition, WaterTracker, Recommendations, WorkoutTimer,
  Integrations, AdvancedAnalytics, Reminders
} from './Phase3';



function Protected({ children }) {
  return localStorage.getItem('fittrack_token')
    ? children
    : <Navigate to="/login" replace />;
}


function Auth({ register = false }) {
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: ''
  });

  const [error, setError] = useState('');
  const nav = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setError('');

    try {
      if (register) {
        await api.post('/auth/register', form);
        alert('Account created. Please log in.');
        nav('/login');
      } else {
        const r = await api.post('/auth/login', {
          email: form.email,
          password: form.password
        });

        localStorage.setItem(
          'fittrack_token',
          r.data.access_token
        );

        localStorage.setItem(
          'fittrack_user',
          JSON.stringify(r.data.user)
        );

        nav('/');
      }
    } catch (err) {
      setError(
        err.response?.data?.detail || 'Request failed'
      );
    }
  }

  return (
    <main className="auth">
      <form className="panel" onSubmit={submit}>
        <h1>FitTrack</h1>
        <p>Your fitness, your progress.</p>

        {register && (
          <input
            placeholder="Username"
            minLength="3"
            value={form.username}
            onChange={e =>
              setForm({ ...form, username: e.target.value })
            }
            required
          />
        )}

        <input
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={e =>
            setForm({ ...form, email: e.target.value })
          }
          required
        />

        <input
          type="password"
          placeholder="Password (8–72 characters)"
          minLength="8"
          maxLength="72"
          value={form.password}
          onChange={e =>
            setForm({ ...form, password: e.target.value })
          }
          required
        />

        {error && (
          <p className="error">{String(error)}</p>
        )}

        <button>
          {register ? 'Create account' : 'Login'}
        </button>

        <p>
          {register
            ? 'Already registered? '
            : 'New to FitTrack? '}

          <Link to={register ? '/login' : '/register'}>
            {register ? 'Login' : 'Register'}
          </Link>
        </p>
      </form>
    </main>
  );
}


function Layout({ children }) {
  const nav = useNavigate();

  const user = JSON.parse(
    localStorage.getItem('fittrack_user') || '{}'
  );

  const [count, setCount] = useState(0);

  async function loadCount() {
    try {
      setCount(
        (await api.get('/notifications/unread-count'))
          .data.unread_count || 0
      );
    } catch {}
  }

  useEffect(() => {
    loadCount();

    const id = setInterval(loadCount, 15000);

    return () => clearInterval(id);
  }, []);

  return (
    <>
      <header>
        <b>FitTrack</b>

        <nav>
          <Link to="/">Dashboard</Link>
          <Link to="/workouts">Workouts</Link>
          <Link to="/goals">Goals</Link>
          <Link to="/plans">Plans</Link>
          <Link to="/exercises">Exercises</Link>
          <Link to="/comparison">Comparison</Link>
          <Link to="/achievements">Achievements</Link>
          <Link to="/reports">Reports</Link>

          <Link to="/nutrition">Nutrition</Link>
          <Link to="/water">Water</Link>
          <Link to="/recommendations">Suggestions</Link>
          <Link to="/timer">Timer</Link>
          <Link to="/integrations">Integrations</Link>
          <Link to="/analytics">Analytics</Link>
          <Link to="/reminders">Reminders</Link>
          <Link to="/notifications">
            Notifications{' '}
            {count > 0 && (
              <span className="notification-badge">
                {count > 99 ? '99+' : count}
              </span>
            )}
          </Link>
        </nav>

        <span>
          {user.username || 'User'}

          <button
            className="small"
            onClick={() => {
              localStorage.removeItem('fittrack_token');
              localStorage.removeItem('fittrack_user');
              nav('/login');
            }}
          >
            Logout
          </button>
        </span>
      </header>

      <main className="container">
        {children}
      </main>
    </>
  );
}


function useLoad(url, initial = []) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState('');

  async function load() {
    try {
      setData((await api.get(url)).data);
      setError('');
    } catch (e) {
      setError(
        e.response?.data?.detail || 'Could not load data'
      );
    }
  }

  useEffect(() => {
    load();
  }, [url]);

  return [data, setData, error, load];
}


// MODULE 12: DASHBOARD
function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    try {
      setData((await api.get('/dashboard')).data);
      setError('');
    } catch (e) {
      setError(
        e.response?.data?.detail || 'Dashboard could not load'
      );
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <Layout>
      <h1>
        Welcome, {data?.user?.username || 'to FitTrack'}!
      </h1>

      {error && <p className="error">{error}</p>}

      {data && (
        <>
          <section className="cards">

            <article>
              <small>Today's workouts</small>
              <h2>{data.daily_summary.workouts}</h2>
            </article>

            <article>
              <small>Calories burned</small>
              <h2>{data.daily_summary.calories}</h2>
            </article>

            <article>
              <small>Minutes active</small>
              <h2>{data.daily_summary.duration}</h2>
            </article>

            <article>
              <small>Current streak 🔥</small>

              <h2>
                {data.streak.current_streak}{' '}
                {data.streak.current_streak === 1
                  ? 'day'
                  : 'days'}
              </h2>

              <small>
                Best: {data.streak.longest_streak}{' '}
                {data.streak.longest_streak === 1
                  ? 'day'
                  : 'days'}
              </small>
            </article>

            <article>
              <small>Badges earned</small>
              <h2>{data.earned_badges}</h2>
            </article>

          </section>

          <h2>Upcoming workouts</h2>

          <div className="cards">
            {data.upcoming_workouts.map(p => (
              <article key={p.id}>
                <h3>{p.title}</h3>
                <p>{p.description}</p>
                <b>{p.scheduled_date}</b>
              </article>
            ))}

            {!data.upcoming_workouts.length && (
              <p>
                No upcoming plans. Create one in Workout Plans.
              </p>
            )}
          </div>

          <h2>Goal progress</h2>

          <div className="cards">
            {data.goals.map(g => (
              <article key={g.id}>
                <h3>{g.goal_type}</h3>

                <p>
                  {g.current_value} / {g.target_value} · {g.status}
                </p>

                <progress
                  value={Math.min(
                    100,
                    g.current_value / g.target_value * 100
                  )}
                  max="100"
                />
              </article>
            ))}

            {!data.goals.length && (
              <p>No goals added yet.</p>
            )}
          </div>
        </>
      )}
    </Layout>
  );
}


const emptyWorkout = {
  workout_name: '',
  category: 'Cardio',
  duration: 30,
  calories_burned: 100,
  workout_date: new Date().toISOString().slice(0, 10)
};


// MODULE 2: WORKOUT MANAGEMENT
function Workouts() {
  const [items, , err, load] = useLoad('/workouts');

  const [form, setForm] = useState(emptyWorkout);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();

    try {
      if (editing) {
        await api.put(`/workouts/${editing}`, form);
      } else {
        await api.post('/workouts', form);
      }

      setForm(emptyWorkout);
      setEditing(null);

      await load();
    } catch (x) {
      setError(
        x.response?.data?.detail || 'Could not save workout'
      );
    }
  }

  async function del(id) {
    if (confirm('Delete this workout?')) {
      await api.delete(`/workouts/${id}`);
      load();
    }
  }

  return (
    <Layout>
      <h1>Workout Management</h1>

      <form
        className="panel formgrid"
        onSubmit={submit}
      >
        <h2>{editing ? 'Edit workout' : 'Add workout'}</h2>

        <input
          placeholder="Workout name"
          value={form.workout_name}
          onChange={e =>
            setForm({
              ...form,
              workout_name: e.target.value
            })
          }
          required
        />

        <select
          value={form.category}
          onChange={e =>
            setForm({
              ...form,
              category: e.target.value
            })
          }
        >
          <option>Cardio</option>
          <option>Strength</option>
          <option>Yoga</option>
        </select>

        <input
          type="number"
          min="1"
          value={form.duration}
          onChange={e =>
            setForm({
              ...form,
              duration: +e.target.value
            })
          }
        />

        <input
          type="number"
          min="0"
          value={form.calories_burned}
          onChange={e =>
            setForm({
              ...form,
              calories_burned: +e.target.value
            })
          }
        />

        <input
          type="date"
          value={form.workout_date}
          onChange={e =>
            setForm({
              ...form,
              workout_date: e.target.value
            })
          }
        />

        <button>
          {editing ? 'Update' : 'Add workout'}
        </button>

        {editing && (
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setEditing(null);
              setForm(emptyWorkout);
            }}
          >
            Cancel
          </button>
        )}
      </form>

      {(err || error) && (
        <p className="error">{err || error}</p>
      )}

      <WorkoutRows
        items={items}
        edit={w => {
          setEditing(w.id);
          setForm({ ...w });
        }}
        del={del}
      />
    </Layout>
  );
}


function WorkoutRows({ items, edit, del }) {
  return (
    <div className="tablewrap">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Category</th>
            <th>Duration</th>
            <th>Calories</th>
            <th>Date</th>
            {edit && <th>Actions</th>}
          </tr>
        </thead>

        <tbody>
          {items.map(w => (
            <tr key={w.id}>
              <td>{w.workout_name}</td>
              <td>{w.category}</td>
              <td>{w.duration} min</td>
              <td>{w.calories_burned}</td>
              <td>{w.workout_date}</td>

              {edit && (
                <td>
                  <button
                    className="small"
                    onClick={() => edit(w)}
                  >
                    Edit
                  </button>{' '}

                  <button
                    className="small danger"
                    onClick={() => del(w.id)}
                  >
                    Delete
                  </button>
                </td>
              )}
            </tr>
          ))}

          {!items.length && (
            <tr>
              <td colSpan="6">
                No workouts logged yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}


// MODULE 4: FITNESS GOALS
function Goals() {
  const [items, , err, load] = useLoad('/goals');

  const [form, setForm] = useState({
    goal_type: 'Weight Loss',
    target_value: 5,
    current_value: 0,
    deadline: new Date(
      Date.now() + 30 * 86400000
    ).toISOString().slice(0, 10)
  });

  async function submit(e) {
    e.preventDefault();
    await api.post('/goals', form);
    load();
  }

  async function update(g) {
    const v = prompt(
      'Enter updated progress',
      g.current_value
    );

    if (v !== null && v.trim() !== '' && !isNaN(+v)) {
      await api.patch(`/goals/${g.id}`, {
        current_value: +v
      });

      load();
    }
  }

  async function del(id) {
    if (confirm('Delete goal?')) {
      await api.delete(`/goals/${id}`);
      load();
    }
  }

  return (
    <Layout>
      <h1>Fitness Goals</h1>

      {err && <p className="error">{err}</p>}

      <form
        className="panel formgrid"
        onSubmit={submit}
      >
        <h2>Create goal</h2>

        <select
          value={form.goal_type}
          onChange={e =>
            setForm({
              ...form,
              goal_type: e.target.value
            })
          }
        >
          <option>Weight Loss</option>
          <option>Muscle Gain</option>
          <option>Steps</option>
        </select>

        <input
          type="number"
          min="0.1"
          step="any"
          value={form.target_value}
          onChange={e =>
            setForm({
              ...form,
              target_value: +e.target.value
            })
          }
        />

        <input
          type="number"
          min="0"
          step="any"
          value={form.current_value}
          onChange={e =>
            setForm({
              ...form,
              current_value: +e.target.value
            })
          }
        />

        <input
          type="date"
          value={form.deadline}
          onChange={e =>
            setForm({
              ...form,
              deadline: e.target.value
            })
          }
        />

        <button>Create goal</button>
      </form>

      <div className="cards">
        {items.map(g => (
          <article key={g.id}>
            <h3>{g.goal_type}</h3>

            <p>
              {g.current_value} / {g.target_value}
            </p>

            <progress
              value={Math.min(
                100,
                g.current_value / g.target_value * 100
              )}
              max="100"
            />

            <p>
              {g.deadline} · {g.status}
            </p>

            <button
              className="small"
              onClick={() => update(g)}
            >
              Update
            </button>{' '}

            <button
              className="small danger"
              onClick={() => del(g.id)}
            >
              Delete
            </button>
          </article>
        ))}
      </div>
    </Layout>
  );
}


// MODULE 7: WORKOUT PLANS
function Plans() {
  const [items, , err, load] = useLoad('/plans');

  const [form, setForm] = useState({
    title: '',
    description: '',
    scheduled_date: new Date().toISOString().slice(0, 10)
  });

  async function submit(e) {
    e.preventDefault();

    await api.post('/plans', form);

    setForm({
      ...form,
      title: '',
      description: ''
    });

    load();
  }

  async function del(id) {
    if (confirm('Delete this plan?')) {
      await api.delete(`/plans/${id}`);
      load();
    }
  }

  return (
    <Layout>
      <h1>Workout Plans & Schedule</h1>

      <form
        className="panel formgrid"
        onSubmit={submit}
      >
        <h2>Schedule a workout</h2>

        <input
          placeholder="Plan title"
          value={form.title}
          onChange={e =>
            setForm({
              ...form,
              title: e.target.value
            })
          }
          required
        />

        <input
          placeholder="Description"
          value={form.description}
          onChange={e =>
            setForm({
              ...form,
              description: e.target.value
            })
          }
        />

        <input
          type="date"
          min={new Date().toISOString().slice(0, 10)}
          value={form.scheduled_date}
          onChange={e =>
            setForm({
              ...form,
              scheduled_date: e.target.value
            })
          }
          required
        />

        <button>Save plan</button>
      </form>

      {err && <p className="error">{err}</p>}

      <h2>Calendar / upcoming schedule</h2>

      <div className="cards">
        {items.map(p => (
          <article key={p.id}>
            <small>{p.scheduled_date}</small>
            <h3>{p.title}</h3>
            <p>{p.description}</p>

            <button
              className="small danger"
              onClick={() => del(p.id)}
            >
              Delete
            </button>
          </article>
        ))}
      </div>

      {!items.length && <p>No plans scheduled yet.</p>}
    </Layout>
  );
}


// MODULE 8: EXERCISE LIBRARY
function Exercises() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [error, setError] = useState('');

  async function load() {
    try {
      const r = await api.get('/exercises', {
        params: {
          search: search || undefined,
          category: category || undefined
        }
      });

      setItems(r.data);
      setError('');
    } catch (e) {
      setError(
        e.response?.data?.detail || 'Could not load exercises'
      );
    }
  }

  useEffect(() => {
    load();
  }, [search, category]);

  async function add(id) {
    try {
      await api.post(
        `/exercises/${id}/add-to-workouts`
      );

      alert("Exercise added to today's workouts");
    } catch (e) {
      alert(
        e.response?.data?.detail || 'Could not add exercise'
      );
    }
  }

  return (
    <Layout>
      <h1>Exercise Library</h1>

      <div className="formgrid">
        <input
          placeholder="Search exercises"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
        >
          <option value="">All categories</option>
          <option>Cardio</option>
          <option>Strength</option>
          <option>Yoga</option>
        </select>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="cards">
        {items.map(x => (
          <article key={x.id}>
            <small>
              {x.category} · {x.duration} min
            </small>

            <h3>{x.name}</h3>
            <p>{x.description}</p>

            <button onClick={() => add(x.id)}>
              Add to today's workouts
            </button>
          </article>
        ))}
      </div>
    </Layout>
  );
}


// MODULE 9: PROGRESS COMPARISON
function Comparison() {
  const [weekly, setWeekly] = useState(null);
  const [monthly, setMonthly] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/comparison/weekly'),
      api.get('/comparison/monthly')
    ])
      .then(([w, m]) => {
        setWeekly(w.data);
        setMonthly(m.data);
      })
      .catch(e => {
        setError(
          e.response?.data?.detail ||
          'Could not load comparison'
        );
      });
  }, []);

  const chart = weekly
    ? [
        {
          period: 'Previous 7 days',
          ...weekly.previous_period
        },
        {
          period: 'Current 7 days',
          ...weekly.current_period
        }
      ]
    : [];

  return (
    <Layout>
      <h1>Progress Comparison</h1>

      {error && <p className="error">{error}</p>}

      {weekly && (
        <>
          <h2>Weekly comparison</h2>

          <div className="cards">
            {['workouts', 'calories', 'duration'].map(k => (
              <article key={k}>
                <small>{k}</small>

                <h2>
                  {weekly.change[k] > 0 ? '+' : ''}
                  {weekly.change[k]}
                </h2>

                <p>Change vs previous 7 days</p>
              </article>
            ))}
          </div>

          <article>
            <div style={{ height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={chart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip />
                  <Legend />

                  <Bar
                    dataKey="workouts"
                    fill="#2563eb"
                  />

                  <Bar
                    dataKey="calories"
                    fill="#16a34a"
                  />

                  <Bar
                    dataKey="duration"
                    fill="#f59e0b"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>
        </>
      )}

      {monthly && (
        <>
          <h2>Monthly comparison</h2>

          <div className="cards">
            {['workouts', 'calories', 'duration'].map(k => (
              <article key={k}>
                <small>{k}</small>

                <h2>
                  {monthly.change[k] > 0 ? '+' : ''}
                  {monthly.change[k]}
                </h2>

                <p>Change vs previous month</p>
              </article>
            ))}
          </div>
        </>
      )}
    </Layout>
  );
}


// MODULE 10 & 11: STREAKS AND ACHIEVEMENTS
function Achievements() {
  const [badges, , err] = useLoad('/badges');

  const [streak, setStreak] = useState({});

  useEffect(() => {
    api.get('/streak')
      .then(r => setStreak(r.data))
      .catch(() => {});
  }, []);

  return (
    <Layout>
      <h1>Streaks & Achievements</h1>

      <section className="cards">

        <article>
          <small>Current streak 🔥</small>

          <h2>
            {streak.current_streak || 0}{' '}
            {(streak.current_streak || 0) === 1
              ? 'day'
              : 'days'}
          </h2>
        </article>

        <article>
          <small>Longest streak 🏆</small>

          <h2>
            {streak.longest_streak || 0}{' '}
            {(streak.longest_streak || 0) === 1
              ? 'day'
              : 'days'}
          </h2>
        </article>

        <article>
          <small>Last workout</small>

          <h2>
            {streak.last_workout_date || '—'}
          </h2>
        </article>

      </section>

      {err && <p className="error">{err}</p>}

      <h2>Achievement badges</h2>

      <div className="cards">
        {badges.map(b => (
          <article
            key={b.id}
            style={{
              opacity: b.earned ? 1 : 0.5
            }}
          >
            <h2>{b.icon}</h2>

            <h3>
              {b.name} {b.earned ? '✓' : '🔒'}
            </h3>

            <p>{b.description}</p>

            <small>
              {b.earned ? 'Earned' : 'Not earned yet'}
            </small>
          </article>
        ))}
      </div>
    </Layout>
  );
}


// MODULE 5: REPORTS & ANALYTICS
function Reports() {
  const [weekly, setWeekly] = useState([]);
  const [monthly, setMonthly] = useState({});

  useEffect(() => {
    Promise.all([
      api.get('/reports/weekly'),
      api.get('/reports/monthly')
    ])
      .then(([w, m]) => {
        setWeekly(w.data);
        setMonthly(m.data);
      })
      .catch(() => {});
  }, []);

  return (
    <Layout>
      <h1>Reports & Analytics</h1>

      <section className="cards">
        <article>
          <small>Monthly workouts</small>
          <h2>{monthly.total_workouts ?? 0}</h2>
        </article>

        <article>
          <small>Monthly calories</small>
          <h2>{monthly.total_calories ?? 0}</h2>
        </article>

        <article>
          <small>Monthly minutes</small>
          <h2>{monthly.total_duration ?? 0}</h2>
        </article>
      </section>

      <article>
        <h2>Last 7 days — calories burned</h2>

        <div style={{ height: 300 }}>
          <ResponsiveContainer>
            <BarChart data={weekly}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />

              <Bar
                dataKey="calories"
                fill="#2563eb"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>
    </Layout>
  );
}


// MODULE 6: NOTIFICATIONS
function Notifications() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');

  async function load() {
    try {
      setItems(
        (await api.get('/notifications')).data
      );

      setError('');
    } catch (e) {
      setError(
        e.response?.data?.detail ||
        'Could not load notifications'
      );
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function read(id) {
    try {
      await api.patch(`/notifications/${id}/read`);
      await load();
    } catch (e) {
      alert(
        e.response?.data?.detail ||
        'Could not mark as read'
      );
    }
  }

  async function all() {
    try {
      await api.patch('/notifications/read-all');
      await load();
    } catch (e) {
      alert(
        e.response?.data?.detail ||
        'Could not mark all as read'
      );
    }
  }

  const unread = items.filter(
    n => !n.is_read
  ).length;

  return (
    <Layout>
      <div className="heading">
        <div>
          <h1>Notifications</h1>
          <p>{unread} unread</p>
        </div>

        <button
          disabled={!unread}
          onClick={all}
        >
          Mark all read
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {items.map(n => (
        <article
          className={`notification ${
            n.is_read
              ? 'read-notification'
              : 'unread-notification'
          }`}
          key={n.id}
        >
          <div>
            <b>{n.title}</b>
            <p>{n.message}</p>

            <small>
              {new Date(n.created_at).toLocaleString()}
            </small>
          </div>

          {!n.is_read && (
            <button
              className="small"
              onClick={() => read(n.id)}
            >
              Mark read
            </button>
          )}
        </article>
      ))}
    </Layout>
  );
}


// MAIN APP ROUTES
export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={<Auth />}
      />

      <Route
        path="/register"
        element={<Auth register />}
      />

      <Route
        path="/"
        element={
          <Protected>
            <Dashboard />
          </Protected>
        }
      />

      <Route
        path="/workouts"
        element={
          <Protected>
            <Workouts />
          </Protected>
        }
      />

      <Route
        path="/goals"
        element={
          <Protected>
            <Goals />
          </Protected>
        }
      />

      <Route
        path="/plans"
        element={
          <Protected>
            <Plans />
          </Protected>
        }
      />

      <Route
        path="/exercises"
        element={
          <Protected>
            <Exercises />
          </Protected>
        }
      />

      <Route
        path="/comparison"
        element={
          <Protected>
            <Comparison />
          </Protected>
        }
      />

      <Route
        path="/achievements"
        element={
          <Protected>
            <Achievements />
          </Protected>
        }
      />

      <Route
        path="/reports"
        element={
          <Protected>
            <Reports />
          </Protected>
        }
      />

      <Route path="/nutrition" element={<Protected><Layout><Nutrition /></Layout></Protected>} />
      <Route path="/water" element={<Protected><Layout><WaterTracker /></Layout></Protected>} />
      <Route path="/recommendations" element={<Protected><Layout><Recommendations /></Layout></Protected>} />
      <Route path="/timer" element={<Protected><Layout><WorkoutTimer /></Layout></Protected>} />
      <Route path="/integrations" element={<Protected><Layout><Integrations /></Layout></Protected>} />
      <Route path="/analytics" element={<Protected><Layout><AdvancedAnalytics /></Layout></Protected>} />
      <Route path="/reminders" element={<Protected><Layout><Reminders /></Layout></Protected>} />

      <Route
        path="/notifications"
        element={
          <Protected>
            <Notifications />
          </Protected>
        }
      />

      <Route
        path="*"
        element={<Navigate to="/" replace />}
      />
    </Routes>
  );
}
