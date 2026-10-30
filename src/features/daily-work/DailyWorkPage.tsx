import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Download,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import type { StaffProfile } from '../auth/components/RoleGate';
import { supabase } from '../../lib/supabase';
import { employeeCode, indiaDate, niceDate } from '../attendance/attendance';

type Work = {
  id: string;
  employee_id: string;
  work_date: string;
  category: string;
  description: string;
  status: 'Pending' | 'In Progress' | 'Completed';
  created_at: string;
  deleted_at: string | null;
};

type Person = {
  user_id: string;
  full_name: string;
  staff_no: number;
  staff_employee_no: number | null;
  role: string;
  active: boolean;
};

type PortalWork = {
  id: string;
  employee_code: string;
  work_date: string;
  category: string;
  description: string;
  status: string;
  deleted_at: string | null;
};

type PortalIdentity = {
  full_name: string;
  kind: 'Employee' | 'Agent';
};

const categories = ['Customer Follow-up', 'Lead Calling', 'Digital Marketing', 'Office Work', 'Accounts', 'Site Coordination', 'Other'];

function exportSafe(value: string) {
  return /^[=+@\-\t\r]/.test(value) ? `'${value}` : value;
}

async function fetchPortalIdentityMap(codes: string[]) {
  const uniqueCodes = [...new Set(codes.filter(Boolean))];
  const result = new Map<string, PortalIdentity>();
  if (!uniqueCodes.length) return result;

  const [staffPeople, agents] = await Promise.all([
    supabase.from('id_portal_staff').select('employee_code,full_name').in('employee_code', uniqueCodes),
    supabase.from('agent_network').select('hierarchy_employee_code,full_name').in('hierarchy_employee_code', uniqueCodes),
  ]);

  if (!staffPeople.error) {
    (staffPeople.data ?? []).forEach((person) => {
      result.set(person.employee_code, { full_name: person.full_name, kind: 'Employee' });
    });
  }

  if (!agents.error) {
    (agents.data ?? []).forEach((agent) => {
      if (agent.hierarchy_employee_code) {
        result.set(agent.hierarchy_employee_code, { full_name: agent.full_name, kind: 'Agent' });
      }
    });
  }

  return result;
}

export default function DailyWorkPage() {
  const me = useOutletContext<StaffProfile>();
  const manager = me.role === 'md' || me.role === 'admin';

  const [portalWork, setPortalWork] = useState<PortalWork[]>([]);
  const [portalIdentityMap, setPortalIdentityMap] = useState<Map<string, PortalIdentity>>(new Map());
  const [works, setWorks] = useState<Work[]>([]);
  const [staff, setStaff] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filterDate, setFilterDate] = useState(indiaDate());
  const [filterStaff, setFilterStaff] = useState('all');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Work | null>(null);

  const [employeeId, setEmployeeId] = useState(me.user_id);
  const [date, setDate] = useState(indiaDate());
  const [category, setCategory] = useState(categories[0]);
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<Work['status']>('Completed');

  const refresh = useCallback(async () => {
    try {
      const [workResponse, staffResponse] = await Promise.all([
        supabase
          .from('employee_daily_work')
          .select('id,employee_id,work_date,category,description,status,created_at,deleted_at')
          .order('work_date', { ascending: false })
          .limit(1000),
        manager
          ? supabase
              .from('staff_profiles')
              .select('user_id,full_name,staff_no,staff_employee_no,role,active')
              .order('full_name')
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (workResponse.error) throw workResponse.error;
      if (staffResponse.error) throw staffResponse.error;

      const staffRows = (staffResponse.data ?? []) as Person[];
      setWorks((workResponse.data ?? []) as Work[]);
      setStaff(staffRows);

      if (manager) {
        const portalResponse = await supabase
          .from('id_portal_work')
          .select('id,employee_code,work_date,category,description,status,deleted_at')
          .order('work_date', { ascending: false })
          .limit(1000);

        if (!portalResponse.error) {
          const portalRows = (portalResponse.data ?? []) as PortalWork[];
          setPortalWork(portalRows);
          setPortalIdentityMap(await fetchPortalIdentityMap(portalRows.map((row) => row.employee_code)));
        }
      }
      setError('');
    } catch (err) {
      setError((err instanceof Error ? err.message : 'Unable to load daily work') + ' · Run supabase/crm_operations_migration.sql if missing.');
    } finally {
      setLoading(false);
    }
  }, [manager]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const names = useMemo(() => new Map(staff.map((person) => [person.user_id, person.full_name])), [staff]);
  const visible = works.filter(
    (work) =>
      !work.deleted_at &&
      (!filterDate || work.work_date === filterDate) &&
      (!manager || filterStaff === 'all' || work.employee_id === filterStaff),
  );
  const visiblePortalWork = portalWork.filter((work) => !work.deleted_at && (!filterDate || work.work_date === filterDate));
  const submitted = new Set(visible.map((work) => work.employee_id)).size;
  const portalSubmitted = new Set(visiblePortalWork.map((work) => work.employee_code)).size;

  function startCreate() {
    setEditing(null);
    setDate(indiaDate());
    setEmployeeId(me.user_id);
    setCategory(categories[0]);
    setDescription('');
    setStatus('Completed');
    setOpen(true);
  }

  function startEdit(work: Work) {
    setEditing(work);
    setEmployeeId(work.employee_id);
    setDate(work.work_date);
    setCategory(work.category);
    setDescription(work.description);
    setStatus(work.status);
    setOpen(true);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const payload = { work_date: date, category, description: description.trim(), status };
      const response = editing
        ? await supabase.from('employee_daily_work').update(payload).eq('id', editing.id)
        : await supabase.from('employee_daily_work').insert({ ...payload, employee_id: manager ? employeeId : me.user_id });
      if (response.error) throw response.error;
      setOpen(false);
      await refresh();
      setNotice(editing ? 'Work entry updated.' : 'Daily work saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save work');
    } finally {
      setBusy(false);
    }
  }

  async function archive(work: Work) {
    if (!manager) return;
    if (!window.confirm('Archive this work entry? An audit record will remain.')) return;
    setBusy(true);
    setError('');
    try {
      const { error: updateError } = await supabase
        .from('employee_daily_work')
        .update({ deleted_at: new Date().toISOString(), deleted_by: me.user_id })
        .eq('id', work.id);
      if (updateError) throw updateError;
      await refresh();
      setNotice('Entry archived; audit history preserved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to archive entry');
    } finally {
      setBusy(false);
    }
  }

  function download() {
    const sheet = XLSX.utils.json_to_sheet([
      ...visible.map((work) => ({
        Date: work.work_date,
        'Employee / Agent': exportSafe(names.get(work.employee_id) ?? me.full_name),
        Category: exportSafe(work.category),
        Description: exportSafe(work.description),
        Status: work.status,
        Source: 'Management work entry',
      })),
      ...visiblePortalWork.map((work) => ({
        Date: work.work_date,
        'Employee / Agent': exportSafe(portalIdentityMap.get(work.employee_code)?.full_name ?? work.employee_code),
        Category: exportSafe(work.category),
        Description: exportSafe(work.description),
        Status: work.status,
        Source: `${portalIdentityMap.get(work.employee_code)?.kind ?? 'Portal'} ID portal`,
      })),
    ]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Daily Work');
    XLSX.writeFile(book, `Sree_Sudha_Daily_Work_${filterDate || 'All'}.xlsx`);
  }

  return (
    <div className="ops-page refined-work-page">
      <header className="ops-top refined-ops-top">
        <Link to={manager ? '/agents' : '/attendance'} className="ops-brand">
          <img src="/sree-sudha-mark.png" alt="Sree Sudha home" />
          <span>
            <strong>SREE SUDHA</strong>
            <small>{manager ? 'TEAM DAILY WORK' : 'DAILY WORK REPORTS'}</small>
          </span>
        </Link>
        <div className="ops-top-actions">
          <Link to={manager ? '/agents' : '/attendance'} className="ops-link"><ArrowLeft size={16} /> Dashboard</Link>
          {manager && <><Link to="/mirai-sales" className="ops-link">MIRAI sales</Link><Link to="/management" className="ops-link">Attendance</Link></>}
        </div>
      </header>

      <main className="ops-container">
        <div className="ops-heading">
          <div>
            <span className="ops-kicker">{manager ? 'TEAM MANAGEMENT' : 'MY WORKSPACE'}</span>
            <h1>{manager ? 'Team daily work' : 'My daily work'}</h1>
            <p>{manager ? 'Review employee and agent work reports with date-wise tracking.' : 'Save your work date-wise. Records stay grouped for easy review.'}</p>
          </div>
          <button className="ops-primary" onClick={startCreate}><Plus size={17} /> Add work</button>
        </div>

        {error && <div className="ops-alert" role="alert">{error}</div>}
        {notice && <div className="ops-notice"><CheckCircle2 size={17} />{notice}</div>}

        <div className="ops-stats refined-ops-stats">
          <div><ClipboardList /><small>Entries shown</small><strong>{visible.length + visiblePortalWork.length}</strong></div>
          <div><CheckCircle2 /><small>Completed</small><strong>{visible.filter((work) => work.status === 'Completed').length + visiblePortalWork.filter((work) => work.status === 'Completed').length}</strong></div>
          <div><CalendarDays /><small>Pending / In Progress</small><strong>{visible.filter((work) => work.status !== 'Completed').length + visiblePortalWork.filter((work) => work.status !== 'Completed').length}</strong></div>
          {manager && <div><Users /><small>People submitted</small><strong>{submitted + portalSubmitted}</strong></div>}
        </div>

        <section className="ops-panel">
          <div className="ops-panel-head">
            <div>
              <h2>Management work records</h2>
              <p>Entries created inside the management CRM with full employee names.</p>
            </div>
            <button className="ops-outline" onClick={download}><Download size={16} /> Excel</button>
          </div>

          <div className="ops-filters refined-ops-filters">
            <label>Date <input type="date" value={filterDate} onChange={(event) => setFilterDate(event.target.value)} /></label>
            {manager && (
              <label>Employee
                <select value={filterStaff} onChange={(event) => setFilterStaff(event.target.value)}>
                  <option value="all">All employees</option>
                  {staff.map((person) => (
                    <option key={person.user_id} value={person.user_id}>{person.full_name} · {employeeCode(person.staff_employee_no ?? person.staff_no)}</option>
                  ))}
                </select>
              </label>
            )}
            <button className="ops-outline" onClick={() => void refresh()}><RefreshCw size={16} /> Refresh</button>
          </div>

          <div className="ops-table-wrap">
            <table className="ops-table responsive-table-cards">
              <thead>
                <tr>
                  <th>DATE</th>
                  {manager && <th>EMPLOYEE</th>}
                  <th>CATEGORY</th>
                  <th>WORK DONE</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((work) => (
                  <tr key={work.id}>
                    <td data-label="Date">{niceDate(work.work_date)}</td>
                    {manager && <td data-label="Employee"><strong>{names.get(work.employee_id) ?? 'Employee'}</strong></td>}
                    <td data-label="Category">{work.category}</td>
                    <td data-label="Work done" className="ops-work-description">{work.description}</td>
                    <td data-label="Status"><span className="ops-pill">{work.status}</span></td>
                    <td data-label="Actions">
                      <div className="ops-cell-actions wrap-actions">
                        <button aria-label="Edit work" disabled={busy} onClick={() => startEdit(work)}><Pencil size={15} /> Edit</button>
                        {manager && <button className="destructive-action" aria-label="Delete work" disabled={busy} onClick={() => void archive(work)}><Trash2 size={15} /> Delete</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!visible.length && <p className="ops-empty">{loading ? 'Loading work records…' : 'No management work reports for this date.'}</p>}
          </div>
        </section>

        {manager && (
          <section className="ops-panel">
            <div className="ops-panel-head">
              <div>
                <h2>Employee / Agent ID portal work reports</h2>
                <p>Names, IDs and work entries saved from the single Employee / Agent login page.</p>
              </div>
            </div>
            <div className="ops-table-wrap">
              <table className="ops-table responsive-table-cards">
                <thead>
                  <tr>
                    <th>DATE</th>
                    <th>NAME</th>
                    <th>EMPLOYEE ID</th>
                    <th>TYPE</th>
                    <th>CATEGORY</th>
                    <th>WORK</th>
                    <th>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePortalWork.map((work) => {
                    const identity = portalIdentityMap.get(work.employee_code);
                    return (
                      <tr key={work.id}>
                        <td data-label="Date">{niceDate(work.work_date)}</td>
                        <td data-label="Name"><strong>{identity?.full_name ?? 'Unknown'}</strong></td>
                        <td data-label="Employee ID">{work.employee_code}</td>
                        <td data-label="Type">{identity?.kind ?? 'Portal user'}</td>
                        <td data-label="Category">{work.category}</td>
                        <td data-label="Work">{work.description}</td>
                        <td data-label="Status">{work.status}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!visiblePortalWork.length && <p className="ops-empty">No Employee / Agent portal work reports yet for this date.</p>}
            </div>
          </section>
        )}
      </main>

      {open && (
        <div className="ops-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setOpen(false); }}>
          <section className="ops-modal" role="dialog" aria-modal="true">
            <div className="ops-modal-head">
              <div>
                <span className="ops-kicker">DAILY ACTIVITY</span>
                <h2>{editing ? 'Edit work entry' : 'Record completed work'}</h2>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close"><X size={20} /></button>
            </div>
            <form onSubmit={save} className="ops-form">
              {manager && !editing && (
                <label>Employee
                  <select required value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
                    {[...staff].filter((person) => person.active).map((person) => (
                      <option value={person.user_id} key={person.user_id}>{person.full_name} · {employeeCode(person.staff_employee_no ?? person.staff_no)}</option>
                    ))}
                  </select>
                </label>
              )}
              <label>Date<input required type="date" value={date} max={indiaDate()} onChange={(event) => setDate(event.target.value)} /></label>
              <label>Work category<select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((currentCategory) => <option key={currentCategory}>{currentCategory}</option>)}</select></label>
              <label>What was done?<textarea required minLength={3} maxLength={2000} rows={4} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Example: Followed up 15 customers; 3 scheduled site visits." /></label>
              <label>Status<select value={status} onChange={(event) => setStatus(event.target.value as Work['status'])}><option>Completed</option><option>In Progress</option><option>Pending</option></select></label>
              <div className="ops-modal-footer">
                <button className="ops-outline" type="button" onClick={() => setOpen(false)}>Cancel</button>
                <button className="ops-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save work'}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
