import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import RoleGate from './features/auth/components/RoleGate';
import LoginPage from './features/auth/pages/LoginPage';
import StaffLoginPage from './features/auth/pages/StaffLoginPage';
import AgentLoginPage from './features/auth/pages/AgentLoginPage';
import EmployeePortalLogin from './features/auth/pages/EmployeePortalLogin';
import AgentRegistryPage from './features/agent-network/AgentRegistryPage';
import IdOnlyPortalPage from './features/attendance/IdOnlyPortalPage';
import StaffDirectoryPage from './features/attendance/StaffDirectoryPage';
import ManagementPage from './features/attendance/ManagementPage';
import PublicAgentRegistrationPage from './features/agent-registration/PublicAgentRegistrationPage';
import RegistrationGroupSettingsPage from './features/agent-registration/RegistrationGroupSettingsPage';
import BusinessPage from './features/business/BusinessPage';
import DailyWorkPage from './features/daily-work/DailyWorkPage';

export default function App() {
  return <BrowserRouter><Routes>
    <Route path="/login" element={<LoginPage/>}/>
    <Route path="/portal-login" element={<EmployeePortalLogin/>}/>
    <Route path="/staff-login" element={<StaffLoginPage/>}/>
    <Route path="/agent-login" element={<AgentLoginPage/>}/>
    <Route path="/activate-device" element={<Navigate to="/portal-login" replace/>}/>
    <Route path="/agent-register" element={<PublicAgentRegistrationPage/>}/>
    <Route element={<RoleGate home/>}><Route path="/" element={<></>}/></Route>
    <Route path="/attendance" element={<IdOnlyPortalPage kind="staff"/>}/>
    <Route path="/agent-portal" element={<IdOnlyPortalPage kind="agent"/>}/>
    <Route element={<RoleGate managerOnly/>}>
      <Route path="/management" element={<ManagementPage/>}/>
      <Route path="/employees" element={<StaffDirectoryPage/>}/>
      <Route path="/daily-work" element={<DailyWorkPage/>}/>
      <Route path="/devices" element={<Navigate to="/employees" replace/>}/>
      <Route path="/mirai-sales" element={<BusinessPage/>}/><Route path="/registration-settings" element={<RegistrationGroupSettingsPage/>}/>
      <Route path="/agents" element={<AgentRegistryPage/>}/>
      <Route path="/agent-network" element={<Navigate to="/agents?view=network" replace/>}/>
    </Route>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes></BrowserRouter>;
}
