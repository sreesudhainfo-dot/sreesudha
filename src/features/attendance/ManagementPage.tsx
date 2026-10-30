import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  Download,
  GitBranch,
  Plus,
  LogOut,
  MapPin,
  RefreshCw,
  Save,
  ShieldCheck,
  UserRound,
  Users,
  TriangleAlert,
  ClipboardList,
  Building2,
  Pencil,
  Trash2,
  RotateCcw,
  X,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import type { StaffProfile } from '../auth/components/RoleGate';
import { logout } from '../auth/services/auth';
import { supabase } from '../../lib/supabase';
import { employeeCode, indiaDate, niceDate, niceTime, officeInfo } from './attendance';
import type { AttendanceRecord, Office } from './attendance';

type Tab = 'overview' | 'records' | 'team' | 'office';
interface Enrollment {
  staff_no: number;
  full_name: string;
  email: string;
  active: boolean;
  claimed_by: string | null;
  created_at: string;
}

type PortalIdentity = {
  full_name: string;
  kind: 'Employee' | 'Agent';
};

function stripFormula(value: string) {
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

export default function ManagementPage() {
  const me = useOutletContext<StaffProfile>();
  const [tab, setTab] = useState<Tab>('overview');
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [activeEmployeeIds, setActiveEmployeeIds] = useState(0);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [editingEmployee, setEditingEmployee] = useState<StaffProfile | null>(null);
  const [editEmployeeName, setEditEmployeeName] = useState('');
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [portalRecords, setPortalRecords] = useState<
    { id: string; employee_code: string; work_date: string; check_in_at: string; check_out_at: string | null }[]
  >([]);
  const [portalIdentityMap, setPortalIdentityMap] = useState<Map<string, PortalIdentity>>(new Map());
  const [office, setOffice] = useState<Office | null>(null);
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [officeName, setOfficeName] = useState('Sree Sudha Office');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const byId = useMemo(() => new Map(staff.map((member) => [member.user_id, member])), [staff]);
  const todays = records.filter((attendance) => attendance.work_date === indiaDate());
  const portalToday = portalRecords.filter((attendance) => attendance.work_date === indiaDate());
  const checkedOut =
    todays.filter((attendance) => attendance.check_out_at).length +
    portalToday.filter((attendance) => attendance.check_out_at).length;
  const dailyCount = new Set([...todays.map((attendance) => attendance.user_id), ...portalToday.map((attendance) => attendance.employee_code)]).size;
  const activeTeam = staff.filter((member) => member.active && member.role === 'staff');

  async function refresh() {
    setError('');
    try {
      const [people, attendance, settings, invites, portal, idPortalStaff] = await Promise.all([
        supabase
          .from('staff_profiles')
          .select('user_id,staff_no,staff_employee_no,agent_id,full_name,role,active')
          .order('staff_no', { ascending: true }),
        supabase
          .from('staff_attendance')
          .select('id,user_id,work_date,check_in_at,check_out_at,check_in_accuracy_m,check_out_accuracy_m')
          .order('work_date', { ascending: false })
          .limit(200),
        officeInfo(),
        supabase
          .from('staff_enrollments')
          .select('staff_no,full_name,email,active,claimed_by,created_at')
          .order('staff_no', { ascending: false }),
        supabase
          .from('id_portal_attendance')
          .select('id,employee_code,work_date,check_in_at,check_out_at')
          .order('work_date', { ascending: false })
          .limit(200),
        supabase.from('id_portal_staff').select('employee_code,full_name,active'),
      ]);

      if (people.error) throw people.error;
      if (attendance.error) throw attendance.error;

      const filteredStaff = ((people.data ?? []).filter((person) => person.role !== 'agent') as StaffProfile[]) ?? [];
      const portalRows = (portal.data ?? []) as typeof portalRecords;

      setStaff(filteredStaff);
      setRecords(attendance.data as AttendanceRecord[]);
      setPortalRecords(portalRows);
      setPortalIdentityMap(await fetchPortalIdentityMap(portalRows.map((row) => row.employee_code)));
      setActiveEmployeeIds((idPortalStaff.data ?? []).filter((row) => row.active).length);

      if (!invites.error) setEnrollments(invites.data as Enrollment[]);
      setOffice(settings);
      setLatitude(settings.latitude?.toString() ?? '');
      setLongitude(settings.longitude?.toString() ?? '');
      setOfficeName(settings.office_name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load management data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function saveOffice() {
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (
      !latitude.trim() ||
      !longitude.trim() ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      Math.abs(lat) > 90 ||
      Math.abs(lon) > 180
    ) {
      setError('Enter verified numeric latitude and longitude from your real office Maps pin.');
      return;
    }
    if (!window.confirm('Use these coordinates as the centre of the 100m attendance area? Incorrect coordinates will block attendance.')) return;

    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { data, error: updateError } = await supabase
        .from('office_settings')
        .update({ latitude: lat, longitude: lon, office_name: officeName.trim() || 'Sree Sudha Office' })
        .eq('office_id', 1)
        .select('office_id')
        .single();
      if (updateError) throw updateError;
      if (!data) throw new Error('Office settings update was not permitted.');
      await refresh();
      setNotice('Office coordinates saved successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save office coordinates.');
    } finally {
      setBusy(false);
    }
  }

  async function editEmployeeRecord(emp: StaffProfile, action: 'edit' | 'status') {
    if (emp.role !== 'staff') {
      setError('Management roles require separate permissions.');
      return;
    }
    if (action === 'edit') {
      setEditingEmployee(emp);
      setEditEmployeeName(emp.full_name);
      return;
    }
    const active = !emp.active;
    if (!window.confirm(`${active ? 'Reactivate' : 'Deactivate'} ${emp.full_name}? Attendance and work history will be retained.`)) return;

    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { error: updateError } = await supabase.rpc('manage_staff_profile', {
        p_user_id: emp.user_id,
        p_full_name: emp.full_name,
        p_active: active,
      });
      if (updateError) throw updateError;
      await refresh();
      setNotice(`Employee ${active ? 'reactivated' : 'deactivated'}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update employee.');
    } finally {
      setBusy(false);
    }
  }

  async function saveEmployeeEdit(event: FormEvent) {
    event.preventDefault();
    if (!editingEmployee) return;
    const name = editEmployeeName.trim();
    if (name.length < 2 || name.length > 120) {
      setError('Name must be 2–120 characters.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { error: updateError } = await supabase.rpc('manage_staff_profile', {
        p_user_id: editingEmployee.user_id,
        p_full_name: name,
        p_active: editingEmployee.active,
      });
      if (updateError) throw updateError;
      setEditingEmployee(null);
      await refresh();
      setNotice('Employee profile updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to edit employee.');
    } finally {
      setBusy(false);
    }
  }

  function exportRecords() {
    const rows = records.map((attendance) => ({
      Date: attendance.work_date,
      'Employee ID': employeeCode(byId.get(attendance.user_id)?.staff_employee_no ?? byId.get(attendance.user_id)?.staff_no ?? 0),
      Employee: stripFormula(byId.get(attendance.user_id)?.full_name ?? 'Unknown'),
      'Check In (IST)': niceTime(attendance.check_in_at),
      'Check Out (IST)': niceTime(attendance.check_out_at),
      Status: attendance.check_out_at ? 'Checked out' : 'Checked in',
      Source: 'Management attendance',
    }));

    rows.push(
      ...portalRecords.map((attendance) => ({
        Date: attendance.work_date,
        'Employee ID': attendance.employee_code,
        Employee: stripFormula(portalIdentityMap.get(attendance.employee_code)?.full_name ?? attendance.employee_code),
        'Check In (IST)': niceTime(attendance.check_in_at),
        'Check Out (IST)': niceTime(attendance.check_out_at),
        Status: attendance.check_out_at ? 'Checked out' : 'Checked in',
        Source: `${portalIdentityMap.get(attendance.employee_code)?.kind ?? 'Portal'} ID portal`,
      })),
    );

    const sheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Attendance');
    XLSX.writeFile(workbook, `Sree_Sudha_Attendance_${indiaDate()}.xlsx`);
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'records', label: 'Attendance records' },
    { id: 'team', label: 'Employees' },
    { id: 'office', label: 'Office location' },
  ];

  return (
    <div className="manager-workspace refined-manager-page">
      <header className="manager-header refined-manager-header">
        <Link className="manager-brand clickable-mark" to="/agents" aria-label="Sree Sudha CRM dashboard">
          <img className="company-logo header-company-logo" src="/sree-sudha-mark.png" alt="Sree Sudha" />
          <div>
            <strong>SREE SUDHA</strong>
            <small>TEAM &amp; ATTENDANCE</small>
          </div>
        </Link>

        <nav className="manager-topnav" aria-label="Management navigation">
          <Link to="/agents"><GitBranch size={17} /> Dashboard</Link>
          <Link to="/mirai-sales"><Building2 size={17} /> MIRAI sales</Link>
          <Link to="/daily-work"><ClipboardList size={17} /> Daily work</Link>
          <Link to="/agent-register" target="_blank" rel="noopener noreferrer"><Plus size={17} /> Agent signup</Link>
          <Link to="/employees"><ShieldCheck size={17} /> Employees</Link>
          <Link to="/registration-settings"><ShieldCheck size={17} /> WhatsApp Group</Link>
        </nav>

        <div className="manager-account">
          <span><ShieldCheck size={15} /> {me.role === 'md' ? 'Managing Director' : 'Administrator'}</span>
          <button onClick={() => void logout().then(() => window.location.assign('/login'))} title="Sign out" aria-label="Sign out">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="manager-main">
        <div className="manager-intro">
          <p className="att-overline">SREE SUDHA · OPERATIONS</p>
          <h1>Team &amp; attendance</h1>
          <p>Professional control for employee records, attendance history, daily work and office location.</p>
        </div>

        <div className="manager-tabs" role="tablist">
          {tabs.map((currentTab) => (
            <button
              key={currentTab.id}
              role="tab"
              aria-selected={tab === currentTab.id}
              className={tab === currentTab.id ? 'active' : ''}
              onClick={() => setTab(currentTab.id)}
            >
              {currentTab.label}
            </button>
          ))}
        </div>

        {error && <div className="att-message error"><TriangleAlert size={16} />{error}</div>}
        {notice && <div className="att-message success"><CheckCircle2 size={16} />{notice}</div>}

        {tab === 'overview' && (
          <>
            <div className="manager-stat-grid refined-stat-grid">
              <div className="manager-stat">
                <Users size={23} />
                <span>Active employee IDs</span>
                <strong>{activeEmployeeIds}</strong>
                <small>ID-based employee access</small>
              </div>
              <div className="manager-stat">
                <CalendarCheck2 size={23} />
                <span>Checked in today</span>
                <strong>{dailyCount}</strong>
                <small>{niceDate(indiaDate())}</small>
              </div>
              <div className="manager-stat">
                <Clock3 size={23} />
                <span>Currently on duty</span>
                <strong>{Math.max(0, dailyCount - checkedOut)}</strong>
                <small>Awaiting check out</small>
              </div>
              <div className="manager-stat">
                <CheckCircle2 size={23} />
                <span>Checked out today</span>
                <strong>{checkedOut}</strong>
                <small>Completed for today</small>
              </div>
            </div>

            <section className="manager-panel">
              <div className="manager-panel-head">
                <div>
                  <h2>Today&apos;s attendance</h2>
                  <p>Live attendance rows from management entries and Employee / Agent ID portal entries.</p>
                </div>
                <button className="att-refresh" onClick={() => void refresh()}><RefreshCw size={17} /> Refresh</button>
              </div>
              <RecordsTable records={todays} byId={byId} loading={loading} />
              <PortalAttendanceTable rows={portalToday} identities={portalIdentityMap} title="Employee / Agent ID portal attendance" />
            </section>
          </>
        )}

        {tab === 'records' && (
          <section className="manager-panel">
            <div className="manager-panel-head">
              <div>
                <h2>Attendance history</h2>
                <p>Latest attendance entries ordered by date, with names and Employee IDs.</p>
              </div>
              <button className="att-refresh" onClick={exportRecords} disabled={!records.length && !portalRecords.length}>
                <Download size={17} /> Excel
              </button>
            </div>
            <RecordsTable records={records} byId={byId} loading={loading} />
            <PortalAttendanceTable rows={portalRecords} identities={portalIdentityMap} title="Employee / Agent ID portal attendance" />
          </section>
        )}

        {tab === 'team' && (
          <section className="manager-panel">
            <div className="manager-panel-head">
              <div>
                <h2>Employees</h2>
                <p>Register employees, view details, edit names and deactivate or restore access.</p>
              </div>
              <Link className="attendance-button" to="/employees"><Plus size={17} /> Register employee</Link>
            </div>

            <div className="manager-info" style={{ margin: '16px 22px' }}>
              <ShieldCheck size={18} />
              Employee IDs are issued automatically. Agents use their own hierarchy-based IDs separately.
            </div>

            <div className="att-table-wrap">
              <table className="att-table responsive-table-cards">
                <thead>
                  <tr>
                    <th>EMPLOYEE</th>
                    <th>ID</th>
                    <th>ROLE</th>
                    <th>STATUS</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((member) => (
                    <tr key={member.user_id}>
                      <td data-label="Employee"><strong>{member.full_name}</strong></td>
                      <td data-label="ID">{employeeCode(member.staff_employee_no ?? member.staff_no)}</td>
                      <td data-label="Role"><span className="manager-role">{member.role === 'md' ? 'Director' : member.role === 'admin' ? 'Admin' : 'Employee'}</span></td>
                      <td data-label="Status">{member.active ? 'Active' : 'Inactive'}</td>
                      <td data-label="Actions">
                        {member.role === 'staff' ? (
                          <div className="ops-cell-actions wrap-actions">
                            <button disabled={busy} onClick={() => void editEmployeeRecord(member, 'edit')}><Pencil size={15} /> Edit</button>
                            <button className={member.active ? 'destructive-action' : ''} disabled={busy} onClick={() => void editEmployeeRecord(member, 'status')}>
                              {member.active ? <Trash2 size={15} /> : <RotateCcw size={15} />} {member.active ? 'Delete' : 'Restore'}
                            </button>
                          </div>
                        ) : 'Protected'}
                      </td>
                    </tr>
                  ))}
                  {enrollments
                    .filter((entry) => !entry.claimed_by && !staff.some((member) => member.staff_no === entry.staff_no))
                    .map((entry) => (
                      <tr key={entry.staff_no}>
                        <td data-label="Employee"><strong>{entry.full_name}</strong><p className="att-table-sub">{entry.email}</p></td>
                        <td data-label="ID">{employeeCode(entry.staff_no)}</td>
                        <td data-label="Role"><span className="manager-role">Legacy employee</span></td>
                        <td data-label="Status">{entry.active ? 'Pending setup' : 'Inactive'}</td>
                        <td data-label="Actions">Pending setup</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {staff.length === 0 && enrollments.length === 0 && <div className="att-empty">No employees have been registered.</div>}
            <p className="manager-info"><UserRound size={17} /> Management sign-in remains separate. Employees and agents use only their issued Employee ID page.</p>
          </section>
        )}

        {tab === 'office' && (
          <section className="manager-panel manager-office">
            <div className="manager-panel-head">
              <div>
                <h2>Office attendance boundary</h2>
                <p>The attendance radius is fixed to 100 metres. Management can update only the office centre coordinates.</p>
              </div>
              <span className="manager-radius"><MapPin size={16} /> 100 m</span>
            </div>

            <div className="manager-office-grid">
              <label>Office name<input value={officeName} onChange={(event) => setOfficeName(event.target.value)} placeholder="Sree Sudha Office" /></label>
              <label>Latitude<input value={latitude} onChange={(event) => setLatitude(event.target.value)} placeholder="Example: 16.000000" inputMode="decimal" /></label>
              <label>Longitude<input value={longitude} onChange={(event) => setLongitude(event.target.value)} placeholder="Example: 80.000000" inputMode="decimal" /></label>
            </div>

            <div className="manager-office-actions">
              <button className="attendance-button" disabled={busy} onClick={() => void saveOffice()}><Save size={18} />{busy ? 'Saving…' : 'Save office location'}</button>
              {office?.latitude != null && office.longitude != null && (
                <a className="att-outline-button" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${office.latitude},${office.longitude}`}>
                  <MapPin size={17} /> View saved pin
                </a>
              )}
            </div>

            <div className="manager-info">
              <MapPin size={20} />
              <p>Open the exact office entrance in Google Maps, copy the latitude and longitude, then paste them here. That point becomes the centre of the attendance boundary.</p>
            </div>
          </section>
        )}

        {editingEmployee && (
          <div className="ops-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setEditingEmployee(null); }}>
            <section className="ops-modal" role="dialog" aria-modal="true" aria-label="Edit employee">
              <div className="ops-modal-head">
                <div>
                  <span className="ops-kicker">EMPLOYEE MANAGEMENT</span>
                  <h2>Edit employee</h2>
                </div>
                <button aria-label="Close" disabled={busy} onClick={() => setEditingEmployee(null)}><X size={20} /></button>
              </div>
              <form className="ops-form" onSubmit={(event) => void saveEmployeeEdit(event)}>
                <label>Employee ID<input disabled value={employeeCode(editingEmployee.staff_employee_no ?? editingEmployee.staff_no)} readOnly /></label>
                <label>Full name<input autoFocus required minLength={2} maxLength={120} value={editEmployeeName} onChange={(event) => setEditEmployeeName(event.target.value)} /></label>
                <p className="ops-help">Employee IDs stay unchanged. Use Delete to deactivate access while keeping history safe.</p>
                <div className="ops-modal-footer">
                  <button className="ops-outline" type="button" onClick={() => setEditingEmployee(null)} disabled={busy}>Cancel</button>
                  <button className="ops-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
                </div>
              </form>
            </section>
          </div>
        )}

        <footer className="staff-footer">Sree Sudha Promoters &amp; Developers · Management access</footer>
      </main>
    </div>
  );
}

function RecordsTable({ records, byId, loading }: { records: AttendanceRecord[]; byId: Map<string, StaffProfile>; loading: boolean }) {
  if (loading) return <div className="att-empty">Loading attendance…</div>;
  if (!records.length) return <div className="att-empty">No attendance entries for this period.</div>;

  return (
    <div className="att-table-wrap">
      <table className="att-table responsive-table-cards">
        <thead>
          <tr>
            <th>EMPLOYEE</th>
            <th>DATE</th>
            <th>CHECK IN</th>
            <th>CHECK OUT</th>
            <th>STATUS</th>
          </tr>
        </thead>
        <tbody>
          {records.map((row) => (
            <tr key={row.id}>
              <td data-label="Employee">
                <strong>{byId.get(row.user_id)?.full_name ?? 'Unassigned'}</strong>
                <div className="att-table-sub">
                  {byId.get(row.user_id)
                    ? employeeCode(byId.get(row.user_id)!.staff_employee_no ?? byId.get(row.user_id)!.staff_no)
                    : '—'}
                </div>
              </td>
              <td data-label="Date">{niceDate(row.work_date)}</td>
              <td data-label="Check in">{niceTime(row.check_in_at)}</td>
              <td data-label="Check out">{niceTime(row.check_out_at)}</td>
              <td data-label="Status"><span className="att-table-status">{row.check_out_at ? 'Checked out' : 'Checked in'}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PortalAttendanceTable({
  rows,
  identities,
  title,
}: {
  rows: { id: string; employee_code: string; work_date: string; check_in_at: string; check_out_at: string | null }[];
  identities: Map<string, PortalIdentity>;
  title: string;
}) {
  if (!rows.length) return null;
  return (
    <div className="ops-table-wrap">
      <h3 className="table-subtitle">{title}</h3>
      <table className="ops-table responsive-table-cards">
        <thead>
          <tr>
            <th>NAME</th>
            <th>EMPLOYEE ID</th>
            <th>TYPE</th>
            <th>DATE</th>
            <th>CHECK IN</th>
            <th>CHECK OUT</th>
            <th>STATUS</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const identity = identities.get(row.employee_code);
            return (
              <tr key={row.id}>
                <td data-label="Name"><strong>{identity?.full_name ?? 'Unknown'}</strong></td>
                <td data-label="Employee ID">{row.employee_code}</td>
                <td data-label="Type">{identity?.kind ?? 'Portal user'}</td>
                <td data-label="Date">{niceDate(row.work_date)}</td>
                <td data-label="Check in">{niceTime(row.check_in_at)}</td>
                <td data-label="Check out">{niceTime(row.check_out_at)}</td>
                <td data-label="Status">{row.check_out_at ? 'Checked out' : 'Checked in'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
