import { BrowserRouter as Router } from 'react-router-dom';
import AppRoutes from './AppRoutes';
import ColdStartNotice from './components/ColdStartNotice';

export default function App() {
  return (
    <Router>
      <AppRoutes />
      {/* Outside the routes so a slow first request is explained on whichever
          page the visitor happens to land on. */}
      <ColdStartNotice />
    </Router>
  );
}
