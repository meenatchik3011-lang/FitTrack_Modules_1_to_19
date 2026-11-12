import React, { useEffect, useState } from 'react';
import api from './api';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid
} from 'recharts';

function ErrorText({ children }) {
  return children ? <p className="error">{String(children)}</p> : null;
}
function Panel({ title, children }) {
  return <article style={{ marginBottom: 18 }}><h2>{title}</h2>{children}</article>;
}

// MODULE 13 - Nutrition & Meal Tracking
export function Nutrition() {
  const emptyForm = {
    meal_type: 'Breakfast',
    food_name: '',
    calories: 0,
    protein: 0,
    carbs: 0,
    fats: 0
  };

  const [meals, setMeals] = useState([]);
  const [summary, setSummary] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const [m, s] = await Promise.all([
        api.get('/meals'),
        api.get('/nutrition/summary')
      ]);
      setMeals(m.data);
      setSummary(s.data);
      setError('');
    } catch (e) {
      setError(e.response?.data?.detail || 'Could not load nutrition data');
    }
  }

  useEffect(() => {
    load();
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(current => ({ ...current, [name]: value }));
  }

  function startEdit(meal) {
    setEditingId(meal.id);
    setForm({
      meal_type: meal.meal_type,
      food_name: meal.food_name,
      calories: meal.calories,
      protein: meal.protein,
      carbs: meal.carbs,
      fats: meal.fats
    });
    setError('');
    setSuccess('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setSuccess('');
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    const payload = {
      ...form,
      calories: Number(form.calories),
      protein: Number(form.protein),
      carbs: Number(form.carbs),
      fats: Number(form.fats)
    };

    try {
      if (editingId !== null) {
        await api.put(`/meals/${editingId}`, payload);
        setSuccess('Meal updated successfully.');
      } else {
        await api.post('/meals', payload);
        setSuccess('Meal added successfully.');
      }

      setEditingId(null);
      setForm(emptyForm);
      await load();
    } catch (e) {
      setError(e.response?.data?.detail || (editingId !== null ? 'Could not update meal' : 'Could not save meal'));
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    if (!window.confirm('Are you sure you want to delete this meal?')) return;
    try {
      await api.delete(`/meals/${id}`);
      if (editingId === id) cancelEdit();
      setSuccess('Meal deleted successfully.');
      setError('');
      await load();
    } catch (e) {
      setError(e.response?.data?.detail || 'Delete failed');
    }
  }

  return (
    <>
      <h1>Nutrition & Meal Tracking</h1>
      <ErrorText>{error}</ErrorText>
      {success && <p className="success">{success}</p>}

      <section className="cards">
        <article><small>Calories today</small><h2>{summary.calories ?? 0}</h2></article>
        <article><small>Protein (g)</small><h2>{summary.protein ?? 0}</h2></article>
        <article><small>Carbs (g)</small><h2>{summary.carbs ?? 0}</h2></article>
        <article><small>Fats (g)</small><h2>{summary.fats ?? 0}</h2></article>
      </section>

      <Panel title={editingId !== null ? 'Edit meal' : 'Add meal'}>
        <form className="formgrid" onSubmit={submit}>
          <select name="meal_type" value={form.meal_type} onChange={handleChange}>
            <option>Breakfast</option>
            <option>Lunch</option>
            <option>Dinner</option>
            <option>Snacks</option>
          </select>

          <input
            name="food_name"
            placeholder="Food name"
            value={form.food_name}
            onChange={handleChange}
            minLength="2"
            maxLength="120"
            required
          />

          <input
            name="calories"
            type="number"
            min="0"
            max="10000"
            placeholder="Calories"
            value={form.calories}
            onChange={handleChange}
            required
          />

          <input
            name="protein"
            type="number"
            min="0"
            max="500"
            step="0.1"
            placeholder="Protein (g)"
            value={form.protein}
            onChange={handleChange}
          />

          <input
            name="carbs"
            type="number"
            min="0"
            max="1000"
            step="0.1"
            placeholder="Carbs (g)"
            value={form.carbs}
            onChange={handleChange}
          />

          <input
            name="fats"
            type="number"
            min="0"
            max="500"
            step="0.1"
            placeholder="Fats (g)"
            value={form.fats}
            onChange={handleChange}
          />

          <button type="submit" disabled={saving}>
            {saving ? 'Saving...' : editingId !== null ? 'Update Meal' : 'Add Meal'}
          </button>

          {editingId !== null && (
            <button type="button" className="secondary" onClick={cancelEdit}>
              Cancel Edit
            </button>
          )}
        </form>
      </Panel>

      <Panel title="Today's meals">
        {meals.length ? (
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Meal</th>
                  <th>Food</th>
                  <th>Calories</th>
                  <th>Macros (P/C/F)</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {meals.map(meal => (
                  <tr key={meal.id}>
                    <td>{meal.meal_type}</td>
                    <td>{meal.food_name}</td>
                    <td>{meal.calories}</td>
                    <td>{meal.protein}/{meal.carbs}/{meal.fats} g</td>
                    <td>
                      <button
                        type="button"
                        className="small"
                        onClick={() => startEdit(meal)}
                      >
                        Edit
                      </button>
                      {' '}
                      <button
                        type="button"
                        className="small danger"
                        onClick={() => remove(meal.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No meals recorded today.</p>
        )}
      </Panel>
    </>
  );
}

// MODULE 14 - Water Tracker
export function WaterTracker() {
  const [data,setData]=useState({entries:[],total_ml:0,goal_ml:2000,progress_percent:0});
  const [amount,setAmount]=useState(250); const [error,setError]=useState('');
  async function load(){try{setData((await api.get('/water')).data);setError('')}catch(e){setError(e.response?.data?.detail||'Could not load water tracker')}}
  useEffect(()=>{load()},[]);
  async function add(e){e.preventDefault();try{await api.post('/water',{quantity:Number(amount)});load()}catch(e){setError(e.response?.data?.detail||'Could not add water')}}
  async function remove(id){await api.delete(`/water/${id}`);load()}
  return <><h1>Water Intake Tracker</h1><ErrorText>{error}</ErrorText><Panel title="Daily hydration">
    <h2>{(data.total_ml/1000).toFixed(2)} L / {(data.goal_ml/1000).toFixed(1)} L</h2>
    <progress max="100" value={data.progress_percent} style={{width:'100%',height:18}}/>
    <p>{data.progress_percent}% of daily goal · {data.remaining_ml} ml remaining</p>
    <form className="formgrid" onSubmit={add}><input type="number" min="1" max="5000" value={amount} onChange={e=>setAmount(e.target.value)}/><button>Add water (ml)</button></form>
  </Panel><Panel title="Today's entries">{data.entries?.map(x=><p key={x.id}>{x.quantity} ml <button className="small danger" onClick={()=>remove(x.id)}>Delete</button></p>)}</Panel></>;
}

// MODULE 15 - Rule-based smart suggestions
export function Recommendations() {
  const [data,setData]=useState(null); const [error,setError]=useState('');
  useEffect(()=>{api.get('/recommendations').then(r=>setData(r.data)).catch(e=>setError(e.response?.data?.detail||'Could not load suggestions'))},[]);
  return <><h1>Recommended Workouts</h1><ErrorText>{error}</ErrorText>{data&&<><p>{data.reason}</p><small>Personalized rule-based suggestions · Current streak: {data.current_streak} days</small><div className="cards">{data.suggestions.map(x=><article key={x.id}><small>{x.category} · {x.duration} min</small><h3>{x.name}</h3><p>{x.description}</p><p>{x.reason}</p></article>)}</div><p><small>{data.note}</small></p></>}</>;
}

// MODULE 16 - Timer
export function WorkoutTimer() {
  const [active, setActive] = useState(null);
  const [name, setName] = useState('Timed Workout');
  const [elapsed, setElapsed] = useState(0);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function loadHistory() {
    try {
      const response = await api.get('/timer/history');
      setHistory(Array.isArray(response.data) ? response.data : []);
    } catch (e) {
      setError(e.response?.data?.detail || 'Could not load workout history');
    }
  }

  async function loadTimer() {
    try {
      const response = await api.get('/timer/active');
      const data = response.data;
      setActive(data.active ? data : null);

      if (data.active) {
        setElapsed(Number(data.elapsed_seconds || 0));
      }
    } catch (e) {
      setError(e.response?.data?.detail || 'Timer request failed');
    }
  }

  useEffect(() => {
    loadTimer();
    loadHistory();
  }, []);

  useEffect(() => {
    if (!active) return undefined;

    const timer = setInterval(() => {
      setElapsed(value => value + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [active?.id]);

  const formatTime = seconds => {
    const safeSeconds = Math.max(0, Number(seconds) || 0);
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const remainingSeconds = safeSeconds % 60;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  };

  function formatDate(value) {
    if (!value) return '—';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
  }

  async function start() {
    if (!name.trim()) {
      setError('Please enter a workout name.');
      return;
    }

    try {
      setError('');
      setSuccess('');
      const response = await api.post('/timer/start', {
        workout_name: name.trim()
      });

      setActive({ id: response.data.id });
      setElapsed(Number(response.data.elapsed_seconds || 0));
    } catch (e) {
      setError(e.response?.data?.detail || 'Could not start timer');
    }
  }

  async function stop() {
    if (!active?.id) {
      setError('There is no active workout timer.');
      return;
    }

    try {
      setError('');
      setSuccess('');
      const response = await api.post(`/timer/${active.id}/stop`);
      const data = response.data || {};
      const elapsedSeconds = Number(data.elapsed_seconds ?? elapsed);
      const fullMinutes = Math.floor(elapsedSeconds / 60);
      const estimatedCalories = Math.max(1, Math.ceil(elapsedSeconds / 60)) * 5;

      setElapsed(elapsedSeconds);
      setActive(null);
      setSuccess(
        `Workout saved successfully! Duration: ${formatTime(elapsedSeconds)} (${fullMinutes} full minutes). Estimated calories: ${estimatedCalories} kcal.`
      );

      await loadHistory();
    } catch (e) {
      setError(e.response?.data?.detail || 'Could not stop timer');
    }
  }

  return (
    <>
      <h1>Workout Timer & Live Tracking</h1>

      <Panel title="Workout timer">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          disabled={!!active}
          placeholder="Workout name"
          maxLength={120}
        />

        <h2 style={{ fontSize: 42 }}>{formatTime(elapsed)}</h2>

        {!active ? (
          <button type="button" onClick={start}>Start workout</button>
        ) : (
          <button type="button" className="danger" onClick={stop}>
            Stop & save workout
          </button>
        )}

        <ErrorText>{error}</ErrorText>
        {success && <p className="success">{success}</p>}

        <p>
          <small>
            Calories are estimated at 5 kcal/minute. This is an approximation,
            not a measured value.
          </small>
        </p>
      </Panel>

      <Panel title="Saved workout history">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <button type="button" className="secondary" onClick={loadHistory}>
            Refresh history
          </button>
        </div>

        {history.length > 0 ? (
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Workout name</th>
                  <th>Started at</th>
                  <th>Duration</th>
                  <th>Calories</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map(session => (
                  <tr key={session.id}>
                    <td>{session.workout_name || 'Timed Workout'}</td>
                    <td>{formatDate(session.started_at)}</td>
                    <td>{Number(session.duration_minutes || 0)} min</td>
                    <td>{Number(session.calories_burned || 0)} kcal</td>
                    <td>{session.status || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No saved workouts yet. Complete a timer session to see it here.</p>
        )}
      </Panel>
    </>
  );
}

// MODULE 17 - Integration status/manual import
export function Integrations() {
  const [status,setStatus]=useState(null);const [rows,setRows]=useState([]);const [form,setForm]=useState({provider:'MANUAL',steps:0,active_minutes:0});const [message,setMessage]=useState('');
  async function load(){const [s,a]=await Promise.all([api.get('/integrations/status'),api.get('/integrations/activity')]);setStatus(s.data);setRows(a.data)}
  useEffect(()=>{load().catch(e=>setMessage(e.response?.data?.detail||'Could not load integrations'))},[]);
  async function sync(e){e.preventDefault();try{await api.post('/integrations/manual-sync',{...form,steps:Number(form.steps),active_minutes:Number(form.active_minutes)});setMessage('Activity imported successfully.');load()}catch(e){setMessage(e.response?.data?.detail||'Import failed')}}
  return <><h1>Third-Party Integrations</h1><Panel title="Provider availability"><p>Google Fit: {status?.google_fit?.message||'Loading...'}</p><p>Apple Health: {status?.apple_health?.message||'Loading...'}</p><p>Manual import: {status?.manual_import?.message||''}</p><p><small>Live provider OAuth is optional and is not configured in this starter project.</small></p></Panel><Panel title="Import activity for testing"><form className="formgrid" onSubmit={sync}><select value={form.provider} onChange={e=>setForm({...form,provider:e.target.value})}><option value="MANUAL">Manual</option><option value="GOOGLE_FIT">Google Fit export</option><option value="APPLE_HEALTH">Apple Health export</option></select><input type="number" min="0" placeholder="Steps" value={form.steps} onChange={e=>setForm({...form,steps:e.target.value})}/><input type="number" min="0" placeholder="Active minutes" value={form.active_minutes} onChange={e=>setForm({...form,active_minutes:e.target.value})}/><button>Import activity</button></form>{message&&<p>{message}</p>}</Panel><Panel title="Imported activity">{rows.map(x=><p key={x.id}>{x.provider}: {x.steps} steps · {x.active_minutes} active minutes</p>)}</Panel></>;
}

// MODULE 18 - Advanced Analytics
export function AdvancedAnalytics() {
  const [overview, setOverview] = useState(null);
  const [trends, setTrends] = useState([]);
  const [comparison, setComparison] = useState(null);
  const [period, setPeriod] = useState(30);
  const [error, setError] = useState('');
  const [comparisonError, setComparisonError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadAnalytics() {
      setLoading(true);
      setError('');
      setComparisonError('');

      try {
        const [overviewResponse, trendsResponse] = await Promise.all([
          api.get('/analytics/overview'),
          api.get(`/analytics/trends?days=${period}`)
        ]);

        if (!cancelled) {
          setOverview(overviewResponse.data);
          setTrends(Array.isArray(trendsResponse.data) ? trendsResponse.data : []);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.response?.data?.detail || 'Could not load analytics');
        }
      }

      // Keep monthly comparison separate so a missing comparison endpoint
      // does not prevent the existing analytics dashboard from loading.
      try {
        const comparisonResponse = await api.get('/analytics/monthly-comparison');
        if (!cancelled) setComparison(comparisonResponse.data);
      } catch (e) {
        if (!cancelled) {
          setComparison(null);
          setComparisonError(
            e.response?.data?.detail ||
            'Monthly comparison is unavailable. Check that the backend endpoint /api/analytics/monthly-comparison is added.'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAnalytics();
    return () => {
      cancelled = true;
    };
  }, [period]);

  const hasData = trends.some(item =>
    Number(item.calories || 0) > 0 ||
    Number(item.workouts || 0) > 0 ||
    Number(item.minutes || 0) > 0
  );

  const goalRate = Math.min(
    100,
    Math.max(0, Number(overview?.goal_completion_rate || 0))
  );

  function formatChange(currentValue, previousValue) {
    const current = Number(currentValue || 0);
    const previous = Number(previousValue || 0);

    if (previous === 0) {
      return current === 0 ? 'No change' : 'New activity';
    }

    const percentage = ((current - previous) / previous) * 100;
    const sign = percentage > 0 ? '+' : '';
    return `${sign}${percentage.toFixed(1)}%`;
  }

  function renderComparisonCard(label, key, unit = '') {
    const current = comparison?.current_month?.[key] ?? 0;
    const previous = comparison?.previous_month?.[key] ?? 0;

    return (
      <article key={key}>
        <small>{label}</small>
        <h2>{Number(current).toLocaleString()}{unit}</h2>
        <p>Previous period: {Number(previous).toLocaleString()}{unit}</p>
        <strong>{formatChange(current, previous)}</strong>
      </article>
    );
  }

  function renderChart(title, dataKey, color, unit = '') {
    return (
      <Panel title={title}>
        {hasData ? (
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={value => [`${value}${unit}`, title]} />
                <Bar dataKey={dataKey} fill={color} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p>No activity data available for this period. Add a workout to see your analytics.</p>
        )}
      </Panel>
    );
  }

  return (
    <>
      <h1>Advanced Analytics</h1>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button
          type="button"
          className={period === 7 ? '' : 'secondary'}
          onClick={() => setPeriod(7)}
          disabled={period === 7 || loading}
        >
          Weekly (7 days)
        </button>
        <button
          type="button"
          className={period === 30 ? '' : 'secondary'}
          onClick={() => setPeriod(30)}
          disabled={period === 30 || loading}
        >
          Monthly (30 days)
        </button>
      </div>

      {loading && <p>Loading analytics...</p>}
      <ErrorText>{error}</ErrorText>

      {!loading && !error && overview && (
        <>
          <section className="cards">
            <article>
              <small>Total workouts</small>
              <h2>{overview.total_workouts ?? 0}</h2>
            </article>
            <article>
              <small>Total calories</small>
              <h2>{overview.total_calories ?? 0}</h2>
            </article>
            <article>
              <small>Active minutes</small>
              <h2>{overview.total_active_minutes ?? 0}</h2>
            </article>
            <article>
              <small>Goal completion</small>
              <h2>{overview.goal_completion_rate ?? 0}%</h2>
            </article>
            <article>
              <small>Workout consistency (7 days)</small>
              <h2>{overview.consistency_percent_last_7_days ?? 0}%</h2>
            </article>
          </section>

          <Panel title="Goal completion progress">
            <p>{goalRate}% completed</p>
            <progress
              value={goalRate}
              max="100"
              style={{ width: '100%', height: 18 }}
            />
            <small>
              {overview.completed_goals ?? 0} of {overview.goal_count ?? 0} goals completed
            </small>
          </Panel>

          <Panel title="Monthly Performance Comparison">
            <p>Current month compared with the same elapsed period of the previous month.</p>
            {comparison ? (
              <section className="cards">
                {renderComparisonCard('Workouts', 'workouts')}
                {renderComparisonCard('Calories burned', 'calories', ' kcal')}
                {renderComparisonCard('Active minutes', 'minutes', ' min')}
              </section>
            ) : (
              <p>{comparisonError || 'Monthly comparison data is not available.'}</p>
            )}
          </Panel>

          {renderChart('Calories burned', 'calories', '#2563eb', ' kcal')}
          {renderChart('Workout count', 'workouts', '#16a34a', ' workouts')}
          {renderChart('Active minutes', 'minutes', '#f59e0b', ' min')}
        </>
      )}
    </>
  );
}

// MODULE 19 - Reminders
export function Reminders() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({
    reminder_type: 'Workout',
    message: 'Time for your workout',
    remind_at: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const response = await api.get('/reminders');
      setItems(Array.isArray(response.data) ? response.data : []);
      setError('');
    } catch (e) {
      setError(e.response?.data?.detail || 'Could not load reminders');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(current => ({ ...current, [name]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.message.trim()) {
      setError('Please enter a reminder message.');
      return;
    }

    if (!form.remind_at) {
      setError('Please select a reminder date and time.');
      return;
    }

    const selectedDate = new Date(form.remind_at);
    if (Number.isNaN(selectedDate.getTime())) {
      setError('Please select a valid date and time.');
      return;
    }

    const payload = {
      reminder_type: form.reminder_type,
      message: form.message.trim(),
      // Convert the browser's local date/time to an ISO timestamp.
      // The updated backend normalizes timezone-aware values for its local DB.
      remind_at: selectedDate.toISOString()
    };

    try {
      setSaving(true);
      await api.post('/reminders', payload);
      setSuccess(`${form.reminder_type} reminder saved successfully.`);
      setForm({
        reminder_type: 'Workout',
        message: '',
        remind_at: ''
      });
      await load();
    } catch (e) {
      setError(
        e.response?.data?.detail ||
        e.response?.data?.message ||
        'Could not save reminder. Check the backend and try again.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function checkDue() {
    setError('');
    setSuccess('');

    try {
      setChecking(true);
      const response = await api.get('/reminders/check-due');
      const count = Number(response.data?.created_notifications || 0);
      setSuccess(
        `${count} due reminder(s) sent to Notifications.`
      );
      await load();
    } catch (e) {
      setError(
        e.response?.data?.detail ||
        'Reminder check failed. Please try again.'
      );
    } finally {
      setChecking(false);
    }
  }

  async function remove(id) {
    const confirmed = window.confirm('Delete this reminder?');
    if (!confirmed) return;

    setError('');
    setSuccess('');

    try {
      await api.delete(`/reminders/${id}`);
      setSuccess('Reminder deleted successfully.');
      await load();
    } catch (e) {
      setError(e.response?.data?.detail || 'Could not delete reminder.');
    }
  }

  function formatReminderDate(value) {
    if (!value) return 'Date not available';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? String(value)
      : date.toLocaleString();
  }

  return (
    <>
      <h1>In-App Reminders &amp; Alerts</h1>

      <Panel title="Create reminder">
        <form className="formgrid" onSubmit={submit}>
          <label>
            Reminder type
            <select
              name="reminder_type"
              value={form.reminder_type}
              onChange={handleChange}
            >
              <option value="Workout">Workout</option>
              <option value="Meal">Meal</option>
              <option value="Water">Water</option>
            </select>
          </label>

          <label>
            Reminder message
            <input
              name="message"
              type="text"
              placeholder={
                form.reminder_type === 'Meal'
                  ? 'Example: Time for lunch'
                  : form.reminder_type === 'Water'
                    ? 'Example: Drink 250 ml of water'
                    : 'Example: Time for your workout'
              }
              value={form.message}
              onChange={handleChange}
              minLength={2}
              maxLength={300}
              required
            />
          </label>

          <label>
            Reminder date and time
            <input
              name="remind_at"
              type="datetime-local"
              value={form.remind_at}
              onChange={handleChange}
              required
            />
          </label>

          <button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save reminder'}
          </button>
        </form>

        {error && <ErrorText>{error}</ErrorText>}
        {success && <p className="success">{success}</p>}

        <button
          type="button"
          onClick={checkDue}
          disabled={checking}
        >
          {checking ? 'Checking...' : 'Check due reminders now'}
        </button>

        <p>
          <small>
            Reminders are saved first. To create an in-app notification,
            the reminder must be due and the due-reminder check must run.
            This button checks reminders manually.
          </small>
        </p>
      </Panel>

      <Panel title="Your reminders">
        <button
          type="button"
          className="secondary"
          onClick={load}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Refresh reminders'}
        </button>

        {items.length > 0 ? (
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Message</th>
                  <th>Reminder time</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id}>
                    <td>{item.reminder_type}</td>
                    <td>{item.message}</td>
                    <td>{formatReminderDate(item.remind_at)}</td>
                    <td>{item.is_active ? 'Active' : 'Sent'}</td>
                    <td>
                      <button
                        type="button"
                        className="small danger"
                        onClick={() => remove(item.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>
            {loading
              ? 'Loading reminders...'
              : 'No reminders found. Create a Workout, Meal, or Water reminder above.'}
          </p>
        )}
      </Panel>
    </>
  );
}
